/**
 * Tests for the pure financial calculation layer (services/safeToSpend.ts).
 *
 * Compiled by scripts/run-tests.mjs via the project's own tsc into
 * .test-build/ and executed with Node's built-in test runner (`node --test`),
 * so no external test framework is required.
 */
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const F = require('../.test-build/services/safeToSpend.js');

const {
  calculateSafeToSpend,
  calculateDailySafeToSpend,
  calculateForecast,
  estimateGoalCompletion,
  monthlySavingsCapacity,
  monthBuckets,
  averageDailyExpense,
  simulateFinancialChange,
  AUTO_BUFFER_DAYS,
} = F;

const NOW = new Date(2026, 8, 24); // 2026-09-24 → Sept = 30 days → 7 days left

const tx = (title, amount, type, category, date) => ({ id: title, title, amount, type, category, date });
const goal = (id, title, target, saved, deadline) => ({ id, title, target, saved, deadline: deadline ?? undefined });

/** Normal dataset: balance 100k, ~2.5k/day pace, one goal 20k short. */
const normal = {
  transactions: [
    tx('Salary', 107500, 'income', 'Salary', '2026-09-01'),
    tx('Groceries', 1500, 'expense', 'Food', '2026-09-24'),
    tx('Transport', 1000, 'expense', 'Transport', '2026-09-24'),
    tx('Save to Emergency', 5000, 'expense', 'Savings', '2026-09-24'),
  ],
  goals: [goal('g1', 'Emergency fund', 50000, 30000)],
};

test('1. normal positive balance: 75,000 safe to spend', () => {
  const r = calculateSafeToSpend({ ...normal, emergencyBuffer: 10000, now: NOW });
  // Total balance = net flow 100,000 + 30,000 goal money (still the user's cash).
  assert.ok(Math.abs(r.balance - 130000) < 1e-6, `balance ${r.balance}`);
  // Goal reserve = actual saved (30,000), NOT the remaining target (20,000).
  assert.ok(Math.abs(r.goalReserve - 30000) < 1e-6);
  assert.ok(Math.abs(r.upcomingExpenses - 15000) < 1e-6, `upcoming ${r.upcomingExpenses}`);
  assert.ok(Math.abs(r.emergencyBuffer - 10000) < 1e-6);
  assert.ok(Math.abs(r.totalReserved - 55000) < 1e-6);
  assert.ok(Math.abs(r.safeToSpend - 75000) < 1e-6, `safe ${r.safeToSpend}`);
  assert.equal(r.insufficientData, false);
});

test('2. no goals → no goal reserve', () => {
  const r = calculateSafeToSpend({ ...normal, goals: [], emergencyBuffer: 10000, now: NOW });
  assert.equal(r.goalReserve, 0);
  assert.ok(Math.abs(r.safeToSpend - 75000) < 1e-6);
});

test('3. multiple goals → reserve sums the actual saved amounts', () => {
  const goals = [
    goal('g1', 'Emergency', 50000, 30000),
    goal('g2', 'Vacation', 10000, 5000),
    goal('g3', 'Complete', 5000, 5000), // completed goal's money is still parked → reserved
  ];
  const r = calculateSafeToSpend({ transactions: normal.transactions, goals, emergencyBuffer: 10000, now: NOW });
  assert.ok(Math.abs(r.goalReserve - 40000) < 1e-6);
});

test('4. saving into a goal is counted exactly once', () => {
  // Moving X into a goal records a "Savings" expense (balance −X) while goal
  // saved grows by X. Saved money is added back into the total balance and then
  // reserved, so the two steps offset: safe-to-spend drops by EXACTLY X — never
  // by the full target, which is what previously inflated the reserve.
  const baseTxs = normal.transactions.filter((t) => t.category !== 'Savings');
  const before = calculateSafeToSpend(
    {
      transactions: baseTxs,
      goals: [goal('g1', 'Emergency fund', 50000, 0)],
      emergencyBuffer: 10000,
      now: NOW,
    },
  );
  const after = calculateSafeToSpend(
    {
      transactions: normal.transactions, // includes "Save to Emergency" 5,000
      goals: [goal('g1', 'Emergency fund', 50000, 5000)],
      emergencyBuffer: 10000,
      now: NOW,
    },
  );
  assert.ok(
    Math.abs(before.safeToSpend - after.safeToSpend - 5000) < 1e-6,
    `${before.safeToSpend} vs ${after.safeToSpend}`,
  );
  // And the spending pace ignores Savings rows entirely.
  const pace = averageDailyExpense(normal.transactions, NOW);
  assert.ok(Math.abs(pace - 2500) < 1e-6, `pace ${pace}`);
});

