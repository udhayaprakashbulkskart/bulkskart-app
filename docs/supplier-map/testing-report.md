# Supplier Map: testing report (23 Nov 2026)

## Summary

| Check | Result |
| --- | --- |
| Database rules, run against a local Postgres copy (PGlite, `sql-tests/map_check.mjs`) | 118 checks, all as expected; identical on a fresh install and on an upgrade over the first version of 00071 |
| Document storage lock-down (`sql-tests/storage_check.mjs`) | 10 checks, all as expected |
| Unit tests (`src/__tests__/supplierMap.test.ts`) | 20 pass |
| Whole test suite (`npx vitest run`) | 579 pass, 0 fail |
| Type check (`tsgo`), lint (`biome`), production build | Pass |
| Browser check, desktop 1440×900 and iPhone 13, with test data fed to the page | All flows below work; no page errors; no sideways scroll on the phone |

## Database (the display rules)

The migration was run twice to prove it can be re-run, against tables shaped like production's. Ten test companies were
set up near Coimbatore, Tiruppur and Mumbai, and each was put in a different state.

| Case | Expected | Result |
| --- | --- | --- |
| Approved business, verified location, active supplier, active product | On the map | ✅ appears |
| Application pending | Hidden | ✅ hidden; detail returns nothing |
| Application rejected | Hidden | ✅ hidden |
| Application suspended | Hidden; cannot re-apply | ✅ hidden; re-apply refused (`suspended_contact_support`) |
| Company blocked | Hidden | ✅ hidden |
| Factory location not yet verified | Hidden | ✅ hidden |
| Owner account suspended | Hidden | ✅ hidden |
| No active product | Hidden | ✅ hidden; products switched off hides a listed company |
| Demo/template company, even if approved | Hidden | ✅ hidden |
| Approval older than a year (recheck overdue) | Hidden until re-approved | ✅ hidden, listed under "Recheck due", back after re-approval |
| Approved company edits its application | Back to pending, off the map | ✅ |
| Approved company moves its factory pin | Location back to pending, off the map | ✅ |
| Radius 100 km / 10 km from Coimbatore | Tiruppur (43.3 km) in, then out | ✅ |
| Search "t-shirt", key-product search, max MOQ, category, CIN-checked only, viewport, paging | Correct rows | ✅ |

**Who can change what:**

| Attempt | Result |
| --- | --- |
| Owner sets their own company to *verified* (update or insert) | ✅ ignored: stays *unverified* |
| Rejected company sets itself *verified* | ✅ ignored |
| Owner writes an approved application, or a verified location, directly into the table | ✅ permission denied |
| Owner deletes their application | ✅ permission denied |
| Buyer or owner calls the admin decision or list functions | ✅ `admin_only` |
| Anonymous visitor calls the admin or supplier functions | ✅ permission denied |
| Anonymous visitor reads applications, locations or the audit log | ✅ permission denied |
| Buyer reads other companies' applications | ✅ none visible |
| Documents in another user's folder | ✅ `invalid_document_path` |
| Private Ltd company with a GSTIN but no CIN | ✅ `cin_required` |
| Bad GSTIN | ✅ `invalid_gstin` |
| Admin approves without ticking a checked registration | ✅ `registration_not_verified` (`cin_not_verified` for companies and LLPs) |
| Reject or suspend without a note | ✅ `note_required` |
| Audit log | ✅ every submit and status change, with the actor and the note |
| Existing admin page sets a company *verified* | ✅ still works; that company is not on the map until its application is approved too |

## Paid plans and existing profiles (00072, `sql-tests/paid_check.mjs`)

Run on top of 00071 and twice in a row, with 19 test companies.

**On the map:**

| Company | Placement | Mark |
| --- | --- | --- |
| Paid, unverified, Coimbatore | city | Premium |
| Paid and verified, "mumbai" | city | Verified |
| "Nehru place, Delhi" | Delhi | |
| City and state swapped ("Maharashtra" / "Mumbai") | Mumbai | |
| "Navi Mumbai" | Navi Mumbai, not Mumbai | |
| Old name "Cochin" | Kochi's centre | |
| Own pin, not yet checked | pinned | |
| Checked pin | exact; the street address is shown | |
| Dubai | city | |

**Hidden:**
- no paid plan, an expired plan, or a trial only;
- no city and no pin;
- blocked company, suspended owner, or a company an admin rejected;
- a suspended map application;
- demo companies.

**Other checks:**
- A verified company with a new application waiting shows as Premium.
- "Verified only" returns only the verified company.
- 60 km of Coimbatore returns the right two.
- A text search finds companies with no products, by their description.
- When a plan ends, the company leaves the map and a live-update signal is sent.
- Visitors can't call the paid-plan check directly.

