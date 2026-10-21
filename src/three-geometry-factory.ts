import * as THREE from 'three';
import type { GeometryShape, PolygonRings } from './geometry-model.js';

function addRing(path: THREE.Path, ring: readonly (readonly [number, number])[]): void {
  path.moveTo(ring[0][0], ring[0][1]);
  for (const position of ring.slice(1)) path.lineTo(position[0], position[1]);
  path.closePath();
}

/**
 * Build the Three.js geometry used by both the WebGL renderer and the SVG spike.
 * The input is already normalized by GeometryAdapter; this function does not
 * parse Tableau values or infer a coordinate system.
 */
export function createExtrudedGeometries(shape: GeometryShape, height: number): THREE.BufferGeometry[] {
  const polygons: PolygonRings[] = shape.type === 'Polygon' ? [shape.rings] : [...shape.rings];
  return polygons.map((rings) => {
    const outer = new THREE.Shape();
    addRing(outer, rings[0]);
    for (const hole of rings.slice(1)) {
      const holePath = new THREE.Path();
      addRing(holePath, hole);
      outer.holes.push(holePath);
    }
    if (height === 0) return new THREE.ShapeGeometry(outer);
    return new THREE.ExtrudeGeometry(outer, { depth: Math.abs(height), bevelEnabled: false });
  });
}

export function placeExtrudedGeometry(object: THREE.Object3D, height: number): void {
  if (height < 0) object.position.z = height;
}
