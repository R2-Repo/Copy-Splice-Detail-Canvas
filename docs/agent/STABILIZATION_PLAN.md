# Splice Detail Canvas — stabilization and fix plan

> Canonical build plan. Kickoff prompt: [`STABILIZATION_BUILD.md`](./STABILIZATION_BUILD.md)

## Goal and constraints

**Goal:** Make the current app reliable and debuggable for real Bentley CSV workflows — import, auto cable drag, manual fine-tune, print PDF — without changing product direction.

**Keep (non-negotiable unless you explicitly reopen):**
- Model-first pipeline: CSV → `ConnectionGraph` → layout → canvas (`SCOPE.md`)
- Nodes routing engine (`ROUTING_ENGINE = "nodes"` in `src/features/diagram/routingEngine.ts`)
- EDGE-004 strict ≤2 bends; Y-tracks stay off (`RULE_PRIORITY.md`)
- React Flow as viewport + interaction shell (not a greenfield SVG-only rewrite)
- Frozen routing symbols per `.cursor/rules/frozen-routing.mdc` — ask before touching

**Out of scope for this plan:**
- New UI / toolbar changes
- New npm dependencies
- Routing philosophy flip (readability-over-bends / Y-track re-enable)
- Full PDF vector export, PNG polish, glossary screenshots
- Parallel greenfield prototype

---

## Agent preamble (every session)

1. Read `AGENTS.md` → `SCOPE.md` → `RULE_PRIORITY.md` → `CONTEXT.md` → `HANDOFF.md`
2. For diagram work: `LAYOUT_RULES.md`, `SIMPLE_TERMS.md`
3. Run baseline: `npm run test:layout` (note current pass/fail count)
4. **Session discipline:** one primary bug → one example CSV → one rule ID → max 2 source files for routing/layout fixes
5. End session: update `CONTEXT.md` + `HANDOFF.md`; run full `npm run verify` when substantive

---

## Phase 0 — Baseline and triage (read-only)

Establish what is broken vs policy vs UX expectation.

| Symptom | Likely class | Action |
|---------|--------------|--------|
| Horizontal lead overlap in dense diagrams | **Policy** (EDGE-004 > overlap) | Document; do not “fix” with Y-tracks without approval |
| Diagram jumps on cable drag release | **Design** (`dragSync` skips collision until stop) | Investigate reducing jump without full collision every frame |
| Manual marquee/selection misses handles | **Bug** (coord mismatch) | Phase 1 |
| Bundle order wrong during live drag | **Bug** (stale `rowOffset`) | Phase 2 |
| Example #2 `EDGE-010` test fail | **Bug** (layout contract) | Phase 3 |
| `legOverrides` lost or misapplied after rebuild | **Bug / fragility** | Phase 4 |
| Failing `packMidXLanes` unit tests | **Regression** | Phase 3 |

**Deliverable:** Short triage note in HANDOFF listing pass/fail on Examples #1–#3, known red tests, and manual QA checklist (`?fixture=example-2`).

---

## Phase 1 — High-confidence bugs (manual coordinate consistency)

**Problem:** Manual hit-testing uses a different coordinate model than rendering in at least one path.

- `handleCoords.ts` and `syncManualVisualCable.ts` pass `diagramScale` + `alignedStemX` to `fiberHandlePosition`
- `useManualAdjustEngine.ts` `anchorPositions()` omits them (lines ~133–137)

**Tasks:**
1. Audit all `fiberHandlePosition` / `tubeHandlePosition` call sites under `manualAdjust/` and `WorkflowCanvas.tsx` manual paths; align with `buildNodesEngineGraph.ts` (canonical)
2. Fix mismatches; add unit test in `constraints.test.ts` or new `handleCoords.test.ts` asserting marquee bounds match rendered anchor positions for scaled cable (`diagramScale !== 1`)
3. Manual QA: Example #2 → Manual mode → shift+click and box marquee on fiber anchors; confirm hits match visible dots

**Files (expected):** `useManualAdjustEngine.ts`, `handleCoords.ts`, small test file

**No frozen routing touched.**

---

## Phase 2 — Auto drag consistency (fix, not redesign)

**Problem:** Live drag and drag-stop use different layout passes by design (`syncNodesEngineDragLayout.ts` vs full `buildReactFlowGraph.ts`), causing perceived instability. Additionally, `rowOffset` on edges comes from layout-time `connectionRowOffsets` while handle X/Y are live — bundle ordering during drag may use stale offsets.

