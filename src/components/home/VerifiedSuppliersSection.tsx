/**
 * VerifiedSuppliersSection - Exact Redesign matching reference mockup (file_00000000825482068b8a3f7235eeb10d.png)
 *
 * Requirements:
 * - Section Header:
 *   - "Verified Suppliers" in bold white text
 *   - Orange circular verified checkmark badge icon right next to title
 *   - "View All ->" link in brand orange on the right
 * - Card Architecture:
 *   - Modern factory exterior photograph at top (aspect 16/10)
 *   - Dark card container (bg-[#C94400] with border border-[#2A2A2A])
 *   - Horizontal identity row:
 *     - Square white company logo box on left
 *     - Bold company name (e.g. ABC Industries Private Limited, Global Pack Solutions, Shakti Electricals)
 *     - Country flag + Country name in muted text
 *     - Orange "Verified Supplier" status badge with checkmark icon
 *   - Action Button:
 *     - Full-width dark button: "View Products >" linking to supplier catalog/profile
 * - Responsive:
 *   - Mobile: Horizontal touch swipe carousel with snap scrolling and partial card peek
 *   - Desktop: Responsive 3 to 4 column grid
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Building2,
  RefreshCw,
  ShieldCheck,
  Globe,
  Layers,
  Users,
  Heart,
  Box,
  MessageSquare,
  ChevronDown,
  Settings2,
} from 'lucide-react';
import { getCompanies } from '@/lib/api';
import { findMockupCompany } from '@/data/mockupVerifiedSuppliers';
import { SUPPLIER_CARD_THEMES } from '@/lib/supplierCardThemes';
import { DISTINCT_PIXABAY_COMPANY_IMAGES, isGenericImage } from '@/lib/contentImages';
import { matchProductImage } from '@/lib/productImageMatchingEngine';
import type { Company } from '@/types/types';

export interface DisplaySupplier {
  id: string;
  name: string;
  slug?: string;
  /** True only when a public company profile exists for `slug` (database company or verified showcase profile). */
  hasProfile?: boolean;
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
}

/** Shrink Unsplash/CDN payloads for card thumbnails (~40–80KB vs 300KB+) */
function optimizeCatalogUrl(url: string): string {
  if (!url) return url;
  if (url.includes('images.unsplash.com')) {
    try {
      const u = new URL(url);
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'crop');
      u.searchParams.set('w', '480');
      u.searchParams.set('h', '300');
      u.searchParams.set('q', '70');
      u.searchParams.set('fm', 'webp');
      return u.toString();
    } catch {
      return url;
    }
  }
  return url;
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

/* ---------- Theme-matched photos for supplier cards (see supplierCardThemes.ts) ---------- */

/**
 * Pick a photo for a supplier card from the theme whose keywords best match the
 * supplier's product focus. Returns null when no theme matches (caller falls back).
 */
