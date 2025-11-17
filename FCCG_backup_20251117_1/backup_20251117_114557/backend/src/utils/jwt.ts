import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fc-chalggyeo-secret';

export interface JwtPayload {
  userId: number;
  role: string;
}

/**
 * JWT 토큰을 발급합니다.
 */
export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * JWT 토큰을 검증합니다.
 */
export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
