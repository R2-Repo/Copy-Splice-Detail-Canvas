# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-18 — **SDC modular rules + grid routing refactor (phase 1).**

### What landed

- **`src/features/rules/`** — SDC-CORE/DATA/ORDER/LAYOUT/GRID/ROUTE/UX validators, registry, `sdcContract.test.ts`.
- **`src/features/grid/`** — grid map, routing zone, reservation, `gridRouter`, `gridPathAdapter`; wired via `routingEngine: "grid"`.
- **`src/features/layoutHybrid/`** — lock-on-edit helpers (`clearAllHybridLocks`, `onEditLock`, `useLayoutHybrid`).
- **`LayoutOverrides`** — `routingEngine`, `gridRoutes`, `gridLocks`; `mergeLayoutOverrides` updated.
- **`WorkflowCanvas`** — import runs `runImportRules`; unlock/reset toolbar; grid mode disables Auto/Manual toggle.
- **Docs:** [`RULE_ID_MAP.md`](./RULE_ID_MAP.md), `LAYOUT_RULES.md` pointer to SDC tests.
- **Scripts:** `test:layout` includes SDC contract; new `test:sdc`.

### Try grid routing

Set `routingEngine: "grid"` in exported `.sdc.json` or `VITE_ROUTING_ENGINE=grid` in dev.

### Next (backlog)

- Wire `rerouteLocalOnGrid` into live drag for incremental perf.
- Full SDC-UX-001: overlay always on in hybrid (leg drag → grid lock without manual mode).
- Port more `spliceEdgeRouting.test.ts` cases to `gridRouter.test.ts`.
- Default `routingEngine` to `grid` after golden parity.

### Verification

- `npm run test:layout` — 124/124
- `npm run test:sdc` — green
- `npm run check` + `npm run build` — green
- `npm run test:ci` — 1 pre-existing fail (`parseBentleyCsv.test.ts` poleNumber)
