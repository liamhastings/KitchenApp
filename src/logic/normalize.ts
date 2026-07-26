/**
 * Collapses "  Olive Oil " and "olive oil" to the same key so recipes written
 * at different times still point at one inventory row. Also strips a trailing
 * plural "s" so "eggs"/"egg" match.
 *
 * Lives in `logic/` rather than `itemRepo` because the food catalog has to
 * match names using exactly this rule, and `logic/` must stay free of SQLite
 * imports so it can run under plain Node in `check:logic`.
 */
export function normalizeName(raw: string): string {
  const base = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (base.length > 3 && base.endsWith('s') && !base.endsWith('ss')) {
    return base.slice(0, -1);
  }
  return base;
}
