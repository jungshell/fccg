/**
 * API 설정 관리
 * 
 * 환경별 자동 감지 및 설정:
 * - 로컬 개발: app-config.json 또는 VITE_API_BASE_URL
 * - 프로덕션: Vercel 환경 변수 (VITE_API_BASE_URL)
 * 
 * 하드코딩 없이 환경에 따라 자동으로 올바른 API URL 사용
 */

import { getRuntimeApiBaseUrl, normalizeBaseUrl, buildUrl } from './runtime';

// 빌드 타임 환경 변수 (Vercel에서 주입)
const buildTimeBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
const buildTimeBaseNormalized = buildTimeBase && buildTimeBase.trim() 
  ? normalizeBaseUrl(buildTimeBase) 
  : '';

// 캐시된 API BASE URL
let cachedApiBaseUrl: string | null = null;

/**
 * API BASE URL을 안전하게 가져옵니다.
 * 우선순위:
 * 1. 빌드 타임 환경 변수 (VITE_API_BASE_URL) - 프로덕션 배포 시
 * 2. 런타임 설정 (app-config.json 또는 window.__APP_CONFIG__) - 로컬 개발 시
 * 3. 기본값 (로컬 개발용)
 */
export async function getApiBaseUrl(): Promise<string> {
  // 캐시된 값이 있으면 반환
  if (cachedApiBaseUrl !== null) {
    return cachedApiBaseUrl;
  }

  // 1. 빌드 타임 환경 변수 우선 (프로덕션 배포 시)
  if (buildTimeBaseNormalized) {
    cachedApiBaseUrl = buildTimeBaseNormalized;
    console.log('🔧 API BASE URL (빌드 타임):', cachedApiBaseUrl);
    return cachedApiBaseUrl;
  }

  // 2. 런타임 설정 확인 (로컬 개발 시)
  try {
    const runtime = await getRuntimeApiBaseUrl();
    if (runtime) {
      cachedApiBaseUrl = runtime;
      console.log('🔧 API BASE URL (런타임):', cachedApiBaseUrl);
      return cachedApiBaseUrl;
    }
  } catch (error) {
    console.warn('⚠️ 런타임 API BASE URL 로드 실패:', error);
  }

  // 3. 로컬 개발 기본값 (Vite 프록시 사용)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    cachedApiBaseUrl = '/api/auth';
    console.log('🔧 API BASE URL (로컬 기본값):', cachedApiBaseUrl);
    return cachedApiBaseUrl;
  }

  // 4. 오류 발생
  const error = new Error(
    'API_BASE_URL이 설정되지 않았습니다.\n\n' +
    '로컬 개발: frontend/public/app-config.json에 API_BASE_URL 설정\n' +
    '프로덕션: Vercel 환경 변수 VITE_API_BASE_URL 설정'
  );
  console.error('❌', error.message);
  throw error;
}

/**
 * API 엔드포인트를 완전한 URL로 변환합니다.
 */
export async function getApiUrl(path: string): Promise<string> {
  const baseUrl = await getApiBaseUrl();
  return buildUrl(baseUrl, path);
}

/**
 * 환경 정보를 반환합니다.
 */
export function getEnvironmentInfo() {
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  const isProduction = typeof window !== 'undefined' && 
    window.location.hostname.includes('vercel.app');

  return {
    isLocal,
    isProduction,
    buildTimeBase: buildTimeBaseNormalized || null,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
  };
}

