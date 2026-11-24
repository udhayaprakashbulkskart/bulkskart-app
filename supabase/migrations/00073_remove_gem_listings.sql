-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 00073: remove everything copied from the GeM portal (Government e-Marketplace)
--
-- What goes (counted in production on 24 Nov 2026):
--   * 347 GeM auctions. They have source keys such as external_listing / source_url / source_auction_id, or a
--     gem.gov.in link, and no BulkSkart seller. All were "live" with 0 bids.
--   * 1,000 GeM requirements, all from the placeholder buyer account
--     "GeM Public Procurement (government buyers)" (5e8d0a1c-0000-4000-8000-67656d666565), with 0 quotations.
--   * That placeholder account itself, once nothing refers to it.
--   * Notifications that point to any of these rows, and any pg_cron job that imports from GeM.
--
-- What stays:
--   * Auctions listed by a BulkSkart seller (anything with a seller_id or seller_company_id is never touched).
--   * Requirements posted by any other buyer.
--   * Conversations and orders that mention one of these requirements. Only their link to it is cleared.
--
-- One transaction. If anything unexpected refers to a GeM row, it stops and changes nothing, naming the table.
-- Safe to run again: a second run finds nothing to remove.
-- The website (branch remove-gem) already hides GeM rows, so the order of deploy and migration does not matter.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- 1. The rows to remove ────────────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE gem_auction_ids ON COMMIT DROP AS
SELECT a.id, a.auction_number
FROM public.auctions a
WHERE a.seller_id IS NULL
  AND a.seller_company_id IS NULL
  AND (
        coalesce(a.specifications, '{}'::jsonb) ?| ARRAY['external_listing', 'source_url', 'source_auction_id', 'seller_org', 'reference_no']
     OR coalesce(a.specifications, '{}'::jsonb)::text ~* 'gem\.gov\.in'
     OR coalesce(a.description, '') ~* 'gem\.gov\.in'
     OR coalesce(a.description, '') ~ '\mGeM\M'          -- the portal's own spelling; "gem stones" do not match
  );

CREATE TEMP TABLE gem_requirement_ids ON COMMIT DROP AS
SELECT r.id
FROM public.requirements r
WHERE r.buyer_id = '5e8d0a1c-0000-4000-8000-67656d666565'
   OR coalesce(r.description, '') LIKE 'Government buyer requirement published on GeM%';

DO $$
DECLARE a_count int; r_count int; other int;
BEGIN
  SELECT count(*) INTO a_count FROM gem_auction_ids;
  SELECT count(*) INTO r_count FROM gem_requirement_ids;
  RAISE NOTICE 'GeM rows found: % auctions, % requirements', a_count, r_count;
  -- anything else that still names GeM is reported, not removed, so a real buyer's requirement is never lost
  SELECT count(*) INTO other FROM public.requirements r
   WHERE r.id NOT IN (SELECT id FROM gem_requirement_ids)
     AND (coalesce(r.description, '') ~ '\mGeM\M' OR coalesce(r.specifications, '') ~* 'gem\.gov\.in');
  IF other > 0 THEN RAISE NOTICE 'Kept % other requirement(s) that mention GeM (posted by real buyers; the site hides them)', other; END IF;
END $$;

