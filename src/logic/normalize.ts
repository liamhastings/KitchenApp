/**
 * Collapses "  Olive Oil " and "olive oil" to the same key so recipes written
 * at different times still point at one inventory row. Also strips a trailing
 * plural "s" so "eggs"/"egg" match.
 *
 * Lives in `logic` rather than next to the item repo because both the database
 * layer and the pure search code need it, and this half must stay free of any
 * SQLite import.
 */
export function normalizeName(raw: string): string {
  const base = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (base.length > 3 && base.endsWith('s') && !base.endsWith('ss')) {
    return base.slice(0, -1);
  }
  return base;
}
