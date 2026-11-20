/**
 * BulkSkart - Intelligent Product Image Relevance & Verification Engine
 *
 * Requirements:
 * 1. Build a good search query from each product title:
 *    - Remove SKU codes, numbers, sizes, and filler words
 *    - Extract core product noun (necklace, ring, forklift, copper wire, cotton fabric, etc.)
 *    - Search with that noun plus one adjective at most. Never search with broad category.
 *    - Try in order: specific query, then core noun only.
 * 2. Relevance check:
 *    - Pixabay returns a "tags" string for each hit. Accept hit ONLY if tags contain
 *      the core product noun or a verified synonym.
 *    - Reject hits whose tags contain a conflicting product type (e.g. ring for necklace).
 *    - Pick the best-matching hit among equal matches by hash(product ID).
 *    - If no hit passes, show neutral placeholder ("Photo coming soon").
 */

export interface NounDefinition {
  noun: string;
  pattern?: RegExp;
  synonyms: string[];
  conflicts: string[];
  preferredAdjective?: string;
  iconName?: string;
}

export const PRODUCT_NOUNS_CATALOG: NounDefinition[] = [
  // ── JEWELLERY & GEMS ──────────────────────────────────────────────────
  {
    noun: 'choker',
    synonyms: ['choker', 'chokers', 'necklace', 'necklaces', 'jewellery', 'jewelry', 'pendant'],
    conflicts: ['ring', 'rings', 'earring', 'earrings', 'bangle', 'bangles', 'bracelet', 'bracelets', 'watch'],
    iconName: 'Gem',
  },
  {
    noun: 'necklace',
    synonyms: ['necklace', 'necklaces', 'choker', 'chokers', 'pendant', 'pendants', 'locket', 'jewellery', 'jewelry'],
    conflicts: ['ring', 'rings', 'earring', 'earrings', 'bangle', 'bangles', 'bracelet', 'bracelets', 'watch'],
    iconName: 'Gem',
  },
  {
    noun: 'ring',
    synonyms: ['ring', 'rings', 'finger ring', 'wedding ring', 'diamond ring', 'band', 'jewellery', 'jewelry'],
    conflicts: ['necklace', 'choker', 'earring', 'earrings', 'bangle', 'bracelet', 'pendant'],
    iconName: 'Gem',
  },
  {
    noun: 'chain',
    synonyms: ['chain', 'necklace', 'link chain', 'silver chain', 'gold chain', 'jewellery', 'jewelry'],
    conflicts: ['ring', 'earring', 'bangle', 'chainsaw'],
    iconName: 'Gem',
  },
  {
    noun: 'pendant',
    synonyms: ['pendant', 'pendants', 'necklace', 'locket', 'gemstone', 'jewellery', 'jewelry'],
    conflicts: ['ring', 'rings', 'earring', 'earrings', 'bangle'],
    iconName: 'Gem',
  },
  {
    noun: 'earring',
    synonyms: ['earring', 'earrings', 'ear stud', 'ear studs', 'jhumka', 'jewellery', 'jewelry'],
    conflicts: ['necklace', 'choker', 'ring', 'bangle', 'bracelet'],
    iconName: 'Gem',
  },
  {
    noun: 'bangle',
    synonyms: ['bangle', 'bangles', 'bracelet', 'bracelets', 'wristband', 'jewellery'],
    conflicts: ['necklace', 'choker', 'ring', 'earring'],
    iconName: 'Gem',
  },
  {
    noun: 'bracelet',
    synonyms: ['bracelet', 'bracelets', 'bangle', 'bangles', 'wristband', 'jewellery', 'jewelry'],
    conflicts: ['necklace', 'choker', 'ring', 'earring'],
    iconName: 'Gem',
  },

  // ── MACHINERY, INDUSTRIAL & TOOLS ─────────────────────────────────────
  {
    noun: 'forklift',
    synonyms: ['forklift', 'fork lift', 'stacker', 'pallet jack', 'warehouse truck', 'reach truck', 'lifting equipment'],
    conflicts: ['car', 'motorcycle', 'airplane', 'bicycle'],
    iconName: 'Cog',
  },
  {
    noun: 'hydraulic press',
    synonyms: ['hydraulic press', 'press machine', 'hydraulic', 'stamping machine', 'industrial press'],
    conflicts: ['newspaper', 'news', 'journalism', 'press conference', 'ironing', 'laundry', 'clothes'],
    iconName: 'Cog',
  },
  {
    noun: 'press',
    synonyms: ['hydraulic', 'press machine', 'industrial press', 'machinery', 'stamping'],
    conflicts: ['newspaper', 'news', 'journalism', 'press conference', 'ironing', 'laundry'],
    iconName: 'Cog',
  },
  {
    noun: 'blower',
    synonyms: ['blower', 'industrial blower', 'ventilation fan', 'exhaust fan', 'centrifugal fan', 'blower fan'],
    conflicts: ['leaf blower', 'snow blower'],
    iconName: 'Cog',
  },
  {
    noun: 'pump',
    synonyms: ['pump', 'water pump', 'feed pump', 'centrifugal pump', 'impeller', 'hydraulic pump', 'industrial pump'],
    conflicts: ['shoe', 'shoes', 'high heels', 'heels', 'stiletto', 'fashion'],
    iconName: 'Cog',
  },
  {
    noun: 'motor',
    synonyms: ['motor', 'electric motor', 'engine', 'servo motor', 'gear motor', 'induction motor', 'rotor', 'stator'],
    conflicts: ['scooter', 'motorcycle', 'car', 'vehicle', 'bike', 'moped'],
    iconName: 'Cpu',
  },
  {
    noun: 'transformer',
    synonyms: ['transformer', 'power transformer', 'electrical transformer', 'substation', 'high voltage', 'electrical substation'],
    conflicts: ['robot', 'optimus', 'toy', 'movie', 'autobot', 'decepticon', 'action figure'],
    iconName: 'Cpu',
  },
  {
    noun: 'inverter',
    synonyms: ['inverter', 'vfd', 'frequency converter', 'frequency drive', 'motor drive', 'variable frequency drive', 'electrical drive'],
    conflicts: ['solar panel on roof', 'residential roof'],
    iconName: 'Cpu',
  },
  {
    noun: 'rotor',
    synonyms: ['brake rotor', 'disc brake', 'brake disc', 'rotor', 'brakes', 'caliper'],
    conflicts: ['helicopter', 'drone', 'quadcopter', 'aircraft'],
    iconName: 'Cog',
  },

  // ── HARDWARE & ELECTRICAL ─────────────────────────────────────────────
  {
    noun: 'pipe',
    synonyms: ['pipe', 'pipes', 'tube', 'tubes', 'piping', 'conduit', 'plumbing pipe', 'pvc pipe', 'steel pipe'],
    conflicts: ['smoking', 'tobacco', 'cigar', 'pipe smoking', 'smoker'],
    iconName: 'HardHat',
  },
  {
    noun: 'wire',
    synonyms: ['wire', 'copper wire', 'electrical wire', 'wires', 'cable', 'cables', 'copper cable'],
    conflicts: ['fence', 'barbed wire', 'suspension bridge', 'wire mesh fence'],
    iconName: 'Cpu',
  },
  {
    noun: 'cable',
    synonyms: ['cable', 'cables', 'electrical cable', 'power cable', 'copper wire', 'wire'],
    conflicts: ['suspension bridge', 'cable car', 'ski lift'],
    iconName: 'Cpu',
  },

  // ── TEXTILES & APPAREL ────────────────────────────────────────────────
  {
    noun: 'fabric',
    synonyms: ['fabric', 'fabrics', 'textile', 'textiles', 'cloth', 'cotton fabric', 'silk fabric', 'material', 'texture', 'weave', 'yarn', 'textile roll'],
    conflicts: ['portrait', 'model', 'sexy', 'woman portrait', 'man portrait', 'face', 'bikini'],
    iconName: 'Shirt',
  },
  {
    noun: 'cloth',
    synonyms: ['cloth', 'fabric', 'textile', 'material', 'cotton cloth', 'texture', 'weave'],
    conflicts: ['portrait', 'model', 'sexy', 'woman face'],
    iconName: 'Shirt',
  },
  {
    noun: 'jersey',
    synonyms: ['jersey', 'cotton jersey', 'fabric', 'textile', 'cloth', 'knit fabric'],
    conflicts: ['football player', 'basketball player', 'soccer', 'sports jersey'],
    iconName: 'Shirt',
  },
  {
    noun: 'curtain',
    synonyms: ['curtain', 'curtains', 'drape', 'drapery', 'drapes', 'window curtain'],
    conflicts: ['shower curtain', 'bed', 'carpet', 'pillow'],
    iconName: 'Box',
  },
  {
    noun: 'shawl',
    synonyms: ['shawl', 'shawls', 'scarf', 'stole', 'wrap', 'wool shawl', 'cashmere'],
    conflicts: ['blanket', 'towel', 'bedsheet'],
    iconName: 'Shirt',
  },
  {
    noun: 'kurta',
    synonyms: ['kurta', 'kurtas', 'tunic', 'shirt', 'clothing', 'apparel', 'ethnic wear'],
    conflicts: ['shoes', 'trousers', 'pants'],
    iconName: 'Shirt',
  },
  {
    noun: 'shoes',
    synonyms: ['shoe', 'shoes', 'footwear', 'leather shoes', 'slippers', 'loafers', 'sandals'],
    conflicts: ['horse', 'horseshoe', 'shirt', 'dress'],
    iconName: 'Shirt',
  },

  // ── FURNITURE & HOME ──────────────────────────────────────────────────
  {
    noun: 'bed',
    synonyms: ['bed', 'beds', 'bed frame', 'bedroom', 'wooden bed', 'mattress', 'headboard'],
    conflicts: ['hospital bed', 'flower bed', 'river bed', 'chair', 'sofa'],
    iconName: 'Box',
  },
  {
    noun: 'table',
    synonyms: ['table', 'tables', 'dining table', 'wooden table', 'desk', 'furniture'],
    conflicts: ['periodic table', 'table tennis', 'ping pong', 'chair only'],
    iconName: 'Box',
  },
  {
    noun: 'tray',
    synonyms: ['tray', 'trays', 'serving tray', 'wooden tray', 'bamboo tray', 'platter'],
    conflicts: ['ashtray', 'baking tray', 'ice cube tray'],
    iconName: 'Box',
  },
  {
    noun: 'runner',
    synonyms: ['runner', 'table runner', 'tablecloth', 'linen runner', 'dining table'],
    conflicts: ['athlete', 'marathon', 'running', 'jogger', 'runner sprinting'],
    iconName: 'Box',
  },
  {
    noun: 'catcher',
    synonyms: ['dream catcher', 'dreamcatcher', 'feathers', 'craft', 'handmade'],
    conflicts: ['baseball', 'baseball catcher'],
    iconName: 'Sparkles',
  },
  {
    noun: 'sculpture',
    synonyms: ['sculpture', 'sculptures', 'statue', 'statues', 'stone sculpture', 'carving'],
    conflicts: [],
    iconName: 'Sparkles',
  },
  {
    noun: 'coasters',
    synonyms: ['coasters', 'coaster', 'drink coasters', 'cup coasters', 'felt coasters'],
    conflicts: ['roller coaster'],
    iconName: 'Box',
  },

  // ── FOOD & AGRI ───────────────────────────────────────────────────────
  {
    noun: 'oil',
    synonyms: ['oil', 'sesame oil', 'cooking oil', 'vegetable oil', 'olive oil', 'oil bottle'],
    conflicts: ['motor oil', 'engine oil', 'car oil', 'petrol', 'crude oil', 'oil spill'],
    iconName: 'Wheat',
  },
  {
    noun: 'rice',
    synonyms: ['rice', 'raw rice', 'rice grain', 'grains', 'basmati', 'white rice', 'cereal'],
    conflicts: ['cooked rice', 'fried rice', 'sushi', 'soup', 'bowl of cooked rice'],
    iconName: 'Wheat',
  },
  {
    noun: 'chilli',
    synonyms: ['chilli', 'chili', 'chilli powder', 'red chilli', 'paprika', 'spice', 'spices', 'red pepper'],
    conflicts: ['face powder', 'snow', 'cosmetics'],
    iconName: 'Wheat',
  },
  {
    noun: 'spice',
    synonyms: ['spice', 'spices', 'seasoning', 'coriander', 'cumin', 'cardamom', 'turmeric'],
    conflicts: ['spice girls'],
    iconName: 'Wheat',
  },
  {
    noun: 'cardamom',
    synonyms: ['cardamom', 'cardamon', 'spice', 'spices', 'green cardamom', 'pods'],
    conflicts: [],
    iconName: 'Wheat',
  },
  {
    noun: 'cashew',
    synonyms: ['cashew', 'cashews', 'cashew nuts', 'nut', 'nuts', 'raw cashew'],
    conflicts: [],
    iconName: 'Wheat',
  },
  {
    noun: 'lentils',
    synonyms: ['lentils', 'dal', 'pulses', 'beans', 'legumes', 'grain'],
    conflicts: ['cooked dal', 'soup'],
    iconName: 'Wheat',
  },

  // ── PHARMA & CHEMICALS ────────────────────────────────────────────────
  {
    noun: 'sensor',
    synonyms: ['sensor', 'electronic sensor', 'proximity sensor', 'transducer', 'detector', 'electronics'],
    conflicts: [],
    iconName: 'Cpu',
  },
  {
    noun: 'switch',
    synonyms: ['switch', 'electrical switch', 'toggle switch', 'push button', 'circuit breaker'],
    conflicts: ['nintendo', 'nintendo switch', 'video game'],
    iconName: 'Cpu',
  },
  {
    noun: 'panel',
    synonyms: ['solar panel', 'solar panels', 'solar module', 'photovoltaic', 'electrical panel'],
    conflicts: ['comic panel'],
    iconName: 'Sun',
  },
  {
    noun: 'flour',
    synonyms: ['flour', 'wheat flour', 'grain flour', 'baking flour', 'cereal'],
    conflicts: ['flower', 'flowers'],
    iconName: 'Wheat',
  },
  {
    noun: 'seeds',
    synonyms: ['seeds', 'seed', 'sesame seed', 'grain', 'planting seeds', 'agriculture'],
    conflicts: [],
    iconName: 'Wheat',
  },
  {
    noun: 'tablets',
    synonyms: ['tablet', 'tablets', 'pill', 'pills', 'medicine', 'medication', 'pharmacy', 'pharmaceutical', 'capsule'],
    conflicts: ['ipad', 'android tablet', 'computer tablet', 'digital tablet', 'graphic tablet', 'screen'],
    iconName: 'FlaskConical',
  },
  {
    noun: 'capsules',
    synonyms: ['capsule', 'capsules', 'softgel', 'softgels', 'pill', 'pills', 'vitamin', 'vitamins', 'supplement'],
    conflicts: ['space capsule', 'time capsule', 'coffee capsule'],
    iconName: 'FlaskConical',
  },
  {
    noun: 'bandage',
    synonyms: ['bandage', 'bandages', 'crepe bandage', 'gauze', 'dressing', 'medical dressing', 'first aid'],
    conflicts: [],
    iconName: 'FlaskConical',
  },
  {
    noun: 'granules',
    synonyms: ['granules', 'plastic granules', 'pellets', 'polymer pellets', 'plastic raw material', 'resin'],
    conflicts: [],
    iconName: 'FlaskConical',
  },
  {
    noun: 'bottle',
    synonyms: ['bottle', 'bottles', 'plastic bottle', 'pet bottle', 'container', 'bottle preform'],
    conflicts: ['wine bottle', 'beer bottle', 'whiskey', 'alcohol'],
    iconName: 'Box',
  },
  {
    noun: 'acid',
    synonyms: ['acid', 'chemical', 'chemicals', 'laboratory', 'liquid flask', 'laboratory chemical'],
    conflicts: ['lsd'],
    iconName: 'FlaskConical',
  },
];

