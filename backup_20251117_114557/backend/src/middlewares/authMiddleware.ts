import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fc-chalggyeo-secret';

/**
 * JWT 토큰을 검증하고 req.user에 userId/role을 주입하는 미들웨어
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log('🔍 토큰 검증 시작:', {
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    tokenLength: token?.length || 0,
    tokenPreview: token ? token.substring(0, 20) + '...' : 'none',
    endpoint: req.path,
    method: req.method,
    fullAuthHeader: authHeader
  });
  
  if (!token) {
    console.log('❌ 토큰이 없습니다.');
    return res.status(401).json({ message: '토큰이 필요합니다.' });
  }
  
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id?: number; userId?: number; role?: string };
    console.log('✅ 토큰 검증 성공:', {
      id: payload.id,
      userId: payload.userId,
      role: payload.role,
      endpoint: req.path
    });
    req.user = { userId: payload.userId || payload.id, role: payload.role || 'USER' };
    next();
  } catch (e) {
    console.log('❌ 토큰 검증 실패:', {
      error: e.message,
      token: token.substring(0, 20) + '...',
      endpoint: req.path
    });
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
} 