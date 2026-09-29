import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
  buildDayIndex,
  buildMonthGrid,
  daysInMonth,
  emptyDaySummary,
  isLeapYear,
  isSameMonth,
  isSavingsRow,
  isValidIso,
  matchedGoalTitle,
  monthKey,
  normalizeMonth,
  parseLocalIso,
  shiftMonth,
  shiftYear,
  summarizeDay,
  summarizeMonth,
  todayIso,
  transactionsForDate,
  weeksInMonth,
  yearRange,
} from '../.test-build/components/insights/calendarData.js';

import {
  categoryBaselines,
  categoryTotals,
  largestExpense,
  projectedMonthSpend,
  savingsOpportunity,
  spendingRows,
  unusualSpending,
} from '../.test-build/components/insights/insightMetrics.js';

/** Helper: a transaction row with sensible defaults. */
const tx = (over = {}) => ({
  id: 't1',
  title: 'Row',
  amount: 100,
  type: 'expense',
  category: 'Food',
  date: '2026-09-15',
  ...over,
});

/* ------------------------------------------------------------------ *
 * ISO validation & local parsing
 * ------------------------------------------------------------------ */

test('1. isValidIso accepts real local calendar days only', () => {
  assert.equal(isValidIso('2026-09-15'), true);
  assert.equal(isValidIso('2024-02-29'), true, 'leap day is a real day');
  assert.equal(isValidIso('2026-02-30'), false, 'February never has 30 days');
  assert.equal(isValidIso('2026-13-01'), false, 'month 13 does not exist');
  assert.equal(isValidIso('2026-00-10'), false, 'month 0 does not exist');
  assert.equal(isValidIso('2026-9-1'), false, 'must be zero padded');
  assert.equal(isValidIso('2026-09-15T00:00:00Z'), false, 'no timestamps');
  assert.equal(isValidIso(''), false);
  assert.equal(isValidIso(null), false);
  assert.equal(isValidIso(20260915), false);
});

test('2. parseLocalIso builds a local Date, never a UTC-shifted one', () => {
  const d = parseLocalIso('2026-09-15');
  assert.ok(d instanceof Date);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8, 'September is month index 8');
  assert.equal(d.getDate(), 15);
  assert.equal(d.getHours(), 0, 'parses to local midnight, not UTC midnight');
  assert.equal(parseLocalIso('nonsense'), null);
});

test('3. todayIso returns a valid local yyyy-mm-dd for any Date', () => {
  const iso = todayIso(new Date(2026, 8, 15, 23, 59, 59));
  assert.equal(iso, '2026-09-15');
  assert.equal(todayIso(new Date(2026, 0, 1, 0, 0, 1)), '2026-01-01');
  assert.equal(isValidIso(todayIso()), true);
});

test('4. monthKey zero-pads and matches the stored date prefix', () => {
  assert.equal(monthKey(2026, 8), '2026-09');
  assert.equal(monthKey(2026, 0), '2026-01');
  assert.equal(monthKey(2026, 11), '2026-12');
});

/* ------------------------------------------------------------------ *
 * Month arithmetic
 * ------------------------------------------------------------------ */

test('5. daysInMonth handles leap years and every month length', () => {
  assert.equal(daysInMonth(2026, 1), 28, '2026 is not a leap year');
  assert.equal(daysInMonth(2024, 1), 29, '2024 is a leap year');
  assert.equal(daysInMonth(2000, 1), 29, '2000 divisible by 400 → leap');
  assert.equal(daysInMonth(1900, 1), 28, '1900 divisible by 100 → not leap');
  assert.equal(daysInMonth(2026, 0), 31);
  assert.equal(daysInMonth(2026, 3), 30);
});

test('6. isLeapYear applies the full Gregorian rule', () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2026), false);
  assert.equal(isLeapYear(1900), false);
  assert.equal(isLeapYear(2000), true);
});

test('7. shiftMonth rolls over December → January in both directions', () => {
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftMonth(2026, 5, 12), { year: 2027, month: 5 });
  assert.deepEqual(shiftMonth(2026, 5, -12), { year: 2025, month: 5 });
  assert.deepEqual(shiftMonth(2026, 5, 0), { year: 2026, month: 5 });
});

