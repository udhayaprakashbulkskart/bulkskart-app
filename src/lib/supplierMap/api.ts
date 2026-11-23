/**
 * Supplier map calls. Everything goes through the database functions of migration 00071, which apply the display
 * rules (approved, active, verified location, active products, not suspended) themselves, so nothing a page does can
 * show a business that does not qualify.
 */
import { supabase } from '@/db/supabase';
import type {
  AdminApplication, AuditEntry, BusinessStatus, MapSearchParams, MapSupplier, MapSupplierDetail, MyMapStatus,
  StockStatus, SupplyType, VerificationDocument,
} from './types';
import { docPathFromUrl, type PrivateDocBucket, privateDocRef } from './docPath';


type DbError = { message?: string; code?: string } | null;

export async function searchSuppliers(p: MapSearchParams): Promise<{ rows: MapSupplier[]; total: number; error: DbError }> {
  const { data, error } = await supabase.rpc('map_search_suppliers', {
    p_query: p.query?.trim() || null,
    p_lat: p.lat ?? null,
    p_lng: p.lng ?? null,
    p_radius_km: p.radiusKm ?? null,
    p_category: p.category || null,
    p_max_moq: p.maxMoq ?? null,
    p_min_capacity: p.minCapacity ?? null,
    p_supplier_type: null,
    p_require_gst: Boolean(p.requireGst),
    p_require_cin: Boolean(p.requireCin),
    p_require_udyam: Boolean(p.requireUdyam),
    p_south: p.bounds?.south ?? null,
    p_west: p.bounds?.west ?? null,
    p_north: p.bounds?.north ?? null,
    p_east: p.bounds?.east ?? null,
    p_limit: p.limit ?? 100,
    p_offset: p.offset ?? 0,
  });
  if (error) return { rows: [], total: 0, error };
  const rows = ((data ?? []) as MapSupplier[]).map((r) => ({
    ...r,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    distance_km: r.distance_km == null ? null : Number(r.distance_km),
    rating: r.rating == null ? null : Number(r.rating),
    min_moq: r.min_moq == null ? null : Number(r.min_moq),
    monthly_capacity: r.monthly_capacity == null ? null : Number(r.monthly_capacity),
    matched_products: Array.isArray(r.matched_products) ? r.matched_products : [],
  }));
  return { rows, total: rows.length ? Number(rows[0].total_count) : 0, error: null };
}

export async function supplierDetail(companyId: string, lat?: number | null, lng?: number | null): Promise<{ detail: MapSupplierDetail | null; error: DbError }> {
  const { data, error } = await supabase.rpc('map_supplier_detail', { p_company_id: companyId, p_lat: lat ?? null, p_lng: lng ?? null });
  return { detail: (data as MapSupplierDetail | null) ?? null, error };
}

/**
 * Calls back (at most every 1.5 s) when an approval, location, availability, product or company status changes.
 * Live through Supabase Realtime; also every 2 minutes in case Realtime is not switched on for the table.
 */
