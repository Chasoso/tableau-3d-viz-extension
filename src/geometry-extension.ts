/// <reference types="@tableau/extensions-api-types" />
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { normalizeGeometryRows } from './geometry-adapter.js';
import { GeometryRenderer } from './geometry-renderer.js';
import type { NormalizedGeometry, RawGeometryRow, SourceCoordinateSystem } from './geometry-model.js';
import { readTableauGeometryRows } from './tableau-geometry-source.js';
import { formatWebGLInitializationError, initializeWebGLRenderer, type WebGLRendererLike } from './webgl-runtime.js';
import { fitCameraAndSaveTarget, resetCamera } from './camera-view.js';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const status = document.querySelector<HTMLElement>('#status');
const selected = document.querySelector<HTMLElement>('#selected');
const elevation = document.querySelector<HTMLElement>('#elevation');
const scale = document.querySelector<HTMLInputElement>('#scale');
const scaleText = document.querySelector<HTMLElement>('#scaleText');
const crs = document.querySelector<HTMLSelectElement>('#crs');
const edges = document.querySelector<HTMLInputElement>('#edges');
const reset = document.querySelector<HTMLButtonElement>('#reset');

if (!canvas || !status || !selected || !elevation || !scale || !scaleText || !crs || !edges || !reset) {
  throw new Error('Geometry extension markup is incomplete.');
}
const sceneCanvas = canvas;
const statusElement = status;
const selectedElement = selected;
const elevationElement = elevation;
const scaleInput = scale;
const scaleTextElement = scaleText;
const crsSelect = crs;
const edgesInput = edges;
const resetButton = reset;

let rawRows: RawGeometryRow[] = [];
let normalized: NormalizedGeometry | undefined;
let heightScale = 2;
let activeRenderer: WebGLRendererLike | undefined;
let viewer: GeometryRenderer | undefined;
let controls: OrbitControls | undefined;
let resizeObserver: ResizeObserver | undefined;
let animationFrameId: number | undefined;
let initializationHandler: (() => void) | undefined;
let disposed = false;

function setStatus(message: string, error = false): void {
  statusElement.textContent = message;
  statusElement.dataset.state = error ? 'error' : 'ok';
}

function showFeature(feature?: { id: string; elevation: number }): void {
  if (!feature) {
    selectedElement.textContent = 'Hover to inspect';
    elevationElement.textContent = 'No feature selected';
    return;
  }
  selectedElement.textContent = feature.id;
  elevationElement.textContent = `Elevation ${feature.elevation} m · Height ${heightScale.toFixed(1)}×`;
}

function fitViewAndSave(): void {
  if (!viewer || !controls) return;
  fitCameraAndSaveTarget(viewer, controls);
}

