# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-23 — **Fast SDC production path (routing partial)**

### Done

| Area | Change |
|------|--------|
| Reconcile | `reconcileGapHorizontalLanesAfterRouting`: clear stale Y → gap bend X → deconflict → `assignSideHorizLaneYs` merge (preserve deconflict Y); EDGE-011 spans via `defaultSideCircuitLabelSpan()` |
| Overlap detect | `gapHorizSegmentsOverlap` uses full `spliceRouteSegments` h-segments (matches legacy EDGE-011 validator) |
| Deconflict | Lane-A source/target/both trials; `assignSideHorizLaneYs` seeds occupied from existing Y offsets |
| Grid assign | `snapLaneMidXAvoidOverlap` skips midX bumps that would stack gap horizontals; horiz ledger passed in |
| CI | `test:ci` excludes `sdcLayoutContractSlow.test.ts`; vitest forks pool / maxWorkers 2 |
| Docs | `RULE_ID_MAP.md` test section corrected |

### Test status

- `npm run test:layout`: **12 pass**
- `npm run test:routing`: **94 pass, 2 fail** — Example #3 + SPI **EDGE-011** (`h/h` same-Y after midX snap)
- `npm run check` + `npm run build`: pass (run after pull)
- `npm run verify`: **not green** (routing EDGE-011)

### Next (routing blocker)

1. Crowded center pairs need `routingSourceHorizY` / `routingTargetHorizY` on precomputed edges; deconflict detects overlap but bend-budget gate blocks all Y trials for jogX routes
2. Consider per-connection `diagramCenterX` in `laneBendsWithinBudget` during reconcile (validator uses per-pair default)
3. Do **not** strip grid Y offsets in reconcile; do **not** use budget-free deconflict (EDGE-004 regressions)
4. Re-run `npm run verify` when routing green

### Frozen routing

See `.cursor/rules/frozen-routing.mdc`.
