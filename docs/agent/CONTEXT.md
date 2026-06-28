# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-28)

**Recoverable import fallback** — heuristic is a normal candidate in the final pool; `pickBestRecoverableCandidate` ranks by rule failures + weighted penalties when no finalist fully passes.

**Import optimizer shipped** — beam search (default), four-side scoring, routing intent + seed generation, finalist fallback, proxy T1, tiered `runRulesForTier`. See [`IMPORT_OPTIMIZER_BUILD.md`](./IMPORT_OPTIMIZER_BUILD.md).

**SPI-215 (KI-003):** import completes via best-recoverable selection (not blind heuristic) when search finds failed finalists; beam + caps improve smaller fixtures.

## Active build track

- **Import optimizer** — recoverable fallback + route-aware seed expansion
- Import perf P0–P3 — worker, tiered eval, memo/budgets (baseline)
- Routing-first auto layout — Phase 6 gated
- Legacy `VITE_USE_LEGACY_IMPORT_LAYOUT=1` + `legacy-guided` search mode still available

## Search modes

| Env | Behavior |
|-----|----------|
| default / `VITE_LAYOUT_SEARCH_MODE=beam` | Structured beam → T0/T1/T2 finalists |
| `VITE_LAYOUT_SEARCH_MODE=legacy-guided` | Hill-climb restarts (pre-optimizer) |
| `VITE_FORCE_LAYOUT_SIDES=Cable:top,...` | Debug seed injection |
| `VITE_DEBUG_LAYOUT_SEARCH=1` | `console.table(finalistSummaries)` |
| `VITE_DEBUG_IMPORT_OPTIMIZER=1` | Full import diagnostics (master flag) |
| `VITE_DEBUG_IMPORT_TIMING=1` | Phase + eval sub-phase timings |
| `VITE_DEBUG_IMPORT_CANDIDATES=1` | Candidate tier/score detail |
| `VITE_DEBUG_IMPORT_RULES=1` | Rule rejection counts |
| `VITE_DEBUG_IMPORT_TOP_BOTTOM=1` | Top/bottom promotion summary |

## Testing policy

- **Default:** `npm run smoke`
- **Manual QA:** example-2 + `?fixture=sp`, `state`, `spi` — **Left-STATE_OFFICE** for recoverable fallback
- KI-003 full feasibility — opt-in only (`test:rules`)

## Branch

- `cursor/recoverable-import-layout-7df9`
