# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## SDC modular rules + grid routing (2026-06-22)

- **Grid engine (default):** `routeAllOnGrid` + packed baseline + snap; hybrid locks on edit.
- **SDC-UX-001:** Always-on auto in grid mode; Auto/Manual toggle hidden; Unlock all resets locks.
- **Hybrid locks:** cable / leg / fusion-dot / tube-group — context menu + drag-stop; cable positions persist on rebuild (`cable-{id}` keys).
- **Drag-stop cache (Phase 2):** Grid auto drag stop reuses pre-drag routes + incremental reroute on dragged cable only.
- **Rules:** D4 contract — GRID-001, ROUTE-002/003, LAYOUT-001/002, UX-001, EDGE-005 on all three reference CSVs.
- **Browser D4 QA:** Passed on SP / STATE / SPI reference CSVs.

## Baseline

- Branch: `main`
- Stabilization plan: Phase 2 done; Phase 4 partial (determinism + legOverride skip tested); Phase 5+ open.
- Milestones A–G + EDGE-005 + wrap-up complete in code/tests.

## Blockers

- None for continued stabilization work. Phase 6 live bundle `rowOffset` needs frozen-routing approval if implemented.

## Canonical docs

1. [`SCOPE.md`](./SCOPE.md)
2. [`RULE_PRIORITY.md`](./RULE_PRIORITY.md)
3. [`LAYOUT_RULES.md`](./LAYOUT_RULES.md)
4. [`RULE_ID_MAP.md`](./RULE_ID_MAP.md)
5. [`STABILIZATION_PLAN.md`](./STABILIZATION_PLAN.md)
6. [`HANDOFF.md`](./HANDOFF.md)
