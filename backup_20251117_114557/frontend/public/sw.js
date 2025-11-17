// Service Worker 비활성화
// 모든 요청을 그대로 통과시킴

console.log('Service Worker 비활성화됨');

// 빈 이벤트 리스너들
self.addEventListener('install', () => {
  console.log('Service Worker 설치됨 (비활성화)');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('Service Worker 활성화됨 (비활성화)');
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 모든 요청을 그대로 통과
  return;
});