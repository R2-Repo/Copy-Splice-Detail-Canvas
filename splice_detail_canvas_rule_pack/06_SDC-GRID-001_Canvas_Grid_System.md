# Canvas Grid System

Rule ID: SDC-GRID-001
Related Rules: SDC-CORE-001, SDC-LAYOUT-001, SDC-LAYOUT-002, SDC-ROUTE-001, SDC-ROUTE-002, SDC-ROUTE-003, SDC-UX-001
Reference Example Images/Docs: Project canvas grid system source file
Rule Type: Layout and routing infrastructure
Status: Active

## Purpose
Use an invisible grid as the main structure for automatic layout, fiber routing, collision detection, manual adjustment, and retry layout generation.

The grid is the spatial source of truth for routing. Auto layout is the process that uses the grid [SDC-UX-001].

## Grid pitch constant

The canvas grid MUST use a **24px** base pitch on both axes [SDC-GRID-001]. This is the same constant as:

- Fiber row pitch within a buffer tube [SDC-ORDER-002].
- Minimum strand lane separation in the routing zone [SDC-LAYOUT-001], [SDC-ROUTE-003].
- Fan-out and nesting rhythm [SDC-LAYOUT-002], [SDC-ROUTE-002].

Grid lines, lane reservation, and strand spacing MUST NOT stretch or compress this pitch to fill space.

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

## Multi-Edge Layout Support

The grid MUST support these zones:

```text
Top cable zone
Left cable zone
Right cable zone
Bottom cable zone
Center routing grid
```

Cables MAY be placed on left, right, top, or bottom edges. Side assignment is determined by the import routing optimizer — not by a user layout-mode toggle [SDC-CORE-001], [SDC-SCORE-001]. Any subset of edges may be populated; unused edges remain empty.

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
