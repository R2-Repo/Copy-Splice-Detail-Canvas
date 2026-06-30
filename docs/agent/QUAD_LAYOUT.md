# Top/bottom edge geometry — render reference

> **Status (2026-06-29):** There is **no user layout-mode toggle**. Import uses the routing-first optimizer ([`ROUTING_FIRST_LAYOUT.md`](./ROUTING_FIRST_LAYOUT.md)) to pick cable edges (L/R/T/B). This file documents the **top/bottom render adapters** in `src/features/diagram/quad/` — reused when the optimizer places cables on those edges.
>
> **Canonical for agents:** read this file before changing top/bottom cable geometry, fan-out orientation, or quad-channel routing. Do **not** edit frozen horizontal routing (`spliceEdgeRouting.ts`, `manualAdjust/*`) for top/bottom fixes.

## Product model (current)

On CSV import:

1. The layout search tries many cable placements across all four edges.
2. Every fiber strand is routed on the internal grid.
3. SDC rules score each candidate; the best feasible layout is painted.
4. **Cable side is a search output** — not a toolbar setting [SDC-CORE-001], [SDC-SCORE-001].

A diagram that ends up with only left/right cables is a valid **outcome**, not a separate mode. Top and bottom edges appear when routing optimization needs them.

## What the quad module provides

When a cable lands on **top** or **bottom**, the app uses quad geometry helpers so buffer tubes and fiber legs fan **inward** toward the center. Splice legs stay orthogonal port-to-dot paths (precomputed `leftPath` / `rightPath` on `SpliceEdge`).

Left/right cables continue to use the horizontal breakout pipeline. The unified import path selects render adapters from the winning candidate's side assignment — see `candidateToGraph.ts` and `evaluateCandidate.ts`.

## User vocabulary (simple terms)

| User says | Top/bottom edge meaning |
|-----------|-------------------------|
| **Corner** | 90° bend on a splice leg (left or right of fusion dot) |
| **Same-side loop back** | Two cables on the same edge meet via a jog just inside the cables |
| **Center nest / crowded center** | Too many fusion dots and legs stacked in the middle |
| **Tube / fiber order** | TIA order: blue → orange → green → brown. Top/bottom cables read **left→right**; left/right read **top→down** |

See also [`SIMPLE_TERMS.md`](./SIMPLE_TERMS.md) and [`CANVAS_GLOSSARY.md`](./CANVAS_GLOSSARY.md).

## Architecture (import path)

```mermaid
flowchart TD
  csv[Bentley CSV] --> graph[buildConnectionGraph]
  graph --> search[layoutSearch]
  search --> eval[evaluateLayoutCandidate]
  eval --> sides{candidate cable sides}
  sides -->|L/R only| horizontal[horizontal breakout + grid route]
  sides -->|includes T/B| quadGeo[quad geometry + channels]
  horizontal --> render[buildReactFlowGraph / candidateToGraph]
  quadGeo --> render
  render --> canvas[WorkflowCanvas]
```

Legacy `buildQuadReactFlowGraph` remains for tests and backward-compat config restore; **import no longer forks on a user `layoutMode` toggle**.

### Module map (`src/features/diagram/quad/`)

| File | Role |
|------|------|
| `quadTypes.ts` | `QuadSide`, `axisForSide`, `inwardDirection`, `QUAD_SIDES` |
| `quadGeometry.ts` | Affine map: canonical left breakout → placed side; `quadFiberHandleCenter`, `quadCableBoxSize`, `quadRenderTransform`, `orientTubesForQuadSide` (top blue-first flip) |
| `quadPlacement.ts` | Side assignment + cable positions on four edges (used by search seeds and legacy path) |
| `quadChannels.ts` | `computeQuadFrontiers` (inner handle envelope), `LaneAllocator` (24px lane packing) |
| `quadRouter.ts` | `createQuadRouter(frontiers, center)` — orthogonal routing, minimal bends |
| `buildQuadReactFlowGraph.ts` | Legacy full quad pipeline (tests / `.sdc.json` restore) |

### Canvas integration

[`CableNode.tsx`](../../src/features/canvas/nodes/CableNode.tsx): top/bottom cables wrapped in `quadRenderTransform` (+90° / −90° CSS). [`FiberAnchorNode.tsx`](../../src/features/canvas/nodes/FiberAnchorNode.tsx): handle positions by `quadSide`.

When the winning candidate includes top/bottom cables, drag routing uses quad-specific sync paths in `WorkflowCanvas.tsx`.

## Persistence (legacy fields)

| Field | Notes |
|-------|--------|
| `layoutMode` | **Deprecated for user control.** May appear in older `.sdc.json` exports for backward compat. Import ignores user mode selection. |
| `quadCableSides` | Per-cable edge from optimizer or saved config |
| `cableSides` | L/R proxy for horizontal pipeline bridge |

## Routing behavior (top/bottom channels)

`createQuadRouter` assigns each splice to a lane between **frontiers** (inner edges of placed handles), not the diagram center line.

| Pair type | Behavior |
|-----------|----------|
| Perpendicular (e.g. left ↔ top) | Single **L** at axis intersection — 0 interior bends |
| Opposite, same row/column | **Straight** line |
| Opposite, offset rows | One **jog** onto nearest free vertical/horizontal lane |
| Same side | Tight loop just inside cables on dedicated lane |

Lanes pack with `SPLICE_LANE_SEP` (24px) via `LaneAllocator`.

## Tests

| File | Covers |
|------|--------|
| `buildQuadReactFlowGraph.test.ts` | Multi-edge placement, anchors in box, top blue-first order |
| `quadRouter.test.ts` | LaneAllocator, perpendicular L, straight aligned, jog spread, same-side loop |

Run: `npx vitest run src/features/diagram/quad/` or `npm run smoke`.

## Known gaps

1. **Routing density** — center and side bands can still feel crowded on very busy diagrams.
2. **Manual adjust** — per-leg / fusion-dot drag for top/bottom cables is not fully implemented.
3. **Labels on top/bottom** — cable titles and tube labels follow rotated breakout; upright labels deferred.

## Do not touch (without explicit user approval)

- **Frozen horizontal routing:** symbols listed in [`.cursor/rules/frozen-routing.mdc`](../../.cursor/rules/frozen-routing.mdc) and all of `src/features/manualAdjust/*`.
- **`handleCoords.ts`** — build quad-specific coords instead of widening for top/bottom.

## Manual QA checklist

1. Import a CSV where the optimizer places cables on top or bottom (e.g. `Left-SPI-215_I-80.csv`).
2. Confirm: cables appear on the edges the optimizer chose — **no layout-mode toggle**.
3. Confirm: top cable reads **BL** leftmost; left/right read BL topmost.
4. Confirm: fusion dots spread in the open region.
5. Drag a cable in **Auto** mode to another edge (`cableSideDrag`) — legs reroute; position persists after reload/export.

## History (compressed)

| Date | Milestone |
|------|-----------|
| 2026-06-14 | Quad geometry module: placement, channels, router, top blue-first order |
| 2026-06-27 | Routing-first import approved — side assignment becomes search output |
| 2026-06-29 | Docs updated — no user 2-side / 4-side toggle; quad module = top/bottom render reference |
| 2026-06-29 | SDC-LAYOUT-001 T1 quad proxy false-fail fix |
