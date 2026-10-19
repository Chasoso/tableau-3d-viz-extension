/// <reference types="@tableau/extensions-api-types" />
import {
  formatDiagnosticValue,
  sampleDataValue,
  truncate
} from './diagnostic-format.js';

type DataTableLike = {
  columns?: Array<{
    fieldName: string;
    fieldId: string;
    dataType: string;
    isReferenced: boolean;
    index: number;
  }>;
  data?: Array<Array<{
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

type DiagnosticResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'error'; error: string };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function capture<T>(operation: () => Promise<T>): Promise<DiagnosticResult<T>> {
  try {
    return { status: 'ok', value: await operation() };
  } catch (error) {
    return { status: 'error', error: errorText(error) };
  }
}

function summarizeTable(table: DataTableLike) {
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const rows = Array.isArray(table.data) ? table.data : [];
  const warnings = [];
  if (!Array.isArray(table.columns)) warnings.push('columns was not returned');
  if (!Array.isArray(table.data)) warnings.push('data was not returned');

  return {
    name: table.isSummaryData ? 'summary' : 'underlying',
    totalRowCount: table.totalRowCount,
    isTotalRowCountLimited: table.isTotalRowCountLimited ?? false,
    returnedKeys: Object.keys(table),
    warnings,
    columns: columns.map((column) => ({
      fieldName: column.fieldName,
      fieldId: column.fieldId,
      dataType: column.dataType,
      isReferenced: column.isReferenced,
      samples: rows.slice(0, 3).map((row) =>
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
      const page = await reader.getPageAsync(pageNumber);
      if (page) pages.push(page);
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
    columns: Array.isArray(first.columns) ? first.columns : [],
    data: pages.flatMap((page) => Array.isArray(page.data) ? page.data : []),
    totalRowCount: pages.reduce(
      (total, page) => total + (Array.isArray(page.data) ? page.data.length : 0),
      0
    ),
    isTotalRowCountLimited: pages.some((page) => page.isTotalRowCountLimited)
  };
}

async function collectDiagnostic() {
  const worksheetContent = tableau.extensions.worksheetContent;
  if (!worksheetContent) {
    throw new Error('The extension is not running as a Viz Extension worksheet.');
  }
  const worksheet = worksheetContent.worksheet;
  const visualSpecification = await capture(
    () => worksheet.getVisualSpecificationAsync()
  );
  const summary = await capture(async () => {
    const summaryReader = await worksheet.getSummaryDataReaderAsync(100);
    return summarizeTable(await readAllPages(summaryReader));
  });
  const underlyingTables = await capture(async () => {
    const logicalTables = await worksheet.getUnderlyingTablesAsync();
    if (!Array.isArray(logicalTables)) {
      throw new Error('getUnderlyingTablesAsync returned a non-array value.');
    }
    const tables = [];
    for (const logicalTable of logicalTables) {
      const reader = await worksheet.getUnderlyingTableDataReaderAsync(
        logicalTable.id,
        100,
        { includeAllColumns: true }
      );
      tables.push({
        logicalTableId: logicalTable.id,
        table: summarizeTable(await readAllPages(reader))
      });
    }
    return tables;
  });
  const dataSources = await capture(() => worksheet.getDataSourcesAsync());

  const visualSpecificationOutput = visualSpecification.status === 'error'
    ? visualSpecification
    : {
        status: 'ok' as const,
        activeMarksSpecificationIndex: visualSpecification.value.activeMarksSpecificationIndex,
        encodings: (Array.isArray(visualSpecification.value.marksSpecifications)
          ? visualSpecification.value.marksSpecifications
          : []).flatMap((marks) =>
          (Array.isArray(marks.encodings) ? marks.encodings : []).map((encoding) => ({
            id: encoding.id,
            type: formatDiagnosticValue(encoding.type),
            fieldName: encoding.field?.name,
            fieldId: encoding.field?.fieldId
          }))
        )
      };

  const dataSourcesOutput = dataSources.status === 'error'
    ? dataSources
    : {
        status: 'ok' as const,
        value: (Array.isArray(dataSources.value) ? dataSources.value : []).map((dataSource) => ({
          id: dataSource?.id,
          name: dataSource?.name,
          fields: Array.isArray(dataSource?.fields)
            ? dataSource.fields.map((field) => field?.name)
            : null,
          note: Array.isArray(dataSource?.fields)
            ? undefined
            : 'The API returned this data source without a fields array.'
        }))
      };

  return {
    collectedAt: new Date().toISOString(),
    note: 'Diagnostic output only. Geometry retrieval is not considered verified by this page.',
    visualSpecification: visualSpecificationOutput,
    dataSources: dataSourcesOutput,
    summary,
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
  void tableau.extensions.initializeAsync()
    .then(() => {
      const worksheet = tableau.extensions.worksheetContent?.worksheet;
      worksheet?.addEventListener(
        tableau.TableauEventType.SummaryDataChanged,
        () => void refresh()
      );
      return refresh();
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Initialization failed: ${message}`, true);
    });
});
