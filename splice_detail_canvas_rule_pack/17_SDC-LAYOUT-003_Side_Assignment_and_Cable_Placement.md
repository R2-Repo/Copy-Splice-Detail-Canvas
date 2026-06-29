# Side Assignment and Cable Placement

Rule ID: SDC-LAYOUT-003
Related Rules: SDC-CORE-001, SDC-LAYOUT-001, SDC-LAYOUT-002, SDC-SCORE-001, SDC-UX-001
Rule Type: Layout generation
Status: Active

## Purpose

Define how the routing-first import optimizer assigns each fiber cable to a diagram edge (left, right, top, or bottom) and how that assignment is validated after paint.

There is **no user layout-mode toggle**. Cable side assignment is a **search output** [SDC-CORE-001], scored by [SDC-SCORE-001] and locked by manual overrides [SDC-UX-001].

## Requirements

Each physical cable MUST:

- Sit on exactly one edge: left, right, top, or bottom.
- Appear in that edge's stack order list used by placement.
- Match the painted cable node edge after import (`quadSide` or horizontal `side`).

The optimizer MAY leave edges empty. A layout that uses only left and right is a valid outcome when routing score does not need top or bottom relief.

## Validation

FAIL when:

- `cableSides` and `stackOrder` disagree for any cable.
- A rendered cable node sits on a different edge than the winning candidate records.
- Topology locks or forbidden same-side pairs are violated (enforced during search; reported under this rule when re-checked at T2).

WARN when:

- No `optimizedLayoutCandidate` is attached (manual or legacy path without search snapshot).

## Success Criteria

Every cable has a single consistent edge assignment from candidate through paint, and stack order on each populated edge matches that assignment.

## Standard Interpretation

- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- FAIL means the validator marks the layout invalid for this rule.
