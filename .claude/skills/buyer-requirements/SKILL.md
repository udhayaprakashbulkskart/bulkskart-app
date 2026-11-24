---
name: buyer-requirements
description: "Turn a bulk buyer's sourcing request into a BulkSkart requirement (RFQ) that fits the requirements table and the Post Requirement form: product, quantity and unit, delivery location, deadline, budget band, specifications, must-haves, plus a seller-facing brief without the buyer's identity. Also generates clearly labelled demo RFQs in batches up to 20,000 with insert and cleanup SQL. Use when a buyer describes what they need, when an RFQ needs tidying, or when demo RFQ feed data is needed."
argument-hint: "[buyer's request text | demo <count> [category] [destination]]"
---

# BulkSkart buyer requirements (RFQs)

Turn what a buyer says ("need 5000 white tees for a school order in Chennai by Jan") into a requirement that manufacturers on BulkSkart can quote on. Every field maps to the `requirements` table and the Post Requirement form (`/post-requirement`).

Request: **$ARGUMENTS**

| Mode | When | Output |
| --- | --- | --- |
| **Structure** (default) | A buyer's own request, pasted or described | Buyer copy for the form, a seller brief, open questions |
| **Demo** | "demo", "sample", "seed", "test RFQs", a count | `demo-content/<folder>/data.json` → `insert.sql` + `cleanup.sql` via the shared helper |

## Read before writing (once per session)

- `src/types/types.ts`: the `Requirement` interface.
- `src/pages/PostRequirementPage.tsx`: the form's units, closing windows and fields.
- `src/lib/seedData.ts`: the demo markers that keep demo RFQs out of public feeds.
- `supabase/migrations/00068_public_listing_rfqs.sql`: the `source_type` rules.

This skill only writes new files. It never changes these.

## The `requirements` columns

| Column | Rule | From the buyer |
| --- | --- | --- |
| `title` | text, required. Product + key spec + quantity, ≤ 100 characters | "Cotton Round-Neck T-Shirts, 180 GSM, White — 5,000 pcs" |
| `category_id` | look up by category slug | Pick the closest slug (list below) |
| `quantity` | **integer**, required for BulkSkart RFQs | Whole number. Convert "5k" to 5000 and "2.5 MT" to 2500 kg if needed |
| `quantity_unit` | text, required | The form's units: `Pcs`, `Metres`, `Kilograms (kg)`, `Metric Tons (MT)`, `Boxes`, `Cartons`, `Liters`, `Pairs`, `Sets`, `Units` |
| `specifications` | text | Specs as `Key: Value` lines: material, size, grade, colour, packing, standard |
| `description` | text | Use, end customer, quality expectations, sample need, delivery terms (see the template) |
| `destination_country`, `destination_city` | text | Delivery location. City only, never a street address |
| `deadline` | date | Date the goods are needed by |
| `budget_min`, `budget_max` | numeric or null | **Target price per unit**: the form's "Target Min / Max Price / Unit". Only if the buyer gave a budget; a total budget is divided by the quantity and marked approximate. Otherwise null, with "Budget: not stated" |
| `currency` | 3 letters, default `INR` | |
| `status` | `active` / `closed` / `expired` | New requirements are `active` |
| `expires_at` | timestamptz | When quoting closes: the form offers 24 h, 48 h, 7, 14 or 30 days |
| `source_type` | `bulkskart` | Requirements posted on BulkSkart. `public_listing` is only for the admin import of outside tenders |
| `buyer_id`, `is_verified_buyer`, `quote_count`, `view_count`, `req_number` | set by the system | Never fill these by hand |

Category slugs: `agriculture-food`, `auto-parts-vehicles`, `chemicals-raw-materials`, `construction-building`,
`electronics-electricals`, `furniture-home`, `gems-jewellery`, `handicrafts-gifts`, `machinery-industrial`,
`packaging`, `pharma-healthcare`, `plastics-rubber`, `textiles-apparel`.

