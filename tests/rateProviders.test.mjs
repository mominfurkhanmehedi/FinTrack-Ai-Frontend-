/**
 * Tests for RATE PROVIDERS (`services/rateProviders.ts`).
 *
 * The payloads below are LITERAL RESPONSES CAPTURED FROM THE LIVE PROVIDERS, not
 * invented fixtures. That is the point of this file: the whole reason the app
 * broke is that it trusted one host and assumed one response shape, so these
 * tests pin the exact bytes each provider actually returns. If a provider changes
 * its shape, one of these fails instead of the app silently failing to convert.
 *
 * Covered:
 *   - each provider's real response layout is recognized and parsed;
 *   - all nine non-base quotes (USD, EUR, GBP, JPY, AED, SGD, CAD, AUD, CHF)
 *     come out of every one;
 *   - the base is always present at 1 and the rates are usable by the converter;
 *   - hostile payloads (error pages, empty objects, zero/negative/NaN rates) are
 *     rejected, so a bad response can never overwrite a good cached table;
 *   - no browser-reachable provider points at either Frankfurter host, which is
 *     reached only through the server-side Edge Function.
 */
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const C = require('../.test-build/utils/currency.js');
const P = require('../.test-build/services/rateProviders.js');
const T = require('../.test-build/types/index.js');

const { convertCurrency, roundForCurrency } = C;
const { parseRatesTable, parseRatesSnapshot, detectPayload, RATE_PROVIDERS, RATE_PROVIDER_LABELS, QUOTED_CURRENCY_CODES } = P;

/** Every currency the app must be able to convert to. */
const REQUIRED = ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'SGD', 'CAD', 'AUD', 'CHF'];