-- 2. Clear or remove what refers to these rows ─────────────────────────────────────────────────────────────
-- Tables whose foreign key cascades (quotations, rfq_matches, auto_quotations, rfq_match_log,
-- public_listing_sources, auction_bids, auction_chats) are emptied by the deletes below. For every other
-- reference, found from the database's own catalogue so tables added outside the migrations are covered too:
--   * a nullable column is set to NULL (the conversation or order stays);
--   * a NOT NULL column in rfq_lead_views loses that row (a supplier's view of a GeM lead);
--   * anything else stops the migration and names the table, so a person can look first.
DO $$
DECLARE
  fk record; n bigint; ids_table text;
BEGIN
  FOR fk IN
    SELECT con.conrelid::regclass AS tbl, att.attname AS col, att.attnotnull AS notnull,
           con.confrelid::regclass::text AS target
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid IN ('public.requirements'::regclass, 'public.auctions'::regclass)
      AND con.confdeltype IN ('a', 'r')          -- no action / restrict
      AND array_length(con.conkey, 1) = 1
  LOOP
    ids_table := CASE WHEN fk.target = 'requirements' OR fk.target = 'public.requirements' THEN 'gem_requirement_ids' ELSE 'gem_auction_ids' END;
    EXECUTE format('SELECT count(*) FROM %s WHERE %I IN (SELECT id FROM %I)', fk.tbl, fk.col, ids_table) INTO n;
    CONTINUE WHEN n = 0;
    IF NOT fk.notnull THEN
      EXECUTE format('UPDATE %s SET %I = NULL WHERE %I IN (SELECT id FROM %I)', fk.tbl, fk.col, fk.col, ids_table);
      RAISE NOTICE 'Cleared the GeM link on % row(s) of %.%', n, fk.tbl, fk.col;
    ELSIF fk.tbl::text IN ('rfq_lead_views', 'public.rfq_lead_views') THEN
      EXECUTE format('DELETE FROM %s WHERE %I IN (SELECT id FROM %I)', fk.tbl, fk.col, ids_table);
      RAISE NOTICE 'Removed % GeM lead view(s) from %', n, fk.tbl;
    ELSE
      RAISE EXCEPTION 'Stopped: % row(s) in %.% refer to GeM rows. Nothing was changed. Look at them first.', n, fk.tbl, fk.col;
    END IF;
  END LOOP;
END $$;

-- notifications that would open a removed row
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'reference_id') THEN
    DELETE FROM public.notifications
     WHERE reference_id::text IN (SELECT id::text FROM gem_requirement_ids UNION ALL SELECT id::text FROM gem_auction_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE 'Removed % notification(s) about GeM rows', n; END IF;
  END IF;
  -- links carry the row's id (/requirements/<id>, ...?req=<id>, /auctions/<id>) or an auction number
  DELETE FROM public.notifications nt
   WHERE (nt.link ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
          AND lower(substring(nt.link from '(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'))::uuid
              IN (SELECT id FROM gem_requirement_ids UNION ALL SELECT id FROM gem_auction_ids))
      OR nt.link IN (SELECT '/auctions/' || auction_number FROM gem_auction_ids WHERE auction_number IS NOT NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN RAISE NOTICE 'Removed % notification(s) linking to GeM rows', n; END IF;
END $$;

-- 3. Remove the GeM rows ───────────────────────────────────────────────────────────────────────────────────
DELETE FROM public.requirements WHERE id IN (SELECT id FROM gem_requirement_ids);
DELETE FROM public.auctions WHERE id IN (SELECT id FROM gem_auction_ids);

-- 4. Remove the placeholder GeM buyer account, when nothing refers to it any more ───────────────────────────
DO $$
DECLARE gem_buyer constant uuid := '5e8d0a1c-0000-4000-8000-67656d666565';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = gem_buyer) THEN RETURN; END IF;
  BEGIN
    IF to_regclass('auth.users') IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users WHERE id = gem_buyer) THEN
      DELETE FROM auth.users WHERE id = gem_buyer;          -- cascades to its profile
    ELSE
      DELETE FROM public.profiles WHERE id = gem_buyer;
    END IF;
    RAISE NOTICE 'Removed the placeholder account "GeM Public Procurement (government buyers)"';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'Kept the placeholder GeM account: other rows still refer to it (%)', SQLERRM;
  END;
END $$;

-- 5. Stop any scheduled GeM import ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE j record;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;
  FOR j IN EXECUTE $q$SELECT jobid, jobname FROM cron.job
                     WHERE command ~* '(gem\.gov\.in|bidplus|\mgem[_-]?(import|sync|auction|tender|bid))'
                        OR coalesce(jobname, '') ~* '\mgem([_-]|\M)'$q$
  LOOP
    PERFORM cron.unschedule(j.jobid);
    RAISE NOTICE 'Unscheduled cron job % (%)', j.jobid, j.jobname;
  END LOOP;
END $$;

-- 6. Check ─────────────────────────────────────────────────────────────────────────────────────────────────
SELECT 'GeM removed' AS result,
       (SELECT count(*) FROM public.auctions a
         WHERE coalesce(a.specifications, '{}'::jsonb) ? 'external_listing'
            OR coalesce(a.specifications, '{}'::jsonb)::text ~* 'gem\.gov\.in') AS gem_auctions_left,       -- 0
       (SELECT count(*) FROM public.requirements r
         WHERE r.buyer_id = '5e8d0a1c-0000-4000-8000-67656d666565'
            OR coalesce(r.description, '') LIKE 'Government buyer requirement published on GeM%') AS gem_requirements_left,   -- 0
       (SELECT count(*) FROM public.auctions) AS auctions_kept,
       (SELECT count(*) FROM public.profiles WHERE id = '5e8d0a1c-0000-4000-8000-67656d666565') AS gem_account_left;  -- 0

COMMIT;
