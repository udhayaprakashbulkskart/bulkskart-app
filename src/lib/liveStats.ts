/**
 * Live numbers for the home page, counted from the database (never typed in):
 *  - openRfqs: open RFQs from BulkSkart buyers, the same ones the Live RFQ feed shows
 *  - suppliers: companies on BulkSkart, without the template's demo companies
 *  - buyers: active buyer accounts
 *  - industries: top-level categories
 * One request set per minute is shared by every section that asks.
 */
import { supabase } from '@/db/supabase';
import { isOutsideListing, withoutOutsideOrDemoRfqs } from '@/lib/rfqSources';
import { INCLUDE_TEMPLATE_SEED_DATA, isSeededRequirement, SEED_COMPANY_ID_PREFIX, SEED_OWNER_ID, SEEDED_RFQ_TITLE_LIKE } from '@/lib/seedData';

export interface LiveStats {
  openRfqs: number | null;
  suppliers: number | null;
  buyers: number | null;
  industries: number | null;
}

let cached: { at: number; promise: Promise<LiveStats> } | null = null;

async function fetchLiveStats(): Promise<LiveStats> {
  const nowIso = new Date().toISOString();
  let open = supabase
    .from('requirements')
    .select('id,title,description,specifications')
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .or(`deadline.is.null,deadline.gt.${nowIso}`);
  if (!INCLUDE_TEMPLATE_SEED_DATA) open = open.not('title', 'like', SEEDED_RFQ_TITLE_LIKE);
  let companiesQuery = supabase.from('companies').select('id', { count: 'exact', head: true });
  if (!INCLUDE_TEMPLATE_SEED_DATA) {
    companiesQuery = companiesQuery.neq('owner_id', SEED_OWNER_ID).not('id', 'like', `${SEED_COMPANY_ID_PREFIX}%`);
  }
  const [rfqs, companies, buyers, industries] = await Promise.all([
    withoutOutsideOrDemoRfqs(open).limit(1000),
    companiesQuery,
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'buyer').eq('status', 'active'),
    supabase.from('categories').select('id', { count: 'exact', head: true }).is('parent_id', null),
  ]);
  return {
    openRfqs: rfqs.error ? null : (rfqs.data ?? []).filter((r) => !isOutsideListing(r as never) && !isSeededRequirement(r as never)).length,
    suppliers: companies.error ? null : companies.count ?? null,
    buyers: buyers.error ? null : buyers.count ?? null,
    industries: industries.error ? null : industries.count ?? null,
  };
}

export function loadLiveStats(): Promise<LiveStats> {
  if (!cached || Date.now() - cached.at > 60_000) {
    cached = { at: Date.now(), promise: fetchLiveStats().catch(() => ({ openRfqs: null, suppliers: null, buyers: null, industries: null })) };
  }
  return cached.promise;
}

/** "1,250+" for a count, "—" while unknown. */
export function countLabel(n: number | null): string {
  if (n === null) return '—';
  return n > 0 ? `${n.toLocaleString('en-IN')}+` : '0';
}
