"""Write verified public requirements as one data migration, a CSV backup and a report (scratch tool).

Usage: python3 export_batch.py <migration.sql> <backup.csv> <report.json> <today YYYY-MM-DD> <verified.json> [more verified.json ...]
A requirement is shown for 30 days after it was posted; listings already past that are left out (reported as expired).
"""
import csv, json, re, sys
from datetime import date, timedelta

mig_path, csv_path, report_path, today = sys.argv[1:5]
today = date.fromisoformat(today)
MONTHS = {m: i for i, m in enumerate(['January','February','March','April','May','June','July','August','September','October','November','December'], 1)}

def posted_date(s):
    m = re.match(r'^(\d{1,2}) (\w+) (\d{4})$', s or '')
    return date(int(m.group(3)), MONTHS[m.group(2)], int(m.group(1))) if m and m.group(2) in MONTHS else None

def q(v):
    return 'NULL' if v is None or v == '' else "'" + str(v).replace("'", "''") + "'"

def whole(n):
    try:
        f = float(n)
        return str(int(f)) if f.is_integer() and 0 < f < 2_000_000_000 else None
    except (TypeError, ValueError):
        return None

verified, rejected, dups = [], [], []
for path in sys.argv[5:]:
    d = json.load(open(path))
    verified += d['verified']; rejected += d['rejected']; dups += d['duplicates']

rows, csv_rows, expired, seen = [], [], [], set()
for r in verified:
    key = r['source_url']
    if key in seen:
        dups.append({**r, 'reason': 'same source URL twice'}); continue
    seen.add(key)
    posted = posted_date(r['posted'])
    if not posted:
        rejected.append({**r, 'reason': 'posting date unreadable'}); continue
    expires = posted + timedelta(days=30)
    if expires <= today:
        expired.append({**r, 'reason': f'expired {expires.isoformat()} (posted {posted.isoformat()})'}); continue
    specs = '\n'.join(r['details']) if r['details'] else None
    want = r.get('want_to_buy')
    description = f"Buyer wants to buy: {want}." if want else None
    rows.append('(' + ', '.join([
        q(r['product']), q(description), q(specs), whole(r['quantity']) or 'NULL', q(r['unit']), q(r['location']), "'India'",
        q(r['source_subcategory']), q(f'{posted.isoformat()}T00:00:00+05:30'), q(f'{expires.isoformat()}T23:59:59+05:30'),
        "'TradeIndia'", q(r['source_url']), q(r['source_id']), q(r['source_category']), q(r['source_subcategory']), q(posted.isoformat()),
        q(r['fetched_at']), q(r['verified_at']), str(r.get('http_status') or 'NULL'),
    ]) + ')')
    csv_rows.append({
        'product_name': r['product'], 'product_description': description or '', 'specifications': specs or '',
        'bulkskart_category': 'Industrial & Engineering Products, Spares and Supplies', 'subcategory': r['source_subcategory'],
        'required_quantity': r['quantity'], 'unit': r['unit'] or '', 'delivery_location': r['location'] or '', 'country': 'India',
        'expected_budget': '', 'requirement_date': posted.isoformat(), 'hidden_after': expires.isoformat(),
        'source_website': 'TradeIndia', 'original_source_url': r['source_url'], 'source_listing_id': r['source_id'],
        'collected_at': r['fetched_at'], 'verified_at': r['verified_at'], 'verified_http_status': r.get('http_status', ''),
    })

sql = f"""-- Public Requirements import: {len(rows)} buyer requirements from publicly accessible pages, each read from its page
-- and checked again against the live page before export (product, quantity, unit, location, posting date).
-- Nothing is added that the page does not show: no buyer names or contacts, no budgets, no deadlines.
-- Listings older than 30 days are left out; each row is hidden 30 days after it was posted (expires_at).
-- Rows are imported as 'pending': nothing is shown to customers until an admin approves it. Supplier matching does not run for them.
-- Needs 00068_public_listing_rfqs.sql. Re-running is safe: a listing already imported (same source URL) is skipped.

WITH src (title, description, specifications, quantity, quantity_unit, destination_city, destination_country, listing_category,
          created_at, expires_at, source_name, source_url, source_listing_id, source_category, source_subcategory, source_posted_on,
          collected_at, verified_at, verified_http_status) AS (
  VALUES
  """ + ',\n  '.join(rows) + """
),
fresh AS MATERIALIZED (
  SELECT uuid_generate_v4() AS id, s.* FROM src s
  WHERE NOT EXISTS (SELECT 1 FROM public_listing_sources p WHERE p.source_url = s.source_url)
),
req AS (
  INSERT INTO requirements (id, source_type, review_status, title, description, specifications, quantity, quantity_unit,
                            destination_city, destination_country, listing_category, category_id, currency, status,
                            is_verified_buyer, created_at, expires_at)
  SELECT id, 'public_listing', 'pending', title, description, specifications, quantity::integer, quantity_unit,
         destination_city, destination_country, listing_category,
         (SELECT id FROM categories WHERE slug = 'machinery-industrial' LIMIT 1), 'INR', 'active', false,
         created_at::timestamptz, expires_at::timestamptz
  FROM fresh
  RETURNING id
)
INSERT INTO public_listing_sources (requirement_id, source_name, source_url, source_listing_id, source_category, source_subcategory,
                                    source_posted_on, collected_at, verified_at, verified_http_status)
SELECT f.id, f.source_name, f.source_url, f.source_listing_id, f.source_category, f.source_subcategory,
       f.source_posted_on::date, f.collected_at::timestamptz, f.verified_at::timestamptz, f.verified_http_status::integer
FROM fresh f JOIN req ON req.id = f.id;
"""
open(mig_path, 'w').write(sql)
with open(csv_path, 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(csv_rows[0].keys())); w.writeheader(); w.writerows(csv_rows)
json.dump({'imported': len(rows), 'expired': expired, 'rejected': rejected, 'duplicates': dups}, open(report_path, 'w'), indent=1, ensure_ascii=False)
print('rows', len(rows), 'expired', len(expired), 'rejected', len(rejected), 'duplicates', len(dups))
