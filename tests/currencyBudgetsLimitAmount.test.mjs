/**
 * Tests for budget currency conversion payload construction and limit_amount consistency.
 *
 * These tests verify:
 * - The client payload for budgets includes only 'amount' (not limit_amount)
 * - The planCurrencyChange output for budgets only converts 'amount'
 * - The limit_amount field is not synchronized in the conversion plan
 * - This documents the known divergence risk between amount and limit_amount after conversion
 *
 * Compiled by scripts/run-tests.mjs and executed with Node's built-in test runner.
 */
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const C = require('../.test-build/utils/currency.js');

const {
  BASE_CURRENCY,
  planCurrencyChange,
  recordCurrency,
  roundForCurrency,
} = C;

/** Rate table covering all 10 supported currencies. */
const RATES = {
  INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095, JPY: 1.8,
  AED: 0.044, SGD: 0.016, CAD: 0.0165, AUD: 0.018, CHF: 0.0105,
};

const near = (a, b, msg = '') => assert.ok(Math.abs(a - b) < 1e-6, `${msg} ${a} !~= ${b}`);

const budget = (id, amount, currency = BASE_CURRENCY, extra = {}) => ({
  id,
  category: 'Food',
  amount,
  period: 'monthly',
  currency,
  ...extra,
});

test('budget payload for conversion includes only amount, not limit_amount', () => {
  const source = {
    transactions: [],
    goals: [],
    budgets: [budget('b1', 5000), budget('b2', 10000, 'USD')],
    emergencyBuffer: null,
  };

  const plan = planCurrencyChange(source, 'INR', 'EUR', RATES);
  assert.equal(plan.ok, true);

  // The plan output for budgets only has 'amount' and 'currency' — no limit_amount
  for (const b of plan.budgets) {
    assert.ok('amount' in b, 'budget has amount');
    assert.ok('currency' in b, 'budget has currency');
    assert.ok(!('limit_amount' in b), 'budget plan output does NOT include limit_amount');
    assert.equal(b.currency, 'EUR');
  }
});

test('budget conversion uses the budget\'s own recorded currency', () => {
  // A budget recorded in USD should convert from USD, not from the app-wide INR
  const source = {
    transactions: [],
    goals: [],
    budgets: [budget('usd-budget', 1000, 'USD'), budget('inr-budget', 83000)],
    emergencyBuffer: null,
  };

  const plan = planCurrencyChange(source, 'INR', 'EUR', RATES);
  assert.equal(plan.ok, true);

  // USD budget: 1000 USD * (0.011/0.012) = 916.666... -> rounded to 916.67 EUR (2 decimals)
  near(plan.budgets.find(b => b.id === 'usd-budget').amount, 916.67, 'USD budget converted from USD');
  // INR budget: 83000 INR * 0.011 = 913 EUR
  near(plan.budgets.find(b => b.id === 'inr-budget').amount, 913, 'INR budget converted from INR');
});

test('limit_amount is NOT converted and will diverge after conversion', () => {
  // This test DOCUMENTS the current behavior: limit_amount is not in the plan output
  // and will NOT be updated by the RPC. After conversion, amount and limit_amount
  // will diverge unless the RPC explicitly syncs them.
  const source = {
    transactions: [],
    goals: [],
    budgets: [budget('b1', 5000)], // amount = 5000, limit_amount would also be 5000 initially
    emergencyBuffer: null,
  };

  const plan = planCurrencyChange(source, 'INR', 'USD', RATES);
  assert.equal(plan.ok, true);

  const converted = plan.budgets[0].amount;
  near(converted, 60); // 5000 * 0.012 = 60 USD

  // The plan output has no limit_amount field — it would stay at 5000 (INR value)
  // while amount becomes 60 (USD value) — a significant divergence
  assert.ok(!('limit_amount' in plan.budgets[0]), 'limit_amount absent from plan output');
});

test('recordCurrency correctly identifies budget currency', () => {
  assert.equal(recordCurrency(budget('b1', 100)), 'INR');
  assert.equal(recordCurrency(budget('b1', 100, 'USD')), 'USD');
  assert.equal(recordCurrency(budget('b1', 100, 'JPY')), 'JPY');
  assert.equal(recordCurrency({}), 'INR'); // legacy
  assert.equal(recordCurrency({ currency: null }), 'INR');
});

test('chained conversion preserves budget amounts through multiple hops', () => {
  const original = { transactions: [], goals: [], budgets: [budget('b1', 100000)], emergencyBuffer: null };
  
  // INR -> USD -> EUR -> GBP -> JPY
  let current = planCurrencyChange(original, 'INR', 'USD', RATES);
  for (const code of ['EUR', 'GBP', 'JPY']) {
    current = planCurrencyChange(current, current.to, code, RATES);
    assert.equal(current.ok, true);
  }
  
  // 100000 INR -> USD: 1200.00
  // 1200 USD -> EUR: 1200 * (0.011/0.012) = 1100.00
  // 1100 EUR -> GBP: 1100 * (0.0095/0.011) = 950.00
  // 950 GBP -> JPY: 950 * (1.8/0.0095) = 180000
  assert.equal(current.budgets[0].currency, 'JPY');
  near(current.budgets[0].amount, 180000, 'chained budget conversion');
});

test('unsupported budget currency fails the plan', () => {
  const noAED = { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095, JPY: 1.8 };
  const source = {
    transactions: [],
    goals: [],
    budgets: [budget('b1', 1000, 'AED')],
    emergencyBuffer: null,
  };
  
  const plan = planCurrencyChange(source, 'INR', 'EUR', noAED);
  assert.equal(plan.ok, false);
  assert.equal(plan.error, 'no-rate');
});

test('empty budget list is valid', () => {
  const plan = planCurrencyChange(
    { transactions: [], goals: [], budgets: [], emergencyBuffer: null },
    'INR', 'USD', RATES
  );
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.budgets, []);
});

test('budget with non-finite amount fails plan', () => {
  const badBudget = budget('b1', Number.NaN);
  const plan = planCurrencyChange(
    { transactions: [], goals: [], budgets: [badBudget], emergencyBuffer: null },
    'INR', 'USD', RATES
  );
  assert.equal(plan.ok, false);
  assert.equal(plan.error, 'invalid-amount');
});

test('conversion preserves non-monetary budget fields', () => {
  const source = {
    transactions: [],
    goals: [],
    budgets: [budget('b1', 5000, 'INR', { category: 'Food', period: 'monthly', startDate: '2026-01-01', rollover: true })],
    emergencyBuffer: null,
  };
  
  const plan = planCurrencyChange(source, 'INR', 'USD', RATES);
  assert.equal(plan.ok, true);
  
  const b = plan.budgets[0];
  assert.equal(b.category, 'Food');
  assert.equal(b.period, 'monthly');
  assert.equal(b.startDate, '2026-01-01');
  assert.equal(b.rollover, true);
  assert.equal(b.currency, 'USD');
});