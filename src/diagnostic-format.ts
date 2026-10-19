export interface DiagnosticSample {
  type: string;
  value: string;
  nativeValue: string;
}

export function formatDiagnosticValue(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
  return String(value);
}

export function sampleDataValue(dataValue: {
  value?: unknown;
  nativeValue?: unknown;
  formattedValue?: string;
}): DiagnosticSample {
  const value = dataValue.value;
  const nativeValue = dataValue.nativeValue;
  return {
    type: typeof nativeValue === 'object' && nativeValue !== null
      ? Object.prototype.toString.call(nativeValue)
      : typeof nativeValue,
    value: formatDiagnosticValue(value),
    nativeValue: formatDiagnosticValue(nativeValue ?? dataValue.formattedValue)
  };
}

export function truncate(text: string, maxLength = 500): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
}
