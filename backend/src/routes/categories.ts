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
  }
}

import { getSupabaseClient } from '../services/database';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiError, successResponse } from '../middleware/errorHandler';
import { categorySchema, idParamSchema } from '../validators/schemas';

const DEFAULT_CATEGORIES = {
  income: ['Salary', 'Freelance', 'Investments', 'Gifts', 'Other Income'],
  expense: ['Housing', 'Food', 'Transport', 'Utilities', 'Healthcare', 'Entertainment', 'Shopping', 'Education', 'Savings', 'Other Expense'],
};

export const categoryRoutes = Router();

categoryRoutes.get('/', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw ApiError.internal(error.message);

  if (!data || data.length === 0) {
    return successResponse({ categories: DEFAULT_CATEGORIES }, res);
  }

  const categories = data.reduce((acc, cat) => {
    if (!acc[cat.type]) acc[cat.type] = [];
    acc[cat.type].push(cat.name);
    return acc;
  }, {} as Record<string, string[]>);

  return successResponse({ categories }, res);
}));

categoryRoutes.post('/', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const input = categorySchema.parse(req.body);

  const { data, error } = await client
    .from('categories')
    .insert({
      user_id: userId,
      name: input.name,
      type: input.type,
      color: input.color || (input.type === 'income' ? '#10B981' : '#EF4444'),
      icon: input.icon,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw ApiError.conflict('Category already exists');
    }
    throw ApiError.badRequest(error.message);
  }

  return successResponse({ category: data }, res, 201);
}));

categoryRoutes.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);
  const input = categorySchema.partial().parse(req.body);

  const { data, error } = await client
    .from('categories')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw ApiError.badRequest(error.message);
  if (!data) throw ApiError.notFound('Category not found');

  return successResponse({ category: data }, res);
}));

categoryRoutes.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);

  const { error } = await client
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw ApiError.internal(error.message);

  return successResponse({ message: 'Category deleted' }, res);
}));

categoryRoutes.post('/seed', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const categories = [
    ...DEFAULT_CATEGORIES.income.map(name => ({ user_id: userId, name, type: 'income', color: '#10B981' })),
    ...DEFAULT_CATEGORIES.expense.map(name => ({ user_id: userId, name, type: 'expense', color: '#EF4444' })),
  ];

  const { data, error } = await client
    .from('categories')
    .upsert(categories, { onConflict: 'user_id,name,type' })
    .select();

  if (error) throw ApiError.internal(error.message);

  return successResponse({ categories: data }, res, 201);
}));
