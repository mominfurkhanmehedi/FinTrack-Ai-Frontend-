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
import { budgetSchema, budgetUpdateSchema, idParamSchema, queryTransactionsSchema } from '../validators/schemas';

export const budgetRoutes = Router();

budgetRoutes.get('/', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { data, error } = await client
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw ApiError.internal(error.message);

  return successResponse({ budgets: data || [] }, res);
}));

budgetRoutes.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);

  const { data, error } = await client
    .from('budgets')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw ApiError.notFound('Budget not found');
  }

  return successResponse({ budget: data }, res);
}));

budgetRoutes.post('/', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const input = budgetSchema.parse(req.body);

  const { data, error } = await client
    .from('budgets')
    .insert({
      user_id: userId,
      category: input.category,
      amount: input.amount,
      period: input.period,
      start_date: input.startDate,
      end_date: input.endDate || null,
    })
    .select()
    .single();

  if (error) throw ApiError.badRequest(error.message);

  return successResponse({ budget: data }, res, 201);
}));

budgetRoutes.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);
  const input = budgetUpdateSchema.parse(req.body);

  const updates: Record<string, unknown> = { ...input };
  if (input.startDate) updates.start_date = input.startDate;
  if (input.endDate !== undefined) updates.end_date = input.endDate;

  const { data, error } = await client
    .from('budgets')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw ApiError.badRequest(error.message);
  if (!data) throw ApiError.notFound('Budget not found');

  return successResponse({ budget: data }, res);
}));

budgetRoutes.get('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);

  const { data: budget, error: budgetError } = await client
    .from('budgets')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (budgetError || !budget) {
    throw ApiError.notFound('Budget not found');
  }

  const now = new Date();
  const startDate = budget.start_date;
  const endDate = budget.end_date || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: transactions, error: txError } = await client
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('category', budget.category)
    .gte('date', startDate)
    .lte('date', endDate);

  if (txError) throw ApiError.internal(txError.message);

  const spent = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const remaining = budget.amount - spent;
  const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
  const isOverBudget = spent > budget.amount;

  return successResponse({
    budget: {
      id: budget.id,
      category: budget.category,
      amount: budget.amount,
      period: budget.period,
    },
    spent,
    remaining,
    percentage: Math.round(percentage * 100) / 100,
    isOverBudget,
    period: { start: startDate, end: endDate },
  }, res);
}));

budgetRoutes.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { id } = idParamSchema.parse(req.params);

  const { error } = await client
    .from('budgets')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw ApiError.internal(error.message);

  return successResponse({ message: 'Budget deleted' }, res);
}));

budgetRoutes.get('/overview', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { data: budgets, error } = await client
    .from('budgets')
    .select('*')
    .eq('user_id', userId);

  if (error) throw ApiError.internal(error.message);

  const now = new Date();
  const results = await Promise.all((budgets || []).map(async (budget) => {
    const startDate = budget.start_date;
    const endDate = budget.end_date || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: transactions } = await client
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .eq('category', budget.category)
      .gte('date', startDate)
      .lte('date', endDate);

    const spent = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const remaining = budget.amount - spent;
    const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    return {
      id: budget.id,
      category: budget.category,
      amount: budget.amount,
      spent,
      remaining,
      percentage: Math.round(percentage * 100) / 100,
      isOverBudget: spent > budget.amount,
      period: { start: startDate, end: endDate },
    };
  }));

  const totalBudgeted = results.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = results.reduce((sum, b) => sum + b.spent, 0);

  return successResponse({
    budgets: results,
    summary: {
      totalBudgeted,
      totalSpent,
      totalRemaining: totalBudgeted - totalSpent,
      overallPercentage: totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 10000) / 100 : 0,
      overBudgetCount: results.filter(b => b.isOverBudget).length,
    },
  }, res);
}));
