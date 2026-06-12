# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-12 — DOT-003 fusion dot corner clearance fix.

## Done

- **DOT-003 measurement** — path-walking distance along left/right legs; removed &lt;96px span exemption and tube-bundle layout skip.
- **Proactive placement** — `resolveFusionDotPosition` nudges dot 48px from `midX`/bend anchors; clearance-aware `reconcileBufferTubeDotColumns`; `buildSplicePath` post-check slides dot when needed.
- **Manual drag** — live `clampVerticalLaneDeltaForCornerClearance` during vertical lane drag; removed debug `fetch` logs.
- **Tests** — `constraints.test.ts` short-span regression; `spliceEdgeRouting.test.ts` DOT-003 build/column cases.

## Next

- Manual QA: `?fixture=example-2` → confirm fusion dots are visibly separated from corners on import; Manual → drag vertical leg near dot (live stop + commit rejection).
- Run full verify when npm available: `npm run test:layout`, `npm run check`, `npm run test:ci`, `npm run build`.

## Commands verified

```bash
npm run check          # pass
npm run build          # pass
npm run test:layout    # 112/114 pass — Example #2 EDGE-010 only (pre-existing)
npx vitest run src/features/manualAdjust/constraints.test.ts  # pass
```

Pre-existing failures unchanged: Example #2 `EDGE-010`, `packMidXLanes` / `assignSpliceRoutingLanes` unit tests in `spliceEdgeRouting.test.ts`.
