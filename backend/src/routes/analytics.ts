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
import { dateRangeSchema } from '../validators/schemas';

export const analyticsRoutes = Router();

function getMonthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function getWeekRange(date: Date): { start: string; end: string } {
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

analyticsRoutes.get('/overview', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const now = new Date();
  const { start: monthStart, end: monthEnd } = getMonthRange(now);
  const { start: weekStart, end: weekEnd } = getWeekRange(now);

  const [monthResult, weekResult, allResult, goalsResult] = await Promise.all([
    client.from('transactions').select('*').eq('user_id', userId).gte('date', monthStart).lte('date', monthEnd),
    client.from('transactions').select('*').eq('user_id', userId).gte('date', weekStart).lte('date', weekEnd),
    client.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1000),
    client.from('goals').select('*').eq('user_id', userId),
  ]);

  if (monthResult.error) {
    console.error('[analytics/overview] month transactions error:', monthResult.error.message);
    throw ApiError.internal('Failed to fetch overview data');
  }
  if (weekResult.error) {
    console.error('[analytics/overview] week transactions error:', weekResult.error.message);
    throw ApiError.internal('Failed to fetch overview data');
  }
  if (allResult.error) {
    console.error('[analytics/overview] all transactions error:', allResult.error.message);
    throw ApiError.internal('Failed to fetch overview data');
  }
  if (goalsResult.error) {
    console.error('[analytics/overview] goals error:', goalsResult.error.message);
    throw ApiError.internal('Failed to fetch overview data');
  }

  const monthTxs = monthResult.data;
  const weekTxs = weekResult.data;
  const allTxs = allResult.data;
  const goals = goalsResult.data;

  const monthIncome = monthTxs?.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) || 0;
  const monthExpenses = monthTxs?.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0) || 0;
  const weekIncome = weekTxs?.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) || 0;
  const weekExpenses = weekTxs?.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalIncome = allTxs?.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalExpenses = allTxs?.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0) || 0;

  const totalSaved = goals?.reduce((sum, g) => sum + (g.saved || 0), 0) || 0;
  const totalTarget = goals?.reduce((sum, g) => sum + (g.target || 0), 0) || 0;

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('emergency_buffer')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('[analytics/overview] profile error:', profileError.message);
    throw ApiError.internal('Failed to fetch overview data');
  }

  return successResponse({
    currentMonth: {
      income: monthIncome,
      expenses: monthExpenses,
      net: monthIncome - monthExpenses,
    },
    currentWeek: {
      income: weekIncome,
      expenses: weekExpenses,
      net: weekIncome - weekExpenses,
    },
    allTime: {
      income: totalIncome,
      expenses: totalExpenses,
      net: totalIncome - totalExpenses,
    },
    goals: {
      totalTarget,
      totalSaved,
      progress: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 10000) / 100 : 0,
      activeCount: goals?.filter(g => (g.saved || 0) < (g.target || 0)).length || 0,
    },
    emergencyBuffer: profile?.emergency_buffer || null,
  }, res);
}));

analyticsRoutes.get('/spending/trends', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { startDate, endDate } = dateRangeSchema.parse(req.query);

  const start = startDate || new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const { data, error } = await client
    .from('transactions')
    .select('amount, type, category, date')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (error) {
    console.error('[analytics/spending/trends] database error:', error.message);
    throw ApiError.internal('Failed to fetch spending trends');
  }

  const monthly = (data || []).reduce((acc, t) => {
    const month = t.date.slice(0, 7);
    if (!acc[month]) acc[month] = { income: 0, expenses: 0, byCategory: {} };
    acc[month].expenses += t.amount;
    acc[month].byCategory[t.category] = (acc[month].byCategory[t.category] || 0) + t.amount;
    return acc;
  }, {} as Record<string, { income: number; expenses: number; byCategory: Record<string, number> }>);

  const { data: incomeData, error: incomeError } = await client
    .from('transactions')
    .select('amount, date')
    .eq('user_id', userId)
    .eq('type', 'income')
    .gte('date', start)
    .lte('date', end);

  if (incomeError) {
    console.error('[analytics/spending/trends] income query error:', incomeError.message);
    throw ApiError.internal('Failed to fetch spending trends');
  }

  (incomeData || []).forEach(t => {
    const month = t.date.slice(0, 7);
    if (!monthly[month]) monthly[month] = { income: 0, expenses: 0, byCategory: {} };
    monthly[month].income += t.amount;
  });

  const trends = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({
      month,
      income: values.income,
      expenses: values.expenses,
      net: values.income - values.expenses,
      topCategories: Object.entries(values.byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, amount]) => ({ category, amount })),
    }));

  return successResponse({ trends }, res);
}));

