# Handoff

## Last session (2026-06-30)

**4-side cable drag and flip (post-import manual adjust)**

### Shipped

- **`cableSideDrag.ts`** — `canUseCandidateSideDrag`; manual mode skips lock; clear `quadCableSides` when demoted to horizontal
- **Bugfix (bottom→top)** — on side flip, drop stale saved cable position from rebuild; `resolveSideDragCablePosition` uses auto-placed Y/X on cross-axis (fixes rank-1 diagram flying off canvas)
- **`WorkflowCanvas.tsx`** — unified candidate side-drag path (replaces quad-only Phase 6 gate); live flip preview via RAF-throttled `applyCableSideDragCommit({ preview: true })`; top/bottom Y snap on drag-stop
- **`cableLayoutMetrics.ts`** — `resolveCableDragStopY` for top/bottom edge snap
- **Tests** — promotion/demotion, preview no-lock, manual no-lock, `canUseCandidateSideDrag`

### Manual QA

1. Import **example-2** (L/R only) — drag a cable to top edge → full flip, legs reroute, reload/export persists side
2. Import **Left-SPI-215_I-80.csv** — drag T/B cable to left/right and back
3. Locked cable — unlock, then side-drag
4. Grid hybrid — confirm reroute + warning when locks conflict

### Gate

- `npm run check` + `npm run build` + cableSideDrag tests pass
- Full `npm run smoke`: 2 pre-existing Windows path failures in `layoutContractCsvPaths.test.ts` (unrelated)

---

## Previous session (2026-06-30)

**deep-search KeyError fix (`run-deep.bat`)**

- **`tools/sdc-sidecar/sdc/engine/coordinator.py`** — T2 candidate filter used `_[2]` on the eval dict (KeyError `2` surfaced as stderr `2`). Fixed to `ev.get("feasible")` like the T1 filter above it.
- Ray missing is OK — sidecar falls back to sequential batch eval; not the failure cause.

### Manual QA

- `sdc-workspace\run-deep.bat` (or `run.bat --deep`) should pass deep-search and export `rank-*.sdc.json`.

---

**sdc-workspace — latest rules parity on `run.bat`**

### Shipped

- **`import-rules`** headless command (`tools/sdc-eval`) + `sdc import-rules` Python CLI — same DATA/ORDER pre-check as PWA CSV import
- **`scripts/sdc-workspace-run.mjs`** — always restart TS daemon; parse → import-rules (warn + continue) → `export-top` with app `timeBudgetMs` and `--max-rounds 2000`
- **`export-top`** writes `importRules` + rules engine metadata in `search-summary.json`
- **`run.bat` / `run.ps1` / `sdc-workspace/README.md`** — document TS rules vs rule-pack docs
- **`sdc:verify`** — smoke `import-rules` (TS + Python)

### Manual QA

- Put CSV in `sdc-workspace/input/`, double-click `run.bat`
- Check console for import-rules + time budget; `output/search-summary.json` has `importRules` / `importRulesPreflight`
- Import `rank-1.sdc.json` in PWA
- After editing `src/features/rules/*.ts`, re-run `run.bat` (no manual daemon step)

---

**SDC-ROUTE-001 — routing box clarity + zone math**

### Shipped

- **Rule pack:** two-case routing box (L/R-only vs four-sided) in `09_SDC-ROUTE-001`; `SIMPLE_TERMS.md` + `RULE_DICTIONARY.md`
- **Zone math:** `gridRouter` anchors use cable `quadSide`; horizontal mode vertical bounds from left/right handles only; quad mode uses top/bottom frontiers
- **Tests:** `gridMap.test.ts`, `route001.test.ts`, `routingZoneImport.test.ts`

### Repro finding (high loop-back)

| Symptom | Rule |
|---------|------|
| Path point **above/below routing box** | **SDC-ROUTE-001** hard fail |
| Path **inside box** but loops high then down | **SDC-SCORE-001** / **SDC-ROUTE-004** (not ROUTE-001) |
| Quad layouts had loose vertical box when anchors used X-only side guess | Fixed — anchors now use `quadSide` |

Prior bug: `anchorsFromEntries` inferred left/right from X only, so quad `topY`/`bottomY` fell back to canvas margins → strands could route through empty space above/below content.

### Manual QA

- Import example-2 — confirm no strands above top fiber / below bottom fiber (L/R layout)
- Import `Left-SPI-215_I-80.csv` when optimizer uses top/bottom — confirm vertical box sits between cable bands
- `npm run smoke`

### Notes

- Handles approximate inner fan-out edge; label-band geometry is future tightening if handles prove loose on T/B cables
- **SDC-SCORE-001** (bend ladder + T/B credit, `sidesUsed` removed from score) merged via PR #43
