import { FOOD_CATALOG } from '../data/foodCatalog';
import type { Item, StoreSection } from '../data/types';
import { normalizeName } from './normalize';

/**
 * Search over everything the user could add to their inventory: items their own
 * data already knows about (recipe ingredients, past additions) plus the static
 * food catalog. Pure — the caller supplies both snapshots.
 */

export interface FoodSuggestion {
  /** Normalized name. Unique within a result set, so it doubles as a list key. */
  key: string;
  name: string;
  section: StoreSection;
  /** True when this is already in the user's inventory. */
  tracked: boolean;
}

const MAX_RESULTS = 40;

export function searchFoods(
  query: string,
  knownItems: Item[],
  trackedNames: Set<string>
): FoodSuggestion[] {
  const q = query.trim().toLowerCase();
  const byKey = new Map<string, FoodSuggestion>();

  const add = (name: string, section: StoreSection) => {
    const key = normalizeName(name);
    if (byKey.has(key)) return;
    byKey.set(key, { key, name, section, tracked: trackedNames.has(key) });
  };

  // Known items go in first so their spelling and section — the ones the rest
  // of the app already uses — win over the catalog's.
  for (const item of knownItems) add(item.name, item.section);
  for (const food of FOOD_CATALOG) add(food.name, food.section);

  const all = [...byKey.values()];
  if (!q) return all.sort((a, b) => a.name.localeCompare(b.name)).slice(0, MAX_RESULTS);

  const exactKey = normalizeName(q);
  const queryTokens = tokenize(q);

  const scored = all
    .map((suggestion) => ({ suggestion, rank: rank(suggestion, q, exactKey, queryTokens) }))
    .filter((scored) => scored.rank < NO_MATCH);

  // Partial-token hits are a last resort: "pumpkin puree" should surface
  // "Pumpkin" when nothing better exists, but never outrank a real match.
  const best = scored.reduce((lowest, s) => Math.min(lowest, s.rank), NO_MATCH);
  const kept = best < PARTIAL ? scored.filter((s) => s.rank < PARTIAL) : scored;

  kept.sort((a, b) => a.rank - b.rank || a.suggestion.name.localeCompare(b.suggestion.name));
  return kept.map((s) => s.suggestion).slice(0, MAX_RESULTS);
}

/** Words to match on. Splits hyphens too, so "all-purpose" matches "purpose". */
function tokenize(text: string): string[] {
  return text.split(/[^a-z0-9]+/i).filter(Boolean);
}

const PARTIAL = 4;
const NO_MATCH = 5;

function rank(
  suggestion: FoodSuggestion,
  query: string,
  exactKey: string,
  queryTokens: string[]
): number {
  if (suggestion.key === exactKey) return 0;

  const lower = suggestion.name.toLowerCase();
  if (lower.startsWith(query)) return 1;
  if (lower.includes(query)) return 2;

  const nameTokens = tokenize(lower);
  const hits = queryTokens.filter((qt) =>
    nameTokens.some((nt) => nt.startsWith(qt) || qt.startsWith(nt))
  ).length;

  if (hits === queryTokens.length) return 3;
  return hits > 0 ? PARTIAL : NO_MATCH;
}

/**
 * The suggestion that *is* the query, if there is one. Drives whether the sheet
 * offers to create a brand-new item instead of picking an existing one.
 */
export function findExactMatch(
  query: string,
  suggestions: FoodSuggestion[]
): FoodSuggestion | null {
  const key = normalizeName(query);
  if (!key) return null;
  return suggestions.find((s) => s.key === key) ?? null;
}
