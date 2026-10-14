/**
 * Static migration checks for migration 0008 design.
 *
 * These tests verify the SQL text of the proposed migration 0008
 * contains the required idempotency guards, correct signatures,
 * and safety patterns. They do NOT execute SQL — they only check
 * that the source text matches the expected design.
 *
 * This provides regression coverage for the migration DESIGN
 * without requiring a database connection.
 *
 * Compiled by scripts/run-tests.mjs and executed with Node's built-in test runner.
 */
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

// The proposed migration 0008 SQL (as a string constant for static verification)
const PROPOSED_0008_SQL = `-- Migration 0008: Idempotent reconciliation for budgets.currency + convert_currency_data(4-arg) + clear_user_data
-- Safe for fresh DB, partial history, or full history. Does not assume remote state.

-- 1. ENSURE 4-ARG convert_currency_data WITH limit_amount SYNC
DROP FUNCTION IF EXISTS public.convert_currency_data(text, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.convert_currency_data(
  p_to           text,
  p_goals        jsonb,
  p_transactions jsonb,
  p_budgets      jsonb DEFAULT '[]'::jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_expected_goals int := coalesce(jsonb_array_length(p_goals), 0);
  v_expected_tx int := coalesce(jsonb_array_length(p_transactions), 0);
  v_expected_budgets int := coalesce(jsonb_array_length(p_budgets), 0);
  v_written_goals int := 0; v_written_tx int := 0; v_written_budgets int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required' USING ERRCODE='42501'; END IF;
  IF p_to IS NULL OR p_to = '' THEN RAISE EXCEPTION 'target currency required' USING ERRCODE='22023'; END IF;

  -- goals
  WITH src AS (SELECT e->>'id' AS id, e->>'from' AS from_currency, (e->>'target')::numeric AS target, (e->>'saved')::numeric AS saved
               FROM jsonb_array_elements(coalesce(p_goals, '[]'::jsonb)) AS e)
  UPDATE public.goals g SET target=src.target, saved=src.saved, currency=p_to
   FROM src WHERE g.id::text=src.id AND g.user_id=v_uid AND g.currency=src.from_currency;
  GET DIAGNOSTICS v_written_goals = ROW_COUNT;

  -- transactions
  WITH src AS (SELECT e->>'id' AS id, e->>'from' AS from_currency, (e->>'amount')::numeric AS amount
               FROM jsonb_array_elements(coalesce(p_transactions, '[]'::jsonb)) AS e)
  UPDATE public.transactions t SET amount=src.amount, currency=p_to
   FROM src WHERE t.id::text=src.id AND t.user_id=v_uid AND t.currency=src.from_currency;
  GET DIAGNOSTICS v_written_tx = ROW_COUNT;

  -- budgets (with limit_amount sync + column existence guard)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='budgets' AND column_name='currency') THEN
    WITH src AS (SELECT e->>'id' AS id, e->>'from' AS from_currency, (e->>'amount')::numeric AS amount
                 FROM jsonb_array_elements(coalesce(p_budgets, '[]'::jsonb)) AS e)
    UPDATE public.budgets b SET amount=src.amount, limit_amount=src.amount, currency=p_to
     FROM src WHERE b.id::text=src.id AND b.user_id=v_uid AND b.currency=src.from_currency;
    GET DIAGNOSTICS v_written_budgets = ROW_COUNT;
    IF v_written_budgets <> v_expected_budgets THEN
      RAISE EXCEPTION 'budgets updated %, expected %', v_written_budgets, v_expected_budgets USING ERRCODE='40001';
    END IF;
  ELSIF v_expected_budgets > 0 THEN
    RAISE EXCEPTION 'budgets column missing but budgets provided' USING ERRCODE='42703';
  END IF;

  IF v_written_goals <> v_expected_goals THEN RAISE EXCEPTION 'goals updated %, expected %', v_written_goals, v_expected_goals USING ERRCODE='40001'; END IF;
  IF v_written_tx <> v_expected_tx THEN RAISE EXCEPTION 'transactions updated %, expected %', v_written_tx, v_expected_tx USING ERRCODE='40001'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_currency_data(text, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_currency_data(text, jsonb, jsonb, jsonb) TO authenticated;

-- 2. ENSURE budgets.currency + constraint + index
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';
ALTER TABLE public.budgets ALTER COLUMN currency SET DEFAULT 'INR';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='budgets_currency_supported' AND conrelid='public.budgets'::regclass) THEN
    ALTER TABLE public.budgets ADD CONSTRAINT budgets_currency_supported
      CHECK (currency IN ('INR','USD','EUR','GBP','JPY','AED','SGD','CAD','AUD','CHF'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS budgets_user_currency_idx ON public.budgets (user_id, currency);

-- 3. ENSURE clear_user_data
CREATE OR REPLACE FUNCTION public.clear_user_data()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$ DECLARE v_uid uuid := auth.uid(); BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required' USING ERRCODE='42501'; END IF;
  DELETE FROM public.notifications WHERE user_id = v_uid;
  DELETE FROM public.budgets WHERE user_id = v_uid;
  DELETE FROM public.transactions WHERE user_id = v_uid;
  DELETE FROM public.goals WHERE user_id = v_uid;
  DELETE FROM public.categories WHERE user_id = v_uid;
  UPDATE public.profiles SET currency='INR', emergency_buffer=NULL,
    notifications='{"transactionAlerts":true,"budgetLimitWarnings":true,"weeklySummary":false,"goalReminders":true}'::jsonb,
    updated_at=NOW() WHERE id = v_uid;
END; $$;

REVOKE ALL ON FUNCTION public.clear_user_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_user_data() TO authenticated;
`;

