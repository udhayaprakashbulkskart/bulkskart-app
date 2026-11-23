/**
 * Indian business registration numbers: format checks (the same rules as the database, migration 00071) plus the
 * GSTIN check digit. A number that passes is only well formed; an admin still checks it on the official portal
 * before a business is approved.
 */
import type { EntityType } from './types';

export const ENTITY_TYPES: { value: EntityType; label: string; hint: string }[] = [
  { value: 'private_limited', label: 'Private Limited Company', hint: 'Needs its CIN' },
  { value: 'public_limited', label: 'Public Limited Company', hint: 'Needs its CIN' },
  { value: 'llp', label: 'Limited Liability Partnership (LLP)', hint: 'Needs its LLPIN' },
  { value: 'partnership', label: 'Partnership Firm', hint: 'Needs GSTIN or Udyam' },
  { value: 'proprietorship', label: 'Sole Proprietorship', hint: 'Needs GSTIN or Udyam' },
  { value: 'other', label: 'Other registered business in India', hint: 'Needs GSTIN or Udyam' },
  { value: 'foreign_company', label: 'Business registered outside India', hint: 'Needs its company registration number' },
];

export const entityLabel = (t: EntityType | string | null | undefined): string =>
  ENTITY_TYPES.find((e) => e.value === t)?.label ?? 'Business';

/** Companies and LLPs are incorporated with the MCA; their CIN/LLPIN is the proof, not a GSTIN. */
export const isIncorporated = (t: EntityType): boolean => t === 'private_limited' || t === 'public_limited' || t === 'llp';
/** Registered in another country: checked in that country's official company registry. */
export const isForeign = (t: EntityType | ''): boolean => t === 'foreign_company';

/** A company registry / business licence / tax number from any country: letters, digits, spaces, dots, dashes, slashes. */
export const checkRegistrationNumber = (raw: string): string | null =>
  /^[A-Z0-9][A-Z0-9 ./-]{2,49}$/.test(raw.trim().toUpperCase()) ? null : 'Enter the registration number exactly as on the certificate (3 to 50 letters or digits)';

const GSTIN = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CIN = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}(PLC|PTC|GOI|SGC|FTC|GAP|GAT|NPL|ULL|ULT|OPC|FLC)[0-9]{6}$/;
const LLPIN = /^(AA[A-Z]-[0-9]{4}|FLLP-[0-9]{4})$/;
const UDYAM = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
const CODE = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const normalise = (v: string): string => v.trim().toUpperCase().replace(/\s+/g, '');

/** The 15th character of a GSTIN, computed from the first 14 (GSTN's published mod-36 scheme). */
export function gstinCheckChar(first14: string): string | null {
  if (first14.length !== 14) return null;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CODE.indexOf(first14[i]);
    if (v < 0) return null;
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CODE[(36 - (sum % 36)) % 36];
}

export function checkGstin(raw: string): string | null {
  const v = normalise(raw);
  if (!GSTIN.test(v)) return 'A GSTIN has 15 characters, like 33ABCDE1234F1Z5';
  if (gstinCheckChar(v.slice(0, 14)) !== v[14]) return 'This GSTIN has a typing mistake (its last character does not match)';
  return null;
}
export const checkCin = (raw: string): string | null =>
  CIN.test(normalise(raw)) ? null : 'A CIN has 21 characters, like U12345TN2020PTC123456';
export const checkLlpin = (raw: string): string | null =>
  LLPIN.test(normalise(raw)) ? null : 'An LLPIN looks like AAB-1234';
export const checkUdyam = (raw: string): string | null =>
  UDYAM.test(normalise(raw)) ? null : 'A Udyam number looks like UDYAM-TN-01-1234567';

/** The PAN inside a GSTIN (characters 3 to 12). */
export const panFromGstin = (gstin: string): string => normalise(gstin).slice(2, 12);

export interface ApplicationInput {
  entity_type: EntityType | '';
  legal_name: string;
  cin_llpin: string;
  gstin: string;
  udyam_number: string;
  registration_country: string;
  registration_number: string;
  registered_address: string;
  factory_address: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  documentCount: number;
}

