# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-15 — **Print simplified.** Single Print button → system dialog; removed broken in-app PDF capture.

### Session changes (print v3)

- **One Print button** — `window.print()` only; user picks printer or system Save as PDF (least steps).
- **Removed** `PrintToolbarControl`, `jspdf`, `html2canvas` (capture was cropping diagram, showing grid + zoom buttons).
- **Print prep:** stage set to 1536×960 px; viewport fit centered; hide background/controls/guides; white page; `@page` tabloid injected.
- **Pending user QA:** Print → preview shows full diagram, no grid/buttons, tabloid landscape; pick printer or Save as PDF in dialog.

### Verification

- `npm run test:layout` green (117/117).
- `npm run check` + `npm run build` green.
- `printDiagram.test.ts` green.
