import {
  BASE_CURRENCY,
  RateTable,
  RatesSnapshot,
  SUPPORTED_CURRENCY_CODES,
} from '../utils/currency';

/**
 * RATE PROVIDERS
 * ==============
 *
 * Where exchange rates come from, and how each provider's response is read.
 * This module is PURE: it builds URLs and parses payloads, and performs no I/O,
 * so all of it is unit-testable without a network or a timer.
 *
 * Why several providers
 * ---------------------
 * A currency change permanently rewrites every stored amount, so a rate source
 * that is down, rate-limited, blocked, or renamed takes the whole feature with
 * it. `services/exchangeRates.ts` therefore walks this list in order and uses
 * the first provider that answers with a usable table. Depending on a single
 * host is what made this fail before.
 *
 * Why Frankfurter is not in this list
 * -----------------------------------
 * Frankfurter is called by the Supabase Edge Function in
 * `supabase/functions/exchange-rates`, never by the browser. Two reasons:
 *
 *   1. `api.frankfurter.app`, the host this app originally used, is DEPRECATED
 *      and its own responses name a successor:
 *
 *        deprecation: @1779103800
 *        link: <https://api.frankfurter.dev/v2/rates>; rel="successor-version"
 *
 *      A deprecated host is exactly the kind of thing that works from a shell
 *      and fails from a browser behind a proxy or an ad blocker.
 *   2. Keeping a single third-party host in the client is a standing dependency
 *      on someone else's CORS policy. Proxied server-side, that decision stops
 *      being able to reach the user, and the browser is off the rate path
 *      entirely.
 *
 * It is still exported and still labelled below, because the Edge Function
 * reports which upstream answered (`source: 'frankfurter-v2'`) and the Settings
 * screen has to be able to name it.
 *
 * Every provider here must, at minimum, answer a plain cross-origin `GET` with
 * `Access-Control-Allow-Origin` and no API key. All three are public reference
 * rate feeds, so a rate outage is a UI problem, never a correctness one: the
 * conversion layer refuses to guess (see `parseRatesTable`).
 */

/** The currencies to request: every supported code except the INR base. */
export const QUOTED_CURRENCY_CODES = SUPPORTED_CURRENCY_CODES.filter((c) => c !== BASE_CURRENCY);

/** A source of exchange rates, described without any I/O. */
export interface RateProvider {
  /** Stable id, used in logs and to skip a provider that already failed. */
  id: string;
  /** Human-readable name, shown in the UI when rates are not fresh. */
  label: string;
  /**
   * Builds the request URL. Given the base code and the codes to quote, returns
   * the absolute URL to GET.
   */
  url: (base: string, quotes: readonly string[]) => string;
  /**
   * True when a parsed response is expected to come from this provider. Used only
   * to log a more useful message when a response turns out to be unusable.
   */
  expect: (payload: unknown) => boolean;
}

/**
 * Frankfurter v2 — the successor to the deprecated `api.frankfurter.app`.
 *
 * SERVER-SIDE ONLY. This is not in `RATE_PROVIDERS` and the browser must never
 * call it; the Edge Function in `supabase/functions/exchange-rates` is its only
 * caller. It is exported so that server path and its tests can reuse the URL
 * builder, and so a future provider list can opt back in deliberately.
 */
export const FRANKFURTER_V2: RateProvider = {
  id: 'frankfurter-v2',
  label: 'Frankfurter (ECB reference rates)',
  url: (base, quotes) =>
    // Commas are left literal rather than percent-encoded: they are a legal
    // character inside a query value, and a few servers do not decode %2C in
    // that position, which would silently drop every quote after the first.
    `https://api.frankfurter.dev/v2/rates?base=${encodeURIComponent(base)}&quotes=${quotes.join(',')}`,
  // v2 answers with an array of one row per quote.
  expect: (payload) => Array.isArray(payload),
};

/**
 * exchangerate-api v4 — same data as Frankfurter, different host, so it covers
 * the case where Frankfurter itself is unreachable.
 */
export const EXCHANGE_RATE_API_V4: RateProvider = {
  id: 'exchangerate-api-v4',
  label: 'ExchangeRate-API',
  url: (base) => `https://api.exchangerate-api.com/v4/latest/${encodeURIComponent(base)}`,
  // v4 answers with `{ base, rates: { ... } }`.
  expect: (payload) => !!payload && typeof payload === 'object' && 'rates' in (payload as object),
};

/**
 * open.er-api.com — a third independent host. Included because having two
 * fallbacks means one provider being blocked still leaves a working path.
 */
