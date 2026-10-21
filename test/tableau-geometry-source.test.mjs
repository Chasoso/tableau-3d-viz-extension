import test from 'node:test';
import assert from 'node:assert/strict';
import { readTableauGeometryRows } from '../extension/tableau-geometry-source.js';

function worksheetWithRows(data) {
  let released = 0;
  return {
    released: () => released,
    getSummaryDataReaderAsync: async () => ({
      pageCount: 1,
      getPageAsync: async () => ({
        columns: [
          { fieldName: 'Id', fieldId: 'id', dataType: 'string', index: 0 },
          { fieldName: 'Geometry', fieldId: 'geometry', dataType: 'spatial', index: 1 },
          { fieldName: 'Elevation', fieldId: 'elevation', dataType: 'float', index: 2 }
        ],
        data
      }),
      releaseAsync: async () => { released += 1; }
    })
  };
}

test('reads a row with an explicit ID and releases the Tableau reader', async () => {
  const worksheet = worksheetWithRows([[{ value: 'feature-1' }, { value: 'POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))' }, { value: 0 }]]);
  const rows = await readTableauGeometryRows(worksheet);
  assert.equal(rows[0].id, 'feature-1');
  assert.equal(rows[0].elevation, 0);
  assert.equal(worksheet.released(), 1);
});

test('rejects a missing ID value instead of inventing a row ID', async () => {
  const worksheet = worksheetWithRows([[{ value: '  ' }, { value: 'POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))' }, { value: 2 }]]);
  await assert.rejects(() => readTableauGeometryRows(worksheet), /has no ID value/);
  assert.equal(worksheet.released(), 1);
});
