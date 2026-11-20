-- Minimal copy of the production schema migrations 00064, 00065 and 00066 touch.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role' $$;
CREATE TYPE user_role AS ENUM ('buyer', 'supplier', 'admin');
CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TYPE quote_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');
CREATE TABLE profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), email text NOT NULL, full_name text, phone text, role user_role NOT NULL DEFAULT 'buyer', status account_status NOT NULL DEFAULT 'active', avatar_url text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') $$;
CREATE TABLE companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES profiles(id), company_name text NOT NULL, slug text, description text, website text, address text, pincode text, logo_url text, cover_url text, gst_doc_url text, iec_doc_url text, reg_doc_url text,
  verification_status verification_status NOT NULL DEFAULT 'unverified', verified_at timestamptz, is_featured boolean NOT NULL DEFAULT false, is_verified boolean DEFAULT false,
  wallet_balance numeric NOT NULL DEFAULT 0, withdrawable_balance numeric NOT NULL DEFAULT 0, total_revenue numeric NOT NULL DEFAULT 0, commission_balance numeric(14,2) NOT NULL DEFAULT 0,
  bank_account_name text, bank_account_number text, bank_ifsc text, bank_name text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE TABLE products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid REFERENCES companies(id), name text, is_active boolean DEFAULT true, is_featured boolean NOT NULL DEFAULT false);
CREATE TABLE subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid REFERENCES companies(id), tier text, status text, used_rfq_leads int DEFAULT 0, max_rfq_leads int DEFAULT 5, updated_at timestamptz DEFAULT now());
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE TABLE subscription_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid, user_id uuid, plan_tier text NOT NULL CHECK (plan_tier IN ('starter','business','growth','enterprise')), plan_label text, price_inr numeric, billing_cycle text, status text, razorpay_order_id text);
CREATE TABLE auctions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), seller_id uuid, title text, status text DEFAULT 'live', updated_at timestamptz DEFAULT now());
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
CREATE TABLE requirements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), buyer_id uuid REFERENCES profiles(id), title text, quantity integer NOT NULL, status text DEFAULT 'active');
CREATE TABLE quotations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requirement_id uuid, supplier_company_id uuid NOT NULL, supplier_id uuid NOT NULL, buyer_id uuid NOT NULL, unit_price numeric(12,2) NOT NULL, currency text NOT NULL DEFAULT 'INR', status quote_status NOT NULL DEFAULT 'pending', total_price numeric, quantity integer);
CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number text NOT NULL DEFAULT ('ORD-' || floor(random() * 100000)::text), quotation_id uuid NOT NULL REFERENCES quotations(id), requirement_id uuid, buyer_id uuid NOT NULL, supplier_id uuid, supplier_company_id uuid NOT NULL, total_amount numeric(14,2) NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'INR', quantity numeric(12,2) NOT NULL DEFAULT 1, quantity_unit text, milestone text NOT NULL DEFAULT 'quote_accepted', notes text, cancelled_reason text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  order_status text NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending','confirmed','processing','shipped','delivered','cancelled')),
  commission_pct numeric(5,2) NOT NULL DEFAULT 2.00, commission_amount numeric(14,2), commission_status text DEFAULT 'pending' CHECK (commission_status IN ('pending','collected','waived')),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','escrow','released','refunded')));
CREATE TABLE order_status_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id), from_status text, to_status text NOT NULL, changed_by uuid NOT NULL, changer_role text NOT NULL CHECK (changer_role IN ('buyer','supplier','admin')), notes text, created_at timestamptz DEFAULT now());
CREATE TABLE withdrawal_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), amount numeric(12,2) NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')), notes text, processed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can manage own withdrawal requests" ON withdrawal_requests FOR ALL USING (company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid()));
CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(id), title text NOT NULL, message text NOT NULL, type text NOT NULL DEFAULT 'info', is_read boolean DEFAULT false, link text, created_at timestamptz DEFAULT now(), reference_id uuid, reference_type text);
