/**
 * Optional: a clean product description written by Claude from the facts read on the product's own page.
 * The model is told to use those facts only; the result is then checked, and thrown away (keeping the page's own
 * text) when it brings in any number, unit or claim the facts do not contain, or the model declines.
 */
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM = `You write B2B product descriptions for an Indian wholesale marketplace.
Use ONLY the facts given. Do not add any number, size, grade, certification, standard, price, quantity, delivery time,
claim or adjective that is not in the facts. Do not mention the website, the source, or that you were given facts.
No superlatives (best, leading, top, premium, world-class). Plain, factual English, 2 to 4 sentences, at most 90 words.
If the facts are too thin to say anything useful, answer exactly: INSUFFICIENT`;

const CLAIMS = /\b(best|leading|top[- ]quality|premium|world[- ]class|no\.?\s?1|#1|certified|iso\s?\d+|guaranteed|award|patented|trusted|finest|superior|unmatched|cheapest|lowest price)\b/i;

const numbers = (text) => (String(text).match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/,/g, ''));

/** true when every number in `out` is in the facts and no claim word was added. Exported for tests. */
export function isGrounded(out, factsText) {
  const facts = String(factsText).toLowerCase();
  const factNumbers = new Set(numbers(factsText));
  if (numbers(out).some((n) => !factNumbers.has(n))) return false;
  const claim = String(out).match(CLAIMS);
  if (claim && !facts.includes(claim[0].toLowerCase())) return false;
  if (/https?:\/\/|www\.|@/i.test(out)) return false;
  return true;
}

export function factsFor(product) {
  const lines = [`Product: ${product.name}`];
  if (product.manufacturer) lines.push(`Manufacturer: ${product.manufacturer}`);
  for (const [k, v] of Object.entries(product.specifications || {})) lines.push(`${k}: ${v}`);
  if (product.description_source) lines.push(`Description on the page: ${product.description_source.slice(0, 1500)}`);
  return lines.join('\n');
}

export function createDescriber(cfg, { client } = {}) {
  if (!cfg?.enabled) return null;
  const anthropic = client ?? new Anthropic();
  return async function describe(product) {
    const facts = factsFor(product);
    if (facts.split('\n').length < 3 && !(product.description_source && product.description_source.length > 80)) return null;
    let response;
    try {
      response = await anthropic.beta.messages.create({
        model: cfg.model,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: SYSTEM,
        messages: [{ role: 'user', content: `Facts:\n${facts}` }],
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.APIConnectionError || e instanceof Anthropic.InternalServerError) return null;
      if (e instanceof Anthropic.APIError) return null;
      throw e;
    }
    if (response.stop_reason !== 'end_turn') return null; // refusal, max_tokens, ...
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!text || /^INSUFFICIENT\b/.test(text) || text.split(/\s+/).length > 110) return null;
    return isGrounded(text, facts) ? text : null;
  };
}
