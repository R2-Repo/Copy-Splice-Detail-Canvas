# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-13 — Manual/auto bug-fix pass + override-model unification + nested-copy removal (code review follow-up). **`npm run verify` green** — `test:layout` 114/114, `test:ci` 430/430, `tsc` + `build` clean.

## Session changes

1. **H1 — manual cable drag no longer drops leg fine-tuning.** New `applyLegOverridesForConnections` (`applyManualAdjust.ts`) re-applies saved `legOverrides` **only** to the connections a cable drag rebuilt (scoped — no double-shift on untouched edges; non-butt edges keep their fusion dot via `preserveSplice`, so splice points need no re-sync). Wired into `applyManualCableDrag` (during drag) and the manual same-side branch of `onNodeDragStop`. Gated by presence of `legOverrides`, so no-override diagrams are unchanged.
2. **H3 — removed nested `setState`.** `handleLegOverridesCommit` no longer calls `setNodes` inside a `setEdges` updater; reads live state via `getEdges`/`getNodes`, then sets nodes / persists / refreshes warnings.
3. **H5 — group leg move resolves each leg's own center segment.** `useManualAdjustEngine` now builds `segmentTargets` at pointer-down (`resolveGroupSegmentIndex`); preview + commit use per-connection `(side, segmentIndex)`. Multi-select drag works across legs with different shapes. **Single-leg drag is unchanged** (map holds only the grabbed leg).
4. **Dead code removed:** `manualAdjust/snapTargets.ts` (no importers) and `accumulateConnectionOverride` (no callers).
5. **H2 (Direction A) — override model unified on `legOverrides`.** Removed dead `bundleOverrides` (never written/read), `connectionOverrides` (read only by the dead legacy routing branch) incl. its bridge + eager persistence in `mergeLayoutOverrides` + legacy-branch wiring in `buildReactFlowGraph`; deleted `connectionOverrides.ts` + its test; dropped `ConnectionOverride`/`BundleOverride` types. `legOverrides` is now the single splice-override representation the nodes engine applies (`applyAllLegOverrides`). Old saved layouts with these fields load fine (extra JSON keys ignored; no migration needed).
6. **C1 — nested copy removed.** `git rm -r Splice-Detail-Canvas/` (19 tracked files: duplicate `.cursor/rules`, `AGENTS.md`, configs; no `src`/`docs`). **Staged, not committed.** Investigation showed **no real backslash/shadow source files** — that was a Windows tooling display artifact.

## Frozen-routing note

`onNodeDragStop` is listed in `.cursor/rules/frozen-routing.mdc`. The edit is **only** inside the manual same-side branch (additive override re-apply); the auto full-graph lane-assign + `diagramCenterX` path is untouched. User approved "fix everything" this session.

## Files

Edited: `applyManualAdjust.ts`, `useManualAdjustEngine.ts`, `WorkflowCanvas.tsx`, `layoutStorage.ts`, `buildReactFlowGraph.ts`, `types/splice.ts`. Deleted: `snapTargets.ts`, `connectionOverrides.ts`, `connectionOverrides.test.ts`, and the nested `Splice-Detail-Canvas/` tree.

## Verification

```bash
npm run verify        # PASSED — layout 114/114, ci 430/430 (52 files), tsc + build clean
```

Manual smoke test (still recommended — no automated coverage of the engine drag UX):

1. Import a Left-* CSV, enable **Manual adjust**, drag a fiber leg's center lane ↔, then drag its **cable** sideways → the hand-adjusted leg shape should persist (no snap back to auto).
2. Marquee/shift-click several fiber anchors, drag one selected leg's center segment → the whole group shifts together.
3. Single-leg drag still behaves exactly as the 2026-06-13 checkpoint.

## Not done (deferred)

- **M1** RAF-throttle auto-mode cable drag (`refreshDragRouting`/`onNodeDrag` are frozen — needs approval).
- **H4** remove dead vertical-axis leg machinery in the manual engine (some helpers/tests may reference it).

## Uncommitted

All of this session's work (edits + deletions + nested-copy `git rm`) is **staged/working-tree only — not committed**. Review with `git status`, then commit when ready.

## Next agent

- Do not weaken leg-drag checkpoint or frozen routing without user approval.
- `stemReachX` still in data model for legacy saved layouts; no UI to edit it.
