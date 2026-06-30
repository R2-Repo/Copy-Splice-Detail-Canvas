# Left-SP-3254.5 import assessment (2026-06-30)

Branch: `cursor/left-sp-3254-import-qa-7a31`

## Reference library mapping

| Observed issue | Rule example | SDC rules |
|---|---|---|
| Missed straight horizontal for CH 3254 (6 DROP BL/OR ↔ 144 MP SL/WH) | `bad-missed-straight-horizontal-splice-routing` | **SDC-LAYOUT-001**, **SDC-ROUTE-004** |
| Center vertical chimney / crowded lanes (ATMS 72↔144) | `bad-center-routing-congestion-overlap` | **SDC-ROUTE-001**, **SDC-ROUTE-002**, **SDC-ROUTE-003**, **SDC-GRID-001** |

## Fixes applied (this PR)

1. **Placement-aware cable pair groups** — `findCablePairGroups` uses canvas side from import placement, not static `vc.side`.
2. **6 DROP pair priority** — small/drop pairs align before bulk 72↔144 alignment; threshold lowered 4 → 2 connections.
3. **Pair anchor + lock** — best straight-leg anchor; lock both cables after align; collision resolve respects locks (no reflow undo).
4. **Soft score** — `handleMisalignment` (×15) and `nearStraightBends` (×250) in import search scoring.
5. **Default-width tie-break** — when soft scores differ only by `centerWidth` noise, prefer W1400 over min-width W1133.

## Re-import results (post-fix)

Artifacts: `Left-SP-3254.5-{console.log,diagnostics.json,run-summary.json,screenshot.png}`

| Metric | Before fix | After fix |
|---|---|---|
| Winner | W1133 (search-best) | **W1400 (heuristic)** |
| Soft total | 6380.8 | 6647.8 (same heuristic; tie-break picks default width) |
| `handleMisalignment` | — | **296** (cross-side gaps above 12px tolerance) |
| Import time | ~38.7 s (debug) | **6.7 s** |
| Rule rejects (search) | LAYOUT-001×9, ROUTE-003×33 | unchanged counts |

Regression test `horizontalAlign.sp3254.test.ts`: CH 3254 BL/OR ↔ 144 MP SL/WH handle gaps **≤ 12px**; total misalignment **< 350**.

## Visual QA (honest)

**Improved**

- Import selects **default W1400** canvas (more center routing room vs W1133).
- CH 3254 straight-run alignment passes unit test (macro cable Y shift for 6 DROP ↔ 144 MP 258.96).

**Still visible / deferred**

- Center **ATMS** (72-SMF ↔ 144) vertical chimney and lane stacking — not fully resolved; contributes most of remaining `handleMisalignment: 296`.
- `sameSideLoopbacks: 2` in winner soft score.
- Full rule-passing layout; search still rejects many candidates for **SDC-ROUTE-003** (×33) during beam search.

Frozen routing (`spliceEdgeRouting.ts`) was **not** modified.

## Screenshots

- Viewport: `docs/reference/rule_examples/Screenshots from Cursor Agent/Left-SP-3254.5-import-viewport-2026-06-30.png`
- Fit (same capture after auto fit-view): `Left-SP-3254.5-import-2026-06-30.png`

## Manual re-run

```bash
npm run dev   # with .env.local debug flags optional
node scripts/import-diagnostics-qa.mjs docs/reference/examples/Left-SP-3254.5.csv \
  --out-dir docs/reference/import-diagnostics --basename Left-SP-3254.5
```
