# Progress

## 2026-09-27 — round long decimals in imported quantities

**Did:** Added `roundLongDecimals` in `src/logic/recipeExtract.ts`, applied to the
amount in `splitIngredientText`. Any number with 4+ decimal places (float noise
from JSON-LD, e.g. `1.3333333333333333`) is rounded to one decimal (`1.3`);
short exact decimals like `0.125` are left alone, and a tiny amount never rounds
to `0`. Added four assertions to `src/logic/rules.check.ts` (1 1/3, 2/3, a
range, and an untouched `0.125`).

**Blocker:** This session could not run `npm run typecheck && npm run check:logic`
because every shell command needed interactive approval. The new cases were
traced by hand against the `AMOUNT` regex but have **not** been executed.

**Next:** Run `npm run typecheck && npm run check:logic`. If it passes, commit
and the task is done. If not, fix whatever it reports.
