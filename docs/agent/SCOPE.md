# Product scope — Splice Detail Canvas

> **Owner:** User-defined (2026-05). Agents: read before coding; update only when the user changes requirements.

**Status:** Defined — ready for MVP implementation.

---

## Build phase (active)

**Focus:** MVP features and **smart manual adjustment** (SDC-UX-001) — cables, buffer tubes/fan-outs, fiber strands, groups.

**Parallel track:** Layout hardening — see [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md). Rule contract tests **suspended** until user requests — see [`TESTING.md`](./TESTING.md).

- PDF/export work **un-deferred**
- No new layout rule IDs without user approval
- No refactors of frozen `spliceEdgeRouting.ts` without user approval
- Session gate: **`npm run smoke`** (`test:fast` + check + build)
- Manual QA: import **example-2** after visual/routing changes

---

## Vision

Replace the painful **Bentley OpenComms Designer splice-detail diagram** step. Bentley exports good **CSV data** but bad **diagrams**; polishing a splice detail in Bentley can take **~1 hour** even for a simple case.

**Splice Detail Canvas** is a frontend PWA that:

1. Imports Bentley **CSV splice reports** (connected pairs only)
2. Auto-generates a splice detail diagram (~**95% complete**)
3. Lets users **drag and polish** on a **node canvas** (lines stay connected and reroute)
4. Exports a PDF whose **graphics and layout** match industry splice-detail style (not Bentley’s messy output)

**Not the goal:** Replace Bentley for network design — only splice-detail **diagram authoring**.

---

## Users

Fiber/telecom designers and field engineers who export Bentley splice CSVs and need presentable splice detail sheets (butt splices, mid-span / ring-cut splices, drop cables, etc.).

---

## Reference material (two unrelated roles)

| Source | Location | Role |
|--------|----------|------|
| CSV examples | [`docs/reference/examples/*.csv`](../reference/examples/) | **Data** — connectivity, colors, metadata |
| PDF examples | [`docs/reference/examples/Splice detail example #*.pdf`](../reference/examples/) | **Visual style** only (ignore PDF text for requirements) |
| Routing/layout screenshots | [`docs/reference/rule_examples/`](../reference/rule_examples/) | **SDC good/bad** routing examples + metadata |
| Color code charts | [`docs/reference/examples/`](../reference/examples/) (`6 Count…`, `288 Count…` PNGs) | Fiber / tube color numbering |

**PDFs and CSVs are independent random examples** — do not map PDF #1 → CSV #1.

---

## Architecture decision: node canvas (not static SVG-only)

Past attempts at **static layout → PDF** failed because **human polish is always required**.

**Chosen stack:**

```
CSV → domain model (splice-pair graph) → auto-layout → React Flow canvas (edit) → PDF/SVG export
```

- **Model-first:** parser and layout are independent of the view layer.
- **React Flow:** interaction layer — drag cable/tube/fiber groups; splice edges reroute uniformly.
- **Export:** from **model + saved layout**, not a one-shot screenshot.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for folder layout.

---

## Primary workflows

1. **Import** — upload/drop Bentley CSV splice report
2. **Auto-generate** — parse pairs, build graph, run layout (~95%)
3. **Review & adjust** — drag cables; **Manual adjust** mode for per-tube tip/reach handles; toggle dashed “existing” lines; fix spacing
4. **Export PDF** — visual layout parity with reference screenshots

---

## Bentley CSV semantics

### Export setting

User exports with **“Spliced / connected pairs only”**. CSV rows = **only spliced fibers**, not full cable inventories.

- Do **not** draw unspliced pass-through strands.
- Example: 144ct mid-span with 2 splices → **2 rows**, not 144.

### Report structure

| Section | Meaning |
|---------|---------|
| Header | Device type, model, name, ID, date, location, splice # |
| `Left ---` | Rows with initial **left-side hint** |
| `Right ---` | Rows with initial **right-side hint** (often mirrors Left) |

Each row = one **splice pair**:

```
From: [Device], [Cable], [Buffer #], [Tube color], [Fiber color]
  <->
To:   [Cable], [Buffer #], [Tube color], [Fiber color], [Device], [OS]
```