test('8. shiftYear and normalizeMonth stay in range for any input', () => {
  assert.deepEqual(shiftYear(2026, 3, 1), { year: 2027, month: 3 });
  assert.deepEqual(shiftYear(2026, 3, -5), { year: 2021, month: 3 });
  assert.deepEqual(normalizeMonth(2026, 12), { year: 2027, month: 0 });
  assert.deepEqual(normalizeMonth(2026, -1), { year: 2025, month: 11 });
  assert.deepEqual(normalizeMonth(2026, 25), { year: 2028, month: 1 });
  const n = normalizeMonth(2026, -37);
  assert.ok(n.month >= 0 && n.month <= 11, 'normalized month must be 0-11');
  assert.equal(isSameMonth(n.year, n.month, 2022, 11), true);
});

test('9. yearRange always includes the center and the current year', () => {
  const years = yearRange(2030, 2, 2, 2026);
  assert.ok(years.includes(2030), 'center year is offered');
  assert.ok(years.includes(2026), 'current year is offered so "today" is reachable');
  assert.deepEqual([...years].sort((a, b) => a - b), years, 'sorted ascending');
  const far = yearRange(1900, 3, 1, 2026);
  assert.ok(far.includes(1900) && far.includes(2026), 'range widens to cover both');
});

/* ------------------------------------------------------------------ *
 * Grid construction
 * ------------------------------------------------------------------ */

test('10. buildMonthGrid covers every day exactly once, in weekday order', () => {
  for (let year = 2023; year <= 2027; year++) {
    for (let month = 0; month < 12; month++) {
      const cells = buildMonthGrid(year, month, '2026-09-15');
      const total = daysInMonth(year, month);
      assert.equal(cells.length, weeksInMonth(year, month) * 7, 'grid is whole weeks');

      const inMonth = cells.filter((c) => c.inCurrentMonth);
      assert.equal(inMonth.length, total, `${year}-${month} must show all ${total} days`);

      const isos = new Set(cells.map((c) => c.iso));
      assert.equal(isos.size, cells.length, 'no duplicate date cells');

      // In-month days must be strictly increasing and match the real calendar.
      inMonth.forEach((cell, i) => {
        assert.equal(cell.day, i + 1, 'in-month days are 1..N in order');
        assert.equal(cell.iso.slice(0, 7), monthKey(year, month));
        assert.equal(cell.weekday, new Date(year, month, i + 1).getDay());
      });
    }
  }
});

test('11. buildMonthGrid marks spill cells, today and future days correctly', () => {
  // September 2026 starts on a Tuesday (weekday 2) and has 30 days.
  const cells = buildMonthGrid(2026, 8, '2026-09-15');
  const firstInMonth = cells.findIndex((c) => c.inCurrentMonth);
  const lead = cells.slice(0, firstInMonth);
  assert.equal(lead.length, 2, 'Tuesday start → 2 leading spill days');
  assert.equal(lead[0].iso, '2026-08-30');
  assert.equal(lead[0].month, 7, 'spill cell carries its own real month');
  assert.equal(lead[0].year, 2026);
  assert.deepEqual(lead.map((c) => c.iso), ['2026-08-30', '2026-08-31']);

  const trail = cells.slice(cells.findIndex((c) => c.inCurrentMonth && c.day === 30) + 1);
  assert.equal(trail.length, 3, '30 days + 2 leading ends on a Thursday → 3 trailing days');
  assert.deepEqual(trail.map((c) => c.iso), ['2026-10-01', '2026-10-02', '2026-10-03']);

  const today = cells.find((c) => c.iso === '2026-09-15');
  assert.ok(today, 'today is present');
  assert.equal(today.isToday, true);
  assert.equal(cells.filter((c) => c.isToday).length, 1, 'exactly one today cell');
  assert.equal(today.isFuture, false);

  const future = cells.find((c) => c.iso === '2026-09-20');
  assert.equal(future.isFuture, true);
  const past = cells.find((c) => c.iso === '2026-09-01');
  assert.equal(past.isFuture, false);
  assert.equal(
    cells.filter((c) => c.isFuture && c.inCurrentMonth).length,
    15,
    'days 16–30 of September are still ahead',
  );
  assert.equal(
    cells.filter((c) => c.isFuture).length,
    18,
    'the 3 trailing October spill days are future too, and are dimmed with them',
  );
  assert.equal(
    cells.filter((c) => c.isFuture && !c.inCurrentMonth).every((c) => c.month === 9),
    true,
    'future spill days belong to the next month',
  );
});

