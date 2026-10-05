import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const transactionSchema = z.object({
  title: z.string().min(1).max(100),
  amount: z.number().positive(),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().length(3).optional(),
});

export const transactionUpdateSchema = transactionSchema.partial();

export const goalSchema = z.object({
  title: z.string().min(1).max(100),
  target: z.number().positive(),
  saved: z.number().min(0).default(0),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  currency: z.string().length(3).optional(),
});

export const goalUpdateSchema = goalSchema.partial();

export const categorySchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['income', 'expense']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
});

export const budgetSchema = z.object({
  category: z.string().min(1).max(50),
  amount: z.number().positive(),
  period: z.enum(['weekly', 'monthly', 'yearly']).default('monthly'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const budgetUpdateSchema = budgetSchema.partial();

export const emergencyFundSchema = z.object({
  amount: z.number().min(0).nullable(),
  isAuto: z.boolean().default(true),
});

export const currencySchema = z.object({
  currency: z.enum(['USD', 'INR', 'EUR', 'GBP', 'JPY', 'AED', 'SGD', 'CAD', 'AUD', 'CHF']),
});

export const userProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().max(10).optional(),
});

export const aiQuestionSchema = z.object({
  question: z.string().min(1).max(1000),
  context: z.object({
    transactions: z.array(z.any()).optional(),
    goals: z.array(z.any()).optional(),
    currency: z.string().length(3).optional(),
  }).optional(),
});

export const notificationPrefsSchema = z.object({
  transactionAlerts: z.boolean().optional(),
  budgetLimitWarnings: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
  goalReminders: z.boolean().optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const queryTransactionsSchema = z.object({
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
});

export const queryGoalsSchema = z.object({
  ...paginationSchema.shape,
  status: z.enum(['active', 'completed', 'all']).default('active'),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type GoalUpdateInput = z.infer<typeof goalUpdateSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>;
export type EmergencyFundInput = z.infer<typeof emergencyFundSchema>;
export type CurrencyInput = z.infer<typeof currencySchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type AIQuestionInput = z.infer<typeof aiQuestionSchema>;
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;
