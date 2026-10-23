import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createExtrudedGeometries, placeExtrudedGeometry } from '../extension/three-geometry-factory.js';
import { parseObservedGeometry } from '../extension/geometry-adapter.js';

test('creates extrusion geometry for Polygon holes and MultiPolygon parts', () => {
  const polygon = parseObservedGeometry("GEOGRAPHY('POLYGON ((0 0, 4 0, 4 4, 0 4, 0 0), (1 1, 3 1, 3 3, 1 3, 1 1))')");
  const multiPolygon = parseObservedGeometry("GEOGRAPHY('MULTIPOLYGON (((5 0, 6 0, 6 1, 5 1, 5 0)), ((7 0, 8 0, 8 1, 7 1, 7 0)))')");

  assert.equal(createExtrudedGeometries(polygon, 20).length, 1);
  assert.equal(createExtrudedGeometries(multiPolygon, 20).length, 2);
  assert.ok(createExtrudedGeometries(polygon, 20)[0].getAttribute('position'));
});

test('places negative extrusion below the base and keeps zero flat', () => {
  const geometry = new THREE.Mesh(createExtrudedGeometries({
    type: 'Polygon',
    rings: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
  }, 12)[0]);
  const negative = new THREE.Mesh(createExtrudedGeometries({
    type: 'Polygon',
    rings: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
  }, -12)[0]);
  const negativeEdges = new THREE.LineSegments();

  placeExtrudedGeometry(geometry, 12);
  placeExtrudedGeometry(negative, -12);
  placeExtrudedGeometry(negativeEdges, -12);
  assert.equal(geometry.position.z, 0);
  assert.equal(negative.position.z, -12);
  assert.equal(negativeEdges.position.z, -12);
});
