export type Position = readonly [number, number];
export type Ring = readonly Position[];
export type PolygonRings = readonly Ring[];

export type SourceCoordinateSystem = 'EPSG:4326' | 'cartesian';

export type GeometryShape =
  | { type: 'Polygon'; rings: PolygonRings }
  | { type: 'MultiPolygon'; rings: readonly PolygonRings[] };

export interface RawGeometryRow {
  id: string;
  geometry: unknown;
  elevation?: unknown;
}

export interface RenderFeature {
  id: string;
  geometry: GeometryShape;
  elevation: number;
}

export interface NormalizedGeometry {
  coordinateSystem: 'local-meters';
  origin: { latitude?: number; longitude?: number };
  features: readonly RenderFeature[];
  warnings: readonly string[];
}

export interface GeometryAdapterOptions {
  sourceCoordinateSystem: SourceCoordinateSystem;
  elevationUnit: 'meters';
}
