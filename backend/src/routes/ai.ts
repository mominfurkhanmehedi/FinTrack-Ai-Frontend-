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
import { aiQuestionSchema } from '../validators/schemas';
import { askAI, isAIConfigured } from '../services/ai';

interface Budget {
  id: string;
  category: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date: string | null;
}

export const aiRoutes = Router();

function calculateBreakdown(transactions: any[], goals: any[], emergencyBuffer: number | null) {
  const now = new Date();
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = income - expenses;

  const savedInGoals = goals.reduce((sum, g) => sum + (g.saved || 0), 0);
  const goalReserve = savedInGoals;

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentExpenses = transactions.filter(t => t.type === 'expense' && t.category !== 'Savings' && t.date >= thirtyDaysAgo);
  const avgDaily = recentExpenses.length > 0 ? recentExpenses.reduce((sum, t) => sum + t.amount, 0) / 30 : 0;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(daysInMonth - now.getDate() + 1, 0);
  const upcomingExpenses = Math.max(avgDaily * Math.max(daysRemaining - 1, 0), 0);

  const autoBuffer = avgDaily * 5;
  const buffer = Math.max(emergencyBuffer ?? autoBuffer, 0);

  const totalReserved = goalReserve + upcomingExpenses + buffer;
  const safeToSpend = balance - totalReserved;
  const dailySafeToSpend = daysRemaining > 0 ? Math.max(safeToSpend, 0) / daysRemaining : 0;

  return {
    balance,
    safeToSpend,
    dailySafeToSpend,
    goalReserve,
    upcomingExpenses,
    emergencyBuffer: buffer,
    daysRemaining,
  };
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(currency === 'JPY' ? 0 : 2)}`;
  }
}

aiRoutes.post('/ask', asyncHandler(async (req: Request, res: Response) => {
  const input = aiQuestionSchema.parse(req.body);
  const client = getSupabaseClient(req.headers.authorization?.split(' ')[1]);
  const userId = req.userId!;

  const { data: profile } = await client
    .from('profiles')
    .select('currency, emergency_buffer')
    .eq('id', userId)
    .single();

  const currency = profile?.currency || 'INR';

  const [{ data: transactions }, { data: goals }, { data: budgets }] = await Promise.all([
    client.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(500),
    client.from('goals').select('*').eq('user_id', userId),
    client.from('budgets').select('*').eq('user_id', userId),
  ]);

  const breakdown = calculateBreakdown(transactions || [], goals || [], profile?.emergency_buffer ?? null);

  const now = new Date();
  const budgetsWithStatus = (budgets || []).map(budget => {
    const startDate = budget.start_date;
    const endDate = budget.end_date || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return { ...budget, periodStart: startDate, periodEnd: endDate };
  });

  const context = {
    transactions: (transactions || []).map(t => ({
      id: t.id,
      title: t.title,
      amount: t.amount,
      type: t.type,
      category: t.category,
      date: t.date,
    })),
    goals: (goals || []).map(g => ({
      id: g.id,
      title: g.title,
      target: g.target,
      saved: g.saved,
      deadline: g.deadline,
    })),
    budgets: budgetsWithStatus.map(b => ({
      id: b.id,
      category: b.category,
      amount: b.amount,
      period: b.period,
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
    })),
    currency,
    emergencyBuffer: profile?.emergency_buffer ?? null,
    breakdown,
    format: (n: number) => formatCurrency(n, currency),
  };

  const answer = await askAI(input.question, context);

  return successResponse({ answer }, res);
}));

aiRoutes.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  return successResponse({
    configured: isAIConfigured(),
    provider: isAIConfigured() ? 'external' : 'local',
  }, res);
}));
