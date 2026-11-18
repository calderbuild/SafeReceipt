import { setLang, useLang, useT } from '../lib/i18n';

/** Compact two-state switch: shows the current language, one click changes it. */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const lang = useLang();
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
      aria-label={t('lang.switch')}
      title={t('lang.switch')}
      className={`flex items-center rounded-md border border-white/10 px-2 py-1 text-xs font-mono text-slate-400 hover:text-white hover:border-white/25 transition-colors cursor-pointer ${className}`}
    >
      {lang === 'zh' ? '中' : 'EN'}
    </button>
  );
}
