/**
 * Supplier & product discovery (migration 00074): the admin functions and the public directory.
 * The internal records live in the `discovery` schema, which the API does not expose; everything goes through
 * these database functions, which check who is calling.
 */
import { supabase } from '@/db/supabase';

export type VerificationStatus = 'discovered' | 'needs_review' | 'verified' | 'rejected' | 'suspended';
export type PublishStatus = 'internal' | 'published' | 'withheld';

export interface GstCheck {
  id: string;
  method: 'gst_api' | 'gst_portal_manual';
  provider: string | null;
  gstin: string;
  result: 'found' | 'not_found' | 'error' | 'not_configured';
  gst_status: string | null;
  legal_name: string | null;
  trade_name: string | null;
  registered_state: string | null;
  registered_pincode: string | null;
  registered_on: string | null;
  name_score: number | null;
  state_match: boolean | null;
  pincode_match: boolean | null;
  evidence?: Record<string, unknown>;
  checked_at: string;
}

export interface EvidenceRef { value?: string; url?: string; method?: string; context?: string }

export interface DiscoveredSupplier {
  id: string;
  website_host: string;
  website_url: string;
  name_on_site: string;
  gstin: string | null;
  gst_legal_name: string | null;
  gst_trade_name: string | null;
  gst_status: string | null;
  gst_state: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  public_phones: string[];
  public_emails: string[];
  category_slugs: string[];
  source_url: string;
  source_type: string;
  found_via: string | null;
  verification_status: VerificationStatus;
  status_reason: string | null;
  status_set_by: 'system' | 'admin';
  publish_status: PublishStatus;
  published_at: string | null;
  duplicate_of: string | null;
  duplicate_of_name: string | null;
  evidence: { pages?: { url: string; title?: string }[]; found?: Record<string, EvidenceRef | EvidenceRef[] | null>; read_at?: string; pages_read?: number; errors?: { url: string; error: string }[] };
  consecutive_failures: number;
  last_fetched_at: string | null;
  last_verified_at: string | null;
  next_recheck_at: string | null;
  created_at: string;
  product_count: number;
  published_products: number;
  latest_gst_check: GstCheck | null;
}

export interface DiscoveredProduct {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  website_host?: string;
  name: string;
  category_slug: string | null;
  manufacturer: string | null;
  description_source: string | null;
  description: string | null;
  description_generated: boolean;
  specifications: Record<string, string>;
  image_source_url: string | null;
  price_text: string | null;
  moq_text: string | null;
  source_url: string;
  verification_status: VerificationStatus;
  status_reason: string | null;
  publish_status: PublishStatus;
  duplicate_of: string | null;
  source_count?: number;
  sources?: { source_url: string; fetched_at: string; http_status: number | null }[];
  last_fetched_at: string | null;
  last_verified_at: string | null;
  created_at: string;
}

export interface DiscoveryJob {
  id: string;
  kind: 'search' | 'seed_urls';
  query: string | null;
  location: string | null;
  category_slug: string | null;
  seed_urls: string[];
  max_results: number;
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  source_type: string | null;
  attempts: number;
  stats: Record<string, number | string | boolean>;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface DiscoveryLog {
  id: number;
  entity: 'supplier' | 'product' | 'job' | 'settings';
  entity_id: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  detail: Record<string, unknown>;
  actor: string | null;
  created_at: string;
  name?: string | null;
}

export interface DiscoverySettings {
  auto_publish: boolean;
  require_name_match: boolean;
  require_state_match: boolean;
  min_published_products: number;
  publish_product_images: boolean;
  recheck_days: number;
  gst_recheck_days: number;
  max_pages_per_site: number;
  updated_at: string;
}

export interface DiscoveryOverview {
  suppliers: { new: number; needs_review: number; verified: number; published: number; rejected: number; suspended: number; duplicates: number; total: number };
  products: { total: number; verified: number; published: number; needs_review: number; duplicates: number };
  failures_7d: number;
  jobs: { queued: number; running: number; failed: number; last_finished_at: string | null };
  settings: DiscoverySettings;
}

export interface SupplierDetail {
  supplier: DiscoveredSupplier;
  gst_checks: GstCheck[];
  products: DiscoveredProduct[];
  logs: DiscoveryLog[];
}

const MESSAGES: Record<string, string> = {
  admin_only: 'Only admins can do this.',
  note_required: 'Please write a short note: it is kept in the log.',
  only_verified_can_be_published: 'Only a verified supplier can be published.',
  only_verified_products_of_published_suppliers: 'Only verified products of a published supplier can be published.',
  status_and_legal_name_required: 'Enter the GST status and the legal name exactly as the GST portal shows them.',
  invalid_result: 'Choose whether the GST portal found the GSTIN.',
  no_gstin: 'This supplier has no GSTIN to check.',
  query_required: 'Enter what to search for.',
  urls_required: 'Enter at least one website address (https://...).',
  too_many_urls: 'At most 50 websites per job.',
  job_not_cancellable: 'This job has already finished.',
  invalid_duplicate_target: 'Enter the ID of another supplier record.',
  not_found: 'This record no longer exists.',
};

export function discoveryError(message: string | undefined | null): string {
  if (!message) return 'Something went wrong. Please try again.';
  const code = Object.keys(MESSAGES).find((k) => message.includes(k));
  return code ? MESSAGES[code] : message;
}

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.rpc(fn, args);
  return { data: (data as T) ?? null, error: error ? discoveryError(error.message) : null };
}

