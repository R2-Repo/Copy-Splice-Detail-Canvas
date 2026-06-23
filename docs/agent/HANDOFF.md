# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-23 — **Fast SDC production path (partial)**

### Done

| Area | Change |
|------|--------|
| SDC contract | `sdcLayoutContract.test.ts`; `test:layout` → SDC only; `test:layout-legacy` for old suite |
| Failure labels | `formatSdcFailureMessage` in `legacyBridge.ts`; SDC phrases in layout/route wrappers |
| Grid routing | `reconcileGapHorizontalLanesAfterRouting`; horiz occupancy + bend gate in `gridLaneAssign.ts`; aligned `horizontalSegmentsForLane` with render segments |
| Cleanup | Removed `debugSessionLog.ts`, session log, WorkflowCanvas/resolve debug calls |
| Docs | Rule pack canonical in AGENTS + layout-rules.mdc; `LAYOUT_RULES.md` deprecation banner |

### Test status

- `npm run test:layout`: **12 pass** (SDC grid contract; 300N import-only)
- `npm run test:layout-slow`: optional full **300N_MAIN** grid rules
- `npm run test:routing`: **94 pass, 2 fail** — legacy EDGE-011 on Example #3 + SPI
- `npm run test:sdc`: pass
- `npm run check` + `npm run build`: pass
- `npm run verify`: **not green** (`test:ci` routing + worker timeouts)

### Next (routing blocker)

1. Example #3 / SPI: crowded center — Y-track offset exists within bend budget for snapped midX pairs (`mid=1968/2040`, `3024/2904`)
2. Do **not** strip grid-assigned Y offsets in reconcile (fixed)
3. Consider midX spread in congested zones or import feasibility expansion — **no frozen routing edits**
4. Re-run `npm run verify` when routing green

### Frozen routing

See `.cursor/rules/frozen-routing.mdc`.
