---
name: marketplace-content
description: "Write BulkSkart marketplace feed content. Real manufacturer updates (new product, capacity, samples, MOQ or price notices, dispatch schedules) come from facts the manufacturer gives. BulkSkart's own business posts cover announcements, buyer and supplier guides, category spotlights, blog posts in the site's format, and social, WhatsApp and email copy. Labelled demo feed posts can be made in batches for UI previews. No invented numbers or claims, and three headline options each time. Use when writing posts, updates, announcements, blog articles or demo feed data for BulkSkart."
argument-hint: "[update <facts> | post <topic> | blog <topic> | social <topic> | demo <count> [category]]"
---

# BulkSkart marketplace content

Write content that reads like a real B2B marketplace. Manufacturers post plain updates, and BulkSkart explains how
bulk buying works. No invented facts.

Request: **$ARGUMENTS**

| Mode | When | Output |
| --- | --- | --- |
| **Manufacturer update** | "update", facts from one manufacturer | 1–3 versions of the post + where it goes |
| **Business post** | "post", "announcement", "guide", "spotlight" in BulkSkart's own voice | Post + 3 headlines + channel versions |
| **Blog** | "blog", "article", "press release" | A `BlogPostData` object + the blog card, written to a draft file |
| **Social** | "social", "LinkedIn", "WhatsApp", "Instagram", "X", "email" | One version per channel, within its limits |
| **Demo feed** | "demo", "sample feed", a count | `demo-content/<folder>/feed.json` + preview, checked by `scripts/check_feed.mjs` |

## Read before writing (once per session)

- `src/pages/BlogPage.tsx` (`POSTS` cards) and `src/pages/BlogDetailPage.tsx` (`BlogPostData`, `BLOG_POSTS`): the blog
  format.
- `src/routes.tsx`: describe only features that exist as routes. These are some of them:
  - post a requirement free (`/post-requirement`);
  - quotations;
  - the Live Supplier Map (`/supplier-map`);
  - register your factory (`/register-factory`);
  - auctions;
  - the blog.

  If you can't find a feature in the code, don't mention it.
- `docs/supplier-map/README.md`: what "Verified" means on BulkSkart. An admin checked the GSTIN / CIN / Udyam (or a
  foreign registry) on official portals. It is **not** a quality guarantee, so never write it as one.
- Never edit these files. Write drafts to new files and say where a snippet would go.

**There is no feed or posts table in the database.** Updates and posts are text for the places listed below, or a
JSON file for demo previews. Do not create tables or insert notifications; a feed table would be a separate migration
the user asks for.

## Voice and rules (merged from the general marketplace-content skill)

**Voice:**
- Plain, practical, Indian English. Short sentences, active voice, units on every number.
- Use ₹ for INR; lakh and crore are fine for Indian readers ("₹4.5 lakh").
- Write like a factory owner or a sourcing manager, not an advert.

**Facts:**
- **Only facts that were supplied.** No user counts, supplier counts, order volumes, GMV, response times,
  "x% cheaper" or growth figures unless the user gives the number and its source.
- A missing fact becomes a placeholder in braces: `{launch_date}`, `{fee_rate}`, `{moq}`, `{city}`. List every
  placeholder at the end.
- **No superlatives without evidence**: never "India's largest", "best", "No.1", "most trusted" or "guaranteed".
- **No certification, award, test or export claims** the manufacturer did not confirm. "Now quoting for UAE buyers"
  is fine; "exporting to 40 countries" needs their word.
- **No completed-deal stories.** Never write "delivered 20 containers to …" or "won an order from …". That needs
  real data and the buyer's consent.
- **No buyer names, contacts or quotes** from real buyers, ever. No testimonials unless the user supplies them with
  permission.

**Output:**
- **Three headline options** with every post, blog and announcement. Each is ≤ 70 characters, and they take different angles.
- **A call to action** that points at a real route: "Post your requirement free → bulkskart.com/post-requirement",
  "Register your factory → bulkskart.com/register-factory".

### Lengths by place

| Place | Length | Notes |
| --- | --- | --- |
| Manufacturer update (company profile, product description, WhatsApp to buyers) | 40–120 words | Lead with the news, then specs, MOQ and when it is available |
| LinkedIn | 80–200 words | 3–5 hashtags at the end |
| X | ≤ 280 characters | One link |
| WhatsApp channel or broadcast | ≤ 500 characters | One link; no all-caps |
| Instagram caption | 80–150 words | 5–10 hashtags, plus an image idea (use `/product-images`) |
| Email | Subject ≤ 50 characters, preview ≤ 90, body 120–250 words | One clear action |
| Blog | 600–1,500 words | The `BlogPostData` shape below |

## Manufacturer updates

What a real manufacturer posts: new product or variant, capacity added, new machine installed, samples ready, MOQ
change, price revision notice, dispatch or holiday schedule, catalogue updated, now quoting for a new market.

Output for each update:
- the post;
- a shorter WhatsApp version;
- **where it goes**:
  - **Company profile** (Dashboard → Profile, `/dashboard/supplier/profile`: `description`, `tagline`, `key_products`,
    `production_capacity`, `moq_policy`, `packaging_details`) when it changes a lasting fact;
  - **the product listing** (use `/product-listing`) when it is about one product;
  - the manufacturer's own social or WhatsApp otherwise.

