# Supplier Map: deployment

## 1. Database (Supabase SQL editor)

1. Make sure migrations 00069 and 00070 have been run.
2. Open `supabase/migrations/00071_supplier_map.sql`, paste the whole file into the SQL editor and run it. It is one
   transaction, it only adds things, and it is safe to run again.
3. Check it worked:

   ```sql
   SELECT count(*) FROM public.map_search_suppliers();          -- 0 until the first approval
   SELECT id, public FROM storage.buckets WHERE id IN ('verification-docs', 'business-docs');   -- both false
   SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE 'doc_buckets%';   -- 2 rows
   SELECT pubname FROM pg_publication_tables WHERE tablename = 'supplier_map_changes';   -- supabase_realtime
   ```

   If the last query returns nothing, live updates fall back to refreshing every 2 minutes. To switch Realtime on:
   `ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_map_changes;`

What the migration changes for existing users:
- **Owners can no longer set their own company to *verified*.** This was a security hole. Admins still can, from the
  existing admin page or the new Verifications page.
- **Document links open through signed links.** The two document buckets become private, so the "public" links that
  older pages saved stop opening directly. The old and new admin pages now open documents through signed links that
  expire after 5 minutes. No document links are saved in production yet.

## 2. Website

Merge the `supplier-map` branch into `master`. The push deploys it as usual: GitHub Actions builds and uploads it. There
are no new required environment variables.

Map tiles are optional settings, not secrets:

| Variable | Default |
| --- | --- |
| `VITE_MAP_TILE_URL_DARK`, `VITE_MAP_TILE_URL_LIGHT` | CARTO dark/light basemaps |
| `VITE_MAP_TILE_ATTRIBUTION` | OpenStreetMap + CARTO |
| `VITE_MAP_SATELLITE_URL`, `VITE_MAP_SATELLITE_ATTRIBUTION` | No satellite layer |

CARTO's free basemaps are meant for limited, non-commercial use. For a busy commercial site, take a plan with a tile
provider (MapTiler, Stadia Maps, CARTO Enterprise), put its tile URL in the variables above, and keep the attribution.

New pages:
- `/supplier-map`: public. It is in the header menu and the sitemap.
- `/dashboard/supplier/map-listing`: manufacturers, also under `/dashboard/manufacturer/…`. In the menu as
  "Supplier Map". Open to manufacturers without a paid plan, like Verification.
- `/dashboard/admin/verifications`: admins. In the menu as "Verifications".

## 3. First run

1. A manufacturer opens **Supplier Map** in their dashboard and works through three steps:
   - sends the registration application with documents;
   - pins the factory;
   - fills in availability.
2. An admin opens **Verifications**:
   - checks each number on the MCA / GST / Udyam portal (the page links to them);
   - ticks what was checked and reads the documents;
   - verifies the pin, then approves.
3. The company appears on `/supplier-map` within seconds (or within 2 minutes without Realtime), provided it has at
   least one active product.

## Rolling back

Hide the pages by reverting the merge. The database objects can stay: nothing else uses them. To remove them
completely, drop these:

- **Functions:** `map_search_suppliers`, `map_supplier_detail`, `map_visible_company_ids`, `km_between`, the
  `supplier_*` and `admin_*_verification*` / `admin_decide_factory_location` functions, `my_company_id`, and the
  `valid_*` functions.
- **Triggers:** `trg_guard_company_verification_fields`, `trg_map_change_*` and `trg_log_*`.
- **Tables:** `business_verifications`, `factory_locations`, `verification_audit_log` and `supplier_map_changes`.

Keep the storage changes: the document buckets should stay private.

## Re-running the database tests

They run the migration in an in-memory Postgres (PGlite) and print each check's result.

```bash
cd docs/supplier-map/sql-tests
npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17   # node_modules is git-ignored
node map_check.mjs && node storage_check.mjs
```
