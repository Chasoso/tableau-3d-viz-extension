import * as THREE from 'three';

export interface CameraFitSource {
  fitCamera(): THREE.Vector3;
}

export interface CameraControlsLike {
  target: THREE.Vector3;
  update(): boolean | void;
  saveState(): void;
  reset(): void;
}

export function fitCameraAndSaveTarget(source: CameraFitSource, controls: CameraControlsLike): THREE.Vector3 {
  const center = source.fitCamera();
  controls.target.copy(center);
  controls.update();
  controls.saveState();
  return center;
}

export function resetCamera(controls: CameraControlsLike): void {
  controls.reset();
  controls.update();
}
