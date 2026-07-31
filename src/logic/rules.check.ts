import assert from 'node:assert';

import { FOOD_CATALOG } from '../data/foodCatalog';
import type { Item, InventoryEntry, ItemStatus, RecipeWithIngredients } from '../data/types';
import { findExactMatch, searchFoods } from './itemSearch';
import { normalizeName } from './normalize';
import { guessSection } from './sectionGuess';
import {
  buildCheckoutPlan,
  buildIngredientLines,
  computeMatchForItems,
  prefillChoice,
  statusAfterHave,
} from './matching';
import { composeQuantity, relativeDate, groupBySection } from './format';

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

// --- quantity is amount + unit, joined for storage ---------------------------
assert.equal(composeQuantity('2', 'lb'), '2 lb');
assert.equal(composeQuantity(' 3 ', ''), '3', 'no unit means a bare count');
assert.equal(composeQuantity('', 'lb'), '', 'a unit with no amount is dropped');

// --- inventory search --------------------------------------------------------
const known: Item[] = [
  { id: 'sriracha', name: 'Sriracha', normalizedName: 'sriracha', section: 'pantry' },
  // Same food as the catalog's "Eggs", but this spelling/section is the one the
  // rest of the user's data already uses.
  { id: 'eggs', name: 'Egg', normalizedName: 'egg', section: 'other' },
];

const eggResults = searchFoods('egg', known, new Set(['egg']));
assert.equal(eggResults[0].name, 'Egg', 'the exact match sorts first');
assert.equal(eggResults[0].section, 'other', "the user's own item wins over the catalog");
assert.ok(eggResults[0].tracked, 'items already in inventory come back flagged');
assert.equal(
  eggResults.filter((s) => s.key === 'egg').length,
  1,
  'catalog and known items de-duplicate by normalized name'
);

const oilResults = searchFoods('oil', known, new Set());
assert.ok(
  oilResults.some((s) => s.name === 'Olive oil'),
  'catalog foods are searchable without existing in the database'
);
assert.ok(oilResults.every((s) => !s.tracked), 'nothing is tracked in an empty inventory');

assert.equal(
  findExactMatch('sriracha', searchFoods('sriracha', known, new Set()))?.name,
  'Sriracha'
);
assert.equal(
  findExactMatch('kimchi', searchFoods('kimchi', known, new Set())),
  null,
  'an unknown food has no exact match, so the UI can offer to create it'
);

// --- the catalog itself must not collide with itself ------------------------
const seen = new Map<string, string>();
for (const food of FOOD_CATALOG) {
  const key = normalizeName(food.name);
  const clash = seen.get(key);
  assert.ok(
    !clash,
    `catalog entries "${clash}" and "${food.name}" normalize to the same item — one would be dropped`
  );
  seen.set(key, food.name);
}

// --- long-tail foods the catalog now carries --------------------------------
for (const food of ['Sesame seeds', 'Molasses', 'Pumpkin puree', 'Tahini', 'Cornstarch']) {
  assert.ok(
    findExactMatch(food, searchFoods(food, [], new Set())),
    `${food} should be findable without typing it out as a new item`
  );
}

// --- near-misses beat an empty list ------------------------------------------
const nearMiss = searchFoods('pumpkin gnocchi', [], new Set());
assert.ok(
  nearMiss.some((s) => s.name === 'Pumpkin puree'),
  'a partial token match still surfaces something related'
);
const seedResults = searchFoods('sesame seeds', [], new Set());
assert.equal(seedResults[0].name, 'Sesame seeds', 'the exact match still wins outright');
assert.ok(
  !seedResults.some((s) => s.name === 'Sesame oil'),
  'partial hits are dropped when a real match exists'
);

// --- aisle guessing for items nobody has catalogued --------------------------
assert.equal(guessSection('sesame seeds'), 'pantry');
assert.equal(guessSection('pumpkin puree'), 'pantry');
assert.equal(guessSection('smoked gouda'), 'other', 'no keyword means no guess, not a wrong one');
assert.equal(guessSection('duck breast'), 'other');
assert.equal(guessSection('lamb shoulder'), 'meat_seafood');
assert.equal(guessSection('frozen okra'), 'frozen', 'explicitly frozen wins over the food word');
assert.equal(guessSection('baking powder'), 'pantry', 'not every powder is a spice');
assert.equal(guessSection('peanut butter'), 'pantry', 'not every butter is dairy');
assert.equal(guessSection('coconut milk'), 'pantry', 'not every milk is dairy');
assert.equal(guessSection('chicken broth'), 'pantry', 'broth is pantry, not the meat counter');
assert.equal(guessSection('black pepper'), 'spices', 'not every pepper is produce');
assert.equal(guessSection('sourdough loaf'), 'bakery');
assert.equal(guessSection(''), 'other');

console.log('All logic assertions passed.');
