"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'fc-chalggyeo-secret';
const prisma = new client_1.PrismaClient();
/**
 * JWT 토큰을 검증하고 req.user에 userId/role을 주입하는 미들웨어
 */
function authenticateToken(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        console.log('🔐 authenticateToken 호출:', {
            path: req.path,
            method: req.method,
            hasAuthHeader: !!req.headers['authorization']
        });
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token)
            return res.status(401).json({ message: '토큰이 필요합니다.' });
        try {
            const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            const userId = payload.userId || payload.id;
            let role = payload.role;
            if (!role && userId) {
                console.log('ℹ️ 토큰에 role 정보 없음, DB 조회 시도:', { userId });
                const user = yield prisma.user.findUnique({
                    where: { id: userId },
                    select: { role: true }
                });
                role = ((_a = user === null || user === void 0 ? void 0 : user.role) !== null && _a !== void 0 ? _a : 'MEMBER');
                console.log('ℹ️ DB에서 role 확인:', role);
            }
            console.log('✅ 토큰 검증 성공:', {
                id: payload.id,
                userId,
                role,
                endpoint: req.path
            });
            req.user = { userId, role: role || 'USER' };
            next();
        }
        catch (e) {
            console.log('❌ 토큰 검증 실패:', {
                error: e.message,
                endpoint: req.path
            });
            return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
        }
    });
}
