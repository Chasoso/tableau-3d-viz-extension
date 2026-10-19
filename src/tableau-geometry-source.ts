import type { RawGeometryRow } from './geometry-model.js';

interface DataValueLike { value?: unknown; nativeValue?: unknown; formattedValue?: string; }
interface DataColumnLike { fieldName?: string; fieldId?: string; dataType?: string; index: number; }
interface DataTableLike { columns?: DataColumnLike[]; data?: DataValueLike[][]; }
interface ReaderLike { pageCount: number; getPageAsync(page: number): Promise<DataTableLike>; releaseAsync(): Promise<void>; }
interface WorksheetLike {
  getSummaryDataReaderAsync(pageSize: number): Promise<ReaderLike>;
}

export interface TableauGeometrySourceOptions {
  idFieldId?: string;
  elevationFieldId?: string;
}

function valueOf(cell: DataValueLike | undefined): unknown {
  return cell?.nativeValue ?? cell?.value ?? cell?.formattedValue;
}

export async function readTableauGeometryRows(
  worksheet: WorksheetLike,
  options: TableauGeometrySourceOptions = {}
): Promise<RawGeometryRow[]> {
  const reader = await worksheet.getSummaryDataReaderAsync(100);
  const pages: DataTableLike[] = [];
  try {
    for (let page = 0; page < reader.pageCount; page += 1) pages.push(await reader.getPageAsync(page));
  } finally {
    await reader.releaseAsync();
  }
  const first = pages[0];
  const columns = first?.columns ?? [];
  const rows = pages.flatMap((page) => page.data ?? []);
  const geometry = columns.find((column) => column.dataType === 'spatial');
  if (!geometry) throw new Error('No spatial Geometry column was returned by Tableau.');
  const id = columns.find((column) => column.fieldId === options.idFieldId) ?? columns.find((column) => /^(id|src id)$/i.test(column.fieldName ?? ''));
  const elevation = columns.find((column) => column.fieldId === options.elevationFieldId) ?? columns.find((column) => /^elevation$/i.test(column.fieldName ?? ''));
  if (!id) throw new Error('No ID field was returned by Tableau. Add the ID encoding or a field named id.');
  return rows.map((row, index) => ({
    id: String(valueOf(row[id.index]) ?? `row-${index + 1}`),
    geometry: valueOf(row[geometry.index]),
    elevation: elevation ? valueOf(row[elevation.index]) : undefined
  }));
}
