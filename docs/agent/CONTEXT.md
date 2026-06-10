# Context



> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).



## Baseline



- Branch: `main` @ tag `layout-baseline-v1`

- Verified: `npm run test:layout` — Examples #1–#3 + SPI-215 strict EDGE checks



## Current phase

**Manual adjust mode (Phase 1)** — toggle auto-relayout; per-tube tip + fan-out reach handles.

## In scope NOW

- **Manual adjust** — toolbar toggle; `LayoutOverrides` v12 (`autoAdjustEnabled`, `tubeOverrides`); soft snap + EDGE advisory banner
- **Cable callouts** — toolbar button; red editable labels per cable node
- **DOT-001/002** — fusion dots on horizontal source rows
- Visual re-test: import Example #2 → Manual adjust → drag tube handles
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

| Manual adjust | **Toggle + tube handles** | `autoAdjustEnabled` default true; cable drag skips full relayout when off |
| Tube overrides | **`vcId\|tubeColor` keys** | `visualShiftY` (tip), `stemReachX` (reach); locked tubes skip auto TUB-008 |
| Callouts | **One per cable node** | `LayoutOverrides.callouts` v11 |

| Callout regen | **Replace all on re-click** | Overwrites manual text |

| DOT group | **Source buffer tube** | `sourceTubeDotGroupKey` = `visualCableId\|tubeColor` |

| Dot row | **Source horizontal** | `sourceY` / `sourceHorizY`; trunk `jogX` when bundled |

| Dot column | **Shared X per tube** | `reconcileBufferTubeDotColumns` after lane assign |

| EDGE-004 | **Max 2 bends always** | Demarcation at horizontal dot may reduce counted bends |



## Known issues (ordered)



1. Many `test:ci` tests still reference Example CSVs under `docs/reference/examples/` (files live in `old csv examples/`)

2. `spliceEdgeRouting.test.ts` 300N_MAIN butt midX band assertion may fail with legacy CSV path

3. PNG visual parity incomplete

4. Callout text does not auto-update when toggling existing splices (re-click button)



## Blockers



None for `npm run test:layout`.



## Canonical docs (read order)



1. [`SCOPE.md`](./SCOPE.md) — product requirements

2. [`RULE_PRIORITY.md`](./RULE_PRIORITY.md) — conflict resolution

3. [`LAYOUT_RULES.md`](./LAYOUT_RULES.md) — layout contract (33 rules incl. DOT-*)

4. [`HANDOFF.md`](./HANDOFF.md) — last session only
