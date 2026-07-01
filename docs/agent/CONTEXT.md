# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-30)

**Top/bottom fiber drag (hybrid)** — fiber handle drag commits `tubeOverrides.visualShiftY` on all sides; quad T/B uses canvas-X delta + `quadFiberHandleCenter` repin.

**Cable drag without locking** — fiber cables no longer auto-lock or offer manual lock; position still saved in overrides. Tube/fiber/leg/fusion-dot locks unchanged.

**Quad drag UX + viewport stability** — viewport no longer refits during drag/manual adjust; one-shot import fit; deferred fit after side flip only.

**4-side cable drag (connected reroute)** — post-import side drag runs constrained layout re-search on T/B or quad transitions; L↔R stays local. Drag-release shows “Adjusting layout…” overlay; winner co-tunes partner sides/stacks.

**SDC-ROUTE-001 routing box** — two-case zone docs (L/R-only vs four-sided); quad anchors use cable `quadSide`; horizontal vertical bounds from L/R fibers only.

**Import soft score (SDC-SCORE-001)** — bend ladder (0→1→2 corners), single-bend top/bottom credit, `sidesUsed` removed from score total. Hard cap unchanged (**SDC-ROUTE-004** ≤2 corners).

**Quad / top-bottom** — four-edge placement + render adapters; see [`QUAD_LAYOUT.md`](./QUAD_LAYOUT.md).

## Active build track

- Smart manual adjustment (SDC-UX-001)
- PDF export polish
- Manual QA: import example-2 — side drag to top/bottom + fiber handle drag stickiness; Left-SP-3254.5 side drag
- Dev deep-search: `npm run sdc:sidecar -- deep-search …` or `npm run sdc:verify`

## Branch

- `cursor/quad-drag-ux-viewport-a5e3`
