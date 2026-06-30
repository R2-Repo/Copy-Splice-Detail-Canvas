# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-30)

**4-side cable drag (post-import)** — any routing-first import can drag cables to L/R/T/B with full flip/reroute via `applyCableSideDragCommit`; L/R-only imports promote to quad on first top/bottom placement; live preview during drag; manual mode skips lock.

**SDC-ROUTE-001 routing box** — two-case zone docs (L/R-only vs four-sided); quad anchors use cable `quadSide`; horizontal vertical bounds from L/R fibers only.

**Import soft score (SDC-SCORE-001)** — bend ladder (0→1→2 corners), single-bend top/bottom credit, `sidesUsed` removed from score total. Hard cap unchanged (**SDC-ROUTE-004** ≤2 corners).

**Python sidecar v0.2** — TS eval daemon pool, `deep-search` / `compare` / `sweep`, topology-aware candidate gen, tiered eval pipeline, SQLite cache, PWA stub (`deepSearchClient.ts`). See [`tools/sdc-sidecar/README.md`](../../tools/sdc-sidecar/README.md).

**sdc-workspace (`run.bat`)** — one-click CSV → `rank-*.sdc.json`: daemon refresh, `import-rules` preflight (warn-only), app-matched `timeBudgetMs`, `export-top` with fresh TS rules from `src/features/rules/`.

**Import optimizer (shipped)** — routing-first search, beam + tiered T0/T1/T2, finalist fallback, worker, diagnostics.

**Quad / top-bottom** — four-edge placement + render adapters; see [`QUAD_LAYOUT.md`](./QUAD_LAYOUT.md).

## Active build track

- Smart manual adjustment (SDC-UX-001)
- PDF export polish
- Manual QA: import example-2; `VITE_DEBUG_IMPORT_OPTIMIZER=1` when debugging import
- Dev deep-search: `npm run sdc:sidecar -- deep-search …` or `npm run sdc:verify`

## Branch

- `main`
