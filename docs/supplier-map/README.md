# Live Verified Supplier Map

Buyers anywhere in the world find manufacturers with a paid BulkSkart plan near them, or in any country, on a map (`/supplier-map`); a green check marks the ones BulkSkart has verified.
Manufacturers in India or abroad apply to be listed (`/dashboard/supplier/map-listing`), and admins check and approve
them (`/dashboard/admin/verifications`).

## Worldwide

- **Where the buyer is.** A buyer sets their location in one of three ways:
  - search about 190 trading cities in more than 70 countries by city or country name;
  - use the device's location;
  - use "the centre of the map" for anywhere else.

  The location is used only to measure distance and is never saved. The radius chips run Nearby / 10 / 25 / 50 /
  100 km, then **Worldwide**.
- **Filters.** Results can be filtered by factory country. "Search this area" works anywhere, including across the
  180th meridian.
- **Factories abroad.** A factory can be in any country; the manufacturer chooses the country when placing the pin.
- **Registered outside India.** A business registered abroad applies as "Business registered outside India", with its
  country and company registration number instead of CIN/GSTIN/Udyam. An admin approves it only after finding it in
  that country's official company registry: the admin page links to OpenCorporates, and the database refuses approval
  without the "registration checked" tick.
- **Signup.** Manufacturer signup has a Country field. Outside India the GST field is hidden and the state is free text.

## "List your business" for new visitors

A visitor who is not signed in and searches the map gets a popup after a few seconds, or sooner when nothing matched:
"Do you make or sell products in bulk? List your business — it's free".

| Choice | What happens |
| --- | --- |
| **List your business** | Goes to `/signup/manufacturer?redirect=/dashboard/supplier/map-listing`: signup, then straight to the map listing page. |
| **I'm a buyer** | Hides the popup for 90 days. |
| **Not now**, close or Esc | Hides it for 3 days. |

It shows at most once per visit. A "List your business" button also stays on the page: in the results panel on
desktop, above the cards on phones. Signed-in manufacturers get a link to their listing page instead, and signed-in
buyers don't see it.

The site's Download App popup and "New RFQ" alert stay off the map page so they don't cover the search bar.

It is a separate module. It reuses the existing accounts, companies, products, auth, the private
`verification-docs` storage bucket and the Instant Quote form. It deletes no data, and existing pages keep working.

## Who appears on the map (migration 00072)

The database decides this in one function, `public.map_visible_company_ids()`. The search and detail functions the
website calls go through it, so no page can show a company that does not qualify.

A company is shown when **all** of these hold:

| Rule | Where it comes from |
| --- | --- |
| Active **paid** plan | a `subscriptions` row with status `active` that has not passed `ends_at` (the same rule as quotations) |
| Active manufacturer account | `profiles.status = 'active'`, `profiles.role = 'supplier'` |
| Not blocked, not rejected | `NOT companies.is_blocked`, `companies.verification_status <> 'rejected'`, and no rejected or suspended map application |
| Not a demo/template company | owner `00000000-…-000000000001`, id prefix `e1000001-0000-0000-0000-` |
| Somewhere to put it | see the placement order below |

Existing manufacturer profiles therefore show automatically. Products and the new registration application are not
required.

**Placement**, in this order:

| Order | Placement | Label |
| --- | --- | --- |
| 1 | The factory pin, once an admin has checked it | `exact` |
| 2 | The pin the manufacturer placed, not yet checked | `pinned` |
| 3 | The centre of the city in the profile, from the `map_places` table (about 270 names, including older ones like Bombay and Cochin) | `city`, shown as "(approx.)" on cards |

A profile with no city and no pin is not shown until it adds one; its map page tells the manufacturer this.

**Two levels on the map:**
- **Verified** (green check): BulkSkart verified the company (`verification_status = 'verified'`, not expired), and
  no newer map application is waiting for review.
- **Premium** (orange crown, no check): has a paid plan but is not verified yet. The card says "check its registration
  documents before you pay".

Buyers can tick **Verified by BulkSkart only** in the filters.

## Register your factory (`/register-factory`)

**The form.** One short page:
- factory/business name, your name, mobile, email and password;
- factory city and country;
- what you make (optional);
- agree to the terms.

**What happens next.** It creates the same kind of manufacturer account as the full signup (the same code saves the
account and the company). Then the plan step offers a plan, with an option to skip. Then the manufacturer lands on
the Supplier Map listing page.

**Links to it.** The empty map's only button, the "List your business" popup and the "Register your factory" buttons
on the map all point here.

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
