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
