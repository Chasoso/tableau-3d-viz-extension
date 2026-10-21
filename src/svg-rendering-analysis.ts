import * as THREE from 'three';

export type FacePart = 'top' | 'side' | 'bottom';

export interface FacePartGeometries {
  top?: THREE.BufferGeometry;
  side?: THREE.BufferGeometry;
  bottom?: THREE.BufferGeometry;
}

export interface ProjectedFaceSample {
  part: FacePart;
  signedArea: number;
  depth: number;
  outsideClip: boolean;
}

export interface ProjectionSummary {
  total: number;
  positiveArea: number;
  negativeArea: number;
  zeroArea: number;
  outsideClip: number;
  depthMin: number;
  depthMax: number;
  samples: readonly ProjectedFaceSample[];
}

const FACE_PARTS: readonly FacePart[] = ['top', 'side', 'bottom'];

function createPartGeometry(positions: number[], normals: number[]): THREE.BufferGeometry | undefined {
  if (positions.length === 0) return undefined;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

/**
 * Split a non-indexed Three.js extrusion into diagnostic face groups.
 * This helper is intentionally kept outside the production WebGL renderer.
 */
export function splitExtrusionGeometry(source: THREE.BufferGeometry): FacePartGeometries {
  const expandedSource = source.index ? source.toNonIndexed() : source;
  const position = expandedSource.getAttribute('position');
  if (!position || position.count % 3 !== 0) {
    if (expandedSource !== source) expandedSource.dispose();
    throw new Error('SVG face analysis requires triangle geometry.');
  }

  const positions = new Map<FacePart, number[]>(FACE_PARTS.map((part) => [part, []]));
  const normals = new Map<FacePart, number[]>(FACE_PARTS.map((part) => [part, []]));
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let index = 0; index < position.count; index += 3) {
    a.fromBufferAttribute(position, index);
    b.fromBufferAttribute(position, index + 1);
    c.fromBufferAttribute(position, index + 2);
    normal.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const part: FacePart = Math.abs(normal.z) < 1e-6 ? 'side' : normal.z > 0 ? 'top' : 'bottom';
    normal.normalize();
    const partPositions = positions.get(part);
    const partNormals = normals.get(part);
    if (!partPositions || !partNormals) throw new Error(`Unknown face part: ${part}`);
    for (const vertex of [a, b, c]) {
      partPositions.push(vertex.x, vertex.y, vertex.z);
      partNormals.push(normal.x, normal.y, normal.z);
    }
  }

  const result = {
    top: createPartGeometry(positions.get('top') ?? [], normals.get('top') ?? []),
    side: createPartGeometry(positions.get('side') ?? [], normals.get('side') ?? []),
    bottom: createPartGeometry(positions.get('bottom') ?? [], normals.get('bottom') ?? [])
  };
  if (expandedSource !== source) expandedSource.dispose();
  return result;
}

function transformToNdc(position: THREE.Vector3, matrix: THREE.Matrix4): THREE.Vector3 {
  const projected = new THREE.Vector4(position.x, position.y, position.z, 1).applyMatrix4(matrix);
  if (projected.w === 0) return new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
  return new THREE.Vector3(projected.x / projected.w, projected.y / projected.w, projected.z / projected.w);
}

/**
 * Recomputes the same screen-space facts that matter to SVGRenderer's painter
 * path: signed 2D triangle area, NDC depth, and clip-range visibility.
 */
export function projectFaceGeometry(
  geometry: THREE.BufferGeometry,
  mesh: THREE.Object3D,
  camera: THREE.Camera,
  part: FacePart
): ProjectedFaceSample[] {
  const position = geometry.getAttribute('position');
  if (!position || position.count % 3 !== 0) throw new Error('Projected face analysis requires triangle geometry.');
  mesh.updateWorldMatrix(true, false);
  camera.updateMatrixWorld();
  const matrix = new THREE.Matrix4()
    .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    .multiply(mesh.matrixWorld);
  const samples: ProjectedFaceSample[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 3) {
    a.fromBufferAttribute(position, index);
    b.fromBufferAttribute(position, index + 1);
    c.fromBufferAttribute(position, index + 2);
    const pa = transformToNdc(a, matrix);
    const pb = transformToNdc(b, matrix);
    const pc = transformToNdc(c, matrix);
    const signedArea = ((pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x)) / 2;
    const depth = (pa.z + pb.z + pc.z) / 3;
    const outsideClip = [pa, pb, pc].some((point) =>
      !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z) ||
      point.x < -1 || point.x > 1 || point.y < -1 || point.y > 1 || point.z < -1 || point.z > 1
    );
    samples.push({ part, signedArea, depth, outsideClip });
  }
  return samples;
}

export function summarizeProjectedFaces(samples: readonly ProjectedFaceSample[]): ProjectionSummary {
  const positiveArea = samples.filter((sample) => sample.signedArea > 1e-7).length;
  const negativeArea = samples.filter((sample) => sample.signedArea < -1e-7).length;
  const zeroArea = samples.length - positiveArea - negativeArea;
  const depths = samples.map((sample) => sample.depth).filter(Number.isFinite);
  return {
    total: samples.length,
    positiveArea,
    negativeArea,
    zeroArea,
    outsideClip: samples.filter((sample) => sample.outsideClip).length,
    depthMin: depths.length > 0 ? Math.min(...depths) : Number.NaN,
    depthMax: depths.length > 0 ? Math.max(...depths) : Number.NaN,
    samples
  };
}
