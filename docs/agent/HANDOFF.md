# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-29 — **SDC-LAYOUT-003 side assignment**

### Root cause

Import search evaluated quad (top/bottom) candidates with **horizontal placement context** rebuilt in `buildSdcContextFromLayout`, while React Flow nodes were quad-painted. That false-failed **SDC-LAYOUT-002** (stem alignment, fan direction) and drowned logs — not a missing rule ID.

### Done

| Area | Change |
|------|--------|
| `layout003.ts` | New **SDC-LAYOUT-003** — stack/side consistency + rendered vs candidate edge check |
| `buildSdcContext.ts` | Use painted node placement when `optimizedLayoutCandidate` or `layoutMode === quad` |
| `layoutRules.ts` | Quad-aware stem alignment + fan checks; skip horizontal tube geometry on vertical edges |
| `tieredEvaluate.ts` | Pass candidate into T0 rule context for LAYOUT-003 |
| Rule pack | `17_SDC-LAYOUT-003_*.md` + index entry |
| Tests | `layout003.test.ts` (5 tests) |

### Gates

- `npm run smoke` — pass

### Manual QA

Import **Left-STATE_OFFICE** with `VITE_DEBUG_IMPORT_OPTIMIZER=1` — quad finalists should show fewer spurious `SDC-LAYOUT-002` rejections; `ruleRejectCounts` may still include ROUTE failures on hard fixtures.

### Frozen

`spliceEdgeRouting.ts` — not touched.
