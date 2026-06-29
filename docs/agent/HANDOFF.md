# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-29 — **top/bottom diagnostics + quad LAYOUT-001 T1** (`cursor/quad-layout001-t1-fix-7c68`)

### This session (combined)

**Diagnostics (was #37):**
- False WARNING "no top/bottom candidates generated" while `topOrBottomReachedT0` > 0.
- `topCandidates` = best-scoring candidates, not top-edge-only.
- Fix: record generation on first T0 eval; reconcile lagging counts; warn only when no T/B reached T0.

**LAYOUT-001 T1 (was #38):**
- Top/bottom candidates failed **SDC-LAYOUT-001** at T1 — top cables proxied to `left`, Y-overlap false fails.
- Fix: `edgePlacement.ts` + four-edge LAYOUT-001-B/C (X-axis for top/bottom).
- Tests: `quadLayout001.test.ts` — Left-SP + synthetic relief pass LAYOUT-001 at T1.

**Gate:** `npm run smoke` pass.

### Manual QA

Import `Left-SP-3254.5` with `VITE_DEBUG_IMPORT_OPTIMIZER=1`:
- No false "no top/bottom" WARNING; summary shows T0/T1 > 0.
- Fewer LAYOUT-001 rejections for T/B at T1; check if search promotes T/B finalists.

### Frozen

`spliceEdgeRouting.ts` — not touched.
