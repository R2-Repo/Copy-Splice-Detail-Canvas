# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-05-26 — SPI-215 render-time midX collapse fix.

## Done

- **Root cause:** Import packed distinct `routingMidX` lanes, but `routingMidXForRender` re-ran `enforceMinHorizontalInset` with per-circuit tag widths and collapsed many strands onto one vertical X (looked unchanged in browser).
- **Fix:** Preserve `midX` when already inside tag-aware inset band; pack lanes with `sourceTagWidth` / `targetTagWidth` from `buildSpliceHandleEntries`.
- Prior: lane assign re-enabled (`assignGapBendLaneXs`, `assignSideHorizLaneYs`, vert deconflict).
- **Regression:** `routingMidXForRender keeps distinct packed lanes` + SPI-215 EDGE-011 test.

## Next

- Hard-refresh **http://localhost:5173/** and re-import SPI-215_I-80 — vertical legs should separate at 24px `midX` lanes.

## Commands verified

- `npm run verify`
