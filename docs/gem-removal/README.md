# GeM removed (24 Nov 2026)

BulkSkart no longer shows anything from the GeM portal (Government e-Marketplace). Visitors see no GeM name, no
"Public auction" or "Government tender" badges, and no link or redirect to gem.gov.in.

## Website (branch `remove-gem`)

- **Removed:**
  - the GeM listing helpers (`src/lib/externalListing.ts`) and the outside-link button (`ExternalSourceLink`);
  - "View on GeM", "View bid on GeM", the public-auction and government-tender badges, and the
    "no phone for this tender" notes;
  - the pages affected are the auctions hub, the home auction rail, the auction detail page, the requirements list and
    detail, the requirement drawer, and the supplier RFQ leads page.
- **Guards, so a GeM row never shows even before the migration runs:**
  - Auctions with importer keys (`external_listing`, `source_url`, …) or a gem.gov.in link, and no BulkSkart seller,
    are left out in the query itself (`withoutImportedAuctions`). Their detail page opens as not found.
  - Requirements whose description starts "Government buyer requirement published on GeM", or that carry a
    gem.gov.in link, are left out of every list (`withoutTenderImports`). Their detail page opens as not found.
  - A real seller's or buyer's text that merely mentions GeM, or "gem stones", is not affected.

## Database (`supabase/migrations/00073_remove_gem_listings.sql`)

Run it once in the Supabase SQL editor. In production on 24 Nov 2026 it removes:
- 347 GeM auctions;
- 1,000 GeM requirements;
- the placeholder account "GeM Public Procurement (government buyers)";
- notifications pointing at those rows;
- any pg_cron GeM import job.

Conversations and orders that mention a GeM requirement are kept, with the link cleared.

It is one transaction:
- It stops without changing anything if an unknown table refers to a GeM row.
- Running it again changes nothing.

## Tests

```bash
cd docs/gem-removal
npm i --no-save --no-package-lock @electric-sql/pglite@0.2.17   # node_modules is git-ignored
node remove_gem_check.mjs        # 15 checks
```

Unit tests: `src/__tests__/auctionListing.test.ts` and `src/__tests__/rfqAndSuppliersDesign.test.ts`.
