# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-28)

**Post-import zoom/pan fix.** Optimized import now renders at stage width in one pass (no second applyGraph + fitView). Engine cable drag RAF-batched. Resize reflow no longer resets viewport.

## Active build track

- **Routing-first auto layout — Phase 6 gated** — horizontal drag restored; quad side-move on drag-stop near canvas edge only.
- **Import paint fix** — static engine-node handles + handle remeasure on import.
- Legacy `USE_LEGACY_IMPORT_LAYOUT=1` fallback still present.

## Testing policy

- **Default:** `npm run smoke` (check + `test:fast` + build) — few minutes
- **Manual QA:** import example-2 / Left-SP-3254.5 — zoom immediately after import, cable Y-drag, fiber/tube adjust
- KI-003 (Left-SPI-215) still skipped unless `RUN_KNOWN_ISSUES=1`

## Session gate

```bash
npm run smoke          # every session
```

## Baseline

- Branch: `cursor/fix-post-import-zoom-pan-5919`
- Frozen: `.cursor/rules/frozen-routing.mdc`
