/** Units a bulk order is counted in, and the ways people write them. */
export const ORDER_UNITS = ['Pcs', 'Units', 'Sets', 'Pairs', 'Boxes', 'Cartons', 'KG', 'Tons', 'MT', 'Litres', 'Meters'] as const;

const ALIASES: Record<string, string> = {
  pc: 'Pcs',
  pcs: 'Pcs',
  piece: 'Pcs',
  pieces: 'Pcs',
  nos: 'Pcs',
  unit: 'Units',
  units: 'Units',
  set: 'Sets',
  sets: 'Sets',
  pair: 'Pairs',
  pairs: 'Pairs',
  box: 'Boxes',
  boxes: 'Boxes',
  carton: 'Cartons',
  cartons: 'Cartons',
  kg: 'KG',
  kgs: 'KG',
  kilogram: 'KG',
  kilograms: 'KG',
  ton: 'Tons',
  tons: 'Tons',
  tonne: 'Tons',
  tonnes: 'Tons',
  mt: 'MT',
  litre: 'Litres',
  litres: 'Litres',
  liter: 'Litres',
  liters: 'Litres',
  ltr: 'Litres',
  meter: 'Meters',
  meters: 'Meters',
  metre: 'Meters',
  metres: 'Meters',
  mtr: 'Meters',
};

/** "Pieces" -> "Pcs"; a unit that is not on the list is kept as written. */
export function normaliseUnit(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return 'Pcs';
  return ALIASES[value.toLowerCase()] ?? value;
}

/** "MOQ: 100 Pieces" -> { quantity: 100, unit: "Pcs" } */
export function readMoq(moq: string | null | undefined): { quantity: number | null; unit: string } {
  const match = (moq ?? '').match(/(\d[\d,]*)\s*([A-Za-z.]+)?/);
  if (!match) return { quantity: null, unit: 'Pcs' };
  return { quantity: Number(match[1].replace(/,/g, '')), unit: normaliseUnit(match[2]?.replace(/\.$/, '')) };
}

/** The list to offer, with the given unit in it even when it is not one of the usual ones. */
export function unitsWith(unit: string): string[] {
  return (ORDER_UNITS as readonly string[]).includes(unit) ? [...ORDER_UNITS] : [unit, ...ORDER_UNITS];
}
