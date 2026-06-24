# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-24 — **Grid EDGE-011 SPI reconcile — parked (partial fix landed)**

### Done

| Area | Change |
|------|--------|
| Import wiring | `buildReactFlowGraph`: `routingVisualCables = sharedVisualCables ?? internal` for **both** `augmentNodesEngineGraph` and `layoutEndpointSync` |
| Layout ctx | `buildLayoutRuleContextWithExpansion` passes `sharedVisualCables`; uses routed `visualCables`/`placement` from graph build |
| Reconcile | `laneHasNoGapHorizConflict`; seal/sweep require global gap clear; jog plain fallback tries jog `sourceHorizY` + `targetHorizY`; seal/sweep iteration loop; **tail** `deconflictGapHorizontalLanes` after horiz-offset merge |
| Attach | Full grid import path now writes `routingSourceHorizY` / `routingTargetHorizY` on split splice legs (was undefined) |

### Test status

- `npm run test:layout`: **12/12**
- `npm run test:routing`: **not green** — SPI legacy **EDGE-011** (see failing pair below)
- `npm run check` + `npm run build`: pass
- `npm run verify`: **not green**

### Failing case (canonical for next session)

- **Fixture:** `docs/reference/examples/Left-SPI-215_I-80.csv`
- **Gate:** `npx vitest run src/features/diagram/gridReconcileEdge011.test.ts -t "SPI: findSpliceOverlapPair"` (use **600_000** ms timeout; filter `-t "left-spi-215"` for routing contract)
- **Overlap:** `288-…|44|BR|BK::288-…|32|GR|BK` vs `24-…|23|OR|RO::48-…|43|BR|RD` — **h/h mid=3000/2952**
- **Lanes on edges:** plain `routingSourceHorizY: 700`; jog `routingTargetHorizY: 676`, `targetBendX: 2952`
- **Original y=652 jog/plain pair:** largely fixed by `routingVisualCables` alignment

### Next (when revisiting)

1. Fix **sourceHorizY plain vs jog targetHorizY** gap overlap without breaking **SDC-ROUTE-002** (bundle trunk spacing)
2. Prefer **targeted** post-offset reconcile for jog/plain + source-offset pairs — avoid doubling full 64-pass deconflict on every import
3. Align legacy EDGE-011 validator geometry with reconcile (`gapHorizSegmentsOverlap`, `sideCircuitSpan`, `diagramCenterX`)
4. Trim `gridReconcileEdge011.test.ts` diagnostics; fix test expecting overlap *before* fix
5. Green `npm run verify`; update this handoff

### Do not

- Edit frozen `spliceEdgeRouting.ts` symbols without user approval
- Weaken layout/routing tests
- Replace full deconflict with budget-free Y (EDGE-004 regressions)
- Move deconflict **only** after horiz-offset merge ( broke SDC-ROUTE-002 on SP-3254.5)

### Key files

- `src/features/diagram/buildReactFlowGraph.ts` — `sharedVisualCables` / `routingVisualCables`
- `src/features/diagram/layoutRules.ts` — `buildLayoutRuleContextWithExpansion`
- `src/features/diagram/spliceCenterLanes.ts` — `reconcileGapHorizontalLanesAfterRouting`, seal/sweep
- `src/features/grid/gridLaneAssign.ts` — calls reconcile
- `src/features/diagram/gridReconcileEdge011.test.ts` — SPI regression
- `src/features/diagram/routingImportContract.test.ts` — legacy EDGE-011 gate (96 tests)
