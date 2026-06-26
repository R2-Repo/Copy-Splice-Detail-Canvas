# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-25)

**EDGE-011 SPI reconcile landed (uncommitted).** `npm run test:edge011` **green** (~70s). Full `verify` not run this session.

## Uncommitted

- `package.json` — `test:edge011` / `test:edge011:example3` with `--pool=forks --maxWorkers=1 --hookTimeout=600000`
- `spliceCenterLanes.ts` — reconcile: offset trials, jog/plain resolve, shared-row gap-bend cap (jog/plain + jog/jog)

## Blockers

- **`npm run verify`:** not run; Tier 3 routing `left-spi-215` not run
- **Pre-existing on HEAD:** `gridReconcileEdge011` example-3 overlap red (~21 min feasibility); `test:layout:fast` **SDC-ROUTE-002** on `left-sp-3254.5` red — unchanged by SPI fix

## Validation tiers

0. `npm run check`
1. `npm run test:layout:fast`
2. `npm run test:edge011` — **green**
3. `npm run test:edge011:example3` — red on HEAD (same pair as layout contract example-3)
4. `npx vitest run …routingImportContract.test.ts -t "left-spi-215" --testTimeout=600000`
5. `npm run verify`

## Baseline

- Branch: `main` (local changes uncommitted)
- Frozen: `.cursor/rules/frozen-routing.mdc`
