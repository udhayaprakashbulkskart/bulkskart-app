/** Password reset by WhatsApp code: pure helpers (no Deno imports; tested with Vitest). */

/** A uniformly random 6-digit code (rejection sampling, so no digit is more likely than another). */
export function generateCode(rand: (n: Uint32Array) => Uint32Array = (n) => { crypto.getRandomValues(n as unknown as Parameters<typeof crypto.getRandomValues>[0]); return n; }): string {
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
  for (;;) {
    const [x] = rand(new Uint32Array(1));
    if (x < limit) return String(x % 1_000_000).padStart(6, '0');
  }
}

/** Indian 10-digit mobiles get 91 in front; other numbers must already carry their country code. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `91${digits.slice(1)}`;
  if (/^00[1-9]\d{9,13}$/.test(digits)) return digits.slice(2);
  if (/^[1-9]\d{10,14}$/.test(digits)) return digits;
  return null;
}

export const phoneHint = (normalized: string) => `•••• ${normalized.slice(-2)}`;

/** 8–72 characters with at least one letter and one digit (72 is bcrypt's limit). */
export function passwordProblem(pw: string): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'Use at least 8 characters.';
  if (pw.length > 72) return 'Use at most 72 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use letters and at least one number.';
  return null;
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;

/**
 * AiSensy API-campaign request. The campaign's approved template has one parameter, the code. For WhatsApp
 * "authentication" templates with a copy-code button, the code is also passed to the button.
 */
export function aisensyOtpBody(apiKey: string, campaignName: string, destination: string, userName: string, code: string, copyButton: boolean) {
  return {
    apiKey,
    campaignName,
    destination,
    userName: userName.replace(/\s+/g, ' ').trim().slice(0, 60) || 'BulkSkart user',
    templateParams: [code],
    source: 'bulkskart-password-reset',
    ...(copyButton ? { buttons: [{ type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: code }] }] } : {}),
  };
}

/** The first address in X-Forwarded-For (set by the gateway), else a fixed value. */
export function clientIp(headers: { get(name: string): string | null }): string {
  const fwd = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = fwd || headers.get('x-real-ip')?.trim() || headers.get('cf-connecting-ip')?.trim() || 'unknown';
  return ip.slice(0, 64);
}
