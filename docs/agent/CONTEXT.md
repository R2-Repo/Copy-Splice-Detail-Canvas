# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-28)

**Phase 6 manual cable side drag done.** Routing-first imports support L/R/T/B side drag with local reroute + lock-on-commit (SDC-UX-001).

## Active build track

- **Routing-first auto layout — Phase 6 done** — `cableSideDrag.ts` + WorkflowCanvas wiring; updates `optimizedLayoutCandidate` on commit; no `layoutSearch` on drag.
- Phase 5 rule hardening (`SDC-SCORE-001`, `test:layout`) on main.
- Legacy `USE_LEGACY_IMPORT_LAYOUT=1` fallback still present.

## Testing policy

- **Default:** `npm run smoke` (check + `test:fast` + build) — few minutes
- **Layout hardening:** `npm run test:layout` — search-produced SDC contract
- **Manual QA:** import example-2, drag cable to opposite side / top/bottom, export/reimport `.sdc.json`
- KI-003 (Left-SPI-215) still skipped unless `RUN_KNOWN_ISSUES=1`

## Session gate

```bash
npm run smoke          # every session
npm run test:layout    # after side-drag contract changes
```

## Baseline

- Branch: `cursor/routing-first-phase6-side-drag-55bb`
- Frozen: `.cursor/rules/frozen-routing.mdc`
