#!/usr/bin/env node
/**
 * BulkSkart demo-data builder, shared by the product-listing and buyer-requirements skills.
 *
 * Reads a data.json of demo companies, products and/or requirements, checks every row against the demo rules,
 * adds the demo labels the website already recognises (src/lib/seedData.ts), and writes next to it:
 *   insert.sql    one transaction for the Supabase SQL editor
 *   cleanup.sql   removes exactly this batch again
 *   summary.json  counts, id range, lot range
 *
 * Usage:
 *   node .claude/skills/product-listing/scripts/demo_sql.mjs demo-content/<folder>/data.json
 *   node .claude/skills/product-listing/scripts/demo_sql.mjs demo-content/<folder>/data.json --check   (validate only)
 *
 * It never overwrites: it stops if insert.sql, cleanup.sql or summary.json already exist in that folder.
 * It never connects to a database. A person reviews insert.sql and runs it.
 */
import fs from 'node:fs';
import path from 'node:path';

// The website hides rows carrying these markers from public listings and counts (src/lib/seedData.ts).
const SEED_OWNER_ID = '00000000-0000-0000-0000-000000000001'; // template demo supplier account (profiles.role = supplier)
const DEMO_BUYER_ID = '00000000-0000-0000-0000-000000000002'; // template demo buyer account (profiles.role = buyer)
const COMPANY_ID_PREFIX = 'e1000001-0000-0000-0000-';
const STORAGE_PREFIX = 'https://www.bulkskart.com/storage/v1/object/public/';

const COMPANY_NOTE = 'DEMO LISTING: sample company made for BulkSkart demo content. Not a real business; do not contact, quote or order.';
const PRODUCT_NOTE = 'DEMO LISTING: sample product made for BulkSkart demo content. Not for sale.';
// must contain "seeded for BulkSkart production RFQ feed" (SEEDED_FEED_DESCRIPTION in src/lib/seedData.ts)
const RFQ_NOTE = 'Demo requirement seeded for BulkSkart production RFQ feed. No buyer posted it; do not quote.';

// Triggers that tell real users about new rows. They are paused inside the load transaction only.
const NOTIFY_TRIGGERS = {
  companies: ['trg_match_on_new_manufacturer'], // calls the match-new-manufacturer function
  products: ['trg_notify_followers'], // notifies buyers who follow the company
  requirements: ['trg_rfq_matching_on_new_req'], // calls run-rfq-matching, which alerts manufacturers
};

const BUSINESS_TYPES = ['Manufacturer', 'Exporter', 'Wholesaler', 'Distributor', 'Importer', 'Trader'];
const EMPLOYEE_RANGES = ['1-10', '11-50', '51-100', '101-200', '201-500', '501-1000', '1001-5000', '5000+'];
const RFQ_STATUSES = ['active', 'closed', 'expired'];
const MAX_ROWS = 20000;
const CHUNK = 500;

const COMPANY_FIELDS = new Set([
  'seq', 'company_name', 'slug', 'description', 'tagline', 'business_type', 'city', 'state', 'country', 'pincode',
  'year_established', 'employee_count_range', 'annual_turnover_range', 'export_destinations', 'key_products',
  'payment_terms', 'production_capacity', 'moq_policy', 'packaging_details', 'logo_url', 'cover_url',
]);
const PRODUCT_FIELDS = new Set([
  'company_seq', 'company_id', 'category_slug', 'name', 'slug', 'description', 'specifications', 'moq', 'moq_unit',
  'price_min', 'price_max', 'price_currency', 'tags', 'export_destinations', 'images', 'is_active',
]);
const REQUIREMENT_FIELDS = new Set([
  'seq', 'category_slug', 'title', 'description', 'specifications', 'quantity', 'quantity_unit', 'destination_country',
  'destination_city', 'deadline', 'budget_min', 'budget_max', 'currency', 'is_urgent', 'status', 'posted_days_ago',
  'expires_in_days',
]);

