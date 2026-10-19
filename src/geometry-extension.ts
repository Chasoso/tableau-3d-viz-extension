/// <reference types="@tableau/extensions-api-types" />
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { normalizeGeometryRows } from './geometry-adapter.js';
import { GeometryRenderer } from './geometry-renderer.js';
import type { NormalizedGeometry, RawGeometryRow, SourceCoordinateSystem } from './geometry-model.js';
import { readTableauGeometryRows } from './tableau-geometry-source.js';

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

const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const viewer = new GeometryRenderer(sceneCanvas);
const controls = new OrbitControls(viewer.camera, sceneCanvas);
controls.enableDamping = true;
controls.screenSpacePanning = true;
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;

let rawRows: RawGeometryRow[] = [];
let normalized: NormalizedGeometry | undefined;
let heightScale = 2;

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

function renderData(): void {
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
  controls.target.set(0, 0, 0);
  controls.update();
  setStatus(`Rendered ${scaled.features.length} feature(s).`);
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
  const rect = sceneCanvas.getBoundingClientRect();
  renderer.setSize(Math.max(rect.width, 1), Math.max(rect.height, 1), false);
  viewer.resize();
}

sceneCanvas.addEventListener('pointermove', (event) => {
  const feature = viewer.pick(event.clientX, event.clientY);
  if (feature) showFeature(feature);
  else showFeature();
});
scaleInput.addEventListener('input', () => {
  heightScale = Number(scaleInput.value);
  scaleTextElement.textContent = `${heightScale.toFixed(1)}×`;
  if (rawRows.length > 0) renderData();
});
crsSelect.addEventListener('change', () => { if (rawRows.length > 0) renderData(); });
edgesInput.addEventListener('change', () => viewer.setStyle({ edgeVisible: edgesInput.checked }));
resetButton.addEventListener('click', () => { controls.reset(); viewer.reset(); });
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(sceneCanvas.parentElement ?? sceneCanvas);

function animate(): void {
  controls.update();
  renderer.render(viewer.scene, viewer.camera);
  requestAnimationFrame(animate);
}

window.addEventListener('beforeunload', () => { controls.dispose(); viewer.dispose(); renderer.dispose(); });
resize();
animate();

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

window.addEventListener('load', () => { void initializeExtension(); }, { once: true });
