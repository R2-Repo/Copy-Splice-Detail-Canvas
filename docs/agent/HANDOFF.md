# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-28 — **Import perf P1 (topology locks) + P2 (tiered eval)**

### Done

| Area | Change |
|------|--------|
| P1 topology | `src/features/layoutSearch/topology/` — `analyzeTopology`, `deriveConstraints`, `topologyTypes` |
| P1 search | `layoutSearch.ts` — lock-aware `enumerateCandidates`, `pickMutation`, `randomCandidate`; seed applies locks |
| P2 tiers | `tieredEvaluate.ts` — T0 stack-crossing, T1 proxy route, T2 full; promotion skips T2 when not competitive |
| Fixtures | `fixtures/syntheticGraphs.ts` — hub + two-144 synthetic graphs |
| Tests | `analyzeTopology.test.ts`, P1/P2 gates in `layoutSearch.test.ts` |
| Probe | `importPerfProbe.test.ts` (opt-in, not in smoke) |

### Perf (main-thread probe, maxRounds=2000)

| CSV | Before (P0 HANDOFF) | After |
|-----|---------------------|-------|
| example-2 | ~60s · ~2000 evals | **4.3s · 43 evals** |
| Left-SP-3254.5 | ~51s · ~2000 evals | **5.4s · 55 evals** |

### Test status

| Gate | Command | Result |
|------|---------|--------|
| smoke | `npm run smoke` | **Pass** |
| topology | `analyzeTopology.test.ts` | **Pass** |

### Manual QA (browser VM)

| CSV | Result |
|-----|--------|
| example-2 (`?fixture=example-2`) | Full diagram — 4 cables, splices, corners |
| Left-SP-3254.5 (Import) | Full diagram — GR/VI/BL routing, feasible overlay |

Screenshots: `/opt/cursor/artifacts/screenshots/example-2-p1p2-final.png`, `left-sp-3254-p1p2-final.png`

### Next (P3)

1. Candidate memo (`candidateStableId → score`)
2. Wire `timeBudgetMs` on import
3. Skip duplicate final T2 when worker already evaluated winner

### Frozen

Not touched — tiered/proxy paths call frozen routing APIs only.

---

## Prior session

2026-06-28 — **Import perf P0 (worker + progress UX)**

Worker, overlay, heuristic-first paint. See git history.