// Things a demo row must never say or carry.
const CONTACT_PATTERNS = [
  [/[\w.+-]+@[\w-]+\.[a-z]{2,}/i, 'an email address'],
  [/https?:\/\/|\bwww\./i, 'a web address'],
  [/(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/, 'a phone number'],
  [/\+\d{1,3}[\s-]?\d{6,}/, 'a phone number'],
  [/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/, 'a GSTIN'],
  [/\b[A-Z]{5}\d{4}[A-Z]\b/, 'a PAN'],
  [/\b[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}\b/, 'a CIN'],
];
const CLAIM_PATTERN =
  /\b(certified|certificate|certification|accredited|iso\s?9001|iso\s?14001|who[- ]?gmp|fda[- ]approved|ce[- ]marked|bis[- ]licen[cs]ed|award(ed|s)?|verified|guaranteed|best[- ]selling|top[- ]rated|no\.\s?1|#1|trusted by|leading|largest)\b/i;
const ORDER_PATTERN = /\b(awarded to|order (was )?(placed|completed|delivered|fulfilled)|purchased from|delivered (to|by) [A-Z]|shipped to [A-Z][a-z]+ (Ltd|Pvt|Inc))\b/i;
const LEGAL_SUFFIX = /\b(pvt|private|ltd|limited|llp|inc|llc|gmbh|corp|corporation|plc|opc)\b\.?/i;
const KNOWN_BRANDS =
  /\b(tata|reliance|adani|mahindra|bajaj|godrej|birla|infosys|wipro|larsen|l&t|samsung|apple|sony|lg|nike|adidas|puma|amazon|flipkart|indiamart|tradeindia|alibaba|walmart|ikea|zara|decathlon|bosch|siemens|philips|havells|asian paints|amul|itc|hul|unilever|nestle|dabur|patanjali|arvind|raymond|welspun|vardhman|trident)\b/i;

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

function text(where, v, { required = false, max = 2000 } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) fail(where, 'is required');
    return null;
  }
  if (typeof v !== 'string') return fail(where, 'must be text'), null;
  const s = v.replace(/\s+/g, ' ').trim();
  if (s.length > max) fail(where, `is longer than ${max} characters`);
  return s;
}
function int(where, v, { required = false, min = 0, max = 1e9 } = {}) {
  if (v === undefined || v === null) {
    if (required) fail(where, 'is required');
    return null;
  }
  if (!Number.isInteger(v) || v < min || v > max) return fail(where, `must be a whole number from ${min} to ${max}`), null;
  return v;
}
function num(where, v, { min = 0, max = 1e10 } = {}) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) return fail(where, `must be a number from ${min} to ${max}`), null;
  return Math.round(v * 100) / 100;
}
function list(where, v) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) return fail(where, 'must be a list of text'), [];
  return v.map((x) => x.trim()).filter(Boolean);
}
function storageUrl(where, v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !v.startsWith(STORAGE_PREFIX))
    return fail(where, `must be a file uploaded to BulkSkart storage (${STORAGE_PREFIX}...). Photos from other sites are not allowed.`), null;
  return v;
}
function onlyFields(where, row, allowed) {
  for (const k of Object.keys(row)) if (!allowed.has(k)) fail(where, `field "${k}" is not allowed on demo rows`);
}
function noContacts(where, ...values) {
  const all = values.flat().filter((x) => typeof x === 'string').join(' \n ');
  for (const [re, what] of CONTACT_PATTERNS) if (re.test(all)) fail(where, `contains ${what}; demo rows carry no contact or registration details`);
}
function noClaims(where, ...values) {
  const all = values.flat().filter((x) => typeof x === 'string').join(' \n ');
  const m = all.match(CLAIM_PATTERN);
  if (m) fail(where, `says "${m[0]}"; demo rows make no certification, verification, award or ranking claims`);
  const o = all.match(ORDER_PATTERN);
  if (o) fail(where, `says "${o[0]}"; demo rows never describe completed orders`);
}
const slugify = (s) =>
  s.toLowerCase().replace(/\(demo\)/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const stripDemo = (s) => s.replace(/\s*\(demo\)\s*/gi, ' ').replace(/\s+/g, ' ').trim();
const pad = (n, w) => String(n).padStart(w, '0');

function specsText(where, v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'string') return text(where, v, { max: 4000 });
  if (typeof v !== 'object' || Array.isArray(v)) return fail(where, 'must be an object of "name": "value" or text'), null;
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val !== 'string' && typeof val !== 'number') fail(`${where}.${k}`, 'must be text or a number');
    out[k.trim()] = String(val).trim();
  }
  // ProductDetailPage parses a JSON object into a specification table
  return JSON.stringify(out);
}

