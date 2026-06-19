<!-- File: 00_Rule_Index.md -->
# Splice Detail Canvas Rule Index

## Rule ID System
Use stable IDs in this format:

`SDC-<GROUP>-<NUMBER>`

Where:
- `SDC` = Splice Detail Canvas.
- `GROUP` = rule family.
- `NUMBER` = stable sequence number within that family.

Recommended groups:
- `CORE` = shared vocabulary and diagram structure.
- `DATA` = imported cable data model and validation.
- `ORDER` = color-code ordering rules.
- `GRID` = internal canvas grid and lane reservation.
- `LAYOUT` = visual placement, fanout, labels, and spacing.
- `ROUTE` = routing zones, nesting, crossings, collisions, and path validation.
- `UX` = manual adjustment, locks, resets, and user interaction behavior.

## Active Rules

| Rule ID | Rule Name | Primary Purpose |
|---|---|---|
| SDC-CORE-001 | Glossary and Diagram Structure | Shared vocabulary and component definitions. |
| SDC-DATA-001 | Fiber Optic Cable Hierarchy | Required parent-child data model after CSV import. |
| SDC-DATA-002 | Buffer Tube Count | Infer and validate 6-count vs 12-count buffer tubes. |
| SDC-ORDER-001 | Buffer Tube Color Order | Standard visual order for buffer tubes. |
| SDC-ORDER-002 | Fiber Strand Color Order | Standard visual order for strands inside a buffer tube. |
| SDC-GRID-001 | Canvas Grid System | Internal routing grid, lanes, intersections, occupancy, and quadrants. |
| SDC-LAYOUT-001 | Spacing | Spacing between cables, buffer tubes, fanouts, strand groups, and strands. |
| SDC-LAYOUT-002 | Fiber Strand Fan Out | Breakout geometry from buffer tube to individual strand exit points. |
| SDC-ROUTE-001 | Fiber Strand Routing Zone | Valid center routing area and bend clearance requirements. |
| SDC-ROUTE-002 | Fiber Strand Nesting | Hierarchy-aware group routing and lane bands. |
| SDC-ROUTE-003 | Fiber Strand Overlap, Crossing, and Collision | Invalid route interference and allowed crossing exception. |
| SDC-UX-001 | Auto Layout and Manual Locks | Always-on auto layout with locked manual overrides. |

## Recommended Rule Processing Order

1. Parse and normalize imported CSV data. Future rule: [SDC-IMPORT-001].
2. Build cable hierarchy [SDC-DATA-001].
3. Infer buffer tube count and validate strand grouping [SDC-DATA-002].
4. Apply buffer tube and strand color order [SDC-ORDER-001], [SDC-ORDER-002].
5. Place cables, buffer tubes, labels, and fanouts [SDC-LAYOUT-002], [SDC-LAYOUT-001].
6. Calculate routing zone boundaries and grid occupancy [SDC-ROUTE-001], [SDC-GRID-001].
7. Apply locked manual overrides as fixed constraints [SDC-UX-001].
8. Build nested routing groups and lane bands [SDC-ROUTE-002].
9. Route strands inside the routing zone [SDC-GRID-001], [SDC-ROUTE-001].
10. Validate overlap, crossing, collision, spacing, labels, and reserved areas [SDC-ROUTE-003], [SDC-LAYOUT-001].
11. Score the layout and retry if needed. Future rule: [SDC-SCORE-001].
12. Save/export PDF/config. Future rule: [SDC-EXPORT-001].

## Conflict Priority

When rules conflict, resolve them in this order:

1. Imported splice data accuracy and hierarchy must not be changed by visual layout [SDC-DATA-001].
2. Absolute strand numbers must not be renumbered [SDC-DATA-002], [SDC-LAYOUT-002].
3. Locked manual overrides are fixed constraints unless the user unlocks them [SDC-UX-001].
4. Fiber routes must stay inside valid routing zones and avoid reserved areas [SDC-ROUTE-001].
5. Overlap, collision, and illegal shared lanes must be prevented or flagged [SDC-ROUTE-003].
6. Minimum spacing must be preserved unless the controlled crossing exception applies [SDC-LAYOUT-001], [SDC-ROUTE-003].
7. Nesting and grouping should be preserved unless breaking nesting is required to solve a higher-priority routing failure [SDC-ROUTE-002].
8. Aesthetic goals such as fewer bends, shorter paths, and compact layout are optimization goals, not hard data rules [SDC-GRID-001].

## Related Rule Matrix

| Rule | Most Related Rules |
|---|---|
| SDC-CORE-001 | All rules |
| SDC-DATA-001 | SDC-DATA-002, SDC-ORDER-001, SDC-ORDER-002, SDC-LAYOUT-002, SDC-ROUTE-002, SDC-UX-001 |
| SDC-DATA-002 | SDC-DATA-001, SDC-ORDER-001, SDC-ORDER-002, SDC-LAYOUT-002 |
| SDC-ORDER-001 | SDC-DATA-001, SDC-DATA-002, SDC-LAYOUT-002, SDC-ROUTE-002 |
| SDC-ORDER-002 | SDC-DATA-001, SDC-DATA-002, SDC-LAYOUT-002, SDC-ROUTE-002, SDC-LAYOUT-001 |
| SDC-GRID-001 | SDC-ROUTE-001, SDC-ROUTE-002, SDC-ROUTE-003, SDC-LAYOUT-001, SDC-UX-001 |
| SDC-LAYOUT-001 | SDC-LAYOUT-002, SDC-ROUTE-001, SDC-ROUTE-002, SDC-ROUTE-003, SDC-GRID-001 |
| SDC-LAYOUT-002 | SDC-ORDER-002, SDC-LAYOUT-001, SDC-ROUTE-001, SDC-ROUTE-002, SDC-ROUTE-003 |
| SDC-ROUTE-001 | SDC-GRID-001, SDC-LAYOUT-001, SDC-LAYOUT-002, SDC-ROUTE-002, SDC-ROUTE-003, SDC-UX-001 |
| SDC-ROUTE-002 | SDC-DATA-001, SDC-LAYOUT-002, SDC-GRID-001, SDC-LAYOUT-001, SDC-ROUTE-001, SDC-ROUTE-003 |
| SDC-ROUTE-003 | SDC-GRID-001, SDC-LAYOUT-001, SDC-ROUTE-001, SDC-ROUTE-002, SDC-UX-001 |
| SDC-UX-001 | SDC-GRID-001, SDC-ROUTE-001, SDC-ROUTE-003, SDC-LAYOUT-001, SDC-LAYOUT-002, SDC-ROUTE-002 |


---

<!-- File: 01_SDC-CORE-001_Glossary_and_Diagram_Structure.md -->
# Glossary and Diagram Structure

Rule ID: SDC-CORE-001
Related Rules: SDC-DATA-001, SDC-DATA-002, SDC-ORDER-001, SDC-ORDER-002, SDC-GRID-001, SDC-LAYOUT-001, SDC-LAYOUT-002, SDC-ROUTE-001, SDC-ROUTE-002, SDC-ROUTE-003, SDC-UX-001
Reference Example Images/Docs: Project glossary source file
Rule Type: Foundational terminology
Status: Active

## Purpose
Define the shared language for the splice detail canvas. This rule is not a routing rule by itself. It standardizes the terms used by the app, AI agents, rules, validators, and user-facing documentation.

## Core Diagram Modes

### Two-Sided Diagram Mode
A two-sided diagram uses left-side and right-side fiber cables. The primary flow is left-to-right or right-to-left. This mode is the default for simpler splice details [SDC-ROUTE-001].

### Four-Sided Diagram Mode
A four-sided diagram can use left-side, right-side, top-side, and bottom-side fiber cables. The primary flow may be left-to-right, right-to-left, top-to-bottom, or bottom-to-top. Top and bottom cable positions are layout options that help reduce congestion on larger splice diagrams [SDC-GRID-001], [SDC-ROUTE-001].

