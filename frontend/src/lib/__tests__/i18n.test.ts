import { describe, expect, it, vi } from 'vitest';
import { localeOf, ruleText, translate } from '../i18n';
import { en, zh } from '../messages';

describe('i18n', () => {
  it('defaults to English with a Chinese browser and restores a saved choice', async () => {
    const storageKey = 'safereceipt:lang';
    const browserLanguage = vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('zh-TW');
    try {
      window.localStorage.removeItem(storageKey);
      vi.resetModules();
      const firstVisit = await import('../i18n');
      expect(firstVisit.getLang()).toBe('en');
      expect(document.documentElement.lang).toBe('en');

      firstVisit.setLang('zh');
      expect(document.documentElement.lang).toBe('zh-CN');
      vi.resetModules();
      const returnVisit = await import('../i18n');
      expect(returnVisit.getLang()).toBe('zh');
      returnVisit.setLang('en');
      expect(document.documentElement.lang).toBe('en');
    } finally {
      browserLanguage.mockRestore();
      window.localStorage.removeItem(storageKey);
      vi.resetModules();
    }
  });

  it('has a Chinese entry for every English key', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('interpolates variables in both languages', () => {
    expect(translate('en', 'demo.runError.network', { network: 'Monad' })).toContain('Monad');
    expect(translate('zh', 'demo.runError.network', { network: 'Monad' })).toContain('Monad');
  });

  it('falls back to the rule id when a rule has no copy', () => {
    expect(ruleText('SOME_FUTURE_RULE').description).toBe('SOME_FUTURE_RULE');
  });

  it('formats dates with the language locale', () => {
    expect(localeOf('zh')).toBe('zh-CN');
    expect(localeOf('en')).toBe('en-US');
  });
});
