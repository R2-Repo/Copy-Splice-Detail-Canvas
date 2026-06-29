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

## Minimum strand pitch

Individual fiber strand routes MUST maintain the **24px** grid pitch [SDC-GRID-001], [SDC-ORDER-002] in all directions. This applies around bends, lane transitions, fan-out exits, and fusion splice dots.

## Near-straight alignment (import)

During automatic layout, cable and fan-out positions SHOULD be nudged so near-horizontal or near-vertical strand runs become straight. Tiny unnecessary jogs (a few pixels) MUST NOT remain when a straight run is feasible without violating higher-priority hard rules.

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
