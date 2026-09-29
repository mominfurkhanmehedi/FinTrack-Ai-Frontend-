/**
 * Tests for the Reports data builders (components/reports/reportData.ts).
 *
 * Compiled by scripts/run-tests.mjs via the project's own tsc into
 * .test-build/ and executed with Node's built-in test runner (`node --test`).
 *
 * These lock down the "Balance over time" requirement: balance is a running
 * total of REAL income minus expenses over chronological dates, quiet days
 * carry the balance forward (never an invented 0), ranges are sliced
 * correctly, and future-dated rows cannot rewrite history.
 */
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const R = require('../.test-build/components/reports/reportData.js');

const { buildBalanceSeries, buildCashFlow, buildCategoryData, categoryPercentLabels } = R;

const tx = (title, amount, type, category, date) => ({ id: title, title, amount, type, category, date });

// Fixed "today" so the trailing windows are deterministic. 2026-09-14.
const NOW = new Date(2026, 8, 14);

test('1. balance = previous balance + income − expenses, chronologically', () => {
  const txs = [
    tx('Salary', 10000, 'income', 'Salary', '2026-09-01'), // opening balance
    tx('Side income', 2000, 'income', 'Freelance', '2026-09-07'),
    tx('Groceries', 500, 'expense', 'Food', '2026-09-09'),
  ];
  const series = buildBalanceSeries(txs, 7, NOW); // 2026-09-08 → 2026-09-14

  assert.equal(series.length, 7);
  assert.deepEqual(
    series.map((p) => p.iso),
    ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'],
  );
  assert.equal(series[0].balance, 12000); // 10000 (opening) + 2000
  assert.equal(series[1].balance, 11500); // 12000 − 500
  assert.equal(series[6].balance, 11500); // carried forward
});

test('2. days without transactions carry the balance forward (flat, not 0)', () => {
  const txs = [
    tx('Salary', 10000, 'income', 'Salary', '2026-09-10'),
    tx('Groceries', 4000, 'expense', 'Food', '2026-09-11'),
  ];
  const series = buildBalanceSeries(txs, 7, NOW); // 2026-09-08 → 2026-09-14

  assert.equal(series[2].balance, 10000); // 09-10 income
  assert.equal(series[3].balance, 6000); // 09-11 expense
  for (let i = 4; i < 7; i++) {
    assert.equal(series[i].balance, 6000, `day ${i} must stay flat (no invented zeros)`);
  }
  // Last point equals the current net balance.
  assert.equal(series[6].balance, 6000);
});

test('3. final point of the range equals current balance; 1Y span still correct', () => {
  const txs = [
    tx('Salary', 50000, 'income', 'Salary', '2026-01-01'),
    tx('Rent', 15000, 'expense', 'Housing', '2026-01-02'),
  ];
  const series = buildBalanceSeries(txs, 365, NOW);
  assert.equal(series.length, 365);
  assert.equal(series[0].iso, '2025-09-15'); // 365 days before 2026-09-14
  assert.equal(series[0].balance, 0); // no tx yet → real zero
  assert.equal(series[series.length - 1].balance, 35000); // 50000 − 15000
});

test('4. future-dated transactions never rewrite past balances', () => {
  const txs = [
    tx('Salary', 10000, 'income', 'Salary', '2026-09-10'),
    tx('Future salary', 90000, 'income', 'Salary', '2026-10-01'), // after "today"
  ];
  const series = buildBalanceSeries(txs, 7, NOW);
  assert.equal(series[series.length - 1].balance, 10000); // future income excluded
});

test('5. range slicing: only days inside the requested range are emitted', () => {
  const txs = [tx('Salary', 1000, 'income', 'Salary', '2026-09-05')];
  const s7 = buildBalanceSeries(txs, 7, NOW);
  assert.equal(s7[0].iso, '2026-09-08');
  const s30 = buildBalanceSeries(txs, 30, NOW);
  assert.equal(s30.length, 30);
  assert.equal(s30[0].iso, '2026-08-16');
  assert.equal(s30[s30.length - 1].balance, 1000);
});

test('6. cash flow: last 7 days, income/expense split, no tx = 0', () => {
  const txs = [
    tx('Salary', 3200, 'income', 'Salary', '2026-09-13'),
    tx('Food', 200, 'expense', 'Food', '2026-09-13'),
    tx('Old', 9999, 'expense', 'Other', '2026-09-01'), // outside the 7-day window
  ];
  const days = buildCashFlow(txs, 7, NOW); // 2026-09-08 → 2026-09-14
  assert.equal(days.length, 7);
  assert.equal(days[5].iso, '2026-09-13');
  assert.equal(days[5].income, 3200);
  assert.equal(days[5].expenses, 200);
  assert.equal(days[5].net, 3000);
  assert.equal(days[0].income + days[0].expenses, 0); // quiet day
});

