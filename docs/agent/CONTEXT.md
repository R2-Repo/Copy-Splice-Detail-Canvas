# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-22)

**SP import — GR/BR horizontal stack on SL/WH (EDGE-011).** User ending session; handoff in [`HANDOFF.md`](./HANDOFF.md).

- **Symptom:** On fresh SP import, lower **6 DROP** green/brown horizontals overlap upper **72-SMF** slate/white (same grid line). Center nest (red box) may be starving lanes.
- **Engine:** Grid routing default (`routingEngine: "grid"`).
- **Tests:** `left-sp-3254.5` + `spHorizontalOverlap.test.ts` pass; browser overlap **not confirmed fixed**. Example #3 + SPI still fail EDGE-011 in contract tests.
- **In flight:** Y-track deconflict in `spliceCenterLanes.ts`; debug logs session `dafd70` — do not remove until verified.

## Baseline

- Branch: `main`
- Prior: cable flip / `resolveSpliceSourceTarget` (see git log)

## Blockers

- Browser QA on `?fixture=sp` — user saw no improvement; tests disagree.
- SPI / Example #3 EDGE-011 still failing in `npm run test:layout`.

## Canonical docs

1. [`SIMPLE_TERMS.md`](./SIMPLE_TERMS.md) — user vocabulary (corner, tube bundle, center nest)
2. [`LAYOUT_RULES.md`](./LAYOUT_RULES.md) — EDGE-011, EDGE-004
3. [`HANDOFF.md`](./HANDOFF.md)