## Required Component Vocabulary

### Fiber Cable
A fiber cable is the main physical cable entering the splice enclosure. It is the parent object for buffer tubes [SDC-DATA-001].

Allowed side names:
- Left fiber cable
- Right fiber cable
- Top fiber cable
- Bottom fiber cable

### Buffer Tube
A buffer tube is a grouped tube inside a fiber cable that contains multiple individual fiber strands. Each buffer tube belongs to exactly one fiber cable [SDC-DATA-001]. Buffer tube order is controlled by the buffer tube color order rule [SDC-ORDER-001].

Allowed side names:
- Left buffer tube
- Right buffer tube
- Top buffer tube
- Bottom buffer tube

### Fiber Strand Fan Out
A fiber strand fan out is the organized breakout area where the strands inside a buffer tube separate into individual visible positions before entering the routing zone [SDC-LAYOUT-002].

A fan out MUST:
- Preserve strand color-code order [SDC-ORDER-002].
- Preserve absolute strand numbers [SDC-DATA-002].
- Provide one exit point per strand [SDC-LAYOUT-002].
- Keep labels outside the routing zone [SDC-ROUTE-001].

### Individual Fiber Strand
An individual fiber strand is one fiber inside a buffer tube. It routes from its fan out exit point to its assigned fusion splice dot [SDC-LAYOUT-002], [SDC-ROUTE-001].

A strand side is determined by the side of its parent cable and parent buffer tube [SDC-DATA-001].

Allowed side names:
- Left fiber strand
- Right fiber strand
- Top fiber strand
- Bottom fiber strand

### Fusion Splice Dot
A fusion splice dot is the center point where two fiber strands meet and represent a physical splice. The dot acts as the center anchor for the connected strand paths [SDC-ROUTE-001].

A fusion splice dot SHOULD:
- Mark the exact visual connection point.
- Separate the incoming route legs.
- Remain traceable from both fan out exit points [SDC-ROUTE-003].
- Respect locked manual dot positions when locked [SDC-UX-001].

## Required Hierarchy

The standard hierarchy is:

```text
Fiber Cable
  -> Buffer Tube
      -> Fiber Strand Fan Out
          -> Individual Fiber Strand
              -> Fusion Splice Dot
```

The parsed data hierarchy is:

```text
Fiber Cable
  -> Buffer Tubes
      -> Fiber Strands
```

The data hierarchy must exist before visual routing starts [SDC-DATA-001].

## Standard Directional Flow

### Left-to-Right Example
```text
Left Fiber Cable
  -> Left Buffer Tube
      -> Left Fiber Strand Fan Out
          -> Left Fiber Strand
              -> Fusion Splice Dot
          <- Right Fiber Strand
      <- Right Fiber Strand Fan Out
  <- Right Buffer Tube
<- Right Fiber Cable
```

### Four-Sided General Flow
```text
Side Fiber Cable
  -> Side Buffer Tube
      -> Side Fiber Strand Fan Out
          -> Side Fiber Strand
              -> Center Routing Zone
                  -> Fusion Splice Dot
```

## Agent Requirements

An AI agent MUST:
- Use these terms consistently.
- Preserve the cable -> buffer tube -> strand hierarchy when describing or implementing features [SDC-DATA-001].
- Use side-based names when discussing diagram geometry.
- Treat fanout, routing zone, grid, and splice dot as separate concepts [SDC-GRID-001], [SDC-LAYOUT-002], [SDC-ROUTE-001].

## Validation
This rule fails only when terminology is used in a way that breaks the model. Examples:
- A fiber strand is described as belonging directly to a cable without a buffer tube [SDC-DATA-001].
- A route starts from a buffer tube instead of a fan out exit point [SDC-LAYOUT-002].
- A fusion splice dot is treated as a cable, buffer tube, or label.

## Standard Interpretation
- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- MAY means optional behavior.
- FAIL means the validator should mark the layout or data as invalid for this rule.
- WARN means the app should keep the layout/data but notify the user or agent that quality is reduced.

## Inline Rule Citation Format
Use inline citations by rule ID when implementing or explaining behavior, for example: [SDC-GRID-001].


---

<!-- File: 02_SDC-DATA-001_Fiber_Optic_Cable_Hierarchy.md -->
# Fiber Optic Cable Hierarchy

Rule ID: SDC-DATA-001
Related Rules: SDC-CORE-001, SDC-DATA-002, SDC-ORDER-001, SDC-ORDER-002, SDC-LAYOUT-002, SDC-ROUTE-002, SDC-UX-001
Reference Example Images/Docs: Project fiber optic cable hierarchy source file
Rule Type: Data model validation
Status: Active

## Purpose
Ensure every imported fiber optic cable is modeled with the correct parent-child hierarchy before any layout, routing, validation, or manual adjustment logic runs.

## Required Hierarchy

```text
Fiber Cable
  -> Buffer Tubes
      -> Fiber Strands
```

## Data Model Requirements

A fiber cable MUST:
- Be the top-level cable object.
- Contain one or more buffer tubes.
- Retain imported cable identity from the CSV.
- Keep its children grouped through layout and routing [SDC-ROUTE-002].

A buffer tube MUST:
- Belong to exactly one fiber cable.
- Contain one or more individual fiber strands.
- Have a color or inferred color when the data allows it [SDC-ORDER-001].
- Be validated against the expected 6-count or 12-count grouping [SDC-DATA-002].

A fiber strand MUST:
- Belong to exactly one parent buffer tube.
- Have an absolute strand number when available.
- Have a color or inferred color when the data allows it [SDC-ORDER-002].
- Keep its parent cable and parent buffer tube identity during routing [SDC-ROUTE-002].

## Scope

This rule applies to the parsed cable data model created from the imported CSV. It runs before layout and routing rules.

This rule controls:
- Parent-child structure.
- Object ownership.
- Basic model validity.
- Whether routing has enough information to run safely.

This rule does not control:
- Visual route paths.
- Cable placement on the canvas.
- Buffer tube visual order.
- Fiber strand visual order.
- Fusion splice dot geometry.

## Required Processing Order

The app MUST run this rule before:
- Buffer tube count inference [SDC-DATA-002].
- Buffer tube color order [SDC-ORDER-001].
- Fiber strand color order [SDC-ORDER-002].
- Fan out generation [SDC-LAYOUT-002].
- Nested route grouping [SDC-ROUTE-002].
- Manual lock application [SDC-UX-001].

## Agent Implementation Notes

The AI agent SHOULD create a normalized internal structure similar to:

```text
CableRecord
  cableId
  side
  bufferTubes[]

BufferTubeRecord
  cableId
  tubeId
  tubeColor
  strandCount
  strands[]

FiberStrandRecord
  cableId
  tubeId
  strandNumber
  strandColor
  osCircuitName
  connectionId
```

The app MAY store additional Bentley CSV fields, but the routing engine must not depend on raw row order alone. It should depend on the normalized hierarchy [SDC-DATA-002].

## Validation

FAIL this rule if:
- A fiber strand is missing its parent buffer tube.
- A buffer tube is missing its parent fiber cable.
- A fiber strand is attached directly to a cable without a buffer tube.
- A buffer tube contains no fiber strands.
- A fiber cable contains no buffer tubes.
- Duplicate object IDs cause ambiguous parent ownership.

WARN if:
- A parent relationship can be inferred but was missing from the CSV.
- Imported rows contain inconsistent cable names that appear to refer to the same physical cable.
- Fiber strand color or buffer tube color must be inferred from strand number rather than explicit CSV values [SDC-DATA-002].

## Success Criteria

The data model is valid when every strand can be traced back to exactly one buffer tube and exactly one cable before any layout is attempted.

