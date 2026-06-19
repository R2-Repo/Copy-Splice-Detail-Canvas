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
