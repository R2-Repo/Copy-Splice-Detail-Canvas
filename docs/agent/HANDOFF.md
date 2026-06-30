# Handoff

## Last session (2026-06-30)

**4-side cable drag — connected reroute**

### Root cause

Post-import side drag only rebuilt one cable locally (`buildCanvasFromCandidate`) without co-optimizing partner sides, stacks, or width — unlike import search. Promoting one L/R cable to T/B detached fibers.

### Shipped

- **`reoptimizeAfterSideDrag.ts`** — constrained background search with `seedCandidate` + user `lockedCableSides` (~2–5s budget)
- **`layoutSearch.ts`** — accepts `seedCandidate` and merges user locks into topology constraints
- **`cableSideDrag.ts`** — `needsReoptimizeAfterSideDrag`, `lockedSidesForSideDrag`, `prepareSideDragSeedCandidate`, `finalCandidate` commit path
- **`WorkflowCanvas.tsx`** — skip side-flip live preview; async re-optimize on drag-stop for T/B/quad; “Adjusting layout…” overlay + fallback banner
- **Tests** — `reoptimizeAfterSideDrag.test.ts` (Left-SP top flip, edge count + splice pairs)
- **`ROUTING_FIRST_LAYOUT.md`** — side drag re-search documented

### Manual QA

1. Import **Left-SP-3254.5.csv** — drag cable straight up → top: fibers stay connected through center splices
2. Reload — layout persists
3. Drag bottom cable straight down → bottom: connected
4. Import **example-2** — L↔R fast flip; promote/demote T/B with brief overlay

### Debug

```bash
VITE_DEBUG_SIDE_DRAG=1
```

### Gate

- `npm run smoke` pass

---

## Previous session (2026-06-30)

**4-side cable drag — top/bottom detection plumbing**

- Exclude current side from proximity detection; frozen drag bounds; stale position clear on quad entry
