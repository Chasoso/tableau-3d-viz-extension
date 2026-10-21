import { readFile } from 'node:fs/promises';

const html = await readFile('diagnostics/rendering.html', 'utf8');
const requiredFragments = [
  'id="canvas-2d"',
  'id="webgl-1"',
  'id="webgl-2"',
  'id="svg-output"',
  'getContext("2d")',
  'getContext(contextName',
  'webglcontextcreationerror',
  'navigator.userAgent',
  'Copy JSON report',
  'Download JSON report'
];

for (const fragment of requiredFragments) {
  if (!html.includes(fragment)) throw new Error(`Rendering diagnostic is missing: ${fragment}`);
}

if (/<script\s+[^>]*src\s*=/i.test(html) || /tableau\.extensions|from ['"]three|fetch\s*\(/i.test(html)) {
  throw new Error('Rendering diagnostic must not depend on Tableau API, Three.js, or network fetches.');
}

console.log('Rendering diagnostic validation: OK');