// ── SQL helpers ──────────────────────────────────────────────────────────────
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined ? 'NULL' : String(v));
const b = (v) => (v ? 'true' : 'false');
const arr = (a) => (a.length ? `ARRAY[${a.map(q).join(', ')}]::text[]` : `'{}'::text[]`);

function insertChunks(table, cols, rows) {
  const out = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    out.push(`INSERT INTO public.${table} (${cols.join(', ')}) VALUES\n${rows.slice(i, i + CHUNK).map((r) => `  (${r.join(', ')})`).join(',\n')};`);
  }
  return out.join('\n\n');
}
function triggerBlock(tables, action) {
  const pairs = tables.flatMap((t) => NOTIFY_TRIGGERS[t].map((g) => `('${t}', '${g}')`));
  if (!pairs.length) return '';
  const verb = action === 'DISABLE' ? 'Paused' : 'Resumed';
  return `DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname::text AS tbl, g.tgname::text AS trg
    FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid JOIN pg_namespace s ON s.oid = c.relnamespace
    WHERE s.nspname = 'public' AND NOT g.tgisinternal AND (c.relname::text, g.tgname::text) IN (VALUES ${pairs.join(', ')})
  LOOP
    EXECUTE format('ALTER TABLE public.%I ${action} TRIGGER %I', t.tbl, t.trg);
    RAISE NOTICE '${verb} trigger % on %', t.trg, t.tbl;
  END LOOP;
END $$;`;
}

