import {
  calculateDailySafeToSpend,
  calculateSafeToSpend,
  GoalEstimate,
  simulateFinancialChange,
  SimulationType,
} from './safeToSpend';
import { Goal, Transaction } from '../types';
import { toNumber } from '../utils';

/**
 * ASK FINTRACK — AI service abstraction.
 *
 * The UI talks to `askFinTrack()`, which NEVER hardcodes fake answers:
 *  - `configureAiProvider(handler)` plugs in a real AI provider (LLM/REST).
 *  - If a bearer/endpoint is configured via env (`EXPO_PUBLIC_AI_API_URL`,
 *    `EXPO_PUBLIC_AI_API_KEY`), a default REST client posts the user's
 *    financial CONTEXT and gets a summary back.
 *  - When NO provider is connected, `askFinTrack` falls back to an honest,
 *    LOCAL, rules-based analyzer that computes its replies purely from the
 *    user's real numbers (safe-to-spend, goals, transactions). Answers are
 *    labeled "Based on your data" so they are never mistaken for model output.
 *
 * Context is built from real app data and only what is needed to answer the
 * question is attached — nothing extra is ever sent.
 */

export type AiProviderHandler = (question: string, context: FinTrackContext) => Promise<string>;

export interface FinTrackContext {
  transactions: Transaction[];
  goals: Goal[];
  goalEstimates: GoalEstimate[];
  /** Pure money formatter bound to the user's selected currency. */
  format: (n: number) => string;
  emergencyBuffer: number | null;
}

export interface AiAnswer {
  text: string;
  /** Where the answer came from, shown as a small badge in the UI. */
  source: 'provider' | 'local';
  /** Recognized intent when the local analyzer handled it. */
  intent?: string;
}

let providerHandler: AiProviderHandler | null = null;

/** Connect a real AI provider (LLM client, REST proxy, edge function…). */
export function configureAiProvider(handler: AiProviderHandler | null): void {
  providerHandler = handler;
}

const API_URL = process.env.EXPO_PUBLIC_AI_API_URL;
const API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY;

/** Default REST provider — used only when env vars are configured. */
async function defaultRestProvider(question: string, context: FinTrackContext): Promise<string> {
  if (!API_URL) throw new Error('EXPO_PUBLIC_AI_API_URL is not configured');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify({ question, context }),
  });
  if (!res.ok) throw new Error(`AI provider error (${res.status})`);
  const json: unknown = await res.json();
  return typeof json === 'string' ? json : String((json as { text?: string })?.text ?? '');
}

/** Ask FinTrack a question about the user's finances. Never mutates data. */
export async function askFinTrack(
  question: string,
  context: FinTrackContext,
): Promise<AiAnswer> {
  const trimmed = question.trim();

  // 1) Real provider first (when configured).
  const handler = providerHandler ?? (API_URL ? defaultRestProvider : null);
  if (handler) {
    try {
      const text = await handler(trimmed, context);
      return { text, source: 'provider' };
    } catch (err) {
      // Fall through to the local analyzer when the provider is unavailable so
      // the user still gets a data-based answer instead of a hard failure.
      console.warn('[askFinTrack] provider failed, using local analyzer:', err);
    }
  }

  // 2) Honest local fallback calculated from the real data.
  return { text: analyzeLocal(trimmed, context), source: 'local' };
}

const breakdownOf = (context: FinTrackContext) =>
  calculateSafeToSpend({
    transactions: context.transactions,
    goals: context.goals,
    emergencyBuffer: context.emergencyBuffer,
  });

const dailyOf = (context: FinTrackContext) =>
  calculateDailySafeToSpend(breakdownOf(context));

const moneyMatch = /(\d[\d,]*\.?\d*)/;

function detectAmount(text: string): number | null {
  const m = moneyMatch.exec(text);
  return m ? toNumber(Number(m[1].replace(/,/g, ''))) : null;
}

function detectType(text: string): SimulationType | null {
  const t = text.toLowerCase();
  if (/\b(save|saving|savings|put .* into)/.test(t)) return 'save-more';
  if (/\b(expense|expenses|spending|spend \d|cost|bill|bills?)\b/.test(t) && /(increase|more)/.test(t)) return 'increase-expenses';
  if (/(purchase|purchases|afford|invest|loan|buy)/.test(t)) return 'add-purchase';
  if (/\bspend\b/.test(t)) return 'spend';
  return null;
}

