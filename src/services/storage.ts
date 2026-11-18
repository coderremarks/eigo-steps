/**
 * Local-first persistence. Everything the app remembers lives in the browser's localStorage under
 * versioned keys. Stored data is treated as untrusted on the way back in: it is parsed with the
 * same Zod schemas, and anything corrupt or tampered with is set aside (not deleted) so the app
 * still starts.
 */
import type { z } from 'zod';

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const STORAGE_KEYS = {
  progress: 'eigo-steps:v1:progress',
  settings: 'eigo-steps:v1:settings',
  lessons: 'eigo-steps:v1:lessons',
  classRoster: 'eigo-steps:v1:class',
} as const;

export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => {
      data.set(key, value);
    },
    remove: (key) => {
      data.delete(key);
    },
  };
}

/**
 * localStorage, falling back to memory when it is unavailable (private browsing, blocked site
 * data, or a school device policy). In that case the app still works for the session.
 */
export function createBrowserStore(): KeyValueStore {
  try {
    const probe = '__eigo_steps_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch {
    return createMemoryStore();
  }
  return {
    get: (key) => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        console.warn('Could not save to localStorage', error);
      }
    },
    remove: (key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

export type LoadStatus = 'ok' | 'empty' | 'recovered';

export interface Loaded<T> {
  value: T;
  status: LoadStatus;
}

/** Reads and validates JSON. Invalid data is moved to `<key>:invalid` and the fallback is used. */
export function loadJson<S extends z.ZodType>(
  store: KeyValueStore,
  key: string,
  schema: S,
  fallback: () => z.output<S>,
): Loaded<z.output<S>> {
  const raw = store.get(key);
  if (raw === null) return { value: fallback(), status: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    store.set(`${key}:invalid`, raw);
    return { value: fallback(), status: 'recovered' };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    store.set(`${key}:invalid`, raw);
    return { value: fallback(), status: 'recovered' };
  }
  return { value: result.data, status: 'ok' };
}

export function saveJson(store: KeyValueStore, key: string, value: unknown): void {
  store.set(key, JSON.stringify(value));
}
