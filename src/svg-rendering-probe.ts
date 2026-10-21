import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { normalizeGeometryRows } from './geometry-adapter.js';
import { projectFaceGeometry, splitExtrusionGeometry, summarizeProjectedFaces, type FacePart, type ProjectionSummary } from './svg-rendering-analysis.js';
import { createExtrudedGeometries, placeExtrudedGeometry } from './three-geometry-factory.js';
import type { NormalizedGeometry, RawGeometryRow, RenderFeature, SourceCoordinateSystem } from './geometry-model.js';

type FaceMode = 'combined' | 'separated' | FacePart;
type MaterialMode = 'double-opaque' | 'front-opaque' | 'double-transparent';

interface ProbePart {
  mesh: THREE.Mesh;
  feature: RenderFeature;
  material: THREE.MeshBasicMaterial;
  facePart?: FacePart;
}

interface ProbeEdge {
  edge: THREE.LineSegments;
  feature: RenderFeature;
}

interface FixtureDefinition {
  label: string;
  sourceCoordinateSystem: SourceCoordinateSystem;
  rows: readonly RawGeometryRow[];
}

const FIXTURES: Record<string, FixtureDefinition> = {
  mixed: {
    label: 'Mixed Polygon / hole / MultiPolygon',
    sourceCoordinateSystem: 'EPSG:4326',
    rows: [
      { id: 'polygon-plain', geometry: "GEOGRAPHY('POLYGON ((0 0, 2 0, 2 2, 0 2, 0 0))')", elevation: 10 },
      { id: 'polygon-hole', geometry: "GEOGRAPHY('POLYGON ((3 0, 7 0, 7 4, 3 4, 3 0), (4 1, 4 2, 6 2, 6 1, 4 1))')", elevation: 20 },
      { id: "multipolygon", geometry: "GEOGRAPHY('MULTIPOLYGON (((0 4, 1 4, 1 5, 0 5, 0 4)), ((2 4, 3 4, 3 5, 2 5, 2 4)))')", elevation: 30 }
    ]
  },
  elevation: {
    label: 'Elevation edge cases',
    sourceCoordinateSystem: 'cartesian',
    rows: [
      { id: 'positive-30m', geometry: 'POLYGON ((-8 -2, -4 -2, -4 2, -8 2, -8 -2))', elevation: 30 },
      { id: 'flat-zero', geometry: 'POLYGON ((-2 -2, 2 -2, 2 2, -2 2, -2 -2))', elevation: 0 },
      { id: 'negative-12m', geometry: 'POLYGON ((4 -2, 8 -2, 8 2, 4 2, 4 -2))', elevation: -12 },
      { id: 'missing-elevation', geometry: 'POLYGON ((-2 5, 2 5, 2 9, -2 9, -2 5))' }
    ]
  }
};

const viewport = document.querySelector<HTMLElement>('#viewport');
const status = document.querySelector<HTMLElement>('#status');
const selected = document.querySelector<HTMLElement>('#selected');
const metrics = document.querySelector<HTMLElement>('#metrics');
const fixtureSelect = document.querySelector<HTMLSelectElement>('#fixture');
const crsSelect = document.querySelector<HTMLSelectElement>('#crs');
const heightInput = document.querySelector<HTMLInputElement>('#height');
const heightText = document.querySelector<HTMLElement>('#heightText');
const edgesInput = document.querySelector<HTMLInputElement>('#edges');
const qualitySelect = document.querySelector<HTMLSelectElement>('#quality');
const faceModeSelect = document.querySelector<HTMLSelectElement>('#faceMode');
const materialModeSelect = document.querySelector<HTMLSelectElement>('#materialMode');
const sortElementsInput = document.querySelector<HTMLInputElement>('#sortElements');
const sortObjectsInput = document.querySelector<HTMLInputElement>('#sortObjects');
const projection = document.querySelector<HTMLElement>('#projection');
const resetButton = document.querySelector<HTMLButtonElement>('#reset');

