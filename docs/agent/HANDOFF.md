# Handoff

## Last session (2026-06-30)

**Quad drag UX + viewport stability**

### Shipped

- **Viewport** — `isInteractingRef` defers fit during drag; one-shot initial fit per diagram load; fit effect decoupled from per-frame `nodes` churn; ResizeObserver skipped while interacting; fit only on side flip commit
- **Live drag perf** — `buildQuadReactFlowGraph` honors `dragSync` + cached splice paths; `syncQuadCandidateDragLayout` for candidate quad path; horizontal candidate drag routes through `syncNodesEngineDragLayout`
- **Top/bottom placement** — `resolveCableDragStopStackX`; T/B drag-stop X/Y snap + clamp; `resolveSideDragCablePosition` keeps drag X on T/B flip; partner positions preserved on quad entry; reoptimize seed includes user drop coords
- **Tests** — `cableLayoutMetrics`, `cableSideDrag`, `buildQuadReactFlowGraph` dragSync cache

### Manual QA

1. Import **Left-SP-3254.5.csv** — drag cables on all sides; no zoom fighting during drag
2. Top/bottom — drag horizontally; position sticks on release + reload
3. Import **example-2** — L↔R flip smooth; viewport stable during same-side Y drag

### Gate

- `npm run smoke` pass

---

## Previous session (2026-06-30)

**4-side cable drag — connected reroute**

- `reoptimizeAfterSideDrag.ts`, async T/B/quad commit, “Adjusting layout…” overlay
- See git log for full detail
