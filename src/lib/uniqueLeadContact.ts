/**
 * Deterministic unique contact details for RFQ / lead cards.
 * Same seed always yields the same phone, dial code, and date — no Math.random flicker.
 */

export interface LeadContactDial {
  country: string;
  dialCode: string; // e.g. "+91"
  iso2: string;
  flag: string;
  nationalLength: number;
}

const DIAL_BY_COUNTRY: Record<string, LeadContactDial> = {
  india: { country: 'India', dialCode: '+91', iso2: 'IN', flag: '🇮🇳', nationalLength: 10 },
  usa: { country: 'USA', dialCode: '+1', iso2: 'US', flag: '🇺🇸', nationalLength: 10 },
  'united states': { country: 'USA', dialCode: '+1', iso2: 'US', flag: '🇺🇸', nationalLength: 10 },
  uae: { country: 'UAE', dialCode: '+971', iso2: 'AE', flag: '🇦🇪', nationalLength: 9 },
  'united arab emirates': { country: 'UAE', dialCode: '+971', iso2: 'AE', flag: '🇦🇪', nationalLength: 9 },
  germany: { country: 'Germany', dialCode: '+49', iso2: 'DE', flag: '🇩🇪', nationalLength: 10 },
  uk: { country: 'UK', dialCode: '+44', iso2: 'GB', flag: '🇬🇧', nationalLength: 10 },
  'united kingdom': { country: 'UK', dialCode: '+44', iso2: 'GB', flag: '🇬🇧', nationalLength: 10 },
  australia: { country: 'Australia', dialCode: '+61', iso2: 'AU', flag: '🇦🇺', nationalLength: 9 },
  japan: { country: 'Japan', dialCode: '+81', iso2: 'JP', flag: '🇯🇵', nationalLength: 10 },
  'south korea': { country: 'South Korea', dialCode: '+82', iso2: 'KR', flag: '🇰🇷', nationalLength: 10 },
  korea: { country: 'South Korea', dialCode: '+82', iso2: 'KR', flag: '🇰🇷', nationalLength: 10 },
  singapore: { country: 'Singapore', dialCode: '+65', iso2: 'SG', flag: '🇸🇬', nationalLength: 8 },
  china: { country: 'China', dialCode: '+86', iso2: 'CN', flag: '🇨🇳', nationalLength: 11 },
  france: { country: 'France', dialCode: '+33', iso2: 'FR', flag: '🇫🇷', nationalLength: 9 },
  italy: { country: 'Italy', dialCode: '+39', iso2: 'IT', flag: '🇮🇹', nationalLength: 10 },
  turkey: { country: 'Turkey', dialCode: '+90', iso2: 'TR', flag: '🇹🇷', nationalLength: 10 },
  brazil: { country: 'Brazil', dialCode: '+55', iso2: 'BR', flag: '🇧🇷', nationalLength: 11 },
  vietnam: { country: 'Vietnam', dialCode: '+84', iso2: 'VN', flag: '🇻🇳', nationalLength: 9 },
  thailand: { country: 'Thailand', dialCode: '+66', iso2: 'TH', flag: '🇹🇭', nationalLength: 9 },
  sweden: { country: 'Sweden', dialCode: '+46', iso2: 'SE', flag: '🇸🇪', nationalLength: 9 },
  'saudi arabia': { country: 'Saudi Arabia', dialCode: '+966', iso2: 'SA', flag: '🇸🇦', nationalLength: 9 },
  kenya: { country: 'Kenya', dialCode: '+254', iso2: 'KE', flag: '🇰🇪', nationalLength: 9 },
  'south africa': { country: 'South Africa', dialCode: '+27', iso2: 'ZA', flag: '🇿🇦', nationalLength: 9 },
  qatar: { country: 'Qatar', dialCode: '+974', iso2: 'QA', flag: '🇶🇦', nationalLength: 8 },
  canada: { country: 'Canada', dialCode: '+1', iso2: 'CA', flag: '🇨🇦', nationalLength: 10 },
};

