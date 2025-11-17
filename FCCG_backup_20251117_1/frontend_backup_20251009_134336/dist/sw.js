const CACHE_NAME = 'fc-cg-v1.0.0';
const STATIC_CACHE = 'fc-cg-static-v1.0.0';
const DYNAMIC_CACHE = 'fc-cg-dynamic-v1.0.0';

// 캐시할 정적 리소스들
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/offline.html'
];

// 캐시할 API 엔드포인트들
const API_CACHE = [
  '/api/members',
  '/api/games',
  '/api/stats'
];

// 설치 시 정적 리소스 캐싱
self.addEventListener('install', (event) => {
  console.log('Service Worker 설치 중...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('정적 리소스 캐싱 중...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker 설치 완료');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker 설치 실패:', error);
      })
  );
});

// 활성화 시 이전 캐시 정리
self.addEventListener('activate', (event) => {
  console.log('Service Worker 활성화 중...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('이전 캐시 삭제:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker 활성화 완료');
        return self.clients.claim();
      })
  );
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // API 요청 처리
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // 정적 리소스 요청 처리
  if (request.method === 'GET') {
    event.respondWith(handleStaticRequest(request));
    return;
  }
});

// API 요청 처리 (네트워크 우선, 캐시 폴백)
async function handleApiRequest(request) {
  try {
    // 투표/프로필/통계는 항상 네트워크 직행, 캐시 금지
    const url = new URL(request.url);
    const noStorePaths = ['/api/votes', '/api/auth/profile', '/api/members/stats'];
    const bypass = noStorePaths.some(p => url.pathname.startsWith(p));

    // 네트워크 요청 시도
    const networkResponse = await fetch(request, bypass ? { cache: 'no-store' } : undefined);
    
    // GET 요청만 캐시에 저장 (POST/DELETE/PUT은 캐싱하지 않음)
    if (!bypass && networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('네트워크 요청 실패, 캐시에서 검색:', request.url);
    
    // 캐시에서 검색
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 캐시에도 없으면 오프라인 응답
    return new Response(
      JSON.stringify({ 
        error: '오프라인 상태입니다. 인터넷 연결을 확인해주세요.',
        offline: true 
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// 정적 리소스 요청 처리 (캐시 우선, 네트워크 폴백)
async function handleStaticRequest(request) {
  // 캐시에서 먼저 검색
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // 네트워크 요청 시도
    const networkResponse = await fetch(request);
    
    // 성공하면 캐시에 저장
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('정적 리소스 요청 실패:', request.url);
    
    // HTML 요청이면 오프라인 페이지 반환
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/offline.html');
    }
    
    // 이미지 요청이면 기본 이미지 반환
    if (request.headers.get('accept')?.includes('image/')) {
      return caches.match('/icons/icon-192x192.png');
    }
    
    // 기타 요청은 빈 응답
    return new Response('', { status: 404 });
  }
}

// 백그라운드 동기화
self.addEventListener('sync', (event) => {
  console.log('백그라운드 동기화:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

// 백그라운드 동기화 수행
async function performBackgroundSync() {
  try {
    // 오프라인 중 저장된 데이터 동기화
    const offlineData = await getOfflineData();
    
    for (const data of offlineData) {
      try {
        await fetch(data.url, {
          method: data.method,
          headers: data.headers,
          body: data.body
        });
        
        // 성공하면 오프라인 데이터 삭제
        await removeOfflineData(data.id);
      } catch (error) {
        console.error('백그라운드 동기화 실패:', error);
      }
    }
  } catch (error) {
    console.error('백그라운드 동기화 오류:', error);
  }
}

// 푸시 알림 처리
self.addEventListener('push', (event) => {
  console.log('푸시 알림 수신:', event);
  
  const options = {
    body: event.data?.text() || '새로운 알림이 있습니다.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '확인하기',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/icons/icon-96x96.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('FC CG', options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('알림 클릭:', event);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// IndexedDB를 사용한 오프라인 데이터 관리
async function getOfflineData() {
  return new Promise((resolve) => {
    const request = indexedDB.open('FC_CG_Offline', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offlineData')) {
        db.createObjectStore('offlineData', { keyPath: 'id', autoIncrement: true });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['offlineData'], 'readonly');
      const store = transaction.objectStore('offlineData');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result);
      };
    };
    
    request.onerror = () => {
      resolve([]);
    };
  });
}

async function saveOfflineData(data) {
  return new Promise((resolve) => {
    const request = indexedDB.open('FC_CG_Offline', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offlineData')) {
        db.createObjectStore('offlineData', { keyPath: 'id', autoIncrement: true });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const addRequest = store.add(data);
      
      addRequest.onsuccess = () => {
        resolve(addRequest.result);
      };
    };
    
    request.onerror = () => {
      resolve(null);
    };
  });
}

async function removeOfflineData(id) {
  return new Promise((resolve) => {
    const request = indexedDB.open('FC_CG_Offline', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => {
        resolve(true);
      };
    };
    
    request.onerror = () => {
      resolve(false);
    };
  });
}
