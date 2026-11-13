/**
 * Assign distinct, title-relevant images to auction lots so the live board
 * never shows the same stock photo repeated across unrelated tenders.
 */

type ImageRule = {
  test: RegExp;
  urls: string[];
};

const RULES: ImageRule[] = [
  {
    test: /kraft|paper\s*bag|linerboard|corrugat|carton|packaging|box/i,
    urls: [
      'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
      'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg',
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    test: /cotton|yarn|textile|fabric|apparel|garment|t-?shirt|woven|knit/i,
    urls: [
      'https://images.unsplash.com/photo-1606744837616-56c9a5c6a6eb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1558171813-4c0887533814?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&q=80',
      'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg',
    ],
  },
  {
    test: /polymer|plastic|polyethylene|polypropylene|abs|pet\b|nylon|resin|granule|pellet|hdpe|ldpe|pvc/i,
    urls: [
      'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=800&q=80',
      'https://cdn.pixabay.com/photo/2017/10/25/17/36/cans-2888650_1280.jpg',
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1565043666747-69f6646db940?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    test: /rubber|epdm|sbr|tyre|tire|elastomer/i,
    urls: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
      'https://cdn.pixabay.com/photo/2017/04/11/16/12/leather-2222053_1280.jpg',
      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    test: /steel|metal|copper|aluminium|aluminum|iron|coil|rebar|wire|ingot|extrusion/i,
    urls: [
      'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1504328345608-5c56ce5c6f0f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1565793298595-6a381b3f1f4d?auto=format&fit=crop&w=800&q=80',
      'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg',
    ],
  },
  {
    test: /solar|inverter|led|electrical|cable|switchgear|transformer/i,
    urls: [
      'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1565814329452-7811bc3270c0?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    test: /cnc|machine|mould|mold|plant|equipment|motor|pump|gear/i,
    urls: [
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1565043666747-69f6646db940?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    test: /chemical|solvent|acid|reagent|pharma|lab/i,
    urls: [
      'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1581093458791-9d42e3f0f0f0?auto=format&fit=crop&w=800&q=80',
      'https://cdn.pixabay.com/photo/2016/11/29/09/16/architecture-1868667_1280.jpg',
    ],
  },
  {
    test: /grain|rice|wheat|maize|corn|turmeric|spice|agro|food|oil\s*seed/i,
    urls: [
      'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    test: /ceramic|pottery|marble|brass|handicraft|carpet|rug|embroidery|leather/i,
    urls: [
      'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80',
      'https://cdn.pixabay.com/photo/2017/04/11/16/12/leather-2222053_1280.jpg',
    ],
  },
  {
    test: /bottle|can|jerry|drum|container|stainless|flask/i,
    urls: [
      'https://cdn.pixabay.com/photo/2017/10/25/17/36/cans-2888650_1280.jpg',
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f?auto=format&fit=crop&w=800&q=80',
    ],
  },
];

const FALLBACK_POOL = [
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80',
  'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg',
  'https://images.unsplash.com/photo-1565814329452-7811bc3270c0?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1504328345608-5c56ce5c6f0f?auto=format&fit=crop&w=800&q=80',
];

function hashKey(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickFrom(pool: string[], key: string): string {
  if (!pool.length) return FALLBACK_POOL[0];
  return pool[hashKey(key) % pool.length];
}

/** True if URL is missing or from the known overused generic industrial stock set. */
export function isWeakAuctionImage(url?: string | null): boolean {
  if (!url || !url.trim()) return true;
  const weak = [
    'photo-1581092160607-ee22621dd758', // overused factory floor
    'photo-1544724569-5f546fd6f2b5', // generic hub fallback
    'photo-1615906655593-ad0386982a0f', // overused pellets (when alone)
  ];
  // Only treat as weak when it's the bare repeated factory shot used 12+ times
  return weak[0] === url.match(/photo-[a-z0-9-]+/i)?.[0] || !url.startsWith('http');
}

/**
 * Resolve a display image for an auction.
 * Prefer a good existing URL; otherwise pick a title-relevant unique URL from pools.
 */
export function resolveAuctionImage(opts: {
  id: string;
  title: string;
  existing?: string | string[] | null;
}): string {
  const existing = Array.isArray(opts.existing) ? opts.existing[0] : opts.existing;
  const key = `${opts.id}|${opts.title}`;

  // Keep existing if it looks intentional and not the mass-duplicated factory shot
  if (existing && existing.startsWith('http')) {
    const factorySpam = existing.includes('photo-1581092160607-ee22621dd758');
    if (!factorySpam) return existing;
  }

  for (const rule of RULES) {
    if (rule.test.test(opts.title)) {
      return pickFrom(rule.urls, key);
    }
  }
  return pickFrom(FALLBACK_POOL, key);
}

/** Deduplicate a list so neighbouring cards prefer different URLs when possible. */
export function assignDistinctAuctionImages<T extends { id: string; title: string; image?: string; images?: string[] }>(
  items: T[]
): T[] {
  const used = new Set<string>();
  return items.map((item) => {
    let url = resolveAuctionImage({
      id: item.id,
      title: item.title,
      existing: item.images?.[0] || item.image,
    });
    if (used.has(url)) {
      url = pickFrom(FALLBACK_POOL, `${item.id}-alt-${used.size}`);
      // try category pool again with salt
      for (const rule of RULES) {
        if (rule.test.test(item.title)) {
          const alt = pickFrom(rule.urls, `${item.id}-salt-${used.size}`);
          if (!used.has(alt)) {
            url = alt;
            break;
          }
        }
      }
    }
    used.add(url);
    return {
      ...item,
      image: url,
      images: [url, ...(item.images?.slice(1) || [])],
    };
  });
}