test('5. upcoming expenses derive from spending pace (rest of month)', () => {
  const r = calculateSafeToSpend({ transactions: normal.transactions, goals: [], now: NOW });
  const daysLeft = 30 - 24 + 1;
  assert.equal(daysLeft, 7);
  assert.ok(Math.abs(r.upcomingExpenses - 2500 * 6) < 1e-6);
  // On the last day of the month there is nothing "upcoming" left.
  const lastDay = new Date(2026, 8, 30);
  const end = calculateSafeToSpend({ transactions: normal.transactions, goals: [], now: lastDay });
  assert.equal(end.upcomingExpenses, 0);
});

test('6. emergency buffer: auto = ~5 days of spending, or a fixed amount', () => {
  const auto = calculateSafeToSpend({ transactions: normal.transactions, goals: normal.goals, now: NOW });
  assert.ok(Math.abs(auto.emergencyBuffer - 2500 * AUTO_BUFFER_DAYS) < 1e-6, `auto ${auto.emergencyBuffer}`);
  const fixed = calculateSafeToSpend({ transactions: normal.transactions, goals: normal.goals, emergencyBuffer: 0, now: NOW });
  assert.equal(fixed.emergencyBuffer, 0);
  // Negative custom buffer is clamped to 0.
  const negative = calculateSafeToSpend({ ...normal, emergencyBuffer: -5, now: NOW });
  assert.equal(negative.emergencyBuffer, 0);
});

test('7. negative balance → negative safe-to-spend, daily floored at 0', () => {
  const txs = [
    tx('Salary', 10000, 'income', 'Salary', '2026-09-01'),
    tx('Huge expense', 50000, 'expense', 'Housing', '2026-09-24'),
  ];
  const goalsD = [goal('g1', 'Fund', 20000, 10000)];
  const r = calculateSafeToSpend({ transactions: txs, goals: goalsD, emergencyBuffer: 0, now: NOW });
  assert.ok(r.balance < 0);
  assert.ok(Number.isFinite(r.safeToSpend) && r.safeToSpend < 0);
  const daily = calculateDailySafeToSpend(r, NOW);
  assert.equal(daily.daily, 0);
  assert.equal(daily.daysRemaining, 7);
});

test('8. zero income → finite negative results (no NaN/Infinity)', () => {
  const r = calculateSafeToSpend({
    transactions: [tx('Rent', 1200, 'expense', 'Housing', '2026-09-10')],
    goals: [],
    now: NOW,
  });
  assert.ok(Number.isFinite(r.balance));
  assert.ok(Number.isFinite(r.safeToSpend));
  assert.ok(Number.isFinite(r.upcomingExpenses));
});

test('9. large expenses → handled safely, no invalid states', () => {
  const big = calculateSafeToSpend({
    transactions: [
      tx('Salary', 1000, 'income', 'Salary', '2026-09-01'),
      tx('Expense', 1_000_000, 'expense', 'Other', '2026-09-24'),
    ],
    goals: [goal('g', 'G', 100000, 0)],
    now: NOW,
  });
  assert.ok(Number.isFinite(big.balance));
  assert.ok(big.safeToSpend < 0);
});

test('10. month-end calculation & daily limits', () => {
  const r = calculateSafeToSpend({ ...normal, emergencyBuffer: 10000, now: NOW });
  const daily = calculateDailySafeToSpend(r, NOW);
  assert.equal(daily.daysRemaining, 7);
  assert.ok(Math.abs(daily.daily - 75000 / 7) < 1e-6, `daily ${daily.daily}`);
  // Same breakdown on the 30th → 1 day left → daily = full remaining amount.
  const end = calculateDailySafeToSpend(r, new Date(2026, 8, 30));
  assert.equal(end.daysRemaining, 1);
  assert.ok(Math.abs(end.daily - 75000) < 1e-6);
});

test('11. what-if spending reduces safe-to-spend only in the simulation', () => {
  const base = calculateSafeToSpend({ ...normal, emergencyBuffer: 10000, now: NOW });
  const sim = simulateFinancialChange(
    { transactions: normal.transactions, goals: normal.goals, emergencyBuffer: 10000, now: NOW },
    { type: 'spend', amount: 20000, now: NOW },
  );
  assert.ok(Math.abs(sim.base.safeToSpend - 75000) < 1e-6);
  assert.ok(Math.abs(sim.after.safeToSpend - 55000) < 1e-6);
  assert.equal(sim.changes.balanceDelta, -20000);
  assert.equal(sim.impact.staysOnTrack, true);
});

