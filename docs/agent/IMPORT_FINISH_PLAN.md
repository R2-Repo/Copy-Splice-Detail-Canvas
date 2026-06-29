# Import finish plan — one-pass execution

> **Created:** 2026-06-28. Canonical checklist for completing remaining import perf work after P0+P1+P2.
> **Status:** In progress — see `HANDOFF.md` for latest results.

## Goal

Ship P3 (memo + budgets + skip duplicate final eval), validate all 3 Left reference CSVs in browser with screenshots, pass `npm run smoke`.

## Reference CSVs (`docs/reference/examples/`)

| File | Dev fixture URL |
|------|-----------------|
| `Left-SP-3254.5.csv` | `?fixture=sp` |
| `Left-STATE_OFFICE.csv` | `?fixture=state` |
| `Left-SPI-215_I-80.csv` | `?fixture=spi` |

## Out of scope

- P4 worker pool
- `npm run test:rules` / full hardening
- KI-003 full feasibility fix (Left-SPI-215 SDC-ROUTE-003-B slow path)
- Frozen routing symbols (`.cursor/rules/frozen-routing.mdc`)

## P3 tasks

### 1. Candidate score memo

- **File:** `src/features/layoutSearch/layoutSearch.ts`
- `Map<candidateStableId, TieredEvalResult>` — skip re-eval on cache hit
- Test: identical best + fewer evals on constrained graph

### 2. Wire `timeBudgetMs` on import

- **File:** `src/features/canvas/WorkflowCanvas.tsx`
- `importTimeBudgetMs(strandCount)` — e.g. `min(180_000, 60_000 + strandCount * 500)`
- Pass to `layoutSearchViaWorker`

### 3. Skip duplicate final T2 eval

- Extend `LayoutSearchResult` with `winnerEvaluation?`
- `WorkflowCanvas` reuses when present

### 4. Adaptive `maxRounds`

- Lower cap when topology locks leave small search space
- Reflect real budget in overlay `evaluationBudget`

## Validation gates

```bash
npm run smoke
npx vitest run src/features/layoutSearch/layoutSearch.test.ts
npx vitest run src/features/layoutSearch/importPerfProbe.test.ts  # opt-in, all 3 Left CSVs
```

## Browser QA (each Left fixture)

1. Overlay animates; no freeze dialog in first 30s
2. Heuristic visible before search completes
3. Final diagram renders; no error banner (SPI fallback documented if needed)
4. Cable Y-drag + zoom work post-import

## Screenshots (`/opt/cursor/artifacts/screenshots/`)

- `left-sp-3254-import-final.png`
- `left-state-office-import-final.png`
- `left-spi-215-import-final.png`

## Success criteria

- [x] P3 code merged
- [x] `npm run smoke` green
- [x] Perf probe logs for SP + STATE (SPI skipped — KI-003)
- [x] 3 browser screenshots
- [x] CONTEXT + HANDOFF + plan status updated
- [x] No frozen routing touched

**Completed 2026-06-28** on branch `cursor/import-perf-p3-finish-5032`.

## Branch

`cursor/import-perf-p3-finish-5032`
