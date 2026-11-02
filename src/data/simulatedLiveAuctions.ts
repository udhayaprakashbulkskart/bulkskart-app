/**
 * Temporary always-on live-auction simulation for marketplace presence.
 * Anonymous factory labels only — no real person names.
 * Toggle off via VITE_SIMULATED_AUCTIONS=false when real inventory is enough.
 */

export const SIMULATED_AUCTIONS_ENABLED =
  String(import.meta.env.VITE_SIMULATED_AUCTIONS ?? 'true').toLowerCase() !== 'false';

export const SIMULATED_ID_PREFIX = 'sim-auc-';

/** 60-minute live window with staggered slots so the board never looks empty. */
const WINDOW_SEC = 60 * 60;
const MIN_LIVE_SEC = 4 * 60;
const ACTIVITY_TICK_MS = 8_000;

export interface SimulatedAuctionItem {
  id: string;
  auction_number: string;
  auction_type: 'reverse' | 'forward';
  title: string;
  description: string;
  total_quantity: number;
  moq: number;
  quantity_unit: string;
  starting_price: number;
  reserve_price?: number;
  current_highest_bid: number | null;
  min_bid_increment: number;
  total_bids: number;
  highest_bidder_name?: string;
  end_time: string;
  status: string;
  delivery_location: string;
  images?: string[];
  manufacturer_name?: string;
  is_simulated?: true;
}

type Seed = {
  slug: string;
  auction_type: 'reverse' | 'forward';
  title: string;
  description: string;
  total_quantity: number;
  moq: number;
  quantity_unit: string;
  starting_price: number;
  min_bid_increment: number;
  delivery_location: string;
  manufacturer_name: string;
  image: string;
  /** Slot offset 0–11 → staggered end times inside the rolling hour. */
  slot: number;
  baseBids: number;
};

