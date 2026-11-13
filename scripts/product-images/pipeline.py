#!/usr/bin/env python3
"""
Product image replacement pipeline: 10 products per batch.

Steps for each batch (see README.md in this folder):
  search  - read 10 products, search a permitted image API, download and validate the best
            licensed match into staging/batch-NNNN/ and write manifest.json. Nothing is written
            to the database or storage.
  review  - record a human decision for each product (approve or reject the selected image).
  apply   - upload approved images to Supabase storage, point the product at the new image,
            record source and licence in product_image_sources, and verify everything loads.
            Rejected or unmatched products are marked NEEDS REVIEW and keep their current image.
  report  - print the batch completion report.

Only products.images is ever changed. Names, descriptions, prices and IDs are never touched.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
STAGING = HERE / "staging"
BATCH_SIZE = 10
USER_AGENT = "BulkskartImagePipeline/1.0 (+https://www.bulkskart.com)"
BUCKET = "product-images"
STORAGE_PREFIX = "catalog"
MIN_LONG_SIDE = 600          # reject images smaller than this on their longest side
MAX_LONG_SIDE = 1600         # downscale larger images to this
MAX_BYTES = 10 * 1024 * 1024 # bucket limit
MIN_SCORE = 0.6              # share of product-name keywords that must appear in the image title/tags
# Licences that allow commercial use AND modification (resizing/re-encoding).
ALLOWED_LICENSES = {"cc0", "pdm", "by", "by-sa"}
# Openverse's mature filter misses some explicit images; drop anything whose title or tags use these words.
BLOCKED_TERMS = re.compile(
    r"\b(nude|nudity|naked|sex|sexy|porn\w*|erotic\w*|nsfw|xxx|milf|fetish|bdsm|bondage|genital\w*|penis|"
    r"vagina|cock|dick|boob\w*|breasts?|nipples?|topless|lingerie|underwear\s+model|cumshot|orgasm|"
    r"escort|stripper|strip\s*club|playboy|hentai)\b", re.I)


# --------------------------------------------------------------------------- config

def load_env() -> None:
    env_file = HERE / ".env"
    if env_file.exists():
        for raw in env_file.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def cfg(name: str, required: bool = False, default: str | None = None) -> str | None:
    value = os.environ.get(name) or default
    if required and not value:
        sys.exit(f"Missing setting {name}. Add it to {HERE / '.env'} (see .env.example).")
    return value


# --------------------------------------------------------------------------- http

def http(method: str, url: str, headers: dict | None = None, data: bytes | None = None,
         timeout: int = 60) -> tuple[int, dict, bytes]:
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"User-Agent": USER_AGENT, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, {k.lower(): v for k, v in resp.headers.items()}, resp.read()
    except urllib.error.HTTPError as err:
        return err.code, {k.lower(): v for k, v in (err.headers or {}).items()}, err.read()
    except (urllib.error.URLError, TimeoutError, ConnectionError) as err:
        return 0, {}, str(err).encode()


def sb_headers(key: str, extra: dict | None = None) -> dict:
    return {"apikey": key, "Authorization": f"Bearer {key}", **(extra or {})}


def supabase_url() -> str:
    return (cfg("SUPABASE_URL", required=True) or "").rstrip("/")


# --------------------------------------------------------------------------- products

def fetch_batch(batch_no: int) -> list[dict]:
    key = cfg("SUPABASE_SERVICE_ROLE_KEY") or cfg("SUPABASE_ANON_KEY", required=True)
    params = urllib.parse.urlencode({
        "select": "id,name,images,categories!category_id(name)",
        "is_active": "eq.true",
        "order": "created_at.asc,id.asc",
        "offset": (batch_no - 1) * BATCH_SIZE,
        "limit": BATCH_SIZE,
    })
    status, _, body = http("GET", f"{supabase_url()}/rest/v1/products?{params}", sb_headers(key))
    if status != 200:
        sys.exit(f"Could not read products (HTTP {status}): {body[:300]!r}")
    return json.loads(body)


def category_name(product: dict) -> str | None:
    cat = product.get("categories")
    if isinstance(cat, list):
        cat = cat[0] if cat else None
    return cat.get("name") if isinstance(cat, dict) else None


# --------------------------------------------------------------------------- matching

STOPWORDS = {
    "with", "and", "for", "the", "from", "bulk", "export", "grade", "quality", "wholesale", "pure",
    "type", "set", "pcs", "piece", "pieces", "inch", "new", "premium", "high", "oem", "per",
    "meter", "pack", "assorted", "custom", "standard", "heavy", "duty",
}


def base_name(name: str) -> str:
    """Strip catalogue suffixes such as 'Mk128', 'Batch6' or a trailing number."""
    current, previous = name.strip(), None
    while current != previous:
        previous = current
        current = re.sub(r"\s+(mk\s*\d+|batch\s*\d+|\d+)$", "", current, flags=re.I).strip()
    return current


FILLER_PHRASES = r"\b(per\s+met(?:er|re)|per\s+kg|bulk|wholesale|export\s+quality|export|assorted|unisex)\b"


def query_variants(name: str) -> list[str]:
    """Exact name first, then without measurements, then the core product phrase.
    Every result is still scored against the full product name, so a looser query
    can never let an unrelated image through."""
    exact = base_name(name)
    no_units = re.sub(r"\S*\d\S*", " ", exact)               # drop tokens containing digits (sizes, models, %)
    no_units = re.sub(FILLER_PHRASES, " ", no_units, flags=re.I)
    no_units = re.sub(r"\s+", " ", no_units).strip()
    variants = [exact, no_units]
    words = no_units.split()
    if len(words) > 3:
        variants.append(" ".join(words[:3]))   # product noun usually leads: "Cumin Seeds Machine..." -> "Cumin Seeds Machine"
    if len(words) > 2:
        variants.append(" ".join(words[:2]))   # "Green Cardamom", "Road Bike", "Cumin Seeds"
    if len(words) > 3:
        variants.append(" ".join(words[-3:]))  # or trails: "...Silk Crepe Fabric", "...Round Neck T-Shirts"
    # A one-word query is too vague to identify a product.
    return [v for v in dict.fromkeys(variants) if v and len(tokens(v)) >= min(2, len(tokens(exact)))]


def tokens(text: str) -> list[str]:
    out = []
    for tok in re.findall(r"[a-z][a-z0-9\-]+", text.lower()):
        tok = tok.strip("-")
        if len(tok) < 3 or tok in STOPWORDS:
            continue
        out.append(tok)
    return out


def norm(tok: str) -> str:
    return tok[:-1] if len(tok) > 4 and tok.endswith("s") else tok


def match_score(product_tokens: list[str], candidate_text: str) -> tuple[float, list[str]]:
    wanted = [norm(t) for t in dict.fromkeys(product_tokens)]
    if not wanted:
        return 0.0, []
    have = {norm(t) for t in tokens(candidate_text)}
    hits = [t for t in wanted if t in have]
    return len(hits) / len(wanted), hits


# --------------------------------------------------------------------------- search providers

def openverse_token() -> str | None:
    client_id, secret = cfg("OPENVERSE_CLIENT_ID"), cfg("OPENVERSE_CLIENT_SECRET")
    if not (client_id and secret):
        return None
    data = urllib.parse.urlencode({"client_id": client_id, "client_secret": secret,
                                   "grant_type": "client_credentials"}).encode()
    status, _, body = http("POST", "https://api.openverse.org/v1/auth_tokens/token/",
                           {"Content-Type": "application/x-www-form-urlencoded"}, data)
    if status != 200:
        sys.exit(f"Openverse authentication failed (HTTP {status}): {body[:200]!r}")
    return json.loads(body)["access_token"]


def search_openverse(query: str, token: str | None) -> list[dict]:
    params = urllib.parse.urlencode({"q": query, "license_type": "commercial,modification",
                                     "page_size": 20, "mature": "false"})
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    status, body = 0, b""
    for attempt in range(4):
        status, _, body = http("GET", f"https://api.openverse.org/v1/images/?{params}", headers, timeout=90)
        if status == 200:
            break
        time.sleep(30 if status == 429 else 5 * (attempt + 1))
    if status != 200:
        raise RuntimeError(f"Openverse search failed (HTTP {status})")
    results = []
    for item in json.loads(body).get("results", []):
        lic = (item.get("license") or "").lower()
        if lic not in ALLOWED_LICENSES:
            continue
        url_path = urllib.parse.urlparse(item.get("url") or "").path.lower()
        if (item.get("filetype") or "").lower() == "svg" or url_path.endswith(".svg"):
            continue  # vector drawings and diagrams, never product photographs
        tag_text = " ".join(t.get("name", "") for t in (item.get("tags") or []))
        title = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", item.get("title") or "")).strip()  # some titles carry HTML
        if item.get("mature") or BLOCKED_TERMS.search(f"{title} {tag_text}"):
            continue
        image_url = item.get("url") or ""
        # Flickr URLs are often small thumbnails (_m = 240px); ask for the 1024px version instead.
        image_url = re.sub(r"(live\.staticflickr\.com/.+?)_[mnzwc](\.jpg)$", r"\1_b\2", image_url)
        results.append({
            "provider": "openverse",
            "title": title,
            "text": f"{title} {tag_text}",
            "image_url": image_url,
            "source_page_url": item.get("foreign_landing_url"),
            "creator": item.get("creator"),
            "creator_url": item.get("creator_url"),
            "license": lic,
            "license_version": item.get("license_version"),
            "license_url": item.get("license_url"),
            "width": item.get("width"),
            "height": item.get("height"),
            "license_verified": True,
        })
    return results


def search_google(query: str) -> list[dict]:
    """Google Programmable Search (only for accounts that still have access).
    Google's rights filter is not proof of licence, so every result needs a licence check at review."""
    params = urllib.parse.urlencode({
        "key": cfg("GOOGLE_CSE_API_KEY", required=True), "cx": cfg("GOOGLE_CSE_CX", required=True),
        "q": query, "searchType": "image", "num": 10, "safe": "active", "imgSize": "large",
        "rights": "cc_publicdomain|cc_attribute|cc_sharealike",
    })
    status, _, body = http("GET", f"https://www.googleapis.com/customsearch/v1?{params}")
    if status != 200:
        raise RuntimeError(f"Google search failed (HTTP {status}): {body[:200]!r}")
    results = []
    for item in json.loads(body).get("items", []):
        image = item.get("image") or {}
        results.append({
            "provider": "google_cse",
            "title": item.get("title", ""),
            "text": f"{item.get('title', '')} {item.get('snippet', '')}",
            "image_url": item.get("link"),
            "source_page_url": image.get("contextLink"),
            "creator": None, "creator_url": None,
            "license": "unverified (google rights filter)", "license_version": None, "license_url": None,
            "width": image.get("width"), "height": image.get("height"),
            "license_verified": False,
        })
    return results


