# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-23)

**SDC production path** — public contract = 12 rules in [`splice_detail_canvas_rule_pack/00_Rule_Index.md`](../splice_detail_canvas_rule_pack/00_Rule_Index.md).

- **Test gate:** `npm run test:layout` → `sdcLayoutContract.test.ts` (grid engine)
- **Legacy:** `layoutRules.ts` private; `npm run test:layout-legacy` optional
- **Routing:** grid assign + `reconcileGapHorizontalLanesAfterRouting` + horiz occupancy in `gridLaneAssign.ts`

## Blockers

- **Legacy routing contract:** `npm run test:routing` — Example #3 + SPI still fail **EDGE-011** (94/96); SDC contract passes those fixtures
- `npm run verify` not green — `test:ci` includes legacy routing failures + slow-test worker timeouts
- **300N_MAIN:** import rules in `test:layout`; full grid in optional `npm run test:layout-slow`

## Baseline

- Branch: `main`
- Pass: Examples #1–#2, SP, most Left CSVs, `npm run test:sdc`
