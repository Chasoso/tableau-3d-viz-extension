import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { zip } from '@mapbox/shp-write';

const geojson = JSON.parse(await readFile('test-data/geometry-fixture.geojson', 'utf8'));
const archive = await zip(geojson, {
  folder: 'geometry-fixture',
  types: { polygon: 'geometry-fixture', polyline: 'geometry-fixture', point: 'geometry-fixture' }
});

await mkdir('test-data/generated', { recursive: true });
await writeFile('test-data/generated/geometry-fixture.zip', Buffer.from(archive, 'base64'));
console.log('Wrote test-data/generated/geometry-fixture.zip (EPSG:4326).');
