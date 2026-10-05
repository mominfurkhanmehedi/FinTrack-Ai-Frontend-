import { isSupportedCurrency } from '../utils/currency';
import { storage } from './storage';

/**
 * PER-USER CURRENCY PREFERENCE
 *
 * The display currency is persisted twice, deliberately:
 *
 *   1. In the main Zustand store (`currency`), which survives restarts and is
 *      what the whole app reads. This is the "last selection on this device"
 *      default and is restored on the very first render.
 *   2. Under a key scoped to the signed-in account, written here.
 *
 * The second copy is what makes the preference survive a sign-out/sign-in cycle
 * *per account*: signing out and back in as the same user restores their own
 * currency, and signing in as somebody else restores theirs instead of
 * inheriting the previous user's choice.
 *
 * A local storage key is used rather than a Supabase column, so no schema, RLS
 * or backend change is involved and the preference still works while offline.
 */

const KEY_PREFIX = 'fintrack-currency:';

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/** Remembers `code` as this account's display currency. */
export async function saveCurrencyForUser(userId: string, code: string): Promise<void> {
  if (!isSupportedCurrency(code)) return;
  try {
    await storage.setItem(keyFor(userId), code);
  } catch (error) {
    console.warn('[currencyPreference] could not save preference:', error);
  }
}

/** This account's remembered currency, or `null` if it has never chosen one. */
export async function loadCurrencyForUser(userId: string): Promise<string | null> {
  try {
    const stored = await storage.getItem(keyFor(userId));
    return isSupportedCurrency(stored) ? (stored as string) : null;
  } catch (error) {
    console.warn('[currencyPreference] could not read preference:', error);
    return null;
  }
}

/** Forgets an account's currency (used when the account is deleted). */
export async function removeCurrencyForUser(userId: string): Promise<void> {
  try {
    await storage.removeItem(keyFor(userId));
  } catch (error) {
    console.warn('[currencyPreference] could not clear preference:', error);
  }
}
