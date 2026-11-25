# SEO: what the site does, and the steps only you can take

## In the code (branch `seo-boost`)
- **Pre-rendered HTML** (`scripts/seo-prerender.mjs`, run by every build): the home page, All Categories, all 41 category
  pages, `/faq`, `/indiamart-alternative`, `/tradeindia-alternative` and `/alibaba-alternative` are written to
  `dist/_seo/` with their own title, description, canonical, structured data and real text. Crawlers that do not run
  JavaScript (Bing often, social previews, AI answer engines) read that text instead of an empty page; people get the
  normal app, which replaces it as it starts.
- **"People also ask" content**: `/faq` (13 questions about BulkSkart), 4 questions on every category page, 3–4 on each
  alternative page, all marked up as `FAQPage`. Wording lives in `src/data/seoContent.json`.
- **Comparison pages** for people searching "IndiaMART alternative", "TradeIndia alternative", "Alibaba alternative":
  only BulkSkart is described; the other platform is named with a trademark note.
- **Brand**: one spelling, "BulkSkart", in titles and `og:site_name`; the Organization data names BulkSkart's own
  profiles (the ones in the footer) and Tech Pod AI Database Private Limited as the parent company.
- **Sitemap** now also lists `/faq`, the alternative pages and the 9 landing pages (`/b2b-marketplace`, …).

## 1. One line on the server (needed for the pre-rendered pages)
The web container reads `deploy/bulkskart/stack/frontend/nginx.conf` from the server's disk. Copy the new file from this
branch to the server (same path), then reload:

```bash
docker exec bulkskart-web nginx -t && docker exec bulkskart-web nginx -s reload
```

Check (should print the page's own title, not the home page's):
```bash
curl -s https://www.bulkskart.com/faq | grep -o '<title>[^<]*'
```
Before the server is updated nothing breaks: the site behaves exactly as today.

## 2. Google Search Console (most important)
1. https://search.google.com/search-console → Add property → **Domain** → `bulkskart.com` → add the TXT record it gives
   in Cloudflare DNS.
2. Sitemaps → submit `https://www.bulkskart.com/sitemap.xml`.
3. URL inspection → request indexing for `/`, `/faq`, `/categories`, `/indiamart-alternative`.

## 3. Bing Webmaster Tools (also feeds ChatGPT search and DuckDuckGo)
The site is already verified (`msvalidate.01`). Submit the same sitemap at https://www.bing.com/webmasters.

## 4. Brand signals Google uses for the knowledge panel and "related searches"
- Make sure these pages exist, are named **BulkSkart** and link to https://www.bulkskart.com:
  linkedin.com/company/bulkskart, twitter.com/bulkskart, facebook.com/bulkskart, instagram.com/bulkskart,
  youtube.com/@bulkskart. If one does not exist, create it or tell the developer to remove it from `index.html`.
- **Google Business Profile** for BulkSkart with the same name, website and phone.
- Get listed and linked: industry associations, chambers of commerce, startup directories, news/press releases,
  supplier testimonials on their own websites. Each real link from a trusted site helps more than any code change.
- Ask buyers and manufacturers to search **"BulkSkart"** by name; brand searches are what create "related searches" and
  "People also ask" entries about BulkSkart over time.

No one can promise a #1 position; these are the steps that move it.
