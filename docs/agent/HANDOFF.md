# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-28 — **Import perf fast-path + T1 pruning**

### Done

| Area | Change |
|------|--------|
| `WorkflowCanvas.tsx` | Heuristic T2 check → immediate paint when feasible; background worker with `searchProfile: background` |
| `candidatePruners.ts` | T1 gate: `top-bottom-no-relief`, quad span, adjacent-pair predictors |
| `candidateGeometry.ts` | Width-invariant geometry key + rule validation cache |
| `layoutSearch.ts` | Geometry memo at T0; `searchCapsForProfile` |
| `importSearchConfig.ts` | `BACKGROUND_SEARCH_CAPS`, 10s/15s perf budget helpers |
| `importDiagnostics.ts` | `fastPath`, `performanceBudget` blocks |
| `import-diagnostics-qa.mjs` | `fastPath` / `performanceBudget` in summary; optional `SDC_ENFORCE_PERF_BUDGET=1` |
| Tests | `candidateGeometry`, `candidatePruners`, `seedCandidateGeneration`, `importSearchConfig` |

### Fast-path (production)

1. Paint heuristic
2. Full T2 eval on heuristic
3. If feasible + not debug → dismiss overlay, finish diagnostics session after background search
4. Background search may upgrade layout if strictly better score

### T1 pruning

- **Do not** prune no-relief top/bottom at T0 (breaks beam ranking on relief fixture)
- **Do** prune at T1 before `buildReactFlowGraph` / proxy route

### Gates

- `npm run smoke` — pass (358 fast tests + build)

### Manual QA

- Import Left-STATE_OFFICE **without** debug flags → canvas live in ~1–2s
- With `VITE_DEBUG_IMPORT_OPTIMIZER=1` → full diagnostics baseline unchanged

### Frozen

`spliceEdgeRouting.ts` — not touched.
