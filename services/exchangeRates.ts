import {
  BASE_CURRENCY,
  RateTable,
  RatesSnapshot,
} from '../utils/currency';
import {
  parseRatesSnapshot,
  fetchRatesWithFailover,
  QUOTED_CURRENCY_CODES,
} from './rateProviders';
import { storage } from './storage';

/**
 * EXCHANGE RATES
 *
 * One rate table for the whole app, fetched once and shared by every screen.
 * The split in this file is deliberate:
 *
 *   - `utils/currency.ts` owns the pure maths and formatting (unit-tested).
 *   - `services/rateProviders.ts` owns the provider list, the response shapes and
 *     the failover walk (also pure, so all unit-tested).
 *   - this module owns the impure half: HTTP, caching, freshness and status.
 *
 * Why a single shared table
 * -------------------------
 * Conversion is a fixed linear factor per currency, so one table describes
 * every amount in the app. Fetching per-transaction would mean an unbounded
 * number of requests, would produce slightly different numbers for different
 * rows, and would make offline behaviour unpredictable. Instead there is exactly
 * one table, one in-flight request, and one cache.
 *
 * Why several rate sources
 * ------------------------
 * This used to depend on one host, `api.frankfurter.app`, and a single blocked
 * request there stopped currency conversion for everyone. That host is DEPRECATED
 * — its own responses point at a successor — so depending on it was always going
 * to break. Rates are now fetched through a list of independent providers
 * (`./rateProviders`) and the first one that answers with a usable table wins, so
 * no single host is a single point of failure. Where available, an optional
 * same-origin proxy (`EXPO_PUBLIC_EXCHANGE_RATE_PROXY_URL`) is preferred, which
 * removes the browser from the rate path entirely.
 *
 * Freshness and offline behaviour
 * -------------------------------
 * A successful fetch is cached in memory AND persisted to storage, so a restart
 * — or a cold start with no connectivity — can still convert. When a refresh
 * fails we keep serving the last good table and report `stale` so the UI can say
 * so. When no table has ever been obtained we report `unavailable` and a
 * currency change is refused outright rather than guessing a rate, because a
 * change here rewrites every stored amount.
 */

/** Storage key for the last successfully fetched rate table. */
const STORAGE_KEY = 'fintrack-exchange-rates-v1';

/** How long a fetched table is considered current. */
export const RATES_TTL_MS = 6 * 60 * 60 * 1000;

/** Abort a rate request that has hung, so the app never waits indefinitely. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Optional same-origin proxy, used when configured.
 *
 * A proxy removes the browser from the rate path entirely: the client asks a
 * backend this app already talks to (Supabase, via an Edge Function), and that
 * function fetches the rates server-side. It is the only configuration that
 * cannot be defeated by a CORS policy or a content blocker in the user's
 * browser, so it is preferred whenever it is set up.
 *
 * Not set by default, because deploying an Edge Function needs project access
 * the app cannot assume. When it is absent the direct providers below are used,
 * which requires no infrastructure at all.
 *
 * The response is expected in the same `{ base, rates }` shape the public feeds
 * use, which is what the bundled Edge Function returns.
 */
function getProxyUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_EXCHANGE_RATE_PROXY_URL;
  return typeof url === 'string' && url.trim() !== '' ? url.trim() : null;
}

/** Everything the UI needs to know about rate availability. */
export type RatesStatus =
  /** Never requested yet in this process. */
  | 'idle'
  /** First fetch in flight and nothing cached to show meanwhile. */
  | 'loading'
  /** A table is in use and is younger than the TTL. */
  | 'ready'
  /** Showing the last good table, but a refresh failed or the table is old. */
  | 'stale'
  /** No table has ever been obtained; amounts cannot be converted. */
  | 'unavailable';

interface PersistedRates {
  base: string;
  rates: RateTable;
  fetchedAt: number;
  source: string;
}

let snapshot: RatesSnapshot | null = null;
let status: RatesStatus = 'idle';
let inFlight: Promise<RatesSnapshot | null> | null = null;
let storageHydrated = false;
let storageHydration: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Notifies subscribers; cheap enough to call on every state transition. */
function emit(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn('[exchangeRates] listener failed:', error);
    }
  });
}

function setStatus(next: RatesStatus): void {
  if (status === next) return;
  status = next;
  emit();
}

