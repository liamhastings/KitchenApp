import { getDb, uid } from './db';
import type { Item, StoreSection } from './types';

interface ItemRow {
  id: string;
  name: string;
  normalized_name: string;
  section: string;
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    section: row.section as StoreSection,
  };
}

/**
 * Collapses "  Olive Oil " and "olive oil" to the same key so recipes written
 * at different times still point at one inventory row. Also strips a trailing
 * plural "s" so "eggs"/"egg" match.
 */
export function normalizeName(raw: string): string {
  const base = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (base.length > 3 && base.endsWith('s') && !base.endsWith('ss')) {
    return base.slice(0, -1);
  }
  return base;
}

export function listItems(): Item[] {
  return getDb()
    .getAllSync<ItemRow>('SELECT * FROM items ORDER BY name COLLATE NOCASE')
    .map(toItem);
}

export function getItem(id: string): Item | null {
  const row = getDb().getFirstSync<ItemRow>('SELECT * FROM items WHERE id = ?', [id]);
  return row ? toItem(row) : null;
}

export function findItemByName(name: string): Item | null {
  const row = getDb().getFirstSync<ItemRow>(
    'SELECT * FROM items WHERE normalized_name = ?',
    [normalizeName(name)]
  );
  return row ? toItem(row) : null;
}

/**
 * Returns the existing canonical item for `name`, or creates one.
 * This is the single entry point for turning free text into an item id.
 */
export function findOrCreateItem(name: string, section: StoreSection = 'other'): Item {
  const existing = findItemByName(name);
  if (existing) return existing;

  const item: Item = {
    id: uid('item_'),
    name: name.trim(),
    normalizedName: normalizeName(name),
    section,
  };
  getDb().runSync(
    'INSERT INTO items (id, name, normalized_name, section) VALUES (?, ?, ?, ?)',
    [item.id, item.name, item.normalizedName, item.section]
  );
  return item;
}

export function updateItemSection(itemId: string, section: StoreSection): void {
  getDb().runSync('UPDATE items SET section = ? WHERE id = ?', [section, itemId]);
}
