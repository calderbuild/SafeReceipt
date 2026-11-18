import { describe, expect, it } from 'vitest';
import { localeOf, ruleText, translate } from '../i18n';
import { en, zh } from '../messages';

describe('i18n', () => {
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
