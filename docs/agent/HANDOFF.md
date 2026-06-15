# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-15 — **Horizontal leg alignment — manual snap fix (EDGE-013 follow-up).**

### Session changes (manual snap)

- User feedback: manual fine-tuning had no real snap, lines kept jogging ~1px off, took too long to get flat. Root cause: a fiber leg only renders truly flat when both handle rows share a Y, so snapping must move the handle/row — but manual cable drag-stop persisted the raw Y (EDGE-013 layout pass only runs on import/auto, not manual).
- **Cable drag-release snap:** manual `onNodeDragStop` now snaps the cable Y to flatten the most cross-side legs vs partner cables' live Ys (`nearStraightCableShift` in `horizontalAlign.ts`). Release near-flat → locks. Auto branch + frozen lane logic untouched; live-drag snap intentionally avoided (would fight React Flow).
- **Tip drag:** wider tolerance + richer targets — `snapTipTargets` now includes every fiber-handle Y (`collectGlobalFiberHandleSnapTargets`), not just tube centers, so strand legs snap too.
- **Tolerance:** new `MANUAL_ALIGN_SNAP_TOLERANCE` (≈18px) for interactive snaps; import/auto stays 12px (`HORIZONTAL_ALIGN_TOLERANCE`).
- **Files:** `horizontalAlign.ts`, `snapGuides.ts`, `WorkflowCanvas.tsx`, `TubeManualHandles.tsx`. Docs: `LAYOUT_RULES.md`, `CONTEXT.md`.
- **Validation:** `check`, `build`, `test:layout` 117/117, frozen `spliceEdgeRouting` (56) + `layoutRules` (117) + `horizontalAlign` (8) green.

### Prior session — Import file hint animation

2026-06-15 — **Import file hint animation (empty-canvas cue).**

### Session changes (import hint)

- **Import file** button gets `toolbar-icon-btn--hint` when no diagram loaded: icon color + soft orange glow pulse (2s cycle). Hover pauses animation; after import switches to existing primary orange style.
- **Files:** `CsvImportButton.tsx`, `splice-diagram.css`.

### Prior session — Print bug-fix pass

- **App restored after dialog (root fix):** `usePrintDiagram` never passed event listeners, so `afterprint` cleanup never ran and `printing-diagram` (hides toolbar/controls) stuck. `runDiagramPrint` now defaults `addEventListener`/`removeEventListener` to `window`.
- **No duplicate / two-page print:** screen-prep `.workflow-canvas { position: fixed }` leaked into print (fixed repeats per page). Now `@media screen` only; print uses static flex centering, `display:contents` wrappers, `html/body { overflow:hidden }`.
- **No browser header/footer:** `@page margin: 0` (was 0.5in). Stage stays 16×10 in → centers on 17×11 page with 0.5in white border, one page.
- **Callouts no longer cut off:** print dispatches `beforeprint` first → callouts lock to fixed `userScale` (no zoom compensation) → flush → measure bounds from fresh `getNodes()` → fit. Bounds were previously measured at on-screen zoom, so callouts resized after fit and spilled off-page.
- **Files:** `printDiagram.ts`, `usePrintDiagram.ts`, `splice-diagram.css`. Tests: `printDiagram.test.ts` (10).
- **Pending user QA:** Print → one tabloid-landscape sheet, full diagram + all callouts centered/on-page, anchor lines visible, no header/footer; close dialog → toolbar + controls return.

### Prior session — OS circuit label + fusion dot size bump

- **Circuit tags** on fan-out strand rows: `.cable-node__circuit` `0.5rem` → `0.55rem` (`splice-diagram.css`).
- **Layout measurement** kept in sync: `CIRCUIT_TAG_FONT` + SSR width estimate in `cableLabels.ts`.
- **Fusion splice dot** slightly larger: `SpliceEdge` SVG `r` 4→4.5; `.splice-point-node__dot` 6→7px; `SPLICE_DOT` 8→9.
- **Golden:** `routingCharacterization.json` — two `routingMidX` values for `Left-SP-3254.5.csv` (wider label column).

### Verification

- `npm run test:layout` green (117/117).
- `npm run check` + `npm run build` green.
- `printDiagram.test.ts` green (10/10).
- `test:ci` still has 1 pre-existing failure (`parseBentleyCsv.test.ts` poleNumber) — unrelated.
