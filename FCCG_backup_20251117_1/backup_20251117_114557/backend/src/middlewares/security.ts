/**
 * 보안 미들웨어
 * 기존 기능에 영향 없이 보안만 강화
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

/**
 * Helmet 보안 헤더 설정
 * 기존 기능에 영향 없이 보안만 강화
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Chakra UI 인라인 스타일 허용
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // 개발 환경용
      imgSrc: ["'self'", "data:", "https:", "http:"], // 이미지 업로드 허용
      connectSrc: ["'self'", "https:", "http:"], // API 호출 허용
    },
  },
  crossOriginEmbedderPolicy: false, // 기존 기능 호환성 유지
  crossOriginResourcePolicy: { policy: "cross-origin" }, // 이미지 업로드 허용
});

/**
 * Rate Limiting 설정
 * DDoS 방지, 기존 사용자에게는 영향 없음
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100 요청
  message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 로그인/회원가입 전용 Rate Limiter (더 엄격)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 5, // 최대 5회 시도
  message: '너무 많은 로그인 시도가 발생했습니다. 15분 후 다시 시도해주세요.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // 성공한 요청은 카운트에서 제외
});

