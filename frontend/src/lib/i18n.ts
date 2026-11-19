/**
 * One language store for the whole app, read with useSyncExternalStore so
 * every screen updates the moment the navbar toggle changes it. The choice is
 * remembered per browser; first visit defaults to English.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { en, zh, type MessageKey } from './messages';

export type Lang = 'en' | 'zh';

const STORAGE_KEY = 'safereceipt:lang';
const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, zh };

function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    // Private mode can block storage; use the default.
  }
  return 'en';
}

let current: Lang = detectLang();
const listeners = new Set<() => void>();

function applyDocumentLang() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
  document.title = dictionaries[current]['meta.title'];
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', dictionaries[current]['meta.description']);
}

applyDocumentLang();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // The toggle still works for this page view.
  }
  applyDocumentLang();
  listeners.forEach((listener) => listener());
}

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  let text = dictionaries[lang][key] ?? en[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

/** For code that runs outside a component (the demo runner). */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(current, key, vars);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

export function useT() {
  const lang = useLang();
  return useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );
}

export function localeOf(lang: Lang): string {
  return lang === 'zh' ? 'zh-CN' : 'en-US';
}

/** Display text for a risk rule, keyed by the on-chain rule id. */
export function ruleText(ruleName: string): { description: string; recommendation?: string } {
  const desc = `risk.rule.${ruleName}.desc` as MessageKey;
  const rec = `risk.rule.${ruleName}.rec` as MessageKey;
  if (desc in en) return { description: t(desc), recommendation: rec in en ? t(rec) : undefined };
  return { description: ruleName };
}
