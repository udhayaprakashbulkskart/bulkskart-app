-- Proposed only. Do not apply automatically.
-- subscription_orders.plan_tier currently allows starter, business, growth, and enterprise.
-- AI add-ons, the 24-hour spotlight, and auction participation fees need their own SKUs
-- so a paid order cannot be fulfilled as a different plan.
-- Starter, Business, and Growth checkout work without this migration.

ALTER TABLE public.subscription_orders
  DROP CONSTRAINT IF EXISTS subscription_orders_plan_tier_check;

ALTER TABLE public.subscription_orders
  ADD CONSTRAINT subscription_orders_plan_tier_check
  CHECK (plan_tier = ANY (ARRAY[
    'starter'::text,
    'business'::text,
    'growth'::text,
    'enterprise'::text,
    'ai_accessibility'::text,
    'flash_sell_24h'::text,
    'auction_fee'::text
  ]));
