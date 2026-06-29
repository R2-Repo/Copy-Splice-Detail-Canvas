# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-29 — **300N&MAIN import diagnostics QA** (`cursor/north-temple-import-qa-4b2d`)

### VM test run

Headless QA on **300N_MAIN.csv** (splice **300N&MAIN**, user “North Temple” fixture) with all debug flags:

- `VITE_DEBUG_IMPORT_OPTIMIZER=1` (+ timing, candidates, rules, top/bottom, layout search)
- Script: `scripts/import-diagnostics-qa.mjs`
- Artifacts: `docs/reference/import-diagnostics/300N_MAIN-*`

**Result:** search candidate fully passes rules; heuristic rejected on soft score. Worker search ~1.2s; no config banner. Screenshot + console log + diagnostics JSON committed.

### Gates

- `npm run smoke` — pass on branch

### Manual QA

Import `300N_MAIN.csv` or `Left-STATE_OFFICE.csv` with debug flags; compare `recoverableSelection` in console vs committed JSON samples.

### Frozen

`spliceEdgeRouting.ts` — not touched.