## Standard Interpretation
- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- MAY means optional behavior.
- FAIL means the validator should mark the layout or data as invalid for this rule.
- WARN means the app should keep the layout/data but notify the user or agent that quality is reduced.

## Inline Rule Citation Format
Use inline citations by rule ID when implementing or explaining behavior, for example: [SDC-GRID-001].


---

<!-- File: 03_SDC-DATA-002_Buffer_Tube_Count.md -->
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


---

<!-- File: 04_SDC-ORDER-001_Buffer_Tube_Color_Order.md -->
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

Top-side and bottom-side cable origins only apply in four-sided diagram mode [SDC-CORE-001], [SDC-GRID-001].

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


---

<!-- File: 05_SDC-ORDER-002_Fiber_Strand_Color_Order.md -->
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


---

<!-- File: 06_SDC-GRID-001_Canvas_Grid_System.md -->
# Canvas Grid System

Rule ID: SDC-GRID-001
Related Rules: SDC-CORE-001, SDC-LAYOUT-001, SDC-LAYOUT-002, SDC-ROUTE-001, SDC-ROUTE-002, SDC-ROUTE-003, SDC-UX-001
Reference Example Images/Docs: Project canvas grid system source file
Rule Type: Layout and routing infrastructure
Status: Active

## Purpose
Use an invisible grid as the main structure for automatic layout, fiber routing, collision detection, manual adjustment, and retry layout generation.

The grid is the spatial source of truth for routing. Auto layout is the process that uses the grid [SDC-UX-001].

## Grid Model

The grid is not a visible box system for the user. It is an internal routing map.

- Grid cells = open spacing areas, label areas, clearance zones, and visual regions.
- Grid lines = routing lanes used by fiber strands.
- Grid intersections = approved bend points or transition points.
- Grid lane segments = reservable path sections.

Fiber strands SHOULD route on grid lines, not randomly through open canvas space [SDC-ROUTE-001].

## Segment Status

Each grid lane segment MUST track one of these statuses:

- `available` = open for routing.
- `reserved` = temporarily held during route calculation.
- `occupied` = used by an accepted fiber route.
- `blocked` = unavailable because of a cable, label, fanout, splice point, spacing area, or reserved region.
- `manual-locked` = fixed because the user manually adjusted it [SDC-UX-001].

## Route Representation

Fiber strand paths SHOULD be stored as ordered grid points:

```text
start point -> lane segment -> bend/intersection -> transition lane -> lane segment -> end point
```

Example:

```text
x=120,y=240 -> x=400,y=240 -> x=400,y=320 -> x=760,y=320
```

The routing engine MUST reserve the exact lane segments used by each accepted route. Unrelated strands MUST NOT use the same occupied segment unless a specific bundling rule allows it [SDC-ROUTE-003].

## Four-Sided Layout Support

The grid MUST support these zones:

```text
Top cable zone
Left cable zone
Right cable zone
Bottom cable zone
Center routing grid
```

Cables MAY be placed on left, right, top, or bottom sides when four-sided diagram mode is enabled [SDC-CORE-001].

## Routing Quadrants

The center routing grid SHOULD be divided into:
- Top-left quadrant.
- Top-right quadrant.
- Bottom-left quadrant.
- Bottom-right quadrant.

Quadrants organize routing but are not hard walls. Fibers MAY move between quadrants only through approved transition rows, columns, or bend points [SDC-ROUTE-001].

## Routing Hierarchy

Grid lane assignment MUST preserve this hierarchy where possible:

```text
Cable -> Buffer Tube -> Fiber Strand -> Splice / Connection Path
```

Buffer tube groups SHOULD receive lane bands. Strands inside the same buffer tube SHOULD use adjacent or nearby lanes [SDC-ROUTE-002].

## Import Behavior

When a CSV is imported, the app SHOULD:
1. Parse the data once.
2. Build the cable/buffer tube/fiber hierarchy [SDC-DATA-001].
3. Assign each object to a grid zone.
4. Generate fan out exits [SDC-LAYOUT-002].
5. Assign routing lanes.
6. Draw initial routes.
7. Mark used lane segments as occupied.

## Manual Adjustment Behavior

Dragging should work with the grid, not against it. Moved items SHOULD snap to the nearest valid grid position and become locked overrides [SDC-UX-001].

Manual-locked items MUST be treated as fixed occupied/blocked grid space during future layout attempts.

## Retry Layout Behavior

Retry Layout MUST NOT re-import or change CSV splice data. It should keep the parsed data and try new layout options:
- Cable side placement.
- Quadrant usage.
- Lane assignment.
- Fan out spacing.
- Bend columns.
- Routing order.

Invalid layouts MUST be rejected. Valid layouts SHOULD be scored by overlaps, crossings, bends, nesting, spacing, path length, and congestion [SDC-ROUTE-003], [SDC-LAYOUT-001].

## Validation

FAIL this rule if:
- A route is not attached to approved grid points or segments.
- A bend occurs outside an approved grid intersection.
- An unrelated route uses an occupied lane segment.
- A route crosses blocked or manual-locked segments without permission.
- The grid fails to reserve fanout, label, cable, buffer tube, or spacing areas [SDC-LAYOUT-002], [SDC-LAYOUT-001].

WARN if:
- A valid layout exists but creates high congestion.
- A route must move between quadrants more than expected.
- Manual locks leave only poor routing options [SDC-UX-001].

## Success Criteria

The rule passes when every routed strand can be represented by valid grid lane segments, occupied segments are reserved, blocked regions are avoided, and manual locks are respected.

## Standard Interpretation
- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- MAY means optional behavior.
- FAIL means the validator should mark the layout or data as invalid for this rule.
- WARN means the app should keep the layout/data but notify the user or agent that quality is reduced.

## Inline Rule Citation Format
Use inline citations by rule ID when implementing or explaining behavior, for example: [SDC-GRID-001].


---

<!-- File: 07_SDC-LAYOUT-001_Spacing.md -->
# Spacing

Rule ID: SDC-LAYOUT-001
Related Rules: SDC-CORE-001, SDC-GRID-001, SDC-LAYOUT-002, SDC-ROUTE-001, SDC-ROUTE-002, SDC-ROUTE-003, SDC-UX-001
Reference Example Images/Docs: Project spacing source file
Rule Type: Layout quality and validation
Status: Active

## Purpose
Define spacing requirements between fiber cables, buffer tubes, fanouts, fiber strand groups, and individual fiber strands so the splice detail remains readable, organized, and routable.

Spacing protects readability and gives the routing engine enough room to avoid overlap, collision, and unnecessary crossing [SDC-ROUTE-003].

## Spacing Categories

This rule covers:
1. Fiber cable spacing.
2. Buffer tube spacing.
3. Fan out spacing.
4. Fiber strand group spacing.
5. Individual fiber strand spacing.

## Fiber Cable Spacing

Fiber cable spacing is the distance between cable objects on the same side of the diagram.

There is no strict minimum or maximum cable spacing value. Cable spacing SHOULD be naturally dictated by:
- Buffer tube layout.
- Fan out spacing.
- Label spacing.
- Available canvas space.
- Routing zone requirements [SDC-ROUTE-001].

FAIL cable spacing only when placement causes fanout overlap, buffer tube overlap, label overlap, routing zone compression, or unclear cable separation.

## Buffer Tube Spacing

Buffer tube spacing is the distance between buffer tubes on the same side of the diagram.

There is no strict minimum or maximum buffer tube spacing value by itself. Buffer tube spacing SHOULD be dictated by:
- Fan out spacing [SDC-LAYOUT-002].
- Strand count [SDC-DATA-002].
- Strand abbreviation labels.
- OS circuit labels.
- Cable group spacing.
- Routing zone requirements [SDC-ROUTE-001].

FAIL buffer tube spacing only when placement causes fanout overlap, label overlap, exit point overlap, or confusing visual grouping.

