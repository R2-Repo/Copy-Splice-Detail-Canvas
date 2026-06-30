# Composite Layout Soft Score

Rule ID: SDC-SCORE-001
Related Rules: SDC-GRID-001, SDC-LAYOUT-001, SDC-ROUTE-001, SDC-ROUTE-002, SDC-ROUTE-003, SDC-ROUTE-004
Reference Example Images/Docs: [`docs/agent/ROUTING_FIRST_LAYOUT.md`](../docs/agent/ROUTING_FIRST_LAYOUT.md)
Rule Type: Optimization (Tier 2 — soft score only)
Status: Active

## Purpose

Define how the routing-first auto layout engine scores feasible candidates and picks a winner among layouts that pass all hard SDC rules.

**SDC-SCORE-001 is Tier 2 only.** Hard gates remain SDC-DATA, SDC-ORDER, SDC-LAYOUT, SDC-GRID, and SDC-ROUTE rules including [SDC-ROUTE-004] (≤2 corners per splice). Any `severity: "fail"` from those rules rejects a candidate before scoring.

## When this rule runs

1. After CSV import, `layoutSearch()` evaluates many `LayoutCandidate` placements.
2. Each candidate is routed on the grid and checked with `runRules()`.
3. Feasible candidates receive a composite soft score from `scoreLayoutEvaluation()` / `layoutScorer.ts`.
4. Search keeps the lowest score; ties break deterministically (see below).

## Bend preference ladder (SDC-ROUTE-004 soft companion)

Hard cap stays on [SDC-ROUTE-004]. Among feasible layouts, minimize bend count per strand:

| Corners | Soft treatment |
|---------|----------------|
| **0** — straight horizontal or vertical | Best (no bend penalty) |
| **1** | Small per-strand penalty |
| **2** | Larger per-strand penalty (still legal) |

**Top/bottom credit (1-corner only):** when a strand uses exactly one corner and at least one cable endpoint is on the **top** or **bottom** edge, apply extra soft-score credit. Zero-corner vertical (top↔bottom) and zero-corner horizontal (left↔right) straights are treated equally — both are best.

**Placement relief:** when top/bottom sides reduce crossings or same-side loopbacks versus a left/right-only baseline, apply `topBottomRelief` (negative penalty). Top/bottom placement is **not** penalized for merely using extra canvas sides.

## Soft score terms (minimize total)

Implementation: `DEFAULT_SOFT_SCORE_WEIGHTS` in `src/features/layoutSearch/layoutScorer.ts`.

| Term | Weight | Source |
|------|--------|--------|
| Strand crossings | 1000 | Grid route segment intersection count |
| One-corner bend | 30 | Per strand with exactly 1 corner |
| Two-corner bend | 100 | Per strand at the 2-corner budget |
| Single-bend top/bottom credit | 20 | Subtracted per qualifying 1-corner T/B strand |
| Same-side loopback paths | 500 | Connection endpoints on the same canvas side |
| Top/bottom placement relief | dynamic | Crossing/loopback delta vs L/R-only baseline |
| Center width used | 1 | Grid routing zone width — prefer compact |
| Side height imbalance | 10 | Max − min populated-side stack height |
| Path length | 0.1 | Sum of orthogonal grid segment lengths |

**Composite formula (T2 `computeSoftScore`):**

```
total = crossings×1000
      + bendOneCorner×(strands with 1 corner)
      + bendTwoCorner×(strands with 2 corners)
      − singleBendTopBottomCredit×(qualifying 1-corner T/B strands)
      + sameSideLoopbacks×500
      + topBottomRelief
      + centerWidth×1 + heightImbalance×10 + pathLength×0.1
```

`sidesUsed` is recorded in diagnostics only — it is **not** added to the total.

## Tie-break order (deterministic)

When two candidates have equal soft score:

1. **Lexicographic stable candidate id** (`candidateStableId`).

Search uses `compareCandidates()` with this order.

## Infeasible candidates

Any hard-rule `severity: "fail"` sets `feasible: false` and score `Number.MAX_SAFE_INTEGER`. Such candidates are never selected as the search winner.

## Rule runner behavior

`SDC-SCORE-001` in `runRules()` reports the computed soft score as informational output when `optimizedLayoutCandidate` and grid routes are present. It never emits `severity: "fail"`.

## Related docs

- [`splice_detail_canvas_rule_pack/00_Rule_Index.md`](../splice_detail_canvas_rule_pack/00_Rule_Index.md) — conflict priority
- [`docs/agent/ROUTING_FIRST_LAYOUT.md`](../docs/agent/ROUTING_FIRST_LAYOUT.md) — search pipeline
