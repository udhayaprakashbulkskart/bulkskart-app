/**
 * robots.txt as RFC 9309 describes it: the group for our product token (or "*"), the longest matching rule wins,
 * "allow" wins a tie, "*" matches any characters and "$" ends a pattern. Crawl-delay is honoured too.
 */

export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      if (value === '' && key === 'disallow') continue; // "Disallow:" with nothing allows everything
      current.rules.push({ allow: key === 'allow', path: value });
    } else if (key === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return { groups };
}

function groupFor(robots, token) {
  const named = robots.groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  if (named.length) return { rules: named.flatMap((g) => g.rules), crawlDelay: named.find((g) => g.crawlDelay !== null)?.crawlDelay ?? null };
  const star = robots.groups.filter((g) => g.agents.includes('*'));
  return { rules: star.flatMap((g) => g.rules), crawlDelay: star.find((g) => g.crawlDelay !== null)?.crawlDelay ?? null };
}

function patternToRegex(path) {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** May `token` fetch `pathWithQuery` (e.g. "/products/a?x=1")? */
export function isAllowed(robots, token, pathWithQuery) {
  if (!robots) return true;
  const { rules } = groupFor(robots, token.toLowerCase());
  let best = null;
  for (const rule of rules) {
    if (!rule.path) continue;
    let target = pathWithQuery;
    try { target = decodeURI(pathWithQuery); } catch { /* keep as is */ }
    if (!patternToRegex(rule.path).test(target) && !patternToRegex(rule.path).test(pathWithQuery)) continue;
    const len = rule.path.replace(/[*$]/g, '').length;
    if (!best || len > best.len || (len === best.len && rule.allow && !best.allow)) best = { len, allow: rule.allow };
  }
  return best ? best.allow : true;
}

export function crawlDelaySeconds(robots, token) {
  if (!robots) return null;
  return groupFor(robots, token.toLowerCase()).crawlDelay;
}

/** robots.txt answered: allow all (missing, 4xx) or block all (5xx / unreachable), per RFC 9309 section 2.3.1 */
export const ALLOW_ALL = { groups: [] };
export const DISALLOW_ALL = { groups: [{ agents: ['*'], rules: [{ allow: false, path: '/' }], crawlDelay: null }] };