### Parse vs layout

| Layer | Rule |
|-------|------|
| **Connection graph** | Authoritative — every row → `SplicePair { endpointA, endpointB }`; dedupe mirrored Left/Right rows |
| **Side hints** | CSV Left/Right = **soft** starting placement only |
| **Layout optimizer** | On import, routing-first search assigns each cable to an edge (L/R/T/B), routes every strand on the grid, scores against SDC rules, and paints the best layout. CSV Left/Right hints are soft only. No user 2-side / 4-side toggle. |
| **User overrides** | Persist layout separately from CSV |

Same-side splices (both endpoints on same edge) are valid — they still meet in the **center splice zone**.

---

## Splice types

### Butt splice / full splice

Two separate cables joined strand-for-strand (e.g. 72↔72 = 72 pairs; 144↔48 = 48 pairs).

### Ring cut / mid-span splice

Case on a **through** cable; only cut/spliced strands appear in CSV.

- Same physical cable may appear as **two legs** (in/out of case) plus drop cables → **3+ cable nodes** in diagram.
- `CableNode` = **cable leg in this diagram**, not always one physical cable ID.

---

## Fiber domain model (MVP: 12-count tubes)

### Hierarchy

```
Splice
  └── Cable leg(s)
        └── Buffer tube(s) — 12 fibers each, color-coded
              └── Fiber strand(s) — spliced pairs only
```

### 12-color code (tube and fiber)

Blue, Orange, Green, Brown, Slate, White, Red, Black, Yellow, Violet, Rose, Aqua.

| # | Color | CSV abbrev |
|---|-------|------------|
| 1–12 | (above) | BL, OR, GR, BR, SL, WH, RD, BK, YL, VI, RO, AQ |

**144-count:** 12 tubes × 12 fibers. Fiber N → tube `ceil(N/12)`, fiber color `(N-1) % 12 + 1`.

