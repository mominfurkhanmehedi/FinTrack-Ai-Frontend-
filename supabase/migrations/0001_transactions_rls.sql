-- FinTrack AI — Transactions table Row Level Security (RLS) policies.
--
-- Goal: keep RLS ENABLED and restrict every transaction operation to the
-- owner of the row, so an authenticated user can only read/write their own
-- transactions (never another user's).
--
-- Run this via `supabase db push` (Supabase CLI) or paste it into the
-- Supabase SQL editor. It is idempotent: policies are dropped (if they
-- exist) before being recreated, so re-running it will not create duplicates.

-- Ensure RLS stays enabled on the table (never disable it).
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- SELECT: only the owner's own rows.
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: only rows where user_id matches the authenticated user.
DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
CREATE POLICY "transactions_insert_own"
  ON public.transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: only the owner's own rows (both USING and WITH CHECK keep it scoped).
DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
CREATE POLICY "transactions_update_own"
  ON public.transactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: only the owner's own rows.
DROP POLICY IF EXISTS "transactions_delete_own" ON public.transactions;
CREATE POLICY "transactions_delete_own"
  ON public.transactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