## Structuring rules (merged from the general buyer-requirements skill)

1. **Sort everything the buyer said** into the fields above, and keep their numbers exactly.
   - **Never invent** a budget, quantity, deadline or spec. A missing one is written as "not stated".
   - "Around 5000" stays 5000, with "approximate" in the description.
2. **Split the needs** into:
   - **Must-haves**: deal breakers, e.g. a GOTS certificate, delivery by a date, a food-grade material.
   - **Nice-to-haves**: e.g. custom printing, eco packaging.
   - **Deal breakers**: what makes a quote useless, e.g. MOQ above their quantity, or no GST invoice.
3. **Ask at most 5 open questions**, most important first: the ones that change the price or decide whether a supplier can quote at all (GSM, grade, size split, packing, Incoterm).
4. **Seller brief**: the same requirement with the buyer's identity left out:
   - no name, company, phone, email, GSTIN or street address;
   - city and country only.

   BulkSkart hides buyer contacts from the public at database level. The text must not leak them either.
5. **Delivery terms**: state who pays freight if the buyer said so (ex-works, FOR destination, FOB, CIF). Otherwise put it in the open questions.
6. **Plain words.** Use units in every number. Use no "urgent!!!", unless the buyer's date really is close. Then say the date.

### Description template

```
Use: <what the goods are for / who the end customer is>.
Quantity: <n> <unit> (<one-time / monthly / per quarter>).
Must have: <list>.
Nice to have: <list>.
Delivery: <city, country> by <date>; <terms or "terms to discuss">.
Samples: <needed before order / not needed / not stated>.
Payment: <buyer's terms or "to discuss">.
```

## Structure mode: output

1. **For the form**: each field of `/post-requirement` with its value: title, category, quantity + unit,
   specifications, description, destination, budget, closing window, required-by date.
   - A prefill link `https://www.bulkskart.com/post-requirement?q=<url-encoded title>` fills the title.
   - The buyer posts it under their own login; never insert real RFQs with SQL.
   - The buyer's name and contact go only in the form's own "Buyer / Company Name" and "Contact" fields (filled
     from their account). Never put them in the title, description or specifications.
2. **Seller brief**: 5–8 lines with no buyer identity.
3. **Open questions**: up to 5.
4. **Checks**: quantity is a whole number in a form unit; the deadline is in the future; budget min ≤ max or "not stated".

For several requests at once, also write `content-drafts/buyer-requirements/<YYYY-MM-DD>-<topic>.json` (an array of
rows using the column names). Never overwrite a file: add `-2`, `-3`…

## Demo mode (batches)

Demo RFQs fill the feed for previews and testing. They must never look like real buyer demand. The shared helper
`.claude/skills/product-listing/scripts/demo_sql.mjs` checks every row and adds the labels the site already uses.

**What every demo RFQ gets (automatic):**
- `buyer_id` is the template demo buyer account `00000000-0000-0000-0000-000000000002`. It is never a real buyer's id.
- The title ends `(Demo) - Lot #9<batch 3><seq 5>`. The site's filter `/ - Lot #\d+\s*$/` hides these from the public
  feeds, the "New RFQ" alerts, the live counts and search indexing.
- The description starts "Demo requirement seeded for BulkSkart production RFQ feed. No buyer posted it; do not quote."
  (it matches `SEEDED_FEED_DESCRIPTION`).
- `is_verified_buyer` false, `quote_count` 0, `view_count` 0, `source_type` `bulkskart`.
- The trigger `trg_rfq_matching_on_new_req`, which sends new RFQs to the matching function that alerts manufacturers,
  is paused inside the load transaction. Real manufacturers get no alerts about demo RFQs.

**Never, in demo mode:**
- Use a real buyer's account, name, company or contact.
- Create quotations, orders, deal statuses, awards, reviews or notifications.
- Write "order placed" or "awarded to …".
- Include phone numbers, emails, websites or street addresses.
- Run SQL against production yourself.

