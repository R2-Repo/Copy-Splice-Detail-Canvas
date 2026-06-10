# Layout rules — cable, tube, and fiber invariants

> **Must keep.** These rules define how fiber cables, buffer tubes, and fiber strands are formatted and oriented. Any change to diagram layout, cable nodes, or splice routing **must pass every rule** in `layoutRules.test.ts`.

**Enforcement code:** `src/features/diagram/layoutRules.ts`  
**Contract tests:** `src/features/diagram/layoutRules.test.ts`  
**Reference CSVs:** `docs/reference/examples/CSV Splice Detail Example #1–#3.csv`

---

## Maintenance protocol

When you add or change layout behavior:

1. **Add or update a rule here** with a stable ID (`FBR-`, `TUB-`, `CBL-`, `DOM-`, `EDGE-`, `STR-`, or `ROW-`).
2. **Implement the check** in `layoutRules.ts` (reuse existing helpers when possible).
3. **Add or extend a test** in `layoutRules.test.ts` — every rule must run against Examples #1–#3 unless marked *example-specific*.
4. Run **`npm run test:layout`** before finishing (required every session with code changes). Then `npm run test:ci`.

Do **not** weaken or delete a rule without explicit user approval.

When EDGE rules conflict, see [`RULE_PRIORITY.md`](./RULE_PRIORITY.md) — EDGE-004 (≤2 bends) wins over EDGE-011 Y-track offsets.

---

## Rule catalog

### Fiber strands (`FBR`)

| ID | Requirement |
|----|-------------|
| **FBR-001** | Within each buffer tube, fibers are ordered top→bottom by TIA fiber number (ascending). |
| **FBR-002** | Within each buffer tube, consecutive fibers are spaced exactly **24px** center-to-center (`FIBER_ROW_PITCH`). Pitch is **never stretched** to match global splice-row gaps. |
| **FBR-003** | Within each cable node, `rowYOffset` increases strictly top→bottom across all fibers. |
| **FBR-004** | Multi-tube cables assign **distinct** `rowYOffset` values per fiber (no two fibers share the same offset). |

### Buffer tubes (`TUB`)

| ID | Requirement |
|----|-------------|
| **TUB-001** | Buffer tubes exit from the cable sheath face: **horizontal** at the fiber-group center when that center lies on the sheath face; otherwise **fan from cable center** (`cableCenterY`) to the fiber-group center (multi-tube cables taller than the sheath). |
| **TUB-002** | Each tube tip (`end.y`) is vertically centered on its fiber group's row span. `visualShiftY` applies to **collapsed** tube handles only — expanded tube/fan geometry never shifts. |
| **TUB-003** | Cable sheath preserves **aspect ratio** at all scales and tube counts. |
| **TUB-004** | Multi-tube cables have **longer tube reach** than single-tube cables (stem extends further from sheath). |
| **TUB-005** | Right-side cables **mirror** breakout geometry (sheath and tubes face inward toward splice center). |
| **TUB-006** | Buffer tubes on each cable are ordered top→bottom: **BL…AQ**, then **BL-BK…AQ-BK** (TIA solid then striped). |
| **TUB-007** | Same-side cables share one **fiber label column** — circuit tags and fiber color codes align vertically; buffer tubes extend dynamically to meet the shared stem X. Per-tube horizontal reach scales with fiber count within the cable. |
| **TUB-008** | Cross-side buffer-tube pairs whose pre-shift handle gap fits the pair shift budget may shift **collapsed** tube handles so they align (±2px). Expanded mode: **±12px** per tube; collapsed full-butt tubes: **±24px**. Larger gaps (ring-cut splits, cross-cable stubs) are exempt. Solver runs on **final** node positions after layout overrides. Fiber handles stay on 24px pitch; neighbor tubes use bidirectional spacing to preserve `TUBE_GROUP_GAP`. Expanded buffer tubes and fan-outs stay horizontal at fiber-group center. |