test('12. buildMonthGrid handles a 31-day month starting on Saturday', () => {
  // May 2026 starts on a Friday and has 31 days → 6 weeks.
  const cells = buildMonthGrid(2026, 4, '2026-09-15');
  assert.equal(weeksInMonth(2026, 4), 6);
  assert.equal(cells.length, 42);
  assert.equal(cells.filter((c) => c.inCurrentMonth).length, 31);
  assert.equal(cells[0].iso, '2026-04-26', 'grid starts on the preceding Sunday');
});

/* ------------------------------------------------------------------ *
 * Day index & summaries
 * ------------------------------------------------------------------ */

test('13. buildDayIndex keys rows by local date and ignores invalid dates', () => {
  const index = buildDayIndex([
    tx({ id: 'a', date: '2026-09-15' }),
    tx({ id: 'b', date: '2026-09-15', amount: 50 }),
    tx({ id: 'c', date: '2026-09-16' }),
    tx({ id: 'bad', date: 'not-a-date' }),
    tx({ id: 'null', date: undefined }),
  ]);
  assert.equal(index.get('2026-09-15').length, 2);
  assert.equal(index.get('2026-09-16').length, 1);
  assert.equal(index.has('not-a-date'), false, 'malformed dates are never indexed');
  assert.equal(buildDayIndex(undefined).size, 0, 'missing list → empty index');
});

test('14. transactionsForDate returns only that day, as a copy', () => {
  const index = buildDayIndex([
    tx({ id: 'a', date: '2026-09-15' }),
    tx({ id: 'b', date: '2026-09-16' }),
  ]);
  const rows = transactionsForDate('2026-09-15', index);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'a');
  rows.push(tx({ id: 'c' }));
  assert.equal(index.get('2026-09-15').length, 1, 'mutating the copy must not affect the index');
  assert.equal(transactionsForDate('2026-01-01', index).length, 0, 'day with no rows → empty');
});

test('15. isSavingsRow only matches expense rows in the Savings category', () => {
  assert.equal(isSavingsRow(tx({ category: 'Savings' })), true);
  assert.equal(isSavingsRow(tx({ type: 'income', category: 'Savings' })), false);
  assert.equal(isSavingsRow(tx({ category: 'Food' })), false);
  assert.equal(isSavingsRow(tx({ category: '  Savings  ' })), true, 'padded category still counts as savings');
});

test('16. summarizeDay splits income, expenses and savings, and nets them', () => {
  const index = buildDayIndex([
    tx({ id: 'i1', type: 'income', category: 'Salary', amount: 5000, date: '2026-09-15' }),
    tx({ id: 'e1', type: 'expense', category: 'Food', amount: 320, date: '2026-09-15' }),
    tx({ id: 'e2', type: 'expense', category: 'Rent', amount: 1200, date: '2026-09-15' }),
    tx({ id: 's1', type: 'expense', category: 'Savings', amount: 700, date: '2026-09-15' }),
  ]);
  const s = summarizeDay('2026-09-15', index);
  assert.equal(s.income, 5000);
  assert.equal(s.expenses, 1520, 'savings are excluded from expenses');
  assert.equal(s.savings, 700);
  assert.equal(s.net, 5000 - 1520 - 700, 'net = income − expenses − savings');
  assert.equal(s.count, 4);
  assert.deepEqual([s.hasIncome, s.hasExpense, s.hasSavings], [true, true, true]);
  assert.equal(s.hasActivity, true);
});

test('17. summarizeDay returns a clean zero summary for an empty day', () => {
  const index = buildDayIndex([tx({ date: '2026-09-16' })]);
  const s = summarizeDay('2026-09-15', index);
  assert.deepEqual(s, emptyDaySummary('2026-09-15'));
  assert.equal(s.hasActivity, false);
  assert.deepEqual([s.hasIncome, s.hasExpense, s.hasSavings], [false, false, false]);
});

test('18. matchedGoalTitle resolves a savings row to a real goal', () => {
  const goals = [
    { id: 'g1', title: 'Emergency Fund', target: 1000, saved: 200 },
    { id: 'g2', title: 'Emergency Fund Top-up', target: 500, saved: 0 },
  ];
  // The Add Saving modal titles rows like "Savings: Emergency fund".
  const row = tx({ type: 'expense', category: 'Savings', title: 'Savings: Emergency Fund Top-up', amount: 50, date: '2026-09-15' });
  assert.equal(matchedGoalTitle(row, goals), 'Emergency Fund Top-up', 'the longest matching title wins');
  assert.equal(matchedGoalTitle(tx({ type: 'expense', category: 'Savings', title: 'Savings: Emergency Fund' }), goals), 'Emergency Fund');
  assert.equal(matchedGoalTitle(row, []), null, 'no goals → null, never a crash');
  assert.equal(matchedGoalTitle(tx({ title: 'Weekly groceries' }), goals), null, 'unrelated row → null');
  assert.equal(matchedGoalTitle(tx({ title: '' }), goals), null, 'no title → null, never a crash');
  assert.equal(matchedGoalTitle(tx({ title: 'Savings: Trip' }), [{ id: 'g', title: '   ' }]), null, 'blank goal titles are ignored');
});

