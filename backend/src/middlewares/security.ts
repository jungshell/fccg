/**
 * 보안 미들웨어
 * 기존 기능에 영향 없이 보안만 강화
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

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
const noopLimiter: RequestHandler = (_req, _res, next) => next();
const isProduction = process.env.NODE_ENV === 'production';

export const apiLimiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000, // 15분
      max: 300, // 최대 300 요청
      message: '요청이 너무 자주 발생하고 있습니다. 잠시 후 다시 시도해주세요.',
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // 헬스체크 엔드포인트는 rate limit 제외 (keepalive용)
        const path = req.path || req.url?.split('?')[0] || '';
        return path === '/health' || path === '/api/auth/health' || path.startsWith('/health');
      },
    })
  : noopLimiter;

/**
 * 로그인/회원가입 전용 Rate Limiter (더 엄격)
 */
export const authLimiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000, // 15분
      max: 15, // 최대 15회 시도
      message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true, // 성공한 요청은 카운트에서 제외
    })
  : noopLimiter;

