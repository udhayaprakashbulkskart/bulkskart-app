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
 *   - Dark card container (bg-[#0f172a] with border border-slate-800)
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
  ChevronRight,
  ChevronLeft,
  BadgeCheck,
  Check,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { getCompanies } from '@/lib/api';
import { DISTINCT_PIXABAY_COMPANY_IMAGES } from '@/lib/contentImages';
import { matchProductImage } from '@/lib/productImageMatchingEngine';
import type { Company } from '@/types/types';

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
}

/**
 * Lightweight catalog image — skips SafeImage matching overhead for known-good CDN URLs.
 * Uses small WebP Unsplash derivatives + eager load for above-the-fold cards.
 */
function FastCatalogImage({
  src,
  alt,
  priority = false,
  className = '',
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const optimized = React.useMemo(() => optimizeCatalogUrl(src), [src]);

  return (
    <div className={`relative w-full h-full overflow-hidden bg-slate-800 ${className}`}>
      {!loaded && !failed && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800" />
      )}
      {!failed ? (
        <img
          src={optimized}
          alt={alt}
          width={480}
          height={300}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          // React 18: pass as DOM attr for LCP on above-the-fold cards
          {...({ fetchpriority: priority ? 'high' : 'low' } as React.ImgHTMLAttributes<HTMLImageElement>)}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs font-medium px-3 text-center">
          {alt}
        </div>
      )}
    </div>
  );
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
    return { ...raw, img } as DisplaySupplier;
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
function SupplierBrandLogo({ supplier }: { supplier: DisplaySupplier }) {
  if (supplier.logoUrl) {
    return (
      <img
        src={supplier.logoUrl}
        alt={supplier.name}
        className="w-full h-full object-contain p-0.5"
        loading="lazy"
      />
    );
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
      return (
        <div className="w-full h-full rounded-lg bg-slate-900 flex items-center justify-center select-none">
          <span className="font-extrabold text-sm sm:text-base text-white tracking-wider">
            {supplier.name.substring(0, 2).toUpperCase()}
          </span>
        </div>
      );
  }
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
    if (s.slug) {
      navigate(`/manufacturers/${s.slug}`);
    } else {
      navigate(`/products?company=${s.id}`);
    }
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

  return (
    <section className="py-5 sm:py-7 md:py-9 bg-[#030712] text-white relative overflow-hidden border-b border-slate-900">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-5 md:px-6">

        {/* ── SECTION HEADER (Exact to Reference Mockup file_00000000825482068b8a3f7235eeb10d.png) ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Verified Suppliers</span>
              {/* Orange circular badge with white checkmark matching reference mockup */}
              <span
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#FF5A00] flex items-center justify-center shrink-0 shadow-sm shadow-[#FF5A00]/40"
                title="Verified Global Suppliers"
              >
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white stroke-[3.5]" />
              </span>
            </h2>

            {/* 30-Second Live Simulation Countdown Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF5A00]/10 border border-[#FF5A00]/30 text-[#FF5A00] text-[11px] font-bold shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A00] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF5A00]"></span>
              </span>
              <span>30s Auto-Update: {secondsLeft}s</span>
              <button
                type="button"
                onClick={handleManualRotate}
                title="Show next unique suppliers"
                className={`ml-1 text-[#FF5A00] hover:text-white transition-transform ${isRotating ? 'rotate-180 animate-spin' : 'hover:scale-110'}`}
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Left and Right Scroll Navigation Buttons */}
            <div className="flex items-center gap-1.5 ml-1">
              <button
                type="button"
                onClick={() => scrollSuppliers('left')}
                aria-label="Scroll verified suppliers left"
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-[#111827] hover:bg-[#FF5A00] text-slate-300 hover:text-white border border-slate-700 hover:border-[#FF5A00] flex items-center justify-center transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollSuppliers('right')}
                aria-label="Scroll verified suppliers right"
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-[#111827] hover:bg-[#FF5A00] text-slate-300 hover:text-white border border-slate-700 hover:border-[#FF5A00] flex items-center justify-center transition-all shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <Link
            to="/manufacturers"
            className="text-[#FF5A00] hover:text-[#ff7429] font-bold text-xs sm:text-sm md:text-base flex items-center gap-1 transition-colors shrink-0 group"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>

        {/* 30-Second Live Progress Timeline Bar */}
        <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden mb-3 sm:mb-3.5" title={`Auto-updates every ${ROTATION_SECONDS}s (${secondsLeft}s remaining)`}>
          <div
            className="h-full bg-gradient-to-r from-[#FF5A00] via-[#FF7A00] to-[#FF5A00] transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${((ROTATION_SECONDS - secondsLeft) / ROTATION_SECONDS) * 100}%` }}
          />
        </div>

        {/* ── Country Filter Pills ───────────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-3.5 sm:mb-4 scrollbar-none -mx-1 px-1">
          {COUNTRY_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedCountry(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 select-none ${
                selectedCountry === tab.key
                  ? 'bg-[#FF5A00] text-white shadow-sm shadow-[#FF5A00]/30 font-bold'
                  : 'bg-[#111827] hover:bg-[#1f2937] text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <span className="text-xs">{tab.flag}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Error Notification with Retry ──────────────────────────── */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 flex items-center justify-between text-xs sm:text-sm text-rose-200">
            <span>{error}</span>
            <button
              onClick={loadSuppliers}
              className="flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

        {/* ── SUPPLIER CARDS DISPLAY ─────────────────────────────────── */}
        {loading ? (
          // Skeleton Loading
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 animate-pulse flex flex-col justify-between h-[280px]"
              >
                <div className="aspect-[16/10] bg-slate-800 rounded-xl mb-3" />
                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-slate-800 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-9 bg-slate-800 rounded-xl w-full mt-3" />
              </div>
            ))}
          </div>
        ) : displayedSuppliers.length === 0 ? (
          <div className="py-12 text-center bg-[#0f172a] rounded-2xl border border-slate-800 p-6">
            <Building2 className="w-10 h-10 text-[#FF5A00] mx-auto mb-2 opacity-80" />
            <p className="text-white font-semibold text-sm">No verified suppliers found for this region.</p>
            <button
              onClick={() => setSelectedCountry('all')}
              className="mt-3 bg-[#FF5A00] hover:bg-[#ff7429] text-white text-xs px-4 py-2 rounded-xl font-bold transition-colors"
            >
              Show All Global Suppliers
            </button>
          </div>
        ) : (
          /* ── RESPONSIVE PC GRID (4 Columns) & MOBILE HORIZONTAL CAROUSEL ── */
          <div
            ref={supplierScrollRef}
            className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 overflow-x-auto md:overflow-visible pb-4 pt-1 scrollbar-none snap-x snap-mandatory overscroll-x-contain touch-pan-x -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            {displayedSuppliers.map((s, idx) => (
              <div
                key={`${s.id}-${s.img}`}
                className={`w-[275px] sm:w-[295px] md:w-auto shrink-0 md:shrink snap-start bg-[#0f172a] hover:bg-[#131d33] border border-slate-800/90 hover:border-[#FF5A00]/50 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-lg min-w-0 ${
                  isRotating ? 'opacity-70 scale-[0.99]' : 'opacity-100 scale-100'
                }`}
              >
                <div className="min-w-0 w-full">
                  {/* Alibaba-style product catalog photo — optimized WebP, unique per card */}
                  <div
                    onClick={() => handleViewProducts(s)}
                    className="aspect-[16/10] w-full overflow-hidden bg-slate-900 relative cursor-pointer"
                  >
                    <FastCatalogImage
                      src={s.img}
                      alt={s.sampleProduct || `${s.name} — ${s.industry || 'Verified Manufacturer'}`}
                      priority={idx < 4}
                      className="group-hover:[&_img]:scale-105 [&_img]:transition-transform [&_img]:duration-500 [&_img]:ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-[#FF5A00]/40 text-[#FF5A00] text-[10px] font-bold shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>Verified Manufacturer</span>
                    </div>
                    {s.sampleProduct ? (
                      <div className="absolute bottom-2 left-2.5 right-2.5 z-10 pointer-events-none">
                        <span className="inline-block max-w-full truncate rounded-md bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-100 border border-white/10">
                          {s.sampleProduct}
                        </span>
                      </div>
                    ) : s.industry ? (
                      <div className="absolute bottom-2 left-2.5 right-2.5 z-10 pointer-events-none">
                        <span className="inline-block max-w-full truncate rounded-md bg-black/55 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-100 border border-white/10">
                          {s.industry}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Card Body with Company Logo & Details */}
                  <div className="p-3.5 sm:p-4">
                    <div className="flex items-start gap-3">
                      <div
                        onClick={() => handleViewProducts(s)}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-sm border border-slate-200/50 cursor-pointer overflow-hidden"
                      >
                        <SupplierBrandLogo supplier={s} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3
                          onClick={() => handleViewProducts(s)}
                          className="font-bold text-white text-sm sm:text-[14px] leading-snug line-clamp-2 group-hover:text-[#FF5A00] transition-colors cursor-pointer"
                          title={s.name}
                        >
                          {s.name}
                        </h3>

                        <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1.5">
                          <span className="text-sm shrink-0 leading-none">{s.flag}</span>
                          <span className="truncate">{s.country}</span>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-[#FF5A00] font-semibold mt-1">
                          <BadgeCheck className="w-3.5 h-3.5 text-[#FF5A00] shrink-0" />
                          <span className="truncate">Verified Supplier</span>
                        </div>

                        {s.sampleProduct && (
                          <p
                            className="mt-1.5 text-[11px] text-slate-400 line-clamp-2 leading-snug"
                            title={s.sampleProduct}
                          >
                            {s.sampleProduct}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-0">
                  <button
                    type="button"
                    onClick={() => handleViewProducts(s)}
                    className="w-full bg-[#162032] hover:bg-[#FF5A00] text-white border border-slate-700/80 hover:border-[#FF5A00] rounded-xl py-2 px-3.5 text-xs sm:text-sm font-semibold flex items-center justify-between transition-all duration-200 shadow-sm active:scale-[0.99] group/btn"
                  >
                    <span className="font-medium">View Products</span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover/btn:text-white group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
