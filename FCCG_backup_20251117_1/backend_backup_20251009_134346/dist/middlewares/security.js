"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokenMiddleware = exports.apiRateLimit = exports.loginRateLimit = exports.validateInput = exports.corsOptions = exports.securityHeaders = exports.createRateLimit = exports.requireRole = exports.requireAdmin = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// 인증 토큰 미들웨어 (표준화)
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                error: 'ACCESS_TOKEN_REQUIRED',
                message: '액세스 토큰이 필요합니다.'
            });
        }
        // JWT 토큰 검증
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'fc-chalggyeo-secret');
        // 사용자 존재 여부 확인
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                status: true,
                lastLoginAt: true
            }
        });
        if (!user) {
            return res.status(401).json({
                error: 'USER_NOT_FOUND',
                message: '사용자를 찾을 수 없습니다.'
            });
        }
        // 사용자 상태 확인
        if (user.status === 'SUSPENDED') {
            return res.status(403).json({
                error: 'ACCOUNT_SUSPENDED',
                message: '계정이 정지되었습니다.'
            });
        }
        if (user.status === 'INACTIVE') {
            return res.status(403).json({
                error: 'ACCOUNT_INACTIVE',
                message: '비활성 계정입니다.'
            });
        }
        // 요청 객체에 사용자 정보 추가
        req.user = {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status
        };
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return res.status(401).json({
                error: 'INVALID_TOKEN',
                message: '유효하지 않은 토큰입니다.'
            });
        }
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return res.status(401).json({
                error: 'TOKEN_EXPIRED',
                message: '토큰이 만료되었습니다.'
            });
        }
        console.error('인증 미들웨어 오류:', error);
        return res.status(500).json({
            error: 'AUTHENTICATION_ERROR',
            message: '인증 처리 중 오류가 발생했습니다.'
        });
    }
};
exports.authenticateToken = authenticateToken;
// 관리자 권한 확인 미들웨어
const requireAdmin = (req, res, next) => {
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({
            error: 'ADMIN_REQUIRED',
            message: '관리자 권한이 필요합니다.'
        });
    }
    next();
};
exports.requireAdmin = requireAdmin;
// 역할 기반 접근 제어 미들웨어
const requireRole = (roles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user || !roles.includes(user.role)) {
            return res.status(403).json({
                error: 'INSUFFICIENT_PERMISSIONS',
                message: '권한이 부족합니다.'
            });
        }
        next();
    };
};
exports.requireRole = requireRole;
// API 요청 제한 미들웨어
const createRateLimit = (windowMs, max, message) => {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max,
        message: {
            error: 'RATE_LIMIT_EXCEEDED',
            message: message || '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            console.log(`🚫 Rate limit exceeded for IP: ${req.ip}`);
            res.status(429).json({
                error: 'RATE_LIMIT_EXCEEDED',
                message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
            });
        }
    });
};
exports.createRateLimit = createRateLimit;
// 보안 헤더 미들웨어
exports.securityHeaders = (0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});
// CORS 설정
exports.corsOptions = {
    origin: (origin, callback) => {
        // 개발 환경에서는 모든 origin 허용
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        // 프로덕션 환경에서는 특정 origin만 허용
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:3000',
            process.env.FRONTEND_URL
        ].filter(Boolean);
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('CORS 정책에 의해 차단되었습니다.'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};
// 입력 검증 미들웨어
const validateInput = (schema) => {
    return (req, res, next) => {
        try {
            const { error } = schema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: error.details[0].message
                });
            }
            next();
        }
        catch (err) {
            return res.status(500).json({
                error: 'VALIDATION_ERROR',
                message: '입력 검증 중 오류가 발생했습니다.'
            });
        }
    };
};
exports.validateInput = validateInput;
// 로그인 시도 제한 미들웨어
exports.loginRateLimit = (0, exports.createRateLimit)(15 * 60 * 1000, // 15분
5, // 최대 5회 시도
'로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.');
// API 요청 제한 미들웨어
exports.apiRateLimit = (0, exports.createRateLimit)(15 * 60 * 1000, // 15분
100, // 최대 100회 요청
'API 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
// 토큰 갱신 미들웨어
const refreshTokenMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return next();
        }
        // 토큰 만료 시간 확인 (30분 이내면 갱신)
        const decoded = jsonwebtoken_1.default.decode(token);
        if (decoded && decoded.exp) {
            const now = Math.floor(Date.now() / 1000);
            const timeUntilExpiry = decoded.exp - now;
            if (timeUntilExpiry < 30 * 60 && timeUntilExpiry > 0) { // 30분 이내
                const newToken = jsonwebtoken_1.default.sign({
                    userId: decoded.userId,
                    email: decoded.email,
                    role: decoded.role
                }, process.env.JWT_SECRET || 'fc-chalggyeo-secret', { expiresIn: '24h' });
                res.setHeader('X-New-Token', newToken);
            }
        }
        next();
    }
    catch (error) {
        next();
    }
};
exports.refreshTokenMiddleware = refreshTokenMiddleware;