test('12. what-if additional savings speeds up the goal', () => {
  const base = estimateGoalCompletion(normal.goals[0], normal.transactions, NOW);
  const withMore = estimateGoalCompletion(normal.goals[0], normal.transactions, NOW, base.pace + 3000);
  assert.equal(base.monthsNeeded, 4); // 20,000 / 5,000
  assert.equal(withMore.monthsNeeded, 3); // 20,000 / 8,000
  assert.ok(withMore.etaIso !== null && base.etaIso !== null);
  assert.ok(withMore.etaIso < base.etaIso);

  const sim = simulateFinancialChange(
    { transactions: normal.transactions, goals: normal.goals, now: NOW },
    { type: 'save-more', amount: 3000, now: NOW },
  );
  assert.equal(sim.changes.balanceDelta, 0); // money is diverted, not lost
  assert.equal(sim.changes.savingsPaceDelta, 3000);
});

test('13. goal impact: overspending flags the goal at risk', () => {
  const sim = simulateFinancialChange(
    { transactions: normal.transactions, goals: normal.goals, emergencyBuffer: 10000, now: NOW },
    { type: 'spend', amount: 80000, now: NOW },
  );
  assert.ok(sim.after.safeToSpend < 0);
  assert.equal(sim.impact.staysOnTrack, false);
  // Monthly savings capacity is 5,000 (single Savings tx this month) → 5,000 deficit → 1 month delay.
  assert.equal(sim.impact.delayMonths, 1);
  assert.match(sim.impact.verdict, /delay your goal/i);
});

test('14. simulation does NOT modify real data', () => {
  const beforeTx = JSON.stringify(normal.transactions);
  const beforeGoals = JSON.stringify(normal.goals);
  const input = { transactions: normal.transactions, goals: normal.goals, emergencyBuffer: 10000, now: NOW };

  simulateFinancialChange(input, { type: 'spend', amount: 60000, now: NOW });
  simulateFinancialChange(input, { type: 'save-more', amount: 9000, now: NOW });
  simulateFinancialChange(input, { type: 'increase-expenses', amount: 5000, now: NOW });
  simulateFinancialChange(input, { type: 'add-purchase', amount: 120000, now: NOW });

  assert.equal(JSON.stringify(normal.transactions), beforeTx);
  assert.equal(JSON.stringify(normal.goals), beforeGoals);
  assert.equal(input.emergencyBuffer, 10000);
});

test('15. what-if "increase expenses" worsens projected surplus', () => {
  const sim = simulateFinancialChange(
    { transactions: normal.transactions, goals: normal.goals, emergencyBuffer: 10000, now: NOW },
    { type: 'increase-expenses', amount: 2000, now: NOW },
  );
  assert.equal(sim.changes.monthlyPaceDelta, -2000);
  assert.ok(sim.forecast.monthlySurplus < 100000 - 1e-6);
});

test('16. no goals → simulation stays neutral', () => {
  const sim = simulateFinancialChange(
    { transactions: normal.transactions, goals: [], emergencyBuffer: 10000, now: NOW },
    { type: 'add-purchase', amount: 5000, now: NOW },
  );
  assert.equal(sim.impact.staysOnTrack, true);
  assert.match(sim.impact.verdict, /No active goals/);
});

test('17. empty data → insufficient-data states everywhere', () => {
  const b = calculateSafeToSpend({ transactions: [], goals: [], now: NOW });
  assert.equal(b.insufficientData, true);
  assert.equal(b.safeToSpend, 0);

  const forecast = calculateForecast([], [], NOW);
  assert.equal(forecast.status, 'insufficient-data');
  assert.equal(forecast.projectedMonthEnd, null);
  assert.equal(forecast.label, 'Not enough data yet');
  assert.equal(forecast.monthlySurplus, null);
});

test('18. forecast: projected month-end balance from real cash flow', () => {
  const forecast = calculateForecast(normal.transactions, normal.goals, NOW);
  // One observed month: income 107,500 − expenses 7,500 → surplus 100,000/mo.
  assert.ok(Math.abs(forecast.monthlySurplus - 100000) < 1e-6);
  const expectedMonthEnd = 100000 + 100000 * (7 / 30);
  assert.ok(Math.abs(forecast.projectedMonthEnd - expectedMonthEnd) < 1e-6);
  assert.ok(Math.abs(forecast.goalProgressPct - 60) < 1e-6); // saved 30k / target 50k
  assert.equal(forecast.status, 'on-track');
  assert.equal(forecast.label, 'On track');
});

test('19. forecast averages across observed months and ignores stale data', () => {
  const txs = [
    ...normal.transactions,
    tx('Past salary', 50000, 'income', 'Salary', '2026-08-10'),
    tx('Past expense', 30000, 'expense', 'Housing', '2026-08-11'),
  ];
  const buckets = monthBuckets(txs, NOW);
  assert.deepEqual(
    buckets.map((b) => b.key),
    ['2026-08', '2026-09'],
  );
  const surplus = (100000 + 20000) / 2;
  const forecast = calculateForecast(txs, normal.goals, NOW);
  assert.ok(Math.abs(forecast.monthlySurplus - surplus) < 1e-6);
  // A year-old transaction is outside the 6-month lookback and ignored.
  const old = [...txs, tx('Ancient', 900000, 'income', 'Salary', '2025-01-05')];
  assert.equal(monthBuckets(old, NOW).length, 2);
});

