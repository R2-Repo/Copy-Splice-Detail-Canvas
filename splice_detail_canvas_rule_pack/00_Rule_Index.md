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
