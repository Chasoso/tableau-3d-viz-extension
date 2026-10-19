import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { zip } from '@mapbox/shp-write';

const geojson = JSON.parse(await readFile('test-data/geometry-fixture.geojson', 'utf8'));
// A Shapefile has one homogeneous shape type. Normalize Polygon features to
// single-part MultiPolygon geometries before writing so all three fixture
// records are preserved in the generated polygon layer.
const shapefileGeojson = {
  ...geojson,
  features: geojson.features.map((feature) =>
    feature.geometry.type === 'Polygon'
      ? {
          ...feature,
          geometry: {
            type: 'MultiPolygon',
            coordinates: [feature.geometry.coordinates]
          }
        }
      : feature
  )
};

const archive = await zip(shapefileGeojson, {
  folder: 'geometry-fixture',
  types: { polygon: 'geometry-fixture' }
});

await mkdir('test-data/generated', { recursive: true });
await writeFile('test-data/generated/geometry-fixture.zip', Buffer.from(archive, 'base64'));
console.log('Wrote test-data/generated/geometry-fixture.zip (EPSG:4326).');
