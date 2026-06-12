# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-12 — New machine dev setup (Node + npm install + `start-dev.bat`).

## Done

- **New PC setup** — Node.js LTS installed via winget; `npm install`; `npm run check` + `npm run build` pass; `start-dev.bat` at repo root (start/restart dev server on port 5173).
- **Vertical leg ↔ drag fix** — `setPathStart`/`setPathEnd` pin path terminus to handles; nested same-side lanes use `shiftVerticalLane`; overlay uses live handle coords; commit persists preview (no re-apply jump); graph rebuild resolves handle coords for overrides.
- **Leg segment drag detach fix** — preview pins left leg to source handle, right leg to target handle; `connectLegPathsAtSplice` keeps fusion dot junction; splice point node moves live during drag.
- **Manual mode auto-off** — skip `resolveSameSideNodeCollisions` when `autoAdjustEnabled: false`; leg commit applies overrides in-place (no full graph reroute).
- **Leg segment drag** — vertical center-lane segments only (↔); horizontal legs not draggable; Y via fan-out; pointer move/up wired; `shiftVerticalLane` keeps corners connected.
- **Fan-out drag** — live preview, ±96px, single-tube sheath moves with tube; snap on release only.
- **Manual adjust leg overlay** — panel-local coords; invisible hit strips on draggable segments only.
- **Shorter fan horizontal** — `fiberFanStub` 8px; label runway 16px (was 36).
- **Code beside handle (4px)** — `CableNode` absolute layout from `fiberRowLayoutXs`; fiber anchors mirrored to handle X.
- **Dynamic fan fill** — fiber codes + handles in fixed columns; circuit labels right-align to codes; fan strand length varies per label (`fiberRowLayoutXs`).
- **Phase 1 — Handle column** — `fixedHandleOutsetFromStem`; aligned handles per side; labels grow inward; `CableNode` + routing tag width = 0.
- **Phase 2 — Engine + fan-out** — `src/features/manualAdjust/` module; `LAYOUT_OVERRIDE_VERSION` 13 (`fanoutOverrides`, `legOverrides`); buffer-tube stretch on `visualShiftY`; tube tip Y handle (horizontal reach removed).
- **Phase 3 — Leg segments** — `legSegments.ts`, `constraints.ts` (Rules 3–4); DOT-003 48px corner clearance; `ManualAdjustOverlay` segment handles; shift+click + box marquee via `selection.ts`.
- **Phase 4 — Canvas wiring** — `useManualAdjustEngine` in `WorkflowCanvas`; fiber-anchor drag branches; `alignedStemX` in `ManualLayoutContext`; docs updated.
- **Tests** — `cableLabels.test.ts`, `manualAdjust/*.test.ts`, layout contract Examples #1–#3 pass.

## Next

- **Group drag** (#6) — multi-select rows, drag together with constraints.
- Leg override persistence spot-check on refresh.

## Commands verified

- `npm run test:layout`
- `npm run check`
- `npm run build`
- `npx vitest run src/features/manualAdjust src/features/diagram/cableLabels.test.ts src/features/canvas/edges/spliceEdgeRouting.test.ts`
