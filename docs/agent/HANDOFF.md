# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-29 — **SDC-LAYOUT-003** merged with main **SDC-LAYOUT-002 quad fix** (#30)

### Root cause (shared)

Import rule checks rebuilt a default 2-side layout but validated the optimizer's **quad** React Flow nodes → false `SDC-LAYOUT-002` failures in logs.

### This branch adds

| Area | Change |
|------|--------|
| `layout003.ts` | **SDC-LAYOUT-003** — stack/side consistency + rendered vs candidate edge |
| `tieredEvaluate.ts` | Candidate in T0 rule context for LAYOUT-003 |
| Rule pack | `17_SDC-LAYOUT-003_*.md` + index |

### From main (#30, kept)

| Area | Change |
|------|--------|
| `buildSdcContext.ts` | `buildLayoutRuleContextFromEvaluated` — no layout rebuild |
| `quadGeometry.ts` | `quadStemAlignCanvasValue`, `quadFansTowardCenter`, `quadSameSideStemColumnsAligned` |
| `layoutRules.ts` | Quad-aware LAYOUT-002 checks; skip horizontal tube geometry for quad slim |
| Tests | `quadGeometry.validation.test.ts`, `layout002Import.test.ts` |

### Gates

- `npm run smoke` — pass after merge
- `layout003.test.ts`, `layout002Import.test.ts`

### Manual QA

Import Left-STATE_OFFICE with `VITE_DEBUG_IMPORT_OPTIMIZER=1`; quad finalists should not mass-fail LAYOUT-002; LAYOUT-003 catches stack/paint mismatches.

### Frozen

`spliceEdgeRouting.ts` — not touched.
