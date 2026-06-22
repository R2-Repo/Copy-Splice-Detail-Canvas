# Architecture

## Layout

```
src/
  components/        # Shared UI (AppShell, import button, etc.)
  features/
    canvas/          # React Flow host, nodes, edges, layout persistence
    import/          # CSV parser, file upload
    diagram/         # Domain model, layout engine, color code, graph builder
    export/          # PDF/SVG export (not yet implemented)
  hooks/
  lib/               # Pure utilities
  types/             # Shared TS types (SplicePair, endpoints, etc.)
  styles/
docs/agent/          # SCOPE, CONTEXT, HANDOFF, LAYOUT_RULES, RULE_PRIORITY
docs/reference/      # User examples, images (not shipped)
docs/archive/        # Superseded planning docs
```

## Data flow

```
Bentley CSV
  → parse (SplicePair graph, dedupe mirrors)
  → layout (side hints, ordering, coordinates)
  → React Flow (edit + persist overrides)
  → export (model + layout → PDF/SVG) [future]
```

## Canvas feature

- `features/canvas/WorkflowCanvas.tsx` — React Flow host; import-driven graph
- `features/canvas/layoutStorage.ts` — layout override persistence (localStorage)
- `features/canvas/nodes/` — CableNode, BufferTubeNode, FiberStrandNode
- `features/canvas/edges/SpliceEdge.tsx` — splice edge rendering
- `features/canvas/edges/spliceEdgeRouting.ts` — routing (~3400 lines; split deferred)

## Diagram feature

- `features/import/parseBentleyCsv.ts` — CSV parser
- `features/diagram/buildConnectionGraph.ts` — splice-pair graph
- `features/diagram/layoutSpliceDiagram.ts` — layout orchestration
- `features/diagram/buildReactFlowGraph.ts` — React Flow nodes/edges; **gates to quad** when `layoutMode === "quad"`
- `features/diagram/quad/` — **4-side layout engine** (paused MVP — see [`docs/agent/QUAD_LAYOUT.md`](./QUAD_LAYOUT.md))
  - `buildQuadReactFlowGraph.ts` — quad pipeline entry
  - `quadPlacement.ts`, `quadGeometry.ts`, `quadChannels.ts`, `quadRouter.ts`, `quadTypes.ts`
- `features/diagram/layoutRules.ts` — contract enforcement (31 rule IDs)
- `features/diagram/spliceRowLayout.ts` — row alignment and cable placement
- `features/diagram/cableBreakoutGeometry.ts` — sheath/tube geometry
- `features/diagram/tubeRowShift.ts` — cross-side tube handle alignment

## Conventions

- Functional components; `@/` imports
- Domain types in `src/types/`; parser/layout pure functions testable without React
- Tests next to source or in feature folder

## Quality gates

```bash
npm run test:layout  # layout contract (Examples #1–#3)
npm run verify       # layout + check + test:ci + build
```

## PWA

Configured in `vite.config.ts` via `vite-plugin-pwa`.

## Local dev

```bash
npm run dev
```

Vite dev server — typically http://localhost:5173

## Drag vs import layout

- **Import / drag-stop:** `buildReactFlowGraph` runs full placement — same-side cable stack collision, cross-side tube auto-align (`TUB-008`), and grid lane assignment (default) or `routeCenterSplices` (nodes escape hatch).
- **Live cable drag:** `syncNodesEngineDragLayout` calls `buildReactFlowGraph` with `dragSync: true`, which skips collision re-stack and tube auto-align until drag stop. Routing lanes and fiber anchors still refresh from live handle positions.
- **Grid drag-stop (auto):** When the routing engine is grid and the cable stayed on the same side, drag stop reuses the pre-drag `priorGridRoutes` snapshot plus live `dragCacheEdges`, and reroutes only splices on the dragged cable (`rerouteConnectionIds`). Collision stack runs on release; unaffected splices keep drag-sync midX lanes.
- **Quad (4-side) mode:** `buildReactFlowGraph` delegates to `buildQuadReactFlowGraph`; `WorkflowCanvas` early-returns quad cable drag to `syncQuadCableDrag` before horizontal manual/auto paths. See [`QUAD_LAYOUT.md`](./QUAD_LAYOUT.md).
- **`assignSpliceRoutingLanesFromLiveHandles`** — wired on live cable drag (`dragSync` → `useLiveHandleLanes` in `computeSpliceLayout` / `gridRouter`). Non-bundle entries get fresh `rowOffset` from handle Y; tube-bundle members keep layout rank. Dev lane diffs: `VITE_DEBUG_LANE_DIFF=1`.

### What differs on drag vs import

| Pass | Collision stack | Tube auto-align (`TUB-008`) | Routing |
|------|-----------------|-----------------------------|---------|
| Import | yes | yes | full grid / center route |
| Live drag (`dragSync`) | no | no | incremental grid reroute on dragged cable |
| Drag stop (grid auto) | yes | yes | reuse drag snapshot + reroute dragged cable only |
| Drag stop (manual) | yes | skipped (`skipTubeAutoAlign`) | manual leg paths preserved |

## Manual overrides (v14)

- **`connectionOverrides` / `bundleOverrides`** — parameter-based routing offsets (Phase 5). `connectionOverrides` keyed by connection id (`laneOffsetX`, `dotOffsetX`, `spliceRowOffsetY`); `bundleOverrides` keyed by `tubeBundleKey`.
- **Bridge:** `legOverrides` segment data dual-writes to `connectionOverrides` on leg commit; `loadLayoutOverrides` bridges legacy leg-only saves on read.
- **Apply rules:**
  - `positions` — always applied on rebuild (including locked cables via `locks.cables`).
  - `tubeOverrides` / `fanoutOverrides` — applied in both auto and manual.
  - `connectionOverrides.laneOffsetX` / `bundleOverrides.laneOffsetX` — applied in manual mode before path precompute (`applyRoutingParameterOverrides` in `computeSpliceLayout` / grid router).
  - `legOverrides` — segment-level detail in manual via `applyAllLegOverrides`; auto skips unless hybrid locked fusion dot (`applyHybridFusionDotLocks` reads `dotOffsetX` or `dotShiftX`).
- Canonical fiber-anchor coordinates: `manualAdjust/handleCoords.ts` — `fiberAnchorCenter()`, `fiberAnchorNodePosition()`, `visualCableFromCableNode()` (shared by engine graph, manual sync, overlay).
