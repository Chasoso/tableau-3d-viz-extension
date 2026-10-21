# Three.js SVGRenderer technical spike

## Purpose and boundary

`diagnostics/svg-rendering.html` is a standalone rendering spike for the Issue #4 geometry and interaction requirements. It uses the repository's resolved Three.js `0.180.0` package and its matching `three/addons/renderers/SVGRenderer.js` module. It does not load the Tableau Extensions API, does not use `WebGLRenderer`, and does not change the production extension entrypoint.

The page reuses the same normalized geometry model, coordinate conversion, extrusion geometry factory, and `OrbitControls` family used by the current Three.js prototype. Tableau data acquisition is intentionally not part of this page.

## Run locally

From the repository root:

```powershell
npm ci
npm run build
npm run serve
```

Open:

```text
http://localhost:8765/diagnostics/svg-rendering.html
```

The page contains two selectable fixtures:

1. **Mixed Polygon / hole / MultiPolygon** — one simple Polygon, one Polygon with a hole, and one two-part MultiPolygon in EPSG:4326.
2. **Elevation edge cases** — positive, zero, negative, and missing elevation values in Cartesian coordinates.

The initial height exaggeration is `2.0×`. The page reports the number of normalized features, rendered faces, SVG nodes, and the last render duration. The duration is a local observation, not a benchmark.

The page also exposes investigation-only controls:

- **Faces**: render the current combined geometry, split top/side/bottom geometry, or one face group at a time.
- **Material**: compare `MeshBasicMaterial` with `DoubleSide`, `FrontSide`, and 50% opacity.
- **sortElements / sortObjects**: toggle the two SVGRenderer painter-sort settings independently.
- **Projection**: report signed projected triangle area, vertices outside the clip range, projected depth range, and SVG fill/stroke path counts.

## Local Chrome smoke observation

On 2026-10-21, the page was opened from the local server in the Codex Chromium test context after `npm run build`. The initial mixed fixture rendered `3 feature(s)`, `68 faces`, and `21 SVG nodes`; the elevation fixture rendered `4 feature(s)`, `28 faces`, and `28 SVG nodes`. The page's generated SVG paths contained filled face paths and edge paths, and no WebGL context is created by the page.

Fixture selection, height control, edge visibility, quality selection, and reset were exercised in that browser context. This is a smoke observation only. Rotation, pan, wheel zoom, hover hit testing, hole visibility and front/back ordering after arbitrary camera rotations, and Tableau Desktop execution remain manual checks and are not marked `PASS` here.

## Face-loss isolation observation

On 2026-10-22, the same Chrome context was used with the isolation controls and the elevation fixture at `0.5×` height so the individual surfaces were not intentionally edge-on.

| Investigation | Observation | Interpretation |
| --- | --- | --- |
| Combined geometry, `DoubleSide`, opaque, Edges OFF | 28 projected triangles, one fill path, and the positive/negative extrusions still appeared mainly as outlines | Reproduces the reported symptom without boundary lines; not an Edges-only issue |
| Top only | 8 triangles and a filled path for the four top surfaces | Top geometry is generated and rendered |
| Bottom only, `DoubleSide` | 4 triangles and filled surfaces | Bottom geometry is generated; `DoubleSide` is required for this view |
| Bottom only, `FrontSide` | 0 renderer faces and no SVG path | Back-face culling behaves as expected and is not the combined-mode fix |
| Side only | 16 triangles; broad side faces fill when they are not edge-on, while some camera views reduce them to narrow projected areas | Side projection quality depends on camera angle |
| Separated top/side/bottom, `DoubleSide`, opaque | 28 triangles and separate fill paths; the mixed Polygon/hole/MultiPolygon fixture showed filled parts and a visible hole | Splitting face groups prevents the combined-path symptom in this browser observation |
| Combined geometry with sort settings on or off | The one-fill-path symptom remained | Changing `sortElements` or `sortObjects` alone did not recover the missing fill |
| Separated geometry with sort settings on or off | Path count and painter order changed, but face groups remained available | Sorting affects SVG output ordering/grouping, not geometry generation |
| `DoubleSide` with 50% opacity | Face presence remained; only visual transparency changed | Opacity is not the primary cause |

The projection panel reports 34 positive and 34 negative signed triangle areas for the mixed fixture at the initial view and 16 positive / 12 negative areas for the elevation fixture at the isolated view. These are diagnostic projections, not a claim that every triangle is visibly unobscured. The SVGRenderer source uses Projector painter sorting and accumulates adjacent faces with the same style into a single SVG path; it does not provide a WebGL depth buffer. The exact contribution of path winding cancellation versus camera-dependent occlusion is therefore a renderer limitation hypothesis, while the combined-versus-separated visual difference is an observed result.

### Current recommendation

