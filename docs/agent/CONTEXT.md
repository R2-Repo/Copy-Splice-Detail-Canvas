# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Baseline

- Branch: `main`
- Verified: **`npm run verify`** green — `test:layout` **114/114**, `test:ci` **428/428**

## Checkpoint (user-approved — 2026-06-13)

**Best manual adjust + leg routing so far.** User confirmed leg drag fixed (no freeze, smooth enough). Treat this commit/state as a **jump-back point** if later manual/routing work regresses.

Key symbols touched this session:

- `legSegments.ts` — `simplifyOrthogonalPath` on `preserveSplice` reconnect
- `useManualAdjustEngine.ts` — absolute drag from pre-drag snapshot; overlay freeze flag
- `ManualAdjustOverlay.tsx` — cached hit-targets during leg drag; handle coord cache

## Current phase

**User-driven bug fixes** — collapsed thick buffer tubes now manually adjustable in manual mode; leg drag checkpoint preserved.

## Latest (2026-06-13)

**Collapsed tube manual adjust** — vertical fan-out drag (tip handle ↕) + center vertical leg drag ↔ (same as fiber legs):

- Tip handle only (↕) — **no reach handle** on any tube
- `applyButtCenterVerticalDelta` bypasses fusion-dot guards that blocked drag at splice X
- Butt horizontal drag moves `routingMidX` (no `preserveSplice` on butt reconnect)

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
