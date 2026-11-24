/**
 * KYC logic with no Deno or Supabase imports, so it can be tested with Vitest:
 *  - which checks are configured ("Integration Pending" otherwise),
 *  - AES-256-GCM encryption of documents and numbers, keyed hashes,
 *  - Cashfree Secure ID requests (PAN, GSTIN, bank account, DigiLocker for Aadhaar) and strict reading of the answers.
 *
 * Reading the answers fails safe: only the exact fields the provider documents as "valid" can produce 'verified', and
 * anything unexpected becomes 'error' (try again) or 'review' (an admin decides). A sandbox answer is never a
 * verification: it becomes 'test_only'.
 *
 * API reference: https://www.cashfree.com/docs/api-reference/vrs/overview (read 24 Nov 2026).
 */
import { panOfGstin } from './validate.ts';

export type Outcome = 'verified' | 'review' | 'invalid' | 'error' | 'integration_pending' | 'test_only' | 'requested' | 'expired' | 'consent_denied';
export type CheckName = 'pan' | 'aadhaar' | 'gstin' | 'bank';

export interface Interpretation {
  outcome: Outcome;
  message: string | null;
  /** Values the step keeps (never full numbers). */
  fields: Record<string, string | number | null>;
  /** Minimal record of the provider's answer for the history (never full numbers, photos, addresses or dates of birth). */
  result: Record<string, unknown>;
  providerRef: string | null;
}

export interface KycConfig {
  provider: 'cashfree' | null;
  environment: 'production' | 'sandbox' | null;
  baseUrl: string | null;
  clientId: string | null;
  clientSecret: string | null;
  publicKeyPem: string | null;
  encryptionKey: string | null;
  keyId: string;
  siteUrl: string;
  companyName: string;
  disabled: Set<string>;
}

type Env = Record<string, string | undefined>;

export function readConfig(env: Env): KycConfig {
  const id = env.CASHFREE_VERIFICATION_CLIENT_ID?.trim() || null;
  const secret = env.CASHFREE_VERIFICATION_CLIENT_SECRET?.trim() || null;
  const envName = env.CASHFREE_VERIFICATION_ENV?.trim().toLowerCase();
  const environment = envName === 'production' || envName === 'sandbox' ? envName : null;
  const ready = Boolean(id && secret && environment);
  return {
    provider: ready ? 'cashfree' : null,
    environment: ready ? environment : null,
    baseUrl: ready ? (environment === 'production' ? 'https://api.cashfree.com/verification' : 'https://sandbox.cashfree.com/verification') : null,
    clientId: id,
    clientSecret: secret,
    publicKeyPem: env.CASHFREE_VERIFICATION_PUBLIC_KEY?.trim() || null,
    encryptionKey: env.KYC_ENCRYPTION_KEY?.trim() || null,
    keyId: env.KYC_ENCRYPTION_KEY_ID?.trim() || 'k1',
    siteUrl: (env.KYC_SITE_URL?.trim() || 'https://www.bulkskart.com').replace(/\/+$/, ''),
    companyName: env.KYC_COMPANY_NAME?.trim() || 'BulkSkart',
    disabled: new Set((env.KYC_DISABLED_CHECKS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)),
  };
}

/** What the website shows: each check is either live (production or sandbox) or "integration_pending". */
export function integrationStatus(c: KycConfig): Record<CheckName | 'documents', 'production' | 'sandbox' | 'integration_pending'> {
  const storage = c.encryptionKey && validKeyLength(c.encryptionKey) ? 'production' : 'integration_pending';
  const check = (name: CheckName) => (storage === 'production' && c.provider && c.environment && !c.disabled.has(name) ? c.environment : 'integration_pending');
  return { documents: storage, pan: check('pan'), aadhaar: check('aadhaar'), gstin: check('gstin'), bank: check('bank') };
}

// ── encryption ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
/** WebCrypto input; the cast keeps this compiling on both older and newer TypeScript lib typings. */
const bs = (u: Uint8Array) => u as unknown as BufferSource;
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

function validKeyLength(key: string): boolean {
  try {
    return unb64(key).length === 32;
  } catch {
    return false;
  }
}

export async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = unb64(base64Key);
  if (raw.length !== 32) throw new Error('KYC_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return crypto.subtle.importKey('raw', bs(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptBytes(key: CryptoKey, data: Uint8Array): Promise<{ iv: string; data: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const out = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(iv) }, key, bs(data)));
  return { iv: b64(iv), data: out };
}