## Fan Out Spacing

Fan out spacing is the distance between fiber strand fan out areas.

Fan outs MUST have minimum spacing between each other. This minimum should be configurable.

Fan out spacing MUST support:
- Color-code order [SDC-ORDER-002].
- Strand abbreviation labels.
- OS circuit labels.
- Clean fan out exit points [SDC-LAYOUT-002].
- Clean entry into the routing zone [SDC-ROUTE-001].

## Fan Out Group Separation

Fan outs from different cable groups MUST have more spacing than fanouts from the same cable group. This visually separates physical fiber cables [SDC-DATA-001].

## Fan Out Maximum Spacing

Fan out spacing SHOULD have a configurable maximum. Fanouts should not be spread so far apart that the diagram becomes oversized, inefficient, or harder to route.

A layout MAY exceed the preferred maximum only when needed to avoid higher-priority failures such as overlap, label collision, or locked manual constraints [SDC-ROUTE-003], [SDC-UX-001].

## Dynamic Fan Out Spacing

The import/layout module SHOULD dynamically adjust fan out spacing based on:
- Number of cables.
- Number of buffer tubes.
- Number of fiber strands.
- Diagram mode.
- Canvas size.
- Routing zone size.
- Label dimensions.
- Expected strand group count.
- Required separation between cable groups.

## Fiber Strand Group Spacing

Fiber strand group spacing is the extra distance between related routing groups inside the center routing zone.

A group may represent:
- Strands from the same buffer tube.
- Strands from the same cable group.
- Strands assigned to the same nested lane band.
- Strands routed toward related fusion splice dots [SDC-ROUTE-002].

Unrelated groups SHOULD be separated so the user can visually understand where each group starts and ends.

## Individual Fiber Strand Spacing

Every individual fiber strand route MUST have a minimum spacing buffer in all directions. The exact value should be configurable.

Spacing applies:
- Horizontally.
- Vertically.
- Around bends.
- Around lane transitions.
- Around fan out exit points.
- Around fusion splice dots.
- Between strand groups.

Unrelated strands MUST NOT share the same horizontal or vertical lane [SDC-GRID-001], [SDC-ROUTE-003].

## Allowed Crossing Exception

A strand MAY cross another strand only when it must change position to reach a fusion splice dot that is higher/lower or left/right of its starting lane [SDC-ROUTE-003].

Even when crossing is allowed:
- The crossing should be short and controlled.
- The crossing must not become a shared lane.
- The route must not run on top of another strand for an extended distance.
- Spacing should be preserved wherever possible.

## Validation

FAIL this rule if:
- Fan out spacing is below the configured minimum.
- Fan out spacing exceeds the configured maximum without a valid routing reason.
- Cable groups do not have enough visual separation.
- Strand groups collapse into one crowded routing area.
- Individual strands violate minimum spacing.
- Strands visually merge into one line.
- Bends are so close together that the route cannot be understood.

WARN if:
- Valid spacing requires an oversized canvas.
- Locked manual items force poor spacing [SDC-UX-001].
- The layout is valid but visually dense.

## Success Criteria

The rule passes when labels, fanouts, groups, and individual strands remain visually separated and traceable without creating avoidable congestion.

## Standard Interpretation
- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- MAY means optional behavior.
- FAIL means the validator should mark the layout or data as invalid for this rule.
- WARN means the app should keep the layout/data but notify the user or agent that quality is reduced.

## Inline Rule Citation Format
Use inline citations by rule ID when implementing or explaining behavior, for example: [SDC-GRID-001].


---

<!-- File: 08_SDC-LAYOUT-002_Fiber_Strand_Fan_Out.md -->
# Fiber Strand Fan Out

Rule ID: SDC-LAYOUT-002
Related Rules: SDC-CORE-001, SDC-DATA-001, SDC-DATA-002, SDC-ORDER-001, SDC-ORDER-002, SDC-GRID-001, SDC-LAYOUT-001, SDC-ROUTE-001, SDC-ROUTE-002, SDC-ROUTE-003
Reference Example Images/Docs: Project fiber strand fan out source file
Rule Type: Layout generation
Status: Active

## Purpose
Define how individual fiber strands visually break out from each buffer tube before entering the routing zone.

The fan out is the organized transition area between a buffer tube and the routed individual strands. It gives the routing engine clean start points [SDC-ROUTE-001].

## Definition

A fan out represents all fiber strands inside one buffer tube being separated into individual visible strand positions.

The fan out starts at the buffer tube and ends at fan out exit points where individual routing begins.

```text
Fiber Cable
  -> Buffer Tube
      -> Fiber Strand Fan Out
          -> Individual Fiber Strands
              -> Routing Zone
                  -> Fusion Splice Dot
```

## Side Behavior

### Left-Side Cable
- Buffer tubes fan out toward the center.
- Strands are ordered vertically top to bottom [SDC-ORDER-002].
- Strands exit the fan out toward the right.

### Right-Side Cable
- Buffer tubes fan out toward the center.
- Strands are ordered vertically top to bottom [SDC-ORDER-002].
- Strands exit the fan out toward the left.

### Top-Side Cable
- Only used in four-sided mode [SDC-CORE-001].
- Buffer tubes fan out toward the center.
- Strands are ordered horizontally left to right.
- Strands exit the fan out downward.

### Bottom-Side Cable
- Only used in four-sided mode [SDC-CORE-001].
- Buffer tubes fan out toward the center.
- Strands are ordered horizontally left to right.
- Strands exit the fan out upward.

## Strand Order

Fan out strands MUST follow the standard strand color order [SDC-ORDER-002].

For 12-count buffer tubes, use Blue through Aqua.

For 6-count buffer tubes, use Blue through White [SDC-DATA-002].

The fan out MUST preserve absolute strand numbers. Sorting or visual placement must not renumber strands [SDC-DATA-002].

## Fan Out Contents

Each fiber strand in the fan out SHOULD include:
- Individual strand line.
- Strand color.
- Strand color abbreviation text.
- OS circuit name when available.
- Absolute strand number when needed for validation or display.
- One fan out exit point used by the routing engine.

## Spacing Requirements

Fan out strand spacing MUST be even and large enough to:
- Distinguish each strand.
- Prevent strand lines from touching.
- Prevent color abbreviation labels from overlapping.
- Prevent OS circuit labels from overlapping.
- Provide clean entry points into the routing zone.
- Avoid immediate collision as routing begins [SDC-LAYOUT-001], [SDC-ROUTE-003].

## Fan Out Exit Points

Each strand MUST have exactly one fan out exit point.

Fan out exit points MUST:
- Follow fiber color-code order [SDC-ORDER-002].
- Be evenly spaced [SDC-LAYOUT-001].
- Avoid labels.
- Avoid other exit points.
- Align with the cable side direction.
- Align to valid grid lanes where possible [SDC-GRID-001].
- Allow minimum bend clearance inside the routing zone [SDC-ROUTE-001].

## Label Placement

Fiber color abbreviation labels and OS circuit labels belong in the fan out area.

Labels MUST:
- Align with their strand.
- Avoid neighboring labels.
- Avoid route lines.
- Stay outside the routing zone [SDC-ROUTE-001].
- Be included as reserved/blocked areas in the grid [SDC-GRID-001].

## Routing Relationship

The fan out does not perform center routing.

The routing engine MUST start from the fan out exit point and route toward the assigned fusion splice dot [SDC-ROUTE-001].

The routing engine MUST NOT:
- Start routing from the buffer tube body.
- Start routing from label text.
- Bend inside the fan out area.
- Route through the fan out area after leaving it.
- Collapse multiple exit points into one shared path.

## Validation

