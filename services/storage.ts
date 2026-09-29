import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * PLATFORM-SAFE KEY/VALUE STORAGE
 *
 * A single async storage adapter that is safe to import and call from anywhere,
 * including while Expo Router renders the app on the server.
 *
 * Why this module exists
 * ----------------------
 * `@react-native-async-storage/async-storage` ships two different
 * implementations behind one import specifier:
 *
 *   - native (`AsyncStorage.native.ts`) -> the React Native native module.
 *   - web    (`AsyncStorage.ts`)        -> a thin shim whose every method is
 *                                          `createPromise(() => window.localStorage.<op>(key))`.
 *
 * The web build dereferences `window` on **every call** and has no guard at
 * all. Expo Router's web renderer (`web.output: "static"`, and the dev
 * `@expo/router-server` renderer) executes the same web bundle inside Node with
 * `resolver.environment=node`, where `window` does not exist — so a single
 * `AsyncStorage.getItem()` during a render pass throws
 * `ReferenceError: window is not defined` and takes the whole route tree down.
 *
 * This adapter resolves the backend per platform instead of assuming one:
 *
 *   - Native (iOS/Android) : `AsyncStorage`  -> unchanged, fully persistent.
 *   - Web, in a browser    : `localStorage`  -> unchanged, fully persistent.
 *   - Web, on the server   : no-op           -> the render pass has no storage
 *                                              and, by definition, no session.
 *
 * Nothing here references `window`, `document` or `localStorage` as a bare
 * identifier. `globalThis` is used instead: reading a property off it is safe
 * on every runtime (it is simply `undefined` where the API does not exist), and
 * `typeof` is used for the DOM probes, so no code path can throw a
 * `ReferenceError` during server rendering.
 *
 * Reads are always async, which is what Supabase's `SupportedStorage` and
 * zustand's `StateStorage` both expect.
 */

/** Async, promise-returning storage contract shared by Supabase and zustand. */
export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

/** The subset of the DOM `Storage` interface this adapter relies on. */
type SyncWebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const PROBE_KEY = '__fintrack_storage_probe__';

/**
 * Last-resort store for browsers that expose `localStorage` but throw on write
 * — Safari private browsing, "block all cookies", some embedded webviews. It
 * keeps the app signed in for the lifetime of the tab instead of failing every
 * write. Never used on the server (see `isBrowser`), so it cannot leak data
 * between concurrent render passes.
 */
const memoryStore = new Map<string, string>();

/**
 * Resolved lazily on first browser use and cached afterwards. `undefined` means
 * "not resolved yet"; `null` means "not usable on this runtime".
 */
let cachedWebStorage: SyncWebStorage | null | undefined;

/**
 * True only inside a real browser document. `Platform.OS` narrows it to web
 * (so native keeps using AsyncStorage) and the `globalThis` probe rules out the
 * Expo Router server renderer, which runs the web bundle under Node.
 */
function isBrowser(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof (globalThis as { document?: unknown }).document !== 'undefined'
  );
}

/**
 * Reads the browser storage object without ever naming `window`/`localStorage`
 * as a global identifier. Returns `null` when it is missing or unusable.
 */
function resolveWebStorage(): SyncWebStorage | null {
  if (cachedWebStorage !== undefined) return cachedWebStorage;

  const candidate = (globalThis as { localStorage?: SyncWebStorage }).localStorage;
  if (!candidate || typeof candidate.getItem !== 'function') {
    cachedWebStorage = null;
    return cachedWebStorage;
  }

  try {
    // A read/write probe catches browsers that expose the object but reject
    // access (private mode, storage disabled by policy).
    candidate.setItem(PROBE_KEY, '1');
    candidate.removeItem(PROBE_KEY);
    cachedWebStorage = candidate;
  } catch {
    cachedWebStorage = null;
  }
  return cachedWebStorage;
}

function readWebItem(key: string): Promise<string | null> {
  if (!isBrowser()) return Promise.resolve(null);
  const store = resolveWebStorage();
  if (store) {
    try {
      return Promise.resolve(store.getItem(key));
    } catch {
      // Fall through to the in-memory fallback.
    }
  }
  return Promise.resolve(memoryStore.get(key) ?? null);
}

function writeWebItem(key: string, value: string): Promise<void> {
  if (!isBrowser()) return Promise.resolve();
  const store = resolveWebStorage();
  if (store) {
    try {
      store.setItem(key, value);
      return Promise.resolve();
    } catch {
      // Fall through to the in-memory fallback.
    }
  }
  memoryStore.set(key, value);
  return Promise.resolve();
}

function removeWebItem(key: string): Promise<void> {
  if (!isBrowser()) return Promise.resolve();
  const store = resolveWebStorage();
  if (store) {
    try {
      store.removeItem(key);
    } catch {
      // Fall through to the in-memory fallback.
    }
  }
  memoryStore.delete(key);
  return Promise.resolve();
}

/**
 * The shared storage adapter.
 *
 * Module-level `const` on purpose: this object is passed to the Supabase client
 * at construction time, and keeping a single instance avoids handing the auth
 * client a different storage object on every re-evaluation.
 */
export const storage: KeyValueStorage = {
  getItem: (key) => (Platform.OS === 'web' ? readWebItem(key) : AsyncStorage.getItem(key)),
  setItem: (key, value) =>
    Platform.OS === 'web' ? writeWebItem(key, value) : AsyncStorage.setItem(key, value),
  removeItem: (key) =>
    Platform.OS === 'web' ? removeWebItem(key) : AsyncStorage.removeItem(key),
};

/**
 * Test seam: drops the cached browser storage lookup. Exported for the unit
 * tests so a simulated server environment can be re-resolved.
 */
export function resetStorageCache(): void {
  cachedWebStorage = undefined;
  memoryStore.clear();
}
