/**
 * extract.ts
 *
 * Low-level extraction layer: parse raw source files/text into a normalised
 * intermediate format (ExtractedRow[]) that preserves full provenance before
 * any AI mapping or schema normalisation happens.
 *
 * Supported sources:
 *   - CSV (via Papa Parse)
 *   - XLSX / XLS (via SheetJS workbook already parsed by parseXlsx)
 *   - Pasted tabular text (tab- or comma-delimited)
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { LANE_KEYS, type LaneKey } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SourceType = 'csv' | 'xlsx' | 'pasted_text' | 'pdf_extracted';

/**
 * One row of raw source data, with full provenance.
 * This is the input to the AI mapping stage and to the review UI.
 */
export interface ExtractedRow {
  /** Where this row came from */
  sourceType: SourceType;
  /** Original file name or "pasted" */
  sourceFileName: string;
  /** Sheet name, page label, or "CSV" / "Pasted text" */
  sourceSheetOrPage: string;
  /** 1-indexed row number in the original source (header = 1) */
  sourceRowNumber: number;
  /** Column headers from the source */
  extractedHeaders: string[];
  /** Cell values keyed by header */
  extractedCells: Record<string, string>;
  /** Tab-joined raw text representation of the row (for quick preview) */
  rawText: string;
}

export interface ExtractionResult {
  rows: ExtractedRow[];
  headers: string[];
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export function extractFromCsv(text: string, fileName: string): ExtractionResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = result.meta.fields ?? [];
  const errors: string[] = result.errors.map((e) => e.message);

  const rows: ExtractedRow[] = result.data.map((row, i) => ({
    sourceType: 'csv',
    sourceFileName: fileName,
    sourceSheetOrPage: 'CSV',
    sourceRowNumber: i + 2, // header = row 1
    extractedHeaders: headers,
    extractedCells: Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, String(v ?? '').trim()]),
    ),
    rawText: headers.map((h) => String(row[h] ?? '')).join('\t'),
  }));

  return { rows, headers, errors, warnings: [] };
}

// ---------------------------------------------------------------------------
// XLSX (uses a workbook already parsed by parseXlsx in parse.ts)
// ---------------------------------------------------------------------------

const SWIMLANE_LANE_ALIASES: Record<string, LaneKey> = {
  user_action: 'user_action_event',
  actors: 'actor',
  primary_actor: 'actor',
  primary_actors: 'actor',
  secondary_actor: 'actor',
  secondary_actors: 'actor',
  user_needs: 'user_need',
  // Plural → singular so frontstage content lands in its own lane (not merged into user_action_event)
  frontstage_touchpoints: 'frontstage_touchpoint',
  business_rule_refs: 'business_rule',
  business_rules: 'business_rule',
  data_in: 'data_input',
  data_out: 'data_output',
  backstage_actors: 'backstage_actor',
  desired_behaviour_change: 'behaviour_change',
  desired_behaviour: 'behaviour_change',
  what_good_looks_like: 'behaviour_change',
  target_behaviour: 'behaviour_change',
  activities: 'activity',
  user_activity: 'activity',
  user_activities: 'activity',
  user_task: 'activity',
  user_tasks: 'activity',
  tasks: 'activity',
  // L3 displays the system lane as "Shared capabilities"
  shared_capabilities: 'system',
  // L1 Macro aliases
  pain_points: 'pain_point',
};

function normalizeKey(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, '_');
}

function isL1LikeSheetName(sourceSheet?: string): boolean {
  return /^(lifecycle|blueprint|l1|l1_macro|l1-macro)$/i.test(sourceSheet?.trim() ?? '');
}

function isExplicitL1SheetName(sourceSheet?: string): boolean {
  return /^(lifecycle|l1|l1_macro|l1-macro)$/i.test(sourceSheet?.trim() ?? '');
}

function isL1MacroSwimlaneLabel(label: string): boolean {
  return [
    'phase',
    'policy_reform',
    'policy_outcome',
    'user_outcome',
    'operational_outcome',
    'insights',
    'impact_of_pain_points',
    'performance_indicators',
    'opportunities_lane',
  ].includes(label);
}

