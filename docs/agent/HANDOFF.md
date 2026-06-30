# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-30 — **SDC workspace + export-top**

### This session

- **`sdc-workspace/`** — drop CSV in `input/`, double-click **`run.bat`**, get `output/rank-*.sdc.json` for web **Import file**.
- **`export-top`** command on `npm run sdc:eval` — search + paint + write `.sdc.json` (same schema as Export workspace).
- **`buildDiagramConfigFromOverrides.ts`** — headless config builder (no localStorage).
- **`npm run sdc:workspace`** — runs workspace from repo root.
- Python `sdc export-top` wired to TS CLI.

**Gate:** `npm run check` pass; `npm run sdc:workspace` tested on Left-SP-3254.5 (2 feasible ranks on small fixture).

### Manual QA

1. `npm run sdc:workspace` (or double-click `sdc-workspace/run.bat`).
2. In app: **Import file** → `sdc-workspace/output/rank-1.sdc.json`.
3. Confirm diagram loads; optionally export/import roundtrip from app.

### Frozen

`spliceEdgeRouting.ts` — not touched.
