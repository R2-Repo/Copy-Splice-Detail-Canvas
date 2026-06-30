# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-30)

**Python sidecar v0.2** — TS eval daemon pool, `deep-search` / `compare` / `sweep`, topology-aware candidate gen, tiered eval pipeline, SQLite cache, PWA stub (`deepSearchClient.ts`). See [`tools/sdc-sidecar/README.md`](../../tools/sdc-sidecar/README.md).

**Import optimizer (shipped)** — routing-first search, beam + tiered T0/T1/T2, finalist fallback, worker, diagnostics.

**Quad / top-bottom** — four-edge placement + render adapters; see [`QUAD_LAYOUT.md`](./QUAD_LAYOUT.md).

## Active build track

- Smart manual adjustment (SDC-UX-001)
- PDF export polish
- Manual QA: import example-2; `VITE_DEBUG_IMPORT_OPTIMIZER=1` when debugging import
- Dev deep-search: `npm run sdc:sidecar -- deep-search …` or `npm run sdc:verify`

## Branch

- `main`
