/**
 * mapping-types.ts
 *
 * Intermediate import model: the AI mapping service takes ExtractedRow[] as
 * input and returns MappedRow[], which the review UI presents to the user
 * before committing to the blueprint store.
 *
 * Separation of concerns:
 *   ExtractedRow  — raw source data (provenance only, no interpretation)
 *   MappedRow     — AI-proposed schema mapping + user corrections
 *   commit.ts     — converts accepted MappedRows into BlueprintState
 */

import type { LaneKey } from '../types';
import type { ExtractedRow } from './extract';

export type RowRecordType = 'structure_row' | 'card_row' | 'noise_row';
export type ReviewStatus = 'pending' | 'accepted' | 'rejected';

export interface MappedRow {
  /** Stable UI key */
  id: string;

  /** Original source row */
  sourceRow: ExtractedRow;

  // ── AI-proposed values ──────────────────────────────────────────────────

  proposedRecordType: RowRecordType;
  proposedStage: string;
  proposedStep: string;
  proposedLaneKey: LaneKey | '';
  proposedCardTitle: string;
  proposedCardBody: string;
  proposedTags: string[];
  /** 0.0–1.0 — how confident the mapping service is in this mapping */
  confidence: number;
  /** Human-readable notes about why confidence is low or what was inferred */
  flags: string[];

  // ── User corrections ────────────────────────────────────────────────────
  // undefined = "use the proposed value"

  reviewStatus: ReviewStatus;
  editedRecordType?: RowRecordType;
  editedStage?: string;
  editedStep?: string;
  editedLaneKey?: LaneKey | '';
  editedCardTitle?: string;
  editedCardBody?: string;
}

export interface MappingResult {
  rows: MappedRow[];
  errors: string[];
  warnings: string[];
}

/**
 * Merge AI-proposed values with any user edits.
 * Call this just before committing to get the final values for each row.
 */
export function resolveRow(row: MappedRow): {
  recordType: RowRecordType;
  stage: string;
  step: string;
  laneKey: LaneKey | '';
  cardTitle: string;
  cardBody: string;
  tags: string[];
} {
  return {
    recordType: row.editedRecordType ?? row.proposedRecordType,
    stage: row.editedStage ?? row.proposedStage,
    step: row.editedStep ?? row.proposedStep,
    laneKey: row.editedLaneKey !== undefined ? row.editedLaneKey : row.proposedLaneKey,
    cardTitle: row.editedCardTitle ?? row.proposedCardTitle,
    cardBody: row.editedCardBody ?? row.proposedCardBody,
    tags: row.proposedTags,
  };
}
