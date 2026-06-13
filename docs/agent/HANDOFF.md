# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-13 — User manual QA: **no visible change** vs pre-stabilization.

## User QA result (important)

- User tested on local dev server (`http://localhost:5173/`) after stabilization build.
- **Report: app looks and behaves the same as before** — same issues, no perceptible improvement.
- Do **not** assume stabilization fixed UX; treat open issues as still open.

## What this session actually changed (mostly non-visible)

| Area | Change | User-visible? |
|------|--------|---------------|
| Layout contract | EDGE-010 / bundle `packMidXLanes` / `shiftCoherentBundleMidXLanes` — **114/114** `test:layout` | Maybe subtle on Example #2 crossover lanes only |
| Manual coords | `fiberAnchorCenter()` + `useManualAdjustEngine` scale/stem | Only if Manual mode marquee/hit-test was wrong |
| Overrides v14 | `connectionOverrides` / `bundleOverrides` persistence bridge | Only after reload/toggle with saved overrides |
| Tests / CI | 422/422 `test:ci`, goldens, CSV helpers | No |
| Frozen routing | Minimal bundle-shift in `assignSpliceRoutingLanes` | User-approved; may not match their pain points |

## Verified (automated only)

```bash
npm run verify         # pass
npm run test:layout    # 114/114
npm run test:ci        # 422/422
```

## Next agent — recommended start

1. **Ask user for a prioritized issue list** (which fixture/CSV, which simple-term symptom: corners, tube bundle, manual select, drag jump, etc.).
2. **One issue → one CSV → one rule ID** — reproduce in browser before coding.
3. Do **not** re-run full stabilization phases unless a specific regression appears in `test:layout`.
4. Read `SIMPLE_TERMS.md` + map to rule IDs; check `frozen-routing.mdc` before touching routing symbols.
5. If user still sees old behavior: hard-refresh / clear site data (PWA cache) to rule out stale assets.

## Dev server

- App: `npm run dev` → `http://localhost:5173/`
- Fixtures: `?fixture=example-1`, `example-2`, `example-3`