// ── main ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const target = args.find((a) => !a.startsWith('--'));
if (!target) {
  console.error('Usage: node demo_sql.mjs <folder or data.json> [--check]');
  process.exit(2);
}
const dataPath = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, 'data.json') : target;
const dir = path.dirname(dataPath);
let data;
try {
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (e) {
  console.error(`Cannot read ${dataPath}: ${e.message}`);
  process.exit(2);
}

const batch = int('batch', data.batch, { required: true, min: 1, max: 999 });
const B3 = pad(batch ?? 0, 3);
const B4 = pad(batch ?? 0, 4);
const companyPrefix = `${COMPANY_ID_PREFIX}dd${B4}`;
const year = new Date().getUTCFullYear();

// companies
const companies = [];
const seenSeq = new Set();
const slugs = new Set();
for (const [i, row] of (data.companies ?? []).entries()) {
  const w = `companies[${i}]`;
  if (typeof row !== 'object' || row === null) { fail(w, 'must be an object'); continue; }
  onlyFields(w, row, COMPANY_FIELDS);
  const seq = int(`${w}.seq`, row.seq, { required: true, min: 1, max: 999999 });
  if (seq !== null && seenSeq.has(seq)) fail(`${w}.seq`, `${seq} is used twice`);
  seenSeq.add(seq);
  const rawName = text(`${w}.company_name`, row.company_name, { required: true, max: 90 }) ?? '';
  const base = stripDemo(rawName);
  if (LEGAL_SUFFIX.test(base)) fail(`${w}.company_name`, `"${base}" has a legal suffix (Pvt Ltd, LLP, ...); demo names must not look like a registered company`);
  if (KNOWN_BRANDS.test(base)) fail(`${w}.company_name`, `"${base}" uses a real brand or company name`);
  const name = `${base} (Demo)`;
  const slug = row.slug ? text(`${w}.slug`, row.slug) : `demo-${slugify(base)}-b${B3}`;
  if (slug && !/^demo-[a-z0-9-]+$/.test(slug)) fail(`${w}.slug`, 'must start with "demo-" and use a-z, 0-9 and -');
  if (slugs.has(slug)) fail(`${w}.slug`, `${slug} is used twice`);
  slugs.add(slug);
  const description = text(`${w}.description`, row.description, { required: true, max: 1800 });
  const tagline = text(`${w}.tagline`, row.tagline, { max: 120 });
  const businessType = text(`${w}.business_type`, row.business_type) ?? 'Manufacturer';
  if (!BUSINESS_TYPES.includes(businessType)) fail(`${w}.business_type`, `must be one of ${BUSINESS_TYPES.join(', ')}`);
  const employees = text(`${w}.employee_count_range`, row.employee_count_range);
  if (employees && !EMPLOYEE_RANGES.includes(employees)) fail(`${w}.employee_count_range`, `must be one of ${EMPLOYEE_RANGES.join(', ')}`);
  const est = int(`${w}.year_established`, row.year_established, { min: 1900, max: year });
  const c = {
    seq, id: `${companyPrefix}${pad(seq ?? 0, 6)}`, name, slug, description, tagline, businessType,
    city: text(`${w}.city`, row.city, { required: true, max: 80 }),
    state: text(`${w}.state`, row.state, { max: 80 }),
    country: text(`${w}.country`, row.country, { max: 80 }) ?? 'India',
    pincode: text(`${w}.pincode`, row.pincode, { max: 12 }),
    est, years: est ? year - est : null, employees,
    turnover: text(`${w}.annual_turnover_range`, row.annual_turnover_range, { max: 40 }),
    exportTo: list(`${w}.export_destinations`, row.export_destinations),
    keyProducts: list(`${w}.key_products`, row.key_products),
    paymentTerms: list(`${w}.payment_terms`, row.payment_terms),
    capacity: text(`${w}.production_capacity`, row.production_capacity, { max: 200 }),
    moqPolicy: text(`${w}.moq_policy`, row.moq_policy, { max: 300 }),
    packaging: text(`${w}.packaging_details`, row.packaging_details, { max: 300 }),
    logo: storageUrl(`${w}.logo_url`, row.logo_url),
    cover: storageUrl(`${w}.cover_url`, row.cover_url),
    products: 0,
  };
  noContacts(w, c.name, c.description, c.tagline, c.capacity, c.moqPolicy, c.packaging, c.keyProducts, c.paymentTerms);
  noClaims(w, c.name, c.description, c.tagline, c.capacity, c.moqPolicy, c.packaging, c.keyProducts);
  companies.push(c);
}
const companyBySeq = new Map(companies.map((c) => [c.seq, c]));

// products
const products = [];
const existingCompanyIds = new Set();
for (const [i, row] of (data.products ?? []).entries()) {
  const w = `products[${i}]`;
  if (typeof row !== 'object' || row === null) { fail(w, 'must be an object'); continue; }
  onlyFields(w, row, PRODUCT_FIELDS);
  let companyId = null;
  if (row.company_seq !== undefined) {
    const c = companyBySeq.get(row.company_seq);
    if (!c) fail(`${w}.company_seq`, `no company with seq ${row.company_seq} in this file`);
    else { companyId = c.id; c.products += 1; }
  } else if (typeof row.company_id === 'string' && row.company_id.startsWith(COMPANY_ID_PREFIX) && /^[0-9a-f-]{36}$/.test(row.company_id)) {
    companyId = row.company_id;
    existingCompanyIds.add(companyId);
  } else {
    fail(w, `needs company_seq (a company in this file) or company_id of an existing demo company (${COMPANY_ID_PREFIX}...). Demo products never go on real companies.`);
  }
  const base = stripDemo(text(`${w}.name`, row.name, { required: true, max: 110 }) ?? '');
  const name = `${base} (Demo)`;
  const slug = row.slug ? text(`${w}.slug`, row.slug) : `demo-${slugify(base)}-b${B3}-${products.length + 1}`;
  if (slug && !new RegExp(`^demo-[a-z0-9-]+-b${B3}-[0-9]+$`).test(slug)) fail(`${w}.slug`, `must look like demo-<name>-b${B3}-<n>`);
  if (slugs.has(slug)) fail(`${w}.slug`, `${slug} is used twice`);
  slugs.add(slug);
  const priceMin = num(`${w}.price_min`, row.price_min);
  const priceMax = num(`${w}.price_max`, row.price_max);
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) fail(w, 'price_min is above price_max');
  const currency = (text(`${w}.price_currency`, row.price_currency) ?? 'INR').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) fail(`${w}.price_currency`, 'must be a 3-letter code such as INR or USD');
  const category = text(`${w}.category_slug`, row.category_slug, { required: true });
  if (category && !/^[a-z0-9-]+$/.test(category)) fail(`${w}.category_slug`, 'must be a category slug');
  const tags = [...new Set(['demo', ...list(`${w}.tags`, row.tags).map((t) => t.toLowerCase())])].slice(0, 12);
  const images = list(`${w}.images`, row.images).map((u, k) => storageUrl(`${w}.images[${k}]`, u)).filter(Boolean);
  if (images.length > 10) fail(`${w}.images`, 'at most 10 images per product (the product form allows 10)');
  const p = {
    companyId, category, name, slug,
    description: text(`${w}.description`, row.description, { required: true, max: 3000 }),
    specs: specsText(`${w}.specifications`, row.specifications),
    moq: int(`${w}.moq`, row.moq, { required: true, min: 1, max: 100000000 }),
    moqUnit: text(`${w}.moq_unit`, row.moq_unit, { max: 30 }) ?? 'pcs',
    priceMin, priceMax, currency, tags,
    exportTo: list(`${w}.export_destinations`, row.export_destinations),
    images, active: row.is_active !== false,
  };
  noContacts(w, p.name, p.description, p.specs);
  noClaims(w, p.name, p.description, p.specs, p.tags);
  products.push(p);
}

