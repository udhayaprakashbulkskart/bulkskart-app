/**
 * VerifiedSuppliersSection - the "Verified Suppliers" part of the home page.
 *
 * This file holds the data (which suppliers, the 30 second rotation, the country filter, the links).
 * The look, and the cards that scroll left and right by themselves, are in ./suppliers/SuppliersShowcase.tsx.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCompanies } from '@/lib/api';
import { DISTINCT_PIXABAY_COMPANY_IMAGES } from '@/lib/contentImages';
import { matchProductImage } from '@/lib/productImageMatchingEngine';
import type { Company } from '@/types/types';
import SuppliersShowcase, { type CountryChip } from './suppliers/SuppliersShowcase';
import { optimizeCatalogUrl } from './suppliers/images';

export interface DisplaySupplier {
  id: string;
  name: string;
  slug?: string;
  country: string;
  flag: string;
  img: string;
  logoType?: 'aubc' | 'orange_box' | 'orange_bolt' | 'green_leaf' | 'timber' | 'red_sun' | 'golden_flame' | 'cyan_circuit' | 'default';
  logoUrl?: string;
  isVerified: boolean;
  industry?: string;
  productFocus?: string;
  /** Alibaba-style sample product listing title shown on the card */
  sampleProduct?: string;
  /** Up to three short labels for the card (what the supplier makes or does) */
  tags?: string[];
  /** Facts from the company record; a card only shows the ones it has */
  yearsInBusiness?: number;
  totalProducts?: number;
  exportsGlobally?: boolean;
}

/** Simulation cycle: rotate unique supplier batches every 30 seconds */
const ROTATION_SECONDS = 30;
const DISPLAY_COUNT = 8;

/** Fresh seed every page open / hard refresh — different users & visits get different batches */
function createVisitSeed(): number {
  const entropy =
    (typeof performance !== 'undefined' ? performance.now() : 0) * 1000 +
    Date.now() +
    Math.floor(Math.random() * 1_000_000);
  return (entropy >>> 0) || 1;
}

/** Deterministic Fisher–Yates shuffle (stable for a given seed) */
function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const COUNTRY_FLAGS: Record<string, string> = {
  'China': '🇨🇳',
  'India': '🇮🇳',
  'UAE': '🇦🇪',
  'Germany': '🇩🇪',
  'Turkey': '🇹🇷',
  'Singapore': '🇸🇬',
  'USA': '🇺🇸',
  'Japan': '🇯🇵',
  'South Korea': '🇰🇷',
  'UK': '🇬🇧',
  'Vietnam': '🇻🇳',
  'Italy': '🇮🇹',
  'France': '🇫🇷',
  'Brazil': '🇧🇷',
  'Sweden': '🇸🇪',
  'Thailand': '🇹🇭',
};

/**
 * Optimized Alibaba-style B2B product catalog photos (licensed Unsplash CDN).
 * Small WebP derivatives load fast on the landing grid (~40–80KB each).
 */
