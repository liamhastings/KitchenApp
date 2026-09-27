# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project overview
- **What:** Restock — a single-user, offline kitchen inventory + grocery list app. Inventory is captured as a side effect of browsing recipes: each ingredient is marked "have it" (→ inventory) or "need it" (→ grocery list).
- **Stack:** TypeScript, React Native 0.86 / Expo SDK 57 (new architecture), React Navigation (native stack + bottom tabs), Zustand, `expo-sqlite`, `react-native-webview`. No backend, no auth, no sync.
- **Structure:** `App.tsx` (navigation root), `src/data/` (SQLite), `src/logic/` (pure functions), `src/state/store.ts` (Zustand), `src/ui/` (screens/components), `ios/` (checked-in native project). No `android/` dir yet.

README.md is the spec — read its "data model" section before changing inventory, checkout, or import behavior.

## Commands
- Install: `npm install` (runs `patch-package` via postinstall — see `patches/`)
- Run: `npm start` (Metro); `npm run ios` / `npm run android` for native builds (needs `npx expo prebuild --platform ios` or `pod install` after native deps change)
- Test: `npm run typecheck && npm run check:logic` — there is no Jest/test runner. `check:logic` compiles `src/logic/rules.check.ts` with `tsc` and runs it under plain Node; it is a flat file of `node:assert` calls, so "running a single test" means adding/commenting assertions there. Fixtures for recipe import live in `src/logic/recipeExtract.fixtures.ts`.
- Lint/format: none configured (no ESLint/Prettier); `npm run typecheck` is the only static check.
- Regenerate iOS project after native config changes: `npx expo prebuild --platform ios --clean`
- Optional Claude import fallback: set `EXPO_PUBLIC_ANTHROPIC_API_KEY` at build time (read in `src/config.ts`; inlined into the bundle).

## Architecture
- **Layering is strict.** `src/data/` has no React; `src/logic/` has no React *and* no SQLite/Expo imports. That is what lets `check:logic` run in plain Node — anything imported by `rules.check.ts` must stay free of native/framework imports (e.g. `recipeExtractLlm.ts` takes `fetch` as a parameter for this reason).
- **Data flow:** screens → `useAppStore` mutators → repos (`src/data/*Repo.ts`) → SQLite. SQLite is the source of truth; the store is a read-through cache. Every mutator writes to the repo first, then refreshes the affected slice — no optimistic state.
- **Schema/migrations** live in `src/data/db.ts` `migrate()`: `CREATE TABLE IF NOT EXISTS` plus `addColumnIfMissing` for columns added later (must have a default). There is no migration versioning — add new columns the same way. `seed.ts` inserts starter recipes once (tracked in the `meta` table).
- **`items` is a catalog, not inventory.** Every ingredient any recipe mentions becomes an `items` row; only `inventory` rows are "in the kitchen". No inventory row = *untracked*, which is distinct from status `none`. Names are deduped via `normalized_name` (`logic/normalize.ts`).
- **Core rules** (enforced in `logic/matching.ts`, asserted in `rules.check.ts`): three-state status (`full`/`some`/`none`), no quantities; never decay by time (`last_updated` is display/sort only); never invent a status; "have it" keeps `some` as `some` and only promotes `none`/untracked to `full`; "need it" writes the grocery list, not inventory, unless the explicit toggle is on; grocery quantities concatenate as text, never summed.
- **Recipe import** (`BrowserScreen` → `logic/recipeExtract.ts`): injected JS posts JSON-LD + visible text over the WebView bridge; `parseJsonLdRecipe` first, then `extractRecipeWithClaude` (raw HTTP — the Anthropic SDK doesn't support RN) only if a key is set. Failures fail closed. `toImportDraft` splits lines into name + quantity and saves via the same `recipeRepo.createRecipe` as the manual form. Instructions/steps are extracted but not stored.

## Environment notes
- The `patch-package` patch for `expo-modules-jsi` works around Xcode 26.0.1 (below SDK 57's recommended 26.4+); don't remove it without upgrading Xcode.
- CocoaPods needs `LANG=en_US.UTF-8`.

## Workflow
- For anything beyond a small fix, propose a short plan and wait for my approval before writing code.
- Work in small steps. Run the tests after each meaningful change.
- A task is only done when the tests pass. Show the test output as evidence; don't just say it works.
- If the same approach fails 2–3 times, stop and explain what you've tried instead of guessing.
- Never weaken, skip, or delete a test to make it pass. If a test seems wrong, explain why and ask.
- Ask before adding any new dependency, and say why it's needed.
- Stay in scope. Don't refactor or "improve" unrelated code; mention it as a suggestion instead.

## Git conventions
- Never commit directly to `main`. Work on a branch named `feat/<short-name>`, `fix/<short-name>`, etc.
- Commit after each completed task, not in one big commit at the end.
- Use Conventional Commits: `type(scope): summary` (types: feat, fix, refactor, docs, test, chore).
  - Summary: imperative mood, under 72 characters ("add", not "added").
  - Body: explain *why* the change was made, not what the diff already shows.
  - Footer: `Closes #<issue>` when there is an issue.
- Never force-push, rebase shared branches, or rewrite history.
- When a feature is finished, open a PR with `gh pr create` including: what changed, why, and how it was tested.

## Code style
- Match the patterns already used in this codebase before introducing new ones.
- Prefer small, single-purpose functions and descriptive names over comments.
- Comments explain *why*, not *what*.
- Add docstrings to public functions and modules.

## Documentation
- Update `README.md` whenever setup steps, commands, or user-facing behavior change.
- Keep specs and design notes in `docs/`.

## Safety
- Never read, print, or commit `.env` files, API keys, or credentials.
- Ask before deleting files or running destructive commands.
- Do not change files outside this repository.

## Explaining your work
- I'm using this project to learn as well as to ship. When you finish a task, summarize what you changed and briefly explain any non-obvious decision or technique.