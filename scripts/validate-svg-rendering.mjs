import { readFile } from 'node:fs/promises';

const html = await readFile('diagnostics/svg-rendering.html', 'utf8');
const requiredFragments = [
  'id="viewport"',
  'id="fixture"',
  'id="height"',
  'id="crs"',
  'id="edges"',
  'id="quality"',
  'id="faceMode"',
  'id="materialMode"',
  'id="fillRule"',
  'id="sortElements"',
  'id="sortObjects"',
  'id="projection"',
  'Left drag rotate',
  'Right drag pan',
  'Wheel zoom',
  './svg-rendering.js'
];

for (const fragment of requiredFragments) {
  if (!html.includes(fragment)) throw new Error(`SVG rendering probe is missing: ${fragment}`);
}

if (!html.includes('NO WEBGL') || !html.includes('does not load Tableau API')) {
  throw new Error('SVG rendering probe must declare its standalone, non-WebGL scope.');
}

if (!html.includes('side-triangles') || !html.includes('side-separate-paths')) {
  throw new Error('SVG rendering probe must expose both side isolation modes.');
}

console.log('SVG rendering probe validation: OK');
