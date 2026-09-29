import { useCallback } from 'react';

import { useAppStore } from '../store';
import { en } from './locales/en';
import { hi } from './locales/hi';
import { kn } from './locales/kn';
import { mr } from './locales/mr';
import { te } from './locales/te';

/** Locale identifiers supported by the app. */
export const SUPPORTED_LANGUAGES = ['en', 'hi', 'kn', 'mr', 'te'] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

/** Native-script display label for each supported language. */
export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: 'English',
  hi: 'हिन्दी',
  kn: 'ಕನ್ನಡ',
  mr: 'मराठी',
  te: 'తెలుగు',
};

/** Locale used for date/number formatting per language. */
export const LOCALE_BY_LANGUAGE: Record<LanguageCode, string> = {
  en: 'en-US',
  hi: 'hi-IN',
  kn: 'kn-IN',
  mr: 'mr-IN',
  te: 'te-IN',
};

export type TranslationParams = Record<string, string | number>;

type AnyDict = typeof en;
type DictValue = string | ((params: Record<string, string | number>) => string);

/** Leaf paths of the English dictionary — e.g. "nav.dashboard", "auth.login.email". */
type KeysOfDict<T> = T extends string | ((p: Record<string, string | number>) => string)
  ? never
  : {
      [K in keyof T & string]: KeysOfDict<T[K]> extends never
        ? K
        : `${K}.${KeysOfDict<T[K]>}`;
    }[keyof T & string];

export type TranslationKey = KeysOfDict<AnyDict>;

const DICTIONARIES: Record<string, AnyDict> = {
  en,
  hi,
  kn,
  mr,
  te,
};

function resolvePath(dict: AnyDict, path: string): DictValue | undefined {
  const parts = path.split('.');
  let node: unknown = dict;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' || typeof node === 'function' ? (node as DictValue) : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/**
 * Translate a dotted dictionary key into the given language, falling back to
 * English (then to the key). Every locale ships a complete translation so the
 * fallback is only a safety net.
 */
export function translate(language: string, key: string, params?: TranslationParams): string {
  const dict = DICTIONARIES[language] ?? en;
  const value = resolvePath(dict, key) ?? resolvePath(en, key);
  if (typeof value === 'function') return interpolate(value(params ?? {}), params);
  if (typeof value === 'string') return interpolate(value, params);
  return key;
}

/** Short + full weekday names for the given language (charts, tooltips, a11y). */
export function dayNames(language: string): { short: string[]; full: string[] } {
  const dict = DICTIONARIES[language] ?? en;
  const short = (dict.days?.short as string[] | undefined) ?? en.days.short;
  const full = (dict.days?.full as string[] | undefined) ?? en.days.full;
  return { short, full };
}

/** True when `code` is one of the supported languages. */
export function isSupportedLanguage(code: string): code is LanguageCode {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/** Best-effort normalized language (unknown/legacy codes → English). */
export function normalizeLanguage(code: string | undefined | null): LanguageCode {
  return isSupportedLanguage(code ?? '') ? (code as LanguageCode) : 'en';
}

export interface UseI18nResult {
  t: (key: TranslationKey, params?: TranslationParams) => string;
  language: string;
  setLanguage: (language: string) => void;
  locale: string;
  dayShort: string[];
  dayFull: string[];
}

/**
 * Reactively translate with the store's persisted language. Components calling
 * `useI18n()` re-render instantly when the language changes because the
 * zustand selector subscribes to the `language` field in AppState.
 */
export function useI18n(): UseI18nResult {
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const locale = LOCALE_BY_LANGUAGE[normalizeLanguage(language)];

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(language, key, params),
    [language],
  );

  const names = dayNames(language);

  return { t, language, setLanguage, locale, dayShort: names.short, dayFull: names.full };
}