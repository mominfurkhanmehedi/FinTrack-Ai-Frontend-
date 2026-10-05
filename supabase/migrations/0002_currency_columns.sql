-- FinTrack AI — per-record currency columns.
--
-- Goal: every monetary row states the currency its amounts are denominated in,
-- so the database always holds values in the user's CURRENTLY SELECTED currency
-- and a stored amount is never ambiguous.
--
-- Background
-- ----------
-- The app used to keep all amounts in a fixed base currency (INR) and convert
-- them only for display. Selecting a different currency now PERMANENTLY
-- CONVERTS the stored values instead, and the preference is only moved after
-- that conversion succeeds (see `planCurrencyChange` in `utils/currency.ts`).
--
-- Because of that, every row's `currency` is the same code at any given moment,
-- and it equals the user's selection. The column exists so the value is
-- explicit and queryable rather than implied, and so the conversion can stamp
-- each row as it rewrites it.
--
-- Backfill
-- --------
-- Rows that predate this column were all written in INR, so the DEFAULT and the
-- backfill are both 'INR' (the legacy base). The DEFAULT matters only for rows
-- written by a client that omits the column; the app always sends it explicitly.
--
-- Run this via `supabase db push` (Supabase CLI) or paste it into the Supabase
-- SQL editor. It is idempotent.

-- ── transactions ────────────────────────────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';

-- ── goals (holds both the target and the saved/savings total) ───────────────
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';

-- Make the DEFAULT explicit: a new row must never land in a currency the app
-- does not support, and it must not be NULL (recordCurrency() treats a missing
-- code as the legacy currency, and would silently mislabel such a row).
ALTER TABLE public.transactions ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE public.goals ALTER COLUMN currency SET DEFAULT 'INR';

-- Reject a currency the app cannot format, so a bad write fails loudly at the
-- database rather than rendering as a bare code in the UI.
DO $$
BEGIN
  -- Scoped by conrelid, not just conname: constraint names are only unique
  -- within a table, so a bare conname lookup could match an unrelated table and
  -- silently skip creating the constraint this table needs.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'transactions_currency_supported'
       AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_currency_supported
      CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP', 'JPY'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'goals_currency_supported'
       AND conrelid = 'public.goals'::regclass
  ) THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_currency_supported
      CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP', 'JPY'));
  END IF;
END $$;

-- The currency change rewrites every row for one user in a single statement
-- pair, so an index on (user_id, currency) keeps that from degrading into a
-- sequential scan on a large table.
CREATE INDEX IF NOT EXISTS transactions_user_currency_idx
  ON public.transactions (user_id, currency);
CREATE INDEX IF NOT EXISTS goals_user_currency_idx
  ON public.goals (user_id, currency);
