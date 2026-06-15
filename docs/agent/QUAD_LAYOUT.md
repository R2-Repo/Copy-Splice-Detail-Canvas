# Quad (4-side) layout — feature handoff

> **Status (2026-06-14):** MVP auto engine shipped and verified. Feature is **paused** — usable for exploration and cable drag, but not production-complete. Pick up from the backlog below when resuming quad work.
>
> **Canonical for agents:** read this file before any quad placement, routing, or geometry change. Do **not** edit frozen horizontal routing (`spliceEdgeRouting.ts`, `manualAdjust/*`) for quad fixes.

## What it is

Optional layout mode: cables sit on **four sides** of the diagram (left, right, top, bottom) with buffer tubes and fiber legs fanning **inward** toward the center. Splice legs are orthogonal port-to-dot paths (same render contract as horizontal mode: precomputed `leftPath` / `rightPath` on `SpliceEdge`).

**Toggle:** toolbar segmented control **Left/right ↔ 4-side**, next to Auto/Manual. Persisted per diagram as `layoutMode: "quad"` in layout overrides and in `.sdc.json` export/import.

**Horizontal (two-sided) mode is unchanged.** Everything quad-specific is gated behind `overrides.layoutMode === "quad"`.

## User vocabulary (simple terms)

| User says | Quad meaning |
|-----------|----------------|
| **Corner** | 90° bend on a splice leg (left or right of fusion dot) |
| **Same-side loop back** | Two cables on the same edge meet via a jog just inside the cables — should be rare after placement fix |
| **Center nest / crowded center** | Too many fusion dots and legs stacked in the middle — channel router spreads lanes but large diagrams may still need tuning |
| **Tube / fiber order** | TIA order: blue → orange → green → brown. Top/bottom cables read **left→right**; left/right read **top→down** |

See also [`SIMPLE_TERMS.md`](./SIMPLE_TERMS.md) and [`CANVAS_GLOSSARY.md`](./CANVAS_GLOSSARY.md).

## Architecture

```mermaid
flowchart TD
  csv[Bentley CSV / .sdc.json] --> graph[buildConnectionGraph]
  graph --> gate{layoutMode === quad?}
  gate -->|no| horizontal[buildReactFlowGraph horizontal pipeline]
  gate -->|yes| quad[buildQuadReactFlowGraph]
  quad --> placement[quadPlacement.computeQuadPlacement]
  quad --> geometry[quadGeometry handles + box size]
  quad --> orient[orientTubesForQuadSide top flip]
  quad --> anchors[fiberAnchor + splicePoint nodes]
  quad --> frontiers[quadChannels.computeQuadFrontiers]
  quad --> router[quadRouter.createQuadRouter]
  router --> edges[precomputed SpliceEdge paths]
  edges --> canvas[WorkflowCanvas render]
```

### Engine fork

[`buildReactFlowGraph.ts`](../../src/features/diagram/buildReactFlowGraph.ts) early-returns when `overrides.layoutMode === "quad"`:

```ts
if (overrides?.layoutMode === "quad") {
  return buildQuadReactFlowGraph(graph, overrides, layoutWidth, buildOptions);
}
```

Quad reuses the same node/edge types as horizontal: `cable`, `fiberAnchor`, `splicePoint`, `splice` edges with `routingPrecomputed: true`.

### Module map (`src/features/diagram/quad/`)

| File | Role |
|------|------|
| `quadTypes.ts` | `QuadSide`, `axisForSide`, `inwardDirection`, `QUAD_SIDES` |
| `quadGeometry.ts` | Affine map: canonical left breakout → placed side; `quadFiberHandleCenter`, `quadCableBoxSize`, `quadRenderTransform`, `orientTubesForQuadSide` (top blue-first flip) |
| `quadPlacement.ts` | Auto side assignment + cable positions on the four edges; `computeQuadPlacement` |
| `quadChannels.ts` | `computeQuadFrontiers` (inner handle envelope), `LaneAllocator` (24px lane packing) |
| `quadRouter.ts` | `createQuadRouter(frontiers, center)` — orthogonal routing, minimal bends |
| `buildQuadReactFlowGraph.ts` | Full quad pipeline: placement → oriented tubes → anchors → frontiers → route → nodes/edges |