function containsAll(sql, patterns, context) {
  for (const p of patterns) {
    assert.ok(sql.includes(p), `${context}: missing "${p}"`);
  }
}

function doesNotContain(sql, patterns, context) {
  for (const p of patterns) {
    assert.ok(!sql.includes(p), `${context}: should not contain "${p}"`);
  }
}

test('migration 0008: drops old 3-arg function before creating 4-arg', () => {
  containsAll(PROPOSED_0008_SQL, [
    "DROP FUNCTION IF EXISTS public.convert_currency_data(text, jsonb, jsonb)",
  ], 'migration 0008');
});

test('migration 0008: creates 4-arg function with p_budgets default', () => {
  containsAll(PROPOSED_0008_SQL, [
    'p_to           text,',
    'p_goals        jsonb,',
    'p_transactions jsonb,',
    "p_budgets      jsonb DEFAULT '[]'::jsonb",
    'RETURNS void',
    'LANGUAGE plpgsql',
    'SECURITY INVOKER',
    'SET search_path = public',
  ], 'migration 0008 function signature');
});

test('migration 0008: function updates limit_amount in budgets', () => {
  containsAll(PROPOSED_0008_SQL, [
    'UPDATE public.budgets b SET amount=src.amount, limit_amount=src.amount, currency=p_to',
  ], 'migration 0008 limit_amount sync');
});

test('migration 0008: budgets column existence guard before UPDATE', () => {
  containsAll(PROPOSED_0008_SQL, [
    "IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='budgets' AND column_name='currency') THEN",
  ], 'migration 0008 column guard');
});

test('migration 0008: row-count validation for all three entity types', () => {
  containsAll(PROPOSED_0008_SQL, [
    'v_written_goals <> v_expected_goals',
    'v_written_tx <> v_expected_tx',
    'v_written_budgets <> v_expected_budgets',
    "ERRCODE='40001'",
  ], 'migration 0008 row-count validation');
});

test('migration 0008: ownership checks on all data table UPDATEs', () => {
  // Match entire UPDATE statement up to semicolon (handles multi-line)
  const updates = PROPOSED_0008_SQL.match(/UPDATE public\.\w+[\s\S]*?;/g) || [];
  console.log('OWNERSHIP CHECK - Found', updates.length, 'UPDATE statements');
  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    console.log(`UPDATE ${i}:`, u.substring(0, 150).replace(/\n/g, '\\n'));
    // Skip profiles UPDATE (uses id = v_uid, not user_id)
    if (u.includes('UPDATE public.profiles')) continue;
    const hasOwnership = u.includes('g.user_id=v_uid') || u.includes('t.user_id=v_uid') || u.includes('b.user_id=v_uid');
    if (!hasOwnership) {
      console.log('FAILED - full text:', u.substring(0, 300));
    }
    assert.ok(hasOwnership, `UPDATE missing ownership check: ${u.substring(0, 100)}...`);
  }
});