analyticsRoutes.get('/spending/by-category', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { startDate, endDate } = dateRangeSchema.parse(req.query);

  const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const { data, error } = await client
    .from('transactions')
    .select('amount, category')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', start)
    .lte('date', end);

  if (error) {
    console.error('[analytics/spending/by-category] database error:', error.message);
    throw ApiError.internal('Failed to fetch spending by category');
  }

  const totals = (data || []).reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  const categories = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 10000) / 100 : 0,
    }));

  return successResponse({ categories, total, period: { start, end } }, res);
}));

analyticsRoutes.get('/income/by-category', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const { startDate, endDate } = dateRangeSchema.parse(req.query);

  const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const { data, error } = await client
    .from('transactions')
    .select('amount, category')
    .eq('user_id', userId)
    .eq('type', 'income')
    .gte('date', start)
    .lte('date', end);

  if (error) {
    console.error('[analytics/income/by-category] database error:', error.message);
    throw ApiError.internal('Failed to fetch income by category');
  }

  const totals = (data || []).reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  const categories = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 10000) / 100 : 0,
    }));

  return successResponse({ categories, total, period: { start, end } }, res);
}));

analyticsRoutes.get('/cashflow', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;
  const days = parseInt(req.query.days as string) || 30;

  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  const startStr = start.toISOString().split('T')[0];
  const endStr = new Date().toISOString().split('T')[0];

  const { data, error } = await client
    .from('transactions')
    .select('amount, type, date')
    .eq('user_id', userId)
    .gte('date', startStr)
    .lte('date', endStr);

  if (error) {
    console.error('[analytics/cashflow] database error:', error.message);
    throw ApiError.internal('Failed to fetch cashflow');
  }

  const daily = (data || []).reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = { income: 0, expenses: 0 };
    if (t.type === 'income') acc[t.date].income += t.amount;
    else acc[t.date].expenses += t.amount;
    return acc;
  }, {} as Record<string, { income: number; expenses: number }>);

  const series = [];
  for (let d = new Date(start); d <= new Date(endStr); d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const day = daily[dateStr] || { income: 0, expenses: 0 };
    series.push({
      date: dateStr,
      income: day.income,
      expenses: day.expenses,
      net: day.income - day.expenses,
    });
  }

  return successResponse({ series }, res);
}));

analyticsRoutes.get('/goals/progress', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { data, error } = await client
    .from('goals')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('[analytics/goals/progress] database error:', error.message);
    throw ApiError.internal('Failed to fetch goals progress');
  }

  const goals = (data || []).map(g => {
    const progress = g.target > 0 ? Math.round((g.saved / g.target) * 10000) / 100 : 0;
    const remaining = Math.max(g.target - g.saved, 0);
    const isCompleted = g.saved >= g.target;
    const isOverdue = g.deadline && new Date(g.deadline) < new Date() && !isCompleted;

    return {
      ...g,
      progress,
      remaining,
      isCompleted,
      isOverdue,
    };
  });

  return successResponse({ goals }, res);
}));

analyticsRoutes.get('/net-worth', asyncHandler(async (req: Request, res: Response) => {
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { data, error } = await client
    .from('transactions')
    .select('amount, type, date')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) {
    console.error('[analytics/net-worth] database error:', error.message);
    throw ApiError.internal('Failed to fetch net worth');
  }

  const monthly = (data || []).reduce((acc, t) => {
    const month = t.date.slice(0, 7);
    if (!acc[month]) acc[month] = { income: 0, expenses: 0 };
    if (t.type === 'income') acc[month].income += t.amount;
    else acc[month].expenses += t.amount;
    return acc;
  }, {} as Record<string, { income: number; expenses: number }>);

  let runningBalance = 0;
  const netWorth = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => {
      runningBalance += values.income - values.expenses;
      return { month, netWorth: runningBalance };
    });

  return successResponse({ netWorth }, res);
}));
