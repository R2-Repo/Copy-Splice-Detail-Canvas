# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-29 — **Merge main into LAYOUT-001 fix branch**

### Conflict resolution

| File | Classification | Resolution |
|------|----------------|------------|
| `buildSdcContext.ts` | **Complicated (same intent)** | Kept main's `buildLayoutRuleContextFromEvaluated`; added branch's `ctx.placement` + `candidateToPlacementMap` fallback via `resolveEvaluatedPlacement` |
| `CONTEXT.md` / `HANDOFF.md` | **Simple** | Combined LAYOUT-001 + LAYOUT-002/003 focus notes |
| `layoutRules.ts`, `tieredEvaluate.ts` | **Simple (auto-merged)** | No manual edits needed |

### Combined fix (post-merge)

| Area | Change |
|------|--------|
| `buildSdcContext.ts` | No layout rebuild; prefer `graphResult.placement`, then candidate map, then node-derived order |
| `evaluateCandidate` / T1 | Pass `graphResult.placement` into `SdcRuleContext` |
| `evaluateSdcLayoutSpacingRules` | Dropped duplicate `SDC-ORDER-002-B` |
| Main (#30) | Quad-aware LAYOUT-002 checks, `quadGeometry` helpers |
| Main | **SDC-LAYOUT-003** — stack/side + rendered vs candidate |

### Gates

- `npm run smoke` — run after merge commit

### Manual QA

Import Left-SP-3254.5, example-2, Left-STATE_OFFICE with `VITE_DEBUG_IMPORT_OPTIMIZER=1`.

### Frozen

`spliceEdgeRouting.ts` — not touched.
