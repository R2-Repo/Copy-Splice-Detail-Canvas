# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-28 — **Import perf build plan**

### Done

| Area | Change |
|------|--------|
| Build plan | [`docs/agent/IMPORT_PERF_PLAN.md`](./IMPORT_PERF_PLAN.md) — P0 worker+UX through P4 pool; topology locks; tiered eval; proxy bundles |

### Next (P0)

1. `layoutSearch.worker.ts` + client bridge
2. Rich `LayoutSearchOverlay` (bar, phases, elapsed)
3. Heuristic paint before search; swap on winner
4. `npm run smoke` + manual QA example-2

---

## Prior session

2026-06-28 — **Fix post-import zoom + drag jank**

### Done

| Area | Change |
|------|--------|
| Optimized import width | Candidate snapshot normalized to `stageLayoutWidthForGraph` before save/render — avoids second full rebuild |
| Width correction | Skipped when `optimizedLayoutCandidate` exists |
| fitView | Instant (`duration: 0`) — no animated viewport reset fighting zoom |
| Stage resize | Reflow column X only — no fitView reset on resize |
| Engine cable drag | RAF-batched like manual drag (`syncNodesEngineDrag`) |

### Root cause

Layout search stores width steps (960/1200/min). Post-import `nodesInitialized` effect saw mismatch vs stage viewport width → second `applyGraph` + animated fitView → zoom appeared broken until other interactions finished.

### Test status

| Gate | Command | Result |
|------|---------|--------|
| smoke | `npm run smoke` | **Pass** |

### Manual QA

1. `npm run dev` → import **Left-SP-3254.5** or example-2
2. Immediately after diagram appears: scroll zoom + controls work (no pan/drag first)
3. Drag cables vertically — responsive
4. Resize window — zoom/pan preserved

### Known

- Layout search still blocks main thread during import (~10–80s by CSV); "Page Unresponsive" possible on heavy files — separate perf track.

### Frozen

See `.cursor/rules/frozen-routing.mdc` — not touched this session.