// requirements
const requirements = [];
const seenReq = new Set();
for (const [i, row] of (data.requirements ?? []).entries()) {
  const w = `requirements[${i}]`;
  if (typeof row !== 'object' || row === null) { fail(w, 'must be an object'); continue; }
  onlyFields(w, row, REQUIREMENT_FIELDS);
  const seq = int(`${w}.seq`, row.seq, { required: true, min: 1, max: 99999 });
  if (seq !== null && seenReq.has(seq)) fail(`${w}.seq`, `${seq} is used twice`);
  seenReq.add(seq);
  const lot = `9${B3}${pad(seq ?? 0, 5)}`;
  const base = stripDemo((text(`${w}.title`, row.title, { required: true, max: 140 }) ?? '').replace(/\s*-\s*Lot #\d+\s*$/i, ''));
  const budgetMin = num(`${w}.budget_min`, row.budget_min);
  const budgetMax = num(`${w}.budget_max`, row.budget_max);
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) fail(w, 'budget_min is above budget_max');
  const status = text(`${w}.status`, row.status) ?? 'active';
  if (!RFQ_STATUSES.includes(status)) fail(`${w}.status`, `must be one of ${RFQ_STATUSES.join(', ')}`);
  const posted = int(`${w}.posted_days_ago`, row.posted_days_ago, { min: 0, max: 60 }) ?? 0;
  const expires = int(`${w}.expires_in_days`, row.expires_in_days, { min: 1, max: 90 }) ?? 30;
  const deadline = text(`${w}.deadline`, row.deadline);
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) fail(`${w}.deadline`, 'must be YYYY-MM-DD');
  if (deadline && new Date(`${deadline}T23:59:59Z`).getTime() < Date.now() - posted * 864e5) fail(`${w}.deadline`, 'is before the day it was posted');
  const currency = (text(`${w}.currency`, row.currency) ?? 'INR').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) fail(`${w}.currency`, 'must be a 3-letter code');
  const category = text(`${w}.category_slug`, row.category_slug, { required: true });
  if (category && !/^[a-z0-9-]+$/.test(category)) fail(`${w}.category_slug`, 'must be a category slug');
  const r = {
    seq, lot, category,
    title: `${base} (Demo) - Lot #${lot}`, // " - Lot #<digits>" at the end: SEEDED_RFQ_TITLE in src/lib/seedData.ts
    description: `${RFQ_NOTE} ${text(`${w}.description`, row.description, { required: true, max: 2500 }) ?? ''}`.trim(),
    specs: specsText(`${w}.specifications`, row.specifications),
    quantity: int(`${w}.quantity`, row.quantity, { required: true, min: 1, max: 2000000000 }),
    unit: text(`${w}.quantity_unit`, row.quantity_unit, { max: 30 }) ?? 'pcs',
    country: text(`${w}.destination_country`, row.destination_country, { required: true, max: 80 }),
    city: text(`${w}.destination_city`, row.destination_city, { max: 80 }),
    deadline, budgetMin, budgetMax, currency, status, posted, expires,
    urgent: row.is_urgent === true,
  };
  noContacts(w, r.title, r.description, r.specs);
  const o = `${r.title} ${r.description}`.match(ORDER_PATTERN);
  if (o) fail(w, `says "${o[0]}"; demo requirements never describe completed orders`);
  requirements.push(r);
}