Example input: "We added 2 new knitting machines, capacity now 60k pcs/month, polo samples ready in 5 days."
Example output: "{company_name} has added two circular knitting machines. Monthly capacity is now about 60,000 pieces
of cotton and blended knit garments. Polo shirt samples in 220 GSM pique are ready within 5 working days of a request.
MOQ stays 500 pieces per style ({moq_per_colour} per colour). Send your requirement on BulkSkart to get a quotation."

## Business posts and blog (BulkSkart's voice)

Topics that fit:
- **Buyer guides**: how to write a requirement manufacturers can quote on; MOQ explained; comparing quotations;
  Incoterms for Indian buyers.
- **Supplier guides**: how to get on the Live Supplier Map; what verification checks; photographing products.
- **Category spotlights**: Tiruppur knitwear, Morbi tiles. Use `.claude/skills/product-listing/reference/india-clusters.md`.
  Describe the cluster from public knowledge, not invented statistics.
- **Feature announcements**, only for features in the code.

**Blog output.** Write `content-drafts/marketplace-content/<YYYY-MM-DD>-<slug>.ts.txt` containing:
1. A `POSTS` card for `BlogPage.tsx`: `{ slug, category, title, excerpt, author: 'BulkSkart', date: 'D Mon YYYY', readTime, tag }`.
2. A `BLOG_POSTS['<slug>']` entry for `BlogDetailPage.tsx`, matching `BlogPostData`:
   - `slug`, `title`, `metaDescription` (≤ 155 characters), `category`, `author`, `authorType`, `date`, `datePublished` (ISO);
   - `readTime`, `h1`, `summary`;
   - `content[]` of `{ heading, paragraphs[], bulletPoints? }`;
   - `faqs[]` (3–5, each answer 1–3 sentences);
   - `relatedLinks[]`, pointing to real routes only.

Tell the user to paste both into those files; edit them yourself only if they ask. Never publish demo content
on the blog.

## Demo feed (batches for UI previews)

Use this for mock-ups of a feed, the app, or marketing screenshots. Every post must say it is demo, and come from a
demo company.

**Where:** a NEW folder `demo-content/<YYYY-MM-DD>-batch-<NNN>-feed/`. Use the highest `batch-NNN` in `demo-content/`
+ 1, and never overwrite. If a demo product batch exists (its `data.json` has companies), reuse those companies'
names, slugs, cities and products, so the feed matches the demo catalogue.

**`feed.json`:** an array of posts:

```json
{
  "id": "demo-post-b005-0001",
  "is_demo": true,
  "label": "Demo post",
  "kind": "capacity_added",
  "company_name": "Noyyal Knit Works (Demo)",
  "company_slug": "demo-noyyal-knit-works-b003",
  "city": "Tiruppur", "state": "Tamil Nadu", "country": "India",
  "category_slug": "textiles-apparel",
  "title": "Two new circular knitting machines installed",
  "body": "Demo post: Monthly capacity is now about 60,000 knit garments. Polo samples in 220 GSM pique are ready in 5 working days. MOQ 500 pieces per style.",
  "tags": ["knitwear", "polo shirts", "tiruppur"],
  "image_idea": "Front view of a white polo shirt on a plain background",
  "posted_at": "2026-11-20T10:15:00+05:30"
}
```

**Allowed `kind`s:** `new_product`, `new_variant`, `capacity_added`, `machine_installed`, `sample_available`,
`moq_change`, `price_notice`, `dispatch_schedule`, `holiday_notice`, `catalogue_update`, `now_quoting_market`,
`buyer_guide` (BulkSkart voice; company fields null).

**Never in a demo post:**
- certifications, awards, "verified", ratings or reviews. A `buyer_guide` post may explain what BulkSkart verification
  checks, or which certificate a buyer should ask for;
- completed orders, shipments or deliveries to anyone;
- real company, brand or person names;
- real trade-fair participation;
- phone numbers, emails or links other than bulkskart.com routes;
- platform statistics.

**Steps:**
1. Plan the mix of kinds, about 70% manufacturer updates and 30% `buyer_guide`. Spread `posted_at` over the last 30
   days, in business hours IST.
2. For ≤ 50 posts, write them by hand. For more, write `demo-content/<folder>/generate.mjs` (Node, no packages):
   - seeded random from the batch number;
   - 4–6 sentence patterns per kind, filled from category vocabularies (products, specs, units, MOQ ranges);
   - no two bodies the same.
3. Check: `node .claude/skills/marketplace-content/scripts/check_feed.mjs demo-content/<folder>/feed.json`. Fix all
   problems and re-run.
4. Write `preview.md` (the first 20 posts, readable) and `README.md` (counts, labels, that this is not loaded into any
   database).

## Before you finish

- [ ] No invented numbers or claims; placeholders are listed; three headlines per post, blog and announcement.
- [ ] Every call to action points at a real route.
- [ ] Every version is within its channel's length.
- [ ] Demo: `is_demo: true`, label "Demo post", company names end "(Demo)", the checker passes, and only new files
  are written.
