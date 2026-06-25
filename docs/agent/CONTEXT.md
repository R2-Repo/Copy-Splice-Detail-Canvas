# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-25)

**EDGE-011 forward plan — paused.** Test tier split is **uncommitted**; reconcile code is **HEAD** (session attempts reverted).

## Uncommitted (keep)

- `package.json` — `test:layout:fast`, `test:edge011`, updated `verify`
- `sdcLayoutContract.test.ts` / `sdcLayoutContractSlow.test.ts` — SPI @ 600s in slow suite
- `gridReconcileEdge011.test.ts` — SPI `beforeAll`, `skipFeasibility` on SPI only

## Blockers

- **SPI EDGE-011:** h/h **mid=1584/1848** (jog/plain; plain `sourceHorizY:1260`) — `npm run test:edge011` still red on HEAD reconcile
- **Reconcile hang:** `gapHorizDeconflictAdjustOrder` jog-first + offset trials → ~10+ min import; avoid until scoped
- **example-3:** partial reconcile regressed overlap check; re-verify on HEAD before landing reconcile
- **`npm run verify`:** not green

## Validation tiers (strict order, one SPI job)

0. `npm run check` + `npx vitest run …gridReconcileEdge011.test.ts -t "example-3: findSpliceOverlapPair" --pool=forks --maxWorkers=1`
1. `npm run test:layout:fast`
2. `npm run test:edge011`
3. `npx vitest run …routingImportContract.test.ts -t "left-spi-215" --testTimeout=600000`
4. `npm run verify`

## Baseline

- Branch: `main` (local changes uncommitted)
- Frozen: `.cursor/rules/frozen-routing.mdc`
