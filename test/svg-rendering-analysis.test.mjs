import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { parseObservedGeometry } from '../extension/geometry-adapter.js';
import { createExtrudedGeometries } from '../extension/three-geometry-factory.js';
import { projectFaceGeometry, splitExtrusionGeometry, splitSvgPathData, summarizeProjectedFaces } from '../extension/svg-rendering-analysis.js';

function disposeParts(parts) {
  for (const geometry of Object.values(parts)) geometry?.dispose();
}

test('splits Polygon extrusion caps and sides without changing the source geometry', () => {
  const shape = parseObservedGeometry("GEOGRAPHY('POLYGON ((0 0, 4 0, 4 4, 0 4, 0 0), (1 1, 3 1, 3 3, 1 3, 1 1))')");
  const source = createExtrudedGeometries(shape, 20)[0];
  const originalVertexCount = source.getAttribute('position').count;
  const parts = splitExtrusionGeometry(source);

  assert.ok(parts.top);
  assert.ok(parts.side);
  assert.ok(parts.bottom);
  assert.equal(parts.top.getAttribute('position').count % 3, 0);
  assert.equal(parts.side.getAttribute('position').count % 3, 0);
  assert.equal(parts.bottom.getAttribute('position').count % 3, 0);
  assert.equal(
    parts.top.getAttribute('position').count + parts.side.getAttribute('position').count + parts.bottom.getAttribute('position').count,
    originalVertexCount
  );

  disposeParts(parts);
  source.dispose();
});

test('keeps Polygon holes and every MultiPolygon part available for face analysis', () => {
  const polygon = parseObservedGeometry("GEOGRAPHY('POLYGON ((0 0, 4 0, 4 4, 0 4, 0 0), (1 1, 3 1, 3 3, 1 3, 1 1))')");
  const multiPolygon = parseObservedGeometry("GEOGRAPHY('MULTIPOLYGON (((5 0, 6 0, 6 1, 5 1, 5 0)), ((7 0, 8 0, 8 1, 7 1, 7 0)))')");
  const geometries = [...createExtrudedGeometries(polygon, 20), ...createExtrudedGeometries(multiPolygon, 20)];

  assert.equal(geometries.length, 3);
  for (const geometry of geometries) {
    const parts = splitExtrusionGeometry(geometry);
    assert.ok(parts.top && parts.side && parts.bottom);
    disposeParts(parts);
    geometry.dispose();
  }
});

test('reports projected winding, depth, and clipping independently of SVG output', () => {
  const source = createExtrudedGeometries({ type: 'Polygon', rings: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]] }, 20)[0];
  const parts = splitExtrusionGeometry(source);
  const mesh = new THREE.Mesh(source);
  mesh.position.z = -5;
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(20, -20, 20);
  camera.lookAt(2, 2, 5);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const samples = [];
  for (const part of ['top', 'side', 'bottom']) {
    samples.push(...projectFaceGeometry(parts[part], mesh, camera, part));
  }
  const summary = summarizeProjectedFaces(samples);

  assert.equal(summary.total, source.getAttribute('position').count / 3);
  assert.equal(summary.positiveArea + summary.negativeArea + summary.zeroArea, summary.total);
  assert.ok(summary.depthMin < summary.depthMax);
  assert.equal(summary.samples.length, summary.total);
  assert.equal(summary.byPart.top.total + summary.byPart.side.total + summary.byPart.bottom.total, summary.total);
  assert.ok(summary.byPart.side.maxAbsArea > 0);
  assert.ok(summary.byPart.side.meanAbsArea > 0);

  disposeParts(parts);
  source.dispose();
});

test('classifies a flat Polygon as a top-only surface', () => {
  const source = createExtrudedGeometries({ type: 'Polygon', rings: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] }, 0)[0];
  const parts = splitExtrusionGeometry(source);
  assert.ok(parts.top);
  assert.equal(parts.side, undefined);
  assert.equal(parts.bottom, undefined);
  disposeParts(parts);
  source.dispose();
});

test('splits SVGRenderer-style concatenated subpaths without changing path data', () => {
  const paths = splitSvgPathData('M0,0L1,0L0,1zM2,2L3,2L2,3z');
  assert.deepEqual(paths, ['M0,0L1,0L0,1z', 'M2,2L3,2L2,3z']);
});
