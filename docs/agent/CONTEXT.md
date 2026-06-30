# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-30)

**Left-SP-3254.5 import QA (PR #42)** — layout pair alignment + default-width tie-break landed; re-import selects W1400. CH 3254 straight-run unit test passes; center ATMS congestion deferred. See `docs/reference/import-diagnostics/Left-SP-3254.5-assessment.md`.

**Docs cleanup** — archived completed build plans to `docs/archive/`; `ROUTING_FIRST_LAYOUT.md` is the live import architecture reference.

**Import optimizer (shipped)** — routing-first search, beam + tiered T0/T1/T2, finalist fallback, worker, diagnostics.

**Quad / top-bottom** — four-edge placement + render adapters; see [`QUAD_LAYOUT.md`](./QUAD_LAYOUT.md).

**SDC-LAYOUT-003** — side assignment rule (stack/side consistency + paint vs candidate).

**Rule example library** — `docs/reference/rule_examples/` (SDC metadata + `index.json`).

## Active build track

- Smart manual adjustment (SDC-UX-001)
- PDF export polish
- Center ATMS routing congestion on Left-SP-3254.5 (deferred)
- Manual QA: import Left-SP-3254.5; `VITE_DEBUG_IMPORT_OPTIMIZER=1` when debugging import

## Branch

- `cursor/left-sp-3254-import-qa-7a31` — SP-3254.5 fixes + QA artifacts (open PR #42)
