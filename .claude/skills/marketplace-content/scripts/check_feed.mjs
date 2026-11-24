#!/usr/bin/env node
/**
 * Checks a BulkSkart demo feed file (feed.json) written by the marketplace-content skill.
 * Usage: node .claude/skills/marketplace-content/scripts/check_feed.mjs demo-content/<folder>/feed.json
 * Exit 0 = every post is labelled demo and makes no forbidden claim. It only reads the file.
 */
import fs from 'node:fs';

const KINDS = new Set([
  'new_product', 'new_variant', 'capacity_added', 'machine_installed', 'sample_available', 'moq_change', 'price_notice',
  'dispatch_schedule', 'holiday_notice', 'catalogue_update', 'now_quoting_market', 'buyer_guide',
]);
const FIELDS = new Set([
  'id', 'is_demo', 'label', 'kind', 'company_name', 'company_slug', 'city', 'state', 'country', 'category_slug', 'title',
  'body', 'tags', 'image_idea', 'posted_at',
]);
const FORBIDDEN = [
  [/\b(certified|certificate|certification|accredited|iso\s?\d{4,5}|who[- ]?gmp|fda[- ]approved|ce[- ]marked|award(ed|s)?|verified|guaranteed|rated|reviews?|testimonial)\b/i, 'a certification, verification, award or review claim'],
  [/\b(best|leading|largest|no\.\s?1|#1|most trusted|top[- ]rated|india'?s (biggest|largest|best))\b/i, 'a superlative'],
  [/\b(delivered|shipped|dispatched|supplied|exported) (\d[\d,]* )?(containers?|orders?|tonnes|pcs|pieces|units)?\s*(to|for) [a-z]/i, 'a completed order or shipment'],
  [/\b(tata|reliance|adani|mahindra|bajaj|godrej|birla|samsung|apple|sony|nike|adidas|puma|amazon|flipkart|indiamart|tradeindia|alibaba|walmart|ikea|zara|decathlon|bosch|siemens|philips|havells|amul|itc|unilever|nestle|dabur|patanjali|raymond|welspun)\b/i, 'a real brand or company name'],
  [/\b(won|bagged|secured|awarded) (an? )?(order|contract|tender)\b/i, 'a completed deal'],
  [/\b(exhibiting|exhibit|stall|booth) at\b/i, 'trade-fair participation'],
  [/\b\d[\d,]*\+? (buyers|suppliers|manufacturers|users|members|businesses)\b/i, 'a platform statistic'],
  [/[\w.+-]+@[\w-]+\.[a-z]{2,}/i, 'an email address'],
  [/(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b|\+\d{1,3}[\s-]?\d{6,}/, 'a phone number'],
];
const LINK = /https?:\/\/[^\s)]+|\bwww\.[^\s)]+/gi;

const file = process.argv[2];
if (!file) {
  console.error('Usage: node check_feed.mjs <feed.json>');
  process.exit(2);
}
let posts;
try {
  posts = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`Cannot read ${file}: ${e.message}`);
  process.exit(2);
}
if (!Array.isArray(posts) || posts.length === 0) {
  console.error('feed.json must be a non-empty array of posts');
  process.exit(1);
}

const errors = [];
const ids = new Set();
const bodies = new Set();
posts.forEach((p, i) => {
  const w = `posts[${i}]${p && p.id ? ` (${p.id})` : ''}`;
  if (typeof p !== 'object' || p === null) return errors.push(`${w}: must be an object`);
  for (const k of Object.keys(p)) if (!FIELDS.has(k)) errors.push(`${w}: field "${k}" is not allowed`);
  if (typeof p.id !== 'string' || !/^demo-post-b\d{3}-\d{4,6}$/.test(p.id)) errors.push(`${w}: id must look like demo-post-b005-0001`);
  else if (ids.has(p.id)) errors.push(`${w}: id is used twice`);
  ids.add(p.id);
  if (p.is_demo !== true) errors.push(`${w}: is_demo must be true`);
  if (p.label !== 'Demo post') errors.push(`${w}: label must be "Demo post"`);
  if (!KINDS.has(p.kind)) errors.push(`${w}: kind must be one of ${[...KINDS].join(', ')}`);
  if (p.kind === 'buyer_guide') {
    if (p.company_name || p.company_slug) errors.push(`${w}: buyer_guide posts are in BulkSkart's voice; leave company fields null`);
  } else {
    if (typeof p.company_name !== 'string' || !/\(Demo\)$/.test(p.company_name.trim())) errors.push(`${w}: company_name must end in "(Demo)"`);
    if (typeof p.company_slug !== 'string' || !p.company_slug.startsWith('demo-')) errors.push(`${w}: company_slug must start with "demo-"`);
  }
  if (typeof p.title !== 'string' || p.title.length < 8 || p.title.length > 90) errors.push(`${w}: title must be 8–90 characters`);
  if (typeof p.body !== 'string' || !p.body.startsWith('Demo post:')) errors.push(`${w}: body must start with "Demo post:"`);
  else {
    const words = p.body.split(/\s+/).length;
    if (words < 15 || words > 160) errors.push(`${w}: body has ${words} words; keep 15–160`);
    const key = p.body.replace(/\d+/g, '#').toLowerCase();
    if (bodies.has(key)) errors.push(`${w}: body repeats another post`);
    bodies.add(key);
  }
  if (p.posted_at !== undefined && Number.isNaN(Date.parse(p.posted_at))) errors.push(`${w}: posted_at must be an ISO date-time`);
  if (p.posted_at && Date.parse(p.posted_at) > Date.now() + 60_000) errors.push(`${w}: posted_at is in the future`);
  if (p.tags !== undefined && (!Array.isArray(p.tags) || p.tags.some((t) => typeof t !== 'string'))) errors.push(`${w}: tags must be a list of text`);
  const textAll = [p.title, p.body, p.image_idea, ...(Array.isArray(p.tags) ? p.tags : [])].filter((x) => typeof x === 'string').join(' \n ');
  // a BulkSkart guide may explain what verification or a certificate means; company posts may not claim one
  for (const [re, what] of p.kind === 'buyer_guide' ? FORBIDDEN.slice(1) : FORBIDDEN) {
    const m = textAll.match(re);
    if (m) errors.push(`${w}: contains ${what} ("${m[0]}")`);
  }
  for (const link of textAll.match(LINK) ?? []) {
    if (!/^(https?:\/\/)?(www\.)?bulkskart\.com(\/|$)/i.test(link)) errors.push(`${w}: link "${link}" is not a bulkskart.com page`);
  }
});

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) in ${file}:`);
  for (const e of errors.slice(0, 200)) console.error(`  - ${e}`);
  if (errors.length > 200) console.error(`  ... and ${errors.length - 200} more`);
  process.exit(1);
}
const kinds = posts.reduce((m, p) => ((m[p.kind] = (m[p.kind] ?? 0) + 1), m), {});
console.log(`✓ ${posts.length} demo posts are labelled and clean`, kinds);
