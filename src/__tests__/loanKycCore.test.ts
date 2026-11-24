import { describe, expect, it } from 'vitest';
import {
  cashfreeSignature, decryptText, digilockerRequest, encryptBytes, encryptText, decryptBytes, gstinPanMatches, importKey, integrationStatus,
  interpretAadhaarDocument, interpretBank, interpretDigilockerStatus, interpretGstin, interpretPan, keyedHash, nameSimilarity, readConfig,
} from '../../supabase/functions/kyc/core';
import {
  DOCUMENT_TYPES, isValidAccount, isValidCin, isValidGstin, isValidIfsc, isValidPan, isValidUdyam, maskPan, normaliseCin, normaliseUdyam, panHolderKind,
  safeFileName, sniffMime,
} from '../../supabase/functions/kyc/validate';

// Test key only (32 zero-to-31 bytes); never used outside this file.
const TEST_KEY = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i)));
const OTHER_KEY = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => 31 - i)));
const prod = readConfig({ CASHFREE_VERIFICATION_CLIENT_ID: 'id', CASHFREE_VERIFICATION_CLIENT_SECRET: 'secret', CASHFREE_VERIFICATION_ENV: 'production', KYC_ENCRYPTION_KEY: TEST_KEY });
const sandbox = readConfig({ CASHFREE_VERIFICATION_CLIENT_ID: 'id', CASHFREE_VERIFICATION_CLIENT_SECRET: 'secret', CASHFREE_VERIFICATION_ENV: 'sandbox', KYC_ENCRYPTION_KEY: TEST_KEY });

// GSTIN-shaped test value with a computed check character.
const A36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const gst = (first14: string) => {
  let t = 0;
  for (let i = 0; i < 14; i++) { const p = A36.indexOf(first14[i]) * (i % 2 ? 2 : 1); t += Math.floor(p / 36) + (p % 36); }
  return first14 + A36[(36 - (t % 36)) % 36];
};
const GSTIN = gst('33ABCPT1234F1Z');

