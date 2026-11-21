"""Re-open every collected source URL and confirm it against the live page; resumable (scratch tool).
Usage: python3 verify_bulk.py <collected.json> <verified.json>"""
import json, os, sys
import collect_tradeindia as c

src, out = sys.argv[1], sys.argv[2]
picked = json.load(open(src))['picked']
state = json.load(open(out)) if os.path.exists(out) else {'verified': [], 'rejected': [], 'duplicates': []}
done = {r['source_url'] for k in ('verified', 'rejected', 'duplicates') for r in state[k]}
for i, r in enumerate(picked):
    if r['source_url'] in done: continue
    page, status = c.fetch(r['source_url'])
    if not page:
        state['rejected'].append({**r, 'reason': f'source not accessible ({status})'})
    else:
        again, why = c.parse_lead(page, r['source_url'])
        if not again:
            state['rejected'].append({**r, 'reason': f'could not re-read page: {why}'})
        else:
            bad = [k for k, a, b in (('product', again['product'], r['product']), ('quantity', (again['quantity'], again['unit']), (r['quantity'], r['unit'])),
                                     ('location', again['location'], r['location']), ('posted', again['posted'], r['posted'])) if a != b]
            if bad: state['rejected'].append({**r, 'reason': 'changed on source: ' + ', '.join(bad)})
            else: state['verified'].append({**r, 'http_status': status, 'verified_at': c.datetime.now(c.timezone.utc).isoformat(timespec='seconds')})
    if i % 10 == 0 or i == len(picked) - 1:
        json.dump(state, open(out, 'w'), indent=1, ensure_ascii=False)
        print(f"{i + 1}/{len(picked)} verified {len(state['verified'])} rejected {len(state['rejected'])}", flush=True)
json.dump(state, open(out, 'w'), indent=1, ensure_ascii=False)
print('finished', len(state['verified']), len(state['rejected']))
