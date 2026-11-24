/**
 * The worker talks to the database only through the discovery_worker_* functions of migration 00074, over the
 * website's own API with the service role key. It has no direct table access.
 */
export class RpcError extends Error {
  constructor(fn, status, body) {
    super(`${fn}: ${body?.message || body?.error || `HTTP ${status}`}`);
    this.fn = fn;
    this.status = status;
    this.code = body?.code;
  }
}

export function createRpc({ supabaseUrl, serviceKey, fetchImpl = fetch }) {
  return async function rpc(fn, args = {}) {
    const res = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { message: text.slice(0, 300) }; }
    if (!res.ok) throw new RpcError(fn, res.status, body);
    return body;
  };
}
