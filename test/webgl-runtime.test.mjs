import test from 'node:test';
import assert from 'node:assert/strict';
import { formatWebGLInitializationError, initializeWebGLRenderer } from '../extension/webgl-runtime.js';

function fakeRenderer() {
  return {
    disposed: 0,
    pixelRatio: 0,
    setPixelRatio(value) { this.pixelRatio = value; },
    setSize() {},
    render() {},
    dispose() { this.disposed += 1; }
  };
}

test('initializes WebGL renderer and configures pixel ratio on success', () => {
  const renderer = fakeRenderer();
  const result = initializeWebGLRenderer({}, 2, () => renderer);
  assert.equal(result.renderer, renderer);
  assert.equal(renderer.pixelRatio, 2);
  assert.equal(renderer.disposed, 0);
});

test('returns a failure without starting a renderer when context creation throws', () => {
  const result = initializeWebGLRenderer({}, 1, () => { throw new Error('GpuChannelHost creation failed'); });
  assert.equal(result.renderer, undefined);
  assert.match(formatWebGLInitializationError(result.error), /WebGL is unavailable/);
  assert.match(formatWebGLInitializationError(result.error), /GpuChannelHost creation failed/);
});

test('disposes a renderer if post-creation initialization fails', () => {
  const renderer = fakeRenderer();
  renderer.setPixelRatio = () => { throw new Error('setPixelRatio failed'); };
  const result = initializeWebGLRenderer({}, 1, () => renderer);
  assert.equal(result.renderer, undefined);
  assert.match(formatWebGLInitializationError(result.error), /setPixelRatio failed/);
  assert.equal(renderer.disposed, 1);
});