export async function decryptBytes(key: CryptoKey, iv: string, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bs(unb64(iv)) }, key, bs(data)));
}

export async function encryptText(key: CryptoKey, text: string): Promise<{ ciphertext: string; iv: string }> {
  const { iv, data } = await encryptBytes(key, new TextEncoder().encode(text));
  return { ciphertext: b64(data), iv };
}

export async function decryptText(key: CryptoKey, ciphertext: string, iv: string): Promise<string> {
  return new TextDecoder().decode(await decryptBytes(key, iv, unb64(ciphertext)));
}

/** HMAC-SHA256 of a value, keyed from the encryption key, so equal numbers can be matched without storing them. */
export async function keyedHash(base64Key: string, purpose: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', bs(unb64(base64Key)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, bs(new TextEncoder().encode(`${purpose}:${value}`))));
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', bs(data)));
}

// ── names ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const NAME_NOISE = new Set(['M/S', 'MS', 'MR', 'MRS', 'MISS', 'DR', 'SHRI', 'SMT', 'KUMARI', 'PVT', 'PRIVATE', 'LTD', 'LIMITED', 'LLP', 'CO', 'COMPANY', 'THE', 'AND', '&', 'INDIA']);
function nameTokens(v: string): string[] {
  return v.toUpperCase().replace(/M\/S/g, ' ').replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t && !NAME_NOISE.has(t));
}
/** Share of the shorter name's words found in the other (an initial matches a word with that first letter, at half weight). */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const x = nameTokens(a || '');
  const y = nameTokens(b || '');
  if (!x.length || !y.length) return 0;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  let score = 0;
  for (const t of short) {
    if (long.includes(t)) score += 1;
    else if (t.length === 1 && long.some((w) => w[0] === t)) score += 0.5;
    else if (long.some((w) => w.length === 1 && w === t[0])) score += 0.5;
  }
  return Math.round((score / short.length) * 100) / 100;
}

const GOOD_MATCH = new Set(['DIRECT_MATCH', 'GOOD_PARTIAL_MATCH']);

// ── Cashfree requests ──────────────────────────────────────────────────────────────────────────────────────────────────
/** x-cf-signature: RSA-OAEP (SHA-1) of "clientId.epochSeconds" with the public key from the Cashfree dashboard, base64. */
export async function cashfreeSignature(publicKeyPem: string, clientId: string, epochSeconds: number): Promise<string> {
  const der = unb64(publicKeyPem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));
  const key = await crypto.subtle.importKey('spki', bs(der), { name: 'RSA-OAEP', hash: 'SHA-1' }, false, ['encrypt']);
  const enc = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, bs(new TextEncoder().encode(`${clientId}.${epochSeconds}`)));
  return b64(new Uint8Array(enc));
}

export async function cashfreeHeaders(c: KycConfig, extra: Record<string, string> = {}, now = Date.now()): Promise<Record<string, string>> {
  if (!c.clientId || !c.clientSecret) throw new Error('integration_pending');
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'x-client-id': c.clientId, 'x-client-secret': c.clientSecret, ...extra };
  if (c.publicKeyPem) h['x-cf-signature'] = await cashfreeSignature(c.publicKeyPem, c.clientId, Math.floor(now / 1000));
  return h;
}

type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const ref = (v: unknown) => (typeof v === 'number' || typeof v === 'string' ? String(v) : null);

function sandboxed(c: KycConfig, i: Interpretation): Interpretation {
  if (c.environment === 'production' || i.outcome === 'error' || i.outcome === 'requested') return i;
  return { ...i, outcome: 'test_only', message: 'Sandbox (test) result: this is not a verification.' };
}

export function errorInterpretation(message: string, status?: number, body?: unknown): Interpretation {
  const b = (body && typeof body === 'object' ? body : {}) as Json;
  return {
    outcome: 'error',
    message: status === 429 ? 'The verification service is busy. Please try again in a minute.' : message,
    fields: {},
    result: { http_status: status ?? null, code: str(b.code), type: str(b.type) },
    providerRef: null,
  };
}

