import * as THREE from 'three';
import { createExtrudedGeometries, placeExtrudedGeometry } from './three-geometry-factory.js';
import type { NormalizedGeometry, RenderFeature } from './geometry-model.js';

export interface RenderStyle {
  fillColor: number;
  edgeColor: number;
  hoverColor: number;
  edgeVisible: boolean;
}

const DEFAULT_STYLE: RenderStyle = {
  fillColor: 0x3f9db1,
  edgeColor: 0xffffff,
  hoverColor: 0x1e637e,
  edgeVisible: true
};

export class GeometryRenderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly root = new THREE.Group();
  readonly raycaster = new THREE.Raycaster();
  readonly pointer = new THREE.Vector2();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly edgeLines: THREE.LineSegments[] = [];
  private readonly materials = new Map<THREE.Mesh, THREE.MeshStandardMaterial>();
  private style: RenderStyle = { ...DEFAULT_STYLE };
  private hovered?: THREE.Mesh;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100_000);
    this.scene.background = new THREE.Color(0xf8fafc);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x78909c, 2.2));
    const directional = new THREE.DirectionalLight(0xffffff, 2.4);
    directional.position.set(5, -7, 12);
    this.scene.add(directional);
    this.scene.add(this.root);
  }

  setStyle(style: Partial<RenderStyle>): void {
    this.style = { ...this.style, ...style };
    for (const [mesh, material] of this.materials) material.color.setHex(mesh === this.hovered ? this.style.hoverColor : this.style.fillColor);
    for (const line of this.edgeLines) line.visible = this.style.edgeVisible;
  }

  setData(data: NormalizedGeometry): void {
    this.clear();
    for (const feature of data.features) this.addFeature(feature);
    this.fitCamera();
  }

  private addFeature(feature: RenderFeature): void {
    const group = new THREE.Group();
    group.userData.featureId = feature.id;
    const geometries = createExtrudedGeometries(feature.geometry, feature.elevation);
    for (const geometry of geometries) {
      const material = new THREE.MeshStandardMaterial({ color: this.style.fillColor, roughness: 0.82, metalness: 0.05, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.feature = feature;
      placeExtrudedGeometry(mesh, feature.elevation);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: this.style.edgeColor, transparent: true, opacity: 0.52 }));
      placeExtrudedGeometry(edges, feature.elevation);
      edges.userData.feature = feature;
      edges.visible = this.style.edgeVisible;
      group.add(mesh, edges);
      this.meshes.push(mesh);
      this.edgeLines.push(edges);
      this.materials.set(mesh, material);
    }
    this.root.add(group);
  }

  setHovered(mesh?: THREE.Mesh): void {
    if (this.hovered === mesh) return;
    if (this.hovered) this.materials.get(this.hovered)?.color.setHex(this.style.fillColor);
    this.hovered = mesh;
    if (mesh) this.materials.get(mesh)?.color.setHex(this.style.hoverColor);
  }

  pick(clientX: number, clientY: number): RenderFeature | undefined {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.meshes, false)[0]?.object as THREE.Mesh | undefined;
    this.setHovered(hit);
    return hit?.userData.feature as RenderFeature | undefined;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.camera.aspect = rect.width / Math.max(rect.height, 1);
    this.camera.updateProjectionMatrix();
  }

  fitCamera(): void {
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const distance = Math.max(size.x, size.y, size.z, 1) * 1.7;
    this.camera.position.set(center.x + distance, center.y - distance, center.z + distance);
    this.camera.lookAt(center);
  }

  reset(): void {
    this.fitCamera();
  }

  clear(): void {
    this.setHovered(undefined);
    for (const mesh of this.meshes) { mesh.geometry.dispose(); this.materials.get(mesh)?.dispose(); }
    for (const line of this.edgeLines) { line.geometry.dispose(); (line.material as THREE.Material).dispose(); }
    this.meshes.length = 0;
    this.edgeLines.length = 0;
    this.materials.clear();
    this.root.clear();
  }

  dispose(): void {
    this.clear();
    this.scene.clear();
  }
}