# --------------------------------------------------------------------------- download + validate

def download_image(url: str, dest_stem: Path) -> tuple[dict | None, str | None]:
    from PIL import Image, ImageOps  # imported here so 'report' works without Pillow

    status, headers, body = 0, {}, b""
    for attempt in range(3):
        status, headers, body = http("GET", url, {"Accept": "image/*"}, timeout=90)
        if status not in (429, 503):
            break
        retry_after = headers.get("retry-after", "")
        time.sleep(int(retry_after) if retry_after.isdigit() else 10 * (attempt + 1))
    time.sleep(1)  # be polite to image hosts such as Wikimedia and Flickr
    if status != 200:
        return None, f"HTTP {status}"
    mime = headers.get("content-type", "").split(";")[0].strip().lower()
    if not mime.startswith("image/"):
        return None, f"not an image ({mime or 'no content-type'})"
    try:
        Image.open(io.BytesIO(body)).verify()
        img = Image.open(io.BytesIO(body))
        img.load()
    except Exception as err:  # noqa: BLE001 - any decode failure means the file is unusable
        return None, f"invalid image data ({err})"
    width, height = img.size
    if max(width, height) < MIN_LONG_SIDE:
        return None, f"too small ({width}x{height})"
    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "LA", "P"):
        rgba = img.convert("RGBA")
        background = Image.new("RGB", rgba.size, "white")
        background.paste(rgba, mask=rgba.split()[-1])
        img = background
    else:
        img = img.convert("RGB")
    img.thumbnail((MAX_LONG_SIDE, MAX_LONG_SIDE))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=85, optimize=True, progressive=True)
    data = out.getvalue()
    if len(data) > MAX_BYTES:
        return None, "re-encoded file is over 10 MB"
    path = dest_stem.with_suffix(".jpg")
    path.write_bytes(data)
    return {"local_file": path.name, "width": img.size[0], "height": img.size[1], "bytes": len(data),
            "source_mime": mime, "sha256": hashlib.sha256(data).hexdigest()}, None


