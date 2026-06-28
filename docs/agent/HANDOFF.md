# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-28 — **Fix center fiber strands missing on CSV import**

### Done

| Area | Change |
|------|--------|
| Root cause | React Flow skipped splice leg edges until `fiberAnchor` / `splicePoint` handle bounds existed; import only remeasured cable nodes |
| Engine nodes | `buildNodesEngineGraph.ts` — static `width`/`height`/`handles` on anchor + splice-point nodes via `spliceEngineNodeHandles.ts` |
| Remeasure | `updateSpliceRoutingNodeInternals.ts`; `WorkflowCanvas` + anchor node components call `updateNodeInternals` after layout |
| Tests | `spliceEngineNodeHandles.test.ts` |

### Test status

| Gate | Command | Result |
|------|---------|--------|
| smoke | `npm run smoke` | **Pass** |

### Manual QA

1. `npm run dev` → import **example-2** (or `?fixture=example-2`)
2. After layout search finishes (~1 min): **6 center splice rows** visible (colored legs + fusion dots between cables)
3. Optional: **Left-SP-3254.5** — same check on a reference CSV

### Next

1. Phase 6 side-drag QA if not already signed off
2. Remove `USE_LEGACY_IMPORT_LAYOUT=1` fallback after full `test:rules` green

### Frozen

See `.cursor/rules/frozen-routing.mdc` — not touched this session.
