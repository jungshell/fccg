import React from 'react';

// Performance monitoring utilities
export const performanceUtils = {
  measureTime: <T>(fn: () => T, label: string): T => {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  },
  
  measureTimeAsync: async <T>(fn: () => Promise<T>, label: string): Promise<T> => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    console.log(`${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  },
  
  debounce: <T extends (...args: any[]) => any>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },
  
  throttle: <T extends (...args: any[]) => any>(func: T, limit: number): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
  
  memoize: <T extends (...args: any[]) => any>(fn: T, getKey?: (...args: Parameters<T>) => string): T => {
    const cache = new Map();
    return ((...args: Parameters<T>) => {
      const key = getKey ? getKey(...args) : JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = fn(...args);
      cache.set(key, result);
      return result;
    }) as T;
  },
  
  lazyLoad: <T extends React.ComponentType<any>>(importFunc: () => Promise<{ default: T }>, fallback?: React.ComponentType): React.LazyExoticComponent<T> => {
    return React.lazy(importFunc);
  },
  
  createIntersectionObserver: (callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}): IntersectionObserver => {
    return new IntersectionObserver(callback, options);
  },
  
  virtualScroll: {
    calculateVisibleRange: (scrollTop: number, itemHeight: number, containerHeight: number, totalItems: number) => {
      const startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(startIndex + Math.ceil(containerHeight / itemHeight) + 1, totalItems);
      return { startIndex, endIndex };
    },
    
    getVisibleItems: <T>(items: T[], startIndex: number, endIndex: number): T[] => {
      return items.slice(startIndex, endIndex);
    }
  },
  
  memory: {
    // 메모리 사용량 모니터링
    getMemoryUsage: () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        return {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
          percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
        };
      }
      return null;
    },
    
    // 메모리 누수 감지
    detectMemoryLeak: (threshold: number = 50) => {
      const usage = performanceUtils.memory.getMemoryUsage();
      if (usage && usage.percentage > threshold) {
        console.warn(`Memory usage is high: ${usage.percentage.toFixed(2)}%`);
        return true;
      }
      return false;
    },
    
    // 가비지 컬렉션 강제 실행 (개발 모드에서만)
    forceGC: () => {
      if (process.env.NODE_ENV === 'development') {
        if ('gc' in window) {
          (window as any).gc();
        }
      }
    }
  },
  
  network: {
    // 네트워크 상태 모니터링
    getNetworkInfo: () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        return {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData
        };
      }
      return null;
    },
    
    // 오프라인 상태 감지
    isOnline: () => navigator.onLine,
    
    // 네트워크 상태 변경 리스너
    onNetworkChange: (callback: (isOnline: boolean) => void) => {
      const handleOnline = () => callback(true);
      const handleOffline = () => callback(false);
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  },
  
  image: {
    // 이미지 최적화
    preloadImage: (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = src;
      });
    },
    
    // 이미지 지연 로딩
    lazyLoadImage: (element: HTMLImageElement, src: string) => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            img.src = src;
            observer.unobserve(img);
          }
        });
      });
      
      observer.observe(element);
      return observer;
    }
  }
};

// 메모리 누수 방지 유틸리티
export const memoryLeakPrevention = {
  // 이벤트 리스너 정리
  cleanupEventListeners: (element: HTMLElement | Window | Document, eventType: string, handler: EventListener) => {
    element.removeEventListener(eventType, handler);
  },
  
  // 타이머 정리
  cleanupTimers: (timers: NodeJS.Timeout[]) => {
    timers.forEach(timer => clearTimeout(timer));
  },
  
  // 인터벌 정리
  cleanupIntervals: (intervals: NodeJS.Timeout[]) => {
    intervals.forEach(interval => clearInterval(interval));
  },
  
  // AbortController 정리
  cleanupAbortController: (controller: AbortController) => {
    controller.abort();
  },
  
  // WebSocket 연결 정리
  cleanupWebSocket: (socket: WebSocket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
  },
  
  // ResizeObserver 정리
  cleanupResizeObserver: (observer: ResizeObserver) => {
    observer.disconnect();
  },
  
  // IntersectionObserver 정리
  cleanupIntersectionObserver: (observer: IntersectionObserver) => {
    observer.disconnect();
  }
};

// React 컴포넌트 최적화 훅
export const usePerformanceOptimization = () => {
  const timers: NodeJS.Timeout[] = [];
  const intervals: NodeJS.Timeout[] = [];
  const observers: (ResizeObserver | IntersectionObserver)[] = [];
  const abortControllers: AbortController[] = [];
  
  // 정리 함수
  const cleanup = () => {
    memoryLeakPrevention.cleanupTimers(timers);
    memoryLeakPrevention.cleanupIntervals(intervals);
    observers.forEach(observer => observer.disconnect());
    abortControllers.forEach(controller => controller.abort());
  };
  
  // 타이머 추가
  const addTimer = (timer: NodeJS.Timeout) => {
    timers.push(timer);
  };
  
  // 인터벌 추가
  const addInterval = (interval: NodeJS.Timeout) => {
    intervals.push(interval);
  };
  
  // 옵저버 추가
  const addObserver = (observer: ResizeObserver | IntersectionObserver) => {
    observers.push(observer);
  };
  
  // AbortController 추가
  const addAbortController = (controller: AbortController) => {
    abortControllers.push(controller);
  };
  
  return {
    cleanup,
    addTimer,
    addInterval,
    addObserver,
    addAbortController
  };
};
