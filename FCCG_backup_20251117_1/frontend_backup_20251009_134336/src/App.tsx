import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Box } from '@chakra-ui/react';
import { useAuthStore } from './store/auth';
import { Header } from './components';
import ErrorBoundary from './components/ErrorBoundary';
import { AccessibilityProvider } from './components/AccessibilityProvider';
import { PWAInstallPrompt, PWAStatus } from './components/PWAInstallPrompt';
import InAppNotificationManager from './components/InAppNotificationManager';
import GlobalNotification from './components/GlobalNotification';
import {
  MainDashboard,
  SchedulePageV2,
  PhotoGalleryPage,
  VideoGalleryPage,
  AdminPage,
  LoginPage as Login,
  RegisterPage as Signup,
  ProfilePage,
} from './pages';

// 고급 기능들 초기화
import { initGA, trackPageView, trackUserBehavior } from './utils/analytics';
import { sessionManager } from './utils/security';
import { cacheManager } from './utils/cache';
import { backupUtils } from './utils/backup';

// 보호된 라우트 컴포넌트 (관리자 페이지, 프로필 페이지 등)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore();
  
  if (!user || !token) {
    // 로그인 페이지로 리다이렉트하면서 현재 경로 정보 전달
    return <Navigate to="/login" state={{ from: { pathname: window.location.pathname } }} replace />;
  }
  
  return <>{children}</>;
}

function AppLayout() {
  const location = useLocation();
  const hideHeader = ['/login', '/signup'].includes(location.pathname);
  const { user } = useAuthStore();

  // 고급 기능 초기화
  React.useEffect(() => {
    // Google Analytics 초기화 (Vite 환경변수 사용)
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (gaId) {
      initGA(gaId);
    }

    // 세션 관리 시작
    sessionManager.startSession();

    // 캐시 최적화
    cacheManager.cleanup();

    // 백업 최적화
    backupUtils.optimize();

    // 페이지뷰 추적
    trackPageView(location.pathname, document.title);
  }, []);

  // 페이지 변경 시 추적
  React.useEffect(() => {
    trackPageView(location.pathname, document.title);
  }, [location.pathname]);

  return (
    <Box minH="100vh" bgGradient="linear(to-br, #004ea8, #1f2937)">
      {!hideHeader && <Header />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {/* 인증이 필요 없는 공개 페이지들 */}
        <Route path="/" element={<MainDashboard />} />
        {/* 인증이 필요한 보호된 페이지들 */}
        <Route path="/schedule-v2" element={<ProtectedRoute><SchedulePageV2 /></ProtectedRoute>} />

        <Route path="/gallery/photos" element={<PhotoGalleryPage />} />
        <Route path="/gallery/videos" element={<VideoGalleryPage />} />
        {/* 인증이 필요한 보호된 페이지들 */}
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* PWA Components */}
      <PWAInstallPrompt />
      <PWAStatus />
      
      {/* 인앱 알림 관리자 */}
      {user && <InAppNotificationManager userId={user.id} />}
      
      {/* 전역 알림 시스템 */}
      <GlobalNotification />
    </Box>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AccessibilityProvider>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </AccessibilityProvider>
    </ErrorBoundary>
  );
}
