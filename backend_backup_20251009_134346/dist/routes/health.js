"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const transaction_1 = require("../utils/transaction");
const router = express_1.default.Router();
// 헬스체크 엔드포인트
router.get('/health', async (req, res) => {
    try {
        const startTime = Date.now();
        // 데이터베이스 연결 상태 확인
        const dbConnected = await (0, transaction_1.checkDatabaseConnection)();
        const responseTime = Date.now() - startTime;
        const healthStatus = {
            status: dbConnected ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            responseTime: `${responseTime}ms`,
            services: {
                database: dbConnected ? 'connected' : 'disconnected',
                api: 'running'
            },
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        };
        const statusCode = dbConnected ? 200 : 503;
        res.status(statusCode).json(healthStatus);
    }
    catch (error) {
        console.error('헬스체크 오류:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed',
            services: {
                database: 'error',
                api: 'error'
            }
        });
    }
});
// 간단한 핑 엔드포인트
router.get('/ping', (req, res) => {
    res.json({
        message: 'pong',
        timestamp: new Date().toISOString()
    });
});
// 메트릭스 엔드포인트 (기본적인 시스템 정보)
router.get('/metrics', (req, res) => {
    const memUsage = process.memoryUsage();
    res.json({
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
        },
        cpu: {
            loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
        },
        node: {
            version: process.version,
            platform: process.platform,
            arch: process.arch
        }
    });
});
exports.default = router;
