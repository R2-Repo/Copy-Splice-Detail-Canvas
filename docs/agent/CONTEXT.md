# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Import file hint animation (2026-06-15)

- Empty canvas: **Import file** toolbar icon pulses gray ↔ orange (`toolbar-icon-btn--hint`) with a soft accent glow so it stands out on the light neo surface while other controls stay disabled.
- Stops after import (`active` → primary orange fill). Respects `prefers-reduced-motion` (static orange ring instead).

## OS circuit label size (2026-06-15)

- Fan-out **circuit tags** `(CH …)` on each strand: `0.5rem` → `0.55rem` (`.cable-node__circuit` + `CIRCUIT_TAG_FONT` in `cableLabels.ts`).
- **Fusion splice dot** slightly larger: SVG `r` 4→4.5, node dot 6→7px, `SPLICE_DOT` 8→9.

## Canvas lock context menu — v1 (2026-06-15)

Right-click context menu (`src/features/canvas/contextMenu/`). First lock tier, top-down:

- **Cable node:** right-click → Lock/Unlock cable position. Frozen across auto/manual + other elements moving (its buffer tubes/fan-outs can still move). Enforced in `buildReactFlowGraph` (pin saved x/y, immovable anchor in `resolveSameSideNodeCollisions`, `draggable:false`).
- **Fan-out group (per tube):** right-click the fan-out/tube label/tip handle → Lock/Unlock. Locks fan-out + label + color abbreviation + handle as one unit (merged into `lockedTubeKeys`, tip handle disabled). Moves with its cable (relative).
- **Model:** `LayoutOverrides.locks` (`{ cables, tubeGroups }`), persisted in localStorage + `.sdc.json`. Additive (no version bump).
- **Deferred tiers:** buffer-tube position, individual leg/segment/bend, fusion dot (touch frozen routing).

## Horizontal leg alignment — EDGE-013 (2026-06-15)

Near-straight legs/collapsed tubes snap to a single flat horizontal line.

- **Import + auto:** new fixpoint pass in `spliceRowLayout.ts` (`snapNearStraightCables`) nudges each unlocked cable's Y by ≤12px (`HORIZONTAL_ALIGN_TOLERANCE`, `horizontalAlign.ts`) when it flattens more legs than it breaks, within same-side stack slack (never breaks CBL-001/002, FBR-002, tube/fiber order). Dominant/high-count pairs stay pinned. Runs on the same path auto drag-stop re-runs, so auto stops fighting near-straight rows.
- **Manual:** two snaps, both moving the handle/row (the only way a leg renders truly flat):
  - **Cable drag-release:** on manual `onNodeDragStop`, the cable Y snaps to flatten the most cross-side legs against partner cables' live Ys (`nearStraightCableShift`, `horizontalAlign.ts`). This is the main fine-tune gesture — release near-flat and it locks (auto branch untouched; live cable-drag snap avoided to not fight React Flow).
  - **Collapsed-tube + fan-out tip drag:** `TubeManualHandles` snaps to nearest partner handle **or fiber-row** Y, with a guide line. `snapTipTargets` = tube tips + every fiber handle (`collectGlobalFiberHandleSnapTargets`); `CableNode` passes `positionAbsoluteY`.
  - **Tolerance:** interactive snaps use wider `MANUAL_ALIGN_SNAP_TOLERANCE` (≈18px, ¾ pitch) — import/auto stays at 12px.
- **Rule:** EDGE-013 added (`layoutRules.ts` + `LAYOUT_RULES.md`), verified at fixpoint via `maxNearStraightResidual`. Unit tests `horizontalAlign.test.ts`.
- **Manual cable snap is release-only** (not live) — chosen to avoid fighting React Flow's drag controller mid-drag. Snap added in the manual branch of `onNodeDragStop`; the frozen auto lane logic is untouched. Frozen tests (`spliceEdgeRouting.test.ts`, 56) still green.
- **Validation:** `test:layout` 117/117, `check`, `build` green; frozen `spliceEdgeRouting` + `layoutRules` + `horizontalAlign` tests pass.

## Baseline

- Branch: `main`
- Verified: **`npm run test:layout`** green (114/114). **`npm run check`** currently fails on pre-existing WIP in `CableNode.tsx` / `TubeManualHandles.tsx` (unrelated to callout scaling).

## Unified diagram import (2026-06-15)

