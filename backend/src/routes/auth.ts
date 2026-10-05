import { Router, type Request, type Response, type NextFunction } from 'express';
import { AuthUser } from '../middleware/auth';

declare module 'express' {
  interface Request {
    user?: AuthUser;
    userId?: string;
    params: Record<string, string>;
    query: Record<string, string | string[] | undefined>;
    headers: {
      authorization?: string;
      [key: string]: string | string[] | undefined;
    };
    body: unknown;
  }
}

import { getEnv } from '../config/env';
import { getSupabaseAdmin } from '../services/database';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiError, successResponse } from '../middleware/errorHandler';
import { z } from 'zod';

export const authRoutes = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  token: z.string().length(6),
});

const resendOtpSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
});

authRoutes.post('/signup', asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = signupSchema.parse(req.body);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name.trim() },
  });

  if (error || !data.user) {
    throw ApiError.badRequest(error?.message ?? 'Could not create account');
  }

  return successResponse({
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name,
    },
    session: null,
  }, res, 201);
}));

authRoutes.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    throw ApiError.unauthorized(error?.message ?? 'Invalid email or password');
  }

  return successResponse({
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name,
      avatar: data.user.user_metadata?.avatar,
    },
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
  }, res);
}));

authRoutes.post('/verify-otp', asyncHandler(async (req: Request, res: Response) => {
  const { email, token } = verifyOtpSchema.parse(req.body);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });

  if (error || !data.session || !data.user) {
    throw ApiError.unauthorized(error?.message ?? 'Invalid or expired code');
  }

  return successResponse({
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name,
      avatar: data.user.user_metadata?.avatar,
    },
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
  }, res);
}));

authRoutes.post('/resend-otp', asyncHandler(async (req: Request, res: Response) => {
  const { email } = resendOtpSchema.parse(req.body);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.auth.resend({ type: 'signup', email });

  if (error) {
    throw ApiError.badRequest(error.message);
  }

  return successResponse({ message: 'Confirmation code resent' }, res);
}));

authRoutes.post('/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const { email } = resetPasswordSchema.parse(req.body);
  const supabase = getSupabaseAdmin();

  const env = getEnv();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.FRONTEND_URL}/reset-password`,
  });

  if (error) {
    throw ApiError.badRequest(error.message);
  }

  return successResponse({ message: 'Password reset link sent' }, res);
}));

authRoutes.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabaseAdmin();
  const token = req.headers.authorization?.split(' ')[1];

  if (token) {
    await supabase.auth.signOut();
  }

  return successResponse({ message: 'Logged out successfully' }, res);
}));

authRoutes.get('/me', asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    throw ApiError.unauthorized();
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  return successResponse({
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name,
      avatar: data.user.user_metadata?.avatar,
      email_confirmed_at: data.user.email_confirmed_at,
    },
  }, res);
}));
