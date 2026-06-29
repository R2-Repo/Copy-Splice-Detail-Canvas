# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-29 — **Routing-first side placement documentation**

### Done

| Area | Change |
|------|--------|
| SDC-CORE-001 | Replaced "two-sided / four-sided modes" with "diagram edges and cable placement" — optimizer-driven, no toggle |
| SDC-GRID-001, SDC-ROUTE-001, SDC-LAYOUT-002, SDC-ORDER-001/002 | Top/bottom edges = optimizer outcome, not a mode gate |
| SDC-SCORE-001 | Tie-break wording: fewer sides is soft preference, not a mode |
| Consolidated rules + 13/14 review docs | Same vocabulary alignment |
| QUAD_LAYOUT.md | Rewritten as top/bottom geometry reference (not a user mode) |
| AGENTS, ARCHITECTURE, SCOPE, ROUTING_FIRST_LAYOUT, Rule Index | Cross-links updated |

### Manual QA

Not required — documentation-only change.

### Frozen

`spliceEdgeRouting.ts` symbols untouched.
