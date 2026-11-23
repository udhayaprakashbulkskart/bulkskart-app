# Live Verified Supplier Map

Buyers find verified Indian manufacturers near them on a map (`/supplier-map`). Manufacturers apply to be listed
(`/dashboard/supplier/map-listing`), and admins check and approve them (`/dashboard/admin/verifications`).

It is a separate module. It reuses the existing accounts, companies, products, auth, the private
`verification-docs` storage bucket and the Instant Quote form. It deletes no data, and existing pages keep working.

## Who appears on the map

The database decides this, in one function (`public.map_visible_company_ids()`, migration 00071). The search and
detail functions the website calls go through it, so no page can show a business that does not qualify.

A company is shown only when **all** of these hold:

| Rule | Column |
| --- | --- |
| Registration application approved by an admin | `business_verifications.status = 'approved'` |
| Approval less than a year old (yearly recheck) | `business_verifications.recheck_due_at > now()` |
| Company verified and not blocked | `companies.verification_status = 'verified'`, `NOT companies.is_blocked` |
| Owner's account is an active supplier account | `profiles.status = 'active'`, `profiles.role = 'supplier'` |
| At least one active product | `products.is_active` |
| Factory location verified by an admin | `factory_locations.status = 'verified'` |
| Not a demo/template company | owner `00000000-…-000000000001`, id prefix `e1000001-0000-0000-0000-` |

Pending, needs-info, rejected, suspended, blocked, inactive and demo companies never appear.

## Verification workflow

1. **The manufacturer submits** an entity type, legal name, CIN/LLPIN, GSTIN, Udyam number, registered and factory
   addresses, a contact, and documents. The files go to the private `verification-docs` bucket under the user's own
   folder. Documents already uploaded on the older Verification page can be attached without uploading them again.
2. **The system checks** formats (GSTIN with its check digit, CIN, LLPIN, Udyam), required fields, and that the
   documents are in the caller's own folder. A Pvt Ltd, Public Ltd or LLP must give its CIN/LLPIN.
3. **An admin checks the registration** on the official portals (MCA master data, GST taxpayer search, Udyam
   verify). The admin page links to them. The admin ticks each number they checked, reads the documents through
   private links that expire after 5 minutes, and checks the factory pin.
4. **The admin decides**: approve, ask for more information, reject, suspend, or recheck. Rejecting, asking for
   information and suspending need a note, which the business sees.
   - Nothing is approved automatically.
   - The database refuses to approve a company or LLP unless its CIN/LLPIN was ticked as checked. **A GSTIN alone never
     proves incorporation.**
   - Other businesses need a checked GSTIN or Udyam number.
5. **Every status change** is written to `verification_audit_log` by a trigger: who, when, from, to and the note.
6. **Each approval lasts one year.** The business then leaves the map until an admin rechecks it. The admin page has a
   "Recheck due" tab that lists approvals due within 30 days.

If the manufacturer changes an approved application, it goes back to *pending* and leaves the map until it is approved
again. Moving the factory pin sends the location back for review as well.

There is no automatic government lookup. The GST, MCA and Udyam APIs need registered access: GST through a GSP, MCA
through a paid service. If you get such access, a server function can set `gst_verified` / `cin_verified` /
`udyam_verified` before the admin decides. The admin still approves.

## Location

The factory location is a pin the manufacturer places once on the registered factory, and an admin checks it. No one's
live GPS is collected or stored. A buyer's "Use my current location" is used only for that one search, to measure
distance; it is not saved.

Distances use the haversine formula in plain Postgres (`public.km_between`), after a latitude/longitude box narrows the
rows. That box is backed by the index `factory_locations_verified_latlng_idx`. With PostGIS you could switch to a
`geography` column and a GiST index. That is not needed at this size.

## Smart match score

A score from 0 to 100 with its reasons, computed in the browser by `src/lib/supplierMap/matchScore.ts`. It is rule
based, not an AI model. These criteria count when they can be measured:

| Criterion | Points |
| --- | --- |
| Product fit | 30 |
| Distance | 20 |
| MOQ against the buyer's quantity | 10 |
| Monthly capacity | 10 |
| Stock status | 10 |
| How recently availability was updated | 5 |
| Registrations checked | 10 |
| Rating (only when there are reviews) | 5 |

The total is scaled to 100 over the criteria that count. Missing data scores zero and says so. Nothing is invented.

## Live updates

Triggers write a row to `supplier_map_changes` whenever any of these change:
- an approval;
- a location;
- availability;
- a product's active state, name, MOQ, price or images;
- a company's status, name or images.

The row holds the company id and the kind of change only. The page listens through Supabase Realtime, refreshes the
results and any open details, and also polls every 2 minutes in case Realtime is off. A supplier who loses
eligibility disappears without a reload.

## Security

- **Direct writes are blocked.** No one can insert, update or delete applications, locations, the audit log or the
  change signal from the website. All writes go through `SECURITY DEFINER` functions that check the caller.
- **Who can read what.** Applications, locations and the audit log can be read by their owner and by admins. Anonymous
  visitors can read none of them; they get map data only through the search and detail functions, which return no
  contact details or documents.
- **Owners can no longer mark their own company verified.** A new trigger, `guard_company_verification_fields`, closes
  that hole. Owners can only move between *unverified* and *pending*, or re-apply after a rejection. Only admins can set
  *verified* or *rejected*, the verification dates or the rejection reason.
- **Documents stay private.** They are opened only through short-lived signed links.

## Files

| Area | File |
| --- | --- |
| Database | `supabase/migrations/00071_supplier_map.sql` |
| Data and rules | `src/lib/supplierMap/` (api, types, registration checks, match score, places, tiles, docPath) |
| Map UI | `src/components/supplierMap/` (Leaflet map, pin picker, cards, CSS) |
| Buyer page | `src/pages/SupplierMapPage.tsx` (`/supplier-map`) |
| Manufacturer page | `src/pages/dashboard/supplier/SupplierMapListingPage.tsx` (`/dashboard/supplier/map-listing`, also `/dashboard/manufacturer/map-listing`) |
| Admin page | `src/pages/dashboard/admin/AdminVerificationsPage.tsx` (`/dashboard/admin/verifications`) |
| Tests | `src/__tests__/supplierMap.test.ts` |

See also [api.md](api.md), [testing-report.md](testing-report.md) and [deployment.md](deployment.md).
