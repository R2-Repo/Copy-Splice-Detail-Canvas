# Handoff



> Agents: overwrite this section at the end of each session.



## Last updated

2026-06-14 — **Help & guide modal** (visual-first toolbar help). Far-right `HelpIcon` button opens `HelpGuideOverlay` with 6 pictorial sections (get started, auto/manual gestures, toolbar map, circuits, keys). `npm run verify` green (layout 114/114, ci 503/503, build).

### Session changes (help guide)

- **`HelpGuideOverlay`** — modal shell (backdrop, Escape, scroll body) matching `SpliceReportOverlay` pattern.
- **`HelpGuideContent`** + **`HelpGuideIllustrations`** — inline SVG gesture cards, key badges (`Shift`, `Ctrl`/`⌘`, `Esc`), toolbar icon row; minimal captions.
- **`WorkflowCanvas`** — `helpOpen` state; `ToolbarActionButton` after Print to PDF.
- **`ToolbarIcon`** — `HelpIcon`, `ListIcon` (circuits row in toolbar map).
- **`splice-diagram.css`** — `.help-guide-overlay*` BEM; hidden on `body.printing-diagram`.
- **Tests:** `HelpGuideOverlay.test.tsx`.

### Prior session (manual multi-leg)

- **Smart bundle selection** — `Shift`+grab a leg expands to its tube bundle (`tubeBundleKey` = same source buffer tube → same destination cable) and drags them together; **double-click** a leg selects the bundle without moving. Built on the existing group-drag path (`segmentTargets` / `resolveGroupSegmentIndex`); only the selection source is new. The grabbed side (left/right) decides which leg of each member moves.
- **Clear selection** — `Escape` or a plain click on empty canvas clears (smart-select not sticky).
- **Accurate hover + click zone** — invisible hit button now spans the **full colinear vertical run** (new pure `verticalRunBounds`), and the hover/selection highlight is a separate thin bar tracing the real vertical, width scaled by zoom (`segmentHighlightStyle`). Replaces the fixed 14px CSS box that sat off the line.
- **Follow-up — selected = hot pink + Ctrl additive select:** selected highlight/ring/dot hot pink (`#ff1493`); leg hover now light hot pink too (no blue left on legs). **Ctrl/Cmd+click** toggles a single leg into the selection (no drag); **Ctrl/Cmd+double-click** unions that leg's bundle into the selection. New pure `addConnectionsToSelection` in `selection.ts` (+ `selection.test.ts`); `onSegmentDoubleClick` now takes an `additive` flag.
- **Follow-up — collapsed butt square shiftable:** the big butt square now has its own square dot handle in `ManualAdjustOverlay` (`fusionDots` includes `butt-*` edges, `BUTT_DOT_HIT`). Drag shifts it horizontally via re-pin around the new spliceX (legs stay joined), persisted as `dotShiftX` on the `butt-*` key; `applyLegOverridesToEdge` butt branch now applies `dotShiftX`. `onDotPointerDown`/`previewDotDrag` accept butt edges (single edge holds both legs); dot commit skips leg validation for butts. Works for straight same-row butts too (old segment handle needed a center vertical). Test: `applyManualAdjust.test.ts`.
- **Follow-up — fusion dots inert as RF nodes:** `splicePoint` nodes now created `draggable: false, selectable: false` in `buildNodesEngineGraph.ts` + `buildQuadReactFlowGraph.ts`. Fixes dots being draggable/clickable in **auto mode** (overlay is off there). Manual dot drag is via the overlay + `syncSplicePointNodes` (programmatic), unaffected by the flags. Also set `SplicePointNode` handles `isConnectable={false}` to kill the stray React Flow connection-line drag (handles only anchor the precomputed leg edges; the dot is never user-wired).
- **Follow-up — fusion-dot selection parity:** dots now use the same gestures as legs (Shift+grab smart-bundle select+drag, plain grab single/selection, Ctrl+click additive single, double-click / Ctrl+double-click bundle). Dot drag itself was already horizontal-only with both legs re-pinned around the moved dot (dot == leg color-transition point), so dragging moves the color point. Selection is per-connection, shared between legs and dots. `onDotPointerDown` got Ctrl/Shift branches (+ `graph` dep); dot `onDoubleClick` reuses `onSegmentDoubleClick`; `.manual-adjust-dot` hover/selected now hot pink. No frozen symbols touched.
- **Follow-up — existing toggle via long-press (replaces click-toggle):** removed `onEdgeClick`. A **long-press** (~450ms, plain left-press, no modifier) on a leg or butt toggles the **whole connection** existing↔normal (both legs flip; long-press again turns back). Keep holding to ~1100ms to toggle the whole **tube bundle** (`tubeBundleKey`). Fire-on-release; pink charge highlight shows the tier; a move cancels (it's a drag). Same in auto + manual. New `canvas/edges/existingToggle.ts` (+ test), `canvas/useExistingLongPress.ts`, `canvas/ExistingToggleContext.tsx`. `SpliceEdge` renders `.splice-edge__hit` (long-press target per shown leg) + `.splice-edge__charge` (feedback). Overlay segment/dot buttons also call `beginLongPress` (still press = toggle, move = drag). Persistence: `existingIdsFromEdges` normalizes split legs → `splice-{connId}`; builder applies `existing` to both legs (back-compat for old split ids) + butt edges (butt existing now persists). No frozen symbols touched.

Created:

- `src/features/manualAdjust/smartSelect.ts` + `smartSelect.test.ts`
- `src/features/manualAdjust/selection.test.ts` (additive-selection coverage)
- `src/features/manualAdjust/applyManualAdjust.test.ts` (butt-square dotShiftX)
- `src/features/canvas/edges/existingToggle.ts` + `existingToggle.test.ts`
- `src/features/canvas/useExistingLongPress.ts`
- `src/features/canvas/ExistingToggleContext.tsx`

Edited:

- `src/features/manualAdjust/useManualAdjustEngine.ts` — Shift bundle branch + Ctrl/Cmd additive single-leg branch in `onSegmentPointerDown`, `onSegmentDoubleClick` (now `additive` flag), `onClearSelection`, Escape listener
- `src/features/manualAdjust/selection.ts` — added pure `addConnectionsToSelection`
- `src/features/manualAdjust/legSegments.ts` (+ `legSegments.test.ts`) — added pure `verticalRunBounds`
- `src/features/manualAdjust/ManualAdjustOverlay.tsx` — invisible hit button + separate zoom-scaled highlight, hover state, empty-click clear, double-click (threads Ctrl/Cmd), full-run sizing, butt square dot handle, `beginLongPress` on segment+dot
- `src/features/canvas/edges/SpliceEdge.tsx` — long-press hit path + charge highlight (consumes `ExistingToggleContext`)
- `src/features/canvas/WorkflowCanvas.tsx` — overlay props; removed `onEdgeClick`; wired `useExistingLongPress` + `ExistingToggleProvider`
- `src/features/canvas/layoutStorage.ts` — `existingIdsFromEdges` normalizes split legs → composite
- `src/features/diagram/buildReactFlowGraph.ts` — `existing` on both fiber legs (back-compat) + butt edges
- `src/features/diagram/buildNodesEngineGraph.ts` + `quad/buildQuadReactFlowGraph.ts` — splice dots `draggable:false, selectable:false`
- `src/features/canvas/nodes/SplicePointNode.tsx` — handles `isConnectable={false}`
- `src/styles/splice-diagram.css` — `.manual-adjust-segment-highlight` (pink), butt `--square` dot, `.splice-edge__hit` / `.splice-edge__charge`

Frozen-routing note: none of the frozen symbols/tests were touched. Changes are confined to `manualAdjust/*`, `canvas/edges/*` (SpliceEdge + new existingToggle), the overlay, canvas wiring, builders (additive `existing`/`draggable` flags), and CSS.

Pending user QA (Left-* imports): single-leg drag still good; Shift-grab a bundled leg moves the whole tube bundle; hover bar sits on the vertical at multiple zoom levels.

---

2026-06-14 — **Quad (4-side) layout paused.** Final handoff doc added: [`QUAD_LAYOUT.md`](./QUAD_LAYOUT.md). MVP auto engine verified (`npm run verify` green). User resuming other project work; pick up quad from backlog in that file.

## Session changes

1. Created **`docs/agent/QUAD_LAYOUT.md`** — canonical quad feature doc: architecture, module map, persistence, routing/placement behavior, known gaps, prioritized backlog, manual QA checklist, do-not-touch list.
2. Updated **`CONTEXT.md`** — current phase = quad paused; pointer to `QUAD_LAYOUT.md`.
3. Updated **`ARCHITECTURE.md`** — quad module section.
4. Updated **`AGENTS.md`** — read `QUAD_LAYOUT.md` when working on 4-side layout.

## Frozen-routing note

No code changes this session. Quad work remains isolated from frozen horizontal routing (`spliceEdgeRouting.ts`, `manualAdjust/*`).

## Files

Created:

- `docs/agent/QUAD_LAYOUT.md`

Edited:

- `docs/agent/CONTEXT.md`
- `docs/agent/HANDOFF.md`
- `docs/agent/ARCHITECTURE.md`
- `AGENTS.md`

## Verification

No code changes — prior baseline still valid:

```bash
npm run verify   # layout 114/114, ci 475/475, build OK
```

## Next agent

- **If user returns to quad:** read [`QUAD_LAYOUT.md`](./QUAD_LAYOUT.md) first; start from P0 backlog (real-import smoke, gap-band routing).
- **If user works elsewhere:** ignore quad unless they toggle 4-side or cite quad symptoms — horizontal + manual adjust are the production path.

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

> **Canonical doc (2026-06-14):** [`QUAD_LAYOUT.md`](./QUAD_LAYOUT.md) — use that file when resuming quad work; sections below are session history.

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

## 2026-06-14 quad refinement — placement + channel router + color order

Auto-engine-only refinement of quad mode (per-leg manual adjust still deferred). The router is a pure, self-contained quad module — no `spliceEdgeRouting.ts` / `manualAdjust/*` edits, horizontal mode byte-identical.

### Changes

1. **Placement** — `quad/quadPlacement.ts` `assignSides` now places each remaining stub on a side **perpendicular to its heaviest already-placed neighbor**, never the same side when one neighbor strictly dominates (kills the "all fibers go to a top cable yet parked on top" same-side loop). Balanced across candidate sides; pins (`quadCableSides`) still win; tiny-graph CSV fallback kept.
2. **Channel/lane router** — new `quad/quadChannels.ts` (`computeQuadFrontiers`, `LaneAllocator`) + rewritten `quad/quadRouter.ts` (`createQuadRouter`). Splices ride open lanes between the side frontiers instead of the dead center; overlapping jogs/loops pack onto nearest free lanes (`SPLICE_LANE_SEP`). Bends minimized: perpendicular = single L, aligned opposite = straight, offset = one jog, same-side = tight inward loop. `quad/buildQuadReactFlowGraph.ts` is two-phase (materialize all handles → frontiers → route).
3. **Top-cable color order** — `quad/quadGeometry.ts` `orientTubesForQuadSide` pre-flips top-cable stacks so the existing +90° render reads blue→orange→green left→right (matches bottom), no text mirroring. Render + handle math share the oriented tubes (dots stay on strands).

### Files

Created:

- `src/features/diagram/quad/quadChannels.ts`
- `src/features/diagram/quad/quadRouter.test.ts`

Edited:

- `src/features/diagram/quad/quadPlacement.ts`
- `src/features/diagram/quad/quadRouter.ts` (rewritten)
- `src/features/diagram/quad/quadGeometry.ts`
- `src/features/diagram/quad/buildQuadReactFlowGraph.ts`
- `src/features/diagram/quad/buildQuadReactFlowGraph.test.ts`
- `docs/agent/CONTEXT.md`, `docs/agent/HANDOFF.md`

### Frozen-routing note

- No frozen symbols touched. `spliceEdgeRouting.ts` and `manualAdjust/*` unchanged.

### Verification

- `npm run verify` PASSED — layout 114/114, check, ci 475/475 (61 files), build.

### Not done (still deferred)

- Per-leg manual adjust in quad mode.
- Crossing-minimal placement (current rule is perpendicular-to-dominant-neighbor, not global crossing minimization).
- Positions still shared across modes (not namespaced).

