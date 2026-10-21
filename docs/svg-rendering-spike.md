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

The page contains five selectable fixtures:

1. **Mixed Polygon / hole / MultiPolygon** — one simple Polygon, one Polygon with a hole, and one two-part MultiPolygon in EPSG:4326.
2. **Elevation edge cases** — positive, zero, negative, and missing elevation values in Cartesian coordinates.
3. **Synthetic small grid** — 4 Cartesian Polygon features.
4. **Synthetic medium grid** — 64 Cartesian Polygon features.
5. **Synthetic large grid** — 256 Cartesian Polygon features for a bounded path-count/performance observation.

The initial height exaggeration is `2.0×`. The page reports the number of normalized features, rendered faces, SVG nodes, and the last render duration. The duration is a local observation, not a benchmark.

The page also exposes investigation-only controls:

- **Faces**: render the current combined geometry, split top/side/bottom geometry, or one face group at a time. `side separate paths (same color)` separates the emitted SVG subpaths after rendering while retaining one material color. `side triangles (unique colors)` gives every side triangle a different SVG style as a separate diagnostic comparison.
- **Material**: compare `MeshBasicMaterial` with `DoubleSide`, `FrontSide`, and 50% opacity.
- **Fill rule**: compare SVG `nonzero` and `evenodd` on the emitted paths; this is a diagnostic attribute applied after SVGRenderer output.
- **sortElements / sortObjects**: toggle the two SVGRenderer painter-sort settings independently.
- **Projection**: report signed projected triangle area, vertices outside the clip range, projected depth range, and SVG fill/stroke path counts.
- **Performance**: report total render time, SVGRenderer time, same-color path-split time, feature/face counts, and SVG node count. These are local observations, not benchmarks.

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

On 2026-10-22, the elevation fixture was checked again at the default `2.0×` height with Edges OFF. In `side only`, the diagnostic reported 16 projected triangles, all with non-zero projected area (`abs 8.73e-4..3.26e-3`, mean `1.92e-3` in the initial view), but SVGRenderer emitted one fill path and the long side faces appeared mainly as outlines. This is not consistent with side geometry being absent or all side triangles being edge-on.

The investigation-only `side triangles (unique colors)` mode then rendered the same 16 side triangles as 16 separately styled SVG paths. After the same vertical camera drag, the projection summary remained the same (`abs 1.19e-4..4.66e-3`, mean `1.75e-3`), while the separate paths showed broad filled side surfaces. Switching back to `side only` at the corresponding camera operation produced one fill path and the outline-like result again. Turning `sortElements` and `sortObjects` off did not recover the fill. This is strong evidence that the loss occurs during same-style SVG path aggregation, not during extrusion generation or projection. It is still an SVGRenderer behavior observation, not a proof that every geometry and camera angle will behave identically.

The likely mechanism is that SVGRenderer concatenates consecutive faces with the same style into one `<path>`, while the side sample contains both positive and negative projected triangle windings (`+8/-8`, zero `0`). The default SVG non-zero fill rule can cancel or expose only narrow portions when these subpaths overlap. The per-triangle style experiment avoids that aggregation. The diagnostic applies `fill-rule` only to its own emitted SVG for comparison; it does not change the production renderer or claim that a particular workaround is production-ready.

The additional `fill-rule` comparison does not by itself resolve the symptom: in the elevation fixture, `side only` still emitted one fill path and remained outline-like with `evenodd`, while `side triangles (unique colors)` emitted 16 fill paths and showed filled surfaces with the same projection metrics. This narrows the investigation toward path decomposition/overlap and painter output, rather than a single `fill-rule` setting.

## Same-color path separation observation

The new `side separate paths (same color)` mode keeps the `MeshBasicMaterial` color unchanged. After `SVGRenderer.render()` completes, the diagnostic reads each generated path's `d` attribute, splits the renderer's concatenated `M...` subpaths, and clones the original SVG attributes onto one `<path>` element per subpath. It does not modify Three.js, `node_modules`, WebGLRenderer, the Geometry adapter, or the production extension entrypoint. This is a diagnostic DOM post-process and is intentionally not a production implementation yet.

In the elevation fixture on 2026-10-22, Chrome reported `16` projected side triangles with non-zero areas and emitted `16` same-color fill paths. The initial view rendered the side surfaces as filled. After horizontal and vertical drags, the fill-path count remained `16`; the measured side absolute-area ranges were `1.06e-3..2.76e-3` (mean `1.71e-3`) and `2.86e-5..4.60e-3` (mean `1.62e-3`), respectively, with zero vertices outside the clip range. This indicates that the small DOM post-process can remove the observed one-path fill loss without changing the material color for these sampled views.