/**
 * Deterministic hash for product ID to ensure even distribution among equal hits
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Clean product title by removing SKU codes, numbers, specs, filler words
 */
export function cleanProductTitle(rawTitle: string): string {
  if (!rawTitle) return '';

  return rawTitle
    // 1. Remove SKU, Lot, Batch, Ref, Model codes e.g. SKU155, Batch164, Lot302, Ref314, #119, Mk117, P166, FL-30
    .replace(/\b(batch|lot|ref|sku|code|art|model|pno|cat|part)\s*#?[a-z0-9_-]+/gi, ' ')
    .replace(/\b(p|mk|fl)\s*#?\d+[a-z0-9_-]*/gi, ' ')
    .replace(/#\s*\d+/gi, ' ')
    // 2. Remove dimensions, units, voltages, capacities e.g. 25mm, 50 Ton, 2.2KW, 1HP, 5Nm, 60K, 400mg, 10cm, 40x180cm, 925, 18 inch
    .replace(/\b\d+(\.\d+)?\s*(mm|cm|m|meter|meters|inch|inches|kg|g|gm|mg|ton|tons|tonne|hp|kw|kva|w|watt|watts|v|volt|volts|a|amp|amps|ah|mah|nm|ml|l|ltr|oz|lb|lbs|psi|bar|rpm|gsm|sq|deg|gauge)\b/gi, ' ')
    .replace(/\b\d+x\d+(\w+)?\b/gi, ' ')
    .replace(/\b\d+%\b/gi, ' ')
    .replace(/\b\d+\b/gi, ' ')
    // 3. Remove marketing filler words
    .replace(/\b(grade|pure|virgin|raw|heavy|duty|industrial|commercial|high|quality|premium|wholesale|bulk|pack|lot|set|piece|pieces|pcs|custom|standard|export|domestic|brand|new|genuine|best|fine|seater|king|queen|double|single|size|extra|bold|top|style|look|hand-loomed|cold pressed|vented|adjustable)\b/gi, ' ')
    // 4. Remove special characters and clean whitespace
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ExtractedQuery {
  specificQuery: string;
  coreNounQuery: string;
  coreNoun: string;
  adjective: string;
  definition: NounDefinition;
}

/**
 * Step 1: Build a good search query from product title
 * - Removes SKU codes, numbers, sizes, and filler words
 * - Extracts core product noun
 * - Constructs specific query (noun + 1 adjective) and fallback query (noun only)
 */
export function buildQueriesForProduct(title: string): ExtractedQuery {
  const cleaned = cleanProductTitle(title);
  const lowerTitle = title.toLowerCase();

  // Try matching against product catalog
  let matchedDef: NounDefinition | undefined;
  for (const def of PRODUCT_NOUNS_CATALOG) {
    // Check if the noun appears as a whole word in title
    const regex = new RegExp(`\\b${def.noun}s?\\b`, 'i');
    if (regex.test(lowerTitle)) {
      matchedDef = def;
      break;
    }
  }

  // Fallback noun if not in predefined catalog
  if (!matchedDef) {
    const cleanedWords = cleaned.split(' ').filter(w => w.length > 2);
    const fallbackNoun = cleanedWords.length > 0 ? cleanedWords[cleanedWords.length - 1].toLowerCase() : 'product';
    matchedDef = {
      noun: fallbackNoun,
      synonyms: [fallbackNoun],
      conflicts: [],
      iconName: 'Package',
    };
  }

  const coreNoun = matchedDef.noun;
  const coreNounWords = coreNoun.split(' ');
  const cleanedWords = cleaned.split(' ').filter(w => w.length > 1);

  // Extract at most 1 descriptive adjective that is not the core noun
  const remainingAdjectives = cleanedWords.filter(
    w => !coreNounWords.includes(w.toLowerCase()) && w.toLowerCase() !== coreNoun
  );

  let adjective = '';
  if (remainingAdjectives.length > 0) {
    adjective = remainingAdjectives[0].toLowerCase();
  } else if (matchedDef.preferredAdjective) {
    adjective = matchedDef.preferredAdjective;
  }

  const specificQuery = adjective ? `${adjective} ${coreNoun}`.trim() : coreNoun;
  const coreNounQuery = coreNoun;

  return {
    specificQuery,
    coreNounQuery,
    coreNoun,
    adjective,
    definition: matchedDef,
  };
}

export interface HitRelevanceResult {
  isMatch: boolean;
  matchedTag: string | null;
  score: number;
  rejectionReason?: string;
}

/**
 * Step 2: Relevance check
 * - Pixabay returns a "tags" string for each hit
 * - Reject hit if tags contain a conflicting product type
 * - Accept hit ONLY if tags contain the core product noun or a synonym
 */
export function checkHitRelevance(
  tagsString: string | undefined | null,
  definition: NounDefinition
): HitRelevanceResult {
  if (!tagsString) {
    return { isMatch: false, matchedTag: null, score: 0, rejectionReason: 'empty_tags' };
  }

  const rawTags = tagsString
    .toLowerCase()
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  const allTagWords = rawTags.flatMap(t => t.split(/\s+/));

  // 1. Check conflict tags (Reject hits whose tags contain a different product type)
  for (const conflict of definition.conflicts) {
    const lowerConflict = conflict.toLowerCase().trim();
    if (lowerConflict.includes(' ')) {
      // multi-word conflict (e.g. "leaf blower", "table tennis")
      if (tagsString.toLowerCase().includes(lowerConflict)) {
        return {
          isMatch: false,
          matchedTag: null,
          score: -100,
          rejectionReason: `conflicting_type:${conflict}`,
        };
      }
    } else {
      // single word conflict (e.g. "ring" for necklace)
      if (allTagWords.includes(lowerConflict) || rawTags.includes(lowerConflict)) {
        // Ensure this isn't also the core noun (e.g. "toe ring" vs "ring")
        if (definition.noun !== lowerConflict && !definition.synonyms.includes(lowerConflict)) {
          return {
            isMatch: false,
            matchedTag: null,
            score: -100,
            rejectionReason: `conflicting_type:${conflict}`,
          };
        }
      }
    }
  }

  // 2. Check for core noun or synonym match in tags
  let matchedTag: string | null = null;
  let score = 0;

  for (const syn of definition.synonyms) {
    const lowerSyn = syn.toLowerCase().trim();
    if (rawTags.includes(lowerSyn)) {
      matchedTag = lowerSyn;
      score += 50; // exact tag match
      break;
    }
  }

  if (!matchedTag) {
    for (const syn of definition.synonyms) {
      const lowerSyn = syn.toLowerCase().trim();
      if (allTagWords.includes(lowerSyn)) {
        matchedTag = lowerSyn;
        score += 30; // word-level match
        break;
      }
    }
  }

  if (!matchedTag) {
    for (const syn of definition.synonyms) {
      const lowerSyn = syn.toLowerCase().trim();
      if (tagsString.toLowerCase().includes(lowerSyn)) {
        matchedTag = lowerSyn;
        score += 20; // substring match
        break;
      }
    }
  }

  if (!matchedTag) {
    return {
      isMatch: false,
      matchedTag: null,
      score: 0,
      rejectionReason: `missing_core_noun:${definition.noun}`,
    };
  }

  return {
    isMatch: true,
    matchedTag,
    score,
  };
}

export interface PixabayHitSummary {
  id: number;
  tags: string;
  webformatURL: string;
  largeImageURL?: string;
  previewURL?: string;
  imageWidth?: number;
  imageHeight?: number;
  likes?: number;
  downloads?: number;
  views?: number;
}

/**
 * Pick best-matching hit among all hits passing relevance check
 * Breaks ties deterministically using hash(productId)
 */
export function selectBestRelevantHit(
  hits: PixabayHitSummary[],
  definition: NounDefinition,
  productId: string,
  excludedUrls: Set<string> = new Set()
): { hit: PixabayHitSummary | null; matchedTag: string | null; score: number } {
  const passingHits: { hit: PixabayHitSummary; matchedTag: string; score: number }[] = [];

  for (const hit of hits) {
    if (excludedUrls.has(hit.webformatURL)) continue;

    const res = checkHitRelevance(hit.tags, definition);
    if (res.isMatch && res.matchedTag) {
      let finalScore = res.score;

      // Aspect ratio bonus: landscape 1.25 to 1.75 is optimal
      const w = hit.imageWidth || 800;
      const h = hit.imageHeight || 600;
      const aspect = w / h;
      if (aspect >= 1.2 && aspect <= 1.8) {
        finalScore += 10;
      }

      // Quality bonus from Pixabay engagement metrics
      if (hit.likes) finalScore += Math.min(10, Math.log10(hit.likes + 1) * 2);
      if (hit.downloads) finalScore += Math.min(10, Math.log10(hit.downloads + 1) * 2);

      passingHits.push({
        hit,
        matchedTag: res.matchedTag,
        score: finalScore,
      });
    }
  }

  if (passingHits.length === 0) {
    return { hit: null, matchedTag: null, score: 0 };
  }

  // Sort by score descending
  passingHits.sort((a, b) => b.score - a.score);

  // Group top matches with scores within 5 points of highest
  const topScore = passingHits[0].score;
  const topTier = passingHits.filter(h => topScore - h.score <= 5);

  // Pick deterministically among top tier by hash(product ID)
  const hash = hashString(productId);
  const selected = topTier[hash % topTier.length];

  return {
    hit: selected.hit,
    matchedTag: selected.matchedTag,
    score: selected.score,
  };
}