FAIL this rule if:
- A buffer tube has no fan out.
- A strand has no fan out position.
- A strand has no fan out exit point.
- Multiple strands share one exit point.
- Fan out order does not match strand color order [SDC-ORDER-002].
- Fan out geometry overlaps the routing zone [SDC-ROUTE-001].
- Fan out geometry overlaps another buffer tube fanout.
- Labels overlap labels or strand lines.
- A strand bends inside the fan out area.
- The routing engine cannot identify a clean start point.

WARN if:
- Labels must be truncated to preserve spacing.
- The fan out must expand beyond preferred spacing to fit labels [SDC-LAYOUT-001].

## Success Criteria

The rule passes when each buffer tube has a clean, ordered, labeled fan out with one deterministic routing start point per strand.

## Standard Interpretation
- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- MAY means optional behavior.
- FAIL means the validator should mark the layout or data as invalid for this rule.
- WARN means the app should keep the layout/data but notify the user or agent that quality is reduced.

## Inline Rule Citation Format
Use inline citations by rule ID when implementing or explaining behavior, for example: [SDC-GRID-001].


---

<!-- File: 09_SDC-ROUTE-001_Fiber_Strand_Routing_Zone.md -->
# Fiber Strand Routing Zone

Rule ID: SDC-ROUTE-001
Related Rules: SDC-CORE-001, SDC-GRID-001, SDC-LAYOUT-001, SDC-LAYOUT-002, SDC-ROUTE-002, SDC-ROUTE-003, SDC-UX-001
Reference Example Images/Docs: Project fiber strand routing zone source file
Rule Type: Routing boundary validation
Status: Active

## Purpose
Define the valid center area where fiber strands may travel between fan out exit points and fusion splice dots.

The routing zone is the open center area of the splice detail diagram. Fiber routes must stay inside this zone and avoid cable bodies, buffer tubes, fanouts, labels, and other reserved regions [SDC-LAYOUT-002].

## Routing Zone Definition

The routing zone is calculated after placement of:
- Fiber cable bodies.
- Buffer tubes.
- Fan out areas.
- Strand color abbreviation labels.
- OS circuit labels.
- Side margins.
- Diagram headers or other non-routing UI elements.

All reserved areas outside the routing zone should become blocked grid areas [SDC-GRID-001].

## Diagram Modes

### Two-Sided Mode
The routing zone exists between the left fan out area and the right fan out area.

### Four-Sided Mode
The routing zone exists between the left, right, top, and bottom fan out areas. Strands from all four sides share the same center routing zone [SDC-CORE-001], [SDC-GRID-001].

## Boundary Rule

A strand may enter the routing zone from its fan out exit point. Once routing begins:
- All route segments must remain inside the routing zone.
- All bends must remain inside the routing zone.
- All splice-center paths must remain inside the routing zone.
- Routes must not leave the zone to avoid congestion [SDC-ROUTE-003].

## Minimum Bend Clearance

Fiber strands MUST NOT bend too close to the routing zone edge.

Default minimum bend clearance: `60px`.

This means:
- Left-side strands travel at least 60px into the routing zone before a vertical bend.
- Right-side strands travel at least 60px into the routing zone before a vertical bend.
- Top-side strands travel at least 60px into the routing zone before a horizontal bend.
- Bottom-side strands travel at least 60px into the routing zone before a horizontal bend.

The 60px value should be configurable, but the behavior is required.

## Purpose of Bend Clearance

Minimum bend clearance prevents:
- Bends crowding the fan out.
- Routes overlapping color abbreviations.
- Routes overlapping OS labels.
- Early collisions near the zone edge.
- Visual confusion between fan out geometry and routed strand geometry [SDC-LAYOUT-002].

## Zone Utilization

The routing engine SHOULD use the full available routing zone. It should not collapse all strands into the smallest possible center area when clean space is available [SDC-LAYOUT-001].

Expected behavior:
- Use available horizontal space.
- Use available vertical space.
- Spread strand groups apart [SDC-ROUTE-002].
- Reserve lanes for different groups [SDC-GRID-001].
- Avoid stacking unrelated strands into the same narrow band.
- Avoid unnecessary congestion near splice dots.

## Relationship to Import Accuracy

Routing depends on a correct cable model. If the imported CSV creates a wrong hierarchy or wrong connection pair, routing cannot reliably optimize paths [SDC-DATA-001].

The routing zone calculation requires accurate:
- Cable identity.
- Cable side assignment.
- Buffer tube grouping.
- Strand numbers.
- Strand colors.
- OS circuit names.
- Connection pairings.
- Fusion splice targets.

## Validation

FAIL this rule if:
- Any route segment exists outside the routing zone.
- Any bend point violates minimum bend clearance.
- A route segment overlaps labels, fanout geometry, cable bodies, or buffer tubes.
- A route ignores available spacing and creates avoidable congestion.
- A route leaves the zone to avoid another strand.
- A route uses an outside path around the diagram.
- A route violates overlap, crossing, spacing, or collision rules [SDC-ROUTE-003], [SDC-LAYOUT-001].

WARN if:
- Manual locks reduce the usable routing zone [SDC-UX-001].
- The route is technically valid but dense.

## Success Criteria

The rule passes when every strand enters the center zone cleanly, bends after the minimum clearance, avoids all reserved regions, and remains traceable from fan out exit to splice dot.

## Standard Interpretation
- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- MAY means optional behavior.
- FAIL means the validator should mark the layout or data as invalid for this rule.
- WARN means the app should keep the layout/data but notify the user or agent that quality is reduced.

## Inline Rule Citation Format
Use inline citations by rule ID when implementing or explaining behavior, for example: [SDC-GRID-001].


---

<!-- File: 10_SDC-ROUTE-002_Fiber_Strand_Nesting.md -->
# Fiber Strand Nesting

Rule ID: SDC-ROUTE-002
Related Rules: SDC-CORE-001, SDC-DATA-001, SDC-DATA-002, SDC-ORDER-001, SDC-ORDER-002, SDC-GRID-001, SDC-LAYOUT-001, SDC-LAYOUT-002, SDC-ROUTE-001, SDC-ROUTE-003, SDC-UX-001
Reference Example Images/Docs: Project nesting fiber strands source file
Rule Type: Routing organization
Status: Active

## Purpose
Ensure fiber strand routing is hierarchy-aware. The routing engine must route strands as members of their parent cable, parent buffer tube, strand group, and connection group before treating them as individual paths.

## Core Principle

The routing engine MUST NOT treat every fiber strand as an unrelated isolated line.

Routing must preserve:

```text
Fiber Cable
  -> Buffer Tube
      -> Fiber Strand
          -> Splice / Connection Path
```

This hierarchy comes from the imported data model [SDC-DATA-001].

## Nesting Definition

Nesting means related fiber strands stay visually grouped as they move through the splice detail diagram.

Strands are related when they share:
- Fiber cable.
- Buffer tube.
- Strand group.
- Connection group.
- Routing direction.
- Splice area relationship.

Nested strands SHOULD:
- Stay near each other.
- Use adjacent routing lanes.
- Move through the routing zone as an organized group.
- Separate only when needed near final splice targets.
- Preserve parent buffer tube grouping as long as possible.

## Required Routing Groups

Before routing individual strands, the app MUST create:

1. Cable Group.
2. Buffer Tube Group.
3. Fiber Strand Group.
4. Connection Group.

### Cable Group
Represents all buffer tubes and strands belonging to one physical cable.

### Buffer Tube Group
Represents all strands inside one buffer tube.

### Fiber Strand Group
Represents the ordered set of fibers inside a buffer tube [SDC-ORDER-002].

### Connection Group
Represents strands that route toward related splice targets or related center lanes.

## Routing Stages