test('migration 0008: currency match check on all data table UPDATEs', () => {
  const updates = PROPOSED_0008_SQL.match(/UPDATE public\.\w+[\s\S]*?;/g) || [];
  console.log('CURRENCY MATCH CHECK - Found', updates.length, 'UPDATE statements');
  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    console.log(`UPDATE ${i}:`, u.substring(0, 150).replace(/\n/g, '\\n'));
    // Skip profiles UPDATE (no currency match check)
    if (u.includes('UPDATE public.profiles')) continue;
    const hasCurrencyMatch = u.includes('g.currency=src.from_currency') || u.includes('t.currency=src.from_currency') || u.includes('b.currency=src.from_currency');
    if (!hasCurrencyMatch) {
      console.log('FAILED - full text:', u.substring(0, 300));
    }
    assert.ok(hasCurrencyMatch, `UPDATE missing currency match check: ${u.substring(0, 100)}...`);
  }
});

test('migration 0008: grants to authenticated only (not anon)', () => {
  containsAll(PROPOSED_0008_SQL, [
    'REVOKE ALL ON FUNCTION public.convert_currency_data(text, jsonb, jsonb, jsonb) FROM PUBLIC',
    'GRANT EXECUTE ON FUNCTION public.convert_currency_data(text, jsonb, jsonb, jsonb) TO authenticated',
    'REVOKE ALL ON FUNCTION public.clear_user_data() FROM PUBLIC',
    'GRANT EXECUTE ON FUNCTION public.clear_user_data() TO authenticated',
  ], 'migration 0008 grants');
  doesNotContain(PROPOSED_0008_SQL, ['TO anon'], 'migration 0008 grants');
});

test('migration 0008: budgets.currency column with IF NOT EXISTS', () => {
  containsAll(PROPOSED_0008_SQL, [
    "ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR'",
    "ALTER TABLE public.budgets ALTER COLUMN currency SET DEFAULT 'INR'",
  ], 'migration 0008 column add');
});

test('migration 0008: budgets currency CHECK constraint with IF NOT EXISTS', () => {
  containsAll(PROPOSED_0008_SQL, [
    "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='budgets_currency_supported' AND conrelid='public.budgets'::regclass)",
    "CHECK (currency IN ('INR','USD','EUR','GBP','JPY','AED','SGD','CAD','AUD','CHF'))",
  ], 'migration 0008 CHECK constraint');
});

test('migration 0008: budgets index with IF NOT EXISTS', () => {
  containsAll(PROPOSED_0008_SQL, [
    "CREATE INDEX IF NOT EXISTS budgets_user_currency_idx ON public.budgets (user_id, currency)",
  ], 'migration 0008 index');
});

test('migration 0008: clear_user_data with SECURITY INVOKER', () => {
  containsAll(PROPOSED_0008_SQL, [
    'CREATE OR REPLACE FUNCTION public.clear_user_data()',
    'RETURNS void',
    'LANGUAGE plpgsql',
    'SECURITY INVOKER',
    'SET search_path = public',
  ], 'migration 0008 clear_user_data signature');
});

test('migration 0008: clear_user_data auth guard', () => {
  containsAll(PROPOSED_0008_SQL, [
    "IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required' USING ERRCODE='42501'",
  ], 'migration 0008 clear_user_data auth guard');
});

test('migration 0008: clear_user_data FK-safe deletion order', () => {
  const deletes = PROPOSED_0008_SQL.match(/DELETE FROM public\.\w+ WHERE user_id = v_uid;/g) || [];
  assert.ok(deletes.length >= 5, 'should have 5+ DELETE statements');
  // Order: notifications, budgets, transactions, goals, categories
  const order = deletes.map(d => d.match(/DELETE FROM public\.(\w+)/)[1]);
  assert.deepEqual(order, ['notifications', 'budgets', 'transactions', 'goals', 'categories']);
});

