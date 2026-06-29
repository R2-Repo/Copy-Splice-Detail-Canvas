# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-29 — **SDC-LAYOUT-001 import false failures**

### Root cause

During import search, `buildSdcContextFromLayout` rebuilt **default** heuristic placement via `buildLayoutRuleContext` while SDC-LAYOUT-001-B/C checked cable overlap/gap against those phantom positions — not the candidate’s painted React Flow nodes. That produced spurious `SDC-LAYOUT-001` rejections in optimizer logs.

### Fix

| Area | Change |
|------|--------|
| `buildLayoutRuleContextFromRendered` | New helper — cable positions from rendered nodes |
| `buildSdcContextFromLayout` | Uses painted geometry + `placement` from search eval |
| `evaluateCandidate` / `tieredEvaluate` T1 | Pass `graphResult.placement` into `SdcRuleContext` |
| `buildSdcRuleContext` | Attach `placement` from `buildReactFlowGraph` |
| `evaluateSdcLayoutSpacingRules` | Dropped duplicate `SDC-ORDER-002-B` (ORDER-002 owns pitch) |
| `buildSdcContext.test.ts` | Regression on Left-SP-3254.5 candidate |

### Gates

- `npm run smoke` — pass (358 fast tests + build)

### Manual QA

Import **Left-SP-3254.5** and **example-2** with `VITE_DEBUG_IMPORT_OPTIMIZER=1`; confirm `ruleRejectCounts` for `SDC-LAYOUT-001` drops vs pre-fix on multi-side candidates.

### Frozen

`spliceEdgeRouting.ts` — not touched.