# --------------------------------------------------------------------------- manifest

def batch_dir(batch_no: int) -> Path:
    return STAGING / f"batch-{batch_no:04d}"


def load_manifest(batch_no: int) -> dict:
    path = batch_dir(batch_no) / "manifest.json"
    if not path.exists():
        sys.exit(f"No manifest for batch {batch_no}. Run: python pipeline.py search --batch {batch_no}")
    return json.loads(path.read_text(encoding="utf-8"))


def save_manifest(manifest: dict) -> None:
    path = batch_dir(manifest["batch"]) / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# --------------------------------------------------------------------------- commands

def cmd_search(args: argparse.Namespace) -> None:
    out_dir = batch_dir(args.batch)
    out_dir.mkdir(parents=True, exist_ok=True)
    provider = (cfg("IMAGE_SEARCH_PROVIDER", default="openverse") or "openverse").lower()
    if provider not in ("openverse", "google_cse"):
        sys.exit("IMAGE_SEARCH_PROVIDER must be 'openverse' or 'google_cse'.")
    token = openverse_token() if provider == "openverse" else None
    products = fetch_batch(args.batch)
    if not products:
        sys.exit(f"Batch {args.batch} is empty: every product has been processed.")

    manifest = {"batch": args.batch, "provider": provider, "searched_at": now(), "products": []}
    # Search results are cached across batches: numbered copies of a product share one search.
    cache_path = STAGING / f"search-cache-{provider}.json"
    cache: dict[str, list[dict]] = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}

    def run_search(q: str) -> list[dict] | str:
        if q in cache:
            return cache[q]
        try:
            results = search_openverse(q, token) if provider == "openverse" else search_google(q)
        except RuntimeError as err:
            # Rate limits and outages must never be recorded as "no image found".
            cache_path.write_text(json.dumps(cache), encoding="utf-8")
            sys.exit(f"STOPPED: {err} during batch {args.batch}. Nothing was marked; "
                     f"run 'search --batch {args.batch}' again later.")
        cache[q] = results
        cache_path.write_text(json.dumps(cache), encoding="utf-8")
        time.sleep(1.5)
        return results

    for product in products:
        product_tokens = tokens(base_name(product["name"]))
        entry = {
            "product_id": product["id"], "name": product["name"], "category": category_name(product),
            "queries_tried": [], "previous_images": product.get("images") or [],
            "candidates": [], "options": [], "selected": None, "auto_status": None, "review": None,
            "download_failures": 0, "notes": [],
        }
        if any(f"/{BUCKET}/{STORAGE_PREFIX}/" in (img or "") for img in entry["previous_images"]):
            entry["auto_status"] = "already_done"
            entry["notes"].append("product already has a verified catalogue image; left unchanged")
            manifest["products"].append(entry)
            continue

        passing: list[dict] = []
        scored: list[dict] = []
        for query in query_variants(product["name"]):
            entry["queries_tried"].append(query)
            results = run_search(query)
            if isinstance(results, str):
                entry["notes"].append(f"search error for '{query}': {results}")
                continue
            query_tokens = tokens(query)
            needed_hits = min(2, len(set(query_tokens))) or 1
            batch_scored = []
            for cand in results:
                # Score against the query words (all taken from the product name); the full-name
                # score is kept for the reviewer. Visual review is the final gate.
                score, hits = match_score(query_tokens, cand["text"])
                full_score, _ = match_score(product_tokens, cand["text"])
                batch_scored.append({**cand, "score": round(score, 2), "full_name_score": round(full_score, 2),
                                     "matched_keywords": hits, "query": query})
            scored.extend(batch_scored)
            passing = [c for c in batch_scored if c["score"] >= MIN_SCORE and len(c["matched_keywords"]) >= needed_hits]
            if passing:
                break
        rank = lambda c: (c["full_name_score"], c["score"], (c.get("width") or 0) * (c.get("height") or 0))  # noqa: E731
        scored.sort(key=rank, reverse=True)
        passing.sort(key=rank, reverse=True)
        entry["candidates"] = [{k: c.get(k) for k in ("title", "score", "matched_keywords", "license", "query",
                                                       "image_url", "source_page_url")} for c in scored[:5]]

        # Download up to three matching options so the reviewer can choose the most accurate one.
        seen_urls: set[str] = set()
        for cand in passing:
            if len(entry["options"]) == 3:
                break
            if cand["image_url"] in seen_urls:
                continue
            seen_urls.add(cand["image_url"])
            stem = out_dir / f"{product['id']}-opt{len(entry['options'])}"
            info, err = download_image(cand["image_url"], stem)
            if info:
                entry["options"].append({k: v for k, v in {**cand, **info}.items() if k != "text"})
            else:
                entry["download_failures"] += 1
                entry["notes"].append(f"download failed ({err}): {cand['image_url']}")
        if entry["options"]:
            entry["selected"] = entry["options"][0]
            entry["auto_status"] = "candidate"
        else:
            entry["auto_status"] = "needs_review"
            entry["notes"].append("no licensed image matched the product name closely enough"
                                  if not passing else "every matching image failed download or validation")
        manifest["products"].append(entry)

    save_manifest(manifest)
    print(f"Batch {args.batch}: {len(manifest['products'])} products searched with {provider}.")
    for e in manifest["products"]:
        if e["options"]:
            print(f"  [{e['auto_status']:>12}] {e['name'][:45]:45} | id {e['product_id'][:8]}")
            for i, opt in enumerate(e["options"]):
                print(f"{'':20}option {i}: {opt['local_file']} | {opt['title'][:55]} | {opt['license']}")
        else:
            print(f"  [{e['auto_status']:>12}] {e['name'][:45]:45} | {'; '.join(e['notes'])[:110]}")
    print(f"\nNext: look at the images in {out_dir}, then run 'review'.")