if (!viewport || !status || !selected || !metrics || !fixtureSelect || !crsSelect || !heightInput || !heightText || !edgesInput || !qualitySelect || !faceModeSelect || !materialModeSelect || !sortElementsInput || !sortObjectsInput || !projection || !resetButton) {
  throw new Error('SVG rendering probe markup is incomplete.');
}

const viewportElement = viewport;
const statusElement = status;
const selectedElement = selected;
const metricsElement = metrics;
const fixtureInput = fixtureSelect;
const crsInput = crsSelect;
const heightScaleInput = heightInput;
const heightTextElement = heightText;
const edgesToggle = edgesInput;
const qualityInput = qualitySelect;
const faceModeInput = faceModeSelect;
const materialModeInput = materialModeSelect;
const sortElementsToggle = sortElementsInput;
const sortObjectsToggle = sortObjectsInput;
const projectionElement = projection;
const resetViewButton = resetButton;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf8fafc);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100_000);
const root = new THREE.Group();
scene.add(root);

const renderer = new SVGRenderer();
renderer.sortObjects = sortObjectsToggle.checked;
renderer.sortElements = sortElementsToggle.checked;
renderer.overdraw = 0.5;
renderer.setQuality('high');
renderer.domElement.setAttribute('aria-label', 'Three.js SVG geometry viewer');
renderer.domElement.style.display = 'block';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
viewportElement.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement as unknown as HTMLElement);
controls.enableDamping = false;
controls.screenSpacePanning = true;
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const parts: ProbePart[] = [];
const edgeLines: ProbeEdge[] = [];
let normalized: NormalizedGeometry | undefined;
let sourceElevations = new Map<string, number>();
let heightScale = 2;
let hoveredId: string | undefined;
let renderDuration = 0;

const FACE_COLORS: Record<FacePart, number> = { top: 0x3f9db1, side: 0x2f7f95, bottom: 0x7db7c1 };

function currentFaceMode(): FaceMode {
  return faceModeInput.value as FaceMode;
}

function currentMaterialMode(): MaterialMode {
  return materialModeInput.value as MaterialMode;
}

function materialSide(mode: MaterialMode): THREE.Side {
  return mode === 'front-opaque' ? THREE.FrontSide : THREE.DoubleSide;
}

function createMaterial(facePart?: FacePart): THREE.MeshBasicMaterial {
  const mode = currentMaterialMode();
  const transparent = mode === 'double-transparent';
  const color = currentFaceMode() === 'separated' && facePart ? FACE_COLORS[facePart] : 0x3f9db1;
  return new THREE.MeshBasicMaterial({ color, side: materialSide(mode), transparent, opacity: transparent ? 0.5 : 1 });
}

function colorForPart(facePart?: FacePart): number {
  return currentFaceMode() === 'separated' && facePart ? FACE_COLORS[facePart] : 0x3f9db1;
}

function summarizeCurrentProjection(): ProjectionSummary {
  const samples = [];
  for (const part of parts) {
    if (part.facePart) {
      samples.push(...projectFaceGeometry(part.mesh.geometry, part.mesh, camera, part.facePart));
      continue;
    }
    const split = splitExtrusionGeometry(part.mesh.geometry);
    for (const facePart of ['top', 'side', 'bottom'] as const) {
      const geometry = split[facePart];
      if (geometry) {
        samples.push(...projectFaceGeometry(geometry, part.mesh, camera, facePart));
        geometry.dispose();
      }
    }
  }
  return summarizeProjectedFaces(samples);
}

function formatDepth(value: number): string {
  return Number.isFinite(value) ? value.toPrecision(8) : 'n/a';
}

function setStatus(message: string, error = false): void {
  statusElement.textContent = message;
  statusElement.dataset.state = error ? 'error' : 'ok';
}

function setSelected(feature?: RenderFeature): void {
  if (!feature) {
    selectedElement.textContent = 'Hover to inspect';
    return;
  }
  const sourceElevation = sourceElevations.get(feature.id) ?? feature.elevation;
  selectedElement.textContent = `${feature.id} · elevation ${sourceElevation} m · extrusion ${feature.elevation} m`;
}

