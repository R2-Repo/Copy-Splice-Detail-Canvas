# Handoff

## Last session (2026-06-30)

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
