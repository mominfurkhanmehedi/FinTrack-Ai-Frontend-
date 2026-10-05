import { CURRENCIES, Goal, Transaction } from '../types';

/**
 * CURRENCY CONVERSION + FORMATTING (PURE)
 *
 * This module is the single source of truth for everything currency-related that
 * is pure math. It deliberately imports nothing but the `CURRENCIES` list so it
 * can be unit-tested with the project's plain-Node test runner (no React
 * Native, no network, no storage).
 *
 * The app-wide rules it encodes
 * -----------------------------
 * 1. EVERY stored amount (transactions, goals, savings, the safety buffer) is
 *    denominated in the user's CURRENTLY SELECTED currency, and every record
 *    carries that code in its own `currency` field. The database therefore
 *    always speaks the same currency as the UI.
 * 2. The selected currency is changed by PERMANENTLY REWRITING the stored
 *    amounts: `planCurrencyChange` is the pure planner, and the store applies
 *    it to Supabase and only then updates the preference. A failed rate lookup
 *    produces no change at all.
 * 3. Because storage is already in the selected currency, the display layer
 *    performs NO conversion — `useMoney().format(v)` renders `v` as-is. That is
 *    what makes double conversion structurally impossible.
 * 4. A rate table maps "<code> -> how many <code> equal 1 RATE_BASE_CURRENCY",
 *    e.g. `{ INR: 1, USD: 0.0119, JPY: 1.78 }`. The table stays anchored to
 *    INR no matter what the user selects, and `effectiveRate` crosses between
 *    any two codes through it.
 * 5. When a rate is genuinely unavailable the conversion helpers return `null`
 *    rather than guessing. A wrong number is never displayed or stored.
 */

/**
 * The currency the shared rate table is quoted against, and the currency every
 * pre-existing row of data was written in (the app shipped with INR amounts).
 *
 * This is deliberately NOT the currency amounts are stored in — that is whatever
 * the user has selected, tracked per record. It only anchors the rate maths, so
 * one table can convert between any pair of the supported currencies.
 */
export const BASE_CURRENCY = 'INR';

/** Every currency code the picker can select, derived from the shared list. */
export const SUPPORTED_CURRENCY_CODES: readonly string[] = CURRENCIES.map((c) => c.code);

/** Currency codes that are conventionally written with no minor units. */
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY']);

/** Locales that produce each currency's native digit grouping. */
const CURRENCY_LOCALES: Record<string, string> = { INR: 'en-IN' };

/**
 * A rate table: for each supported code, how many of that code one
 * `BASE_CURRENCY` unit buys. The base itself is always implicitly 1.
 */
export type RateTable = Record<string, number>;

/** A rate table plus when it was fetched, so freshness can be judged. */
export interface RatesSnapshot {
  base: string;
  rates: RateTable;
  /** Epoch milliseconds of the successful fetch. */
  fetchedAt: number;
  /** Human-readable origin of the data, for the Settings screen. */
  source: string;
}

