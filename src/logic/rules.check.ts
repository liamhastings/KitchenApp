import assert from 'node:assert';

import { CATALOG } from '../data/catalog';
import type { InventoryEntry, ItemStatus, RecipeWithIngredients } from '../data/types';
import { estimateGroceryTotal, findCatalogFood, searchCatalog } from './catalog';
import {
  buildCheckoutPlan,
  buildIngredientLines,
  buildPutAwayPlan,
  computeMatchForItems,
  prefillChoice,
  splitCookable,
  statusAfterHave,
} from './matching';
import { relativeDate, groupBySection } from './format';
import { normalizeName } from './normalize';

function entry(itemId: string, status: ItemStatus, lastUpdated: string): InventoryEntry {
  return { itemId, status, lastUpdated, source: 'manual' };
}

// --- prefill rules from the spec -------------------------------------------
assert.equal(prefillChoice('full'), 'have', 'full should prefill have');
assert.equal(prefillChoice('none'), 'need', 'none should prefill need');
assert.equal(prefillChoice('some'), 'have', 'some should prefill have');
assert.equal(prefillChoice(null), 'need', 'untracked should prefill need');

// --- confirming "have it" must not inflate a `some` -------------------------
assert.equal(statusAfterHave('some'), 'some', 'some stays some when confirmed');
assert.equal(statusAfterHave('full'), 'full');
assert.equal(statusAfterHave('none'), 'full', 'none is promoted when contradicted');
assert.equal(statusAfterHave(null), 'full', 'untracked becomes full');

// --- building lines from a recipe ------------------------------------------
const recipe: RecipeWithIngredients = {
  id: 'r1',
  title: 'Test Recipe',
  description: '',
  servings: '2',
  isUserCreated: false,
  createdAt: new Date().toISOString(),
  ingredients: [
    { id: 'i1', recipeId: 'r1', itemId: 'eggs', quantity: '3', sortOrder: 0, item: { id: 'eggs', name: 'Eggs', normalizedName: 'egg', section: 'dairy' } },
    { id: 'i2', recipeId: 'r1', itemId: 'rice', quantity: '1 cup', sortOrder: 1, item: { id: 'rice', name: 'Rice', normalizedName: 'rice', section: 'pantry' } },
    { id: 'i3', recipeId: 'r1', itemId: 'peas', quantity: '1 cup', sortOrder: 2, item: { id: 'peas', name: 'Peas', normalizedName: 'pea', section: 'frozen' } },
    { id: 'i4', recipeId: 'r1', itemId: 'soy', quantity: '2 tbsp', sortOrder: 3, item: { id: 'soy', name: 'Soy sauce', normalizedName: 'soy sauce', section: 'pantry' } },
  ],
};

const statusMap = new Map<string, InventoryEntry>([
  ['eggs', entry('eggs', 'full', '2026-07-20T10:00:00.000Z')],
  ['rice', entry('rice', 'some', '2026-07-18T10:00:00.000Z')],
  ['peas', entry('peas', 'none', '2026-07-10T10:00:00.000Z')],
  // 'soy' deliberately untracked
]);

const lines = buildIngredientLines(recipe, statusMap);
assert.deepEqual(
  lines.map((l) => l.choice),
  ['have', 'have', 'need', 'need'],
  'prefill across full/some/none/untracked'
);
assert.ok(lines.every((l) => l.isPrefilled), 'all lines start as suggestions');

// --- checkout plan, default (need does NOT write inventory) -----------------
const plan = buildCheckoutPlan(lines);
assert.deepEqual(
  plan.inventoryUpdates,
  [
    { itemId: 'eggs', status: 'full' },
    { itemId: 'rice', status: 'some' },
  ],
  'only have-it items write inventory, and some stays some'
);
assert.deepEqual(
  plan.groceryAdditions,
  [
    { itemId: 'peas', quantity: '1 cup' },
    { itemId: 'soy', quantity: '2 tbsp' },
  ],
  'need-it items carry their recipe quantity to the list'
);

