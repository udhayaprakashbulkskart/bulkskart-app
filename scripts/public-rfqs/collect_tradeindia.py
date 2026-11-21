"""Collect public buyer requirements from TradeIndia's buy-lead pages (scratch tool).

Rules followed:
- robots.txt is checked before every request (urllib.robotparser); disallowed URLs are skipped and logged.
- Only public pages are read: no login, no form posts, no CAPTCHA handling, no hidden contact details.
- One request every 3 seconds.
- Every field is read from the lead page itself; a field the page does not show stays empty (None).
- Buyer names are never stored (TradeIndia shows the buyer's first name in the page title; we keep only the URL).

Usage: python3 collect_tradeindia.py <out.json> <max_leads> [subcategory-slug ...]
"""
import html, json, re, sys, time, urllib.request, urllib.robotparser
from datetime import datetime, timezone

BASE = 'https://www.tradeindia.com'
UA = 'BulkSkartRFQImporter/1.0 (+https://www.bulkskart.com)'
DELAY = 3.0
LOG = []

rp = urllib.robotparser.RobotFileParser(BASE + '/robots.txt')
rp.read()
_last = [0.0]

def fetch(url):
    if not rp.can_fetch(UA, url):
        LOG.append({'url': url, 'skipped': 'disallowed by robots.txt'})
        return None, 'robots'
    wait = DELAY - (time.time() - _last[0])
    if wait > 0: time.sleep(wait)
    _last[0] = time.time()
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html'})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            body = r.read().decode('utf-8', 'ignore')
            final = r.geturl()
            if re.search(r'g-recaptcha|hcaptcha|cf-challenge|captcha-container', body, re.I):
                LOG.append({'url': url, 'skipped': 'captcha / challenge page'})
                return None, 'captcha'
            if re.search(r'/login|/registration', final):
                LOG.append({'url': url, 'skipped': 'redirected to login'})
                return None, 'login'
            return body, r.status
    except Exception as e:  # network or HTTP error
        LOG.append({'url': url, 'error': str(e)[:200]})
        return None, str(e)[:80]

def text_lines(page):
    page = re.sub(r'<script.*?</script>|<style.*?</style>', '', page, flags=re.S)
    txt = html.unescape(re.sub(r'<[^>]+>', '\n', page))
    return [re.sub(r'\s+', ' ', l).strip() for l in txt.split('\n') if l.strip()]

def parse_lead(page, url):
    """Read the main lead block (not the 'Recommended' leads under it)."""
    L = text_lines(page)
    # breadcrumb 'Buy Trade Leads' > category > subcategory, then the main heading '... is looking for ...'
    j = next((k + 3 for k, l in enumerate(L[:-3]) if l == 'Buy Trade Leads' and re.search(r'looking for', L[k + 3], re.I)), None)
    if j is None:
        return None, 'lead block not found'
    cat, sub = L[j - 2], L[j - 1]
    heading = L[j]
    end = L.index('Recommended Buy Trade Leads') if 'Recommended Buy Trade Leads' in L else len(L)
    block = L[j:end]
    rec = {'source_category': cat, 'source_subcategory': sub, 'location': None, 'posted': None,
           'quantity': None, 'unit': None, 'want_to_buy': None, 'product': None, 'details': []}
    for k, line in enumerate(block):
        nxt = block[k + 1] if k + 1 < len(block) else ''
        nxt2 = block[k + 2] if k + 2 < len(block) else ''
        if line.startswith('Date posted'):
            rec['posted'] = nxt if nxt != ':' else nxt2
            # the line before 'Date posted' is the location when present
            prev = block[k - 1] if k > 0 else ''
            if prev and not prev.lower().startswith('buyer is looking') and ',' in prev:
                rec['location'] = prev
        elif line == 'Quantity Required' and nxt == ':' and rec['quantity'] is None:
            m = re.match(r'^([\d,.]+)\s*(.*)$', nxt2)
            if m:
                rec['quantity'], rec['unit'] = m.group(1).replace(',', ''), (m.group(2) or None)
        elif line == 'Want to Buy' and nxt == ':':
            rec['want_to_buy'] = nxt2
        elif line.startswith("Buyer is looking for '"):
            m = re.match(r"^Buyer is looking for '(.+)'$", line)
            if m: rec['product'] = m.group(1).strip()
        elif line == 'Product Details:':
            for d in block[k + 1:]:
                if d.startswith('Contact buyer') or d.startswith('Contact Buyer'): break
                if ':' in d and len(d) < 160: rec['details'].append(d)
    if not rec['product']:
        m = re.search(r'looking for (?:suppliers of )?(.+)$', heading, re.I)
        if m: rec['product'] = m.group(1).strip(" '")
    if not rec['product']:
        return None, 'product name not on page'
    lead_id = re.search(r'/buyoffer/(\d+)/', url)
    rec['source_id'] = lead_id.group(1) if lead_id else None
    rec['source_url'] = url
    return rec, None

def subcategory_leads(slug):
    url = f'{BASE}/TradeLeads/buy/Industrial-Supplies/{slug}/'
    page, status = fetch(url)
    if not page: return []
    ids = re.findall(r'href="(/buyoffer/(\d+)/[^"]+\.html)"', page)
    seen, out = set(), []
    for path, lid in ids:
        if lid in seen: continue
        seen.add(lid); out.append((int(lid), BASE + path))
    return sorted(out, reverse=True)  # newest first

if __name__ == '__main__':
    out_path, max_leads = sys.argv[1], int(sys.argv[2])
    subs = sys.argv[3:]
    picked, rejected = [], []
    for slug in subs:
        if len(picked) >= max_leads: break
        cands = subcategory_leads(slug)[:6]
        fallback = None
        for lid, url in cands:
            page, status = fetch(url)
            if not page:
                rejected.append({'source_url': url, 'reason': f'not fetched ({status})'}); continue
            rec, why = parse_lead(page, url)
            if not rec:
                rejected.append({'source_url': url, 'reason': why}); continue
            if not rec['quantity']:
                rejected.append({'source_url': url, 'reason': 'no quantity on page'}); continue
            if not rec['location']:
                rejected.append({'source_url': url, 'reason': 'no delivery location on page'}); continue
            rec['fetched_at'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
            try: qty = float(rec['quantity'])
            except ValueError: qty = 0
            if qty < 2 and fallback is None:
                fallback = rec; continue   # keep looking for a bulk quantity in this subcategory
            picked.append(rec); fallback = None
            break  # one lead per subcategory for a varied test
        if fallback is not None and len(picked) < max_leads:
            picked.append(fallback)
    json.dump({'picked': picked, 'rejected': rejected, 'log': LOG}, open(out_path, 'w'), indent=1, ensure_ascii=False)
    print('picked', len(picked), 'rejected', len(rejected), 'skipped/errors', len(LOG))
