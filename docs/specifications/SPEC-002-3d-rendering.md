# SPEC-002: Polygon / MultiPolygon 3D rendering

## Scope

This specification covers the Three.js renderer introduced for Issue #4. It does not claim that every Tableau Shapefile can be converted without configuration. Tableau data acquisition, Geometry normalization, and rendering remain separate responsibilities.

## Input contract

The renderer consumes the normalized output of `GeometryAdapter`:

- `coordinateSystem: local-meters`
- `Polygon`: one outer ring followed by zero or more hole rings
- `MultiPolygon`: one or more polygons, each with an outer ring and optional holes
- `elevation`: numeric meters; negative values extrude downward, zero creates a flat surface, and missing values are rendered at zero with a warning
- `id`: stable feature identifier for hover/attribute display

The adapter accepts only the observed `GEOGRAPHY('POLYGON ...')` and `GEOGRAPHY('MULTIPOLYGON ...')` string forms, plus the equivalent bare WKT type. Unknown types, three-dimensional coordinates, open rings, non-numeric elevations, and unsupported values are explicit errors.

## Coordinate and height handling

The UI requires the source coordinate system to be selected as `EPSG:4326` or `Cartesian`. EPSG:4326 values are projected to a local equirectangular meter system around the fixture extent; Cartesian values are translated to a local origin without scale conversion. The extension does not infer a CRS from the Geometry string.

The height control starts at `2.0×`. The source `elevation` is required to be meters for this implementation. A different vertical unit is not silently converted.

## Interaction and style

- Left drag: orbit rotation
- Right drag: pan
- Mouse wheel: zoom
- Reset: restore a fitted initial view
- Edges checkbox: toggle polygon boundary lines
- Hover: highlight the feature and show `id`, elevation, and applied height scale
- Fill and edge colors are temporary renderer settings. Tableau color and border settings are not read yet.

## Verification

Automated tests cover a Polygon with a hole, a MultiPolygon, EPSG:4326 local-meter conversion, and rejection of unknown formats. `npm run check` covers TypeScript compilation, unit tests, and both extension manifests.

Manual Tableau Desktop verification remains required for:

1. Loading `extension/geometry-3d.trex` with the fixture Shapefile.
2. Placing Geometry on Detail and assigning `id` and `elevation` to the extension encodings.
3. Confirming Polygon holes and MultiPolygon parts render correctly.
4. Confirming the chosen CRS and elevation unit match the workbook data.
5. Confirming interaction behavior and resource cleanup after removing/re-adding the extension.

The attached HTML prototype was not present in the repository; its interaction model was used as the UI reference for this implementation.

The renderer is published as a dependency-bundled, classic IIFE script because Tableau Desktop's embedded WebView must load the extension entrypoint without relying on ES module loading or an import map. If the extension remains on `Loading extension…`, inspect the status area for a script error and verify that the served `extension/geometry-extension.js` is reachable. If it reaches `Connecting to Tableau Extensions API…`, verify that the official Tableau Extensions API script is reachable from the Tableau Desktop environment. The extension reports a missing API script or a 15-second initialization timeout directly in the status area.

## SVGRenderer candidate spike

Because the Tableau Desktop rendering diagnostic observed Canvas 2D and SVG success while WebGL 1 and WebGL 2 context creation failed, an independent Three.js SVGRenderer spike is available at [`diagnostics/svg-rendering.html`](../../diagnostics/svg-rendering.html). It reuses the normalized model, extrusion geometry factory, and OrbitControls boundary without changing the WebGL production entrypoint. It covers two local fixtures, Polygon / hole / MultiPolygon extrusion, elevation cases, edges, hover, reset, rotation, pan, zoom, SVG quality, face-group isolation, material-side/opacity checks, painter-sort toggles, and projected-face diagnostics.

The current investigation result is provisional recommendation **B**: continue a bounded SVGRenderer face-separation experiment because individually styled side triangles can be filled in Chrome while the same side triangles aggregated into one style/path reproduce the outline-like symptom. This does not claim Issue #4 acceptance or production readiness. The diagnostic reports non-zero projected side areas, and changing `sortElements`, `sortObjects`, or the SVG `fill-rule` alone does not recover the one-path side fill. The likely same-style SVG path aggregation and winding/overlap interaction is an observation-supported hypothesis, not a renderer guarantee. Tableau Desktop execution of the new per-triangle isolation and fill-rule controls, large-data performance, exact occlusion quality after arbitrary camera rotation, and production renderer selection remain `NOT VERIFIED`. See the [SVGRenderer spike procedure](../svg-rendering-spike.md) for the manual checklist.
