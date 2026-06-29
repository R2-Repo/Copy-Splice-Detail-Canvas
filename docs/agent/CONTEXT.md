# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-28)

**SDC rule vocabulary cleanup** — legacy rule IDs removed from agent-facing docs. New active rule **SDC-ROUTE-004** (bend budget). **24px pitch** documented in **SDC-GRID-001** + cross-refs. Renamed: `heuristicImportLayout`, `hill-climb` search mode, `composite` routing engine.

**Import perf fast-path** — heuristic T2 → immediate paint; background optimizer.

## Active build track

- SDC docs + failure messages (Tier 1 done)
- Dropped-rule code migration — see [`DROPPED_RULE_ENFORCEMENT.md`](./DROPPED_RULE_ENFORCEMENT.md) (DOM, CBL-005, bundle/nest — frozen routing needs approval)
- Import optimizer / routing-first layout

## Q&A decisions (rule cleanup)

| Topic | Decision |
|-------|----------|
| Bend budget | **SDC-ROUTE-004** — hard, documented everywhere |
| 24px pitch | **SDC-GRID-001** foundation + ORDER/LAYOUT/ROUTE cross-refs |
| Dominant pair | Dropped from contract |
| Ring-cut split | Dropped |
| Fusion dots | Organized line per tube group; horizontal or vertical per path |
| Near-straight snap | **SDC-LAYOUT-001** + **SDC-UX-001** |
| Center nest / jogX | Dropped from contract |
| Q8 path/lane/row rules | Dropped from contract |
| RULE_PRIORITY.md | Deleted — use rule pack index |
| Legacy naming | Renamed in same pass |

## Branch

- `cursor/sdc-rules-cleanup-78ac`
