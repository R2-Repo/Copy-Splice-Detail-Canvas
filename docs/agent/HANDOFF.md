# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-28 — **Routing-first layout Phase 6 (manual cable side drag)**

### Done

| Area | Change |
|------|--------|
| Side drag engine | `src/features/manualAdjust/cableSideDrag.ts` — detect L/R/T/B zone, `moveCableInCandidate`, `applyCableSideDragCommit` via `buildCanvasFromCandidate` |
| Canvas UX | `WorkflowCanvas.tsx` — routing-first drag path when `optimizedLayoutCandidate` present; live preview + commit; lock-on-commit; warning banner for blocked locks |
| SDC-UX-001 | `ux001.ts` — warn when `cableSides` proxy disagrees with `quadCableSides` |
| Tests | `cableSideDrag.test.ts` — L↔R flip, top move → quad mode, locked cable block, stack order |

### Test status

| Gate | Command | Result |
|------|---------|--------|
| smoke | `npm run smoke` | **Pass** |
| layout | `npm run test:layout` | **Pass** 12/12 |

### Manual QA

1. `npm run dev` → import **example-2**
2. Drag a cable to the **opposite side** (L↔R) — geometry mirrors, strands reroute
3. Drag a cable toward **top or bottom** — quad layout activates, cable rotates inward
4. Export `.sdc.json` → reimport — side assignment + `optimizedLayoutCandidate` restored
5. Optional: **Left-SP-3254.5** stacked-cable side drag
6. With locked fan-out / lane segments: confirm **warning banner** (no silent unlock)

### Next

1. Remove `USE_LEGACY_IMPORT_LAYOUT=1` fallback after full `test:rules` green
2. KI-003 (Left-SPI-215) — opt-in hardening when user requests

### Frozen

- `spliceEdgeRouting.ts` — no edits (side drag calls frozen APIs only)
