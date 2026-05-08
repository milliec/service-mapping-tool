import { LANE_KEYS, type ImportValidationError } from '../types';

const REQUIRED_HEADERS = [
  'record_type',
  'service_name',
  'stage',
  'stage_order',
  'step',
  'step_order',
];

const ALL_HEADERS = [
  'record_type',
  'service_name',
  'stage',
  'stage_order',
  'stage_outcome',
  'step',
  'step_order',
  'lane_key',
  'card_title',
  'card_body',
  'card_order',
  'tags',
  'source_ref',
  // Optional traceability columns (not required; preserved if present)
  'traceability_code',
  'derived_from_ids',
  'next_step',
];

export function validateHeaders(headers: string[]): ImportValidationError[] {
  const errors: ImportValidationError[] = [];
  const normalized = headers.map((h) => h.toLowerCase().trim().replace(/\s+/g, '_'));

  for (const req of REQUIRED_HEADERS) {
    if (!normalized.includes(req)) {
      errors.push({ row: 0, field: req, message: `Missing required column: ${req}` });
    }
  }

  return errors;
}

export function normalizeHeaders(headers: string[]): string[] {
  return headers.map((h) => {
    const normalized = h.toLowerCase().trim().replace(/\s+/g, '_');
    const match = ALL_HEADERS.find((ah) => ah === normalized);
    return match || normalized;
  });
}

export function validateLaneKey(laneKey: string, row: number): ImportValidationError | null {
  if (!laneKey) return null;
  const normalized = laneKey.toLowerCase().trim().replace(/\s+/g, '_');
  if (!LANE_KEYS.includes(normalized as (typeof LANE_KEYS)[number])) {
    return { row, field: 'lane_key', message: `Invalid lane_key "${laneKey}". Valid keys: ${LANE_KEYS.join(', ')}` };
  }
  return null;
}

export function isEmptyRow(row: Record<string, string>): boolean {
  return Object.values(row).every((v) => !v || v.trim() === '');
}
