import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';
import {
  describeSession,
  inspectToken,
  isAuthError,
  isNetworkError,
  readTokenClaims,
  secondsUntilExpiry,
  type TokenFailureReason,
} from './tokenClaims';

/**
 * Single source of truth for "do we have a usable Supabase session right now?".
 *
 * Why this module exists
 * ----------------------
 * The app used to call `supabase.auth.getUser()` from three places on every cold
 * start (the root-layout boot check, every `onAuthStateChange` event, and again
 * inside `hydrateFromSupabase`). `getUser()` is a *network* round trip to
 * `/auth/v1/user`, so each of those produced a real request — and each one that
 * found an expired token kicked off its own `refresh_token` grant. A single
 * launch therefore produced several concurrent token refreshes and several
 * `/auth/v1/user` calls.
 *
 * This module collapses all of that into ONE guarded operation:
 *   - `getSession()` is local (reads the client's in-memory/persisted session)
 *     and costs no network request, so the common path is free.
 *   - A token is only refreshed when it is actually close to expiry, or when
 *     `inspectToken()` finds its claims clock-inconsistent — which is what
 *     catches a stale persisted session.
 *   - Concurrent callers share a single in-flight promise instead of each
 *     starting its own refresh.
 *
 * The "JWT issued at future" problem
 * ----------------------------------
 * PostgREST rejects a request whose bearer token has an `iat` claim ahead of the
 * database's own clock. The way a React Native app ends up sending such a token
 * is a **stale persisted session**: the access token cached under
 * `sb-<project-ref>-auth-token` in AsyncStorage (localStorage on web) survives
 * app updates, Fast Refresh reloads and offline stretches, and is replayed
 * verbatim on the next cold start.
 *
 * Such a token is not "about to expire" — its `exp` is comfortably in the
 * future — so a purely expiry-based check waves it through and the app queries
 * with a token the server will never accept. Every retry fails identically,
 * which is the loop this module exists to break.
 *
 * So the cached claims are never trusted blindly:
 *   1. `inspectToken()` decodes the persisted token's claims locally (read-only;
 *      the signature is never touched, nothing is forged, no token is
 *      hardcoded) and rejects a token that is expired or whose `iat` runs ahead
 *      of the device clock by more than the tolerance.
 *   2. Such a session is never handed to a query. It is refreshed once.
 *   3. If the refresh cannot produce a usable token, the persisted session is
 *      purged from storage so the bad token can never be replayed, and the app
 *      falls back to the signed-out state. Recovery is single-flight and capped
 *      per user, so it cannot loop.
 *
 * Pure helpers live in `./tokenClaims`; this module owns the Supabase calls.
 */

export type SessionFailureReason =
  | TokenFailureReason
  | 'no-session'
  | 'refresh-failed'
  | 'rejected-by-server';

export type SessionResult =
  | { ok: true; session: Session; refreshed: boolean; recovered: boolean }
  | { ok: false; reason: SessionFailureReason; error?: unknown; subject?: string };

const now = () => Date.now();

/* -------------------------------------------------------------------------- */
/* Single-flight state                                                         */
/* -------------------------------------------------------------------------- */

/**
 * In-flight promises. While set, every caller awaits the same promise instead
 * of starting its own work, so N concurrent callers collapse into at most one
 * refresh. This is what makes a cold start with several triggers cheap, and
 * what keeps recovery from becoming a loop.
 */
let inFlightEnsure: Promise<SessionResult> | null = null;
let inFlightForcedRefresh: Promise<SessionResult> | null = null;
let inFlightRecovery: Promise<SessionResult> | null = null;

/**
 * Users whose session has already been through the full recovery path (refresh
 * attempt, storage purge, sign-out). Capped at one recovery per user per app
 * run: if a freshly minted token is *still* rejected, another refresh will not
 * fix it, and retrying would loop forever.
 */
const recoveredUsers = new Set<string>();

function logSessionState(stage: string, session: Session | null): void {
  if (!__DEV__) return;
  console.log(
    `[auth] ${stage} — session ${session ? 'exists' : 'missing'} (${describeSession(session)}).`,
  );
}

/* -------------------------------------------------------------------------- */
/* Core resolution                                                             */
/* -------------------------------------------------------------------------- */

/** Performs exactly one `refreshSession()` grant. */
async function refreshOnce(): Promise<SessionResult> {
  if (__DEV__) console.log('[auth] Refreshing access token once (single-flight).');
  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    console.error('[auth] Token refresh failed:', error.message);
    return { ok: false, reason: 'refresh-failed', error };
  }
  const session = data.session ?? null;
  if (!session) {
    console.error('[auth] Token refresh returned no session.');
    return { ok: false, reason: 'refresh-failed' };
  }

  // A refresh can hand back a token that is *also* clock-inconsistent (that is
  // exactly the case that produced the original error), so the fresh token is
  // checked before anyone is allowed to query with it. `expired` is tolerated:
  // the caller retries immediately, and a brand-new token is never meaningfully
  // expired.
  const problem = inspectToken(session, now());
  if (problem && problem.reason !== 'expired') {
    console.error(
      `[auth] Refreshed token is still unusable (${problem.reason}): ${problem.detail}.`,
    );
    return {
      ok: false,
      reason: problem.reason,
      error: new Error(problem.detail),
      subject: session.user?.id,
    };
  }

  logSessionState('Token refreshed', session);
  return { ok: true, session, refreshed: true, recovered: true };
}

/**
 * Resolves a session that is safe to send.
 *
 * `forceRefresh` bypasses the local checks and performs a single
 * `refreshSession()`. It is only ever used from the one-shot recovery path.
 */
