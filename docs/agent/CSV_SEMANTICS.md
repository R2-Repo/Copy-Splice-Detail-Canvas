# Bentley splice CSV — semantics

> **Status:** Parser validates on paired **CSV Splice Detail Examples #1–#3** (see matrix below). Canvas/layout must match **Splice Detail Example #1–#3** PNGs — see [`SCOPE.md`](./SCOPE.md) and `docs/reference/examples/`.
> **Owner:** User + agents. Update when new example CSVs arrive.

## Import strategy (confirmed)

- **No user-facing CSV cleanup** — interpret the Bentley export directly.
- **Internal normalization only:** blank To fiber # → copy From; empty device → copy peer; preserve empty comma fields; dedupe Left/Right mirrors when both exist.
- **Left `---` is authoritative** for splice pairs; Right `---` is for cable-leg hints only (may be partial).

## File shape

```
[Header metadata]
Terminating / Device / From / Buffer / Color / To / Buffer / Color / Device / OS
Left ---
  <data rows with <-> per splice>
Right ---
  <optional mirror or partial rows>
```

| Section | Example #2 | Example #1 |
|---------|------------|------------|
| Left rows | 4 | 574 |
| Right rows | 4 (full mirror) | 30 (partial) |
| Parsed pairs (Left only) | 4 | 574 |
| Parse gap | 0 | 0 |

## Row anatomy (one splice)

Split on `<->`:

| Side of `<->` | CSV columns (after cable/device) | Parser fields |
|---------------|----------------------------------|---------------|
| **From** (left of arrow) | Device, Cable, **Fiber #**, **Tube color**, **Fiber color** | `endpointA`, `csvColumn: from` |
| **To** (right of arrow) | Cable, **Fiber #** (often blank), **Tube color**, **Fiber color**, Device [, OS] | `endpointB`, `csvColumn: to` |

```
288 DIS …, 1, BL, BL  <->  288 DIST …, [empty], BL, BL [, device] [, OS]
                  │   │   │                                     │       │    │
                  │   │   └ fiber color                   │       │    └ fiber color
                  │   └ buffer tube (BL)                │       └ buffer tube (BL)
                  └ fiber number                         └ missing fiber # → copy From
```

| Position (after cable) | Meaning |
|------------------------|---------|
| Number | **Fiber number** (not tube #) |
| 1st color | **Buffer tube** color (`BL`, `BR-BK`, …) |
| 2nd color | **Fiber** color inside that tube |

**Blank fiber # on To** = omitted count only; the next `BL` is still the **tube**, not a missing buffer.

Cable names may contain commas — parse fixed tail from the row end; never use `filter(Boolean)` on split fields.

### To-side tail (parser)

Fixed fields from the end: `fiber#`, `tube`, `fiber`, `device` [, `OS`]. OS values seen: `CH ####`, `EL-###`, `[HORROCKS] …`. Stray trailing commas add empty fields — trimmed before parse.

## Confirmed rules (user + Examples #1–#2)

| Rule | Validation |
|------|------------|
| Each Left `---` row with `<->` = one splice pair | #1: 574/574, #2: 4/4 |
| **Tube color** = buffer tube; one tube per `(cable leg, tube color)` | #2: one BL tube, four fibers |
| **Blank To fiber #** → inherit From on same row | #1 butt rows, #2 |
| **Striped tubes** `XX-BK` in tube column | #1 rows 187+ |
| Same **cable name** can be two **legs** (in/out) | #2: `144 DIST` mirror pattern |
| Right `---` may **not** mirror Left | #1: 30 vs 574 rows — do not pair from Right |
| Empty **device** on To → copy From device when present | #1 rows with `, ,tube,fiber, ,OS` |

## Cable leg identity (heuristic)

| Pattern in Left/Right counts | Inferred |
|------------------------------|----------|
| To only in Left, From only in Right | Two legs, same name (through in/out) |
| From only in Left, To only in Right | One leg on diagram left (e.g. drop) |
| From + To both in Left | Two legs (needs more examples) |

**Limit:** Large splices with partial Right `---` weaken mirror heuristics — may need manual leg IDs later.

## Example matrix (paired CSV ↔ splice detail image)

| ID | CSV | Image | Left rows | Parsed pairs | Visual target |
|----|-----|-------|-----------|--------------|---------------|
| **1** | `CSV Splice Detail Example #1.csv` | `Splice Detail Example #1.png` | 4 | 4 | Ring cut: 6-drop → 144 (fibers 11–12 + blank-To rows) |
| **2** | `CSV Splice Detail Example #2.csv` | `Splice Detail Example #2.png` | 6 | 6 | 4 cables; cross-side splices (GR/BR); dashed through pairs |
| **3** | `CSV Splice Detail Example #3.csv` | `Splice Detail Example #3.png` | 28 | 28 | 144 + 24 + DK-6; multi-cable same-side routing |

Legacy large export: `Bentley OpenComms Output Example #1.csv` (574 pairs) — stress test, not paired to a simple diagram.

Drop new files in `docs/reference/examples/` with expected counts in this table.

## Validation workflow

1. Import CSV → **Show CSV parse report** (raw vs parsed, failure breakdown, cable legs).
2. **Parse gap must be 0** on Left section before canvas work.
3. Confirm leg/tube groupings; update this doc.
4. Resume layout/nodes only after step 2–3 on your real exports.

## Parse failure codes (Left section)

See `PARSE_REASON_LABELS` in `src/features/import/parseReasons.ts`. Report shows top reasons + sample lines.

## Open questions (need your field confirmation)

1. On 144/288 cables: is fiber # global 1–144 or index within each tube?
2. When **both** sides lack a fiber # after normalization — reject row or infer?
3. What does partial Right `---` represent on large splices (#1)?
4. Other export modes besides “connected pairs only”?