/* ------------------------------------------------------------------ *
 * Month summaries
 * ------------------------------------------------------------------ */

test('19. summarizeMonth aggregates only the target month and year', () => {
  const txs = [
    tx({ id: 'i1', type: 'income', category: 'Salary', amount: 4000, date: '2026-09-01' }),
    tx({ id: 'e1', category: 'Food', amount: 300, date: '2026-09-02' }),
    tx({ id: 's1', category: 'Savings', amount: 500, date: '2026-09-03' }),
    tx({ id: 'aug', category: 'Food', amount: 999, date: '2026-08-31' }),
    tx({ id: 'next', type: 'income', amount: 7777, date: '2026-10-01' }),
    tx({ id: 'y1', type: 'income', amount: 5555, date: '2025-09-15' }),
  ];
  const s = summarizeMonth(txs, 2026, 8);
  assert.equal(s.key, '2026-09');
  assert.equal(s.income, 4000);
  assert.equal(s.expenses, 300);
  assert.equal(s.savings, 500);
  assert.equal(s.net, 3200);
  assert.equal(s.count, 3, 'only September rows counted');
  assert.equal(s.activeDays, 3);
  assert.ok(Math.abs(s.savingsRate - 80) < 1e-9, 'savings rate is 500 / 4000 income kept');
});

test('20. summarizeMonth reports a 0 rate instead of NaN with no income', () => {
  const s = summarizeMonth([tx({ category: 'Food', amount: 100, date: '2026-09-02' })], 2026, 8);
  assert.equal(s.savingsRate, 0, 'no income → 0, never NaN or Infinity');
  assert.equal(s.net, -100);
  const empty = summarizeMonth([], 2026, 8);
  assert.equal(empty.count, 0);
  assert.equal(empty.savingsRate, 0);
  assert.equal(Number.isFinite(empty.savingsRate), true);
});

test('21. summarizeMonth normalises out-of-range month input', () => {
  const txs = [
    tx({ id: 'jan', type: 'income', amount: 100, date: '2027-01-10' }),
    tx({ id: 'dec', type: 'income', amount: 200, date: '2026-12-20' }),
  ];
  assert.equal(summarizeMonth(txs, 2026, 12).count, 1, 'month 12 means January 2027');
  assert.equal(summarizeMonth(txs, 2026, 12).income, 100);
  assert.equal(summarizeMonth(txs, 2027, -1).count, 1, 'month −1 means December 2026');
  assert.equal(summarizeMonth(txs, 2027, -1).income, 200);
});

/* ------------------------------------------------------------------ *
 * Insight metrics
 * ------------------------------------------------------------------ */

test('22. spendingRows and categoryTotals exclude savings and rank by size', () => {
  const txs = [
    tx({ id: '1', category: 'Food', amount: 300, date: '2026-09-01' }),
    tx({ id: '2', category: 'Food', amount: 200, date: '2026-09-02' }),
    tx({ id: '3', category: 'Rent', amount: 1200, date: '2026-09-03' }),
    tx({ id: '4', category: 'Savings', amount: 500, date: '2026-09-04' }),
    tx({ id: '5', type: 'income', category: 'Salary', amount: 9000, date: '2026-09-05' }),
    tx({ id: '6', category: 'Food', amount: -50, date: '2026-09-06' }),
  ];
  assert.equal(spendingRows(txs).length, 3, 'no savings, no income, no non-positive rows');
  const totals = categoryTotals(txs);
  assert.equal(totals.length, 2);
  assert.equal(totals[0].name, 'Rent', 'largest category first');
  assert.equal(totals[0].value, 1200);
  assert.equal(totals[1].name, 'Food');
  assert.equal(totals[1].value, 500, 'the −50 row is not counted');
  const sum = totals.reduce((s, t) => s + t.pct, 0);
  assert.ok(Math.abs(sum - 100) < 1e-9, 'shares add up to 100%');
});