describe('format checks', () => {
  it('PAN', () => {
    expect(isValidPan('ABCPT1234F')).toBe(true);
    expect(isValidPan('ABCPT1234')).toBe(false);
    expect(panHolderKind('ABCPT1234F')).toBe('person');
    expect(panHolderKind('AAOCS4553K')).toBe('business');
    expect(maskPan('ABCPT1234F')).toBe('ABXXXXXX4F');
    expect(/^[A-Z]{2}X{6}[0-9A-Z]{2}$/.test(maskPan('ABCPT1234F'))).toBe(true); // what the database accepts
  });
  it('GSTIN check character', () => {
    expect(isValidGstin(GSTIN)).toBe(true);
    expect(isValidGstin(GSTIN.slice(0, 14) + (GSTIN[14] === 'A' ? 'B' : 'A'))).toBe(false);
  });
  it('IFSC, account, Udyam, CIN and LLPIN', () => {
    expect(isValidIfsc('HDFC0001234')).toBe(true);
    expect(isValidIfsc('HDFC1001234')).toBe(false);
    expect(isValidAccount('000123456789')).toBe(true);
    expect(isValidAccount('12')).toBe(false);
    expect(normaliseUdyam('udyam tn 01 1234567')).toBe('UDYAM-TN-01-1234567');
    expect(isValidUdyam('UDYAM-TN-01-1234567')).toBe(true);
    expect(isValidCin('U12345TN2020PTC123456')).toBe(true);
    expect(normaliseCin('aab1234')).toBe('AAB-1234');
    expect(isValidCin('AAB-1234')).toBe(true);
  });
  it('a masked Aadhaar copy belongs to the Aadhaar step', () => {
    expect(DOCUMENT_TYPES.aadhaar_masked.step).toBe('aadhaar');
  });
  it('trusts the file bytes, not the name', () => {
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffMime(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf');
    expect(sniffMime(new TextEncoder().encode('MZ executable'))).toBeNull();
    expect(safeFileName('../../etc/passwd.pdf.exe', 'application/pdf')).toBe('etc_passwd.pdf.pdf');
    expect(safeFileName('My GST cert (1).PNG', 'image/png')).toBe('My_GST_cert_1_.png');
  });
});

describe('integration status', () => {
  it('everything is pending with nothing configured', () => {
    expect(integrationStatus(readConfig({}))).toEqual({ documents: 'integration_pending', pan: 'integration_pending', aadhaar: 'integration_pending', gstin: 'integration_pending', bank: 'integration_pending' });
  });
  it('the encryption key alone enables uploads but no checks', () => {
    const s = integrationStatus(readConfig({ KYC_ENCRYPTION_KEY: TEST_KEY }));
    expect(s.documents).toBe('production');
    expect(s.pan).toBe('integration_pending');
  });
  it('a key of the wrong length is not accepted', () => {
    expect(integrationStatus(readConfig({ KYC_ENCRYPTION_KEY: btoa('short') })).documents).toBe('integration_pending');
  });
  it('provider keys without an environment stay pending; a disabled check stays pending', () => {
    expect(integrationStatus(readConfig({ CASHFREE_VERIFICATION_CLIENT_ID: 'a', CASHFREE_VERIFICATION_CLIENT_SECRET: 'b', KYC_ENCRYPTION_KEY: TEST_KEY })).pan).toBe('integration_pending');
    const s = integrationStatus(readConfig({ CASHFREE_VERIFICATION_CLIENT_ID: 'a', CASHFREE_VERIFICATION_CLIENT_SECRET: 'b', CASHFREE_VERIFICATION_ENV: 'sandbox', KYC_ENCRYPTION_KEY: TEST_KEY, KYC_DISABLED_CHECKS: 'aadhaar' }));
    expect(s).toMatchObject({ pan: 'sandbox', aadhaar: 'integration_pending', bank: 'sandbox' });
  });
});

describe('encryption', () => {
  it('round-trips text and files; ciphertext reveals nothing and fails with another key', async () => {
    const key = await importKey(TEST_KEY);
    const enc = await encryptText(key, 'ABCPT1234F');
    expect(enc.ciphertext).not.toContain('ABCPT1234F');
    expect(await decryptText(key, enc.ciphertext, enc.iv)).toBe('ABCPT1234F');
    const again = await encryptText(key, 'ABCPT1234F');
    expect(again.ciphertext).not.toBe(enc.ciphertext); // random IV
    await expect(decryptText(await importKey(OTHER_KEY), enc.ciphertext, enc.iv)).rejects.toBeTruthy();
    const file = new Uint8Array([1, 2, 3, 4, 5]);
    const ef = await encryptBytes(key, file);
    expect(Array.from(await decryptBytes(key, ef.iv, ef.data))).toEqual([1, 2, 3, 4, 5]);
  });
  it('keyed hashes match equal values without storing them', async () => {
    expect(await keyedHash(TEST_KEY, 'pan', 'ABCPT1234F')).toBe(await keyedHash(TEST_KEY, 'pan', 'ABCPT1234F'));
    expect(await keyedHash(TEST_KEY, 'pan', 'ABCPT1234F')).not.toBe(await keyedHash(TEST_KEY, 'bank_account', 'ABCPT1234F'));
    const panHash = await keyedHash(TEST_KEY, 'pan', 'ABCPT1234F');
    expect(await gstinPanMatches(TEST_KEY, GSTIN, [panHash])).toBe(true);
    expect(await gstinPanMatches(TEST_KEY, GSTIN, [await keyedHash(TEST_KEY, 'pan', 'ZZZPT9999Z')])).toBe(false);
    expect(await gstinPanMatches(TEST_KEY, GSTIN, [null])).toBeNull();
  });
  it('signs Cashfree requests with RSA-OAEP over "clientId.timestamp"', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-1' }, true, ['encrypt', 'decrypt']);
    const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
    const pem = `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...spki))}\n-----END PUBLIC KEY-----`;
    const sig = await cashfreeSignature(pem, 'CLIENT', 1700000000);
    const plain = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, pair.privateKey, Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)));
    expect(new TextDecoder().decode(plain)).toBe('CLIENT.1700000000');
  });
});

