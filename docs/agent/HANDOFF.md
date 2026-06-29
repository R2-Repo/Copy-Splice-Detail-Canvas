# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-28 — **SDC-only rule vocabulary (merge-ready)**

### Done (PR #28)

| Area | Change |
|------|--------|
| Rule pack + docs | SDC-ROUTE-004, 24px in SDC-GRID-001; deleted legacy agent docs |
| Enforcement | Q3/Q4/Q7/Q8 dropped; dominant pair, ring-cut split, nest validators removed |
| Subcodes | All atomic checks renamed to `SDC-*-NNN-A` … in `sdcCheckIds.ts` |
| Purge | No FBR/TUB/CBL/ROW/EDGE/DOT/STR/DOM IDs in src or active agent docs |
| Gates | `npm run smoke` pass |

### Manual QA before merge

Import **example-2** + any touched Left-* CSVs.

### Frozen

`spliceEdgeRouting.ts` symbols untouched.
