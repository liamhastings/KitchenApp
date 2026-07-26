/**
 * Domain types for Restock.
 *
 * Deliberately NOT quantity-based. Inventory is a three-state status the user
 * sets at their own discretion. `lastUpdated` exists for display and sorting
 * only — nothing in this app decays, downgrades, or second-guesses a status
 * based on how old it is.
 */

/** The only inventory states. There is no numeric count anywhere. */
export type ItemStatus = 'full' | 'some' | 'none';

/** How an inventory status was last set. Display/debug only. */
export type StatusSource = 'recipe_checkout' | 'grocery_checkout' | 'manual' | 'seed';

/** Aisle grouping used to organize the grocery list. */
export type StoreSection =
  | 'produce'
  | 'meat_seafood'
  | 'dairy'
  | 'bakery'
  | 'pantry'
  | 'frozen'
  | 'spices'
  | 'beverages'
  | 'other';

export const STORE_SECTIONS: StoreSection[] = [
  'produce',
  'meat_seafood',
  'dairy',
  'bakery',
  'pantry',
  'frozen',
  'spices',
  'beverages',
  'other',
];

export const SECTION_LABELS: Record<StoreSection, string> = {
  produce: 'Produce',
  meat_seafood: 'Meat & Seafood',
  dairy: 'Dairy & Eggs',
  bakery: 'Bakery',
  pantry: 'Pantry',
  frozen: 'Frozen',
  spices: 'Spices',
  beverages: 'Beverages',
  other: 'Other',
};

export const STATUS_LABELS: Record<ItemStatus, string> = {
  full: 'Full',
  some: 'Some',
  none: 'None',
};

/**
 * A canonical kitchen item. Recipes reference items by id so that "Eggs" in one
 * recipe and "eggs" in another resolve to the same inventory row.
 */
export interface Item {
  id: string;
  /** Human-facing name, e.g. "Olive oil". */
  name: string;
  /** Lowercased/trimmed key used for de-duplication. Unique. */
  normalizedName: string;
  section: StoreSection;
}

/**
 * Inventory state for an item. An item with no InventoryEntry is *untracked*
 * — distinct from `none`, which is a deliberate user statement.
 */
export interface InventoryEntry {
  itemId: string;
  status: ItemStatus;
  /** ISO-8601. Reference only — never used to auto-change `status`. */
  lastUpdated: string;
  source: StatusSource;
}

/** An item joined with its inventory state, for list rendering. */
export interface InventoryRow {
  item: Item;
  /** null when the user has never set a status for this item. */
  entry: InventoryEntry | null;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  itemId: string;
  /** Free text as written in the recipe, e.g. "2 cups". May be empty. */
  quantity: string;
  sortOrder: number;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  servings: string;
  isUserCreated: boolean;
  createdAt: string;
}

/** A recipe with its ingredients resolved to canonical items. */
export interface RecipeWithIngredients extends Recipe {
  ingredients: Array<RecipeIngredient & { item: Item }>;
}

/** What the user tapped for one ingredient during a recipe pass. */
export type IngredientChoice = 'have' | 'need';

export interface GroceryEntry {
  id: string;
  itemId: string;
  /** Accumulated quantity text, e.g. "2 cups; 1 tbsp". */
  quantity: string;
  /** Where it came from, for context in the list. */
  sourceRecipeTitle: string | null;
  checked: boolean;
  addedAt: string;
}

/** A grocery entry joined with its item, for list rendering. */
export interface GroceryRow {
  entry: GroceryEntry;
  item: Item;
}
