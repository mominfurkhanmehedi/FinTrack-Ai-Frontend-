/**
 * Tests for the currency conversion + formatting layer (utils/currency.ts).
 *
 * Compiled by scripts/run-tests.mjs via the project's own tsc into
 * .test-build/ and executed with Node's built-in test runner (`node --test`).
 *
 * The module under test is pure on purpose — no React Native, no network, no
 * storage — so every rule the app depends on is assertable here:
 *
 *   - base-currency amounts are the unit of storage, and conversion is the only
 *     thing that happens at the presentation layer;
 *   - a converted TOTAL equals the sum of the converted parts, so a chart, a
 *     list and a summary can never disagree;
 *   - ratios (category shares, budget percentages) are scale-invariant and so
 *     identical in every currency;
 *   - an unavailable rate yields `null` and a base-currency fallback, never a
 *     guessed number;
 *   - JPY has no minor units and INR keeps Indian digit grouping.
 */
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const C = require('../.test-build/utils/currency.js');

const {
  BASE_CURRENCY,
  convertAmount,
  convertFromBase,
  convertToBase,
  currencyFractionDigits,
  currencySymbol,
  effectiveRate,
  formatCompactAmount,
  formatMoney,
  formatMoneyAmount,
  formatMoneyCompact,
  hasRateFor,
  isSupportedCurrency,
  normalizeCurrency,
  roundForCurrency,
  toInputValue,
} = C;

/** "How many X per 1 INR" for a deliberately non-round table. */
/**
 * A rate table covering EVERY supported currency, so tests that sweep `ALL`
 * never hit a code with no rate (which yields null/NaN and looks like a maths
 * bug when it is really a gap in the fixture).
 */
const RATES = {
  INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095, JPY: 1.8,
  AED: 0.0439, SGD: 0.0161, CAD: 0.0164, AUD: 0.0181, CHF: 0.0105,
};
const ALL = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AED', 'SGD', 'CAD', 'AUD', 'CHF'];

/**
 * A currency code the app deliberately does not support. Used wherever a test
 * needs a "real-looking but rejected" code -- `AUD` cannot be used for this
 * anymore now that it is a supported currency.
 */
const UNSUPPORTED = 'BTC';

