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
