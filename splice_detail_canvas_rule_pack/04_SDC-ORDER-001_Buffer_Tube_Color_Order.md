# Buffer Tube Color Order

Rule ID: SDC-ORDER-001
Related Rules: SDC-CORE-001, SDC-DATA-001, SDC-DATA-002, SDC-ORDER-002, SDC-LAYOUT-002, SDC-ROUTE-002
Reference Example Images/Docs: Project buffer tube color order source file
Rule Type: Visual ordering
Status: Active

## Purpose
Ensure buffer tubes are displayed in standard fiber optic color-code order based on the cable origin side.

## Standard Buffer Tube Color Order

Base sequence:

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

Striped sequence for cables above 144 fibers:

13. Blue Striped
14. Orange Striped
15. Green Striped
16. Brown Striped
17. Slate Striped
18. White Striped
19. Red Striped
20. Black Striped
21. Yellow Striped
22. Violet Striped
23. Rose Striped
24. Aqua Striped

Striped buffer tubes MUST NOT appear before all 12 base buffer tube colors are used.

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
| Blue Striped | BL/S |
| Orange Striped | OR/S |
| Green Striped | GR/S |
| Brown Striped | BR/S |
| Slate Striped | SL/S |
| White Striped | WH/S |
| Red Striped | RD/S |
| Black Striped | BK/S |
| Yellow Striped | YL/S |
| Violet Striped | VI/S |
| Rose Striped | RS/S |
| Aqua Striped | AQ/S |

## Ordering Direction by Cable Side

- Left-side cable: buffer tubes are ordered vertically from top to bottom.
- Right-side cable: buffer tubes are ordered vertically from top to bottom.
- Top-side cable: buffer tubes are ordered horizontally from left to right.
- Bottom-side cable: buffer tubes are ordered horizontally from left to right.

Top-side and bottom-side cable ordering applies when the import optimizer places cables on those edges [SDC-CORE-001], [SDC-GRID-001], [SDC-SCORE-001].

## Scope

This rule applies only to the visual ordering of buffer tubes inside a fiber cable. It does not control the strand order inside each buffer tube. Strand order is controlled by [SDC-ORDER-002].

## Relationship to Data Rules

The app must build the cable -> buffer tube -> strand hierarchy before this visual order is applied [SDC-DATA-001].

The inferred 6-count or 12-count buffer tube count does not change the buffer tube color order [SDC-DATA-002]. It only changes how many strands are expected inside each buffer tube.

## Relationship to Fan Out and Nesting

The visual buffer tube order controls the starting order for fanouts [SDC-LAYOUT-002]. Nested routing groups should preserve this buffer tube order as much as possible when assigning lane bands [SDC-ROUTE-002].

## Validation

FAIL this rule if:
- Buffer tubes are visually out of standard color-code order.
- Buffer tube labels do not match the expected color sequence.
- Striped buffer tubes appear before all 12 base colors are used.
- Left-side or right-side cables order buffer tubes horizontally instead of vertically.
- Top-side or bottom-side cables order buffer tubes vertically instead of horizontally.
- Buffer tubes from unrelated cables are visually interleaved without a valid layout reason [SDC-ROUTE-002].

WARN if:
- Buffer tube color was inferred rather than explicitly imported.
- Missing CSV data prevents complete sequence validation.

## Success Criteria

The rule passes when all buffer tubes for a cable appear in the expected color order and in the correct axis for the cable side.

## Standard Interpretation
- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- MAY means optional behavior.
- FAIL means the validator should mark the layout or data as invalid for this rule.
- WARN means the app should keep the layout/data but notify the user or agent that quality is reduced.

## Inline Rule Citation Format
Use inline citations by rule ID when implementing or explaining behavior, for example: [SDC-GRID-001].
