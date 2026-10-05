import { useCallback, useEffect } from 'react';

import { useAppStore } from '../store';
import {
  BASE_CURRENCY,
  convertAmount,
  convertFromBase,
  currencySymbol,
  formatCompactAmount,
  formatMoneyAmount,
  hasRateFor,
  roundForCurrency,
} from '../utils';
import type { RatesStatus } from '../services/exchangeRates';

/**
 * useMoney — the single access point for money in the app.
 *
 * THE STORED CURRENCY IS THE SELECTED CURRENCY
 * --------------------------------------------
 * Every amount the app persists — transaction amounts (income and expense
 * alike), goal targets, savings, the safety buffer, and therefore every derived
 * balance, total and ratio — is denominated in the user's currently selected
 * currency, and each row says so in its own `currency` field. Selecting a
 * different currency PERMANENTLY rewrites those values (`store.setCurrency`),
 * so the database always speaks the same currency as the UI.
 *
 * Because of that this hook performs NO conversion on the way to the screen:
 *
 *   - `format(amount)` renders the stored amount as-is;
 *   - `convert(amount)` is the identity, kept so chart code that already
 *     separates numeric series from their formatting keeps working;
 *   - `toBase(amount)` is the identity, so a value the user typed is stored
 *     exactly as entered.
 *
 * That is deliberate rather than a shortcut: with conversion applied both on
 * write and on read, a value would be rescaled twice, and the only way to be
 * sure it never is again is for the display layer to have no conversion to do.
 * A chart that mixes an aggregated total with per-row values also stays exactly
 * consistent for the same reason — no rounding happens between the sum and the
 * parts.
 *
 * Exchange rates are still needed, but only for the one operation that changes
 * the currency. `canConvert` reports whether that is currently possible, and the
 * Settings screen explains it when it is not.
 */
export function useMoney() {
  const currency = useAppStore((s) => s.currency);
  const rates = useAppStore((s) => s.exchangeRates);
  const ratesStatus = useAppStore((s) => s.exchangeRatesStatus);
  const ratesUpdatedAt = useAppStore((s) => s.exchangeRatesUpdatedAt);
  const refreshExchangeRates = useAppStore((s) => s.refreshExchangeRates);

  const isBase = currency === BASE_CURRENCY;
  /**
   * Whether switching to (or between) currencies is possible right now. Only a
   * currency change needs a rate — reading and writing amounts in the selected
   * currency never does.
   */
  const canConvert = isBase || hasRateFor(currency, rates);

  /**
   * Numbers this hook returns are always denominated in the selected currency,
   * so `formatValue` / `formatCompactValue` can format them directly and the
   * common chart idiom `convert(v) ?? v` stays safe.
   */
  const valueCurrency = currency;

  // Ask for a table whenever a rate will be needed. This is a no-op once rates
  // are present and fresh: the service coalesces concurrent callers and honours
  // its own TTL, so every screen mounting at once still costs at most one
  // request. `canConvert` only flips on a currency change or on rates
  // arriving/failing, so this cannot loop.
  useEffect(() => {
    if (!canConvert) void refreshExchangeRates();
  }, [canConvert, currency, rates, refreshExchangeRates]);

  /** Renders a stored amount in the selected currency. No conversion. */
  const format = useCallback(
    (amount: number) => formatMoneyAmount(amount, currency),
    [currency],
  );

  /** Compact form of `format`, for chart axes and tight tiles. */
  const formatCompact = useCallback(
    (amount: number) => formatCompactAmount(amount, currency),
    [currency],
  );

  /**
   * Formats a stored amount. Identical to `format`; kept as a separate name
   * because chart code reads better when it says which of its numbers have been
   * through the numeric `convert` step.
   */
  const formatValue = useCallback(
    (amount: number) => formatMoneyAmount(amount, valueCurrency),
    [valueCurrency],
  );

  /** `formatValue` in compact form. */
  const formatCompactValue = useCallback(
    (amount: number) => formatCompactAmount(amount, valueCurrency),
    [valueCurrency],
  );

  /**
   * The identity, by design: a stored amount is already in the selected
   * currency. Returns a number so chart scales and tooltip math keep working
   * unchanged, and rounds to the currency's minor unit so JPY never grows a
   * decimal.
   */
  const convert = useCallback(
    (amount: number) => roundForCurrency(amount, currency),
    [currency],
  );

  /**
   * A number the user typed, normalized to the selected currency's minor unit.
   * Stored as-is — the database holds the selected currency, so there is nothing
   * to convert to. Never returns null, but keeps the nullable shape its callers
   * already handle so no form logic has to change.
   */
  const toBase = useCallback(
    (amount: number) => roundForCurrency(amount, currency),
    [currency],
  );

  /** The number to pre-fill an input with: stored as-is, no symbol or grouping. */
  const toInputValue = useCallback(
    (amount: number) => roundForCurrency(amount, currency),
    [currency],
  );

  /** Converts an amount held in another supported currency into the selected one. */
  const convertFrom = useCallback(
    (amount: number, fromCurrency: string) => convertAmount(amount, fromCurrency, currency, rates),
    [currency, rates],
  );

  /**
   * Units of the rate table's base (INR) per 1 unit of the selected currency —
   * the quote a currency picker shows next to an option. `null` when unknown.
   */
  const basePerUnit = useCallback(() => {
    const converted = convertFromBase(1, currency, rates);
    return converted === null ? null : 1 / converted;
  }, [currency, rates]);

  /** Force-refreshes the rate table, bypassing the TTL. */
  const refreshRates = useCallback(
    () => void refreshExchangeRates({ force: true }),
    [refreshExchangeRates],
  );

  /**
   * Id of the feed the in-use table came from, or `null` when no table has ever
   * been obtained. Surfaced in Settings so a fallback provider is visible rather
   * than silent.
   */
  const ratesSource = useAppStore((s) => s.exchangeRatesSource);

  return {
    currency,
    symbol: currencySymbol(currency),
    /** Currency of every number this hook returns: always the selected one. */
    valueCurrency,
    format,
    formatCompact,
    formatValue,
    formatCompactValue,
    convert,
    convertFrom,
    toBase,
    toInputValue,
    basePerUnit,
    /** True while the selected currency is the rate table's base (INR). */
    isBase,
    /** False when the selected currency cannot be converted right now. */
    canConvert,
    ratesStatus: ratesStatus as RatesStatus,
    ratesUpdatedAt,
    ratesSource,
    refreshRates,
  };
}
