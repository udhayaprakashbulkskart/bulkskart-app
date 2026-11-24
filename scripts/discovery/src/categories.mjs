/**
 * BulkSkart's top-level category slugs, picked from the words of a product name, its category text and specs.
 * No match means no category (an admin can set one); nothing is guessed from the company alone.
 */
const RULES = [
  ['textiles-apparel', /\b(fabric|yarn|textile|garment|apparel|t-?shirts?|shirts?|hosiery|knit|denim|cotton|polyester|saree|towel|bedsheet|uniform|thread|weaving|jute fabric)\b/i],
  ['packaging', /\b(packaging|carton|corrugated|box(es)?|pouch|woven sack|sacks?|bags? \(packaging\)|bopp|jumbo bag|fibc|stretch film|shrink film|label|tape|container|bottle|jar|cap|closure|laminate)\b/i],
  ['machinery-industrial', /\b(machine|machinery|pump|motor|compressor|gear ?box|valve|bearing|conveyor|boiler|lathe|cnc|press|crusher|mixer|blower|fan|chiller|turbine|hydraulic|pneumatic|spare parts?|casting|forging|fastener|bolt|nut|screw)\b/i],
  ['electronics-electricals', /\b(cable|wire|switch(gear)?|transformer|led|lighting|panel|inverter|ups|battery|solar|electrical|electronic|pcb|sensor|meter|charger|socket|mcb|capacitor)\b/i],
  ['chemicals-raw-materials', /\b(chemical|acid|solvent|resin|pigment|dye|polymer|granules?|powder|alkali|caustic|oxide|sulphate|chloride|reagent|additive|adhesive|coating|paint|ink|catalyst|cas\s*no)\b/i],
  ['plastics-rubber', /\b(plastic|pvc|hdpe|ldpe|pp |polypropylene|rubber|silicone|moulded|molded|pipe fittings?|hose|gasket|o-?ring)\b/i],
  ['construction-building', /\b(tiles?|cement|tmt|steel bars?|brick|block|marble|granite|sanitary|plywood|door|window|roofing|sheet|pipe|aggregate|construction|scaffold|faucet)\b/i],
  ['agriculture-food', /\b(rice|wheat|spice|turmeric|chilli|cumin|pulses?|dal|sugar|jaggery|tea|coffee|cashew|seeds?|fertili[sz]er|pesticide|grain|flour|oil seeds?|edible oil|honey|fruit|vegetable|dairy|food)\b/i],
  ['pharma-healthcare', /\b(pharma|tablet|capsule|syrup|api\b|drug|medical|surgical|hospital|diagnostic|ayurvedic|nutraceutical|sanitizer|gloves|mask|syringe)\b/i],
  ['furniture-home', /\b(furniture|chair|table|sofa|bed|cabinet|wardrobe|kitchen|home d[eé]cor|carpet|rug|curtain|mattress|lamp|cookware|utensil)\b/i],
  ['handicrafts-gifts', /\b(handicraft|handmade|brass|wooden craft|gift|souvenir|artifact|figurine|decorative|idol|pottery|candle|incense)\b/i],
  ['gems-jewellery', /\b(jewell?ery|gemstone|diamond|gold|silver|necklace|bangle|ring|earring|pearl)\b/i],
  ['auto-parts-vehicles', /\b(auto(motive)? parts?|automobile|vehicle|tractor|brake|clutch|piston|radiator|silencer|axle|tyre|tire|wheel rim|spark plug|engine parts?)\b/i],
];

export function categoryFor(...texts) {
  const text = texts.filter(Boolean).join(' \n ');
  if (!text.trim()) return null;
  let best = null;
  for (const [slug, re] of RULES) {
    const hits = (text.match(new RegExp(re.source, 'gi')) || []).length;
    if (hits && (!best || hits > best.hits)) best = { slug, hits };
  }
  return best?.slug ?? null;
}
