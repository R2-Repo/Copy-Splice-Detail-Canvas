# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-13 — Manual leg drag fixed + optimized. **User checkpoint:** best manual adjust / routing so far; use as rollback anchor.

## Checkpoint note

User marked this state **fixed** and requested it be recorded as the **best version of manual adjustment and routing done so far** — a good **jump-back point** if future work regresses drag feel, freezes, or leg path behavior.

To restore: find the git commit on `main` after this session (search log for leg drag / `simplifyOrthogonalPath` / absolute snapshot drag).

## Session fixes (manual leg drag)

1. **Freeze fix** — `reconnectEditedLegPaths` + `preserveSplice` now runs `simplifyOrthogonalPath` after pin (stopped path point explosion 6 → 98k segments).
2. **Smooth drag** — preview applies **total pointer delta** from **pre-drag path snapshot** (not incremental frames on mutated paths).
3. **Perf** — overlay hit-targets **frozen during drag**; `buildHandleCoordsCache` in overlay recompute.

Files: `legSegments.ts`, `legSegments.test.ts`, `useManualAdjustEngine.ts`, `ManualAdjustOverlay.tsx`, `WorkflowCanvas.tsx`.

## User testing workflow

1. `npm run dev` → `http://localhost:5173/`
2. **Import** one of:
   - `docs/reference/examples/Left-STATE_OFFICE.csv`
   - `docs/reference/examples/Left-SPI-215_I-80.csv`
   - `docs/reference/examples/Left-SP-3254.5.csv`
3. Toggle **manual adjust**, drag leg corners and tube tips — leg drag should stay responsive.

## Automated status

```bash
npm run verify         # pass
npm run test:layout    # 114/114
npm run test:ci        # 423/423
```

## Next agent

1. Do **not** weaken leg drag / `preserveSplice` simplify without user approval and regression tests.
2. Frozen routing symbols unchanged (see `.cursor/rules/frozen-routing.mdc`).
3. Remaining backlog: PNG parity, callout toggle text, auto layout jumpiness if user reports again.
