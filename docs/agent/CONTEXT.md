# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-28)

**Import perf fast-path** — when heuristic passes all hard rules (non-debug), paint immediately and run background optimizer (`searchProfile: background`, reduced caps). Debug mode keeps full synchronous search for diagnostics baseline.

**Recoverable import fallback** — heuristic in final pool; `pickBestRecoverableCandidate` when no finalist fully passes.

**Import optimizer** — beam search, T1 pruning for hopeless top/bottom (no relief), geometry-key rule cache, 10s/15s perf budget (non-debug).

## Active build track

- Import perf fast-path + T1 pruning + geometry cache + perf budget
- Import optimizer — recoverable fallback + route-aware seeds
- Routing-first auto layout — Phase 6 gated

## Search modes

| Env | Behavior |
|-----|----------|
| default / `VITE_LAYOUT_SEARCH_MODE=beam` | Beam → T0/T1/T2; heuristic fast-path when feasible |
| `VITE_DEBUG_IMPORT_OPTIMIZER=1` | Full blocking search + diagnostics (no perf budget) |
| `VITE_LAYOUT_SEARCH_MODE=legacy-guided` | Hill-climb restarts |

## Perf budget (non-debug)

- Warn: 10s optimizer wall
- Fail banner: 15s
- QA: `SDC_ENFORCE_PERF_BUDGET=1` on `scripts/import-diagnostics-qa.mjs`

## Testing policy

- **Default:** `npm run smoke`
- **Manual QA:** Left-STATE_OFFICE — heuristic fast-path ~1–2s paint; background search optional upgrade
- Diagnostics baseline: `VITE_DEBUG_IMPORT_OPTIMIZER=1` + QA script (unchanged)

## Branch

- `cursor/import-perf-fast-path-2e03`