The mixed Polygon / hole / MultiPolygon fixture emitted `40` same-color side paths for `40` side triangles. Its EPSG:4326-to-local-meter coordinate scale makes the fixture's elevation comparatively small, so its side surfaces are visually thin; the path count and projection diagnostics are evidence of separation, not a visual PASS for all MultiPolygon and hole camera views. The elevation fixture covers a single Polygon per feature and positive, zero, negative, and missing elevation cases.

### Bounded Chrome performance observation

The following values were recorded in the local Chromium context on 2026-10-22 with `side separate paths (same color)`, Edges OFF, and the default height. Times include the diagnostic's DOM path split where applicable.

| Fixture | Features | Rendered faces | SVG nodes / same-color paths | Total | SVGRenderer | Path split |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Synthetic small | 4 | 32 | 32 / 32 | 0.4 ms | 0.2 ms | 0.2 ms |
| Synthetic medium | 64 | 512 | 512 / 512 | 7.9 ms | 5.0 ms | 2.9 ms |
| Synthetic large | 256 | 2048 | 2048 / 2048 | 39.7 ms | 29.2 ms | 10.5 ms |

For comparison, the same synthetic large fixture in `side only` emitted `1` SVG node and took `15.0 ms` total. This shows a roughly linear SVG-node and path-split cost in this small synthetic range, but it is not a Tableau Desktop benchmark and does not establish acceptable memory or interaction latency for production data.

### Tableau Desktop corroboration

On 2026-10-22, a user-provided Tableau Desktop capture reproduced the same distinction in the embedded page. Both captures used the `Elevation edge cases` fixture, Cartesian CRS, `2.0×` height, Edges OFF, `MeshBasicMaterial / DoubleSide / opaque`, high quality, `fill-rule nonzero`, and both sort settings ON.

| Tableau mode | Reported diagnostic | Visual observation |
| --- | --- | --- |
| `side triangles (unique colors)` | 16 projected triangles, area `+8/-8/zero 0`, outside clip `0`, side absolute area `2.57e-3..3.19e-2` (mean `1.26e-2`), SVG fill paths `16` | Side surfaces are filled; individual diagnostic colors are visible |
| `side only` | 16 projected triangles, area `+8/-8/zero 0`, outside clip `0`, side absolute area `3.62e-3..6.39e-2` (mean `2.21e-2`), SVG fill paths `1` | Long side surfaces are mostly line-like while end faces remain visible |

The two screenshots were taken at different camera states, so they are not a strict frame-identical A/B comparison. They nevertheless corroborate the controlled browser comparison: the side triangles exist, have non-zero projected area, and are visible when SVG output is split into separate paths, while the one-path form reproduces the reported loss in Tableau Desktop. The Tableau evidence does not establish production readiness or acceptable performance.

The projection panel reports 34 positive and 34 negative signed triangle areas for the mixed fixture at the initial view and 16 positive / 12 negative areas for the elevation fixture at the isolated view. These are diagnostic projections, not a claim that every triangle is visibly unobscured. The SVGRenderer source uses Projector painter sorting and accumulates adjacent faces with the same style into a single SVG path; it does not provide a WebGL depth buffer. The exact contribution of path winding cancellation versus camera-dependent occlusion is therefore a renderer limitation hypothesis, while the combined-versus-separated visual difference is an observed result.

### Current recommendation

The result remains **B: there is a bounded reason to continue SVGRenderer investigation**, but it is not an Issue #4 acceptance `PASS` and it is not a production-renderer decision. Same-color DOM path separation works for the sampled elevation views in Chrome and is a smaller intervention than a Three.js fork, but it relies on the current SVGRenderer path-data shape, increases SVG node count, and has not been validated for arbitrary holes, MultiPolygon occlusion, large data, or Tableau Desktop. The user-provided Tableau evidence covers the unique-color diagnostic mode; the new same-color mode remains `NOT VERIFIED` in Tableau.

A bounded Canvas 2D comparison should begin in parallel before adopting SVGRenderer. This does not require a migration now: compare projected face painter ordering, hole handling, rotation quality, and the same synthetic performance tiers. If SVG path separation fails in Tableau or its node cost is unacceptable, the Canvas 2D comparison becomes the primary fallback rather than extending the SVGRenderer workaround.

