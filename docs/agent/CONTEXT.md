# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-27)

**Phase 5 rule hardening done.** `test:rules` re-enabled for search-produced layouts; `SDC-SCORE-001` active. Fast gate remains `npm run smoke`.

## Active build track

- **Routing-first auto layout — Phase 5 done** — `SDC-SCORE-001` in rule pack + engine; `sdcLayoutContract.test.ts` uses `layoutSearch` + `evaluateLayoutCandidate`; search candidate snapshots in `src/testHelpers/fixtures/searchCandidates/`.
- Phase 4 import wire (`layoutSearchAsync`, `buildCanvasFromCandidate`, `optimizedLayoutCandidate`) on main.
- Smart manual movement + SDC-UX-001 lock-on-commit (Phase 6 side drag not started).

## Testing policy

- **Default:** `npm run smoke` (check + `test:fast` + build) — few minutes
- **Layout hardening:** `npm run test:rules` — search-produced SDC contract + suspended suite (~tens of minutes)
- **Manual QA:** import example-2 after visual/routing changes
- KI-003 (Left-SPI-215) still skipped unless `RUN_KNOWN_ISSUES=1` — see [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)

## Session gate

```bash
npm run smoke          # every session
npm run test:rules     # user-scheduled hardening (Phase 5 gate)
```

## Baseline

- Branch: `cursor/routing-first-phase5-rule-hardening-d051`
- Frozen: `.cursor/rules/frozen-routing.mdc`
