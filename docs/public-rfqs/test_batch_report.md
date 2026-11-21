# Public RFQ import: test batch (21 Nov 2026)

Imported as **public listings** (`requirements.source_type = public_listing`), kept apart from BulkSkart buyer RFQs.

## Result

- Verified and ready to import: **10**
- Rejected while collecting: **7**
- Rejected at verification: **0**
- Duplicates: **0**
- URLs skipped because robots.txt disallows them: **0**

## Sources

| Source | Used | Why |
|---|---|---|
| TradeIndia (`/TradeLeads/buy/`, `/buyoffer/`) | Yes, 10 | Buy-lead pages are public, allowed by robots.txt; terms have no anti-scraping clause. Only facts are copied, with a link back; buyer names and contacts are not. |
| IndiaMART | No | robots.txt on www, dir, m and trade.indiamart.com blocks `ClaudeBot` (`Disallow: /`); buy-lead search and detail paths are also disallowed. |
| Alibaba RFQ | No | robots.txt disallows `/buyingrequest/` (sourcing.alibaba.com) and `/buyeroffers/`, `/buyofferdetail/`, `/buyers/` (www.alibaba.com). |
| ExportersIndia | No | robots.txt disallows `/trade/buyingleads-india/`. |
| Google Search | No | Results for buyer requirements point back to the portals above; Google results are not scraped. |
| Government tender portals | No | Excluded by request. |

## Category-wise count (BulkSkart: Industrial & Engineering Products, Spares and Supplies)

| TradeIndia subcategory | RFQs |
|---|---|
| Abrasives | 1 |
| Air Compressors & Air Separation Plants | 1 |
| Aluminum Castings | 1 |
| Ball Valves | 1 |
| Bearings | 1 |
| Belt Pulleys | 1 |
| Bolts | 1 |
| CNC Machined Components | 1 |
| Castor Wheels | 1 |
| Centrifugal Pumps | 1 |

## Source-wise count

| Source | RFQs |
|---|---|
| TradeIndia | 10 |

## Rejected while collecting

| Reason | Original URL |
|---|---|
| no quantity on page | https://www.tradeindia.com/buyoffer/18689803/Abhi-is-looking-for-suppliers-of-air-compressor-.html |
| no quantity on page | https://www.tradeindia.com/buyoffer/18684919/Sathya-Purchase-Store-is-looking-for-suppliers-of-air-compressor-.html |
| no quantity on page | https://www.tradeindia.com/buyoffer/18681881/ADC-Private-Limited-is-looking-for-suppliers-of-air-compressor-.html |
| no quantity on page | https://www.tradeindia.com/buyoffer/18682909/Shahrukh-Khan-Is-Looking-For-Suppliers-Of-Air-Blower-Aluminium-Casting-.html |
| no quantity on page | https://www.tradeindia.com/buyoffer/18660374/Naresh-is-looking-for-suppliers-of-aluminum-extrusion-.html |
| no quantity on page | https://www.tradeindia.com/buyoffer/18622383/Bhavesh-is-looking-for-suppliers-of-Aluminum-Extrusion-.html |
| no quantity on page | https://www.tradeindia.com/buyoffer/18689575/Hemant-is-looking-for-suppliers-of-steel-caster-.html |

## How each record was checked

1. Read from the public lead page (no login; robots.txt checked before each request; one request every 3 seconds).
2. Opened again before export: HTTP 200, and product, quantity, unit, location and posting date still match the page.
3. Fields the page does not show (budget, deadline) are left empty. Buyer names and contacts are never stored.

Files: `test_batch_2026-11-21.csv` (backup), `supabase/migrations/00069_public_listing_rfqs_test_batch.sql` (import), `scripts/public-rfqs/` (collector, verifier, exporter).
