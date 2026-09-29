import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CLOCK_SKEW_TOLERANCE_MS,
  inspectToken,
  isAuthError,
  isNetworkError,
  readTokenClaims,
  secondsUntilExpiry,
} from '../.test-build/services/tokenClaims.js';

/** Fixed "now" so every assertion is deterministic: 2026-09-29T08:00:00Z. */
const NOW_MS = Date.parse('2026-09-29T08:00:00.000Z');
const NOW_SEC = Math.floor(NOW_MS / 1000);

/**
 * Builds an unsigned JWT-shaped string with the given claims. The payload is
 * what the app reads locally; the signature segment is a placeholder because
 * nothing in this codebase ever verifies or forges one.
 */
function tokenWithClaims(claims) {
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.placeholder-signature`;
}

const validClaims = (overrides = {}) => ({
  iss: 'supabase',
  sub: 'user-123',
  iat: NOW_SEC,
  exp: NOW_SEC + 3600,
  ...overrides,
});

const sessionWith = ({ claims, ...rest } = {}) => ({
  access_token: tokenWithClaims(validClaims(claims)),
  refresh_token: 'refresh-token-value',
  expires_at: NOW_SEC + 3600,
  user: { id: 'user-123' },
  ...rest,
});

describe('readTokenClaims', () => {
  it('reads iat, exp and sub from a base64url payload', () => {
    const claims = readTokenClaims(tokenWithClaims(validClaims()));
    assert.equal(claims.iat, NOW_SEC);
    assert.equal(claims.exp, NOW_SEC + 3600);
    assert.equal(claims.sub, 'user-123');
  });

  it('decodes a non-ASCII payload without throwing', () => {
    const claims = readTokenClaims(
      tokenWithClaims(validClaims({ sub: 'ünïcødé-user-✓', name: 'José 🎯' })),
    );
    assert.equal(claims.sub, 'ünïcødé-user-✓');
  });

  it('returns null for a token that is not a three-part JWT', () => {
    assert.equal(readTokenClaims('not-a-jwt'), null);
    assert.equal(readTokenClaims('only.two'), null);
  });

  it('returns null for a missing or empty token', () => {
    assert.equal(readTokenClaims(undefined), null);
    assert.equal(readTokenClaims(''), null);
    assert.equal(readTokenClaims(null), null);
  });

  it('returns null when the payload is not valid JSON', () => {
    assert.equal(readTokenClaims('aGVhZGVy.bm90LWpzb24.c2ln'), null);
  });
});

describe('inspectToken — the "JWT issued at future" case', () => {
  it('rejects a token whose iat is far ahead of the device clock', () => {
    // A stale persisted session minted by a clock running ahead of ours. Its
    // `exp` is also in the future, so an expiry-only check would pass it.
    const problem = inspectToken(
      sessionWith({ claims: { iat: NOW_SEC + 3600, exp: NOW_SEC + 7200 } }),
      NOW_MS,
    );
    assert.ok(problem, 'expected the token to be rejected');
    assert.equal(problem.reason, 'issued-at-future');
    assert.match(problem.detail, /ahead of this device's clock/);
  });

  it('tolerates ordinary clock jitter just inside the window', () => {
    const skewSeconds = Math.floor(CLOCK_SKEW_TOLERANCE_MS / 1000) - 5;
    const problem = inspectToken(
      sessionWith({ claims: { iat: NOW_SEC + skewSeconds } }),
      NOW_MS,
    );
    assert.equal(problem, null, 'a few seconds of drift must not sign the user out');
  });

  it('rejects a token once the skew exceeds the tolerance', () => {
    const skewSeconds = Math.floor(CLOCK_SKEW_TOLERANCE_MS / 1000) + 1;
    const problem = inspectToken(
      sessionWith({ claims: { iat: NOW_SEC + skewSeconds } }),
      NOW_MS,
    );
    assert.equal(problem?.reason, 'issued-at-future');
  });
});

describe('inspectToken — expiry and unreadable tokens', () => {
  it('accepts a normal, unexpired token', () => {
    assert.equal(inspectToken(sessionWith(), NOW_MS), null);
  });

  it('rejects an already-expired token and says how long ago', () => {
    const problem = inspectToken(
      sessionWith({ claims: { iat: NOW_SEC - 7200, exp: NOW_SEC - 60 } }),
      NOW_MS,
    );
    assert.equal(problem?.reason, 'expired');
    assert.match(problem.detail, /expired 60s ago/);
  });

  it('rejects a token inside the refresh window', () => {
    const problem = inspectToken(sessionWith({ claims: { exp: NOW_SEC + 30 } }), NOW_MS);
    assert.equal(problem?.reason, 'expired');
    assert.match(problem.detail, /refresh window/);
  });

  it('rejects a session with no access token', () => {
    assert.equal(inspectToken({ access_token: null }, NOW_MS)?.reason, 'no-session');
    assert.equal(inspectToken(null, NOW_MS)?.reason, 'no-session');
  });

  it('rejects an unparseable access token', () => {
    const problem = inspectToken({ access_token: 'garbage', user: { id: 'u' } }, NOW_MS);
    assert.equal(problem?.reason, 'unreadable-token');
  });
});

describe('secondsUntilExpiry', () => {
  it('reports the remaining lifetime in seconds', () => {
    assert.equal(secondsUntilExpiry(sessionWith(), NOW_MS), 3600);
  });

  it('reports a negative value once expired', () => {
    const session = sessionWith({ claims: { iat: NOW_SEC - 7200, exp: NOW_SEC - 100 } });
    assert.equal(secondsUntilExpiry(session, NOW_MS), -100);
  });

  it('falls back to expires_at when the JWT has no exp claim', () => {
    const session = sessionWith({
      access_token: tokenWithClaims({ sub: 'user-123', iat: NOW_SEC }),
      expires_at: NOW_SEC + 120,
    });
    assert.equal(secondsUntilExpiry(session, NOW_MS), 120);
  });

  it('returns null when expiry cannot be determined', () => {
    const session = { access_token: tokenWithClaims({ sub: 'u' }), user: { id: 'u' } };
    assert.equal(secondsUntilExpiry(session, NOW_MS), null);
  });
});

describe('isAuthError', () => {
  it('recognises the "JWT issued at future" message', () => {
    assert.equal(isAuthError({ message: 'JWT issued at future' }), true);
  });

  it('recognises 401 and 403 by status', () => {
    assert.equal(isAuthError({ status: 401, message: 'Unauthorized' }), true);
    assert.equal(isAuthError({ status: 403, message: 'Forbidden' }), true);
  });

  it('recognises the PostgREST auth error code', () => {
    assert.equal(isAuthError({ code: 'PGRST301', message: 'no permission' }), true);
  });

  it('ignores errors that are not authentication problems', () => {
    assert.equal(isAuthError(null), false);
    assert.equal(isAuthError({ message: 'relation "goals" does not exist' }), false);
    assert.equal(isAuthError({ status: 500, message: 'Internal Server Error' }), false);
  });

  it('does NOT treat a network failure as an auth error', () => {
    // Misclassifying these is what turns a flaky connection into a refresh loop.
    assert.equal(isAuthError({ name: 'AuthRetryableFetchError', message: 'Network request failed' }), false);
    assert.equal(isAuthError(new TypeError('Failed to fetch')), false);
    assert.equal(isAuthError({ message: 'socket hang up' }), false);
  });
});

describe('isNetworkError', () => {
  it('recognises transport failures', () => {
    assert.equal(isNetworkError(new TypeError('Network request failed')), true);
    assert.equal(isNetworkError({ name: 'AuthRetryableFetchError', message: 'x' }), true);
    assert.equal(isNetworkError({ status: 0, message: 'x' }), true);
    assert.equal(isNetworkError({ message: 'connect ETIMEDOUT 1.2.3.4:443' }), true);
  });

  it('does not swallow real HTTP responses', () => {
    assert.equal(isNetworkError({ status: 401, message: 'JWT issued at future' }), false);
    assert.equal(isNetworkError({ status: 500, message: 'Internal Server Error' }), false);
    assert.equal(isNetworkError({ message: 'JWT issued at future' }), false);
  });

  it('returns false for no error at all', () => {
    assert.equal(isNetworkError(null), false);
    assert.equal(isNetworkError(undefined), false);
  });
});