**Tasks:**
1. **Reproduce** on Example #2: import → drag one cable slowly → release; record what changes (routing lanes, bundle nest, cable stack, anchor positions)
2. **Bundle rowOffset during drag:** Evaluate whether `rowOffset` should be recomputed from live handle Y for non-bundle entries only, with bundled entries preserving tube-group order (see unused `assignSpliceRoutingLanesFromLiveHandles` in `spliceCenterLanes.ts` lines 64–72). **Requires user approval if touching frozen `recomputeRowOffsetsFromHandleYs`**
3. **Reduce drag-stop jump:** Prefer tuning drag-stop to reuse last drag-sync routing snapshot where collision adjustment is the only delta. If frozen `refreshDragRouting` / drag hooks must change, get explicit approval.
4. Add test in `syncNodesEngineDragLayout.test.ts`: same positions through `dragSync` then full build → document expected deltas or assert lane stability

**Do not:** Remove `dragSync` or run full collision every pointer move.

---

## Phase 3 — Layout contract and routing regressions

**Blocker:** Example #2 `EDGE-010` fails `npm run test:layout` (tube bundle lane spacing).

**Tasks:**
1. Run failing test; trace through `layoutRules.ts` EDGE-010 and `spliceCenterLanes.ts` bundle packing
2. Fix with minimal scoped change; **do not weaken EDGE-010**
3. Fix `packMidXLanes` / `assignSpliceRoutingLanes` failures in `spliceEdgeRouting.test.ts`
4. Run `npm run test:layout` until Examples #1–#3 + SPI-215 strict EDGE checks pass

**Frozen routing:** If fix requires `bundleJogXForMembers`, `assignSpliceRoutingLanes`, or `reconcileBundleJogXForRender`, follow frozen-routing protocol + `npm run verify` including `visualQa3161.test.ts`.

**Secondary:** Fix `test:ci` CSV path references (`docs/reference/examples/` vs `old csv examples/`).

---

## Phase 4 — Deterministic layout output and override survival

**Tasks:**
1. **Idempotency test:** `layoutDeterminism.test.ts` — same graph + `LayoutOverrides` twice → equal `midX`, `jogX`, paths
2. **Override survival:** `positions`, `fanoutOverrides`, `tubeOverrides`, `legOverrides` survive Auto↔Manual toggle and `mergeLayoutOverrides` round-trip
3. **Auto mode ignores `legOverrides`:** Confirm `buildReactFlowGraph` / `applyAllLegOverrides` matches CONTEXT; fix if wrong
4. **Document** drag vs import differences in `ARCHITECTURE.md` (`dragSync`, collision skip)

---

## Phase 5 — Manual overrides: parameter migration (post-stabilization)

**Goal:** Reduce fragility of segment-index `legOverrides`; keep segment drag UX during transition.

```ts
// LayoutOverrides v14 addition
connectionOverrides?: Record<string, {
  laneOffsetX?: number;
  spliceRowOffsetY?: number;
  dotOffsetX?: number;
}>;
bundleOverrides?: Record<string, { laneOffsetX?: number; rowOffsetY?: number }>;
```

**Tasks:**
1. Define types in `src/types/splice.ts`; bump `layoutVersion`
2. Apply in `computeSpliceLayout.ts` before path build
3. Bridge from existing `legOverrides` on read
4. Wire leg drag to write `laneOffsetX` / `dotOffsetX` where `allowedSegmentAxes` allows
5. Tests: override survives rebuild; Example #2 spot-check
6. Deprecate segment `legOverrides` only after migration test passes

**No UI changes.**

---

## Phase 6 — Test and debug ergonomics

**Tasks:**
1. Layout-slot golden tests (`routingCharacterizationGoldens.test.ts` pattern)
2. Centralize handle coordinate helper — single source for manual engine, overlay, sync
3. Document or wire `assignSpliceRoutingLanesFromLiveHandles` (currently uncalled)
4. Optional dev-only lane assignment diff logging

---

## Phase 7 — Verification and manual QA gate

```bash
npm run test:layout
npm run check
npm run test:ci
npm run build
# If frozen routing touched:
npm run verify
```

**Manual QA:** `?fixture=example-1/2/3` — import, auto drag, manual nudge, toggle, reload, print preview.

---

## Execution order

1. Phase 0 → Phase 1 → Phase 3 → Phase 2 → Phase 4 → Phase 5 → Phase 6 → Phase 7
2. Phases 1 and 3 can parallelize across agents
3. Phase 5 only after `test:layout` is green

---

## Deferred (owner approval required)

| Proposal | Why deferred |
|----------|----------------|
| Y-track / EDGE-011 re-enable | Violates EDGE-004; CONTEXT out-of-scope |
| Readability-first routing | Policy reversal |
| Remove React Flow splice edges | High interaction risk |
| Greenfield SVG prototype | SCOPE rejection; stabilization gate |
| Full model-based PDF | Out of scope |

---

## Success criteria

- `npm run test:layout` fully green (including Example #2 EDGE-010)
- Manual selection/marquee aligned with rendered handles
- Predictable auto drag-stop behavior (documented; jump reduced where possible)
- Overrides survive toggle, reload, rebuild
- `connectionOverrides` bridge reduces `legOverrides` fragility
- No routing philosophy change; no new UI; frozen routing respected
