# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-27 — **Routing-first layout Phase 4 (import wire + unified render)**

### Done

| Area | Change |
|------|--------|
| `candidateToGraph.ts` | `buildCanvasFromCandidate` — unified L/R + quad render from `LayoutCandidate` |
| `layoutSearch.ts` | `layoutSearchAsync`, progress/cancel hooks (`onProgress`, `shouldCancel`) |
| `WorkflowCanvas.tsx` | CSV import runs optimizer; overlay “Optimizing layout…”; cancel → best-so-far |
| `LayoutOverrides` | `optimizedLayoutCandidate` snapshot persisted (localStorage + `.sdc.json`) |
| `restoreDiagramConfig.ts` | One-shot `verifyLayoutCandidate` on restore |
| Toolbar | Layout mode toggle hidden unless `VITE_SHOW_LAYOUT_MODE_TOGGLE=1` |
| Legacy escape | `USE_LEGACY_IMPORT_LAYOUT=1` → old `resolveFeasibleImportLayout` path |

### Test status

| Gate | Command | Result |
|------|---------|--------|
| smoke | `npm run smoke` | **Pass** (~38s) |
| fast | `npm run test:fast` | Pass (includes `buildCanvasFromCandidate` smoke test) |
| slow CSV search | `npx vitest run src/features/layoutSearch/layoutSearch.slow.test.ts` | Opt-in |
| rules | `npm run test:rules` | **Suspended** |

### Manual QA (required)

1. `npm run dev`
2. Import **example-2** — confirm “Optimizing layout…” overlay, then diagram renders without layout mode picker
3. Import **Left-SP-3254.5.csv**, **Left-SPI-215_I-80.csv** if time permits
4. Export `.sdc.json` → re-import → layout restores from candidate
5. Cancel mid-search → best-so-far applies
6. Optional: `USE_LEGACY_IMPORT_LAYOUT=1 npm run dev` — heuristic import still works

### Next

1. **Phase 5** — re-enable `test:rules` + `SDC-SCORE-001` rule pack
2. Phase 6 manual side drag

### Frozen

- `spliceEdgeRouting.ts` — no edits without user approval
