-- FinTrack AI - fetch exchange rates through the app's own backend.
--
-- Goal: let the client read a rate table through the Supabase project it already
-- talks to, so no third-party CORS policy can block currency conversion.
--
-- Why this exists
-- ---------------
-- The app originally fetched rates straight from `api.frankfurter.app`. That host
-- is DEPRECATED - its own responses carry a `deprecation` header and a
-- `successor-version` link - so a request to it fails intermittently, typically
-- as a CORS error in the browser, which is unrecoverable for the user: the app
-- cannot convert, and cannot switch currency at all.
--
-- Two defenses, either sufficient on its own:
--
--   1. `services/rateProviders.ts` calls three independent, CORS-safe public
--      providers and fails over between them. This needs no infrastructure and
--      works today.
--   2. This function proxies the same lookup through the app's own backend, so
--      the browser is not in the path at all.
--
-- Defense (2) is what carries Frankfurter: it is called from the server only,
-- so no third-party host ever sees a browser request. Without this function
-- deployed, Frankfurter is simply unused -- the app still converts using (1).
--
-- This migration is for (2), and is optional. The client falls back to (1)
-- automatically whenever the proxy is unreachable or unset, so applying this
-- migration can never make things worse.
--
-- Deploy the function first, then apply this migration:
--
--   supabase functions deploy exchange-rates
--
-- Then set, in the app's .env:
--
--   EXPO_PUBLIC_EXCHANGE_RATE_PROXY_URL=<project-ref>.supabase.co/functions/v1/exchange-rates
--
-- Why a SQL wrapper rather than `supabase.functions.invoke()`
-- ---------------------------------------------------------
-- `functions.invoke()` is authenticated and works out of the box, but this app
-- fetches rates before a user is necessarily signed in (a signed-out user's
-- currency picker still needs rates, and the rate table is cached per device).
-- Calling the function over plain HTTP from the browser avoids tying rate
-- fetching to the auth session, and the function returns public market data with
-- no user input, so it needs no user context of its own.
--
-- CORS is still handled at the function: the function itself returns
-- `Access-Control-Allow-Origin: *`, so a browser can call it directly. This
-- wrapper exists for callers that would rather go through the normal PostgREST
-- endpoint.
--
-- This migration is idempotent.

CREATE OR REPLACE FUNCTION public.fetch_exchange_rates(p_base text DEFAULT 'INR')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base      text := upper(coalesce(p_base, 'INR'));
  v_url       text;
  v_response  jsonb;
  v_rates     jsonb;
  v_content   text;
  v_status    int;
  v_source    text;
  v_parsed    jsonb;
  -- The quotes this proxy will ask for and accept, i.e. every supported code
  -- except the base. Mirrors `QUOTED_CURRENCY_CODES` in
  -- `services/rateProviders.ts`, which the app derives from `CURRENCIES` in
  -- `types/index.ts`. A currency missing from this array is dropped twice over:
  -- it is never requested from Frankfurter, and the filter below discards it if
  -- another upstream returns it, so the client reports "no rate" for it. Keep
  -- the three lists in step.
  v_codes     text[] := array['USD', 'EUR', 'GBP', 'JPY',
                              'AED', 'SGD', 'CAD', 'AUD', 'CHF'];
  v_code      text;
  v_quotes    text;
  v_rate      numeric;
  v_out       jsonb := jsonb_build_object(v_base, 1);
BEGIN
  -- Only the one base the app converts from, and only the currencies it
  -- supports. This keeps the function from being used as an open proxy.
  IF v_base <> 'INR' THEN
    RAISE EXCEPTION 'unsupported base currency: %', v_base USING ERRCODE = '22023';
  END IF;

  v_quotes := array_to_string(v_codes, ',');

  -- Upstreams in the same order as `services/rateProviders.ts`, so the proxy and
  -- the direct path agree on which feed is primary.
  FOR v_url, v_source IN
    SELECT * FROM (VALUES
      ('https://api.frankfurter.dev/v2/rates?base=' || v_base || '&quotes=' || v_quotes, 'frankfurter-v2'),
      ('https://api.exchangerate-api.com/v4/latest/' || v_base,                     'exchangerate-api-v4'),
      ('https://open.er-api.com/v6/latest/' || v_base,                              'er-api-v6'),
      ('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/' || lower(v_base) || '.json',
                                                                                    'fawazahmed0-cdn')
    ) AS t(url, source)
  LOOP
    -- `net.http_get` is Supabase's pg_net wrapper. It is the only HTTP egress
    -- Postgres has, and it is already enabled on hosted projects. If pg_net is
    -- not available the client falls back to its direct providers, so this
    -- function is allowed to fail rather than being made to work without it.
    BEGIN
      SELECT content, status INTO v_content, v_status
      FROM net.http_get(
        url     := v_url,
        headers := jsonb_build_object('Accept', 'application/json'),
        timeout_milliseconds := 8000
      );

      CONTINUE WHEN v_status IS DISTINCT FROM 200 OR v_content IS NULL;

      v_response := v_content::jsonb;

      -- Layout 1: { base, rates: { ... } }  (v4, open feed, and the proxy's own
      -- output, so this wrapper can also call another function).
      v_rates := v_response -> 'rates';

      -- Layout 2: [{ base, quote, rate }, ...]  (Frankfurter v2)
      IF v_rates IS NULL AND jsonb_typeof(v_response) = 'array' THEN
        SELECT jsonb_object_agg(entry ->> 'quote', entry -> 'rate')
          INTO v_rates
          FROM jsonb_array_elements(v_response) AS entry;
      END IF;

      -- Layout 3: { <base>: { <quote>: rate } }  (currency-api on jsDelivr)
      IF v_rates IS NULL THEN
        v_rates := v_response -> lower(v_base);
      END IF;

      CONTINUE WHEN v_rates IS NULL OR jsonb_typeof(v_rates) <> 'object';

      -- Keep only supported, positive, finite rates, coerced to numbers so the
      -- client receives the same types it would from a direct call.
      FOREACH v_code IN ARRAY v_codes LOOP
        v_rate := nullif(v_rates ->> v_code, '')::numeric;
        CONTINUE WHEN v_rate IS NULL OR v_rate <= 0;
        v_out := v_out || jsonb_build_object(v_code, v_rate);
      END LOOP;

      -- The base alone is not a usable table; that is how a provider error page
      -- or an empty response gets rejected here instead of cached as a table.
      IF jsonb_object_length(v_out) > 1 THEN
        RETURN jsonb_build_object(
          'base',    v_base,
          'rates',   v_out,
          'source',  'supabase-proxy',
          'upstream', v_source
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Try the next upstream. Nothing is written, so there is no partial state.
      RAISE NOTICE 'rate upstream % failed: %', v_source, SQLERRM;
    END;
  END LOOP;

  -- Every upstream failed. The client sees an error and falls back to its own
  -- direct providers.
  RAISE EXCEPTION 'all exchange rate providers failed' USING ERRCODE = '08006';
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_exchange_rates(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_exchange_rates(text) TO anon, authenticated;
