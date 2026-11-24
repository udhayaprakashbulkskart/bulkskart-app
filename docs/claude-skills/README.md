# BulkSkart Claude Code skills

There are four project skills in `.claude/skills/`. Claude Code loads them whenever it runs in this repository, and
each one works as a slash command.

| Command | What it makes |
| --- | --- |
| `/marketplace-content` | Manufacturer updates, BulkSkart posts, blog drafts in the site's `BlogPostData` format, social / WhatsApp / email copy, labelled demo feed posts |
| `/product-listing` | Product listings that fit the `products` table (title, description, specs, MOQ, price, tags, images); demo companies and products as SQL |
| `/buyer-requirements` | Buyer requests turned into RFQs for the Post Requirement form, plus a seller brief with no buyer identity; demo RFQs as SQL |
| `/product-images` | Shot lists, a phone photography brief, captions, alt text, file names, upload steps and a rights check |

Account-level skills with the same names still exist as `anthropic-skills:<name>`. Their rules are folded into these
BulkSkart versions, and the plain `/<name>` runs the BulkSkart one.

## Folder structure

```
.claude/skills/
├── marketplace-content/
│   ├── SKILL.md
│   └── scripts/check_feed.mjs        checks demo feed.json files
├── product-listing/
│   ├── SKILL.md
│   ├── reference/india-clusters.md   manufacturing towns, spec keys and price bands (shared)
│   └── scripts/demo_sql.mjs          demo data.json → insert.sql + cleanup.sql (shared with buyer-requirements)
├── buyer-requirements/
│   └── SKILL.md
└── product-images/
    └── SKILL.md
docs/claude-skills/
├── README.md                         this file
└── tests/                            run.mjs + fixtures
```

The skills only ever write new files, in these two places:
- `content-drafts/<skill>/…` for real content;
- `demo-content/<date>-batch-<NNN>-<topic>/…` for demo batches.

They never edit existing project files unless you ask.

## Examples

```
/product-listing PP woven sacks 50 kg, 60x90 cm, laminated, MOQ 10,000 pcs, ₹9–12 per piece ex-works Daman
/product-listing review <paste a listing>
/product-listing demo 300 textiles-apparel Tiruppur
/buyer-requirements need 5000 white cotton t-shirts 180 gsm for a school in Chennai by 15 Jan, about ₹160 each
/buyer-requirements demo 2000
/product-images Glazed vitrified floor tile 600x600 mm matt
/product-images demo  (for the products in the latest demo batch)
/marketplace-content update we added 2 knitting machines, capacity now 60k pcs/month
/marketplace-content blog how to write a requirement manufacturers can quote on
/marketplace-content demo 200
```

## Demo data rules

The helper script adds these labels automatically. It refuses any row that breaks a rule.

| | Labels |
| --- | --- |
| Companies | Owner is the template demo supplier `00000000-…-000000000001`; id `e1000001-0000-0000-0000-dd<batch><seq>`; name "… (Demo)"; slug `demo-…`; the description starts "DEMO LISTING"; `unverified`, not featured, no rating or reviews; no GSTIN, IEC, phone, email or website |
| Products | Only on demo companies; name "… (Demo)"; slug `demo-…-b<batch>-<n>`; tag `demo`; the description starts "DEMO LISTING … Not for sale"; images only from BulkSkart storage |
| Requirements | Buyer is the template demo buyer `00000000-…-000000000002`; the title ends "(Demo) - Lot #9<batch><seq>"; the description starts "Demo requirement seeded for BulkSkart production RFQ feed"; not a verified buyer; no quotes |
| Feed posts | `is_demo: true`, label "Demo post", the body starts "Demo post:", the company is a "(Demo)" one. They are files only; there is no feed table |

**What the site hides.** It already keeps these rows out of public RFQ feeds, "New RFQ" alerts, live counts, search
indexing and the supplier map (`src/lib/seedData.ts`). To see them, build with `VITE_INCLUDE_TEMPLATE_SEED_DATA=true`.

**What the skills never create:**
- accounts;
- subscriptions or payments;
- orders or quotations;
- reviews or certifications;
- verification records;
- notifications or messages.

They never mark anything verified. They never run SQL against production; you paste `insert.sql` into the Supabase
SQL editor yourself.

**Loading a batch:**
- `insert.sql` is one transaction.
- It stops without changes if the batch is already loaded or a category slug is unknown.
- While it runs, it pauses the three triggers that alert real users about new rows: `trg_rfq_matching_on_new_req`,
  `trg_match_on_new_manufacturer` and `trg_notify_followers`.
- Keep a batch to 5,000 rows or fewer for the SQL editor.
- `cleanup.sql` removes exactly that batch.

## Tests

```bash
cd docs/claude-skills/tests
npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17   # node_modules is git-ignored
node run.mjs
```

18 checks, run on 24 Nov 2026, all passing:
- the helper's validation;
- loading the SQL into an in-memory Postgres with production's table shapes and trigger names;
- the paused and restored triggers;
- re-runs and unknown categories;
- cleanup;
- the site's own demo filter on the generated rows;
- the feed checker.

Also on 24 Nov 2026:
- A batch of 19,000 rows loaded in 2.4 s.
- A fresh Claude Code process in this repository listed all four skills as slash commands.
- `/buyer-requirements` ran end to end.
