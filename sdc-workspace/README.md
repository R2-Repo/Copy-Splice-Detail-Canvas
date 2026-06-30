# SDC workspace

Drop **one** Bentley splice CSV here, double-click **`run.bat`**, then import the results in the web app.

## One-click

**Double-click [`run.bat`](run.bat)** in this folder.

- Installs npm + Python sidecar on first run (needs internet once)
- Requires Node 20+ and Python 3.11+ on PATH
- Put one CSV in `input/` first
3. Open **`output/`** — up to **5** layout files:
   - `rank-1.sdc.json` (best score)
   - `rank-2.sdc.json` … `rank-5.sdc.json`
   - `search-summary.json` (scores + rule info)
4. In the Splice Detail Canvas PWA: **Import file** → pick `rank-1.sdc.json` (or any rank).

## Optional: longer Python deep-search

Double-click **`run-deep.bat`** (or `run.bat --deep`) for a longer evolutionary search before export. Same output files.

## What it does

Runs the **same** routing-first search and SDC rules as the web app (TypeScript engine via Python sidecar daemon). Writes **`.sdc.json`** — the same format as **Export workspace** in the app.

You may get **fewer than 5** files if the search finds fewer distinct **feasible** layouts (all must pass SDC rules).

## Requirements

- [Node.js 20+](https://nodejs.org)
- [Python 3.11+](https://www.python.org/downloads/) — enable **Add to PATH** on install
- Internet on first run (npm + pip download)

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Node.js not found` | Install Node, restart terminal |
| `Python not found` | Reinstall Python with PATH checkbox |
| `pip install failed` | Run `python -m pip install -e tools/sdc-sidecar` from repo root |
| Multiple CSVs | Keep only one file in `input/` |

## From repo root (alternative)

```powershell
npm run sdc:workspace
npm run sdc:workspace -- --deep
```
