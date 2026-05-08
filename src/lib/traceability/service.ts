import { SOURCE_TYPE_PREFIXES, type SourceType, type TraceabilityPrefix } from './registry';

/**
 * Pure traceability code generator.
 * No side effects — takes counters as input, returns new code + updated counters.
 * Counters live in BlueprintState.traceabilityCounters and travel with undo/redo.
 */

/**
 * Generates the next semantic traceability code for a given prefix.
 * Codes are zero-padded to at least 3 digits: PP-001, OPP-027, etc.
 *
 * @param prefix  - e.g. 'PP', 'OPP', 'ST'
 * @param counters - current counter map from BlueprintState
 * @returns new code string and updated counters (do not mutate the input)
 */
export function generateTraceabilityCode(
  prefix: TraceabilityPrefix | string,
  counters: Record<string, number>,
): { code: string; updatedCounters: Record<string, number> } {
  const current = counters[prefix] ?? 0;
  const next = current + 1;
  const code = `${prefix}-${String(next).padStart(3, '0')}`;
  return {
    code,
    updatedCounters: { ...counters, [prefix]: next },
  };
}

/**
 * Generates a source provenance reference: SRC-PDF-001, SRC-XLSX-014, SRC-AI-003, etc.
 * Uses a compound counter key (e.g. 'SRC_PDF') to track per-type sequences independently.
 *
 * @param sourceType - 'pdf' | 'xlsx' | 'csv' | 'ai' | 'mural' | 'manual'
 * @param counters   - current counter map
 */
export function generateSourceRef(
  sourceType: SourceType,
  counters: Record<string, number>,
): { ref: string; updatedCounters: Record<string, number> } {
  const typePrefix = SOURCE_TYPE_PREFIXES[sourceType];
  const counterKey = `SRC_${typePrefix}`;
  const current = counters[counterKey] ?? 0;
  const next = current + 1;
  const ref = `SRC-${typePrefix}-${String(next).padStart(3, '0')}`;
  return {
    ref,
    updatedCounters: { ...counters, [counterKey]: next },
  };
}

/**
 * Detects source type from a file name or extension string.
 * Falls back to 'manual' if unrecognised.
 */
export function detectSourceType(sourceFile: string): SourceType {
  const ext = sourceFile.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'csv') return 'csv';
  if (sourceFile === 'AI' || sourceFile.toLowerCase().includes('ai')) return 'ai';
  if (sourceFile.toLowerCase().includes('mural')) return 'mural';
  return 'manual';
}