/** Coerces anything to a finite number, falling back to 0 (mirrors `toNumber`). */
function finite(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** True when `code` is one of the currencies the app supports. */
export function isSupportedCurrency(code: unknown): boolean {
  return typeof code === 'string' && SUPPORTED_CURRENCY_CODES.includes(code);
}

/** Normalizes an arbitrary code to a supported one, else the base currency. */
export function normalizeCurrency(code: unknown): string {
  return isSupportedCurrency(code) ? (code as string) : BASE_CURRENCY;
}

/**
 * Symbol for a supported currency code — e.g. "₹" for INR, "$" for USD.
 * Reuses the shared CURRENCIES list so charts and formatters never need to
 * hardcode symbols and always stay in sync with the currency picker.
 */
export function currencySymbol(currency = 'USD'): string {
  const match = CURRENCIES.find((c) => c.code === currency);
  return match?.symbol ?? currency;
}

/**
 * Locale that produces the native grouping for a currency. INR uses the Indian
 * "en-IN" grouping (₹10,00,000); everything else keeps western grouping.
 */
function localeForCurrency(currency: string): string {
  return CURRENCY_LOCALES[currency] ?? 'en-US';
}

/** Minor-unit digits for a currency. JPY has none; everything else has two. */
export function currencyFractionDigits(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
}

/**
 * Rounds to the currency's smallest tradable unit. Used after a conversion so a
 * converted value never renders as "$3.9999999" or a spurious ¥ decimal.
 */
export function roundForCurrency(value: number, currency: string): number {
  const factor = 10 ** currencyFractionDigits(currency);
  return Math.round(finite(value) * factor) / factor;
}

/** Reads a usable positive rate out of a table; base and unusable entries yield null. */
function rateFor(code: string, table?: RateTable | null): number | null {
  if (code === BASE_CURRENCY) return 1;
  if (!table) return null;
  const rate = table[code];
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** True when a non-base currency can actually be converted right now. */
export function hasRateFor(code: string, table?: RateTable | null): boolean {
  return rateFor(code, table) !== null;
}

/**
 * The multiplier that turns an amount in `from` into an amount in `to`.
 * Returns `null` when either side's rate is unavailable.
 */
export function effectiveRate(from: string, to: string, table?: RateTable | null): number | null {
  if (from === to) return 1;
  const fromRate = rateFor(from, table);
  const toRate = rateFor(to, table);
  if (fromRate === null || toRate === null) return null;
  // Rates are "units per 1 base", so to->from is (1 / fromRate) and
  // from->to is `toRate / fromRate`.
  return toRate / fromRate;
}

/**
 * Base-currency amount -> selected display currency.
 * `null` when no rate is available for `to`.
 */
export function convertFromBase(amount: number, to: string, table?: RateTable | null): number | null {
  const rate = rateFor(to, table);
  if (rate === null) return null;
  return finite(amount) * rate;
}

/**
 * Selected display currency -> base currency, for values the user typed.
 * `null` when no rate is available, so callers can refuse to store a number
 * they cannot convert rather than silently recording it in the wrong unit.
 */
export function convertToBase(amount: number, from: string, table?: RateTable | null): number | null {
  const rate = rateFor(from, table);
  if (rate === null) return null;
  return finite(amount) / rate;
}

/** Converts between any two supported currencies. `null` when a rate is missing. */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  table?: RateTable | null,
): number | null {
  const rate = effectiveRate(from, to, table);
  if (rate === null) return null;
  return finite(amount) * rate;
}

/**
 * THE centralized currency conversion entry point.
 *
 *   convertCurrency(amount, fromCurrency, toCurrency) -> converted amount
 *
 * `amount` is always interpreted in `fromCurrency` and the result is always
 * denominated in `toCurrency` — never in the rate table's anchor. Callers must
 * pass the currency the value is *actually* stored in, which is why
 * `recordCurrency` exists below: converting from a hardcoded currency would
 * rescale data that had already been converted.
 *
 * Behaviour:
 *   - identical currencies return the amount completely unchanged — not
 *     multiplied by a rate of 1, and not re-rounded, so this is a true no-op and
 *     cannot quietly shift a stored value;
 *   - otherwise the result is rounded to the TARGET currency's minor unit, so a
 *     converted value can be stored directly and JPY never grows a decimal;
 *   - an unknown currency or a missing rate yields `null`, never a guess.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  table?: RateTable | null,
): number | null {
  if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) return null;
  if (fromCurrency === toCurrency) return finite(amount);
  const converted = convertAmount(amount, fromCurrency, toCurrency, table);
  if (converted === null) return null;
  return roundForCurrency(converted, toCurrency);
}

/**
 * The currency a record's monetary fields are denominated in.
 *
 * Rows written before the currency column existed carry no code, and every one
 * of them is INR — which is exactly what `BASE_CURRENCY` means. So a missing
 * value is resolved to the legacy currency rather than to "unknown".
 */
export function recordCurrency(record: { currency?: string | null }): string {
  return isSupportedCurrency(record?.currency) ? (record.currency as string) : BASE_CURRENCY;
}

/** What `reconcileCurrencyFromRecords` decided, and why. */
export type CurrencyReconciliation =
  /** No records were supplied, so there is nothing to infer from. */
  | { kind: 'empty' }
  /** Every record states the same currency: that is the data's currency. */
  | { kind: 'agreed'; currency: string }
  /**
   * Records disagree, which only happens when some were written under an older
   * preference. The most common code is returned as the least-wrong reading, and
   * the full list is reported so the caller can log it. A subsequent
   * `setCurrency` normalizes every row onto one code, because that converts each
   * row from the currency it actually records.
   */
  | { kind: 'ambiguous'; currency: string; mixed: string[] };

/**
 * Decides which currency the app should be on, given the records it just loaded.
 *
 * The stored data is the authority on its own unit, not the preference: once a
 * currency change has run, the rows hold the NEW currency, and any device-level
 * preference (a fresh install, or a pre-conversion display-only choice) can
 * disagree with them. Adopting the rows' currency is what stops the UI from
 * labelling USD amounts with the rupee sign.
 *
 * This never converts anything. It only reports the code the data is already in,
 * so calling it is always safe.
 */
export function reconcileCurrencyFromRecords(
  records: ReadonlyArray<{ currency?: string | null }>,
): CurrencyReconciliation {
  const counts = new Map<string, number>();
  for (const record of records) {
    const code = recordCurrency(record);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  if (counts.size === 0) return { kind: 'empty' };

  // Highest count wins; ties break on insertion order via `>`, which is stable
  // and deterministic for a given input order.
  let winner = [...counts.keys()][0];
  let winnerCount = 0;
  for (const [code, count] of counts) {
    if (count > winnerCount) {
      winner = code;
      winnerCount = count;
    }
  }
  if (counts.size === 1) return { kind: 'agreed', currency: winner };

  return { kind: 'ambiguous', currency: winner, mixed: [...counts.keys()].sort() };
}

/** The full set of monetary values the app persists, for one currency change. */
export interface MonetaryData {
  transactions: Transaction[];
  goals: Goal[];
  /** Safety buffer, or `null` when it is derived automatically. */
  emergencyBuffer: number | null;
}

/** A currency change that has been fully planned but not yet applied. */
export interface CurrencyChangePlan {
  /** False when a rate was unavailable — nothing may be written in that case. */
  ok: boolean;
  /** Machine-readable reason for a failed plan, e.g. 'no-rate' | 'same-currency'. */
  error?: CurrencyChangeError;
  from: string;
  to: string;
  transactions: Transaction[];
  goals: Goal[];
  emergencyBuffer: number | null;
}

export type CurrencyChangeError = 'unsupported' | 'same-currency' | 'no-rate' | 'invalid-amount';

/** Input accepted by `planCurrencyChange`, so callers can pass a partial slice. */
export interface MonetaryDataInput {
  transactions?: Transaction[] | null;
  goals?: Goal[] | null;
  emergencyBuffer?: number | null;
}

/**
 * Plans a permanent currency change for every monetary value the app stores:
 * transaction amounts, goal targets, savings (`goal.saved`) and the safety
 * buffer. Income and expense amounts are both covered because both live in
 * `transactions.amount`; account balances are not a separate record — they are
 * derived from transactions — so converting those rows converts the balances
 * too.
 *
 * This function is PURE: it computes what the new values would be and touches
 * neither the store nor the network. The caller persists the result and only
 * then moves the preference, which is what guarantees requirement "update the
 * preference only AFTER the conversion succeeds".
 *
 * `from` is the app-wide selected currency, used for the safety buffer (the one
 * value with no per-row currency of its own). Every persisted row is instead
 * converted from the currency that row records, via `recordCurrency`, so a row
 * left behind by an older preference is rescaled by the rate that actually
 * applies to it rather than by the global one.
 *
 * The whole plan is all-or-nothing. If any single value cannot be converted the
 * plan fails with `ok: false` and the original records are returned unchanged,
 * so a partial conversion can never be written.
 */
export function planCurrencyChange(
  data: MonetaryDataInput,
  from: string,
  to: string,
  table?: RateTable | null,
): CurrencyChangePlan {
  const transactions = data.transactions ?? [];
  const goals = data.goals ?? [];
  const emergencyBuffer = data.emergencyBuffer ?? null;
  const fail = (error: CurrencyChangeError): CurrencyChangePlan => ({
    ok: false,
    error,
    from,
    to,
    transactions,
    goals,
    emergencyBuffer,
  });

  if (!isSupportedCurrency(from) || !isSupportedCurrency(to)) return fail('unsupported');
  // A no-op change must never rescale anything: that is the double-conversion
  // guard, and it has to run before any arithmetic.
  if (from === to) return fail('same-currency');

  // Every row is converted from the currency IT records, not from the app-wide
  // preference. The two agree in the normal case, but each row carries its own
  // `currency` precisely so that a row written under an older preference (or by
  // a partially-migrated restore) is rescaled by the rate that actually applies
  // to it. Trusting the global `from` for such a row would multiply or divide it
  // by the wrong factor, which is unrecoverable once written.
  const sourceOf = (record: { currency?: string | null }): string => recordCurrency(record);

  // A rate is required for every distinct source that is not already the target.
  // Checking them up front is what makes the plan all-or-nothing: if any source
  // is unsupported or unconvertible the plan fails before producing a single
  // value, so a partial conversion can never be written.
  const sources = new Set<string>();
  for (const t of transactions) sources.add(sourceOf(t));
  for (const g of goals) sources.add(sourceOf(g));
  // The safety buffer is a single app-level value with no per-row code, so it
  // follows the selected currency the app is currently on.
  if (emergencyBuffer !== null) sources.add(from);
  for (const source of sources) {
    if (source === to) continue;
    if (effectiveRate(source, to, table) === null) return fail('no-rate');
  }

  // Bail out before producing anything if any value is unusable, so a single bad
  // row can never leave the caller with a half-converted data set. This checks
  // the RAW fields rather than the coerced ones: `finite()` would silently turn a
  // corrupt amount into 0, and converting a corrupt row to 0 destroys data
  // instead of refusing to touch it.
  const raw: number[] = [
    ...transactions.map((t) => Number(t.amount)),
    ...goals.flatMap((g) => [Number(g.target), Number(g.saved)]),
    ...(emergencyBuffer === null ? [] : [Number(emergencyBuffer)]),
  ];
  if (raw.some((n) => !Number.isFinite(n))) return fail('invalid-amount');

  return {
    ok: true,
    from,
    to,
    transactions: transactions.map((t) => ({
      ...t,
      amount: convertCurrency(t.amount, sourceOf(t), to, table) as number,
      currency: to,
    })),
    goals: goals.map((g) => ({
      ...g,
      target: convertCurrency(g.target, sourceOf(g), to, table) as number,
      saved: convertCurrency(g.saved, sourceOf(g), to, table) as number,
      currency: to,
    })),
    emergencyBuffer:
      emergencyBuffer === null ? null : (convertCurrency(emergencyBuffer, from, to, table) as number),
  };
}

/**
 * Formats an ALREADY-CONVERTED amount. Pure presentation: no conversion
 * happens here, so callers can build chart scales, ticks and tooltips from
 * converted numbers and still get correct currency formatting.
 */
export function formatMoneyAmount(amount: number, currency = 'USD'): string {
  const digits = currencyFractionDigits(currency);
  return new Intl.NumberFormat(localeForCurrency(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(roundForCurrency(amount, currency));
}

/**
 * Compact money for tight spaces, e.g. $1.2k / ₹2.5K / ₹1L.
 * INR uses Indian compact units: K (thousand), L (lakh), Cr (crore).
 */
export function formatCompactAmount(amount: number, currency = 'USD'): string {
  if (currency === 'INR') {
    return `${currencySymbol(currency)}${compactNumber(amount)}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    // A zero-decimal currency must not grow a decimal in compact form (¥1.2k).
    maximumFractionDigits: currencyFractionDigits(currency) === 0 ? 0 : 1,
  }).format(roundForCurrency(amount, currency));
}

/** Compact number for INR: 0, 2.5K, 75K, 1L, 12.5L, 2Cr, … */
function compactNumber(amount: number): string {
  const abs = Math.abs(amount);
  // Drop trailing ".0" and cap non-integers at one decimal place.
  const trim = (n: number) =>
    Number.isInteger(n) ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, '');
  if (abs >= 1e7) return `${trim(amount / 1e7)}Cr`;
  if (abs >= 1e5) return `${trim(amount / 1e5)}L`;
  if (abs >= 1e3) return `${trim(amount / 1e3)}K`;
  return trim(amount);
}

/**
 * Converts a rate-anchored base amount and renders it in `currency`.
 *
 * NO LONGER the app's display path: stored amounts are already denominated in
 * the selected currency, so the UI formats them with `formatMoneyAmount`
 * directly. This stays as a tested building block for anyone holding a figure
 * that is still in the table's anchor currency.
 *
 * When the rate is unavailable it renders the amount in the base currency
 * instead of a guessed one, so it degrades to a truthful number.
 */
export function formatMoney(
  baseAmount: number,
  currency = 'USD',
  table?: RateTable | null,
): string {
  const converted = convertFromBase(baseAmount, currency, table);
  if (converted === null) return formatMoneyAmount(baseAmount, BASE_CURRENCY);
  return formatMoneyAmount(converted, currency);
}

/** Compact variant of `formatMoney`, for chart axes and tight tiles. */
export function formatMoneyCompact(
  baseAmount: number,
  currency = 'USD',
  table?: RateTable | null,
): string {
  const converted = convertFromBase(baseAmount, currency, table);
  if (converted === null) return formatCompactAmount(baseAmount, BASE_CURRENCY);
  return formatCompactAmount(converted, currency);
}

/**
 * A bare number for a text input holding a base-currency amount: the value the
 * user sees in the selected currency, with no symbol and no grouping (grouping
 * would fight the keyboard's numeric keypad).
 */
export function toInputValue(baseAmount: number, currency: string, table?: RateTable | null): number {
  const converted = convertFromBase(baseAmount, currency, table);
  if (converted === null) return roundForCurrency(baseAmount, currency);
  return roundForCurrency(converted, currency);
}
