/**
 * mapping-service.ts
 *
 * Provider interface for the AI-assisted import mapping step.
 *
 * Swap implementations without changing any other code:
 *   MockImportMappingService   — deterministic keyword heuristics (default)
 *   (future) LLMImportMappingService — LLM-based semantic classification
 */

import type { ExtractedRow } from './extract';
import type { MappingResult } from './mapping-types';

export interface ImportMappingService {
  /**
   * Classify each row, infer stage/step/lane/title, and return confidence
   * scores. Must not mutate the input rows or write to any store.
   */
  mapRows(rows: ExtractedRow[]): Promise<MappingResult>;
}
