# Big Picture Rule Review

## Overall Finding

No direct hard contradiction was found in the current rule set. The rules are mostly aligned around one consistent model:

```text
CSV import -> cable hierarchy -> color/count validation -> fanout layout -> grid routing -> nested lane bands -> collision/spacing validation -> manual locks/export
```

The rule set is strongest when the app treats routing as a grid-based, hierarchy-aware layout problem instead of drawing unrelated SVG lines.

## Important Clarifications Needed

### 1. Grid Source of Truth vs Auto Layout Source of Truth
There is no real conflict if these are defined separately:
- The grid is the spatial source of truth for lanes, occupancy, bends, blocked areas, and route segments [SDC-GRID-001].
- Auto layout is the process that uses the grid to place and route components [SDC-UX-001].
- Manual locks are fixed constraints inside the grid [SDC-UX-001].

### 2. Nesting vs Collision Prevention
Nesting keeps related strands together [SDC-ROUTE-002]. Collision prevention keeps routes valid [SDC-ROUTE-003].

Resolution: collision, spacing, reserved areas, and valid routing override perfect nesting. Nesting should break only as much as needed.

### 3. Color Order vs Final Route Position
Color order controls buffer tube order, fan out order, and preferred group lane order [SDC-ORDER-001], [SDC-ORDER-002].

Resolution: routing may locally separate strands near splice dots if required, but it must never renumber strands or lose parent relationships [SDC-DATA-002].

### 4. No Crossing vs Allowed Crossing Exception
The rules correctly allow one crossing exception [SDC-LAYOUT-001], [SDC-ROUTE-003].

Resolution: crossing is only valid when a strand or group must transition to reach its assigned splice location and no cleaner lane exists. It must not become a shared lane or long overlap.

### 5. 6-Count vs 12-Count Buffer Tubes
Buffer tube count affects how many strands are inside each buffer tube [SDC-DATA-002]. Buffer tube color order still uses the normal buffer tube color sequence [SDC-ORDER-001].

Resolution: keep these separate. Tube count does not change tube color order.

### 6. Dynamic Spacing Needs Config Values
Spacing rules mention minimum and maximum values, but only routing zone bend clearance has a default value of 60px [SDC-ROUTE-001].

Resolution: create a future layout constants/defaults rule, or define defaults inside [SDC-LAYOUT-001].

### 7. Multi-Edge Layout Needs Connection/Dot Placement Rules
Import-driven cable placement on any edge (left, right, top, bottom) is defined at a high level [SDC-CORE-001], [SDC-GRID-001], but fusion splice dot placement is not yet fully specified.

Resolution: create a fusion splice dot placement and connection pairing rule.

## Proposed Rule Priority Order

1. CSV import/schema normalization. Future [SDC-IMPORT-001].
2. Cable data hierarchy [SDC-DATA-001].
3. Buffer tube count and strand number validation [SDC-DATA-002].
4. Color order validation [SDC-ORDER-001], [SDC-ORDER-002].
5. Fanout generation and label reservation [SDC-LAYOUT-002].
6. Routing zone calculation [SDC-ROUTE-001].
7. Grid lane setup and occupancy [SDC-GRID-001].
8. Manual locks as fixed constraints [SDC-UX-001].
9. Nested group/lane band assignment [SDC-ROUTE-002].
10. Route generation [SDC-GRID-001], [SDC-ROUTE-001].
11. Collision/crossing/spacing validation [SDC-ROUTE-003], [SDC-LAYOUT-001].
12. Layout scoring/retry. Future [SDC-SCORE-001].
13. Export/persistence. Future [SDC-EXPORT-001].

## Recommendation for Cursor/AI Agents

The agent should implement the rules as validators and layout constraints, not as loose prose. Each route should be testable against:
- data hierarchy
- count/order
- fanout exits
- routing zone
- grid lane occupancy
- spacing buffer
- collision/crossing rules
- manual locks
- group nesting

The biggest implementation risk is treating strands as independent SVG paths too early. The engine should first build groups and lane bands, then route individual strands inside those groups.
