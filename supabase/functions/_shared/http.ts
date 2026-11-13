export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export function razorpayConfig() {
  return {
    keyId: (Deno.env.get('RAZORPAY_KEY_ID') || '').trim(),
    keySecret: (Deno.env.get('RAZORPAY_KEY_SECRET') || '').trim(),
    webhookSecret: (Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || '').trim(),
  };
}

export function keysMissingResponse(): Response {
  return json({
    error: 'Payment gateway is not configured. Please contact support.',
    code: 'RAZORPAY_KEYS_MISSING',
  }, 503);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
