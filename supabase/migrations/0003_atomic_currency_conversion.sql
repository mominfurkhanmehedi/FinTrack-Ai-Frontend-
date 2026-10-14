-- FinTrack AI - atomic (all-or-nothing) currency conversion.
--
-- Goal: make a currency change a single atomic database operation, so the
-- requirement "if it fails, nothing is partially updated" actually holds.
--
-- Why this is needed
-- ------------------
-- Converting a currency rewrites a DIFFERENT amount into every monetary row
-- (transactions.amount, goals.target, goals.saved). A bulk `update` cannot
-- write a distinct value per row, so the previous approach sent one REST
-- request per row. PostgREST has no multi-statement transaction, so a failure
-- half way through the loop left the database holding a MIX of old and new
-- currency rows - which is worse than not converting at all, because every
-- amount is then wrong.
--
-- This function fixes that at the source. A single PostgREST function call runs
-- inside one database transaction, so either every row is rewritten or none is.
-- The converted values are still computed client-side by
-- `planCurrencyChange` (the app owns the rate table and the rounding); this
-- function's job is purely to apply them atomically.
--
-- Why it also double-checks each row
-- ---------------------------------
-- Every entry carries the currency that row was in when the plan was computed
-- (`from`). The UPDATE only matches a row that is STILL in that currency, and
-- the row count is then compared against the number of rows sent. A mismatch
-- means the data moved underneath the client - another device, or a second app
-- instance - so the whole call raises and nothing is written. That turns the
-- "convert from the record's CURRENT stored currency" rule into a guarantee
-- rather than an assumption.
--
-- Ownership
-- ---------
-- `auth.uid()` is required, and both UPDATEs are additionally filtered by
-- `user_id = auth.uid()`. That is the same owner check the RLS policies in
-- migration 002 apply, restated inside the function so the guarantee does not
-- depend on goals having RLS enabled. The function is SECURITY INVOKER, so RLS
-- still applies on top of this.
--
-- Idempotency: CREATE OR REPLACE plus a re-grant, so re-running is safe.
--
-- Run this via `supabase db push` (Supabase CLI) or paste it into the Supabase
-- SQL editor. It must be applied AFTER 002, since it writes the `currency`
-- column that migration adds.

CREATE OR REPLACE FUNCTION public.convert_currency_data(
  p_to           text,
  p_goals        jsonb,
  p_transactions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_expected_goals int  := coalesce(jsonb_array_length(p_goals), 0);
  v_expected_tx    int  := coalesce(jsonb_array_length(p_transactions), 0);
  v_written_goals  int  := 0;
  v_written_tx     int  := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'convert_currency_data requires an authenticated user'
      USING ERRCODE = '42501';
  END IF;

  -- An empty request is a valid no-op (a brand new account has no rows yet).
  IF p_to IS NULL OR p_to = '' THEN
    RAISE EXCEPTION 'convert_currency_data: target currency is required'
      USING ERRCODE = '22023';
  END IF;

  -- goals: each entry is { "id", "from", "target", "saved" }.
  -- `id` is compared as text rather than cast to uuid so this works whether the
  -- column is uuid or text.
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

  -- transactions: each entry is { "id", "from", "amount" }.
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

  -- Any shortfall means a row was deleted, is not ours, or has already moved to
  -- another currency. Raising here rolls the whole transaction back, so the
  -- caller can safely re-read and retry instead of reconciling a half-written
  -- data set.
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
END;
$$;

-- PostgREST exposes functions in the `public` schema, but the default EXECUTE
-- grant is not guaranteed to include the authenticated role across projects.
REVOKE ALL ON FUNCTION public.convert_currency_data(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_currency_data(text, jsonb, jsonb) TO authenticated;