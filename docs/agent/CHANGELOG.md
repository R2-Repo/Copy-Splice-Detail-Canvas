# Agent changelog (archived session notes)

> Not read by default. For archaeology only. Active state: [`CONTEXT.md`](./CONTEXT.md) + [`HANDOFF.md`](./HANDOFF.md).

---

## 2026-05-25

- **SDC-LAYOUT-002-A horizontal breakout:** single-tube / on-sheath groups exit horizontal at fiber center; multi-tube fans from sheath center when groups exceed sheath height; `visualShiftY` collapsed handles only
- **SDC-ROUTE-004-A strict two-bend routing:** all splice paths (fiber + collapsed butt) use ≤2 bends total; removed Y-track offsets that added extra elbows; deconflict via distinct `midX` only
- **Dynamic layout on collapse toggle:** `refreshRowLayout` + `autoLayoutY` drag delta preservation
- **Tube-shift v2 (SDC-LAYOUT-002-G):** solver on final merged positions; ±24px collapsed / ±12px expanded
- **Collapsed tube fix:** buffer tube line starts at `tube.origin` (sheath face) and runs to stem handle Y

## 2026-05-24

- **Tube bundle routing (SDC-ROUTE-002):** one parallel lane stack per bundle — row-offset/color order preserved at vertical elbows; shared horizontal deconflict + shared midX shift per bundle
- **Cable stack order:** converging median barycenter (own rows + partner rows); joint permutation search (≤8 cables/side) minimizes strand crossings
- **Cable Y alignment bugfix:** pair alignment no longer wiped by full `placeSide` re-anchor — uses `reflowStackPreservingY`; dominant + high-count pairs only; skips ring-cut multi-instance groups
- **Adaptive row gaps:** stub/split boundaries use 24–48px (`adaptiveBoundaryRowGap`) instead of full cable height
- **Side scoring:** `heightImbalance` term balances left/right stack height
- **Stack order:** barycenter sort replaces hardcoded DROP/DK/2700/3175 heuristics
- **Routing:** measured OS tags; shrinkable inset floor; `enforceDistinctMidXLanes`; SDC-ROUTE-003-C vertical deconflict
- **Tubes:** per-tube horizontal length scales with fiber count
- **Drag-scoped routing:** full diagram routing at import only; after import, moving a cable live-reroutes only that cable's strands; other edges use frozen `routingMidX`/`routingJogX`/horiz Y from import
- **Cross-side bundle pack:** fixed 24px sep, anchored at median row-offset-proportional ideal midX
- **Bundle trunk:** `bundleJogXForMembers` anchors trunk at source-side midX
- **Global deconfliction:** `assignSideHorizLaneYs` + `assignSideVertLaneXs` share one occupied ledger across routing zones
- **Width-stable toggle:** `importLayoutWidthForGraph` always sizes for expanded graph
- **Wider center floor:** `minCenterGapForRowSpan` floor 200 → 320px
- **Import fitView:** fit-width camera on import
- **SDC-ROUTE-001 horizontal-first (full):** OS-aware clearance before vertical legs
- **Per-lane stagger bend (SDC-ROUTE-003-B/012):** Y-offset tracks use `laneClearXBeforeVertical`
- **Spacing fix (SDC-ROUTE-003-B):** `assignGapBendLaneXs` assigns distinct gap bend X per strand
