/**
 * Pure, dependency-free helpers for inspecting a Supabase access token and for
 * classifying the errors Supabase returns.
 *
 * Nothing in this file touches the network, the Supabase client or React
 * Native, which is what makes the "JWT issued at future" logic testable in
 * isolation (see `tests/authSession.test.mjs`).
 *
 * The JWT handling here is deliberately READ-ONLY. `readTokenClaims` decodes
 * the payload so the app can do local clock arithmetic, but it never verifies
 * a signature, never mints a token, never edits a claim and never hardcodes a
 * token. The server stays the only authority on whether a token is valid, and
 * JWT validation is left fully enabled everywhere.
 */

/** How far ahead of the *device* clock a token's `iat` may sit and still be used. */
export const CLOCK_SKEW_TOLERANCE_MS = 90_000;

/** Refresh a token this many ms before it actually expires. */
export const EXPIRY_SKEW_MS = 60_000;

export type TokenFailureReason =
  | 'no-session'
  | 'expired'
  | 'issued-at-future'
  | 'unreadable-token'
  | 'unusable-after-refresh';

export type TokenProblem = { reason: TokenFailureReason; detail: string };

/** Structural view of the parts of a Supabase `Session` this module reads. */
export type SessionLike = {
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
  user?: { id?: string | null } | null;
} | null | undefined;

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodes base64/base64url to raw bytes without depending on `atob`. */
function base64ToBytes(input: string): number[] {
  const cleaned = input.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < cleaned.length; i += 1) {
    const index = B64_ALPHABET.indexOf(cleaned[i]);
    if (index < 0) continue;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

/** UTF-8 decodes bytes without depending on `TextDecoder` being present. */
function utf8Decode(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const byte = bytes[i];
    i += 1;
    if (byte < 0x80) {
      out += String.fromCharCode(byte);
    } else if (byte >= 0xc0 && byte < 0xe0) {
      out += String.fromCharCode(((byte & 0x1f) << 6) | ((bytes[i] ?? 0) & 0x3f));
      i += 1;
    } else if (byte >= 0xe0 && byte < 0xf0) {
      out += String.fromCharCode(
        ((byte & 0x0f) << 12) | (((bytes[i] ?? 0) & 0x3f) << 6) | ((bytes[i + 1] ?? 0) & 0x3f),
      );
      i += 2;
    } else {
      const cp =
        ((byte & 0x07) << 18) |
        (((bytes[i] ?? 0) & 0x3f) << 12) |
        (((bytes[i + 1] ?? 0) & 0x3f) << 6) |
        ((bytes[i + 2] ?? 0) & 0x3f);
      i += 3;
      const offset = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
    }
  }
  return out;
}

export type TokenClaims = { iat?: number; exp?: number; sub?: string };

/**
 * Reads the *unverified* claims of a JWT.
 *
 * A local peek at the payload, used only for clock arithmetic. It performs no
 * signature verification, forges nothing, modifies nothing and embeds no
 * tokens — the server remains the sole authority on validity.
 */
export function readTokenClaims(accessToken: string | null | undefined): TokenClaims | null {
  if (!accessToken) return null;
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(utf8Decode(base64ToBytes(parts[1]))) as Record<string, unknown>;
    if (!payload || typeof payload !== 'object') return null;
    return {
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
      sub: typeof payload.sub === 'string' ? payload.sub : undefined,
    };
  } catch {
    return null;
  }
}

/** Seconds until the token expires. Negative once expired, `null` if unknown. */
export function secondsUntilExpiry(session: SessionLike, nowMs = Date.now()): number | null {
  const claims = readTokenClaims(session?.access_token);
  const exp = claims?.exp ?? (typeof session?.expires_at === 'number' ? session.expires_at : null);
  if (typeof exp !== 'number') return null;
  return exp - Math.floor(nowMs / 1000);
}

/**
 * Why this token must not be sent, or `null` when it looks safe to use.
 *
 * `issued-at-future` is the local mirror of the server's "JWT issued at future":
 * the token claims to have been minted after "now", so a server with a saner
 * clock rejects it. A token like that is typically left behind by a stale
 * persisted session — its `exp` is comfortably in the future, so a purely
 * expiry-based check would wave it through and the app would query with a token
 * the server will never accept.
 */
