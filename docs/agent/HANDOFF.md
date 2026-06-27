# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-27 — **Routing-first layout Phase 1 (evaluation harness)**

### Done

| Area | Change |
|------|--------|
| `src/features/layoutSearch/layoutCandidate.ts` | `LayoutCandidate` type (L/R sides, stack order, width, expansion); placement helpers; heuristic baseline seed |
| `src/features/layoutSearch/evaluateCandidate.ts` | `evaluateLayoutCandidate` — placement → React Flow → `routeAllOnGrid` → `runRules` → score |
| `src/features/layoutSearch/layoutScorer.ts` | Tier-1 fail gate + Tier-2 soft score (SDC-SCORE-001 weights); deterministic tie-breaks |
| `src/features/layoutSearch/layoutSearch.test.ts` | 3-cable synthetic fixture; brute-force beats heuristic; determinism |
| `buildReactFlowGraph.ts` | `fixedPlacement` build option for search harness (no import wire) |

### Test status

| Gate | Command | Result |
|------|---------|--------|
| smoke | `npm run smoke` | **Pass** |
| fast | `npm run test:fast` | Pass (includes `layoutSearch.test.ts`) |
| rules | `npm run test:rules` | **Suspended** — user must ask |

### Manual QA

No user-visible change — import path unchanged. No manual QA required this session.

### Next

1. **Phase 2** [`ROUTING_FIRST_LAYOUT.md`](./ROUTING_FIRST_LAYOUT.md): `layoutSearch.ts` guided search loop (1000–5000 rounds)
2. Continue smart manual adjust + MVP features
3. Phase 4 wires import; Phase 5 re-enables `test:rules`

### Frozen

- `spliceEdgeRouting.ts` — no edits without user approval
