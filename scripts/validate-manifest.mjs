import { readFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';

const manifest = await readFile('extension/geometry-diagnostic.trex', 'utf8');
const parsed = new XMLParser({ ignoreAttributes: false }).parse(manifest);
const extension = parsed.manifest['worksheet-extension'];
const url = extension['source-location'].url;
const encodings = Array.isArray(extension.encoding) ? extension.encoding : [extension.encoding];

if (!manifest.startsWith('<?xml version="1.0" encoding="utf-8"?>')) {
  throw new Error('The XML declaration must be the first content in the manifest.');
}
if (!extension || !extension['@_id'] || !extension['@_extension-version']) {
  throw new Error('worksheet-extension id and extension-version are required.');
}
if (url !== 'http://localhost:8765/extension/geometry-diagnostic.html') {
  throw new Error(`Unexpected source location: ${url}`);
}
if (!encodings.some((encoding) => encoding['@_id'] === 'id') ||
    !encodings.some((encoding) => encoding['@_id'] === 'elevation')) {
  throw new Error('Expected id and elevation encodings.');
}
console.log('Manifest validation: OK');