function setHovered(feature?: RenderFeature): void {
  hoveredId = feature?.id;
  for (const part of parts) {
    part.material.color.setHex(part.feature.id === hoveredId ? 0x1e637e : colorForPart(part.facePart));
  }
  for (const edgeLine of edgeLines) {
    (edgeLine.edge.material as THREE.LineBasicMaterial).color.setHex(edgeLine.feature.id === hoveredId ? 0x173b4a : 0xffffff);
  }
  setSelected(feature);
}

function clearScene(): void {
  setHovered(undefined);
  for (const part of parts) {
    part.mesh.geometry.dispose();
    part.material.dispose();
  }
  for (const edgeLine of edgeLines) {
    edgeLine.edge.geometry.dispose();
    (edgeLine.edge.material as THREE.Material).dispose();
  }
  parts.length = 0;
  edgeLines.length = 0;
  root.clear();
}

function addFeature(feature: RenderFeature): void {
  const group = new THREE.Group();
  group.userData.featureId = feature.id;
  for (const geometry of createExtrudedGeometries(feature.geometry, feature.elevation)) {
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 })
    );
    edge.userData.feature = feature;
    edge.visible = edgesToggle.checked;
    edgeLines.push({ edge, feature });
    group.add(edge);

    const selectedFaceMode = currentFaceMode();
    const split = selectedFaceMode === 'combined' ? undefined : splitExtrusionGeometry(geometry);
    const renderParts = selectedFaceMode === 'combined'
      ? [{ geometry, facePart: undefined }]
      : selectedFaceMode === 'top' || selectedFaceMode === 'side' || selectedFaceMode === 'bottom'
        ? [{ geometry: split?.[selectedFaceMode], facePart: selectedFaceMode }]
        : (['top', 'side', 'bottom'] as const).map((facePart) => ({ geometry: split?.[facePart], facePart }));
    const usedGeometries = new Set<THREE.BufferGeometry>();

    for (const renderPart of renderParts) {
      if (!renderPart.geometry) continue;
      usedGeometries.add(renderPart.geometry);
      const material = createMaterial(renderPart.facePart);
      const mesh = new THREE.Mesh(renderPart.geometry, material);
      mesh.userData.feature = feature;
      mesh.userData.facePart = renderPart.facePart;
      placeExtrudedGeometry(mesh, feature.elevation);
      group.add(mesh);
      parts.push({ mesh, feature, material, facePart: renderPart.facePart });
    }
    if (split) {
      for (const facePart of ['top', 'side', 'bottom'] as const) {
        const splitGeometry = split[facePart];
        if (splitGeometry && !usedGeometries.has(splitGeometry)) splitGeometry.dispose();
      }
    }
  }
  root.add(group);
}

function fitCamera(): void {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const distance = Math.max(size.x, size.y, size.z, 1) * 1.7;
  camera.far = Math.max(100_000, distance * 10);
  camera.updateProjectionMatrix();
  camera.position.set(center.x + distance, center.y - distance, center.z + distance);
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();
  controls.saveState();
}

function render(): void {
  const start = performance.now();
  renderer.render(scene, camera);
  renderDuration = performance.now() - start;
  metricsElement.textContent = `${normalized?.features.length ?? 0} feature(s) · ${renderer.info.render.faces} faces · ${renderer.domElement.childElementCount} SVG nodes · ${renderDuration.toFixed(1)} ms last render`;
  const summary = summarizeCurrentProjection();
  const paths = Array.from(renderer.domElement.querySelectorAll('path'));
  const fillPaths = paths.filter((path) => (path.getAttribute('style') ?? '').includes('fill:'));
  const strokePaths = paths.filter((path) => (path.getAttribute('style') ?? '').includes('stroke:'));
  projectionElement.textContent = `Projected ${summary.total} triangles · area +${summary.positiveArea}/-${summary.negativeArea}/zero ${summary.zeroArea} · vertices outside clip ${summary.outsideClip} · depth ${formatDepth(summary.depthMin)}..${formatDepth(summary.depthMax)} · SVG paths fill ${fillPaths.length}, stroke ${strokePaths.length} · sortElements ${renderer.sortElements ? 'on' : 'off'}, sortObjects ${renderer.sortObjects ? 'on' : 'off'}`;
}

