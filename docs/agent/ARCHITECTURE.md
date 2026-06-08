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
- `features/diagram/buildReactFlowGraph.ts` — React Flow nodes/edges
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
