import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDiagnosticValue, sampleDataValue, truncate } from '../extension/diagnostic-format.js';

test('formats primitive and object diagnostic values without assuming geometry shape', () => {
  assert.equal(formatDiagnosticValue('Polygon'), 'Polygon');
  assert.equal(formatDiagnosticValue({ coordinates: [[1, 2]] }), '{"coordinates":[[1,2]]}');
  assert.equal(sampleDataValue({ value: 'raw', nativeValue: { ringCount: 2 } }).type, '[object Object]');
});

test('truncates diagnostic text', () => {
  assert.equal(truncate('abcdef', 3), 'abc…');
  assert.equal(truncate('abc', 3), 'abc');
});
