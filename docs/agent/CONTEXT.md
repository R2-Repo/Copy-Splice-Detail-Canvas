# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Baseline

- Branch: `main` @ tag `layout-baseline-v1`
- Verified: `npm run verify` — all 31 layout rules on Examples #1–#3 + production CSVs

## Current phase

**Layout stabilization** — baseline merged to `main`; contract tests green.

## In scope NOW

- **3161.4 BL tube bundle** — import + post-drag order + loop-back bend fix; user visual re-test pending
- Bug fixes: one example, one rule ID, max 2 source files per session

## Out of scope until stabilization complete

- PDF export, PNG typography polish, new layout rule IDs
- Refactors of `spliceEdgeRouting.ts` (split deferred)
- New npm dependencies

## Rule priority (conflicts)

See [`RULE_PRIORITY.md`](./RULE_PRIORITY.md). EDGE-004 wins over EDGE-011.

## Active decisions

| Topic | Choice | Notes |
|-------|--------|-------|
| CSV import | Direct interpret + internal normalize | No cleaned.csv rewrite |
| Cable leg identity | **Cable name only** at splice | Remote `device` diagnostic only |
| Side assignment | Bend-first exhaustive + height balance | `compareSideAssignments` in `layoutScoring.ts` |
| Cable stack order | Barycenter (2-pass Sugiyama) | Dominant pair still first |
| Full butt splice | **Auto-enable on import** when detected | Toggle persists; row layout excludes collapsed fiber pairs |
| Canvas | `@xyflow/react` | LayoutOverrides v8 |
| Layout scope | Auto-layout on **import** + drag rowOffset/routing refresh for **moved cable only** | No full-diagram re-route after import |
| Same-side routing | Inward H–V–H detour | 60px jog after measured OS column |
| Center spacing | Packed midX lanes per zone | Min 24px; never collapse on infeasible inset |
| Layout regressions | Rules doc + contract tests | Must pass before merge |
| New npm deps | User approval required | PDF lib TBD |

## Known issues (ordered)

1. SPI-215 / busy diagrams: lane assign runs; handle-row Y-offsets stored on edges but **not yet drawn** in `buildDemarcatedSplicePaths` (still ≤2-bend handle-row paths). Re-test SPI-215&I-80 after import.
2. PNG visual parity incomplete
3. PDF export blocked on dep approval

## Blockers

None for Examples #1–#3 contract tests.

## Canonical docs (read order)

1. [`SCOPE.md`](./SCOPE.md) — product requirements
2. [`RULE_PRIORITY.md`](./RULE_PRIORITY.md) — conflict resolution
3. [`LAYOUT_RULES.md`](./LAYOUT_RULES.md) — layout contract (31 rules)
4. [`CSV_SEMANTICS.md`](./CSV_SEMANTICS.md) — parser/import semantics
5. [`HANDOFF.md`](./HANDOFF.md) — last session only
6. [`RULE_DICTIONARY.md`](./RULE_DICTIONARY.md) — plain-English rule IDs
7. [`CANVAS_GLOSSARY.md`](./CANVAS_GLOSSARY.md) — diagram component names + screenshots
