import { readFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';

for (const [manifestPath, scriptPath, expectedUrl] of [
  ['extension/geometry-diagnostic.trex', 'extension/geometry-diagnostic.js', 'http://localhost:8765/extension/geometry-diagnostic.html'],
  ['extension/geometry-3d.trex', 'extension/geometry-extension.js', 'http://localhost:8765/extension/geometry-3d.html']
]) {
  const manifest = await readFile(manifestPath, 'utf8');
  const compiledScript = await readFile(scriptPath, 'utf8');
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(manifest);
  const extension = parsed.manifest['worksheet-extension'];
  const url = extension['source-location'].url;
  const encodings = Array.isArray(extension.encoding) ? extension.encoding : [extension.encoding];

  if (!manifest.startsWith('<?xml version="1.0" encoding="utf-8"?>')) {
    throw new Error(`The XML declaration must be the first content in ${manifestPath}.`);
  }
  if (!extension || !extension['@_id'] || !extension['@_extension-version']) {
    throw new Error(`worksheet-extension id and extension-version are required in ${manifestPath}.`);
  }
  if (compiledScript.includes('require(')) {
    throw new Error(`The browser bundle must not contain CommonJS require(): ${scriptPath}`);
  }
  if (!extension.author?.['@_name'] || !extension.author?.['@_email'] || !extension.author?.['@_website']) {
    throw new Error(`author name, email, and website are required in ${manifestPath}.`);
  }
  if (url !== expectedUrl) throw new Error(`Unexpected source location in ${manifestPath}: ${url}`);
  if (!encodings.some((encoding) => encoding['@_id'] === 'id') ||
      !encodings.some((encoding) => encoding['@_id'] === 'elevation')) {
    throw new Error(`Expected id and elevation encodings in ${manifestPath}.`);
  }
}
console.log('Manifest validation: OK');