test('7. spending by category: expenses only, income excluded, sorted desc, pct computed', () => {
  const txs = [
    tx('Salary', 5000, 'income', 'Salary', '2026-09-01'),
    tx('Groceries', 300, 'expense', 'Food', '2026-09-02'),
    tx('Dinner', 100, 'expense', 'Food', '2026-09-03'),
    tx('Save for goal', 150, 'expense', 'Savings', '2026-09-04'),
  ];
  const items = buildCategoryData(txs);
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'Food');
  assert.equal(items[0].value, 400);
  assert.ok(Math.abs(items[0].pct - (400 / 550) * 100) < 1e-9);
  assert.equal(items[1].name, 'Savings'); // recorded as an expense row → appears
  assert.equal(items[1].value, 150);
});

test('8. category data: no expenses → empty list (no fabricated slices)', () => {
  assert.deepEqual(buildCategoryData([]), []);
  assert.deepEqual(
    buildCategoryData([tx('Salary', 5000, 'income', 'Salary', '2026-09-01')]),
    [],
  );
});

test('9. small categories roll up into "Other"', () => {
  const xs = ['Food', 'Housing', 'Transport', 'Utilities', 'Fun', 'Health', 'Pets', 'Gifts'];
  const txs = xs.map((c, i) => tx(`e${i}`, 10 * (i + 1), 'expense', c, '2026-09-01'));
  const items = buildCategoryData(txs); // max 6 leading + "Other"
  assert.equal(items.length, 7);
  assert.equal(items[items.length - 1].name, 'Other');
});

test('10. infinite/NaN amounts never leak into the series', () => {
  const txs = [
    tx('Bad', NaN, 'income', 'Salary', '2026-09-10'),
    tx('Inf', Infinity, 'expense', 'Housing', '2026-09-11'),
  ];
  const series = buildBalanceSeries(txs, 7, NOW);
  for (const p of series) {
    assert.ok(Number.isFinite(p.balance), `balance must be finite, got ${p.balance}`);
  }
});

/** Numeric part of a label, so the printed percentages can be summed. */
const labelValue = (label) => (label === '<1%' ? 0 : Number.parseFloat(label));

test('11. percentage labels always add up to 100', () => {
  const cases = [
    [100],
    [50, 50],
    [40, 35, 25],
    [1, 1, 1],
    [999, 1, 1, 1],
    [101610100, 125000, 5000],
  ];
  for (const values of cases) {
    const labels = categoryPercentLabels(values.map((value) => ({ value })));
    assert.equal(labels.length, values.length);
    assert.equal(
      labels.reduce((s, l) => s + labelValue(l), 0),
      100,
      `labels must total 100, got ${labels.join(' ')}`,
    );
  }
});

test('12. a real but tiny category is never labelled "0%"', () => {
  // Savings ₹10,16,10,100, Other ₹1,25,000, Freelance ₹5,000 → total ₹10,17,40,100.
  // Exact shares are 99.872% / 0.123% / 0.005%, so independent rounding used to
  // print "100% / 0% / 0%" and make the two small categories look free.
  const items = buildCategoryData([
    tx('Emergency fund', 101610100, 'expense', 'Savings', '2026-09-01'),
    tx('Misc', 125000, 'expense', 'Other', '2026-09-02'),
    tx('Side gig', 5000, 'expense', 'Freelance', '2026-09-03'),
  ]);

  assert.equal(items[0].name, 'Savings');
  assert.equal(items.reduce((s, it) => s + it.value, 0), 101740100);

  const labels = categoryPercentLabels(items);
  assert.deepEqual(labels, ['100%', '<1%', '<1%']);
  // The geometry keeps the exact share, not the rounded label.
  const exact = (101610100 / 101740100) * 100;
  assert.ok(Math.abs(items[0].pct - exact) < 1e-9, `pct was ${items[0].pct}`);
  assert.ok(exact > 99.87 && exact < 99.88, `sanity: exact share was ${exact}`);
});

test('13. a category with no money is not labelled "<1%"', () => {
  assert.deepEqual(categoryPercentLabels([{ value: 100 }, { value: 0 }]), ['100%', '0%']);
});

test('14. percentage labels handle empty and zero totals without throwing', () => {
  assert.deepEqual(categoryPercentLabels([]), []);
  assert.deepEqual(categoryPercentLabels([{ value: 0 }]), ['0%']);
});