export function inspectToken(
  session: SessionLike,
  nowMs = Date.now(),
): TokenProblem | null {
  if (!session?.access_token) {
    return { reason: 'no-session', detail: 'session has no access token' };
  }

  const claims = readTokenClaims(session.access_token);
  if (!claims) {
    return { reason: 'unreadable-token', detail: 'access token is not a readable JWT' };
  }

  const reference = Math.floor(nowMs / 1000);
  if (typeof claims.exp === 'number' && claims.exp <= reference) {
    return { reason: 'expired', detail: `expired ${reference - claims.exp}s ago` };
  }
  if (
    typeof claims.iat === 'number' &&
    claims.iat - reference > Math.floor(CLOCK_SKEW_TOLERANCE_MS / 1000)
  ) {
    return {
      reason: 'issued-at-future',
      detail:
        `iat is ${claims.iat - reference}s ahead of this device's clock ` +
        `(> ${Math.floor(CLOCK_SKEW_TOLERANCE_MS / 1000)}s tolerance)`,
    };
  }
  if (typeof claims.exp === 'number' && claims.exp - reference <= Math.floor(EXPIRY_SKEW_MS / 1000)) {
    return { reason: 'expired', detail: 'expires within the refresh window' };
  }
  return null;
}

/** Human-readable one-liner for the `[auth]` logs. */
export function describeSession(session: SessionLike, nowMs = Date.now()): string {
  if (!session) return 'session=none';
  const expiresIn = secondsUntilExpiry(session, nowMs);
  const expiry =
    expiresIn === null
      ? 'expiry=unknown'
      : `expiry=${expiresIn > 0 ? `in ${expiresIn}s` : `${expiresIn}s ago`}`;
  return `user=${session.user?.id ?? 'unknown'} refresh_token=${
    session.refresh_token ? 'yes' : 'no'
  } ${expiry}`;
}

/* -------------------------------------------------------------------------- */
/* Error classification — auth vs. network                                     */
/* -------------------------------------------------------------------------- */

/** Error codes that mean "your token is no longer acceptable, re-authenticate". */
const AUTH_ERROR_CODES = new Set([401, 403, 'PGRST301']);

/** Substrings that identify a transport failure rather than an auth failure. */
const NETWORK_ERROR_PATTERNS = [
  'network request failed',
  'failed to fetch',
  'networkerror',
  'timeout',
  'timed out',
  'etimedout',
  'econnrefused',
  'econnreset',
  'enetunreach',
  'ehostunreach',
  'socket hang up',
  'load failed',
];

type ErrorLike = { status?: number; code?: string; message?: string; name?: string };

function asErrorLike(error: unknown): ErrorLike {
  if (!error) return {};
  if (typeof error === 'string') return { message: error };
  return error as ErrorLike;
}

/**
 * Transport-level failure (offline, DNS, timeout, dropped socket). These are
 * NOT authentication problems: no amount of refreshing fixes them, and
 * misclassifying them as auth errors is what turns a flaky connection into a
 * refresh storm.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const { name, message, status } = asErrorLike(error);
  // A real HTTP status means the server answered, so it is not a transport
  // problem — the request got far enough to be rejected for some other reason.
  if (typeof status === 'number' && status >= 400) return false;
  if (name === 'AuthRetryableFetchError' || name === 'FetchError') return true;
  if (status === 0) return true;
  const text = (message ?? String(error)).toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pattern) => text.includes(pattern));
}

/**
 * Whether the server rejected the token — the `401 JWT issued at future` class
 * of failure, where a refresh could genuinely help.
 *
 * Network errors are explicitly excluded so they can never drive a refresh.
 */
export function isAuthError(error: unknown): error is { message: string } {
  if (!error) return false;
  if (isNetworkError(error)) return false;

  const { status, code, message } = asErrorLike(error);
  if (typeof status === 'number' && AUTH_ERROR_CODES.has(status)) return true;
  if (typeof code === 'string' && AUTH_ERROR_CODES.has(code)) return true;

  const text = (message ?? '').toLowerCase();
  return (
    text.includes('jwt') ||
    text.includes('token') ||
    text.includes('unauthorized') ||
    text.includes('authentication')
  );
}
