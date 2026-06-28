# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-28)

**Next build:** [`IMPORT_OPTIMIZER_BUILD.md`](./IMPORT_OPTIMIZER_BUILD.md) — four-side scoring, beam search, finalist fallback, proxy T1 optimization (single-agent one-pass).

**Import perf P0–P3 shipped** — worker + topology locks + tiered eval + memo/budgets/skip-duplicate-T2. See [`IMPORT_PERF_PLAN.md`](./IMPORT_PERF_PLAN.md), [`IMPORT_FINISH_PLAN.md`](./IMPORT_FINISH_PLAN.md).

**SPI-215 (KI-003):** import completes via heuristic fallback when search times out (~4 min); full optimizer still slow on 68-pair fixture.

## Active build track

- **Import perf P3** — score memo, `importTimeBudgetMs`, adaptive `maxRounds`, `winnerEvaluation`, worker deadline + graceful timeout
- **Import perf P1+P2** — topology + tiered eval
- **Import perf P0** — worker + overlay + heuristic-first paint
- Routing-first auto layout — Phase 6 gated
- Legacy `USE_LEGACY_IMPORT_LAYOUT=1` fallback still present

## Testing policy

- **Default:** `npm run smoke`
- **Manual QA:** all 3 Left CSVs — `?fixture=sp`, `state`, `spi`
- KI-003 (Left-SPI-215) — timeout fallback documented; full feasibility opt-in only

## Perf baseline (P3, worker path / main-thread probe)

| CSV | evals | wall | feasible |
|-----|-------|------|----------|
| example-2 | ~42 | ~1.6s | yes |
| Left-SP-3254.5 | ~55 | ~5s | yes |
| Left-STATE_OFFICE | ~3 | ~2 min | yes (browser) |
| Left-SPI-215_I-80 | — | ~4 min | timeout → heuristic |

## Branch

- `cursor/import-perf-p3-finish-5032`
