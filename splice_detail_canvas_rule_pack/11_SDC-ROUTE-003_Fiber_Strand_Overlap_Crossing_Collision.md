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
