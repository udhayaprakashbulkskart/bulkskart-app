/**
 * kyc — the only way KYC data and documents get in or out (migration 00076).
 *
 * The caller must be signed in (Authorization: Bearer <user JWT>). Everything is written through kyc_service_* database
 * functions, which enforce the rules again. Full PAN and account numbers are encrypted here (AES-256-GCM with
 * KYC_ENCRYPTION_KEY) before they reach the database; documents are encrypted before they reach storage.
 * Nothing sensitive is logged.
 *
 * POST JSON { action, ... }:
 *   status                                   which checks are live ('production' | 'sandbox' | 'integration_pending')
 *   save_pan { pan, name }                   PAN check (Cashfree /pan)
 *   aadhaar_start                            DigiLocker consent link for Aadhaar (Cashfree /digilocker); returns { url }
 *   aadhaar_status { ref }                   after DigiLocker sends the user back: reads the consent and the Aadhaar details
 *   save_business { entity_type, business_name, gstin?, udyam_number?, cin?, business_pan? }   GSTIN check (Cashfree /gstin)
 *   save_bank { holder_name, account_number, ifsc }   bank account check (Cashfree /bank-account/sync)
 *   remove_document { id }
 *   document { id }                          returns the decrypted file (owner or admin; every opening is logged)
 *   purge                                    admin: deletes documents past their retention date
 * POST multipart/form-data with action=upload, step, doc_type, file   → encrypted upload (JPG, PNG or PDF)
 *
 * Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KYC_ENCRYPTION_KEY (32 random bytes, base64), optional
 * KYC_ENCRYPTION_KEY_ID; CASHFREE_VERIFICATION_CLIENT_ID, CASHFREE_VERIFICATION_CLIENT_SECRET,
 * CASHFREE_VERIFICATION_ENV (production | sandbox), optional CASHFREE_VERIFICATION_PUBLIC_KEY (PEM, for 2FA signature),
 * optional KYC_DISABLED_CHECKS (e.g. "aadhaar,bank"), KYC_SITE_URL, KYC_COMPANY_NAME.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  type Interpretation, type KycConfig, cashfreeHeaders, decryptBytes, digilockerRequest, encryptBytes, encryptText, errorInterpretation,
  gstinPanMatches, importKey, integrationStatus, interpretAadhaarDocument, interpretBank, interpretDigilockerStatus, interpretGstin,
  interpretPan, keyedHash, readConfig, sha256Hex,
} from './core.ts';
import {
  DOCUMENT_TYPES, type DocumentType, ENTITY_TYPES, type EntityType, cleanName, isValidAccount, isValidBusinessName, isValidCin, isValidGstin,
  isValidIfsc, isValidPan, isValidPersonName, isValidUdyam, maskPan, normaliseAccount, normaliseCin, normaliseGstin, normaliseIfsc,
  normalisePan, normaliseUdyam, safeFileName, sniffMime,
} from './validate.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const BUCKET = 'kyc-documents';

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function dbError(e: { message?: string } | null): HttpError {
  const m = e?.message ?? 'database_error';
  const code = m.match(/(consent_required|kyc_rejected|kyc_locked|step_locked|invalid_[a-z]+|cin_required|business_pan_required|file_too_large|too_many_documents|not_found|details_missing)/)?.[1];
  return new HttpError(code === 'not_found' ? 404 : 409, code ?? 'database_error');
}

async function rpc<T>(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw dbError(error);
  return data as T;
}

async function callProvider(c: KycConfig, method: 'GET' | 'POST', path: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
  try {
    const res = await fetch(`${c.baseUrl}${path}`, {
      method,
      headers: await cashfreeHeaders(c, extraHeaders),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

async function record(db: SupabaseClient, user: string, step: string, checkType: string, c: KycConfig, i: Interpretation, clientRef: string | null = null) {
  await rpc(db, 'kyc_service_record_check', {
    p_user: user, p_step: step, p_check_type: checkType,
    p_provider: i.outcome === 'integration_pending' ? null : c.provider,
    p_environment: i.outcome === 'integration_pending' ? 'none' : c.environment,
    p_outcome: i.outcome, p_provider_ref: i.providerRef, p_client_ref: clientRef, p_result: i.result, p_message: i.message, p_fields: i.fields,
  });
  return { outcome: i.outcome, message: i.message };
}

const pending = (what: string): Interpretation => ({
  outcome: 'integration_pending', message: `${what}: automatic check not connected (integration pending). Our team will verify it from your documents.`,
  fields: {}, result: {}, providerRef: null,
});

interface State {
  profile: Record<string, any> | null;
  settings: { max_file_mb: number };
  is_admin: boolean;
  aadhaar_request: { client_ref: string; status: string } | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(500, { error: 'server_not_configured' });
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const c = readConfig(Deno.env.toObject());
  const live = integrationStatus(c);

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
    const user = auth?.user?.id;
    if (!user) throw new HttpError(401, 'sign_in_required');

    const isForm = (req.headers.get('Content-Type') || '').includes('multipart/form-data');
    const form = isForm ? await req.formData() : null;
    const body = isForm ? {} : ((await req.json().catch(() => ({}))) as Record<string, unknown>);
    const action = String(isForm ? form?.get('action') : body.action);

    if (action === 'status') return json(200, { checks: live });

    const needsStorage = live.documents !== 'production';
    if (needsStorage && action !== 'purge') {
      return json(200, { outcome: 'integration_pending', message: 'Secure document and data storage is not set up yet (integration pending).', checks: live });
    }
    const key = needsStorage ? null : await importKey(c.encryptionKey as string);
    const state = await rpc<State>(db, 'kyc_service_state', { p_user: user });
    const profile = state.profile;

    switch (action) {
      case 'save_pan': {
        const pan = normalisePan(body.pan);
        const name = cleanName(body.name);
        if (!isValidPan(pan)) throw new HttpError(400, 'invalid_pan');
        if (!isValidPersonName(name)) throw new HttpError(400, 'invalid_name');
        const enc = await encryptText(key as CryptoKey, pan);
        await rpc(db, 'kyc_service_save_pan', {
          p_user: user, p_pan_masked: maskPan(pan), p_pan_hash: await keyedHash(c.encryptionKey as string, 'pan', pan), p_name: name,
          p_ciphertext: enc.ciphertext, p_iv: enc.iv, p_key_id: c.keyId,
        });
        if (live.pan === 'integration_pending') return json(200, await record(db, user, 'pan', 'pan', c, pending('PAN check')));
        const res = await callProvider(c, 'POST', '/pan', { pan, name }, { 'x-api-version': '2022-10-26' });
        const i = res.ok ? interpretPan(c, res.body) : errorInterpretation('The PAN check could not be completed. Please try again later.', res.status, res.body);
        return json(200, await record(db, user, 'pan', 'pan', c, i));
      }

      case 'aadhaar_start': {
        if (!profile?.consent_at) throw new HttpError(409, 'consent_required');
        if (profile.aadhaar_status === 'verified') throw new HttpError(409, 'step_locked');
        if (live.aadhaar === 'integration_pending') return json(200, await record(db, user, 'aadhaar', 'aadhaar_digilocker', c, pending('Aadhaar verification (DigiLocker)')));
        const ref = `bk${crypto.randomUUID().replace(/-/g, '')}`.slice(0, 40);
        const res = await callProvider(c, 'POST', '/digilocker', digilockerRequest(c, ref));
        const r = (res.body || {}) as Record<string, unknown>;
        if (!res.ok || typeof r.url !== 'string' || !/^https:\/\//.test(r.url)) {
          const i = errorInterpretation('DigiLocker could not be opened. Please try again later.', res.status, res.body);
          return json(200, await record(db, user, 'aadhaar', 'aadhaar_digilocker', c, i));
        }
        await record(db, user, 'aadhaar', 'aadhaar_digilocker', c,
          { outcome: 'requested', message: 'Waiting for your consent on DigiLocker.', fields: {}, result: { status: 'PENDING' }, providerRef: r.reference_id == null ? null : String(r.reference_id) }, ref);
        return json(200, { outcome: 'requested', url: r.url });
      }

      case 'aadhaar_status': {
        const ref = String(body.ref || '');
        const last = state.aadhaar_request;
        if (!last || last.client_ref !== ref) throw new HttpError(404, 'not_found');
        if (last.status !== 'requested') return json(200, { outcome: last.status });
        if (live.aadhaar === 'integration_pending') return json(200, { outcome: 'integration_pending' });
        const st = await callProvider(c, 'GET', `/digilocker?verification_id=${encodeURIComponent(ref)}`);
        if (!st.ok) return json(200, { outcome: 'requested', message: 'DigiLocker has not confirmed yet. Please try again in a moment.' });
        const s = interpretDigilockerStatus(st.body);
        if (s.state === 'pending' || s.state === 'unknown') return json(200, { outcome: 'requested', message: 'DigiLocker consent is not complete yet.' });
        if (s.state === 'expired' || s.state === 'consent_denied' || !s.consentedAadhaar) {
          const outcome = s.state === 'expired' ? 'expired' : 'consent_denied';
          const message = outcome === 'expired' ? 'The DigiLocker link expired (10 minutes). Please start again.' : 'Aadhaar was not shared on DigiLocker. Please start again and allow Aadhaar.';
          return json(200, await record(db, user, 'aadhaar', 'aadhaar_digilocker', c, { outcome, message, fields: {}, result: { status: s.state }, providerRef: null }, ref));
        }
        const doc = await callProvider(c, 'GET', `/digilocker/document/AADHAAR?verification_id=${encodeURIComponent(ref)}`);
        const i = doc.ok
          ? interpretAadhaarDocument(c, doc.body, { panName: profile?.pan_registered_name ?? profile?.pan_name ?? null })
          : errorInterpretation('DigiLocker did not return the Aadhaar details. Please try again.', doc.status, doc.body);
        if (i.outcome === 'error') return json(200, { outcome: 'requested', message: i.message });
        return json(200, await record(db, user, 'aadhaar', 'aadhaar_digilocker', c, i, ref));
      }

      case 'save_business': {
        const entity = String(body.entity_type || '') as EntityType;
        const name = cleanName(body.business_name);
        const gstin = body.gstin ? normaliseGstin(body.gstin) : '';
        const udyam = body.udyam_number ? normaliseUdyam(body.udyam_number) : '';
        const cin = body.cin ? normaliseCin(body.cin) : '';
        const bpan = body.business_pan ? normalisePan(body.business_pan) : '';
        if (!ENTITY_TYPES.includes(entity)) throw new HttpError(400, 'invalid_entity_type');
        if (!isValidBusinessName(name)) throw new HttpError(400, 'invalid_business_name');
        if (gstin && !isValidGstin(gstin)) throw new HttpError(400, 'invalid_gstin');
        if (udyam && !isValidUdyam(udyam)) throw new HttpError(400, 'invalid_udyam');
        if (cin && !isValidCin(cin)) throw new HttpError(400, 'invalid_cin');
        if (bpan && !isValidPan(bpan)) throw new HttpError(400, 'invalid_business_pan');
        const enc = bpan ? await encryptText(key as CryptoKey, bpan) : null;
        const bpanHash = bpan ? await keyedHash(c.encryptionKey as string, 'pan', bpan) : null;
        await rpc(db, 'kyc_service_save_business', {
          p_user: user,
          p: {
            entity_type: entity, business_name: name, gstin, udyam_number: udyam, cin,
            business_pan_masked: bpan ? maskPan(bpan) : '', business_pan_hash: bpanHash ?? '',
            business_pan_ciphertext: enc?.ciphertext ?? '', business_pan_iv: enc?.iv ?? '', key_id: c.keyId,
          },
        });
        if (!gstin) return json(200, { outcome: 'review', message: 'Saved. Without a GSTIN, your business is checked from the documents you upload.' });
        if (live.gstin === 'integration_pending') return json(200, await record(db, user, 'business', 'gstin', c, pending('GSTIN check')));
        const res = await callProvider(c, 'POST', '/gstin', { GSTIN: gstin, business_name: name });
        const panMatches = await gstinPanMatches(c.encryptionKey as string, gstin, entity === 'proprietorship' ? [profile?.pan_hash] : [bpanHash]);
        const i = res.ok ? interpretGstin(c, res.body, { gstin, businessName: name, panMatches })
          : errorInterpretation('The GSTIN check could not be completed. Please try again later.', res.status, res.body);
        return json(200, await record(db, user, 'business', 'gstin', c, i));
      }

      case 'save_bank': {
        const holder = cleanName(body.holder_name);
        const account = normaliseAccount(body.account_number);
        const ifsc = normaliseIfsc(body.ifsc);
        if (!isValidPersonName(holder) && !isValidBusinessName(holder)) throw new HttpError(400, 'invalid_name');
        if (!isValidAccount(account)) throw new HttpError(400, 'invalid_account');
        if (!isValidIfsc(ifsc)) throw new HttpError(400, 'invalid_ifsc');
        const enc = await encryptText(key as CryptoKey, account);
        await rpc(db, 'kyc_service_save_bank', {
          p_user: user, p_holder: holder, p_last4: account.slice(-4), p_hash: await keyedHash(c.encryptionKey as string, 'bank_account', `${ifsc}:${account}`),
          p_ifsc: ifsc, p_ciphertext: enc.ciphertext, p_iv: enc.iv, p_key_id: c.keyId,
        });
        if (live.bank === 'integration_pending') return json(200, await record(db, user, 'bank', 'bank_account', c, pending('Bank account check')));
        const res = await callProvider(c, 'POST', '/bank-account/sync', { bank_account: account, ifsc, name: holder.replace(/[^A-Za-z0-9 ]/g, ' ').trim() });
        const i = res.ok ? interpretBank(c, res.body) : errorInterpretation('The bank check could not be completed. Please try again later.', res.status, res.body);
        return json(200, await record(db, user, 'bank', 'bank_account', c, i));
      }

      case 'upload': {
        const step = String(form?.get('step') || '');
        const docType = String(form?.get('doc_type') || '') as DocumentType;
        const file = form?.get('file');
        if (!(docType in DOCUMENT_TYPES) || DOCUMENT_TYPES[docType].step !== step) throw new HttpError(400, 'invalid_document_type');
        if (!(file instanceof File)) throw new HttpError(400, 'file_required');
        if (file.size > state.settings.max_file_mb * 1048576) throw new HttpError(413, 'file_too_large');
        const bytes = new Uint8Array(await file.arrayBuffer());
        const mime = sniffMime(bytes);
        if (!mime) throw new HttpError(415, 'unsupported_file');
        const enc = await encryptBytes(key as CryptoKey, bytes);
        const path = `${user}/${crypto.randomUUID()}.bin`;
        const up = await db.storage.from(BUCKET).upload(path, enc.data, { contentType: 'application/octet-stream', upsert: false });
        if (up.error) throw new HttpError(502, 'storage_error');
        try {
          const id = await rpc<string>(db, 'kyc_service_add_document', {
            p_user: user, p_step: step, p_doc_type: docType, p_file_name: safeFileName(file.name, mime), p_mime: mime, p_size: bytes.length,
            p_sha256: await sha256Hex(bytes), p_path: path, p_iv: enc.iv, p_key_id: c.keyId,
          });
          return json(200, { id });
        } catch (e) {
          await db.storage.from(BUCKET).remove([path]);
          throw e;
        }
      }

      case 'remove_document': {
        const path = await rpc<string>(db, 'kyc_service_remove_document', { p_user: user, p_doc: String(body.id || '') });
        await db.storage.from(BUCKET).remove([path]);
        return json(200, { removed: true });
      }

      case 'document': {
        const meta = await rpc<{ path: string; iv: string; key_id: string; mime_type: string; file_name: string }>(db, 'kyc_service_document_for', { p_actor: user, p_doc: String(body.id || '') });
        if (meta.key_id !== c.keyId) throw new HttpError(409, 'key_rotated');
        const dl = await db.storage.from(BUCKET).download(meta.path);
        if (dl.error || !dl.data) throw new HttpError(404, 'not_found');
        const plain = await decryptBytes(key as CryptoKey, meta.iv, new Uint8Array(await dl.data.arrayBuffer()));
        return new Response(plain as unknown as BodyInit, {
          status: 200,
          headers: { ...CORS, 'Content-Type': meta.mime_type, 'Content-Disposition': `inline; filename="${meta.file_name}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
        });
      }

      case 'purge': {
        if (!state.is_admin) throw new HttpError(403, 'admin_only');
        const expired = await rpc<{ id: string; path: string }[]>(db, 'kyc_service_expired_documents', { p_limit: 500 });
        if (!expired.length) return json(200, { purged: 0 });
        const rm = await db.storage.from(BUCKET).remove(expired.map((e) => e.path));
        if (rm.error) throw new HttpError(502, 'storage_error');
        const n = await rpc<number>(db, 'kyc_service_mark_purged', { p_actor: user, p_ids: expired.map((e) => e.id) });
        return json(200, { purged: n });
      }

      default:
        throw new HttpError(400, 'unknown_action');
    }
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error('kyc: unexpected failure', e instanceof Error ? e.name : 'error');
    return json(500, { error: 'server_error' });
  }
});
