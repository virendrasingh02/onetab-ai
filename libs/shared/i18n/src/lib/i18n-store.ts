import { create } from 'zustand';
import {
  DEFAULT_LANGUAGE,
  getLanguageConfig,
  isSupportedLanguage,
  resolveInitialLanguage,
  type SupportedLanguageCode,
} from './config.js';

export interface I18nState {
  locale: SupportedLanguageCode;
  direction: 'ltr' | 'rtl';
  isRtl: boolean;
  setLocale: (locale: SupportedLanguageCode) => void;
  syncFromUserPreference: (userLocale?: string | null) => void;
}

function applyDomLocale(locale: SupportedLanguageCode): void {
  if (typeof document === 'undefined') return;

  const config = getLanguageConfig(locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = config.direction;

  // Add or remove RTL marker class on body or html for CSS targeting if needed
  if (config.isRtl) {
    document.documentElement.classList.add('rtl');
    document.documentElement.classList.remove('ltr');
  } else {
    document.documentElement.classList.add('ltr');
    document.documentElement.classList.remove('rtl');
  }
}

function getInitialLocale(): SupportedLanguageCode {
  const initial = resolveInitialLanguage();
  if (typeof document !== 'undefined') {
    applyDomLocale(initial);
  }
  return initial;
}

const initialLocale = getInitialLocale();
const initialConfig = getLanguageConfig(initialLocale);

export const useI18nStore = create<I18nState>((set) => ({
  locale: initialLocale,
  direction: initialConfig.direction,
  isRtl: initialConfig.isRtl,

  setLocale: (newLocale: SupportedLanguageCode) => {
    if (!isSupportedLanguage(newLocale)) {
      newLocale = DEFAULT_LANGUAGE;
    }

    const config = getLanguageConfig(newLocale);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('onetab_language', newLocale);
      }
    } catch {
      // Storage access blocked
    }

    applyDomLocale(newLocale);

    set({
      locale: newLocale,
      direction: config.direction,
      isRtl: config.isRtl,
    });
  },

  syncFromUserPreference: (userLocale?: string | null) => {
    if (!userLocale || !isSupportedLanguage(userLocale)) return;

    const config = getLanguageConfig(userLocale);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('onetab_language', userLocale);
      }
    } catch {
      // Storage access blocked
    }

    applyDomLocale(userLocale);

    set({
      locale: userLocale,
      direction: config.direction,
      isRtl: config.isRtl,
    });
  },
}));

