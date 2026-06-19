# SDC ↔ Legacy Rule ID Map

Canonical SDC rules live in [`splice_detail_canvas_rule_pack/`](../splice_detail_canvas_rule_pack/00_Rule_Index.md).  
Legacy layout contract IDs remain in [`LAYOUT_RULES.md`](./LAYOUT_RULES.md) until full cutover.

| SDC ID | Legacy IDs | Module |
|--------|------------|--------|
| SDC-CORE-001 | — | `src/features/rules/core001.ts` |
| SDC-DATA-001 | CBL-005 (partial) | `data001.ts` |
| SDC-DATA-002 | — | `data002.ts` |
| SDC-ORDER-001 | TUB-006 | `order001.ts` |
| SDC-ORDER-002 | FBR-001, FBR-002, FBR-003 | `order002.ts` |
| SDC-LAYOUT-001 | CBL-*, ROW-*, DOM-*, EDGE-013 | `layout001.ts` |
| SDC-LAYOUT-002 | TUB-*, STR-001 | `layout002.ts` |
| SDC-GRID-001 | EDGE-001 (partial) | `grid001.ts` + `src/features/grid/` |
| SDC-ROUTE-001 | EDGE-009 | `route001.ts` |
| SDC-ROUTE-002 | EDGE-005, EDGE-010 | `route002.ts` |
| SDC-ROUTE-003 | EDGE-001, EDGE-004, EDGE-007, EDGE-011, EDGE-012 | `route003.ts` |
| SDC-UX-001 | DOT-*, manual toggle | `ux001.ts` + `src/features/layoutHybrid/` |

## Processing order

See rule pack index — import DATA/ORDER → placement → grid zone → locks → route → validate.

## Tests

- `npm run test:sdc` — per-rule + contract
- `npm run test:layout` — legacy Examples #1–#3 + SDC contract

## Routing engines

| `routingEngine` | Behavior |
|-----------------|----------|
| `nodes` (default) | Current lane router |
| `grid` | Grid reservation router (`routeAllOnGrid`) |
| `legacy` | Pre-nodes composite edges |

Set per-diagram in `.sdc.json` or `VITE_ROUTING_ENGINE=grid`.