const total = companies.length + products.length + requirements.length;
if (total === 0) fail('data.json', 'has no companies, products or requirements');
if (total > MAX_ROWS) fail('data.json', `has ${total} rows; split batches above ${MAX_ROWS} rows`);

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) in ${dataPath}:`);
  for (const e of errors.slice(0, 200)) console.error(`  - ${e}`);
  if (errors.length > 200) console.error(`  ... and ${errors.length - 200} more`);
  process.exit(1);
}
const counts = { companies: companies.length, products: products.length, requirements: requirements.length };
if (checkOnly) {
  console.log(`✓ ${dataPath} is valid demo data for batch ${batch}:`, counts);
  process.exit(0);
}

const outFiles = ['insert.sql', 'cleanup.sql', 'summary.json'].map((f) => path.join(dir, f));
const existing = outFiles.filter((f) => fs.existsSync(f));
if (existing.length) {
  console.error(`✗ Not overwriting ${existing.join(', ')}. Use a new folder and a new batch number.`);
  process.exit(1);
}

const tables = Object.entries(counts).filter(([, v]) => v > 0).map(([k]) => k);
const categorySlugs = [...new Set([...products, ...requirements].map((x) => x.category))];
const productSlugPattern = `demo-%-b${B3}-%`;
const lotPattern = `% - Lot #9${B3}_____`;

const checks = [];
if (companies.length) {
  checks.push(`  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '${SEED_OWNER_ID}' AND role = 'supplier') THEN
    RAISE EXCEPTION 'The demo supplier account ${SEED_OWNER_ID} is missing; demo companies need it as owner.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.companies WHERE id::text LIKE '${companyPrefix}%') THEN
    RAISE EXCEPTION 'Demo batch ${batch} companies are already loaded. Run cleanup.sql first or use a new batch number.';
  END IF;`);
}
if (products.length) {
  checks.push(`  IF EXISTS (SELECT 1 FROM public.products WHERE slug LIKE '${productSlugPattern}') THEN
    RAISE EXCEPTION 'Demo batch ${batch} products are already loaded. Run cleanup.sql first or use a new batch number.';
  END IF;`);
}
if (existingCompanyIds.size) {
  checks.push(`  SELECT array_agg(x) INTO missing FROM unnest(ARRAY[${[...existingCompanyIds].map(q).join(', ')}]::uuid[]) x
    WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = x AND c.owner_id = '${SEED_OWNER_ID}');
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'These are not existing demo companies: %', missing; END IF;`);
}
if (requirements.length) {
  checks.push(`  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '${DEMO_BUYER_ID}' AND role = 'buyer') THEN
    RAISE EXCEPTION 'The demo buyer account ${DEMO_BUYER_ID} is missing; demo requirements need it as buyer.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.requirements WHERE buyer_id = '${DEMO_BUYER_ID}' AND title LIKE '${lotPattern}') THEN
    RAISE EXCEPTION 'Demo batch ${batch} requirements are already loaded. Run cleanup.sql first or use a new batch number.';
  END IF;`);
}
if (categorySlugs.length) {
  checks.push(`  SELECT array_agg(s) INTO missing_slugs FROM unnest(ARRAY[${categorySlugs.map(q).join(', ')}]::text[]) s
    WHERE NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.slug = s);
  IF missing_slugs IS NOT NULL THEN RAISE EXCEPTION 'Unknown category slugs: %', missing_slugs; END IF;`);
}

