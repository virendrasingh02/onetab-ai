import type { SupportedLanguageCode } from '@org/validation';

export type LanguageDirection = 'ltr' | 'rtl';

export interface LanguageConfig {
  code: SupportedLanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  direction: LanguageDirection;
  localeCode: string;
  isRtl: boolean;
}

export type TranslationParams = Record<string, string | number | boolean | undefined | null>;

export type TranslationFunction = (key: string, params?: TranslationParams) => string;

export interface TranslationDictionary {
  [namespace: string]: {
    [key: string]: string | Record<string, string>;
  };
}

export type TranslationSchema = TranslationDictionary;
export type NestedKeyOf<T> = string;

