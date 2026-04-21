import ar from './ar.json';
import de from './de.json';
import en from './en.json';
import fr from './fr.json';
import id from './id.json';
import it from './it.json';
import ja from './ja.json';
import ko from './ko.json';
import nl from './nl.json';
import pl from './pl.json';
import pt from './pt.json';
import ru from './ru.json';
import sv from './sv.json';
import tr from './tr.json';
import uk from './uk.json';
import vi from './vi.json';
import zh from './zh.json';

/** localStorage key for the active UI language */
export const LANGUAGE_STORAGE_KEY = 'nginx-warden.i18n.language';

export const DEFAULT_LOCALE = 'en' as const;

/**
 * Single registry for shipped languages. To add one:
 * 1. Add `src/locales/<code>.json` (copy `en.json`, translate values).
 * 2. Import the JSON above and append one object to this array.
 * 3. Add the same code to `apps/api/src/shared/constants/ui-languages.constants.ts` (profile language validation).
 *
 * `nativeLabel` is how the language appears in language dropdowns (always in that
 * language’s own script, independent of the active UI locale). Prefer it over i18n keys.
 */
const LOCALES = [
  { code: 'en', label: 'English', nativeLabel: 'English', translation: en },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', translation: ar },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', translation: de },
  { code: 'fr', label: 'French', nativeLabel: 'Français', translation: fr },
  { code: 'id', label: 'Indonesian', nativeLabel: 'Bahasa Indonesia', translation: id },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano', translation: it },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', translation: ja },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어', translation: ko },
  { code: 'nl', label: 'Dutch', nativeLabel: 'Nederlands', translation: nl },
  { code: 'pl', label: 'Polish', nativeLabel: 'Polski', translation: pl },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', translation: pt },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский', translation: ru },
  { code: 'sv', label: 'Swedish', nativeLabel: 'Svenska', translation: sv },
  { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe', translation: tr },
  { code: 'uk', label: 'Ukrainian', nativeLabel: 'Українська', translation: uk },
  { code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt', translation: vi },
  { code: 'zh', label: 'Chinese', nativeLabel: '简体中文', translation: zh },
] as const;

export const SUPPORTED_LOCALES = LOCALES.map(({ code, label, nativeLabel }) => ({
  code,
  label,
  nativeLabel,
}));

export type LocaleCode = (typeof LOCALES)[number]['code'];

/** i18next resource map */
export const localeResources = Object.fromEntries(
  LOCALES.map((l) => [l.code, { translation: l.translation }])
) as Record<LocaleCode, { translation: typeof en }>;

/** Keys in the default English bundle — use for typed `t()` keys where helpful */
export type TranslationKey = keyof typeof en;

const localeCodes = new Set<string>(LOCALES.map((l) => l.code));

export function isLocaleCode(value: string): value is LocaleCode {
  return localeCodes.has(value);
}

export function getStoredLocale(): LocaleCode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!raw || !isLocaleCode(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}