// PAN: POST /pan { pan, name } → valid, pan_status, registered_name, name_match_result, type …
export function interpretPan(c: KycConfig, body: unknown): Interpretation {
  const r = (body || {}) as Json;
  const base = {
    fields: { registered_name: str(r.registered_name) ?? str(r.name_pan_card), pan_type: str(r.type) },
    result: { valid: r.valid ?? null, pan_status: str(r.pan_status), pan_status_desc: str(r.pan_status_desc), type: str(r.type),
              name_match_result: str(r.name_match_result), name_match_score: r.name_match_score ?? null, aadhaar_seeding_status: str(r.aadhaar_seeding_status) },
    providerRef: ref(r.reference_id),
  };
  let i: Interpretation;
  if (r.valid === true && (r.pan_status === undefined || r.pan_status === 'VALID')) {
    i = GOOD_MATCH.has(String(r.name_match_result))
      ? { ...base, outcome: 'verified', message: null }
      : { ...base, outcome: 'review', message: 'The PAN is valid but the name does not match the Income Tax records closely. An admin will check it.' };
  } else if (r.valid === false || ['INVALID', 'DELETED', 'DEACTIVATED'].includes(String(r.pan_status))) {
    i = { ...base, outcome: 'invalid', message: `PAN not accepted: ${str(r.pan_status_desc) ?? str(r.message) ?? 'not found in the Income Tax records'}. Please check the number.` };
  } else {
    i = { ...base, outcome: 'error', message: 'The PAN check returned an unexpected answer. Please try again later.' };
  }
  return sandboxed(c, i);
}

// GSTIN: POST /gstin { GSTIN, business_name } → valid, gst_in_status, legal_name_of_business …
export function interpretGstin(c: KycConfig, body: unknown, ctx: { gstin: string; businessName: string; panMatches: boolean | null }): Interpretation {
  const r = (body || {}) as Json;
  const legal = str(r.legal_name_of_business);
  const trade = str(r.trade_name_of_business);
  const status = str(r.gst_in_status);
  const base = {
    fields: { legal_name: legal, gst_status: status },
    result: { valid: r.valid ?? null, gst_in_status: status, legal_name: legal, trade_name: trade, taxpayer_type: str(r.taxpayer_type),
              constitution: str(r.constitution_of_business), state: str((r.principal_place_split_address as Json | undefined)?.state) },
    providerRef: ref(r.reference_id),
  };
  let i: Interpretation;
  if (r.valid === true && str(r.GSTIN) === ctx.gstin && status) {
    const nameScore = Math.max(nameSimilarity(ctx.businessName, legal), nameSimilarity(ctx.businessName, trade));
    if (status.toLowerCase() !== 'active') i = { ...base, outcome: 'invalid', message: `This GST registration is ${status}. Only an active registration can be used.` };
    else if (ctx.panMatches === false) i = { ...base, outcome: 'review', message: 'The GSTIN is registered to a different PAN than the one you gave. An admin will check it.' };
    else if (nameScore < 0.6) i = { ...base, outcome: 'review', message: 'The GSTIN is active but the business name does not match the GST records closely. An admin will check it.' };
    else i = { ...base, outcome: 'verified', message: null };
  } else if (r.valid === false || /doesn'?t exist|does not exist|invalid/i.test(String(r.message ?? ''))) {
    i = { ...base, outcome: 'invalid', message: 'This GSTIN was not found in the GST records. Please check the number.' };
  } else {
    i = { ...base, outcome: 'error', message: 'The GSTIN check returned an unexpected answer. Please try again later.' };
  }
  return sandboxed(c, i);
}

const BANK_MESSAGES: Record<string, string> = {
  INVALID_ACCOUNT_FAIL: 'The bank says this account number is not valid.',
  INVALID_IFSC_FAIL: 'The IFSC code is not valid.',
  ACCOUNT_BLOCKED: 'The bank says this account is blocked or frozen.',
  NRE_ACCOUNT_FAIL: 'NRE accounts cannot be used.',
};