def cmd_review(args: argparse.Namespace) -> None:
    manifest = load_manifest(args.batch)
    by_prefix = lambda pid: [e for e in manifest["products"] if e["product_id"].startswith(pid)]  # noqa: E731
    decisions = [(pid, "approved") for pid in args.approve] + [(pid, "rejected") for pid in args.reject]
    for spec, decision in decisions:
        pid, _, opt = spec.partition(":")          # "<id-prefix>" or "<id-prefix>:<option number>"
        matches = by_prefix(pid)
        if len(matches) != 1:
            sys.exit(f"'{pid}' matches {len(matches)} products in batch {args.batch}; use a longer ID prefix.")
        entry = matches[0]
        if decision == "approved":
            index = int(opt) if opt else 0
            if index >= len(entry.get("options") or []):
                sys.exit(f"{entry['name']} has no option {index} to approve.")
            entry["selected"] = entry["options"][index]
        entry["review"] = {"decision": decision, "reason": args.reason, "reviewed_at": now(),
                           "license_checked": bool(args.license_checked)}
        print(f"{decision:>8}: {entry['name']}" + (f" (option {opt or 0})" if decision == "approved" else ""))
    save_manifest(manifest)


def upsert_source_row(key: str, row: dict) -> None:
    status, _, body = http(
        "POST", f"{supabase_url()}/rest/v1/product_image_sources?on_conflict=product_id",
        sb_headers(key, {"Content-Type": "application/json",
                         "Prefer": "resolution=merge-duplicates,return=minimal"}),
        json.dumps(row).encode())
    if status not in (200, 201, 204):
        raise RuntimeError(f"could not record image source (HTTP {status}): {body[:200]!r}")