### Cable placement (`CBL`)

| ID | Requirement |
|----|-------------|
| **CBL-001** | Same-side cable nodes **never overlap** vertically. |
| **CBL-002** | Same-side cables stack by **placement order** with at least `cableGap` (32px) between nodes (may be larger when row-aligning ring-cut splits). |
| **CBL-003** | Same-side cables share one column X (`cableXForSide`); multi-tube reach uses longer tube stems (TUB-004), not horizontal inset. |
| **CBL-004** | When a **dominant cable pair** exists, its splice endpoints share the same row Y (±2px). Ring-cut layouts without a dominant pair: see `spliceRowLayout.test.ts`. |
| **CBL-005** | Ring-cut through cables with four opposing splices split into **two visual instances** on the through side (Example #1). |

### Row ordering (`ROW`)

| ID | Requirement |
|----|-------------|
| **ROW-001** | Global splice-row steps within one buffer tube equal `FIBER_ROW_PITCH` (24px). |
| **ROW-002** | Global splice-row steps across buffer-tube boundaries add `TUBE_GROUP_GAP` (8px) beyond pitch. |
| **ROW-003** | Ring-cut split boundaries add **adaptive gap** (min 24–48px, expanded to clear stacked sibling cable height when needed). Stub→dominant transitions use compact 24–48px only. |
| **ROW-004** | Through-cable splices sort by through-cable fiber #; crossover stubs use `max(left, right)` fiber # (Example #3). *Example-specific assertion in `connectionRowOrder.test.ts`.* |

### Dominant cable pair (`DOM`)

| ID | Requirement |
|----|-------------|
| **DOM-001** | Dominant pair = left↔right visual-cable group with the **most splice rows** (tie-break favors straight-across pairs). |
| **DOM-002** | All dominant-pair splice rows appear **before** non-dominant rows in global row order. |
| **DOM-003** | Dominant-pair fibers on left and right share the **same row Y** (±2px) — straight-across priority. |
| **DOM-004** | Cable pairs with **≥4 splice rows** (non-dominant) share aligned row Y (±2px) on left and right. |

### Splice edges (`EDGE`)

| ID | Requirement |
|----|-------------|
| **EDGE-001** | On import, each splice edge receives a **distinct routing lane** (no overlapping mid-X paths). |
| **EDGE-002** | Splice paths use **orthogonal** H–V–H routing with a fusion dot on the **horizontal fiber segment** before center vertical fan-out (see DOT-001). |
| **EDGE-003** | Lane registry assigns **staggered lanes on initial mount** (no drag required to separate overlapping strands). *Tested in `spliceEdgeRouting.test.ts`.* |
| **EDGE-004** | Handle-to-handle splice path uses **≤2 orthogonal 90° bends total** across both legs combined; prefer **0** (straight) when tube rows align within **12px** (half pitch). Collapsed tubes use the same limit. Deconfliction uses distinct `midX` lanes — not Y-track offsets that add bends. |
| **EDGE-005** | **Buffer-tube grouping in center lanes:** `midX` order mirrors vertical `rowOffset` (+ tube-boundary gaps). Coherent tube bundles apply the same `spliceMidOrderInverts` logic as individual strands. For downward splices (right endpoint below left), top rows bend farther toward the target; for upward splices, top rows bend closer to the source. |
| **EDGE-006** | Route template minimizes bends among grouping-preserving options; lane stagger applies only to `hv_demarcated` paths (crossing prevention). |
| **EDGE-007** | Nested center bends avoid H×V segment crossings within same-direction bundles — upper fibers bend first (farther toward target) on downward splices. **Exception:** same-side loop bundles may cross at one bend (source bend on downward loops, target bend on upward loops); see EDGE-010. |
| **EDGE-008** | Center vertical lanes (`midX`) stay at least **24px** apart within each cable-column routing zone — never collapse when OS-inset is infeasible. |
| **EDGE-009** | Non-straight splices run horizontally **past the longest OS/circuit label on that canvas side** (measured via canvas `measureText`), then **≥60px** inward toward center, before vertical legs — same-side and cross-side; both source and target legs; applies to Y-track deconflict bends (`sourceHorizY` / `targetHorizY`), not only center `midX`. |
| **EDGE-010** | Fibers from the **same buffer tube** to the **same target cable** use **24px-spaced** vertical lanes plus a **shared horizontal trunk** (`jogX`) before each lane turns vertical — stay grouped without stacking. **Exception:** same-side downward loop bundles omit `jogX` so the source bend can cross while preserving color order. |
| **EDGE-011** | Parallel splice segments never **stack on the same track** (same X for vertical, same Y for horizontal); distinct lanes stay ≥24px apart. Side horizontal legs use **offset Y tracks** (`sourceHorizY` / `targetHorizY`) when aligned rows would overlap in the gap. **Global** — applies across all routing zones, not just within a single source/target cable pair. |
| **EDGE-012** | When vertical center legs overlap in Y, they use **distinct midX lanes** (≥24px apart). **Global** — applies across all routing zones. |

### Fusion splice dots (`DOT`)

| ID | Requirement |
|----|-------------|
| **DOT-001** | Fusion dot lies on a **horizontal** splice-path segment (not a vertical segment). Default row: source fiber row (`sourceY` / `sourceHorizY`). |
| **DOT-002** | Fibers sharing a **source buffer tube** (`visualCableId \| tubeColor`) use one **shared dot column X**; dot Y follows each fiber’s source handle row — vertically **stacked** at multiples of 24px (sparse tubes may skip unspliced fiber rows). Shared X prefers bundle `jogX` trunk when present. |
| **DOT-003** | *(Reserved — overlap / conflict avoidance with other strands; not enforced yet. Subordinate to EDGE-011 until wording is finalized.)* |

### Fiber strand direction (`STR`)

| ID | Requirement |
|----|-------------|
| **STR-001** | Every fiber strand's fan endpoint (`fanTo.x`) lies **toward canvas center** from its sheath — left cables fan right; right cables fan left. Display side uses dynamic `layoutWidth / 2`, not a fixed center. |

---

## Constants (single source of truth)

Defined in `src/features/diagram/cableLayoutMetrics.ts`:

| Constant | Value | Used for |
|----------|-------|----------|
| `FIBER_ROW_PITCH` / `MIN_FIBER_LINE_GAP` | 24px | Fiber spacing within tube, row pitch, splice lane separation |
| `MIN_HORIZONTAL_INSET_FLOOR` | 16px | Minimum inward jog when OS label span leaves no room for full 60px inset |
| `MIN_SPLICE_HORIZONTAL_INSET` | 60px | Inward jog after the OS/circuit label column before vertical legs |
| `TUBE_GROUP_GAP` | 8px | Extra gap at buffer-tube boundaries in global row layout |
| `CABLE_LAYOUT.cableGap` | 32px | Vertical gap between stacked same-side cables |
| `CABLE_LAYOUT.tubeCountXOffset` | _(unused — column alignment policy)_ | Reserved; CBL-003 uses shared column X |

---

## Example-specific regression tests

These live beside the contract suite and document edge cases tied to reference CSVs:

| File | Covers |
|------|--------|
| `connectionRowOrder.test.ts` | Example #3 crossover RD/BK ordering; tube-boundary gaps |
| `spliceRowLayout.test.ts` | Example #2 drop/DK strand order; ring-cut alignment |
| `dominantCablePair.test.ts` | Example #2 DROP↔3175 dominant pair |
| `buildReactFlowGraph.test.ts` | Node/edge counts per example |
| `cableBreakoutGeometry.test.ts` | Sheath/tube geometry unit tests |
| `spliceEdgeRouting.test.ts` | Lane staggering and orthogonal paths |

When an example-specific behavior becomes universal, promote it to a rule ID above.
