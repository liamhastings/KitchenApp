import type { StoreSection } from '../data/types';
import { guessSection } from './sectionGuess';

/**
 * Pulls a recipe out of a web page. Pure — string in, plain object out, no
 * React, no SQLite, no network — so it is checkable in plain Node like the
 * rest of logic/.
 *
 * The output is deliberately *not* a database shape. `toImportDraft` converts
 * it into the same `{ name, quantity, section }` ingredient lines that typed
 * and seeded recipes use, so imported recipes go through `recipeRepo`'s single
 * write path and the matching/checkout rules never learn they came from a URL.
 */

export interface ExtractedIngredient {
  /** The ingredient exactly as the page wrote it, e.g. "2 cups flour". */
  text: string;
}

export interface ExtractedRecipe {
  title: string;
  ingredients: ExtractedIngredient[];
  steps: string[];
  servings?: string;
  /** The page's own summary, when it publishes one. */
  description?: string;
  sourceUrl: string;
}

// --- HTML text handling -----------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  deg: '°',
  frac12: '1/2',
  frac13: '1/3',
  frac14: '1/4',
  frac23: '2/3',
  frac34: '3/4',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value =
        code[1] === 'x' || code[1] === 'X'
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Drops tags but keeps block boundaries as newlines, so lists survive. */
export function stripTags(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|ol|ul|h[1-6]|tr|section)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');
}

/** Tag-free, entity-free, single-spaced. */
export function cleanText(input: string): string {
  return decodeEntities(stripTags(input)).replace(/\s+/g, ' ').trim();
}

// --- JSON-LD ----------------------------------------------------------------

const LD_SCRIPT =
  /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

type LdNode = Record<string, unknown>;

/** Schema.org lets a Recipe hide in an array, a @graph, or a mainEntity. */
function collectNodes(value: unknown, out: LdNode[], depth = 0): void {
  if (depth > 6 || value === null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    for (const entry of value) collectNodes(entry, out, depth + 1);
    return;
  }

  const node = value as LdNode;
  out.push(node);
  collectNodes(node['@graph'], out, depth + 1);
  collectNodes(node.mainEntity, out, depth + 1);
  collectNodes(node.itemListElement, out, depth + 1);
}

function isRecipeNode(node: LdNode): boolean {
  const type = node['@type'] ?? node.type;
  const types = Array.isArray(type) ? type : [type];
  return types.some(
    (t) => typeof t === 'string' && t.toLowerCase().replace(/^.*\//, '') === 'recipe'
  );
}

/** schema.org values arrive as strings, numbers, {@value}, or arrays of those. */
function readString(value: unknown): string {
  if (typeof value === 'string') return cleanText(value);
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = readString(entry);
      if (found) return found;
    }
    return '';
  }
  if (value && typeof value === 'object') {
    const node = value as LdNode;
    return readString(node['@value'] ?? node.name ?? node.text);
  }
  return '';
}

function readIngredients(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [value];
  const lines: string[] = [];

  for (const entry of raw) {
    const text = readString(entry);
    if (!text) continue;
    // A few sites put the whole list in one newline-separated string.
    for (const line of text.split(/\n+/)) {
      const clean = line.trim();
      if (clean) lines.push(clean);
    }
  }
  return lines;
}

/** Handles plain strings, HowToStep objects, and HowToSection nesting. */
function readInstructions(value: unknown, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) return [];

  if (typeof value === 'string') {
    return decodeEntities(stripTags(value))
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => readInstructions(entry, depth + 1));
  }

  if (typeof value === 'object') {
    const node = value as LdNode;
    if (node.itemListElement) return readInstructions(node.itemListElement, depth + 1);
    const text = readString(node.text ?? node.name);
    return text ? [text] : [];
  }

  return [];
}

/**
 * Finds a schema.org Recipe in the page's JSON-LD. Returns null when the page
 * has none, or has one too broken to be worth saving — a recipe with no title
 * or no ingredients is not a recipe.
 */