function resolveSwimlaneLaneKey(label: string, sourceSheet?: string, isL1MacroContext = false): LaneKey {
  if ((isL1LikeSheetName(sourceSheet) || isL1MacroContext) && (label === 'success_measure' || label === 'success_measures')) {
    return 'performance_indicators';
  }
  if ((isExplicitL1SheetName(sourceSheet) || isL1MacroContext) && (label === 'ideas' || label === 'opportunities' || label === 'opportunities_lane')) {
    return 'opportunities_lane';
  }
  return (SWIMLANE_LANE_ALIASES[label] ?? label) as LaneKey;
}

function splitCellItems(cell: string): string[] {
  if (!cell.trim()) return [];
  return cell
    .split(/\r?\n/)
    .flatMap((line) => line.split(';'))
    .map((segment) => segment.replace(/^[-\u2022*\s]+/, '').trim())
    .filter(Boolean);
}

function getSwimlaneSourceTags(label: string): string[] {
  switch (label) {
    case 'primary_actor':
    case 'primary_actors':
      return ['primary'];
    case 'secondary_actors':
      return ['secondary'];
    default:
      return [];
  }
}

function getIndefiniteArticle(label: string): 'a' | 'an' {
  return /^[aeiou]/i.test(label.trim()) ? 'an' : 'a';
}

function capitalizeSentenceStart(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const firstLetterIndex = trimmed.search(/[A-Za-z]/);
  if (firstLetterIndex === -1) return trimmed;

  return `${trimmed.slice(0, firstLetterIndex)}${trimmed[firstLetterIndex].toUpperCase()}${trimmed.slice(firstLetterIndex + 1)}`;
}

function qualifyUserNeedWithActor(text: string, actorLabel: string): string {
  const trimmedText = text.trim();
  const trimmedActor = actorLabel.trim();
  if (!trimmedText || !trimmedActor) return trimmedText;
  if (/^as\s+(a|an|the)\b/i.test(trimmedText)) return trimmedText;
  const article = getIndefiniteArticle(trimmedActor);
  return capitalizeSentenceStart(`As ${article} ${trimmedActor}, ${trimmedText.charAt(0).toLowerCase()}${trimmedText.slice(1)}`);
}

/**
 * Handles the swimlane matrix format where rows = lanes and columns = steps.
 * Pivots the matrix into flat ExtractedRows with explicit stage/step/lane_key/card_title
 * so the mapping service can resolve them correctly.
 */
