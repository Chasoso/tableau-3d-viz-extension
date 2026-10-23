# WebGL / rendering API diagnostic

## Purpose

`diagnostics/rendering.html` is a dependency-free page for comparing the rendering APIs available in a normal browser and inside Tableau Desktop. It does not load the Tableau Extensions API, Three.js, or any other external script, and it does not transmit diagnostic data.

The page tests these APIs independently:

- Canvas 2D: creates a `CanvasRenderingContext2D` and draws a triangle.
- WebGL 1: creates a `webgl` context, compiles a minimal shader pair, and draws a triangle.
- WebGL 2: creates a `webgl2` context, compiles a minimal WebGL 2 shader pair, and draws a triangle.
- SVG: appends an SVG polygon and text node to the document.

For WebGL tests, the page also records `webglcontextcreationerror`, `getContext()` failures, context version/vendor/renderer information when available, and shader/draw errors. The report includes local browser information and can be copied or downloaded as JSON. A result is evidence for the current browsing context only; it is not a conclusion about another browser or Tableau Desktop.

## Start the local server

From the repository root:

```powershell
npm ci
npm run serve
```

The page is served at:

```text
http://localhost:8765/diagnostics/rendering.html
```

The page is static and does not require `npm run build`.

## Compare Chrome and Tableau Desktop

### Chrome

1. Open `http://localhost:8765/diagnostics/rendering.html` in Chrome.
2. Confirm that all four test cards are visible.
3. Click **Run diagnostics**.
4. Use **Copy JSON report** or **Download JSON report** to save the result.
5. Record the complete JSON and the Chrome version separately from the screenshot.

### Tableau Desktop Web Page object

The diagnostic is intentionally independent of Tableau API, so it can be loaded as a Web Page object. This avoids adding another Tableau extension manifest and ensures that Chrome and Tableau use exactly the same HTML.

1. Keep `npm run serve` running on the same machine as Tableau Desktop.
2. Open a Tableau workbook and create or edit a dashboard.
3. Drag **Web Page** from the Objects pane onto the dashboard.
4. Enter `http://localhost:8765/diagnostics/rendering.html` as the URL.
5. Click **Run diagnostics** inside Tableau Desktop.
6. Save the JSON using **Copy JSON report** or **Download JSON report**. If clipboard or download is unavailable in the embedded page, copy the visible JSON manually or capture the result cards and browser-information section.
7. Compare the four `checks` entries and `browser` information with the Chrome report.

Do not classify a Tableau result as `PASS` based on the page loading alone. Record each API separately as `success`, `unavailable`, or `error`, including the displayed error and creation-event message.

## Tableau Desktop remote debugging

Tableau's official documentation states that Tableau Desktop embeds a Chromium-based browser and can expose it through Chromium remote debugging. Use the Chromium/Chrome version recommended for the Tableau version under test.

On Windows, close all Tableau Desktop windows and start Tableau from Command Prompt. For Tableau 2026.2, an example is:

```text
"C:\Program Files\Tableau\Tableau 2026.2\bin\tableau.exe" --webEngineArgs --remote-debugging-port=8696
```

Then:

1. Add the Web Page object described above, or open the existing page in the workbook.
2. Open Chrome or the matching Chromium build.
3. Navigate to `http://localhost:8696`.
4. Select the page whose title is **Rendering API Diagnostic**.
5. In DevTools, inspect the Console and the page's `canvas` elements. The page itself already records the context-creation event, but the Console can show browser-level WebGL messages.
6. Use the **Sources** or **Console** panel only to inspect the diagnostic page. Do not paste or execute unrelated code in the embedded page.

The remote debugging port is separate from the local HTTP port `8765`. The official Tableau documentation warns that remote debugging enables unauthenticated access to the extension runtime; stop Tableau after the test and remove any `QTWEBENGINE_REMOTE_DEBUGGING` environment variable if it was used. Do not expose port `8696` beyond the local machine.

Official reference: [Debug Extensions in Tableau Desktop](https://tableau.github.io/extensions-api/docs/debug/trex_debugging/)

## Interpretation boundary

This diagnostic distinguishes observations from hypotheses:

- `webgl2: unavailable` in Tableau but `webgl2: success` in Chrome proves a difference between the two browsing contexts, not the cause.
- A `webglcontextcreationerror` status message is evidence supplied by the embedded browser; it should be recorded verbatim.
- Browser version, GPU information, and the Tableau version should be captured with every result.
- The diagnostic does not test Three.js, `WebGLRenderer`, Tableau API initialization, Geometry retrieval, SVGRenderer, or rendering performance.

Do not change Three.js, switch to an older Three.js version, or select Canvas 2D/SVG as the production renderer solely from this page. Those are follow-up design decisions after the results are recorded.

## Next verification after results are collected

1. If Canvas 2D and SVG succeed in Tableau while WebGL 1/2 fail, implement a small renderer spike outside the current 3D renderer and measure Polygon, hole, MultiPolygon, hover, and interaction behavior.
2. If WebGL 1 succeeds and WebGL 2 fails, record the browser versions and do not migrate to an older Three.js version automatically. First verify the supported API/runtime requirements and decide whether a non-WebGL renderer is preferable.
3. If all APIs fail, investigate the Tableau WebView loading/security environment before changing geometry or rendering architecture.
4. If WebGL 2 succeeds in the diagnostic but the current extension still fails, investigate Three.js initialization and canvas options separately.
