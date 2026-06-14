# Handoff



> Agents: overwrite this section at the end of each session.



## Last updated



2026-06-14 — Quad (4-side) layout mode (additive). `npm run verify` green. See "2026-06-14 quad (4-side) layout mode" at the bottom.



## Session changes



1. Added map popover button in left toolbar (`CsvImportButton` neighbor) wired to CSV header location.
2. New tabbed popover UI:
   - `uPlan` ArcGIS iframe (`center`, `level=20`, `marker`)
   - `Earth` link-out to Google Earth 3D + embedded Google Maps satellite preview
   - `Street View` no-key experimental iframe + fallback open-link
3. Added map URL builder utilities and robust `header.location` parser.
4. Added focused tests for location parsing, map URL builders, and tab rendering behavior.



## Frozen-routing note



No frozen symbols touched.



## Files



Created:

- `src/features/maps/parseSpliceLocation.ts`
- `src/features/maps/buildArcGisWebAppUrl.ts`
- `src/features/maps/buildGoogleEarthUrl.ts`
- `src/features/maps/buildGoogleMapsUrls.ts`
- `src/features/maps/MapEmbedButton.tsx`
- `src/features/maps/parseSpliceLocation.test.ts`
- `src/features/maps/mapUrlBuilders.test.ts`
- `src/features/maps/MapEmbedButton.test.tsx`

Edited:

- `src/features/canvas/WorkflowCanvas.tsx`
- `src/components/toolbar/ToolbarIcon.tsx`
- `src/components/toolbar/ToolbarSegmentedControl.tsx`
- `src/styles/splice-diagram.css`
- `docs/agent/CONTEXT.md`
- `docs/agent/HANDOFF.md`



## Verification



```bash
npm run test:layout   # PASSED — 114/114
npm run check         # PASSED
npm run test:ci       # PASSED — 56 files, 450 tests
npm run build         # PASSED
```



Manual smoke test:



1. Import `docs/reference/examples/Left-SP-3254.5.csv`.
2. Click new map button in toolbar.
3. Verify tabs:
   - `uPlan`: map centers on splice point and shows marker
   - `Earth`: link opens Google Earth 3D view
   - `Street View`: iframe attempts pano; fallback link opens Maps pano route



## Not done (deferred)



- Earth Web iframe is still expected to be unreliable/cross-origin blocked; use link-out as primary UX.
- Street View no-key iframe is unofficial and may fail at locations without imagery.



## Next agent



- If the user wants stricter provider behavior, add a setting to hide Street View tab when panorama lookup fails.
- Experience Builder migration should only require swapping ArcGIS URL builder constants/format.

## 2026-06-14 manual mode mirror + bend fixes

- User-reported manual mode regressions:
  - mirror still wrong after cable flips
  - legs detaching/disappearing
  - 90-degree bend hooks reappearing
- Deterministic repro from exported config (`SP-3254.5-config-2026-06-14_134959.sdc.json`) showed persisted side divergence:
  - `graph.cableSides` could disagree with rendered `node.data.side`
- Implemented fixes:
  - `src/features/manualAdjust/handleCoords.ts`
    - treat `node.data.side` as source of truth for handle coordinate side + source/target selection
  - `src/features/manualAdjust/syncManualVisualCable.ts`
    - copy live `cableData.side` into visual cable used for manual drag sync
  - `src/features/manualAdjust/repinButtSpliceEdges.ts`
    - copy live `cableData.side` into butt handle repin visual cable
  - `src/features/canvas/WorkflowCanvas.tsx`
    - sync `graph.cableSides` during cable drag + drag-stop
    - always persist dragged cable side on drag-stop (not only when sideChanged)
  - `src/features/manualAdjust/legSegments.ts`
    - added endpoint-preserving `removeOrthogonalReversals()`
    - applied in `shiftVerticalLaneX()`
  - `src/features/manualAdjust/syncManualVisualCable.ts`
    - apply reversal cleanup after repin sequence
- Added tests:
  - `src/features/manualAdjust/checkpointRepro.test.ts`
  - `src/features/manualAdjust/handleCoordsSide.test.ts`
  - `src/features/manualAdjust/syncManualVisualCableSide.test.ts`
