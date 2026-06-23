# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-22 — **SP import horizontal overlap (EDGE-011) — incomplete; user ending session.**

### Problem (user screenshot)

Fresh **SP** import (`?fixture=sp` / `left-sp-3254.5`): **GR/BR** from lower **6 DROP** stack on same horizontal grid line as **SL/WH** from upper **72-SMF** (light blue box). User suspects **red box** center congestion leaves those strands no lane — wants dynamic spread so every strand has a home.

### Root cause (confirmed in code/tests)

- Default routing is **grid** (`ROUTING_ENGINE = "grid"`), not legacy composite edges.
- EDGE-011 overlap: same-Y horizontals with overlapping X range; `isNestedHandleRowHorizOverlap` was too permissive (exempted when `midX` differed ≥24px on long gap tracks) — **tightened** in `splicePathGeometry.ts`.
- Y-track offsets (`sourceHorizY` / `targetHorizY`) often **never applied**: `assignSideHorizLanesWithGapBends` strips them, deconflict hits bend budget, `assignSideHorizLaneYs` exhausts attempts or offsets rejected by `laneBendsWithinBudget`.

### Changes in tree (uncommitted / session work — verify with `git diff`)

| File | Change |
|------|--------|
| `splicePathGeometry.ts` | Tighter `isNestedHandleRowHorizOverlap`; `maxSpliceBendsForLane` +1 when Y-track used |
| `spliceCenterLanes.ts` | `deconflictGapHorizontalLanes`, longer horiz lane search (256), bend-aware `assignSideHorizLaneYs`, debug log H2 for unresolved pairs |
| `gridLaneAssign.ts` | `snapLaneMidXAvoidOverlap`; debug logs for GR/BR/OR (H1) |
| `layoutExpansion.ts` | Wider feasibility iterations (may be insufficient for SPI) |
| `spHorizontalOverlap.test.ts` | Rendered-path audit for SP watch fibers (grid engine) |
| `debugSessionLog.ts` | Temp instrumentation — **remove after browser proof** |

### Test status (last run this session)

- **PASS:** `left-sp-3254.5` EDGE-011 in `routingImportContract.test.ts` (grid)
- **PASS:** `spHorizontalOverlap.test.ts`
- **FAIL:** `example-3` EDGE-011 (grid + layout contract)
- **FAIL:** `Left-SPI-215_I-80` EDGE-011 (`h/h mid=2472/2688`)
- **FAIL:** Some Example #2/#3 EDGE-004 when Y-offsets forced without bend gate

**Browser vs tests:** User still saw overlap on import; tests claim SP clean — possible jsdom/canvas label width gap or stale dev build. **Browser soak required.**

### Debug instrumentation (session `dafd70`)

- Log file: `.cursor/debug-dafd70.log` (NDJSON via ingest)
- `WorkflowCanvas.tsx` — GR/BR/SL/WH lane snapshot on import/reroute
- `gridLaneAssign.ts` — grid assign for watch fibers
- `spliceCenterLanes.ts` — unresolved gap horiz pairs after deconflict

### Recommended next steps

1. **Browser first:** restart dev server, import SP, read `.cursor/debug-dafd70.log` — confirm H2 unresolved pairs and whether `sourceHorizY`/`targetHorizY` are set on GR/BR edges.
2. If tests pass but browser fails: compare handle X/Y from live import vs `buildReactFlowGraph` grid path (canvas label widths in `cableLabels.ts`).
3. If overlap persists with no Y offsets: consider **grid horizontal occupancy** in `assignGridLanes` (like `verticalOccupied` but for H segments), or **midX spread** in congested center zones (user’s red-box hypothesis) — **frozen routing** in `spliceEdgeRouting.ts` re-exports; edit `spliceCenterLanes.ts` / `gridLaneAssign.ts` with minimal diff.
4. Do **not** remove instrumentation until user confirms fix.
5. Run gate before ship: `npm run test:layout`, `npm run test:ci`, `npm run build`.

### Frozen routing

See `.cursor/rules/frozen-routing.mdc` — avoid editing re-exports in `spliceEdgeRouting.ts` without user approval.

### Verify (not run clean end-of-session)

- `npm run verify` — **may fail** on example-3 / SPI EDGE-011