function pickThemeImage(productFocus: string, industry: string, usedImages: Set<string>, seedIndex: number): string | null {
  const words = `${productFocus} ${industry}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let best: { theme: (typeof SUPPLIER_CARD_THEMES)[number]; score: number } | null = null;
  for (const theme of SUPPLIER_CARD_THEMES) {
    const score = theme.keywords.reduce((n, kw) => n + (words.includes(kw) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { theme, score };
  }
  if (!best || best.theme.photos.length === 0) return null;

  const photos = best.theme.photos;
  for (let i = 0; i < photos.length; i++) {
    const candidate = photos[(seedIndex + i) % photos.length];
    if (!usedImages.has(candidate)) {
      usedImages.add(candidate);
      return candidate;
    }
  }
  // Every photo in this theme is already on the page: reuse one rather than show an unrelated image
  const reused = photos[seedIndex % photos.length];
  usedImages.add(reused);
  return reused;
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
    // Prefer a real catalog photo of this product; fall back to the curated image only when none matches.
    let img: string | null = pickThemeImage(productFocus, industry, usedImages, seed + idx);
    if (!img) {
      if (!isReliableCoverUrl(raw.img) || usedImages.has(raw.img)) {
        img = resolveSupplierProductImage(industry, productFocus, `${raw.id}-${seed}-${idx}`, usedImages);
      } else {
        usedImages.add(raw.img);
        img = raw.img;
      }
    }
    // Curated cards only link to a profile page when that profile actually exists.
    return { ...raw, img, hasProfile: Boolean(raw.slug && findMockupCompany(raw.slug)) } as DisplaySupplier;
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
    if (!src || isGenericImage(src)) return;
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

const SUPPLIER_STATS = [
  { icon: Users, value: '10,000+', label: 'Verified Suppliers' },
  { icon: Globe, value: '120+', label: 'Countries' },
  { icon: Layers, value: '50+', label: 'Industries' },
  { icon: ShieldCheck, value: '100%', label: 'Verified Profiles' },
];

/** One supplier card in the reference design (image, logo, details, stats, actions). */
// Cover pictures from the Verified Suppliers design, used when a supplier has not uploaded its own
const DESIGN_COVERS = { factory: '/home-design/sup-cover-factory.jpg', tower: '/home-design/sup-cover-tower.jpg' };

function isOwnStorageImage(url?: string | null): boolean {
  return !!url && (url.startsWith('/') || /\.supabase\.co\/storage\/v1\/object\//.test(url) || /bulkskart\.com/.test(url));
}

function coverFor(s: DisplaySupplier, index: number): string {
  // Each supplier keeps its own photo (its upload, or the photo matched to its industry),
  // so cards don't repeat; the design covers are only used when there is no photo at all
  if (s.img && (isOwnStorageImage(s.img) || /^https:\/\//.test(s.img))) return s.img;
  return designCoverFor(index);
}

function designCoverFor(index: number): string {
  return index % 2 === 0 ? DESIGN_COVERS.tower : DESIGN_COVERS.factory;
}

/** "ABC Industries Private Limited" → "ABC", "Apex Manufacturing Dynamics Inc." → "APEX", "Shenzhen Nova Consumer" → "SNC" */
function logoWord(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return name.slice(0, 3).toUpperCase();
  if (words[0].length <= 4) return words[0].toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
}

function SupplierCardDesign({
  supplier: s,
  index,
  dimmed,
  onOpen,
  onInquiry,
}: {
  supplier: DisplaySupplier;
  index: number;
  dimmed: boolean;
  onOpen: () => void;
  onInquiry: () => void;
}) {
  const [saved, setSaved] = useState(false);
  // a logo that does not load falls back to the company's letters
  const [logoFailed, setLogoFailed] = useState(false);
  const industryWord = (s.industry || 'Industrial').split(/[\s&,/]+/)[0];
  const hasLogo = s.logoUrl && !isGenericImage(s.logoUrl);
  return (
    <article
      className={`group relative flex w-[calc((100%-8px)/2)] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-[#FF6A14]/55 bg-gradient-to-b from-[#121826] to-[#0b0f18] shadow-[0_0_22px_-10px_rgba(255,90,0,0.8)] transition-all duration-300 hover:-translate-y-1 hover:border-[#FF5A00] md:w-auto ${
        dimmed ? 'opacity-70' : 'opacity-100'
      }`}
    >
      <div className="relative aspect-[2/1] w-full cursor-pointer overflow-hidden bg-[#0A0A0A]" onClick={onOpen}>
        <img src={coverFor(s, index)} alt="" onError={(e) => { const fb = designCoverFor(index); if (!e.currentTarget.src.endsWith(fb)) e.currentTarget.src = fb; }} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" loading={index < 4 ? 'eager' : 'lazy'} decoding="async" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#121826] to-transparent" />
        <span className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-gradient-to-b from-[#FF7A1A] to-[#F25600] px-1.5 py-[3px] text-[8px] font-bold text-white shadow-lg md:left-3 md:top-3 md:px-2.5 md:py-1 md:text-[11px]">
          <BadgeCheck className="h-2.5 w-2.5 md:h-3.5 md:w-3.5" aria-hidden="true" />
          Verified Manufacturer
        </span>
        <button
          type="button"
          aria-label={saved ? 'Remove from saved suppliers' : 'Save supplier'}
          aria-pressed={saved}
          onClick={e => { e.stopPropagation(); setSaved(v => !v); }}
          className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/25 bg-[#0A0A0A]/70 backdrop-blur-md transition-transform hover:scale-110 md:right-3 md:top-3 md:h-8 md:w-8"
        >
          <Heart className={`h-3 w-3 md:h-4 md:w-4 ${saved ? 'fill-[#FF5A00] text-[#FF5A00]' : 'text-white'}`} />
        </button>
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2.5 pt-2 md:px-4 md:pb-4 md:pt-3">
        <div className="flex items-start gap-1.5 md:gap-3">
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${s.name}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/20 bg-[#0b0b0b] md:h-14 md:w-14 md:rounded-xl"
          >
            {hasLogo && !logoFailed ? (
              <img src={s.logoUrl} alt="" className="h-full w-full object-contain p-0.5" loading="lazy" onError={() => setLogoFailed(true)} />
            ) : (
              <span className="text-[10px] font-black tracking-tight text-white md:text-[15px]">{logoWord(s.name)}</span>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <h3
              onClick={onOpen}
              title={s.name}
              className="line-clamp-2 cursor-pointer text-[11.5px] font-bold leading-tight text-white transition-colors group-hover:text-[#FF7A2E] md:text-[16px]"
            >
              {s.name}
            </h3>
            <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-white/85 md:mt-1 md:text-[13px]">
              <span className="text-[11px] leading-none md:text-[15px]">{s.flag}</span>
              <span className="truncate">{s.country}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[9.5px] font-semibold text-[#FF7A2E] md:mt-1 md:text-[13px]">
              <BadgeCheck className="h-3 w-3 fill-[#FF6A14] text-[#121826] md:h-4 md:w-4" aria-hidden="true" />
              <span>Verified Supplier</span>
            </div>
          </div>
        </div>

        <p className="mt-1.5 flex items-center gap-1 text-[9px] text-white/85 md:mt-3 md:gap-1.5 md:text-[13px]">
          <Building2 className="h-3 w-3 shrink-0 text-[#FF6A14] md:h-4 md:w-4" aria-hidden="true" />
          <span className="line-clamp-1">{s.industry || s.sampleProduct || 'Verified manufacturer'}</span>
        </p>

        <div className="mt-1.5 grid grid-cols-3 divide-x divide-white/15 rounded-lg border border-white/15 bg-black/20 py-1.5 md:mt-3 md:rounded-xl md:py-2.5">
          {[
            { icon: ShieldCheck, top: 'Verified', bottom: 'Profile' },
            { icon: Settings2, top: industryWord, bottom: 'Industry' },
            { icon: Globe, top: 'Global', bottom: 'Export' },
          ].map(({ icon: Icon, top, bottom }) => (
            <div key={bottom} className="flex min-w-0 items-center justify-center gap-0.5 px-0.5 md:gap-1.5">
              <Icon className="h-3 w-3 shrink-0 text-[#FF6A14] md:h-4 md:w-4" aria-hidden="true" />
              <span className="min-w-0 text-[7.5px] leading-tight text-white/90 md:text-[11.5px]">
                <span className="block truncate font-semibold">{top}</span>
                <span className="block text-white/65">{bottom}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-auto grid grid-cols-[1.1fr_1fr] gap-1 pt-2 md:gap-2 md:pt-4">
          <button
            type="button"
            onClick={onOpen}
            className="flex h-[26px] min-w-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-lg bg-gradient-to-b from-[#FF7A1A] to-[#F25600] px-1 text-[9px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(255,90,0,0.8)] transition-transform hover:-translate-y-0.5 md:h-10 md:rounded-xl md:text-[13px]"
          >
            <span className="truncate">View Products</span>
            <ArrowRight className="h-3 w-3 shrink-0 md:h-4 md:w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onInquiry}
            className="flex h-[26px] min-w-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-lg border border-white/30 px-1 text-[9px] font-bold text-white transition-colors hover:border-[#FF5A00] hover:text-[#FF7A2E] md:h-10 md:rounded-xl md:text-[13px]"
          >
            <MessageSquare className="h-3 w-3 shrink-0 md:h-4 md:w-4" aria-hidden="true" />
            <span className="truncate">Send Inquiry</span>
          </button>
        </div>
      </div>
    </article>
  );
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

  // Carousel position (0–3) drives the page dots under the cards.
  const [supplierPage, setSupplierPage] = useState(0);
  const handleSupplierScroll = () => {
    const el = supplierScrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setSupplierPage(max <= 0 ? 0 : Math.min(3, Math.round((el.scrollLeft / max) * 3)));
  };
  const scrollSupplierTo = (page: number) => {
    const el = supplierScrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: (max * page) / 3, behavior: 'smooth' });
  };

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

          formatted.push({
            id: c.id,
            name: c.company_name,
            slug: c.slug,
            hasProfile: Boolean(c.slug),
            country,
            flag: COUNTRY_FLAGS[country] || '🌐',
            img: preferred && !usedImages.has(preferred)
              ? (() => { usedImages.add(preferred); return preferred; })()
              : (pickThemeImage(industry, industry, usedImages, seed + idx) ??
                resolveSupplierProductImage(industry, industry, `${c.id}-${seed}-${idx}`, usedImages)),
            logoUrl: c.logo_url || undefined,
            logoType: 'default',
            isVerified: true,
            industry,
            productFocus: industry,
            sampleProduct: `${industry} · OEM / Wholesale Lot`,
          });
        });
      }

      setSuppliers(shuffleWithSeed(formatted, seed ^ 0x85ebca6b));
      setRotationOffset(seed % Math.max(1, formatted.length));
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
    // Only open a profile that exists; otherwise send the buyer to a product search
    // for this supplier's category instead of a "Manufacturer Not Found" page.
    if (s.slug && s.hasProfile) {
      navigate(`/manufacturers/${s.slug}`);
      return;
    }
    const query = s.productFocus || s.industry || s.name;
    navigate(`/products?q=${encodeURIComponent(query)}`);
  };

  const supplierScrollRef = useRef<HTMLDivElement>(null);

  const scrollSuppliers = (direction: 'left' | 'right') => {
    if (supplierScrollRef.current) {
      const scrollAmount = supplierScrollRef.current.clientWidth * 0.75;
      supplierScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
    advanceBatch(direction === 'left' ? -DISPLAY_COUNT : DISPLAY_COUNT);
  };

  // Inquiry: the supplier's own enquiry form when it has a profile, otherwise a general buying requirement
  const handleInquiry = (s: DisplaySupplier) => {
    const isDbCompany = /^[0-9a-f-]{36}$/i.test(s.id);
    navigate(s.hasProfile && isDbCompany ? `/post-requirement?supplier=${s.id}` : '/post-requirement');
  };

  const mainTabs = COUNTRY_TABS.slice(0, 4);
  const moreTabs = COUNTRY_TABS.slice(4);
  const moreSelected = moreTabs.find((t) => t.key === selectedCountry);
  const [moreOpen, setMoreOpen] = useState(false);
  const secondsAgo = ROTATION_SECONDS - secondsLeft;

  return (
    <section className="relative overflow-hidden border-b border-[#2A2A2A] bg-[#0a0d14] py-5 text-white sm:py-7 md:py-9" aria-labelledby="verified-suppliers-title">
      {/* port picture top right, fading into the dark */}
      <img
        src="/home-design/sup-port.jpg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-[130px] w-[34%] max-w-[420px] object-cover [mask-image:linear-gradient(90deg,transparent_0%,#000_40%),linear-gradient(0deg,transparent_0%,#000_45%)] [mask-composite:intersect] [-webkit-mask-composite:source-in] sm:h-[170px] md:h-[230px]"
        loading="lazy"
        decoding="async"
      />
      <div className="relative mx-auto w-full max-w-[1400px] px-2.5 sm:px-5 md:px-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-2.5 px-1 md:gap-4">
          <img src="/home-design/sup-shield.png" alt="" aria-hidden="true" className="h-[48px] w-[43px] shrink-0 object-contain md:h-[80px] md:w-[72px]" loading="lazy" />
          <div className="min-w-0">
            <h2 id="verified-suppliers-title" className="text-[27px] font-black leading-none tracking-tight min-[400px]:text-[29px] md:text-[48px]">
              Verified <span className="text-[#FF6A14]">Suppliers</span>
            </h2>
            <p className="mt-1 text-[12px] text-white/85 min-[400px]:text-[12.5px] md:text-[17px]">Trusted Manufacturers &amp; Exporters Worldwide</p>
          </div>
        </div>

        <ul className="mt-3 flex items-center md:mt-5">
          {['Verified Businesses', 'Genuine Manufacturers', 'Global Trade Ready'].map((text, i) => (
            <li key={text} className={`flex items-center gap-1 px-1.5 md:gap-2 md:px-4 ${i > 0 ? 'border-l border-white/25' : 'pl-1'}`}>
              <Check className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#FF6A14] p-[2px] text-white md:h-5 md:w-5 md:p-[3px]" strokeWidth={3} aria-hidden="true" />
              <span className="whitespace-nowrap text-[10px] text-white/90 min-[400px]:text-[10.5px] md:text-[15px]">{text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex md:mt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF5A00]/60 bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white md:px-3.5 md:py-1.5 md:text-[14px]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E5322D] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E5322D]" />
            </span>
            Live Updates: <span className="tabular-nums text-[#FF7A2E]">{secondsAgo <= 0 ? 'just now' : `${secondsAgo}s ago`}</span>
            <button
              type="button"
              onClick={handleManualRotate}
              aria-label="Show next suppliers"
              title="Show next suppliers"
              className={`ml-0.5 text-[#FF7A2E] transition-transform hover:text-white ${isRotating ? 'animate-spin' : 'hover:scale-110'}`}
            >
              <RefreshCw className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </button>
          </span>
        </div>

        {/* Stats */}
        <div className="mt-3 grid grid-cols-4 rounded-2xl border border-[#FF5A00]/45 bg-gradient-to-b from-[#141820] to-[#0b0e15] px-1 py-3 shadow-[0_0_30px_-14px_rgba(255,90,0,0.8)] md:mt-5 md:py-5">
          {SUPPLIER_STATS.map(({ icon: Icon, value, label }, i) => (
            <div key={label} className={`flex flex-col items-center px-1 text-center ${i > 0 ? 'border-l border-white/10' : ''}`}>
              <Icon className="h-[22px] w-[22px] text-[#FF6A14] md:h-8 md:w-8" strokeWidth={1.6} aria-hidden="true" />
              <span className="mt-1 text-[16px] font-extrabold leading-none min-[400px]:text-[17px] md:mt-2 md:text-[30px]">{value}</span>
              <span className="mt-1 max-w-[80px] text-[9.5px] leading-tight text-white/80 min-[400px]:text-[10.5px] md:max-w-none md:text-[15px]">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Country chips ── */}
        <div className="relative mt-3 flex items-center gap-1.5 md:mt-5 md:gap-3">
          {mainTabs.map(tab => {
            const active = selectedCountry === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={active}
                onClick={() => { setSelectedCountry(tab.key); setMoreOpen(false); }}
                className={`flex h-[32px] shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-semibold transition-colors md:h-11 md:px-5 md:text-[15px] ${
                  active
                    ? 'border-transparent bg-gradient-to-b from-[#FF7A1A] to-[#F25600] text-white shadow-[0_0_16px_-4px_rgba(255,90,0,0.9)]'
                    : 'border-white/25 bg-[#0d1119] text-white hover:border-[#FF5A00]/70'
                }`}
              >
                {tab.key === 'all' ? <Globe className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" /> : <span className="text-[14px] leading-none md:text-[17px]">{tab.flag}</span>}
                <span>{tab.label}</span>
              </button>
            );
          })}
          <div className="relative">
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen(o => !o)}
              className={`flex h-[32px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-semibold transition-colors md:h-11 md:px-5 md:text-[15px] ${
                moreSelected ? 'border-transparent bg-gradient-to-b from-[#FF7A1A] to-[#F25600] text-white' : 'border-white/25 bg-[#0d1119] text-white hover:border-[#FF5A00]/70'
              }`}
            >
              {moreSelected ? <><span className="text-[14px] leading-none">{moreSelected.flag}</span>{moreSelected.label}</> : 'More'}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
            {moreOpen && (
              <div role="menu" className="absolute right-0 z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-white/15 bg-[#111622] py-1 shadow-2xl">
                {moreTabs.map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    role="menuitem"
                    onClick={() => { setSelectedCountry(tab.key); setMoreOpen(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-white/10 ${selectedCountry === tab.key ? 'font-bold text-[#FF7A2E]' : 'text-white'}`}
                  >
                    <span className="text-[15px] leading-none">{tab.flag}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Error with retry ── */}
        {error && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-[#FF5A00]/50 bg-[#B33D00]/40 p-3 text-xs text-[#FF7A2E] sm:text-sm">
            <span>{error}</span>
            <button
              type="button"
              onClick={loadSuppliers}
              className="flex items-center gap-1 rounded-lg bg-[#B33D00] px-3 py-1 font-semibold text-white transition-colors hover:bg-[#C94400]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {/* ── Supplier cards: two per view on phones, four per row on wide screens ── */}
        {loading ? (
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4 md:gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-[260px] animate-pulse rounded-2xl border border-white/10 bg-[#121826] md:h-[380px]" />
            ))}
          </div>
        ) : displayedSuppliers.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#121826] p-6 py-12 text-center">
            <Building2 className="mx-auto mb-2 h-10 w-10 text-[#FF5A00] opacity-80" />
            <p className="text-sm font-semibold text-white">No verified suppliers found for this region.</p>
            <button
              type="button"
              onClick={() => setSelectedCountry('all')}
              className="mt-3 rounded-xl bg-[#C94400] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#ff7429]"
            >
              Show All Global Suppliers
            </button>
          </div>
        ) : (
          <>
            <div
              ref={supplierScrollRef}
              onScroll={handleSupplierScroll}
              className="mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-2 pt-1 scrollbar-none md:grid md:grid-cols-2 md:gap-4 md:overflow-visible lg:grid-cols-4"
            >
              {displayedSuppliers.map((s, idx) => (
                <SupplierCardDesign
                  key={`${s.id}-${idx}`}
                  supplier={s}
                  index={idx}
                  dimmed={isRotating}
                  onOpen={() => handleViewProducts(s)}
                  onInquiry={() => handleInquiry(s)}
                />
              ))}
            </div>

            {/* Page dots (follow the carousel position) */}
            <div className="mt-3 flex items-center justify-center gap-2 md:hidden">
              {[0, 1, 2, 3].map(i => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Show suppliers page ${i + 1}`}
                  aria-current={supplierPage === i ? 'true' : undefined}
                  onClick={() => scrollSupplierTo(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${supplierPage === i ? 'w-6 bg-[#FF6A14]' : 'w-2 bg-white/35 hover:bg-white/60'}`}
                />
              ))}
            </div>

            <div className="mt-5 flex justify-center">
              <Link
                to="/manufacturers"
                className="group flex h-11 items-center gap-2 rounded-xl border border-[#FF5A00]/60 bg-[#FF5A00]/5 px-6 text-[13px] font-bold text-[#FF7A2E] transition-all hover:border-[#FF5A00] hover:bg-[#B33D00]/15 md:h-12 md:px-8 md:text-[14px]"
              >
                View All Verified Suppliers
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
