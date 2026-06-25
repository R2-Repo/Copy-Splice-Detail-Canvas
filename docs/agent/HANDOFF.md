# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-25 — **EDGE-011 forward plan — paused (test infra uncommitted; reconcile not landed)**

### Done (uncommitted)

| Area | Change |
|------|--------|
| Test tiers | `package.json`: `test:layout:fast`, `test:edge011`, `verify` = fast + slow + check + test:ci + build |
| SDC split | SPI moved to `sdcLayoutContractSlow.test.ts` @ 600s; removed from fast `sdcLayoutContract.test.ts` |
| EDGE-011 test | `gridReconcileEdge011.test.ts`: SPI `beforeAll` + `skipFeasibility: true` on SPI only (not example-3) |

### Reconcile (attempted, **reverted to HEAD**)

- Partial fixes in `spliceCenterLanes.ts` were tried (`resolveJogPlainGapHorizOverlaps`, seal/sweep offset bases, `buildGapHorizDeconflictTrial` offset base).
- **`gapHorizDeconflictAdjustOrder` jog-first** caused **hang** (~10+ min imports); do not re-add without scoping.
- Partial reconcile **regressed example-3** (`findSpliceOverlapPair` non-null after ~430s feasibility import).
- **`layoutRules` sideSpans in `findSpliceOverlapPair`** reverted — also suspected regression on example-3.
- Working tree: **`spliceCenterLanes.ts` = HEAD** (no reconcile diff).

### Test status (last run this session)

| Tier | Command | Result |
|------|---------|--------|
| SPI EDGE-011 | `npm run test:edge011` | **Red** — h/h **mid=1584/1848** (~75–80s with `skipFeasibility`) |
| example-3 | `-t "example-3: findSpliceOverlapPair"` | **Red** with partial reconcile; **not re-verified on HEAD** after revert (run takes ~7 min full feasibility) |
| layout:fast | `npm run test:layout:fast` | **Not finished** this session (example-3 job blocked terminal) |

### Failing pair (canonical, `skipFeasibility`)

- **Fixture:** `Left-SPI-215_I-80.csv`
- **Pair:** jog `mid=1584, jogX=1392` vs plain `mid=1848, sourceHorizY=1260` — **jog/plain**, not jog/jog
- **Root cause (confirmed):** after horiz-offset merge, trials must step from **current** `sourceHorizY`/`targetHorizY`, not endpoint Y; when plain already offset, try **jog** trunk first

### Next (resume forward plan)

1. **Commit test infra only** (4 files; exclude `.dev-server.pid`)
2. Re-apply **minimal** reconcile: seal/sweep offset bases + fresh `lanes.get` in jog fallback + `resolveJogPlainGapHorizOverlaps` after tail deconflict — **without** `gapHorizDeconflictAdjustOrder` jog-first (hang)
3. Tier 0: `npm run check` + `-t "example-3: findSpliceOverlapPair"` — must stay green before Tier 2
4. Tier 1: `npm run test:layout:fast` → Tier 2: `npm run test:edge011` → Tier 3: routing `left-spi-215` → Tier 4: `npm run verify`
5. **Do not:** parallel vitest/SPI imports; `skipFeasibility` on example-3; full `gridReconcileEdge011.test.ts` while iterating

### Frozen

- `spliceEdgeRouting.ts` — no edits without user approval