The routing engine SHOULD follow this order:
1. Place fiber cables.
2. Place buffer tubes.
3. Build cable groups [SDC-DATA-001].
4. Build buffer tube groups.
5. Build fiber strand groups.
6. Build connection groups.
7. Assign nested lane bands inside the routing zone [SDC-GRID-001], [SDC-ROUTE-001].
8. Route individual strands inside assigned group lanes.
9. Spread groups apart across the center routing zone [SDC-LAYOUT-001].
10. Run overlap, collision, spacing, and crossing cleanup [SDC-ROUTE-003].
11. Preserve manual locks [SDC-UX-001].

## Lane Bands

A lane band is a reserved group of nearby lanes used by related strands.

The routing engine SHOULD:
- Assign each buffer tube group a nearby lane band.
- Keep related strand lanes adjacent.
- Spread unrelated groups apart.
- Avoid compressing all groups into the center.
- Keep nested groups readable from fan out to splice dot.

## Relationship to Fan Out

The fan out creates ordered strand exit points for each buffer tube [SDC-LAYOUT-002]. Nesting must preserve that order when strands enter the routing zone [SDC-ORDER-002].

The engine MUST NOT immediately scatter fanout strands into unrelated lanes when adjacent or nearby lanes are available.

## Relationship to Collision Rules

Nesting is important, but nesting must not create invalid routing.

The app SHOULD break or loosen nesting when required to prevent:
- Fiber overlap.
- Fiber collision.
- Broken spacing.
- Unnecessary crossing.
- Routing outside the routing zone.
- Label collisions.
- Locked manual constraint failures [SDC-ROUTE-003], [SDC-UX-001].

Collision prevention and valid routing win over perfect nesting.

## Interleaving Rule

The routing engine SHOULD avoid interleaving unrelated buffer tubes or unrelated fiber groups.

Interleaving is allowed only when required to solve a higher-priority routing issue, such as:
- Preventing overlap.
- Preventing collision.
- Preserving minimum spacing.
- Avoiding invalid routing.
- Keeping routes inside the routing zone.
- Respecting locked manual adjustments.

When interleaving is required, the disruption should be as small as possible.

## Good Behavior

Good nesting means:
- Same-buffer-tube fibers route near each other.
- Same-buffer-tube fibers use adjacent lanes.
- Same-cable fibers remain visually grouped.
- Buffer tube groups are visually separate from unrelated groups.
- Groups spread cleanly across the routing zone.
- Individual strands only separate near final splice targets.

## Bad Behavior

FAIL or WARN when:
- Same-buffer-tube fibers are scattered across unrelated areas.
- Fibers from unrelated buffer tubes are mixed without reason.
- Individual strands are routed before parent groups are assigned.
- A strand crosses through an unrelated group unnecessarily.
- Related strands are far apart despite adjacent lanes being available.
- The diagram loses the cable -> buffer tube -> strand relationship.

## Validation

FAIL this rule if:
- Routing starts with individual strands and no group model.
- Buffer tube groups are not assigned lane bands.
- Related strands are scattered without a higher-priority reason.
- Interleaving creates avoidable confusion or collisions.

WARN if:
- Nesting must be broken because of locked items, zone constraints, or collision avoidance.

## Success Criteria

The rule passes when strands route as organized cable/buffer/connection groups, stay nested where possible, and break nesting only when required for valid routing.

## Standard Interpretation
- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- MAY means optional behavior.
- FAIL means the validator should mark the layout or data as invalid for this rule.
- WARN means the app should keep the layout/data but notify the user or agent that quality is reduced.

## Inline Rule Citation Format
Use inline citations by rule ID when implementing or explaining behavior, for example: [SDC-GRID-001].


---

<!-- File: 11_SDC-ROUTE-003_Fiber_Strand_Overlap_Crossing_Collision.md -->
# Fiber Strand Overlap, Crossing, and Collision

Rule ID: SDC-ROUTE-003
Related Rules: SDC-CORE-001, SDC-GRID-001, SDC-LAYOUT-001, SDC-LAYOUT-002, SDC-ROUTE-001, SDC-ROUTE-002, SDC-UX-001
Reference Example Images/Docs: Project fiber strand overlap/crossing/collision source file
Rule Type: Route validity
Status: Active

## Purpose
Prevent fiber strand routes from visually overlapping, colliding, crossing unnecessarily, or violating minimum spacing while routed through the splice detail diagram.

This rule applies to fiber strand routing only. It references spacing rules but defines what makes a routed strand path visually invalid [SDC-LAYOUT-001].

## Core Terms

Overlap, crossing, collision, and spacing issue are related. They all describe route interference that makes strands hard to trace or visually invalid.

## Overlap

An overlap occurs when two different strands run on top of each other, share a path, occupy the same lane, or become close enough to violate spacing.

Overlap is invalid when:
- Two strands share the same horizontal route.
- Two strands share the same vertical route.
- Two strands run parallel too closely.
- A horizontal and vertical strand come too close without a valid crossing reason.
- Two strands visually merge into one line.
- Two strands occupy the same grid lane segment [SDC-GRID-001].
- Two strands violate minimum spacing [SDC-LAYOUT-001].

## Crossing

A crossing occurs when one strand path passes through or over another strand path.

Crossing is invalid when:
- The crossing is unnecessary.
- A different available lane would avoid the crossing.
- The crossing happens because a strand bends too late.
- Multiple crossings occur in the same small area.
- The crossing makes splice relationships unclear.

## Acceptable Crossing Exception

A strand or group MAY cross other strands only when it must change position to reach its correct splice location.

This usually happens when:
- A strand starts on one lane.
- The target fusion splice dot is higher/lower or left/right of the start lane.
- The strand must transition through a perpendicular lane.
- The transition must cross strands on another axis.

The crossing is allowed only when required to reach the correct destination and only when it is cleaner than the available alternatives.

Even when allowed:
- The crossing should be short and controlled.
- The crossing should happen at a planned grid transition [SDC-GRID-001].
- The route should preserve spacing where possible [SDC-LAYOUT-001].
- The route must not run on top of another strand for an extended distance.
- The crossing strand should visually remain above the crossed strands when layer ordering is needed.

## Collision

A collision is a specific overlap where strands from opposing sides route into the same lane, horizontal position, or vertical position.

Collision is invalid when:
- A left-side and right-side strand run on top of each other.
- A top-side and bottom-side strand run on top of each other.
- Opposing strands enter the same center lane unnecessarily.
- Two strands could have bent earlier but instead continue into the same path.
- Opposing routes stack before reaching the fusion splice dot.

## Spacing Issue

A spacing issue occurs when two routes are technically separate but are too close to meet minimum spacing [SDC-LAYOUT-001].

Spacing issues can occur between:
- Two horizontal strands.
- Two vertical strands.
- One horizontal and one vertical strand.
- A strand and a bend point.
- A strand and a fusion splice dot.
- A strand and another route segment.

## Routing Requirements

Fiber routing MUST:
1. Avoid overlap.
2. Avoid shared lanes unless an explicit future bundling rule allows it.
3. Avoid unnecessary crossing.
4. Avoid collisions between opposing sides.
5. Maintain minimum spacing.
6. Bend earlier when earlier bending prevents collision.
7. Use separate lanes when separate lanes are available.
8. Remain visually traceable from fan out exit to fusion splice dot [SDC-LAYOUT-002].
9. Avoid unnecessary center congestion [SDC-ROUTE-001].
10. Cross only when required for a valid destination transition.

## Bad Routing Patterns

FAIL this rule if:
- Two strands run directly on top of each other.
- Two strands run nearly parallel with no readable spacing.
- A strand crosses another strand when a clear route was available.
- Opposing strands enter the same center lane.
- A strand waits too long to bend and collides.
- Multiple strands cross in the same small area.
- A vertical route passes too close to a horizontal route without valid reason.
- A path makes the splice relationship unclear.

## Acceptable Routing Pattern

A route can be valid when:
- It leaves the fan out cleanly.
- It uses a dedicated lane.
- It maintains minimum spacing.
- It bends only when needed.
- It crosses only to reach a required higher/lower or left/right splice location.
- The crossing is short, controlled, and visually clear.
- It reaches the correct fusion splice dot without merging with another route.