test('20. monthly savings capacity uses real savings pace, else surplus', () => {
  const own = monthlySavingsCapacity(normal.transactions, NOW);
  assert.ok(Math.abs(own - 5000) < 1e-6); // the single "Save to Emergency" row
  // No savings rows → falls back to observed monthly surplus.
  const noSavings = monthlySavingsCapacity(
    normal.transactions.filter((t) => t.category !== 'Savings'),
    NOW,
  );
  assert.ok(Math.abs(noSavings - 105000) < 1e-6); // (107,500 − 1,500 − 1,000)
});

test('21. goal estimate respects deadlines', () => {
  const withDeadline = goal('g1', 'Fund', 20000, 10000, '2026-09-30'); // nearly no time left
  const est = estimateGoalCompletion(withDeadline, normal.transactions, NOW);
  assert.equal(est.monthsNeeded, 2); // 10,000 / 5,000
  assert.equal(est.onTrack, false); // deadline is 6 days away
  // Generous deadline → on track.
  const relaxed = estimateGoalCompletion(
    goal('g1', 'Fund', 20000, 10000, '2027-12-31'),
    normal.transactions,
    NOW,
  );
  assert.equal(relaxed.onTrack, true);
});

test('22. NaN/Infinity never leak into results', () => {
  const r = calculateSafeToSpend({
    transactions: [
      tx('Bad income', NaN, 'income', 'Salary', '2026-09-01'),
      tx('Bad expense', Infinity, 'expense', 'Food', '2026-09-24'),
      tx('Bad category', null, 'expense', null, '2026-09-24'),
    ],
    goals: [goal('g1', 'G', NaN, Infinity)],
    emergencyBuffer: NaN,
    now: NOW,
  });
  for (const k of ['balance', 'goalReserve', 'upcomingExpenses', 'emergencyBuffer', 'totalReserved', 'safeToSpend']) {
    assert.ok(Number.isFinite(r[k]), `${k} must be finite, got ${r[k]}`);
  }
});

test('23. simulated balance override never mutates the input snapshot', () => {
  const input = { transactions: normal.transactions, goals: normal.goals, now: NOW };
  const sim = simulateFinancialChange(input, { type: 'add-purchase', amount: 30000, now: NOW });
  assert.equal(sim.base.safeToSpend, sim.after.safeToSpend + 30000);
  assert.deepEqual(input, { transactions: normal.transactions, goals: normal.goals, now: NOW });
});

test('24. huge goal targets never inflate the reserve (regression: ₹1,99,97,75,000)', () => {
  // Previously goalReserve = target − saved, so a goal with target 200,000,000
  // and saved 22,500 reserved ₹1,99,97,75,000 and produced a huge red balance.
  const r = calculateSafeToSpend({
    transactions: normal.transactions,
    goals: [goal('g1', 'Home', 200000000, 22500)],
    emergencyBuffer: 10000,
    now: NOW,
  });
  assert.ok(Math.abs(r.goalReserve - 22500) < 1e-6, `reserve ${r.goalReserve}`);
  // Total balance = net 100,000 + 22,500 parked in the goal → safe stays sane.
  assert.ok(Math.abs(r.balance - 122500) < 1e-6);
  assert.ok(Math.abs(r.safeToSpend - (122500 - 22500 - 15000 - 10000)) < 1e-6, `safe ${r.safeToSpend}`);
});

test('25. invalid goal amounts can never create an unrealistic reserved balance', () => {
  const bad = calculateSafeToSpend({
    transactions: normal.transactions,
    goals: [
      goal('g1', 'Negative saved', 50000, -5000),
      goal('g2', 'NaN saved', 50000, NaN),
      goal('g3', 'Infinity saved', 50000, Infinity),
      goal('g4', 'Dup same id twice', 100000, 40000),
      goal('g4', 'Dup same id twice', 100000, 40000),
    ],
    emergencyBuffer: 0,
    now: NOW,
  });
  // Negative/NaN/Infinity saved clamp to 0; duplicates each still count once,
  // but the reserve only ever reflects real, finite saved money (2 × 40,000).
  assert.ok(Math.abs(bad.goalReserve - 80000) < 1e-6, `reserve ${bad.goalReserve}`);
  assert.ok(Number.isFinite(bad.balance));
  assert.ok(Number.isFinite(bad.safeToSpend));
});