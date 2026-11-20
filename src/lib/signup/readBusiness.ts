import { matchCategories, soundsLikeAProduct } from './categories';
import { findGstin, GSTIN_IN_TEXT, type GstinInfo } from './gstin';
import { readPlace } from './places';
import type { ProductCategory, SupplierBusinessType, TradeType } from './vocab';

/**
 * Turns what a manufacturer writes about their business ("We make HDPE pipes and fittings in Vadodara, Gujarat.
 * 15 years in business.") into the details a profile needs.
 *
 * It reads the words with fixed rules and word lists: nothing is sent anywhere, the answer is the same every time,
 * and anything it is not sure of is left empty for the person to fill in.
 */

export interface BusinessReading {
  companyName: string | null;
  /** the main thing the business does */
  businessType: SupplierBusinessType | null;
  /** everything it says the business does, main one first */
  businessTypes: SupplierBusinessType[];
  tradeType: TradeType | null;
  categories: ProductCategory[];
  products: string[];
  city: string | null;
  state: string | null;
  /** only when a year is written ("since 2005") */
  yearEstablished: number | null;
  /** only when it is written ("15 years in business") */
  yearsInBusiness: number | null;
  gstin: GstinInfo | null;
  /** whether the text told us anything we could use */
  understood: boolean;
}

const EMPTY: BusinessReading = {
  companyName: null,
  businessType: null,
  businessTypes: [],
  tradeType: null,
  categories: [],
  products: [],
  city: null,
  state: null,
  yearEstablished: null,
  yearsInBusiness: null,
  gstin: null,
  understood: false,
};

// ── what kind of business ────────────────────────────────────────────────────────────────────────────────────────

/** In order of importance: a "manufacturer and exporter" is a manufacturer first. */
const TYPE_PATTERNS: ReadonlyArray<readonly [SupplierBusinessType, RegExp]> = [
  ['Manufacturer', /\b(?:manufactur\w*|mfg|mfr|factory|factories|mills?|production\s+unit|fabricat\w*|foundry|processing\s+unit|producers?|making|producing|we\s+(?:make|produce|process))\b/i],
  ['Exporter', /\bexport(?:s|ed|ing|er|ers)?\b/i],
  ['Distributor', /\b(?:distribut\w*|authori[sz]ed\s+dealers?|channel\s+partners?)\b/i],
  ['Wholesaler', /\b(?:wholesal\w*|stockists?|traders?|trading|dealers?|dealing|deals?\s+in)\b/i],
  ['Importer', /\b(?:importers?|importing|we\s+import|imports?\s+(?:of|from))\b/i],
];

// ── the products ─────────────────────────────────────────────────────────────────────────────────────────────────

const ROLE = '(?:manufacturer|producer|supplier|exporter|importer|trader|dealer|distributor|wholesaler|stockist|fabricator|processor)s?';
const LEADING_ROLE = new RegExp(`^(?:(?:and|&|,|or|/)\\s*)?${ROLE}\\s+(?:of|in|for)\\s+`, 'i');
/** "we manufacture X", "making X", "dealing in X": the products follow the verb */
const VERB_FORMS =
  'manufactur(?:e|es|ed|ing)|mfg|mfr|fabricat(?:e|es|ing|ion)|produc(?:e|es|ing)|mak(?:e|es|ing)|suppl(?:y|ies|ying)|export(?:s|ing)?|import(?:s|ing)?|deal(?:s|ing)?\\s+in|trad(?:e|es|ing)\\s+in|distribut(?:e|es|ing)|wholesal(?:e|es|ing)|process(?:es|ing)';
