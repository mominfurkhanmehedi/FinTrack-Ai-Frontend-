import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../config/env';
import { ApiError } from './errorHandler';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

let supabaseAuthClient: SupabaseClient | null = null;

function getSupabaseAuthClient(): SupabaseClient {
  if (!supabaseAuthClient) {
    const env = getEnv();
    supabaseAuthClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAuthClient;
}

export async function verifySupabaseToken(token: string): Promise<{ sub: string; email: string; user_metadata?: { name?: string; avatar?: string } } | null> {
  try {
    const client = getSupabaseAuthClient();
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      console.warn('[auth] Token verification failed:', error?.message ?? 'No user');
      return null;
    }
    return {
      sub: data.user.id,
      email: data.user.email ?? '',
      user_metadata: data.user.user_metadata,
    };
  } catch (error) {
    console.warn('[auth] Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    const payload = await verifySupabaseToken(token);
    if (!payload) {
      return next(ApiError.unauthorized('Invalid or expired token'));
    }

    const userId = payload.sub;
    if (!userId) {
      return next(ApiError.unauthorized('Invalid token: missing subject'));
    }

    req.userId = userId;
    req.user = {
      id: userId,
      email: payload.email as string,
      name: payload.user_metadata?.name ?? undefined,
      avatar: payload.user_metadata?.avatar ?? undefined,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuthMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return next();
    }

    const payload = await verifySupabaseToken(token);
    if (!payload || !payload.sub) {
      return next();
    }

    req.userId = payload.sub;
    req.user = {
      id: payload.sub,
      email: payload.email as string,
      name: payload.user_metadata?.name ?? undefined,
      avatar: payload.user_metadata?.avatar ?? undefined,
    };

    next();
  } catch {
    next();
  }
};

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.userId) {
    return next(ApiError.unauthorized('Authentication required'));
  }
  next();
}
