import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface UserPayload {
      userId: number;
      role: Role | string;
    }
    interface Request {
      user?: UserPayload;
    }
  }
} 