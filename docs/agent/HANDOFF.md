# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-13 — Fixed collapsed butt center vertical ↔ drag; removed all tube reach handles.

## Session fix

1. **Horizontal drag blocked** — fiber `applySegmentDelta` refused butt center verticals at splice X; new `applyButtCenterVerticalDelta` + no `preserveSplice` on butt reconnect so `routingMidX` moves with drag.
2. **Reach handle removed** — deleted `tube-reach-drag` UI/CSS from all tubes (expanded + collapsed). Horizontal adjust is center vertical segment only.
3. **Vertical** — tip handle ↕ unchanged (`visualShiftY` + `repinButtSpliceEdges`).

Files: `buttLegAdjust.ts`, `legSegments.ts`, `useManualAdjustEngine.ts`, `applyManualAdjust.ts`, `TubeManualHandles.tsx`, `ManualAdjustOverlay.tsx`, `splice-diagram.css`.

## User testing

1. Import Left-* CSV, collapse full butt splices, enable **Manual adjust**.
2. **Tip handle**: drag up/down on collapsed tube end.
3. **Center vertical** on thick butt path: hover → highlight + ↔ → drag left/right (path should move).
4. No second handle below the tip on any tube.

## Automated status

```bash
npm run verify         # pass
npm run test:layout    # 114/114
npm run test:ci        # 428/428
```

## Next agent

- Do not weaken leg drag checkpoint or frozen routing without user approval.
- `stemReachX` still in data model for legacy saved layouts; no UI to edit it.