test('23. categoryTotals returns [] when there is nothing to chart', () => {
  assert.deepEqual(categoryTotals([]), []);
  assert.deepEqual(categoryTotals([tx({ type: 'income', amount: 500, date: '2026-09-01' })]), []);
  assert.deepEqual(categoryTotals(undefined), []);
});

test('24. categoryBaselines averages the user\'s own months per category', () => {
  const txs = [
    tx({ id: '1', category: 'Food', amount: 300, date: '2026-07-01' }),
    tx({ id: '2', category: 'Food', amount: 500, date: '2026-08-01' }),
    tx({ id: '3', category: 'Food', amount: 100, date: '2026-09-01' }),
    tx({ id: '4', category: 'Rent', amount: 1200, date: '2026-09-01' }),
  ];
  const base = categoryBaselines(txs);
  assert.equal(base.get('Food').months, 3);
  assert.equal(base.get('Food').total, 900);
  assert.equal(base.get('Food').average, 300, 'total / distinct months');
  assert.equal(base.get('Rent').months, 1, 'a single month gives no baseline to compare');
  assert.equal(base.size, 2);
});

test('25. unusualSpending needs 2+ baseline months and a real overshoot', () => {
  const history = [
    tx({ id: 'h1', category: 'Food', amount: 400, date: '2026-07-01' }),
    tx({ id: 'h2', category: 'Food', amount: 400, date: '2026-08-01' }),
    tx({ id: 'h3', category: 'Travel', amount: 100, date: '2026-07-05' }),
    tx({ id: 'h4', category: 'Travel', amount: 100, date: '2026-08-05' }),
  ];
  const base = categoryBaselines(history);

  const spike = unusualSpending([tx({ category: 'Food', amount: 900, date: '2026-09-10' })], base);
  assert.equal(spike.length, 1);
  assert.equal(spike[0].category, 'Food');
  assert.equal(spike[0].average, 400);
  assert.equal(spike[0].pctOver, 125, '900 is 125% above the 400 baseline');

  assert.equal(unusualSpending([tx({ category: 'Food', amount: 420, date: '2026-09-10' })], base).length, 0,
    'a 5% overshoot stays under the threshold');
  assert.equal(unusualSpending([tx({ category: 'Brand New', amount: 900, date: '2026-09-10' })], base).length, 0,
    'an unseen category has no baseline');
});

test('26. savingsOpportunity reports what trimming the top category frees', () => {
  const opp = savingsOpportunity([
    tx({ category: 'Rent', amount: 1000, date: '2026-09-01' }),
    tx({ category: 'Food', amount: 500, date: '2026-09-02' }),
  ]);
  assert.equal(opp.category, 'Rent');
  assert.equal(opp.current, 1000);
  assert.equal(opp.potential, 100);
  assert.equal(savingsOpportunity([]), null, 'nothing to trim → null');
  assert.equal(savingsOpportunity([tx({ type: 'income', amount: 100, date: '2026-09-01' })]), null);
});

test('27. largestExpense finds the biggest row in the top category', () => {
  const out = largestExpense([
    tx({ id: 'a', category: 'Food', amount: 100, date: '2026-09-01' }),
    tx({ id: 'b', category: 'Food', amount: 200, date: '2026-09-02' }),
    tx({ id: 'big', category: 'Food', amount: 900, date: '2026-09-03' }),
  ]);
  assert.equal(out.transaction.id, 'big');
  assert.equal(out.ratio, 6, '900 vs a 150 typical (200+100)/2 → 6×');
  assert.equal(largestExpense([]), null);
});

test('28. projectedMonthSpend extrapolates the observed daily pace', () => {
  // 600 spent over 10 elapsed days → 60/day → 21 days left → 600 + 1260.
  const out = projectedMonthSpend([tx({ category: 'Food', amount: 600, date: '2026-09-05' })], 10, 31);
  assert.equal(out.spent, 600);
  assert.equal(out.dailyPace, 60);
  assert.equal(out.projected, 1860);

  const fresh = projectedMonthSpend([tx({ category: 'Food', amount: 120, date: '2026-09-02' })], 3, 31);
  assert.equal(fresh.dailyPace, 40);
  assert.equal(fresh.projected, 120 + 40 * 28);

  const done = projectedMonthSpend([tx({ category: 'Food', amount: 500, date: '2026-09-31' })], 31, 31);
  assert.equal(done.projected, 500, 'a finished month projects nothing more');

  const none = projectedMonthSpend([], 0, 31);
  assert.equal(none.projected, 0);
  assert.equal(Number.isFinite(none.projected), true, 'never NaN on an empty month');
});
