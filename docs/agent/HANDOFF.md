# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-29 — **300N&MAIN import diagnostics QA** merged with main **LAYOUT-001 fix** (#31)

### This branch (PR #33)

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
