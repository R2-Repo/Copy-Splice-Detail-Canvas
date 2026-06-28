# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-28)

**Post-import interaction restore.** Optimized import kept; Phase 6 side-drag gated to quad layouts only (edge-proximity on drag-stop). Horizontal layouts use legacy incremental drag + fixedPlacement from candidate.

## Active build track

- **Routing-first auto layout — Phase 6 gated** — horizontal drag restored; quad side-move on drag-stop near canvas edge only.
- **Import paint fix** — static engine-node handles + handle remeasure on import.
- Legacy `USE_LEGACY_IMPORT_LAYOUT=1` fallback still present.

## Testing policy

- **Default:** `npm run smoke` (check + `test:fast` + build) — few minutes
- **Manual QA:** import example-2 — zoom, cable Y-drag, fiber/tube adjust in auto + manual modes
- KI-003 (Left-SPI-215) still skipped unless `RUN_KNOWN_ISSUES=1`

## Session gate

```bash
npm run smoke          # every session
```

## Baseline

- Branch: `cursor/restore-post-import-interaction-14a3`
- Frozen: `.cursor/rules/frozen-routing.mdc`
