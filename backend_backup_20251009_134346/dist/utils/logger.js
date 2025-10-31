"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSystemEvent = exports.logUserAction = exports.logErrorWithContext = exports.logPerformance = exports.logSecurityEvent = exports.logBusinessEvent = exports.logDatabaseQuery = exports.requestLogger = exports.logDebug = exports.logHttp = exports.logInfo = exports.logWarn = exports.logError = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
// 로그 레벨 정의
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// 로그 색상 정의
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};
// winston에 색상 추가
winston_1.default.addColors(logColors);
// 로그 포맷 정의
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`));
// 파일 로그 포맷 (색상 제거)
const fileLogFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
// 로그 파일 경로
const logDir = path_1.default.join(process.cwd(), 'logs');
// Winston 로거 생성
const logger = winston_1.default.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    levels: logLevels,
    format: fileLogFormat,
    transports: [
        // 에러 로그 파일
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // 모든 로그 파일
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});
// 개발 환경에서는 콘솔에도 출력
if (process.env.NODE_ENV === 'development') {
    logger.add(new winston_1.default.transports.Console({
        format: logFormat,
    }));
}
// 로그 레벨별 헬퍼 함수들
const logError = (message, error, meta) => {
    logger.error(message, { error: error?.stack || error, ...meta });
};
exports.logError = logError;
const logWarn = (message, meta) => {
    logger.warn(message, meta);
};
exports.logWarn = logWarn;
const logInfo = (message, meta) => {
    logger.info(message, meta);
};
exports.logInfo = logInfo;
const logHttp = (message, meta) => {
    logger.http(message, meta);
};
exports.logHttp = logHttp;
const logDebug = (message, meta) => {
    logger.debug(message, meta);
};
exports.logDebug = logDebug;
// API 요청 로깅 미들웨어
const requestLogger = (req, res, next) => {
    const start = Date.now();
    // 응답 완료 시 로그 기록
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.userId,
        };
        if (res.statusCode >= 400) {
            (0, exports.logError)(`HTTP ${res.statusCode}`, null, logData);
        }
        else {
            (0, exports.logHttp)(`HTTP ${res.statusCode}`, logData);
        }
    });
    next();
};
exports.requestLogger = requestLogger;
// 데이터베이스 쿼리 로깅
const logDatabaseQuery = (query, params, duration) => {
    (0, exports.logDebug)('Database Query', {
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        params,
        duration: duration ? `${duration}ms` : undefined,
    });
};
exports.logDatabaseQuery = logDatabaseQuery;
// 비즈니스 로직 로깅
const logBusinessEvent = (event, data) => {
    (0, exports.logInfo)(`Business Event: ${event}`, data);
};
exports.logBusinessEvent = logBusinessEvent;
// 보안 이벤트 로깅
const logSecurityEvent = (event, data) => {
    (0, exports.logWarn)(`Security Event: ${event}`, data);
};
exports.logSecurityEvent = logSecurityEvent;
// 성능 메트릭 로깅
const logPerformance = (operation, duration, meta) => {
    if (duration > 1000) { // 1초 이상인 경우만 로그
        (0, exports.logWarn)(`Slow Operation: ${operation}`, {
            duration: `${duration}ms`,
            ...meta,
        });
    }
    else {
        (0, exports.logDebug)(`Performance: ${operation}`, {
            duration: `${duration}ms`,
            ...meta,
        });
    }
};
exports.logPerformance = logPerformance;
// 에러 추적
const logErrorWithContext = (error, context) => {
    (0, exports.logError)('Application Error', error, {
        context,
        stack: error.stack,
        name: error.name,
        message: error.message,
    });
};
exports.logErrorWithContext = logErrorWithContext;
// 사용자 액션 로깅
const logUserAction = (action, userId, data) => {
    (0, exports.logInfo)(`User Action: ${action}`, {
        userId,
        action,
        timestamp: new Date().toISOString(),
        ...data,
    });
};
exports.logUserAction = logUserAction;
// 시스템 이벤트 로깅
const logSystemEvent = (event, data) => {
    (0, exports.logInfo)(`System Event: ${event}`, {
        event,
        timestamp: new Date().toISOString(),
        ...data,
    });
};
exports.logSystemEvent = logSystemEvent;
exports.default = logger;