def cmd_apply(args: argparse.Namespace) -> None:
    manifest = load_manifest(args.batch)
    key = cfg("SUPABASE_SERVICE_ROLE_KEY", required=True)
    anon = cfg("SUPABASE_ANON_KEY") or key
    base = supabase_url()
    unreviewed = [e["name"] for e in manifest["products"] if e["selected"] and not e["review"]]
    if unreviewed:
        sys.exit("These products have an image waiting for review:\n  " + "\n  ".join(unreviewed))

    for e in manifest["products"]:
        if e.get("result") in ("updated", "needs_review", "already_done"):
            continue
        if e["auto_status"] == "already_done":
            e["result"] = "already_done"
            continue
        sel, review = e["selected"], e["review"] or {}
        approved = bool(sel) and review.get("decision") == "approved"
        if approved and not sel.get("license_verified") and not review.get("license_checked"):
            approved = False
            e["notes"].append("licence not verified at the source page; held for review")
        query_used = (sel or {}).get("query") or " | ".join(e.get("queries_tried") or [])
        common = {"product_id": e["product_id"], "provider": manifest["provider"], "search_query": query_used,
                  "previous_images": e["previous_images"], "batch_no": manifest["batch"],
                  "checked_at": now()}
        try:
            if not approved:
                reason = review.get("reason") or "; ".join(e["notes"]) or "no exact match found"
                upsert_source_row(key, {**common, "status": "needs_review", "image_url": None, "notes": reason})
                e["result"] = "needs_review"
                continue

            data = (batch_dir(manifest["batch"]) / sel["local_file"]).read_bytes()
            obj = f"{STORAGE_PREFIX}/{e['product_id']}-{sel['sha256'][:10]}.jpg"
            status, _, body = http("POST", f"{base}/storage/v1/object/{BUCKET}/{obj}",
                                   sb_headers(key, {"Content-Type": "image/jpeg", "x-upsert": "true",
                                                    "cache-control": "max-age=31536000"}), data, timeout=120)
            if status not in (200, 201):
                raise RuntimeError(f"upload failed (HTTP {status}): {body[:200]!r}")
            public_url = f"{base}/storage/v1/object/public/{BUCKET}/{obj}"

            status, headers, body = http("GET", public_url, timeout=60)
            if status != 200 or not headers.get("content-type", "").startswith("image/") \
                    or hashlib.sha256(body).hexdigest() != sel["sha256"]:
                raise RuntimeError(f"uploaded image does not load correctly (HTTP {status})")

            status, _, body = http("PATCH", f"{base}/rest/v1/products?id=eq.{e['product_id']}",
                                   sb_headers(key, {"Content-Type": "application/json",
                                                    "Prefer": "return=minimal"}),
                                   json.dumps({"images": [public_url]}).encode())
            if status not in (200, 204):
                raise RuntimeError(f"product update failed (HTTP {status}): {body[:200]!r}")

            upsert_source_row(key, {**common, "status": "applied", "image_url": public_url,
                                    "source_page_url": sel.get("source_page_url"),
                                    "original_image_url": sel.get("image_url"), "title": sel.get("title"),
                                    "creator": sel.get("creator"), "creator_url": sel.get("creator_url"),
                                    "license": sel.get("license"), "license_version": sel.get("license_version"),
                                    "license_url": sel.get("license_url"), "notes": review.get("reason")})

            status, _, body = http("GET", f"{base}/rest/v1/products?id=eq.{e['product_id']}&select=images",
                                   sb_headers(anon))
            rows = json.loads(body) if status == 200 else []
            if not rows or (rows[0].get("images") or [None])[0] != public_url:
                raise RuntimeError("product does not show the new image after update")
            e["result"], e["image_url"] = "updated", public_url
        except RuntimeError as err:
            e["result"] = "failed"
            e["notes"].append(str(err))
    manifest["applied_at"] = now()
    save_manifest(manifest)
    print_report(manifest)