// --- checkout plan with the explicit opt-in --------------------------------
const optIn = buildCheckoutPlan(lines, { markNeedAsNone: true });
assert.deepEqual(
  optIn.inventoryUpdates.filter((u) => u.status === 'none').map((u) => u.itemId),
  ['peas', 'soy'],
  'opt-in marks need-it items none'
);

// --- user override survives ------------------------------------------------
const overridden = lines.map((l) =>
  l.itemId === 'peas' ? { ...l, choice: 'have' as const, isPrefilled: false } : l
);
const overriddenPlan = buildCheckoutPlan(overridden);
assert.ok(
  overriddenPlan.inventoryUpdates.some((u) => u.itemId === 'peas' && u.status === 'full'),
  'overriding none -> have promotes to full'
);
assert.ok(
  !overriddenPlan.groceryAdditions.some((g) => g.itemId === 'peas'),
  'overridden item leaves the grocery list'
);

// --- recipe match summary ---------------------------------------------------
const match = computeMatchForItems(['eggs', 'rice', 'peas', 'soy'], statusMap);
assert.deepEqual(match, { total: 4, onHand: 2, missing: 1, unknown: 1 });

// --- no time-based decay ----------------------------------------------------
const ancient = new Map<string, InventoryEntry>([
  ['eggs', entry('eggs', 'full', '2019-01-01T00:00:00.000Z')],
]);
assert.equal(
  prefillChoice(ancient.get('eggs')!.status),
  'have',
  'a years-old full status is still full — no decay'
);
assert.equal(
  computeMatchForItems(['eggs'], ancient).onHand,
  1,
  'stale entries still count as on hand'
);

// --- date formatting is display-only ---------------------------------------
assert.equal(relativeDate(null), 'Never set');
assert.equal(relativeDate(new Date().toISOString()), 'Today');
const yesterday = new Date(Date.now() - 86_400_000).toISOString();
assert.equal(relativeDate(yesterday), 'Yesterday');

// --- aisle grouping ordering ------------------------------------------------
const grouped = groupBySection(
  [
    { section: 'pantry' as const, name: 'Rice' },
    { section: 'produce' as const, name: 'Basil' },
    { section: 'pantry' as const, name: 'Oats' },
  ],
  (r) => r.section
);
assert.deepEqual(
  grouped.map((g) => g.section),
  ['produce', 'pantry'],
  'sections come back in aisle order, not insertion order'
);
assert.equal(grouped[1].data.length, 2, 'pantry bucket keeps both items');

// --- "what can I make" never claims more than the user has stated -----------
const cookMap = new Map<string, InventoryEntry>([
  ['a', entry('a', 'full', '2026-07-20T10:00:00.000Z')],
  ['b', entry('b', 'some', '2026-07-20T10:00:00.000Z')],
  ['c', entry('c', 'none', '2026-07-20T10:00:00.000Z')],
]);
const cook = splitCookable(
  [
    { recipe: 'all-on-hand', itemIds: ['a', 'b'] },
    { recipe: 'one-missing', itemIds: ['a', 'b', 'c'] },
    { recipe: 'one-untracked', itemIds: ['a', 'b', 'untracked'] },
    { recipe: 'nothing-known', itemIds: ['x', 'y', 'z'] },
    { recipe: 'empty', itemIds: [] },
  ],
  cookMap
);
assert.deepEqual(
  cook.ready.map((r) => r.recipe),
  ['all-on-hand'],
  'only a recipe whose every ingredient is full or some is ready'
);
assert.ok(
  cook.nearly.some((r) => r.recipe === 'one-untracked'),
  'an untracked ingredient holds a recipe back rather than dropping it'
);
assert.ok(
  !cook.ready.some((r) => r.recipe === 'one-untracked'),
  'untracked is never counted as on hand — the app does not promise what it cannot back up'
);
assert.ok(
  !cook.nearly.some((r) => r.recipe === 'nothing-known'),
  'a recipe with nothing on hand is not "nearly" anything'
);
assert.ok(
  !cook.ready.concat(cook.nearly).some((r) => r.recipe === 'empty'),
  'an ingredient-less recipe is never claimed as cookable'
);
assert.deepEqual(
  splitCookable([], new Map()),
  { ready: [], nearly: [] },
  'an empty kitchen suggests nothing'
);
assert.equal(
  splitCookable(
    [{ recipe: 'far-off', itemIds: ['a', 'p', 'q', 'r', 's'] }],
    cookMap
  ).nearly.length,
  0,
  'recipes past the gap cap stay out of the shortlist'
);