const DIAL_POOL = Object.values(
  Object.fromEntries(Object.values(DIAL_BY_COUNTRY).map((d) => [d.iso2, d]))
);

/** Valid mobile prefix pools per market (realistic, not sequential) */
const PREFIX_POOLS: Record<string, string[]> = {
  IN: ['7000', '7012', '7089', '8011', '8099', '8123', '8765', '9012', '9123', '9876', '9988', '9600'],
  US: ['201', '212', '305', '312', '404', '415', '512', '617', '702', '713', '818', '917'],
  AE: ['50', '52', '54', '55', '56', '58'],
  DE: ['151', '152', '160', '170', '171', '175', '176', '179'],
  GB: ['7400', '7401', '7700', '7780', '7800', '7900', '7911'],
  AU: ['40', '41', '42', '43', '45', '47', '48', '49'],
  JP: ['70', '80', '90'],
  KR: ['10', '11'],
  SG: ['8', '9'],
  CN: ['130', '131', '135', '136', '138', '150', '151', '186', '188'],
  FR: ['6', '7'],
  IT: ['32', '33', '34', '35', '36', '37', '38', '39'],
  TR: ['50', '53', '54', '55'],
  BR: ['11', '21', '31', '41', '51', '61'],
  VN: ['90', '91', '93', '96', '97', '98'],
  TH: ['8', '9'],
  SE: ['70', '72', '73', '76'],
  SA: ['50', '53', '54', '55', '56', '58', '59'],
  KE: ['70', '71', '72', '74', '79'],
  ZA: ['60', '71', '72', '73', '74', '76', '82', '83'],
  QA: ['33', '55', '66', '77'],
  CA: ['204', '236', '306', '416', '437', '514', '604', '647', '778', '780', '905'],
};

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function resolveDialForCountry(country?: string | null, seed = ''): LeadContactDial {
  const key = (country || '').trim().toLowerCase();
  if (key && DIAL_BY_COUNTRY[key]) return DIAL_BY_COUNTRY[key];
  // Fuzzy contains match
  for (const [k, dial] of Object.entries(DIAL_BY_COUNTRY)) {
    if (key.includes(k) || k.includes(key)) return dial;
  }
  // Deterministic fallback from seed so cards still vary
  const h = hashSeed(seed || key || 'bulkskart');
  return DIAL_POOL[h % DIAL_POOL.length];
}

function buildNationalDigits(iso2: string, seed: string, length: number): string {
  const h = hashSeed(`${seed}:${iso2}:phone`);
  const prefixes = PREFIX_POOLS[iso2] || PREFIX_POOLS.IN;
  const prefix = prefixes[h % prefixes.length];
  let rest = '';
  let x = h;
  while (prefix.length + rest.length < length) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    rest += String(x % 10);
  }
  return (prefix + rest).slice(0, length);
}

function groupDigits(national: string): string {
  if (national.length <= 4) return national;
  const parts: string[] = [];
  let index = 0;
  while (national.length - index > 4) {
    const remaining = national.length - index;
    const take = remaining % 4 === 1 ? 3 : 4;
    parts.push(national.slice(index, index + take));
    index += take;
  }
  parts.push(national.slice(index));
  return parts.join(' ');
}

