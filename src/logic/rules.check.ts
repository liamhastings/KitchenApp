import assert from 'node:assert';

import { FOOD_CATALOG } from '../data/foodCatalog';
import { hostOf, toBrowserUrl } from './browserUrl';
import type { Item, InventoryEntry, ItemStatus, RecipeWithIngredients } from '../data/types';
import { findExactMatch, searchFoods } from './itemSearch';
import { normalizeName } from './normalize';
import { parseJsonLdRecipe, splitIngredientText, toImportDraft } from './recipeExtract';
import {
  BROKEN_THEN_VALID,
  CLEAN_JSON_LD,
  GRAPH_JSON_LD,
  NO_RECIPE,
} from './recipeExtract.fixtures';
import {
  buildExtractionPrompt,
  extractRecipeWithClaude,
  parseLlmRecipeJson,
} from './recipeExtractLlm';
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
  sourceUrl: '',
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

// --- recipe import: JSON-LD extraction --------------------------------------
const chili = parseJsonLdRecipe(CLEAN_JSON_LD, 'https://example.com/chili');
assert.ok(chili, 'a plain schema.org Recipe is found');
assert.equal(chili!.title, 'Weeknight Chili & Cornbread', 'entities are decoded');
assert.equal(chili!.servings, '6 servings');
assert.equal(chili!.sourceUrl, 'https://example.com/chili', 'the page URL rides along');
assert.equal(chili!.ingredients.length, 6, 'every ingredient line survives');
assert.equal(chili!.ingredients[0].text, '1 lb ground beef', 'lines are kept verbatim');
assert.deepEqual(chili!.steps, ['Brown the beef.', 'Add everything else and simmer.']);

const soup = parseJsonLdRecipe(GRAPH_JSON_LD, 'https://example.com/soup');
assert.ok(soup, 'a Recipe nested in @graph is found past the other nodes');
assert.equal(soup!.title, 'Lemon Orzo Soup');
assert.equal(soup!.servings, '4', 'an array yield takes the first value');
assert.deepEqual(
  soup!.steps,
  ['Bring the broth to a boil.', 'Add orzo and cook 8 minutes.'],
  'HowToSection nesting is flattened'
);

assert.equal(parseJsonLdRecipe(NO_RECIPE, 'https://example.com/pans'), null, 'no Recipe -> null');
assert.equal(parseJsonLdRecipe('<html><body>hi</body></html>'), null, 'no JSON-LD at all -> null');
assert.equal(
  parseJsonLdRecipe('<script type="application/ld+json">{"@type":"Recipe","name":"X"}</script>'),
  null,
  'a Recipe with no ingredients is not worth saving'
);
assert.equal(
  parseJsonLdRecipe(BROKEN_THEN_VALID)?.title,
  'Toast',
  'one unparseable block does not hide a valid one'
);

// --- recipe import: ingredient line -> item name + quantity -----------------
assert.deepEqual(splitIngredientText('2 cups all-purpose flour, sifted'), {
  name: 'All-purpose flour',
  quantity: '2 cups',
});
assert.deepEqual(splitIngredientText('1 lb ground beef'), {
  name: 'Ground beef',
  quantity: '1 lb',
});
assert.deepEqual(splitIngredientText('½ teaspoon cumin'), {
  name: 'Cumin',
  quantity: '1/2 teaspoon',
});
assert.deepEqual(splitIngredientText('1½ cups milk'), {
  name: 'Milk',
  quantity: '1 1/2 cups',
});
assert.deepEqual(splitIngredientText('2 (14-ounce) cans diced tomatoes'), {
  name: 'Diced tomatoes',
  quantity: '2 cans',
});
assert.deepEqual(
  splitIngredientText('1 large yellow onion, finely chopped'),
  { name: 'Yellow onion', quantity: '1' },
  'size words are dropped so the catalog does not fork into large/small onions'
);
assert.deepEqual(splitIngredientText('Salt and pepper to taste'), {
  name: 'Salt and pepper',
  quantity: '',
});
assert.deepEqual(
  splitIngredientText('Pinch of saffron'),
  { name: 'Saffron', quantity: 'Pinch' },
  'a bare unit still reads as a quantity when the line says "of"'
);
assert.deepEqual(
  splitIngredientText('Cornstarch'),
  { name: 'Cornstarch', quantity: '' },
  'an unquantified line is all name, like a typed ingredient with no amount'
);

