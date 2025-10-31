"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
const jsonwebtoken_1 = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || 'fc-chalggyeo-secret';
/**
 * JWT 토큰을 검증하고 req.user에 userId/role을 주입하는 미들웨어
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token)
        return res.status(401).json({ message: '토큰이 필요합니다.' });
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = { userId: payload.userId, role: payload.role };
        next();
    }
    catch (e) {
        return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
    }
}