### Tests

| File | Covers |
|------|--------|
| `buildQuadReactFlowGraph.test.ts` | 4+ sides used, anchors in box, horizontal untouched, placement same-side invariant, top blue-first order (`Left-SPI-215_I-80.csv`) |
| `quadRouter.test.ts` | LaneAllocator, perpendicular L, straight aligned, jog spread, same-side loop |

Run: `npx vitest run src/features/diagram/quad/` or full `npm run verify`.

### Canvas integration (additive only)

[`WorkflowCanvas.tsx`](../../src/features/canvas/WorkflowCanvas.tsx):

- `layoutMode` state + toolbar toggle; persisted via `mergeLayoutOverrides`.
- `refreshDragRouting` / `onNodeDrag*` **early-return** to `syncQuadCableDrag` when `layoutMode === "quad"` — **before** any horizontal manual/auto drag logic.
- Quad cable drag: rebuild graph with saved positions, reroute all legs.

[`CableNode.tsx`](../../src/features/canvas/nodes/CableNode.tsx): top/bottom cables wrapped in `quadRenderTransform` (+90° / −90° CSS). [`FiberAnchorNode.tsx`](../../src/features/canvas/nodes/FiberAnchorNode.tsx): handle positions by `quadSide`.

## Persistence

| Field | Scope | Notes |
|-------|--------|------|
| `layoutMode` | `"horizontal"` \| `"quad"` | Which engine runs |
| `quadCableSides` | `Record<visualCableId, QuadSide>` | User-pinned side per cable in quad mode |
| `cableSides` | L/R only | **Separate** from quad; not clobbered |
| `positions` | Shared | **Not namespaced per mode** — toggling L/R ↔ 4-side re-runs that mode's auto layout; drag positions from one mode do not carry to the other |

Import: [`restoreDiagramConfig.ts`](../../src/features/export/restoreDiagramConfig.ts) skips cable de-overlap nudge in quad mode.

## Routing behavior (auto)

`createQuadRouter` assigns each splice to a lane between **frontiers** (inner edges of placed handles), not the diagram center line.

| Pair type | Behavior |
|-----------|----------|
| Perpendicular (e.g. left ↔ top) | Single **L** at axis intersection — 0 interior bends |
| Opposite, same row/column | **Straight** line |
| Opposite, offset rows | One **jog** onto nearest free vertical/horizontal lane |
| Same side | Tight loop just inside cables on dedicated lane |

Lanes pack with `SPLICE_LANE_SEP` (24px) via `LaneAllocator`.

**Placement** (`assignSides`): dominant pair → left/right; each remaining stub → side **perpendicular to its heaviest neighbor** (never same side when one neighbor dominates >50% of links).

## What works today

- Toggle 4-side layout; import CSV or `.sdc.json`; export config with `layoutMode: "quad"`.
- Auto placement and channel/lane routing for typical multi-cable splices.
- Cable drag in **auto** mode (live reroute + position persist).
- Top-cable TIA color order blue-first left→right (via `orientTubesForQuadSide`).
- Regression tests on Example #2 + `Left-SPI-215_I-80.csv`.
- Full `npm run verify` green with horizontal layout contract untouched (114/114 layout, 475+ ci).

## Known gaps (expect bugs on complex diagrams)

User QA on **SPI-215 I-80** and similar large splices surfaced areas still needing iteration:

1. **Routing density** — center and side bands can still feel crowded on very busy diagrams; side **gap bands** (blank space above/below left/right cable stacks) are not fully exploited yet.
2. **Path length** — some legs may still travel farther than necessary before bending; router picks nearest lane to midpoint but does not do global crossing minimization.
3. **Manual adjust** — per-leg / fusion-dot drag (**Manual** toolbar mode) is **not implemented** for quad; only cable-column drag works.
4. **Labels on top/bottom** — cable titles and tube labels follow rotated breakout; upright (counter-rotated) labels deferred.
5. **Mode toggle positions** — shared `positions` map means switching Left/right ↔ 4-side loses per-mode cable positions.
6. **Layout rules contract** — `npm run test:layout` validates **horizontal** Examples #1–#3 only; quad has its own tests under `quad/` but no formal layout-rule IDs yet.

