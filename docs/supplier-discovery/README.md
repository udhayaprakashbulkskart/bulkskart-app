# Supplier & product discovery engine

Finds real manufacturers and their real products on the companies' **own websites**, verifies each company's GST
registration with an **authorised** source, and publishes only what passes the rules in a public
Supplier Directory (`/directory`). Nothing is invented: every value comes from a page, and every record keeps the
page it came from.

There are no business records in the code or the migration. The tables start empty and fill only from real websites.

## How it works

```
Admin queues a job (Dashboard → Admin → Discovery → Find suppliers)
      │  search query + place, or a list of company websites
      ▼
Worker: GitHub Actions, every 2 hours (.github/workflows/supplier-discovery.yml)
  1. search API → candidate websites (marketplaces, directories, social, news and gov sites are skipped)
  2. reads each company's own site (robots.txt obeyed, 1.5 s between requests, ≤25 pages)
  3. extracts name, GSTIN (check digit verified), address, city, state, pincode, phones, emails, products
  4. saves through discovery_worker_* functions → database applies the rules (below)
  5. GST check with the configured GST Suvidha Provider → database re-applies the rules
  6. rechecks: websites and product pages every 30 days, GST every 90 days
      ▼
Published + verified only → public directory (/directory). No phones, emails, GSTINs or source links in public.
```

## The rules (enforced in the database)

**Verified** needs all of these:
- **An active GST registration.** It comes from an authorised source: the GST provider API, or an admin who checked
  the official portal and recorded it. A search listing never verifies anything. Without a provider, suppliers stay
  in **Needs review**.
- **The name matches.** The website's name must match the GST legal or trade name: at least 60% of the words,
  ignoring "Pvt Ltd", "M/s" and similar. This can be turned off in Settings.
- **The state matches.** The website's address must be in the GSTIN's state. This can be turned off in Settings.
- **Not a duplicate, and not suppressed.**

**What happens otherwise:**

| Finding | Result |
| --- | --- |
| GST cancelled, suspended or not found | Rejected; or suspended, if the supplier was verified before |
| No GSTIN on the website | Needs review |
| Name or state does not match | Needs review |

**Published.** The database refuses to publish anything that is not verified (a CHECK constraint). A supplier is
published automatically when it is verified and has at least one verified product. Both can be changed in Settings.

**Products.**
- A product is verified when its supplier is verified and its page is on the supplier's own website.
- It is published with its supplier.
- Price and MOQ are stored only when the page prints them, word for word. They are never worked out.
- Photos are not shown publicly until "Show product photos" is turned on, because they belong to each company.

**Duplicates.**
- *Suppliers:* the same website is the same record; the same GSTIN on another website, or the same name and pincode,
  is a duplicate.
- *Products:* the same product name from the same supplier at another address becomes a second source of one
  product.

All are shown in the **Duplicates** tabs.

**Rechecks.**
- A page that is gone (404 or 410, or the domain no longer exists) is suspended and unpublished at once.
- Three temporary failures in a row (5xx, timeouts) also suspend it.
- A later successful check restores it.
- If GST becomes inactive, the supplier is suspended.

**Admin decisions stand.** A rejection or suspension by an admin stays until an admin restores it. A withheld
supplier is never re-published automatically.

**Removal requests.** "Removal request" unpublishes the company, clears its stored contacts, and adds its domain and
GSTIN to `discovery.suppressions`, so it is never collected again. The public page and `/bot` explain how to ask.

## Tables (schema `discovery`, not exposed by the API)

| Table | Holds |
| --- | --- |
| `suppliers` | One per company website: facts read, `source_url`, `source_type`, `found_via`, `verification_status`, `publish_status`, `evidence` (where each fact was read), `last_verified_at`, `last_fetched_at`, `next_recheck_at`, timestamps |
| `supplier_verification` | Every GST check: method (API / admin portal), provider, result, status, legal and trade name, name score, state and pincode match, evidence |
| `products` | One per product: name, category, specifications, description (as on the page, or rewritten from it), `price_text` / `moq_text` (only as printed), `source_url`, statuses, evidence |
| `product_sources` | Every address a product was seen at |
| `verification_logs` | Every change, error and decision, with who made it |
| `discovery_jobs` | Queued, running and finished jobs with their stats and errors |
| `settings`, `suppressions`, `gst_states` | The rules, removal requests, official GST state codes |