const cat = (slug) => `(SELECT id FROM public.categories WHERE slug = ${q(slug)} ORDER BY parent_id NULLS FIRST LIMIT 1)`;
const parts = [];
if (companies.length) {
  parts.push(`-- ${companies.length} demo companies: owner = demo supplier account, unverified, not featured, no rating, no GST/IEC/contact details
${insertChunks('companies', [
    'id', 'owner_id', 'company_name', 'slug', 'description', 'tagline', 'business_type', 'city', 'state', 'country', 'pincode',
    'year_established', 'years_in_business', 'employee_count_range', 'annual_turnover_range', 'export_destinations', 'key_products',
    'payment_terms', 'production_capacity', 'moq_policy', 'packaging_details', 'logo_url', 'cover_url',
    'verification_status', 'is_verified', 'is_featured', 'rating_avg', 'review_count', 'total_quotes_sent', 'total_products',
  ], companies.map((c) => [
    q(c.id), q(SEED_OWNER_ID), q(c.name), q(c.slug), q(`${COMPANY_NOTE} ${c.description}`), q(c.tagline), q(c.businessType),
    q(c.city), q(c.state), q(c.country), q(c.pincode), n(c.est), n(c.years), q(c.employees), q(c.turnover), arr(c.exportTo),
    arr(c.keyProducts), arr(c.paymentTerms), q(c.capacity), q(c.moqPolicy), q(c.packaging), q(c.logo), q(c.cover),
    `'unverified'`, 'false', 'false', '0', '0', '0', n(c.products),
  ]))}`);
}
if (products.length) {
  parts.push(`-- ${products.length} demo products, only on demo companies, tagged "demo", not featured
${insertChunks('products', [
    'company_id', 'category_id', 'name', 'slug', 'description', 'specifications', 'moq', 'moq_unit', 'price_min', 'price_max',
    'price_currency', 'tags', 'export_destinations', 'images', 'is_active', 'is_featured', 'view_count',
  ], products.map((p) => [
    q(p.companyId), cat(p.category), q(p.name), q(p.slug), q(`${PRODUCT_NOTE} ${p.description}`), q(p.specs), n(p.moq),
    q(p.moqUnit), n(p.priceMin), n(p.priceMax), q(p.currency), arr(p.tags), arr(p.exportTo), arr(p.images), b(p.active), 'false', '0',
  ]))}`);
}
if (requirements.length) {
  parts.push(`-- ${requirements.length} demo requirements from the demo buyer account; not a verified buyer; no quotes, views or orders
${insertChunks('requirements', [
    'buyer_id', 'category_id', 'title', 'description', 'specifications', 'quantity', 'quantity_unit', 'destination_country',
    'destination_city', 'deadline', 'budget_min', 'budget_max', 'currency', 'status', 'is_urgent', 'quote_count', 'view_count',
    'is_verified_buyer', 'source_type', 'created_at', 'updated_at', 'expires_at',
  ], requirements.map((r) => {
    const at = `now() - interval '${r.posted} days' - interval '${(r.seq * 37) % 1440} minutes'`;
    return [
      q(DEMO_BUYER_ID), cat(r.category), q(r.title), q(r.description), q(r.specs), n(r.quantity), q(r.unit), q(r.country), q(r.city),
      r.deadline ? `${q(r.deadline)}::date` : 'NULL', n(r.budgetMin), n(r.budgetMax), q(r.currency), q(r.status), b(r.urgent),
      '0', '0', 'false', `'bulkskart'`, at, at, `${at} + interval '${r.expires} days'`,
    ];
  }))}`);
}

