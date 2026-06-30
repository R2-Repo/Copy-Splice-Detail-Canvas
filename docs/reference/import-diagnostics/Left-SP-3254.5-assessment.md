# Left-SP-3254.5 import assessment (2026-06-30)

Branch: `cursor/left-sp-3254-import-qa-7a31`

## Verdict: post-fix import was **worse**, not improved

Visual comparison (baseline vs last re-import):

| | Baseline (pre-fix, W1133) | Post-fix (W1400 tie-break) |
|---|---|---|
| Winner | W1133 search-best | W1400 heuristic (forced) |
| Center routing | Crowded but contained | **Vertical chimney** — strands shoot far above cables |
| Soft score (pre handleMisalignment term) | 1940.8 | 6647.8 |

The PR incorrectly labeled W1400 selection as “improved.” For this CSV, **W1133 routes cleaner** in the center zone. Forcing default width via tie-break was a regression.

## What still matches the bad rule library (baseline too)

Both baseline and post-fix still exhibit issues from:

- `bad-missed-straight-horizontal-splice-routing` — **SDC-LAYOUT-001**
- `bad-center-routing-congestion-overlap` — **SDC-ROUTE-001/002/003**

Neither state is merge-ready for “fix everything.”

## Code changes attempted (this branch)

1. Placement-aware cable pair groups
2. 6 DROP pair priority; threshold 4 → 2
3. Pair anchor + lock; locked collision resolve
4. `handleMisalignment` / `nearStraightBends` soft score terms
5. ~~Default W1400 tie-break~~ — **reverted** (caused visual regression)

Unit test `horizontalAlign.sp3254.test.ts` passes (CH 3254 handle gaps ≤ 12px in `computeAlignedLayout`), but **import paint does not visibly improve** — metrics ≠ user-visible routing.

## Next steps (not done)

- Do **not** merge PR #42 as success
- Re-import after tie-break revert; confirm W1133 restores baseline-level routing
- Re-evaluate whether pair-alignment macro Y shifts help or hurt at search-selected width
- Center ATMS chimney needs routing/lane work, not width forcing

Frozen routing (`spliceEdgeRouting.ts`) was not modified.
