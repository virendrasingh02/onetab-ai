import { useMemo } from 'react';
import {
  getLanguageConfig,
  SUPPORTED_LANGUAGES,
  type SupportedLanguageCode,
} from './config.js';
import { createFormatters, type Formatters } from './formatters.js';
import { useI18nStore, type I18nState } from './i18n-store.js';
import { createTranslator, type Translator } from './translator.js';

export interface UseTranslationResult {
  t: Translator;
  locale: SupportedLanguageCode;
  setLocale: (locale: SupportedLanguageCode) => void;
  direction: 'ltr' | 'rtl';
  isRtl: boolean;
  language: ReturnType<typeof getLanguageConfig>;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
  formatters: Formatters;
}

/**
 * Primary React hook for accessing localization in UI components.
 */
export function useTranslation(): UseTranslationResult {
  const locale = useI18nStore((state: I18nState) => state.locale);
  const direction = useI18nStore((state: I18nState) => state.direction);
  const isRtl = useI18nStore((state: I18nState) => state.isRtl);
  const setLocale = useI18nStore((state: I18nState) => state.setLocale);


  const t = useMemo(() => createTranslator(locale), [locale]);
  const formatters = useMemo(() => createFormatters(locale), [locale]);
  const language = useMemo(() => getLanguageConfig(locale), [locale]);

  return {
    t,
    locale,
    setLocale,
    direction,
    isRtl,
    language,
    supportedLanguages: SUPPORTED_LANGUAGES,
    formatters,
  };
}

