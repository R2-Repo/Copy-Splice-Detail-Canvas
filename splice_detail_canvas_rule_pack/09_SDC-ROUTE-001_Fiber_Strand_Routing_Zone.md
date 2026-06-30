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

## Routing Zone Shape

The routing zone is the open **routing box** in the center of the diagram — bounded by the inner edges of cable fan-outs, not the canvas edge.

There is no separate two-sided vs four-sided user mode. Edge population is whatever the import routing search selects [SDC-LAYOUT-003], [SDC-SCORE-001]. The routing box shape follows whichever edges hold cables.

### Valid center zone — two cases

**Case A — Two-sided (left and right only)**

- **Horizontal bounds:** between the inner edges of the left and right fan-out / handle columns.
- **Vertical bounds:** from the **topmost fiber row** to the **bottommost fiber row** on the left and right cables.
- Strands must not route above the highest left/right fiber or below the lowest left/right fiber.

**Case B — Four-sided (includes top and/or bottom cables)**

- **Horizontal bounds:** still between the inner edges of the left and right fan-out regions (when populated).
- **Vertical bounds:** between the **inner edge of the top cable fan-out/label band** and the **inner edge of the bottom cable fan-out/label band** — i.e. inward from the top/bottom cable content (between fan-out labels and fiber color abbreviations), not the outer canvas edge.
- Strands must not shoot above the top cable band or below the bottom cable band and loop back through empty space.

Strands from every populated edge share the same center routing box [SDC-CORE-001], [SDC-GRID-001]. See [`docs/agent/QUAD_LAYOUT.md`](../docs/agent/QUAD_LAYOUT.md) for top/bottom render geometry.

### Never allowed

- Leaving the routing box to dodge congestion [SDC-ROUTE-003].
- Running over cable bodies, buffer tubes, fan-outs, or labels [SDC-LAYOUT-002].
- Taking a long arc above or below the cable content and looping back.

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
