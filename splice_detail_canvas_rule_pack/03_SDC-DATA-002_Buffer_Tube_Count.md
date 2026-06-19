# Buffer Tube Count

Rule ID: SDC-DATA-002
Related Rules: SDC-CORE-001, SDC-DATA-001, SDC-ORDER-001, SDC-ORDER-002, SDC-LAYOUT-002
Reference Example Images/Docs: Project buffer tube count source file
Rule Type: Data inference and validation
Status: Active

## Purpose
Determine whether a fiber cable uses 12-count buffer tubes or 6-count buffer tubes, then validate that the imported cable structure matches the expected grouping.

## Definitions

`ct` means count.

A 12-count buffer tube contains 12 individual fiber strands. Most modern fiber cables in this project should be treated as 12-count unless the imported data indicates otherwise.

A 6-count buffer tube contains 6 individual fiber strands. Older or smaller cables may use 6-count buffer tubes.

## Standard 12-Count Strand Colors

A 12-count buffer tube uses:

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

This order is reused by the fiber strand color order rule [SDC-ORDER-002].

## Standard 6-Count Strand Colors

A 6-count buffer tube uses only the first six strand colors:

1. Blue
2. Orange
3. Green
4. Brown
5. Slate
6. White

## Required Absolute Strand Number Rule

Fiber strand numbers MUST remain absolute across the entire cable. Buffer tube grouping must never renumber strands [SDC-LAYOUT-002].

Examples:
- In a 12-count cable, strand 12 may be Aqua in the Blue buffer tube.
- In a 6-count cable, strand 12 may be White in the Orange buffer tube.
- In both cases, strand 12 is still absolute fiber strand number 12.

## Inference Requirement

The imported CSV may not explicitly state whether a cable uses 6-count or 12-count buffer tubes. The app MUST infer the most likely buffer tube count from available data.

Inference clues include:
- Total fiber cable count.
- Buffer tube colors present in the CSV.
- Fiber strand colors present in each buffer tube.
- Strand number ranges.
- Repeated color patterns.
- Whether each tube contains Blue through Aqua.
- Whether each tube contains only Blue through White.
- Known cable sizes that commonly use 6-count tubes.

## Expected Inference Behavior

The app SHOULD infer 12-count buffer tubes when:
- Each tube contains 12 strand colors from Blue through Aqua.
- The cable count is divisible by 12 and the observed pattern supports 12-count grouping.

The app SHOULD infer 6-count buffer tubes when:
- Each tube contains only Blue through White.
- The cable count is 18, 24, or 36 and the observed strand/color pattern supports 6-count grouping.
- The cable count is divisible by 6 but not by 12.

If the CSV data is incomplete, the app MAY infer the most likely count but MUST attach a confidence value or warning.

## Relationship to Buffer Tube Color Order

This rule determines how many strands belong inside each buffer tube. It does not change the buffer tube color sequence. Buffer tubes still follow the standard buffer tube color order [SDC-ORDER-001].

## Relationship to Fiber Strand Fan Out

Fan out geometry must use the inferred buffer tube count to decide how many strand exit points to generate [SDC-LAYOUT-002]. A 6-count buffer tube should create 6 fan out strand positions. A 12-count buffer tube should create 12 fan out strand positions.

## Validation

FAIL this rule if:
- A 12-count buffer tube has more or fewer than 12 strands.
- A 6-count buffer tube has more or fewer than 6 strands.
- A 6-count buffer tube contains fiber colors beyond White.
- A cable is missing expected buffer tubes based on total fiber count.
- A cable is missing expected fiber strands based on total fiber count.
- Strand numbers are renumbered because of buffer tube grouping.
- Total parsed strand count does not match known cable count.

WARN if:
- The inferred buffer tube count has low confidence.
- CSV rows are missing enough data to prove 6-count vs 12-count.
- Total fiber count is unknown but can be estimated from rows.

## Success Criteria

The rule passes when every buffer tube has the expected number of strands, strand numbers remain absolute, and the inferred grouping supports later color order and fan out rules [SDC-ORDER-002], [SDC-LAYOUT-002].

## Standard Interpretation
- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- MAY means optional behavior.
- FAIL means the validator should mark the layout or data as invalid for this rule.
- WARN means the app should keep the layout/data but notify the user or agent that quality is reduced.

## Inline Rule Citation Format
Use inline citations by rule ID when implementing or explaining behavior, for example: [SDC-GRID-001].