// --- recipe import: the draft matches what recipeRepo already accepts -------
const draft = toImportDraft(chili!);
assert.equal(draft.isUserCreated, true, 'imports are the user’s recipes, like typed ones');
assert.equal(draft.title, 'Weeknight Chili & Cornbread');
assert.equal(draft.servings, '6 servings');
assert.deepEqual(
  draft.ingredients.map((i) => [i.name, i.quantity, i.section]),
  [
    ['Ground beef', '1 lb', 'meat_seafood'],
    ['Canned tomatoes', '2 cups', 'pantry'],
    ['Yellow onion', '1', 'produce'],
    ['Garlic', '2 cloves', 'produce'],
    ['Cumin', '1/2 teaspoon', 'spices'],
    ['Salt and pepper', '', 'spices'],
  ],
  'imported lines land as name/quantity/section, aisle-guessed like typed items'
);
assert.ok(
  draft.ingredients.every((i) => typeof i.name === 'string' && typeof i.quantity === 'string'),
  'the draft is structurally a NewRecipeInput — no new write path needed'
);

// --- browser address bar: URL or search? ------------------------------------
assert.equal(toBrowserUrl('https://example.com/x'), 'https://example.com/x');
assert.equal(toBrowserUrl('seriouseats.com/chili'), 'https://seriouseats.com/chili');
assert.equal(
  toBrowserUrl('chicken pot pie'),
  'https://duckduckgo.com/?q=chicken%20pot%20pie',
  'a phrase is a search, not a hostname'
);
assert.equal(toBrowserUrl('  '), '', 'empty input navigates nowhere');
assert.equal(hostOf('https://www.seriouseats.com/chili'), 'seriouseats.com', 'www is dropped');
assert.equal(hostOf('not a url'), '');

// --- recipe import: the model fallback's pure halves ------------------------
const llmPrompt = buildExtractionPrompt('Grandma soup\n2 carrots', 'https://example.com/soup');
assert.ok(llmPrompt.includes('https://example.com/soup'), 'the prompt carries the page URL');
assert.ok(llmPrompt.includes('2 carrots'), 'the prompt carries the page text');

const fenced = parseLlmRecipeJson(
  '```json\n{"title":"Toast","ingredients":[{"text":"2 slices bread"}],"steps":["Toast it."]}\n```',
  'https://example.com/toast'
);
assert.equal(fenced?.title, 'Toast', 'a fenced reply is still read');
assert.equal(fenced?.ingredients[0].text, '2 slices bread');
assert.equal(fenced?.sourceUrl, 'https://example.com/toast');

assert.equal(
  parseLlmRecipeJson('Sure! {"title":"Tea","ingredients":["1 bag tea"]}', 'u')?.ingredients[0].text,
  '1 bag tea',
  'plain-string ingredients and surrounding prose are both tolerated'
);
assert.equal(parseLlmRecipeJson('{"title": ""}', 'u'), null, 'the not-a-recipe reply fails closed');
assert.equal(parseLlmRecipeJson('no json here', 'u'), null, 'garbage fails closed');
assert.equal(
  parseLlmRecipeJson('{"title":"X","ingredients":[]}', 'u'),
  null,
  'a titled recipe with no ingredients is still not importable'
);

/** Stands in for fetch so the request path runs without a network. */
function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as unknown as Response) as unknown as typeof fetch;
}

async function checkLlmFallback(): Promise<void> {
  const good = await extractRecipeWithClaude('page text', 'https://example.com/x', {
    apiKey: 'test-key',
    fetchImpl: fakeFetch(200, {
      stop_reason: 'end_turn',
      content: [
        { type: 'text', text: '{"title":"Dal","ingredients":["1 cup red lentils"],"steps":[]}' },
      ],
    }),
  });
  assert.ok(good.ok && good.recipe.title === 'Dal', 'a good reply becomes a recipe');

  const noKey = await extractRecipeWithClaude('t', 'u', { apiKey: '' });
  assert.deepEqual(noKey, { ok: false, reason: 'no_api_key' }, 'no key is a reason, not a crash');

  const http500 = await extractRecipeWithClaude('t', 'u', {
    apiKey: 'k',
    fetchImpl: fakeFetch(500, {}),
  });
  assert.deepEqual(http500, { ok: false, reason: 'request_failed' });

  const refused = await extractRecipeWithClaude('t', 'u', {
    apiKey: 'k',
    fetchImpl: fakeFetch(200, { stop_reason: 'refusal', content: [] }),
  });
  assert.deepEqual(refused, { ok: false, reason: 'refused' }, 'a refusal never reaches content');

  const junk = await extractRecipeWithClaude('t', 'u', {
    apiKey: 'k',
    fetchImpl: fakeFetch(200, { stop_reason: 'end_turn', content: [{ type: 'text', text: 'hi!' }] }),
  });
  assert.deepEqual(junk, { ok: false, reason: 'unreadable' }, 'a non-JSON reply is never saved');

  const threw = await extractRecipeWithClaude('t', 'u', {
    apiKey: 'k',
    fetchImpl: (() => {
      throw new Error('offline');
    }) as unknown as typeof fetch,
  });
  assert.deepEqual(threw, { ok: false, reason: 'request_failed' }, 'a thrown fetch is handled');
}

checkLlmFallback().then(
  () => console.log('All logic assertions passed.'),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
