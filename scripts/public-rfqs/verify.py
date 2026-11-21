"""Re-open each collected source URL and confirm the record against the live page (scratch tool)."""
import json, re, sys, csv
sys.path.insert(0, '.')
import collect_tradeindia as c

d = json.load(open(sys.argv[1]))
verified, rejected, dups, seen = [], [], [], set()
for r in d['picked']:
    key = (r['product'].lower(), (r['location'] or '').lower())
    if r['source_id'] in seen or key in seen:
        dups.append({**r, 'reason': 'duplicate of another collected lead'}); continue
    page, status = c.fetch(r['source_url'])
    if not page:
        rejected.append({**r, 'reason': f'source not accessible ({status})'}); continue
    again, why = c.parse_lead(page, r['source_url'])
    if not again:
        rejected.append({**r, 'reason': f'could not re-read page: {why}'}); continue
    checks = {
        'product': again['product'] == r['product'],
        'quantity': again['quantity'] == r['quantity'] and again['unit'] == r['unit'],
        'location': again['location'] == r['location'],
        'posted': again['posted'] == r['posted'],
    }
    if not all(checks.values()):
        rejected.append({**r, 'reason': 'changed on source: ' + ', '.join(k for k, ok in checks.items() if not ok)}); continue
    seen.add(r['source_id']); seen.add(key)
    verified.append({**r, 'http_status': status, 'verified_at': c.datetime.now(c.timezone.utc).isoformat(timespec='seconds')})
json.dump({'verified': verified, 'rejected': rejected, 'duplicates': dups}, open(sys.argv[2], 'w'), indent=1, ensure_ascii=False)
print('verified', len(verified), 'rejected', len(rejected), 'duplicates', len(dups))