/** Subscribe to rate changes. Returns an unsubscribe function. */
export function subscribeExchangeRates(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The rate table currently in use, or `null` if none was ever obtained. */
export function getExchangeRates(): RatesSnapshot | null {
  return snapshot;
}

/** Just the rate table, in the shape the pure conversion helpers take. */
export function getRateTable(): RateTable | null {
  return snapshot?.rates ?? null;
}

export function getRatesStatus(): RatesStatus {
  return status;
}

/** True when the in-use table is older than the TTL. */
function isExpired(current: RatesSnapshot): boolean {
  return Date.now() - current.fetchedAt > RATES_TTL_MS;
}

/**
 * Accepts a provider payload and keeps only the currencies the app supports,
 * with positive finite rates.
 *
 * The layout detection and the per-provider quirks live in `./rateProviders`,
 * which is pure and unit-tested. This stays as a thin re-export so existing
 * callers and tests keep working.
 *
 * Two response shapes are supported so the endpoint stays swappable:
 *   - `{ base, rates: { USD: 0.01, ... } }`      (Frankfurter, ExchangeRate-API)
 *   - `{ base_code, conversion_rates: { ... } }` (open.er-api.com)
 */
export function parseRatesPayload(
  payload: unknown,
  fetchedAt: number,
  source: string,
): RatesSnapshot | null {
  return parseRatesSnapshot(payload, fetchedAt, source);
}

/** Reads a persisted table from storage exactly once per process. */
function hydrateFromStorage(): Promise<void> {
  if (storageHydrated) return Promise.resolve();
  if (storageHydration) return storageHydration;

  storageHydration = (async () => {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      storageHydrated = true;
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedRates;
      if (parsed?.base !== BASE_CURRENCY || !parsed.rates) return;
      const restored = parseRatesPayload(
        { base: parsed.base, rates: parsed.rates },
        parsed.fetchedAt,
        parsed.source ?? 'cache',
      );
      if (!restored) return;
      // Only adopt the cached table if nothing fresher is already in memory.
      if (snapshot && snapshot.fetchedAt >= restored.fetchedAt) return;
      snapshot = restored;
      setStatus(isExpired(restored) ? 'stale' : 'ready');
    } catch (error) {
      storageHydrated = true;
      console.warn('[exchangeRates] could not read cached rates:', error);
    }
  })();

  return storageHydration;
}

/**
 * Adopts the persisted table without touching the network.
 *
 * Used at store creation so a currency change is possible immediately from the
 * first tap, instead of waiting on a network round trip. Deliberately does no
 * fetching, so importing the store during a server render stays a pure storage
 * read.
 */
export function hydrateCachedExchangeRates(): Promise<void> {
  return hydrateFromStorage();
}

function persistSnapshot(next: RatesSnapshot): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error: unknown) => {
    console.warn('[exchangeRates] could not cache rates:', error);
  });
}

/** Reads one URL and parses it, throwing on any HTTP, network or shape error. */
async function fetchSnapshot(url: string, source: string): Promise<RatesSnapshot> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // No custom headers: a bare GET never triggers a CORS preflight, which keeps
    // the request to a single round trip and avoids depending on the provider
    // answering OPTIONS correctly.
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`responded ${response.status}`);
    }
    const payload = await response.json();
    const parsed = parseRatesSnapshot(payload, Date.now(), source);
    if (!parsed) {
      throw new Error('returned no usable rates');
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches a rate table from the proxy, or from the provider list in order.
 *
 * A provider that is down, rate-limited, blocked, or CORS-denied is skipped and
 * the next one is tried, so no single host is a single point of failure. The
 * first usable table wins. If every source fails the last error is rethrown so
 * the caller can log something specific instead of a bare "network error".
 */
async function requestRates(): Promise<RatesSnapshot> {
  const proxyUrl = getProxyUrl();
  if (proxyUrl) {
    const url = `${proxyUrl}${proxyUrl.includes('?') ? '&' : '?'}base=${encodeURIComponent(
      BASE_CURRENCY,
    )}`;
    try {
      return await fetchSnapshot(url, 'proxy');
    } catch (error) {
      // A misconfigured or down proxy must not be a dead end: the direct
      // providers are still tried, so the feature keeps working.
      console.warn(
        '[exchangeRates] proxy failed, falling back to direct providers:',
        describeError(error),
      );
    }
  }

  return fetchRatesWithFailover(fetch, BASE_CURRENCY, QUOTED_CURRENCY_CODES, {
    onAttemptFailed: (id, reason) => {
      console.warn(`[exchangeRates] ${id} failed (${reason}), trying the next provider`);
    },
  });
}

/** A short, safe description of a fetch failure for logging. */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}


/**
 * Makes sure a rate table is available, fetching only when it is genuinely
 * needed. Concurrent callers (several screens mounting at once, React Strict
 * Mode's double effects) share a single in-flight request, so mounting the
 * whole app still costs at most one HTTP call.
 */
export function ensureExchangeRates(
  options: { force?: boolean } = {},
): Promise<RatesSnapshot | null> {
  if (inFlight) return inFlight;

  const run = (async (): Promise<RatesSnapshot | null> => {
    await hydrateFromStorage();

    if (snapshot && !isExpired(snapshot) && !options.force) return snapshot;

    setStatus(snapshot ? 'stale' : 'loading');

    try {
      const fetched = await requestRates();
      if (!fetched) {
        // Defensive: `requestRates` throws rather than returning null.
        setStatus(snapshot ? 'stale' : 'unavailable');
        return snapshot;
      }
      snapshot = fetched;
      persistSnapshot(fetched);
      setStatus('ready');
      return fetched;
    } catch (error) {
      const message = (error as { message?: string })?.message ?? String(error);
      // An abort here is our own timeout, not a server problem, but either way
      // the remedy is identical: keep whatever we already had.
      console.warn('[exchangeRates] refresh failed:', message);
      setStatus(snapshot ? 'stale' : 'unavailable');
      return snapshot;
    }
  })();

  inFlight = run.finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Test seam: drops every cached value so a new run starts cold. Does not touch
 * persisted storage — call it after seeding the storage mock.
 */
export function resetExchangeRatesCache(): void {
  snapshot = null;
  status = 'idle';
  inFlight = null;
  storageHydrated = false;
  storageHydration = null;
  emit();
}