## Validation

FAIL this rule if:
- A route overlaps another route.
- A route crosses unnecessarily.
- A route violates minimum spacing.
- A route shares a lane without permission.
- A route collides with a route from the opposite side.
- A route runs on top of another route for a meaningful distance.
- A route creates ambiguity about which strand connects to which splice dot.
- A route ignores an available cleaner path.

WARN if:
- A valid route requires a controlled crossing.
- Manual locks force a route to use a lower-quality path [SDC-UX-001].
- Dense routing is valid but difficult to read.

## Success Criteria

The rule passes when each strand remains visually separate, uses its own lane, avoids unnecessary crossing, and reaches its splice dot without ambiguity.

## Standard Interpretation
- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- MAY means optional behavior.
- FAIL means the validator should mark the layout or data as invalid for this rule.
- WARN means the app should keep the layout/data but notify the user or agent that quality is reduced.

## Inline Rule Citation Format
Use inline citations by rule ID when implementing or explaining behavior, for example: [SDC-GRID-001].


---

<!-- File: 12_SDC-UX-001_Auto_Layout_and_Manual_Locks.md -->
# Auto Layout and Manual Locks

Rule ID: SDC-UX-001
Related Rules: SDC-CORE-001, SDC-DATA-001, SDC-GRID-001, SDC-LAYOUT-001, SDC-LAYOUT-002, SDC-ROUTE-001, SDC-ROUTE-002, SDC-ROUTE-003
Reference Example Images/Docs: Project auto and manual adjustment source file
Rule Type: User interaction and layout constraints
Status: Active

## Purpose
Define how automatic layout and manual adjustment work together.

The app should not use a separate Auto Adjust / Manual Adjust toggle. Auto layout is always active. Manual edits become locked layout overrides that the auto layout engine must preserve.

## Core Concept

- Auto layout is always the main layout process.
- Manual adjustment is handled through locked overrides.
- Locked items are fixed constraints.
- Unlocked items remain controlled by auto layout.
- The grid remains the spatial source of truth for routing and occupancy [SDC-GRID-001].

## Primary Workflow

1. User imports a CSV.
2. App builds the splice data model [SDC-DATA-001].
3. App automatically places cables, buffer tubes, fanouts, strand routes, and splice dots.
4. User manually adjusts a component.
5. App saves the edit as a locked override.
6. Auto layout continues to run.
7. Locked components do not move.
8. Unlocked components auto-adjust around locked components.
9. User may unlock selected items, unlock groups, unlock all, or reset layout.

## Locking Behavior

A locked item MUST:
- Keep its position during future auto adjustments.
- Be recognized by the routing engine as occupied space.
- Be saved in the diagram config.
- Reload in the same position.
- Be treated as blocked or manual-locked grid space [SDC-GRID-001].

Auto layout MUST NOT silently move a locked item. If locked items prevent a clean layout, the app should warn the user.

## Manual Adjustment Scope

### Cable Position Adjustment
The user may drag a fiber cable node. When moved, the cable position becomes locked. Connected buffer tubes, fanouts, and strands remain attached.

### Buffer Tube / Fan Out Adjustment
The user may move a buffer tube or fan out area. Once adjusted, it becomes locked. Routes should adjust around it while respecting fan out and routing zone rules [SDC-LAYOUT-002], [SDC-ROUTE-001].

### Fiber Strand Leg / Lane Adjustment
The user may adjust a fiber strand leg, usually a vertical lane segment. The strand remains connected to its fan out exit and fusion splice dot. The adjusted lane becomes a locked override [SDC-GRID-001].

### Fusion Splice Dot Adjustment
The user may move a fusion splice dot horizontally, or along allowed axes based on future dot placement rules. Connected strand legs reconnect to the new dot position. The dot becomes locked.

### Bundle / Group Adjustment
The user may lock a group of related strands, such as fibers from the same buffer tube. The locked bundle should preserve its spacing and relative shape [SDC-ROUTE-002], [SDC-LAYOUT-001].

## Auto Adjustment Rules With Locks

Auto layout MAY move unlocked items.

Auto layout MUST NOT move locked items.

Auto layout MUST treat locked items as fixed obstacles and route unlocked items around them where possible [SDC-ROUTE-003].

Auto layout SHOULD preserve locked edits across:
- Imports of the same data.
- Reloads.
- PDF exports.
- Config saves.
- Retry layout attempts.

## Cable Side Move / Mirror / Flip Rule

Dragging a fiber cable across sides is a structural side-change event, not a simple x/y move.

When a cable changes sides, the app MUST:

1. Update cable side.
2. Mirror cable geometry so the cable faces inward.
3. Mirror buffer tubes, fanouts, labels, handles, and attached strand endpoints.
4. Preserve imported splice connections [SDC-DATA-001].
5. Reroute affected unlocked strands.
6. Preserve pinned strand lanes and pinned splice dots where possible.
7. Apply normal ordering, spacing, fan out, routing zone, nesting, and collision rules.
8. Lock the dropped cable position after the side change.

## Side Direction Requirements

After a side move:
- Left-side cables fan out toward the right.
- Right-side cables fan out toward the left.
- Top-side cables fan out downward.
- Bottom-side cables fan out upward [SDC-LAYOUT-002].

## Warnings

The app SHOULD warn when locked items cause:
- Fiber strand overlap.
- Lane spacing issues.
- Fusion dot too close to a bend.
- Too many bends.
- Blocked clean routing.
- Label collisions.
- Routing outside the zone [SDC-ROUTE-001], [SDC-ROUTE-003].

Warnings should not silently unlock or move user-locked items.

## Reset / Unlock Options

The user MUST be able to:
- Unlock one selected item.
- Unlock a selected group or bundle.
- Unlock all manual adjustments.
- Reset the full diagram to pure auto layout.

## Validation

FAIL this rule if:
- Auto layout moves a locked item without user action.
- A locked item is not treated as occupied space.
- A manual edit breaks data connections.
- A cable side move fails to mirror attached components.
- Locked positions are not saved or restored.

WARN if:
- Locks make a valid clean route impossible.
- Locks force rule violations in spacing or collision checks.
- The user creates a layout that is technically connected but visually poor.

## Success Criteria

The rule passes when auto layout remains active, manual edits become predictable locks, locked items are preserved, and unlocked items route around fixed constraints without changing imported splice data.

## Standard Interpretation
- MUST means required behavior.
- SHOULD means preferred behavior unless a higher-priority rule prevents it.
- MAY means optional behavior.
- FAIL means the validator should mark the layout or data as invalid for this rule.
- WARN means the app should keep the layout/data but notify the user or agent that quality is reduced.

## Inline Rule Citation Format
Use inline citations by rule ID when implementing or explaining behavior, for example: [SDC-GRID-001].


---

<!-- File: 13_Big_Picture_Review.md -->
# Big Picture Rule Review

## Overall Finding

No direct hard contradiction was found in the current rule set. The rules are mostly aligned around one consistent model:

```text
CSV import -> cable hierarchy -> color/count validation -> fanout layout -> grid routing -> nested lane bands -> collision/spacing validation -> manual locks/export
```

The rule set is strongest when the app treats routing as a grid-based, hierarchy-aware layout problem instead of drawing unrelated SVG lines.

## Important Clarifications Needed

### 1. Grid Source of Truth vs Auto Layout Source of Truth
There is no real conflict if these are defined separately:
- The grid is the spatial source of truth for lanes, occupancy, bends, blocked areas, and route segments [SDC-GRID-001].
- Auto layout is the process that uses the grid to place and route components [SDC-UX-001].
- Manual locks are fixed constraints inside the grid [SDC-UX-001].

