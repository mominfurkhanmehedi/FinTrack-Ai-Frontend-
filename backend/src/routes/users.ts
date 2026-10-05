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

import { getSupabaseClient } from '../services/database';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiError, successResponse } from '../middleware/errorHandler';
import { userProfileSchema, notificationPrefsSchema } from '../validators/schemas';

export const userRoutes = Router();

userRoutes.get('/profile', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const { data: { user }, error } = await client.auth.getUser();

  if (error || !user) {
    throw ApiError.unauthorized();
  }

  const { data: profile } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return successResponse({
    user: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name,
      avatar: user.user_metadata?.avatar,
      profilePicture: profile?.profile_picture,
      currency: profile?.currency || 'INR',
      language: profile?.language || 'en',
      emergency_buffer: profile?.emergency_buffer,
      notifications: profile?.notifications || {
        transactionAlerts: true,
        budgetLimitWarnings: true,
        weeklySummary: false,
        goalReminders: true,
      },
    },
  }, res);
}));

userRoutes.patch('/profile', asyncHandler(async (req: Request, res: Response) => {
  const input = userProfileSchema.parse(req.body);
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.avatar !== undefined) updates.avatar = input.avatar;

  if (Object.keys(updates).length > 0) {
    const { error } = await client.auth.updateUser({ data: updates });
    if (error) throw ApiError.badRequest(error.message);
  }

  const { data: { user } } = await client.auth.getUser();
  return successResponse({
    user: {
      id: user!.id,
      email: user!.email,
      name: user!.user_metadata?.name,
      avatar: user!.user_metadata?.avatar,
    },
  }, res);
}));

userRoutes.get('/preferences', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { data: profile } = await client
    .from('profiles')
    .select('currency, language, emergency_buffer, notifications')
    .eq('id', userId)
    .single();

  return successResponse({
    currency: profile?.currency || 'INR',
    language: profile?.language || 'en',
    emergencyBuffer: profile?.emergency_buffer ?? null,
    notifications: profile?.notifications || {
      transactionAlerts: true,
      budgetLimitWarnings: true,
      weeklySummary: false,
      goalReminders: true,
    },
  }, res);
}));

userRoutes.patch('/preferences', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { currency, language, emergencyBuffer, notifications } = req.body as { currency?: string; language?: string; emergencyBuffer?: number | null; notifications?: Record<string, boolean> };
  const updates: Record<string, unknown> = {};

  if (currency) updates.currency = currency;
  if (language) updates.language = language;
  if (emergencyBuffer !== undefined) updates.emergency_buffer = emergencyBuffer;
  if (notifications) updates.notifications = notifications;

  const { error } = await client
    .from('profiles')
    .upsert({ id: userId, ...updates });

  if (error) throw ApiError.badRequest(error.message);

  return successResponse({ message: 'Preferences updated' }, res);
}));

userRoutes.patch('/notifications', asyncHandler(async (req: Request, res: Response) => {
  const input = notificationPrefsSchema.parse(req.body);
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { data: current } = await client
    .from('profiles')
    .select('notifications')
    .eq('id', userId)
    .single();

  const notifications = { ...(current?.notifications || {}), ...input };

  const { error } = await client
    .from('profiles')
    .upsert({ id: userId, notifications });

  if (error) throw ApiError.badRequest(error.message);

  return successResponse({ notifications }, res);
}));

userRoutes.delete('/account', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  await client.from('transactions').delete().eq('user_id', userId);
  await client.from('goals').delete().eq('user_id', userId);
  await client.from('profiles').delete().eq('id', userId);

  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) throw ApiError.internal(error.message);

  return successResponse({ message: 'Account deleted successfully' }, res);
}));
