# Known layout issues (deferred hardening)

> Canonical log of **documented weak points**. Default test runs skip these; run `npm run test:hardening` to re-check.

| ID | Fixture | Symptom | Rule | Track | Reproduce |
|----|---------|---------|------|-------|-----------|
| KI-001 | example-3 | `findSpliceOverlapPair` non-null after grid import | EDGE-011 / overlap | Layout hardening | `npm run test:edge011:example3` |
| KI-002 | left-sp-3254.5 | SDC-ROUTE-002 nesting/lane fail on grid import | SDC-ROUTE-002 | Layout hardening | `npm run test:layout` |
| KI-003 | Left-SPI-215_I-80 | Full feasibility overlap (~21 min) | EDGE-011 | Slow hardening | `npm run test:edge011` |
| KI-004 | example-3 (SDC contract) | Grid rule failures tied to KI-001 | SDC-ROUTE-* | Same as KI-001 | `npm run test:layout` |

## Details

### KI-001 — example-3 splice overlap

- **Symptom:** At least one splice pair still has horizontal lead overlap after grid reconcile.
- **Last verified:** 2026-06-25
- **Owner track:** Layout hardening (not blocking feature work)
- **Notes:** Same underlying issue as KI-004; full feasibility can take ~21 min.

### KI-002 — left-sp-3254.5 route nesting

- **Symptom:** SDC-ROUTE-002 fails on Left-SP-3254.5 import.
- **Last verified:** 2026-06-25 (pre-existing on HEAD)
- **Owner track:** Layout hardening

### KI-003 — Left-SPI-215 full feasibility

- **Symptom:** SPI overlap reconcile may fail when full feasibility runs (not skipped).
- **Last verified:** 2026-06-25
- **Owner track:** Slow hardening
- **Notes:** `test:edge011` with `skipFeasibility: true` is green; full run is opt-in.

### KI-004 — example-3 SDC grid rules

- **Symptom:** Grid routing rule failures on example-3 in `sdcLayoutContract.test.ts`.
- **Last verified:** 2026-06-25
- **Owner track:** Same root cause as KI-001

### KI-005 — centerRouter SPI oracle (slow)

- **Symptom:** `centerRouter.test.ts` Left-SPI-215 cases exceed 120s timeout in full CI.
- **Last verified:** 2026-06-25
- **Owner track:** Slow hardening — excluded from `test:ci`; run via `npm run test:hardening`

## Opt-in full check

Set `RUN_KNOWN_ISSUES=1` to run skipped tests in CI/local:

```bash
RUN_KNOWN_ISSUES=1 npm run test:layout
RUN_KNOWN_ISSUES=1 npm run test:edge011
```

Or run the full hardening suite:

```bash
npm run test:hardening
```

## When to update

- **Add** an entry when a red test is accepted as deferred (not when hiding a new regression).
- **Remove** an entry when the issue is fixed and the skip is deleted from [`knownLayoutIssues.ts`](../../src/testHelpers/knownLayoutIssues.ts).
