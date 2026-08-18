/**
 * Region, Locale and Timezone mapping utilities.
 */

export interface RegionInfo {
  code: string;
  name: string;
  flag: string;
  defaultTimezone: string;
  defaultDateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  defaultTimeFormat: '12h' | '24h';
  currency: string;
}

export const WORLD_REGIONS: RegionInfo[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸', defaultTimezone: 'America/New_York', defaultDateFormat: 'MM/DD/YYYY', defaultTimeFormat: '12h', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', defaultTimezone: 'Europe/London', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'GBP' },
  { code: 'IN', name: 'India', flag: '🇮🇳', defaultTimezone: 'Asia/Kolkata', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '12h', currency: 'INR' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', defaultTimezone: 'America/Toronto', defaultDateFormat: 'YYYY-MM-DD', defaultTimeFormat: '12h', currency: 'CAD' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', defaultTimezone: 'Australia/Sydney', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '12h', currency: 'AUD' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', defaultTimezone: 'Europe/Berlin', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'EUR' },
  { code: 'FR', name: 'France', flag: '🇫🇷', defaultTimezone: 'Europe/Paris', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'EUR' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', defaultTimezone: 'Asia/Tokyo', defaultDateFormat: 'YYYY-MM-DD', defaultTimeFormat: '24h', currency: 'JPY' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', defaultTimezone: 'Asia/Singapore', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '12h', currency: 'SGD' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', defaultTimezone: 'Asia/Dubai', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '12h', currency: 'AED' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', defaultTimezone: 'Europe/Amsterdam', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'EUR' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', defaultTimezone: 'America/Sao_Paulo', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'BRL' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', defaultTimezone: 'Europe/Zurich', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'CHF' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', defaultTimezone: 'Europe/Stockholm', defaultDateFormat: 'YYYY-MM-DD', defaultTimeFormat: '24h', currency: 'SEK' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', defaultTimezone: 'Europe/Madrid', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'EUR' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', defaultTimezone: 'Europe/Rome', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'EUR' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', defaultTimezone: 'Europe/Dublin', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'EUR' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', defaultTimezone: 'Pacific/Auckland', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '12h', currency: 'NZD' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', defaultTimezone: 'Africa/Johannesburg', defaultDateFormat: 'YYYY-MM-DD', defaultTimeFormat: '24h', currency: 'ZAR' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', defaultTimezone: 'America/Mexico_City', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '12h', currency: 'MXN' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', defaultTimezone: 'Asia/Seoul', defaultDateFormat: 'YYYY-MM-DD', defaultTimeFormat: '24h', currency: 'KRW' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', defaultTimezone: 'Asia/Jakarta', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'IDR' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', defaultTimezone: 'Asia/Hong_Kong', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '12h', currency: 'HKD' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', defaultTimezone: 'Europe/Warsaw', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'PLN' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', defaultTimezone: 'Europe/Oslo', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'NOK' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', defaultTimezone: 'Europe/Copenhagen', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'DKK' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', defaultTimezone: 'Europe/Helsinki', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'EUR' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', defaultTimezone: 'Europe/Lisbon', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'EUR' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', defaultTimezone: 'Europe/Istanbul', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'TRY' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', defaultTimezone: 'Africa/Lagos', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '12h', currency: 'NGN' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', defaultTimezone: 'Africa/Nairobi', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '12h', currency: 'KES' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', defaultTimezone: 'Africa/Cairo', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '12h', currency: 'EGP' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', defaultTimezone: 'Asia/Jerusalem', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'ILS' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', defaultTimezone: 'Asia/Riyadh', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '12h', currency: 'SAR' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', defaultTimezone: 'America/Argentina/Buenos_Aires', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'ARS' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', defaultTimezone: 'America/Santiago', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '24h', currency: 'CLP' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', defaultTimezone: 'America/Bogota', defaultDateFormat: 'DD/MM/YYYY', defaultTimeFormat: '12h', currency: 'COP' },
];

