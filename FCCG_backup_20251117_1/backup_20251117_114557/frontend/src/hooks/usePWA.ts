import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@chakra-ui/react';

interface PWAInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
  isInstalled: boolean;
  isInstallable: boolean;
  isOnline: boolean;
  isServiceWorkerReady: boolean;
  isPushSupported: boolean;
  isNotificationSupported: boolean;
}

export const usePWA = () => {
  const [pwaState, setPwaState] = useState<PWAState>({
    isInstalled: false,
    isInstallable: false,
    isOnline: navigator.onLine,
    isServiceWorkerReady: false,
    isPushSupported: 'serviceWorker' in navigator && 'PushManager' in window,
    isNotificationSupported: 'Notification' in window
  });

  const [deferredPrompt, setDeferredPrompt] = useState<PWAInstallPromptEvent | null>(null);
  const toast = useToast();

  // Service Worker 등록
  const registerServiceWorker = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker 등록 성공:', registration);
        
        setPwaState(prev => ({ ...prev, isServiceWorkerReady: true }));
        
        // 업데이트 확인
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                toast({
                  title: '새로운 업데이트가 있습니다',
                  description: '페이지를 새로고침하여 최신 버전을 사용하세요.',
                  status: 'info',
                  duration: 5000,
                  isClosable: true,
                });
              }
            });
          }
        });
        
        return registration;
      } catch (error) {
        console.error('Service Worker 등록 실패:', error);
        return null;
      }
    }
    return null;
  }, [toast]);

  // 설치 프롬프트 처리
  const handleInstallPrompt = useCallback((event: PWAInstallPromptEvent) => {
    event.preventDefault();
    setDeferredPrompt(event);
    setPwaState(prev => ({ ...prev, isInstallable: true }));
    
    toast({
      title: '앱 설치 가능',
      description: '홈 화면에 FC CG 앱을 설치할 수 있습니다.',
      status: 'info',
      duration: 8000,
      isClosable: true,
    });
  }, [toast]);

  // 앱 설치
  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      toast({
        title: '설치 불가',
        description: '앱을 설치할 수 없습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setPwaState(prev => ({ 
          ...prev, 
          isInstalled: true, 
          isInstallable: false 
        }));
        
        toast({
          title: '설치 완료',
          description: 'FC CG 앱이 성공적으로 설치되었습니다!',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        
        setDeferredPrompt(null);
        return true;
      } else {
        toast({
          title: '설치 취소',
          description: '앱 설치가 취소되었습니다.',
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
        return false;
      }
    } catch (error) {
      console.error('앱 설치 실패:', error);
      toast({
        title: '설치 실패',
        description: '앱 설치 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }
  }, [deferredPrompt, toast]);

  // 푸시 알림 권한 요청
  const requestNotificationPermission = useCallback(async () => {
    if (!pwaState.isPushSupported) {
      toast({
        title: '지원되지 않음',
        description: '이 브라우저는 푸시 알림을 지원하지 않습니다.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        toast({
          title: '알림 권한 허용',
          description: '푸시 알림을 받을 수 있습니다.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        return true;
      } else {
        toast({
          title: '알림 권한 거부',
          description: '설정에서 알림 권한을 허용해주세요.',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
        return false;
      }
    } catch (error) {
      console.error('알림 권한 요청 실패:', error);
      return false;
    }
  }, [pwaState.isPushSupported, toast]);

  // 푸시 알림 구독
  const subscribeToPushNotifications = useCallback(async () => {
    if (!pwaState.isPushSupported || !pwaState.isServiceWorkerReady) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY
      });
      
      console.log('푸시 알림 구독 성공:', subscription);
      
      // 서버에 구독 정보 전송
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription)
      });
      
      toast({
        title: '푸시 알림 구독 완료',
        description: '새로운 알림을 받을 수 있습니다.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      return true;
    } catch (error) {
      console.error('푸시 알림 구독 실패:', error);
      toast({
        title: '구독 실패',
        description: '푸시 알림 구독에 실패했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }
  }, [pwaState.isPushSupported, pwaState.isServiceWorkerReady, toast]);

  // 오프라인 데이터 동기화
  const syncOfflineData = useCallback(async () => {
    if (!pwaState.isServiceWorkerReady) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('background-sync');
      
      toast({
        title: '동기화 시작',
        description: '오프라인 데이터를 동기화합니다.',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      
      return true;
    } catch (error) {
      console.error('백그라운드 동기화 실패:', error);
      return false;
    }
  }, [pwaState.isServiceWorkerReady, toast]);

  // 앱 업데이트 확인
  const checkForUpdates = useCallback(async () => {
    if (!pwaState.isServiceWorkerReady) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      
      toast({
        title: '업데이트 확인',
        description: '앱 업데이트를 확인했습니다.',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      
      return true;
    } catch (error) {
      console.error('업데이트 확인 실패:', error);
      return false;
    }
  }, [pwaState.isServiceWorkerReady, toast]);

  // 초기화
  useEffect(() => {
    // Service Worker 등록 (완전 비활성화)
    // registerServiceWorker();

    // 설치 프롬프트 이벤트 리스너
    window.addEventListener('beforeinstallprompt', handleInstallPrompt as EventListener);

    // 앱 설치 완료 이벤트 리스너
    window.addEventListener('appinstalled', () => {
      setPwaState(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
      setDeferredPrompt(null);
    });

    // 온라인/오프라인 상태 변경 리스너
    const handleOnline = () => setPwaState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setPwaState(prev => ({ ...prev, isOnline: false }));
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 앱이 설치되었는지 확인
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setPwaState(prev => ({ ...prev, isInstalled: true }));
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt as EventListener);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [registerServiceWorker, handleInstallPrompt]);

  return {
    ...pwaState,
    installApp,
    requestNotificationPermission,
    subscribeToPushNotifications,
    syncOfflineData,
    checkForUpdates,
  };
};
