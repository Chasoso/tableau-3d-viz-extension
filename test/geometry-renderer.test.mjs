import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GeometryRenderer } from '../extension/geometry-renderer.js';

function fakeCanvas() {
  return { getBoundingClientRect: () => ({ width: 800, height: 400 }) };
}

test('fits camera to geometry center and keeps the camera aimed at that center', () => {
  const renderer = new GeometryRenderer(fakeCanvas());
  renderer.resize();
  renderer.setData({
    coordinateSystem: 'local-meters',
    origin: {},
    warnings: [],
    features: [{
      id: 'feature',
      elevation: 6,
      geometry: { type: 'Polygon', rings: [[[10, 20], [14, 20], [14, 24], [10, 24], [10, 20]]] }
    }]
  });

  const center = renderer.fitCamera();
  const expected = new THREE.Vector3(12, 22, 3);
  const direction = renderer.camera.getWorldDirection(new THREE.Vector3());
  const expectedDirection = expected.clone().sub(renderer.camera.position).normalize();
  assert.ok(center.distanceTo(expected) < 1e-9);
  assert.ok(direction.distanceTo(expectedDirection) < 1e-9);
  assert.ok(renderer.camera.near > 0);
  assert.ok(renderer.camera.far > renderer.camera.near);

  renderer.dispose();
  renderer.dispose();
});
