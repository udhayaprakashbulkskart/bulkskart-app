/** Shapes returned by the supplier map database functions (migration 00071). */

export type EntityType = 'private_limited' | 'public_limited' | 'llp' | 'partnership' | 'proprietorship' | 'other' | 'foreign_company';
export type BusinessStatus = 'pending' | 'needs_info' | 'approved' | 'rejected' | 'suspended';
export type LocationStatus = 'pending' | 'verified' | 'rejected';
export type StockStatus = 'in_stock' | 'limited' | 'made_to_order' | 'out_of_stock';
export type SupplyType = 'bulk' | 'contract' | 'bulk_contract' | 'export';
export type LocationPrecision = 'exact' | 'pinned' | 'city';

export interface MapProduct {
  id: string;
  name: string;
  slug: string | null;
  moq: number | null;
  moq_unit: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  image: string | null;
  category?: string | null;
}

/** One row of map_search_suppliers. */
export interface MapSupplier {
  company_id: string;
  company_name: string;
  slug: string;
  business_type: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  /** exact = factory pin checked by BulkSkart; pinned = set by the manufacturer; city = centre of the profile's city */
  location_precision: LocationPrecision;
  distance_km: number | null;
  rating: number | null;
  review_count: number | null;
  logo_url: string | null;
  cover_url: string | null;
  gst_verified: boolean;
  cin_verified: boolean;
  udyam_verified: boolean;
  /** a business registered outside India whose registration an admin checked in that country's registry */
  registry_verified: boolean;
  /** verified by BulkSkart (green check); every company on the map has an active paid plan */
  verified: boolean;
  verified_since: string | null;
  matched_products: MapProduct[];
  product_count: number;
  min_moq: number | null;
  moq_unit: string | null;
  monthly_capacity: number | null;
  capacity_unit: string | null;
  lead_time_days: number | null;
  stock_status: StockStatus | null;
  supply_type: SupplyType | null;
  availability_updated_at: string | null;
  total_count: number;
}

/** map_supplier_detail. */
export interface MapSupplierDetail {
  company_id: string;
  company_name: string;
  slug: string;
  business_type: string | null;
  description: string | null;
  year_established: number | null;
  logo_url: string | null;
  cover_url: string | null;
  banner_url: string | null;
  gallery_images: string[];
  rating: number | null;
  review_count: number | null;
  production_capacity_text: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  factory_address: string | null;
  latitude: number;
  longitude: number;
  distance_km: number | null;
  monthly_capacity: number | null;
  capacity_unit: string | null;
  lead_time_days: number | null;
  stock_status: StockStatus | null;
  supply_type: SupplyType | null;
  availability_updated_at: string | null;
  gst_verified: boolean;
  cin_verified: boolean;
  udyam_verified: boolean;
  registry_verified: boolean;
  registration_country: string | null;
  verified: boolean;
  location_precision: LocationPrecision;
  entity_type: EntityType | null;
  verified_since: string | null;
  products: MapProduct[];
}

export interface MapSearchParams {
  query?: string;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number | null;
  category?: string | null;
  maxMoq?: number | null;
  minCapacity?: number | null;
  requireGst?: boolean;
  requireCin?: boolean;
  requireUdyam?: boolean;
  /** factory country, e.g. "Vietnam" */
  country?: string | null;
  verifiedOnly?: boolean;
  bounds?: { south: number; west: number; north: number; east: number } | null;
  limit?: number;
  offset?: number;
}

export interface VerificationDocument {
  kind: 'gst' | 'incorporation' | 'udyam' | 'partnership_deed' | 'factory' | 'other';
  /** path inside the private verification-docs bucket, "<user id>/..." */
  path: string;
  name: string;
}

export interface BusinessApplication {
  company_id: string;
  entity_type: EntityType;
  legal_name: string;
  cin_llpin: string | null;
  gstin: string | null;
  udyam_number: string | null;
  registration_country: string | null;
  registration_number: string | null;
  registered_address: string;
  factory_address: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  documents: VerificationDocument[];
  status: BusinessStatus;
  gst_verified: boolean;
  cin_verified: boolean;
  udyam_verified: boolean;
  registry_verified: boolean;
  decision_note: string | null;
  submitted_at: string;
  decided_at: string | null;
  recheck_due_at: string | null;
}

export interface FactoryLocation {
  company_id: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  status: LocationStatus;
  review_note: string | null;
  reviewed_at: string | null;
  monthly_capacity: number | null;
  capacity_unit: string | null;
  lead_time_days: number | null;
  stock_status: StockStatus | null;
  supply_type: SupplyType | null;
  availability_updated_at: string | null;
}

/** supplier_map_status: what is still missing before the company shows on the map. */
export interface MyMapStatus {
  company_id: string | null;
  company_verification: string | null;
  blocked: boolean;
  business: BusinessApplication | null;
  location: FactoryLocation | null;
  active_products: number;
  account_active: boolean;
  on_map: boolean;
  /** from migration 00072 */
  paid?: boolean;
  verified?: boolean;
  profile_city?: string | null;
  map_point?: { latitude: number; longitude: number; location_precision: LocationPrecision; city: string | null; country: string | null } | null;
}

/** admin_list_business_verifications. */
export interface AdminApplication extends BusinessApplication {
  company_name: string;
  owner_email: string | null;
  location: FactoryLocation | null;
  active_products: number;
  on_map: boolean;
}

export interface AuditEntry {
  created_at: string;
  company_name: string | null;
  actor_email: string | null;
  subject: 'business' | 'location';
  action: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
}
