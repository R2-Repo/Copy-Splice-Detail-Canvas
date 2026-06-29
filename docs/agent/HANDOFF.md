# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-29 — **quad LAYOUT-001 T1 fix** (`cursor/quad-layout001-t1-fix-7c68`)

### This session

**Problem:** Top/bottom candidates reached T0/T1 on real imports but failed **SDC-LAYOUT-001** at T1 proxy — top cables were proxied to `left` for L/R spacing checks (Y overlap), blocking promotion to T2.

**Fix:**
- New `edgePlacement.ts` — four-edge side + stack order for spacing rules.
- `buildQuadReactFlowGraph` returns `edgePlacement`; threaded through T1/T2 rule context.
- LAYOUT-001-B/C: all four edges; top/bottom use X-axis overlap/gap; boxes from React Flow nodes.
- `buildSdcContext` resolves `edgePlacement` from candidate, painted quad nodes, or quad graph result.

**Tests:** `quadLayout001.test.ts` — Left-SP top+cable stack + synthetic relief pass LAYOUT-001 at T1.

**Gate:** `npm run smoke` pass.

### Manual QA

Import `Left-SP-3254.5` with `VITE_DEBUG_IMPORT_OPTIMIZER=1` — top/bottom candidates should show fewer LAYOUT-001 rejections at T1; check whether search promotes T/B finalists (may still lose on score vs heuristic).

### Frozen

`spliceEdgeRouting.ts` — not touched.