export function parseJsonLdRecipe(html: string, sourceUrl = ''): ExtractedRecipe | null {
  const nodes: LdNode[] = [];

  for (const match of html.matchAll(LD_SCRIPT)) {
    const body = match[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
    if (!body) continue;

    try {
      collectNodes(JSON.parse(body), nodes);
    } catch {
      // One malformed block must not hide a good one further down the page.
    }
  }

  const recipe = nodes.find(isRecipeNode);
  if (!recipe) return null;

  const title = readString(recipe.name ?? recipe.headline);
  const ingredients = readIngredients(recipe.recipeIngredient ?? recipe.ingredients);
  if (!title || ingredients.length === 0) return null;

  const servings = readString(recipe.recipeYield ?? recipe.yield);
  const description = readString(recipe.description);

  return {
    title,
    ingredients: ingredients.map((text) => ({ text })),
    steps: readInstructions(recipe.recipeInstructions),
    ...(servings ? { servings } : {}),
    ...(description ? { description } : {}),
    sourceUrl,
  };
}

// --- ingredient line -> item name + quantity --------------------------------

const UNIT_WORDS = new Set([
  'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'tbsps', 'tbs',
  'teaspoon', 'teaspoons', 'tsp', 'tsps',
  'gram', 'grams', 'g', 'gr', 'kilogram', 'kilograms', 'kg',
  'ounce', 'ounces', 'oz', 'pound', 'pounds', 'lb', 'lbs',
  'milliliter', 'milliliters', 'ml', 'liter', 'liters', 'litre', 'litres', 'l',
  'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons',
  'can', 'cans', 'package', 'packages', 'pkg', 'packet', 'packets',
  'jar', 'jars', 'box', 'boxes', 'bag', 'bags', 'bottle', 'bottles',
  'container', 'containers', 'stick', 'sticks', 'slice', 'slices',
  'clove', 'cloves', 'head', 'heads', 'stalk', 'stalks', 'sprig', 'sprigs',
  'bunch', 'bunches', 'piece', 'pieces', 'handful', 'handfuls',
  'pinch', 'pinches', 'dash', 'dashes', 'drop', 'drops', 'scoop', 'scoops',
  'fillet', 'fillets', 'strip', 'strips',
]);

const VULGAR_FRACTIONS: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

/** Size and freshness words that would otherwise fork the item catalog. */
const LEADING_NOISE =
  /^(?:extra[- ]large|large|medium|small|jumbo|ripe|fresh|freshly|finely|thinly|coarsely|roughly|about|approximately)\s+/i;

/** Trailing clauses that describe the cook's job, not the ingredient. */
const TRAILING_NOISE =
  /\s*\b(?:to taste|for serving|for garnish|for topping|as needed|if needed|optional|divided|plus more.*|or more.*|at room temperature)\b\s*$/i;

const AMOUNT =
  /^(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?(?:\s*(?:-|–|—|to)\s*\d+(?:[.,]\d+)?)?)/;

function expandFractions(text: string): string {
  let out = '';
  for (const char of text) {
    const fraction = VULGAR_FRACTIONS[char];
    // "1½" is one and a half, so the fraction needs a space in front of it.
    if (fraction) out += (/\d$/.test(out) ? ' ' : '') + fraction;
    else out += char;
  }
  return out;
}

function tidyName(text: string): string {
  let name = text.split(',')[0];

  let previous = '';
  while (previous !== name) {
    previous = name;
    name = name.replace(TRAILING_NOISE, '').replace(LEADING_NOISE, '');
  }

  name = name.replace(/^[\s\-–:;.]+|[\s\-–:;.]+$/g, '').trim();
  if (!name) return '';
  return name[0].toUpperCase() + name.slice(1);
}

/**
 * Splits "2 cups all-purpose flour, sifted" into a quantity ("2 cups") and an
 * item name ("All-purpose flour") — the same split the Add Recipe form asks the
 * user to make by hand. Without it every imported line would create its own
 * junk item and nothing would ever match inventory.
 *
 * When there is no recognizable amount the whole line becomes the name and the
 * quantity is empty, exactly like an unquantified typed ingredient.
 */
export function splitIngredientText(raw: string): { name: string; quantity: string } {
  const text = expandFractions(cleanText(raw))
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return { name: '', quantity: '' };

  const amountMatch = text.match(AMOUNT);
  const amount = amountMatch ? amountMatch[0] : '';
  let rest = text.slice(amount.length).trim();

  let unit = '';
  const unitMatch = rest.match(/^([a-z]+)\.?(?=\s|$)/i);
  if (unitMatch && UNIT_WORDS.has(unitMatch[1].toLowerCase())) {
    const followedByOf = /^of\s+/i.test(rest.slice(unitMatch[0].length).trim());
    // A bare unit with no amount only counts when it reads as one: "pinch of
    // salt" is a quantity, but "Cups" on its own is an ingredient name.
    if (amount || followedByOf) {
      unit = unitMatch[0];
      rest = rest.slice(unit.length).trim();
    }
  }

  rest = rest.replace(/^of\s+/i, '');

  const name = tidyName(rest);
  const quantity = [amount, unit].filter(Boolean).join(' ').trim();

  if (!name) return { name: tidyName(text) || text, quantity: '' };
  return { name, quantity };
}

// --- extraction -> the shape recipeRepo already writes ----------------------

/**
 * Structurally identical to `recipeRepo`'s `NewRecipeInput`, plus the source
 * URL. Declared here rather than imported so logic/ keeps its no-SQLite rule.
 */
export interface ImportedRecipeDraft {
  title: string;
  description: string;
  servings: string;
  isUserCreated: boolean;
  sourceUrl: string;
  ingredients: Array<{ name: string; quantity: string; section: StoreSection }>;
}

/**
 * Turns an extraction into the exact input the existing recipe write path
 * takes. Sections are guessed the same way a hand-created item's is, so an
 * imported ingredient lands in the catalog indistinguishable from a typed one.
 */
export function toImportDraft(recipe: ExtractedRecipe): ImportedRecipeDraft {
  const ingredients = recipe.ingredients
    .map((ing) => splitIngredientText(ing.text))
    .filter((ing) => ing.name.length > 0)
    .map((ing) => ({ ...ing, section: guessSection(ing.name) }));

  return {
    title: recipe.title,
    description: recipe.description ?? '',
    servings: recipe.servings ?? '',
    isUserCreated: true,
    sourceUrl: recipe.sourceUrl,
    ingredients,
  };
}