function renderData(): void {
  if (!viewer || !controls) return;
  try {
    normalized = normalizeGeometryRows(rawRows, {
      sourceCoordinateSystem: crsSelect.value as SourceCoordinateSystem,
      elevationUnit: 'meters'
    });
    const scaled: NormalizedGeometry = {
      ...normalized,
      features: normalized.features.map((feature) => ({ ...feature, elevation: feature.elevation * heightScale }))
    };
    viewer.setData(scaled);
    viewer.setStyle({ edgeVisible: edgesInput.checked });
    fitViewAndSave();
    const warningText = scaled.warnings.length > 0 ? ` Warning: ${scaled.warnings.join(' ')}` : '';
    setStatus(`Rendered ${scaled.features.length} feature(s).${warningText}`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
}

async function loadTableauData(): Promise<void> {
  setStatus('Reading Geometry from Tableau…');
  try {
    const worksheet = tableau.extensions.worksheetContent?.worksheet;
    if (!worksheet) throw new Error('No Tableau worksheet is available. Place this extension on a worksheet.');
    rawRows = await readTableauGeometryRows(worksheet);
    renderData();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
}

function resize(): void {
  if (!activeRenderer || !viewer) return;
  const rect = sceneCanvas.getBoundingClientRect();
  activeRenderer.setSize(Math.max(rect.width, 1), Math.max(rect.height, 1), false);
  viewer.resize();
}

function animate(): void {
  if (disposed || !activeRenderer || !viewer || !controls) return;
  controls.update();
  activeRenderer.render(viewer.scene, viewer.camera);
  animationFrameId = window.requestAnimationFrame(animate);
}

function onPointerMove(event: PointerEvent): void {
  const feature = viewer?.pick(event.clientX, event.clientY);
  if (feature) showFeature(feature);
  else showFeature();
}

function onScaleInput(): void {
  heightScale = Number(scaleInput.value);
  scaleTextElement.textContent = `${heightScale.toFixed(1)}×`;
  if (rawRows.length > 0) renderData();
}

function onCrsChange(): void {
  if (rawRows.length > 0) renderData();
}

function onEdgesChange(): void {
  viewer?.setStyle({ edgeVisible: edgesInput.checked });
}

function onReset(): void {
  if (controls) resetCamera(controls);
}

function cleanup(): void {
  if (disposed) return;
  disposed = true;
  if (animationFrameId !== undefined) window.cancelAnimationFrame(animationFrameId);
  animationFrameId = undefined;
  resizeObserver?.disconnect();
  resizeObserver = undefined;
  if (initializationHandler) window.removeEventListener('load', initializationHandler);
  initializationHandler = undefined;
  sceneCanvas.removeEventListener('pointermove', onPointerMove);
  scaleInput.removeEventListener('input', onScaleInput);
  crsSelect.removeEventListener('change', onCrsChange);
  edgesInput.removeEventListener('change', onEdgesChange);
  resetButton.removeEventListener('click', onReset);
  window.removeEventListener('resize', resize);
  controls?.dispose();
  viewer?.dispose();
  activeRenderer?.dispose();
  controls = undefined;
  viewer = undefined;
  activeRenderer = undefined;
}

function startViewer(): boolean {
  const initialization = initializeWebGLRenderer(sceneCanvas, Math.min(window.devicePixelRatio, 2));
  if (!initialization.renderer) {
    setStatus(formatWebGLInitializationError(initialization.error), true);
    return false;
  }
  activeRenderer = initialization.renderer;
  try {
    viewer = new GeometryRenderer(sceneCanvas);
    controls = new OrbitControls(viewer.camera, sceneCanvas);
    controls.enableDamping = true;
    controls.screenSpacePanning = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;

    sceneCanvas.addEventListener('pointermove', onPointerMove);
    scaleInput.addEventListener('input', onScaleInput);
    crsSelect.addEventListener('change', onCrsChange);
    edgesInput.addEventListener('change', onEdgesChange);
    resetButton.addEventListener('click', onReset);
    window.addEventListener('resize', resize);
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(sceneCanvas.parentElement ?? sceneCanvas);
    resize();
    animate();
    return true;
  } catch (error) {
    cleanup();
    setStatus(`3D viewer initialization failed: ${error instanceof Error ? error.message : String(error)}`, true);
    return false;
  }
}

window.addEventListener('beforeunload', cleanup, { once: true });

if (startViewer()) {
  async function initializeExtension(): Promise<void> {
    if (typeof tableau === 'undefined' || !tableau.extensions) {
      setStatus('Tableau Extensions API library was not loaded. Check network access to the official Tableau API script.', true);
      return;
    }
    setStatus('Connecting to Tableau Extensions API…');
    try {
      await Promise.race([
        tableau.extensions.initializeAsync(),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('Tableau Extensions API initialization timed out after 15 seconds.')), 15_000);
        })
      ]);
      await loadTableauData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), true);
    }
  }

  let initializationStarted = false;
  function startInitialization(): void {
    if (initializationStarted || disposed) return;
    initializationStarted = true;
    void initializeExtension();
  }

  initializationHandler = startInitialization;
  window.addEventListener('load', startInitialization, { once: true });
  startInitialization();
}
