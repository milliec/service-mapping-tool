import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { type ImportResult } from '../types';
import { validateHeaders, normalizeHeaders } from './validate';
import { normalizeImportRows, normalizeMuralExport, normalizeSwimlaneMatrix, detectFormat, normalizeMultiTabBlueprint } from './normalize';

export interface SheetInfo {
  name: string;
  rowCount: number;
}

export interface ParsedFile {
  sheets: SheetInfo[];
  selectedSheet: string;
  headers: string[];
  rows: Record<string, string>[];
  format: 'template' | 'mural' | 'swimlane' | 'unknown';
}

function xlsxSheetToRows(ws: XLSX.WorkSheet): { headers: string[]; rows: Record<string, string>[] } {
  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
  if (raw.length === 0) return { headers: [], rows: [] };

  const seenKeys = new Set<string>();
  const headers = raw[0].map((h, i) => {
    const trimmed = String(h).trim();
    if (!trimmed) return `_col_${i}`;
    if (seenKeys.has(trimmed.toLowerCase().replace(/\s+/g, '_'))) return `${trimmed}_${i}`;
    seenKeys.add(trimmed.toLowerCase().replace(/\s+/g, '_'));
    return trimmed;
  });

  const rows = raw.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h.toLowerCase().trim().replace(/\s+/g, '_')] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '';
    });
    return obj;
  });

  return { headers, rows };
}

export function parseXlsx(buffer: ArrayBuffer, fileName: string): { sheets: SheetInfo[]; workbook: XLSX.WorkBook } {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheets: SheetInfo[] = wb.SheetNames
    .filter((name) => {
      const ws = wb.Sheets[name];
      return ws['!ref'] !== undefined;
    })
    .map((name) => {
      const ws = wb.Sheets[name];
      const range = XLSX.utils.decode_range(ws['!ref']!);
      return { name, rowCount: range.e.r + 1 };
    });

  return { sheets, workbook: wb };
}

export function processXlsxSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  fileName: string,
): ImportResult {
  const ws = workbook.Sheets[sheetName];
  if (!ws) {
    return {
      state: { blueprint: { id: '', serviceName: '', description: '', createdAt: '', updatedAt: '' }, stages: [], steps: [], lanes: [], childBlueprints: [], rootDocument: null, activeBlueprintId: '', rootBlueprintId: '', cards: [], storyboardImages: [], storyboardVisible: true, storyboardCollapsed: false, cardLinks: [], evidence: [], opportunities: [], solutions: [], assumptions: [], strategicGoals: [], outcomes: [], systemOutcomes: [], behaviourOutcomes: [], serviceOutcomes: [], stepLinks: [], requirements: [], apiContracts: [], uiScaffolds: [], traceabilityCounters: {} },
      errors: [{ row: 0, field: 'sheet', message: `Sheet "${sheetName}" not found` }],
      warnings: [],
    };
  }

  const { headers, rows } = xlsxSheetToRows(ws);
  if (headers.length === 0) {
    return {
      state: { blueprint: { id: '', serviceName: '', description: '', createdAt: '', updatedAt: '' }, stages: [], steps: [], lanes: [], childBlueprints: [], rootDocument: null, activeBlueprintId: '', rootBlueprintId: '', cards: [], storyboardImages: [], storyboardVisible: true, storyboardCollapsed: false, cardLinks: [], evidence: [], opportunities: [], solutions: [], assumptions: [], strategicGoals: [], outcomes: [], systemOutcomes: [], behaviourOutcomes: [], serviceOutcomes: [], stepLinks: [], requirements: [], apiContracts: [], uiScaffolds: [], traceabilityCounters: {} },
      errors: [{ row: 0, field: 'headers', message: 'No headers found in sheet' }],
      warnings: [],
    };
  }

  const format = detectFormat(headers, rows);

  if (format === 'mural') {
    return normalizeMuralExport(rows, fileName, sheetName);
  }

  if (format === 'swimlane') {
    return normalizeSwimlaneMatrix(headers, rows, fileName, sheetName);
  }

  if (format === 'template') {
    const normalizedHeaders = normalizeHeaders(headers);
    const headerErrors = validateHeaders(normalizedHeaders);
    if (headerErrors.length > 0) {
      return {
        state: { blueprint: { id: '', serviceName: '', description: '', createdAt: '', updatedAt: '' }, stages: [], steps: [], lanes: [], childBlueprints: [], rootDocument: null, activeBlueprintId: '', rootBlueprintId: '', cards: [], storyboardImages: [], storyboardVisible: true, storyboardCollapsed: false, cardLinks: [], evidence: [], opportunities: [], solutions: [], assumptions: [], strategicGoals: [], outcomes: [], systemOutcomes: [], behaviourOutcomes: [], serviceOutcomes: [], stepLinks: [], requirements: [], apiContracts: [], uiScaffolds: [], traceabilityCounters: {} },
        errors: headerErrors,
        warnings: [],
      };
    }
    // Re-map rows to normalized headers
    const normalizedRows = rows.map((row) => {
      const mapped: Record<string, string> = {};
      headers.forEach((h, i) => {
        const nk = normalizedHeaders[i];
        const origKey = h.toLowerCase().trim().replace(/\s+/g, '_');
        mapped[nk] = row[origKey] || '';
      });
      return mapped;
    });
    return normalizeImportRows(normalizedRows, fileName, sheetName);
  }

  return {
    state: { blueprint: { id: '', serviceName: '', description: '', createdAt: '', updatedAt: '' }, stages: [], steps: [], lanes: [], childBlueprints: [], rootDocument: null, activeBlueprintId: '', rootBlueprintId: '', cards: [], storyboardImages: [], storyboardVisible: true, storyboardCollapsed: false, cardLinks: [], evidence: [], opportunities: [], solutions: [], assumptions: [], strategicGoals: [], outcomes: [], systemOutcomes: [], behaviourOutcomes: [], serviceOutcomes: [], stepLinks: [], requirements: [], apiContracts: [], uiScaffolds: [], traceabilityCounters: {} },
    errors: [{ row: 0, field: 'format', message: 'Unrecognized spreadsheet format. Expected template (record_type, lane_key) or Mural export (Swim Lane Label, Stage Label) columns.' }],
    warnings: [],
  };
}

