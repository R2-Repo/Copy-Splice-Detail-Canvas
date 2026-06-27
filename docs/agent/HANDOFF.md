# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-27 — **Routing-first layout Phase 3 (four-side candidates)**

### Done

| Area | Change |
|------|--------|
| `layoutCandidate.ts` | `LayoutSide` = L/R/T/B; `stackOrder` for all sides; `deriveLayoutMode`, quad side helpers, stable id with T/B stacks |
| `evaluateCandidate.ts` | Quad path via `buildQuadReactFlowGraph` adapters + `routeAllOnGrid` with `layoutMode: "quad"` when top/bottom populated |
| `layoutSearch.ts` | 4^n enumeration, flip to any side, stack swaps on all sides, deterministic mutations |
| `quadPlacement.ts` | `stackOrderByCableKey` for search stack order on quad edges |
| `layoutSearch.test.ts` | Fast gate: synthetic 3-cable + Left-SP-3254.5 smoke (~45s for file) |
| `layoutSearch.slow.test.ts` | Opt-in: Left-SPI-215_I-80 + Example #2 (excluded from smoke) |

### Test status

| Gate | Command | Result |
|------|---------|--------|
| smoke | `npm run smoke` | **Pass** (~2.5 min) |
| fast | `npm run test:fast` | Pass (includes Phase 3 fast `layoutSearch` tests) |
| slow CSV search | `npx vitest run src/features/layoutSearch/layoutSearch.slow.test.ts` | Opt-in — minutes per file |
| rules | `npm run test:rules` | **Suspended** — user must ask |

### Manual QA

No user-visible change — import path unchanged. No manual QA required this session.

### Next

1. **Phase 4** [`ROUTING_FIRST_LAYOUT.md`](./ROUTING_FIRST_LAYOUT.md): wire `layoutSearch` into import + unified render
2. Phase 5 re-enables `test:rules`

### Frozen

- `spliceEdgeRouting.ts` — no edits without user approval
