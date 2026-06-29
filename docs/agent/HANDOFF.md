# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-28 — **SDC cleanup: docs + dropped-rule enforcement (Q3/Q4/Q7/Q8)**

### Done (PR #28)

| Area | Change |
|------|--------|
| Rule pack | **SDC-ROUTE-004**; 24px in **SDC-GRID-001**; deleted legacy agent docs |
| Enforcement pass | Removed DOM/CBL-004/005/ROW-003, EDGE-001/005/007/009/010; deleted `dominantCablePair.ts` |
| Pipeline | Single visual cable (no ring-cut split); tube-grouped row order; no dominant pinning |
| Quad placement | Heaviest-cable anchor (not dominant-pair rule) |
| Tests | Updated for dropped behaviors; layout search oracle relaxed for 3-side winners |
| Gates | `npm run smoke` pass |

### Not done (before merge)

- Rename remaining internal check IDs (FBR-*, EDGE-*, etc.) → SDC subcodes
- Purge legacy ID strings from comments/tests/docs
- Optional: simplify jogX assignment in frozen routing (geometry only today)

### Manual QA

Import **example-2** after merge candidate review.

### Frozen

`spliceEdgeRouting.ts` symbols untouched — jogX still assigned, not validated.
