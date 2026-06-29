# Composite Layout Soft Score

Rule ID: SDC-SCORE-001
Related Rules: SDC-GRID-001, SDC-LAYOUT-001, SDC-ROUTE-001, SDC-ROUTE-002, SDC-ROUTE-003
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

## Soft score terms (minimize total)

Implementation: `DEFAULT_SOFT_SCORE_WEIGHTS` in `src/features/layoutSearch/layoutScorer.ts`.

| Term | Weight | Source |
|------|--------|--------|
| Strand crossings | 1000 | Grid route segment intersection count |
| Bends over budget headroom | 100 | Bends beyond 1 headroom per strand (prefer 0–1 bends) |
| Same-side loopback paths | 500 | Routes whose start/end share the same side of center X |
| Sides used | 50 | Count of populated canvas sides (L/R/T/B) — penalize extra sides |
| Center width used | 1 | Grid routing zone width — prefer compact |
| Side height imbalance | 10 | \|left stack height − right stack height\| |
| Path length | 0.1 | Sum of orthogonal grid segment lengths |

**Composite formula:**

```
total = crossings×1000 + bendsOverBudget×100 + sameSideLoopbacks×500
      + sidesUsed×50 + centerWidth×1 + heightImbalance×10 + pathLength×0.1
```

## Tie-break order (deterministic)

When two candidates have equal soft score:

1. **Fewer sides used** (soft preference — prefer left/right-only outcomes when scores tie; not a layout-mode constraint).
2. **Lexicographic stable candidate id** (`candidateStableId`).

Search uses `compareCandidates()` with this order.

## Infeasible candidates

Any hard-rule `severity: "fail"` sets `feasible: false` and score `Number.MAX_SAFE_INTEGER`. Such candidates are never selected as the search winner.

## Rule runner behavior

`SDC-SCORE-001` in `runRules()` reports the computed soft score as informational output when `optimizedLayoutCandidate` and grid routes are present. It never emits `severity: "fail"`.

## Related docs

- [`splice_detail_canvas_rule_pack/00_Rule_Index.md`](../splice_detail_canvas_rule_pack/00_Rule_Index.md) — conflict priority
- [`docs/agent/ROUTING_FIRST_LAYOUT.md`](../docs/agent/ROUTING_FIRST_LAYOUT.md) — search pipeline
