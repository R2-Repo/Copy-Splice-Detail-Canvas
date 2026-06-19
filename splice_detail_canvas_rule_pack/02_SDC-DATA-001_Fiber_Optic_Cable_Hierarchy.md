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
