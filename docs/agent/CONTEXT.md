# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Stabilization complete (2026-06-22)

Phases 0–7 done. Grid default, hybrid locks, override migration, live drag lanes, fixture QA gate.

- **Fixture QA:** `?fixture=example-1|2|3|sp|state|spi` (dev auto-import)
- **Automated gate:** `npm run test:phase7` + `npm run verify`
- **D4 left refs:** SP / STATE / SPI — automated + prior browser sign-off

## Baseline

- Branch: `main`
- `npm run test:layout` 124/124; full verify green (633 tests)

## Blockers

- None for stabilization backlog. Deferred items in `STABILIZATION_PLAN.md` (PDF export, quad, etc.) need owner approval.

## Canonical docs

1. [`STABILIZATION_PLAN.md`](./STABILIZATION_PLAN.md)
2. [`docs/reference/examples/README.md`](../reference/examples/README.md) — fixture URLs + manual checklist
3. [`HANDOFF.md`](./HANDOFF.md)
