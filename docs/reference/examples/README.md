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

## Automated layout contract only

`npm run test:layout` still uses legacy `CSV Splice Detail Example #1–#3.csv` files (under `old csv examples/`) for rule coverage. **Do not use these for manual QA** unless debugging a specific layout rule.

Helper: `src/testHelpers/layoutContractCsvPaths.ts`.
