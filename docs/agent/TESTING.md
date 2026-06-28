# Testing policy

> **Active (2026-06-27):** Build phase — **fast gates by default**, manual QA for visuals, **rule/layout contract tests suspended** until explicitly requested.

## Why

Grid routing rule tests rebuild full diagrams (sometimes 20+ feasibility iterations per CSV). SPI-scale fixtures can take **20+ minutes each**. Running them on every session blocked feature work while MVP pieces are still landing.

**Nothing is deleted.** Slow tests live in [`vitest.slowTests.ts`](../../vitest.slowTests.ts) and run only via `test:rules` / `test:hardening`.

## Gates

| Gate | Command | When | Target time |
|------|---------|------|-------------|
| **Dev default** | `npm run smoke` | Every session / CI | Few minutes |
| Fast tests only | `npm run test:fast` | While iterating | Few minutes |
| Manual adjust | `npm run test:engine` | Touching drag/handles | < 1 min |
| **Rules / layout** | `npm run test:rules` | **Only when user asks** | Tens of minutes |
| Full suite | `npm run test:full` | Pre-release hardening | Hours possible |
| Legacy aliases | `test:layout`, `test:routing`, … | Targeted debugging | Varies |

`npm run verify` = `npm run smoke` (fast).

## What `test:fast` includes

- Typecheck + build (via `smoke`)
- CSV parse / import identity / import rule guard (`skipReactFlow`)
- Manual adjust, canvas storage, UI components
- Routing **unit** tests (`spliceEdgeRouting.test.ts`, etc.)
- Pure geometry/label/metric tests

## What is suspended (opt-in only)

Listed in `vitest.slowTests.ts` — two groups:

**Rule contracts** (`SLOW_RULE_TEST_FILES`): SDC layout contract, legacy EDGE rules, grid feasibility loops, phase-7 verification, SP routing characterization.

**Integration oracles** (`SLOW_INTEGRATION_TEST_FILES`): full `buildReactFlowGraph` on examples/production CSVs, export roundtrips, `spliceEdgeRouting` regression suite, quad layout, cable breakout geometry on full cables.

## Manual QA (required during build phase)

1. `npm run dev`
2. Import **`example-2`** (dominant pair) — primary visual smoke
3. Import any CSV touched by the feature
4. Check: cable stack, tube order, splice corners, drag behavior, export if relevant

Sample CSVs: [`docs/reference/examples/`](../reference/examples/README.md).

### Import optimizer diagnostics (dev)

When debugging slow imports or finalist/fallback behavior:

1. Add to `.env.local` (see [`.env.example`](../../.env.example)):

   ```
   VITE_DEBUG_IMPORT_OPTIMIZER=1
   ```

2. `npm run dev` → import a CSV → one collapsed **`[import optimizer]`** group in the browser console.

3. Inspect `window.__SDC_LAST_IMPORT_DIAGNOSTICS__` or run `window.__SDC_PRINT_LAST_IMPORT_DIAGNOSTICS__()`.

**Headless Left-CSV QA** (optional, requires Playwright installed separately):

```bash
npm run dev   # separate terminal
node scripts/import-diagnostics-qa.mjs docs/reference/examples/Left-STATE_OFFICE.csv
```

Prints heuristic/total wall time, `searchStats`, `ruleRejectCounts`, and `fallback` from the last import.

## Re-enabling intense validation

When the user says to harden layout/rules:

```bash
npm run test:rules          # all suspended contract tests
RUN_KNOWN_ISSUES=1 npm run test:layout   # include KI-001..004 skips
npm run verify:full         # check + entire vitest suite + build
```

See [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md) for deferred weak points.

## Agents

- **Default session end:** `npm run smoke` only.
- **Do not** run `test:rules`, `test:layout`, or `verify:full` unless the user explicitly asks.
- Layout/routing code changes: note manual QA steps in HANDOFF; skip rule contract runs.
