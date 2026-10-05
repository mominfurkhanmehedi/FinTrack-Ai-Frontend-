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
import { transactionSchema, transactionUpdateSchema, queryTransactionsSchema, idParamSchema } from '../validators/schemas';

export const transactionRoutes = Router();

transactionRoutes.get('/', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const query = queryTransactionsSchema.parse(req.query);

  let queryBuilder = client
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (query.type) queryBuilder = queryBuilder.eq('type', query.type);
  if (query.category) queryBuilder = queryBuilder.eq('category', query.category);
  if (query.startDate) queryBuilder = queryBuilder.gte('date', query.startDate);
  if (query.endDate) queryBuilder = queryBuilder.lte('date', query.endDate);
  if (query.minAmount !== undefined) queryBuilder = queryBuilder.gte('amount', query.minAmount);
  if (query.maxAmount !== undefined) queryBuilder = queryBuilder.lte('amount', query.maxAmount);

  const from = (query.page - 1) * query.limit;
  const to = from + query.limit - 1;
  queryBuilder = queryBuilder.range(from, to);

  const { data, error, count } = await queryBuilder;

  if (error) throw ApiError.internal(error.message);

  return successResponse({
    transactions: data || [],
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / query.limit),
    },
  }, res);
}));

transactionRoutes.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);

  const { data, error } = await client
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw ApiError.notFound('Transaction not found');
  }

  return successResponse({ transaction: data }, res);
}));

transactionRoutes.post('/', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const input = transactionSchema.parse(req.body);

  const { data: profile } = await client
    .from('profiles')
    .select('currency')
    .eq('id', userId)
    .single();

  const currency = input.currency || profile?.currency || 'INR';

  const { data, error } = await client
    .from('transactions')
    .insert({
      user_id: userId,
      title: input.title,
      amount: input.amount,
      type: input.type,
      category: input.category,
      date: input.date,
      currency,
    })
    .select()
    .single();

  if (error) throw ApiError.badRequest(error.message);

  return successResponse({ transaction: data }, res, 201);
}));

transactionRoutes.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);
  const input = transactionUpdateSchema.parse(req.body);

  const { data: existing } = await client
    .from('transactions')
    .select('currency')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!existing) {
    throw ApiError.notFound('Transaction not found');
  }

  const updates: Record<string, unknown> = { ...input };
  if (input.amount !== undefined) {
    updates.amount = input.amount;
  }
  updates.currency = existing.currency;

  const { data, error } = await client
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw ApiError.badRequest(error.message);

  return successResponse({ transaction: data }, res);
}));

transactionRoutes.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);

  const { error } = await client
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw ApiError.internal(error.message);

  return successResponse({ message: 'Transaction deleted' }, res);
}));

transactionRoutes.get('/categories/list', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { data, error } = await client
    .from('transactions')
    .select('category, type')
    .eq('user_id', userId);

  if (error) throw ApiError.internal(error.message);

  const categories = [...new Set(data?.map(t => t.category) || [])].sort();
  const categoriesByType = (data || []).reduce((acc, t) => {
    if (!acc[t.type]) acc[t.type] = [];
    if (!acc[t.type].includes(t.category)) acc[t.type].push(t.category);
    return acc;
  }, {} as Record<string, string[]>);

  return successResponse({ categories, categoriesByType }, res);
}));

transactionRoutes.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { startDate, endDate } = req.query;

  let queryBuilder = client
    .from('transactions')
    .select('amount, type, category, date')
    .eq('user_id', userId);

  if (startDate) queryBuilder = queryBuilder.gte('date', startDate as string);
  if (endDate) queryBuilder = queryBuilder.lte('date', endDate as string);

  const { data, error } = await queryBuilder;

  if (error) throw ApiError.internal(error.message);

  const transactions = data || [];
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = income - expenses;

  const byCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  return successResponse({
    income,
    expenses,
    balance,
    transactionCount: transactions.length,
    byCategory,
  }, res);
}));
