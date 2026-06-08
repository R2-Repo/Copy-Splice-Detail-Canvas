# Rule dictionary — plain English

> **Use this when talking to agents.** Say `Rule ID: TUB-001` and both sides mean the same thing.  
> Full spec: [`LAYOUT_RULES.md`](./LAYOUT_RULES.md) · Conflicts: [`RULE_PRIORITY.md`](./RULE_PRIORITY.md)

## How to use

| You say | Agent understands |
|---------|-------------------|
| `Rule ID: FBR-002` | 24px fiber spacing inside a tube |
| `Example #2, EDGE-004` | Check bend count on the 4-pair drop splice CSV |
| `P1 conflict` | EDGE-004 wins over EDGE-011 |

**Prefix cheat sheet**

| Prefix | Topic |
|--------|--------|
| **FBR** | Individual fiber strands inside a buffer tube |
| **TUB** | Buffer tubes (thick colored lines from cable) |
| **CBL** | Whole cable nodes (stacking, columns, ring-cut splits) |
| **ROW** | Global vertical row order and gaps between splice rows |
| **DOM** | “Dominant” cable pair (most splices, straight-across first) |
| **EDGE** | Splice lines in the center (routing, bends, lanes) |
| **STR** | Fiber fan direction toward center |

---

## FBR — Fiber strands

| ID | Short name | Plain English | Say this when… |
|----|------------|---------------|----------------|
| **FBR-001** | TIA fiber order | Fibers in each tube run top→bottom: fiber 1 at top, 12 at bottom (TIA color order). | Colors/fiber numbers appear in wrong vertical order inside one tube. |
| **FBR-002** | 24px pitch | Neighboring fibers in the same tube are always **24px** apart — never stretched to fill space. | Fibers inside a tube look too far apart or unevenly spaced. |
| **FBR-003** | Row order per cable | Every fiber on one cable has a unique vertical slot; order is top→bottom. | Fibers on one cable cross or reorder vertically. |
| **FBR-004** | Multi-tube fiber slots | On cables with multiple buffer tubes, each fiber gets its own vertical slot (no sharing). | Two fibers from different tubes land on the same Y. |

---

## TUB — Buffer tubes

| ID | Short name | Plain English | Say this when… |
|----|------------|---------------|----------------|
| **TUB-001** | Tube exit from sheath | Tubes leave the cable sheath horizontally when the fiber group fits on the sheath face; otherwise they fan from cable center to the group. | Tube stems float beside the cable, wrong fan angle, or detached from sheath. |
| **TUB-002** | Tube tip on fiber group | The tube tip aligns with the vertical center of its fiber group. Small Y shift only when tubes are **collapsed** (full-butt). | Tube stem ends too high/low relative to its fibers. |
| **TUB-003** | Sheath aspect ratio | The cable circle/body keeps correct proportions at all sizes. | Cable blob looks squashed or stretched. |
| **TUB-004** | Longer multi-tube reach | Cables with more buffer tubes have longer tube stems toward center. | Single-tube and multi-tube stems same length; multi-tube looks cramped. |
| **TUB-005** | Right-side mirror | Right-side cables mirror left-side geometry (face inward). | Right cable tubes fan the wrong direction. |
| **TUB-006** | TIA tube order | Tubes stack BL→AQ, then striped BL-BK→AQ-BK. | Tube colors in wrong vertical order on one cable. |
| **TUB-007** | Shared label column | Cables on the same side share one vertical column for circuit tags and color codes; tubes extend to meet that column. | Labels misaligned between cables on the same side; stems too short/long. |
| **TUB-008** | Cross-side tube align | Matching tube pairs may shift Y slightly so butt-spliced tubes line up (±12px expanded, ±24px collapsed). | Collapsed tube handles misaligned left↔right; ring-cut gaps exempt. |

---

## CBL — Cable placement

