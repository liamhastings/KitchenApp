import type {
  IngredientChoice,
  InventoryEntry,
  ItemStatus,
  RecipeWithIngredients,
} from '../data/types';

/**
 * Pure recipe/inventory cross-referencing. No React, no SQLite — everything
 * here is a function of (recipe, inventory snapshot), which keeps it trivially
 * testable and lets the two halves of the app be worked on independently.
 */

/**
 * Pre-fill rule for one ingredient:
 *   full      -> have  (they said it's stocked)
 *   some      -> have  (judgment call; "some" usually covers one recipe's worth,
 *                       and it's one tap to override)
 *   none      -> need
 *   untracked -> need  (never stated, so don't claim they have it)
 *
 * Every one of these is a suggestion the user can flip with a single tap.
 */
export function prefillChoice(status: ItemStatus | null): IngredientChoice {
  switch (status) {
    case 'full':
    case 'some':
      return 'have';
    case 'none':
      return 'need';
    default:
      return 'need';
  }
}

export interface IngredientLine {
  ingredientId: string;
  itemId: string;
  itemName: string;
  quantity: string;
  /** Current inventory status, or null if the item is untracked. */
  status: ItemStatus | null;
  /** ISO timestamp of the last status change; null when untracked. */
  lastUpdated: string | null;
  choice: IngredientChoice;
  /** True while `choice` is still the app's suggestion, false once tapped. */
  isPrefilled: boolean;
}

/**
 * Builds the initial have/need state for a recipe from an inventory snapshot.
 */
export function buildIngredientLines(
  recipe: RecipeWithIngredients,
  statusMap: Map<string, InventoryEntry>
): IngredientLine[] {
  return recipe.ingredients.map((ing) => {
    const entry = statusMap.get(ing.itemId) ?? null;
    const status = entry?.status ?? null;
    return {
      ingredientId: ing.id,
      itemId: ing.itemId,
      itemName: ing.item.name,
      quantity: ing.quantity,
      status,
      lastUpdated: entry?.lastUpdated ?? null,
      choice: prefillChoice(status),
      isPrefilled: true,
    };
  });
}

/**
 * The status to write when the user confirms "have it" at checkout.
 *
 * Confirming does not inflate what the user already told us: an item they'd
 * marked `some` stays `some`, it just gets a fresh timestamp. Only an item that
 * was `none` or untracked is promoted to `full`, because tapping "have it" is a
 * direct contradiction of the old value.
 */
export function statusAfterHave(current: ItemStatus | null): ItemStatus {
  if (current === 'some') return 'some';
  return 'full';
}

export interface CheckoutPlan {
  /** Inventory writes from "have it" ingredients. */
  inventoryUpdates: Array<{ itemId: string; status: ItemStatus }>;
  /** Grocery additions from "need it" ingredients. */
  groceryAdditions: Array<{ itemId: string; quantity: string }>;
}

/**
 * Turns the user's have/need taps into the two writes checkout performs.
 *
 * `markNeedAsNone` is off by default: "I need to buy this" is not the same
 * claim as "I have zero of it", so the app does not infer one from the other.
 * The checkout screen exposes it as an explicit opt-in.
 */
export function buildCheckoutPlan(
  lines: IngredientLine[],
  options: { markNeedAsNone?: boolean } = {}
): CheckoutPlan {
  const inventoryUpdates: CheckoutPlan['inventoryUpdates'] = [];
  const groceryAdditions: CheckoutPlan['groceryAdditions'] = [];

  for (const line of lines) {
    if (line.choice === 'have') {
      inventoryUpdates.push({
        itemId: line.itemId,
        status: statusAfterHave(line.status),
      });
    } else {
      groceryAdditions.push({ itemId: line.itemId, quantity: line.quantity });
      if (options.markNeedAsNone) {
        inventoryUpdates.push({ itemId: line.itemId, status: 'none' });
      }
    }
  }

  return { inventoryUpdates, groceryAdditions };
}

export interface RecipeMatch {
  total: number;
  /** Ingredients currently marked `full` or `some`. */
  onHand: number;
  /** Ingredients marked `none`. */
  missing: number;
  /** Ingredients with no status recorded at all. */
  unknown: number;
}

/**
 * Summary shown on the recipe list ("5 of 7 on hand") so the user can pick a
 * recipe without opening it. Untracked ingredients are counted separately
 * rather than being assumed missing.
 */
export function computeMatchForItems(
  itemIds: string[],
  statusMap: Map<string, InventoryEntry>
): RecipeMatch {
  let onHand = 0;
  let missing = 0;
  let unknown = 0;

  for (const itemId of itemIds) {
    const status = statusMap.get(itemId)?.status ?? null;
    if (status === 'full' || status === 'some') onHand += 1;
    else if (status === 'none') missing += 1;
    else unknown += 1;
  }

  return { total: itemIds.length, onHand, missing, unknown };
}

export function computeRecipeMatch(
  recipe: RecipeWithIngredients,
  statusMap: Map<string, InventoryEntry>
): RecipeMatch {
  return computeMatchForItems(
    recipe.ingredients.map((ing) => ing.itemId),
    statusMap
  );
}
