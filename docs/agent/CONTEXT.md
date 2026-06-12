# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Baseline

- Branch: `main` @ tag `layout-baseline-v1`
- Verified: `npm run test:layout` — Examples #1–#3 + SPI-215 strict EDGE checks

## Current phase

**Manual + Auto engine stabilization** — persistence, path-based warnings, leg commit validation; toggle does not rebuild layout.

## In scope NOW

- **Cable sheath visuals** — ~15% smaller bordered cable box; black border; lighter inside label text (tube/fiber labels unchanged for now)
- **Regression fix (2026-06-12)** — isolate near-splice leg segment drag from cable drag: `pinCableLegHandles` for manual cable sync; full rebuild on manual side flip; skip `legOverrides` in auto mode
- **Toggle Auto/Manual** — flag + UI only; diagram unchanged until cable drag in Auto (or manual fan-out/leg edits in Manual)
- **Auto-mode cable drag** — live drag uses `dragSync` (routing only); stack collision on drag stop
- **Manual adjust** — `LayoutOverrides` v13; fixed **handle column**; fan-out/labels vertical drag; **direct leg segment drag** (invisible hit strips + axis cursor); shift+click + box marquee multi-select; DOT-003 (48px corner clearance); invalid leg commit reverts + banner
- **Cable callouts** — toolbar on/off toggle; `calloutsVisible` in `LayoutOverrides`; text/positions kept when hidden
- **Print to PDF (V1)** — toolbar button; browser print dialog → Save as PDF; WYSIWYG canvas export (not model-based vector PDF yet)
- `test:ci` CSV path cleanup (`docs/reference/examples/old csv examples/`)

## Out of scope until stabilization complete

- Full PDF export (title block, pagination, model-based vector output), PNG typography polish
- Y-track horizontal deconflict (disabled — strict ≤2 bends)
- New npm dependencies

## Rule priority (conflicts)

See [`RULE_PRIORITY.md`](./RULE_PRIORITY.md). EDGE-004 strict ≤2 bends; widen layout via `resolveFeasibleImportLayout` instead of Y-tracks.

## Active decisions

| Topic | Choice | Notes |
|-------|--------|-------|
| Manual adjust | **Engine module** | `src/features/manualAdjust/`; `useManualAdjustEngine` + `ManualAdjustOverlay` |
| Handle column | **Fixed at max label width** | ~154px from stem; labels grow inward from handle; routing tag width = 0 at handle |
| Fan-out drag | **Vertical per tube** | `fanoutOverrides.shiftY` canonical on read (wins over `tubeOverrides.visualShiftY`); both written on commit; buffer tube stretches; horizontal reach handle removed |
| Mode toggle | **No layout rebuild** | `mergeLayoutOverrides` preserves `legOverrides` / `fanoutOverrides`; Reset clears all three override maps |
| Smart snap | **Disabled** | `snapTipTargets = []` until re-enabled deliberately |
| Leg segments | **Direct drag on leg** | `legOverrides` v13; invisible hit strips + axis cursor; Rules 3–4 in `constraints.ts` |
| Multi-select | **Shift+click + box marquee** | Fiber anchor nodes; group drag with per-splice constraints |
| Auto cable drag | **`dragSync` during pointer move** | Skips collision until drag stop; `syncNodesEngineDragLayout` |
| Tube overrides | **`vcId\|tubeColor` keys** | `visualShiftY` (fan-out shift); locked tubes skip auto TUB-008 |
| Callouts | **One per cable node** | Fixed 200px width; dynamic height; straight leaders; discrete border anchors; `LayoutOverrides.callouts` v11 |
| Print to PDF | **Browser print (V1)** | `src/features/export/`; fits viewport to diagram bounds; `@media print` landscape; restores viewport after print |
| Cable sheath | **~15% smaller, black border** | `SHEATH_SIZE` in `cableBreakoutGeometry.ts`; CSS in `splice-diagram.css`; fiber pitch unchanged |
| DOT-003 | **48px corner clearance** | Enforced on import; exempt tube dot columns + span &lt;96px |
| EDGE-004 | **Max 2 bends always** | Demarcation at horizontal dot may reduce counted bends |

## Known issues (ordered)

1. Example #2 `EDGE-010` layout check failing in `layoutRules.test.ts` (tube bundle lane spacing — investigate separately)
2. Many `test:ci` tests still reference Example CSVs under `docs/reference/examples/` (files live in `old csv examples/`)
3. PNG visual parity incomplete
4. Callout text does not auto-update when toggling existing splices (re-click button)
5. Glossary screenshot crops (`docs/reference/images/glossary/00`–`03`) not in repo — capture from `?fixture=example-2` + `scripts/crop-glossary-shots.ps1`

## Blockers

Example #2 `EDGE-010` fails `npm run test:layout` — pre-existing / separate from manual-leg work.

## Canonical docs (read order)

1. [`SCOPE.md`](./SCOPE.md) — product requirements
2. [`RULE_PRIORITY.md`](./RULE_PRIORITY.md) — conflict resolution
3. [`LAYOUT_RULES.md`](./LAYOUT_RULES.md) — layout contract (34 rules incl. DOT-*)
4. [`HANDOFF.md`](./HANDOFF.md) — last session only
