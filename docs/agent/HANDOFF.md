# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-09 — Manual adjust mode + buffer-tube handles (Phase 1).

## Done

- **`LayoutOverrides` v12** — `autoAdjustEnabled` (default true), `tubeOverrides` per `vcId|tubeColor`.
- **Toolbar** — “Manual adjust” toggle, “Reset to auto layout”; advisory banner for EDGE-004/012 on touched edges.
- **Cable drag (manual mode)** — position-only during drag; lightweight rebuild on stop (`skipTubeAutoAlign`); resize reflow frozen.
- **Tube handles** — tip (Y) + fan-out reach (X) on `CableNode` when manual mode on; snap guides (`snapGuides.ts`).
- **Geometry** — `visualShiftY` / `stemReachX` in `computeCableBreakout`; locked tubes skip `applyTubeRowAlignmentShifts`.
- **Tests** — `snapGuides.test.ts`, `layoutStorage.test.ts`, locked-tube case in `tubeRowShift.test.ts`.

## Next

- User trial: Example #2 → Manual adjust → drag tube tip/reach; confirm splice paths follow + snap lines.
- Phase 2: per-fiber / multi-fiber row groups.
- Phase 3: splice-routing waypoint handles (`midX` / `jogX`).

## Commands verified

- `npm run test:layout`
- `npm run check`
- `npm run build`
- `npx vitest run src/features/diagram/snapGuides.test.ts src/features/canvas/layoutStorage.test.ts`
