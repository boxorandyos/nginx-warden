/**
 * UI locale codes shipped by apps/web `src/locales/*.json`.
 * Keep in sync with `apps/web/src/locales/index.ts` LOCALES.
 */
export const SUPPORTED_UI_LANGUAGE_CODES = [
  'en',
  'ar',
  'de',
  'fr',
  'id',
  'it',
  'ja',
  'ko',
  'nl',
  'pl',
  'pt',
  'ru',
  'sv',
  'tr',
  'uk',
  'vi',
  'zh',
] as const;

export type SupportedUiLanguageCode = (typeof SUPPORTED_UI_LANGUAGE_CODES)[number];
