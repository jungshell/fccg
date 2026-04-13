import { create } from 'zustand';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  phone?: string;
  avatarUrl?: string;
  attendance?: number; // 출석률(참여율)
  voteAttendance?: number; // 투표 참여율
  voteDetails?: {
    participated: number;
    total: number;
    missed?: number;
    sessions?: Array<{
      id: number;
      weekStartDate: string;
      isActive: boolean;
      isCompleted: boolean;
      userParticipated: boolean;
      createdAt: string;
    }>;
  };
  gameDetails?: {
    participated: number;
    total: number;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  refreshUserData: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  reloadTokenFromStorage: () => void;
}

let refreshAccessTokenInFlight: Promise<boolean> | null = null;

function loadAuthFromStorage() {
  // Safety check for SSR environments
  if (typeof window === 'undefined') {
    return { user: null, token: null };
  }
  
  try {
    console.log('🔄 초기 로드 시 토큰 복구 시도...');
    
    const user = localStorage.getItem('user');
    // 여러 소스에서 토큰 찾기
    let token = localStorage.getItem('token') || 
                localStorage.getItem('auth_token_backup') || 
                sessionStorage.getItem('token');
    
    console.log('🔍 초기 로드 토큰 검색:');
    console.log('  - localStorage.token:', localStorage.getItem('token') ? '있음' : '없음');
    console.log('  - localStorage.backup:', localStorage.getItem('auth_token_backup') ? '있음' : '없음');
    console.log('  - sessionStorage.token:', sessionStorage.getItem('token') ? '있음' : '없음');
    console.log('  - 최종 토큰:', token ? `길이: ${token.length}` : '없음');
    
    // 토큰이 있으면 모든 저장소에 다시 저장
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('auth_token_backup', token);
      sessionStorage.setItem('token', token);
      console.log('✅ 초기 로드 시 토큰 복구 및 재저장 완료');
    }
    
    return {
      user: user ? JSON.parse(user) : null,
      token: token || null,
    };
  } catch (error) {
    console.error('❌ 초기 로드 시 토큰 복구 실패:', error);
    return { user: null, token: null };
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...loadAuthFromStorage(),
  setUser: (user) => {
    set({ user });
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  },
  setToken: (token) => {
    console.log('🔧 setToken 호출됨:', token ? `토큰 길이: ${token.length}` : '토큰 없음');
    set({ token });
    if (token) {
      // 여러 방법으로 토큰 저장 (백업)
      localStorage.setItem('token', token);
      localStorage.setItem('auth_token_backup', token);
      sessionStorage.setItem('token', token);
      console.log('✅ 토큰 다중 저장 완료 (localStorage, sessionStorage, backup)');
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token_backup');
      sessionStorage.removeItem('token');
      console.log('🗑️ 토큰 다중 삭제 완료');
    }
  },
  // localStorage에서 토큰을 다시 로드하는 함수 (강화된 복구 로직)
  reloadTokenFromStorage: () => {
    console.log('🔄 토큰 복구 시도 시작...');
    
    // 여러 소스에서 토큰 찾기
    let token = localStorage.getItem('token') || 
                localStorage.getItem('auth_token_backup') || 
                sessionStorage.getItem('token');
    
    const user = localStorage.getItem('user');
    
    console.log('🔍 토큰 검색 결과:');
    console.log('  - localStorage.token:', localStorage.getItem('token') ? '있음' : '없음');
    console.log('  - localStorage.backup:', localStorage.getItem('auth_token_backup') ? '있음' : '없음');
    console.log('  - sessionStorage.token:', sessionStorage.getItem('token') ? '있음' : '없음');
    console.log('  - 최종 토큰:', token ? `길이: ${token.length}` : '없음');
    console.log('🔍 사용자 정보:', user ? '있음' : '없음');
    
    if (token) {
      set({ token });
      // 복구된 토큰을 다시 모든 저장소에 저장
      localStorage.setItem('token', token);
      localStorage.setItem('auth_token_backup', token);
      sessionStorage.setItem('token', token);
      console.log('✅ 토큰 복구 및 재저장 완료');
    } else {
      console.log('❌ 모든 저장소에서 토큰을 찾을 수 없습니다');
    }
    
    if (user) {
      try {
        const parsedUser = JSON.parse(user);
        set({ user: parsedUser });
        console.log('✅ 사용자 정보 복구 완료');
      } catch (error) {
        console.error('❌ 사용자 파싱 실패:', error);
      }
    }
  },
  logout: () => {
    console.log('🚪 로그아웃 시작 - 모든 저장소에서 토큰 및 사용자 정보 제거');
    set({ user: null, token: null });
    
    // 모든 저장소에서 사용자 정보 제거
    localStorage.removeItem('user');
    
    // 모든 저장소에서 토큰 완전히 제거
    localStorage.removeItem('token');
    localStorage.removeItem('auth_token_backup');
    sessionStorage.removeItem('token');
    
    console.log('✅ 로그아웃 완료 - 모든 저장소 정리됨');
  },
  refreshUserData: async () => {
    const { token } = get();
    console.log('🔄 refreshUserData 시작 - 토큰 상태:', token ? `길이: ${token.length}` : '없음');
    
    if (!token) {
      console.log('❌ refreshUserData 실패: 토큰이 없습니다');
      return;
    }
    
    try {
      const { getProfile } = await import('../api/auth');
      const response = await getProfile();
      set({ user: response });
      localStorage.setItem('user', JSON.stringify(response));
      console.log('✅ 사용자 데이터 새로고침 완료:', response);
    } catch (error) {
      console.error('❌ 사용자 데이터 새로고침 실패:', error);
      throw error; // 에러를 다시 던져서 호출자가 처리할 수 있도록 함
    }
  },
  refreshAccessToken: async () => {
    if (refreshAccessTokenInFlight) return refreshAccessTokenInFlight;
    refreshAccessTokenInFlight = (async () => {
      try {
        const token =
          get().token ||
          (typeof window !== 'undefined'
            ? localStorage.getItem('token') ||
              localStorage.getItem('auth_token_backup') ||
              sessionStorage.getItem('token')
            : null);
        if (!token) return false;
        const { getApiUrl } = await import('../config/api');
        const url = await getApiUrl('/refresh-token');
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data?.token) return false;
        get().setToken(data.token);
        if (data.user) get().setUser(data.user);
        return true;
      } catch (e) {
        console.warn('refreshAccessToken 실패:', e);
        return false;
      } finally {
        refreshAccessTokenInFlight = null;
      }
    })();
    return refreshAccessTokenInFlight;
  },
})); 