**Steps:**

1. **Pick the batch number.** Use the highest `batch-NNN` in `demo-content/` + 1. Make a NEW folder
   `demo-content/<YYYY-MM-DD>-batch-<NNN>-rfqs/`. Never reuse or overwrite one.
2. **Plan the mix.**
   - Spread over categories, destination cities (Indian metros and clusters from
     `.claude/skills/product-listing/reference/india-clusters.md`, and about 20% export: UAE, Saudi Arabia, UK, USA,
     Kenya, Nigeria, Singapore, Australia).
   - Quantities realistic per product (tees in thousands of `Pcs`, rice in `Metric Tons (MT)`, chemicals in
     `Kilograms (kg)`); a per-unit budget on about 60% (the rest "not stated" and null); deadlines 10–90 days ahead.
   - `posted_days_ago` spread over 0–20 days, `expires_in_days` from {2, 7, 14, 30}. A few `closed`.
3. **Write the rows.**
   - Up to ~50: write them in `data.json` by hand, each in a buyer's own voice, filled into the template.
   - More: write `demo-content/<folder>/generate.mjs` (Node, no packages):
     - seeded random (e.g. mulberry32 with the batch number);
     - per category, product types with spec keys and value ranges, unit, quantity range and budget per unit;
     - 4–6 description patterns per category; titles de-duplicated.
   - Read 20 random rows and fix anything implausible before going on.
   - Keep one batch to **5,000 rows or fewer**: that is about 2.5 MB of SQL, which the Supabase SQL editor
     takes in one paste. For a bigger job, make several batches (one folder each) from the same generator.
4. **Build:** `node .claude/skills/product-listing/scripts/demo_sql.mjs demo-content/<folder>/data.json`. Fix every
   reported problem and re-run. It writes `insert.sql`, `cleanup.sql` and `summary.json`, and refuses to overwrite them.
5. **Write `README.md` in the folder.** Cover:
   - the counts and the labels;
   - load: paste `insert.sql` into the Supabase SQL editor (one transaction, safe to retry);
   - remove: run `cleanup.sql`;
   - demo RFQs only show on the site when it is built with `VITE_INCLUDE_TEMPLATE_SEED_DATA=true`.

`data.json` shape:

```json
{
  "batch": 4,
  "requirements": [
    {
      "seq": 1, "category_slug": "textiles-apparel",
      "title": "Cotton Round-Neck T-Shirts, 180 GSM, White",
      "description": "Use: school sports day kits. Quantity: 5000 Pcs (one-time). Must have: 100% cotton, size split S–XL. Nice to have: one-colour chest print. Delivery: Chennai, India by 15 Jan; FOR Chennai. Samples: needed before order. Payment: to discuss.",
      "specifications": {"Fabric": "100% cotton single jersey", "GSM": "180", "Colour": "White", "Packing": "Polybag per piece"},
      "quantity": 5000, "quantity_unit": "Pcs",
      "destination_country": "India", "destination_city": "Chennai",
      "deadline": "2027-01-15", "budget_min": 130, "budget_max": 180, "currency": "INR",
      "posted_days_ago": 3, "expires_in_days": 14
    }
  ]
}
```

Allowed fields: `seq`, `category_slug`, `title`, `description`, `specifications` (object or text), `quantity`,
`quantity_unit`, `destination_country`, `destination_city`, `deadline`, `budget_min`, `budget_max`, `currency`,
`is_urgent`, `status`, `posted_days_ago` (0–60), `expires_in_days` (1–90). The helper rejects anything else.

## Before you finish

- [ ] No invented numbers in structure mode. Every gap is "not stated" or an open question (5 at most).
- [ ] The seller brief carries no buyer identity.
- [ ] Quantity is an integer in one of the form's units. The deadline is in the future.
- [ ] Demo mode: a new folder; the helper ran clean; the README is written; nothing outside `demo-content/` changed.
