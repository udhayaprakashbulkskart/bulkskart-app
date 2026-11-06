/**
 * How a product card writes the minimum order and the unit of the price.
 * Both come from the product's own MOQ text ("MOQ: 5,000 Pcs"), so nothing is made up here.
 */

export interface MoqParts {
  /** The quantity as it was written, for example "5,000". Empty when the text has no number. */
  qty: string;
  /** The unit in words, for example "Pieces" ("Piece" when the quantity is 1). */
  unit: string;
  /** The unit a price is quoted per, for example "Piece". */
  priceUnit: string;
  /** What the card prints after "Minimum Order:", for example "5,000 Pieces". */
  text: string;
}

/** [what the unit is written as, plural, singular] */
const UNITS: Array<[RegExp, string, string]> = [
  [/^(?:pcs?|pieces?)\.?$/i, 'Pieces', 'Piece'],
  [/^units?$/i, 'Units', 'Unit'],
  [/^sets?$/i, 'Sets', 'Set'],
  [/^pairs?$/i, 'Pairs', 'Pair'],
  [/^(?:m|mtrs?|meters?|metres?)$/i, 'Meters', 'Meter'],
  [/^(?:kgs?|kilograms?)$/i, 'Kg', 'Kg'],
  [/^(?:mt|tons?|tonnes?)$/i, 'MT', 'MT'],
  [/^containers?$/i, 'Containers', 'Container'],
  [/^rolls?$/i, 'Rolls', 'Roll'],
  [/^(?:boxes|box)$/i, 'Boxes', 'Box'],
  [/^cartons?$/i, 'Cartons', 'Carton'],
  [/^bags?$/i, 'Bags', 'Bag'],
  [/^(?:liters?|litres?|ltrs?)$/i, 'Liters', 'Liter'],
];

function capitalise(word: string): string {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

export function describeMoq(moq: string | null | undefined): MoqParts {
  const raw = (moq ?? '').trim();
  const match = /^(?:moq\s*:?\s*)?(\d[\d,]*(?:\.\d+)?)\s*(.*)$/i.exec(raw);
  if (!match) {
    // no number to work with (for example "MOQ: On request"): show the words as they are
    const words = raw.replace(/^moq\s*:?\s*/i, '').trim();
    return { qty: '', unit: 'Units', priceUnit: 'Unit', text: words || 'On request' };
  }
  const qty = match[1];
  const written = match[2].trim();
  const amount = Number(qty.replace(/,/g, ''));
  const known = UNITS.find(([pattern]) => pattern.test(written));
  const plural = known ? known[1] : capitalise(written) || 'Units';
  const singular = known ? known[2] : capitalise(written) || 'Unit';
  const unit = amount === 1 ? singular : plural;
  return { qty, unit, priceUnit: singular, text: `${qty} ${unit}` };
}
