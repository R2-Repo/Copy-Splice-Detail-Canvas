# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-29)

**Quad LAYOUT-001 at T1** — four-edge `edgePlacement` + axis-aware spacing; top/bottom no longer false-fail at T1 proxy.

**Top/bottom diagnostics** — `topOrBottomGenerated` on first T0 eval; warning uses `topOrBottomReachedT0`; duplicate worker note removed.

**Fixed layout + fit-to-view** — diagram geometry is content-driven only; viewport zoom/pan adapts to screen size.

**SDC-LAYOUT-003** — side assignment rule (stack/side consistency + paint vs candidate).

**Routing-first side placement** — optimizer assigns L/R/T/B [SDC-CORE-001], [SDC-SCORE-001].

**Rule example library** — `docs/reference/rule_examples/` (SDC metadata + `index.json`); supersedes `routing-examples/`. Glossary PNG crops removed — use live app + CSV import.

## Active build track

- Import optimizer / routing-first layout
- Manual QA: import Left-SP-3254.5 with `VITE_DEBUG_IMPORT_OPTIMIZER=1` after T/B fixes

## Branch

- `cursor/quad-layout001-t1-fix-7c68` — combined diagnostics + LAYOUT-001 T1 fix