/** Derives the region/flag from an IANA timezone string. */
export function getRegionForTimezone(timezone: string): RegionInfo {
  const normalized = timezone.toLowerCase();
  
  if (normalized.includes('kolkata') || normalized.includes('calcutta') || normalized.includes('india')) {
    return WORLD_REGIONS.find((r) => r.code === 'IN')!;
  }
  if (normalized.includes('new_york') || normalized.includes('chicago') || normalized.includes('los_angeles') || normalized.includes('denver') || normalized.includes('america/')) {
    return WORLD_REGIONS.find((r) => r.code === 'US')!;
  }
  if (normalized.includes('london')) {
    return WORLD_REGIONS.find((r) => r.code === 'GB')!;
  }
  if (normalized.includes('toronto') || normalized.includes('vancouver') || normalized.includes('montreal')) {
    return WORLD_REGIONS.find((r) => r.code === 'CA')!;
  }
  if (normalized.includes('sydney') || normalized.includes('melbourne') || normalized.includes('perth') || normalized.includes('australia')) {
    return WORLD_REGIONS.find((r) => r.code === 'AU')!;
  }
  if (normalized.includes('berlin') || normalized.includes('frankfurt') || normalized.includes('germany')) {
    return WORLD_REGIONS.find((r) => r.code === 'DE')!;
  }
  if (normalized.includes('paris')) {
    return WORLD_REGIONS.find((r) => r.code === 'FR')!;
  }
  if (normalized.includes('tokyo')) {
    return WORLD_REGIONS.find((r) => r.code === 'JP')!;
  }
  if (normalized.includes('singapore')) {
    return WORLD_REGIONS.find((r) => r.code === 'SG')!;
  }
  if (normalized.includes('dubai')) {
    return WORLD_REGIONS.find((r) => r.code === 'AE')!;
  }
  if (normalized.includes('amsterdam')) {
    return WORLD_REGIONS.find((r) => r.code === 'NL')!;
  }
  if (normalized.includes('sao_paulo')) {
    return WORLD_REGIONS.find((r) => r.code === 'BR')!;
  }
  if (normalized.includes('zurich')) {
    return WORLD_REGIONS.find((r) => r.code === 'CH')!;
  }

  // Fallback match by country in timezone name
  for (const r of WORLD_REGIONS) {
    if (normalized.includes(r.defaultTimezone.toLowerCase())) {
      return r;
    }
  }

  // Generic fallback
  return {
    code: 'GLOBAL',
    name: 'Global / UTC',
    flag: '🌐',
    defaultTimezone: 'UTC',
    defaultDateFormat: 'YYYY-MM-DD',
    defaultTimeFormat: '24h',
    currency: 'USD',
  };
}

export type WorkingHoursStatus = 'working' | 'off-hours' | 'sleeping';

export interface WorkingHoursInfo {
  status: WorkingHoursStatus;
  label: string;
  hourInZone: number;
  localTimeFormatted: string;
  icon: string;
}

/**
 * Calculates whether a given timezone is currently in working hours (default: 9am - 6pm),
 * off-hours (6pm - 11pm, 7am - 9am), or sleeping (11pm - 7am).
 */
export function getWorkingHoursStatus(
  timezone: string,
  date: Date = new Date(),
  workStartHour = 9,
  workEndHour = 18,
): WorkingHoursInfo {
  let hour = 12;
  let formattedTime = '12:00';

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '12');
    const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
    hour = h % 24;
    formattedTime = `${String(hour).padStart(2, '0')}:${m}`;
  } catch {
    hour = date.getUTCHours();
    formattedTime = `${String(hour).padStart(2, '0')}:00`;
  }

  if (hour >= workStartHour && hour < workEndHour) {
    return {
      status: 'working',
      label: 'In working hours',
      hourInZone: hour,
      localTimeFormatted: formattedTime,
      icon: '☀️',
    };
  }

  if (hour >= 23 || hour < 7) {
    return {
      status: 'sleeping',
      label: 'Sleeping (Late Night)',
      hourInZone: hour,
      localTimeFormatted: formattedTime,
      icon: '💤',
    };
  }

  return {
    status: 'off-hours',
    label: 'Outside working hours',
    hourInZone: hour,
    localTimeFormatted: formattedTime,
    icon: '🌙',
  };
}
