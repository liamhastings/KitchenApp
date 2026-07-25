import { getDb, uid } from './db';
import type { GroceryEntry, GroceryRow, Item, StoreSection } from './types';

interface JoinedRow {
  id: string;
  item_id: string;
  quantity: string;
  source_recipe_title: string | null;
  checked: number;
  added_at: string;
  item_name: string;
  normalized_name: string;
  section: string;
}

function toGroceryRow(row: JoinedRow): GroceryRow {
  const item: Item = {
    id: row.item_id,
    name: row.item_name,
    normalizedName: row.normalized_name,
    section: row.section as StoreSection,
  };
  const entry: GroceryEntry = {
    id: row.id,
    itemId: row.item_id,
    quantity: row.quantity,
    sourceRecipeTitle: row.source_recipe_title,
    checked: row.checked === 1,
    addedAt: row.added_at,
  };
  return { entry, item };
}

export function listGrocery(): GroceryRow[] {
  return getDb()
    .getAllSync<JoinedRow>(
      `SELECT g.*, i.name AS item_name, i.normalized_name, i.section
       FROM grocery_items g
       JOIN items i ON i.id = g.item_id
       ORDER BY g.checked, i.name COLLATE NOCASE`
    )
    .map(toGroceryRow);
}

/**
 * Adds an item to the list, or merges into the existing row if it's already
 * there. Quantities from different recipes accumulate as text ("2 cups; 1 tbsp")
 * rather than being summed — units are free text and adding them would be a
 * guess.
 */
export function addToGrocery(
  itemId: string,
  quantity: string,
  sourceRecipeTitle: string | null
): void {
  const db = getDb();
  const existing = db.getFirstSync<{
    id: string;
    quantity: string;
    checked: number;
    source_recipe_title: string | null;
  }>('SELECT id, quantity, checked, source_recipe_title FROM grocery_items WHERE item_id = ?', [
    itemId,
  ]);

  const now = new Date().toISOString();
  const cleanQty = quantity.trim();

  if (!existing) {
    db.runSync(
      `INSERT INTO grocery_items (id, item_id, quantity, source_recipe_title, checked, added_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [uid('gro_'), itemId, cleanQty, sourceRecipeTitle, now]
    );
    return;
  }

  // Re-adding a checked-off item means the user needs it again: un-check it and
  // start its quantity over rather than appending to a stale value.
  if (existing.checked === 1) {
    db.runSync(
      'UPDATE grocery_items SET quantity = ?, source_recipe_title = ?, checked = 0, added_at = ? WHERE id = ?',
      [cleanQty, sourceRecipeTitle, now, existing.id]
    );
    return;
  }

  const parts = existing.quantity
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  if (cleanQty && !parts.includes(cleanQty)) parts.push(cleanQty);

  db.runSync('UPDATE grocery_items SET quantity = ? WHERE id = ?', [
    parts.join('; '),
    existing.id,
  ]);
}

/** Adds many items in one transaction (recipe checkout). */
export function addToGroceryBulk(
  entries: Array<{ itemId: string; quantity: string }>,
  sourceRecipeTitle: string | null
): void {
  if (entries.length === 0) return;
  getDb().withTransactionSync(() => {
    for (const e of entries) {
      addToGrocery(e.itemId, e.quantity, sourceRecipeTitle);
    }
  });
}

export function setChecked(entryId: string, checked: boolean): void {
  getDb().runSync('UPDATE grocery_items SET checked = ? WHERE id = ?', [
    checked ? 1 : 0,
    entryId,
  ]);
}

export function removeFromGrocery(entryId: string): void {
  getDb().runSync('DELETE FROM grocery_items WHERE id = ?', [entryId]);
}

export function clearChecked(): void {
  getDb().runSync('DELETE FROM grocery_items WHERE checked = 1');
}

export function clearGrocery(): void {
  getDb().runSync('DELETE FROM grocery_items');
}
