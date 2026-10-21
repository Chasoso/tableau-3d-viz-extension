import * as THREE from 'three';

export interface WebGLRendererLike {
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}

export type WebGLRendererFactory = (parameters: THREE.WebGLRendererParameters) => WebGLRendererLike;

export interface WebGLRendererInitialization {
  renderer?: WebGLRendererLike;
  error?: unknown;
}

const defaultFactory: WebGLRendererFactory = (parameters) => new THREE.WebGLRenderer(parameters);

export function initializeWebGLRenderer(
  canvas: HTMLCanvasElement,
  pixelRatio: number,
  factory: WebGLRendererFactory = defaultFactory
): WebGLRendererInitialization {
  let renderer: WebGLRendererLike | undefined;
  try {
    renderer = factory({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(pixelRatio);
    return { renderer };
  } catch (error) {
    try { renderer?.dispose(); } catch { /* keep the original initialization error */ }
    return { error };
  }
}

export function formatWebGLInitializationError(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error ?? 'unknown error');
  return `WebGL is unavailable. The 3D view could not start because WebGLRenderer initialization failed. ${detail}`;
}
