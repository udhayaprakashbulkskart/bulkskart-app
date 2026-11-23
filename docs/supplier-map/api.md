# Supplier Map API

Every call is a Postgres function, called through Supabase: `supabase.rpc(name, args)`, or over plain HTTP as
`POST /rest/v1/rpc/<name>` with the anon key and, for signed-in calls, the user's token.

The TypeScript wrappers are in `src/lib/supplierMap/api.ts`.

Errors come back as Postgres exceptions whose message is a code (for example `admin_only`).
`mapDbError()` in `src/lib/supplierMap/registration.ts` turns them into plain sentences.

## Public (anyone, signed in or not)

### `map_search_suppliers`

Verified manufacturers, filtered and sorted by distance. Only companies that pass every display rule are returned.

| Parameter | Type | Meaning |
| --- | --- | --- |
| `p_query` | text | Product name, category or tag. A company name or a listed key product also matches. |
| `p_lat`, `p_lng` | float | The buyer's point, used for `distance_km` and the radius. Not stored. |
| `p_radius_km` | float | Only within this distance. Needs `p_lat`/`p_lng`. |
| `p_category` | text | Category slug or name. |
| `p_max_moq` | numeric | Only products whose MOQ is at or below this (the buyer's order quantity). |
| `p_min_capacity` | numeric | Only factories with at least this monthly capacity. |
| `p_supplier_type` | text | Matches `business_type` / `trade_type`. |
| `p_require_gst`, `p_require_cin`, `p_require_udyam` | bool | Only businesses whose GSTIN / CIN-LLPIN / Udyam an admin checked. |
| `p_south`, `p_west`, `p_north`, `p_east` | float | Map viewport ("Search this area"). |
| `p_limit` | int | Page size; default 100, at most 200. |
| `p_offset` | int | Paging. |

Each row returns:
- `company_id`, `company_name`, `slug`, `business_type`;
- the factory's `city`, `state`, `latitude`, `longitude`, and `distance_km`;
- `rating`, `review_count`, `logo_url`, `cover_url`;
- `gst_verified`, `cin_verified`, `udyam_verified`, `verified_since`;
- `matched_products` (up to 6: id, name, slug, moq, moq_unit, price_min, price_max, currency, image, category),
  `product_count`, `min_moq`, `moq_unit`;
- availability: `monthly_capacity`, `capacity_unit`, `lead_time_days`, `stock_status`, `supply_type`,
  `availability_updated_at`;
- `total_count`, the number of matches across all pages.

Sorting is nearest first, then rating, then name.

### `map_supplier_detail(p_company_id uuid, p_lat float = null, p_lng float = null) → jsonb`

One supplier's card: description, photos (`cover_url`, `banner_url`, `gallery_images`), factory address, availability,
the registration checks, `entity_type`, and up to 12 active products. It returns `null` when the company does not pass
the display rules. No contact details are returned.

### Realtime: `supplier_map_changes`

Subscribe to `INSERT` on `public.supplier_map_changes` to learn when something on the map changed. Each row is
`company_id`, `kind` (the table that changed) and `changed_at`. Rows older than 2 days are pruned.

## Manufacturer (signed in; acts on the caller's own company)

| Function | Does | Errors |
| --- | --- | --- |
| `supplier_submit_business_verification(p jsonb) → 'pending'` | Creates or replaces the application (see the keys below). Any change sets it back to `pending`. | `company_required`, `invalid_entity_type`, `missing_details`, `cin_required`, `llpin_required`, `invalid_gstin`, `invalid_udyam`, `gst_or_udyam_required`, `documents_required`, `invalid_document_path`, `suspended_contact_support` |
| `supplier_save_factory_location(p_lat, p_lng, p_address, p_city, p_state, p_country, p_pincode) → status` | Saves the factory pin. A new position or address goes back to `pending`. | `invalid_location`, `address_required` |
| `supplier_update_availability(p_monthly_capacity, p_capacity_unit, p_lead_time_days, p_stock_status, p_supply_type)` | Updates availability and stamps `availability_updated_at`. No review is needed. | `location_first` |
| `supplier_map_status() → jsonb` | What is missing before the company shows: `business`, `location`, `active_products`, `account_active`, `blocked`, `on_map`. | |

Keys of `p` for `supplier_submit_business_verification`:
- `entity_type`: one of `private_limited`, `public_limited`, `llp`, `partnership`, `proprietorship`, `other`;
- `legal_name`, `cin_llpin`, `gstin`, `udyam_number`;
- `registered_address`, `factory_address`;
- `contact_name`, `contact_phone`, `contact_email`;
- `documents`: `[{ kind, path, name }]`, with each `path` inside `<auth.uid()>/` of the `verification-docs` bucket.

Allowed values:
- `stock_status`: `in_stock`, `limited`, `made_to_order`, `out_of_stock`.
- `supply_type`: `bulk`, `contract`, `bulk_contract`, `export`.

## Admin (role `admin`; anyone else gets `admin_only`)

### `admin_list_business_verifications(p_status text = 'pending')`

`p_status` takes:
- `pending`, `needs_info`, `approved`, `rejected`, `suspended`, `all`;
- `locations`: factory pins waiting for review;
- `recheck_due`: approvals due within 30 days.

Each row returns the application, plus `company_name`, `owner_email`, `location` (jsonb), `active_products` and
`on_map`. At most 200 rows.

### `admin_decide_business_verification(p_company, p_decision, p_note, p_gst_verified, p_cin_verified, p_udyam_verified) → status`

`p_decision` takes:

| Decision | Effect |
| --- | --- |
| `approve` | Approves the business. |
| `needs_info` | Asks the business for more. |
| `reject` | Rejects it. |
| `suspend` | Takes it off the map at once. |
| `recheck` | Sends it back to pending. |

How the decision works:
- The three flags record which numbers the admin checked on the official portals.
- Approving syncs `companies.verification_status`, `is_verified`, `verified_at`, `verified_by` and
  `verification_expiry_at`, and sets `recheck_due_at` to one year ahead.
- A `reject` or `suspend` sets the company to `rejected` with the reason.

Errors:
- `note_required`: rejecting, asking for information and suspending all need a note.
- `cin_not_verified`: a company or LLP was approved without its CIN/LLPIN checked.
- `registration_not_verified`: another business was approved without a checked GSTIN or Udyam number.

### `admin_decide_factory_location(p_company, p_decision, p_note) → status`

`p_decision` is `verify` or `reject`; `reject` needs a note.

### `admin_verification_history(p_company uuid = null)`

The audit log, newest first, at most 200 rows. Each row has `created_at`, `company_name`, `actor_email`, `subject`
(`business` or `location`), `action`, `from_status`, `to_status` and `note`.

## Documents

Files are stored in the private bucket `verification-docs` at `<user id>/map/<kind>-<time>-<hex name>.<ext>`.
Open them with `supabase.storage.from('verification-docs').createSignedUrl(path, 300)`. The bucket's own policies
allow this for the owner and for admins.
