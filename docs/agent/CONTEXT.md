# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-24)

**Grid reconcile EDGE-011 (SPI) — parked.** Public contract = 12 SDC rules in [`splice_detail_canvas_rule_pack/00_Rule_Index.md`](../splice_detail_canvas_rule_pack/00_Rule_Index.md).

- **SDC gate:** `npm run test:layout` → `sdcLayoutContract.test.ts` — **10/12 pass** after tail deconflict (SPI **timeout** @120s; `left-sp-3254.5` **SDC-ROUTE-002**)
- **Legacy routing gate:** `npm run test:routing` → `routingImportContract.test.ts` — **SPI EDGE-011 still red** (~94/96)
- **Full verify:** `npm run verify` — **not green** (routing EDGE-011)

## Done this session (keep)

- **`buildReactFlowGraph`:** `sharedVisualCables` / `routingVisualCables` — same cables for grid routing **and** `layoutEndpointSync` (was root cause: handle entries vs sync mismatch)
- **`buildLayoutRuleContextWithExpansion`:** passes `sharedVisualCables: ruleVisualCables`; returns post-route `visualCables` / `placement` from graph build when available
- **`spliceCenterLanes.ts`:** `laneHasNoGapHorizConflict`; seal/sweep global overlap checks; jog-strand `sourceHorizY` / `targetHorizY` fallback; iterative seal+sweep; tail `deconflictGapHorizontalLanes` after horiz-offset merge
- Precomputed **`routingTargetHorizY` / `routingSourceHorizY`** now attach on full import path (was missing on split legs)

## Blockers (revisit later)

- **SPI legacy EDGE-011:** remaining pair is **not** the original y=652 jog/plain case — overlap is **h/h mid=3000/2952**: plain `routingSourceHorizY: 700` vs jog `routingTargetHorizY: 676` (`Left-SPI-215_I-80.csv`)
- **Horiz-offset order:** `assignSideHorizLaneYs` merge runs **after** first deconflict and can re-stack; tail deconflict helps but does not fully clear SPI
- **Do not** move deconflict entirely after horiz-offsets only — regressed **SDC-ROUTE-002** on `left-sp-3254.5`
- **Tail deconflict:** extra `deconflictGapHorizontalLanes` after seal/sweep regressed **SDC-ROUTE-002** on `left-sp-3254.5`; SPI SDC test **times out** at 120s (reconcile too slow) — consider reverting tail pass or scoping it

## Baseline

- Branch: `main` (local changes uncommitted)
- Pass: `npm run check`, `npm run build`; `npm run test:layout` **10/12** (tail deconflict regressions — see blockers)
- Fail: `npm run test:routing` (SPI + possibly Example #3 legacy EDGE-011), `npm run verify`
- Frozen: `.cursor/rules/frozen-routing.mdc` — no `spliceEdgeRouting.ts` edits without user approval
