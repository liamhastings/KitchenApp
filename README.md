# Restock

Kitchen inventory and grocery list, driven by browsing recipes.

Inventory is never entered by hand as a chore. When you open a recipe you're
already deciding "do I have this?" for each ingredient — the app captures that
decision. Tapping **have it** confirms the item in your kitchen; tapping
**need it** puts it on the grocery list.

## The data model (read this before changing anything)

Inventory is **not** quantity-tracked. Each item has:

| field              | meaning                                                     |
| ------------------ | ----------------------------------------------------------- |
| `status`           | `full` \| `some` \| `none` — nothing else, no counts         |
| `last_updated`     | when the user last set it — **display and sorting only**     |
| `source`           | `recipe_checkout` \| `manual` \| `seed`                      |

Two rules the code deliberately enforces:

1. **No time-based decay.** A status set two years ago is still that status.
   Nothing reads elapsed time to downgrade, expire, or second-guess a value.
   `last_updated` exists so the user can judge staleness themselves.
2. **The app never invents a status.** An item with no inventory row is
   *untracked*, which is different from `none`. `none` is a statement the user
   made; untracked means they never said.
3. **An item is not inventory.** `items` is a catalog — every ingredient any
   recipe mentions lands there. The Inventory screen lists only rows the user
   put there, by adding them or by confirming "have it" at checkout. Untracked
   items surface as *search suggestions*, never as inventory.

### Recipe → inventory pre-fill

When a recipe opens, each ingredient is cross-referenced against inventory:

| current status | pre-filled choice                                  |
| -------------- | -------------------------------------------------- |
| `full`         | have it                                            |
| `some`         | have it (judgment call — one tap to override)      |
| `none`         | need it                                            |
| untracked      | need it (never claim they have something)          |

Every pre-fill is a suggestion, overridable with a single tap.

### What checkout writes

- **have it** → inventory. Confirming does not inflate what the user already
  said: an item marked `some` stays `some` and just gets a fresh timestamp.
  Only `none`/untracked is promoted to `full`, because the tap directly
  contradicts the old value.
- **need it** → grocery list, with the recipe's quantity text.
  It does **not** write inventory by default. "I need to buy this" is not the
  same claim as "I have zero of it". The checkout screen exposes an explicit,
  default-off toggle for users who want it to mean both.

Quantities on the grocery list accumulate as text (`"2 cups; 1 tbsp"`) rather
than being summed — units are free text and adding them would be a guess.
Recipe quantities are *composed* from an amount plus a unit picked from a list,
then stored as that same free text.

### Stocking the inventory directly

The Inventory screen's **Add** sheet searches two pools at once: items already
in the database (recipe ingredients, past additions) and `data/foodCatalog.ts`,
~420 common groceries. Catalog entries are never inserted on launch — a row is
created the moment the user adds one, so nothing appears in the inventory that
the user didn't ask for.

The catalog is deliberately not exhaustive; three things cover the long tail:

- **Token search.** Query words are matched against name words, so a near-miss
  ("pumpkin gnocchi") surfaces something related rather than an empty list.
  Partial hits are dropped whenever a real match exists.
- **Create from the search box.** Anything not in either pool becomes an item by
  name. `logic/sectionGuess.ts` guesses the aisle from keywords so it's one tap;
  the specific rules run first, which is what keeps "baking powder" out of the
  spice rack and "peanut butter" out of the dairy case. It answers `other` when
  nothing matches rather than guessing wrong.
- **Recipes feed the pool.** Any ingredient typed into a recipe is an item, and
  therefore a suggestion from then on.

### Importing a recipe from the web

The Recipes screen opens an in-app browser (`react-native-webview`). On **Import
this recipe**, injected JavaScript posts the page's JSON-LD blocks and visible
text back over the WebView bridge — read from inside the page rather than
re-fetched, so JS-rendered markup and the user's own session are both visible.

Extraction runs in two tiers, both landing on the same `ExtractedRecipe`:

1. `parseJsonLdRecipe` reads schema.org `Recipe` markup (directly, in an array,
   in `@graph`, or under `mainEntity`). Most recipe sites publish it for Google,
   so this is the common path — exact, free, and offline.
2. If there is none and an API key is configured, `extractRecipeWithClaude`
   sends the page's visible text to the Claude API and asks for that same shape
   back as JSON. Network, refusal, and parse failures all surface as "could not
   read this recipe" — a half-parsed import is never saved.

