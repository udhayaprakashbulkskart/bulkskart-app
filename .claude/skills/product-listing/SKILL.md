---
name: product-listing
description: "Write BulkSkart product listings (title, description, specifications, MOQ, price range, images) that fit the products table. Works for a real manufacturer from the facts they give, or as clearly labelled demo catalogue data in batches up to 20,000 rows, with a ready SQL file and a cleanup file. Use when adding, rewriting or reviewing a BulkSkart product, or when demo products and demo manufacturers are needed."
argument-hint: "[product facts | review <product text> | demo <count> [category] [cluster]]"
---

# BulkSkart product listing

Make listings that a bulk buyer on BulkSkart (www.bulkskart.com, a B2B wholesale marketplace) can act on: what it is,
the key spec, the MOQ, the price band and what still needs asking. Everything maps onto the real `products` table.

Request: **$ARGUMENTS**

Pick the mode from the request:

| Mode | When | Output |
| --- | --- | --- |
| **Real listing** (default) | A manufacturer's own product, from facts they give | Listing preview + a JSON row; they paste it into their dashboard |
| **Review** | "review", "improve", "check" with existing listing text | Problems ranked, then the rewritten listing |
| **Demo** | "demo", "sample", "seed", "test data", a count like "200 products" | `demo-content/<folder>/data.json` → `insert.sql` + `cleanup.sql` via the helper |

Ask at most one question, and only when the product itself is unclear. Otherwise write the listing and list the gaps.

## Read before writing (once per session)

- `src/types/types.ts`: the `Product` and `Company` interfaces (the column names below come from there).
- `src/pages/ProductDetailPage.tsx` → `parseSpecifications()`: specs are a JSON object string (or `Key: Value` lines).
- `src/lib/seedData.ts`: the demo markers the site hides from public listings.
- Do not modify these files. This skill only writes new files.

## The `products` columns

| Column | Type / rule | Notes |
| --- | --- | --- |
| `name` | text, required | Listing title (formula below) |
| `slug` | text, unique | lowercase-hyphenated; demo: `demo-<name>-b<batch>-<n>` |
| `company_id` | uuid, required | The seller's company. Demo rows only on demo companies |
| `category_id` | uuid | Look up by slug; give `category_slug` in JSON |
| `description` | text | 60–180 words, plain sentences |
| `specifications` | text | JSON object string, e.g. `{"GSM":"180","Fabric":"100% cotton"}` |
| `moq` | integer ≥ 1, required | Whole number in `moq_unit` |
| `moq_unit` | text, default `pcs` | `pcs`, `kg`, `tonnes`, `metres`, `sq m`, `litres`, `sets`, `pairs`, `dozen`, `rolls`, `cartons`, `bags` |
| `price_min`, `price_max` | numeric(12,2) or null | Per `moq_unit`. Both null = "Price on request" |
| `price_currency` | 3 letters, default `INR` | |
| `images` | text[] | Up to 10 URLs in BulkSkart storage; `images[0]` is the card photo. Plan them with `/product-images` |
| `tags` | text[] | 3–8 lowercase search words buyers type |
| `export_destinations` | text[] | Countries the seller says they ship to |
| `is_active` | boolean | true |

Do not set `is_featured`, `view_count` or promotion fields. Those are paid or earned, and the database guards them.

Top-level category slugs (live site, Nov 2026). Subcategory slugs also work. The SQL stops on an unknown slug:
`agriculture-food`, `auto-parts-vehicles`, `chemicals-raw-materials`, `construction-building`, `electronics-electricals`,
`furniture-home`, `gems-jewellery`, `handicrafts-gifts`, `machinery-industrial`, `packaging`, `pharma-healthcare`,
`plastics-rubber`, `textiles-apparel`.

## Listing rules

**Title** = product + the one spec buyers filter on + form or grade (+ MOQ if it fits). Use 50–90 characters, no
capitals for emphasis, and no seller name.
- Good: `Cotton Round-Neck T-Shirt, 180 GSM Bio-Washed, Plain or Printed`
- Good: `PP Woven Sack 50 kg, 60×90 cm, Laminated, BOPP Print Optional`
- Bad: `BEST QUALITY T SHIRTS!!! Top Supplier`

