import {
  calculateDailySafeToSpend,
  calculateSafeToSpend,
  GoalEstimate,
  simulateFinancialChange,
  SimulationType,
} from './safeToSpend';
import { Goal, Transaction } from '../types';
import { BASE_CURRENCY, toNumber } from '../utils';
import { api } from './axios';

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
 *
 * CURRENCY
 * --------
 * Every raw figure in this module (transactions, goals, the safety buffer and
 * therefore every `calculate*` result) is denominated in the user's currently
 * selected currency, which is also the currency it is stored in. The two
 * currency-aware members of `FinTrackContext` are:
 *   - `format(amount)` — renders a stored amount in that currency;
 *   - `toBase(amount)` — normalizes an amount the USER TYPED to the same
 *     currency before it is compared against a computed figure.
 * Getting that second direction right is what stops "Can I afford 500?" from
 * being compared against a figure rounded to a different currency's minor unit.
 *
 * Example prompts are phrased with the user's own real figures rather than
 * hardcoded amounts, so they are always in the right currency and always
 * plausible for that user.
 */

export type AiProviderHandler = (question: string, context: FinTrackContext) => Promise<string>;

export interface FinTrackContext {
  transactions: Transaction[];
  goals: Goal[];
  goalEstimates: GoalEstimate[];
  /** Pure money formatter bound to the user's selected currency. */
  format: (n: number) => string;
  /**
   * Selected display currency code (e.g. "JPY"), so a provider knows which
   * currency the preformatted strings below are in.
   */
  currency: string;
  /**
   * Normalizes an amount the user typed to the same currency (and the same minor
   * unit) as the figures it is compared against, so "can I afford 500?" is
   * answered against a like-for-like number.
   */
  toBase: (n: number) => number;
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

/**
 * Builds the JSON body for the default REST provider.
 *
 * A function-valued `format` is silently dropped by `JSON.stringify`, which
 * would leave a model reasoning about raw numbers with no idea which currency
 * they are in. The payload therefore carries the currency code AND a `formatted`
 * block with every headline figure already rendered, so the provider can quote
 * the user directly instead of guessing the unit.
 */
function providerPayload(question: string, context: FinTrackContext) {
  const breakdown = breakdownOf(context);
  const daily = dailyOf(context);
  const { format } = context;
  return {
    question,
    context: {
      currency: context.currency,
      // Every figure below is denominated in `context.currency` — the selected
      // currency IS the stored currency, because selecting a new one permanently
      // converts the data. Stating a separate base here would tell a model the
      // numbers are in some other unit than the one it is asked about.
      dataCurrency: context.currency,
      formatted: {
        balance: format(breakdown.balance),
        safeToSpend: format(breakdown.safeToSpend),
        dailySafeToSpend: format(daily.daily),
        goalReserve: format(breakdown.goalReserve),
        upcomingExpenses: format(breakdown.upcomingExpenses),
        emergencyBuffer: format(breakdown.emergencyBuffer),
        daysRemaining: daily.daysRemaining,
      },
      // Raw figures, in the same currency declared above, for a provider that
      // wants to do its own arithmetic rather than quote the rendered strings.
      figures: {
        balance: breakdown.balance,
        safeToSpend: breakdown.safeToSpend,
        dailySafeToSpend: daily.daily,
        goalReserve: breakdown.goalReserve,
        upcomingExpenses: breakdown.upcomingExpenses,
        emergencyBuffer: breakdown.emergencyBuffer,
      },
      goals: context.goals,
      transactions: context.transactions,
      emergencyBuffer: context.emergencyBuffer,
    },
  };
}

/** Default REST provider — used only when env vars are configured. */
async function defaultRestProvider(question: string, context: FinTrackContext): Promise<string> {
  if (!API_URL) throw new Error('EXPO_PUBLIC_AI_API_URL is not configured');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify(providerPayload(question, context)),
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

  // 1) Backend API first (primary source).
  try {
    console.log('[askFinTrack] POST /ai/ask request:', { question: trimmed });
    const response = await api.post<{ success: boolean; data: { answer: AiAnswer } }>('/ai/ask', {
      question: trimmed,
    });
    console.log('[askFinTrack] POST /ai/ask response:', { status: response.status, data: response.data });
    if (response.data.success && response.data.data?.answer) {
      return response.data.data.answer;
    }
    console.warn('[askFinTrack] POST /ai/ask unexpected response shape:', response.data);
  } catch (err: any) {
    // Fall through to the local analyzer when the backend is unavailable.
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = err?.message;
    console.error('[askFinTrack] POST /ai/ask ERROR:', { status, data, message, error: err });
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

/**
 * Pulls a money amount out of a free-text question.
 *
 * The result is in the selected currency (the user typed "₹15,000" or "$500"),
 * which is also the currency every stored figure is in, so the caller only
 * normalizes it to that currency's minor unit before comparing.
 */
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

  /**
   * A typed amount -> the figure the calculators work with (in the same currency
   * as the stored data) and the string the user reads. Null when the question had
   * no amount.
   */
  const typed = (): { amount: number; display: string } | null => {
    const raw = detectAmount(question);
    if (raw == null) return null;
    const amount = context.toBase(raw);
    return { amount, display: format(amount) };
  };

  // A plausible, currency-correct example built from the user's own figures —
  // used in the "tell me an amount" prompts instead of a hardcoded ₹ value.
  const exampleSpend = format(Math.max(Math.round(breakdown.safeToSpend), 1));
  const exampleSave = format(Math.max(Math.round(daily.daily * 30), 1));

  const spendToday = /\b(spend|afford|spending|safe to spend|how much can)\b/.test(q) && /(today|now|day|month)/.test(q);
  const afford = /(afford|comfortably)/.test(q);
  const goal = /(goal|save .* for|reach|complete)/.test(q) && /(how long|when|eta|complete|reach)/.test(q);
  const simulate = /(what (if|happens)|impact|effect|if i)/.test(q);
  const explainLow = /(why|reason).*(low|negative|less)|(why is).*(safe)/.test(q);
  const topExpense = /(which|what) .*(expense|category|spend).*(goal|affect|impact|biggest|largest)/.test(q);

  if (spendToday || afford) {
    const asked = typed();
    if (afford && asked) {
      const enough = asked.amount <= Math.max(breakdown.safeToSpend, 0);
      return (
        `Based on your data, a ${asked.display} purchase is ${enough ? 'affordable' : 'not currently affordable'}. ` +
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
    const asked = typed();
    if (type != null && asked && asked.amount > 0) {
      const result = simulateFinancialChange(
        { transactions: context.transactions, goals: context.goals, emergencyBuffer: context.emergencyBuffer },
        { type, amount: asked.amount },
      );
      return (
        `${result.impact.verdict}. Safe-to-spend would change from ${format(result.base.safeToSpend)} to ` +
        `${format(result.after.safeToSpend)}, daily from ${format(result.baseDaily.daily)} to ${format(result.afterDaily.daily)}. ` +
        `Your projected month-end balance would be ${format(result.forecast.projectedMonthEnd ?? 0)}. ` +
        '(Simulation only — nothing was changed in your records.)'
      );
    }
    return `Tell me an amount with your question — e.g. "What if I spend ${exampleSpend}?" or "What if I save ${exampleSave} more every month?"`;
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
    `I can help with questions like "How much can I spend today?", "Can I afford ${exampleSpend}?", ` +
    `"How long until I reach my goal?", "What if I save ${exampleSave} more every month?", "Why is my ` +
    'safe-to-spend low?", or "Which expense affects my goal the most?". An AI provider can be ' +
    'connected in services/ai.ts to answer broader questions.'
  );
}