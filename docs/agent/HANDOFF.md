# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-29 — **SDC-LAYOUT-002 import false failures** (merged with main routing-first docs)

### Root cause

Import rule checks rebuilt a default 2-side layout (`buildLayoutRuleContext`) but validated the optimizer's **quad** React Flow nodes. Stem-column alignment grouped cables by stale left/right placement, so quad finalists falsely failed `SDC-LAYOUT-002` ("shared label column misaligned").

### Fix

| Area | Change |
|------|--------|
| `buildSdcContext.ts` | `buildSdcContextFromLayout` derives placement from evaluated cable nodes — no rebuild |
| `quadGeometry.ts` | `quadStemAlignCanvasValue`, `quadFansTowardCenter`, `quadSameSideStemColumnsAligned` |
| `layoutRules.ts` | Quad-aware stem alignment + fan direction; skip horizontal-only tube geometry for quad slim; SDC check IDs (`SDC-LAYOUT-002-A` … `H`) |
| Tests | `quadGeometry.validation.test.ts`, `layout002Import.test.ts` (STATE_OFFICE heuristic + quad seeds) |

### Gates

- `npm run smoke` — pass after merge
- `layout002Import.test.ts` — STATE_OFFICE quad seeds pass SDC-LAYOUT-002

### Manual QA

Import Left-STATE_OFFICE with optimizer on; confirm optimizer finalists no longer all fail SDC-LAYOUT-002 in `VITE_DEBUG_IMPORT_RULES=1` console table.

### Frozen

`spliceEdgeRouting.ts` drag hooks — not touched.

---

## Prior session (main, 2026-06-29)

**Routing-first side placement documentation** — SDC-CORE-001, rule pack, QUAD_LAYOUT.md, agent docs: top/bottom edges are optimizer outcomes, not a user mode toggle. Documentation-only; no code behavior change.

---

## Prior session

2026-06-28 — Recoverable import fallback. See git history.