function extractFromSwimlaneMatrix(
  ws: XLSX.WorkSheet,
  sheetName: string,
  fileName: string,
): ExtractionResult {
  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
  if (raw.length === 0) {
    return { rows: [], headers: [], errors: ['Sheet is empty'], warnings: [] };
  }

  // Deduplicate empty/repeated headers so every column gets a unique key.
  // Without this, spreadsheets whose header row has blank cells (like the
  // swimlane matrix where only the first cell says "swimlane") collapse
  // all empty-header columns into a single key and only the last column
  // value survives.
  const seenKeys = new Set<string>();
  const headers = raw[0].map((h, i) => {
    const trimmed = String(h).trim();
    if (!trimmed) return `_col_${i}`;
    const norm = trimmed.toLowerCase().replace(/\s+/g, '_');
    if (seenKeys.has(norm)) return `${trimmed}_${i}`;
    seenKeys.add(norm);
    return trimmed;
  });
  const laneColKey = normalizeKey(headers[0]);
  const stepColKeys = headers.slice(1).map(normalizeKey);

  // Parse all data rows into keyed objects
  const allRows = raw.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[normalizeKey(h)] = row[i] !== undefined ? String(row[i]).trim() : '';
    });
    return obj;
  });

  // Scan for metadata rows and lane rows
  let stageRow: Record<string, string> | undefined;
  let stepRow: Record<string, string> | undefined;
  let phaseRow: Record<string, string> | undefined;
  let descriptionRow: Record<string, string> | undefined;
  let primaryActorRow: Record<string, string> | undefined;
  const laneRows: Array<{ laneKey: LaneKey; sourceTags: string[]; row: Record<string, string>; rowIndex: number }> = [];
  const isL1MacroContext = allRows.some((row) => {
    const label = normalizeKey(row[laneColKey] ?? '');
    return isL1MacroSwimlaneLabel(label);
  });

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const cellVal = normalizeKey(row[laneColKey] ?? '');
    if (cellVal === 'stage') { stageRow = row; continue; }
    if (cellVal === 'step') { stepRow = row; continue; }
    if (cellVal === 'phase') { phaseRow = row; continue; }
    if (cellVal === 'description') { descriptionRow = row; continue; }
    if (cellVal === 'primary_actor' || cellVal === 'primary_actors') primaryActorRow = row;
    // Skip other metadata rows
    if (['service_name', 'stage_outcome', 'next_step'].includes(cellVal)) continue;
    if (!cellVal) continue;

    const resolvedLane = resolveSwimlaneLaneKey(cellVal, sheetName, isL1MacroContext);
    if (LANE_KEYS.includes(resolvedLane)) {
      laneRows.push({
        laneKey: resolvedLane,
        sourceTags: getSwimlaneSourceTags(cellVal),
        row,
        rowIndex: i + 2,
      });
    }
  }

  // L2/L3 fallback: if the sheet has a step row but no stage row, treat step
  // names as stage names too. This gives each column its own stage (matching
  // the L2/L3 "one column = one step" expectation) instead of collapsing all
  // columns into a single default "Stage 1".
  if (!stageRow && stepRow) {
    stageRow = stepRow;
  }

  // Build per-column stage/step/phase/description names with carry-forward for
  // merged cells.
  let lastStageName = 'Stage 1';
  let lastPhaseName = '';
  const colStage: Record<string, string> = {};
  const colStep: Record<string, string> = {};
  const colPhase: Record<string, string> = {};
  const colDescription: Record<string, string> = {};

  for (let colIdx = 0; colIdx < stepColKeys.length; colIdx++) {
    const colKey = stepColKeys[colIdx];
    const originalHeader = headers[colIdx + 1];

    const stageCell = (stageRow?.[colKey] ?? '').trim();
    const stageName = stageCell || lastStageName;
    if (stageCell) lastStageName = stageCell;

    const phaseCell = (phaseRow?.[colKey] ?? '').trim();
    const phaseName = phaseCell || lastPhaseName;
    if (phaseCell) lastPhaseName = phaseCell;

    colStage[colKey] = stageName;
    colPhase[colKey] = phaseName;
    colDescription[colKey] = (descriptionRow?.[colKey] ?? '').trim();
    const rawStep = (stepRow?.[colKey] ?? '').trim();
    colStep[colKey] = rawStep || (originalHeader.startsWith('_col_') ? stageName : originalHeader);
  }

  // Pivot: for each lane row × step column, create one ExtractedRow per cell item.
  // We prepend one structure_row per column so stages get created in column order
  // (left-to-right) and carry phase info through to commit.ts.
  const rows: ExtractedRow[] = [];
  const flatHeaders = ['record_type', 'stage', 'step', 'lane_key', 'card_title', 'tags', 'phase', 'description'];

  // Emit structure rows first, one per column, in left-to-right order.
  // This seeds the stage list in spreadsheet column order regardless of which
  // lane row happens to have content in which column.
  for (const colKey of stepColKeys) {
    const cells: Record<string, string> = {
      record_type: 'structure_row',
      stage: colStage[colKey],
      step: colStep[colKey],
      lane_key: '',
      card_title: '',
      tags: '',
      phase: colPhase[colKey],
      description: colDescription[colKey],
    };
    rows.push({
      sourceType: 'xlsx',
      sourceFileName: fileName,
      sourceSheetOrPage: sheetName,
      sourceRowNumber: 1, // structure rows come from the header area
      extractedHeaders: flatHeaders,
      extractedCells: cells,
      rawText: `${colStage[colKey]}\t${colStep[colKey]}\t${colPhase[colKey]}`,
    });
  }

  for (const { laneKey, sourceTags, row, rowIndex } of laneRows) {
    for (const colKey of stepColKeys) {
      const cellValue = (row[colKey] ?? '').trim();
      if (!cellValue) continue;

      const items = splitCellItems(cellValue);

      for (const item of items) {
        const primaryActor = (primaryActorRow?.[colKey] ?? '').trim();
        const resolvedTitle = laneKey === 'user_need'
          ? qualifyUserNeedWithActor(item, primaryActor)
          : capitalizeSentenceStart(item);
        const cells: Record<string, string> = {
          record_type: 'card_row',
          stage: colStage[colKey],
          step: colStep[colKey],
          lane_key: laneKey,
          card_title: capitalizeSentenceStart(resolvedTitle),
          tags: sourceTags.join('; '),
          phase: colPhase[colKey],
          description: colDescription[colKey],
        };
        rows.push({
          sourceType: 'xlsx',
          sourceFileName: fileName,
          sourceSheetOrPage: sheetName,
          sourceRowNumber: rowIndex,
          extractedHeaders: flatHeaders,
          extractedCells: cells,
          rawText: `${colStage[colKey]}\t${colStep[colKey]}\t${laneKey}\t${item}`,
        });
      }
    }
  }

  return { rows, headers: flatHeaders, errors: [], warnings: [] };
}

