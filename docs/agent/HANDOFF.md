# Handoff



> Agents: overwrite this section at the end of each session.



## Last updated



2026-06-13 — Multi-map embed popover. `test:layout` 114/114, `test:ci` 450/450, `tsc` + `build` clean.



## Session changes



1. Added map popover button in left toolbar (`CsvImportButton` neighbor) wired to CSV header location.
2. New tabbed popover UI:
   - `uPlan` ArcGIS iframe (`center`, `level=20`, `marker`)
   - `Earth` link-out to Google Earth 3D + embedded Google Maps satellite preview
   - `Street View` no-key experimental iframe + fallback open-link
3. Added map URL builder utilities and robust `header.location` parser.
4. Added focused tests for location parsing, map URL builders, and tab rendering behavior.



## Frozen-routing note



No frozen symbols touched.



## Files



Created:

- `src/features/maps/parseSpliceLocation.ts`
- `src/features/maps/buildArcGisWebAppUrl.ts`
- `src/features/maps/buildGoogleEarthUrl.ts`
- `src/features/maps/buildGoogleMapsUrls.ts`
- `src/features/maps/MapEmbedButton.tsx`
- `src/features/maps/parseSpliceLocation.test.ts`
- `src/features/maps/mapUrlBuilders.test.ts`
- `src/features/maps/MapEmbedButton.test.tsx`

Edited:

- `src/features/canvas/WorkflowCanvas.tsx`
- `src/components/toolbar/ToolbarIcon.tsx`
- `src/components/toolbar/ToolbarSegmentedControl.tsx`
- `src/styles/splice-diagram.css`
- `docs/agent/CONTEXT.md`
- `docs/agent/HANDOFF.md`



## Verification



```bash
npm run test:layout   # PASSED — 114/114
npm run check         # PASSED
npm run test:ci       # PASSED — 56 files, 450 tests
npm run build         # PASSED
```



Manual smoke test:



1. Import `docs/reference/examples/Left-SP-3254.5.csv`.
2. Click new map button in toolbar.
3. Verify tabs:
   - `uPlan`: map centers on splice point and shows marker
   - `Earth`: link opens Google Earth 3D view
   - `Street View`: iframe attempts pano; fallback link opens Maps pano route



## Not done (deferred)



- Earth Web iframe is still expected to be unreliable/cross-origin blocked; use link-out as primary UX.
- Street View no-key iframe is unofficial and may fail at locations without imagery.



## Next agent



- If the user wants stricter provider behavior, add a setting to hide Street View tab when panorama lookup fails.
- Experience Builder migration should only require swapping ArcGIS URL builder constants/format.