## Backlog (when resuming)

Priority order suggested from user feedback and architecture:

### P0 — Stability on real imports

- [ ] Manual smoke pass: `Left-SPI-215_I-80.csv`, `Left-SP-3254.5.csv`, user `.sdc.json` configs in 4-side mode; file issues with cable id + symptom.
- [ ] Tune router to use **side gap bands** explicitly (inter-cable vertical gaps on left/right stacks) before falling back to center banks.
- [ ] Shortest-path bias: avoid crossing to far side when target is on adjacent perpendicular edge.

### P1 — Manual adjust (separate engine)

- [ ] Parallel quad manual path — **do not** extend `handleCoords.ts` or frozen `spliceEdgeRouting.ts`.
- [ ] New module e.g. `src/features/quadManualAdjust/` or `diagram/quad/quadManualAdjust.ts`: quad handle coords, leg drag, fusion-dot drag, warn-don't-revert rules.
- [ ] Wire `WorkflowCanvas` manual guards for quad (mirror pattern of existing early-returns).

### P2 — Placement quality

- [ ] Crossing-minimizing side assignment (barycentric / median around ring), not just perpendicular-to-neighbor heuristic.
- [ ] Optional user pin UI for `quadCableSides` (today: persistence field only).

### P3 — Polish

- [ ] Namespace positions: `positionsHorizontal` / `positionsQuad` (or nested by mode) — requires migration in `LayoutOverrides`.
- [ ] Upright labels on rotated top/bottom cables.
- [ ] Quad-specific layout rule IDs in `LAYOUT_RULES.md` + tests if quad becomes production-default.

## Do not touch (without explicit user approval)

- **Frozen horizontal routing:** symbols listed in [`.cursor/rules/frozen-routing.mdc`](../../.cursor/rules/frozen-routing.mdc) and all of `src/features/manualAdjust/*`.
- **`handleCoords.ts`** — widen for quad; build quad-specific coords instead.
- **Horizontal behavior when `layoutMode !== "quad"`** — must remain byte-identical.

## Safe extension pattern

1. Change only under `src/features/diagram/quad/` plus additive canvas guards in `WorkflowCanvas.tsx`.
2. Keep router **pure** (no shared mutable state with horizontal pipeline).
3. Add tests in `quad/*.test.ts` before tuning heuristics.
4. Run `npm run verify` — layout 114/114 must stay green.

## Manual QA checklist

1. Import `docs/reference/examples/Left-SPI-215_I-80.csv`.
2. Toggle **4-side** in toolbar.
3. Confirm: cables on 3–4 sides; dominant pair left/right; stubs not same-side as dominant neighbor.
4. Confirm: top cable reads **BL** leftmost; bottom matches; left/right read BL topmost.
5. Confirm: fusion dots spread in open region (not one vertical line at exact center).
6. Drag a cable in **Auto** mode — legs reroute, position persists after reload/export.
7. Toggle back to **Left/right** — horizontal layout unchanged from pre-quad baseline.
8. Export `.sdc.json` — `layoutMode: "quad"` and positions restore on import.

## History (compressed)

| Date | Milestone |
|------|-----------|
| 2026-06-14 | Initial quad engine: toggle, geometry, placement v1, router v1, persistence |
| 2026-06-14 | Refinement: perpendicular placement, channel/lane router, top blue-first color order |
| 2026-06-14 | **Paused** — documentation handoff; resume from backlog above |

Detailed session notes remain in [`CONTEXT.md`](./CONTEXT.md) and [`HANDOFF.md`](./HANDOFF.md) under "2026-06-14 quad" sections.
