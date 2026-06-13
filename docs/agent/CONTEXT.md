# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Baseline

- Branch: `main`
- Verified: **`npm run verify`** green — `test:layout` **114/114**, `test:ci` **430/430**, `tsc` + `build` clean (incl. 2026-06-13 manual/auto bug-fix + override unification).

## Checkpoint (user-approved — 2026-06-13)

**Best manual adjust + leg routing so far.** User confirmed leg drag fixed (no freeze, smooth enough). Treat this commit/state as a **jump-back point** if later manual/routing work regresses.

Key symbols touched this session:

- `legSegments.ts` — `simplifyOrthogonalPath` on `preserveSplice` reconnect
- `useManualAdjustEngine.ts` — absolute drag from pre-drag snapshot; overlay freeze flag
- `ManualAdjustOverlay.tsx` — cached hit-targets during leg drag; handle coord cache

## Current phase

**User-driven bug fixes** — collapsed thick buffer tubes now manually adjustable in manual mode; leg drag checkpoint preserved.

## Manual/auto bug-fix pass (2026-06-13, verified)

Code-review follow-up — `npm run verify` green (114 layout / 430 ci / build):

- Leg fine-tuning now survives manual cable drag (`applyLegOverridesForConnections`, scoped re-apply; wired into `applyManualCableDrag` + manual `onNodeDragStop`).
- Group leg move resolves each leg's own center segment (`segmentTargets`); single-leg drag unchanged.
- `handleLegOverridesCommit` no longer nests `setState`.
- **Override model unified on `legOverrides`** (H2 Direction A): removed dead `bundleOverrides`, `connectionOverrides` (+ bridge/persistence/legacy-branch wiring), `connectionOverrides.ts` (+ test), `snapTargets.ts`, `accumulateConnectionOverride`. `legOverrides` is now the single splice-override representation the nodes engine applies.
- **C1:** nested `Splice-Detail-Canvas/` scaffold (19 tracked files, no `src`/`docs`, only duplicated `.cursor/rules` + `AGENTS.md`) staged for removal via `git rm -r` — **uncommitted, pending user commit**. No real backslash/shadow source files existed (Windows tooling artifact).
- Still deferred: M1 auto-drag RAF throttle (frozen `refreshDragRouting`/`onNodeDrag`), H4 dead vertical-axis leg machinery.

## Latest (2026-06-13)

**Connection inspector modal (new non-diagram view):**

- Added toolbar action: **Open connection inspector** (read-only modal)
- New overlay shows **left cable list / center connections / right cable list**
- Click center connection highlights matching strands on both sides and auto-focuses cable dropdowns
- Click left/right strand highlights matching center rows and opposite-side strands
- Uses post-import graph model (`ConnectionGraph`) + existing/protect-in-place edge state; no CSV re-inspection UI

Files added:

- `src/features/report/connectionInspectorModel.ts`
- `src/components/ConnectionInspectorOverlay.tsx`
- `src/features/report/connectionInspectorModel.test.ts`
- `src/components/ConnectionInspectorOverlay.test.tsx`

Files updated:

- `src/features/canvas/WorkflowCanvas.tsx`
- `src/components/toolbar/ToolbarIcon.tsx`
- `src/styles/splice-diagram.css`
- `src/App.test.tsx`

Validation command status this session:

- Attempted `npm run test:layout`, `npm run check`, `npm run test:ci`, `npm run build`
- Terminal returned unknown exit status for every command, so pass/fail could not be confirmed in-session

## User testing (canonical)

Import **Left-*** Bentley CSVs from `docs/reference/examples/`:

- `Left-STATE_OFFICE.csv`
- `Left-SPI-215_I-80.csv`
- `Left-SP-3254.5.csv`

**Not used:** dev `?fixture=` URLs (removed), `public/fixtures/`, “Example #1–#3” for manual QA.

## In scope NOW

- Fix issues user sees on **Left-*** imports
- Per issue: which Left file, simple-term symptom, expected vs actual

## Known issues

1. PNG visual parity incomplete
2. Callout text does not auto-update when toggling existing splices
3. Auto layout jumpiness / cable column drag in manual mode (not reported broken after leg fix)

## Blockers

None for automated tests.

## Canonical docs (read order)

1. [`SCOPE.md`](./SCOPE.md)
2. [`RULE_PRIORITY.md`](./RULE_PRIORITY.md)
3. [`LAYOUT_RULES.md`](./LAYOUT_RULES.md)
4. [`HANDOFF.md`](./HANDOFF.md)
5. [`../reference/examples/README.md`](../reference/examples/README.md) — Left CSV list
