# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-27 — **Routing-first layout Phase 2 (search engine)**

### Done

| Area | Change |
|------|--------|
| `src/features/layoutSearch/layoutSearch.ts` | `layoutSearch(graph, config?)` — round-0 heuristic seed, brute-force (≤8 cables, capped enumeration), guided hill-climb (flip side, swap stack, width/expansion bumps), random restarts, plateau early exit, `timeBudgetMs` best-so-far |
| `src/features/layoutSearch/layoutSearch.test.ts` | Phase 2: Example #2 beats/matches heuristic crossings; determinism (same seed → same `best.id`) |
| Determinism | FNV-1a seed from `reportStorageKey`; Mulberry32 RNG; `compareCandidates` tie-breaks |

### Test status

| Gate | Command | Result |
|------|---------|--------|
| smoke | `npm run smoke` | **Pass** |
| fast | `npm run test:fast` | Pass (includes Phase 2 `layoutSearch` tests) |
| rules | `npm run test:rules` | **Suspended** — user must ask |

### Manual QA

No user-visible change — import path unchanged. No manual QA required this session.

### Next

1. **Phase 3** [`ROUTING_FIRST_LAYOUT.md`](./ROUTING_FIRST_LAYOUT.md): four-side candidates (L/R/T/B) + quad evaluate path
2. Phase 4 wires `layoutSearch` into import
3. Phase 5 re-enables `test:rules`

### Frozen

- `spliceEdgeRouting.ts` — no edits without user approval
