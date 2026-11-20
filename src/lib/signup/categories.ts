import { PRODUCT_CATEGORIES, type ProductCategory } from './vocab';

/**
 * Which of the marketplace's 13 categories a sentence is about, worked out from the words in it.
 *
 * Every category has words that point to it strongly (3 points), words that usually do (2) and words that only
 * hint (1). A category needs at least 2 points to be suggested, and the person always has the final say.
 */

interface CategoryWords {
  strong: string[];
  normal: string[];
  weak: string[];
}

const WORDS: Record<ProductCategory, CategoryWords> = {
  'Machinery & Industrial Equipment': {
    strong: [
      'machinery', 'cnc', 'vmc', 'lathe', 'hydraulic', 'pneumatic', 'compressor', 'boiler', 'conveyor', 'forging', 'casting', 'foundry',
      'gearbox', 'turbine', 'extruder', 'industrial equipment', 'machine tool', 'press machine', 'packing machine', 'packaging machine',
      'pump', 'valve', 'bearing', 'crane', 'hoist', 'forklift', 'excavator', 'earthmoving',
    ],
    normal: ['machine', 'machining', 'fabrication', 'fabricated', 'sheet metal', 'welding', 'fastener', 'bolt', 'nut', 'screw', 'spring', 'gear', 'tooling', 'die', 'engineering', 'stainless steel', 'mild steel'],
    weak: ['spare', 'steel', 'metal', 'equipment', 'motor', 'fitting', 'pipe', 'industrial'],
  },
  'Packaging & Printing': {
    strong: ['packaging', 'corrugated', 'carton', 'flexo', 'offset printing', 'pouch', 'bopp', 'label', 'sticker', 'paper bag', 'shopping bag', 'stretch film', 'bubble wrap', 'packing material'],
    normal: ['printing', 'printed', 'print', 'box', 'packing', 'wrapping', 'lamination', 'laminated', 'tape', 'jar', 'closure', 'kraft', 'paper', 'paperboard', 'folding carton'],
    weak: ['bag', 'film', 'sheet', 'container', 'bottle'],
  },
  'Textiles & Apparel': {
    strong: [
      'textile', 'fabric', 'yarn', 'garment', 'apparel', 'hosiery', 'knitwear', 'denim', 'saree', 'sari', 'spinning', 'weaving', 'dyeing',
      'embroidery', 'readymade', 'home textile', 'bedsheet', 'towel', 'cotton', 'polyester', 'viscose', 'silk', 'linen', 'woven', 'knitted',
    ],
    normal: [
      'shirt', 'tshirt', 't shirt', 'trouser', 'jean', 'kurti', 'kurtis', 'uniform', 'thread', 'lace', 'jute', 'carpet', 'rug', 'curtain', 'blanket', 'sweater',
      'hoodie', 'innerwear', 'sock', 'lingerie', 'shawl', 'scarf', 'footwear', 'shoe', 'leather', 'handloom', 'fiber', 'fibre', 'nonwoven', 'non woven',
    ],
    weak: ['cloth', 'wear', 'stitching', 'stitched'],
  },
  'Chemicals & Raw Materials': {
    strong: [
      'chemical', 'specialty chemical', 'dye', 'pigment', 'resin', 'solvent', 'caustic soda', 'soda ash', 'agrochemical', 'intermediate',
      'adhesive', 'lubricant', 'paint', 'coating', 'varnish', 'surfactant', 'detergent', 'powder coating', 'industrial chemical', 'acid',
    ],
    normal: ['raw material', 'mineral', 'ore', 'silica', 'bentonite', 'wax', 'soap', 'glue', 'putty', 'additive', 'catalyst', 'carbon', 'graphite', 'lime', 'gypsum', 'calcium', 'sodium', 'potassium', 'ammonium', 'ink'],
    weak: ['oil', 'powder', 'liquid', 'compound'],
  },
  'Construction & Building Materials': {
    strong: [
      'cement', 'concrete', 'brick', 'tile', 'ceramic', 'vitrified', 'marble', 'granite', 'sanitaryware', 'tmt', 'rebar', 'plywood', 'flooring',
      'roofing', 'aac block', 'ready mix', 'building material', 'construction material', 'scaffolding', 'structural steel', 'cpvc', 'ppr', 'upvc', 'plumbing',
    ],
    normal: ['stone', 'sanitary', 'faucet', 'laminate', 'sunmica', 'door', 'window', 'glass', 'steel bar', 'aluminium section', 'aluminum section', 'false ceiling', 'paver', 'cladding'],
    weak: ['pipe', 'fitting', 'steel', 'building', 'construction', 'wall'],
  },
  'Electronics & Electricals': {
    strong: [
      'electronic', 'electrical', 'switchgear', 'transformer', 'inverter', 'solar', 'pcb', 'circuit board', 'mcb', 'capacitor', 'relay', 'sensor',
      'led', 'cable', 'wire', 'wiring harness', 'battery', 'charger', 'adapter', 'ups', 'smps', 'connector', 'lighting', 'luminaire',
    ],
    normal: ['switch', 'lamp', 'bulb', 'light', 'fan', 'appliance', 'meter', 'motor', 'panel', 'generator', 'wiring', 'socket', 'plug', 'extension board', 'busbar', 'earthing'],
    weak: ['power', 'electric', 'copper'],
  },
  'Auto Parts & Vehicles': {
    strong: [
      'auto part', 'automotive', 'automobile', 'two wheeler', 'three wheeler', 'four wheeler', 'brake', 'clutch', 'piston', 'gasket', 'axle', 'chassis',
      'radiator', 'spark plug', 'tyre', 'tire', 'suspension', 'bumper', 'headlamp', 'shock absorber', 'e rickshaw', 'ev',
    ],
    normal: ['vehicle', 'car', 'truck', 'tractor', 'bus', 'wheel', 'engine', 'exhaust', 'silencer', 'harness', 'trailer', 'body building'],
    weak: ['part', 'spare', 'oem'],
  },
  'Pharmaceuticals & Healthcare': {
    strong: [
      'pharma', 'pharmaceutical', 'medicine', 'tablet', 'capsule', 'syrup', 'injection', 'api', 'formulation', 'surgical', 'medical', 'healthcare',
      'syringe', 'bandage', 'diagnostic', 'ayurvedic', 'herbal', 'nutraceutical', 'generic drug', 'drug', 'glove', 'mask', 'sanitizer', 'cosmetic', 'personal care', 'hospital',
    ],
    normal: ['supplement', 'wellness', 'disposable', 'ointment', 'cream', 'lotion', 'shampoo', 'skincare', 'hair care', 'sanitary napkin', 'diaper', 'gauze', 'orthopedic', 'implant', 'wheelchair', 'medical device'],
    weak: ['health', 'care'],
  },
  'Agriculture & Food Products': {
    strong: [
      'rice', 'basmati', 'wheat', 'flour', 'atta', 'sugar', 'jaggery', 'spice', 'masala', 'turmeric', 'chilli', 'cumin', 'tea', 'coffee', 'edible oil',
      'groundnut', 'mustard', 'pulse', 'dal', 'lentil', 'cashew', 'almond', 'dry fruit', 'snack', 'namkeen', 'biscuit', 'bakery', 'beverage', 'juice',
      'dairy', 'ghee', 'paneer', 'honey', 'seed', 'fertilizer', 'pesticide', 'organic', 'agro', 'agriculture', 'millet', 'cattle feed', 'poultry', 'seafood',
      'fish', 'frozen food', 'food processing', 'pickle', 'papad', 'noodle', 'pasta', 'sauce', 'jam', 'ketchup', 'chocolate', 'confectionery', 'candy',
      'fruit', 'vegetable', 'onion', 'potato', 'mango', 'banana', 'coconut', 'copra', 'tamarind',
    ],
    normal: ['food', 'grain', 'nut', 'milk', 'oil', 'farm', 'flour mill', 'rice mill', 'dal mill', 'oil mill', 'packaged food', 'ready to eat', 'mineral water', 'drinking water', 'ice cream', 'cold storage', 'soya', 'soybean', 'maize', 'corn', 'barley', 'sesame', 'coriander', 'pepper'],
    weak: ['edible', 'fresh', 'processed'],
  },
  'Plastics & Rubber': {
    strong: [
      'plastic', 'hdpe', 'ldpe', 'lldpe', 'pvc', 'cpvc', 'upvc', 'ppr', 'polymer', 'polypropylene', 'polyethylene', 'injection moulding', 'injection molding',
      'blow moulding', 'blow molding', 'extrusion', 'rubber', 'silicone', 'polyurethane', 'masterbatch', 'granule', 'pet bottle', 'recycled plastic',
      'tarpaulin', 'pp bag', 'hdpe bag', 'woven sack', 'crate', 'abs', 'nylon',
    ],
    normal: ['moulded', 'molded', 'foam', 'eva', 'pu', 'bucket', 'jerry can', 'tank', 'water tank', 'container', 'hose', 'o ring', 'rubber sheet', 'pipe', 'film', 'sheet', 'bottle', 'cap', 'drum'],
    weak: ['moulding', 'molding'],
  },
  'Furniture & Home Decor': {
    strong: [
      'furniture', 'sofa', 'chair', 'mattress', 'wardrobe', 'cabinet', 'modular kitchen', 'home decor', 'decor', 'decorative', 'office furniture',
      'school furniture', 'bed', 'table', 'shelf', 'wooden furniture', 'cane', 'bamboo', 'kitchenware', 'cookware', 'utensil', 'crockery', 'homeware', 'mirror', 'frame', 'cushion', 'lamp shade',
    ],
    normal: ['wooden', 'wood', 'timber', 'carpenter', 'interior', 'steel utensil', 'home furnishing', 'curtain', 'carpet', 'rug', 'pillow'],
    weak: ['home', 'interior'],
  },
  'Gems & Jewellery': {
    strong: [
      'jewellery', 'jewelry', 'gold', 'silver', 'diamond', 'gem', 'gemstone', 'pearl', 'kundan', 'polki', 'bangle', 'necklace', 'earring', 'platinum',
      'precious stone', 'lab grown', 'imitation jewellery', 'artificial jewellery', 'ornament',
    ],
    normal: ['ring', 'pendant', 'bracelet', 'anklet', 'chain', 'mangalsutra', 'bullion', 'hallmark', 'stone'],
    weak: ['jewel'],
  },
  'Handicrafts & Gifts': {
    strong: [
      'handicraft', 'handmade', 'gift', 'souvenir', 'artefact', 'artifact', 'copper craft', 'pottery', 'terracotta', 'idol', 'statue', 'candle',
      'incense', 'agarbatti', 'puja', 'return gift', 'corporate gift', 'craft', 'wooden toy', 'toy', 'showpiece', 'brassware',
    ],
    normal: ['bamboo craft', 'jute craft', 'marble craft', 'metal craft', 'stone craft', 'paper craft', 'coir', 'cane', 'wicker', 'mat', 'basket', 'brassware', 'copperware', 'bidri'],
    weak: ['art', 'antique', 'brass'],
  },
};