export function onMapChange(callback: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const fire = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      callback();
    }, 1500);
  };
  const channel = supabase
    .channel(`supplier-map-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'supplier_map_changes' }, fire)
    .subscribe();
  const poll = setInterval(() => {
    if (document.visibilityState === 'visible') callback();
  }, 120_000);
  return () => {
    if (timer) clearTimeout(timer);
    clearInterval(poll);
    supabase.removeChannel(channel);
  };
}

// ── manufacturer ──

export async function myMapStatus(): Promise<{ status: MyMapStatus | null; error: DbError }> {
  const { data, error } = await supabase.rpc('supplier_map_status');
  return { status: (data as MyMapStatus | null) ?? null, error };
}

export async function submitBusinessVerification(payload: Record<string, unknown>): Promise<DbError> {
  const { error } = await supabase.rpc('supplier_submit_business_verification', { p: payload });
  return error;
}

export async function saveFactoryLocation(l: { lat: number; lng: number; address: string; city?: string; state?: string; pincode?: string }): Promise<{ status: string | null; error: DbError }> {
  const { data, error } = await supabase.rpc('supplier_save_factory_location', {
    p_lat: l.lat, p_lng: l.lng, p_address: l.address, p_city: l.city || null, p_state: l.state || null, p_country: 'India', p_pincode: l.pincode || null,
  });
  return { status: (data as string | null) ?? null, error };
}

export async function updateAvailability(a: { monthlyCapacity: number | null; capacityUnit: string; leadTimeDays: number | null; stockStatus: StockStatus | ''; supplyType: SupplyType | '' }): Promise<DbError> {
  const { error } = await supabase.rpc('supplier_update_availability', {
    p_monthly_capacity: a.monthlyCapacity, p_capacity_unit: a.capacityUnit, p_lead_time_days: a.leadTimeDays,
    p_stock_status: a.stockStatus || null, p_supply_type: a.supplyType || null,
  });
  return error;
}

const DOC_BUCKET: PrivateDocBucket = 'verification-docs';
const toHex = (s: string) => Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');

/** Uploads into the caller's own folder of the private bucket; returns the stored path (never a public link). */
export async function uploadVerificationDocument(userId: string, kind: VerificationDocument['kind'], file: File): Promise<VerificationDocument> {
  const dot = file.name.lastIndexOf('.');
  const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
  const ext = dot > 0 ? file.name.slice(dot).toLowerCase() : '';
  const path = `${userId}/map/${kind}-${Date.now().toString(36)}-${toHex(stem).slice(0, 40)}${ext}`;
  const { error } = await supabase.storage.from(DOC_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return { kind, path, name: file.name };
}

/** A link that works for 5 minutes, for the owner or an admin (the bucket's own rules decide). */
export async function signedDocumentUrl(path: string, bucket: PrivateDocBucket = DOC_BUCKET): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  return error ? null : data?.signedUrl ?? null;
}

/**
 * Opens a private document in a new tab through a signed link. Takes a stored path in verification-docs, or a link
 * the older pages saved. The tab is opened first (so pop-up blockers allow it) and pointed at the file once the link
 * is ready. Returns false when the file cannot be opened.
 */
export async function openPrivateDocument(pathOrUrl: string): Promise<boolean> {
  const tab = window.open('about:blank', '_blank');
  if (tab) tab.opener = null;
  const ref = privateDocRef(pathOrUrl) ?? (docPathFromUrl(pathOrUrl) ? { bucket: DOC_BUCKET, path: pathOrUrl } : null);
  const url = ref ? await signedDocumentUrl(ref.path, ref.bucket) : /^https:\/\//.test(pathOrUrl) ? pathOrUrl : null;
  if (!url) {
    tab?.close();
    return false;
  }
  if (tab) tab.location.href = url;
  else window.location.assign(url);
  return true;
}

// ── admin ──

export async function adminListApplications(status: string): Promise<{ rows: AdminApplication[]; error: DbError }> {
  const { data, error } = await supabase.rpc('admin_list_business_verifications', { p_status: status });
  return { rows: ((data ?? []) as AdminApplication[]).map((r) => ({ ...r, documents: Array.isArray(r.documents) ? r.documents : [] })), error };
}

export type AdminDecision = 'approve' | 'reject' | 'needs_info' | 'suspend' | 'recheck';

export async function adminDecideBusiness(companyId: string, decision: AdminDecision, note: string, checks: { gst?: boolean; cin?: boolean; udyam?: boolean }): Promise<{ status: BusinessStatus | null; error: DbError }> {
  const { data, error } = await supabase.rpc('admin_decide_business_verification', {
    p_company: companyId, p_decision: decision, p_note: note.trim() || null,
    p_gst_verified: checks.gst ?? null, p_cin_verified: checks.cin ?? null, p_udyam_verified: checks.udyam ?? null,
  });
  return { status: (data as BusinessStatus | null) ?? null, error };
}

export async function adminDecideLocation(companyId: string, decision: 'verify' | 'reject', note: string): Promise<DbError> {
  const { error } = await supabase.rpc('admin_decide_factory_location', { p_company: companyId, p_decision: decision, p_note: note.trim() || null });
  return error;
}

export async function adminHistory(companyId?: string): Promise<{ rows: AuditEntry[]; error: DbError }> {
  const { data, error } = await supabase.rpc('admin_verification_history', { p_company: companyId ?? null });
  return { rows: (data ?? []) as AuditEntry[], error };
}
