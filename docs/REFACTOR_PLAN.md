# Splice Detail Canvas — Refactor Plan

Status: **Approved for build** (decisions locked; routing rules confirmed against reference screenshots; no code changed yet)
Scope: center-routing rewrite, node model expansion, CSV/identity changes.
Routing visual reference: [`docs/reference/routing-examples/`](reference/routing-examples/README.md).

---

## 0. Locked decisions (do not re-litigate)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Same unique cable appearing in **both** From and To columns | **Two legs (left + right) joined by a REAL splice point.** Not a continuous mid-sheath/through line. Domain: if it is in the CSV it has been spliced (damaged cable, or spliced to a now-removed cable and strands reclaimed). |
| D2 | Old two-section (Left+Right mirror) CSV support | **New single-section only.** Drop old-format handling. |
| D3 | Fibers-per-tube (needed to fill a blank fiber #) | **Derive empirically per cable** from the data (detect 6 vs 12 by which tube colors / fiber colors actually appear). No name-based guessing. |
| D4 | Visual style | **Match the current look as closely as possible.** Visual parity is the success metric. |
| D5 | Manual node editing | **Auto everything first.** Auto on import and auto re-layout after nodes are added. A future toggle switches auto OFF for 100% manual editing (selection tools, multi-select of nodes/handles, keyboard/mouse shortcuts). The rebuild must not preclude this. |
| D6 | Features that carry over | **All current features:** collapse-full-butt-splices toggle, click-edge protect-in-place, auto fit-to-width / responsive width, drag-cable-across-center to flip side, CSV import button. (Fixture URL param is not required.) |
| D7 | Center splice nodes | **One draggable splice-point node per fiber connection**, auto-grouped/nested into shared lanes by tube bundle. (Grouping is a layout behavior, not a change in dot count.) |
| D8 | ElkJS | **Skip.** Commit to a deterministic router. ELK can't express the center rules without fighting it. |
| D9 | Routing spec | Section 4 (R1–R7, spacing constants 4.2, forbidden patterns 4.3) is the spec and the test oracle. Confirmed against the annotated reference screenshots. |
| D10 | Grouping basis | Bundles are defined by **shared destination/path**, mixed colors allowed; members nested by **destination fan-in order** (single-tube bundles keep strict fiber-number order). |
| D11 | Spacing | Intra-bundle pitch = fixed, uniform, **isotropic** constant (same on both axes). Inter-bundle gap = variable (this is what spreads routing across the center). |

---

## 1. Goals

1. **Tame the center routing.** Replace the render-time, geometry-derived engine with a deterministic, model-driven layout pass that honors the routing rules (section 4).
2. **Add real nodes** at meaningful anchor points (tube ends, fiber ends, center splice points) so React Flow renders them and the user gets manual grab points later (D5).
3. **Decouple cable identity from semantics.** Unique cable names = identity; derive strand count empirically (D3); stop regexing the name for meaning.
4. **Single-section CSV import** (D2).
5. Keep a working diagram at every step (flag-gated), measured against golden output and visual parity (D4).

Non-goals: changing color/TIA logic, header parsing, PWA/build setup, building the manual-edit UI itself (only leave room for it).

---

## 2. Current architecture (as-is)

### Data flow
```
CSV text
  -> parseBentleyCsv()                       src/features/import/parseBentleyCsv.ts
  -> buildConnectionGraph()                  src/features/diagram/buildConnectionGraph.ts
  -> buildReactFlowGraph()                   src/features/diagram/buildReactFlowGraph.ts
  -> <ReactFlow nodes edges>                 src/features/canvas/WorkflowCanvas.tsx
       nodes: only "cable" (composite)       src/features/canvas/nodes/CableNode.tsx
       edges: "splice" (custom path)         src/features/canvas/edges/SpliceEdge.tsx
                                             src/features/canvas/edges/spliceEdgeRouting.ts
```

### Facts confirmed during review
- Only the **`cable`** node type is instantiated. `BufferTubeNode` / `FiberStrandNode` are registered but **never created** (dead code).
- `CableNode` is composite: sheath + every tube + every fiber + one `Handle` per fiber row.
- The diagram **center is empty space**; every splice is an edge whose path is computed in `spliceEdgeRouting.ts` (~3,700 lines, ~100 functions), at **render time**, across **three** parallel paths (import / live-drag registry / drag snapshot) using **module-global mutable state**, with a render-time re-separation hack (`separatedMidXForRender`) because stored lanes drift from settled pixels.
- Canvas left/right is decided by `computeCableCanvasSides()` (brute force ≤ `MAX_EXHAUSTIVE_CABLES = 14`), **not** by CSV sections.
- The **cable name is overloaded** as identity + fibers-per-tube (`fibersPerBufferTubeFromCableName`) + through/drop role (`isThroughCableName`).
- Layout persistence key is the **splice number** (`reportStorageKey`); renaming cables does **not** orphan saved layouts.

---

## 3. Target architecture

### 3.1 Node model (D7)
| Node type     | Physical feature                                  | Draggable later (D5) | Count (approx)     |
|---------------|---------------------------------------------------|----------------------|--------------------|
| `cable`       | Sheath + label only (slimmed)                     | yes                  | one per leg        |
| `tubeAnchor`  | Buffer-tube breakout point                        | yes                  | tubes × legs       |
| `fiberAnchor` | Fiber strand end (today's `Handle`)               | yes                  | fibers × legs      |
| `splicePoint` | Center dot where left fiber meets right fiber     | yes                  | one per connection |

- Full butt splice = the existing special case: one **square** per tube (keep, D6).
- Edges become short and dumb: `fiberAnchor → splicePoint → fiberAnchor`. Built-in step edge (or a thin wrapper for color/contrast only). **No path math in the edge component.**
- `CableNode` slims to sheath + label; the fiber `Handle`s move onto `fiberAnchor` nodes.

### 3.2 Layout as a pure pass (not render)
One pure function computes ALL positions (cables, anchors, splice points) from the model, once per import/drag. No module globals, no render-time subscribers.
```
computeSpliceLayout(graph, options) -> { nodePositions, edgeRoutes }
```
- Cable Y and tube-group Y are **layout variables** the pass may move to relieve congestion (R7).
- Node positions live in the persistable `LayoutOverrides` shape even while fully auto, so the future manual mode (D5) is a small addition, not a rewrite.

### 3.3 Identity vs semantics
- Identity = unique cable name (`cableNameKey` stays trim-based, now reliable).
- `CableLeg.fibersPerTube: 6 | 12` — derived **empirically** (D3), computed once at graph build.
- `CableLeg.role: "through" | "drop"` — derived from **fiber count + topology** (larger / passes-through = through), name regex kept only as last-resort fallback. Role affects dominant-pair anchoring/order, not correctness.

---

## 4. Center routing spec — the oracle

The whole center between the left and right fan-outs is the routing field. Rules below were
confirmed against annotated reference screenshots (see `docs/reference/routing-examples/`).
The router MUST satisfy all of them.

### 4.1 Core rules (R1–R7)

- **R1 Use the whole center.** Spread routing across the full available width AND height
  (including stacked vertical regions when there are multiple cable groups). Never cram all
  strands into one band or stack them in the dead center while space sits unused.
- **R2 Vertical-vs-horizontal crossings are fine.** A vertical run crossing a horizontal run is
  expected and acceptable.
- **R3 No parallel overlap, EITHER AXIS.** Two parallel segments — two horizontals OR two
  verticals — must never be coincident or closer than the spacing minimum. Every parallel run
  gets its own distinct lane. (Vertical lanes are governed exactly like horizontal planes; see
  forbidden pattern F2.)
- **R4 Shared plane across center is OK.** A left-half and a right-half horizontal segment may
  share the same Y as long as they stay on opposite sides of the diagram center. Only when a run
  **crosses center** must it be offset so it never stacks on another. (When two same-direction
  lines share a plane, give each its own vertical lane and stagger the turns — which line turns
  first is free, as long as R3 holds afterward.)
- **R5 Group + nest by destination.**
  - A **group/bundle is defined by a shared path/destination, NOT by color or origin tube.**
    Mixed-color bundles drawn from several cables are normal.
  - Within a bundle, **nesting order = destination fan-in order** so strands arrive at the
    destination without crossing; any unavoidable disorder is absorbed at the **merge** point
    where strands join the bundle.
  - For a single-tube bundle this coincides with **strict fiber-number order**, and fiber-number
    order is never reordered to avoid an internal crossing.
  - Nesting is **preserved through bends**: a turning bundle routes as **concentric parallel
    corners**; members hold their offset and peel off only at the point of divergence.
- **R6 Bend budget + clean transitions.**
  - Each line has a maximum allowed number of bends.
  - A **same-direction transition (no loop-back) must be crossing-free** — it resolves to a clean
    concentric two-bend step (see forbidden pattern F1). Bend overlap/crossing is only ever
    potentially justified when a fiber genuinely **loops back on itself** (reverses direction).
- **R7 Groups breathe.** Each tube's fanned fibers stay contiguous with consistent spacing, but
  the whole tube group — and the cable's vertical position — may shift up/down to relieve
  routing congestion (bounded so groups stay contiguous).

### 4.2 Spacing constants (R3/R5 detail)

- **Intra-bundle pitch = a single fixed, uniform, ISOTROPIC constant.** Spacing between adjacent
  members is identical on the X axis and the Y axis, so concentric corners march at a clean 45°
  (bend points offset by the pitch on both axes). Never variable within a bundle.
- **Inter-bundle gap = variable.** The gap between separate bundles flexes; this variability is
  precisely what lets routing spread to fill the whole center (R1).

### 4.3 Forbidden patterns (confirmed "never do this")

- **F1 Avoidable crossings on a same-direction step.** When fibers continue the same net direction
  (no U-turn), turn order that does not match exit/destination order produces avoidable
  crossings/overlaps. Must instead be a clean crossing-free concentric two-bend step.
- **F2 Coincident vertical (or horizontal) lanes.** Two strands turning vertical onto the same X
  (stacked directly on top of each other) violate the spacing minimum. This is the primary legacy
  bug; the new router must make it **structurally impossible** by assigning lanes from the model,
  not deriving them from drifting render geometry.

### 4.4 Router approach (deterministic, D8)
1. Order fibers per cable by fiber number, grouped by tube (fixed source order).
2. Form **bundles by shared destination/path** (R5), allowing mixed colors.
3. Order members **within each bundle by destination fan-in order** (R5).
4. Assign **center columns (X lanes)** to bundles, spreading across the full center width (R1),
   each parallel vertical run in its own lane ≥ pitch apart (R3/F2), nested (R5).
5. Assign **horizontal planes (Y lanes)** with min-separation (R3), allowing left/right halves to
   share Y when not crossing center (R4).
6. Choose turn order per bundle so same-direction transitions are crossing-free (R6/F1); the
   specific line that turns first is free as long as invariants hold.
7. Allow cable/tube-group Y shifts as a relief variable (R7), bounded so groups stay contiguous.
8. Build orthogonal paths within the bend budget (R6), preserving concentric nesting and the
   fixed isotropic pitch through every corner (4.2).

All steps are pure and unit-testable against R1–R7, the spacing constants (4.2), and the
forbidden patterns (4.3).

---

## 5. Workstream A — Import & Identity

### A1. Single-section parsing (D2)
- `src/features/import/parseBentleyCsv.ts`: confirm empty `Right ---` is a no-op; keep section-independent `canonicalPairKey` dedupe (mirrors still collapse). Drop old two-section assumptions.
- `src/features/import/cableLegIdentity.ts`: replace section-pattern `csvColumnsForCable` with an explicit, section-agnostic rule on combined From/To presence:
  - from only → `["from"]`; to only → `["to"]`; both → `["from","to"]` (two legs; D1).

### A2. Empirical strand count + decoupled semantics (D3)
- `src/types/splice.ts`: add `CableLeg.fibersPerTube: 6 | 12` and `CableLeg.role: "through" | "drop"`.
- New `src/features/diagram/fibersPerTube.ts`: derive 6 vs 12 per cable from observed (tubeColor, fiberColor, fiberNumber) data; expose a pure function + unit tests.
- `src/features/diagram/buildConnectionGraph.ts`: compute `fibersPerTube` and `role` once, store on legs.
- Update consumers to read leg fields instead of regexing the name:
  - `src/features/import/parseBentleyCsv.ts` (`fillMissingFiberNumber`)
  - `src/features/diagram/throughCable.ts`, `src/features/diagram/dominantCablePair.ts`
- Keep `fibersPerBufferTubeFromCableName` / `isThroughCableName` only as deprecated fallbacks.

### A3. Identity diagnostics
- `src/features/import/inspectBentleyCsv.ts`: warn when two legs share a name but look like distinct cables (disjoint fiber ranges / different derived counts) to catch non-unique names early.

### A4. Tests
- Fixtures (provided): `docs/reference/examples/Left-SP-3254.5.csv`, `Left-STATE_OFFICE.csv`, `Left-SPI-215_I-80.csv`.
- `src/features/import/referenceCsvParse.test.ts`: add expected `leftRows / pairs / uniqueCables / parseGap` for the three.
- New tests: both-columns → two legs + splice point (D1); empirical fibers-per-tube (D3).

---

## 6. Workstream B — Nodes & Routing

### B0. Phase 0 characterization (do FIRST)
Lock current behavior before touching routing.
- Golden tests capturing, per reference file: pair count, leg count + sides, dominant pair, per-connection routing lane/midX from `buildReactFlowGraph`.
- These are the regression gate for B1–B4. (Visual parity, D4, is checked manually against the running app on the same files.)

### B1. Introduce middle nodes (flag-gated, default OFF)
- `src/features/canvas/nodes/types.ts`: add `TubeAnchorNodeData`, `FiberAnchorNodeData`, `SplicePointNodeData`.
- New `SplicePointNode.tsx`, `TubeAnchorNode.tsx`, `FiberAnchorNode.tsx` (may repurpose dead `FiberStrandNode`/`BufferTubeNode`).
- `src/features/canvas/nodeTypes.ts`: register them.
- `src/features/diagram/buildReactFlowGraph.ts`: emit anchors + splice points; rewire edges to `fiberAnchor → splicePoint → fiberAnchor`.
- Slim `CableNode` to sheath + label.
- Flag: a build constant (e.g. `ROUTING_ENGINE = "legacy" | "nodes"`), default legacy until parity.

### B2. Pure layout pass + deterministic router (section 4)
- New `src/features/diagram/computeSpliceLayout.ts` (pure: positions + edge endpoints).
- New `src/features/diagram/centerRouter.ts` implementing the section 4 approach (bundle by destination → order by destination fan-in → X lanes → Y lanes → cable/tube Y relief → orthogonal paths within bend budget, preserving concentric nesting + fixed isotropic pitch).
- Define the spacing constants in one place (intra-bundle isotropic pitch; min inter-bundle gap) — likely `src/features/diagram/cableLayoutMetrics.ts`.
- `buildReactFlowGraph` calls these instead of `assignSpliceRouting*` / `assignSpliceMidXLanes`.
- Unit tests assert, on the three files:
  - **R3/F2**: no two parallel segments (either axis) are coincident or closer than the pitch — including vertical lanes.
  - **4.2**: intra-bundle pitch is uniform and equal on both axes (corner points offset by exactly the pitch).
  - **R5/D10**: bundle membership = shared destination; member order = destination fan-in order.
  - **R6/F1**: same-direction transitions produce zero avoidable crossings.
  - **R1**: routing bbox spans the full center extent (not collapsed into one band).

### B3. Retire the render-time engine
- `src/features/canvas/edges/SpliceEdge.tsx`: drop `useRoutingLaneIndex`; render from precomputed points (or built-in step edge) + color/contrast only.
- `src/features/canvas/WorkflowCanvas.tsx`: remove `publishDragRoutingSnapshot` / `setActiveDragCableNodeId` / `refreshDragRouting`; drag moves nodes and re-runs `computeSpliceLayout`. Keep D6 features (collapse toggle, protect-in-place, fit-width, side-flip, import button).
- Delete the bulk of `src/features/canvas/edges/spliceEdgeRouting.ts` (registry, snapshot, lane packing, separated-midX, bundle ordering). Keep only pure helpers still used.
- Flip flag to `nodes` once goldens pass and visual parity is confirmed.

### B4. Cleanup
- Remove fixture-specific rule tests (`spi215Layout`, `spi215Stack`, `visualQa3161`, parts of `layoutRules`) once goldens pass with the new engine.
- Remove dead `BufferTubeNode`/`FiberStrandNode` if not repurposed.
- Revisit `MAX_EXHAUSTIVE_CABLES = 14` now that unique names may raise distinct-cable count and more nodes exist.

### (No ELK — D8.)

---

## 7. Sequencing

```
B0 characterization goldens     <- safety net, no behavior change
A1 single-section parse
A2 empirical strand count + identity/semantics split
A3 diagnostics
A4 import tests                 <- checkpoint: npm run verify green, report
B1 middle nodes (flag OFF)
B2 pure layout + deterministic router (R1-R7)
B3 retire render engine, flip flag ON, delete old code
B4 cleanup                      <- checkpoint: parity + goldens, report
```
Flag keeps `main` renderable throughout. Report at each checkpoint.

### 7.1 Build progress notes — **refactor complete** (2026-06-08)

| Item | Status |
|------|--------|
| `ROUTING_ENGINE` | `"nodes"` (default) |
| `centerRouter.routeCenterSplices` | `spliceCenterLanes.assignCenterLanes` — §4.4 zone pack + global F2 vertical ledger; oracle helpers in `centerRouter.ts` |
| `spliceCenterLanes.ts` | Lane assignment + horiz/gap tracks; `assignCenterLanes` replaces legacy `assignSpliceMidXLanes` + `assignSideVertLaneXs` on the nodes path |
| `spliceEdgeRouting.ts` | Path builders + handle positions + legacy drag registry (gated no-op when `ROUTING_ENGINE === "nodes"`) |
| `SpliceEdge` | `PrecomputedSpliceEdge` (nodes default); `LiveSpliceEdge` retained for `legacy` flag only |
| §4.4 pure router | **Done** — `assignCenterMidXLanes` + `assignGlobalF2VertLaneMidXs` (F2-by-construction; prefers unclamped midX when inset clamp would stack lanes) |
| B3 edge model | Fiber splices: `fiberAnchor → splicePoint → fiberAnchor`; butt splices: `cable → cable`; drag rebuilds via `buildReactFlowGraph` |
| B0 goldens | Updated for §4.4 F2 parity (STATE_OFFICE / SPI-215); minor SP-3254.5 `routingMidX` shifts after `CableLeg.role` row layout |
| `useRoutingLaneIndex` | No-op registry path when nodes engine; precomputed edges skip hook entirely |
| `CableLeg.role` | `connectionRowOrder`, `dominantCablePair`, `visualCables` use `isThroughCable(cable, graph)` |
| Manual D4 | **Still required** — visual compare `Left-*.csv` against `docs/reference/routing-examples/` in running app |

**Remaining (non-blocking):** further shrink `spliceEdgeRouting.ts` (extract `splicePathGeometry.ts`); raise `MAX_EXHAUSTIVE_CABLES` if real imports exceed 14 unique cables.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Routing rewrite changes output subtly | B0 goldens + manual visual parity (D4) on the 3 files; flag-gate |
| Empirical fibers-per-tube guesses wrong on sparse data | Prefer explicit CSV fiber numbers when present; fall back to derivation; A3 diagnostics; unit tests |
| Through/drop role mis-derived without name keywords | Role only affects anchoring/order, not correctness; derive from size/topology; goldens catch shifts |
| D1 case regresses full-butt-splice collapse | Explicit test: same-name both-sides → splice point, not collapse |
| Future manual mode (D5) needs more than auto layout exposes | Persist node positions in `LayoutOverrides` even while auto, so manual is additive |
| More unique cables exceed exhaustive scorer (14) | Revisit in B4; greedy fallback exists |

---

## 9. File change index

New:
- `src/features/diagram/computeSpliceLayout.ts`
- `src/features/diagram/centerRouter.ts`
- `src/features/diagram/spliceCenterLanes.ts` (lane assignment extracted from `spliceEdgeRouting.ts`)
- `src/features/diagram/fibersPerTube.ts`
- `src/features/canvas/nodes/SplicePointNode.tsx`, `TubeAnchorNode.tsx`, `FiberAnchorNode.tsx`
- golden tests under `src/features/diagram/`
- `docs/reference/examples/Left-*.csv` (provided)

Modify:
- `src/types/splice.ts` (CableLeg fields)
- `src/features/import/parseBentleyCsv.ts`, `cableLegIdentity.ts`, `inspectBentleyCsv.ts`
- `src/features/diagram/buildConnectionGraph.ts`, `throughCable.ts`, `dominantCablePair.ts`, `buildReactFlowGraph.ts`
- `src/features/canvas/nodes/types.ts`, `nodeTypes.ts`, `CableNode.tsx` (slim)
- `src/features/canvas/edges/SpliceEdge.tsx`
- `src/features/canvas/WorkflowCanvas.tsx`

Delete / shrink (after parity):
- bulk of `src/features/canvas/edges/spliceEdgeRouting.ts`
- fixture-specific rule tests; dead `BufferTubeNode.tsx` / `FiberStrandNode.tsx` if unused