const SEEDS: Seed[] = [
  {
    slug: '01',
    auction_type: 'reverse',
    title: 'Pure Copper Wire 2.5mm Industrial Grade (Surplus Factory Lot)',
    description: 'Anonymous verified factory surplus. Mill test certificates available on request. Simulation lot for marketplace preview.',
    total_quantity: 5000,
    moq: 500,
    quantity_unit: 'Kilograms',
    starting_price: 720,
    min_bid_increment: 5,
    delivery_location: 'Mumbai, Maharashtra',
    manufacturer_name: 'Verified Copper Mill · West Zone',
    image: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80',
    slot: 0,
    baseBids: 14,
  },
  {
    slug: '02',
    auction_type: 'reverse',
    title: 'Organic Cotton Combed Yarn 30s Count (Ring Spun Export Lot)',
    description: 'Export-ready yarn lot from a verified textile cluster. Temporary simulation listing.',
    total_quantity: 10000,
    moq: 1000,
    quantity_unit: 'Kilograms',
    starting_price: 310,
    min_bid_increment: 2,
    delivery_location: 'Tirupur, Tamil Nadu',
    manufacturer_name: 'Verified Spinning Unit · South Zone',
    image: 'https://images.unsplash.com/photo-1606744837616-56c9a5c6a6eb?auto=format&fit=crop&w=800&q=80',
    slot: 1,
    baseBids: 11,
  },
  {
    slug: '03',
    auction_type: 'reverse',
    title: 'HDPE Blow-Moulded Jerry Cans 20L Natural (Food-Grade Lot)',
    description: 'Food-grade HDPE containers, factory-sealed pallets. Simulation lot.',
    total_quantity: 8000,
    moq: 400,
    quantity_unit: 'Units',
    starting_price: 185,
    min_bid_increment: 3,
    delivery_location: 'Vadodara, Gujarat',
    manufacturer_name: 'Verified Packaging Plant · West Zone',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
    slot: 2,
    baseBids: 9,
  },
  {
    slug: '04',
    auction_type: 'reverse',
    title: 'MS Hot-Rolled Coil 2.0mm IS 2062 (Mill Surplus Bundle)',
    description: 'Prime HR coil surplus from a verified rolling mill. Simulation lot.',
    total_quantity: 45,
    moq: 5,
    quantity_unit: 'Metric Tons',
    starting_price: 48500,
    min_bid_increment: 250,
    delivery_location: 'Raipur, Chhattisgarh',
    manufacturer_name: 'Verified Steel Mill · Central Zone',
    image: 'https://images.unsplash.com/photo-1504328345608-5c56ce5c6f0f?auto=format&fit=crop&w=800&q=80',
    slot: 3,
    baseBids: 17,
  },
  {
    slug: '05',
    auction_type: 'reverse',
    title: 'Industrial LED High-Bay Fixtures 150W IP65 (Warehouse Clearance)',
    description: 'Surplus lighting SKUs from OEM warehouse. Simulation lot.',
    total_quantity: 1200,
    moq: 50,
    quantity_unit: 'Units',
    starting_price: 2450,
    min_bid_increment: 25,
    delivery_location: 'Noida, Uttar Pradesh',
    manufacturer_name: 'Verified Lighting OEM · North Zone',
    image: 'https://images.unsplash.com/photo-1565814329452-7811bc3270c0?auto=format&fit=crop&w=800&q=80',
    slot: 4,
    baseBids: 13,
  },
  {
    slug: '06',
    auction_type: 'reverse',
    title: 'Food-Grade Corrugated Cartons 5-Ply (Export Ready)',
    description: '5-ply export cartons, standard B2B sizes. Simulation lot.',
    total_quantity: 25000,
    moq: 2000,
    quantity_unit: 'Units',
    starting_price: 42,
    min_bid_increment: 1,
    delivery_location: 'Vapi, Gujarat',
    manufacturer_name: 'Verified Corrugator · West Zone',
    image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80',
    slot: 5,
    baseBids: 8,
  },
  {
    slug: '07',
    auction_type: 'forward',
    title: 'High-Precision 5-Axis CNC Milling Center – 12,000 RPM',
    description: 'Plant liquidation machinery lot. Anonymous seller profile. Simulation lot.',
    total_quantity: 2,
    moq: 1,
    quantity_unit: 'Units',
    starting_price: 1850000,
    min_bid_increment: 25000,
    delivery_location: 'Coimbatore, Tamil Nadu',
    manufacturer_name: 'Verified Machinery Yard · South Zone',
    image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80',
    slot: 6,
    baseBids: 7,
  },
  {
    slug: '08',
    auction_type: 'forward',
    title: 'Corrugated Box Flute Making Line (High Speed 200m/min)',
    description: 'Complete production line liquidation. Simulation lot.',
    total_quantity: 1,
    moq: 1,
    quantity_unit: 'Set',
    starting_price: 3200000,
    min_bid_increment: 50000,
    delivery_location: 'Surat, Gujarat',
    manufacturer_name: 'Verified Plant Liquidator · West Zone',
    image: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80',
    slot: 7,
    baseBids: 10,
  },
  {
    slug: '09',
    auction_type: 'forward',
    title: 'Commercial Solar On-Grid Inverter Lot (50kW IP65 Three Phase)',
    description: 'OEM surplus inverters. Simulation lot for live board presence.',
    total_quantity: 25,
    moq: 5,
    quantity_unit: 'Units',
    starting_price: 115000,
    min_bid_increment: 1500,
    delivery_location: 'Bengaluru, Karnataka',
    manufacturer_name: 'Verified Energy OEM · South Zone',
    image: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
    slot: 8,
    baseBids: 15,
  },
  {
    slug: '10',
    auction_type: 'reverse',
    title: 'Aluminium Extrusion Profiles 6063-T5 (Architectural Batch)',
    description: 'Architectural aluminium profiles, mill finish. Simulation lot.',
    total_quantity: 18,
    moq: 2,
    quantity_unit: 'Metric Tons',
    starting_price: 265000,
    min_bid_increment: 1000,
    delivery_location: 'Hyderabad, Telangana',
    manufacturer_name: 'Verified Extrusion Plant · South Zone',
    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80',
    slot: 9,
    baseBids: 12,
  },
  {
    slug: '11',
    auction_type: 'reverse',
    title: 'PP Woven Sack Rolls 70 GSM (Bulk Agro Packaging)',
    description: 'Agro packaging woven rolls from verified converter. Simulation lot.',
    total_quantity: 40,
    moq: 5,
    quantity_unit: 'Metric Tons',
    starting_price: 98000,
    min_bid_increment: 500,
    delivery_location: 'Kanpur, Uttar Pradesh',
    manufacturer_name: 'Verified Polymer Unit · North Zone',
    image: 'https://images.unsplash.com/photo-1578574577315-52ac1758a1d0?auto=format&fit=crop&w=800&q=80',
    slot: 10,
    baseBids: 6,
  },
  {
    slug: '12',
    auction_type: 'forward',
    title: 'Used Injection Moulding Machine 250T (Servo Hydraulic)',
    description: 'Refurbished plant equipment, inspection reports on request. Simulation lot.',
    total_quantity: 3,
    moq: 1,
    quantity_unit: 'Units',
    starting_price: 980000,
    min_bid_increment: 15000,
    delivery_location: 'Pune, Maharashtra',
    manufacturer_name: 'Verified Equipment Yard · West Zone',
    image: 'https://images.unsplash.com/photo-1565043666747-69f6646db940?auto=format&fit=crop&w=800&q=80',
    slot: 11,
    baseBids: 9,
  },
];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

