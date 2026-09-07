import { SUPPORTED_LANGUAGE_CODES, type SupportedLanguageCode } from '@org/validation';
import type { LanguageConfig } from './types.js';

export type { SupportedLanguageCode };

export const SUPPORTED_LANGUAGES: readonly LanguageConfig[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    direction: 'ltr',
    localeCode: 'en-US',
    isRtl: false,
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    direction: 'ltr',
    localeCode: 'hi-IN',
    isRtl: false,
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    direction: 'ltr',
    localeCode: 'es-ES',
    isRtl: false,
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    direction: 'ltr',
    localeCode: 'fr-FR',
    isRtl: false,
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    direction: 'ltr',
    localeCode: 'de-DE',
    isRtl: false,
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇧🇷',
    direction: 'ltr',
    localeCode: 'pt-BR',
    isRtl: false,
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    direction: 'ltr',
    localeCode: 'ja-JP',
    isRtl: false,
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    direction: 'ltr',
    localeCode: 'ko-KR',
    isRtl: false,
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '简体中文',
    flag: '🇨🇳',
    direction: 'ltr',
    localeCode: 'zh-CN',
    isRtl: false,
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    direction: 'rtl',
    localeCode: 'ar-SA',
    isRtl: true,
  },
] as const;

export const DEFAULT_LANGUAGE: SupportedLanguageCode = 'en';

export const LANGUAGE_MAP = new Map<SupportedLanguageCode, LanguageConfig>(
  SUPPORTED_LANGUAGES.map((lang) => [lang.code, lang]),
);

export function isSupportedLanguage(code: string): code is SupportedLanguageCode {
  return (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(code);
}

export function getLanguageConfig(code: string): LanguageConfig {
  return LANGUAGE_MAP.get(code as SupportedLanguageCode) || LANGUAGE_MAP.get(DEFAULT_LANGUAGE)!;
}

export function isRtlLanguage(code: string): boolean {
  return getLanguageConfig(code).isRtl;
}

/**
 * Normalizes an arbitrary locale or language tag (e.g. "en-US", "es-419", "zh_CN")
 * to the closest supported language code.
 */
export function normalizeLanguageCode(localeString?: string | null): SupportedLanguageCode | null {
  if (!localeString || typeof localeString !== 'string') return null;
  const cleaned = localeString.trim().toLowerCase().replace('_', '-');
  const baseCode = cleaned.split('-')[0];

  if (isSupportedLanguage(cleaned)) {
    return cleaned;
  }
  if (isSupportedLanguage(baseCode)) {
    return baseCode;
  }
  return null;
}

/**
 * Resolves the initial interface language based on strict precedence:
 * 1. Explicit user preference
 * 2. Stored localStorage choice
 * 3. Desktop shell application locale (Electron bridge)
 * 4. Browser navigator language
 * 5. English default fallback
 */
export function resolveInitialLanguage(explicitLanguage?: string | null): SupportedLanguageCode {
  if (explicitLanguage && isSupportedLanguage(explicitLanguage)) {
    return explicitLanguage;
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('onetab_language');
      if (stored && isSupportedLanguage(stored)) {
        return stored;
      }
    } catch {
      // Storage access blocked or restricted
    }

    // 3. Desktop shell capabilities
    const desktopLocale = (window as unknown as { desktopApi?: { capabilities?: () => { locale?: string } } })
      ?.desktopApi?.capabilities?.()?.locale;
    const matchedDesktop = normalizeLanguageCode(desktopLocale);
    if (matchedDesktop) {
      return matchedDesktop;
    }

    // 4. Browser navigator language
    if (typeof navigator !== 'undefined') {
      const navLang = navigator.language;
      const matchedNav = normalizeLanguageCode(navLang);
      if (matchedNav) {
        return matchedNav;
      }

      if (navigator.languages?.length) {
        for (const lang of navigator.languages) {
          const matched = normalizeLanguageCode(lang);
          if (matched) return matched;
        }
      }
    }
  }

  return DEFAULT_LANGUAGE;
}
