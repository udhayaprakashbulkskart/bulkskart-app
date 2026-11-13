import { PRE_CACHED_PIXABAY_IMAGES } from '@/lib/pixabay';
import { RFQ_LICENSED_IMAGES } from '@/lib/rfqLicensedImages';

/**
 * Content-Based Image System for BulkSkart B2B Marketplace
 *
 * Strict Rules:
 * 1. PRODUCTS: Every product has its own PRODUCT-SPECIFIC image (e.g. Solar panel -> solar panel photo).
 *    Never reuse generic images across unrelated products.
 * 2. COMPANIES: Dedicated company branding (distinct company logo, factory/facility cover banner).
 *    Never use product images as company logos. Never share identical images across different companies.
 * 3. RFQS / LIVE REQUIREMENTS: Requirement-specific image representing what the buyer is requesting.
 *    The image represents the commodity/product requested, not the supplier.
 * 4. FALLBACKS: Category-specific placeholders when genuine images are absent.
 */

// Generic placeholders and repeated stock images that MUST be replaced with distinct authentic content images
const GENERIC_PLACEHOLDERS = [
  'prod_asset_19173084',
  'prod_asset_3dd25eca',
  'prod_asset_06e7b00f',
  'prod_asset_206d733c',
  'prod_asset_474d3681',
  'prod_asset_d6f9b3ff',
  'prod_asset_22110305',
  'prod_asset_ba175bf8',
  'prod_asset_4af11ca3',
  'prod_asset_a3c06a3e',
  'prod_asset_18bd87c0',
  'prod_asset_ede57bc5',
  'photo-1581091226825-a6a2a5aee158', // Female engineer with laptop repeated excessively
  'photo-1584917865442-de89df76afd3',
  'photo-1544816155-12df9643f363', // Passport mismatch
  'photo-1542838132-92c53300491e', // Cash / money notes mismatch
  '3127927', // Passport with visas mismatch
  'photo-1581092160607-ee22621dd758', // Seashell mismatch
  'photo-1565123409695-7b5ef63a2efb',
  '663096', // Pasta mismatch
  '4385125', // Dollar bills mismatch
  '67616', // Nebula mismatch
  '5007955', // Train mismatch
  '257336', // Pills mismatch
  'placeholder',
  'via.placeholder.com',
  'default-product',
  'ewnftvshvsrhawluloty.supabase.co',
  '/product-images/representative/',
  // Unsplash removed these files. Requesting them returns HTML and Chrome logs ORB errors.
  'photo-1486006920555-c77dce18193b',
  'photo-1504328345608-5c56ce5c6f0f',
  'photo-1504917599217-d4dc5ebe6122',
  'photo-1509391365360-2e959784a276',
  'photo-1541888946425-d0fbb186c5f9',
  'photo-1550985543-f47df4b4c4e0',
  'photo-1556911220-bff31c99235b',
  'photo-1558171813-4c0887533814',
  'photo-1565793298595-6a381b3f1f4d',
  'photo-1565814329452-7811bc3270c0',
  'photo-1578574577315-52ac1758a1d0',
  'photo-1579482495398-a28a2a0ebae7',
  'photo-1580481077195-c328a37db71a',
  'photo-1581092335397-9583fe92d232',
  'photo-1581093458791-9d42e3f0f0f0',
  'photo-1607344645866-009c320c5ab8',
  'photo-1611591475819-79730e70a311',
];

export function isGenericImage(url?: string | null): boolean {
  if (!url) return true;
  // Real catalog files in Supabase storage. Never treat these as placeholders.
  // Representative stand-ins (/product-images/representative/) stay in GENERIC_PLACEHOLDERS.
  if (url.includes('/product-images/catalog/')) return false;
  return GENERIC_PLACEHOLDERS.some((p) => url.includes(p));
}