// Bank: POST /bank-account/sync { bank_account, ifsc, name } → account_status, account_status_code, name_at_bank, name_match_result …
export function interpretBank(c: KycConfig, body: unknown): Interpretation {
  const r = (body || {}) as Json;
  const ifsc = (r.ifsc_details || {}) as Json;
  const base = {
    fields: { bank_name: str(r.bank_name) ?? str(ifsc.bank), branch: str(r.branch) ?? str(ifsc.branch), name_at_bank: str(r.name_at_bank),
              name_match_result: str(r.name_match_result), name_match_score: r.name_match_score == null ? null : Number(r.name_match_score) || null },
    result: { account_status: str(r.account_status), account_status_code: str(r.account_status_code), name_match_result: str(r.name_match_result),
              name_match_score: r.name_match_score ?? null, bank_name: str(r.bank_name) ?? str(ifsc.bank), branch: str(r.branch) ?? str(ifsc.branch) },
    providerRef: ref(r.reference_id),
  };
  let i: Interpretation;
  if (r.account_status === 'VALID' && r.account_status_code === 'ACCOUNT_IS_VALID') {
    i = GOOD_MATCH.has(String(r.name_match_result))
      ? { ...base, outcome: 'verified', message: null }
      : { ...base, outcome: 'review', message: 'The account is valid but the name at the bank does not match closely. An admin will check it.' };
  } else if (r.account_status === 'INVALID') {
    const code = String(r.account_status_code ?? '');
    i = { ...base, outcome: 'invalid', message: `${BANK_MESSAGES[code] ?? 'The bank could not confirm this account.'} Please check the details.` };
  } else {
    i = { ...base, outcome: 'error', message: 'The bank check returned an unexpected answer. Please try again later.' };
  }
  return sandboxed(c, i);
}

// DigiLocker: POST /digilocker creates a consent link; GET /digilocker?verification_id= tells whether the user consented;
// GET /digilocker/document/AADHAAR?verification_id= returns the Aadhaar details with uid masked ("xxxxxxxx5647").
export function digilockerRequest(c: KycConfig, verificationId: string): Json {
  return {
    verification_id: verificationId,
    document_requested: ['AADHAAR'],
    redirect_url: `${c.siteUrl}/dashboard/loans?kyc=aadhaar&ref=${encodeURIComponent(verificationId)}`,
    purpose: 'Business loan KYC',
    company_name: c.companyName,
  };
}

export function interpretDigilockerStatus(body: unknown): { state: 'authenticated' | 'pending' | 'expired' | 'consent_denied' | 'unknown'; consentedAadhaar: boolean } {
  const r = (body || {}) as Json;
  const consent = Array.isArray(r.document_consent) ? (r.document_consent as unknown[]).map(String) : [];
  const s = String(r.status ?? '');
  return {
    state: s === 'AUTHENTICATED' ? 'authenticated' : s === 'PENDING' ? 'pending' : s === 'EXPIRED' ? 'expired' : s === 'CONSENT_DENIED' ? 'consent_denied' : 'unknown',
    consentedAadhaar: consent.includes('AADHAAR'),
  };
}

export function interpretAadhaarDocument(c: KycConfig, body: unknown, ctx: { panName: string | null }): Interpretation {
  const r = (body || {}) as Json;
  const uid = str(r.uid);
  const last4 = uid?.match(/([0-9]{4})$/)?.[1] ?? null;
  const name = str(r.name);
  const base = { fields: { aadhaar_last4: last4, name }, result: { status: str(r.status), aadhaar_last4: last4, name }, providerRef: ref(r.reference_id) };
  let i: Interpretation;
  if (r.status === 'SUCCESS' && last4 && name) {
    const score = ctx.panName ? nameSimilarity(name, ctx.panName) : null;
    i = score !== null && score < 0.5
      ? { ...base, outcome: 'review', message: 'Aadhaar was shared through DigiLocker, but the name does not match your PAN closely. An admin will check it.' }
      : { ...base, outcome: 'verified', message: null };
  } else if (r.status === 'AADHAAR_NOT_LINKED') {
    i = { ...base, outcome: 'invalid', message: 'Your Aadhaar is not linked to this DigiLocker account. Link it on DigiLocker and try again.' };
  } else {
    i = { ...base, outcome: 'error', message: 'DigiLocker did not return the Aadhaar details. Please try again.' };
  }
  return sandboxed(c, i);
}

/** Does the PAN inside a GSTIN match the PAN given for the business (compared by keyed hash)? null when unknown. */
export async function gstinPanMatches(base64Key: string, gstin: string, panHashes: (string | null | undefined)[]): Promise<boolean | null> {
  const known = panHashes.filter(Boolean) as string[];
  if (!known.length) return null;
  const h = await keyedHash(base64Key, 'pan', panOfGstin(gstin));
  return known.includes(h);
}
