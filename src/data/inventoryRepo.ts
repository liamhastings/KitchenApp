import { getDb } from './db';
import type {
  InventoryEntry,
  InventoryRow,
  Item,
  ItemStatus,
  StatusSource,
  StoreSection,
} from './types';

interface JoinedRow {
  id: string;
  name: string;
  normalized_name: string;
  section: string;
  status: string | null;
  last_updated: string | null;
  source: string | null;
}

function toInventoryRow(row: JoinedRow): InventoryRow {
  const item: Item = {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    section: row.section as StoreSection,
  };
  const entry: InventoryEntry | null =
    row.status === null
      ? null
      : {
          itemId: row.id,
          status: row.status as ItemStatus,
          lastUpdated: row.last_updated as string,
          source: row.source as StatusSource,
        };
  return { item, entry };
}

/**
 * The user's inventory: every item they have given a status, newest change
 * first. Items that merely exist because a recipe mentions them are excluded —
 * they are search suggestions, not inventory.
 */
export function listInventory(): InventoryRow[] {
  return getDb()
    .getAllSync<JoinedRow>(
      `SELECT i.id, i.name, i.normalized_name, i.section,
              inv.status, inv.last_updated, inv.source
       FROM items i
       JOIN inventory inv ON inv.item_id = i.id
       ORDER BY inv.last_updated DESC`
    )
    .map(toInventoryRow);
}

export function getStatus(itemId: string): InventoryEntry | null {
  const row = getDb().getFirstSync<{
    item_id: string;
    status: string;
    last_updated: string;
    source: string;
  }>('SELECT * FROM inventory WHERE item_id = ?', [itemId]);

  if (!row) return null;
  return {
    itemId: row.item_id,
    status: row.status as ItemStatus,
    lastUpdated: row.last_updated,
    source: row.source as StatusSource,
  };
}

/** Bulk status lookup keyed by item id, for recipe cross-referencing. */
export function getStatusMap(itemIds: string[]): Map<string, InventoryEntry> {
  if (itemIds.length === 0) return new Map();
  const placeholders = itemIds.map(() => '?').join(',');
  const rows = getDb().getAllSync<{
    item_id: string;
    status: string;
    last_updated: string;
    source: string;
  }>(`SELECT * FROM inventory WHERE item_id IN (${placeholders})`, itemIds);

  return new Map(
    rows.map((r) => [
      r.item_id,
      {
        itemId: r.item_id,
        status: r.status as ItemStatus,
        lastUpdated: r.last_updated,
        source: r.source as StatusSource,
      },
    ])
  );
}

/**
 * Sets an item's status. `lastUpdated` is stamped here and nowhere else.
 * Writing the same status again is still a real update — the user reaffirming
 * "yes, still full" is meaningful information about freshness of the record.
 */
export function setStatus(
  itemId: string,
  status: ItemStatus,
  source: StatusSource,
  at: Date = new Date()
): void {
  getDb().runSync(
    `INSERT INTO inventory (item_id, status, last_updated, source)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET
       status = excluded.status,
       last_updated = excluded.last_updated,
       source = excluded.source`,
    [itemId, status, at.toISOString(), source]
  );
}

/** Applies many status changes in one transaction (recipe checkout). */
export function setStatusBulk(
  updates: Array<{ itemId: string; status: ItemStatus }>,
  source: StatusSource
): void {
  if (updates.length === 0) return;
  const now = new Date();
  getDb().withTransactionSync(() => {
    for (const u of updates) {
      setStatus(u.itemId, u.status, source, now);
    }
  });
}

export function clearStatus(itemId: string): void {
  getDb().runSync('DELETE FROM inventory WHERE item_id = ?', [itemId]);
}
