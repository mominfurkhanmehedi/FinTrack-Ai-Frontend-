-- FinTrack AI - extend atomic currency conversion to include budgets.
--
-- This migration REPLACES the 3-argument convert_currency_data function
-- with a 4-argument version where p_budgets defaults to '[]'::jsonb.
-- Existing calls with 3 arguments continue to work unchanged.
--
-- Why replace instead of overload:
--   Postgres identifies functions by argument types. Adding a 4-arg version
--   alongside the 3-arg version would create an overload. Calls with 3 args
--   would resolve to the old function, calls with 4 args to the new one.
--   Replacing with a single function that has a default for p_budgets
--   ensures ALL calls (old and new) hit the same atomic logic.
--
-- Run via `supabase db push` (Supabase CLI) or paste into Supabase SQL editor.
-- Must be applied AFTER 0003_atomic_currency_conversion.sql.

-- Drop the old 3-argument function so we can replace it cleanly.
-- DROP FUNCTION is idempotent with IF EXISTS.
DROP FUNCTION IF EXISTS public.convert_currency_data(text, jsonb, jsonb);

-- New 4-argument function with default for p_budgets.
CREATE OR REPLACE FUNCTION public.convert_currency_data(
  p_to           text,
  p_goals        jsonb,
  p_transactions jsonb,
  p_budgets      jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid             uuid := auth.uid();
  v_expected_goals  int  := coalesce(jsonb_array_length(p_goals), 0);
  v_expected_tx     int  := coalesce(jsonb_array_length(p_transactions), 0);
  v_expected_budgets int := coalesce(jsonb_array_length(p_budgets), 0);
  v_written_goals   int  := 0;
  v_written_tx      int  := 0;
  v_written_budgets int  := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'convert_currency_data requires an authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF p_to IS NULL OR p_to = '' THEN
    RAISE EXCEPTION 'convert_currency_data: target currency is required'
      USING ERRCODE = '22023';
  END IF;

  -- goals: each entry is { "id", "from", "target", "saved" }
  WITH src AS (
    SELECT
      e->>'id'          AS id,
      e->>'from'        AS from_currency,
      (e->>'target')::numeric AS target,
      (e->>'saved')::numeric  AS saved
    FROM jsonb_array_elements(coalesce(p_goals, '[]'::jsonb)) AS e
  )
  UPDATE public.goals AS g
     SET target  = src.target,
         saved   = src.saved,
         currency = p_to
    FROM src
   WHERE g.id::text = src.id
     AND g.user_id = v_uid
     AND g.currency = src.from_currency;

  GET DIAGNOSTICS v_written_goals = ROW_COUNT;

  -- transactions: each entry is { "id", "from", "amount" }
  WITH src AS (
    SELECT
      e->>'id'              AS id,
      e->>'from'            AS from_currency,
      (e->>'amount')::numeric AS amount
    FROM jsonb_array_elements(coalesce(p_transactions, '[]'::jsonb)) AS e
  )
  UPDATE public.transactions AS t
     SET amount   = src.amount,
         currency = p_to
    FROM src
   WHERE t.id::text = src.id
     AND t.user_id = v_uid
     AND t.currency = src.from_currency;

  GET DIAGNOSTICS v_written_tx = ROW_COUNT;

  -- budgets: each entry is { "id", "from", "amount" }
  WITH src AS (
    SELECT
      e->>'id'              AS id,
      e->>'from'            AS from_currency,
      (e->>'amount')::numeric AS amount
    FROM jsonb_array_elements(coalesce(p_budgets, '[]'::jsonb)) AS e
  )
  UPDATE public.budgets AS b
     SET amount   = src.amount,
         currency = p_to
    FROM src
   WHERE b.id::text = src.id
     AND b.user_id = v_uid
     AND b.currency = src.from_currency;

  GET DIAGNOSTICS v_written_budgets = ROW_COUNT;

  -- Atomicity: all row counts must match exactly.
  IF v_written_goals <> v_expected_goals THEN
    RAISE EXCEPTION
      'convert_currency_data: goals updated %, expected % - nothing was written',
      v_written_goals, v_expected_goals
      USING ERRCODE = '40001';
  END IF;

  IF v_written_tx <> v_expected_tx THEN
    RAISE EXCEPTION
      'convert_currency_data: transactions updated %, expected % - nothing was written',
      v_written_tx, v_expected_tx
      USING ERRCODE = '40001';
  END IF;

  IF v_written_budgets <> v_expected_budgets THEN
    RAISE EXCEPTION
      'convert_currency_data: budgets updated %, expected % - nothing was written',
      v_written_budgets, v_expected_budgets
      USING ERRCODE = '40001';
  END IF;
END;
$$;

-- Ensure authenticated role can execute (idempotent).
REVOKE ALL ON FUNCTION public.convert_currency_data(text, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_currency_data(text, jsonb, jsonb, jsonb) TO authenticated;