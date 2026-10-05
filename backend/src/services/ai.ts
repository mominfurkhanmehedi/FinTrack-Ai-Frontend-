import { getEnv } from '../config/env';

export interface AIContext {
  transactions: Array<{
    id: string;
    title: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: string;
  }>;
  goals: Array<{
    id: string;
    title: string;
    target: number;
    saved: number;
    deadline?: string;
  }>;
  budgets: Array<{
    id: string;
    category: string;
    amount: number;
    period: 'weekly' | 'monthly' | 'yearly';
    periodStart: string;
    periodEnd: string;
  }>;
  currency: string;
  emergencyBuffer: number | null;
  breakdown: {
    balance: number;
    safeToSpend: number;
    dailySafeToSpend: number;
    goalReserve: number;
    upcomingExpenses: number;
    emergencyBuffer: number;
    daysRemaining: number;
  };
  format: (amount: number) => string;
}

export interface AIAnswer {
  text: string;
  source: 'provider' | 'local';
  intent?: string;
}

const AI_API_URL = getEnv().AI_API_URL;
const AI_API_KEY = getEnv().AI_API_KEY;

function buildProviderPayload(question: string, context: AIContext) {
  const { breakdown, currency, transactions, goals, emergencyBuffer, budgets } = context;
  return {
    question,
    context: {
      currency,
      dataCurrency: currency,
      formatted: {
        balance: formatCurrency(breakdown.balance, currency),
        safeToSpend: formatCurrency(breakdown.safeToSpend, currency),
        dailySafeToSpend: formatCurrency(breakdown.dailySafeToSpend, currency),
        goalReserve: formatCurrency(breakdown.goalReserve, currency),
        upcomingExpenses: formatCurrency(breakdown.upcomingExpenses, currency),
        emergencyBuffer: formatCurrency(breakdown.emergencyBuffer, currency),
        daysRemaining: breakdown.daysRemaining,
      },
      figures: {
        balance: breakdown.balance,
        safeToSpend: breakdown.safeToSpend,
        dailySafeToSpend: breakdown.dailySafeToSpend,
        goalReserve: breakdown.goalReserve,
        upcomingExpenses: breakdown.upcomingExpenses,
        emergencyBuffer: breakdown.emergencyBuffer,
      },
      goals,
      transactions,
      budgets,
      emergencyBuffer,
    },
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

async function callProvider(question: string, context: AIContext): Promise<string> {
  if (!AI_API_URL) throw new Error('AI_API_URL not configured');

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
    },
    body: JSON.stringify(buildProviderPayload(question, context)),
  });

  if (!response.ok) {
    throw new Error(`AI provider error (${response.status})`);
  }

  const data = await response.json() as { text?: string; answer?: string };
  return typeof data === 'string' ? data : String(data.text ?? data.answer ?? '');
}