describe('names', () => {
  it('ignores titles, company words and case; gives initials half credit', () => {
    expect(nameSimilarity('M/s Test Traders Pvt. Ltd.', 'TEST TRADERS PRIVATE LIMITED')).toBe(1);
    expect(nameSimilarity('R Kumar', 'Rajesh Kumar')).toBe(0.75);
    expect(nameSimilarity('Anita Rao', 'Vikram Shah')).toBe(0);
  });
});

// Response shapes below are the examples in Cashfree's API reference.
describe('PAN answers', () => {
  const valid = { pan: 'ABCPV1234D', type: 'Individual', reference_id: 161, name_provided: 'JOHN DOE', registered_name: 'JOHN DOE', valid: true, message: 'PAN verified successfully', name_match_score: 100, name_match_result: 'DIRECT_MATCH', aadhaar_seeding_status: 'Y', last_updated_at: '01/01/2019', name_pan_card: 'JOHN DOE', pan_status: 'VALID', pan_status_code: 'E', pan_status_desc: 'Existing and Valid' };
  it('valid with a good name match → verified (production only)', () => {
    const i = interpretPan(prod, valid);
    expect(i.outcome).toBe('verified');
    expect(i.fields.registered_name).toBe('JOHN DOE');
    expect(JSON.stringify(i.result)).not.toContain('ABCPV1234D'); // the full PAN is not kept in the history
    expect(interpretPan(sandbox, valid).outcome).toBe('test_only');
  });
  it('valid but a weak name match → admin review', () => {
    expect(interpretPan(prod, { ...valid, name_match_result: 'MODERATE_PARTIAL_MATCH', name_match_score: 60 }).outcome).toBe('review');
  });
  it('invalid PAN → applicant must correct', () => {
    const i = interpretPan(prod, { pan: 'ABCPV1234D', reference_id: 17974435, name_provided: null, valid: false, message: 'Invalid PAN', name_match_score: 0, name_match_result: '-', pan_status_code: 'N', pan_status_desc: 'Not found in ITD database or Invalid PAN' });
    expect(i.outcome).toBe('invalid');
    expect(i.message).toContain('Not found in ITD database');
  });
  it('anything unexpected is an error, never verified', () => {
    expect(interpretPan(prod, { status: 'ok' }).outcome).toBe('error');
    expect(interpretPan(prod, { valid: 'true', pan_status: 'VALID', name_match_result: 'DIRECT_MATCH' }).outcome).toBe('error');
    expect(interpretPan(prod, null).outcome).toBe('error');
  });
});

describe('GSTIN answers', () => {
  const active = { reference_id: 19, GSTIN, legal_name_of_business: 'TEST TRADERS', trade_name_of_business: 'TEST TRADERS', gst_in_status: 'Active', taxpayer_type: 'Regular', constitution_of_business: 'Proprietorship', principal_place_split_address: { state: 'Tamil Nadu' }, valid: true, message: 'GSTIN Exists' };
  const ctx = { gstin: GSTIN, businessName: 'Test Traders', panMatches: true };
  it('active, same name, same PAN → verified', () => expect(interpretGstin(prod, active, ctx).outcome).toBe('verified'));
  it('cancelled → invalid', () => expect(interpretGstin(prod, { ...active, gst_in_status: 'Cancelled' }, ctx).outcome).toBe('invalid'));
  it('different PAN or name → review', () => {
    expect(interpretGstin(prod, active, { ...ctx, panMatches: false }).outcome).toBe('review');
    expect(interpretGstin(prod, active, { ...ctx, businessName: 'Another Mills' }).outcome).toBe('review');
  });
  it("doesn't exist → invalid; another GSTIN in the answer → error", () => {
    expect(interpretGstin(prod, { reference_id: 20, GSTIN, message: "GSTIN Doesn't Exist" }, ctx).outcome).toBe('invalid');
    expect(interpretGstin(prod, { ...active, GSTIN: gst('29ABCPT1234F1Z') }, ctx).outcome).toBe('error');
  });
});

