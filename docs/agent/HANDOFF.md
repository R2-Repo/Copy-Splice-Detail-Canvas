# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-28 — **Recoverable import fallback**

### Done

| Area | Change |
|------|--------|
| `pickBestRecoverableCandidate.ts` | Weighted rule-penalty ranking; heuristic in same pool as finalists |
| `WorkflowCanvas.tsx` | Fast heuristic paint unchanged; final layout from recoverable pick |
| `seedCandidateGeneration.ts` | More route-aware seeds (dominant T/B, bundle groups, width variants, stack reversals) |
| `importDiagnostics.ts` | `recoverableSelection` block + console tables (vs heuristic, rejected) |
| Tests | `pickBestRecoverableCandidate.test.ts` (4 tests) |

### Selection order (no passing finalist)

1. Fewest hard failures
2. Lowest weighted penalty (SDC-LAYOUT-002 high, SDC-ROUTE-001 high, SDC-ROUTE-002/003 medium)
3. Fewer route-zone / layout failures
4. Better soft score → deterministic id tie-break

### Enable diagnostics

```
VITE_DEBUG_IMPORT_OPTIMIZER=1
```

Import Left-STATE_OFFICE.csv → console shows `recoverable selection` with beat-heuristic reason.

### Gates

- `npm run smoke` — pass (350 fast tests + build)

### Manual QA (dev)

Import Left-STATE_OFFICE with optimizer on; confirm final layout is a top/bottom finalist (not blind heuristic) when finalists score better. Check `window.__SDC_LAST_IMPORT_DIAGNOSTICS__.recoverableSelection`.

### Frozen

`spliceEdgeRouting.ts` drag hooks — not touched.

---

## Prior session

2026-06-28 — Import optimizer diagnostics. See git history.