def print_report(manifest: dict) -> None:
    products = manifest["products"]
    found = sum(1 for e in products if e["selected"] and (e["review"] or {}).get("decision") == "approved")
    updated = sum(1 for e in products if e.get("result") == "updated")
    review = sum(1 for e in products if e.get("result", e["auto_status"]) == "needs_review"
                 or (e["review"] or {}).get("decision") == "rejected")
    failed_downloads = sum(e.get("download_failures", 0) for e in products)
    failed_updates = sum(1 for e in products if e.get("result") == "failed")
    print(f"\nBatch {manifest['batch']} completion report")
    print(f"  Products processed:             {len(products)}")
    print(f"  Correct images found:           {found}")
    print(f"  Images updated:                 {updated}")
    earlier = sum(1 for e in products if e.get("result", e["auto_status"]) == "already_done")
    if earlier:
        print(f"  Updated in an earlier pass:     {earlier}")
    print(f"  Images requiring manual review: {review}")
    print(f"  Failed image downloads:         {failed_downloads}")
    if failed_updates:
        print(f"  Failed uploads/updates:         {failed_updates}")
    for e in products:
        status = e.get("result") or (e["review"] or {}).get("decision") or e["auto_status"]
        print(f"   - {status:>12}: {e['name']}" + (f"  ({e['notes'][-1]})" if e["notes"] and status != "updated" else ""))


def cmd_report(args: argparse.Namespace) -> None:
    print_report(load_manifest(args.batch))


def main() -> None:
    for stream in (sys.stdout, sys.stderr):  # Windows consoles default to cp1252; titles can be any language
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    load_env()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("search", "apply", "report"):
        p = sub.add_parser(name)
        p.add_argument("--batch", type=int, required=True)
    p = sub.add_parser("review")
    p.add_argument("--batch", type=int, required=True)
    p.add_argument("--approve", nargs="*", default=[], help="product ID prefixes to approve")
    p.add_argument("--reject", nargs="*", default=[], help="product ID prefixes to reject (NEEDS REVIEW)")
    p.add_argument("--reason", default=None, help="note stored with the decision")
    p.add_argument("--license-checked", action="store_true",
                   help="confirm the licence was checked at the source page (needed for google_cse results)")
    args = parser.parse_args()
    {"search": cmd_search, "review": cmd_review, "apply": cmd_apply, "report": cmd_report}[args.command](args)


if __name__ == "__main__":
    main()
