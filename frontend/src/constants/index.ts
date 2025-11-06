// API 엔드포인트
// BASE_URL 결정 로직: (1) 런타임(app-config.json/window) → (2) 빌드타임(VITE_) → (3) 오류
import { getRuntimeApiBaseUrl, normalizeBaseUrl } from '../config/runtime';

const buildTimeBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
const buildTimeBaseNormalized = buildTimeBase && buildTimeBase.trim() ? normalizeBaseUrl(buildTimeBase) : '';

export const API_ENDPOINTS = {
  BASE_URL: buildTimeBaseNormalized || '',
  MEMBERS: '/members',
  MEMBERS_STATS: '/members/stats',
  GAMES: '/games',
  SEARCH_LOCATION: '/search-location',
  LOGIN: '/login',
  SIGNUP: '/signup',
} as const;

// 런타임에서 BASE_URL을 보장적으로 주입하기 위한 헬퍼
export async function ensureApiBaseUrl(): Promise<string> {
  // 1) 런타임 파일/전역에서 우선 획득
  const runtime = await getRuntimeApiBaseUrl();
  if (runtime) return runtime;
  // 2) 빌드타임이 있으면 사용
  if (API_ENDPOINTS.BASE_URL) return API_ENDPOINTS.BASE_URL;
  // 3) 명확한 오류 (임시 하드코딩 방지)
  throw new Error('API_BASE_URL이 설정되지 않았습니다. Vercel 환경변수(VITE_API_BASE_URL) 또는 public/app-config.json을 설정하세요.');
}

// UI 관련 상수
export const UI_CONSTANTS = {
  COLORS: {
    PRIMARY: '#004ea8',
    SECONDARY: '#f7fafc',
    SUCCESS: '#38a169',
    ERROR: '#e53e3e',
    WARNING: '#d69e2e',
    INFO: '#3182ce',
  },
  SIZES: {
    HEADER_HEIGHT: '80px',
    SIDEBAR_WIDTH: '250px',
    MAX_CONTENT_WIDTH: '1200px',
  },
  REFRESH_INTERVALS: {
    DATA_REFRESH: 30000, // 30초
    MEMBER_REFRESH: 60000, // 1분
  },
} as const;

// 게임 관련 상수
export const GAME_CONSTANTS = {
  EVENT_TYPES: ['자체', '리그', '친선경기', '토너먼트'] as const,
  MAX_PARTICIPANTS: 100,
  MIN_PARTICIPANTS: 2,
  DEFAULT_MERCENARY_COUNT: 0,
} as const;

// 멤버 관련 상수
export const MEMBER_CONSTANTS = {
  ROLES: ['ADMIN', 'USER', 'GUEST'] as const,
  STATUS: ['ACTIVE', 'SUSPENDED', 'INACTIVE', 'DELETED'] as const,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  EMAIL_MAX_LENGTH: 100,
  PHONE_MAX_LENGTH: 20,
} as const;

// 검증 정규식
export const VALIDATION_REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[0-9-+().\s]+$/,
  PASSWORD: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/,
} as const;

// 에러 메시지
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '네트워크 오류가 발생했습니다.',
  INVALID_EMAIL: '올바른 이메일 형식이 아닙니다.',
  INVALID_PHONE: '올바른 전화번호 형식이 아닙니다.',
  REQUIRED_FIELD: '필수 입력 항목입니다.',
  SERVER_ERROR: '서버 오류가 발생했습니다.',
  AUTH_FAILED: '인증에 실패했습니다.',
  ACCESS_DENIED: '접근 권한이 없습니다.',
} as const;

// 성공 메시지
export const SUCCESS_MESSAGES = {
  SAVE_SUCCESS: '저장되었습니다.',
  DELETE_SUCCESS: '삭제되었습니다.',
  UPDATE_SUCCESS: '수정되었습니다.',
  LOGIN_SUCCESS: '로그인되었습니다.',
  LOGOUT_SUCCESS: '로그아웃되었습니다.',
} as const;