export function parseCsv(text: string, fileName: string): ImportResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.toLowerCase().trim().replace(/\s+/g, '_'),
  });

  if (result.errors.length > 0) {
    return {
      state: { blueprint: { id: '', serviceName: '', description: '', createdAt: '', updatedAt: '' }, stages: [], steps: [], lanes: [], childBlueprints: [], rootDocument: null, activeBlueprintId: '', rootBlueprintId: '', cards: [], storyboardImages: [], storyboardVisible: true, storyboardCollapsed: false, cardLinks: [], evidence: [], opportunities: [], solutions: [], assumptions: [], strategicGoals: [], outcomes: [], systemOutcomes: [], behaviourOutcomes: [], serviceOutcomes: [], stepLinks: [], requirements: [], apiContracts: [], uiScaffolds: [], traceabilityCounters: {} },
      errors: result.errors.map((e, i) => ({ row: e.row ?? i, field: 'csv', message: e.message })),
      warnings: [],
    };
  }

  const headers = result.meta.fields || [];
  const format = detectFormat(headers, result.data);

  if (format === 'mural') {
    return normalizeMuralExport(result.data, fileName, 'CSV');
  }

  if (format === 'swimlane') {
    return normalizeSwimlaneMatrix(headers, result.data, fileName, 'CSV');
  }

  const headerErrors = validateHeaders(headers);
  if (headerErrors.length > 0) {
    return {
      state: { blueprint: { id: '', serviceName: '', description: '', createdAt: '', updatedAt: '' }, stages: [], steps: [], lanes: [], childBlueprints: [], rootDocument: null, activeBlueprintId: '', rootBlueprintId: '', cards: [], storyboardImages: [], storyboardVisible: true, storyboardCollapsed: false, cardLinks: [], evidence: [], opportunities: [], solutions: [], assumptions: [], strategicGoals: [], outcomes: [], systemOutcomes: [], behaviourOutcomes: [], serviceOutcomes: [], stepLinks: [], requirements: [], apiContracts: [], uiScaffolds: [], traceabilityCounters: {} },
      errors: headerErrors,
      warnings: [],
    };
  }

  return normalizeImportRows(result.data, fileName, 'CSV');
}

/**
 * Processes all tabs of a structured multi-tab workbook
 * (Service / Stages / Actors / Business Rules / Blueprint) into a single ImportResult.
 */
export function processMultiTabWorkbook(workbook: XLSX.WorkBook, fileName: string): ImportResult {
  return normalizeMultiTabBlueprint(workbook, fileName);
}
