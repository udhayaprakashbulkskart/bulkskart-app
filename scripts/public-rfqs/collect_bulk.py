"""Collect up to N public buyer requirements across every TradeIndia Industrial Supplies subcategory (scratch tool).
Same rules as collect_tradeindia.py: robots.txt checked per request, public pages only, 3 s between requests,
fields only as shown on the page. Results are written after every subcategory so a stop keeps what was found."""
import json, re, sys
from datetime import datetime, timezone
import collect_tradeindia as c

out_path, target, per_sub = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
done = json.load(open('batch_test.json'))['picked']          # the 10 test records are not collected again
seen_ids = {r['source_id'] for r in done}
seen_keys = {(r['product'].lower(), (r['location'] or '').lower()) for r in done}

page, _ = c.fetch(c.BASE + '/TradeLeads/buy/Industrial-Supplies/')
subs = sorted(set(re.findall(r'href="/TradeLeads/buy/Industrial-Supplies/([A-Za-z0-9-]+)/"', page or '')))
import os
state = {'subcategories': len(subs), 'picked': [], 'rejected': [], 'duplicates': 0, 'done_subs': []}
if os.path.exists(out_path):  # resume: keep what was found and skip finished subcategories
    prev = json.load(open(out_path))
    state.update({k: prev[k] for k in ('picked', 'rejected', 'duplicates', 'done_subs') if k in prev})
    for r in state['picked']:
        seen_ids.add(r['source_id']); seen_keys.add((r['product'].lower(), (r['location'] or '').lower()))
for slug in subs:
    if slug in state['done_subs']: continue
    if len(state['picked']) >= target: break
    taken = 0
    for lid, url in c.subcategory_leads(slug)[:per_sub * 2]:
        if taken >= per_sub or len(state['picked']) >= target: break
        if str(lid) in seen_ids: state['duplicates'] += 1; continue
        body, status = c.fetch(url)
        if not body: state['rejected'].append({'source_url': url, 'reason': f'not fetched ({status})'}); continue
        rec, why = c.parse_lead(body, url)
        if not rec: state['rejected'].append({'source_url': url, 'reason': why}); continue
        if not rec['quantity']: state['rejected'].append({'source_url': url, 'reason': 'no quantity on page'}); continue
        if not rec['location']: state['rejected'].append({'source_url': url, 'reason': 'no delivery location on page'}); continue
        key = (rec['product'].lower(), rec['location'].lower())
        if key in seen_keys: state['duplicates'] += 1; continue
        seen_ids.add(rec['source_id']); seen_keys.add(key)
        rec['fetched_at'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
        state['picked'].append(rec); taken += 1
    state['done_subs'].append(slug)
    state['log'] = c.LOG
    json.dump(state, open(out_path, 'w'), indent=1, ensure_ascii=False)
    print(f"{len(state['done_subs'])}/{len(subs)} {slug}: total {len(state['picked'])}", flush=True)
print('finished', len(state['picked']))
