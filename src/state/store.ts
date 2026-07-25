import { create } from 'zustand';

import { migrate, resetAllData } from '../data/db';
import * as groceryRepo from '../data/groceryRepo';
import * as inventoryRepo from '../data/inventoryRepo';
import * as itemRepo from '../data/itemRepo';
import * as recipeRepo from '../data/recipeRepo';
import { seedIfNeeded } from '../data/seed';
import type {
  GroceryRow,
  InventoryEntry,
  InventoryRow,
  ItemStatus,
  Recipe,
  RecipeWithIngredients,
  StatusSource,
  StoreSection,
} from '../data/types';
import type { CheckoutPlan } from '../logic/matching';

/**
 * Single store for the whole app. SQLite is the source of truth; this holds a
 * read-through cache of it so screens re-render on write. Every mutator writes
 * to the repo first, then refreshes the affected slice — there is no optimistic
 * state that could drift from the database.
 */
interface AppState {
  ready: boolean;
  recipes: Recipe[];
  inventory: InventoryRow[];
  grocery: GroceryRow[];
  /** Status by item id, for recipe cross-referencing. */
  statusMap: Map<string, InventoryEntry>;

  init: () => void;
  refreshRecipes: () => void;
  refreshInventory: () => void;
  refreshGrocery: () => void;

  getRecipe: (id: string) => RecipeWithIngredients | null;
  createRecipe: (input: recipeRepo.NewRecipeInput) => string;
  deleteRecipe: (id: string) => void;

  setItemStatus: (itemId: string, status: ItemStatus, source?: StatusSource) => void;
  addManualItem: (name: string, status: ItemStatus, section: StoreSection) => void;
  clearItemStatus: (itemId: string) => void;

  /** Applies a checkout: inventory writes and grocery additions, together. */
  applyCheckout: (plan: CheckoutPlan, recipeTitle: string) => void;

  toggleGroceryChecked: (entryId: string, checked: boolean) => void;
  removeGroceryEntry: (entryId: string) => void;
  clearCheckedGrocery: () => void;
  addGroceryItemByName: (name: string, quantity: string, section: StoreSection) => void;

  resetEverything: () => void;
}

function buildStatusMap(rows: InventoryRow[]): Map<string, InventoryEntry> {
  const map = new Map<string, InventoryEntry>();
  for (const row of rows) {
    if (row.entry) map.set(row.item.id, row.entry);
  }
  return map;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  recipes: [],
  inventory: [],
  grocery: [],
  statusMap: new Map(),

  init: () => {
    migrate();
    seedIfNeeded();
    get().refreshRecipes();
    get().refreshInventory();
    get().refreshGrocery();
    set({ ready: true });
  },

  refreshRecipes: () => set({ recipes: recipeRepo.listRecipes() }),

  refreshInventory: () => {
    // Includes untracked items so the Inventory screen can offer them for a
    // first-time status set.
    const rows = inventoryRepo.listAllItemsWithStatus();
    set({ inventory: rows, statusMap: buildStatusMap(rows) });
  },

  refreshGrocery: () => set({ grocery: groceryRepo.listGrocery() }),

  getRecipe: (id) => recipeRepo.getRecipe(id),

  createRecipe: (input) => {
    const id = recipeRepo.createRecipe(input);
    get().refreshRecipes();
    // New ingredients may have created new items.
    get().refreshInventory();
    return id;
  },

  deleteRecipe: (id) => {
    recipeRepo.deleteRecipe(id);
    get().refreshRecipes();
  },

  setItemStatus: (itemId, status, source = 'manual') => {
    inventoryRepo.setStatus(itemId, status, source);
    get().refreshInventory();
  },

  addManualItem: (name, status, section) => {
    const item = itemRepo.findOrCreateItem(name, section);
    inventoryRepo.setStatus(item.id, status, 'manual');
    get().refreshInventory();
  },

  clearItemStatus: (itemId) => {
    inventoryRepo.clearStatus(itemId);
    get().refreshInventory();
  },

  applyCheckout: (plan, recipeTitle) => {
    inventoryRepo.setStatusBulk(plan.inventoryUpdates, 'recipe_checkout');
    groceryRepo.addToGroceryBulk(plan.groceryAdditions, recipeTitle);
    get().refreshInventory();
    get().refreshGrocery();
  },

  toggleGroceryChecked: (entryId, checked) => {
    groceryRepo.setChecked(entryId, checked);
    get().refreshGrocery();
  },

  removeGroceryEntry: (entryId) => {
    groceryRepo.removeFromGrocery(entryId);
    get().refreshGrocery();
  },

  clearCheckedGrocery: () => {
    groceryRepo.clearChecked();
    get().refreshGrocery();
  },

  addGroceryItemByName: (name, quantity, section) => {
    const item = itemRepo.findOrCreateItem(name, section);
    groceryRepo.addToGrocery(item.id, quantity, null);
    get().refreshGrocery();
    get().refreshInventory();
  },

  resetEverything: () => {
    resetAllData();
    seedIfNeeded();
    get().refreshRecipes();
    get().refreshInventory();
    get().refreshGrocery();
  },
}));
