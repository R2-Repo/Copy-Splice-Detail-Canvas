# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-25 — **SPI EDGE-011 green (`test:edge011`); reconcile uncommitted**

### Done (uncommitted)

| Area | Change |
|------|--------|
| `package.json` | `test:edge011` + `test:edge011:example3` — single worker, 600s hook timeout |
| `spliceCenterLanes.ts` | Offset-based horiz trials; seal/sweep jog-first when plain offset; `resolveJogPlainGapHorizOverlaps`; **`resolveJogPlainSharedRowGapBendXs`** — caps source gap-bend before partner target lead-in (24px) when pair still gap-H overlaps; jog/plain + jog/jog; `assignGapBendLaneXs` never places source bend at midX |

### Root cause (SPI)

Plain `sourceBendX` at midX left a long **source-row** horizontal (Y = handle row) through the jog **target-row** lead-in zone. Fix: cap plain/jog source bend X before partner `targetBendX` by `MIN_SPLICE_HORIZONTAL_INSET`; only when `gapHorizSegmentsOverlap` still true after assign.

### Test status

| Tier | Command | Result |
|------|---------|--------|
| SPI EDGE-011 | `npm run test:edge011` | **Green** (~67–71s) |
| check | `npm run check` | **Green** |
| layout:fast | `npm run test:layout:fast` | **Red** — SDC-ROUTE-002 on `left-sp-3254.5` (**also red on HEAD**) |
| example-3 overlap | `test:edge011:example3` | **Red on HEAD** (h/h mid=1968/2064; full feasibility ~21 min) |
| verify / routing SPI | not run | |

### Next

1. User commit when ready (`spliceCenterLanes.ts` + `package.json`)
2. Tier 3: routing `left-spi-215` full feasibility
3. Tier 4: `npm run verify`
4. Separate track: example-3 / SDC-ROUTE-002 reds on HEAD (not introduced by SPI fix)

### Frozen

- `spliceEdgeRouting.ts` — no edits without user approval
