/**
 * Public listings mirrored from India's GeM portal.
 * Auctions keep bidding on the source site. Requirements can still be quoted here.
 * A normal BulkSkart listing has none of these fields, and nothing below changes it.
 */

export interface ExternalAuctionInfo {
  /** true when this lot is a public listing rather than a BulkSkart auction */
  external: boolean;
  sourceUrl: string | null;
  sourceName: string | null;
  sellerOrg: string | null;
}

/** Keys the importer writes. They are not product specifications. */
export const EXTERNAL_SPEC_KEYS = ['external_listing', 'source_url', 'source_name', 'seller_org'] as const;

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`)\]}]+/gi;
const BIDPLUS_HOST = /^(www\.)?bidplus\.gem\.gov\.in$/i;

function asText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function specRecord(specifications: unknown): Record<string, unknown> | null {
  if (!specifications) return null;
  if (typeof specifications === 'string') {
    const trimmed = specifications.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
    return null;
  }
  if (typeof specifications === 'object' && !Array.isArray(specifications)) return specifications as Record<string, unknown>;
  return null;
}

/** `external_listing` comes back as the string "true" from SQL ->> and as a boolean from jsonb. */
export function isExternalFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value !== 'string') return false;
  const flag = value.trim().toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function cleanUrl(raw: string): string | null {
  const trimmed = raw.replace(/[.,;:]+$/g, '');
  return isHttpUrl(trimmed) ? trimmed : null;
}

export function urlsInText(value: string | null | undefined): string[] {
  if (!value) return [];
  const found = value.match(URL_IN_TEXT) ?? [];
  const urls: string[] = [];
  for (const raw of found) {
    const url = cleanUrl(raw);
    if (url) urls.push(url);
  }
  return urls;
}

export function isBidplusUrl(value: string | null | undefined): boolean {
  if (!isHttpUrl(value)) return false;
  try {
    return BIDPLUS_HOST.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

function isGemUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return host === 'gem.gov.in' || host.endsWith('.gem.gov.in');
  } catch {
    return false;
  }
}

function firstMatching(urls: string[], pred: (url: string) => boolean): string | null {
  return urls.find(pred) ?? null;
}

/**
 * A public auction: `external_listing` is set, `source_url` is a link, or the description
 * (or the specifications text) contains a GeM link. The button opens that link.
 */
export function readExternalAuction(specifications: unknown, description?: string | null): ExternalAuctionInfo {
  const specs = specRecord(specifications);
  const flagged = isExternalFlag(specs?.external_listing);
  const explicit = cleanUrl(asText(specs?.source_url) ?? '');
  const described = urlsInText(description);
  const specText = typeof specifications === 'string' ? specifications : specs ? JSON.stringify(specs) : '';
  const fromSpecs = urlsInText(specText);
  const gem = firstMatching(described, isGemUrl) ?? firstMatching(fromSpecs, isGemUrl);
  const sourceUrl = explicit ?? gem ?? (flagged ? (described[0] ?? fromSpecs.find((url) => url !== explicit) ?? null) : null);
  const external = flagged || Boolean(explicit) || Boolean(gem);
  return {
    external,
    sourceUrl: external && isHttpUrl(sourceUrl) ? sourceUrl : null,
    sourceName: asText(specs?.source_name),
    sellerOrg: asText(specs?.seller_org),
  };
}

/** "View on GeM", or "View on {source_name}" when the listing names its source. */
export function viewOnSourceLabel(sourceName: string | null | undefined): string {
  const name = (sourceName ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return 'View on GeM';
  if (/^view\s+on\b/i.test(name)) return name;
  return `View on ${name}`;
}

/**
 * A requirement is a government tender when its specifications carry `source_url`
 * or any bidplus.gem.gov.in link. Other text is left alone.
 */
export function gemTenderUrl(specifications: unknown): string | null {
  const specs = specRecord(specifications);
  const explicit = cleanUrl(asText(specs?.source_url) ?? '');
  if (explicit) return explicit;
  const raw = typeof specifications === 'string' ? specifications : specs ? JSON.stringify(specs) : '';
  if (!raw) return null;
  const labeled = raw.match(/source_url\s*[:=]\s*(https?:\/\/[^\s<>"']+)/i);
  if (labeled) {
    const url = cleanUrl(labeled[1]);
    if (url) return url;
  }
  return firstMatching(urlsInText(raw), isBidplusUrl);
}

/** Specifications with the importer's bookkeeping keys removed, for the page to show. */
export function specificationProse(specifications: unknown): string | null {
  if (typeof specifications !== 'string' && !specRecord(specifications)) return null;
  const record = specRecord(specifications);
  if (!record) {
    const text = typeof specifications === 'string' ? specifications.trim() : '';
    return text || null;
  }
  const hidden = new Set<string>(EXTERNAL_SPEC_KEYS);
  const lines = Object.entries(record)
    .filter(([key, value]) => !hidden.has(key) && value !== null && value !== undefined && String(value).trim() !== '')
    .map(([key, value]) => {
      const label = key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      const printed = typeof value === 'string' ? value.trim() : typeof value === 'object' ? '' : String(value);
      return printed ? `${label}: ${printed}` : null;
    })
    .filter((line): line is string => Boolean(line));
  return lines.length ? lines.join('\n') : null;
}

/** A phone the buyer actually saved. Empty means the page must not offer one. */
export function sharedBuyerPhone(phone: string | null | undefined): string | null {
  const trimmed = phone?.trim() ?? '';
  return trimmed || null;
}