export const ER_API_V6: RateProvider = {
  id: 'er-api-v6',
  label: 'ExchangeRate-API (open.er-api.com)',
  url: (base) => `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
  expect: (payload) =>
    !!payload &&
    typeof payload === 'object' &&
    ('base_code' in (payload as object) || 'rates' in (payload as object)),
};

/**
 * jsDelivr mirror of the fawazahmed0 currency API — a CDN front end, so it is
 * reachable even where the API hosts above are blocked. Served from a CDN rather
 * than an API origin, so it also behaves differently from a typical API under
 * restrictive corporate proxies.
 */
export const FAWAZAHMED0_CDN: RateProvider = {
  id: 'fawazahmed0-cdn',
  label: 'currency-api (jsDelivr CDN)',
  url: (base) =>
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${encodeURIComponent(
      base.toLowerCase(),
    )}.json`,
  // Answers with `{ date, <base>: { <quote>: rate } }`.
  expect: (payload) =>
    !!payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    !('rates' in (payload as object)),
};

/**
 * Providers the BROWSER may call, in the order they are tried.
 *
 * The configured proxy is tried before any of these (see
 * `services/exchangeRates.ts`); these are the fallback for when no proxy is
 * configured or the proxy is down. Frankfurter is deliberately absent — it is
 * reached through the Edge Function, so a third-party CORS policy cannot break
 * the client.
 */
export const RATE_PROVIDERS: readonly RateProvider[] = [
  EXCHANGE_RATE_API_V4,
  ER_API_V6,
  FAWAZAHMED0_CDN,
];

/**
 * Source id -> display name, for the UI.
 *
 * A snapshot records which feed it came from, so a user being served by a
 * fallback can see that rather than wondering why the numbers differ. `'proxy'`
 * covers the same-origin Edge Function; `'cache'` is a table restored from local
 * storage with no network involved at all.
 *
 * `frankfurter-v2` is listed explicitly rather than picked up from
 * `RATE_PROVIDERS`: it is not a browser provider, but the Edge Function names
 * it in the snapshot's `source`, and without an entry here the Settings screen
 * would render a raw id to the user.
 */
export const RATE_PROVIDER_LABELS: Record<string, string> = {
  proxy: 'App server',
  cache: 'Saved on this device',
  [FRANKFURTER_V2.id]: FRANKFURTER_V2.label,
  ...Object.fromEntries(RATE_PROVIDERS.map((p) => [p.id, p.label])),
};

/** The shape a provider response must have to be usable. */
export type RatesPayload =
  | { kind: 'object'; rates: Record<string, unknown>; base?: unknown }
  | { kind: 'list'; rows: unknown[] }
  | { kind: 'nested'; map: Record<string, unknown> };

/**
 * Recognizes which of the three supported response layouts this is.
 *
 * The three are:
 *
 *   object  `{ base?, rates: { USD: 0.0104, ... } }`   Frankfurter v1, the
 *           v4 and open feeds, and the app's own proxy
 *   list    `[{ base, quote, rate }, ...]`             Frankfurter v2
 *   nested  `{ <base>: { <quote>: rate } }`            currency-api (CDN)
 *
 * `conversion_rates` is accepted alongside `rates` because older builds of the
 * open feed used that key and a cached response may still carry it.
 *
 * Returns `null` for anything unrecognized, which the caller treats as a
 * provider failure rather than as an empty table — the difference matters,
 * because an empty table must never be written over a good cached one.
 */
export function detectPayload(payload: unknown): RatesPayload | null {
  if (Array.isArray(payload)) {
    return payload.length > 0 ? { kind: 'list', rows: payload } : null;
  }
  if (!payload || typeof payload !== 'object') return null;

  const body = payload as Record<string, unknown>;
  const rates = body.rates ?? body.conversion_rates;
  if (rates && typeof rates === 'object' && !Array.isArray(rates)) {
    return { kind: 'object', rates: rates as Record<string, unknown>, base: body.base ?? body.base_code };
  }

  // `nested`: exactly one object-valued key holding the quote map. The base code
  // is whichever key that is, so `eur` and `EUR` both work.
  const objects = Object.entries(body).filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value));
  if (objects.length === 1) {
    return { kind: 'nested', map: objects[0][1] as Record<string, unknown> };
  }
  return null;
}

