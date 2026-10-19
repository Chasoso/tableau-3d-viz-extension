import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGeometryRows, parseObservedGeometry } from '../extension/geometry-adapter.js';

test('parses observed Polygon geography values including a hole', () => {
  const geometry = parseObservedGeometry("GEOGRAPHY('POLYGON ((0 0, 2 0, 2 2, 0 2, 0 0), (0.5 0.5, 1.5 0.5, 1.5 1.5, 0.5 1.5, 0.5 0.5))')");
  assert.equal(geometry.type, 'Polygon');
  assert.equal(geometry.rings.length, 2);
  assert.deepEqual(geometry.rings[0][0], [0, 0]);
});

test('parses MultiPolygon and converts EPSG:4326 to local meters', () => {
  const normalized = normalizeGeometryRows([
    {
      id: 'multi',
      geometry: "GEOGRAPHY('MULTIPOLYGON (((0 0, 1 0, 1 1, 0 1, 0 0)), ((2 0, 3 0, 3 1, 2 1, 2 0)))')",
      elevation: 30
    },
    {
      id: 'plain',
      geometry: "GEOGRAPHY('POLYGON ((4 0, 5 0, 5 1, 4 1, 4 0))')",
      elevation: 10
    }
  ], { sourceCoordinateSystem: 'EPSG:4326', elevationUnit: 'meters' });
  assert.equal(normalized.features.length, 2);
  assert.equal(normalized.features[0].geometry.type, 'MultiPolygon');
  assert.equal(normalized.features[0].geometry.rings.length, 2);
  assert.ok(normalized.features[1].geometry.rings[0][1][0] > 100_000);
});

test('rejects unknown geometry formats instead of guessing', () => {
  assert.throws(() => parseObservedGeometry('{"type":"Polygon"}'), /Unsupported Geometry value/);
  assert.throws(() => parseObservedGeometry("GEOGRAPHY('POINT (0 0)')"), /Unsupported WKT geometry type/);
});
