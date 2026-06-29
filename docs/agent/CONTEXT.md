# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-29)

**Fixed layout + fit-to-view** — diagram geometry is content-driven only; viewport zoom/pan adapts to screen size (no viewport-fill column stretch).

**Import searchStats diagnostics** — worker slice now records tier counters alongside eval sub-phases.

**SDC-LAYOUT-001 import validation** — spacing checks use painted candidate geometry.

**SDC-LAYOUT-003** — side assignment rule (stack/side consistency + paint vs candidate).

**Routing-first side placement** — optimizer assigns L/R/T/B [SDC-CORE-001], [SDC-SCORE-001].

## Active build track

- Import optimizer / routing-first layout
- Manual QA: import example-2 + Left-SP-3254.5 after viewport behavior change

## Branch

- `cursor/fixed-layout-fit-view-f283` — fixed layout width + fit-to-view on import/resize