`toImportDraft` then splits each ingredient line into the *item name* and the
*quantity* the rest of the app expects (`"2 cups all-purpose flour, sifted"` ->
`All-purpose flour` + `2 cups`), guesses each aisle with `sectionGuess`, and
hands the result to `recipeRepo.createRecipe` — the same call the Add Recipe
form makes. Imported recipes are `is_user_created = 1` and carry a `source_url`;
nothing downstream of the write can tell them apart from typed ones.

Two consequences worth knowing:

- **Instructions are not stored.** The schema has no steps column and this
  feature did not add one. Steps are extracted (and counted in the import
  confirmation) but only the ingredients are saved; the recipe detail links back
  to the source page for the method.
- **`servings` never scales quantities.** Quantities are free text, so halving
  "2 cups" reliably would need a real unit parser. The yield is stored and shown
  as written.

The Claude fallback is off unless `EXPO_PUBLIC_ANTHROPIC_API_KEY` is set:

```bash
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-... npm start
```

`EXPO_PUBLIC_*` values are inlined into the JS bundle, so that key is readable
by anyone who unpacks the app — fine for a local single-user build, not for a
shipped one. JSON-LD import works with no key at all.

## Project layout

The data model is fully separated from the views so the two halves can be
worked on independently.

```
src/
  data/          # persistence — SQLite only, no React
    types.ts        domain types + labels
    db.ts           connection, schema, migrations
    itemRepo.ts     canonical items
    inventoryRepo.ts
    recipeRepo.ts
    groceryRepo.ts
    seed.ts         8 starter recipes, inserted once
    foodCatalog.ts  common groceries offered as search suggestions
  logic/         # pure functions — no React, no SQLite
    matching.ts     pre-fill rules, checkout plan, match summary
    itemSearch.ts   catalog + known-item search for "add to inventory"
    sectionGuess.ts keyword aisle guess for items the catalog lacks
    normalize.ts    name normalization shared by the repo and search
    format.ts       relative dates, aisle grouping, quantity composition
    recipeExtract.ts        JSON-LD -> recipe, ingredient line -> name+quantity
    recipeExtract.fixtures.ts  sample pages the assertions run against
    recipeExtractLlm.ts     Claude fallback: prompt, reply parser, one request
    browserUrl.ts   address bar input -> URL or search
    rules.check.ts  assertions covering the rules above
  config.ts      # build-time env (the optional Claude API key)
  state/
    store.ts        Zustand; SQLite is the source of truth, this is a
                    read-through cache that refreshes after every write
  ui/
    theme.ts
    components/
    screens/
```

`logic/` has no framework imports, which is what makes the spec's rules
directly testable in plain Node.

## Running it

```bash
npm install
```

```bash
npm start
```

Day-to-day development happens in JS/TS with Metro. Xcode is only for build
config, signing, and TestFlight/App Store submission:

```bash
open ios/Restock.xcworkspace
```

The `ios/` project is checked in. Regenerate it if native config changes:

```bash
npx expo prebuild --platform ios --clean
```

## Checks

```bash
npm run typecheck && npm run check:logic
```

`check:logic` runs `src/logic/rules.check.ts` under plain Node — it asserts the
pre-fill table, that `some` survives confirmation, that need-it doesn't silently
write inventory, that a years-old status still counts as on hand, and that
import reads the fixture pages, splits ingredient lines correctly, and fails
closed on every bad model reply.

The webview is a native module: after `npm install`, an iOS build needs
`npx expo prebuild --platform ios` (or `pod install`) before `npm run ios`.

## Known environment issues on this machine

- **Xcode 26.0.1** (Swift 6.2) is below Expo SDK 57's recommended **Xcode
  26.4+** (Swift 6.3). A `patch-package` workaround in `patches/` fixes
  `expo-modules-jsi` compile errors on this toolchain; upgrading Xcode removes
  the need for it.
- **`LANG` is unset**, which makes CocoaPods crash with
  `Unicode Normalization not appropriate for ASCII-8BIT`. Add
  `export LANG=en_US.UTF-8` to your shell profile, or prefix:
  `LANG=en_US.UTF-8 pod install`
- **Node is 20.11.0**; Expo SDK 57 wants `>=20.19.4`. It bundles fine but the
  version warning will keep appearing.

## Out of scope for this MVP

No auth, no accounts, no cloud sync, no backend. No budgeting features, no
store pricing or brand comparison, no barcode scanning or receipt OCR, no
ingredient health scanning. Single local user, single device.

Recipe import calls the Claude API directly from the device when a key is
configured, and only for pages without recipe markup. That is the one network
call in the app: there is still no backend, no account, and nothing synced.
