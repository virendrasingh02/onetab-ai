import { arLocale as ar } from './ar.js';
import { deLocale as de } from './de.js';
import { enLocale as en } from './en.js';
import { esLocale as es } from './es.js';
import { frLocale as fr } from './fr.js';
import { hiLocale as hi } from './hi.js';
import { jaLocale as ja } from './ja.js';
import { koLocale as ko } from './ko.js';
import { ptLocale as pt } from './pt.js';
import { zhLocale as zh } from './zh.js';
import type { TranslationSchema } from '../types.js';
import type { SupportedLanguageCode } from '../config.js';

export { ar, de, en, es, fr, hi, ja, ko, pt, zh };

export const LOCALES: Record<SupportedLanguageCode, TranslationSchema> = {
  en,
  hi,
  es,
  fr,
  de,
  pt,
  ja,
  ko,
  zh,
  ar,
};

