import { getDb, uid } from './db';
import { findOrCreateItem } from './itemRepo';
import type { Recipe, RecipeWithIngredients, StoreSection } from './types';

interface RecipeRow {
  id: string;
  title: string;
  description: string;
  servings: string;
  is_user_created: number;
  created_at: string;
  source_url: string | null;
}

interface IngredientJoinRow {
  ing_id: string;
  recipe_id: string;
  quantity: string;
  sort_order: number;
  item_id: string;
  item_name: string;
  normalized_name: string;
  section: string;
}

function toRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    servings: row.servings,
    isUserCreated: row.is_user_created === 1,
    createdAt: row.created_at,
    sourceUrl: row.source_url ?? '',
  };
}

export function listRecipes(): Recipe[] {
  return getDb()
    .getAllSync<RecipeRow>('SELECT * FROM recipes ORDER BY title COLLATE NOCASE')
    .map(toRecipe);
}

export function getRecipe(id: string): RecipeWithIngredients | null {
  const row = getDb().getFirstSync<RecipeRow>('SELECT * FROM recipes WHERE id = ?', [id]);
  if (!row) return null;

  const ingredients = getDb().getAllSync<IngredientJoinRow>(
    `SELECT ri.id AS ing_id, ri.recipe_id, ri.quantity, ri.sort_order,
            i.id AS item_id, i.name AS item_name, i.normalized_name, i.section
     FROM recipe_ingredients ri
     JOIN items i ON i.id = ri.item_id
     WHERE ri.recipe_id = ?
     ORDER BY ri.sort_order`,
    [id]
  );

  return {
    ...toRecipe(row),
    ingredients: ingredients.map((ing) => ({
      id: ing.ing_id,
      recipeId: ing.recipe_id,
      itemId: ing.item_id,
      quantity: ing.quantity,
      sortOrder: ing.sort_order,
      item: {
        id: ing.item_id,
        name: ing.item_name,
        normalizedName: ing.normalized_name,
        section: ing.section as StoreSection,
      },
    })),
  };
}

export interface NewRecipeInput {
  title: string;
  description?: string;
  servings?: string;
  isUserCreated?: boolean;
  /** Set only by web import; typed and seeded recipes leave it empty. */
  sourceUrl?: string;
  ingredients: Array<{ name: string; quantity?: string; section?: StoreSection }>;
}

/**
 * Creates a recipe and resolves each ingredient name to a canonical item,
 * creating items that don't exist yet. Returns the new recipe id.
 */
export function createRecipe(input: NewRecipeInput): string {
  const recipeId = uid('rec_');
  const now = new Date().toISOString();
  const db = getDb();

  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO recipes (id, title, description, servings, is_user_created, created_at, source_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        recipeId,
        input.title.trim(),
        input.description?.trim() ?? '',
        input.servings?.trim() ?? '',
        input.isUserCreated === false ? 0 : 1,
        now,
        input.sourceUrl?.trim() ?? '',
      ]
    );

    input.ingredients.forEach((ing, index) => {
      const name = ing.name.trim();
      if (!name) return;
      const item = findOrCreateItem(name, ing.section ?? 'other');
      db.runSync(
        `INSERT INTO recipe_ingredients (id, recipe_id, item_id, quantity, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [uid('ring_'), recipeId, item.id, ing.quantity?.trim() ?? '', index]
      );
    });
  });

  return recipeId;
}

/**
 * Ingredient item ids for every recipe, in one query, so the recipe list can
 * show an "on hand" summary without loading each recipe individually.
 */
export function getAllRecipeItemIds(): Map<string, string[]> {
  const rows = getDb().getAllSync<{ recipe_id: string; item_id: string }>(
    'SELECT recipe_id, item_id FROM recipe_ingredients ORDER BY sort_order'
  );
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.recipe_id);
    if (existing) existing.push(row.item_id);
    else map.set(row.recipe_id, [row.item_id]);
  }
  return map;
}

/** Lets import warn about a page the user has already saved. */
export function findRecipeBySourceUrl(sourceUrl: string): Recipe | null {
  const url = sourceUrl.trim();
  if (!url) return null;
  const row = getDb().getFirstSync<RecipeRow>(
    'SELECT * FROM recipes WHERE source_url = ? LIMIT 1',
    [url]
  );
  return row ? toRecipe(row) : null;
}

export function deleteRecipe(id: string): void {
  getDb().runSync('DELETE FROM recipes WHERE id = ?', [id]);
}
