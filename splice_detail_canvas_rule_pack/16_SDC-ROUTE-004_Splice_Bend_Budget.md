# Splice Bend Budget

Rule ID: SDC-ROUTE-004
Related Rules: SDC-CORE-001, SDC-GRID-001, SDC-LAYOUT-001, SDC-ROUTE-001, SDC-ROUTE-002, SDC-ROUTE-003, SDC-UX-001
Reference Example Images/Docs: Project splice path geometry source file
Rule Type: Route validity (hard gate)
Status: Active

## Purpose

Limit how many 90° corners each fiber strand may use on its splice path so legs stay readable and routing stays predictable.

This is a **hard rule**. It applies to every routed strand path regardless of canvas side assignment (left/right or top/bottom).

## Bend budget

Each fiber strand splice path MUST use **at most 2 corners total** across **both legs combined** (source leg + target leg).

| Leg split (source + target) | Valid? |
|---|---|
| 0 + 0 | Yes — both legs straight |
| 1 + 0 or 0 + 1 | Yes |
| 1 + 1 | Yes |
| 2 + 0 or 0 + 2 | Yes |
| Any split summing to **> 2** | **No** |

A **corner** is a 90° direction change on a splice leg (horizontal ↔ vertical). Fan-out curves on the cable are **not** splice corners.

## Path orientation

Strands may run horizontally (left↔right) or vertically (top↔bottom) depending on cable placement. The bend budget applies to the actual routed path — not to a fixed left/right assumption.

## Relationship to other rules

- Minimum lane spacing and grid pitch come from [SDC-GRID-001].
- Overlap, collision, and lane sharing come from [SDC-ROUTE-003].
- When resolving conflicts, satisfy this bend budget before adding extra lane offsets or vertical jogs that would exceed the limit.
- Soft scoring may prefer fewer bends inside the budget [SDC-SCORE-001].

## Validation

FAIL this rule if:
- Any strand path uses more than 2 corners total.
- A layout workaround adds a third corner to avoid overlap instead of using a distinct lane within budget.

WARN if:
- A strand uses the full 2-corner budget but a 0- or 1-corner path was available without violating higher-priority hard rules.

## Success Criteria

Every strand path is traceable with at most two 90° corners combined across both legs.

## Standard Interpretation

- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- MAY means optional behavior.
- FAIL means the validator should mark the layout or data as invalid for this rule.
- WARN means the app should keep the layout/data but notify the user or agent that quality is reduced.

## Inline Rule Citation Format

Use inline citations by rule ID when implementing or explaining behavior, for example: [SDC-ROUTE-004].