/** "manufacturer of X": the products follow when the role is followed by "of"; "manufacturer in Pune" names a place */
const ROLE_NOUNS = 'manufacturers?|producers?|suppliers?|exporters?|importers?|traders?|dealers?|distributors?|wholesalers?|stockists?|fabricators?|processors?';
const VERB = new RegExp(`\\b(?:${VERB_FORMS})\\b\\s*(?:of\\s+|in\\s+)?|\\b(?:${ROLE_NOUNS})\\s+of\\s+`, 'i');
/** "I own a rice mill in Thanjavur" */
const OWNS = /\b(?:own|run|operate|manage|have)\s+(?:a|an|the)\s+(.+?)(?=\s+(?:in|at|from|near|based|located)\b|[.,;|]|$)/i;
/** Where the list of products stops: "... pipes and fittings in Vadodara", "... rice from Karnal", "... since 1998", "... | Noida" */
const TAIL_STOP = /\s(?:in|at|from|near|based|located|situated|since|with|having|for|across|to|serving|established|founded|operating|offering|supplying|exporting|importing)\s|\s\(|\s?[|–—]\s?|\s-\s|[.;!?\n]/i;
const SPLIT = /\s*(?:,|;|&|\/|\||\band\b|\bas\s+well\s+as\b|\balong\s+with\b|\bplus\b)\s*/i;
const PREFIX_NOISE =
  /^(?:all\s+(?:kinds|types|sorts)\s+of|wide\s+range\s+of|range\s+of|variety\s+of|various|different|assorted|high[-\s]quality|best[-\s]quality|top[-\s]quality|quality|premium|leading|reliable|genuine|affordable|bulk|wholesale|customi[sz]ed|custom|branded|our|the|a|an|also|many|more)\s+/i;
const SUFFIX_NOISE = /\s*\b(?:etc|and\s+more|and\s+others|more|products?|items?)\b\.?$/i;
/** "<products> manufacturer": the products come before the role word; "we are leading manufacturers" has none */
const BEFORE_ROLE = new RegExp(`^(.*?)\\s*\\b${ROLE}\\b`, 'i');
const SENTENCE_WORDS = /\b(?:we|i|my|our|are|is|am|a|an|the|also|own|run|have|has|sell|selling|want|looking)\b/i;
/** "and" and "&" join products, so they do not make the words a sentence */
const SPLIT_WORDS = /\band\b|&/gi;
/** Things said about a business rather than made by it: "GMP certified", "ISO 9001", "20 years" */
const CLAIMS = /^(?:iso|gmp|who|haccp|fssai|bis|ce)\b|\b(?:certified|certification|approved|experience|years?|yrs?)\b/i;
/** Words that are not a product on their own */
const NOT_PRODUCTS = new Set([
  'products', 'product', 'goods', 'items', 'item', 'material', 'materials', 'things', 'manufacturer', 'manufacturers', 'supplier', 'suppliers',
  'exporter', 'exporters', 'importer', 'importers', 'trader', 'traders', 'dealer', 'dealers', 'company', 'factory', 'business', 'we', 'i', 'also',
]);
/** Written in capitals however they are typed */
const ACRONYMS = new Set([
  'hdpe', 'ldpe', 'lldpe', 'pvc', 'cpvc', 'upvc', 'ppr', 'pp', 'pet', 'abs', 'cnc', 'led', 'pcb', 'mcb', 'ups', 'eva', 'pu', 'tmt', 'aac', 'api', 'oem',
  'ms', 'ss', 'gi', 'frp', 'grp', 'mdf', 'bopp', 'rcc', 'pcc', 'smps', 'vmc', 'ev', 'iso',
]);

function sentenceCase(item: string): string {
  if (/[A-Z]/.test(item)) return item;
  const words = item.split(' ').map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word));
  if (!ACRONYMS.has(words[0].toLowerCase())) words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(' ');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** One fragment of a list, tidied; null when it is not something a manufacturer makes. */
