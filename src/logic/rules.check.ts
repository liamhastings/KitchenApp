import assert from 'node:assert';

import type { InventoryEntry, ItemStatus, RecipeWithIngredients } from '../data/types';
import {
  buildCheckoutPlan,
  buildIngredientLines,
  computeMatchForItems,
  prefillChoice,
  statusAfterHave,
} from './matching';
import { relativeDate, groupBySection } from './format';

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

console.log('All logic assertions passed.');