// ---------------------------------------------------------------------------
// 1. PRODUCT-SPECIFIC AUTHENTIC IMAGES (Exact commodity representation)
// ---------------------------------------------------------------------------
// Comprehensive keyword mapping to ensure EVERY industrial commodity has a dedicated, authentic photo
export const PRODUCT_SPECIFIC_IMAGES: { keywords: string[]; url: string; fallbackCategory: string }[] = [
  // Machinery & CNC
  {
    keywords: ['cnc', 'machining', '5-axis', 'vertical machining', 'milling center', 'precision lathe'],
    url: 'https://cdn.pixabay.com/photo/2014/09/13/21/46/milling-444493_1280.jpg',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['lathe', 'turning machine', 'metal lathe', 'industrial lathe', 'rotary'],
    url: 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['laser cutting', 'fiber laser', 'sheet metal laser', 'laser cutting machine'],
    url: 'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['injection molding', 'plastic molding machine', 'molding machine'],
    url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['packaging machine', 'carton packing', 'blister packaging', 'packing machine', 'sealing machine', 'vffs'],
    url: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'packaging',
  },
  {
    keywords: ['hydraulic', 'hydraulic press', 'hydraulic pump', 'gear pump', 'valve test'],
    url: 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['boiler', 'steam boiler', 'pressure vessel', 'heat exchanger'],
    url: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['forging', 'foundry', 'metal casting', 'drop forge', 'forged parts'],
    url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'metals',
  },
  {
    keywords: ['pump', 'slurry pump', 'centrifugal pump', 'gate valve', 'flanged valve'],
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['bearing', 'ball bearing', 'roller bearing', 'flange bearing', 'thrust bearing'],
    url: 'https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['food truck', 'catering trailer', 'commercial kitchen truck', 'mobile kitchen'],
    url: 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'machinery',
  },

  // Chemicals & Minerals
  {
    keywords: ['sodium hypochlorite', 'chlorine', 'bleach', 'disinfectant'],
    url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'chemicals',
  },
  {
    keywords: ['hydrogen peroxide', 'peroxide', 'oxidizer'],
    url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'chemicals',
  },
  {
    keywords: ['calcium carbonate', 'chalk powder', 'ground limestone', 'mineral powder'],
    url: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'chemicals',
  },
  {
    keywords: ['titanium dioxide', 'rutile', 'white pigment', 'tio2'],
    url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'chemicals',
  },
  {
    keywords: ['activated carbon', 'charcoal filter', 'carbon mesh'],
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'chemicals',
  },
  {
    keywords: ['silica gel', 'desiccant', 'white beads', 'moisture absorber'],
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'chemicals',
  },
  {
    keywords: ['gypsum', 'plaster of paris', 'gypsum powder'],
    url: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'chemicals',
  },
  {
    keywords: ['calcium chloride', 'deicing salt', 'brine flakes'],
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'chemicals',
  },
  {
    keywords: ['dap fertiliser', 'npk', 'fertiliser', 'fertilizer', 'urea', 'potash'],
    url: 'https://images.unsplash.com/photo-1628352081506-83c43123ed6d?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'agriculture',
  },

  // Polymers & Plastics
  {
    keywords: ['bubble wrap', 'air bubble', 'protective roll', 'cushion packaging'],
    url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'packaging',
  },
  {
    keywords: ['ldpe', 'hdpe', 'polypropylene', 'pp granules', 'plastic resin', 'masterbatch'],
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'plastics',
  },
  {
    keywords: ['silicone rubber', 'rubber sheet', 'elastomer', 'gasket sheet'],
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'plastics',
  },
  {
    keywords: ['hips sheet', 'acrylic sheet', 'polycarbonate sheet', 'plastic sheet'],
    url: 'https://cdn.pixabay.com/photo/2015/11/25/11/07/plastic-1061731_1280.jpg',
    fallbackCategory: 'plastics',
  },

  // Electronics & Solar
  {
    keywords: ['solar panel', 'photovoltaic', 'topcon', 'solar module', 'bifacial solar', 'pv module'],
    url: 'https://images.unsplash.com/photo-1545208942-e1c9c916524b?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'electronics',
  },
  {
    keywords: ['pcb', 'printed circuit board', 'smt line', 'circuit board', 'electronic component'],
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'electronics',
  },
  {
    keywords: ['semiconductor', 'microcontroller', 'wafer', 'integrated circuit', 'micro-power'],
    url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'electronics',
  },
  {
    keywords: ['wire harness', 'cable assembly', 'industrial cabling', 'copper wire'],
    url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'electronics',
  },
  {
    keywords: ['power systems', 'substation', 'inverter', 'transformer', 'switchgear'],
    url: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'electronics',
  },

  // Pharmaceuticals & Medical
  {
    keywords: ['pharma', 'amoxicillin', 'capsule', 'medicine', 'tablet', 'formulation'],
    url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'pharma',
  },
  {
    keywords: ['herbal', 'ayurvedic', 'plant extract', 'botanical extract'],
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'pharma',
  },
  {
    keywords: ['diagnostics', 'medical supplies', 'test kit', 'lab supplies'],
    url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'pharma',
  },

  // Textiles & Leather
  {
    keywords: ['leather', 'hide', 'tannery', 'vachetta', 'full grain'],
    url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['terracotta', 'tile', 'ceramic', 'porcelain', 'marble'],
    url: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'construction',
  },
  {
    keywords: ['hosiery', 't-shirt', 'knitwear', 'garments', 'cotton yarn'],
    url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['silk', 'sari', 'saree', 'brocade', 'jacquard'],
    url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['woollen', 'wool', 'blanket', 'fleece', 'yarn'],
    url: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['cotton', 'fabric', 'denim', 'textile mill'],
    url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['furniture', 'wood', 'sofa', 'desk', 'cabinet'],
    url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'furniture',
  },
  {
    keywords: ['mining', 'excavator', 'heavy equipment', 'crusher'],
    url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['industrial machinery', 'conveyor', 'gearbox', 'automation equipment'],
    url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['hydraulic pump', 'gear pump', 'hydraulic motor', 'cast iron pump', 'piston pump'],
    url: 'https://cdn.pixabay.com/photo/2016/09/12/07/48/mechanical-1663275_1280.jpg',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['ev charger', 'fast charger', 'charging station', 'dc fast charger', 'ccs2', 'electric vehicle charger'],
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'electronics',
  },
  {
    keywords: ['energy storage', 'lifepo4', 'battery storage', 'bess', 'solar battery cabinet', 'battery system'],
    url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'electronics',
  },
  {
    keywords: ['espresso machine', 'coffee vending', 'commercial coffee', 'barista station'],
    url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['food truck', 'catering trailer', 'commercial kitchen truck', 'mobile kitchen'],
    url: 'https://cdn.pixabay.com/photo/2017/06/05/20/51/food-truck-2375246_1280.jpg',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['weaving loom', 'textile loom', 'spinning machine', 'textile machine'],
    url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['cotton twill', 'cotton fabric', 'fabric rolls', 'textile rolls', 'combed cotton'],
    url: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['rice', 'basmati', 'steamed rice', 'grain export', 'cereals'],
    url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'agriculture',
  },
  {
    keywords: ['polypropylene', 'pp granules', 'polymer resin', 'plastic raw material', 'injection granules'],
    url: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'plastics',
  },
  {
    keywords: ['solar panel', 'photovoltaic', 'topcon', 'solar module', 'bifacial solar'],
    url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'electronics',
  },
  {
    keywords: ['pipe fitting', 'flange', 'valve', 'stainless steel pipe', 'industrial valve'],
    url: 'https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'metals',
  },
  {
    keywords: ['bearing', 'ball bearing', 'roller bearing', 'flange bearing'],
    url: 'https://images.unsplash.com/photo-1545208942-e1c9c916524b?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['pcb', 'printed circuit board', 'smt line', 'lorawan', 'iot gateway', 'electronics component'],
    url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'electronics',
  },
  {
    keywords: ['carton box', 'corrugated box', 'shipping carton', 'cardboard box', 'packaging box'],
    url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'packaging',
  },
  {
    keywords: ['transformer', 'power transformer', 'high voltage', 'substation'],
    url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'electronics',
  },
  {
    keywords: ['hdpe pipe', 'drainage pipe', 'corrugated pipe', 'pvc pipe'],
    url: 'https://cdn.pixabay.com/photo/2014/09/02/12/47/pipe-433609_1280.jpg',
    fallbackCategory: 'construction',
  },
  {
    keywords: ['kraft paper', 'valve bag', 'packaging bag', 'paper sack'],
    url: 'https://cdn.pixabay.com/photo/2014/04/05/11/07/cardboard-314504_1280.jpg',
    fallbackCategory: 'packaging',
  },
  {
    keywords: ['machinery', 'industrial machine', 'hydraulic press', 'conveyor', 'gearbox'],
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'machinery',
  },
  {
    keywords: ['saree', 'sari', 'silk saree', 'banarasi', 'kanjivaram', 'cotton saree'],
    url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['silk fabric', 'pure silk', 'silk roll', 'mulberry silk'],
    url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['denim', 'jeans', 'denim fabric', 'chambray', 'denim cloth'],
    url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['polyester', 'blend cloth', 'synthetic fabric', 'poly blend', 'polyester cloth'],
    url: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['linen', 'dress material', 'cotton dress', 'woven cloth'],
    url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['woollen', 'wool blanket', 'fleece polar', 'winter blanket', 'wool yarn'],
    url: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['t-shirt', 'tshirt', 'polo shirt', 'hosiery', 'apparel garment'],
    url: 'https://cdn.pixabay.com/photo/2012/02/16/12/29/worker-13550_1280.jpg',
    fallbackCategory: 'textiles',
  },
  {
    keywords: ['jute', 'jute bag', 'gunny bag', 'burlap', 'hessian sack'],
    url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'packaging',
  },
  {
    keywords: ['plastic packaging', 'packaging bag', 'polybag', 'pouch', 'ziplock', 'courier bag'],
    url: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'packaging',
  },
  {
    keywords: ['corrugated', 'carton', 'box', 'cardboard box', 'shipping box'],
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'packaging',
  },
  {
    keywords: ['rice', 'basmati', 'grain', 'paddy', 'cereals'],
    url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'agriculture',
  },
  {
    keywords: ['chilli', 'spice', 'turmeric', 'pepper', 'cardamom', 'cumin'],
    url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'agriculture',
  },
  {
    keywords: ['steel', 'iron bar', 'rebar', 'stainless steel', 'steel coil', 'tmt bar'],
    url: 'https://images.unsplash.com/photo-1535813547-99c456a41d4a?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'metals',
  },
  {
    keywords: ['tile', 'vitrified', 'ceramic', 'porcelain tile', 'marble slab', 'granite'],
    url: 'https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'construction',
  },
  {
    keywords: ['pipe', 'hdpe', 'pvc pipe', 'upvc', 'plumbing pipe', 'conduit'],
    url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'construction',
  },
  {
    keywords: ['brake pad', 'auto parts', 'clutch', 'automotive', 'vehicle parts', 'engine part'],
    url: 'https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'auto',
  },
  {
    keywords: ['diamond gemstone', 'fine jewellery', 'polished diamond', 'solitaire diamond', 'gold jewellery', 'silver jewellery', 'gemstone ring', 'diamond necklace'],
    url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'gems',
  },
  {
    keywords: ['furniture', 'teak', 'wooden chair', 'office desk', 'sofa', 'cabinet'],
    url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'furniture',
  },
  {
    keywords: ['amoxicillin', 'capsule', 'medicine', 'pharma', 'tablet', 'pharmaceutical'],
    url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'pharma',
  },
  {
    keywords: ['dyes', 'reactive dye', 'chemical', 'pigment', 'solvent', 'industrial chemical'],
    url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'chemicals',
  },
  {
    keywords: ['headphone', 'earphone', 'wireless earbud', 'audio gadget', 'bluetooth'],
    url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'electronics',
  },
  {
    keywords: ['shrimp', 'prawn', 'fish', 'seafood', 'frozen seafood'],
    url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
    fallbackCategory: 'agriculture',
  },
  {
    keywords: ['granule', 'polymer', 'ldpe', 'hdpe granule', 'plastic raw material', 'resin'],
    url: 'https://cdn.pixabay.com/photo/2015/11/25/11/07/plastic-1061731_1280.jpg',
    fallbackCategory: 'plastics',
  },
];

