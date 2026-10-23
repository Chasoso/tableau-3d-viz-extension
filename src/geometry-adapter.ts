import type {
  GeometryAdapterOptions,
  GeometryShape,
  NormalizedGeometry,
  PolygonRings,
  Position,
  RawGeometryRow,
  RenderFeature
} from './geometry-model.js';

const EARTH_RADIUS_METERS = 6_378_137;

class GeometryInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeometryInputError';
  }
}

function unwrapGeography(value: unknown): string {
  if (typeof value !== 'string') {
    throw new GeometryInputError(`Geometry value must be a string, received ${typeof value}.`);
  }
  const trimmed = value.trim();
  const geography = /^GEOGRAPHY\(\s*'([\s\S]*)'\s*\)$/i.exec(trimmed);
  if (geography) return geography[1];
  if (/^(?:MULTI)?POLYGON\b/i.test(trimmed)) return trimmed;
  throw new GeometryInputError('Unsupported Geometry value. Expected observed GEOGRAPHY(POLYGON ...) or GEOGRAPHY(MULTIPOLYGON ...) format.');
}

function tokenizeWkt(text: string): string[] {
  const tokens: string[] = [];
  const pattern = /\s*(\(|\)|,|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)/gy;
  let index = 0;
  while (index < text.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(text);
    if (!match) throw new GeometryInputError(`Invalid WKT near offset ${index}.`);
    tokens.push(match[1]);
    index = pattern.lastIndex;
  }
  return tokens;
}

function parseRing(tokens: readonly string[], start: number): { ring: Position[]; next: number } {
  if (tokens[start] !== '(') throw new GeometryInputError('Expected a ring in WKT.');
  const ring: Position[] = [];
  let index = start + 1;
  while (index < tokens.length && tokens[index] !== ')') {
    const x = Number(tokens[index]);
    const y = Number(tokens[index + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new GeometryInputError('WKT contains a non-finite coordinate.');
    if (tokens[index + 2] !== ',' && tokens[index + 2] !== ')') {
      throw new GeometryInputError('Only two-dimensional coordinate pairs are supported.');
    }
    ring.push([x, y]);
    index += 2;
    if (tokens[index] === ',') index += 1;
  }
  if (tokens[index] !== ')') throw new GeometryInputError('Unclosed polygon ring in WKT.');
  if (ring.length < 4) throw new GeometryInputError('A polygon ring must contain at least four positions.');
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw new GeometryInputError('Polygon rings must be closed.');
  }
  let twiceArea = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    twiceArea += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }
  if (twiceArea === 0) throw new GeometryInputError('Polygon rings must enclose a non-zero area.');
  return { ring, next: index + 1 };
}

function parsePolygon(tokens: readonly string[], start: number): { rings: PolygonRings; next: number } {
  if (tokens[start] !== '(') throw new GeometryInputError('Expected a polygon in WKT.');
  const rings: Position[][] = [];
  let index = start + 1;
  while (tokens[index] === '(') {
    const parsed = parseRing(tokens, index);
    rings.push(parsed.ring);
    index = parsed.next;
    if (tokens[index] === ',') index += 1;
  }
  if (tokens[index] !== ')') throw new GeometryInputError('Unclosed polygon in WKT.');
  if (rings.length === 0) throw new GeometryInputError('Polygon must contain an outer ring.');
  return { rings, next: index + 1 };
}

export function parseObservedGeometry(value: unknown): GeometryShape {
  const wkt = unwrapGeography(value);
  const header = /^(POLYGON|MULTIPOLYGON)\s*/i.exec(wkt);
  if (!header) throw new GeometryInputError('Unsupported WKT geometry type.');
  const tokens = tokenizeWkt(wkt.slice(header[0].length));
  if (header[1].toUpperCase() === 'POLYGON') {
    const parsed = parsePolygon(tokens, 0);
    if (parsed.next !== tokens.length) throw new GeometryInputError('Unexpected tokens after WKT geometry.');
    return { type: 'Polygon', rings: parsed.rings };
  }
  if (tokens[0] !== '(') throw new GeometryInputError('Expected a MultiPolygon in WKT.');
  const rings: PolygonRings[] = [];
  let index = 1;
  while (tokens[index] === '(') {
    const parsed = parsePolygon(tokens, index);
    rings.push(parsed.rings);
    index = parsed.next;
    if (tokens[index] === ',') index += 1;
  }
  if (tokens[index] !== ')' || index + 1 !== tokens.length) throw new GeometryInputError('Invalid MultiPolygon WKT.');
  if (rings.length === 0) throw new GeometryInputError('MultiPolygon must contain at least one polygon.');
  return { type: 'MultiPolygon', rings };
}

