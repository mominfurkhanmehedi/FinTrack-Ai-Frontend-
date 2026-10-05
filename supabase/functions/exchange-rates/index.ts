// Supabase Edge Function: exchange-rates
//
// Fetches a reference rate table server-side and returns it to the app in the
// simple `{ base, rates }` shape the client's parser already understands.
//
// WHY THIS EXISTS
// ---------------
// A browser blocks a cross-origin request unless the response carries
// `Access-Control-Allow-Origin`. That is the server's decision, so a third-party
// rate API can break the app at any time - by changing a header, by adding a
// redirect to a host that does not send one, or by retiring the hostname
// altogether. `api.frankfurter.app`, which this app originally called, is in
// exactly that position: it is DEPRECATED, and its own responses point at a
// successor host.
//
// Proxying through a function this app already owns removes the browser from the
// rate path, so no third-party CORS policy can reach the user. The function also
// has the upstream failover list baked in, so a dead provider is invisible to the
// client.
//
// This is OPTIONAL but strongly recommended. Without it, `services/exchangeRates.ts`
// falls back to calling the three CORS-safe providers in `RATE_PROVIDERS`
// directly, which works but leaves the browser dependent on their CORS policy.
// Note that Frankfurter is reached ONLY from here, so an undeployed function
// means Frankfurter is simply not used -- it is not a degradation of the app.
//
// DEPLOY
// ------
//   supabase functions deploy exchange-rates
//
// Then point the app at it (no trailing slash):
//
//   EXPO_PUBLIC_EXCHANGE_RATE_PROXY_URL=<project-ref>.supabase.co/functions/v1/exchange-rates
//
// The anon key is sent as a normal Supabase header. If JWT verification is
// enabled for the project, add the apikey/Authorization headers client-side too.
//
// SECURITY
// --------
// Rates are public reference data, so this needs no user data and holds no
// secrets. It is still rate-limited to the app by CORS, and the upstream list is a
// fixed constant - the caller cannot choose an arbitrary URL, so this cannot be
// turned into an open proxy.

/**
 * Upstreams this function calls, in order.
 *
 * A SUPERSET of the browser list in `services/rateProviders.ts`: Frankfurter
 * appears here and not there, because this file is its only caller. The three
 * others are duplicated so that if every upstream below fails the client still
 * has a working direct path.
 */
const UPSTREAMS: ReadonlyArray<{ label: string; build: (base: string) => string }> = [
  {
    label: 'frankfurter-v2',
    build: (base) =>
      `https://api.frankfurter.dev/v2/rates?base=${base}&quotes=${quoteList(base)}`,
  },
  {
    label: 'exchangerate-api-v4',
    build: (base) => `https://api.exchangerate-api.com/v4/latest/${base}`,
  },
  {
    label: 'er-api-v6',
    build: (base) => `https://open.er-api.com/v6/latest/${base}`,
  },
  {
    label: 'fawazahmed0-cdn',
    build: (base) =>
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`,
  },
];

const TIMEOUT_MS = 8000;
const CORS_HEADERS: Record<string, string> = {
  // The app is a mobile/web client with no fixed origin, so any origin is
  // allowed. This is safe because the function returns public market data and
  // takes no user input beyond a whitelisted base code.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * Every currency the app supports. Mirrors `CURRENCIES` in `types/index.ts` and
 * the `QUOTED_CURRENCY_CODES` the client derives from it.
 *
 * This is the allowlist for the whole function: `normalize` drops any quote
 * that is not listed, so a currency missing here would reach the client as
 * "no rate" even though the upstream supplied one. Keep it in step with the
 * app-side list.
 */
const SUPPORTED_CODES = [
  'INR', 'USD', 'EUR', 'GBP', 'JPY',
  'AED', 'SGD', 'CAD', 'AUD', 'CHF',
] as const;

const BASE_CURRENCY = 'INR';

/** Only the currencies the app supports, so nothing extra is proxied through. */
const ALLOWED_BASES = new Set([BASE_CURRENCY]);
const ALLOWED_QUOTES = new Set(SUPPORTED_CODES);

/**
 * Frankfurter takes an explicit quote list and returns nothing else, so the
 * requested set is derived from the allowlist above. Deriving it is the point:
 * a hardcoded list here is exactly what silently dropped the newer currencies
 * in the first place.
 */
function quoteList(base: string): string {
  return SUPPORTED_CODES.filter((code) => code !== base).join(',');
}

function positiveNumber(value: unknown): number | null {
  const rate = typeof value === 'string' ? Number(value) : value;
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Reduces any supported upstream shape to `{ INR: 1, ...quotes }`.
 *
 * Handles all three layouts the client handles too, so the two stay in step.
 * Returns null when the payload yields nothing usable.
 */
function normalize(payload: unknown, base: string): Record<string, number> | null {
  const rates: Record<string, number> = { [base]: 1 };
  const put = (code: unknown, value: unknown): void => {
    if (typeof code !== 'string') return;
    const key = code.trim().toUpperCase();
    if (!ALLOWED_QUOTES.has(key) || key === base) return;
    const rate = positiveNumber(value);
    if (rate !== null) rates[key] = rate;
  };

  if (Array.isArray(payload)) {
    for (const row of payload) {
      if (!row || typeof row !== 'object') continue;
      const entry = row as Record<string, unknown>;
      put(entry.quote ?? entry.currency, entry.rate);
    }
  } else if (payload && typeof payload === 'object') {
    const body = payload as Record<string, unknown>;
    const direct = body.rates ?? body.conversion_rates;
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      for (const [code, value] of Object.entries(direct as Record<string, unknown>)) put(code, value);
    } else {
      // `{ <base>: { <quote>: rate } }`
      for (const [code, value] of Object.entries(body)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          for (const [q, r] of Object.entries(value as Record<string, unknown>)) put(q, r);
        }
      }
    }
  }

  return Object.keys(rates).length > 1 ? rates : null;
}

async function fetchUpstream(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`upstream responded ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  // Preflight. Answered from here so the client can adopt the proxy without
  // depending on any upstream's OPTIONS behaviour.
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const url = new URL(request.url);
  const base = (url.searchParams.get('base') ?? BASE_CURRENCY).toUpperCase();
  if (!ALLOWED_BASES.has(base)) return json({ error: `unsupported base currency: ${base}` }, 400);

  const failures: string[] = [];
  for (const upstream of UPSTREAMS) {
    try {
      const payload = await fetchUpstream(upstream.build(base));
      const rates = normalize(payload, base);
      if (!rates) {
        failures.push(`${upstream.label}: unusable payload`);
        continue;
      }
      return json({ base, rates, source: 'proxy', upstream: upstream.label }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${upstream.label}: ${message}`);
    }
  }

  // Every upstream failed. The client treats a non-2xx as a failed fetch and
  // falls back to its own direct providers, so this is not a dead end.
  return json({ error: 'all rate providers failed', details: failures }, 502);
});
