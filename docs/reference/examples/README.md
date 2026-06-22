# Reference CSVs

## User QA and agent testing (canonical)

Import these via the app **Import** button (`npm run dev` → `http://localhost:5173/`):

| File | Splice |
|------|--------|
| `Left-STATE_OFFICE.csv` | STATE_OFFICE |
| `Left-SPI-215_I-80.csv` | SPI-215 & I-80 |
| `Left-SP-3254.5.csv` | SP-3254.5 |

All live in this folder: `docs/reference/examples/`.

Code helper: `src/testHelpers/leftCsvPaths.ts` (`readLeftCsv`, `LEFT_REFERENCE_CSVS`).

## Dev fixture URLs (Phase 7 QA gate)

With `npm run dev`, append `?fixture=` to auto-import on load (dev only):

| URL param | CSV loaded |
|-----------|------------|
| `example-1` | Layout contract Example #1 (ring cut) |
| `example-2` | Layout contract Example #2 (dominant pair) |
| `example-3` | Layout contract Example #3 (multi-cable) |
| `sp` | `Left-SP-3254.5.csv` |
| `state` | `Left-STATE_OFFICE.csv` |
| `spi` | `Left-SPI-215_I-80.csv` |

Examples:

- `http://localhost:5173/?fixture=example-2`
- `http://localhost:5173/?fixture=sp`

Browser dev loads copies from `public/qa-fixtures/{id}.csv` (keep in sync with files in this folder when reference CSVs change).

### Manual browser checklist (each fixture)

1. Diagram loads without config error banner
2. Drag a cable → release → position holds
3. Manual mode: nudge a leg or fusion dot
4. Toggle auto/manual → diagram stable
5. Reload → layout persists (localStorage)
6. Print preview → tabloid landscape, no clipped cables

Automated gate: `npm run test:phase7` (import + build + print-fit per fixture).

## Automated layout contract only

`npm run test:layout` still uses legacy `CSV Splice Detail Example #1–#3.csv` files (under `old csv examples/`) for rule coverage. **Do not use these for manual QA** unless debugging a specific layout rule.

Helper: `src/testHelpers/layoutContractCsvPaths.ts`.
