import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LOCALE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  getStoredLocale,
  localeResources,
} from '@/locales';

function persistLanguage(lng: string) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    }
  } catch {
    /* quota / private mode */
  }
}

const initialLng = getStoredLocale() ?? DEFAULT_LOCALE;

i18n.use(initReactI18next).init({
  resources: localeResources,
  lng: initialLng,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LOCALES.map((l) => l.code),
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

i18n.on('languageChanged', (lng: string) => {
  persistLanguage(lng);
});

export default i18n;
