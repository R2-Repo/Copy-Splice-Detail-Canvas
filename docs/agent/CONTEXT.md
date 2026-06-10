# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Baseline

- Branch: `main` @ tag `layout-baseline-v1`
- Verified: `npm run test:layout` — Examples #1–#3 + SPI-215 strict EDGE checks

## Current phase

**Manual Adjust Engine** — phased implementation complete (handle column, fan-out drag, leg segments, canvas wiring).

## In scope NOW

- **Auto-mode cable drag** — live drag uses `dragSync` (routing only); stack collision on drag stop
- **Manual adjust** — `LayoutOverrides` v13; fixed **handle column**; fan-out/labels vertical drag; **direct leg segment drag** (invisible hit strips + axis cursor); shift+click + box marquee multi-select; DOT-003 (48px corner clearance)
- **Cable callouts** — toolbar button; red editable labels per cable node
- Visual re-test: import Example #2 → Manual adjust → fan-out drag, segment handles, multi-select
- `test:ci` CSV path cleanup (`docs/reference/examples/old csv examples/`)

## Out of scope until stabilization complete

- PDF export (callouts not embedded yet), PNG typography polish
- Y-track horizontal deconflict (disabled — strict ≤2 bends)
- New npm dependencies

## Rule priority (conflicts)

See [`RULE_PRIORITY.md`](./RULE_PRIORITY.md). EDGE-004 strict ≤2 bends; widen layout via `resolveFeasibleImportLayout` instead of Y-tracks.

## Active decisions

| Topic | Choice | Notes |
|-------|--------|-------|
| Manual adjust | **Engine module** | `src/features/manualAdjust/`; `useManualAdjustEngine` + `ManualAdjustOverlay` |
| Handle column | **Fixed at max label width** | ~154px from stem; labels grow inward from handle; routing tag width = 0 at handle |
| Fan-out drag | **Vertical per tube** | `fanoutOverrides` + `visualShiftY`; buffer tube stretches; horizontal reach handle removed |
| Leg segments | **Direct drag on leg** | `legOverrides` v13; invisible hit strips + axis cursor; Rules 3–4 in `constraints.ts` |
| Multi-select | **Shift+click + box marquee** | Fiber anchor nodes; group drag with per-splice constraints |
| Auto cable drag | **`dragSync` during pointer move** | Skips collision until drag stop; `syncNodesEngineDragLayout` |
| Tube overrides | **`vcId\|tubeColor` keys** | `visualShiftY` (fan-out shift); locked tubes skip auto TUB-008 |
| Callouts | **One per cable node** | `LayoutOverrides.callouts` v11 |
| DOT-003 | **48px corner clearance** | Enforced on import; exempt tube dot columns + span &lt;96px |
| EDGE-004 | **Max 2 bends always** | Demarcation at horizontal dot may reduce counted bends |

## Known issues (ordered)

1. Many `test:ci` tests still reference Example CSVs under `docs/reference/examples/` (files live in `old csv examples/`)
2. PNG visual parity incomplete
3. Callout text does not auto-update when toggling existing splices (re-click button)
4. Glossary screenshot crops (`docs/reference/images/glossary/00`–`03`) not in repo — capture from `?fixture=example-2` + `scripts/crop-glossary-shots.ps1`

## Blockers

None for `npm run test:layout`.

## Canonical docs (read order)

1. [`SCOPE.md`](./SCOPE.md) — product requirements
2. [`RULE_PRIORITY.md`](./RULE_PRIORITY.md) — conflict resolution
3. [`LAYOUT_RULES.md`](./LAYOUT_RULES.md) — layout contract (34 rules incl. DOT-*)
4. [`HANDOFF.md`](./HANDOFF.md) — last session only