/** Rules-based answers computed from real numbers — see module header. */
function analyzeLocal(question: string, context: FinTrackContext): string {
  const q = question.toLowerCase();
  const { format } = context;
  const breakdown = breakdownOf(context);
  const daily = dailyOf(context);

  const spendToday = /\b(spend|afford|spending|safe to spend|how much can)\b/.test(q) && /(today|now|day|month)/.test(q);
  const afford = /(afford|comfortably)/.test(q);
  const goal = /(goal|save .* for|reach|complete)/.test(q) && /(how long|when|eta|complete|reach)/.test(q);
  const simulate = /(what (if|happens)|impact|effect|if i)/.test(q);
  const explainLow = /(why|reason).*(low|negative|less)|(why is).*(safe)/.test(q);
  const topExpense = /(which|what) .*(expense|category|spend).*(goal|affect|impact|biggest|largest)/.test(q);

  if (spendToday || afford) {
    const amount = detectAmount(question);
    if (afford && amount != null) {
      const enough = amount <= Math.max(breakdown.safeToSpend, 0);
      return (
        `Based on your data, a ${format(amount)} purchase is ${enough ? 'affordable' : 'not currently affordable'}. ` +
        `You can safely spend ${format(Math.max(breakdown.safeToSpend, 0))} right now — that already protects your goals, ` +
        `upcoming expenses, and safety buffer. Your daily safe-to-spend is ${format(daily.daily)}/day` +
        (enough ? '.' : ` — this would need to come from your reserve.`)
      );
    }
    return (
      `You can safely spend ${format(Math.max(breakdown.safeToSpend, 0))} in total and about ` +
      `${format(daily.daily)} per day for the next ${daily.daysRemaining} day(s). This protects ` +
      `${format(breakdown.goalReserve)} toward goals, ${format(breakdown.upcomingExpenses)} of upcoming expenses, ` +
      `and a ${format(breakdown.emergencyBuffer)} safety buffer.`
    );
  }

  if (goal) {
    const active = context.goalEstimates
      .filter((e) => e.remaining > 0 && e.etaIso != null)
      .sort((a, b) => (a.etaIso! < b.etaIso! ? -1 : 1))[0];
    if (!active) {
      const anyGoal = context.goals.find((g) => toNumber(g.target) > toNumber(g.saved));
      return anyGoal
        ? 'You have an active goal, but there is not enough data yet to estimate when it will be reached. Add a few months of transactions and savings first.'
        : 'You currently have no active goals. Add a goal in Budget & Goals and I can estimate a timeline for it.';
    }
    return (
      `At your current savings pace of ${format(active.pace)}/month, you could reach "${active.title}" in about ` +
      `${active.monthsNeeded} month(s). This is an estimate based on your recent transactions and savings behavior.`
    );
  }

  if (simulate) {
    const type = detectType(question);
    const amount = detectAmount(question);
    if (type != null && amount != null && amount > 0) {
      const result = simulateFinancialChange(
        { transactions: context.transactions, goals: context.goals, emergencyBuffer: context.emergencyBuffer },
        { type, amount },
      );
      return (
        `${result.impact.verdict}. Safe-to-spend would change from ${format(result.base.safeToSpend)} to ` +
        `${format(result.after.safeToSpend)}, daily from ${format(result.baseDaily.daily)} to ${format(result.afterDaily.daily)}. ` +
        `Your projected month-end balance would be ${format(result.forecast.projectedMonthEnd ?? 0)}. ` +
        '(Simulation only — nothing was changed in your records.)'
      );
    }
    return 'Tell me an amount with your question — e.g. "What if I spend ₹15,000?" or "What if I save ₹2,000 more every month?"';
  }

  if (explainLow) {
    const largest = Math.max(breakdown.goalReserve, breakdown.upcomingExpenses, breakdown.emergencyBuffer);
    let reason = 'Your safe-to-spend is low because of what needs to stay protected';
    if (largest === breakdown.goalReserve && largest > 0) reason += ' — most of it is reserved toward your goals';
    else if (largest === breakdown.upcomingExpenses && largest > 0) reason += ' — a lot is set aside for upcoming expenses';
    else if (largest === breakdown.emergencyBuffer && largest > 0) reason += ' — your safety buffer covers several days of spending';
    return (
      `${reason}. ${format(breakdown.goalReserve)} is reserved for goals, ${format(breakdown.upcomingExpenses)} for ` +
      `upcoming expenses, and ${format(breakdown.emergencyBuffer)} for your safety buffer, leaving ${format(breakdown.safeToSpend)} available.`
    );
  }

  if (topExpense) {
    const cat = Object.entries(
      context.transactions
        .filter((t) => t.type === 'expense' && t.category !== 'Savings')
        .reduce<Record<string, number>>((acc, t) => {
          acc[t.category] = (acc[t.category] ?? 0) + toNumber(t.amount);
          return acc;
        }, {}),
    ).sort((a, b) => b[1] - a[1])[0];
    if (!cat) return 'No tracked expenses yet — add some before I can rank what affects your goals most.';
    return `Your largest expense category influencing your goals is "${cat[0]}" at ${format(cat[1])}.`;
  }

  return (
    'I can help with questions like "How much can I spend today?", "Can I afford ₹15,000?", ' +
    '"How long until I reach my goal?", "What if I save ₹2,000 more every month?", "Why is my ' +
    'safe-to-spend low?", or "Which expense affects my goal the most?". An AI provider can be ' +
    'connected in services/ai.ts to answer broader questions.'
  );
}