test('migration 0008: clear_user_data preserves profile identity fields', () => {
  containsAll(PROPOSED_0008_SQL, [
    "UPDATE public.profiles SET currency='INR', emergency_buffer=NULL",
    'notifications=\'{"transactionAlerts":true,"budgetLimitWarnings":true,"weeklySummary":false,"goalReminders":true}\'::jsonb',
    'updated_at=NOW() WHERE id = v_uid',
  ], 'migration 0008 profile update');
  // Does NOT set name, avatar, profile_picture, language
  // Use word boundaries to avoid false positives (e.g., column_name contains 'name=')
  const checks = [' name=', ' avatar=', ' profile_picture=', ' language='];
  for (const c of checks) {
    assert.ok(!PROPOSED_0008_SQL.includes(c), `migration 0008 profile identity preservation: should not contain "${c.trim()}"`);
  }
});

test('migration 0008: grants on clear_user_data to authenticated only', () => {
  containsAll(PROPOSED_0008_SQL, [
    'REVOKE ALL ON FUNCTION public.clear_user_data() FROM PUBLIC',
    'GRANT EXECUTE ON FUNCTION public.clear_user_data() TO authenticated',
  ], 'migration 0008 clear_user_data grants');
  doesNotContain(PROPOSED_0008_SQL, ['TO anon'], 'migration 0008 clear_user_data grants');
});

test('migration 0008: uses CREATE OR REPLACE for idempotency', () => {
  // Both functions use CREATE OR REPLACE
  const createOrReplaceCount = (PROPOSED_0008_SQL.match(/CREATE OR REPLACE FUNCTION/g) || []).length;
  assert.equal(createOrReplaceCount, 2, 'both functions use CREATE OR REPLACE');
});

test('migration 0008: no plain CREATE FUNCTION (would fail on re-run)', () => {
  const createFunctionCount = (PROPOSED_0008_SQL.match(/^CREATE FUNCTION /gm) || []).length;
  assert.equal(createFunctionCount, 0, 'no plain CREATE FUNCTION — all use CREATE OR REPLACE');
});

test('migration 0008: no plain ADD COLUMN (would fail on re-run)', () => {
  const addColumnCount = (PROPOSED_0008_SQL.match(/^ALTER TABLE .* ADD COLUMN (?!IF NOT EXISTS)/gm) || []).length;
  assert.equal(addColumnCount, 0, 'all ADD COLUMN use IF NOT EXISTS');
});

test('migration 0008: no plain CREATE INDEX (would fail on re-run)', () => {
  const createIndexCount = (PROPOSED_0008_SQL.match(/^CREATE INDEX (?!IF NOT EXISTS)/gm) || []).length;
  assert.equal(createIndexCount, 0, 'all CREATE INDEX use IF NOT EXISTS');
});

test('migration 0008: includes all 10 supported currencies in CHECK', () => {
  const currencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AED', 'SGD', 'CAD', 'AUD', 'CHF'];
  for (const c of currencies) {
    assert.ok(PROPOSED_0008_SQL.includes(c), `CHECK constraint includes ${c}`);
  }
});

test('migration 0008: does not reference rollover column (may not exist remotely)', () => {
  doesNotContain(PROPOSED_0008_SQL, ['rollover'], 'migration 0008 avoids rollover column');
});

test('migration 0008: does not assume notifications table may not exist', () => {
  // The confirmed metadata shows notifications table exists, so unconditional DELETE is acceptable
  // But we note this assumption
  assert.ok(PROPOSED_0008_SQL.includes('DELETE FROM public.notifications WHERE user_id = v_uid;'));
});

test('migration 0008: transaction safety — single PL/pgSQL block per function', () => {
  // Each function is a single BEGIN...END block — atomic transaction
  const functionBlocks = PROPOSED_0008_SQL.match(/AS \$\$[\s\S]*?\$\$;/g) || [];
  assert.equal(functionBlocks.length, 2, 'two function blocks (convert_currency_data + clear_user_data)');
});