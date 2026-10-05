/**
 * Tests for PERMANENT currency conversion.
 *
 * Covers `convertCurrency` and `planCurrencyChange` in `utils/currency.ts` —
 * the layer that rewrites stored amounts when the user picks a new currency.
 *
 * The rules under test are the ones that make the database trustworthy:
 *
 *   - a change converts FROM the currency the data is actually in, so a chained
 *     INR -> USD -> EUR is USD -> EUR on the second step, never INR -> EUR;
 *   - every monetary field is covered: income and expense amounts, goal targets,
 *     savings (`saved`) and the safety buffer;
 *   - each rewritten record carries the new currency;
 *   - the plan is all-or-nothing, so a missing rate can never leave half the
 *     data converted;
 *   - re-selecting the current currency changes nothing at all.
 *
 * Compiled by scripts/run-tests.mjs via the project's own tsc into .test-build/
 * and executed with Node's built-in test runner.
 */
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const C = require('../.test-build/utils/currency.js');

const {
  BASE_CURRENCY,
  convertCurrency,
  planCurrencyChange,
  reconcileCurrencyFromRecords,
  recordCurrency,
  roundForCurrency,
} = C;

/** "How many X per 1 INR" for a deliberately non-round table. */
const RATES = { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095, JPY: 1.8 };

