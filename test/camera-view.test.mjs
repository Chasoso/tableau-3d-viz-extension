import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { fitCameraAndSaveTarget, resetCamera } from '../extension/camera-view.js';

function fakeControls() {
  return {
    target: new THREE.Vector3(),
    updates: 0,
    saves: 0,
    resets: 0,
    update() { this.updates += 1; },
    saveState() { this.saves += 1; },
    reset() { this.resets += 1; }
  };
}

test('fits controls to the renderer center and saves the fitted state', () => {
  const controls = fakeControls();
  const center = new THREE.Vector3(4, 5, 6);
  const result = fitCameraAndSaveTarget({ fitCamera: () => center }, controls);
  assert.deepEqual(result.toArray(), [4, 5, 6]);
  assert.deepEqual(controls.target.toArray(), [4, 5, 6]);
  assert.equal(controls.updates, 1);
  assert.equal(controls.saves, 1);
});

test('reset restores the saved controls state through one operation', () => {
  const controls = fakeControls();
  resetCamera(controls);
  assert.equal(controls.resets, 1);
  assert.equal(controls.updates, 1);
});
