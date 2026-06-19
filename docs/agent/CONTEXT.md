# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## SDC modular rules + grid routing refactor (2026-06-18)

- **Rules framework:** `src/features/rules/` — 12 SDC modules, registry, `runImportRules` / `runRules`, legacy bridge (`RULE_ID_MAP.md`).
- **Grid engine:** `src/features/grid/` — GridMap, routing zone, segment reservation, `routeAllOnGrid` (feature-flagged).
- **Routing modes:** `routingEngine` on `LayoutOverrides` — `nodes` (default), `grid`, `legacy`. Env: `VITE_ROUTING_ENGINE=grid`.
- **Hybrid locks:** `src/features/layoutHybrid/` — lock-on-edit helpers; toolbar **Unlock all / reset layout**; Auto/Manual toggle disabled when `routingEngine === "grid"`.
- **CSV guard:** `importRuleGuard.test.ts` + `runImportRules` on import (parse unchanged).
- **Tests:** `npm run test:layout` (legacy + SDC contract), `npm run test:sdc` (rules + grid + import guard).
- **Visual parity:** `CableNode` / `SpliceEdge` unchanged; grid path still emits same precomputed SVG legs.

## Baseline

- Branch: `main`
- `npm run test:layout` green (124). `npm run check` + `npm run build` green.
- Pre-existing: `parseBentleyCsv.test.ts` poleNumber assertion (unrelated).

## Canonical docs

1. [`SCOPE.md`](./SCOPE.md)
2. [`RULE_PRIORITY.md`](./RULE_PRIORITY.md)
3. [`LAYOUT_RULES.md`](./LAYOUT_RULES.md)
4. [`RULE_ID_MAP.md`](./RULE_ID_MAP.md)
5. [`HANDOFF.md`](./HANDOFF.md)
