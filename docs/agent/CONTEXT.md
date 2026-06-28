# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-28)

**Import perf P1 next** — P0 shipped (worker + rich overlay + heuristic-first paint). See [`IMPORT_PERF_PLAN.md`](./IMPORT_PERF_PLAN.md): topology locks, tiered eval, memo/budgets.

**Post-import zoom/pan** — done (stage width one-pass, RAF cable drag).

## Active build track

- **Import perf P0** — `layoutSearch.worker.ts` + client; heartbeat progress; overlay bar/phases; heuristic paint before search.
- **Routing-first auto layout — Phase 6 gated** — horizontal drag restored; quad side-move on drag-stop near canvas edge only.
- Legacy `USE_LEGACY_IMPORT_LAYOUT=1` fallback still present.

## Testing policy

- **Default:** `npm run smoke` (check + `test:fast` + build) — few minutes
- **Manual QA:** import example-2 / Left-SP-3254.5 — overlay animates during search; no page-unresponsive dialog; zoom + cable Y-drag after import
- KI-003 (Left-SPI-215) still skipped unless `RUN_KNOWN_ISSUES=1`

## Session gate

```bash
npm run smoke          # every session
```

## Baseline

- Branch: `cursor/import-perf-p0-worker-c09d`
- Frozen: `.cursor/rules/frozen-routing.mdc`