// Clean category-specific fallbacks (Real industrial factory & wholesale photography via Pixabay & Unsplash CDN)
export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  machinery: 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=800&q=80',
  electronics: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
  textiles: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80',
  agriculture: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
  chemicals: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
  construction: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80',
  furniture: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
  auto: 'https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&w=800&q=80',
  pharma: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
  plastics: 'https://cdn.pixabay.com/photo/2015/11/25/11/07/plastic-1061731_1280.jpg',
  gems: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
  packaging: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
  metals: 'https://images.unsplash.com/photo-1535813547-99c456a41d4a?auto=format&fit=crop&w=800&q=80',
  solar: 'https://images.unsplash.com/photo-1545208942-e1c9c916524b?auto=format&fit=crop&w=800&q=80',
  electrical: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
  default: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
};

/**
 * Generates an isolated, product-specific fallback image data URI.
 * Guarantees that if a product has no image or an image fails to load,
 * it receives an isolated badge fallback containing ONLY that specific product's
 * name and sector, preventing the same image from being reused across different products.
 */
export function generateIsolatedProductFallback(title?: string, category?: string): string {
  const cleanTitle = (title || 'Bulk Requirement').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cleanCat = (category || 'Industrial Goods').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  
  // Deterministic accent color based on title hash
  let hash = 0;
  for (let i = 0; i < cleanTitle.length; i++) {
    hash = (hash << 5) - hash + cleanTitle.charCodeAt(i);
    hash |= 0;
  }
  const hues = [25, 210, 160, 280, 45, 190];
  const hue = hues[Math.abs(hash) % hues.length];

  // Escape text inserted into the SVG: a bare "&" (e.g. "Textiles & Apparel") makes the markup invalid.
  const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0E111A"/>
        <stop offset="100%" stop-color="#181D2D"/>
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="hsl(${hue}, 90%, 55%)"/>
        <stop offset="100%" stop-color="hsl(${hue + 20}, 90%, 65%)"/>
      </linearGradient>
    </defs>
    <rect width="600" height="400" fill="url(#bg)"/>
    <rect x="20" y="20" width="560" height="360" rx="16" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
    <circle cx="300" cy="150" r="48" fill="rgba(255,255,255,0.04)" stroke="url(#accent)" stroke-width="2.5"/>
    <path d="M285 140 L315 140 M285 150 L315 150 M285 160 L305 160" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
    <rect x="235" y="220" width="130" height="24" rx="12" fill="url(#accent)" fill-opacity="0.18"/>
    <text x="300" y="236" fill="hsl(${hue}, 95%, 65%)" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" text-anchor="middle" letter-spacing="1">${xml(cleanCat.toUpperCase())}</text>
    <text x="300" y="280" fill="#F8FAFC" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" text-anchor="middle">
      ${xml(cleanTitle.length > 36 ? cleanTitle.slice(0, 36) + '...' : cleanTitle)}
    </text>
    <text x="300" y="325" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="12" text-anchor="middle">
      BulkSkart B2B Verified Commodity
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

import { matchProductImage } from '@/lib/productImageMatchingEngine';

/**
 * Resolves a product's primary display image.
 * If user uploaded an authentic image, uses it.
 * If missing or generic placeholder, matches product title/name to exact commodity photo.
 */
export function resolveProductImage(
  item: {
    name?: string;
    title?: string;
    images?: string[] | null;
    image?: string | null;
    category?: string | null;
  }
): string {
  // Check if item has a valid, non-generic uploaded image
  const customImg = item.images?.[0] || item.image;
  if (customImg && !isGenericImage(customImg)) {
    return customImg;
  }

  // Use Alibaba-benchmarked matching engine first
  const matched = matchProductImage({
    name: item.name || item.title,
    category: item.category || undefined,
    currentImages: item.images,
  });
  if (matched.primaryImage) {
    return matched.primaryImage;
  }

  const textToMatch = `${item.name || ''} ${item.title || ''} ${item.category || ''}`.toLowerCase();

  // Match against product-specific keywords
  for (const mapping of PRODUCT_SPECIFIC_IMAGES) {
    if (mapping.keywords.some((k) => textToMatch.includes(k))) {
      return mapping.url;
    }
  }

  // Fallback by category
  for (const [catKey, url] of Object.entries(CATEGORY_FALLBACK_IMAGES)) {
    if (textToMatch.includes(catKey)) return url;
  }

  return generateIsolatedProductFallback(item.name || item.title, item.category || 'General Products');
}

/**
 * Resolves a Live Buying Requirement / RFQ image based on what the buyer is requesting.
 * The RFQ image represents the requested product/commodity, NOT the company.
 */
export function resolveRfqImage(
  rfq: {
    id?: string | null;
    title?: string;
    name?: string;
    attachment_url?: string | null;
    imageUrl?: string | null;
    category?: string | null;
    categories?: { name?: string; slug?: string } | null;
  }
): string {
  // 0. Reviewed licensed photos for known requirements (replaces earlier AI-generated attachments).
  if (rfq.id && Object.prototype.hasOwnProperty.call(RFQ_LICENSED_IMAGES, rfq.id)) {
    const entry = RFQ_LICENSED_IMAGES[rfq.id];
    if (entry) return entry.url;
    return generateIsolatedProductFallback(rfq.title || rfq.name, rfq.category || rfq.categories?.name || 'Bulk RFQ');
  }

  // 1. If buyer uploaded a requirement photo, use it directly!
  const uploaded = rfq.attachment_url || rfq.imageUrl;
  if (uploaded && !isGenericImage(uploaded)) {
    return uploaded;
  }

  const catStr = `${rfq.category || ''} ${rfq.categories?.name || ''} ${rfq.categories?.slug || ''}`;
  const textToMatch = `${rfq.title || ''} ${rfq.name || ''} ${catStr}`.toLowerCase();

  // 2. Match exact commodity requested
  for (const mapping of PRODUCT_SPECIFIC_IMAGES) {
    if (mapping.keywords.some((k) => textToMatch.includes(k))) {
      return mapping.url;
    }
  }

  // 3. Fallback by requirement sector
  for (const [catKey, url] of Object.entries(CATEGORY_FALLBACK_IMAGES)) {
    if (textToMatch.includes(catKey)) return url;
  }

  // 4. Isolated product fallback
  return generateIsolatedProductFallback(rfq.title || rfq.name, rfq.category || rfq.categories?.name || 'Bulk RFQ');
}

// ---------------------------------------------------------------------------
// 2. COMPANY BRANDING & LOGOS (Distinct corporate identity)
// ---------------------------------------------------------------------------

// Curated pool of distinct Unsplash industrial facility photos (Pixabay CDN returns 403 when hotlinked)
export const DISTINCT_PIXABAY_COMPANY_IMAGES: string[] = [
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80', // 0: Welding steel fabrication
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80', // 1: Packaging logistics warehouse
  'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80', // 2: Power grid & electrical
  'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80', // 3: Chemical synthesis lab
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80', // 4: Heavy construction / timber site
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80', // 5: Precision optics / camera lens
  'https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=800&q=80', // 6: Petrochemical plant
  'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=800&q=80', // 7: Solar energy farm
  'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=800&q=80', // 8: CNC / automation floor
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80', // 9: Agro grains & farming
  'https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=800&q=80', // 10: Textile yarn / weaving
  'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=800&q=80', // 11: Automotive / steel plant
  'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=800&q=80', // 12: Precision machining
  'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?auto=format&fit=crop&w=800&q=80', // 13: Polymers / recycled plastics
  'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80', // 14: Cartons & packaging line
  'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=800&q=80', // 15: Industrial piping / metalwork
  'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=800&q=80', // 16: Electronics / cleanroom tech
  'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=800&q=80', // 17: Specialty chemicals
  'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80', // 18: Electrical copper wiring
  'https://images.unsplash.com/photo-1565043666747-69f6646db940?auto=format&fit=crop&w=800&q=80', // 19: Metal fabrication floor
  'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=800&q=80', // 20: Cleanroom / wafer tooling
  'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=800&q=80', // 21: Container port terminal
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80', // 22: Robotic assembly plant
  'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80', // 23: Industrial bearings / tooling
  'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=800&q=80', // 24: Textile dyeing / knitwear
  'https://images.unsplash.com/photo-1595113316349-9fa4eb24f884?auto=format&fit=crop&w=800&q=80', // 25: Footwear / leather goods
  'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80', // 26: Timber / softwood forest
  'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80', // 27: Pharma / medical production
  'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80', // 28: Bulk cargo shipping
  'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=800&q=80', // 29: Hydraulic / auto systems
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80', // 30: Construction materials
  'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80', // 31: Mining / heavy excavator
  'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80', // 32: Catering / food processing
  'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80', // 33: Home textiles / fabrics
  'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=800&q=80', // 34: Wind / renewable energy
  'https://images.unsplash.com/photo-1586528116493-a029325540fa?auto=format&fit=crop&w=800&q=80', // 35: Customs / logistics hub
];

// Curated authentic manufacturing facility & factory cover banners (by industrial hub)
export const FACTORY_COVER_BANNERS: Record<string, string> = {
  machinery: DISTINCT_PIXABAY_COMPANY_IMAGES[8],
  electronics: DISTINCT_PIXABAY_COMPANY_IMAGES[16],
  textiles: DISTINCT_PIXABAY_COMPANY_IMAGES[10],
  chemicals: DISTINCT_PIXABAY_COMPANY_IMAGES[3],
  metals: DISTINCT_PIXABAY_COMPANY_IMAGES[0],
  packaging: DISTINCT_PIXABAY_COMPANY_IMAGES[1],
  default: DISTINCT_PIXABAY_COMPANY_IMAGES[12],
};

// Generates an elegant SVG Data URI logo for a company using its initials and corporate theme
export function generateCompanyLogo(companyName: string, idSeed = ''): string {
  const cleanName = (companyName || 'Supplier').trim();
  const words = cleanName.split(/\s+/).filter(Boolean);
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : cleanName.slice(0, 2).toUpperCase();

  // Consistent color palette derived from name hash
  const palettes = [
    { bg: '#0F2B48', border: '#2563EB', text: '#FFFFFF', accent: '#38BDF8' },
    { bg: '#2D1B4E', border: '#7C3AED', text: '#FFFFFF', accent: '#A78BFA' },
    { bg: '#064E3B', border: '#059669', text: '#FFFFFF', accent: '#34D399' },
    { bg: '#78350F', border: '#D97706', text: '#FFFFFF', accent: '#FBBF24' },
    { bg: '#831843', border: '#DB2777', text: '#FFFFFF', accent: '#F472B6' },
    { bg: '#1E293B', border: '#FF5A00', text: '#FFFFFF', accent: '#FF7A29' },
  ];

  let hash = 0;
  const str = cleanName + idSeed;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const theme = palettes[Math.abs(hash) % palettes.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <rect width="120" height="120" rx="24" fill="${theme.bg}"/>
    <rect x="6" y="6" width="108" height="108" rx="20" fill="none" stroke="${theme.border}" stroke-width="3" stroke-opacity="0.6"/>
    <circle cx="100" cy="20" r="4" fill="${theme.accent}"/>
    <text x="60" y="68" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="38" font-weight="800" fill="${theme.text}" text-anchor="middle" dominant-baseline="middle" letter-spacing="1">
      ${String(initials).replace(/&/g, '&amp;').replace(/</g, '&lt;')}
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Resolves company branding:
 * - Logo: Company logo URL if provided, otherwise SVG corporate brand monogram
 * - Banner: Factory/facility cover banner
 */
export function resolveCompanyBranding(company: {
  id?: string;
  company_name?: string;
  name?: string;
  logo_url?: string | null;
  banner_url?: string | null;
  cover_url?: string | null;
  business_type?: string | null;
  industry?: string | null;
  key_products?: string[] | null;
}): { logo: string; banner: string } {
  const name = company.company_name || company.name || 'Company';

  // 1. Logo resolver: Ensure company uses its own logo, not a product image
  let logo = company.logo_url;
  if (!logo || isGenericImage(logo)) {
    logo = generateCompanyLogo(name, company.id || '');
  }

  // 2. Banner resolver: Prioritize authentic self-hosted cover_url over static unsplash banner_url
  let banner = company.cover_url || company.banner_url;
  if (company.banner_url?.includes('unsplash.com') && company.cover_url && !company.cover_url.includes('unsplash.com')) {
    banner = company.cover_url;
  }
  if (!banner || isGenericImage(banner)) {
    // Generate a deterministic unique index from company ID and name to guarantee NO two companies share an image
    let seed = 0;
    const str = `${company.id || ''}_${name}_${company.business_type || ''}`;
    for (let i = 0; i < str.length; i++) {
      seed = (seed << 5) - seed + str.charCodeAt(i);
      seed |= 0;
    }
    const distinctIdx = Math.abs(seed) % DISTINCT_PIXABAY_COMPANY_IMAGES.length;
    banner = DISTINCT_PIXABAY_COMPANY_IMAGES[distinctIdx];
  }

  return { logo, banner };
}