function renderFixture(): void {
  const fixture = FIXTURES[fixtureInput.value];
  if (!fixture) {
    setStatus(`Unknown fixture: ${fixtureInput.value}`, true);
    return;
  }
  try {
    normalized = normalizeGeometryRows(fixture.rows, {
      sourceCoordinateSystem: crsInput.value as SourceCoordinateSystem,
      elevationUnit: 'meters'
    });
    sourceElevations = new Map(normalized.features.map((feature) => [feature.id, feature.elevation]));
    const scaled: NormalizedGeometry = {
      ...normalized,
      features: normalized.features.map((feature) => ({ ...feature, elevation: feature.elevation * heightScale }))
    };
    clearScene();
    normalized = scaled;
    for (const feature of scaled.features) addFeature(feature);
    fitCamera();
    const warningText = normalized.warnings.length > 0 ? ` Warning: ${normalized.warnings.join(' ')}` : '';
    setStatus(`${fixture.label} rendered with Three.js SVGRenderer. WebGL is not used.${warningText}`);
    render();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
}

function resize(): void {
  const rect = viewportElement.getBoundingClientRect();
  renderer.setSize(Math.max(rect.width, 1), Math.max(rect.height, 1));
  camera.aspect = rect.width / Math.max(rect.height, 1);
  camera.updateProjectionMatrix();
  render();
}

function pick(event: PointerEvent): void {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(parts.map((part) => part.mesh), false)[0]?.object as THREE.Mesh | undefined;
  setHovered(hit?.userData.feature as RenderFeature | undefined);
  render();
}

controls.addEventListener('change', render);
renderer.domElement.addEventListener('pointermove', pick);
renderer.domElement.addEventListener('pointerleave', () => { setHovered(undefined); render(); });
fixtureInput.addEventListener('change', () => {
  const fixture = FIXTURES[fixtureInput.value];
  if (fixture) crsInput.value = fixture.sourceCoordinateSystem;
  renderFixture();
});
crsInput.addEventListener('change', renderFixture);
heightScaleInput.addEventListener('input', () => {
  heightScale = Number(heightScaleInput.value);
  heightTextElement.textContent = `${heightScale.toFixed(1)}×`;
  renderFixture();
});
edgesToggle.addEventListener('change', () => {
  for (const edgeLine of edgeLines) edgeLine.edge.visible = edgesToggle.checked;
  render();
});
qualityInput.addEventListener('change', () => {
  renderer.setQuality(qualityInput.value);
  render();
});
faceModeInput.addEventListener('change', renderFixture);
materialModeInput.addEventListener('change', renderFixture);
sortElementsToggle.addEventListener('change', () => {
  renderer.sortElements = sortElementsToggle.checked;
  render();
});
sortObjectsToggle.addEventListener('change', () => {
  renderer.sortObjects = sortObjectsToggle.checked;
  render();
});
resetViewButton.addEventListener('click', () => { controls.reset(); controls.update(); render(); });
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(viewportElement);

window.addEventListener('error', (event) => setStatus(`SVG probe script error: ${event.message || 'unknown error'}`, true));
window.addEventListener('unhandledrejection', (event) => setStatus(`SVG probe promise error: ${String(event.reason || 'unknown error')}`, true));

const initialFixture = FIXTURES[fixtureInput.value];
if (initialFixture) crsInput.value = initialFixture.sourceCoordinateSystem;
resize();
renderFixture();

window.addEventListener('beforeunload', () => {
  controls.dispose();
  clearScene();
});
