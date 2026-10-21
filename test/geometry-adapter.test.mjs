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

const square = "GEOGRAPHY('POLYGON ((0 0, 2 0, 2 2, 0 2, 0 0))')";

test('treats zero elevation as valid and does not warn', () => {
  const normalized = normalizeGeometryRows([{ id: 'zero', geometry: square, elevation: 0 }], {
    sourceCoordinateSystem: 'cartesian',
    elevationUnit: 'meters'
  });
  assert.equal(normalized.features[0].elevation, 0);
  assert.deepEqual(normalized.warnings, []);
});

test('renders only missing elevations at zero and warns', () => {
  const normalized = normalizeGeometryRows([
    { id: 'undefined', geometry: square },
    { id: 'blank', geometry: square, elevation: '  ' },
    { id: 'null', geometry: square, elevation: null }
  ], { sourceCoordinateSystem: 'cartesian', elevationUnit: 'meters' });
  assert.deepEqual(normalized.features.map((feature) => feature.elevation), [0, 0, 0]);
  assert.deepEqual(normalized.warnings, ['Missing elevation values were rendered at zero meters.']);
});

test('keeps negative elevations and rejects invalid elevation types', () => {
  const normalized = normalizeGeometryRows([{ id: 'negative', geometry: square, elevation: -12 }], {
    sourceCoordinateSystem: 'cartesian',
    elevationUnit: 'meters'
  });
  assert.equal(normalized.features[0].elevation, -12);
  assert.throws(() => normalizeGeometryRows([{ id: 'boolean', geometry: square, elevation: true }], {
    sourceCoordinateSystem: 'cartesian',
    elevationUnit: 'meters'
  }), /invalid elevation type/);
  assert.throws(() => normalizeGeometryRows([{ id: 'nan', geometry: square, elevation: 'not-a-number' }], {
    sourceCoordinateSystem: 'cartesian',
    elevationUnit: 'meters'
  }), /non-numeric elevation/);
});

test('rejects a closed but degenerate ring', () => {
  assert.throws(() => parseObservedGeometry("POLYGON ((0 0, 1 0, 2 0, 0 0))"), /non-zero area/);
});
