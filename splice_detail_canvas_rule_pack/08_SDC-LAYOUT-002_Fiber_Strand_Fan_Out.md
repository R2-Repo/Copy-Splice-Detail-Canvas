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
