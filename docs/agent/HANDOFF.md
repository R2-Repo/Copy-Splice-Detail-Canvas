# Handoff

## Last session (2026-06-30)

**4-side cable drag — top/bottom bugs fixed**

### Root cause

- `detectSideFromEdgeProximity` always included the **current** side. A left-column cable sits ~24px from the left edge, so `left` beat `top`/`bottom` on every vertical drag — bottom flip never triggered; dragging down saved a huge Y and broke fit/zoom.

### Shipped

- **`cableSideDrag.ts`** — exclude `currentSide` from proximity candidates; `[side-drag]` logs via `debugSideDrag.ts`
- **`WorkflowCanvas.tsx`** — improved `sideDragBounds` (measured heights, true centerY); clamp same-side L/R Y to cable envelope; `requestDiagramFitView` on side-flip commit + quad mode promotion during preview
- **`.env.example`** — `VITE_DEBUG_SIDE_DRAG=1`
- **Tests** — left-column top/bottom detection; bottom flip stays on canvas; rank-1 fixture test skipped when file absent

### Debug logging

Set in `.env.local`:

```bash
VITE_DEBUG_SIDE_DRAG=1
```

Console shows `[side-drag]` for detect, bounds, preview/commit, and drag-stop.

### Manual QA

1. Import **Left-SP-3254.5.csv** — drag bottom left cable **straight down** → bottom flip, diagram stays in view
2. Reload — drag top cable **straight up** → top flip, auto fitView
3. Import **example-2** — L↔R and promote/demote T/B still work

### Gate

- `npm run smoke` pass

---

## Previous session (2026-06-30)

**4-side cable drag and flip (post-import manual adjust)**

### Shipped

- **`cableSideDrag.ts`** — `canUseCandidateSideDrag`; manual mode skips lock; clear `quadCableSides` when demoted to horizontal
- **Bugfix (bottom→top)** — on side flip, drop stale saved cable position from rebuild; `resolveSideDragCablePosition` uses auto-placed Y/X on cross-axis
- **`WorkflowCanvas.tsx`** — unified candidate side-drag path; live flip preview; top/bottom Y snap on drag-stop
- **Tests** — promotion/demotion, preview no-lock, manual no-lock