/** Rounds to 6dp so float noise never decides a comparison. */
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} !~= ${b}`);

// ─────────────────────────────────────────────────────────────────────────────
// Base currency
// ─────────────────────────────────────────────────────────────────────────────

test('base currency is INR and every supported currency has a symbol', () => {
  assert.equal(BASE_CURRENCY, 'INR');
  assert.equal(currencySymbol('USD'), '$');
  assert.equal(currencySymbol('INR'), '₹');
  assert.equal(currencySymbol('EUR'), '€');
  assert.equal(currencySymbol('GBP'), '£');
  assert.equal(currencySymbol('JPY'), '¥');
  // An unknown code falls back to the code itself rather than throwing.
  assert.equal(currencySymbol('ZZZ'), 'ZZZ');
});

test('every offered currency is supported, and anything else is not', () => {
  for (const code of ALL) assert.equal(isSupportedCurrency(code), true, code);
  assert.equal(isSupportedCurrency(UNSUPPORTED), false);
  assert.equal(isSupportedCurrency('usd'), false);
  assert.equal(isSupportedCurrency(undefined), false);
  assert.equal(normalizeCurrency(UNSUPPORTED), 'INR');
  assert.equal(normalizeCurrency('JPY'), 'JPY');
});

test('fraction digits follow the currency (JPY has none)', () => {
  assert.equal(currencyFractionDigits('JPY'), 0);
  for (const code of ALL) {
    if (code === 'JPY') continue;
    assert.equal(currencyFractionDigits(code), 2, code);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Conversion
// ─────────────────────────────────────────────────────────────────────────────

test('base amounts are never rescaled on the way to the base currency', () => {
  near(convertFromBase(1000, 'INR', RATES), 1000);
  assert.equal(convertToBase(1000, 'INR', RATES), 1000);
});

test('base -> display applies the rate', () => {
  near(convertFromBase(1000, 'USD', RATES), 12);
  near(convertFromBase(1000, 'EUR', RATES), 11);
  near(convertFromBase(1000, 'JPY', RATES), 1800);
});

test('display -> base is the inverse of base -> display', () => {
  for (const code of ALL) {
    const there = convertFromBase(2500, code, RATES);
    assert.notEqual(there, null, code);
    const back = convertToBase(there, code, RATES);
    near(back, 2500);
  }
});

test('cross-currency conversion goes through the base', () => {
  // 1200 USD is 100 000 INR, which is 180 000 JPY.
  near(convertAmount(1200, 'USD', 'JPY', RATES), 180000);
  near(convertAmount(1800, 'JPY', 'USD', RATES), 12);
  assert.equal(convertAmount(500, 'EUR', 'EUR', RATES), 500);
});

test('effectiveRate is symmetric through the base', () => {
  near(effectiveRate('USD', 'JPY', RATES), 150); // 1.8 / 0.012
  near(effectiveRate('JPY', 'USD', RATES), 1 / 150);
  assert.equal(effectiveRate('EUR', 'EUR', RATES), 1);
  assert.equal(effectiveRate('USD', 'INR', RATES), 1 / 0.012);
});

// ─────────────────────────────────────────────────────────────────────────────
// Totals and percentages
// ─────────────────────────────────────────────────────────────────────────────

test('a converted total equals the sum of the converted parts, in every currency', () => {
  const transactions = [186.4, 1200, 64.2, 47.9, 95.5];
  const baseTotal = transactions.reduce((s, n) => s + n, 0);

  for (const code of ALL) {
    const convertedTotal = convertFromBase(baseTotal, code, RATES);
    const convertedParts = transactions
      .map((n) => convertFromBase(n, code, RATES))
      .reduce((s, n) => s + n, 0);
    near(convertedTotal, convertedParts);
  }
});

test('category shares and budget percentages are identical in every currency', () => {
  const values = { Food: 1500, Housing: 9000, Transport: 1500 };
  const total = Object.values(values).reduce((s, n) => s + n, 0);

  const share = (v) => (v / total) * 100;
  const baseShares = Object.values(values).map(share);

  for (const code of ALL) {
    const converted = Object.values(values).map((v) => convertFromBase(v, code, RATES));
    const convertedTotal = converted.reduce((s, n) => s + n, 0);
    const convertedShares = converted.map((v) => (v / convertedTotal) * 100);
    convertedShares.forEach((s, i) => near(s, baseShares[i]));
  }

  // Sanity: the numbers are actually meaningful, not all zeroes.
  near(baseShares[0], 12.5);
  near(baseShares[1], 75);
});

test('a goal progress ratio survives a currency switch', () => {
  const saved = 2150;
  const target = 5000;
  const basePct = (saved / target) * 100;
  for (const code of ALL) {
    const pct =
      (convertFromBase(saved, code, RATES) / convertFromBase(target, code, RATES)) * 100;
    near(pct, basePct);
  }
  near(basePct, 43);
});

// ─────────────────────────────────────────────────────────────────────────────
// Missing / invalid rates
// ─────────────────────────────────────────────────────────────────────────────

test('a missing rate yields null rather than a guess', () => {
  const partial = { INR: 1, USD: 0.012 };
  assert.equal(convertFromBase(1000, 'USD', partial), 12);
  assert.equal(convertFromBase(1000, 'GBP', partial), null);
  assert.equal(convertToBase(1000, 'GBP', partial), null);
  assert.equal(convertAmount(1000, 'USD', 'GBP', partial), null);
  assert.equal(hasRateFor('GBP', partial), false);
  assert.equal(hasRateFor('USD', partial), true);
  // The base currency never needs a rate.
  assert.equal(hasRateFor('INR', null), true);
  assert.equal(convertFromBase(1000, 'INR', null), 1000);
});

test('no table at all behaves like a missing rate', () => {
  assert.equal(convertFromBase(1000, 'USD', null), null);
  assert.equal(convertFromBase(1000, 'USD', undefined), null);
  assert.equal(hasRateFor('USD', null), false);
});

test('non-positive and non-finite rates are rejected', () => {
  const broken = { INR: 1, USD: 0, EUR: -2, GBP: Number.NaN, JPY: Number.POSITIVE_INFINITY };
  for (const code of ['USD', 'EUR', 'GBP', 'JPY']) {
    assert.equal(hasRateFor(code, broken), false, code);
    assert.equal(convertFromBase(1000, code, broken), null, code);
  }
});

test('with no rate, formatMoney falls back to the base currency instead of lying', () => {
  // The amount is still shown, but in the base currency — never rescaled.
  const out = formatMoney(2500, 'JPY', { INR: 1, USD: 0.012 });
  assert.equal(out, formatMoneyAmount(2500, 'INR'));
  assert.ok(!out.includes('¥'));

  const compact = formatMoneyCompact(2500, 'JPY', { INR: 1, USD: 0.012 });
  assert.equal(compact, formatCompactAmount(2500, 'INR'));

  // An input pre-fill likewise falls back rather than inventing a number.
  assert.equal(toInputValue(2500, 'JPY', { INR: 1, USD: 0.012 }), 2500);
});

test('a non-finite amount is coerced to 0 instead of producing NaN', () => {
  near(convertFromBase(Number.NaN, 'USD', RATES), 0);
  assert.equal(formatMoney(Number.NaN, 'USD', RATES), formatMoneyAmount(0, 'USD'));
  assert.ok(!formatMoney(Number.POSITIVE_INFINITY, 'USD', RATES).includes('NaN'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

test('formatMoney converts then formats', () => {
  assert.equal(formatMoney(1000, 'USD', RATES), '$12.00');
  assert.equal(formatMoney(1000, 'EUR', RATES), '€11.00');
  assert.equal(formatMoney(1000, 'GBP', RATES), '£9.50');
  assert.equal(formatMoney(1000, 'INR', RATES), '₹1,000.00');
});

test('JPY renders without minor units', () => {
  assert.equal(formatMoney(1000, 'JPY', RATES), '¥1,800');
  // A converted value that lands on a half is rounded, never shown as .5 yen.
  assert.equal(formatMoneyAmount(1234.5, 'JPY'), '¥1,235');
  assert.equal(formatCompactAmount(12345, 'JPY'), '¥12K');
  // The other currencies keep two decimals.
  assert.equal(formatMoneyAmount(1234.5, 'USD'), '$1,234.50');
});

test('INR keeps Indian digit grouping', () => {
  assert.equal(formatMoneyAmount(1000000, 'INR'), '₹10,00,000.00');
  // Western grouping would render this as ₹1,000,000.00.
  assert.equal(formatMoney(1000000, 'INR', RATES), '₹10,00,000.00');
});

test('compact formatting stays compact in every currency', () => {
  assert.equal(formatMoneyCompact(100000, 'USD', RATES), '$1.2K');
  // INR keeps its Indian compact units (lakh) rather than Intl's "100K".
  assert.equal(formatMoneyCompact(100000, 'INR', RATES), '₹1L');
  assert.equal(formatMoneyCompact(100000, 'JPY', RATES), '¥180K');
  // JPY stays on whole units even in compact form.
  assert.equal(formatMoneyCompact(1000, 'JPY', RATES), '¥2K');
});

test('a currency symbol never leaks into a different currency', () => {
  for (const code of ALL) {
    const out = formatMoney(1234.5, code, RATES);
    if (code === 'INR') {
      assert.ok(out.includes('₹'), out);
    } else {
      assert.ok(!out.includes('₹'), `${code} rendered with an INR sign: ${out}`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Rounding and input pre-fill
// ─────────────────────────────────────────────────────────────────────────────

test('roundForCurrency respects each currency minor unit', () => {
  assert.equal(roundForCurrency(1234.567, 'JPY'), 1235);
  assert.equal(roundForCurrency(1234.567, 'USD'), 1234.57);
  assert.equal(roundForCurrency(1234.567, 'INR'), 1234.57);
  // Negative amounts round symmetrically.
  assert.equal(roundForCurrency(-1234.567, 'JPY'), -1235);
});

test('toInputValue gives a plain rounded number for a text field', () => {
  assert.equal(toInputValue(1000, 'USD', RATES), 12);
  assert.equal(toInputValue(1000, 'JPY', RATES), 1800);
  // Rounded to the display currency's minor unit, with no symbol or grouping.
  assert.equal(toInputValue(1234.5, 'USD', RATES), 14.81);
  assert.equal(typeof toInputValue(1000, 'USD', RATES), 'number');
});

test('a base->display->base round trip is lossy by at most one minor unit', () => {
  // This is exactly why the edit form submits the STORED base amount when the
  // user never touched the amount field: re-deriving it from the display value
  // would nudge it by a fraction of a minor unit on every save.
  const original = 1234.5;
  for (const code of ALL) {
    const viaDisplay = toInputValue(original, code, RATES);
    const backToBase = convertToBase(viaDisplay, code, RATES);
    // Rounding the DISPLAY value to its minor unit is the only source of drift,
    // so the worst case is half a minor unit of that currency, carried back
    // into the base currency through the same rate.
    const oneMinorUnit = 10 ** -currencyFractionDigits(code);
    const perMinorUnit = convertAmount(oneMinorUnit, code, BASE_CURRENCY, RATES);
    const tolerance = 0.5 * perMinorUnit + 1e-9;
    assert.ok(
      Math.abs(backToBase - original) <= tolerance,
      `${code} drifted by ${Math.abs(backToBase - original)} (tolerance ${tolerance})`,
    );
  }

  // With no conversion involved the round trip is exact.
  assert.equal(toInputValue(original, 'INR', RATES), original);
  assert.equal(convertToBase(original, 'INR', RATES), original);
});
