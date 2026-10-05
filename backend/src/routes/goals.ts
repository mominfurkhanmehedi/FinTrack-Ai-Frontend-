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
import { goalSchema, goalUpdateSchema, queryGoalsSchema, idParamSchema } from '../validators/schemas';

export const goalRoutes = Router();

goalRoutes.get('/', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const query = queryGoalsSchema.parse(req.query);

  let queryBuilder = client
    .from('goals')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (query.status === 'active') {
    queryBuilder = queryBuilder.filter('saved', 'lt', 'target');
  } else if (query.status === 'completed') {
    queryBuilder = queryBuilder.filter('saved', 'gte', 'target');
  }

  const from = (query.page - 1) * query.limit;
  const to = from + query.limit - 1;
  queryBuilder = queryBuilder.range(from, to);

  const { data, error, count } = await queryBuilder;

  if (error) throw ApiError.internal(error.message);

  return successResponse({
    goals: data || [],
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / query.limit),
    },
  }, res);
}));

goalRoutes.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);

  const { data, error } = await client
    .from('goals')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw ApiError.notFound('Goal not found');
  }

  return successResponse({ goal: data }, res);
}));

goalRoutes.post('/', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const input = goalSchema.parse(req.body);

  const { data: profile } = await client
    .from('profiles')
    .select('currency')
    .eq('id', userId)
    .single();

  const currency = input.currency || profile?.currency || 'INR';

  const { data, error } = await client
    .from('goals')
    .insert({
      user_id: userId,
      title: input.title,
      target: input.target,
      saved: input.saved,
      deadline: input.deadline || null,
      currency,
    })
    .select()
    .single();

  if (error) throw ApiError.badRequest(error.message);

  return successResponse({ goal: data }, res, 201);
}));

goalRoutes.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);
  const input = goalUpdateSchema.parse(req.body);

  const { data: existing } = await client
    .from('goals')
    .select('currency')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!existing) {
    throw ApiError.notFound('Goal not found');
  }

  const updates: Record<string, unknown> = { ...input };
  updates.currency = existing.currency;

  const { data, error } = await client
    .from('goals')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw ApiError.badRequest(error.message);

  return successResponse({ goal: data }, res);
}));

goalRoutes.post('/:id/contribute', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);
  const { amount } = req.body as { amount: number };

  if (!amount || amount <= 0) {
    throw ApiError.badRequest('Amount must be positive');
  }

  const { data: goal } = await client
    .from('goals')
    .select('saved, target, currency')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!goal) {
    throw ApiError.notFound('Goal not found');
  }

  const newSaved = Math.min(goal.saved + amount, goal.target);

  const { data, error } = await client
    .from('goals')
    .update({ saved: newSaved })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw ApiError.badRequest(error.message);

  return successResponse({ goal: data }, res);
}));

goalRoutes.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);

  const { error } = await client
    .from('goals')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw ApiError.internal(error.message);

  return successResponse({ message: 'Goal deleted' }, res);
}));
