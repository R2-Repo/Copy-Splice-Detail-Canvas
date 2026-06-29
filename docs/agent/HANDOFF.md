# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-29 — **top/bottom diagnostics fix** (`cursor/fix-topbottom-diagnostics-7c68`)

### This session

**User question:** Why no cables on top/bottom in real imports? Logs say "no top/bottom candidates generated" while `topOrBottomReachedT0` / `topCandidates` show T/B work.

**Findings (not a generation block):**
- `topCandidates` = **best-scoring** candidates (misleading name), not top-edge-only.
- Search **does** try T/B on real CSVs (e.g. Left-SP: 42 T0, 36 T1). Synthetic `syntheticTopBottomReliefGraph` can win T/B.
- Real imports keep L/R because: (1) heuristic fully passes rules; (2) T/B fail **SDC-LAYOUT-001** at T1 proxy (36× on Left-SP); (3) `evaluatedT2: 0` — no finalists; (4) recoverable selection keeps heuristic (`heuristicWon: true`).
- False WARNING: `appendTopBottomNotes` checked `topOrBottomGenerated === 0` while generation counts only ran in `layoutSearch.ts` seed loop (stale vs tier counters); note also duplicated on worker merge + flush.

**Fix:**
- Record `recordCandidateGenerated` on first T0 eval in `recordCandidateEvaluated` (WeakMap dedupe).
- Reconcile `generated` / `topOrBottomGenerated` from tier stats when lagging.
- Warning when **no T0 T/B tries**; drop worker-side `appendTopBottomNotes` (flush only).
- Console label: "Best-scoring candidates (not top-edge only)".

**Gate:** `npm run smoke` pass.

### Manual QA

Import Left-SP-3254.5 with `VITE_DEBUG_IMPORT_OPTIMIZER=1` — no false "no top/bottom" WARNING; top/bottom summary shows reached T0/T1 > 0.

### Frozen

`spliceEdgeRouting.ts` — not touched.