describe('bank answers', () => {
  const valid = { reference_id: 34, name_at_bank: 'TEST PERSON', bank_name: 'YES BANK', city: 'MUMBAI', branch: 'SANTACRUZ, MUMBAI', micr: 400532038, name_match_score: '90.00', name_match_result: 'GOOD_PARTIAL_MATCH', account_status: 'VALID', account_status_code: 'ACCOUNT_IS_VALID' };
  it('valid with a good name match → verified', () => {
    const i = interpretBank(prod, valid);
    expect(i.outcome).toBe('verified');
    expect(i.fields).toMatchObject({ bank_name: 'YES BANK', name_at_bank: 'TEST PERSON', name_match_score: 90 });
  });
  it('poor name match → review; invalid or blocked → invalid; odd answer → error', () => {
    expect(interpretBank(prod, { ...valid, name_match_result: 'POOR_PARTIAL_MATCH' }).outcome).toBe('review');
    expect(interpretBank(prod, { reference_id: 34, account_status: 'INVALID', account_status_code: 'INVALID_ACCOUNT_FAIL' }).outcome).toBe('invalid');
    expect(interpretBank(prod, { reference_id: 34, account_status: 'INVALID', account_status_code: 'ACCOUNT_BLOCKED' }).message).toContain('blocked');
    expect(interpretBank(prod, { account_status: 'VALID' }).outcome).toBe('error');
  });
});

describe('Aadhaar through DigiLocker', () => {
  it('asks only for Aadhaar and returns to the loans page', () => {
    const r = digilockerRequest(prod, 'bk123');
    expect(r).toMatchObject({ verification_id: 'bk123', document_requested: ['AADHAAR'], redirect_url: 'https://www.bulkskart.com/dashboard/loans?kyc=aadhaar&ref=bk123' });
  });
  it('reads the consent status', () => {
    expect(interpretDigilockerStatus({ status: 'AUTHENTICATED', document_consent: ['AADHAAR'] })).toEqual({ state: 'authenticated', consentedAadhaar: true });
    expect(interpretDigilockerStatus({ status: 'AUTHENTICATED', document_consent: ['PAN'] }).consentedAadhaar).toBe(false);
    expect(interpretDigilockerStatus({ status: 'EXPIRED' }).state).toBe('expired');
    expect(interpretDigilockerStatus({ status: 'CONSENT_DENIED' }).state).toBe('consent_denied');
  });
  const doc = { reference_id: 408, verification_id: 'bk123', status: 'SUCCESS', uid: 'xxxxxxxx5647', care_of: 'S/O: Someone', dob: '02-02-1995', gender: 'M', name: 'Test Person', photo_link: '/9j/4AAQ', split_address: { dist: 'Chennai' } };
  it('keeps only the last 4 digits and the name; no photo, date of birth or address', () => {
    const i = interpretAadhaarDocument(prod, doc, { panName: 'TEST PERSON' });
    expect(i.outcome).toBe('verified');
    expect(i.fields).toEqual({ aadhaar_last4: '5647', name: 'Test Person' });
    const kept = JSON.stringify(i);
    for (const s of ['1995', '/9j/', 'Someone', 'Chennai']) expect(kept).not.toContain(s);
  });
  it('a name that does not match the PAN goes to review; not linked → invalid; sandbox → test only', () => {
    expect(interpretAadhaarDocument(prod, doc, { panName: 'Vikram Shah' }).outcome).toBe('review');
    expect(interpretAadhaarDocument(prod, { reference_id: 408, status: 'AADHAAR_NOT_LINKED' }, { panName: null }).outcome).toBe('invalid');
    expect(interpretAadhaarDocument(sandbox, doc, { panName: 'TEST PERSON' }).outcome).toBe('test_only');
  });
});
