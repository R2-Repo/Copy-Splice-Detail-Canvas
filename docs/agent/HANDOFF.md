# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-28 — **Import optimizer (Phases 1–6)**

### Done

| Area | Change |
|------|--------|
| Beam search | Default `layoutSearchMode=beam`; `legacy-guided` fallback; caps T0≤300, T1≤40, T2≤8 |
| Four-side scoring | `layoutScorer.ts` — candidate-side loopbacks, `fourSideCrossingEstimate`, `topBottomBenefit`, quad `heightImbalance` |
| Routing intent | `routingIntent.ts` + `seedCandidateGeneration.ts` (8–30 deterministic seeds) |
| Finalists | `pickBestPassingFinalist`; WorkflowCanvas uses first rule-passing finalist before heuristic |
| Proxy T1 | `buildProxyEvalContext` + `proxyRouteKey` memo in `tieredEvaluate.ts` |
| Rule tiers | `runRulesForTier` + optional `tiers` on SDC rules |
| Diagnostics | `LayoutSearchDiagnostics`, overlay dev row, `VITE_FORCE_LAYOUT_SIDES` |
| Tests | `layoutScorer.test.ts`, `seedCandidateGeneration.test.ts`, `importSearchConfig.test.ts`, beam tests in `layoutSearch.test.ts` |

### Gates

- `npm run smoke` — pass (339 fast tests + build)
- `npm run test:rules` — not run (suspended unless user asks)

### Manual QA (dev)

Import via toolbar or fixtures:

| Fixture | URL |
|---------|-----|
| example-2 | default |
| Left-SP-3254.5 | `?fixture=sp` |
| Left-STATE_OFFICE | `?fixture=state` |
| Left-SPI-215 | `?fixture=spi` |

Checklist: heuristic paints fast → overlay shows tier progress → final layout or fallback banner → dev diagnostics show T/B candidacy when applicable.

### Frozen

`spliceEdgeRouting.ts` drag hooks — not touched.

---

## Prior session

2026-06-28 — Import optimizer build plan (docs only). See git history.