// --- putting shopping away is NOT the same rule as confirming "have it" -----
// The plan needs no current status at all: buying lands at `full` whatever was
// there before, which is exactly what makes it a different rule from
// `statusAfterHave` below.
const putAway = buildPutAwayPlan([
  { itemId: 'oil' },
  { itemId: 'rice' },
  { itemId: 'salt' },
  { itemId: 'eggs' },
]);
assert.deepEqual(
  putAway,
  [
    { itemId: 'oil', status: 'full' },
    { itemId: 'rice', status: 'full' },
    { itemId: 'salt', status: 'full' },
    { itemId: 'eggs', status: 'full' },
  ],
  'buying always lands at full — a purchase adds stock'
);
assert.equal(
  statusAfterHave('some'),
  'some',
  'confirming still must not inflate a some — the two rules stay different'
);
assert.deepEqual(buildPutAwayPlan([]), [], 'nothing checked writes nothing');

// --- catalog search ---------------------------------------------------------
const chicken = searchCatalog('chicken', 10);
assert.ok(chicken.length >= 4, 'a broad food term offers several products');
assert.ok(
  chicken.every((f) => f.name.toLowerCase().includes('chicken')),
  'every suggestion actually matches the query'
);
assert.ok(
  chicken.some((f) => f.name === 'Chicken breast') &&
    chicken.some((f) => f.name === 'Chicken thighs') &&
    chicken.some((f) => f.name === 'Chicken drumsticks'),
  'the cut-level products are reachable from the bare word'
);
assert.equal(searchCatalog('').length, 0, 'an empty query suggests nothing');
assert.equal(
  searchCatalog('zzznotafood').length,
  0,
  'an unknown food yields no suggestion — the caller falls back to free text'
);
assert.equal(searchCatalog('chicken', 2).length, 2, 'the limit is respected');

// Names are matched with the same normalization used to de-duplicate items, so
// plural/case differences resolve to one catalog entry.
assert.equal(findCatalogFood('eggs')?.name, 'Eggs');
assert.equal(findCatalogFood('  EGGS ')?.name, 'Eggs', 'lookup ignores case and padding');
assert.equal(findCatalogFood('unicorn steak'), null, 'unknown foods are simply absent');

const normalizedCatalogNames = new Set(CATALOG.map((f) => normalizeName(f.name)));
assert.equal(
  normalizedCatalogNames.size,
  CATALOG.length,
  'no two catalog foods collapse to the same normalized name'
);
assert.ok(
  CATALOG.every((f) => f.price > 0 && f.unit.length > 0),
  'every catalog food carries a positive price and a stated unit'
);

// --- grocery estimate is honest about what it cannot price ------------------
const estimate = estimateGroceryTotal([
  { name: 'Eggs' },
  { name: 'Chicken breast' },
  { name: 'Something homemade' },
]);
assert.equal(estimate.pricedCount, 2);
assert.equal(estimate.unpricedCount, 1, 'unpriced items are reported, not silently zeroed');
assert.equal(
  estimate.total,
  Math.round((4.49 + 7.99) * 100) / 100,
  'the total is the sum of only the items it could actually price'
);
assert.deepEqual(
  estimateGroceryTotal([]),
  { total: 0, pricedCount: 0, unpricedCount: 0 },
  'an empty list estimates to zero rather than throwing'
);
// Quantity text is deliberately not parsed into a multiplier — "2 dozen eggs"
// still prices as one unit, the same reason quantities are never summed.
assert.equal(
  estimateGroceryTotal([{ name: 'Eggs' }]).total,
  4.49,
  'one unit per line, regardless of the free-text quantity beside it'
);

console.log('All logic assertions passed.');