The result is **B: there is a bounded reason to continue SVGRenderer investigation**, but it is not an Issue #4 acceptance `PASS` and it is not a production-renderer decision. A small next experiment should render cap and side groups as separately styled SVG paths in the real probe, then repeat the hole, MultiPolygon, negative-elevation, and camera-rotation checks. Tableau Desktop has not yet been rerun with these new isolation controls, so the separated result is `NOT VERIFIED` in Tableau.

If face separation still fails in Tableau or under representative geometry, the fallback investigation should be a Canvas 2D renderer that reuses the normalized geometry, the existing Three.js camera, and the same projected face samples: project vertices with the camera matrices, painter-sort faces by depth, draw each ring with Canvas 2D fill/stroke, and use the projected paths for hit testing. That fallback is not implemented by this spike and should not be adopted until the SVG isolation experiment is complete.

## Manual checks

For each fixture:

1. Confirm the status says that the fixture was rendered with `Three.js SVGRenderer` and that `WebGL is not used`.
2. With Edges OFF, record the `combined` view, then switch to `separated top/side/bottom` and compare filled areas.
3. Select `top only`, `side only`, and `bottom only`; record the rendered-face count and whether broad faces are filled at the current camera angle.
4. Compare `DoubleSide` and `FrontSide`, especially for `bottom only`; record culling rather than treating missing back faces as a geometry failure.
5. Toggle `sortElements` and `sortObjects` independently while keeping the same fixture and camera; record path counts and visual changes.
6. Rotate with the left mouse button through at least one horizontal and one vertical drag, then repeat the face comparison. Do not use one camera angle as a universal PASS.
7. Pan with the right mouse button and zoom with the mouse wheel.
8. Click the reset button and confirm the fitted initial view returns.
9. Toggle **Edges** and confirm the boundary lines disappear and reappear.
10. Hover a feature and confirm its identifier and scaled extrusion value are shown.
11. Change the height control from `2.0×` and confirm the extrusion changes. In the elevation fixture, confirm the zero-height feature is flat, the negative feature extends below its base, and the missing value is rendered at zero with the adapter warning semantics.
12. Switch SVG quality between `high` and `low`, then record any visible quality or render-time difference.

The acceptance result must be recorded separately for each item. A page load or a successful first render alone is not sufficient to claim that all interaction and geometry cases pass.

## Tableau Desktop procedure

This page can be loaded without a `.trex` manifest as a Tableau Dashboard **Web Page** object:

1. Keep `npm run serve` running on the same machine as Tableau Desktop.
2. Create or open a dashboard.
3. Drag **Web Page** from the Objects pane into the dashboard.
4. Enter `http://localhost:8765/diagnostics/svg-rendering.html`.
5. Select both fixtures and repeat the manual checks above.
6. Record the Tableau Desktop version, operating system, selected fixture, and any visible error. Save screenshots because SVG DOM output may not be available through Tableau's clipboard/download handling.

This is a manual Tableau Desktop procedure. The repository does not contain a Tableau Desktop execution artifact, so no Tableau result is claimed by this document until a user records it.

## Observed implementation constraints

- SVGRenderer creates SVG DOM elements and does not require a WebGL context.
- SVGRenderer supports flat/lit polygon faces and lines but does not provide WebGL-style advanced shading, textures, or shadows. This spike uses `MeshBasicMaterial` and `LineBasicMaterial` intentionally.
- The page uses Three.js `ExtrudeGeometry` and the existing adapter output. SVGRenderer's vector output may grow in DOM size with feature, triangle, and edge counts; the displayed last-render duration should be recorded for representative data.
- Depth and draw ordering are the SVGRenderer/Projector result for the current camera. Rotating the scene is required to inspect occlusion quality; no claim of WebGL-equivalent depth precision is made.
- The face-isolation controls are diagnostic only. They add a separate `top` / `side` / `bottom` geometry path and do not alter the production WebGL renderer or the Tableau data adapter.
- Hover uses Three.js `Raycaster` against the same meshes used for SVG projection. It is a probe feature, not a Tableau selection integration.
- This spike has no Tableau data acquisition and no production renderer switch. It must not be used to conclude that arbitrary Tableau Shapefiles, coordinate systems, or large datasets are supported.

## Decision status and next work

This spike does not decide whether SVGRenderer replaces WebGLRenderer. The current implementation remains in the production extension, and the diagnostic page is an independent candidate evaluation.

Before an architecture decision, collect Tableau Desktop evidence for both fixtures and record:

- Polygon hole fill and boundary behavior after rotation.
- MultiPolygon part visibility and front/back ordering.
- Interaction latency and last-render duration at representative feature counts.
- SVG DOM size and memory behavior after repeated fixture changes.
- Whether the Tableau Web Page object permits the required pointer interactions at the target dashboard size.
- Whether a later integration can retain the existing Tableau acquisition and adapter boundaries without browser-specific changes.