const header = `-- ═══════════════════════════════════════════════════════════════════════════
-- BULKSKART DEMO DATA, batch ${batch}. NOT REAL BUSINESSES, PRODUCTS OR BUYERS.
-- ${counts.companies} companies, ${counts.products} products, ${counts.requirements} requirements.
-- Built by .claude/skills/product-listing/scripts/demo_sql.mjs from ${path.basename(dataPath)}.
--
-- Labels the website recognises (src/lib/seedData.ts), so these rows stay out of
-- the public RFQ feeds, live counts and the supplier map:
--   companies     owner ${SEED_OWNER_ID}, id ${companyPrefix}NNNNNN, name "... (Demo)", unverified
--   products      on demo companies only, slug ${productSlugPattern}, name "... (Demo)", tag "demo"
--   requirements  buyer ${DEMO_BUYER_ID}, title "... (Demo) - Lot #9${B3}NNNNN",
--                 description starts "${RFQ_NOTE}"
-- No accounts, subscriptions, orders, quotations, reviews, verifications or notifications are created.
--
-- Run: paste the whole file into the Supabase SQL editor. It is one transaction; it stops
-- without changing anything if the batch is already loaded or a category slug is unknown.
-- The triggers that alert real users about new rows are paused inside the transaction only.
-- Undo: run cleanup.sql from the same folder.
-- ═══════════════════════════════════════════════════════════════════════════
`;

const insertSql = `${header}
BEGIN;

DO $$
DECLARE missing uuid[]; missing_slugs text[];
BEGIN
${checks.join('\n')}
END $$;

-- pause the triggers that would notify real manufacturers and buyers about demo rows
${triggerBlock(tables, 'DISABLE')}

${parts.join('\n\n')}

${triggerBlock(tables, 'ENABLE')}

SELECT 'demo batch ${batch} loaded' AS result,
${[
  companies.length ? `  (SELECT count(*) FROM public.companies WHERE id::text LIKE '${companyPrefix}%') AS companies` : null,
  products.length ? `  (SELECT count(*) FROM public.products WHERE slug LIKE '${productSlugPattern}') AS products` : null,
  requirements.length ? `  (SELECT count(*) FROM public.requirements WHERE buyer_id = '${DEMO_BUYER_ID}' AND title LIKE '${lotPattern}') AS requirements` : null,
].filter(Boolean).join(',\n')};

COMMIT;
`;

const cleanupSql = `-- Removes BulkSkart demo batch ${batch} (and nothing else). Safe to run more than once.
BEGIN;
${requirements.length ? `DELETE FROM public.requirements
 WHERE buyer_id = '${DEMO_BUYER_ID}'
   AND title LIKE '${lotPattern}'
   AND description LIKE ${q(`${RFQ_NOTE}%`)};
` : ''}${products.length ? `DELETE FROM public.products
 WHERE slug LIKE '${productSlugPattern}'
   AND company_id::text LIKE '${COMPANY_ID_PREFIX}%'
   AND 'demo' = ANY (tags);
` : ''}${companies.length ? `DELETE FROM public.companies
 WHERE id::text LIKE '${companyPrefix}%'
   AND owner_id = '${SEED_OWNER_ID}';
` : ''}COMMIT;
`;

const summary = {
  batch,
  generated_at: new Date().toISOString(),
  demo: true,
  counts,
  company_ids: companies.length ? `${companyPrefix}000001 … ${companyPrefix}${pad(Math.max(...companies.map((c) => c.seq)), 6)}` : null,
  product_slug_pattern: products.length ? productSlugPattern : null,
  requirement_lots: requirements.length ? `9${B3}00001 … 9${B3}${pad(Math.max(...requirements.map((r) => r.seq)), 5)}` : null,
  category_slugs: categorySlugs,
  demo_owner_id: companies.length ? SEED_OWNER_ID : null,
  demo_buyer_id: requirements.length ? DEMO_BUYER_ID : null,
};

for (const [file, body] of [[outFiles[0], insertSql], [outFiles[1], cleanupSql], [outFiles[2], `${JSON.stringify(summary, null, 2)}\n`]]) {
  fs.writeFileSync(file, body, { flag: 'wx' }); // wx: fail rather than overwrite
}
console.log(`✓ Demo batch ${batch}:`, counts);
if (total > 5000) {
  console.log(`  ! ${total} rows make a ${(Buffer.byteLength(insertSql) / 1e6).toFixed(1)} MB insert.sql. The Supabase SQL editor handles about 5,000 rows per paste;
    split larger jobs into several batches, or run the file with psql.`);
}
for (const f of outFiles) console.log(`  wrote ${f}`);