/** Rolling remaining seconds so every slot stays live forever (recycles each hour). */
export function simulatedRemainingSeconds(slot: number, nowMs = Date.now()): number {
  const nowSec = Math.floor(nowMs / 1000);
  const phase = (slot * 307) % WINDOW_SEC;
  const elapsedInWindow = (nowSec + phase) % WINDOW_SEC;
  const remaining = WINDOW_SEC - elapsedInWindow;
  return Math.max(MIN_LIVE_SEC, remaining);
}

function activityPulse(slug: string, nowMs: number): number {
  const tick = Math.floor(nowMs / ACTIVITY_TICK_MS);
  const h = hashSlug(slug);
  // Stable pseudo-random 0–2 extra bids per tick window
  return (h + tick * 17) % 3;
}

function bidDelta(seed: Seed, nowMs: number): { bids: number; leading: number } {
  const pulse = activityPulse(seed.slug, nowMs);
  const tick = Math.floor(nowMs / ACTIVITY_TICK_MS);
  const steps = seed.baseBids + pulse + ((hashSlug(seed.slug) + tick) % 5);
  const isReverse = seed.auction_type === 'reverse';
  const direction = isReverse ? -1 : 1;
  const leading = Math.max(
    seed.min_bid_increment,
    seed.starting_price + direction * steps * seed.min_bid_increment
  );
  return { bids: steps, leading };
}

export function isSimulatedAuctionId(id: string | undefined | null): boolean {
  return Boolean(id && id.startsWith(SIMULATED_ID_PREFIX));
}

export function getSimulatedAuctions(nowMs = Date.now()): SimulatedAuctionItem[] {
  if (!SIMULATED_AUCTIONS_ENABLED) return [];

  return SEEDS.map((seed) => {
    const remaining = simulatedRemainingSeconds(seed.slot, nowMs);
    const { bids, leading } = bidDelta(seed, nowMs);
    return {
      id: `${SIMULATED_ID_PREFIX}${seed.slug}`,
      auction_number: `SIM-${seed.slug.padStart(4, '0')}`,
      auction_type: seed.auction_type,
      title: seed.title,
      description: seed.description,
      total_quantity: seed.total_quantity,
      moq: seed.moq,
      quantity_unit: seed.quantity_unit,
      starting_price: seed.starting_price,
      reserve_price: undefined,
      current_highest_bid: leading,
      min_bid_increment: seed.min_bid_increment,
      total_bids: bids,
      highest_bidder_name: 'Verified Enterprise Buyer',
      end_time: new Date(nowMs + remaining * 1000).toISOString(),
      status: 'live',
      delivery_location: seed.delivery_location,
      images: [seed.image],
      manufacturer_name: seed.manufacturer_name,
      is_simulated: true,
    };
  });
}

export function getSimulatedAuctionById(
  id: string,
  nowMs = Date.now()
): SimulatedAuctionItem | null {
  if (!isSimulatedAuctionId(id) || !SIMULATED_AUCTIONS_ENABLED) return null;
  return getSimulatedAuctions(nowMs).find((a) => a.id === id) ?? null;
}

export function getSimulatedBidHistory(
  auction: SimulatedAuctionItem,
  nowMs = Date.now()
): Array<{
  id: string;
  bidder_name: string;
  bid_amount: number;
  quantity: number;
  timestamp: string;
  status: 'accepted' | 'outbid' | 'winning';
}> {
  const labels = [
    'Verified Enterprise Buyer',
    'Registered Trading House',
    'OEM Procurement Desk',
    'Regional Distributor',
    'Export House · India',
  ];
  const count = Math.min(8, Math.max(3, auction.total_bids));
  const isReverse = auction.auction_type === 'reverse';
  const rows = [];
  for (let i = 0; i < count; i++) {
    const step = count - i;
    const amount = isReverse
      ? auction.starting_price - step * auction.min_bid_increment
      : auction.starting_price + step * auction.min_bid_increment;
    rows.push({
      id: `${auction.id}-bid-${i}`,
      bidder_name: labels[i % labels.length],
      bid_amount: Math.max(auction.min_bid_increment, amount),
      quantity: Math.max(auction.moq, Math.floor(auction.total_quantity / (i + 2))),
      timestamp: new Date(nowMs - i * ACTIVITY_TICK_MS * 2).toISOString(),
      status: (i === 0 ? 'winning' : 'outbid') as 'winning' | 'outbid',
    });
  }
  return rows;
}

/** Merge DB rows with simulated lots. Real DB auctions win on duplicate titles; sims fill the board. */
export function mergeWithSimulatedAuctions<T extends { id: string; auction_type?: string }>(
  dbAuctions: T[],
  nowMs = Date.now()
): Array<T | SimulatedAuctionItem> {
  const sims = getSimulatedAuctions(nowMs);
  if (!sims.length) return dbAuctions;

  const liveDb = dbAuctions.filter((a) => !isSimulatedAuctionId(a.id));
  // Always keep sims so the board never empties; prepend real lots first.
  return [...liveDb, ...sims];
}
