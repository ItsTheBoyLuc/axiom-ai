/**
 * robots.txt handling (RFC 9309), enough for a polite fetcher: pick the group that names our
 * product token (else `*`), and apply the longest matching Allow/Disallow rule, `*` wildcards and
 * `$` end anchors included. Allow wins a tie. No rules for us means allowed.
 */

type Rule = { allow: boolean; pattern: string };
export type RobotsRules = { rules: Rule[]; crawlDelaySeconds: number | null };

const ALLOW_ALL: RobotsRules = { rules: [], crawlDelaySeconds: null };
export const allowAll = (): RobotsRules => ALLOW_ALL;
/** Used when robots.txt could not be fetched reliably (5xx, network error): be conservative. */
export const disallowAll = (): RobotsRules => ({
  rules: [{ allow: false, pattern: '/' }],
  crawlDelaySeconds: null,
});

export function parseRobots(text: string, productToken: string): RobotsRules {
  const token = productToken.toLowerCase();
  type Group = { agents: string[]; rules: Rule[]; delay: number | null };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], delay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === 'allow' || field === 'disallow') {
      // An empty Disallow means "nothing is disallowed"; an empty Allow is meaningless.
      if (value !== '') current.rules.push({ allow: field === 'allow', pattern: value });
    } else if (field === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.delay = n;
    }
  }

  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  if (chosen.length === 0) return ALLOW_ALL;
  return {
    rules: chosen.flatMap((g) => g.rules),
    crawlDelaySeconds: chosen.find((g) => g.delay !== null)?.delay ?? null,
  };
}

/** Turns a robots pattern into a RegExp anchored at the start of the path. */
function toRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** May `path` (with query) be fetched under these rules? */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of rules.rules) {
    if (!toRegExp(rule.pattern).test(path)) continue;
    const length = rule.pattern.length;
    if (!best || length > best.length || (length === best.length && rule.allow)) {
      best = { allow: rule.allow, length };
    }
  }
  return best ? best.allow : true;
}
