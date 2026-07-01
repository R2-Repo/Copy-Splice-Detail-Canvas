# Handoff

## Last session (2026-06-30)

**Top/bottom fiber drag commit (hybrid)**

### Shipped

- **Fiber drag always wired** — no longer gated on legacy manual/auto toggle; `fiberDragEnabled: !!meta` on adjust engine
- **Quad drag-stop fix** — fiber anchor release runs tube-override commit before quad catch-all (no stale `persistLayout` on anchors)
- **Quad repin math** — `quadManualAdjust.ts`: `quadFiberAnchorNodePosition`, `fanShiftDeltaFromFiberDrag` (top: −ΔX, bottom: +ΔX); used in `syncManualVisualCable` + `useManualAdjustEngine`
- **Tests** — `quadManualAdjust.test.ts`, `quadFiberDragCommit.test.ts` (top + bottom repin after tube shift)

### Manual QA

1. Import **example-2** — drag a cable to **top**, wait for layout adjust
2. Drag a fiber handle along the cable — release → stays, legs follow
3. Repeat for **bottom**
4. Reload — tube shift persists

### Gate

- `npm run check` + `npm run build` pass
- `test:fast`: 402 pass; 2 pre-existing Windows path failures in `layoutContractCsvPaths.test.ts`

---

## Previous session (2026-06-30)

**Remove fiber cable locking** — see git log.
