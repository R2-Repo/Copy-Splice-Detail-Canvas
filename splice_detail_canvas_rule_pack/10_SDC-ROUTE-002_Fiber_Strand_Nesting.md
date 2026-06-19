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