- Verification:
  - `npm run verify` PASSED (`59 files`, `460 tests`, build OK)

## 2026-06-14 mirror follow-up (config 140801)

- User reported mirror improved but still saw leg disconnect/disappear/color anomalies.
- Reproduced against user-exported config (`SP-3254.5-config-2026-06-14_140801.sdc.json`) and traced remaining drift to workflow side synchronization.
- Final adjustments:
  - `src/features/canvas/WorkflowCanvas.tsx`
    - stop mutating `graph.cableSides` every drag frame
    - after drag-stop rebuild, persist + sync the **resolved** side from rebuilt node data (not precomputed drag side)
  - `src/features/manualAdjust/syncManualVisualCable.ts`
    - live side propagation from `cableData.side` into visual cable projection
  - `src/features/manualAdjust/repinButtSpliceEdges.ts`
    - same side propagation for collapsed tube repin
- Existing mirror/side guards still pass:
  - `handleCoordsSide.test.ts`
  - `syncManualVisualCableSide.test.ts`
  - `checkpointRepro.test.ts`
- Verification rerun:
  - `npm run verify` PASSED (`59 files`, `460 tests`, build OK)

## 2026-06-14 config 141620 follow-up (detach + overlap)

- User repro config: `SP-3254.5-config-2026-06-14_141620.sdc.json`
- Confirmed detached-leg regression during manual cable drag on same-side straight-run pairs (not just static import state).

- Manual drag fixes:
  - `src/features/manualAdjust/legSegments.ts`
    - `repinLegStart` / `repinLegEnd`: when a leg is a full colinear run, keep the opposite endpoint anchored and add one orthogonal connector instead of translating both ends
    - preserve interior waypoints for those full-run cases
  - `src/features/manualAdjust/handleCoords.ts`
    - `handleCoordsForConnection` now returns `sourceVisualCableId` / `targetVisualCableId`
  - `src/features/manualAdjust/syncManualVisualCable.ts`
    - pin-source/pin-target detection now uses those canonical IDs
  - `src/features/manualAdjust/legSegments.test.ts`
    - updated full-run `repinLegStart` expectation
    - added full-run `repinLegEnd` anchor regression test

- Re-import overlap guard:
  - `src/features/export/restoreDiagramConfig.ts`
    - normalize imported cable positions if two cable nodes land on effectively the same row (`x/y` within epsilon), separating by `FIBER_ROW_PITCH`
  - `src/features/export/diagramConfig.test.ts`
    - added regression for config import de-overlap behavior

- Frozen-routing note:
  - no frozen routing symbols changed.

- Verification:
  - `npm run test:layout` PASSED (`114/114`)
  - `npm run check` PASSED
  - `npm run test:ci` PASSED (`59 files`, `462 tests`)
  - `npm run build` PASSED

## 2026-06-14 overlap follow-up (vertical runs stacking)

- New user issue after detach fix:
  - manual cable drag could stack vertical leg runs at same `x` (lines appear stuck on top of each other)
  - user observed in both manual and auto views

- Fix implemented:
  - `src/features/manualAdjust/syncManualVisualCable.ts`
    - added post-repin moved-leg vertical deconfliction
    - identifies moved-side vertical runs per touched connection
    - packs overlapping intervals into separate `x` columns using deterministic offsets
    - uses `shiftVerticalLaneX` so endpoints remain anchored
    - centralizes left/right split-edge patch updates via `patchConnectionPaths`

- New regression test:
  - `src/features/manualAdjust/syncManualVisualCableSide.test.ts`
    - `de-stacks moved-leg vertical runs after large cable drag`
    - recreates SP-3254.5 right-side drag scenario with persisted sides/positions

- Verification rerun:
  - `npm run test:layout` PASSED (`114/114`)
  - `npm run check` PASSED
  - `npm run test:ci` PASSED (`59 files`, `463 tests`)
  - `npm run build` PASSED

## 2026-06-14 spacing follow-up (manual lanes too close)

