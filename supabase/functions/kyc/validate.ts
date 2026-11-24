/**
 * Format checks shared by the KYC edge function and the website (src/lib/loanKyc). No network, no secrets.
 * A value that passes these checks is only well-formed: it is verified only by the provider or an admin review.
 */

export const KYC_STEPS = ['pan', 'aadhaar', 'business', 'bank', 'review'] as const;
export type KycStep = (typeof KYC_STEPS)[number];

export const KYC_STATUSES = ['not_started', 'pending', 'in_progress', 'verified', 'rejected', 'resubmission_required'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const ENTITY_TYPES = ['proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited', 'other'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const DOCUMENT_TYPES = {
  pan_card: { step: 'pan', label: 'PAN card' },
  gst_certificate: { step: 'business', label: 'GST registration certificate' },
  udyam_certificate: { step: 'business', label: 'Udyam registration certificate' },
  incorporation_certificate: { step: 'business', label: 'Certificate of incorporation' },
  partnership_deed: { step: 'business', label: 'Partnership deed' },
  business_pan_card: { step: 'business', label: 'Business PAN card' },
  cancelled_cheque: { step: 'bank', label: 'Cancelled cheque' },
  bank_statement: { step: 'bank', label: 'Bank statement (last 6 months)' },
  other: { step: 'other', label: 'Other document' },
} as const;
export type DocumentType = keyof typeof DOCUMENT_TYPES;

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

const clean = (v: unknown) => String(v ?? '').toUpperCase().replace(/[\s-]/g, '');

export function normalisePan(v: unknown): string {
  return clean(v);
}
export function isValidPan(v: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v);
}
/** 4th character: P person, C company, F firm/LLP, H HUF, A AOP, T trust, B BOI, L local authority, J juridical person, G government. */
export function panHolderKind(pan: string): 'person' | 'business' | 'other' {
  const c = pan[3];
  if (c === 'P') return 'person';
  if ('CFH'.includes(c)) return 'business';
  return 'other';
}
/** AB XXXXXX 4F: first two and last two characters. */
export function maskPan(pan: string): string {
  return `${pan.slice(0, 2)}XXXXXX${pan.slice(8)}`;
}

const A36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function normaliseGstin(v: unknown): string {
  return clean(v);
}
export function isValidGstin(v: string): boolean {
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)) return false;
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const p = A36.indexOf(v[i]) * (i % 2 ? 2 : 1);
    total += Math.floor(p / 36) + (p % 36);
  }
  return A36[(36 - (total % 36)) % 36] === v[14];
}
export function panOfGstin(gstin: string): string {
  return gstin.slice(2, 12);
}

export function normaliseIfsc(v: unknown): string {
  return clean(v);
}
export function isValidIfsc(v: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);
}

export function normaliseAccount(v: unknown): string {
  return clean(v);
}
export function isValidAccount(v: string): boolean {
  return /^[0-9A-Z]{6,40}$/.test(v) && /[0-9]{4}$/.test(v);
}

export function normaliseUdyam(v: unknown): string {
  const s = String(v ?? '').toUpperCase().replace(/\s/g, '');
  const m = s.match(/^UDYAM-?([A-Z]{2})-?([0-9]{2})-?([0-9]{7})$/);
  return m ? `UDYAM-${m[1]}-${m[2]}-${m[3]}` : s;
}
export function isValidUdyam(v: string): boolean {
  return /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/.test(v);
}

export function normaliseCin(v: unknown): string {
  const s = String(v ?? '').toUpperCase().replace(/\s/g, '');
  return /^[A-Z]{3}-?[0-9]{4}$/.test(s) ? `${s.slice(0, 3)}-${s.slice(-4)}` : s;
}
/** Company CIN (21 characters) or LLP identification number (AAA-1234). */
export function isValidCin(v: string): boolean {
  return /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(v) || /^[A-Z]{3}-[0-9]{4}$/.test(v);
}

export function cleanName(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}
export function isValidPersonName(v: string): boolean {
  return v.length >= 2 && v.length <= 120 && /^[A-Za-z][A-Za-z .'-]*$/.test(v);
}
export function isValidBusinessName(v: string): boolean {
  return v.length >= 2 && v.length <= 160 && /[A-Za-z]/.test(v);
}

/** What the file really is, from its first bytes (the browser's type and the file name are not trusted). */
export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 5 && [0x25, 0x50, 0x44, 0x46, 0x2d].every((b, i) => bytes[i] === b)) return 'application/pdf';
  return null;
}

/** A safe display name for an uploaded file: letters, digits, dot, dash, underscore; at most 120 characters. */
export function safeFileName(name: string, mime: AllowedMime): string {
  const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg';
  const base = String(name || 'document').replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+/, '').slice(0, 100) || 'document';
  return `${base}.${ext}`;
}
