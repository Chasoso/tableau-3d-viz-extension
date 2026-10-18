/// <reference types="@tableau/extensions-api-types" />
import {
  formatDiagnosticValue,
  sampleDataValue,
  truncate
} from './diagnostic-format.js';

type DataTableLike = {
  columns: Array<{
    fieldName: string;
    fieldId: string;
    dataType: string;
    isReferenced: boolean;
    index: number;
  }>;
  data: Array<Array<{
    value?: unknown;
    nativeValue?: unknown;
    formattedValue?: string;
  }>>;
  totalRowCount: number;
  isTotalRowCountLimited?: boolean;
  isSummaryData?: boolean;
};

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as T;
}

function setStatus(message: string, isError = false): void {
  const status = element<HTMLParagraphElement>('status');
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'ok';
}

function summarizeTable(table: DataTableLike) {
  return {
    name: table.isSummaryData ? 'summary' : 'underlying',
    totalRowCount: table.totalRowCount,
    isTotalRowCountLimited: table.isTotalRowCountLimited ?? false,
    columns: table.columns.map((column) => ({
      fieldName: column.fieldName,
      fieldId: column.fieldId,
      dataType: column.dataType,
      isReferenced: column.isReferenced,
      samples: table.data.slice(0, 3).map((row) =>
        sampleDataValue(row[column.index])
      )
    }))
  };
}

async function readAllPages(reader: {
  pageCount: number;
  getPageAsync(pageNumber: number): Promise<DataTableLike>;
  releaseAsync(): Promise<void>;
}): Promise<DataTableLike> {
  const pages: DataTableLike[] = [];
  try {
    for (let pageNumber = 0; pageNumber < reader.pageCount; pageNumber += 1) {
      pages.push(await reader.getPageAsync(pageNumber));
    }
  } finally {
    await reader.releaseAsync();
  }

  const first = pages[0];
  if (!first) {
    return {
      columns: [],
      data: [],
      totalRowCount: 0,
      isSummaryData: false
    };
  }
  return {
    ...first,
    data: pages.flatMap((page) => page.data),
    totalRowCount: pages.reduce((total, page) => total + page.data.length, 0),
    isTotalRowCountLimited: pages.some((page) => page.isTotalRowCountLimited)
  };
}

async function collectDiagnostic() {
  const worksheetContent = tableau.extensions.worksheetContent;
  if (!worksheetContent) {
    throw new Error('The extension is not running as a Viz Extension worksheet.');
  }
  const worksheet = worksheetContent.worksheet;
  const visualSpecification = await worksheet.getVisualSpecificationAsync();
  const summaryReader = await worksheet.getSummaryDataReaderAsync(100);
  const summaryTable = await readAllPages(summaryReader);
  const logicalTables = await worksheet.getUnderlyingTablesAsync();
  const underlyingTables = [];

  for (const logicalTable of logicalTables) {
    const reader = await worksheet.getUnderlyingTableDataReaderAsync(
      logicalTable.id,
      100,
      { includeAllColumns: true }
    );
    underlyingTables.push({
      logicalTableId: logicalTable.id,
      table: summarizeTable(await readAllPages(reader))
    });
  }

  const dataSources = await worksheet.getDataSourcesAsync();
  return {
    collectedAt: new Date().toISOString(),
    note: 'Diagnostic output only. Geometry retrieval is not considered verified by this page.',
    visualSpecification: {
      activeMarksSpecificationIndex: visualSpecification.activeMarksSpecificationIndex,
      encodings: visualSpecification.marksSpecifications.flatMap((marks) =>
        marks.encodings.map((encoding) => ({
          id: encoding.id,
          type: formatDiagnosticValue(encoding.type),
          fieldName: encoding.field.name,
          fieldId: encoding.field.fieldId
        }))
      )
    },
    dataSources: dataSources.map((dataSource) => ({
      id: dataSource.id,
      name: dataSource.name,
      fields: dataSource.fields.map((field) => field.name)
    })),
    summary: summarizeTable(summaryTable),
    underlyingTables
  };
}

function render(result: unknown): void {
  const output = element<HTMLPreElement>('output');
  output.textContent = JSON.stringify(result, null, 2);
  const spatialColumns = JSON.stringify(result).match(/"dataType": "spatial"/g)?.length ?? 0;
  element<HTMLParagraphElement>('spatial-count').textContent =
    `Detected spatial columns in the returned metadata: ${spatialColumns}. This is observation only.`;
}

async function refresh(): Promise<void> {
  setStatus('Reading worksheet data…');
  try {
    render(await collectDiagnostic());
    setStatus('Completed. Save the JSON evidence before changing the worksheet.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Diagnostic failed: ${message}`, true);
    element<HTMLPreElement>('output').textContent = truncate(message, 2000);
  }
}

window.addEventListener('load', () => {
  element<HTMLButtonElement>('refresh').addEventListener('click', () => {
    void refresh();
  });
  if (typeof tableau === 'undefined' || !tableau.extensions) {
    setStatus('Tableau Extensions API library was not loaded.', true);
    return;
  }
  void tableau.extensions.initializeAsync().then(refresh).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Initialization failed: ${message}`, true);
  });
});