// ── admin ──
export const adminOverview = () => call<DiscoveryOverview>('admin_discovery_overview');
export const adminSuppliers = (tab: string, search = '', limit = 50, offset = 0) =>
  call<{ total: number; rows: DiscoveredSupplier[] }>('admin_discovery_suppliers', { p_tab: tab, p_search: search || null, p_limit: limit, p_offset: offset });
export const adminSupplierDetail = (id: string) => call<SupplierDetail>('admin_discovery_supplier_detail', { p_id: id });
export const adminProducts = (tab: string, search = '', limit = 50, offset = 0) =>
  call<{ total: number; rows: DiscoveredProduct[] }>('admin_discovery_products', { p_tab: tab, p_search: search || null, p_limit: limit, p_offset: offset });
export const adminJobs = () => call<DiscoveryJob[]>('admin_discovery_jobs', { p_limit: 50 });
export const adminLogs = (kind: 'failures' | 'all' = 'failures') => call<DiscoveryLog[]>('admin_discovery_logs', { p_kind: kind, p_limit: 150 });
export const adminQueueJob = (j: { kind: 'search' | 'seed_urls'; query?: string; location?: string; category?: string; urls?: string[]; maxResults?: number }) =>
  call<string>('admin_discovery_queue_job', {
    p_kind: j.kind, p_query: j.query || null, p_location: j.location || null, p_category: j.category || null,
    p_seed_urls: j.urls ?? [], p_max_results: j.maxResults ?? 20,
  });
export const adminCancelJob = (id: string) => call<null>('admin_discovery_cancel_job', { p_id: id });
export type SupplierAction = 'gst_portal_check' | 'publish' | 'withhold' | 'reject' | 'suspend' | 'restore' | 'mark_duplicate' | 'not_duplicate' | 'suppress' | 'recheck_now';
export const adminSupplierAction = (id: string, action: SupplierAction, note?: string, payload: Record<string, unknown> = {}) =>
  call<{ verification_status: VerificationStatus; publish_status: PublishStatus; reason: string | null }>('admin_discovery_supplier_action', { p_id: id, p_action: action, p_note: note || null, p_payload: payload });
export type ProductAction = 'publish' | 'withhold' | 'reject' | 'restore' | 'mark_duplicate' | 'set_category';
export const adminProductAction = (id: string, action: ProductAction, note?: string, payload: Record<string, unknown> = {}) =>
  call<{ verification_status: VerificationStatus; publish_status: PublishStatus }>('admin_discovery_product_action', { p_id: id, p_action: action, p_note: note || null, p_payload: payload });
export const adminUpdateSettings = (s: Partial<DiscoverySettings>) => call<DiscoverySettings>('admin_discovery_update_settings', { p: s });

// ── public directory (published, verified records only) ──
export interface DirectorySupplier {
  id: string;
  name: string;
  legal_name: string | null;
  city: string | null;
  state: string | null;
  country: string;
  categories: string[];
  gst_status: string | null;
  verified_at: string | null;
  published_at: string | null;
  product_count: number;
  sample_products?: string[];
}
export interface DirectoryProduct {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  specifications: Record<string, string>;
  price_text: string | null;
  moq_text: string | null;
  image_url: string | null;
  checked_at: string;
  supplier_id: string;
}
export const directorySuppliers = (q: { search?: string; category?: string; state?: string; limit?: number; offset?: number }) =>
  call<{ total: number; rows: DirectorySupplier[] }>('directory_suppliers', {
    p_search: q.search || null, p_category: q.category || null, p_state: q.state || null, p_limit: q.limit ?? 24, p_offset: q.offset ?? 0,
  });
export const directorySupplier = (id: string) => call<(DirectorySupplier & { products: DirectoryProduct[] }) | null>('directory_supplier', { p_id: id });

export const CATEGORY_LABELS: Record<string, string> = {
  'agriculture-food': 'Agriculture & Food', 'auto-parts-vehicles': 'Auto Parts & Vehicles', 'chemicals-raw-materials': 'Chemicals & Raw Materials',
  'construction-building': 'Construction & Building', 'electronics-electricals': 'Electronics & Electricals', 'furniture-home': 'Furniture & Home',
  'gems-jewellery': 'Gems & Jewellery', 'handicrafts-gifts': 'Handicrafts & Gifts', 'machinery-industrial': 'Machinery & Industrial',
  packaging: 'Packaging', 'pharma-healthcare': 'Pharma & Healthcare', 'plastics-rubber': 'Plastics & Rubber', 'textiles-apparel': 'Textiles & Apparel',
};
export const categoryLabel = (slug: string | null | undefined) => (slug ? CATEGORY_LABELS[slug] ?? slug : null);

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  discovered: 'Discovered', needs_review: 'Needs review', verified: 'Verified', rejected: 'Rejected', suspended: 'Suspended',
};
export const PUBLISH_LABEL: Record<PublishStatus, string> = { internal: 'Not published', published: 'Published', withheld: 'Withheld' };

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