### 2. Nesting vs Collision Prevention
Nesting keeps related strands together [SDC-ROUTE-002]. Collision prevention keeps routes valid [SDC-ROUTE-003].

Resolution: collision, spacing, reserved areas, and valid routing override perfect nesting. Nesting should break only as much as needed.

### 3. Color Order vs Final Route Position
Color order controls buffer tube order, fan out order, and preferred group lane order [SDC-ORDER-001], [SDC-ORDER-002].

Resolution: routing may locally separate strands near splice dots if required, but it must never renumber strands or lose parent relationships [SDC-DATA-002].

### 4. No Crossing vs Allowed Crossing Exception
The rules correctly allow one crossing exception [SDC-LAYOUT-001], [SDC-ROUTE-003].

Resolution: crossing is only valid when a strand or group must transition to reach its assigned splice location and no cleaner lane exists. It must not become a shared lane or long overlap.

### 5. 6-Count vs 12-Count Buffer Tubes
Buffer tube count affects how many strands are inside each buffer tube [SDC-DATA-002]. Buffer tube color order still uses the normal buffer tube color sequence [SDC-ORDER-001].

Resolution: keep these separate. Tube count does not change tube color order.

### 6. Dynamic Spacing Needs Config Values
Spacing rules mention minimum and maximum values, but only routing zone bend clearance has a default value of 60px [SDC-ROUTE-001].

Resolution: create a future layout constants/defaults rule, or define defaults inside [SDC-LAYOUT-001].

### 7. Four-Sided Layout Needs Connection/Dot Placement Rules
The four-sided layout is well defined at a high level [SDC-CORE-001], [SDC-GRID-001], but fusion splice dot placement is not yet fully specified.

Resolution: create a fusion splice dot placement and connection pairing rule.

## Proposed Rule Priority Order

1. CSV import/schema normalization. Future [SDC-IMPORT-001].
2. Cable data hierarchy [SDC-DATA-001].
3. Buffer tube count and strand number validation [SDC-DATA-002].
4. Color order validation [SDC-ORDER-001], [SDC-ORDER-002].
5. Fanout generation and label reservation [SDC-LAYOUT-002].
6. Routing zone calculation [SDC-ROUTE-001].
7. Grid lane setup and occupancy [SDC-GRID-001].
8. Manual locks as fixed constraints [SDC-UX-001].
9. Nested group/lane band assignment [SDC-ROUTE-002].
10. Route generation [SDC-GRID-001], [SDC-ROUTE-001].
11. Collision/crossing/spacing validation [SDC-ROUTE-003], [SDC-LAYOUT-001].
12. Layout scoring/retry. Future [SDC-SCORE-001].
13. Export/persistence. Future [SDC-EXPORT-001].

## Recommendation for Cursor/AI Agents

The agent should implement the rules as validators and layout constraints, not as loose prose. Each route should be testable against:
- data hierarchy
- count/order
- fanout exits
- routing zone
- grid lane occupancy
- spacing buffer
- collision/crossing rules
- manual locks
- group nesting

The biggest implementation risk is treating strands as independent SVG paths too early. The engine should first build groups and lane bands, then route individual strands inside those groups.


---

<!-- File: 14_Suggested_Additional_Rules.md -->
# Suggested Additional Rule Documents

## 1. CSV Import, Normalization, and Bentley Compatibility
Suggested Rule ID: SDC-IMPORT-001

Purpose:
Define how Bentley OpenComms Designer CSV exports are parsed, normalized, validated, and protected from corruption after user edits.

Should include:
- Required headers.
- Accepted delimiters and line endings.
- Encoding handling.
- Quoted fields.
- Empty rows.
- Hidden/special columns.
- Cable identity normalization.
- Connection pairing extraction.
- Error messages when a modified CSV cannot be parsed.
- Confidence/warning behavior when data is inferred.

Why it matters:
Routing quality depends on correct imported data. This rule should run before [SDC-DATA-001].

## 2. Fusion Splice Dot and Connection Pairing
Suggested Rule ID: SDC-CONNECT-001

Purpose:
Define how imported connection rows create fusion splice dots and how each dot is placed, ordered, locked, and validated.

Should include:
- One splice dot per physical splice pair.
- Dot placement order.
- Dot spacing.
- Dot-to-strand endpoint mapping.
- Dot lock behavior.
- Multi-side connection behavior in four-sided mode.
- Handling missing or one-sided/unconnected strands.

Why it matters:
Current rules define strands routing to fusion splice dots, but dot creation and placement need their own source of truth.

## 3. Route Scoring, Retry Layout, and Rule Priority
Suggested Rule ID: SDC-SCORE-001

Purpose:
Define how the app scores layouts and chooses between multiple valid attempts.

Should include:
- Hard failures vs soft warnings.
- Score weights for overlaps, crossings, bends, path length, congestion, nesting quality, fanout spacing, and manual locks.
- Retry layout limits.
- Tie-breaking rules.
- Deterministic output requirement.

Why it matters:
Many rules say the engine should choose the cleanest layout. Scoring needs a dedicated rule so the app behaves predictably.

## 4. Label Placement and Text Collision
Suggested Rule ID: SDC-LABEL-001

Purpose:
Define placement, size, truncation, collision handling, and reserved grid areas for OS circuit names, fiber abbreviations, cable labels, and buffer tube labels.

Should include:
- Label anchor points.
- Side-based orientation.
- Truncation behavior.
- Font size limits.
- Collision detection.
- Label reserved areas.
- PDF export legibility.

Why it matters:
Several rules mention labels, but label behavior is currently spread across fanout, spacing, and routing zone rules.

## 5. Orthogonal Path Geometry and Bend Limits
Suggested Rule ID: SDC-ROUTE-004

Purpose:
Define the exact allowed shape of fiber routes.

Should include:
- Horizontal/vertical segment rules.
- Approved bend types.
- Bend count limits.
- Bend clearance around splice dots.
- Segment simplification.
- How routes connect to fanout exits and splice dots.

Why it matters:
The grid rule implies orthogonal paths, but route geometry should be explicit for implementation.

## 6. Layout Modes, Side Assignment, and Cable Placement
Suggested Rule ID: SDC-LAYOUT-003

Purpose:
Define how the app chooses left/right/top/bottom cable placement during auto layout and retry layout.

Should include:
- Two-sided vs four-sided triggers.
- Side scoring.
- Cable ordering on each side.
- Side move behavior references [SDC-UX-001].
- Cleanest-side selection.

Why it matters:
The current grid and glossary rules support four-sided layout, but side assignment deserves its own rule.

## 7. Validation Messages and Severity Levels
Suggested Rule ID: SDC-VALIDATE-001

Purpose:
Define standard validation output for AI agents and UI messages.

Should include:
- Error vs warning vs info.
- Rule ID included in every validation result.
- Object IDs included in every result.
- Suggested fix text.
- Whether PDF export is blocked or allowed.

Why it matters:
This makes rule failures actionable during development and user cleanup.

## 8. Persistence, Config, PDF Export, and Reimport
Suggested Rule ID: SDC-EXPORT-001

Purpose:
Define how the app saves the diagram, manual locks, layout state, and export metadata.

Should include:
- JSON config schema.
- PDF export requirements.
- Optional embedded JSON in PDF.
- Security considerations.
- Reimport behavior.
- Versioning/migrations.

Why it matters:
Manual locks and layout choices must survive reloads and exports [SDC-UX-001].

## 9. Visual Color Rendering and Legend
Suggested Rule ID: SDC-VISUAL-001

Purpose:
Define exact rendered colors, stroke widths, strand layering, striped tube styling, and legend behavior.

Should include:
- Fiber strand colors.
- Buffer tube colors.
- Striped tube rendering.
- Stroke width.
- Selection/hover styles.
- Layer order for controlled crossings [SDC-ROUTE-003].

Why it matters:
The current rules define color order and abbreviations, but not exact visual rendering.


---

