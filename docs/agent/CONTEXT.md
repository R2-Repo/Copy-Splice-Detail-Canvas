# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Baseline

- Branch: `main`
- Verified: **`npm run verify`** green — `test:layout` **114/114**, `test:ci` **441/441**, `tsc` + `build` clean (incl. diagram config export/import).

## Checkpoint (user-approved — 2026-06-13)

**Best manual adjust + leg routing so far.** User confirmed leg drag fixed (no freeze, smooth enough). Treat this commit/state as a **jump-back point** if later manual/routing work regresses.

Key symbols touched this session:

- `legSegments.ts` — `simplifyOrthogonalPath` on `preserveSplice` reconnect
- `useManualAdjustEngine.ts` — absolute drag from pre-drag snapshot; overlay freeze flag
- `ManualAdjustOverlay.tsx` — cached hit-targets during leg drag; handle coord cache

## Current phase

**Quad (4-side) layout mode** — additive toolbar toggle (Left/right ↔ 4-side); fully isolated from the frozen horizontal pipeline. See 2026-06-14 quad section below.

**Diagram config export/import** — standalone `.sdc.json` backup + PDF companion; drop or toolbar import restores full diagram without CSV.

## Diagram config (2026-06-13, verified)

- **Export:** toolbar **Export diagram config** → `{splice}-config.sdc.json` (embedded `SpliceReport` + `LayoutOverrides` + `cableSides`; optional viewport).
- **Import:** toolbar config button or canvas drop → `activateDiagram` (same path as CSV, preserves saved positions/routing overrides).
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
5. [`../reference/examples/README.md`](../reference/examples/README.md) — Left CSV list

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
