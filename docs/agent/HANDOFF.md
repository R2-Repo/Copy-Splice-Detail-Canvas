# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-28 — **Import optimizer diagnostics**

### Done

| Area | Change |
|------|--------|
| `importDiagnostics.ts` | Dev-only phase timings, tier counts, T/B promotion, rule rejects, finalist/winner summaries |
| Flags | `VITE_DEBUG_IMPORT_OPTIMIZER=1` (master) + granular timing/candidates/rules/top-bottom flags |
| Instrumentation | `WorkflowCanvas` import path, `layoutSearch` beam, `tieredEvaluate`, `evaluateCandidate` |
| Window API | `__SDC_LAST_IMPORT_DIAGNOSTICS__`, `__SDC_IMPORT_DIAGNOSTICS_HISTORY__`, `__SDC_PRINT_LAST_IMPORT_DIAGNOSTICS__()` |
| Tests | `importDiagnostics.test.ts` (6 tests) |

### Enable

Add to `.env.local`:

```
VITE_DEBUG_IMPORT_OPTIMIZER=1
```

Import a CSV → one collapsed `[import optimizer]` console group per import. Inspect `window.__SDC_LAST_IMPORT_DIAGNOSTICS__`.

### Gates

- `npm run smoke` — pass (345 fast tests + build)

### Manual QA (dev)

Import example-2 with flag on; confirm grouped summary shows phase timings, T0/T1/T2 counts, T/B stats, rule rejects, winner/fallback.

### Frozen

`spliceEdgeRouting.ts` drag hooks — not touched.

---

## Prior session

2026-06-28 — Import optimizer (Phases 1–6). See git history.
