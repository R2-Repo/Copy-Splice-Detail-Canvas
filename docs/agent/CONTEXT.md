# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-30)

**Quad drag UX + viewport stability** — viewport no longer refits during drag/manual adjust; one-shot import fit; deferred fit after side flip only. Same-side cable drag uses lightweight engine/quad sync (`dragSync` honors prior splice paths). Top/bottom placement parity: stack-axis X snap/clamp, keep drag X on T/B flip, preserve partner saved positions.

**4-side cable drag (connected reroute)** — post-import side drag runs constrained layout re-search on T/B or quad transitions; L↔R stays local. Drag-release shows “Adjusting layout…” overlay; winner co-tunes partner sides/stacks.

**SDC-ROUTE-001 routing box** — two-case zone docs (L/R-only vs four-sided); quad anchors use cable `quadSide`; horizontal vertical bounds from L/R fibers only.

**Import soft score (SDC-SCORE-001)** — bend ladder (0→1→2 corners), single-bend top/bottom credit, `sidesUsed` removed from score total. Hard cap unchanged (**SDC-ROUTE-004** ≤2 corners).

**Quad / top-bottom** — four-edge placement + render adapters; see [`QUAD_LAYOUT.md`](./QUAD_LAYOUT.md).

## Active build track

- Smart manual adjustment (SDC-UX-001)
- PDF export polish
- Manual QA: import example-2 + Left-SP-3254.5 side drag; confirm viewport stable + T/B horizontal stickiness
- Dev deep-search: `npm run sdc:sidecar -- deep-search …` or `npm run sdc:verify`

## Branch

- `cursor/quad-drag-ux-viewport-a5e3`
