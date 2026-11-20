import { INCLUDE_TEMPLATE_SEED_DATA, SEED_OWNER_ID, SEEDED_RFQ_TITLE_LIKE } from '@/lib/seedData';

/**
 * Counts a visitor can trust. Seeded demonstration rows are left out, matching the public
 * catalogues. A failed query stays null so the UI can omit the figure instead of inventing one.
 */
export interface PublicCounts {
  products: number | null;
  suppliers: number | null;
  verifiedSuppliers: number | null;
  openRequirements: number | null;
}

const EMPTY: PublicCounts = {
  products: null,
  suppliers: null,
  verifiedSuppliers: null,
  openRequirements: null,
};

let cache: { at: number; data: PublicCounts } | null = null;
let inflight: Promise<PublicCounts> | null = null;

function asCount(count: number | null, error: { message?: string } | null): number | null {
  if (error || count == null || count < 0) return null;
  return count;
}

async function load(): Promise<PublicCounts> {
  const { supabase } = await import('@/db/supabase');
  const today = new Date().toISOString().slice(0, 10);
  let productsQ = supabase
    .from('products')
    .select('id, companies!company_id!inner(owner_id)', { count: 'exact', head: true })
    .eq('is_active', true);
  let suppliersQ = supabase.from('companies').select('id', { count: 'exact', head: true });
  let verifiedQ = supabase
    .from('companies')
    .select('id', { count: 'exact', head: true })
    .eq('verification_status', 'verified');
  let requirementsQ = supabase
    .from('requirements')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .or(`deadline.is.null,deadline.gte.${today}`);

  if (!INCLUDE_TEMPLATE_SEED_DATA) {
    productsQ = productsQ.neq('companies.owner_id', SEED_OWNER_ID);
    suppliersQ = suppliersQ.neq('owner_id', SEED_OWNER_ID);
    verifiedQ = verifiedQ.neq('owner_id', SEED_OWNER_ID);
    requirementsQ = requirementsQ.not('title', 'like', SEEDED_RFQ_TITLE_LIKE);
  }

  const [products, suppliers, verified, requirements] = await Promise.all([
    productsQ,
    suppliersQ,
    verifiedQ,
    requirementsQ,
  ]);

  return {
    products: asCount(products.count, products.error),
    suppliers: asCount(suppliers.count, suppliers.error),
    verifiedSuppliers: asCount(verified.count, verified.error),
    openRequirements: asCount(requirements.count, requirements.error),
  };
}

export function fetchPublicCounts(): Promise<PublicCounts> {
  if (cache && Date.now() - cache.at < 60_000) return Promise.resolve(cache.data);
  if (!inflight) {
    inflight = load()
      .then((data) => {
        cache = { at: Date.now(), data };
        return data;
      })
      .catch(() => EMPTY)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function formatExactCount(value: number): string {
  return value.toLocaleString('en-IN');
}
