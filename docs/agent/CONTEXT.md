# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-28)

**Import perf P1+P2 shipped** — topology locks + tiered eval (T0/T1/T2). See [`IMPORT_PERF_PLAN.md`](./IMPORT_PERF_PLAN.md). P3 (memo/budgets) next.

**Post-import zoom/pan** — done (stage width one-pass, RAF cable drag).

## Active build track

- **Import perf P1+P2** — `topology/` module; constrained search; `tieredEvaluate.ts`; worker unchanged (calls `layoutSearch`).
- **Import perf P0** — worker + overlay + heuristic-first paint (merged direction).
- **Routing-first auto layout — Phase 6 gated** — horizontal drag restored; quad side-move on drag-stop near canvas edge only.
- Legacy `USE_LEGACY_IMPORT_LAYOUT=1` fallback still present.

## Testing policy

- **Default:** `npm run smoke` (check + `test:fast` + build) — few minutes
- **Manual QA:** import example-2 / Left-SP-3254.5 — overlay animates; feasible layout; zoom + cable Y-drag after import
- KI-003 (Left-SPI-215) still skipped unless `RUN_KNOWN_ISSUES=1`

## Session gate

```bash
npm run smoke          # every session
```

## Perf baseline (P1+P2, 2026-06-28, worker path)

| CSV | Before (P0) | After (P1+P2) |
|-----|---------------|---------------|
| example-2 | ~60s · ~2000 evals | **4.3s · 43 evals** |
| Left-SP-3254.5 | ~51s · ~2000 evals | **5.4s · 55 evals** |

## Branch

- `cursor/import-perf-p1-p2-topology-3acd`
- Frozen: `.cursor/rules/frozen-routing.mdc`
