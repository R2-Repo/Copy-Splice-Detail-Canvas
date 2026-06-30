# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-30)

**Dev sidecar (shipped)** — headless TS eval CLI (`tools/sdc-eval/`, `npm run sdc:eval`) + Python orchestrator (`tools/sdc-sidecar/`) for batch import/search/rules without browser. See [`TESTING.md`](./TESTING.md).

**Import optimizer (shipped)** — routing-first search, beam + tiered T0/T1/T2, finalist fallback, worker, diagnostics.

**Quad / top-bottom** — four-edge placement + render adapters; see [`QUAD_LAYOUT.md`](./QUAD_LAYOUT.md).

**Rule example library** — `docs/reference/rule_examples/` (SDC metadata + `index.json`).

## Active build track

- Smart manual adjustment (SDC-UX-001)
- PDF export polish
- Manual QA: import Left-SP-3254.5; `VITE_DEBUG_IMPORT_OPTIMIZER=1` when debugging import
- Dev routing/import iteration: `python -m sdc search …` or `npm run sdc:eval`

## Branch

- `main`