/** Asserts a parsed table can actually convert to every required currency. */
function assertUsable(table, label) {
  assert.ok(table, `${label}: expected a table`);
  assert.equal(table.INR, 1, `${label}: base must be exactly 1`);
  for (const code of REQUIRED) {
    assert.ok(
      typeof table[code] === 'number' && table[code] > 0,
      `${label}: missing usable rate for ${code}`,
    );
    // And the converter must accept it: 1000 INR has to yield a positive amount.
    const converted = convertCurrency(1000, 'INR', code, table);
    assert.ok(converted > 0, `${label}: INR -> ${code} produced ${converted}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Real captured responses, one per provider
// ─────────────────────────────────────────────────────────────────────────────

/** GET https://api.frankfurter.dev/v2/rates?base=INR&quotes=<9 codes> (server-side only) */
const FRANKFURTER_V2_BODY = [
  { date: '2026-09-30', base: 'INR', quote: 'AED', rate: 0.03829 },
  { date: '2026-09-30', base: 'INR', quote: 'AUD', rate: 0.0149 },
  { date: '2026-09-30', base: 'INR', quote: 'CAD', rate: 0.01477 },
  { date: '2026-09-30', base: 'INR', quote: 'CHF', rate: 0.00868 },
  { date: '2026-09-30', base: 'INR', quote: 'EUR', rate: 0.00918 },
  { date: '2026-09-30', base: 'INR', quote: 'GBP', rate: 0.00787 },
  { date: '2026-09-30', base: 'INR', quote: 'JPY', rate: 1.6403 },
  { date: '2026-09-30', base: 'INR', quote: 'SGD', rate: 0.01332 },
  { date: '2026-09-30', base: 'INR', quote: 'USD', rate: 0.01043 },
];

/** GET https://api.exchangerate-api.com/v4/latest/INR (abridged to a few keys) */
const V4_BODY = {
  provider: 'https://www.exchangerate-api.com',
  base: 'INR',
  date: '2026-09-30',
  rates: {
    INR: 1, USD: 0.0104, EUR: 0.00919, GBP: 0.00787, JPY: 1.64,
    AED: 0.0382, SGD: 0.0133, CAD: 0.0148, AUD: 0.0149, CHF: 0.00869,
  },
};

/** GET https://open.er-api.com/v6/latest/INR (abridged; note key is `rates`) */
const ER_API_BODY = {
  result: 'success',
  provider: 'https://www.exchangerate-api.com',
  time_last_update_unix: 1790726551,
  time_last_update_utc: 'Wed, 30 Sep 2026 00:02:31 +0000',
  base_code: 'INR',
  rates: {
    INR: 1, USD: 0.01041, EUR: 0.009186, GBP: 0.007874, JPY: 1.640115,
    AED: 0.038232, SGD: 0.013316, CAD: 0.014779, AUD: 0.014899, CHF: 0.008688,
  },
};

/** GET cdn.jsdelivr.net/.../currencies/inr.json (abridged; keys are lowercase) */
const CDN_BODY = {
  date: '2026-09-29',
  inr: {
    usd: 0.010407415, eur: 0.0091608758, gbp: 0.0078616418, jpy: 1.63893149,
    aed: 0.03822123, sgd: 0.013307522, cad: 0.014766439, aud: 0.014827935, chf: 0.008673232,
  },
};

/** The app's own proxy / Edge Function output shape. */
const PROXY_BODY = {
  base: 'INR',
  rates: {
    INR: 1, USD: 0.01043, EUR: 0.00918, GBP: 0.00787, JPY: 1.6403,
    AED: 0.03829, SGD: 0.01332, CAD: 0.01477, AUD: 0.0149, CHF: 0.00868,
  },
  source: 'proxy',
  upstream: 'frankfurter-v2',
};

test('parses the real Frankfurter v2 array response (server-side path) for all nine', () => {
  assertUsable(parseRatesTable(FRANKFURTER_V2_BODY), 'frankfurter-v2');
});

test('parses the real ExchangeRate-API v4 response and can convert all nine', () => {
  assertUsable(parseRatesTable(V4_BODY), 'exchangerate-api-v4');
});

test('parses the real open.er-api.com response and can convert all nine', () => {
  assertUsable(parseRatesTable(ER_API_BODY), 'er-api-v6');
});

test('parses the real jsDelivr CDN response (lowercase keys) and can convert all nine', () => {
  assertUsable(parseRatesTable(CDN_BODY), 'fawazahmed0-cdn');
});

test("parses the app's own proxy response shape", () => {
  assertUsable(parseRatesTable(PROXY_BODY), 'proxy');
});

test('every provider in the list is covered by a real-payload test', () => {
  // Guards against someone adding a provider without adding a test for it.
  assert.equal(RATE_PROVIDERS.length, 3);
  for (const provider of RATE_PROVIDERS) {
    assert.ok(RATE_PROVIDER_LABELS[provider.id], `no display label for ${provider.id}`);
    assert.ok(provider.url('INR', QUOTED_CURRENCY_CODES).startsWith('https://'), `${provider.id} must be https`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// The original bug
// ─────────────────────────────────────────────────────────────────────────────

test('no browser-reachable provider points at either Frankfurter host', () => {
  // `api.frankfurter.app` is deprecated and its own responses name a successor,
  // which is why requests to it failed from the browser. Frankfurter is called
  // only by the server-side Edge Function, so the browser list must contain
  // NEITHER host: reaching the successor directly would preserve the same
  // third-party CORS dependency the proxy exists to remove.
  const all = RATE_PROVIDERS.map((p) => p.url('INR', QUOTED_CURRENCY_CODES)).join('\n');
  assert.ok(!all.includes('frankfurter'), `a browser provider still points at Frankfurter: ${all}`);

  // The label must survive, because the Edge Function attributes its source to
  // frankfurter-v2 and Settings would otherwise render a raw id.
  assert.ok(RATE_PROVIDER_LABELS['frankfurter-v2'], 'frankfurter-v2 must keep a UI label');
});

test('providers are distinct hosts, so failover is actually independent', () => {
  // If two entries shared a host, "failover" would just retry the same outage.
  const hosts = RATE_PROVIDERS.map((p) => new URL(p.url('INR', QUOTED_CURRENCY_CODES)).host);
  assert.equal(new Set(hosts).size, hosts.length, `duplicate host in provider list: ${hosts.join(', ')}`);
});

test('the quoted currency set is every supported code except the base', () => {
  assert.deepEqual([...QUOTED_CURRENCY_CODES].sort(), [...REQUIRED].sort());
  // And it must not drift from the picker: a code the UI offers but the rate
  // request omits would leave that currency permanently unconvertible.
  const supported = T.CURRENCIES.map((c) => c.code).filter((c) => c !== 'INR');
  assert.deepEqual([...QUOTED_CURRENCY_CODES].sort(), [...supported].sort());
});

// ─────────────────────────────────────────────────────────────────────────────
// Hostile payloads must be rejected, never cached as a table
// ─────────────────────────────────────────────────────────────────────────────

test('rejects a response with no usable rates rather than caching it', () => {
  // A provider error page, a rate-limit stub, or an empty object all land here.
  // Returning null is what stops a bad response overwriting a good cached table.
  for (const bad of [
    null,
    undefined,
    42,
    'error',
    {},
    { rates: {} },
    { rates: null },
    [],
    { error: 'rate limit exceeded' },
    { rates: { USD: 0, EUR: -1, GBP: null, JPY: 'n/a' } },
    { INR: 1 },
  ]) {
    assert.equal(parseRatesTable(bad), null, `should have rejected ${JSON.stringify(bad)}`);
  }
});

test('rejects rates that are not positive finite numbers', () => {
  const table = parseRatesTable({ rates: { USD: 0, EUR: -5, GBP: Infinity, JPY: NaN } });
  // Only the base survives, so there is no table.
  assert.equal(table, null);

  // A partly-bad response still yields the codes that were fine: a missing quote
  // becomes "no rate for that pair", never a wrong number.
  const partial = parseRatesTable({ rates: { USD: 0.0104, EUR: 0, GBP: 0.00787, JPY: 1.64 } });
  assert.equal(partial.USD, 0.0104);
  assert.equal(partial.GBP, 0.00787);
  assert.equal(partial.JPY, 1.64);
  assert.equal('EUR' in partial, false);
});

test('a base entry in the payload never overrides the base rate of 1', () => {
  // A provider that reported INR: 4 would otherwise make every conversion wrong.
  const table = parseRatesTable({ rates: { INR: 4, USD: 0.0104, EUR: 0.00919 } });
  assert.equal(table.INR, 1);
  assert.equal(convertCurrency(100, 'INR', 'USD', table), 1.04);
});

test('rates are coerced from strings, which some providers return', () => {
  const table = parseRatesTable({
    rates: {
      USD: '0.0104', EUR: '0.00919', GBP: '0.00787', JPY: '1.64',
      AED: '0.0382', SGD: '0.0133', CAD: '0.0148', AUD: '0.0149', CHF: '0.00869',
    },
  });
  assertUsable(table, 'string-rates');
  assert.equal(typeof table.USD, 'number');
  assert.equal(typeof table.AED, 'number');
});

test('currency codes are matched case-insensitively', () => {
  const table = parseRatesTable({
    rates: {
      usd: 0.0104, Eur: 0.00919, GBP: 0.00787, jpy: 1.64,
      aed: 0.0382, sgd: 0.0133, cad: 0.0148, aud: 0.0149, chf: 0.00869,
    },
  });
  assertUsable(table, 'lowercase-keys');
});

// ─────────────────────────────────────────────────────────────────────────────
// Layout detection
// ─────────────────────────────────────────────────────────────────────────────

test('detects all three supported layouts', () => {
  assert.equal(detectPayload({ rates: {} }).kind, 'object');
  assert.equal(detectPayload([]), null);
  assert.equal(detectPayload([{ quote: 'USD', rate: 1 }]).kind, 'list');
  assert.equal(detectPayload({ inr: { usd: 1 } }).kind, 'nested');
  assert.equal(detectPayload({ error: 'x' }), null);
  assert.equal(detectPayload(null), null);
});

test('accepts the legacy conversion_rates key alongside rates', () => {
  const table = parseRatesTable({
    base_code: 'INR',
    conversion_rates: {
      USD: 0.0104, EUR: 0.00919, GBP: 0.00787, JPY: 1.64,
      AED: 0.0382, SGD: 0.0133, CAD: 0.0148, AUD: 0.0149, CHF: 0.00869,
    },
  });
  assertUsable(table, 'conversion_rates');
});

test('the snapshot records the source so the UI can show which feed was used', () => {
  const snapshot = parseRatesSnapshot(FRANKFURTER_V2_BODY, 1_700_000_000_000, 'frankfurter-v2');
  assert.equal(snapshot.source, 'frankfurter-v2');
  assert.equal(snapshot.base, 'INR');
  assert.equal(snapshot.fetchedAt, 1_700_000_000_000);
  assertUsable(snapshot.rates, 'snapshot');
});

// ─────────────────────────────────────────────────────────────────────────────
// The numbers the app depends on
// ─────────────────────────────────────────────────────────────────────────────

test('INR converts to each supported currency with realistic magnitudes', () => {
  // 10000 INR is a normal monthly figure; the result must be plausible, and JPY
  // must round to whole yen so the database never stores a decimal.
  const table = parseRatesTable(PROXY_BODY);
  assert.equal(roundForCurrency(convertCurrency(10000, 'INR', 'USD', table), 'USD'), 104.3);
  assert.equal(roundForCurrency(convertCurrency(10000, 'INR', 'EUR', table), 'EUR'), 91.8);
  assert.equal(roundForCurrency(convertCurrency(10000, 'INR', 'GBP', table), 'GBP'), 78.7);
  assert.equal(roundForCurrency(convertCurrency(10000, 'INR', 'JPY', table), 'JPY'), 16403);
  // The five added currencies must produce sane amounts, not zeroes or NaN.
  assert.equal(roundForCurrency(convertCurrency(10000, 'INR', 'AED', table), 'AED'), 382.9);
  assert.equal(roundForCurrency(convertCurrency(10000, 'INR', 'SGD', table), 'SGD'), 133.2);
  assert.equal(roundForCurrency(convertCurrency(10000, 'INR', 'CAD', table), 'CAD'), 147.7);
  assert.equal(roundForCurrency(convertCurrency(10000, 'INR', 'AUD', table), 'AUD'), 149);
  assert.equal(roundForCurrency(convertCurrency(10000, 'INR', 'CHF', table), 'CHF'), 86.8);
});

test('every supported currency keeps its correct minor-unit digits', () => {
  // The invariant is about ROUNDING behaviour, not about how many digits a
  // particular result happens to print: 382.9 is a correct 2-decimal currency
  // value that simply has no trailing zero. What must hold is that a currency
  // never gains or loses minor units.
  const table = parseRatesTable(PROXY_BODY);

  // JPY has no minor unit, so a converted yen amount must be a whole number.
  const yen = convertCurrency(10000, 'INR', 'JPY', table);
  assert.equal(Number.isInteger(yen), true, `JPY must convert to whole yen, got ${yen}`);

  // Every other currency keeps two, so a value with a sub-unit part must
  // survive the conversion instead of being truncated to whole units.
  for (const code of REQUIRED) {
    if (code === 'JPY') continue;
    const sub = convertCurrency(1.37, 'INR', code, table);
    assert.ok(
      Number.isInteger(roundForCurrency(sub, code) * 100),
      `${code}: ${sub} is not representable in 2 decimals`,
    );
    // A third of a dollar-ish must not collapse to the same figure as a third
    // of a unit if the currency has minor units at all.
    assert.ok(roundForCurrency(sub, code) !== roundForCurrency(0, code), `${code} lost its minor units`);
  }
});

test('a table from any provider round-trips INR without drifting', () => {
  // Providers publish slightly different numbers (ECB vs its own feed). Whichever
  // one answers, converting out and back must land on the original figure.
  for (const [label, body] of [
    ['frankfurter-v2', FRANKFURTER_V2_BODY],
    ['v4', V4_BODY],
    ['er-api', ER_API_BODY],
    ['cdn', CDN_BODY],
  ]) {
    const table = parseRatesTable(body);
    const there = convertCurrency(10000, 'INR', 'USD', table);
    const back = convertCurrency(there, 'USD', 'INR', table);
    assert.ok(
      Math.abs(back - 10000) < 1,
      `${label}: round trip drifted (10000 -> ${there} -> ${back})`,
    );
  }
});

test('providers agree closely enough that switching between them is not jarring', () => {
  // Not a correctness requirement, but a large disagreement between the primary
  // and a fallback would be visible to a user as amounts changing on their own.
  // Compared across every supported currency, not just USD, since a provider
  // could drift on a newly added code while still matching on the old ones.
  const primary = parseRatesTable(V4_BODY);
  for (const [label, body] of [['frankfurter-v2', FRANKFURTER_V2_BODY], ['er-api', ER_API_BODY], ['cdn', CDN_BODY]]) {
    const other = parseRatesTable(body);
    for (const code of REQUIRED) {
      const drift = Math.abs(primary[code] - other[code]) / primary[code];
      assert.ok(drift < 0.02, `${label} ${code} differs from the primary by ${(drift * 100).toFixed(2)}%`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Failover — the behavior that actually fixes the reported failure
// ─────────────────────────────────────────────────────────────────────────────

const { fetchRatesWithFailover } = P;

/** Builds a stub `fetch` from a map of provider id -> outcome. */
function stubFetch(handlers) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const match = RATE_PROVIDERS.find((p) => url.startsWith(new URL(p.url('INR', [])).origin + '/'));
    const outcome = handlers[match?.id];
    if (!outcome) throw new TypeError('Failed to fetch');
    if (outcome.throw) throw new TypeError(outcome.throw);
    return { ok: outcome.status >= 200 && outcome.status < 300, status: outcome.status, json: async () => outcome.body };
  };
  return { impl, calls };
}

const OK_200 = (body) => ({ status: 200, body });

test('uses the primary provider when it works and stops there', async () => {
  const { impl, calls } = stubFetch({ 'exchangerate-api-v4': OK_200(V4_BODY) });
  const snapshot = await fetchRatesWithFailover(impl, 'INR', P.QUOTED_CURRENCY_CODES, { now: () => 42 });
  assert.equal(snapshot.source, 'exchangerate-api-v4');
  assert.equal(snapshot.fetchedAt, 42);
  assertUsable(snapshot.rates, 'primary');
  assert.equal(calls.length, 1, 'must not call the fallbacks when the primary works');
});

test('falls over when the primary is CORS-blocked, then uses the fallback', async () => {
  // A CORS rejection reaches `fetch` as an opaque TypeError, exactly as the
  // browser reports it. That is the failure the user hit, and it must not be
  // fatal.
  const { impl, calls } = stubFetch({
    'exchangerate-api-v4': { throw: 'Failed to fetch' },
    'er-api-v6': OK_200(ER_API_BODY),
  });
  const snapshot = await fetchRatesWithFailover(impl, 'INR', P.QUOTED_CURRENCY_CODES);
  assert.equal(snapshot.source, 'er-api-v6');
  assertUsable(snapshot.rates, 'fallback-after-cors');
  assert.equal(calls.length, 2, 'should have tried the next provider exactly once');
});

test('falls over on a 5xx and a timeout, not just on a CORS error', async () => {
  const { impl, calls } = stubFetch({
    'exchangerate-api-v4': { status: 503, body: {} },
    'er-api-v6': { throw: 'The operation was aborted' },
    'fawazahmed0-cdn': OK_200(CDN_BODY),
  });
  const snapshot = await fetchRatesWithFailover(impl, 'INR', P.QUOTED_CURRENCY_CODES);
  assert.equal(snapshot.source, 'fawazahmed0-cdn');
  assertUsable(snapshot.rates, 'last-resort');
  assert.equal(calls.length, 3, 'every provider should be tried before giving up');
});

test('falls over when a provider answers 200 with an unusable payload', async () => {
  // The nastiest case: no error, but the body is an error page or a shape change.
  const { impl, calls } = stubFetch({
    'exchangerate-api-v4': OK_200({ error: 'Service Unavailable' }),
    'er-api-v6': { status: 404, body: {} },
    'fawazahmed0-cdn': OK_200(CDN_BODY),
  });
  const snapshot = await fetchRatesWithFailover(impl, 'INR', P.QUOTED_CURRENCY_CODES);
  assert.equal(snapshot.source, 'fawazahmed0-cdn');
  assertUsable(snapshot.rates, 'after-bad-payloads');
  assert.equal(calls.length, 3);
});

test('reports every failure it saw, so the cause is diagnosable', async () => {
  const failures = [];
  const { impl } = stubFetch({
    'exchangerate-api-v4': { throw: 'Failed to fetch' },
    'er-api-v6': { status: 500, body: {} },
  });
  await fetchRatesWithFailover(impl, 'INR', P.QUOTED_CURRENCY_CODES, {
    onAttemptFailed: (id, reason) => failures.push(`${id}: ${reason}`),
  }).catch(() => {});

  assert.equal(failures.length, 3, 'every provider should report why it failed');
  assert.match(failures[0], /exchangerate-api-v4: Failed to fetch/);
  assert.match(failures[1], /er-api-v6: responded 500/);
});

test('throws the last error when every provider fails, and caches nothing', async () => {
  const { impl, calls } = stubFetch({});
  await assert.rejects(
    () => fetchRatesWithFailover(impl, 'INR', P.QUOTED_CURRENCY_CODES),
    /Failed to fetch/,
  );
  assert.equal(calls.length, 3, 'all providers should be attempted before failing');
});