export function extractFromXlsx(
  workbook: XLSX.WorkBook,
  sheetName: string,
  fileName: string,
): ExtractionResult {
  const ws = workbook.Sheets[sheetName];
  if (!ws) {
    return {
      rows: [],
      headers: [],
      errors: [`Sheet "${sheetName}" not found`],
      warnings: [],
    };
  }

  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
  if (raw.length === 0) {
    return { rows: [], headers: [], errors: ['Sheet is empty'], warnings: [] };
  }

  // Detect swimlane matrix format (first header cell = "Swimlane")
  const firstHeader = normalizeKey(String(raw[0]?.[0] ?? ''));
  if (firstHeader === 'swimlane') {
    return extractFromSwimlaneMatrix(ws, sheetName, fileName);
  }

  const headers = raw[0].map((h) => String(h).trim());

  const rows: ExtractedRow[] = raw
    .slice(1)
    .map((row, i) => {
      const cells: Record<string, string> = {};
      headers.forEach((h, j) => {
        cells[h] = row[j] !== undefined ? String(row[j]).trim() : '';
      });
      return {
        sourceType: 'xlsx' as SourceType,
        sourceFileName: fileName,
        sourceSheetOrPage: sheetName,
        sourceRowNumber: i + 2,
        extractedHeaders: headers,
        extractedCells: cells,
        rawText: headers.map((h) => cells[h] ?? '').join('\t'),
      };
    })
    .filter((r) => Object.values(r.extractedCells).some((v) => v !== ''));

  return { rows, headers, errors: [], warnings: [] };
}

// ---------------------------------------------------------------------------
// Pasted tabular text
// ---------------------------------------------------------------------------

export function extractFromPastedText(text: string): ExtractionResult {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      rows: [],
      headers: [],
      errors: ['No content found in pasted text'],
      warnings: [],
    };
  }

  // Detect delimiter: prefer tab, fallback to comma
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const allRows = lines.map((l) => l.split(delimiter).map((c) => c.trim()));
  const maxCols = Math.max(...allRows.map((r) => r.length));

  // Use first row as headers if it looks like header labels (non-numeric)
  const firstRow = allRows[0];
  const looksLikeHeader =
    firstRow.length > 1 && firstRow.every((cell) => isNaN(Number(cell)) || cell === '');

  let headers: string[];
  let dataRows: string[][];

  if (looksLikeHeader && allRows.length > 1) {
    headers = firstRow;
    dataRows = allRows.slice(1);
  } else {
    headers = Array.from({ length: maxCols }, (_, i) => `column_${i + 1}`);
    dataRows = allRows;
  }

  const rows: ExtractedRow[] = dataRows.map((row, i) => {
    const cells: Record<string, string> = {};
    headers.forEach((h, j) => {
      cells[h] = row[j] ?? '';
    });
    return {
      sourceType: 'pasted_text',
      sourceFileName: 'pasted',
      sourceSheetOrPage: 'Pasted text',
      sourceRowNumber: i + (looksLikeHeader ? 2 : 1),
      extractedHeaders: headers,
      extractedCells: cells,
      rawText: row.join('\t'),
    };
  });

  return { rows, headers, errors: [], warnings: [] };
}
