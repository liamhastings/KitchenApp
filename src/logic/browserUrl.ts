/**
 * Turns whatever the user typed in the browser's address bar into something
 * navigable. Pure, so the "is this a URL or a search?" call is checkable.
 */

const SEARCH_PREFIX = 'https://duckduckgo.com/?q=';

export function toBrowserUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^about:|^data:/i.test(raw)) return raw;

  // A single token with a dot and no spaces is a domain; anything else is a
  // search. "chicken pot pie" and "how to sear" must not become URLs.
  const looksLikeDomain = !/\s/.test(raw) && /^[^\s/]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(raw);
  if (looksLikeDomain) return `https://${raw}`;

  return SEARCH_PREFIX + encodeURIComponent(raw);
}

/** Host only, for compact display next to an imported recipe. */
export function hostOf(url: string): string {
  const match = url.match(/^https?:\/\/([^/:?#]+)/i);
  return match ? match[1].replace(/^www\./i, '') : '';
}
