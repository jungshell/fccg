import { API_ENDPOINTS, ERROR_MESSAGES, ensureApiBaseUrl } from '../constants';
import { buildUrl } from '../config/runtime';
import { cachedApiCall, createCacheKey, createWeeklyCacheKey, invalidateCache } from './cache';

// API 기본 설정 (베이스 URL은 런타임에 보장적으로 주입)
const API_CONFIG = {
  baseURL: API_ENDPOINTS.BASE_URL,
  timeout: 10000, // 10초
  headers: {
    'Content-Type': 'application/json',
  },
};

// 에러 처리 함수
const handleApiError = (error: any): never => {
  if (error.response) {
    // 서버에서 응답한 에러
    throw new Error(error.response.data?.message || error.response.data?.error || ERROR_MESSAGES.SERVER_ERROR);
  } else if (error.request) {
    // 네트워크 에러
    throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
  } else {
    // 기타 에러
    throw new Error(error.message || ERROR_MESSAGES.SERVER_ERROR);
  }
};

// 공통 fetch 함수
const apiFetch = async (url: string, options: RequestInit = {}): Promise<any> => {
  try {
    const base = API_CONFIG.baseURL && API_CONFIG.baseURL.trim() ? API_CONFIG.baseURL : await ensureApiBaseUrl();
    API_CONFIG.baseURL = base; // 한번 구하면 캐시
    const fullUrl = buildUrl(base, url);
    
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        ...API_CONFIG.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    handleApiError(error);
  }
};

// API 함수들
export const api = {
  // 멤버 관련
  members: {
    getAll: () => cachedApiCall(
      createCacheKey('members_all'),
      () => apiFetch(API_ENDPOINTS.MEMBERS),
      10 // 10분 캐시
    ),
    getStats: () => cachedApiCall(
      createCacheKey('members_stats'),
      () => apiFetch(API_ENDPOINTS.MEMBERS_STATS),
      5 // 5분 캐시
    ),
    create: async (memberData: any) => {
      const result = await apiFetch(API_ENDPOINTS.MEMBERS, {
        method: 'POST',
        body: JSON.stringify(memberData),
      });
      // 멤버 관련 캐시 무효화
      await invalidateCache('members_');
      return result;
    },
    update: async (id: string, memberData: any) => {
      const result = await apiFetch(`${API_ENDPOINTS.MEMBERS}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(memberData),
      });
      // 멤버 관련 캐시 무효화
      await invalidateCache('members_');
      return result;
    },
    delete: async (id: string) => {
      const result = await apiFetch(`${API_ENDPOINTS.MEMBERS}/${id}`, {
        method: 'DELETE',
      });
      // 멤버 관련 캐시 무효화
      await invalidateCache('members_');
      return result;
    },
  },

  // 게임 관련
  games: {
    getAll: () => cachedApiCall(
      createWeeklyCacheKey('games_all'),
      () => apiFetch(API_ENDPOINTS.GAMES),
      15 // 15분 캐시 (주간 데이터)
    ),
    create: async (gameData: any) => {
      const result = await apiFetch(API_ENDPOINTS.GAMES, {
        method: 'POST',
        body: JSON.stringify(gameData),
      });
      // 게임 관련 캐시 무효화
      await invalidateCache('games_');
      return result;
    },
    update: async (id: string, gameData: any) => {
      const result = await apiFetch(`${API_ENDPOINTS.GAMES}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(gameData),
      });
      // 게임 관련 캐시 무효화
      await invalidateCache('games_');
      return result;
    },
    delete: async (id: string) => {
      const result = await apiFetch(`${API_ENDPOINTS.GAMES}/${id}`, {
        method: 'DELETE',
      });
      // 게임 관련 캐시 무효화
      await invalidateCache('games_');
      return result;
    },
  },

  // 인증 관련
  auth: {
    login: (credentials: any) => apiFetch(API_ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
    signup: (userData: any) => apiFetch(API_ENDPOINTS.SIGNUP, {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  },

  // 기타
  searchLocation: (query: string) => cachedApiCall(
    createCacheKey('search_location', { query }),
    () => apiFetch(`${API_ENDPOINTS.SEARCH_LOCATION}?query=${encodeURIComponent(query)}`),
    30 // 30분 캐시 (장소 검색은 자주 바뀌지 않음)
  ),
};

// 자주 사용되는 데이터 변환 함수들
export const dataTransformers = {
  // 게임 데이터 변환
  transformGameData: (game: any) => ({
    ...game,
    memberNames: game.memberNames ? JSON.parse(game.memberNames) : [],
    selectedMembers: game.selectedMembers ? JSON.parse(game.selectedMembers) : [],
    date: game.date ? new Date(game.date).toISOString().split('T')[0] : '',
  }),

  // 멤버 데이터 필터링
  getActiveMembers: (members: any[]) => 
    members.filter(member => member.status === 'ACTIVE' || member.status === 'SUSPENDED'),

  // 날짜 형식 변환
  formatDate: (date: string | Date) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },

  // 참가자 수 계산
  calculateTotalParticipants: (game: any) => {
    const memberNames = game.memberNames ? JSON.parse(game.memberNames) : [];
    const selectedMembers = game.selectedMembers ? JSON.parse(game.selectedMembers) : [];
    return (game.mercenaryCount || 0) + selectedMembers.length + memberNames.length;
  },
};
