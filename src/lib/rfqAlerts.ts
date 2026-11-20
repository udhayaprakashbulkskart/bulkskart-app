/**
 * The "New RFQ Posted!" popup at the top of the site: the visitor's on/off choice and the text it shows.
 */
import type { Requirement } from '@/types/types';
import { formatMoney } from '@/lib/productPrice';
import { isOutsideListing } from '@/lib/rfqSources';
import { isSeededRequirement } from '@/lib/seedData';

const OFF_KEY = 'bs-rfq-alerts-off';
export const RFQ_ALERTS_EVENT = 'bs-rfq-alerts-change';

/** True when the visitor turned the RFQ popups off. */
export function rfqAlertsOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === '1';
  } catch {
    return false;
  }
}

/** Turns the RFQ popups off or back on, for this browser. */
export function setRfqAlertsOff(off: boolean) {
  try {
    if (off) localStorage.setItem(OFF_KEY, '1');
    else localStorage.removeItem(OFF_KEY);
  } catch {
    // storage can be blocked; the choice then lasts until the page is reloaded
  }
  window.dispatchEvent(new CustomEvent(RFQ_ALERTS_EVENT, { detail: { off } }));
}

const SINGULAR: Record<string, string> = {
  pieces: 'Piece', pcs: 'Pc', units: 'Unit', sets: 'Set', boxes: 'Box', cartons: 'Carton', bags: 'Bag', rolls: 'Roll',
  pairs: 'Pair', bottles: 'Bottle', drums: 'Drum', packs: 'Pack', kits: 'Kit', meters: 'Meter', metres: 'Metre',
  tons: 'Ton', tonnes: 'Tonne', kgs: 'Kg', litres: 'Litre', liters: 'Liter', containers: 'Container', panels: 'Panel',
  sheets: 'Sheet', dozens: 'Dozen', pallets: 'Pallet',
};

/** "Pieces" → "Piece", for "₹2,500 / Piece". */
export function singularUnit(unit?: string | null): string {
  const u = (unit ?? '').trim();
  if (!u) return 'Unit';
  return SINGULAR[u.toLowerCase()] ?? u;
}

/** "50 Pieces" */
export function rfqQuantity(req: Pick<Requirement, 'quantity' | 'quantity_unit'>): string | null {
  const qty = Number(req.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unit = req.quantity_unit?.trim();
  return `${qty.toLocaleString('en-IN')}${unit ? ` ${unit}` : ''}`;
}

/**
 * The buyer's target price per unit, as entered on the RFQ form ("Target Max Price / Unit", or the min when
 * only that was given): "₹2,500 / Piece". Null when the buyer left it open.
 */
export function rfqBudgetPerUnit(req: Pick<Requirement, 'budget_min' | 'budget_max' | 'currency' | 'quantity_unit'>): string | null {
  const amount = Number(req.budget_max) > 0 ? Number(req.budget_max) : Number(req.budget_min) > 0 ? Number(req.budget_min) : 0;
  if (!amount) return null;
  const money = formatMoney({ amount, currency: (req.currency || 'INR').toUpperCase(), approximate: false });
  return `${money} / ${singularUnit(req.quantity_unit)}`;
}

/** Posted in the last two days. */
export function isNewRfq(createdAt?: string | null, now = Date.now()): boolean {
  if (!createdAt) return false;
  const age = now - new Date(createdAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < 48 * 3600e3;
}

/** A new popup every 10 seconds. */
export const CYCLE_MS = 10_000;
/** How long each one stays before sliding away. */
export const VISIBLE_MS = 7_000;

/** Pages where the popup would get in the way. */
export const NO_RFQ_ALERT_PATHS =
  /^\/(auth|login|register|signup|forgot-password|reset-password|checkout|payment|pay|post-requirement|business-setup|onboarding)(\/|$)|\/(negotiation|settings)(\/|$)/;

export type RfqLead = Pick<
  Requirement,
  'id' | 'title' | 'description' | 'specifications' | 'quantity' | 'quantity_unit' | 'budget_min' | 'budget_max' | 'currency' | 'created_at'
>;

const isTestTitle = (title: string) => /\b(test|debug|timed|timeout)\b/i.test(title);

/** Real, open RFQs only, each title once. */
export function usableLeads(rows: RfqLead[]): RfqLead[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (!r?.id || !r.title?.trim() || isTestTitle(r.title)) return false;
    if (isOutsideListing(r) || isSeededRequirement(r)) return false;
    const key = r.title.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
