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
