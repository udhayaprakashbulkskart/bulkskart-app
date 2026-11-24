/**
 * Settings from the environment. Only variable NAMES appear in this repository; values are GitHub Actions secrets.
 *
 *   SUPABASE_URL                  default https://www.bulkskart.com
 *   SUPABASE_SERVICE_ROLE_KEY     required to read jobs and save results (without it the worker does nothing)
 *   BRAVE_SEARCH_API_KEY          search provider: Brave Search API, or
 *   GOOGLE_CSE_KEY + GOOGLE_CSE_ID  Google Programmable Search JSON API
 *   SEARCH_PROVIDER               "brave" | "google_cse" (picked from the keys when unset)
 *   GST_VERIFY_URL                authorised GST verification endpoint (a GST Suvidha Provider), with {gstin} in it
 *   GST_VERIFY_API_KEY            its key; sent in GST_VERIFY_AUTH_HEADER (default "Authorization")
 *   GST_VERIFY_EXTRA_HEADERS      optional JSON object of further headers the provider needs
 *   GST_VERIFY_PROVIDER           a label kept with each check (default: the endpoint's host)
 *   ANTHROPIC_API_KEY             optional: rewrite product descriptions from the facts found
 *   DISCOVERY_LLM_MODEL           default claude-opus-5-5
 *   DISCOVERY_TIME_BUDGET_MIN     minutes per run (default 45)
 */

export const USER_AGENT = 'BulkSkartDiscoveryBot/1.0 (+https://www.bulkskart.com/bot)';
/** the product token robots.txt rules are matched against */
export const ROBOTS_TOKEN = 'bulkskartdiscoverybot';

function json(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function loadConfig(env = process.env) {
  const braveKey = env.BRAVE_SEARCH_API_KEY || '';
  const googleKey = env.GOOGLE_CSE_KEY || '';
  const googleCx = env.GOOGLE_CSE_ID || '';
  const provider = env.SEARCH_PROVIDER || (braveKey ? 'brave' : googleKey && googleCx ? 'google_cse' : '');
  const gstUrl = env.GST_VERIFY_URL || '';
  let gstHost = '';
  try { gstHost = gstUrl ? new URL(gstUrl.replace('{gstin}', 'x')).hostname : ''; } catch { gstHost = ''; }
  return {
    supabaseUrl: (env.SUPABASE_URL || 'https://www.bulkskart.com').replace(/\/+$/, ''),
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
    search: { provider, braveKey, googleKey, googleCx },
    gst: {
      url: gstUrl,
      apiKey: env.GST_VERIFY_API_KEY || '',
      authHeader: env.GST_VERIFY_AUTH_HEADER || 'Authorization',
      extraHeaders: json(env.GST_VERIFY_EXTRA_HEADERS, {}),
      provider: env.GST_VERIFY_PROVIDER || gstHost,
    },
    llm: {
      enabled: Boolean(env.ANTHROPIC_API_KEY) && env.DISCOVERY_AI_DESCRIPTIONS !== 'off',
      model: env.DISCOVERY_LLM_MODEL || 'claude-opus-5-5',
    },
    timeBudgetMs: Math.max(1, Number(env.DISCOVERY_TIME_BUDGET_MIN) || 45) * 60_000,
    maxRechecks: Math.max(0, Number(env.DISCOVERY_MAX_RECHECKS) || 30),
    maxProductsPerSite: Math.max(1, Number(env.DISCOVERY_MAX_PRODUCTS_PER_SITE) || 60),
  };
}
