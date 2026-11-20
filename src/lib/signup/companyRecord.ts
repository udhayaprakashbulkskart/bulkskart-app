import { decodeGstin } from './gstin';
import type { SupplierBusinessType, TradeType } from './vocab';

/** Everything the fast sign-up collects. */
export interface SignupDraft {
  companyName: string;
  businessType: SupplierBusinessType;
  categories: string[];
  products: string[];
  city: string;
  state: string;
  country: string;
  /** the GST number as typed; empty when there is none */
  gstin: string;
  /** the person's own words about the business */
  description: string;
  tradeType: TradeType;
  yearEstablished: number | null;
  yearsInBusiness: number | null;
  fullName: string;
  /** "+919876543210" */
  phone: string;
}

/** A web address part for the company page: the name, then a short unique tail. */
export function makeCompanySlug(name: string, now: number = Date.now()): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'company';
  return `${base.slice(0, 60)}-${now.toString(36)}`;
}

/**
 * How complete the profile is, on the same scale the Business Setup Wizard uses, so the figure on the dashboard
 * carries on from here when the rest of the profile is filled in.
 */
export function signupCompletionScore(draft: SignupDraft): number {
  let score = 20; // the account type is chosen
  if (draft.fullName && draft.phone && draft.city && draft.state) score += 20;
  if (draft.companyName && draft.description && draft.gstin) score += 25;
  if (draft.categories.length > 0 && draft.products.length > 0) score += 20;
  return Math.min(100, score);
}

/** The company row for a new manufacturer. Only columns that exist on `companies`. */
export function buildCompanyRow(draft: SignupDraft, ownerId: string, now: number = Date.now()): Record<string, unknown> {
  const gst = draft.gstin ? decodeGstin(draft.gstin) : null;
  return {
    owner_id: ownerId,
    company_name: draft.companyName.trim(),
    slug: makeCompanySlug(draft.companyName, now),
    business_type: draft.businessType,
    gst_number: gst ? gst.gstin : draft.gstin.trim().toUpperCase() || null,
    // characters 3 to 12 of a GSTIN are the holder's PAN
    pan_number: gst ? gst.pan : null,
    city: draft.city.trim() || null,
    state: draft.state.trim() || null,
    country: draft.country || 'India',
    description: draft.description.trim().slice(0, 1000) || null,
    product_categories: draft.categories,
    key_products: draft.products,
    trade_type: draft.tradeType,
    year_established: draft.yearEstablished,
    years_in_business: draft.yearsInBusiness,
    // nothing has been checked yet: verification starts when documents are uploaded
    verification_status: 'unverified',
    // the setup wizard picks up at "Personal details" with what is already here filled in
    onboarding_step: 2,
    onboarding_completed: false,
    profile_completion: signupCompletionScore(draft),
  };
}

/** What goes on the person's own profile (the same columns the setup wizard saves). */
export function buildProfileUpdate(draft: SignupDraft): Record<string, unknown> {
  return {
    full_name: draft.fullName.trim(),
    phone: draft.phone,
    country: draft.country || 'India',
    state: draft.state.trim() || null,
    city: draft.city.trim() || null,
    updated_at: new Date().toISOString(),
  };
}