If face separation still fails in Tableau or under representative geometry, the fallback investigation should be a Canvas 2D renderer that reuses the normalized geometry, the existing Three.js camera, and the same projected face samples: project vertices with the camera matrices, painter-sort faces by depth, draw each ring with Canvas 2D fill/stroke, and use the projected paths for hit testing. That fallback is not implemented by this spike and should not be adopted until the SVG isolation experiment is complete.

## Manual checks

For each fixture:

1. Confirm the status says that the fixture was rendered with `Three.js SVGRenderer` and that `WebGL is not used`.
2. With Edges OFF, record the `combined` view, then switch to `separated top/side/bottom` and compare filled areas.
3. Select `top only`, `side only`, `side separate paths (same color)`, `side triangles (unique colors)`, and `bottom only`; record the rendered-face count, SVG fill-path count, and whether broad faces are filled at the current camera angle. The unique-color mode is diagnostic only; do not treat its different colors as a styling requirement.
4. Compare `DoubleSide` and `FrontSide`, especially for `bottom only`; record culling rather than treating missing back faces as a geometry failure.
5. Compare `nonzero` and `evenodd` for `side only`; record whether the one-path symptom changes.
6. Toggle `sortElements` and `sortObjects` independently while keeping the same fixture and camera; record path counts and visual changes.
7. Rotate with the left mouse button through at least one horizontal and one vertical drag, then repeat the face comparison. Do not use one camera angle as a universal PASS.
8. Pan with the right mouse button and zoom with the mouse wheel.
9. Click the reset button and confirm the fitted initial view returns.
10. Toggle **Edges** and confirm the boundary lines disappear and reappear.
11. Hover a feature and confirm its identifier and scaled extrusion value are shown.
12. Change the height control from `2.0×` and confirm the extrusion changes. In the elevation fixture, confirm the zero-height feature is flat, the negative feature extends below its base, and the missing value is rendered at zero with the adapter warning semantics.
13. Switch SVG quality between `high` and `low`, then record any visible quality or render-time difference.
14. Select each synthetic grid and record features, faces, SVG nodes, total time, SVGRenderer time, and same-color path-split time. Repeat at least `side only` and `side separate paths (same color)` for the large grid.

The acceptance result must be recorded separately for each item. A page load or a successful first render alone is not sufficient to claim that all interaction and geometry cases pass.

## Tableau Desktop procedure

This page can be loaded without a `.trex` manifest as a Tableau Dashboard **Web Page** object:

1. Keep `npm run serve` running on the same machine as Tableau Desktop.
2. Create or open a dashboard.
3. Drag **Web Page** from the Objects pane into the dashboard.
4. Enter `http://localhost:8765/diagnostics/svg-rendering.html`.
5. Select `Elevation edge cases`, set Faces to `side only`, Edges OFF, `nonzero`, and record the one-path result.
6. Without changing the material, set Faces to `side separate paths (same color)` and record whether the same-color side surfaces are filled and whether the path count increases to the side triangle count.
7. Repeat steps 5–6 after one horizontal and one vertical rotation. Then repeat with `Mixed Polygon / hole / MultiPolygon`; record hole/MultiPolygon visibility separately from path count.
8. Select each synthetic grid and record the displayed timing and SVG-node values. Treat these as environment-specific observations, not PASS thresholds.
9. Record the Tableau Desktop version, operating system, selected fixture, and any visible error. Save screenshots because SVG DOM output may not be available through Tableau's clipboard/download handling.

This is a manual Tableau Desktop procedure. The repository does not contain a Tableau Desktop execution artifact, so no Tableau result is claimed by this document until a user records it.

## Observed implementation constraints

- SVGRenderer creates SVG DOM elements and does not require a WebGL context.
- SVGRenderer supports flat/lit polygon faces and lines but does not provide WebGL-style advanced shading, textures, or shadows. This spike uses `MeshBasicMaterial` and `LineBasicMaterial` intentionally.
- The page uses Three.js `ExtrudeGeometry` and the existing adapter output. SVGRenderer's vector output may grow in DOM size with feature, triangle, and edge counts; the displayed last-render duration should be recorded for representative data.
- Depth and draw ordering are the SVGRenderer/Projector result for the current camera. Rotating the scene is required to inspect occlusion quality; no claim of WebGL-equivalent depth precision is made.
- The face-isolation controls are diagnostic only. They add separate `top` / `side` / `bottom` geometry paths or post-process SVG subpaths and do not alter the production WebGL renderer or the Tableau data adapter.
- The same-color path mode depends on the current Three.js r180 SVGRenderer `d` command format (`M...` subpaths). A production implementation would need a maintained renderer boundary or a robust SVG path parser; this spike does not fork SVGRenderer.
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