- **Import file** toolbar button (folder icon, left toolbar) accepts Bentley `.csv` and saved `.sdc.json` configs via `routeImportFile` content sniff.
- **Canvas drop** uses the same router (`importDiagramFile`); config restores layout, CSV runs fresh layout.
- **Removed** separate **Import diagram config** button next to Export.
- **Files:** `routeImportFile.ts`, `CsvImportButton.tsx`, `WorkflowCanvas.tsx`; deleted `DiagramConfigImportButton.tsx`.
- **Tests:** `routeImportFile.test.ts`, `App.test.tsx` updated.

## Print diagram (2026-06-15)

- **Single Print button** → system print dialog (`window.print()`). User picks printer or Save as PDF there (fewest steps).
- **Tabloid:** `@page 17×11 in landscape, margin 0` (margin 0 removes browser header/footer/URL/date). Stage sized to 1536×960 px (16×10 in) so it centers on the page with a 0.5in white self-margin and never overflows to a 2nd page.
- **Single page / no duplicate:** screen prep (centering, `position:fixed`) is `@media screen` only — a fixed element repeats on every printed page. Print layout uses static flex centering; wrappers `display:contents`; `html/body overflow:hidden`.
- **Restore after dialog:** `runDiagramPrint` defaults `addEventListener`/`removeEventListener` to `window` (the hook didn't pass them, so `afterprint` cleanup never ran → toolbar/controls stayed hidden). Now removes `printing-diagram`, restores title/stage size/viewport on `afterprint`.
- **Callouts in fit:** print dispatches `beforeprint` first (locks callouts to fixed `userScale`, no zoom compensation), flushes, then measures fresh bounds via `getNodes()` so the fit includes callouts at their exact print size (was cutting callouts off because bounds were measured at the on-screen zoom before the scale changed).
- **Callout leaders:** `callout-leader-panel` kept visible in print; diagram centered+fit so center fiber strands aren't clipped.
- **Print prep hides:** grid background, zoom controls, toolbar, manual-adjust overlay, layout guides, inspectors.
- **Files:** `printDiagram.ts`, `usePrintDiagram.ts`, `splice-diagram.css`.

## Callout dynamic scaling (2026-06-15)

- **Toolbar:** Callouts pill now has a ▾ submenu — size slider (50–300%) + “Keep readable when zoomed” toggle (default on).
- **Auto zoom:** Flow-space box/text/leader stroke scale by `userScale / zoom` so callouts stay readable when zoomed out on large imports.
- **Print:** Zoom compensation disabled during print — callouts stay proportional to the diagram.
- **Persistence:** `LayoutOverrides.calloutScale`, `calloutAutoZoom`; included in `.sdc.json` export.
- **Files:** `calloutScale.ts`, `CalloutScaleContext.tsx`, `CalloutsToolbarControl.tsx`, `CableCalloutNode.tsx`, `CalloutLeaderLayer.tsx`.

## Diagram title box (2026-06-14, verified)

- **Canvas:** upper-left bordered info box (`diagramTitle` React Flow node) — Street / City/St / Pole #, Report Date, Desc, Location.
- **UI:** single flat border box; plain monospace text (contentEditable values, no form inputs / neumorphic chrome).
- **Position:** anchored above diagram content bounds (`boundsFromFlowNodes` on engine nodes) with 24px gap; repositions on layout/drag.
- **CSV:** `parseHeader` extracts street/city/pole/desc; empty Desc falls back to `Splice#`.
- **Scaling:** flow-space; width/font scale with layout; print fit-width includes title in bounds.
- **Persistence:** `LayoutOverrides.titleBlock` — editable on blur.

## Help & guide modal (2026-06-14, verified)

- **Toolbar:** far-right **Help and guide** button (`HelpIcon`) after Print diagram in `workflow-canvas__toolbar-export`.
- **Modal:** `HelpGuideOverlay` — visual-first cards (inline SVG gestures, toolbar icon map, key badges); Escape / backdrop / Close dismiss.
- **Files:** `src/components/help/*`, styles in `splice-diagram.css`, `ListIcon` + `HelpIcon` in `ToolbarIcon.tsx`.
- **Tests:** `HelpGuideOverlay.test.tsx` (3).

## Checkpoint (user-approved — 2026-06-13)

**Best manual adjust + leg routing so far.** User confirmed leg drag fixed (no freeze, smooth enough). Treat this commit/state as a **jump-back point** if later manual/routing work regresses.

Key symbols touched this session:

- `legSegments.ts` — `simplifyOrthogonalPath` on `preserveSplice` reconnect
- `useManualAdjustEngine.ts` — absolute drag from pre-drag snapshot; overlay freeze flag
- `ManualAdjustOverlay.tsx` — cached hit-targets during leg drag; handle coord cache

## Current phase

**Quad (4-side) layout — paused (MVP auto engine).** Usable for exploration; not production-complete. Canonical handoff: [`QUAD_LAYOUT.md`](./QUAD_LAYOUT.md). Resume from backlog there (manual adjust, gap-band routing, placement polish).

**Other project work** — user moving focus off quad for now; horizontal two-sided mode + manual adjust remain the primary production path.

**Diagram config export/import** — `.sdc.json` via **Import file** button or canvas drop; Export unchanged.

## Diagram config (2026-06-13, verified)

- **Export:** toolbar **Export diagram config** → `{splice}-config.sdc.json` (embedded `SpliceReport` + `LayoutOverrides` + `cableSides`; optional viewport).
- **Import:** **Import file** toolbar button or canvas drop → `activateDiagram` (config preserves saved positions/routing; CSV fresh layout).
- **Tests:** `src/features/export/diagramConfig.test.ts` — Left-* roundtrip + schema rejection.
- **`npm run verify` green** — layout 114/114, ci 441/441.

## Manual/auto bug-fix pass (2026-06-13, verified)

Code-review follow-up — `npm run verify` green (114 layout / 450 ci / build):

- **Manual mode is fully rigid (no auto reroute).** `syncManualVisualCable` re-pins the moved cable/tube leg end(s) to the new handle and keeps the existing leg shape + fusion dot; lanes/midX are never recomputed on a manual move. Preserves hand-adjusted leg shapes through a cable drag (replaced the earlier `applyLegOverridesForConnections` re-apply, now removed).
  - Re-pin uses point-based `repinLegStart`/`repinLegEnd` (`legSegments.ts`) — moves the leg end + slides the **whole leading/trailing run on that row**, preserves the rest exactly, **idempotent**. (Earlier attempts: `setPathStart`/`setPathEnd` round-trip collapsed legs/froze app; then a first-corner-only repin left multi-waypoint runs behind → diagonal on vertical cable moves. Both fixed.)
- **Same-side loop-back: manual leg drag is warn-don't-revert.** On commit (`useManualAdjustEngine`) and on rebuild (`applyLegOverridesToEdge`), a rule trip shows the banner but keeps the drag — no snap-back. Unblocks loops that sit at the DOT/EDGE limits.
- **Leg drag adds no bend.** A leg drag is only ever a horizontal lane shift, so it now uses point-based `shiftVerticalLaneX` (moves just the dragged vertical's two bend points; preserves direction + splice) instead of the lossy `applySegmentDelta`→`segmentsToPath`→reconnect round-trip (which redrew horizontals to max-x / verticals min→max and spawned a spurious bend on loops whose last run goes leftward). Used by both `previewSegmentDrag` and `applyLegOverridesToEdge` (non-butt); butt keeps the segment-based reshape.
- **Movable fusion dots** (= leg color-transition point). New `onDotPointerDown` + dot hit-targets (`ManualAdjustOverlay`); drag along the leg (single or group via selection), warn-don't-revert; persisted via new `legOverrides.dotShiftX`, applied on rebuild by re-pinning both legs around the new dot.
- **Toggle jitter fix.** `toggleManualAdjust` no longer forces `updateNodeInternals` — cable geometry is identical between modes (manual only mounts an absolute overlay), so the forced re-measure was causing a visible jump.
- Group leg move resolves each leg's own center segment (`segmentTargets`); single-leg drag unchanged.
- `handleLegOverridesCommit` no longer nests `setState`.
- **Override model unified on `legOverrides`** (H2 Direction A): removed dead `bundleOverrides`, `connectionOverrides` (+ bridge/persistence/legacy-branch wiring), `connectionOverrides.ts` (+ test), `snapTargets.ts`, `accumulateConnectionOverride`. `legOverrides` is now the single splice-override representation the nodes engine applies.
- **C1:** nested `Splice-Detail-Canvas/` scaffold (19 tracked files, no `src`/`docs`, only duplicated `.cursor/rules` + `AGENTS.md`) staged for removal via `git rm -r` — **uncommitted, pending user commit**. No real backslash/shadow source files existed (Windows tooling artifact).
- Still deferred: M1 auto-drag RAF throttle (frozen `refreshDragRouting`/`onNodeDrag`), H4 dead vertical-axis leg machinery.

## Latest (2026-06-13)

**Neumorphic theme (app chrome only):**

- Token-based soft UI for toolbar, panels, modals, React Flow controls
- Accent: neon burnt orange (`#FF6B2C`); diagram nodes/edges/callouts unchanged
- New: `src/styles/neumorphic-tokens.css`, `src/styles/neumorphic.css`
- Updated: `global.css`, `splice-diagram.css` (chrome zone), `main.tsx`, `index.html`
- **`npm run verify` green** after theme pass

**Connection inspector modal (new non-diagram view):**

- Added toolbar action: **Open connection inspector** (read-only modal)
- New overlay shows **left cable list / center connections / right cable list**
- Click center connection highlights matching strands on both sides and auto-focuses cable dropdowns
- Click left/right strand highlights matching center rows and opposite-side strands
- Uses post-import graph model (`ConnectionGraph`) + existing/protect-in-place edge state; no CSV re-inspection UI

Files added:

- `src/features/report/connectionInspectorModel.ts`
- `src/components/ConnectionInspectorOverlay.tsx`
- `src/features/report/connectionInspectorModel.test.ts`
- `src/components/ConnectionInspectorOverlay.test.tsx`

Files updated:

- `src/features/canvas/WorkflowCanvas.tsx`
- `src/components/toolbar/ToolbarIcon.tsx`
- `src/styles/splice-diagram.css`
- `src/App.test.tsx`

**Multi-map embed popover (ArcGIS + Earth + Street View):**

- Added left-toolbar map button that opens a compact tabbed popover.
- ArcGIS tab embeds the uPlan Web App centered on CSV `Location` with marker and tight zoom.
- Earth tab opens a 3D Google Earth URL in a new tab and shows a maps satellite iframe preview.
- Street View tab uses no-key experimental embed URL plus a fallback link to Google Maps panorama.
- CSV `header.location` parsing stays model-safe (`parseSpliceLocation`) and does not affect layout/routing.

Files added:

- `src/features/maps/parseSpliceLocation.ts`
- `src/features/maps/buildArcGisWebAppUrl.ts`
- `src/features/maps/buildGoogleEarthUrl.ts`
- `src/features/maps/buildGoogleMapsUrls.ts`
- `src/features/maps/MapEmbedButton.tsx`
- `src/features/maps/parseSpliceLocation.test.ts`
- `src/features/maps/mapUrlBuilders.test.ts`
- `src/features/maps/MapEmbedButton.test.tsx`

Validation command status this session:

- `npm run test:layout` passed (`114/114`)
- `npm run check` passed
- `npm run test:ci` passed (`56 files`, `450 tests`)
- `npm run build` passed

## User testing (canonical)

Import **Left-*** Bentley CSVs from `docs/reference/examples/`:

- `Left-STATE_OFFICE.csv`
- `Left-SPI-215_I-80.csv`
- `Left-SP-3254.5.csv`

**Not used:** dev `?fixture=` URLs (removed), `public/fixtures/`, “Example #1–#3” for manual QA.

## In scope NOW

- Fix issues user sees on **Left-*** imports
- Per issue: which Left file, simple-term symptom, expected vs actual

## Known issues

1. PNG visual parity incomplete
2. Callout text does not auto-update when toggling existing splices
3. Auto layout jumpiness / cable column drag in manual mode (not reported broken after leg fix)

## Blockers

None for automated tests.

## Canonical docs (read order)

1. [`SCOPE.md`](./SCOPE.md)
2. [`RULE_PRIORITY.md`](./RULE_PRIORITY.md)
3. [`LAYOUT_RULES.md`](./LAYOUT_RULES.md)
4. [`HANDOFF.md`](./HANDOFF.md)
5. [`QUAD_LAYOUT.md`](./QUAD_LAYOUT.md) — **4-side layout** (paused; read before any quad work)
6. [`../reference/examples/README.md`](../reference/examples/README.md) — Left CSV list

## 2026-06-14 manual mode mirror + bend pass

- Reproduced 90-degree bend regression on checkpoint using deterministic guard (`checkpointRepro.test.ts`):
  - cable move created vertical hook reversals (`...y0 -> yMid -> y1...` on same `x`)
  - leg drag created horizontal hook reversals (`...x0 -> xMid -> x1...` on same `y`)
- Fixed by adding endpoint-preserving `removeOrthogonalReversals()` in `legSegments.ts` and applying it in:
  - `shiftVerticalLaneX()`
  - `syncManualVisualCable()` after repin sequence
- Mirror issue root cause from user config export:
  - `graph.cableSides` can be stale relative to live node side/position
  - manual handle and repin logic then mixed stale side with live render side
- Fixes for stale side divergence:
  - `handleCoords.ts`: resolve source/target side from `node.data.side` (live render truth), not persisted side map
  - `syncManualVisualCable.ts`: `visualCableFromCableNode()` now copies `side` from `cableData.side`
  - `repinButtSpliceEdges.ts`: same live-side copy for collapsed tube repin
  - `WorkflowCanvas.tsx`: keep `graph.cableSides` synchronized during manual cable drag and on drag-stop; always persist dragged cable side on stop (even when unchanged vs node)
- Added guards:
  - `src/features/manualAdjust/checkpointRepro.test.ts`
  - `src/features/manualAdjust/handleCoordsSide.test.ts`
  - `src/features/manualAdjust/syncManualVisualCableSide.test.ts`
- Validation:
  - `npm run verify` passed (layout + check + test:ci + build)

## 2026-06-14 mirror follow-up (user config 14:08)

- User supplied `SP-3254.5-config-2026-06-14_140801.sdc.json`; mirror still partially broken with leg disconnect/disappear/color confusion.
- Root cause: side source-of-truth still drifted in some live paths:
  - handle math used live node side, but drag workflow could leave graph side + persisted side out of sync with final rebuilt node side.
- Additional fixes:
  - `WorkflowCanvas.tsx`
    - removed live per-frame `graph.cableSides` mutation in `applyManualCableDrag`
    - after drag-stop rebuild, derive `resolvedSide` from rebuilt cable node (`merged[node.id].data.side`)
    - persist `cableSides[visualId] = resolvedSide` and sync `graph.cableSides` to `resolvedSide`
  - `syncManualVisualCable.ts`
    - `visualCableFromCableNode()` now carries `side: cableData.side ?? vc.side`
  - `repinButtSpliceEdges.ts`
    - same live-side carry for collapsed tube repin path
- Added guard tests:
  - `syncManualVisualCableSide.test.ts`
  - `handleCoordsSide.test.ts`
  - `checkpointRepro.test.ts` (90-degree regression guard)
- Validation:
  - `npm run verify` passed (`59 files`, `460 tests`, build OK)

## 2026-06-14 manual drag endpoint-anchor + import overlap guard (user config 14:16)

- User config `SP-3254.5-config-2026-06-14_141620.sdc.json` repro:
  - manual cable drag still detached some same-side legs
  - imported layout could reopen with two cable nodes effectively on top of each other
- Root cause (detach):
  - for straight same-side legs (`M ... L ...`), `repinLegStart/repinLegEnd` could slide the entire colinear run and move both endpoints during vertical drag
  - this broke handle anchoring on the unmoved cable side
- Fixes:
  - `src/features/manualAdjust/legSegments.ts`
    - updated `repinLegStart` and `repinLegEnd` full-run behavior
    - when the whole leg is one colinear run, keep the opposite endpoint anchored and insert one orthogonal connector corner
    - preserve interior waypoints in that run
  - `src/features/manualAdjust/legSegments.test.ts`
    - updated/added full-run anchor tests for `repinLegStart` + `repinLegEnd`
  - `src/features/manualAdjust/handleCoords.ts`
    - `handleCoordsForConnection` now returns `sourceVisualCableId` / `targetVisualCableId`
  - `src/features/manualAdjust/syncManualVisualCable.ts`
    - pin-side selection now uses the canonical IDs from `handleCoordsForConnection`, not split-edge anchor parsing
- Import overlap guard:
  - `src/features/export/restoreDiagramConfig.ts`
    - normalize imported cable positions when two cable nodes share effectively the same `x/y` (within epsilon), spacing them by `FIBER_ROW_PITCH`
  - `src/features/export/diagramConfig.test.ts`
    - added regression test for de-overlapping imported cable rows
- Validation:
  - `npm run test:layout` passed (`114/114`)
  - `npm run check` passed
  - `npm run test:ci` passed (`59 files`, `462 tests`)
  - `npm run build` passed

## 2026-06-14 moved-leg vertical de-stack fix (auto/manual visible overlap)

- User-reported regression after detach fix:
  - vertical running leg segments could stack on top of each other after cable drag
  - appeared in both manual + auto views (same in-memory edge geometry while toggling)
- Root cause:
  - manual cable drag could create long moved-leg vertical connectors on the same `x`
  - overlapping connector intervals were not separated, so lines collapsed visually
- Fix:
  - `src/features/manualAdjust/syncManualVisualCable.ts`
    - added moved-leg vertical run deconfliction pass after repin/reversal cleanup
    - detects per-connection moved-side vertical runs and assigns non-overlapping `x` columns (`STACK_SEP_X`)
    - applies separation via existing `shiftVerticalLaneX` (endpoint-preserving)
    - keeps split left/right edge patch data synchronized through helper patching
- Added regression:
  - `src/features/manualAdjust/syncManualVisualCableSide.test.ts`
    - `de-stacks moved-leg vertical runs after large cable drag`
    - reproduces SP-3254.5 right-side scenario with explicit persisted positions/sides
- Validation:
  - `npm run test:layout` passed (`114/114`)
  - `npm run check` passed
  - `npm run test:ci` passed (`59 files`, `463 tests`)
  - `npm run build` passed

## 2026-06-14 spacing follow-up (manual mode vertical lanes too close)

- User follow-up:
  - vertical legs no longer stacked, but manual-mode lanes still too close (spacing-rule violation).
- Root cause:
  - de-stack pass used `STACK_SEP_X = 8`, which prevented overlap but violated EDGE-011 minimum lane separation.
- Fix:
  - `src/features/manualAdjust/syncManualVisualCable.ts`
    - set `STACK_SEP_X` to canonical `SPLICE_LANE_SEP` (24px) from `cableLayoutMetrics`.
  - `src/features/manualAdjust/syncManualVisualCableSide.test.ts`
    - expanded de-stack regression to assert overlapping vertical intervals keep `dx >= FIBER_ROW_PITCH - 1`.
- Validation:
  - `npm run test:layout` passed (`114/114`)
  - `npm run check` passed
  - `npm run test:ci` passed (`59 files`, `463 tests`)
  - `npm run build` passed

## 2026-06-14 quad (4-side) layout mode — additive, isolated

> **Canonical doc:** [`QUAD_LAYOUT.md`](./QUAD_LAYOUT.md) (paused MVP — resume from backlog there).

New optional engine: cables on **left / right / top / bottom**, fans pointing inward, orthogonal port-to-dot splice routing. Perpendicular cable pairs meet at an **L corner with 0 interior bends**; opposite pairs meet on a center lane; same-side pairs loop just inside the cables. **Horizontal L/R mode is unchanged** — gated entirely behind `overrides.layoutMode`.

- **Toggle:** toolbar segmented control (Left/right ↔ 4-side), next to Auto/Manual. Per-diagram, persisted (`layoutMode`), survives `.sdc.json` export/import.
- **Engine fork:** `buildReactFlowGraph` early-returns to `buildQuadReactFlowGraph` when `layoutMode === "quad"`. Reuses the slim-cable + `fiberAnchor` + `splicePoint` + precomputed `SpliceEdge` render contract — no frozen router changes.
- **Geometry:** top/bottom cables render the canonical *left* breakout rotated ±90° (CSS) and their handle coords use the **same affine map** (`quadGeometry.ts`), so dots/legs land on the drawn strands.
- **Placement (auto, v1):** dominant pair → left/right; remaining stubs spread top/bottom by connection weight (`quadPlacement.ts`). Cables draggable in auto mode (reroutes live); positions persist.
- **Persistence:** `layoutMode` + `quadCableSides` added to `LayoutOverrides` **without bumping `LAYOUT_OVERRIDE_VERSION`** (back-compat); preserved in `mergeLayoutOverrides`; import de-overlap nudge skipped in quad mode.
- New: `src/features/diagram/quad/{quadTypes,quadGeometry,quadPlacement,quadRouter,buildQuadReactFlowGraph}.ts` + `buildQuadReactFlowGraph.test.ts`.
- Edited additively: `types/splice.ts`, `layoutStorage.ts`, `nodes/types.ts`, `CableNode.tsx`, `FiberAnchorNode.tsx`, `buildReactFlowGraph.ts`, `WorkflowCanvas.tsx`, `ToolbarIcon.tsx`, `restoreDiagramConfig.ts`.
- **Deferred:** per-leg **manual** adjust in quad (auto-mode drag works); placement optimizer quality (v1 heuristic, not crossing-minimal); upright labels on rotated cables.
- Validation: **`npm run verify` green** (layout 114/114, full ci + build).

## 2026-06-14 quad refinement — placement + channel router + color order

Auto-engine-only refinement (manual stays deferred; router is a pure quad module, fully separate from `spliceEdgeRouting`/`manualAdjust`). Horizontal mode untouched.

- **Placement** (`quad/quadPlacement.ts` `assignSides`): each stub now lands on a side **perpendicular to its heaviest neighbor**, never the same side when one neighbor dominates. Fixes the "all-fibers-to-a-top-cable but parked on top" pointless same-side loop. Pins (`quadCableSides`) still win; balanced across candidate sides by load.
- **Channel/lane router** (new `quad/quadChannels.ts` + rewritten `quad/quadRouter.ts`): `createQuadRouter(frontiers, center)` keeps splices out of the dead center. Frontiers = inner edges of the placed handles; `LaneAllocator` packs jogs/loops onto nearest free lanes spaced by `SPLICE_LANE_SEP`. Bends minimized — perpendicular = single L (0 interior), aligned opposite = straight, offset = one jog, same-side = tight inward loop. `buildQuadReactFlowGraph` is two-phase now (materialize handles → frontiers → route).
- **Top-cable color order** (`quad/quadGeometry.ts` `orientTubesForQuadSide`): top cables pre-flip their stack so the +90° render reads blue→orange→green left→right (matching bottom), no text mirroring. Render (`CableNode` `d.tubes`) + handle math (`quadFiberHandleCenter`) share the oriented tubes.
- **Tests:** new `quad/quadRouter.test.ts` (LaneAllocator + router bends/spread); extended `quad/buildQuadReactFlowGraph.test.ts` (placement same-side invariant + top-cable blue-first) on `Left-SPI-215_I-80.csv`.
- Validation: **`npm run verify` green** — layout 114/114, ci 475/475, build OK.

## 2026-06-14 existing toggle — long-press (auto + manual)

Replaced the old click-to-toggle (`onEdgeClick`, removed) which broke in manual mode against the new selection. Works the **same in auto and manual**.

- **Long-press a leg or butt** (~450ms, plain left-press, no modifier) toggles the **whole connection** existing↔normal — both legs flip together (a fiber splice is two split edges; both inherit). Moving during the press cancels (it's a drag). Long-press an existing strand turns it back.
- **Tiered group:** keep holding to ~1100ms to toggle the whole **tube bundle** (`tubeBundleKey`) existing. Fire-on-release; a pink "charge" highlight on the leg(s) shows the tier you're in (single strand at T1, bundle at T2).
- **Architecture:** `useExistingLongPress` (timing + charge + apply), `ExistingToggleContext` (provider in `WorkflowCanvas`), pure helpers in `canvas/edges/existingToggle.ts` (`legConnectionId`, `setConnectionsExisting`, `isConnectionExisting`). `SpliceEdge` renders an invisible wide `.splice-edge__hit` path per shown leg → `beginLongPress`, plus a `.splice-edge__charge` highlight (both scale with zoom since edges live in the viewport). Manual overlay segment + dot buttons also call `beginLongPress` (hold = toggle, move = drag); the dot/segment drag commits nothing on a still press so they coexist.
- **Persistence fixed:** `existingIdsFromEdges` now normalizes split legs to the composite `splice-{connId}` and keeps `butt-{tubeId}`; `buildReactFlowGraph` applies `existing` to fiber connections (with back-compat for old split ids) **and** butt edges (previously butt existing never persisted).
- Tests: `canvas/edges/existingToggle.test.ts`. Validation: **`npm run verify` green** — layout 114/114, ci 503/503, build OK.
- **Pending user QA:** long-press a leg/butt in both modes → whole thing greys; long-press again → back; hold longer → bundle greys; a drag still drags (no accidental toggle).

## 2026-06-14 manual adjust — smart multi-leg selection + accurate hit/highlight

Additive manual-mode features (horizontal L/R). No frozen routing symbols touched; single-leg drag path unchanged (new behavior is modifier-gated).

- **Smart bundle selection:** Shift+grab a leg expands to every leg sharing its `tubeBundleKey` (same source buffer tube → same destination cable, the "shared run") and moves them together this gesture; double-click a leg selects the bundle without moving. Reuses the existing group-drag machinery (`segmentTargets` / `resolveGroupSegmentIndex`) — only the selection source is new. Grabbed side decides which leg moves.
- **Clear selection:** `Escape` or a plain click on empty canvas clears (smart-select is no longer sticky).
- **Accurate hover/click zone:** hit button is now invisible and sized to the **full colinear vertical run** (new pure `verticalRunBounds` in `legSegments.ts`), so the grab area matches the visible leg. The hover/selection highlight is a separate thin bar that traces the real vertical run and scales width with zoom (`segmentHighlightStyle`) — replaces the old fixed 14px CSS box that sat off the line.
- New: `src/features/manualAdjust/smartSelect.ts` (`bundleConnectionIds`) + `smartSelect.test.ts`; `verticalRunBounds` + tests in `legSegments.test.ts`.
- Edited: `useManualAdjustEngine.ts` (Shift branch, `onSegmentDoubleClick`, `onClearSelection`, Escape), `ManualAdjustOverlay.tsx` (invisible hit + highlight elements, hover state, empty-click clear), `WorkflowCanvas.tsx` (overlay props), `splice-diagram.css` (`.manual-adjust-segment-highlight`).

### Follow-up (same session)

- **Selected = hot pink.** Selected leg highlight, fiber-anchor selection ring, and selected fusion-dot now use hot pink (`#ff1493` / `rgba(255,20,147,*)`); **hover stays blue** so hover vs selected read differently.
- **Ctrl/Cmd additive multi-select** (build a selection across bundles): **Ctrl+click** a leg toggles that single leg in/out of the current selection (no drag); **Ctrl+double-click** unions that leg's whole bundle into the selection. Shift (bundle replace + drag), double-click (bundle replace), Escape/empty-click clear all unchanged. New pure `addConnectionsToSelection` in `selection.ts` (+ `selection.test.ts`).
- **Hover also hot pink.** Leg hover highlight uses light hot pink (`rgba(255,20,147,0.4)`), selected stronger (`0.8`); no blue left on legs.
- **Collapsed buffer-tube butt square is shiftable.** The big butt square now has its own dot-style grab handle (square, `BUTT_DOT_HIT` 22px) in the overlay. Dragging it shifts the square **horizontally** via `repinLegEnd`/`repinLegStart` around the new position (legs stay joined), persisted as `dotShiftX` on the `butt-*` key and re-applied on rebuild in the `applyLegOverridesToEdge` butt branch. Works for both bent and straight (same-row) butts — the latter had no center vertical so the old segment handle couldn't grab it. Same selection gestures as dots (Shift / Ctrl / double-click). `onDotPointerDown` + `previewDotDrag` now accept `butt-*` edges (single edge holds both legs). Existing butt center-segment handle kept for back-compat.
- **Fusion dots inert as RF nodes (auto + manual).** `splicePoint` nodes are now created with `draggable: false, selectable: false` (both nodes engine `buildNodesEngineGraph.ts` and quad `buildQuadReactFlowGraph.ts`). Fixes splice dots being click/drag-able in **auto mode** (the overlay is off in auto, so the bare RF node was draggable). Manual dot drag is unaffected — it runs through the overlay buttons + `syncSplicePointNodes` (programmatic reposition), not RF node drag. `SplicePointNode` handles are also `isConnectable={false}` so dragging a dot no longer spawns a React Flow "connect to another node" line (handles only anchor the precomputed leg edges).
- **Fusion-dot selection parity.** Fusion dots now use the same selection gestures as legs — Shift+grab (smart-bundle select + drag), plain grab (single or current selection), **Ctrl+click** (additive single, no drag), double-click / **Ctrl+double-click** (bundle select / additive). Drag is unchanged: **horizontal only**, both legs re-pinned around the moved dot so the leg color-transition point moves with the dot (dot == color transition). Selection is per-connection and **shared between legs and dots** (select via either, drag the other). Dot hover/selected now hot pink. Edits: `onDotPointerDown` (Ctrl/Shift branches), dot `onDoubleClick` reuses `onSegmentDoubleClick`, `.manual-adjust-dot` hover/selected pink.
- Validation: **`npm run verify` green** — layout 114/114, ci 490/490 (63 files), build OK.
- **Pending user QA (Left-* imports):** leg + dot drag still good; Shift-grab a bundled leg/dot shifts the whole tube bundle; Ctrl+click / Ctrl+double-click adds legs/dots/bundles; dots drag horizontally and stay tied to strands; selected + hover show hot pink.