**Access.**
- `discovery_worker_*`: the service role only.
- `admin_discovery_*`: admins only (anyone else gets `admin_only`).
- `directory_*`: anyone, but they return only published, verified records, without contacts, GSTIN or source links.

## Setup

1. **Database.** In the Supabase SQL editor, run `supabase/migrations/00074_supplier_discovery.sql`. It is one
   transaction and safe to run again.
2. **Website.** Merge the `supplier-discovery` branch. This adds:
   - `/dashboard/admin/discovery` (menu: Discovery);
   - `/directory` and `/directory/:id`;
   - `/bot`;
   - a footer link to the directory.
3. **Worker secrets.** Add these in GitHub → Settings → Secrets and variables → Actions. Only the first is required;
   without it the scheduled run does nothing.

   | Secret | For |
   | --- | --- |
   | `SUPABASE_SERVICE_ROLE_KEY` | Saving results (required) |
   | `BRAVE_SEARCH_API_KEY`, or `GOOGLE_CSE_KEY` + `GOOGLE_CSE_ID` | Search jobs. Without one, only "Company websites" jobs work |
   | `GST_VERIFY_URL` (with `{gstin}` in it), `GST_VERIFY_API_KEY`, optional `GST_VERIFY_AUTH_HEADER`, `GST_VERIFY_EXTRA_HEADERS` (JSON) | Automatic GST checks through a GST Suvidha Provider. The answer is read in GSTN's taxpayer-search format (`gstin`, `lgnm`, `tradeNam`, `sts`, `pradr`) or its common camelCase variants |
   | `ANTHROPIC_API_KEY` | Optional. Product descriptions rewritten by Claude from the page's facts only. A rewrite that adds any number, claim or link is thrown away and the page's own text is kept |

4. **First run.**
   - Queue a "Company websites" job with one website you know, then run the workflow by hand (Actions →
     Supplier discovery → Run workflow).
   - To see what would be stored without saving anything, put the address in **dry_run_url**.

## Behaviour on the web

- **Identification.** The User-Agent is `BulkSkartDiscoveryBot/1.0 (+https://www.bulkskart.com/bot)`.
- **robots.txt.** It is obeyed, including Crawl-delay. If robots.txt can't be read because of a server error, the
  site is not crawled.
- **Limits.** At least 1.5 s between requests to a site; 20 s and 2 MB per page; at most 5 redirects.
- **Safety.** Only public addresses on standard ports are opened. Private and internal networks are refused on every
  redirect.
- **Logs.** The Actions logs show only website names and counts, never phones, emails or full GSTINs, because the
  repository is public.

## Tests

| Where | What | Result (24 Nov 2026) |
| --- | --- | --- |
| `scripts/discovery` → `npm test` | robots.txt, safe fetching, extraction, GST parsing, search adapters, grounding of AI text, the worker flow | 33 / 33 |
| `docs/supplier-discovery/sql-tests/discovery_check.mjs` | The migration on PGlite with Supabase roles: rules, duplicates, rechecks, admin decisions, removal requests, permissions | 71 / 71 |
| `docs/supplier-discovery/sql-tests/e2e_check.mjs` | The real worker against the real migration: queue → read website → GST check → verified → published → recheck → unpublished | 9 / 9 |
| `src/__tests__/supplierDiscovery.test.ts` (Vitest) | No contacts or source links in the public page, published means verified, same category list everywhere | 5 / 5 |
| Browser (Playwright, stubbed API) | Admin page and directory, desktop and phone, dark and light | no overflow, no page errors, no contacts or outside links in public |

Run the database tests with:

```bash
cd docs/supplier-discovery/sql-tests
npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17
(cd ../../../scripts/discovery && npm ci)
node discovery_check.mjs && node e2e_check.mjs
```

Test inputs use the reserved `.example` domain and computed check digits. They live only in memory.

**Not tested here:**
- Real websites. This development sandbox cannot reach them, though the GitHub runner can. Start with a dry run on a
  few real sites.
- Real search or GST providers. They need your keys.
- Live verification: until a GST provider is configured, or an admin records portal checks, nothing becomes
  verified, so nothing is published.
