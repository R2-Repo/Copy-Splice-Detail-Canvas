# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-30 — **Left-SP-3254.5 layout fixes + re-import QA** (`cursor/left-sp-3254-import-qa-7a31`, PR #42)

### This session

- Fixed **SDC-LAYOUT-001** straight-run root causes (not frozen routing):
  - Placement-aware pair groups; 6 DROP ↔ 144 MP 258.96 runs before 72↔144 bulk.
  - Pair anchor maximizes straight legs; lock + locked collision resolve (no reflow undo).
  - `handleMisalignment` / `nearStraightBends` soft score; default **W1400** tie-break over W1133.
- Re-import QA: winner **W1400 heuristic** (was W1133); `handleMisalignment: 296` remains (ATMS center congestion).
- Artifacts: `docs/reference/import-diagnostics/Left-SP-3254.5-*`, assessment md, rule_examples screenshots.
- Test: `horizontalAlign.sp3254.test.ts` — CH 3254 gaps ≤ 12px.

**Deferred:** center ATMS vertical chimney (**SDC-ROUTE-001/002/003**) — needs separate pass (possibly routing-first lane assignment, not macro Y).

**Gate:** `npm run check` + targeted vitest pass; full `npm run smoke` blocked by missing legacy example CSVs in VM.

### Manual QA

- Import `Left-SP-3254.5` — compare screenshot vs `bad-missed-straight-horizontal-splice-routing` + `bad-center-routing-congestion-overlap`.

### Frozen

`spliceEdgeRouting.ts` — not touched.