/** Rounds to 6dp so float noise never decides a comparison. */
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} !~= ${b}`);

const tx = (id, amount, type = 'expense', extra = {}) => ({
  id,
  title: id,
  amount,
  type,
  category: 'Food',
  date: '2026-01-01',
  currency: BASE_CURRENCY,
  ...extra,
});

const goal = (id, target, saved, extra = {}) => ({
  id,
  title: id,
  target,
  saved,
  currency: BASE_CURRENCY,
  ...extra,
});

/** A small but complete data set: income, expense, a goal with savings, a buffer. */
const data = () => ({
  transactions: [tx('tx-1', 10000, 'income'), tx('tx-2', 2500.5, 'expense')],
  goals: [goal('goal-1', 50000, 21500)],
  emergencyBuffer: 12000,
});

// ─────────────────────────────────────────────────────────────────────────────
// convertCurrency — the centralized utility
// ─────────────────────────────────────────────────────────────────────────────

test('convertCurrency converts between any two supported currencies', () => {
  near(convertCurrency(10000, 'INR', 'USD', RATES), 120);
  near(convertCurrency(120, 'USD', 'INR', RATES), 10000);
  near(convertCurrency(120, 'USD', 'EUR', RATES), 110);
  near(convertCurrency(110, 'EUR', 'JPY', RATES), 18000);
  near(convertCurrency(18000, 'JPY', 'INR', RATES), 10000);
});

test('convertCurrency is a no-op for identical currencies', () => {
  for (const code of ['INR', 'USD', 'EUR', 'GBP', 'JPY']) {
    // Not merely multiplied by a rate of 1 — not re-rounded either, so calling it
    // can never quietly shift a stored value.
    assert.equal(convertCurrency(1234.5, code, code, RATES), 1234.5, code);
  }
  // And it needs no rate table at all, so a total outage cannot block a
  // same-currency edit.
  assert.equal(convertCurrency(500, 'INR', 'INR', null), 500);
});

test('convertCurrency rounds to the TARGET currency minor unit', () => {
  // 100 INR -> 180 JPY exactly; a fractional yen must not survive into storage.
  assert.equal(convertCurrency(100, 'INR', 'JPY', RATES), 180);
  assert.equal(roundForCurrency(convertCurrency(123, 'INR', 'JPY', RATES), 'JPY'), 221);
  // Two-decimal currencies keep cents.
  near(convertCurrency(1000, 'INR', 'USD', RATES), 12);
  near(convertCurrency(1, 'INR', 'USD', RATES), 0.01);
});

test('convertCurrency refuses rather than guessing', () => {
  const partial = { INR: 1, USD: 0.012 };
  assert.equal(convertCurrency(1000, 'INR', 'GBP', partial), null);
  assert.equal(convertCurrency(1000, 'INR', 'USD', null), null);
  assert.equal(convertCurrency(1000, 'INR', 'AUD', RATES), null);
  assert.equal(convertCurrency(1000, 'XXX', 'USD', RATES), null);
  assert.equal(convertCurrency(1000, 'INR', 'usd', RATES), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// recordCurrency — existing rows are INR
// ─────────────────────────────────────────────────────────────────────────────

test('a record with no currency is treated as the legacy INR base', () => {
  assert.equal(recordCurrency({}), 'INR');
  assert.equal(recordCurrency({ currency: null }), 'INR');
  assert.equal(recordCurrency({ currency: '' }), 'INR');
  assert.equal(recordCurrency({ currency: 'BTC' }), 'INR');
  assert.equal(recordCurrency({ currency: 'usd' }), 'INR');
  // A currency the app supports is taken at face value.
  assert.equal(recordCurrency({ currency: 'JPY' }), 'JPY');
  assert.equal(recordCurrency({ currency: 'AED' }), 'AED');
  assert.equal(BASE_CURRENCY, 'INR');
});

// ─────────────────────────────────────────────────────────────────────────────
// planCurrencyChange — the whole-data conversion
// ─────────────────────────────────────────────────────────────────────────────

test('INR -> USD permanently converts every stored amount', () => {
  const plan = planCurrencyChange(data(), 'INR', 'USD', RATES);
  assert.equal(plan.ok, true);
  assert.equal(plan.from, 'INR');
  assert.equal(plan.to, 'USD');

  const salary = plan.transactions.find((t) => t.id === 'tx-1');
  const rent = plan.transactions.find((t) => t.id === 'tx-2');
  // Both directions of the ledger, not just expenses.
  near(salary.amount, 120); // 10 000 INR income
  near(rent.amount, 30.01); // 2 500.5 INR expense
  near(plan.goals[0].target, 600); // goal target
  near(plan.goals[0].saved, 258); // savings
  near(plan.emergencyBuffer, 144); // safety buffer
});

test('every rewritten record is stamped with the new currency', () => {
  const plan = planCurrencyChange(data(), 'INR', 'USD', RATES);
  for (const t of plan.transactions) assert.equal(t.currency, 'USD', t.id);
  for (const g of plan.goals) assert.equal(g.currency, 'USD', g.id);
});

test('non-monetary fields survive the conversion untouched', () => {
  const source = {
    transactions: [tx('tx-1', 10000, 'income', { title: 'Salary', category: 'Salary', date: '2026-03-04' })],
    goals: [{ ...goal('goal-1', 50000, 21500), title: 'Emergency fund', deadline: '2027-01-01' }],
    emergencyBuffer: 12000,
  };
  const plan = planCurrencyChange(source, 'INR', 'USD', RATES);
  assert.deepEqual(
    { ...plan.transactions[0], amount: 0, currency: null },
    { ...source.transactions[0], amount: 0, currency: null },
  );
  assert.deepEqual(
    { ...plan.goals[0], target: 0, saved: 0, currency: null },
    { ...source.goals[0], target: 0, saved: 0, currency: null },
  );
});

test('a chained change converts from the CURRENT currency, never from INR', () => {
  // The requirement this guards: 100 INR -> USD -> EUR must be 120 USD -> 110
  // EUR. Converting from INR again would give 11 EUR — a wrong number that is
  // off by a factor of ten.
  const original = { transactions: [tx('tx-1', 100)], goals: [], emergencyBuffer: null };

  const toUsd = planCurrencyChange(original, 'INR', 'USD', RATES);
  near(toUsd.transactions[0].amount, 1.2);

  const toEur = planCurrencyChange(toUsd, 'USD', 'EUR', RATES);
  near(toEur.transactions[0].amount, 1.1);
  assert.equal(toEur.transactions[0].currency, 'EUR');

  // And the same for the full INR -> USD -> EUR -> GBP -> JPY chain.
  let current = planCurrencyChange(original, 'INR', 'USD', RATES);
  for (const code of ['EUR', 'GBP', 'JPY']) {
    current = planCurrencyChange(current, current.to, code, RATES);
    assert.equal(current.ok, true);
  }
  // 100 INR is 180 JPY at this table.
  near(current.transactions[0].amount, 180);
  assert.equal(current.transactions[0].currency, 'JPY');
});

test('each row is converted from the currency IT records, not the app-wide one', () => {
  // A row written under an older preference still says what it is denominated
  // in. Converting it with the global `from` would rescale it by the wrong
  // factor: 120 USD must reach EUR as 110, while 100000 INR reaches it as 1100.
  const mixed = {
    transactions: [tx('usd-row', 120, 'expense', { currency: 'USD' }), tx('inr-row', 100000)],
    goals: [goal('usd-goal', 600, 0, { currency: 'USD' }), goal('inr-goal', 10000, 1000)],
    emergencyBuffer: null,
  };

  const plan = planCurrencyChange(mixed, 'INR', 'EUR', RATES);
  assert.equal(plan.ok, true);

  // The USD row uses the USD -> EUR rate (0.011 / 0.012).
  near(plan.transactions[0].amount, 110);
  // The INR row uses the INR -> EUR rate (0.011).
  near(plan.transactions[1].amount, 1100);
  // Goals are converted from their own recorded currency too.
  near(plan.goals[0].target, 550);
  near(plan.goals[1].target, 110);

  // Every row ends up stamped with the one target currency.
  for (const t of plan.transactions) assert.equal(t.currency, 'EUR');
  for (const g of plan.goals) assert.equal(g.currency, 'EUR');
});

test('a row already in the target currency is left at its own value', () => {
  // Mixed state: the preference is INR but one row is already EUR and the user
  // picks EUR. That row must not be rescaled, only relabelled.
  const mixed = {
    transactions: [tx('already-eur', 110, 'expense', { currency: 'EUR' }), tx('inr-row', 100000)],
    goals: [],
    emergencyBuffer: null,
  };
  const plan = planCurrencyChange(mixed, 'INR', 'EUR', RATES);
  assert.equal(plan.ok, true);
  near(plan.transactions[0].amount, 110);
  near(plan.transactions[1].amount, 1100);
});

test('a row whose own currency has no rate fails the plan, leaving the others alone', () => {
  // No USD rate in the table, so the USD row cannot be converted to EUR. The
  // whole plan must fail rather than converting only the INR row.
  const noUsd = { INR: 1, EUR: 0.011, GBP: 0.0095, JPY: 1.8 };
  const mixed = {
    transactions: [tx('usd-row', 120, 'expense', { currency: 'USD' }), tx('inr-row', 100000)],
    goals: [],
    emergencyBuffer: null,
  };
  const plan = planCurrencyChange(mixed, 'INR', 'EUR', noUsd);
  assert.equal(plan.ok, false);
  assert.equal(plan.error, 'no-rate');
  // The original records are handed back untouched.
  assert.equal(plan.transactions[0].amount, 120);
  assert.equal(plan.transactions[1].amount, 100000);
});

test('a row with no currency column is treated as the legacy currency', () => {
  // A row predating the migration reads as INR, so it converts with the INR
  // rate even when the app-wide preference says USD.
  const legacy = {
    transactions: [{ ...tx('legacy', 100000), currency: undefined }],
    goals: [],
    emergencyBuffer: null,
  };
  assert.equal(recordCurrency(legacy.transactions[0]), BASE_CURRENCY);

  const plan = planCurrencyChange(legacy, 'USD', 'EUR', RATES);
  assert.equal(plan.ok, true);
  // 100000 INR * 0.011, NOT 100000 treated as USD.
  near(plan.transactions[0].amount, 1100);
  assert.equal(plan.transactions[0].currency, 'EUR');
});

test('the safety buffer follows the app-wide currency, since it has no row code', () => {
  const withBuffer = {
    transactions: [tx('usd-row', 120, 'expense', { currency: 'USD' })],
    goals: [],
    emergencyBuffer: 1000,
  };
  const plan = planCurrencyChange(withBuffer, 'INR', 'EUR', RATES);
  assert.equal(plan.ok, true);
  // Buffer is converted with `from` (INR), the row with its own USD code.
  near(plan.emergencyBuffer, 11);
  near(plan.transactions[0].amount, 110);
});

test('a chained round trip returns to within the accumulated rounding of each step', () => {

  const toUsd = planCurrencyChange(data(), 'INR', 'USD', RATES);
  const toEur = planCurrencyChange(toUsd, 'USD', 'EUR', RATES);
  const backToInr = planCurrencyChange(toEur, 'EUR', 'INR', RATES);

  assert.equal(backToInr.ok, true);
  for (const t of backToInr.transactions) assert.equal(t.currency, 'INR');

  // Each hop stores the amount rounded to that currency's minor unit, so a value
  // is never re-scaled from full precision — it is the *stored* amount that the
  // next hop reads. The drift is therefore bounded by half a minor unit of each
  // intermediate currency, re-expressed in INR. With USD and EUR both quoted
  // per 1 INR, one US cent is worth ~0.83 INR, so two hops stay under ~1 INR on
  // a 10 000 balance: visually nothing, and it never compounds silently because
  // the database holds the rounded figure and every total is its exact sum.
  const centsInInr = 1 / RATES.USD; // one minor unit of USD, in INR
  const tolerance = 2 * 0.5 * centsInInr;

  const cases = [
    [backToInr.transactions.find((t) => t.id === 'tx-1').amount, 10000],
    [backToInr.transactions.find((t) => t.id === 'tx-2').amount, 2500.5],
    [backToInr.goals[0].target, 50000],
    [backToInr.goals[0].saved, 21500],
    [backToInr.emergencyBuffer, 12000],
  ];
  for (const [actual, original] of cases) {
    assert.ok(
      Math.abs(actual - original) <= tolerance,
      `${actual} drifted from ${original} by more than ${tolerance}`,
    );
  }
});

test('JPY conversion lands on whole yen, so the database holds no decimals', () => {
  const plan = planCurrencyChange(data(), 'INR', 'JPY', RATES);
  for (const t of plan.transactions) {
    assert.equal(t.amount, Math.round(t.amount), `${t.id} kept a decimal in JPY`);
  }
  assert.equal(plan.transactions.find((t) => t.id === 'tx-1').amount, 18000);
  assert.equal(plan.goals[0].target, 90000);
  assert.equal(plan.goals[0].saved, 38700);
  assert.equal(plan.emergencyBuffer, 21600);
});

test('an automatic safety buffer (null) stays automatic', () => {
  const plan = planCurrencyChange({ ...data(), emergencyBuffer: null }, 'INR', 'USD', RATES);
  assert.equal(plan.ok, true);
  assert.equal(plan.emergencyBuffer, null);
});

test('an empty data set is still a valid conversion', () => {
  const plan = planCurrencyChange({ transactions: [], goals: [], emergencyBuffer: null }, 'INR', 'USD', RATES);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.transactions, []);
  assert.deepEqual(plan.goals, []);
});

test('a plan leaves the source data alone', () => {
  const source = data();
  const snapshot = JSON.stringify(source);
  planCurrencyChange(source, 'INR', 'USD', RATES);
  assert.equal(JSON.stringify(source), snapshot);
});

// ─────────────────────────────────────────────────────────────────────────────
// Failure modes — nothing may be half-converted
// ─────────────────────────────────────────────────────────────────────────────

test('a missing rate fails the whole plan and changes nothing', () => {
  const source = data();
  const plan = planCurrencyChange(source, 'INR', 'GBP', { INR: 1, USD: 0.012 });

  assert.equal(plan.ok, false);
  assert.equal(plan.error, 'no-rate');
  // The ORIGINAL records come back, so a caller that ignores `ok` still cannot
  // persist a partial conversion.
  assert.deepEqual(plan.transactions, source.transactions);
  assert.deepEqual(plan.goals, source.goals);
  assert.equal(plan.emergencyBuffer, source.emergencyBuffer);
  for (const t of plan.transactions) assert.equal(t.currency, 'INR');
});

test('no rate table at all is refused rather than guessed', () => {
  for (const table of [null, undefined, { INR: 1 }]) {
    const plan = planCurrencyChange(data(), 'INR', 'USD', table);
    assert.equal(plan.ok, false, JSON.stringify(table));
    assert.equal(plan.error, 'no-rate');
  }
});

test('re-selecting the current currency is a no-op, not a second conversion', () => {
  const source = data();
  for (const code of ['INR', 'USD', 'EUR', 'GBP', 'JPY']) {
    const plan = planCurrencyChange(source, code, code, RATES);
    assert.equal(plan.ok, false, code);
    assert.equal(plan.error, 'same-currency');
    assert.deepEqual(plan.transactions, source.transactions);
    assert.deepEqual(plan.goals, source.goals);
    assert.equal(plan.emergencyBuffer, source.emergencyBuffer);
  }
  // It is refused before any rate lookup, so it works with no table at all.
  assert.equal(planCurrencyChange(source, 'INR', 'INR', null).error, 'same-currency');
});

test('an unsupported currency is refused', () => {
  for (const [from, to] of [
    ['INR', 'BTC'],
    ['BTC', 'INR'],
    ['INR', 'usd'],
  ]) {
    const plan = planCurrencyChange(data(), from, to, RATES);
    assert.equal(plan.ok, false, `${from}->${to}`);
    assert.equal(plan.error, 'unsupported');
  }
});

test('a broken rate is treated as a missing rate', () => {
  const broken = { INR: 1, USD: 0, EUR: -2, GBP: Number.NaN, JPY: Number.POSITIVE_INFINITY };
  const plan = planCurrencyChange(data(), 'INR', 'GBP', broken);
  assert.equal(plan.ok, false);
  assert.equal(plan.error, 'no-rate');
});

test('a non-finite stored amount fails the plan instead of being written', () => {
  const broken = { ...data(), transactions: [tx('tx-1', Number.NaN)] };
  const plan = planCurrencyChange(broken, 'INR', 'USD', RATES);
  assert.equal(plan.ok, false);
  assert.equal(plan.error, 'invalid-amount');
  assert.deepEqual(plan.transactions, broken.transactions);
});

// ─────────────────────────────────────────────────────────────────────────────
// Ratios and totals — the UI must stay self-consistent after a conversion
// ─────────────────────────────────────────────────────────────────────────────

test('a total on screen is exactly the sum of the amounts listed above it', () => {
  const source = {
    transactions: [tx('a', 186.4), tx('b', 1200), tx('c', 64.2), tx('d', 47.9), tx('e', 95.5)],
    goals: [],
    emergencyBuffer: null,
  };
  const sum = (rows) => rows.reduce((s, r) => s + r.amount, 0);
  const sourceTotal = sum(source.transactions);

  for (const to of ['USD', 'EUR', 'GBP', 'JPY']) {
    const plan = planCurrencyChange(source, 'INR', to, RATES);
    assert.equal(plan.ok, true, to);

    // The dashboard total is `sum(records)`, and the database holds those
    // records — so the two agree EXACTLY. This is the property that matters:
    // converting a pre-aggregated total and converting the rows would disagree,
    // and only one of them can be what is actually stored.
    near(sum(plan.transactions), plan.transactions.reduce((s, r) => s + r.amount, 0));

    // The per-row rounding shifts the total from the un-rounded conversion by at
    // most half a minor unit per row, and never by more.
    const ideal = sourceTotal * C.effectiveRate('INR', to, RATES);
    const tolerance = 0.5 * 10 ** -C.currencyFractionDigits(to) * source.transactions.length;
    assert.ok(
      Math.abs(sum(plan.transactions) - ideal) <= tolerance,
      `${to}: ${sum(plan.transactions)} is more than ${tolerance} from ${ideal}`,
    );
  }
});

test('goal progress and category shares are unchanged by a conversion', () => {
  const source = { transactions: [tx('a', 1500), tx('b', 9000), tx('c', 1500)], goals: [goal('g', 50000, 21500)], emergencyBuffer: null };
  const share = (rows) => rows.map((r) => r.amount / rows.reduce((s, x) => s + x.amount, 0));
  const before = share(source.transactions);
  const beforeProgress = source.goals[0].saved / source.goals[0].target;

  for (const to of ['USD', 'EUR', 'GBP', 'JPY']) {
    const plan = planCurrencyChange(source, 'INR', to, RATES);
    const after = share(plan.transactions);
    after.forEach((s, i) => near(s, before[i]));
    near(plan.goals[0].saved / plan.goals[0].target, beforeProgress);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// New records created after a change
// ─────────────────────────────────────────────────────────────────────────────

test('a new record created after a change is already in the selected currency', () => {
  // The store stamps the current selection on insert, so what the user typed is
  // what is stored — no conversion on the way in, which is what keeps a new
  // transaction consistent with the converted ones around it.
  const plan = planCurrencyChange(data(), 'INR', 'USD', RATES);
  const selected = plan.to;

  const newTransaction = { id: 'tx-new', title: 'Coffee', amount: 4.5, type: 'expense', category: 'Food', date: '2026-04-01', currency: selected };
  assert.equal(newTransaction.currency, 'USD');
  assert.equal(newTransaction.amount, 4.5);
  // It totals with the converted records in the same unit.
  const total = [...plan.transactions, newTransaction].reduce((s, r) => s + r.amount, 0);
  near(total, 120 + 30.01 + 4.5);
});

// ─────────────────────────────────────────────────────────────────────────────
// reconcileCurrencyFromRecords - which code the app should be on after a load
// ─────────────────────────────────────────────────────────────────────────────

test('reconciling follows the rows, not the device preference', () => {
  // The bug this prevents: the server rows are in USD (a conversion already ran)
  // while the device preference still says INR. Adopting the rows is what keeps
  // the UI from labelling USD amounts with a rupee sign.
  const rows = [tx('a', 120, 'expense', { currency: 'USD' }), goal('g', 600, 60, { currency: 'USD' })];
  assert.deepEqual(reconcileCurrencyFromRecords(rows), { kind: 'agreed', currency: 'USD' });
});

test('reconciling pre-feature rows overrides a display-only saved preference', () => {
  // Rows written before the currency column have no code and are all INR. An old
  // install could have had "USD" selected purely for display, so trusting that
  // preference would restore rupee amounts labelled as dollars.
  const legacyRows = [tx('a', 10000), tx('b', 2500)];
  assert.deepEqual(reconcileCurrencyFromRecords(legacyRows), { kind: 'agreed', currency: 'INR' });
});

test('reconciling no records reports empty so the saved preference stands', () => {
  // A brand new account legitimately has no rows yet; there is nothing to infer.
  assert.deepEqual(reconcileCurrencyFromRecords([]), { kind: 'empty' });
});

test('reconciling mixed rows reports them and picks the majority', () => {
  const mixed = [
    tx('a', 120, 'expense', { currency: 'USD' }),
    tx('b', 120, 'expense', { currency: 'USD' }),
    tx('c', 10000),
  ];
  const result = reconcileCurrencyFromRecords(mixed);
  assert.equal(result.kind, 'ambiguous');
  assert.equal(result.currency, 'USD');
  assert.deepEqual(result.mixed, ['INR', 'USD']);

  // And the follow-up a caller would take: converting from the rows' own codes
  // normalizes the whole set onto one currency.
  const plan = planCurrencyChange({ transactions: mixed, goals: [], emergencyBuffer: null }, 'INR', 'EUR', RATES);
  assert.equal(plan.ok, true);
  for (const t of plan.transactions) assert.equal(t.currency, 'EUR');
});
