# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-28 — **Speed up import layout search**

### Done

| Area | Change |
|------|--------|
| Import config | `IMPORT_LAYOUT_SEARCH_CONFIG` — `bruteForceMaxCables: 3`, `plateauRounds: 64`, `timeBudgetMs: 45_000` wired in `WorkflowCanvas` |
| Search eval | `stopOnFail` during search; dedupe by candidate id; async yield every 8 rounds |
| Why | example-2 (4 cables) was brute-forcing 2,520 full evals (~60–70 s); guided path hits same score in ~20 s |

### Test status

| Gate | Command | Result |
|------|---------|--------|
| smoke | `npm run smoke` | **Pass** |

### Manual QA

1. `npm run dev` → `?fixture=example-2`
2. Layout search should finish in **~20–35 s** (was ~60–70 s)
3. Confirm **6 center splice rows** (colored legs + fusion dots) after search

### Next

1. SPI-scale CSV timing with 45 s cap — confirm best-so-far quality
2. Optional Web Worker for UI responsiveness during search

### Frozen

See `.cursor/rules/frozen-routing.mdc` — not touched this session.