/** One word, in the form it is compared in: lower case, plural removed ("boxes" -> "box", "batteries" -> "battery"). */
function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(?:ss|us)$/.test(word)) return word;
  if (/(?:xes|ches|shes|sses|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** The words of a sentence in comparable form, as one string with a space on both ends. */
export function comparable(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem);
  return ` ${words.join(' ')} `;
}

const WEIGHTS = { strong: 3, normal: 2, weak: 1 } as const;

/** Every word list, already in comparable form. */
const COMPILED = PRODUCT_CATEGORIES.map((category) => ({
  category,
  rules: (['strong', 'normal', 'weak'] as const).flatMap((level) =>
    WORDS[category][level].map((word) => ({ phrase: comparable(word), points: WEIGHTS[level] })),
  ),
}));

export interface CategoryScore {
  category: ProductCategory;
  points: number;
}

/** Every category the text points to, best first. */
export function scoreCategories(text: string): CategoryScore[] {
  const haystack = comparable(text);
  return COMPILED.map(({ category, rules }) => {
    const seen = new Set<string>();
    let points = 0;
    for (const { phrase, points: worth } of rules) {
      if (haystack.includes(phrase) && !seen.has(phrase)) {
        seen.add(phrase);
        points += worth;
      }
    }
    return { category, points };
  })
    .filter((score) => score.points > 0)
    .sort((a, b) => b.points - a.points);
}

/** Up to three categories worth suggesting: at least 2 points, and at least 60% of the best one's. */
export function matchCategories(text: string): ProductCategory[] {
  const scores = scoreCategories(text);
  if (scores.length === 0 || scores[0].points < 2) return [];
  const bar = Math.max(2, Math.ceil(scores[0].points * 0.6));
  return scores.filter((score) => score.points >= bar).slice(0, 3).map((score) => score.category);
}

/** True when any word in it belongs to some category: used to tell a product from another fragment of a sentence. */
export function soundsLikeAProduct(fragment: string): boolean {
  return scoreCategories(fragment).length > 0;
}