**288-count (fibers 145–288):** **striped** tubes — CSV uses compound codes (`BL-BK`, `OR-BK`, …). Stripe **graphic TBD** (no screenshot reference); parser must handle codes (see Example #1 CSV).

**6-count tubes:** deferred (older 6/12/18/24/36 ct cables).

### Full buffer tube collapse (space-saving rule)

When an **entire buffer tube** is spliced to another buffer tube — **all 12 fibers** paired, same tube **color**, same tube **count** (12-fiber tubes) — the diagram **does not break out individual fiber strands**.

Instead, show **thick buffer tube line → thick buffer tube line** (tube-to-tube splice in the center, with fusion splice dot). It is **implied** that all 12 fibers within each tube are spliced strand-for-strand (BL↔BL, OR↔OR, … within the tube).

| Condition | Render |
|-----------|--------|
| All 12 fibers in tube A ↔ all 12 in tube B, same tube color | **Tube-to-tube only** (no fiber breakout) |
| Only some fibers in a tube spliced | Break out **only those** fiber strands |
| Mixed: part of tube full, part partial | Full tubes collapsed; partial tubes show individual fibers |

**Detection (from CSV pairs):** Group splice rows by `(cable leg, tube color, buffer #)` on each side. If 12 matching pairs exist with consistent fiber-color pairing within the tube, collapse to one tube-level connection.

**Layout benefit:** Fewer lines, less vertical space, cleaner diagrams for butt splices where whole tubes are joined.

**User override (optional later):** Expand a collapsed tube to show individual fibers for inspection — not required for MVP unless needed.

---

## Visual design (from PDF screenshots)

**Priority: graphics and layout. PDF text/labels are low priority.**

### Line-weight hierarchy

| Element | Appearance | Weight |
|---------|------------|--------|
| **Cable** | Circle + horizontal stub at outer edge | Largest |
| **Buffer tube** | Thick colored diagonal from cable toward center | Medium |
| **Fiber strand** | Thin colored line, horizontal toward center | Thin |
| **Fusion splice** | Small **black dot** where strands meet | Point |

### Layout (fan-out)

```
[Cable] → [Tube] → [Fiber] ─── center splice (black dot) ─── [Fiber] ← [Tube] ← [Cable]
  left edge      fans right              meet here                 fans left    right edge
```

**Full tube collapse:** when all 12 fibers in a tube splice to another full tube (same color), skip the fiber tier:

```
[Cable] → [Tube] ═══════════ center splice (black dot) ═══════════ [Tube] ← [Cable]
```

- Auto-layout: maximize **straight horizontal** left↔right pairs; **orthogonal elbows** (H–V–H) when Y differs.
- Same-side pairs still meet in center.
- Prefer tube-level connections whenever the full-tube rule applies.

### Line styles

- **Solid** — default on import
- **Dashed** — “Existing (Protect in Place)” — **manual toggle only** (not in CSV); persist in layout

### Legend

- `• Fusion Splice Required`
- `--- Existing (Protect in Place)` (dashed)

---

## Canvas node & edge types

| Node | Purpose |
|------|---------|
| `CableNode` | Cable leg; circle + stub; scale by role/size |
| `BufferTubeNode` | Thick colored tube segment; striped flag |
| `FiberStrandNode` | Thin colored strand toward center |
| `LegendNode` | Symbol key |
| `SpliceHeaderNode` | Optional CSV header (secondary) |

| Edge | Purpose |
|------|---------|
| `SpliceEdge` | Fusion splice between **fibers** or **whole tubes** (when collapsed); orthogonal route; black dot; dashed if user marks existing |
| `TubeSpliceEdge` | Tube-to-tube connection when full 12-fiber collapse applies (may reuse `SpliceEdge` with tube-level handles) |
| Breakout/containment | Internal cable→tube→fiber structure |

---

## Data & persistence

| Concern | MVP approach |
|---------|----------------|
| Import | Bentley CSV (examples in `docs/reference/examples/`) |
| Internal model | `SpliceReport` + `SplicePair[]` + layout positions |
| Layout overrides | `localStorage` (positions, dashed flags, manual side tweaks) |
| Export | PDF from model + layout (library **needs user approval** before adding) |

---

## MVP (phased)

**Locked choices:** visual/layout parity (not text); auto-layout + manual edit.

### MVP-a — prove pipeline (target: screenshot #3 complexity)

- [ ] **Full buffer tube collapse** — detect 12/12 same-color tube splices; render tube-to-tube (no fiber breakout)
- [ ] Fiber color code lib (12 colors, 144 math, striped `*-BK` parse)
- [ ] CSV parser (header, Left/Right, dedupe mirrors)
- [ ] Spliced-pairs-only graph builder; mid-span cable legs
- [ ] Side hints + basic layout optimizer
- [ ] Custom nodes: cable circle, thick tube, thin strand
- [ ] SpliceEdge with black dot + elbow routing
- [ ] Import UI + canvas display
- [ ] Test with **Example #2 CSV** (`SP-3022.4`, 4 pairs)

### MVP-b — scale

- [ ] Example #1 CSV (large splice, striped tubes)
- [ ] Performance tuning for many edges
- [ ] Pagination strategy for PDF
- [ ] Manual dashed-line toggle

### MVP-c — polish

- [ ] Visual parity pass vs all 4 screenshot layouts
- [ ] PDF export
- [ ] Stripe tube graphic finalized

---

## Out of scope (initial)

- Bentley live integration / API
- Full 6-count tube rules
- Authoring splices without CSV
- GIS / network map
- Backend, auth, collaboration
- Non-Bentley CSV formats

---

## Success criteria

- Import both example CSVs; only **spliced** fibers drawn
- Mid-span: same cable name can appear as multiple legs
- Small splice matches reference **visual style** (fan-out, weights, splice dots)
- Full-tube splices render as **tube-to-tube** lines (not 12 fiber breakouts) when all 12 fibers in a same-color tube are spliced
- Large splice readable (pagination OK)
- Time to usable diagram: **minutes**, not hours

---

## Open items (TBD with user)

1. Stripe graphic on buffer tubes (145–288)
2. PDF pagination rules for large splices
3. Branding (logo, title block, footer)

---

## Local development

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`) to view the app live.

Quality gates: `npm run check`, `npm run test:ci`, `npm run build`.
