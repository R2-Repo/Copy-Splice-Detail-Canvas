# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-13 — Removed dev `?fixture=` URLs; user QA uses **Left-*** CSVs only.

## User testing workflow

1. `npm run dev` → `http://localhost:5173/`
2. **Import** one of:
   - `docs/reference/examples/Left-STATE_OFFICE.csv`
   - `docs/reference/examples/Left-SPI-215_I-80.csv`
   - `docs/reference/examples/Left-SP-3254.5.csv`
3. No URL shortcuts — import only.

## User QA (2026-06-13)

Manual testing after stabilization: **no visible change** vs before. Same issues remain.

## Automated status

```bash
npm run verify         # pass
npm run test:layout    # 114/114 (legacy contract CSVs — not Left-*)
npm run test:ci        # 422/422
```

## Next agent

1. Ask user which **Left-*** file and what symptom (simple terms from `SIMPLE_TERMS.md`).
2. Reproduce via Import — not fixtures or Example #1–#3 language.
3. One issue → one Left CSV → one rule ID.
