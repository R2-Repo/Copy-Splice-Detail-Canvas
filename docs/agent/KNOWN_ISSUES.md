# Known layout issues (deferred hardening)

> Re-evaluated **2026-06-27 (Phase 5)** with search-produced layouts. **KI-001, KI-002, KI-004 resolved** — example-3 and Left-SP-3254.5 pass `test:layout` on search winners. Remaining skips: KI-003 (Left-SPI-215). See [`TESTING.md`](./TESTING.md).

| ID | Fixture | Symptom | Rule | Track | Reproduce |
|----|---------|---------|------|-------|-----------|
| KI-003 | Left-SPI-215_I-80 | Full feasibility overlap (~21 min) | EDGE-011 | Slow hardening | `RUN_KNOWN_ISSUES=1 npm run test:layout-slow` |

## Phase 5 resolution (2026-06-27)

| Former ID | Fixture | Phase 5 outcome |
|-----------|---------|-----------------|
| ~~KI-001~~ | example-3 | **Fixed** — search-produced layout passes grid rules |
| ~~KI-002~~ | left-sp-3254.5 | **Fixed** — search-produced layout passes SDC-ROUTE-002 |
| ~~KI-004~~ | example-3 (SDC contract) | **Fixed** — same root cause as KI-001 |

Default `npm run test:layout`: **12/12 pass** (example-1..3, left-sp-3254.5, import-only 300n_main, SDC-SCORE-001 assertions).

## Details

### KI-003 — Left-SPI-215 full feasibility

- **Symptom:** SPI overlap reconcile may fail when full feasibility runs (not skipped).
- **Last verified:** 2026-06-27
- **Owner track:** Slow hardening
- **Notes:** `test:edge011` with `skipFeasibility: true` is green; full run is opt-in. Skipped in `sdcLayoutContractSlow.test.ts` unless `RUN_KNOWN_ISSUES=1`.

### KI-005 — centerRouter SPI oracle (slow)

- **Symptom:** `centerRouter.test.ts` Left-SPI-215 cases exceed 120s timeout in full CI.
- **Last verified:** 2026-06-25
- **Owner track:** Slow hardening — excluded from `test:ci`; run via `npm run test:hardening`

## Opt-in full check

```bash
RUN_KNOWN_ISSUES=1 npm run test:layout-slow   # Left-SPI-215 grid contract
RUN_KNOWN_ISSUES=1 npm run test:edge011
npm run test:hardening                         # full suspended suite
```

## When to update

- **Add** an entry when a red test is accepted as deferred (not when hiding a new regression).
- **Remove** an entry when the issue is fixed and the skip is deleted from [`knownLayoutIssues.ts`](../../src/testHelpers/knownLayoutIssues.ts).
