# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-10 — Label anchor at code column + wider/black labels + shorter fan stub.

## Done

- **Labels at code column** — fan horizontal ends at `labelEndX` (code side); labels right-align into BL/OR column and grow left for long names; max width 128px; black text.
- **Shorter fan horizontal** — `fiberFanStub` 8px; label runway 16px (was 36).
- **Code beside handle (4px)** — `CableNode` absolute layout from `fiberRowLayoutXs`; fiber anchors mirrored to handle X.
- **Dynamic fan fill** — fiber codes + handles in fixed columns; circuit labels right-align to codes; fan strand length varies per label (`fiberRowLayoutXs`).
- **Phase 1 — Handle column** — `fixedHandleOutsetFromStem`; aligned handles per side; labels grow inward; `CableNode` + routing tag width = 0.
- **Phase 2 — Engine + fan-out** — `src/features/manualAdjust/` module; `LAYOUT_OVERRIDE_VERSION` 13 (`fanoutOverrides`, `legOverrides`); buffer-tube stretch on `visualShiftY`; tube tip Y handle (horizontal reach removed).
- **Phase 3 — Leg segments** — `legSegments.ts`, `constraints.ts` (Rules 3–4); DOT-003 48px corner clearance; `ManualAdjustOverlay` segment handles; shift+click + box marquee via `selection.ts`.
- **Phase 4 — Canvas wiring** — `useManualAdjustEngine` in `WorkflowCanvas`; fiber-anchor drag branches; `alignedStemX` in `ManualLayoutContext`; docs updated.
- **Tests** — `cableLabels.test.ts`, `manualAdjust/*.test.ts`, layout contract Examples #1–#3 pass.

## Next

- Visual re-test Example #2: Manual adjust → fan-out vertical drag → segment handles → multi-select group drag.
- `test:ci` CSV path cleanup when touching import tests.

## Commands verified

- `npm run test:layout`
- `npm run check`
- `npm run build`
- `npx vitest run src/features/manualAdjust src/features/diagram/cableLabels.test.ts src/features/canvas/edges/spliceEdgeRouting.test.ts`
