/** MOQ with short unit names so it fits beside "Free Delivery" on a phone card ("100 Cartons" → "100 Ctns"). */
export function shortMoq(moq: string): string {
  return moq
    .replace(/\bpieces\b|\bpcs\b/gi, 'Pcs')
    .replace(/\bcartons?\b/gi, 'Ctns')
    .replace(/\bcontainers?\b/gi, 'Cntr')
    .replace(/\bsquare (?:meters?|metres?)\b/gi, 'Sq m')
    .replace(/\bmeters?\b|\bmetres?\b/gi, 'm')
    .replace(/\bkilograms?\b|\bkgs?\b/gi, 'Kg')
    .replace(/\bmetric (?:tons?|tonnes?)\b/gi, 'MT')
    .replace(/\blitres?\b|\bliters?\b/gi, 'L');
}