function tidyProduct(fragment: string): string | null {
  let item = fragment.trim().replace(/^["'“”‘’(\[]+|["'“”‘’)\].:\-–]+$/g, '').replace(/\s+/g, ' ');
  for (let i = 0; i < 3; i++) item = item.replace(PREFIX_NOISE, '');
  item = item.replace(SUFFIX_NOISE, '').trim();

  // a place written in the list is not a product: "pipes, fittings, Vadodara, Gujarat"
  const place = readPlace(item);
  for (const name of [place.city, place.state]) {
    if (name) item = item.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i'), '');
  }
  item = item.replace(/\s+/g, ' ').replace(/^[\s,.:;–—-]+|[\s,.:;–—-]+$/g, '').replace(/\s+(?:in|at|from|near|of|based|located)$/i, '');

  if (item.length < 3 || item.length > 50) return null;
  if (!/[a-z]/i.test(item)) return null;
  if (NOT_PRODUCTS.has(item.toLowerCase())) return null;
  if (CLAIMS.test(item)) return null;
  return sentenceCase(item);
}

function addProducts(into: string[], fragments: string[]): void {
  for (const fragment of fragments) {
    const item = tidyProduct(fragment);
    if (item && !into.some((known) => known.toLowerCase() === item.toLowerCase())) into.push(item);
  }
}

function readProducts(text: string): string[] {
  const found: string[] = [];

  // "We manufacture X, Y and Z in ...": what comes after the verb, up to where the place or the year starts
  for (const sentence of text.split(/[.!?]+\s+|\n+/)) {
    const verb = VERB.exec(sentence);
    if (!verb) continue;
    let tail = sentence.slice(verb.index + verb[0].length).trim();
    for (let i = 0; i < 3 && LEADING_ROLE.test(tail); i++) tail = tail.replace(LEADING_ROLE, '');
    tail = ` ${tail}`;
    const stop = tail.search(TAIL_STOP);
    // "we supply to retailers in Mumbai": nothing is named before the next word that ends a list
    if (stop === 0) continue;
    addProducts(found, (stop === -1 ? tail : tail.slice(0, stop)).trim().split(SPLIT));
  }

  // "Cotton hosiery garments exporter from Tiruppur": the products are said before the role
  if (found.length === 0) {
    for (const sentence of text.split(/[.!?]+\s+|\n+/)) {
      const before = BEFORE_ROLE.exec(sentence)?.[1] ?? '';
      if (before && !SENTENCE_WORDS.test(before.replace(SPLIT_WORDS, ' '))) addProducts(found, before.split(SPLIT));
    }
  }

  // "I own a rice mill in Thanjavur"
  if (found.length === 0) {
    const owned = OWNS.exec(text)?.[1];
    if (owned) addProducts(found, [owned]);
  }

  // no verb or role ("HDPE pipes, PVC fittings, Vadodara"): keep the parts that sound like a product
  if (found.length === 0) {
    addProducts(
      found,
      text
        .split(/\s*(?:,|;|\n|\||\s[–—-]\s|[–—]|\band\b)\s*/i)
        .filter((fragment) => !SENTENCE_WORDS.test(fragment) && soundsLikeAProduct(fragment))
        .slice(0, 6),
    );
  }
  return found.slice(0, 8);
}

// ── the name, the years ──────────────────────────────────────────────────────────────────────────────────────────

const LEGAL_WORD =
  'Pvt\\.?\\s*Ltd\\.?|Private\\s+Limited|Limited|Ltd\\.?|LLP|Industries|Enterprises|Enterprise|Exports|Traders|Mills|Works|Corporation|Corp\\.?|Company|Group|International|Overseas';
/** "Shree Ganesh Polymers Pvt Ltd", "Anand Industries": capitalised words, then a word that names a kind of firm */
const NAME_WITH_LEGAL_WORD = new RegExp(`\\b((?:[A-Z][\\w&'’.-]*\\s+){1,6}?)(${LEGAL_WORD})(?=[\\s,.;:-]|$)`);
/** "our company is Sai Polymers" */
const NAME_AFTER_CUE = /\b(?:company\s+name\s+is|our\s+company\s+is|company\s+is|firm\s+is|called|named)\s+((?:[A-Z][\w&'’.-]*)(?:\s+[A-Z][\w&'’.-]*){0,5})/;
const ARTICLES = new Set(['We', 'Our', 'The', 'An', 'A']);
/** Words that describe a business rather than name it */
const DESCRIPTIVE = new Set(['International', 'Overseas', 'Leading', 'Indian', 'Best', 'Top', 'Global', 'Reputed', 'Registered', 'Private', 'Public', 'Limited', 'Group', 'Company']);

function readCompanyName(text: string): string | null {
  let name: string | null = null;
  const legal = NAME_WITH_LEGAL_WORD.exec(text);
  if (legal) {
    const lead = legal[1].trim().split(/\s+/);
    while (lead.length > 0 && ARTICLES.has(lead[0])) lead.shift();
    // "International Company" is a description, not a name: something has to name the firm
    if (lead.length > 0 && !lead.every((word) => DESCRIPTIVE.has(word))) name = `${lead.join(' ')} ${legal[2]}`;
  } else {
    name = NAME_AFTER_CUE.exec(text)?.[1] ?? null;
  }
  if (!name) return null;
  name = name.replace(/[\s,.;:-]+$/, '').replace(/\s+/g, ' ');
  return name.length >= 3 && name.length <= 60 ? name : null;
}

function readYears(text: string, now: Date): Pick<BusinessReading, 'yearEstablished' | 'yearsInBusiness'> {
  const thisYear = now.getFullYear();
  const written = /\b(?:since|established(?:\s+in)?|est\.?|founded(?:\s+in)?|started(?:\s+in)?)\s*[:-]?\s*((?:19[5-9]|20[0-2])\d)\b/i.exec(text);
  const year = written ? Number(written[1]) : null;
  const counted =
    /\b(\d{1,2})\+?\s*years?\s*(?:of\s+)?(?:experience|expertise|in\s+(?:business|the\s+(?:industry|market|field))|old)\b/i.exec(text) ??
    /\b(?:experience|operating|in\s+business)\s+(?:of|for)\s+(\d{1,2})\+?\s*years?\b/i.exec(text);
  const years = counted ? Number(counted[1]) : null;
  return {
    yearEstablished: year !== null && year <= thisYear ? year : null,
    yearsInBusiness: years !== null && years > 0 && years <= 120 ? years : null,
  };
}

function readTypes(text: string): { all: SupplierBusinessType[]; trade: TradeType | null } {
  const all = TYPE_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([type]) => type);
  const exports = all.includes('Exporter');
  const imports = all.includes('Importer');
  const trade: TradeType | null = all.length === 0 ? null : exports && imports ? 'both' : exports ? 'export' : imports ? 'import' : 'domestic';
  return { all, trade };
}

/** Reads a business description. `now` is only here so a test can fix the year. */
export function readBusiness(input: string, now: Date = new Date()): BusinessReading {
  const text = input.trim();
  if (text.length < 3) return { ...EMPTY };

  const gstin = findGstin(text);
  // the GST number is read on its own, and left out of the rest so its digits and letters are not mistaken for words
  const words = gstin ? text.replace(GSTIN_IN_TEXT, ' ') : text;

  const place = readPlace(words);
  const types = readTypes(words);
  const companyName = readCompanyName(words);
  // the firm's own name ("Sri Lakshmi Engineering Works") says what it is called, not what it makes
  const aboutProducts = companyName ? words.replace(companyName, ' ') : words;
  const reading: BusinessReading = {
    companyName,
    businessType: types.all[0] ?? null,
    businessTypes: types.all,
    tradeType: types.trade,
    categories: matchCategories(aboutProducts),
    products: readProducts(aboutProducts),
    city: place.city,
    // the state a GST number is registered in is a good guess when the text does not name one
    state: place.state ?? gstin?.state ?? null,
    ...readYears(words, now),
    gstin,
    understood: false,
  };
  reading.understood = Boolean(
    reading.companyName || reading.businessType || reading.categories.length || reading.products.length || reading.city || reading.state || reading.gstin,
  );
  return reading;
}