async function resolveSession(forceRefresh: boolean): Promise<SessionResult> {
  if (forceRefresh) return refreshOnce();

  // Local read only — no network request.
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('[auth] getSession reported an error:', error.message);
  }

  const session = data.session ?? null;
  logSessionState('Local session read', session);
  const subject = session?.user?.id;

  if (!session) {
    return { ok: false, reason: 'no-session' };
  }

  const problem = inspectToken(session, now());
  if (problem) {
    // Never hand back a token we already know the server will reject.
    console.error(`[auth] Persisted session rejected locally (${problem.reason}): ${problem.detail}.`);
    return { ok: false, reason: problem.reason, error: new Error(problem.detail), subject };
  }

  // Fast path: reuse the token the client already holds. No network call.
  return { ok: true, session, refreshed: false, recovered: false };
}

/**
 * Coalesced session accessor.
 *
 * Returns a *result* rather than a bare session so callers can tell "signed out"
 * apart from "your cached token is broken and needs recovery" — that
 * distinction is what keeps a stale session from being replayed.
 */
export function ensureSession(forceRefresh = false): Promise<SessionResult> {
  if (forceRefresh) {
    if (!inFlightForcedRefresh) {
      inFlightForcedRefresh = resolveSession(true).finally(() => {
        inFlightForcedRefresh = null;
      });
    }
    return inFlightForcedRefresh;
  }

  if (!inFlightEnsure) {
    inFlightEnsure = resolveSession(false).finally(() => {
      inFlightEnsure = null;
    });
  }
  return inFlightEnsure;
}

/**
 * Drops the persisted session so a token the server rejected can never be read
 * or replayed again.
 *
 * Uses `auth.signOut()` deliberately: it clears the auth client's in-memory
 * session *and* the persisted record, which a bare `removeItem` would not. It
 * also raises the `SIGNED_OUT` event the app's auth listener already handles, so
 * the user lands on the signed-out state through the normal path.
 */
export async function purgePersistedSession(reason: SessionFailureReason): Promise<void> {
  console.error(`[auth] Purging the persisted Supabase session (${reason}).`);
  try {
    await supabase.auth.signOut();
  } catch (error) {
    // A failed purge must not mask the original auth problem.
    console.error('[auth] signOut() during purge failed:', error);
  }
  resetSessionCache();
}

/**
 * One-shot, non-looping recovery.
 *
 * Called when a request was rejected with an auth error, or when the persisted
 * session failed its local check. It:
 *   1. refreshes the token at most once (coalesced across concurrent callers),
 *   2. returns the fresh session when that produced a usable token,
 *   3. otherwise purges the persisted session and reports the failure so the
 *      app can surface it and land on the signed-out state.
 *
 * The `recoveredUsers` guard means a user is only ever taken through this path
 * once per app run, so a persistently rejected token cannot spin the loop.
 */
export function recoverSession(userId: string | null | undefined): Promise<SessionResult> {
  if (inFlightRecovery) return inFlightRecovery;

  const subject = userId ?? 'unknown';
  if (recoveredUsers.has(subject)) {
    // Already recovered once and still failing — stop here rather than loop.
    console.error(
      `[auth] Recovery already attempted for ${subject}; refusing to refresh again. Sign in again to continue.`,
    );
    inFlightRecovery = Promise.resolve({ ok: false, reason: 'rejected-by-server', subject });
    return inFlightRecovery;
  }

  recoveredUsers.add(subject);
  console.error(`[auth] Session recovery started for ${subject} — refreshing token once.`);
  inFlightRecovery = refreshOnce()
    .then(async (result) => {
      if (result.ok) {
        if (__DEV__) console.log('[auth] Session recovered with a fresh token.');
        return result;
      }
      await purgePersistedSession(result.reason);
      return result;
    })
    .finally(() => {
      inFlightRecovery = null;
    });
  return inFlightRecovery;
}

/**
 * The session every data query is allowed to use, or `null`.
 *
 * `ensureSession()` is asked first; when it reports a session that exists but
 * cannot be trusted (expired, future-issued, unreadable) this escalates to the
 * single-shot `recoverSession()`. Only a session that survived both steps is
 * returned, which guarantees a query is never issued with a token the server
 * has already rejected.
 */
export async function ensureUsableSession(fallbackUserId?: string | null): Promise<Session | null> {
  const result = await ensureSession();
  if (result.ok) return result.session;

  if (result.reason === 'no-session') {
    if (__DEV__) console.log('[auth] No session available — user is signed out.');
    return null;
  }

  const recovered = await recoverSession(fallbackUserId ?? result.subject ?? null);
  return recovered.ok ? recovered.session : null;
}

/**
 * The currently authenticated user's id, or `null` when signed out.
 *
 * Always derived from the live Supabase session — never from a cached store
 * value and never hardcoded — so a query can never be scoped to the wrong
 * account, and never issued against a token known to be unusable.
 */
export async function getAuthenticatedUserId(forceRefresh = false): Promise<string | null> {
  const result = await ensureSession(forceRefresh);
  return result.ok ? result.session.user?.id ?? null : null;
}

/** True when a session is persisted at all, regardless of its token's health. */
export async function hasPersistedSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

/**
 * Clears in-flight coalescing state and, on request, the per-user recovery
 * guard. Called on sign-out and account deletion so the next attempt
 * re-evaluates from scratch.
 */
export function resetSessionCache(options: { forgetRecoveryGuard?: boolean } = {}): void {
  inFlightEnsure = null;
  inFlightForcedRefresh = null;
  inFlightRecovery = null;
  if (options.forgetRecoveryGuard) recoveredUsers.clear();
}

export {
  describeSession,
  inspectToken,
  isAuthError,
  isNetworkError,
  readTokenClaims,
  secondsUntilExpiry,
};
