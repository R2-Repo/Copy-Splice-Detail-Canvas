# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-29 — **searchStats diagnostics fix** (`cursor/fix-searchstats-diagnostics-9fc7`)

### This session

- **Bug:** `[layoutSearch] evaluations=60` but merged `searchStats` showed `generated` / `evaluatedT0` / `finalists` all 0 while `evalSubPhaseCounts` matched real work.
- **Cause:** Tier counters were recorded only from `layoutSearch.ts` (`recordCandidateEvaluated` in `evaluateAtTier`); eval sub-phases recorded in `tieredEvaluate.ts`. Worker bundle could hold two copies of `importDiagnostics` module state — sub-phase timers updated one copy, search stats another (empty slice).
- **Fix:** Record `recordCandidateEvaluated` inside `evaluateT0` / `evaluateT1` / `evaluateT2` (same module as sub-phase timers); store active search diag on `globalThis`; reconcile tier counts from `evalSubPhaseCounts` in `endSearchDiagnostics` as fallback.
- **Test:** `searchStatsDiagnostics.test.ts` — worker slice `searchStats.evaluatedT0` matches `evalSubPhaseCounts.evaluateT0`.
- **Gate:** `npm run smoke` pass.

### Prior (300N&MAIN import diagnostics QA)

Headless QA on **300N_MAIN.csv** (splice **300N&MAIN**, 278 pairs) with all debug flags:

- `VITE_DEBUG_IMPORT_OPTIMIZER=1` (+ timing, candidates, rules, top/bottom, layout search)
- Script: `scripts/import-diagnostics-qa.mjs`
- Artifacts: `docs/reference/import-diagnostics/300N_MAIN-*`

**Result:** search candidate fully passes rules; heuristic rejected on soft score. Worker search ~1.2s; no config banner.

### Merged from main (#31 LAYOUT-001)

| Area | Change |
|------|--------|
| `buildSdcContext.ts` | No layout rebuild; prefer `graphResult.placement`, then candidate map, then node-derived order |
| `evaluateCandidate` / T1 | Pass `graphResult.placement` into `SdcRuleContext` |
| `evaluateSdcLayoutSpacingRules` | Dropped duplicate `SDC-ORDER-002-B` |
| Main (#30) | Quad-aware LAYOUT-002 checks, `quadGeometry` helpers |
| Main (#32) | **SDC-LAYOUT-003** — stack/side + rendered vs candidate |

### Gates

- `npm run smoke` — run after merge commit

### Manual QA

Import `300N_MAIN.csv`, Left-SP-3254.5, example-2, Left-STATE_OFFICE with `VITE_DEBUG_IMPORT_OPTIMIZER=1`.

### Frozen

`spliceEdgeRouting.ts` — not touched.
