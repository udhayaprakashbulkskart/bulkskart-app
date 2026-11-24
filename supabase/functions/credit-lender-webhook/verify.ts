/**
 * Lender webhook: signature check and event validation, with no Deno imports (tested with Vitest).
 *
 * The lending partner signs every request:
 *   X-BulkSkart-Timestamp: <unix seconds>
 *   X-BulkSkart-Signature: v1=<hex HMAC-SHA256 of "<timestamp>.<raw body>" with the partner's webhook secret>
 * Requests older than 5 minutes (or from the future) are refused, so a captured request cannot be replayed later;
 * each event id is processed once (the database keeps the ids).
 */

export const TOLERANCE_SECONDS = 300;
export const EVENT_TYPES = ['application.decision', 'disbursement.update', 'schedule.set', 'repayment.received'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface LenderEvent {
  id: string;
  type: EventType;
  data: Record<string, unknown>;
}

const bs = (u: Uint8Array) => u as unknown as BufferSource;
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

export async function sign(secret: string, timestamp: string, rawBody: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', bs(enc.encode(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, bs(enc.encode(`${timestamp}.${rawBody}`))));
}

function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySignature(
  secret: string, timestampHeader: string | null, signatureHeader: string | null, rawBody: string, nowMs = Date.now(),
): Promise<{ ok: true } | { ok: false; reason: 'missing_signature' | 'stale_timestamp' | 'bad_signature' }> {
  if (!timestampHeader || !signatureHeader || !/^\d{9,11}$/.test(timestampHeader)) return { ok: false, reason: 'missing_signature' };
  if (Math.abs(nowMs / 1000 - Number(timestampHeader)) > TOLERANCE_SECONDS) return { ok: false, reason: 'stale_timestamp' };
  const given = signatureHeader.split(',').map((p) => p.trim()).find((p) => p.startsWith('v1='))?.slice(3).toLowerCase() ?? '';
  if (!/^[0-9a-f]{64}$/.test(given)) return { ok: false, reason: 'bad_signature' };
  const expected = await sign(secret, timestampHeader, rawBody);
  return sameHex(given, expected) ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, min = 1) => typeof v === 'string' && v.trim().length >= min;

/** Checks the shape of an event; the database checks the business rules again. */
export function parseEvent(raw: string): { ok: true; event: LenderEvent } | { ok: false; reason: string } {
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return { ok: false, reason: 'invalid_json' }; }
  const e = body as { id?: unknown; type?: unknown; data?: unknown };
  if (!str(e?.id, 6) || String(e.id).length > 100) return { ok: false, reason: 'event_id_required' };
  if (!EVENT_TYPES.includes(e.type as EventType)) return { ok: false, reason: 'unknown_event_type' };
  if (!e.data || typeof e.data !== 'object' || Array.isArray(e.data)) return { ok: false, reason: 'data_required' };
  const d = e.data as Record<string, unknown>;
  const type = e.type as EventType;
  if (type === 'disbursement.update') {
    if (!UUID.test(String(d.disbursement_id ?? ''))) return { ok: false, reason: 'disbursement_id_required' };
    if (!['sent_to_lender', 'disbursed', 'failed'].includes(String(d.status))) return { ok: false, reason: 'invalid_status' };
    if (d.status === 'disbursed' && !str(d.utr, 6)) return { ok: false, reason: 'utr_required' };
  } else {
    if (!UUID.test(String(d.application_id ?? ''))) return { ok: false, reason: 'application_id_required' };
  }
  if (type === 'application.decision') {
    if (!['approved', 'rejected'].includes(String(d.decision))) return { ok: false, reason: 'invalid_decision' };
    if (!str(d.lender_reference, 3)) return { ok: false, reason: 'lender_reference_required' };
    if (d.decision === 'approved' && (!num(d.approved_amount) || !d.kfs || typeof d.kfs !== 'object')) return { ok: false, reason: 'kfs_required' };
  }
  if (type === 'schedule.set' && (!Array.isArray(d.installments) || d.installments.length === 0)) return { ok: false, reason: 'installments_required' };
  if (type === 'repayment.received' && (!num(d.amount) || !str(d.reference, 4) || !str(d.method))) return { ok: false, reason: 'repayment_fields_required' };
  return { ok: true, event: { id: String(e.id).trim(), type, data: d } };
}

/** The environment variable that holds a partner's webhook secret: CREDIT_WEBHOOK_SECRET_<CODE>. */
export function secretName(partnerCode: string): string | null {
  return /^[a-z][a-z0-9_]{1,30}$/.test(partnerCode) ? `CREDIT_WEBHOOK_SECRET_${partnerCode.toUpperCase()}` : null;
}