/** Field -> message for everything that would make the database refuse the application. */
export function validateApplication(a: ApplicationInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (!a.entity_type) e.entity_type = 'Choose how the business is registered';
  if (!a.legal_name.trim()) e.legal_name = 'Enter the legal name exactly as registered';
  if (!a.registered_address.trim()) e.registered_address = 'Enter the registered office address';
  if (!a.factory_address.trim()) e.factory_address = 'Enter the factory address';
  if (!a.contact_name.trim()) e.contact_name = 'Enter a contact person';
  if (!/^\+?[0-9][0-9\s-]{7,15}$/.test(a.contact_phone.trim())) e.contact_phone = 'Enter a phone number';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.contact_email.trim())) e.contact_email = 'Enter an email address';
  if (a.entity_type === 'foreign_company') {
    if (!a.registration_country.trim() || a.registration_country.trim().toLowerCase() === 'india') e.registration_country = 'Choose the country where the business is registered';
    const m = a.registration_number.trim() ? checkRegistrationNumber(a.registration_number) : 'Enter the company registration number';
    if (m) e.registration_number = m;
  } else if (a.entity_type === 'private_limited' || a.entity_type === 'public_limited') {
    const m = a.cin_llpin.trim() ? checkCin(a.cin_llpin) : 'A company needs its CIN';
    if (m) e.cin_llpin = m;
  } else if (a.entity_type === 'llp') {
    const m = a.cin_llpin.trim() ? checkLlpin(a.cin_llpin) : 'An LLP needs its LLPIN';
    if (m) e.cin_llpin = m;
  }
  if (a.gstin.trim() && !isForeign(a.entity_type)) {
    const m = checkGstin(a.gstin);
    if (m) e.gstin = m;
  }
  if (a.udyam_number.trim() && !isForeign(a.entity_type)) {
    const m = checkUdyam(a.udyam_number);
    if (m) e.udyam_number = m;
  }
  if (a.entity_type && !isIncorporated(a.entity_type) && !isForeign(a.entity_type) && !a.gstin.trim() && !a.udyam_number.trim()) {
    e.gstin = 'Enter a GSTIN or a Udyam number';
  }
  if (a.documentCount === 0) e.documents = 'Attach at least one registration document';
  return e;
}

/** Messages for the codes the database functions raise. */
const DB_ERRORS: Record<string, string> = {
  not_authenticated: 'Please sign in again.',
  company_required: 'Create your business profile first.',
  invalid_entity_type: 'Choose how the business is registered.',
  missing_details: 'Fill in every required field.',
  cin_required: 'A company needs a valid CIN.',
  llpin_required: 'An LLP needs a valid LLPIN.',
  invalid_gstin: 'The GSTIN is not valid.',
  invalid_udyam: 'The Udyam number is not valid.',
  gst_or_udyam_required: 'Enter a GSTIN or a Udyam number.',
  registration_country_required: 'Choose the country where the business is registered.',
  registration_number_required: 'Enter the company registration number exactly as on the certificate.',
  registry_not_verified: 'Tick "registration checked" after checking the business in its country\'s official company registry.',
  documents_required: 'Attach at least one registration document.',
  invalid_document_path: 'A document could not be attached. Upload it again.',
  suspended_contact_support: 'This business is suspended. Contact BulkSkart support.',
  invalid_location: 'Place the pin on the map.',
  address_required: 'Enter the factory address.',
  location_first: 'Save the factory location first.',
  admin_only: 'Only admins can do this.',
  application_not_found: 'This application no longer exists.',
  location_not_found: 'This factory location no longer exists.',
  cin_not_verified: 'Tick "CIN/LLPIN checked" after checking it on the MCA portal. A company cannot be approved on its GSTIN alone.',
  registration_not_verified: 'Tick the GSTIN or Udyam number you checked on the official portal before approving.',
  note_required: 'Write a reason. The business sees it.',
  invalid_decision: 'Unknown decision.',
};

export function mapDbError(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return '';
  const msg = err.message ?? '';
  for (const [code, text] of Object.entries(DB_ERRORS)) if (msg.includes(code)) return text;
  if (err.code === 'PGRST202' || /Could not find the function/i.test(msg)) {
    return 'The supplier map is not switched on yet: an admin needs to run database update 00071.';
  }
  return 'Something went wrong. Please try again.';
}
