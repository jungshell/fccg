// 캐시 유틸리티 - IndexedDB 기반 데이터 캐싱
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class CacheManager {
  private dbName = 'FCCGByGemini_Cache';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 캐시 저장소 생성
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async set<T>(key: string, data: T, ttlMinutes: number = 5): Promise<void> {
    if (!this.db) await this.init();
    
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + (ttlMinutes * 60 * 1000)
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.put({ key, ...item });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }
        
        // 만료 확인
        if (Date.now() > result.expiry) {
          this.delete(key);
          resolve(null);
          return;
        }
        
        resolve(result.data);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 만료된 캐시 정리
  async cleanup(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const index = store.index('timestamp');
      const request = index.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (Date.now() > cursor.value.expiry) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
}

// 싱글톤 인스턴스
export const cacheManager = new CacheManager();

// 캐시 키 생성 헬퍼
export const createCacheKey = (prefix: string, params: Record<string, any> = {}): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  return sortedParams ? `${prefix}?${sortedParams}` : prefix;
};

// 주간 캐시 키 생성 (월요일 기준)
export const createWeeklyCacheKey = (prefix: string, date?: Date): string => {
  const targetDate = date || new Date();
  const monday = new Date(targetDate);
  const dayOfWeek = monday.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + daysToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const weekKey = monday.toISOString().split('T')[0];
  return `${prefix}_week_${weekKey}`;
};

// 캐시된 API 호출 래퍼
export const cachedApiCall = async <T>(
  cacheKey: string,
  apiCall: () => Promise<T>,
  ttlMinutes: number = 5
): Promise<T> => {
  // 캐시에서 먼저 확인
  const cached = await cacheManager.get<T>(cacheKey);
  if (cached) {
    console.log('📦 캐시 히트:', cacheKey);
    return cached;
  }
  
  // API 호출
  console.log('🌐 API 호출:', cacheKey);
  const data = await apiCall();
  
  // 캐시에 저장
  await cacheManager.set(cacheKey, data, ttlMinutes);
  
  return data;
};

// 캐시 무효화 헬퍼
export const invalidateCache = async (pattern: string): Promise<void> => {
  if (!cacheManager.db) await cacheManager.init();
  
  return new Promise((resolve, reject) => {
    const transaction = cacheManager.db!.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    const request = store.openCursor();
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        if (cursor.key.toString().includes(pattern)) {
          cursor.delete();
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    
    request.onerror = () => reject(request.error);
  });
};