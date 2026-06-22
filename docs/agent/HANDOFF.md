# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-22 — **Stabilization Phase 7 complete — verification gate green.**

### What landed

- **Dev fixtures:** `?fixture=example-1|2|3|sp|state|spi` auto-imports CSV on dev load (`devFixtureMeta.ts`, `devFixtures.ts` fetch, `useDevFixtureAutoLoad`). Browser copies in `public/qa-fixtures/`; tests use `devFixturesNode.ts` (fs).
- **Automated gate:** `phase7Verification.test.ts` — Examples #1–#3 + D4 left refs import, build, print-fit viewport.
- **Docs:** `docs/reference/examples/README.md` — fixture URLs + manual browser checklist.
- **Script:** `npm run test:phase7`.
- **Stabilization plan Phases 0–7:** complete in code/tests.

### Manual browser sign-off (optional)

Run checklist on `?fixture=example-2` and `?fixture=sp` if not already done this release.

### Verification

- `npm run verify` — green (633 tests)
- `npm run test:phase7` — gate tests