function formatNational(iso2: string, national: string): string {
  if (iso2 === 'IN' && national.length === 10) {
    return `${national.slice(0, 5)} ${national.slice(5)}`;
  }
  if ((iso2 === 'US' || iso2 === 'CA') && national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  if (iso2 === 'AE' && national.length >= 9) {
    return `${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
  }
  if (iso2 === 'GB' && national.length >= 10) {
    return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
  }
  if (iso2 === 'JP' && national.length >= 10) {
    return `${national.slice(0, 2)} ${national.slice(2, 6)} ${national.slice(6)}`;
  }
  if (iso2 === 'FR' && national.length >= 9) {
    return `${national.slice(0, 1)} ${national.slice(1, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7)}`;
  }
  if (iso2 === 'DE' && national.length >= 10) {
    return `${national.slice(0, 3)} ${national.slice(3)}`;
  }
  if (iso2 === 'QA' && national.length >= 8) {
    return `${national.slice(0, 4)} ${national.slice(4)}`;
  }
  if (iso2 === 'AU' && national.length >= 9) {
    return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  }
  if ((iso2 === 'IT' || iso2 === 'SA' || iso2 === 'ZA' || iso2 === 'KE') && national.length >= 9) {
    return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  }
  return groupDigits(national);
}

export function maskNational(iso2: string, national: string, dialCode: string): string {
  if (iso2 === 'IN' && national.length >= 4) {
    return `${dialCode} ${national.slice(0, 4)}… ****`;
  }
  if ((iso2 === 'US' || iso2 === 'CA') && national.length >= 3) {
    return `${dialCode} (${national.slice(0, 3)}) •••-••••`;
  }
  if (iso2 === 'AE' && national.length >= 2) {
    return `${dialCode} ${national.slice(0, 2)} ••• ••••`;
  }
  const visible = Math.min(4, Math.max(2, Math.floor(national.length / 3)));
  return `${dialCode} ${national.slice(0, visible)}… ****`;
}

/** Unique deadline date derived from seed when RFQ has no deadline */
export function uniqueLeadDeadline(seed: string, baseDate = new Date()): string {
  const h = hashSeed(`${seed}:deadline`);
  const daysAhead = 7 + (h % 45); // 7–51 days out
  const d = new Date(baseDate);
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function formatLeadDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export interface UniqueLeadContact {
  country: string;
  dialCode: string;
  iso2: string;
  flag: string;
  /** Full E.164-ish display for unlocked paid view */
  phone: string;
  /** Digits only including country code */
  e164Digits: string;
  /** Masked preview for unpaid cards */
  maskedPhone: string;
  /** ISO deadline (existing or generated) */
  deadline: string;
  deadlineLabel: string;
}

/**
 * Build unique contact + date for a lead card.
 * Prefer real phone/deadline when provided; always unique when synthesizing.
 */
export function getUniqueLeadContact(opts: {
  seed: string;
  country?: string | null;
  phone?: string | null;
  deadline?: string | null;
}): UniqueLeadContact {
  const seed = opts.seed || 'lead';
  const dial = resolveDialForCountry(opts.country, seed);
  const national = buildNationalDigits(dial.iso2, seed, dial.nationalLength);
  const formattedNational = formatNational(dial.iso2, national);
  const synthesizedPhone = `${dial.dialCode} ${formattedNational}`;
  const synthesizedDigits = `${dial.dialCode.replace('+', '')}${national}`;

  const rawPhone = (opts.phone && String(opts.phone).trim()) || '';
  const phone = rawPhone || synthesizedPhone;
  const e164Digits = rawPhone
    ? rawPhone.replace(/\D/g, '')
    : synthesizedDigits;

  // Mask from actual or synthesized digits so every card differs
  const nationalForMask = (() => {
    const digits = e164Digits;
    const dialDigits = dial.dialCode.replace('+', '');
    if (digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
      return digits.slice(dialDigits.length);
    }
    return digits.slice(-dial.nationalLength) || national;
  })();

  const maskedPhone = maskNational(dial.iso2, nationalForMask, dial.dialCode);
  const deadline = opts.deadline || uniqueLeadDeadline(seed);
  const deadlineLabel = formatLeadDate(deadline);

  return {
    country: opts.country?.trim() || dial.country,
    dialCode: dial.dialCode,
    iso2: dial.iso2,
    flag: dial.flag,
    phone,
    e164Digits,
    maskedPhone,
    deadline,
    deadlineLabel,
  };
}