/** Coerces a rate to a positive finite number, or `null` if it is not usable. */
function positiveRate(value: unknown): number | null {
  const rate = typeof value === 'string' ? Number(value) : value;
  if (typeof rate !== 'number') return null;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Turns a provider response into a rate table keyed by supported code, or
 * `null` when the response cannot be trusted.
 *
 * The base is always present at 1, because it is the definition of the table
 * rather than a fetched fact. Every other code is optional, and a code that is
 * missing or nonsensical is simply absent — the conversion layer then reports
 * "no rate" for that pair instead of inventing one.
 *
 * A response that yields the base and nothing else is rejected outright
 * (`null`), which is what stops a provider error page, an empty object, or a
 * rate-limited stub from being cached as if it were a real table.
 */
export function parseRatesTable(payload: unknown, base: string = BASE_CURRENCY): RateTable | null {
  const detected = detectPayload(payload);
  if (!detected) return null;

  const rates: RateTable = { [base]: 1 };
  const put = (code: string, value: unknown): void => {
    const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!normalized || normalized === base) return;
    const rate = positiveRate(value);
    if (rate !== null) rates[normalized] = rate;
  };

  if (detected.kind === 'object') {
    for (const [code, value] of Object.entries(detected.rates)) put(code, value);
  } else if (detected.kind === 'list') {
    for (const row of detected.rows) {
      if (!row || typeof row !== 'object') continue;
      const entry = row as Record<string, unknown>;
      put(String(entry.quote ?? entry.currency ?? ''), entry.rate);
    }
  } else {
    for (const [code, value] of Object.entries(detected.map)) put(code, value);
  }

  return Object.keys(rates).length > 1 ? rates : null;
}

/**
 * Full snapshot from a provider response, or `null` when unusable.
 *
 * `source` is recorded in the snapshot so the UI can tell the user where the
 * numbers came from — useful when a fallback provider is in use and the user
 * wants to know it is not the primary feed.
 */
export function parseRatesSnapshot(
  payload: unknown,
  fetchedAt: number,
  source: string,
  base: string = BASE_CURRENCY,
): RatesSnapshot | null {
  const rates = parseRatesTable(payload, base);
  return rates ? { base, rates, fetchedAt, source } : null;
}

/** The subset of `Response` this module needs, so tests can substitute a stub. */
export interface FetchLikeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

/** The subset of `fetch` this module needs, so tests can substitute a stub. */
export type FetchLike = (
  url: string,
  init: { signal?: AbortSignal },
) => Promise<FetchLikeResponse>;

export interface FailoverOptions {
  /** Overrides the provider order. Defaults to `RATE_PROVIDERS`. */
  providers?: readonly RateProvider[];
  signal?: AbortSignal;
  /** Called once per failed attempt, for logging. */
  onAttemptFailed?: (providerId: string, reason: string) => void;
  /** Injected for deterministic tests. */
  now?: () => number;
}

/**
 * Walks the provider list and returns the first usable table.
 *
 * This is where the original failure is actually fixed. Depending on one host
 * meant a single host's availability decided whether the app could convert at
 * all; here a host that errors, 404s, 500s, times out, or answers in an
 * unrecognised shape is skipped and the next is tried.
 *
 * A CORS rejection is deliberately treated as just another failure. The browser
 * reports a blocked response to `fetch` as an opaque `TypeError` and will not say
 * why, so there is nothing to distinguish it from a network error and no useful
 * retry against the same host — which is the reason for having somewhere else to
 * go.
 *
 * Throws the last error when every provider fails, so the caller can report a
 * real cause rather than a bare "no rates". Nothing is cached on failure.
 */
export async function fetchRatesWithFailover(
  fetchImpl: FetchLike,
  base: string = BASE_CURRENCY,
  quotes: readonly string[] = QUOTED_CURRENCY_CODES,
  options: FailoverOptions = {},
): Promise<RatesSnapshot> {
  const providers = options.providers ?? RATE_PROVIDERS;
  const now = options.now ?? Date.now;
  const describe = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

  let lastError: unknown = new Error('no rate providers configured');
  for (const provider of providers) {
    try {
      const response = await fetchImpl(provider.url(base, quotes), { signal: options.signal });
      if (!response.ok) {
        throw new Error(`responded ${response.status}`);
      }
      const payload = await response.json();
      const parsed = parseRatesSnapshot(payload, now(), provider.id, base);
      if (!parsed) {
        throw new Error(`unrecognized response shape (${provider.id})`);
      }
      return parsed;
    } catch (error) {
      lastError = error;
      options.onAttemptFailed?.(provider.id, describe(error));
    }
  }
  throw lastError;
}