function collectPositions(shape: GeometryShape): Position[] {
  return shape.type === 'Polygon'
    ? shape.rings.flat()
    : shape.rings.flat(2);
}

function mapShape(shape: GeometryShape, map: (position: Position) => Position): GeometryShape {
  if (shape.type === 'Polygon') {
    return { type: 'Polygon', rings: shape.rings.map((ring) => ring.map(map)) };
  }
  return { type: 'MultiPolygon', rings: shape.rings.map((polygon) => polygon.map((ring) => ring.map(map))) };
}

function toLocalMeters(shape: GeometryShape, origin: Position, source: GeometryAdapterOptions['sourceCoordinateSystem']): GeometryShape {
  if (source === 'cartesian') {
    return mapShape(shape, ([x, y]) => [x - origin[0], y - origin[1]]);
  }
  const [originLongitude, originLatitude] = origin;
  const latitudeScale = Math.cos(originLatitude * Math.PI / 180);
  return mapShape(shape, ([longitude, latitude]) => [
    (longitude - originLongitude) * Math.PI / 180 * EARTH_RADIUS_METERS * latitudeScale,
    (latitude - originLatitude) * Math.PI / 180 * EARTH_RADIUS_METERS
  ]);
}

export function normalizeGeometryRows(
  rows: readonly RawGeometryRow[],
  options: GeometryAdapterOptions
): NormalizedGeometry {
  if (options.elevationUnit !== 'meters') {
    throw new GeometryInputError('Elevation must be explicitly supplied in meters.');
  }
  if (rows.length === 0) return { coordinateSystem: 'local-meters', origin: {}, features: [], warnings: [] };

  let hasMissingElevation = false;
  const parsed = rows.map((row, index) => {
    const id = String(row.id ?? '').trim();
    if (!id) throw new GeometryInputError(`Row ${index + 1} has no id.`);
    const geometry = parseObservedGeometry(row.geometry);
    let elevation: number;
    if (row.elevation === undefined || row.elevation === null || (typeof row.elevation === 'string' && row.elevation.trim() === '')) {
      elevation = 0;
      hasMissingElevation = true;
    } else if (typeof row.elevation === 'number') {
      elevation = row.elevation;
    } else if (typeof row.elevation === 'string') {
      elevation = Number(row.elevation.trim());
    } else {
      throw new GeometryInputError(`Row ${index + 1} has an invalid elevation type.`);
    }
    if (!Number.isFinite(elevation)) throw new GeometryInputError(`Row ${index + 1} has a non-numeric elevation.`);
    return { id, geometry, elevation };
  });

  const allPositions = parsed.flatMap((row) => collectPositions(row.geometry));
  const origin: Position = options.sourceCoordinateSystem === 'cartesian'
    ? [allPositions.reduce((sum, position) => sum + position[0], 0) / allPositions.length, allPositions.reduce((sum, position) => sum + position[1], 0) / allPositions.length]
    : [allPositions.reduce((sum, position) => sum + position[0], 0) / allPositions.length, allPositions.reduce((sum, position) => sum + position[1], 0) / allPositions.length];
  const features: RenderFeature[] = parsed.map((row) => ({
    id: row.id,
    geometry: toLocalMeters(row.geometry, origin, options.sourceCoordinateSystem),
    elevation: row.elevation
  }));

  return {
    coordinateSystem: 'local-meters',
    origin: options.sourceCoordinateSystem === 'EPSG:4326'
      ? { longitude: origin[0], latitude: origin[1] }
      : {},
    features,
    warnings: hasMissingElevation ? ['Missing elevation values were rendered at zero meters.'] : []
  };
}
