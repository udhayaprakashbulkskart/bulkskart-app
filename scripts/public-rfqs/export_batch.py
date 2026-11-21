"""Write the verified public RFQs as a data migration, a CSV backup and a verification report (scratch tool)."""
import csv, json, re, sys
from datetime import datetime

src, mig_path, csv_path, report_path, batch = sys.argv[1:6]
d = json.load(open(src))
MONTHS = {m: i for i, m in enumerate(['January','February','March','April','May','June','July','August','September','October','November','December'], 1)}

def posted_date(s):
    m = re.match(r'^(\d{1,2}) (\w+) (\d{4})$', s or '')
    return f'{m.group(3)}-{MONTHS[m.group(2)]:02d}-{int(m.group(1)):02d}' if m and m.group(2) in MONTHS else None

def q(v):
    return 'NULL' if v is None or v == '' else "'" + str(v).replace("'", "''") + "'"

def whole(n):
    try:
        f = float(n)
        return str(int(f)) if f.is_integer() else None
    except (TypeError, ValueError):
        return None

rows, csv_rows = [], []
for r in d['verified']:
    posted = posted_date(r['posted'])
    specs = '\n'.join(r['details']) if r['details'] else None
    want = r.get('want_to_buy')
    description = f"Buyer wants to buy: {want}." if want else None
    qty = whole(r['quantity'])
    city = r['location']
    rows.append('(' + ', '.join([
        "'public_listing'", "'TradeIndia'", q(r['source_url']), q(r['source_id']), q(r['source_category']), q(r['source_subcategory']),
        q(posted), q(r['verified_at']),
        "(SELECT id FROM categories WHERE slug = 'machinery-industrial' LIMIT 1)",
        q(r['product']), q(description), q(specs), qty or 'NULL', q(r['unit']), q(city), "'India'",
        'NULL', 'NULL', "'INR'", "'active'", 'false', (f"'{posted}T00:00:00+05:30'" if posted else 'now()'),
    ]) + ')')
    csv_rows.append({
        'product_name': r['product'], 'product_description': description or '', 'specifications': specs or '',
        'bulkskart_category': 'Industrial & Engineering Products, Spares and Supplies',
        'source_category': r['source_category'], 'subcategory': r['source_subcategory'],
        'required_quantity': r['quantity'], 'unit': r['unit'] or '', 'delivery_location': city or '', 'country': 'India',
        'expected_budget': '', 'requirement_date': posted or '', 'source_website': 'TradeIndia',
        'original_source_url': r['source_url'], 'source_listing_id': r['source_id'],
        'collected_at': r['fetched_at'], 'verified_at': r['verified_at'], 'verified_http_status': r['http_status'],
    })

cols = ('source_type, source_name, source_url, source_listing_id, source_category, source_subcategory, source_posted_on, source_verified_at, '
        'category_id, title, description, specifications, quantity, quantity_unit, destination_city, destination_country, '
        'budget_min, budget_max, currency, status, is_verified_buyer, created_at')
sql = f"""-- Public RFQ listings, {batch}: {len(rows)} buyer requirements read from public TradeIndia buy-lead pages.
-- Each row was read from its source page and checked again against the live page before export
-- (product, quantity, unit, location and posting date). Nothing is added that the page does not show:
-- no buyer names or contacts, no budgets (not shown on the pages), no deadlines.
-- Needs 00068_public_listing_rfqs.sql. Re-running is safe: a listing already imported is skipped.

INSERT INTO requirements ({cols})
VALUES
  """ + ',\n  '.join(rows) + """
ON CONFLICT (source_url) WHERE source_url IS NOT NULL DO NOTHING;
"""
open(mig_path, 'w').write(sql)
with open(csv_path, 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(csv_rows[0].keys())); w.writeheader(); w.writerows(csv_rows)
json.dump({'verified': len(d['verified']), 'rejected': d['rejected'], 'duplicates': d['duplicates']}, open(report_path, 'w'), indent=1)
print('rows', len(rows))
