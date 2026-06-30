# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-30 — **Left-SP-3254.5 visual analysis + layout fix WIP** (`cursor/left-sp-3254-import-qa-7a31`)

### This session

- User confirmed import matches `bad-missed-straight-horizontal-splice-routing` + center congestion rules (**SDC-LAYOUT-001**, **SDC-ROUTE-001/002/003**, **SDC-GRID-001**).
- Root causes traced in code (not frozen routing):
  - Import search favored **W1133** (min width) over **W1400** — `centerWidth` soft term only; no handle-alignment term.
  - **6 DROP ↔ 144 MP 258.96** CH 3254 pairs still ~**96px** handle-Y off after layout — pair alignment anchor/reflow order.
  - `findCablePairGroups` used static `vc.side` instead of **placement** side.
  - Post-alignment **reflow** can undo pair Y targets.
- WIP (same branch): `handleMisalignment` + `nearStraightBends` soft score; pair anchor picks min max-gap; conditional lock; placement-aware pair groups.

**Next:** finish CH 3254 straight alignment (6 DROP BL/OR ↔ 144 GR SL/WH), re-import screenshot, prefer default width when misalignment lower.

**Gate:** typecheck passes; full smoke blocked by missing legacy example CSVs in VM (pre-existing).

### Manual QA

- Import `Left-SP-3254.5` — baseline screenshot in `rule_examples/Screenshots from Cursor Agent/`.
- Visual fix verification — **pending** after layout pass lands.

### Frozen

`spliceEdgeRouting.ts` — not touched.