**Browser (sample data):**
- 3 profiles sharing Coimbatore's centre are fanned out so each can be tapped.
- Only the 2 verified pins have the green check.
- Cards show Verified or Premium, "(approx.)" for city-level places, and "No products listed yet".

**Live site, empty map:**
- The card shows a single "Register your factory" button, which opens `/register-factory`.
- An empty submit there shows 7 messages and puts the cursor in the first field.
- Not tested: creating a real account, because that would write to the live database.

## Worldwide (added after the first version)

| Case | Result |
| --- | --- |
| Business registered outside India with country "India" | ✅ refused (`registration_country_required`) |
| Bad registration number | ✅ refused (`registration_number_required`) |
| Registered abroad, no GSTIN | ✅ accepted, pending |
| Admin approves it without the registry tick, or with only a GST tick | ✅ refused (`registry_not_verified`) |
| Admin approves it after the registry check | ✅ approved; on the map once the pin is verified |
| Search with no filters | ✅ India, UAE and Fiji factories together |
| Country filter "united arab emirates" (any case) | ✅ only the UAE factory |
| 50 km of Dubai | ✅ the Jebel Ali factory, 27.1 km |
| 300 km around a point at -179.9° longitude | ✅ the Suva (Fiji, +178.4°) factory, 176 km away |
| Viewport from 170° to -170° | ✅ the Suva factory |
| Card details | ✅ "registration checked in the official company registry of United Arab Emirates" |

**Browser, signed-out visitor:**
- No popup before searching.
- After a search, the popup appears with focus on "List your business"; Esc closes it.
- On phones it appears as a bottom sheet, and the Download App popup stays away.
- After "I'm a buyer" and a reload, it does not come back.
- On an empty result it appears too. "List your business" opens `/signup/manufacturer?redirect=%2Fdashboard%2Fsupplier%2Fmap-listing`.
- In signup, choosing United Arab Emirates hides the GST field and makes the state a text field.
- Location search "dub" → Dubai; 50 km → the Dubai factory, with the address bar `?city=Dubai, United Arab Emirates&r=50`.
- No page errors.

## Document storage

The test set up the bucket rules as migrations 00011 and 00033 left them.

| Case | Before | After 00071 |
| --- | --- | --- |
| Anonymous visitor lists files | Saw every verification and business document | Sees none (product images still public) |
| Anonymous upload | Allowed | Refused |
| Owner reads files | Own folder | Own folder |
| Owner uploads to another user's folder | — | Refused |
| Admin reads files | All | All |
| Buckets public | `verification-docs` and `business-docs` public | Both private |

Live check (read-only, with the public key) on 23 Nov 2026:
- an anonymous listing of both buckets returned 0 files;
- no company has a saved document link yet.

So no documents were exposed, and 00071 closes the gap before the first upload.

## Browser (`/supplier-map`, test data, map tiles stubbed)

- Desktop:
  - 3 orange factory markers with green checks;
  - picking Coimbatore and 50 km leaves 2; searching "t-shirt" keeps them and updates the address (`?q=t-shirt&city=Coimbatore&r=50`);
  - clicking a marker opens the details: photos fallback, verified business box, "Why 100% match" breakdown, products,
    Request Quotation, Factory profile and Directions;
  - the List view works;
  - "Search this area" appears only after the person drags the map, and sends the viewport.
- An unmatched search shows the honest empty state (clear filters, post a requirement, manufacturer link).
- Phone:
  - full-screen map with back, search, filters and list buttons;
  - radius chips and swipeable cards; swiping selects the matching marker;
  - tapping a card opens the details sheet; the filters panel and list view work;
  - no horizontal overflow.
- The light theme renders.
- Console: no page errors.

## Not tested here

- **Realtime.** The page listens to `supplier_map_changes` and also polls every 2 minutes, but live push depends on the
  self-hosted Realtime service. Test it after running the migration: approve a test company and watch the map.
- **Sign-in flows.** The manufacturer and admin pages were type-checked and built, and the database functions they call
  are tested above. They were not clicked through in a browser while signed in, because that needs real accounts.
- **Map tiles (fixed 23 Nov 2026).** The first version used CARTO tiles, which this sandbox could not reach, so they were stubbed in testing. On the live site they showed "API KEY REQUIRED". The map now uses OpenStreetMap tiles. They were checked here with real tiles, in dark and light themes and on desktop and phone: 20 tiles loaded, 0 failed, no CARTO requests.
- **Production data.** Today no company meets every rule, so the live map is empty until the first approvals.