**Description**: what it is, then:
- what it is used for and who buys it (garment brands, contractors, distributors);
- 4–6 bullet-style facts woven into sentences (material, size range, finish, packing, lead time);
- what can be customised.

End with one line on what the buyer should confirm (sample, colour approval, test report).

**Specifications**: 5–12 rows, units in every value. When a value is missing, write `"Ask seller"`. Never guess.

**MOQ**: the seller's number. Write it as a whole number in the selling unit (500 pcs, 2 tonnes). If the seller sells by carton, say what one carton holds in the description.

**Price**: only the seller's price, per unit, with what it includes (ex-works / FOB, GST extra or included).
- No price given: leave both empty ("Price on request") and say so.
- `price_min ≤ price_max`. A single price goes in both.

**Claims** (merged from the general product-listing skill):
- Never add a certification, test result, award, review, rating, ranking or capacity figure the seller did not confirm.
- No superlatives ("best", "leading", "No.1").
- "Verified" only appears when the company's `verification_status` is `verified` on BulkSkart, and that's the site's badge, not listing text.

**Gaps**: after every real listing, list "Missing — ask the seller" (up to 5 items, most important first).

## Real listing: output

1. A preview: title, 4–6 key facts, specs table, MOQ, price line, tags, and an image line ("needs 6 photos — run
   `/product-images <title>`").
2. A JSON row the seller can copy (same keys as the columns, `category_slug` instead of `category_id`).
3. Where it goes: **Dashboard → Products → Add product** (`/dashboard/supplier/products`). The seller enters it there
   under their own login; row-level security lets only the owner add products. Do not write SQL for real companies.

For many real products, write `content-drafts/product-listing/<YYYY-MM-DD>-<company-slug>.json` (an array of rows) and
a matching `.md` preview. Never overwrite a file: add `-2`, `-3`… to the name.

## Demo mode (batches)

Demo data is for previews, screenshots and testing. It must never pass for a real business. The helper
`.claude/skills/product-listing/scripts/demo_sql.mjs` enforces the rules below and refuses rows that break them.

**What demo rows get (added automatically by the helper):**
- **Companies:**
  - owner is the template demo supplier `00000000-0000-0000-0000-000000000001`;
  - id is `e1000001-0000-0000-0000-dd<batch 4><seq 6>`;
  - name ends in ` (Demo)`, slug starts `demo-`;
  - the description starts "DEMO LISTING: … Not a real business";
  - `unverified`, not featured, rating 0, no reviews.
- **Products:** only on demo companies; name ends ` (Demo)`; slug `demo-…-b<batch>-<n>`; tag `demo`; the description starts "DEMO LISTING: … Not for sale."
- The site already hides demo companies (by owner and id prefix) from live counts and the supplier map. The `(Demo)`
  labels cover the pages that still list them.

**Never, in demo mode:**
- Create accounts or profiles, subscriptions or payments, orders, quotations, reviews, certifications,
  `business_verifications`, `factory_locations`, notifications or messages.
- Mark anything verified or featured.
- Use a real company, brand or person's name, or a legal suffix (Pvt Ltd, LLP, Ltd).
- Include a GSTIN, IEC, CIN, PAN, phone, email or website. A made-up GSTIN can belong to a real firm.
- Put photos from other sellers or websites in `images`. Leave `images` empty, or use the user's own uploads in BulkSkart storage.
- Attach a demo product to a real company.
- Run SQL against production yourself. A person reviews and runs `insert.sql`.

**Steps:**

1. **Pick the batch number.** List `demo-content/`, take the highest `batch-NNN` in use (across all folders) + 1.
   Create a NEW folder `demo-content/<YYYY-MM-DD>-batch-<NNN>-<topic>/`. Never reuse or overwrite a folder.
2. **Plan the mix.** Spread categories, clusters and price bands. Use `reference/india-clusters.md` (in this skill)
   so each demo manufacturer sits in a city known for that product: Tiruppur knitwear, Morbi tiles, Moradabad brassware…
   For a request like "demo 500" use about 1 company per 5–8 products.
3. **Write the rows.**
   - **Up to ~50 rows:** write `data.json` by hand, with each listing written individually.
   - **More rows:** write a generator, `demo-content/<folder>/generate.mjs` (Node, no packages):
     - a seeded random generator (e.g. mulberry32 with the batch number), so a re-run gives the same file;
     - per category, curated lists of product types with realistic spec keys and value ranges, units, MOQ ranges and
       INR price bands per unit, plus 3–5 sentence patterns per category so descriptions don't repeat;
     - de-duplicate names and slugs;
     - output `data.json`.
   - Read 20 random rows before going on, and fix anything that reads robotic or implausible: a 1 kg MOQ for steel
     beams, ₹5 per kg for saffron.
   - Keep one batch to **5,000 rows or fewer**: that is about 2.5 MB of SQL, which the Supabase SQL editor
     takes in one paste. For a bigger job, make several batches (one folder each) from the same generator.
4. **Build the SQL:** `node .claude/skills/product-listing/scripts/demo_sql.mjs demo-content/<folder>/data.json`.
   - Fix every reported problem in the generator or `data.json` and run it again.
   - It writes `insert.sql`, `cleanup.sql` and `summary.json`, and refuses to overwrite them.
5. **Write `demo-content/<folder>/README.md`.** Include:
   - what is in the batch and the counts;
   - the labels used;
   - how to load it: paste `insert.sql` into the Supabase SQL editor. It's one transaction; it stops if the batch is already loaded; the notification triggers are paused inside it;
   - how to remove it (`cleanup.sql`);
   - that the site hides demo RFQs and counts unless the site is built with `VITE_INCLUDE_TEMPLATE_SEED_DATA=true`.

`data.json` shape (the helper rejects any other field):

```json
{
  "batch": 3,
  "companies": [
    {
      "seq": 1, "company_name": "Noyyal Knit Works", "business_type": "Manufacturer",
      "city": "Tiruppur", "state": "Tamil Nadu", "country": "India",
      "description": "Knitwear unit making cotton and blended T-shirts, polos and sweatshirts for private labels.",
      "tagline": "Cotton knitwear for private labels", "year_established": 2011, "employee_count_range": "101-200",
      "key_products": ["T-shirts", "Polo shirts", "Sweatshirts"], "export_destinations": ["UAE", "UK"],
      "payment_terms": ["30% advance, 70% before dispatch"], "production_capacity": "About 40,000 pcs per month",
      "moq_policy": "500 pcs per style, 100 per colour", "packaging_details": "Polybag per piece, 50 pcs per 5-ply carton"
    }
  ],
  "products": [
    {
      "company_seq": 1, "category_slug": "textiles-apparel",
      "name": "Cotton Round-Neck T-Shirt, 180 GSM Bio-Washed",
      "description": "Plain round-neck T-shirt in combed cotton single jersey ...",
      "specifications": {"Fabric": "100% combed cotton single jersey", "GSM": "180 ± 5", "Sizes": "S–XXL", "Print": "Screen or DTF, Ask seller"},
      "moq": 500, "moq_unit": "pcs", "price_min": 145, "price_max": 210, "price_currency": "INR",
      "tags": ["t-shirt", "cotton", "180 gsm", "private label"], "export_destinations": ["UAE"], "images": []
    }
  ]
}
```

To add products to demo companies that already exist, use `"company_id": "e1000001-0000-0000-0000-…"` instead of
`company_seq`. The SQL checks that they are demo companies.

## Before you finish

- [ ] Every title follows the formula and is ≤ 90 characters. No superlatives, no unconfirmed claims.
- [ ] Specs have units, and missing ones say "Ask seller" (real mode).
- [ ] MOQ is a whole number. The price is per `moq_unit`, `min ≤ max`, or "Price on request".
- [ ] Real mode: a gaps list and the dashboard path. No SQL for real companies.
- [ ] Demo mode: a new folder; the helper ran clean; the README is written; nothing outside `demo-content/` changed.
