# Port checklist — experimental Python → TypeScript

Use this before merging any experimental search or proxy logic into `src/`.

## Preconditions

1. Change is scoped to **search strategy** or **tiered eval hooks** — not frozen routing symbols (see `.cursor/rules/frozen-routing.mdc`).
2. Python prototype has a recorded `sdc compare` run on the target CSV(s).

## Validation steps

1. **Golden compare** — run from repo root:
   ```bash
   npm run sdc:sidecar -- compare docs/reference/examples/Left-SP-3254.5.csv --max-generations 10
   ```
   Save JSON to `tools/sdc-sidecar/fixtures/golden/` for regression.

2. **T0 calibration** — zero false rejects:
   ```bash
   npm run sdc:sidecar -- calibrate-t0 docs/reference/examples/Left-SP-3254.5.csv
   ```

2. **TS authority** — incumbent `layoutSearch` score must be matched or beaten on the same fixture after port (same seed / config).

3. **Fixture sweep** — at minimum:
   - `Left-SP-3254.5.csv` (manual QA primary Left fixture)
   - `CSV Splice Detail Example #2.csv` (example-2)
   - Any CSV touched by the change

4. **Quality gates**
   - `npm run smoke`
   - Manual QA: import example-2 in the app

5. **Frozen routing** — if the change requires editing symbols listed in `frozen-routing.mdc`, stop and get explicit user approval first.

## Proxy calibration (T0/T1 analog only)

If porting proxy filters from `experimental/proxy.py`:

1. Run batch with and without `--no-proxy` on preset `qa`.
2. Confirm proxy rejects do not drop incumbent-feasible candidates (zero false rejects on golden set).
3. Document reject rate and wall-time savings in HANDOFF.

## Do not

- Ship Python routing or rules in the PWA bundle.
- Treat proxy scores as SDC feasibility — always run TS `evaluate` / `rules` for winners.
