# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Baseline

- Branch: `main`
- Verified: **`npm run verify`** green — `test:layout` **114/114**, `test:ci` **422/422**, `check`, `build`

## Current phase

**Stabilization build complete (tests green) — user manual QA reports no visible improvement.** Next work = issue-by-issue fixes from user symptom list.

## In scope NOW

- **User-driven bug fixes** — start from manual QA findings (same issues as before stabilization)
- Capture per issue: fixture/CSV, simple-term description, expected vs actual

## Out of scope until stabilization complete

- Full PDF export, PNG typography polish
- Y-track horizontal deconflict (disabled — strict ≤2 bends)
- New npm dependencies

## Rule priority (conflicts)

See [`RULE_PRIORITY.md`](./RULE_PRIORITY.md). EDGE-004 strict ≤2 bends; widen layout via `resolveFeasibleImportLayout` instead of Y-tracks.

## Active decisions

| Topic | Choice | Notes |
|-------|--------|-------|
| Layout overrides | **v14** | `connectionOverrides` / `bundleOverrides`; `legOverrides` bridged on merge |
| Manual anchor coords | **`fiberAnchorCenter()`** | Single helper in `handleCoords.ts`; uses `diagramScale` + `alignedStemX` |
| Bundle lane clamp | **Uniform shift** | `shiftCoherentBundleMidXLanes` preserves 24px spacing + EDGE-005 order |
| Crossover packing | **Clamp start once** | `packMidXLanes` + `enforceDistinctMidXLanes` (no per-lane collapse) |
| Frozen routing | **Respected** | `assignSpliceRoutingLanes` clamp path adjusted minimally for bundle shift |

## Known issues (ordered)

1. **User QA (2026-06-13): no visible change** — same diagram/routing/manual issues as before stabilization session
2. PNG visual parity incomplete
3. Callout text does not auto-update when toggling existing splices
4. Glossary screenshot crops not in repo

## Blockers

None for **automated** layout contract (`test:layout` green). **User-visible** issues remain unaddressed until reproduced and fixed one-by-one.

## Canonical docs (read order)

1. [`SCOPE.md`](./SCOPE.md)
2. [`RULE_PRIORITY.md`](./RULE_PRIORITY.md)
3. [`LAYOUT_RULES.md`](./LAYOUT_RULES.md)
4. [`STABILIZATION_PLAN.md`](./STABILIZATION_PLAN.md)
5. [`HANDOFF.md`](./HANDOFF.md)