const p = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=480&h=300&q=70&fm=webp`;

/**
 * Alibaba factory-style sample catalog — company + sample product listing titles
 * inspired by verified B2B manufacturer directories (images from licensed CDNs).
 */
const REFERENCE_SUPPLIERS_RAW: Array<Omit<DisplaySupplier, 'img'> & { img: string }> = [
  {
    id: 'ref-mfr-abc',
    name: 'Dongguan Apex CNC Co., Ltd.',
    slug: 'dongguan-apex-cnc',
    country: 'China',
    flag: '🇨🇳',
    img: p('photo-1565793298595-6a879b1d9492'),
    logoType: 'aubc',
    isVerified: true,
    industry: 'Industrial Machinery',
    productFocus: 'CNC machined steel components',
    sampleProduct: 'High Precision 5-Axis CNC Milling Center',
  },
  {
    id: 'ref-mfr-gps',
    name: 'Ahmedabad Crown Packaging Mfg Corp.',
    slug: 'ahmedabad-crown-packaging',
    country: 'India',
    flag: '🇮🇳',
    img: p('photo-1530587191325-3db32d826c18'),
    logoType: 'orange_box',
    isVerified: true,
    industry: 'Packaging Machinery',
    productFocus: 'corrugated carton packaging',
    sampleProduct: 'Automatic Multi-Head Weigher Packaging Machine',
  },
  {
    id: 'ref-mfr-shakti',
    name: 'Shakti Electricals Switchgear Pvt Ltd',
    slug: 'shakti-electricals',
    country: 'India',
    flag: '🇮🇳',
    img: p('photo-1621905252507-b35492cc74b4'),
    logoType: 'orange_bolt',
    isVerified: true,
    industry: 'Consumer Electronics',
    productFocus: 'electrical copper cable switchgear',
    sampleProduct: 'HV Copper Power Cable & Switchgear Assemblies',
  },
  {
    id: 'ref-mfr-rheinland',
    name: 'Düsseldorf Precision Hydraulic GmbH',
    slug: 'dusseldorf-precision-hydraulic',
    country: 'Germany',
    flag: '🇩🇪',
    img: p('photo-1582719478250-c89cae4dc85b'),
    logoType: 'green_leaf',
    isVerified: true,
    industry: 'Specialty Chemicals',
    productFocus: 'specialty chemical polymer resin',
    sampleProduct: 'Industrial Polymer Resin & Specialty Chemicals',
  },
  {
    id: 'ref-mfr-pacific',
    name: 'Pacific Northwest Timber Corp.',
    slug: 'pacific-northwest-timber',
    country: 'USA',
    flag: '🇺🇸',
    img: p('photo-1503387762-592deb58ef4e'),
    logoType: 'timber',
    isVerified: true,
    industry: 'Building Materials',
    productFocus: 'timber softwood lumber pallets',
    sampleProduct: 'Export-Grade Softwood Lumber & Pallets',
  },
  {
    id: 'ref-mfr-nippon',
    name: 'Osaka Summit Optics Enterprises Ltd.',
    slug: 'osaka-summit-optics',
    country: 'Japan',
    flag: '🇯🇵',
    img: p('photo-1516035069371-29a1b244cc32'),
    logoType: 'red_sun',
    isVerified: true,
    industry: 'Consumer Electronics',
    productFocus: 'optical lens precision camera sensor',
    sampleProduct: 'OEM Precision Camera Lens & Optical Sensors',
  },
  {
    id: 'ref-mfr-emirates',
    name: 'Emirates Petrochem & Polymers LLC',
    slug: 'emirates-petrochem-polymers',
    country: 'UAE',
    flag: '🇦🇪',
    img: p('photo-1611273426858-450d8e3c9fce'),
    logoType: 'golden_flame',
    isVerified: true,
    industry: 'Plastics & Rubber',
    productFocus: 'polyethylene plastic pellets resin',
    sampleProduct: 'Virgin HDPE / LDPE Polymer Pellets (Bulk)',
  },
  {
    id: 'ref-mfr-hana',
    name: 'Hana Smart Energy & Battery Corp',
    slug: 'hana-smart-energy-battery',
    country: 'South Korea',
    flag: '🇰🇷',
    img: p('photo-1613665813446-82a78c468a1d'),
    logoType: 'cyan_circuit',
    isVerified: true,
    industry: 'Consumer Electronics',
    productFocus: 'solar panel battery module inverter',
    sampleProduct: 'Li-ion Battery Module & Solar Inverter Kits',
  },
  {
    id: 'ref-mfr-zenith',
    name: 'Suzhou Golden Laser Industries Inc.',
    slug: 'suzhou-golden-laser',
    country: 'China',
    flag: '🇨🇳',
    img: p('photo-1565043589221-1a6fd9ae45c7'),
    logoType: 'default',
    isVerified: true,
    industry: 'Industrial Machinery',
    productFocus: 'fiber laser sheet metal cutting',
    sampleProduct: 'Fiber Laser Sheet Metal Cutting Machine 12kW',
  },
  {
    id: 'ref-mfr-agrogold',
    name: 'AgroGold Commodities Exports',
    slug: 'agrogold-commodities-exports',
    country: 'India',
    flag: '🇮🇳',
    img: p('photo-1586201375761-83865001e31c'),
    logoType: 'default',
    isVerified: true,
    industry: 'Agriculture & Food',
    productFocus: 'organic wheat grain spice commodities',
    sampleProduct: 'Bulk Organic Basmati Rice & Spice Lots',
  },
  {
    id: 'ref-mfr-silkweave',
    name: 'Shaoxing SilkWoven Textile Mills Ltd',
    slug: 'shaoxing-silkwoven-textiles',
    country: 'China',
    flag: '🇨🇳',
    img: p('photo-1558611848-73f7eb4001a1'),
    logoType: 'default',
    isVerified: true,
    industry: 'Textiles & Apparel',
    productFocus: 'silk fabric cotton textile yarn',
    sampleProduct: 'Mulberry Silk Fabric Rolls (OEM Dyeing)',
  },
  {
    id: 'ref-mfr-titansteel',
    name: 'Cleveland Titan Auto Castings Inc.',
    slug: 'cleveland-titan-auto-castings',
    country: 'USA',
    flag: '🇺🇸',
    img: p('photo-1486262715619-67b85e0b08d3'),
    logoType: 'default',
    isVerified: true,
    industry: 'Auto Parts',
    productFocus: 'automotive casting steel alloy parts',
    sampleProduct: 'Automotive Transmission Forgings & Cast Parts',
  },
  {
    id: 'ref-mfr-nordic',
    name: 'Stuttgart Phoenix Bearings GmbH',
    slug: 'stuttgart-phoenix-bearings',
    country: 'Germany',
    flag: '🇩🇪',
    img: p('photo-1581092918056-0c4c3acd3789'),
    logoType: 'default',
    isVerified: true,
    industry: 'Industrial Machinery',
    productFocus: 'ball bearing roller motion systems',
    sampleProduct: 'Precision Ball Bearing Sets (ISO Grade)',
  },
  {
    id: 'ref-mfr-gulfpipe',
    name: 'Gulf Industrial Piping LLC',
    slug: 'gulf-industrial-piping',
    country: 'UAE',
    flag: '🇦🇪',
    img: p('photo-1504328345606-18bbc8c9d7d1'),
    logoType: 'default',
    isVerified: true,
    industry: 'Building Materials',
    productFocus: 'HDPE PVC industrial pipe fittings',
    sampleProduct: 'HDPE Pressure Pipe & PVC Fittings Bundle',
  },
  {
    id: 'ref-mfr-osakacircuit',
    name: 'Osaka MicroCircuit Co., Ltd.',
    slug: 'osaka-microcircuit',
    country: 'Japan',
    flag: '🇯🇵',
    img: p('photo-1518770660439-4636190af475'),
    logoType: 'default',
    isVerified: true,
    industry: 'Consumer Electronics',
    productFocus: 'PCB printed circuit microelectronics',
    sampleProduct: 'OEM Multilayer PCB Assembly (FR4 / HDI)',
  },
  {
    id: 'ref-mfr-seoulwind',
    name: 'Seoul Wind & Grid Systems Co.',
    slug: 'seoul-wind-grid-systems',
    country: 'South Korea',
    flag: '🇰🇷',
    img: p('photo-1509391366360-2e959784a276'),
    logoType: 'default',
    isVerified: true,
    industry: 'Consumer Electronics',
    productFocus: 'solar inverter grid energy',
    sampleProduct: 'Grid-Tied Solar Inverter 5kW–50kW',
  },
  {
    id: 'ref-mfr-mumbaiwire',
    name: 'Mumbai Copper Wire Works',
    slug: 'mumbai-copper-wire-works',
    country: 'India',
    flag: '🇮🇳',
    img: p('photo-1558618666-fcd25c85cd64'),
    logoType: 'default',
    isVerified: true,
    industry: 'Electronics & Electricals',
    productFocus: 'copper wire power cable winding',
    sampleProduct: 'Enameled Copper Winding Wire (Class H)',
  },
  {
    id: 'ref-mfr-shenzhenpoly',
    name: 'Shenzhen Polymer Pellets Ltd',
    slug: 'shenzhen-polymer-pellets',
    country: 'China',
    flag: '🇨🇳',
    img: p('photo-1600880292089-90a7e086ee0c'),
    logoType: 'default',
    isVerified: true,
    industry: 'Plastics & Rubber',
    productFocus: 'recycled plastic polymer pellets',
    sampleProduct: 'Recycled ABS / PP Polymer Pellets (Bulk)',
  },
  {
    id: 'ref-mfr-detroitauto',
    name: 'Detroit Forge & Castings Inc.',
    slug: 'detroit-forge-castings',
    country: 'USA',
    flag: '🇺🇸',
    img: p('photo-1492144534655-ae79c964c9d7'),
    logoType: 'default',
    isVerified: true,
    industry: 'Auto Parts',
    productFocus: 'automotive forging casting metal',
    sampleProduct: 'Drop-Forged Automotive Chassis Components',
  },
  {
    id: 'ref-mfr-hamburglog',
    name: 'Hamburg Bulk Logistics Packaging AG',
    slug: 'hamburg-bulk-logistics',
    country: 'Germany',
    flag: '🇩🇪',
    img: p('photo-1607166452427-7e4477079cb9'),
    logoType: 'default',
    isVerified: true,
    industry: 'Packaging',
    productFocus: 'export packaging corrugated cartons',
    sampleProduct: 'Export-Ready Corrugated Carton Kits',
  },
  {
    id: 'ref-mfr-dubaiwater',
    name: 'Dubai Desal Chem Partners',
    slug: 'dubai-desal-chem-partners',
    country: 'UAE',
    flag: '🇦🇪',
    img: p('photo-1532187863486-abf9dbad1b69'),
    logoType: 'default',
    isVerified: true,
    industry: 'Chemicals',
    productFocus: 'water treatment industrial chemicals',
    sampleProduct: 'Water Treatment Chemical Drum Kits',
  },
  {
    id: 'ref-mfr-kyotofiber',
    name: 'Kyoto Technical Fibers K.K.',
    slug: 'kyoto-technical-fibers',
    country: 'Japan',
    flag: '🇯🇵',
    img: p('photo-1620799140408-edc6dcb6d633'),
    logoType: 'default',
    isVerified: true,
    industry: 'Textiles',
    productFocus: 'technical textile industrial fiber',
    sampleProduct: 'High-Tenacity Technical Fiber Fabrics',
  },
  {
    id: 'ref-mfr-busanport',
    name: 'Wuxi Starlight Pumps Global Exports',
    slug: 'wuxi-starlight-pumps',
    country: 'China',
    flag: '🇨🇳',
    img: p('photo-1619642751034-765dfdf7c58e'),
    logoType: 'default',
    isVerified: true,
    industry: 'Industrial Machinery',
    productFocus: 'industrial slurry pump hydraulic',
    sampleProduct: 'High Pressure Industrial Slurry Pump',
  },
  {
    id: 'ref-mfr-punecnc',
    name: 'Pune Multi-Axis CNC Hub Pvt Ltd',
    slug: 'pune-multi-axis-cnc-hub',
    country: 'India',
    flag: '🇮🇳',
    img: p('photo-1581092162384-8987c1d64718'),
    logoType: 'default',
    isVerified: true,
    industry: 'Industrial Machinery',
    productFocus: '5-axis CNC milling machine',
    sampleProduct: 'Industrial Metal Lathe & CNC Turning Center',
  },
  {
    id: 'ref-mfr-shenzhenelec',
    name: 'Shenzhen Nova Consumer Electronics Co.',
    slug: 'shenzhen-nova-consumer-electronics',
    country: 'China',
    flag: '🇨🇳',
    img: p('photo-1581092160562-40aa08e78837'),
    logoType: 'default',
    isVerified: true,
    industry: 'Consumer Electronics',
    productFocus: 'wireless earbuds power bank electronics OEM',
    sampleProduct: 'OEM TWS Earbuds & 20000mAh Power Banks',
  },
  {
    id: 'ref-mfr-guangzhouled',
    name: 'Guangzhou Bright LED Lighting Factory',
    slug: 'guangzhou-bright-led-lighting',
    country: 'China',
    flag: '🇨🇳',
    img: p('photo-1550985543-f47df4b4c4e0'),
    logoType: 'default',
    isVerified: true,
    industry: 'Consumer Electronics',
    productFocus: 'LED panel light strip lighting OEM',
    sampleProduct: 'Commercial LED Panel Lights (OEM Bulk)',
  },
  {
    id: 'ref-mfr-milanlaser',
    name: 'Milan United Laser Precision Ltd.',
    slug: 'milan-united-laser-precision',
    country: 'Italy',
    flag: '🇮🇹',
    img: p('photo-1581094794329-c8112a89af12'),
    logoType: 'default',
    isVerified: true,
    industry: 'Industrial Machinery',
    productFocus: 'CO2 laser acrylic engraver cutting',
    sampleProduct: 'CO2 Laser Acrylic Engraver 150W',
  },
  {
    id: 'ref-mfr-clevelandfood',
    name: 'Cleveland Royal Food Technology Co.',
    slug: 'cleveland-royal-food-tech',
    country: 'USA',
    flag: '🇺🇸',
    img: p('photo-1596040033229-a9821ebd058d'),
    logoType: 'default',
    isVerified: true,
    industry: 'Food Machinery',
    productFocus: 'commercial kitchen food processing line',
    sampleProduct: 'Commercial Vegetable Washing & Peeling Line',
  },
  {
    id: 'ref-mfr-osakainject',
    name: 'Osaka Summit Injection Enterprises',
    slug: 'osaka-summit-injection',
    country: 'Japan',
    flag: '🇯🇵',
    img: p('photo-1565043666747-69f6646db940'),
    logoType: 'default',
    isVerified: true,
    industry: 'Industrial Machinery',
    productFocus: 'PET preform injection molding machine',
    sampleProduct: 'High Speed PET Preform Injection Molding Machine',
  },
  {
    id: 'ref-mfr-ahmedabadpump',
    name: 'Ahmedabad Nova Pumps Enterprises Ltd.',
    slug: 'ahmedabad-nova-pumps',
    country: 'India',
    flag: '🇮🇳',
    img: p('photo-1579482495398-a28a2a0ebae7'),
    logoType: 'default',
    isVerified: true,
    industry: 'Industrial Machinery',
    productFocus: 'cast steel flanged gate valve pump',
    sampleProduct: 'Cast Steel Flanged Gate Valve DN100',
  },
  {
    id: 'ref-mfr-foshanfurn',
    name: 'Foshan Modern Workspace Furniture Co.',
    slug: 'foshan-modern-workspace-furniture',
    country: 'China',
    flag: '🇨🇳',
    img: p('photo-1586023492125-27b2c045efd7'),
    logoType: 'default',
    isVerified: true,
    industry: 'Furniture',
    productFocus: 'ergonomic office chair banquet furniture OEM',
    sampleProduct: 'Ergonomic Mesh Office Chair Executive Series',
  },
  {
    id: 'ref-mfr-morbitile',
    name: 'Morbi Ceramic Tile Consortium',
    slug: 'morbi-ceramic-tile-consortium',
    country: 'India',
    flag: '🇮🇳',
    img: p('photo-1565193566173-7a0ee3dbe261'),
    logoType: 'default',
    isVerified: true,
    industry: 'Building Materials',
    productFocus: 'ceramic porcelain floor tile export',
    sampleProduct: 'Ceramic Floor Tiles 60×60 Matt Porcelain Bulk',
  },
  {
    id: 'ref-mfr-shenzhenev',
    name: 'Shenzhen VoltCharge Mobility Co.',
    slug: 'shenzhen-voltcharge-mobility',
    country: 'China',
    flag: '🇨🇳',
    img: p('photo-1593941707882-a5bba14938c7'),
    logoType: 'default',
    isVerified: true,
    industry: 'Automotive',
    productFocus: 'EV DC fast charger CCS2 station',
    sampleProduct: 'EV Fast DC Charger Station 60kW–120kW',
  },
  {
    id: 'ref-mfr-vietnamcashew',
    name: 'Binh Phuoc Cashew Export JSC',
    slug: 'binh-phuoc-cashew-export',
    country: 'Vietnam',
    flag: '🇻🇳',
    img: p('photo-1508747703725-719777637510'),
    logoType: 'default',
    isVerified: true,
    industry: 'Agriculture & Food',
    productFocus: 'raw cashew nuts WW320 export',
    sampleProduct: 'Raw Cashew Nuts WW320 Export Grade',
  },
  {
    id: 'ref-mfr-keralanature',
    name: 'Kerala Nature Extracts Pvt Ltd',
    slug: 'kerala-nature-extracts',
    country: 'India',
    flag: '🇮🇳',
    img: p('photo-1608571423902-eed4a5ad8108'),
    logoType: 'default',
    isVerified: true,
    industry: 'Beauty & Personal Care',
    productFocus: 'organic essential oil cosmetic extract',
    sampleProduct: 'Cold-Pressed Organic Essential Oil Collection',
  },
  {
    id: 'ref-mfr-tianjinsteel',
    name: 'Tianjin Structural Scaffold Steel Co.',
    slug: 'tianjin-structural-scaffold-steel',
    country: 'China',
    flag: '🇨🇳',
    img: p('photo-1504307651254-35680f356dfd'),
    logoType: 'default',
    isVerified: true,
    industry: 'Construction',
    productFocus: 'galvanized scaffolding frame system',
    sampleProduct: 'Industrial Metal Scaffolding Frame System',
  },
  {
    id: 'ref-mfr-wuyikitchen',
    name: 'Wuyi Kitchenware Export Group',
    slug: 'wuyi-kitchenware-export',
    country: 'China',
    flag: '🇨🇳',
    img: p('photo-1556910103-1c02745aae4d'),
    logoType: 'default',
    isVerified: true,
    industry: 'Home & Kitchen',
    productFocus: 'cookware kitchen sink stainless OEM',
    sampleProduct: 'Non-Stick Hard Anodized Cookware Set 10-Piece',
  },
  {
    id: 'ref-mfr-yixinggarden',
    name: 'Yixing Garden Ceramics Factory',
    slug: 'yixing-garden-ceramics',
    country: 'China',
    flag: '🇨🇳',
    img: p('photo-1416879595882-3373a0480b5b'),
    logoType: 'default',
    isVerified: true,
    industry: 'Home & Garden',
    productFocus: 'ceramic planter garden tool kits',
    sampleProduct: 'Outdoor Ceramic Planters & Garden Tool Kits',
  },
  {
    id: 'ref-mfr-nordic',
    name: 'Nordic Heavy Industrial AB',
    slug: 'nordic-heavy-industrial',
    country: 'Sweden',
    flag: '🇸🇪',
    img: p('photo-1513828583688-c52646db42da'),
    logoType: 'default',
    isVerified: true,
    industry: 'Heavy Machinery',
    productFocus: 'excavator rock breaker attachment',
    sampleProduct: 'Hydraulic Excavator Attachment Breaker Kit',
  },
  {
    id: 'ref-mfr-wuxipack',
    name: 'Wuxi Beauty Packaging Glass Co.',
    slug: 'wuxi-beauty-packaging-glass',
    country: 'China',
    flag: '🇨🇳',
    img: p('photo-1522335789203-aabd1fc54bc9'),
    logoType: 'default',
    isVerified: true,
    industry: 'Packaging',
    productFocus: 'cosmetic jar glass dropper bottles',
    sampleProduct: 'Cosmetic Cream Jar PET / Glass Private Label',
  },
];

/** True when URL is a reliable cover (Unsplash / known good CDN), not blocked Pixabay hotlinks */
function isReliableCoverUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.includes('cdn.pixabay.com') || url.includes('pixabay.com/photo')) return false;
  if (url.startsWith('data:image')) return false;
  return url.startsWith('http');
}

/** Assign a unique cover image that has not already been used in the current pool */
function assignUniqueCover(usedImages: Set<string>, preferred?: string | null, seedIndex = 0): string {
  if (preferred && isReliableCoverUrl(preferred) && !usedImages.has(preferred)) {
    usedImages.add(preferred);
    return preferred;
  }
  const pool = DISTINCT_PIXABAY_COMPANY_IMAGES;
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[(seedIndex + i) % pool.length];
    if (!usedImages.has(candidate)) {
      usedImages.add(candidate);
      return candidate;
    }
  }
  // Exhausted pool — still return a deterministic image (rare with 36+ assets)
  const fallback = pool[seedIndex % pool.length];
  usedImages.add(fallback);
  return fallback;
}

/**
 * Resolve an Alibaba-benchmarked product/commodity photo for a supplier card.
 * Prefer product imagery over generic facility landscapes.
 */
function resolveSupplierProductImage(
  industry: string,
  productFocus: string,
  id: string,
  usedImages: Set<string>
): string {
  const matched = matchProductImage({
    id,
    name: productFocus || industry,
    category: industry,
  });
  const candidates = [
    matched.primaryImage,
    ...(matched.galleryImages || []),
  ].filter((url) => url && isReliableCoverUrl(url) && !usedImages.has(url));

  if (candidates[0]) {
    usedImages.add(candidates[0]);
    return candidates[0];
  }
  return assignUniqueCover(usedImages, null, usedImages.size);
}

/**
 * Hydrate catalog: prefer curated Alibaba-style product photos first,
 * fall back to keyword-matched commodity images only if needed for uniqueness.
 */
function hydrateSupplierCatalog(seed: number): DisplaySupplier[] {
  const usedImages = new Set<string>();
  const hydrated = REFERENCE_SUPPLIERS_RAW.map((raw, idx) => {
    const industry = raw.industry || 'Industrial Manufacturing';
    const productFocus = raw.productFocus || industry;
    let img = raw.img;
    if (!isReliableCoverUrl(img) || usedImages.has(img)) {
      img = resolveSupplierProductImage(industry, productFocus, `${raw.id}-${seed}-${idx}`, usedImages);
    } else {
      usedImages.add(img);
    }
    return { ...raw, img, tags: raw.industry ? [raw.industry] : undefined } as DisplaySupplier;
  });
  return shuffleWithSeed(hydrated, seed);
}

const REFERENCE_SUPPLIERS: DisplaySupplier[] = hydrateSupplierCatalog(42);

/** Pick up to `count` suppliers with unique images from a rotated pool */
function pickUniqueBatch(pool: DisplaySupplier[], offset: number, count: number): DisplaySupplier[] {
  if (pool.length === 0) return [];
  const start = ((offset % pool.length) + pool.length) % pool.length;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  const seenImg = new Set<string>();
  const seenId = new Set<string>();
  const batch: DisplaySupplier[] = [];

  for (const s of rotated) {
    if (batch.length >= count) break;
    if (seenId.has(s.id) || seenImg.has(s.img)) continue;
    seenId.add(s.id);
    seenImg.add(s.img);
    batch.push(s);
  }

  // If country filter left too few unique images, fill without image collision when possible
  if (batch.length < count) {
    for (const s of REFERENCE_SUPPLIERS) {
      if (batch.length >= count) break;
      if (seenId.has(s.id) || seenImg.has(s.img)) continue;
      seenId.add(s.id);
      seenImg.add(s.img);
      batch.push(s);
    }
  }

  return batch;
}

function preloadImages(urls: string[]) {
  if (typeof window === 'undefined') return;
  urls.forEach((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = optimizeCatalogUrl(src);
  });
}

const COUNTRY_TABS = [
  { key: 'all', label: 'All Global', flag: '🌐' },
  { key: 'India', label: 'India', flag: '🇮🇳' },
  { key: 'China', label: 'China', flag: '🇨🇳' },
  { key: 'USA', label: 'USA', flag: '🇺🇸' },
  { key: 'Germany', label: 'Germany', flag: '🇩🇪' },
  { key: 'UAE', label: 'UAE', flag: '🇦🇪' },
  { key: 'Japan', label: 'Japan', flag: '🇯🇵' },
  { key: 'South Korea', label: 'South Korea', flag: '🇰🇷' },
];

/**
 * Custom High-Resolution Vector Brand Logo Renderer
 * Matches the exact aesthetic in the reference mockup
 */
/** The initials on a dark tile, used when a supplier has no logo or its logo does not load */
function SupplierMonogram({ name }: { name: string }) {
  return (
    <div className="vs-monogram select-none">
      <span>{name.substring(0, 2).toUpperCase()}</span>
    </div>
  );
}

function SupplierLogoImage({ supplier }: { supplier: DisplaySupplier }) {
  const [failed, setFailed] = useState(false);
  if (failed || !supplier.logoUrl) return <SupplierMonogram name={supplier.name} />;
  return (
    <img
      src={supplier.logoUrl}
      alt={supplier.name}
      className="w-full h-full object-contain p-0.5"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function SupplierBrandLogo({ supplier }: { supplier: DisplaySupplier }) {
  if (supplier.logoUrl) {
    return <SupplierLogoImage supplier={supplier} />;
  }

  switch (supplier.logoType) {
    case 'aubc':
      // Card 1: AUBC / ABC monogram with navy blue shield/typography
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center select-none">
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <rect width="40" height="40" rx="8" fill="#F8FAFC" />
            <path
              d="M12 28L20 12L28 28H23.5L20 20.5L16.5 28H12Z"
              fill="#0F172A"
            />
            <path
              d="M20 22L17.5 27H22.5L20 22Z"
              fill="#FF5A00"
            />
            <text
              x="20"
              y="36"
              textAnchor="middle"
              fontSize="7.5"
              fontWeight="900"
              fill="#0F172A"
              letterSpacing="0.5"
            >
              AUBC
            </text>
          </svg>
        </div>
      );

    case 'orange_box':
      // Card 2: Global Pack Solutions - vibrant orange 3D isometric box package
      return (
        <div className="w-full h-full flex items-center justify-center select-none">
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <rect width="40" height="40" rx="8" fill="#FFF7ED" />
            {/* 3D Isometric Open Box */}
            <path
              d="M20 9L31 15.5V28L20 34.5L9 28V15.5L20 9Z"
              fill="#EA580C"
            />
            <path
              d="M20 9L31 15.5L20 22L9 15.5L20 9Z"
              fill="#FB923C"
            />
            <path
              d="M20 22V34.5L9 28V15.5L20 22Z"
              fill="#C2410C"
            />
            <path
              d="M20 22L31 15.5V28L20 34.5V22Z"
              fill="#EA580C"
            />
            {/* Box tape strip */}
            <path
              d="M16 11.5L24 16.2M20 18.5V32"
              stroke="#FED7AA"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      );

    case 'orange_bolt':
      // Card 3: Shakti Electricals - solid brand orange lightning bolt
      return (
        <div className="w-full h-full flex items-center justify-center select-none">
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <rect width="40" height="40" rx="8" fill="#FFF7ED" />
            <path
              d="M22 6L11 21H19L17 34L29 17H20L22 6Z"
              fill="#FF5A00"
            />
          </svg>
        </div>
      );

    case 'green_leaf':
      // Rheinland Bio-Polymer - German eco leaf & helix
      return (
        <div className="w-full h-full flex items-center justify-center select-none">
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <rect width="40" height="40" rx="8" fill="#F0FDF4" />
            <path
              d="M20 8C20 8 30 14 30 24C30 29.5 25.5 34 20 34C14.5 34 10 29.5 10 24C10 14 20 8 20 8Z"
              fill="#16A34A"
            />
            <path
              d="M20 12V32M20 18L26 14M20 24L14 20M20 28L25 25"
              stroke="#BBF7D0"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      );

    case 'timber':
      // Pacific Northwest Timber Corp. - evergreen spruce tree
      return (
        <div className="w-full h-full flex items-center justify-center select-none">
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <rect width="40" height="40" rx="8" fill="#ECFDF5" />
            <path
              d="M20 7L27 15H24L29 22H25L30 29H10L15 22H11L16 15H13L20 7Z"
              fill="#065F46"
            />
            <rect x="18" y="29" width="4" height="6" rx="1" fill="#78350F" />
          </svg>
        </div>
      );

    case 'red_sun':
      // Nippon Precision Optics - precision aperture lens
      return (
        <div className="w-full h-full flex items-center justify-center select-none">
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <rect width="40" height="40" rx="8" fill="#FEF2F2" />
            <circle cx="20" cy="20" r="13" stroke="#DC2626" strokeWidth="3" />
            <circle cx="20" cy="20" r="6" fill="#DC2626" />
            <line x1="20" y1="3" x2="20" y2="7" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
            <line x1="20" y1="33" x2="20" y2="37" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
            <line x1="3" y1="20" x2="7" y2="20" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
            <line x1="33" y1="20" x2="37" y2="20" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );

    case 'golden_flame':
      // Emirates Petrochem - golden refinery flame
      return (
        <div className="w-full h-full flex items-center justify-center select-none">
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <rect width="40" height="40" rx="8" fill="#FFFBEB" />
            <path
              d="M20 7C20 7 28 15 28 23C28 27.5 24.5 33 20 33C15.5 33 12 27.5 12 23C12 15 20 7 20 7Z"
              fill="#D97706"
            />
            <path
              d="M20 16C20 16 24 21 24 25C24 27.5 22 30 20 30C18 30 16 27.5 16 25C16 21 20 16 20 16Z"
              fill="#FDE68A"
            />
          </svg>
        </div>
      );

    case 'cyan_circuit':
      // Hana Smart Energy - smart battery/chip circuit with orange accents
      return (
        <div className="w-full h-full flex items-center justify-center select-none">
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <rect width="40" height="40" rx="8" fill="#FFF7ED" />
            <rect x="11" y="11" width="18" height="18" rx="4" fill="#EA580C" />
            <path
              d="M16 11V7M24 11V7M16 33V29M24 33V29M7 16H11M7 24H11M29 16H33M29 24H33"
              stroke="#FF5A00"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M16 20L19 23L24 17"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      );

    default:
      // Clean fallback monogram badge
      return <SupplierMonogram name={supplier.name} />;
  }
}

/** Make a name short enough for a card label: drop brackets, keep the first part, trim at a word. */
function shortTag(value?: string | null, max = 22): string {
  let text = (value || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  text = text.split(/\s[-–·|]\s|,|;/)[0].trim();
  if (text.length > max) {
    const cut = text.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    text = (lastSpace > 8 ? cut.slice(0, lastSpace) : cut).trim();
  }
  return text;
}

/** Short labels for a company's card: its industry first, then the things it makes. */
function companyTags(c: Company): string[] {
  const extra = c as Company & { industry?: string; subcategory?: string };
  const seen = new Set<string>();
  const tags: string[] = [];
  const add = (value?: string | null) => {
    const tag = shortTag(value);
    if (!tag || seen.has(tag.toLowerCase())) return;
    seen.add(tag.toLowerCase());
    tags.push(tag);
  };
  add(extra.industry);
  add(extra.subcategory);
  (c.key_products || []).forEach(add);
  // companies that list no products still say what kind of business they are
  if (tags.length < 2) add(c.business_type);
  if (tags.length < 2) add(c.production_capacity);
  return tags.slice(0, 3);
}

function hasFacts(s: DisplaySupplier): boolean {
  return s.yearsInBusiness != null || s.totalProducts != null || Boolean(s.exportsGlobally);
}

export default function VerifiedSuppliersSection() {
  const navigate = useNavigate();
  // Fresh unique catalog + offset every page open / refresh (no blank first paint)
  const visitSeedRef = useRef<number>(createVisitSeed());
  const [suppliers, setSuppliers] = useState<DisplaySupplier[]>(() =>
    hydrateSupplierCatalog(visitSeedRef.current)
  );
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 30-second live auto-update rotation cycle (temporary simulation, production-ready)
  const [secondsLeft, setSecondsLeft] = useState(ROTATION_SECONDS);
  const [rotationOffset, setRotationOffset] = useState(
    () => visitSeedRef.current % Math.max(1, REFERENCE_SUPPLIERS_RAW.length)
  );
  const [isRotating, setIsRotating] = useState(false);
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advanceBatch = useCallback((step = DISPLAY_COUNT) => {
    setIsRotating(true);
    setRotationOffset((r) => r + step);
    setSecondsLeft(ROTATION_SECONDS);
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    rotateTimerRef.current = setTimeout(() => setIsRotating(false), 450);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Defer batch advance so we don't update unrelated state inside this setter
          queueMicrotask(() => advanceBatch(DISPLAY_COUNT));
          return ROTATION_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      clearInterval(timer);
      if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    };
  }, [advanceBatch]);

  const handleManualRotate = () => advanceBatch(DISPLAY_COUNT);

  // Load database suppliers and merge with visit-randomized simulation catalog
  const loadSuppliers = useCallback(async () => {
    setError(null);
    try {
      let dbCompanies: Company[] = [];
      try {
        dbCompanies = await getCompanies({ verified: true, limit: 24 });
      } catch (err) {
        console.warn('Could not fetch companies from DB, using simulation catalog:', err);
      }

      const seed = visitSeedRef.current;
      const formatted: DisplaySupplier[] = [];
      const seenNames = new Set<string>();
      const usedImages = new Set<string>();

      // 1. Visit-shuffled curated suppliers with Alibaba-benchmarked product photos
      hydrateSupplierCatalog(seed).forEach((ref) => {
        if (!seenNames.has(ref.name.toLowerCase())) {
          seenNames.add(ref.name.toLowerCase());
          usedImages.add(ref.img);
          formatted.push(ref);
        }
      });

      // 2. Supplement with verified DB companies — product-matched unique images
      if (Array.isArray(dbCompanies) && dbCompanies.length > 0) {
        const shuffledDb = shuffleWithSeed(dbCompanies, seed ^ 0x9e3779b9);
        shuffledDb.forEach((c, idx) => {
          if (seenNames.has(c.company_name.toLowerCase())) return;
          seenNames.add(c.company_name.toLowerCase());
          const country = c.country || 'India';
          const industry = c.business_type || 'Industrial Manufacturing';
          const preferred =
            (isReliableCoverUrl(c.cover_url) ? c.cover_url : null) ||
            (isReliableCoverUrl(c.banner_url) ? c.banner_url : null);

          const years =
            c.years_in_business ?? (c.year_established ? new Date().getFullYear() - c.year_established : undefined);
          formatted.push({
            id: c.id,
            name: c.company_name,
            slug: c.slug,
            country,
            flag: COUNTRY_FLAGS[country] || '🌐',
            img: preferred && !usedImages.has(preferred)
              ? (() => { usedImages.add(preferred); return preferred; })()
              : resolveSupplierProductImage(industry, industry, `${c.id}-${seed}-${idx}`, usedImages),
            logoUrl: c.logo_url || undefined,
            logoType: 'default',
            isVerified: true,
            industry,
            productFocus: industry,
            sampleProduct: `${industry} · OEM / Wholesale Lot`,
            tags: companyTags(c),
            yearsInBusiness: years && years > 0 ? years : undefined,
            totalProducts: c.total_products && c.total_products > 0 ? c.total_products : undefined,
            exportsGlobally: (c.export_destinations?.length ?? 0) > 0,
          });
        });
      }

      // Cards with company facts (years, products, exports) come first, so the cards match the design;
      // the hand-written reference suppliers, which carry none, follow.
      const withFacts = formatted.filter(hasFacts);
      const withoutFacts = formatted.filter((s) => !hasFacts(s));
      setSuppliers([
        ...shuffleWithSeed(withFacts, seed ^ 0x85ebca6b),
        ...shuffleWithSeed(withoutFacts, seed ^ 0x85ebca6b),
      ]);
      setRotationOffset(0);
    } catch (err) {
      console.error('Failed to load verified suppliers', err);
      setError('Unable to load verified suppliers.');
      setSuppliers(hydrateSupplierCatalog(visitSeedRef.current));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // Filter by country, then rotate unique 8-card batches every 30s
  const displayedSuppliers = useMemo(() => {
    let pool = suppliers;
    if (selectedCountry !== 'all') {
      const filtered = suppliers.filter(
        (s) => s.country.toLowerCase() === selectedCountry.toLowerCase()
      );
      if (filtered.length >= 3) {
        pool = filtered;
      } else {
        const refMatch = REFERENCE_SUPPLIERS.filter(
          (s) => s.country.toLowerCase() === selectedCountry.toLowerCase()
        );
        const combined = [...filtered];
        const seen = new Set(combined.map((s) => s.name.toLowerCase()));
        refMatch.forEach((r) => {
          if (!seen.has(r.name.toLowerCase())) {
            seen.add(r.name.toLowerCase());
            combined.push(r);
          }
        });
        pool = combined.length > 0 ? combined : suppliers;
      }
    }

    return pickUniqueBatch(pool, rotationOffset, DISPLAY_COUNT);
  }, [suppliers, selectedCountry, rotationOffset]);

  // Preload current + next batch so first paint and 30s swap stay smooth
  useEffect(() => {
    const current = pickUniqueBatch(suppliers, rotationOffset, DISPLAY_COUNT);
    const next = pickUniqueBatch(suppliers, rotationOffset + DISPLAY_COUNT, DISPLAY_COUNT);
    preloadImages([...current, ...next].map((s) => s.img));
  }, [suppliers, rotationOffset]);

  const handleViewProducts = (s: DisplaySupplier) => {
    if (s.slug) {
      navigate(`/manufacturers/${s.slug}`);
    } else {
      navigate(`/products?company=${s.id}`);
    }
  };

  // The chips after "All Global" are the first four countries of the tab list; the rest go in the "More" menu
  const chips: CountryChip[] = COUNTRY_TABS.slice(1, 5);
  const moreChips = useMemo<CountryChip[]>(() => {
    const shown = new Set(COUNTRY_TABS.map((t) => t.key.toLowerCase()));
    const rest: CountryChip[] = COUNTRY_TABS.slice(5);
    const extra = new Map<string, CountryChip>();
    suppliers.forEach((s) => {
      const key = s.country;
      if (!key || shown.has(key.toLowerCase()) || extra.has(key.toLowerCase())) return;
      extra.set(key.toLowerCase(), { key, label: key, flag: COUNTRY_FLAGS[key] || s.flag || '🌐' });
    });
    return [...rest, ...Array.from(extra.values()).sort((a, b) => a.label.localeCompare(b.label))];
  }, [suppliers]);

  return (
    <SuppliersShowcase
      suppliers={displayedSuppliers}
      selectedCountry={selectedCountry}
      onCountryChange={setSelectedCountry}
      chips={chips}
      moreChips={moreChips}
      secondsLeft={secondsLeft}
      isRefreshing={isRotating}
      onRefresh={handleManualRotate}
      error={error}
      onRetry={loadSuppliers}
      onOpenSupplier={handleViewProducts}
      renderLogo={(s) => <SupplierBrandLogo supplier={s} />}
    />
  );
}
