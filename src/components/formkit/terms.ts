/** Payment and delivery terms offered by the quotation forms, so every quote form lists the same choices. */
export const PAYMENT_TERMS: readonly string[] = ['100% Advance', '50% Advance', 'LC 30 Days', 'LC 60 Days', 'Net 30', 'Net 60', 'CAD', 'TT'];
export const DELIVERY_TERMS: readonly string[] = ['Ex-Works', 'FOB', 'CIF', 'C&F', 'DAP', 'DDP'];

/** The list, with a value that is not in it (an older or typed-in one) kept at the front so it stays selected. */
export function optionsWith(list: readonly string[], value: string | null | undefined): string[] {
  const current = (value ?? '').trim();
  return current && !list.includes(current) ? [current, ...list] : [...list];
}
