import {
  SECTION_LABELS,
  type QuantityUnit,
  type StoreSection,
  STORE_SECTIONS,
} from '../data/types';

/**
 * Joins an amount and a unit into the free-text quantity the rest of the app
 * stores and displays, e.g. ("2", "lb") -> "2 lb". A unit with no amount is
 * meaningless on a grocery list, so it is dropped.
 */
export function composeQuantity(amount: string, unit: QuantityUnit): string {
  const cleanAmount = amount.trim();
  if (!cleanAmount) return '';
  return unit ? `${cleanAmount} ${unit}` : cleanAmount;
}

/**
 * "Updated today" / "3 days ago" — shown for reference only. Nothing in the app
 * reads elapsed time to change a status.
 */
export function relativeDate(iso: string | null): string {
  if (!iso) return 'Never set';

  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Never set';

  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** Groups any item-bearing row by store section, in aisle order. */
export function groupBySection<T>(
  rows: T[],
  getSection: (row: T) => StoreSection
): Array<{ section: StoreSection; title: string; data: T[] }> {
  const buckets = new Map<StoreSection, T[]>();
  for (const row of rows) {
    const section = getSection(row);
    const bucket = buckets.get(section);
    if (bucket) bucket.push(row);
    else buckets.set(section, [row]);
  }

  return STORE_SECTIONS.filter((s) => buckets.has(s)).map((section) => ({
    section,
    title: SECTION_LABELS[section],
    data: buckets.get(section) as T[],
  }));
}
