-- WIDEN THE SUPPORTED CURRENCY SET
-- ================================
--
-- The app now offers ten currencies instead of five, adding AED, SGD, CAD,
-- AUD and CHF. Migration 0002 pinned a CHECK constraint to the original five,
-- so without this the database would reject every write of a newly added code
-- while the picker happily offers it: the row would fail at the database and
-- the conversion would appear to succeed in the UI.
--
-- `types/index.ts` (CURRENCIES) is the app-side source of truth. The two must
-- stay in step, so the list below is written out in full rather than derived.
--
-- IDEMPOTENT
-- ----------
-- Safe to run on a database that never received 0002 as well as one that did,
-- and safe to re-run: the drops are guarded and the adds re-validate every
-- existing row. Re-validating cannot fail, because the previous constraint
-- admitted only five codes and all five are still members of the new set, so
-- no row can be present that the wider check would reject. The defaults added
-- by 0002 are untouched.
--
-- To add a currency in future, add it to CURRENCIES and to both lists here.

DO $$
BEGIN
  ALTER TABLE public.transactions
    DROP CONSTRAINT IF EXISTS transactions_currency_supported;
  ALTER TABLE public.goals
    DROP CONSTRAINT IF EXISTS goals_currency_supported;

  -- NOT VALID would skip the existing-row scan, but since the new set is a
  -- strict superset of the old one there is nothing to skip, and validating
  -- now means a bad row is reported at migration time rather than later.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'transactions_currency_supported'
       AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_currency_supported
      CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP', 'JPY',
                          'AED', 'SGD', 'CAD', 'AUD', 'CHF'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'goals_currency_supported'
       AND conrelid = 'public.goals'::regclass
  ) THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_currency_supported
      CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP', 'JPY',
                          'AED', 'SGD', 'CAD', 'AUD', 'CHF'));
  END IF;
END $$;
