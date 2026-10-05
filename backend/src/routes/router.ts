import { Router, type Request, type Response, type NextFunction } from 'express';
import { type AuthUser } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      userId?: string;
    }
  }
}

export const router = Router();

// Type assertion helper for route handlers
export function handler<T extends Request = Request>(
  fn: (req: T & { user?: AuthUser; userId?: string; params: Record<string, string>; query: Record<string, string | string[] | undefined>; headers: { authorization?: string; [key: string]: string | string[] | undefined } }, res: Response, next: NextFunction) => Promise<unknown>
) {
  return fn as any;
}
