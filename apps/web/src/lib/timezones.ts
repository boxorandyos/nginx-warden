/**
 * Default profile timezone for US-centric demos and when the API omits a zone.
 */
export const DEFAULT_TIMEZONE = 'America/New_York' as const;

/** Used only when `Intl.supportedValuesOf('timeZone')` is unavailable (legacy runtimes). */
const FALLBACK_IANA_TIME_ZONES: readonly string[] = [
  'UTC',
  'America/Adak',
  'America/Anchorage',
  'America/Boise',
  'America/Chicago',
  'America/Denver',
  'America/Detroit',
  'America/Indiana/Indianapolis',
  'America/Indiana/Knox',
  'America/Indiana/Marengo',
  'America/Indiana/Petersburg',
  'America/Indiana/Tell_City',
  'America/Indiana/Vevay',
  'America/Indiana/Vincennes',
  'America/Indiana/Winamac',
  'America/Juneau',
  'America/Kentucky/Louisville',
  'America/Kentucky/Monticello',
  'America/Los_Angeles',
  'America/Menominee',
  'America/Metlakatla',
  'America/New_York',
  'America/Nome',
  'America/North_Dakota/Beulah',
  'America/North_Dakota/Center',
  'America/North_Dakota/New_Salem',
  'America/Phoenix',
  'America/Sitka',
  'America/Yakutat',
  'America/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
];

let cachedIds: string[] | null = null;

/**
 * All IANA time zone identifiers available in this JS engine (typically 400+),
 * sorted for stable UI. Falls back to a short list if the API is missing.
 */
export function getIanaTimeZoneIds(): string[] {
  if (cachedIds) return cachedIds;
  try {
    const intl = Intl as typeof Intl & {
      supportedValuesOf?: (key: 'timeZone') => string[];
    };
    if (typeof intl.supportedValuesOf === 'function') {
      cachedIds = [...intl.supportedValuesOf('timeZone')].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );
      return cachedIds;
    }
  } catch {
    /* invalid engine */
  }
  cachedIds = [...FALLBACK_IANA_TIME_ZONES];
  return cachedIds;
}

/** Single-line label for the trigger (IANA id + current UTC offset when supported). */
export function formatTimezoneChoice(id: string, locale: string): string {
  if (!id) return '';
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: id,
      timeZoneName: 'shortOffset',
    }).formatToParts(now);
    const off = parts.find((p) => p.type === 'timeZoneName')?.value;
    return off ? `${id} (${off})` : id;
  } catch {
    return id;
  }
}
