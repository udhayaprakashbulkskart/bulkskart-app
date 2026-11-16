/**
 * Phone and e-mail checks for the sign-up form, written for how people really type them:
 * "98765 43210", "+91 98765-43210", "09876543210", "me@gmial.com".
 */

export interface MobileCheck {
  ok: boolean;
  /** "+919876543210": what is saved */
  e164: string | null;
  /** "+91 98765 43210": what is shown back */
  display: string | null;
}

const NOT_OK: MobileCheck = { ok: false, e164: null, display: null };

/**
 * An Indian mobile number is 10 digits starting 6 to 9; it may be written with +91, 91 or 0 in front. A number with
 * another country code is accepted as long as it has a plausible length, because the form is for any manufacturer.
 */
export function checkMobile(input: string): MobileCheck {
  const raw = input.trim();
  if (!raw) return NOT_OK;
  const digits = raw.replace(/\D/g, '');
  const international = raw.startsWith('+') || raw.startsWith('00');

  let national: string | null = null;
  if (international) {
    const withCode = raw.startsWith('00') ? digits.slice(2) : digits;
    if (withCode.startsWith('91')) national = withCode.slice(2);
    else if (withCode.length >= 8 && withCode.length <= 15) return { ok: true, e164: `+${withCode}`, display: `+${withCode}` };
    else return NOT_OK;
  } else if (digits.length === 10) national = digits;
  else if (digits.length === 11 && digits.startsWith('0')) national = digits.slice(1);
  else if (digits.length === 12 && digits.startsWith('91')) national = digits.slice(2);

  if (!national || !/^[6-9]\d{9}$/.test(national)) return NOT_OK;
  return { ok: true, e164: `+91${national}`, display: `+91 ${national.slice(0, 5)} ${national.slice(5)}` };
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function looksLikeEmail(value: string): boolean {
  return EMAIL_SHAPE.test(value.trim());
}

const COMMON_DOMAINS = ['gmail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com', 'hotmail.com', 'rediffmail.com', 'icloud.com'];
/** Real mail services that sit one letter away from a common one ("mail.com" is not a typo of "gmail.com") */
const OTHER_REAL_DOMAINS = new Set([
  'mail.com', 'gmx.com', 'aol.com', 'zoho.com', 'live.com', 'live.in', 'msn.com', 'me.com', 'ymail.com', 'rocketmail.com', 'proton.me',
  'protonmail.com', 'googlemail.com', 'yahoo.in', 'yahoo.co.uk', 'outlook.in', 'hotmail.co.uk',
]);

/** Number of single-character edits (insert, delete, change, swap two neighbours) between two words. */
function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

/**
 * "me@gmial.com" -> "me@gmail.com". Only a well-known mail domain written one or two letters wrong is corrected;
 * a company's own domain is never touched.
 */
export function suggestEmailFix(email: string): string | null {
  const value = email.trim().toLowerCase();
  if (!looksLikeEmail(value)) return null;
  const at = value.lastIndexOf('@');
  const domain = value.slice(at + 1);
  if (COMMON_DOMAINS.includes(domain) || OTHER_REAL_DOMAINS.has(domain)) return null;
  const close = COMMON_DOMAINS.filter((known) => distance(domain, known) <= (known.length >= 9 ? 2 : 1));
  return close.length === 1 ? `${value.slice(0, at + 1)}${close[0]}` : null;
}
