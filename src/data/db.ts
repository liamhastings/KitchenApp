import * as SQLite from 'expo-sqlite';

const DB_NAME = 'restock.db';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Lazily opens the database. Every repository goes through this so there is
 * exactly one connection for the app's lifetime.
 */
export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    db.execSync('PRAGMA foreign_keys = ON;');
  }
  return db;
}

/**
 * Creates the schema if it doesn't exist.
 *
 * Note there is no quantity column on `inventory` — the three-state status is
 * the whole model. `last_updated` is written on every status change but is only
 * ever read for display and sorting.
 */
export function migrate(): void {
  const database = getDb();

  database.execSync(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      section TEXT NOT NULL DEFAULT 'other'
    );

    CREATE TABLE IF NOT EXISTS inventory (
      item_id TEXT PRIMARY KEY NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('full', 'some', 'none')),
      last_updated TEXT NOT NULL,
      source TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      servings TEXT NOT NULL DEFAULT '',
      is_user_created INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY NOT NULL,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      quantity TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS grocery_items (
      id TEXT PRIMARY KEY NOT NULL,
      item_id TEXT NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
      quantity TEXT NOT NULL DEFAULT '',
      source_recipe_title TEXT,
      checked INTEGER NOT NULL DEFAULT 0,
      added_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
      ON recipe_ingredients(recipe_id);
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}

/** Reads a value from the key/value `meta` table. */
export function getMeta(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

/** Writes a value to the key/value `meta` table. */
export function setMeta(key: string, value: string): void {
  getDb().runSync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

/** Collision-resistant enough for a single-device local MVP. */
export function uid(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Drops all rows. Used by the "reset app data" action in Settings. */
export function resetAllData(): void {
  const database = getDb();
  database.execSync(`
    DELETE FROM grocery_items;
    DELETE FROM recipe_ingredients;
    DELETE FROM recipes;
    DELETE FROM inventory;
    DELETE FROM items;
    DELETE FROM meta;
  `);
}