function analyzeLocal(question: string, context: AIContext): AIAnswer {
  const q = question.toLowerCase();
  const { breakdown, currency, goals, transactions, budgets } = context;
  const { format } = context;

  const localFormatCurrency = (amount: number) => format(amount);

  const topExpense = /(where|what|which).*(spend|expense).*(most|highest|top)|(biggest|largest|top).*(expense|category|spending)|(spent|spend).*(most|highest).*(this month|category)/.test(q);
  const categorySpending = /(how much|what).*(did i|have i|i).*(spend|spent).*(on|in)\s+(\w+).*(this month|month)|(how much).*(spend|spending).*(food|travel|shopping|bills|transport|housing|utilities|entertainment|health|education|other).*(this month|month)/.test(q);
  const savingAdvice = /(how (can|should|to) (i )?save|save (more|money)).*(next month|month|money)?|how much (should|can) i save/.test(q);

  const spendToday = /\b(spend|afford|spending|safe to spend|how much can)\b/.test(q) && /(today|now|day|month)/.test(q);
  const afford = /(afford|comfortably)/.test(q);
  const goal = /(goal|save .* for|reach|complete)/.test(q) && /(how long|when|eta|complete|reach)/.test(q);
  const simulate = /(what (if|happens)|impact|effect|if i)/.test(q);
  const monthlySpending = /(how much|what).*(did i|have i|i).*(spend|spent).*(this month|month)|(total|monthly).*(spend|spending|expense).*(this month|month)/.test(q);
  const dailySpending = /(how much|what).*(am i|do i|i).*(spend|spending).*(each day|per day|daily|every day)|(average|avg).*(daily|day).*(spend|spending)/.test(q);
  const goalProgress = /(how).*(am i|doing).*(with|on).*(goal|goals)|(goal|goals).*(progress|status|how)/.test(q);
  const budgetRemaining = /(how much).*(left|remaining).*(budget|budgets)|(budget|budgets).*(left|remaining|balance)/.test(q);
  const upcomingExpensesIntent = /(what|which).*(upcoming|future|next).*(expense|expenses|bill|bills|payment|payments)/.test(q);
  const explainLow = /(why|reason).*(low|negative|less)|(why is).*(safe)/.test(q);

  const moneyMatch = /([$€£₹]?\s*\d[\d,]*\.?\d*)/;
  
  const detectCurrency = (text: string): string | null => {
    const currencySymbols: Record<string, string> = {
      '₹': 'INR',
      '$': 'USD',
      '€': 'EUR',
      '£': 'GBP',
    };
    for (const [symbol, code] of Object.entries(currencySymbols)) {
      if (text.includes(symbol)) return code;
    }
    return null;
  };

  const detectAmount = (text: string): { amount: number | null; currency: string | null } => {
    const m = moneyMatch.exec(text);
    if (!m) return { amount: null, currency: null };
    const raw = m[1].replace(/,/g, '').replace(/[$€£₹]\s*/, '');
    const amount = parseFloat(raw);
    const currency = detectCurrency(text);
    return { amount: isNaN(amount) ? null : amount, currency };
  };

  const exampleSpend = localFormatCurrency(Math.max(Math.round(breakdown.safeToSpend), 1));
  const exampleSave = localFormatCurrency(Math.max(Math.round(breakdown.dailySafeToSpend * 30), 1));

  if (topExpense) {
    const isThisMonth = /this month/.test(q);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const filteredTransactions = transactions.filter(t => {
      if (t.type !== 'expense' || t.category === 'Savings') return false;
      if (isThisMonth) {
        const txDate = new Date(t.date);
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      }
      return true;
    });

    const categoryTotals = filteredTransactions.reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount;
      return acc;
    }, {});
    const top = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    if (!top) {
      return { text: 'No tracked expenses yet — add some before I can rank what you spent the most on.', source: 'local', intent: 'top_expense' };
    }
    const period = isThisMonth ? 'this month' : 'overall';
    return {
      text: `Your largest expense category ${period} is "${top[0]}" at ${localFormatCurrency(top[1])}.`,
      source: 'local',
      intent: 'top_expense',
    };
  }

  if (categorySpending) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const categoryMatch = q.match(/(?:on|in)\s+(food|travel|shopping|bills|transport|housing|utilities|entertainment|health|education|other)/i);
    const targetCategory = categoryMatch ? categoryMatch[1].toLowerCase() : null;

    if (!targetCategory) {
      return {
        text: 'Please specify a category (e.g., Food, Travel, Shopping, Bills, Transport, Housing, Utilities, Entertainment, Health, Education, Other).',
        source: 'local',
        intent: 'category_spending',
      };
    }

    const categoryExpenses = transactions.filter(t => {
      if (t.type !== 'expense' || t.category === 'Savings') return false;
      const txDate = new Date(t.date);
      if (txDate.getMonth() !== currentMonth || txDate.getFullYear() !== currentYear) return false;
      return t.category.toLowerCase() === targetCategory;
    });

    const totalSpent = categoryExpenses.reduce((sum, t) => sum + t.amount, 0);

    if (totalSpent === 0) {
      return {
        text: `You haven't recorded any ${targetCategory} expenses this month.`,
        source: 'local',
        intent: 'category_spending',
      };
    }

    return {
      text: `You spent ${localFormatCurrency(totalSpent)} on ${targetCategory} this month (${categoryExpenses.length} expense${categoryExpenses.length === 1 ? '' : 's'}).`,
      source: 'local',
      intent: 'category_spending',
    };
  }

  if (savingAdvice) {
    const { amount: targetAmount, currency: targetCurrency } = detectAmount(question);
    const expenseTransactions = transactions.filter(t => t.type === 'expense' && t.category !== 'Savings');
    
    const categoryTotals = expenseTransactions.reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount;
      return acc;
    }, {});
    
    const sortedCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const suggestions: string[] = [];
    for (const [category, total] of sortedCategories) {
      const reduction = Math.round(total * 0.15);
      if (reduction > 0) {
        suggestions.push(`Reduce ${category} spending by ~${localFormatCurrency(reduction)} (15% of ${localFormatCurrency(total)})`);
      }
    }

    let adviceText = 'Here are some practical ways to save based on your spending:\n';
    if (suggestions.length > 0) {
      adviceText += suggestions.slice(0, 4).map((s, i) => `${i + 1}. ${s}`).join('\n');
    } else {
      adviceText += '1. Track all expenses to identify areas to cut back\n2. Set a daily spending limit\n3. Automate savings on payday\n4. Review subscriptions and recurring costs';
    }

    if (targetAmount && targetAmount > 0) {
      const dailyTarget = Math.round(targetAmount / 30);
      const targetFormatCurrency = targetCurrency ? (amt: number) => formatCurrency(amt, targetCurrency) : localFormatCurrency;
      adviceText += `\n\nTo save ${targetFormatCurrency(targetAmount)} next month, aim for ~${targetFormatCurrency(dailyTarget)}/day or ${targetFormatCurrency(targetAmount)}/month.`;
    }

    return {
      text: adviceText,
      source: 'local',
      intent: 'saving_advice',
    };
  }

  if (monthlySpending) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthExpenses = transactions.filter(t => {
      if (t.type !== 'expense' || t.category === 'Savings') return false;
      const txDate = new Date(t.date);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    });

    const totalSpent = thisMonthExpenses.reduce((sum, t) => sum + t.amount, 0);

    if (totalSpent === 0) {
      return {
        text: `You haven't recorded any expenses this month yet.`,
        source: 'local',
        intent: 'monthly_spending',
      };
    }

    return {
      text: `You spent ${localFormatCurrency(totalSpent)} this month (${thisMonthExpenses.length} expense${thisMonthExpenses.length === 1 ? '' : 's'}).`,
      source: 'local',
      intent: 'monthly_spending',
    };
  }

  if (dailySpending) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysElapsed = now.getDate();

    const thisMonthExpenses = transactions.filter(t => {
      if (t.type !== 'expense' || t.category === 'Savings') return false;
      const txDate = new Date(t.date);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    });

    const totalSpent = thisMonthExpenses.reduce((sum, t) => sum + t.amount, 0);

    if (totalSpent === 0 || daysElapsed === 0) {
      return {
        text: `You haven't recorded any expenses this month yet.`,
        source: 'local',
        intent: 'daily_spending',
      };
    }

    const avgDaily = totalSpent / daysElapsed;
    const projectedMonthEnd = avgDaily * daysInMonth;

    return {
      text: `Your average daily spending this month is ${localFormatCurrency(avgDaily)} (${localFormatCurrency(totalSpent)} over ${daysElapsed} day${daysElapsed === 1 ? '' : 's'}). At this pace, you're on track for ~${localFormatCurrency(projectedMonthEnd)} this month.`,
      source: 'local',
      intent: 'daily_spending',
    };
  }

  if (goalProgress) {
    if (goals.length === 0) {
      return {
        text: 'You have no goals set up yet. Add a goal in Budget & Goals to track your progress.',
        source: 'local',
        intent: 'goal_progress',
      };
    }

    const goalSummaries = goals.map(g => {
      const target = g.target;
      const saved = g.saved;
      const remaining = Math.max(target - saved, 0);
      const progressPct = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
      const status = remaining === 0 ? '✓ Complete' : `${progressPct.toFixed(0)}%`;
      return `"${g.title}": ${localFormatCurrency(saved)} / ${localFormatCurrency(target)} (${status})`;
    });

    const activeCount = goals.filter(g => g.target > g.saved).length;
    const completedCount = goals.filter(g => g.target <= g.saved).length;

    return {
      text: `Goal Progress (${goals.length} total: ${activeCount} active, ${completedCount} complete):\n${goalSummaries.join('\n')}`,
      source: 'local',
      intent: 'goal_progress',
    };
  }

  if (budgetRemaining) {
    if (!budgets || budgets.length === 0) {
      return {
        text: 'You have no budgets set up. Create a budget in the Budget section to track your spending limits.',
        source: 'local',
        intent: 'budget_remaining',
      };
    }

    const now = new Date();
    const budgetSummaries = budgets.map(budget => {
      const periodStart = new Date(budget.periodStart);
      const periodEnd = new Date(budget.periodEnd);
      
      if (now < periodStart || now > periodEnd) {
        return null;
      }

      const relevantExpenses = transactions.filter(t => {
        if (t.type !== 'expense' || t.category === 'Savings') return false;
        if (t.category !== budget.category) return false;
        const txDate = new Date(t.date);
        return txDate >= periodStart && txDate <= periodEnd;
      });

      const spent = relevantExpenses.reduce((sum, t) => sum + t.amount, 0);
      const remaining = budget.amount - spent;

      return {
        category: budget.category,
        budgetAmount: budget.amount,
        spent,
        remaining,
        period: budget.period,
      };
    }).filter((b): b is NonNullable<typeof b> => b !== null);

    if (budgetSummaries.length === 0) {
      return {
        text: 'You have budgets set up, but none are active for the current period.',
        source: 'local',
        intent: 'budget_remaining',
      };
    }

    const lines = budgetSummaries.map(b => {
      const status = b.remaining < 0 ? ' (OVER BUDGET)' : '';
      return `"${b.category}" (${b.period}): Budget ${localFormatCurrency(b.budgetAmount)}, Spent ${localFormatCurrency(b.spent)}, Remaining ${localFormatCurrency(b.remaining)}${status}`;
    });

    return {
      text: `Budget Remaining:\n${lines.join('\n')}`,
      source: 'local',
      intent: 'budget_remaining',
    };
  }

  if (upcomingExpensesIntent) {
    const now = new Date();
    const upcoming = transactions.filter(t => {
      if (t.type !== 'expense') return false;
      const txDate = new Date(t.date);
      return txDate >= now;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (upcoming.length === 0) {
      return {
        text: 'You have no upcoming expenses recorded.',
        source: 'local',
        intent: 'upcoming_expenses',
      };
    }

    const summary = upcoming.slice(0, 5).map(t => {
      const date = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${date}: ${t.title} (${t.category}) — ${localFormatCurrency(t.amount)}`;
    }).join('\n');

    const total = upcoming.reduce((sum, t) => sum + t.amount, 0);

    return {
      text: `Upcoming expenses (${upcoming.length} total, ${localFormatCurrency(total)}):\n${summary}${upcoming.length > 5 ? `\n... and ${upcoming.length - 5} more` : ''}`,
      source: 'local',
      intent: 'upcoming_expenses',
    };
  }

  if (simulate) {
    const { amount: asked } = detectAmount(question);
    if (asked != null && asked > 0) {
      return {
        text: `Simulating ${localFormatCurrency(asked)}... Your safe-to-spend would change from ${localFormatCurrency(breakdown.safeToSpend)} to ${localFormatCurrency(Math.max(breakdown.safeToSpend - asked, 0))}. Daily from ${localFormatCurrency(breakdown.dailySafeToSpend)} to ${localFormatCurrency(Math.max(breakdown.dailySafeToSpend - asked / breakdown.daysRemaining, 0))}. (Simulation only — nothing was changed in your records.)`,
        source: 'local',
        intent: 'simulation',
      };
    }
    return {
      text: `Tell me an amount with your question — e.g. "What if I spend ${exampleSpend}?" or "What if I save ${exampleSave} more every month?"`,
      source: 'local',
      intent: 'simulation',
    };
  }

  if (spendToday || afford) {
    const { amount: asked } = detectAmount(question);
    if (afford && asked != null) {
      const enough = asked <= Math.max(breakdown.safeToSpend, 0);
      return {
        text: `Based on your data, a ${localFormatCurrency(asked)} purchase is ${enough ? 'affordable' : 'not currently affordable'}. You can safely spend ${localFormatCurrency(Math.max(breakdown.safeToSpend, 0))} right now — that already protects your goals, upcoming expenses, and safety buffer. Your daily safe-to-spend is ${localFormatCurrency(breakdown.dailySafeToSpend)}/day${enough ? '.' : ' — this would need to come from your reserve.'}`,
        source: 'local',
        intent: 'affordability',
      };
    }
    return {
      text: `You can safely spend ${localFormatCurrency(Math.max(breakdown.safeToSpend, 0))} in total and about ${localFormatCurrency(breakdown.dailySafeToSpend)} per day for the next ${breakdown.daysRemaining} day(s). This protects ${localFormatCurrency(breakdown.goalReserve)} toward goals, ${localFormatCurrency(breakdown.upcomingExpenses)} of upcoming expenses, and a ${localFormatCurrency(breakdown.emergencyBuffer)} safety buffer.`,
      source: 'local',
      intent: 'safe_to_spend',
    };
  }

  if (goal) {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const cutoff = sixMonthsAgo.toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const monthlyBuckets: Record<string, { income: number; expenses: number; savings: number }> = {};

    for (const t of transactions) {
      if (t.date < cutoff || t.date > lastDay) continue;
      const key = t.date.slice(0, 7);
      const b = monthlyBuckets[key] ?? { income: 0, expenses: 0, savings: 0 };
      if (t.type === 'income') b.income += t.amount;
      else {
        b.expenses += t.amount;
        if (t.category === 'Savings') b.savings += t.amount;
      }
      monthlyBuckets[key] = b;
    }

    const buckets = Object.values(monthlyBuckets).sort((a, b) => (a.income + a.expenses) - (b.income + b.expenses));
    const monthCount = buckets.length;

    let monthlySavingsPace = 0;
    if (monthCount > 0) {
      const totalSavings = buckets.reduce((sum, m) => sum + m.savings, 0);
      monthlySavingsPace = totalSavings / monthCount;
      if (monthlySavingsPace <= 0) {
        const totalSurplus = buckets.reduce((sum, m) => sum + Math.max(m.income - m.expenses, 0), 0);
        monthlySavingsPace = totalSurplus / monthCount;
      }
    }

    const activeGoals = goals.filter(g => g.target > g.saved);
    if (activeGoals.length === 0) {
      return {
        text: 'You currently have no active goals. Add a goal and I can estimate a timeline for it.',
        source: 'local',
        intent: 'goal_eta',
      };
    }

    if (monthCount === 0 || monthlySavingsPace <= 0) {
      const nearest = activeGoals.reduce((a, b) => (a.target - a.saved < b.target - b.saved ? a : b));
      return {
        text: `You have an active goal ("${nearest.title}"), but there is not enough transaction data yet to estimate when it will be reached. Add a few months of transactions and savings first.`,
        source: 'local',
        intent: 'goal_eta',
      };
    }

    const active = activeGoals
      .map(g => ({
        ...g,
        remaining: g.target - g.saved,
        pace: monthlySavingsPace,
      }))
      .sort((a, b) => Math.ceil(a.remaining / a.pace) - Math.ceil(b.remaining / b.pace))[0];

    const monthsNeeded = Math.ceil(active.remaining / active.pace);
    return {
      text: `At your current savings pace of ${format(active.pace)}/month, you could reach "${active.title}" in about ${monthsNeeded} month(s). This is an estimate based on your recent transactions and savings behavior.`,
      source: 'local',
      intent: 'goal_eta',
    };
  }

  if (simulate) {
    const { amount: asked } = detectAmount(question);
    if (asked != null && asked > 0) {
      return {
        text: `Simulating ${localFormatCurrency(asked)}... Your safe-to-spend would change from ${localFormatCurrency(breakdown.safeToSpend)} to ${localFormatCurrency(Math.max(breakdown.safeToSpend - asked, 0))}. Daily from ${localFormatCurrency(breakdown.dailySafeToSpend)} to ${localFormatCurrency(Math.max(breakdown.dailySafeToSpend - asked / breakdown.daysRemaining, 0))}. (Simulation only — nothing was changed in your records.)`,
        source: 'local',
        intent: 'simulation',
      };
    }
    return {
      text: `Tell me an amount with your question — e.g. "What if I spend ${exampleSpend}?" or "What if I save ${exampleSave} more every month?"`,
      source: 'local',
      intent: 'simulation',
    };
  }

  if (explainLow) {
    const largest = Math.max(breakdown.goalReserve, breakdown.upcomingExpenses, breakdown.emergencyBuffer);
    let reason = 'Your safe-to-spend is low because of what needs to stay protected';
    if (largest === breakdown.goalReserve && largest > 0) reason += ' — most of it is reserved toward your goals';
    else if (largest === breakdown.upcomingExpenses && largest > 0) reason += ' — a lot is set aside for upcoming expenses';
    else if (largest === breakdown.emergencyBuffer && largest > 0) reason += ' — your safety buffer covers several days of spending';
    return {
      text: `${reason}. ${localFormatCurrency(breakdown.goalReserve)} is reserved for goals, ${localFormatCurrency(breakdown.upcomingExpenses)} for upcoming expenses, and ${localFormatCurrency(breakdown.emergencyBuffer)} for your safety buffer, leaving ${localFormatCurrency(breakdown.safeToSpend)} available.`,
      source: 'local',
      intent: 'explain_low',
    };
  }

  return {
    text: `I can help with questions like "How much can I spend today?", "Can I afford ${exampleSpend}?", "How long until I reach my goal?", "What if I save ${exampleSave} more every month?", "Why is my safe-to-spend low?", or "Which expense affects my goal the most?".`,
    source: 'local',
    intent: 'help',
  };
}

export async function askAI(question: string, context: AIContext): Promise<AIAnswer> {
  if (AI_API_URL) {
    try {
      const text = await callProvider(question, context);
      return { text, source: 'provider' };
    } catch (error) {
      console.warn('[ai] Provider failed, using local analyzer:', error);
    }
  }
  return analyzeLocal(question, context);
}

export function isAIConfigured(): boolean {
  return !!AI_API_URL;
}
