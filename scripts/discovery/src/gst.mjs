/**
 * GSTIN helpers and the GST check.
 *
 * Verification uses an authorised source only: a GST Suvidha Provider (GSP) endpoint set in GST_VERIFY_URL. GSPs
 * pass through GSTN's "Search Taxpayer" answer (gstin, lgnm, tradeNam, sts, rgdt, cxdt, pradr.addr.stcd/pncd);
 * camelCase equivalents are read too. Without a configured provider nothing is verified: the supplier stays in the
 * review queue, where an admin can check the official GST portal by hand.
 */

const A36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const GSTIN_SHAPE = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const GST_STATES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland',
  '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh',
};

export function gstinCheckChar(first14) {
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const p = A36.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(p / 36) + (p % 36);
  }
  return A36[(36 - (total % 36)) % 36];
}

export function isValidGstin(raw) {
  const g = String(raw || '').toUpperCase();
  return GSTIN_SHAPE.test(g) && gstinCheckChar(g.slice(0, 14)) === g[14];
}

export const stateOfGstin = (g) => GST_STATES[String(g).slice(0, 2)] ?? null;

/** every valid GSTIN in a text, with the words around it, in the order found */
export function findGstins(text) {
  const out = [];
  const seen = new Set();
  const upper = String(text || '').toUpperCase();
  for (const m of upper.matchAll(/(?<![0-9A-Z])([0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])(?![0-9A-Z])/g)) {
    const g = m[1];
    if (seen.has(g) || !isValidGstin(g)) continue;
    seen.add(g);
    const from = Math.max(0, m.index - 60);
    out.push({ gstin: g, context: String(text).slice(from, m.index + 15 + 40).replace(/\s+/g, ' ').trim(), labelled: /GST/i.test(upper.slice(from, m.index)) });
  }
  return out;
}

/** "17/05/2018" or "2018-05-17" -> "2018-05-17" */
export function isoDate(value) {
  const s = String(value || '').trim();
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function findTaxpayer(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 5) return null;
  if (!Array.isArray(node)) {
    const keys = Object.keys(node);
    const hasId = keys.some((k) => /^gstin$/i.test(k));
    const hasStatus = keys.some((k) => /^(sts|status|gstinstatus|taxpayerstatus|gstin_status)$/i.test(k));
    if (hasId && hasStatus) return node;
  }
  for (const value of Array.isArray(node) ? node : Object.values(node)) {
    const found = findTaxpayer(value, depth + 1);
    if (found) return found;
  }
  return null;
}

const pick = (obj, ...names) => {
  for (const n of names) {
    const key = Object.keys(obj || {}).find((k) => k.toLowerCase() === n.toLowerCase());
    if (key && obj[key] !== null && obj[key] !== undefined && String(obj[key]).trim() !== '') return String(obj[key]).trim();
  }
  return null;
};

/** a provider answer -> the fields the database stores. Exported for tests. */
export function readTaxpayer(body, gstin) {
  const tp = findTaxpayer(body);
  if (!tp) return null;
  if ((pick(tp, 'gstin') || '').toUpperCase() !== gstin) return null;
  const addr = tp.pradr?.addr ?? tp.principalAddress?.address ?? tp.principalPlaceOfBusiness ?? {};
  const stateCode = pick(addr, 'stcd', 'stateCode', 'state');
  return {
    gst_status: pick(tp, 'sts', 'status', 'gstinStatus', 'taxpayerStatus', 'gstin_status'),
    legal_name: pick(tp, 'lgnm', 'legalName', 'legal_name', 'legalNameOfBusiness'),
    trade_name: pick(tp, 'tradeNam', 'tradeName', 'trade_name'),
    registered_state: stateCode && /^\d{2}$/.test(stateCode) ? GST_STATES[stateCode] ?? null : stateCode,
    registered_pincode: pick(addr, 'pncd', 'pincode', 'pinCode'),
    registered_on: isoDate(pick(tp, 'rgdt', 'registrationDate', 'dateOfRegistration')),
    cancelled_on: isoDate(pick(tp, 'cxdt', 'cancellationDate', 'dateOfCancellation')),
    constitution: pick(tp, 'ctb', 'constitutionOfBusiness'),
    taxpayer_type: pick(tp, 'dty', 'taxpayerType'),
  };
}

/** Look a GSTIN up with the configured provider: { result: found | not_found | error | not_configured, ... } */
export async function verifyGstin(gstin, cfg, { fetchImpl = fetch } = {}) {
  const g = String(gstin || '').toUpperCase();
  if (!cfg?.url || !cfg.url.includes('{gstin}')) return { gstin: g, result: 'not_configured' };
  const headers = { Accept: 'application/json', ...cfg.extraHeaders };
  if (cfg.apiKey) headers[cfg.authHeader || 'Authorization'] = cfg.apiKey;
  const checkedAt = new Date().toISOString();
  let res;
  let body;
  try {
    res = await fetchImpl(cfg.url.replaceAll('{gstin}', encodeURIComponent(g)), { headers, signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    try { body = JSON.parse(text); } catch { body = null; }
  } catch (e) {
    return { gstin: g, result: 'error', provider: cfg.provider, evidence: { error: String(e?.message || e).slice(0, 200), checked_at: checkedAt } };
  }
  const evidenceBase = { provider: cfg.provider, http_status: res.status, checked_at: checkedAt };
  const tp = body ? readTaxpayer(body, g) : null;
  if (tp) return { gstin: g, result: 'found', provider: cfg.provider, ...tp, evidence: { ...evidenceBase, ...tp } };
  const message = JSON.stringify(body ?? '').slice(0, 400);
  // GSTN answers an unknown number with SWEB_9035 / "Invalid GSTIN"; providers map it to 404 or a similar message
  if (res.status === 404 || /SWEB_9035|invalid gstin|no record|not found|does not exist/i.test(message)) {
    return { gstin: g, result: 'not_found', provider: cfg.provider, evidence: { ...evidenceBase, message: message.slice(0, 200) } };
  }
  return { gstin: g, result: 'error', provider: cfg.provider, evidence: { ...evidenceBase, error: res.ok ? 'Unrecognised answer' : `HTTP ${res.status}`, message: message.slice(0, 200) } };
}
