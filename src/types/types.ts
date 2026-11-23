export type UserRole = 'buyer' | 'supplier' | 'admin';
export type AccountStatus = 'pending' | 'active' | 'suspended' | 'rejected';
export type SubscriptionTier = 'starter' | 'business' | 'growth' | 'enterprise';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'trial';
export type RfqStatus = 'active' | 'closed' | 'expired' | 'draft';
export type QuoteStatus = 'pending' | 'accepted' | 'rejected' | 'revised';
export type OrderStatus = 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

// 5-stage pipeline (new)
export type PipelineStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: PipelineStatus | null;
  to_status: PipelineStatus;
  changed_by: string;
  changer_role: 'buyer' | 'supplier' | 'admin';
  notes: string | null;
  created_at: string;
  // join
  changer?: { full_name: string | null; avatar_url: string | null } | null;
}
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  status: AccountStatus;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  /** Admins who decide who else is an admin (migration 00070) */
  is_super_admin?: boolean;
}

export interface Company {
  id: string;
  owner_id: string;
  company_name: string;
  slug: string;
  description: string | null;
  tagline: string | null;
  gst_number: string | null;
  iec_number: string | null;
  business_type: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  logo_url: string | null;
  banner_url: string | null;
  cover_url: string | null;
  verification_status: VerificationStatus;
  // new verified flag (is_verified synced with verification_status)
  is_verified: boolean;
  verified_at: string | null;
  verification_notes: string | null;
  is_featured: boolean;
  total_products: number;
  total_quotes_sent: number;
  export_destinations: string[] | null;
  years_in_business: number | null;
  year_established: number | null;
  employee_count: string | null;
  employee_count_range: string | null;
  annual_turnover: string | null;
  annual_turnover_range: string | null;
  gst_doc_url: string | null;
  iec_doc_url: string | null;
  reg_doc_url: string | null;
  key_products: string[] | null;
  payment_terms: string[] | null;
  production_capacity: string | null;
  moq_policy: string | null;
  packaging_details: string | null;
  rating_avg: number;
  review_count: number;
  profile_completion: number;
  response_rate: number | null;
  avg_response_hours: number | null;
  wallet_balance: number | null;
  withdrawable_balance: number | null;
  total_revenue: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyCertification {
  id: string;
  company_id: string;
  cert_type: 'gst' | 'iec' | 'company_reg' | 'iso' | 'other';
  cert_name: string;
  cert_number: string | null;
  cert_file_url: string | null;
  is_verified: boolean;
  verified_at: string | null;
  pending_review: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyReview {
  id: string;
  company_id: string;
  reviewer_id: string;
  rating: number;
  review_text: string | null;
  order_id: string | null;
  created_at: string;
  reviewer?: Profile;
}

export interface BuyerProfile {
  id: string;
  user_id: string;
  public_slug?: string | null;
  company_name: string;
  business_type: string | null;
  gst_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  icon: string | null;
  image_url: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  product_count: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  company_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  price_inr: number | null;
  billing_cycle: string;
  starts_at: string;
  ends_at: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  max_products: number;
  max_rfq_leads: number;
  used_rfq_leads: number;
  has_ai_access?: boolean;
  flash_sell_until?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  company_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  specifications: string | null;
  moq: number;
  moq_unit: string;
  price_min: number | null;
  price_max: number | null;
  price_currency: string;
  images: string[] | null;
  video_url: string | null;
  brochure_url: string | null;
  tags: string[] | null;
  export_destinations: string[] | null;
  is_active: boolean;
  is_featured: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  // joins
  companies?: Company;
  categories?: Category;
}

export interface Requirement {
  id: string;
  req_number?: string | null;
  images?: string[] | null;
  buyer_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  specifications: string | null;
  quantity: number;
  quantity_unit: string;
  destination_country: string | null;
  destination_city: string | null;
  deadline: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  attachment_url: string | null;
  status: RfqStatus;
  quote_count: number;
  view_count: number;
  is_verified_buyer: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  /** 'public_listing' = a Public Requirement collected from a public page elsewhere (its source is admin-only); BulkSkart buyer RFQs are 'bulkskart' */
  source_type?: 'bulkskart' | 'public_listing' | null;
  /** public requirements only: admin review state */
  review_status?: 'pending' | 'approved' | 'rejected' | null;
  /** public requirements only: product category as listed (e.g. "Bearings") */
  listing_category?: string | null;
  // joins
  profiles?: Profile;
  categories?: Category;
}

export interface Quotation {
  id: string;
  requirement_id: string;
  supplier_company_id: string;
  supplier_id: string;
  buyer_id: string;
  unit_price: number;
  currency: string;
  moq: number;
  moq_unit: string;
  delivery_days: number | null;
  production_days: number | null;
  payment_terms: string | null;
  delivery_terms: string | null;
  validity_days: number;
  total_price: number | null;
  notes: string | null;
  status: QuoteStatus;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
  // joins
  companies?: Company;
  requirements?: Requirement;
}

export interface Order {
  id: string;
  order_number: string;
  quotation_id: string;
  requirement_id: string | null;
  buyer_id: string;
  supplier_id: string | null;
  supplier_company_id: string;
  total_amount: number;
  currency: string;
  quantity: number;
  quantity_unit: string | null;
  milestone: string;
  notes: string | null;
  cancelled_reason: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

// OrderRow — enriched with joins for list/tracking views
export interface OrderRow {
  id: string;
  order_number: string;
  milestone: string;
  total_amount: number;
  currency: string;
  quantity: number;
  quantity_unit: string | null;
  created_at: string;
  updated_at: string;
  quotations?: { unit_price: number; payment_terms: string | null; delivery_terms: string | null } | null;
  requirements?: { title: string; quantity_unit: string } | null;
  companies?: { company_name: string; slug: string; logo_url: string | null; verification_status: string } | null;
  buyer?: { full_name: string | null; avatar_url: string | null } | null;
  // payment and wallet (migrations 00065 and 00066)
  order_status?: string | null;
  payment_status?: 'pending' | 'paid' | 'escrow' | 'released' | 'refunded' | null;
  payment_method?: 'online' | 'at_factory' | null;
  paid_amount?: number | null;
  paid_at?: string | null;
  payout_amount?: number | null;
  commission_amount?: number | null;
  commission_pct?: number | null;
  released_at?: string | null;
  refunded_at?: string | null;
}

export interface Conversation {
  id: string;
  requirement_id: string | null;
  quotation_id: string | null;
  product_id: string | null;
  buyer_id: string;
  supplier_company_id: string;
  supplier_id: string;
  last_message: string | null;
  last_message_at: string | null;
  buyer_unread: number;
  supplier_unread: number;
  buyer_blocked: boolean;
  supplier_blocked: boolean;
  created_at: string;
  // joins
  companies?: Company;
  buyer?: Profile;
  supplier?: Profile;
  product?: Pick<Product, 'id' | 'name' | 'slug' | 'price_min' | 'price_max' | 'price_currency' | 'moq' | 'moq_unit'> | null;
}

export interface BuyerSubscription {
  id: string;
  user_id: string;
  tier: 'basic' | 'premium' | 'enterprise';
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  attachment_url: string | null;
  is_read: boolean;
  created_at: string;
  sender?: Profile;
}


export interface InquiryReply {
  id: string;
  sender: 'buyer' | 'supplier';
  sender_name: string;
  content: string;
  created_at: string;
}

export interface SupplierInquiry {
  id: string;
  conversation_id: string;
  supplier_company_id: string;
  supplier_name: string;
  sender_name: string;
  sender_email: string;
  sender_phone?: string;
  sender_company?: string;
  subject: string;
  message: string;
  product_id?: string | null;
  product_name?: string | null;
  product_slug?: string | null;
  target_quantity?: number;
  quantity_unit?: string;
  created_at: string;
  status: 'new' | 'replied' | 'in_progress';
  replies: InquiryReply[];
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_company_id: string | null;
  reported_product_id: string | null;
  reason: string;
  description: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}
