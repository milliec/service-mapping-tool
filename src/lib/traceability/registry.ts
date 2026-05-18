import type { LaneKey } from '../types';

/**
 * Traceability tag prefixes.
 * Two-letter codes identify entity types in human-readable traceability codes (e.g. PP-027).
 */
export const TRACEABILITY_PREFIXES = {
  // Blueprint structure
  service: 'SV',
  stage: 'ST',
  stage_outcome: 'SO',
  step: 'SS',
  // Swimlane card types (keyed by LaneKey)
  actor: 'AC',
  user_action_event: 'UA',
  user_need: 'UN',
  pain_point: 'PP',
  frontstage_touchpoint: 'FT',
  backstage_process: 'BP',
  description: 'DS',
  behaviour_change: 'BC',
  success_measure: 'SM',
  motivation: 'MO',
  ability: 'AB',
  prompts: 'PM',
  system: 'SY',
  policy_intent: 'PI',
  business_rule: 'BR',
  data_input: 'DI',
  data_output: 'DO',
  opportunities: 'OPP',
  ideas: 'IDEA',
  // L1 Macro swimlane card types
  policy_outcome: 'PO',
  user_outcome: 'UO',
  operational_outcome: 'OO',
  insights: 'IN',
  impact_of_pain_points: 'IP',
  performance_indicators: 'SPI',
  opportunities_lane: 'WOA',
  third_parties_involved: 'TP',
  support_system: 'SUP',
  // Downstream artifacts
  opportunity: 'OPP',
  evidence: 'EVD',
  requirement: 'REQ',
  api_contract: 'API',
  ui_scaffold: 'UI',
  // Relationship types (for NS codes on import mapping)
  next_step: 'NS',
} as const;

export type TraceabilityPrefix = (typeof TRACEABILITY_PREFIXES)[keyof typeof TRACEABILITY_PREFIXES];

export type TraceabilityEntityType = keyof typeof TRACEABILITY_PREFIXES;

/**
 * Source provenance prefix map.
 * SRC codes are assigned during extraction/import (e.g. SRC-PDF-001).
 */
export const SOURCE_TYPE_PREFIXES = {
  pdf: 'PDF',
  xlsx: 'XLSX',
  csv: 'CSV',
  ai: 'AI',
  mural: 'MURAL',
  manual: 'MAN',
} as const;

export type SourceType = keyof typeof SOURCE_TYPE_PREFIXES;

/**
 * Returns the traceability prefix for a given lane key.
 * Used when assigning codes to cards based on their lane.
 */
export function getLanePrefix(laneKey: LaneKey): TraceabilityPrefix {
  const prefix = TRACEABILITY_PREFIXES[laneKey as TraceabilityEntityType];
  // All LaneKeys have a direct entry in TRACEABILITY_PREFIXES
  return (prefix ?? 'UN') as TraceabilityPrefix;
}

/**
 * Parses a traceability code string into its constituent parts.
 * Returns null if the code does not match the expected format.
 *
 * Handles both semantic codes (PP-027) and source provenance codes (SRC-PDF-001).
 */
export function parseTraceabilityCode(
  code: string,
): { prefix: string; sequence: number } | null {
  // Semantic code: PP-027 or OPP-003
  const semanticMatch = code.match(/^([A-Z]+)-(\d{3,})$/);
  if (semanticMatch) {
    return { prefix: semanticMatch[1], sequence: parseInt(semanticMatch[2], 10) };
  }
  // Source provenance code: SRC-PDF-001
  const srcMatch = code.match(/^SRC-([A-Z]+)-(\d{3,})$/);
  if (srcMatch) {
    return { prefix: `SRC-${srcMatch[1]}`, sequence: parseInt(srcMatch[2], 10) };
  }
  return null;
}
