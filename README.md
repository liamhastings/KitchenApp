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

### Putting shopping away

Ticking an item on the grocery list means "it's in my cart" — and it's
reversible. Writing inventory on that tick would mean un-writing it on an
untick, and there is no honest answer to what it should revert to (untracked?
the previous status?). So the list never writes inventory on its own. Instead a
**"Put N in your kitchen"** button appears once something is ticked; it's the
deliberate, one-way step.

Putting away writes `full` — and this is deliberately *not* the
`statusAfterHave` rule. Confirming "have it" on a recipe must not inflate a
`some` into a `full`, because the user is only affirming a belief they already
held. Buying genuinely adds stock, so a purchase lands at `full` regardless of
what was there before. Both rules live in `logic/matching.ts` and the check
suite asserts they stay different.

The rows are then dropped from the list. "Clear N done" is still there as the
escape hatch for ticked items you don't want tracked.

### Inventory starts empty

The Inventory screen lists only items the user has actually given a status.
Untracked items are never shown there, so a fresh install shows "Add your
inventory here" rather than pre-listing every ingredient the seeded recipes
happen to mention. Untracked remains a real, distinct state — it just isn't a
row.

Long-pressing an item's name removes it, matching how the grocery list removes a
row. Removing **untracks** it: the user's statement is deleted, putting the item
back to never-said. That is not the same as setting `none`, and it leaves the
item and every recipe using it untouched.

The screen is called **Your Kitchen** in the UI. `inventory` remains the term in
the schema, types and repos — the tab route is still named `Inventory` and only
its label is user-facing.

### What can I make?

Your Kitchen leads with recipes derived from what's on hand, via `splitCookable`:

- **You can make** — every ingredient is `full` or `some`.
- **Almost there** — within a few of ready, closest first.

An untracked ingredient is never counted as on hand, so the app never promises a
meal it can't back up. But untracked doesn't disqualify a recipe either — it
holds it in "almost there", where the note reads "N still unconfirmed" rather
than implying the user is missing them. Recipes with nothing on hand aren't
"nearly" anything and stay out.

### The food catalog

`data/catalog.ts` is a static list of ~180 common groceries, each with a store
section, a typical unit, and a Canadian price. It drives two things:

- **Autocomplete** on both add fields — grocery and inventory — via the shared
  `ui/components/FoodSuggestions`. Typing "chicken" offers the actual products:
  breast, thighs, drumsticks, wings, ground, broth. Picking one also borrows its
  aisle, so the item groups correctly wherever it ends up. The catalog is a
  convenience, never a restriction: anything not in it is still addable as free
  text, and the suggestion list always carries an `Add "…"` escape hatch.
  Grocery shows the price and unit; inventory doesn't, because what you own
  doesn't have a price.
- **A price estimate** for the grocery list.

**Prices are estimates**, not live data: typical Canadian shelf prices, before
tax, for the stated unit. Two limits are deliberate and are stated in the UI
rather than hidden:

1. It prices **one unit of each item**. Parsing `"2 cups; 1 tbsp"` into a
   multiplier would be the same guess the app already refuses to make when
   accumulating quantities.
2. Items missing from the catalog are **reported, not zeroed** — the bar reads
   "N not priced". An unpriced item silently contributing $0 would understate
   the total, which is worse than admitting the total is partial.

Catalog names are matched with the same `normalizeName` used to de-duplicate
items, so "eggs"/"Eggs"/"egg" all resolve to one entry. That function lives in
`logic/normalize.ts` rather than `itemRepo` so `logic/` stays free of SQLite
imports and can still run under plain Node.

## Project layout

The data model is fully separated from the views so the two halves can be
worked on independently.

```
src/
  data/          # persistence — SQLite only, no React
    types.ts        domain types + labels
    db.ts           connection, schema, migrations
    catalog.ts      ~180 known groceries: section, unit, CAD price
    itemRepo.ts     canonical items
    inventoryRepo.ts
    recipeRepo.ts
    groceryRepo.ts
    seed.ts         8 starter recipes, inserted once
  logic/         # pure functions — no React, no SQLite
    matching.ts     pre-fill rules, checkout plan, match summary
    catalog.ts      autocomplete search + grocery price estimate
    normalize.ts    the one name-matching rule, shared by items and catalog
    format.ts       relative dates, currency, aisle grouping
    rules.check.ts  assertions covering the rules above
  state/
    store.ts        Zustand; SQLite is the source of truth, this is a
                    read-through cache that refreshes after every write
  ui/
    theme.ts        the whole design system: palette, scale, type
    components/
    screens/
```

`logic/` has no framework imports, which is what makes the spec's rules
directly testable in plain Node.

## Design

Scandinavian: warm unbleached paper instead of grey, hairline rules instead of
shadows, muted natural pigments (spruce, clay, ochre) instead of saturated UI
colour, and a lot of air.

Two typefaces, loaded at runtime by `useFonts` in `App.tsx` and gated on before
the first frame renders:

- **Instrument Serif** — screen titles, recipe and item names, tallies. Anything
  that names a thing.
- **Inter** — everything else, at 400/500/600.

Every text style lives in the `type` object in `src/ui/theme.ts`. Use it rather
than setting sizes inline: custom fonts on iOS ignore `fontWeight`, so weight
has to come from the family name, and centralising that is what stops a stray
`fontWeight: '700'` from silently doing nothing.

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
write inventory, and that a years-old status still counts as on hand. It also
covers the catalog: that a bare "chicken" reaches the cut-level products, that
an unknown food yields no suggestion so the caller falls back to free text, that
no two catalog names collapse to the same normalized key, and that the estimate
reports unpriced items instead of counting them as $0.

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

No auth, no accounts, no cloud sync, no backend. No AI/budgeting features, no
store pricing or brand comparison, no barcode scanning or receipt OCR, no
ingredient health scanning. Single local user, single device.
