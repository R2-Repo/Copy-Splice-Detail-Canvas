# Fiber Strand Color Order

Rule ID: SDC-ORDER-002
Related Rules: SDC-CORE-001, SDC-DATA-001, SDC-DATA-002, SDC-ORDER-001, SDC-LAYOUT-001, SDC-LAYOUT-002, SDC-ROUTE-002
Reference Example Images/Docs: Project fiber strand color order source file
Rule Type: Visual ordering
Status: Active

## Purpose
Ensure fiber strands are displayed in standard fiber optic color-code order inside each buffer tube, fan out, strand group, and nested route group.

## Standard 12-Count Fiber Strand Order

1. Blue
2. Orange
3. Green
4. Brown
5. Slate
6. White
7. Red
8. Black
9. Yellow
10. Violet
11. Rose
12. Aqua

## Standard 6-Count Fiber Strand Order

For 6-count buffer tubes, only the first six colors are used [SDC-DATA-002]:

1. Blue
2. Orange
3. Green
4. Brown
5. Slate
6. White

## Abbreviations

| Color | Abbreviation |
|---|---|
| Blue | BL |
| Orange | OR |
| Green | GR |
| Brown | BR |
| Slate | SL |
| White | WH |
| Red | RD |
| Black | BK |
| Yellow | YL |
| Violet | VI |
| Rose | RS |
| Aqua | AQ |

## Ordering Direction by Cable Side

- Left-side cable: strands are ordered vertically from top to bottom.
- Right-side cable: strands are ordered vertically from top to bottom.
- Top-side cable: strands are ordered horizontally from left to right.
- Bottom-side cable: strands are ordered horizontally from left to right.

Top and bottom sides only apply in four-sided diagram mode [SDC-CORE-001].

## Scope

This rule applies to:
- Fiber strands inside each buffer tube.
- Fiber strand fanouts [SDC-LAYOUT-002].
- Fiber strand group routing [SDC-ROUTE-002].
- Fiber strand nesting [SDC-ROUTE-002].

This rule does not control buffer tube order. Buffer tube order is controlled by [SDC-ORDER-001].

## Absolute Strand Number Requirement

Visual ordering MUST NOT change the absolute fiber strand number. Sorting strands for display cannot renumber the imported or inferred strand identity [SDC-DATA-002].

## Relationship to Fan Out

Fan out exit points MUST follow this color order [SDC-LAYOUT-002]. This gives the routing engine deterministic start points and prevents immediate fan out confusion.

## Relationship to Nesting

Nested routing should preserve strand order when assigning nearby lanes inside a buffer tube group [SDC-ROUTE-002]. Strand order may be adjusted only when required to avoid higher-priority routing failures such as collisions, illegal overlap, or locked manual constraints [SDC-ROUTE-003], [SDC-UX-001]. The strand number and connection identity still must not change.

## Validation

FAIL this rule if:
- Fiber strands are visually out of color-code order inside the buffer tube or fan out.
- Fiber strand labels do not match the expected color sequence.
- Left-side or right-side cables order strands horizontally instead of vertically.
- Top-side or bottom-side cables order strands vertically instead of horizontally.
- Strands from the same buffer tube are not grouped before entering the routing zone [SDC-LAYOUT-002].
- Strand visual sorting changes absolute strand numbers [SDC-DATA-002].

WARN if:
- Strand colors are inferred from strand number.
- A route must locally break visual order near the splice dot to satisfy collision or lock constraints [SDC-ROUTE-003], [SDC-UX-001].

## Success Criteria

The rule passes when strands are shown in the expected color order at the buffer tube and fan out, maintain absolute numbering, and remain grouped as they enter routing [SDC-LAYOUT-002], [SDC-ROUTE-002].

## Standard Interpretation
- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- MAY means optional behavior.
- FAIL means the validator should mark the layout or data as invalid for this rule.
- WARN means the app should keep the layout/data but notify the user or agent that quality is reduced.

## Inline Rule Citation Format
Use inline citations by rule ID when implementing or explaining behavior, for example: [SDC-GRID-001].
