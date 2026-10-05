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
import { idParamSchema } from '../validators/schemas';

export const notificationRoutes = Router();

notificationRoutes.get('/', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { unreadOnly, limit = '20' } = req.query;

  let queryBuilder = client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit as string, 10));

  if (unreadOnly === 'true') {
    queryBuilder = queryBuilder.eq('read', false);
  }

  const { data, error } = await queryBuilder;

  if (error) throw ApiError.internal(error.message);

  return successResponse({ notifications: data || [] }, res);
}));

notificationRoutes.get('/unread-count', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { count, error } = await client
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw ApiError.internal(error.message);

  return successResponse({ unreadCount: count || 0 }, res);
}));

notificationRoutes.patch('/:id/read', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);

  const { error } = await client
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw ApiError.internal(error.message);

  return successResponse({ message: 'Marked as read' }, res);
}));

notificationRoutes.patch('/read-all', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { error } = await client
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw ApiError.internal(error.message);

  return successResponse({ message: 'All marked as read' }, res);
}));

notificationRoutes.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);

  const { error } = await client
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw ApiError.internal(error.message);

  return successResponse({ message: 'Notification deleted' }, res);
}));

notificationRoutes.post('/', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { title, body, type, data } = req.body as { title: string; body: string; type?: string; data?: Record<string, unknown> };

  if (!title || !body) {
    throw ApiError.badRequest('title and body are required');
  }

  const { data: notification, error } = await client
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      body,
      type: type || 'info',
      data: data || {},
      read: false,
    })
    .select()
    .single();

  if (error) throw ApiError.badRequest(error.message);

  return successResponse({ notification }, res, 201);
}));