- User noted remaining issue: vertical runs no longer overlap, but manual-mode spacing was too tight.
- Fix:
  - `src/features/manualAdjust/syncManualVisualCable.ts`
    - changed de-stack separation from hardcoded 8px to canonical `SPLICE_LANE_SEP` (24px).
  - `src/features/manualAdjust/syncManualVisualCableSide.test.ts`
    - strengthened regression to fail if overlapping vertical intervals are separated by less than pitch (`FIBER_ROW_PITCH - 1` threshold).
- Verification:
  - `npm run test:layout` PASSED (`114/114`)
  - `npm run check` PASSED
  - `npm run test:ci` PASSED (`59 files`, `463 tests`)
  - `npm run build` PASSED

## 2026-06-14 quad (4-side) layout mode — additive engine

New optional layout: cables on **left/right/top/bottom**, fans inward, orthogonal port-to-dot routing (perpendicular pairs = L corner, 0 interior bends). **Horizontal L/R mode untouched** — everything gated behind `overrides.layoutMode`.

- Toolbar segmented control toggles Left/right ↔ 4-side; persisted per diagram and through `.sdc.json`.
- `buildReactFlowGraph` early-returns to new `buildQuadReactFlowGraph`; reuses slim-cable + `fiberAnchor` + `splicePoint` + precomputed `SpliceEdge` paths (no frozen router edits).
- Top/bottom cables = canonical left breakout rotated ±90° (CSS); handle coords use the same affine map so dots/legs align.
- Auto placement v1: dominant pair left/right, stubs spread top/bottom by weight. Auto-mode cable drag reroutes + persists.

### Frozen-routing note

- `WorkflowCanvas` drag wiring (`refreshDragRouting`, `onNodeDragStart/Drag/Stop`) got **additive quad guards** that early-return *before* any binary L/R handling. Horizontal behavior is byte-for-byte unchanged when `layoutMode !== "quad"`. No frozen routing symbols in `spliceEdgeRouting.ts` were modified.

### Files

Created:

- `src/features/diagram/quad/quadTypes.ts`
- `src/features/diagram/quad/quadGeometry.ts`
- `src/features/diagram/quad/quadPlacement.ts`
- `src/features/diagram/quad/quadRouter.ts`
- `src/features/diagram/quad/buildQuadReactFlowGraph.ts`
- `src/features/diagram/quad/buildQuadReactFlowGraph.test.ts`

Edited (additive):

- `src/types/splice.ts` — `LayoutMode`, `QuadSide`, `layoutMode`, `quadCableSides` (no version bump)
- `src/features/canvas/layoutStorage.ts` — preserve quad fields in `mergeLayoutOverrides`
- `src/features/canvas/nodes/types.ts` — `quadSide` / `orientation`
- `src/features/canvas/nodes/CableNode.tsx` — rotated render for top/bottom
- `src/features/canvas/nodes/FiberAnchorNode.tsx` — quad handle in/out positions
- `src/features/diagram/buildReactFlowGraph.ts` — quad mode gate
- `src/features/canvas/WorkflowCanvas.tsx` — layout-mode state/toggle + quad drag guards/sync
- `src/components/toolbar/ToolbarIcon.tsx` — `HorizontalLayoutIcon`, `QuadLayoutIcon`
- `src/features/export/restoreDiagramConfig.ts` — skip de-overlap nudge in quad

### Verification

- `npm run verify` PASSED (layout 114/114, check, full ci, build).

### Not done (deferred)

- Per-leg **manual** adjust in quad mode (parallel quad manual path) — auto-mode cable drag works today.
- Placement optimizer quality — v1 is a connection-weight heuristic, not crossing-minimal.
- Upright (counter-rotated) labels on rotated top/bottom cables.
- **Positions are not namespaced per mode** — `overrides.positions` is shared, so toggling Left/right ↔ 4-side re-runs that mode's auto layout (manual position tweaks don't carry across a toggle). `cableSides` (L/R) and `quadCableSides` (quad) *are* separate, so side assignments don't clobber. Namespacing positions per mode is the clean fix.

### Next agent

- If improving quad: build the manual-adjust quad path (own handle-coords + de-stack), and a real crossing-minimizing placement (e.g. barycentric/median around the ring). Do **not** widen the binary `handleCoords.ts`.

