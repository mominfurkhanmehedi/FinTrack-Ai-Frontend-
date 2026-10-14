import { getEnv } from '../config/env';

export interface ExchangeRateResponse {
  base: string;
  rates: Record<string, number>;
  source: string;
  upstream?: string;
  fetchedAt: number;
}

const SUPPORTED_CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'JPY', 'AED', 'SGD', 'CAD', 'AUD', 'CHF'] as const;
const BASE_CURRENCY = 'INR';

const UPSTREAMS = [
  {
    label: 'frankfurter-v2',
    build: (base: string) => `https://api.frankfurter.dev/v2/rates?base=${base}&quotes=${SUPPORTED_CURRENCIES.filter(c => c !== base).join(',')}`,
    parse: (data: unknown, base: string) => parseFrankfurterV2(data, base),
  },
  {
    label: 'exchangerate-api-v4',
    build: (base: string) => `https://api.exchangerate-api.com/v4/latest/${base}`,
    parse: (data: unknown, base: string) => parseObjectRates(data, base),
  },
  {
    label: 'er-api-v6',
    build: (base: string) => `https://open.er-api.com/v6/latest/${base}`,
    parse: (data: unknown, base: string) => parseObjectRates(data, base),
  },
  {
    label: 'fawazahmed0-cdn',
    build: (base: string) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`,
    parse: (data: unknown, base: string) => parseNestedRates(data, base),
  },
];

const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = getEnv().EXCHANGE_RATE_CACHE_TTL_MS;

// Cache rates per base currency to avoid cross-base contamination.
const cachedRatesByBase = new Map<string, ExchangeRateResponse>();
const cacheExpiryByBase = new Map<string, number>();

function parseFrankfurterV2(data: unknown, base: string): Record<string, number> | null {
  if (!Array.isArray(data)) return null;
  const rates: Record<string, number> = { [base]: 1 };
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const entry = row as Record<string, unknown>;
    const quote = String(entry.quote ?? entry.currency ?? '').toUpperCase();
    const rate = Number(entry.rate);
    if (quote && quote !== base && SUPPORTED_CURRENCIES.includes(quote as typeof SUPPORTED_CURRENCIES[number]) && Number.isFinite(rate) && rate > 0) {
      rates[quote] = rate;
    }
  }
  return Object.keys(rates).length > 1 ? rates : null;
}

function parseObjectRates(data: unknown, base: string): Record<string, number> | null {
  if (!data || typeof data !== 'object') return null;
  const body = data as Record<string, unknown>;
  const direct = body.rates ?? body.conversion_rates;
  if (!direct || typeof direct !== 'object' || Array.isArray(direct)) return null;
  const rates: Record<string, number> = { [base]: 1 };
  for (const [code, value] of Object.entries(direct as Record<string, unknown>)) {
    const key = code.trim().toUpperCase();
    const rate = Number(value);
    if (key && key !== base && SUPPORTED_CURRENCIES.includes(key as typeof SUPPORTED_CURRENCIES[number]) && Number.isFinite(rate) && rate > 0) {
      rates[key] = rate;
    }
  }
  return Object.keys(rates).length > 1 ? rates : null;
}

function parseNestedRates(data: unknown, base: string): Record<string, number> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const body = data as Record<string, unknown>;
  const nested = body[base.toLowerCase()];
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return null;
  const rates: Record<string, number> = { [base]: 1 };
  for (const [code, value] of Object.entries(nested as Record<string, unknown>)) {
    const key = code.trim().toUpperCase();
    const rate = Number(value);
    if (key && key !== base && SUPPORTED_CURRENCIES.includes(key as typeof SUPPORTED_CURRENCIES[number]) && Number.isFinite(rate) && rate > 0) {
      rates[key] = rate;
    }
  }
  return Object.keys(rates).length > 1 ? rates : null;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchUpstream(upstream: typeof UPSTREAMS[0], base: string): Promise<Record<string, number> | null> {
  const url = upstream.build(base);
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`upstream responded ${response.status}`);
  const data = await response.json();
  return upstream.parse(data, base);
}

export async function getExchangeRates(base: string = BASE_CURRENCY, forceRefresh = false): Promise<ExchangeRateResponse> {
  const now = Date.now();

  const cached = cachedRatesByBase.get(base);
  const expiry = cacheExpiryByBase.get(base) ?? 0;

  if (!forceRefresh && cached && now < expiry) {
    return cached;
  }

  const errors: string[] = [];

  for (const upstream of UPSTREAMS) {
    try {
      const rates = await fetchUpstream(upstream, base);
      if (rates) {
        const result: ExchangeRateResponse = {
          base,
          rates,
          source: 'backend',
          upstream: upstream.label,
          fetchedAt: now,
        };
        cachedRatesByBase.set(base, result);
        cacheExpiryByBase.set(base, now + CACHE_TTL_MS);
        return result;
      }
      errors.push(`${upstream.label}: unusable payload`);
    } catch (error) {
      errors.push(`${upstream.label}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Return stale cache for this base if available, even if expired.
  if (cached) {
    return { ...cached, source: 'backend (stale)' };
  }

  throw new Error(`All exchange rate providers failed: ${errors.join('; ')}`);
}

export function getSupportedCurrencies(): readonly string[] {
  return SUPPORTED_CURRENCIES;
}

export function getBaseCurrency(): string {
  return BASE_CURRENCY;
}

export function clearCache(): void {
  cachedRatesByBase.clear();
  cacheExpiryByBase.clear();
}

export function getCacheStatus(): { hasCache: boolean; expiresAt: number | null; isExpired: boolean; byBase: Record<string, { hasCache: boolean; expiresAt: number | null; isExpired: boolean }> } {
  const now = Date.now();
  const primaryBase = BASE_CURRENCY;
  const cached = cachedRatesByBase.get(primaryBase);
  const expiry = cacheExpiryByBase.get(primaryBase) ?? 0;

  const byBase: Record<string, { hasCache: boolean; expiresAt: number | null; isExpired: boolean }> = {};
  for (const [base, cachedResponse] of cachedRatesByBase.entries()) {
    const baseExpiry = cacheExpiryByBase.get(base) ?? 0;
    byBase[base] = {
      hasCache: cachedResponse !== undefined,
      expiresAt: baseExpiry || null,
      isExpired: baseExpiry > 0 && now >= baseExpiry,
    };
  }

  return {
    hasCache: cached !== undefined,
    expiresAt: expiry || null,
    isExpired: expiry > 0 && now >= expiry,
    byBase,
  };
}
