# SDC workspace

Drop **one** Bentley splice CSV here, double-click **`run.bat`**, then import the results in the web app.

## Steps

1. Put your CSV in **`input/`** (or rename/copy to **`input.csv`** in this folder).
2. Double-click **`run.bat`** (first run installs npm deps if needed).
3. Open **`output/`** — you'll get up to **5** layout files:
   - `rank-1.sdc.json` (best score)
   - `rank-2.sdc.json` … `rank-5.sdc.json`
   - `search-summary.json` (scores + rule info)
4. In the Splice Detail Canvas PWA: **Import file** → pick `rank-1.sdc.json` (or any rank).

## What it does

Runs the **same** routing-first search and SDC rules as the web app (TypeScript engine, no browser). Writes **`.sdc.json`** — the same format as **Export workspace** in the app.

You may get **fewer than 5** files if the search finds fewer distinct **feasible** layouts (all must pass SDC rules).

## From repo root (alternative)

```powershell
npm run sdc:workspace
```

Or with a custom CSV:

```powershell
echo '{"csvPath":"docs/reference/examples/Left-SP-3254.5.csv","outDir":"sdc-workspace/output","top":5}' | npm run sdc:eval -- export-top
```

## Requirements

- Node.js 20+
- `npm install` once in the repo root (run.bat does this automatically)
