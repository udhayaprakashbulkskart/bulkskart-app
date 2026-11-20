import { stateFromGstCode } from './places';
import { GSTIN_REGEX } from './vocab';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** What the 4th letter of a PAN (the 6th character of a GSTIN) says about who holds it. */
const PAN_HOLDER: Record<string, string> = {
  C: 'Company',
  P: 'Individual / proprietorship',
  H: 'Hindu undivided family',
  F: 'Partnership firm / LLP',
  A: 'Association of persons',
  T: 'Trust',
  B: 'Body of individuals',
  L: 'Local authority',
  J: 'Artificial juridical person',
  G: 'Government',
};

/** Upper case, without spaces or dashes: how a GSTIN is written once it is pasted from a bill. */
export function cleanGstin(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]+/g, '');
}

/**
 * The 15th character of a GSTIN is a check character worked out from the first 14: weights 1, 2, 1, 2 ... on their
 * base-36 values, the digits of each product added up in base 36, and the check is what brings the total to a
 * multiple of 36.
 */
export function gstinCheckCharacter(first14: string): string {
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const product = ALPHABET.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return ALPHABET[(36 - (total % 36)) % 36];
}

export interface GstinInfo {
  gstin: string;
  stateCode: string;
  /** the state the number is registered in; null for codes that are not a state (97, 99) */
  state: string | null;
  /** characters 3 to 12 of a GSTIN are the holder's PAN */
  pan: string;
  holder: string | null;
  /** false when the last character does not fit the rest: usually a typo, so it is a warning, not a refusal */
  checkOk: boolean;
}

/** Reads a complete, correctly shaped GSTIN; returns null for anything else. */
export function decodeGstin(raw: string): GstinInfo | null {
  const gstin = cleanGstin(raw);
  if (!GSTIN_REGEX.test(gstin)) return null;
  const stateCode = gstin.slice(0, 2);
  return {
    gstin,
    stateCode,
    state: stateFromGstCode(stateCode),
    pan: gstin.slice(2, 12),
    holder: PAN_HOLDER[gstin[5]] ?? null,
    checkOk: gstinCheckCharacter(gstin.slice(0, 14)) === gstin[14],
  };
}

export type GstinProgress =
  | { status: 'empty' }
  /** still being typed */
  | { status: 'typing'; length: number }
  /** 15 or more characters that are not shaped like a GSTIN */
  | { status: 'invalid' }
  | { status: 'ok'; info: GstinInfo };

/** What to tell someone who is typing a GST number into a box. */
export function gstinProgress(raw: string): GstinProgress {
  const gstin = cleanGstin(raw);
  if (gstin.length === 0) return { status: 'empty' };
  if (gstin.length < 15) return { status: 'typing', length: gstin.length };
  const info = decodeGstin(gstin);
  return info ? { status: 'ok', info } : { status: 'invalid' };
}

/** A GSTIN written inside a sentence; people sometimes put spaces between its parts. */
export const GSTIN_IN_TEXT = /\b\d{2}\s?[A-Z]{5}\s?\d{4}\s?[A-Z]\s?[1-9A-Z]\s?Z\s?[0-9A-Z]\b/i;

export function findGstin(text: string): GstinInfo | null {
  const match = GSTIN_IN_TEXT.exec(text);
  return match ? decodeGstin(match[0]) : null;
}
