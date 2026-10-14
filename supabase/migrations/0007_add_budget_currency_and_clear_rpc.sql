-- Migration 0007: Add budgets.currency column + atomic clear_user_data RPC
-- Run AFTER 0006_extend_currency_conversion_budgets.sql
-- Purpose: (1) Fix schema gap for atomic currency conversion on budgets
--          (2) Provide atomic clear-all-data for "Clear All Data" feature

-- ============================================================
-- 1. ADD currency COLUMN TO BUDGETS
-- ============================================================
-- Required by convert_currency_data (migration 0006) which updates b.currency
-- Without this, budget currency conversion would fail with row-count mismatch.
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';

-- Make DEFAULT explicit so clients omitting the column still get INR
ALTER TABLE public.budgets ALTER COLUMN currency SET DEFAULT 'INR';

-- CHECK constraint matching transactions/goals/profiles (10 supported currencies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budgets_currency_supported'
       AND conrelid = 'public.budgets'::regclass
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_currency_supported
      CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP', 'JPY',
                          'AED', 'SGD', 'CAD', 'AUD', 'CHF'));
  END IF;
END $$;

-- Index for currency-change query performance (mirrors transactions/goals)
CREATE INDEX IF NOT EXISTS budgets_user_currency_idx
  ON public.budgets (user_id, currency);

-- ============================================================
-- 2. ATOMIC clear_user_data RPC
-- ============================================================
-- Deletes ALL authenticated user's app data in ONE transaction.
-- Preserves: auth account, profile row (id, name, avatar, profile_picture, language)
-- Resets:    profile preferences (currency, emergency_buffer, notifications)
-- Tables affected (in FK-safe order): notifications, budgets, transactions, goals, categories
CREATE OR REPLACE FUNCTION public.clear_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER          -- Runs as caller; RLS policies still apply
SET search_path = public  -- Prevent search_path injection
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Guard: must be authenticated
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'clear_user_data requires an authenticated user'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  -- Delete user-owned data (FK-safe order: children first)
  -- All tables have user_id FK to auth.users with ON DELETE CASCADE,
  -- but explicit deletes keep RLS checks explicit and auditable.
  DELETE FROM public.notifications WHERE user_id = v_uid;
  DELETE FROM public.budgets       WHERE user_id = v_uid;
  DELETE FROM public.transactions  WHERE user_id = v_uid;
  DELETE FROM public.goals         WHERE user_id = v_uid;
  DELETE FROM public.categories    WHERE user_id = v_uid;

  -- Reset profile preferences, KEEP identity fields (name, avatar, profile_picture, language)
  UPDATE public.profiles
     SET currency          = 'INR',
         emergency_buffer  = NULL,
         notifications     = '{"transactionAlerts": true, "budgetLimitWarnings": true, "weeklySummary": false, "goalReminders": true}'::jsonb,
         updated_at        = NOW()
   WHERE id = v_uid;
END;
$$;

-- Standard PostgREST grant pattern (matches convert_currency_data)
REVOKE ALL ON FUNCTION public.clear_user_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_user_data() TO authenticated;