| ID | Short name | Plain English | Say this when… |
|----|------------|---------------|----------------|
| **CBL-001** | No cable overlap | Same-side cables never stack on top of each other. | Two cable circles overlap vertically. |
| **CBL-002** | Cable stack gap | Same-side cables have at least **32px** gap (more if row-aligning ring-cut). | Cables too close or touching vertically. |
| **CBL-003** | Shared cable column | Same-side cables share one X column; reach comes from tube stem length, not horizontal inset. | Cables at different X when they should align; or wrong multi-tube inset policy. |
| **CBL-004** | Dominant pair straight | The main cable pair’s splices share the same row Y left↔right (±2px). | Main pair rows don’t line up horizontally across the diagram. |
| **CBL-005** | Ring-cut split instances | A through-cable with four splices shows as **two** cable legs on the through side (Example #1). | Mid-span cable should split into two visuals but doesn’t. |

---

## ROW — Row ordering

| ID | Short name | Plain English | Say this when… |
|----|------------|---------------|----------------|
| **ROW-001** | 24px within tube | Global splice rows step 24px between fibers in the same tube. | Row spacing wrong within one tube in full diagram order. |
| **ROW-002** | Gap at tube boundary | Extra **8px** gap when moving from one buffer tube to the next in row order. | Fibers from adjacent tubes too tight vertically in global order. |
| **ROW-003** | Ring-cut / stub gaps | Ring-cut splits get adaptive **24–48px** gap (wider if needed to clear stacked cables). | Stub rows collide with dominant rows; split boundary too tight. |
| **ROW-004** | Through-fiber sort order | Through-cable splices sort by fiber number; crossover stubs use max(left,right) fiber #. | Example #3 RD/BK crossover order wrong. |

---

## DOM — Dominant cable pair

| ID | Short name | Plain English | Say this when… |
|----|------------|---------------|----------------|
| **DOM-001** | Who is dominant | Dominant pair = left↔right group with the **most** splice rows. | Wrong pair treated as “main” straight-across pair. |
| **DOM-002** | Dominant rows first | All dominant-pair splice rows appear **above** stub/other rows in the diagram. | Drop/stub rows appear before the main pair. |
| **DOM-003** | Dominant Y aligned | Dominant pair fibers share same row Y on left and right (±2px). | Main pair rows stagger vertically left vs right. |
| **DOM-004** | High-count pairs align | Pairs with **4+** splice rows (non-dominant) also align straight across. | Secondary pairs with many rows don’t line up. |

---

## EDGE — Splice routing (center lines)

| ID | Short name | Plain English | Priority | Say this when… |
|----|------------|---------------|----------|----------------|
| **EDGE-001** | Distinct lanes | Each splice gets its own routing lane on import (no shared mid-X). | P2 | Two splices share the same center path on import. |
| **EDGE-002** | Orthogonal H–V–H | Center paths use right-angle horizontal and vertical segments with a fusion dot. | — | Diagonal splices or missing splice dot. |
| **EDGE-003** | Lanes on mount | Lanes separate on first render — no drag needed to unstack. | — | Strands overlap until you drag a cable. |
| **EDGE-004** | ≤2 bends | Each splice uses **at most 2 bends** total; prefer straight when rows align within 12px. Deconflict with distinct `midX` only — **no extra Y-tracks**. | **P1** | Too many elbows; zig-zag gap routing; extra horizontal tracks. |
| **EDGE-005** | Tube order in center | Center lane order follows fiber row order (top rows bend farther on downward splices). | — | Center lanes out of color/row order. |
| **EDGE-006** | Minimize bends | Pick the fewest bends that still preserve tube grouping. | — | Extra bends when a simpler path exists. |
| **EDGE-007** | No path crossing | Bundles going same direction don’t cross each other in the center. | — | Strands cross in the splice zone. |
| **EDGE-008** | 24px midX spacing | Center vertical lanes stay ≥24px apart in each zone. | P2 | Center verticals collapsed onto one X. |
| **EDGE-009** | Past OS labels | Paths go past the widest circuit/OS label on that side, then **≥60px** inward, before turning vertical. | P4 | Vertical leg starts on top of OS text; inset too short. |
| **EDGE-010** | Tube bundle trunk | Fibers from same tube to same target cable share a horizontal trunk then fan to 24px-spaced lanes. | P4 | Same-tube fibers scattered or stacked in center. |
| **EDGE-011** | No stacked tracks | Parallel segments don’t share the same horizontal Y or vertical X (≥24px apart). **Subordinate to EDGE-004.** | P3 | Strands drawn on top of each other in the gap or center. |
| **EDGE-012** | Distinct midX when Y overlaps | Vertical center legs that overlap in Y use different midX (≥24px). | P2 | Overlapping vertical center legs on same X. |

---

## STR — Strand direction

| ID | Short name | Plain English | Say this when… |
|----|------------|---------------|----------------|
| **STR-001** | Fan toward center | Fiber lines always point **inward** toward the splice center (left cables fan right, right fan left). | Fiber stub points outward away from center. |

---

## Key numbers (quick ref)

| Constant | Value | Rules |
|----------|-------|-------|
| Fiber pitch | 24px | FBR-002, ROW-001, EDGE-008/011/012 |
| Tube boundary gap | 8px | ROW-002 |
| Cable stack gap | 32px | CBL-002 |
| OS inset after labels | 60px | EDGE-009 |
| Max splice bends | 2 | EDGE-004 |
