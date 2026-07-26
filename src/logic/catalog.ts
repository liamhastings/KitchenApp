import { CATALOG, type CatalogFood } from '../data/catalog';
import { normalizeName } from './normalize';

/**
 * Search and pricing over the static food catalog. Pure — no React, no SQLite —
 * so the rules below are testable under plain Node.
 */

let byNormalizedName: Map<string, CatalogFood> | null = null;

function index(): Map<string, CatalogFood> {
  if (!byNormalizedName) {
    byNormalizedName = new Map();
    for (const food of CATALOG) byNormalizedName.set(normalizeName(food.name), food);
  }
  return byNormalizedName;
}

/** The catalog entry for a name, or null if it isn't a known product. */
export function findCatalogFood(name: string): CatalogFood | null {
  return index().get(normalizeName(name)) ?? null;
}

/**
 * Autocomplete for the grocery add field. Typing "chicken" should surface the
 * actual products — breast, thighs, drumsticks — rather than leaving the user
 * to name them.
 *
 * Ranked so the most literal interpretation wins:
 *   0  the query already names a product exactly
 *   1  a product name starts with the query      ("chick" -> Chicken breast)
 *   2  a later word starts with the query        ("brea"  -> Chicken breast)
 *   3  the query appears anywhere in the name
 *
 * Returns [] for an empty query. A miss is not an error — the caller is
 * expected to fall back to adding the raw text.
 */
export function searchCatalog(query: string, limit = 6): CatalogFood[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return [];

  const exact = normalizeName(query);
  const scored: Array<{ food: CatalogFood; rank: number }> = [];

  for (const food of CATALOG) {
    const name = food.name.toLowerCase();
    let rank = -1;

    if (normalizeName(food.name) === exact) rank = 0;
    else if (name.startsWith(q)) rank = 1;
    else if (name.split(' ').some((word) => word.startsWith(q))) rank = 2;
    else if (name.includes(q)) rank = 3;

    if (rank >= 0) scored.push({ food, rank });
  }

  scored.sort((a, b) => a.rank - b.rank || a.food.name.localeCompare(b.food.name));
  return scored.slice(0, limit).map((s) => s.food);
}

export interface GroceryEstimate {
  /** CAD before tax: one unit of each priced item. */
  total: number;
  pricedCount: number;
  /** Items with no catalog price. Deliberately not counted as $0. */
  unpricedCount: number;
}

/**
 * A rough cost for the list.
 *
 * Two deliberate limits, both of which the UI has to state rather than hide:
 *
 * 1. It prices **one unit of each item**. Quantities on the list are free text
 *    ("2 cans; 1 tbsp") and parsing them into a multiplier would be a guess —
 *    the same reason the list accumulates quantity text instead of summing it.
 * 2. Items missing from the catalog are **reported, not zeroed**. An unpriced
 *    item silently contributing $0 would quietly understate the total, which is
 *    worse than admitting the total is partial.
 */
export function estimateGroceryTotal(items: Array<{ name: string }>): GroceryEstimate {
  let total = 0;
  let pricedCount = 0;
  let unpricedCount = 0;

  for (const item of items) {
    const food = findCatalogFood(item.name);
    if (food) {
      total += food.price;
      pricedCount += 1;
    } else {
      unpricedCount += 1;
    }
  }

  // Cents, so repeated float addition can't surface as $23.870000000000001.
  return { total: Math.round(total * 100) / 100, pricedCount, unpricedCount };
}
