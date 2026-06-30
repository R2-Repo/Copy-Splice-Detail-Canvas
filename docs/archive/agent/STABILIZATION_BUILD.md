# Stabilization build — agent kickoff

> **Archived (2026-06-30).** Moved from `docs/agent/`. Superseded by routing-first import and build phase in [`SCOPE.md`](../../agent/SCOPE.md). Default gate: `npm run smoke`.
>
> **Broken links:** `RULE_PRIORITY.md` and `SDC_CHECKS.md` were removed — see [`RULE_DICTIONARY.md`](../../agent/RULE_DICTIONARY.md) and `src/features/rules/sdcCheckIds.ts`.

> **Start here (archived).** This file was the handoff for stabilization — not active.

## Full plan

Read the complete phased plan: **[`STABILIZATION_PLAN.md`](./STABILIZATION_PLAN.md)**

## Copy-paste prompt for a new agent

Paste everything inside the block below into a **new Cursor agent chat**:

---

```
Execute the Splice Detail Canvas stabilization build.

## Your mission
Fix and stabilize the existing app. Do NOT change product direction, routing philosophy, or UI. No new npm deps. No greenfield SVG rewrite.

## Read first (in order)
1. AGENTS.md
2. docs/agent/STABILIZATION_PLAN.md  ← canonical build plan for this session
3. docs/agent/SCOPE.md
4. docs/agent/RULE_PRIORITY.md
5. docs/agent/CONTEXT.md
6. docs/agent/HANDOFF.md
7. docs/agent/SDC_CHECKS.md
8. docs/agent/SIMPLE_TERMS.md (when discussing diagram parts)
9. .cursor/rules/frozen-routing.mdc (do not edit frozen symbols without explicit user approval)

## Hard constraints
- Keep: CSV → ConnectionGraph → layout → nodes engine (ROUTING_ENGINE = "nodes") → React Flow shell
- Keep: SDC-ROUTE-004-A strict ≤2 bends; Y-tracks stay OFF (RULE_PRIORITY.md)
- Out of scope: new UI, new features, Y-track re-enable, readability-first routing flip, parallel SVG prototype
- Session discipline: one primary bug → one example CSV → one rule ID → max 2 source files for routing/layout fixes
- Do not weaken layout rules or frozen regression tests without user approval
- End every substantive session: update CONTEXT.md + HANDOFF.md; run npm run verify when done

## Execution order
Follow docs/agent/STABILIZATION_PLAN.md phases in this order:

Phase 0 — Baseline: npm run test:layout + npm run test:ci; triage bug vs policy vs UX; update HANDOFF with pass/fail counts

Phase 1 — Manual coordinate bug (start here if Phase 0 confirms baseline):
  - Fix useManualAdjustEngine.ts anchorPositions() missing diagramScale + alignedStemX on fiberHandlePosition
  - Audit all manualAdjust/ call sites vs buildNodesEngineGraph.ts (canonical)
  - Add test; no frozen routing touched

Phase 3 — Layout contract (after Phase 1, or parallel if separate session):
  - Fix Example #2 SDC-ROUTE-002 failure in layoutRules.test.ts
  - Fix packMidXLanes / assignSpliceRoutingLanes failures in spliceEdgeRouting.test.ts
  - Do not weaken SDC-ROUTE-002; frozen routing needs user approval + npm run verify

Phase 2 — Drag consistency:
  - Stale bundle rowOffset during live drag
  - Reduce drag-stop jump without removing dragSync
  - Frozen: recomputeRowOffsetsFromHandleYs, refreshDragRouting, onNodeDrag* — ask first

Phase 4 — Determinism tests + override survival + document dragSync vs import in ARCHITECTURE.md

Phase 5 — Parameter override migration (only after test:layout is green):
  - Add connectionOverrides / bundleOverrides to LayoutOverrides v14
  - Bridge from legOverrides; wire leg drag to laneOffsetX / dotOffsetX
  - No UI changes

Phase 6 — Centralize handle coords helper; layout-slot golden tests; document dead assignSpliceRoutingLanesFromLiveHandles

Phase 7 — npm run verify + manual QA on ?fixture=example-1/2/3

## Known issues (from CONTEXT.md)
- Example #2 SDC-ROUTE-002 fails test:layout (blocker)
- test:ci CSV paths may point to wrong folder (old csv examples/)
- Manual marquee may miss handles (Phase 1)
- legOverrides fragile on rebuild (Phase 4–5)

## Success criteria
- npm run test:layout fully green (Examples #1–#3)
- Manual selection matches rendered handles on scaled diagrams
- Overrides survive toggle, reload, rebuild
- No routing philosophy change; frozen routing respected

Start with Phase 0, then Phase 1. Report what you find before touching frozen routing.
```

---

## Quick reference

| Phase | Focus | Frozen routing? |
|-------|--------|-----------------|
| 0 | Baseline triage | No |
| 1 | Manual coord bug | No |
| 3 | SDC-ROUTE-002 + unit tests | Maybe — ask first |
| 2 | Drag consistency | Maybe — ask first |
| 4 | Determinism tests | No |
| 5 | Parameter overrides | Minimal |
| 6 | Test ergonomics | No |
| 7 | Verify + QA | — |

## Background (why this build exists)

Owner reviewed external ChatGPT notes on routing/manual issues and simplification. Those notes lacked project context. This build keeps the current architecture (nodes engine, 2-bend policy, React Flow shell) and fixes real bugs: coordinate drift, layout contract failures, drag inconsistency, and fragile `legOverrides`.

## Owner decisions already made (do not reopen without asking)

- Static SVG-only export failed; human polish required (SCOPE.md)
- SDC-ROUTE-004-A > overlap; Y-tracks disabled
- Manual mode fine-tunes layout; does not repair bad auto routes
- Include parameter-based override migration (Phase 5) after bugs are fixed
- No UI changes in this build
