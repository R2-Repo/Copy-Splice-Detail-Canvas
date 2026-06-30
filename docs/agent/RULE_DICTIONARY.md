# Rule dictionary — plain English (SDC only)

> **Public contract:** [`splice_detail_canvas_rule_pack/00_Rule_Index.md`](../splice_detail_canvas_rule_pack/00_Rule_Index.md)  
> **Simple part names:** [`SIMPLE_TERMS.md`](./SIMPLE_TERMS.md)

## Active rules

| SDC ID | Plain English |
|--------|----------------|
| **SDC-CORE-001** | Shared vocabulary — cable → tube → fan-out → handle → legs → dot |
| **SDC-DATA-001** | Imported cable hierarchy after CSV parse |
| **SDC-DATA-002** | 6-count vs 12-count buffer tube inference |
| **SDC-ORDER-001** | TIA buffer tube stack order on each cable |
| **SDC-ORDER-002** | TIA fiber color order + **24px pitch** within each tube |
| **SDC-GRID-001** | Internal routing grid — **24px pitch**, lanes, occupancy, four sides |
| **SDC-LAYOUT-001** | Spacing, stacking, near-straight import alignment |
| **SDC-LAYOUT-002** | Fan-out geometry from tube to handles |
| **SDC-ROUTE-001** | **Routing box** — splice legs stay inside the open center; two-sided vs four-sided vertical bounds |
| **SDC-ROUTE-002** | Strand group nesting and lane bands |
| **SDC-ROUTE-003** | No overlap, collision, or illegal shared lanes |
| **SDC-ROUTE-004** | **Max 2 corners** per splice (both legs combined) — hard rule; 0→1→2 preference in soft score |
| **SDC-SCORE-001** | Soft score for import search winner — bend ladder, T/B credit, crossings |
| **SDC-UX-001** | Manual locks, organized fusion-dot lines, drag snap |

## When to cite which rule

| You notice… | Cite |
|-------------|------|
| Wrong fiber colors or order in a tube | **SDC-ORDER-002** |
| Fibers too far apart or uneven inside a tube | **SDC-ORDER-002**, **SDC-GRID-001** |
| Cables overlap on same side | **SDC-LAYOUT-001** |
| Strands route above/below cable content or over labels | **SDC-ROUTE-001** |
| Two splices on same lane / paths merge | **SDC-ROUTE-003** |
| More than 2 corners on one splice | **SDC-ROUTE-004** |
| Fusion dots scattered in a tube group | **SDC-UX-001** |
| Tiny jog on an almost-straight leg | **SDC-LAYOUT-001**, **SDC-UX-001** |
| Locked item moved after drag | **SDC-UX-001** |

## Conflict priority

See **Conflict Priority** in [`00_Rule_Index.md`](../splice_detail_canvas_rule_pack/00_Rule_Index.md). Bend budget [SDC-ROUTE-004] outranks lane-offset workarounds that would add corners.

## Implementation note

Atomic checks use **SDC subcodes** (e.g. `SDC-ORDER-002-B`) in `src/features/rules/sdcCheckIds.ts`. Validators run from `src/features/diagram/layoutRules.ts` and `src/features/rules/`.
