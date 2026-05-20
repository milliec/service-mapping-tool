/**
 * mock-mapping-service.ts
 *
 * MockImportMappingService
 *
 * Deterministic keyword-heuristic implementation of ImportMappingService.
 * Used as the default provider; swap to an LLM-backed service when ready.
 *
 * Mapping strategy (in priority order):
 *   1. Explicit `lane_key` column → use directly (confidence 0.95)
 *   2. Explicit `card_title` column → use directly (confidence 0.85)
 *   3. Column header name matches a known lane → lane from header (0.70)
 *   4. Content keyword scan across full rawText → infer lane (0.35–0.60)
 *   5. No lane detected → flag for manual review (confidence 0.15)
 *
 * Record type detection:
 *   - Explicit `record_type` column → use value
 *   - Numeric hierarchy prefix (e.g. "1.", "2.3") → structure_row / card_row
 *   - Single non-empty cell with heading pattern → structure_row
 *   - Zero non-empty cells → noise_row
 *   - Default → card_row
 *
 * Stage / step inference:
 *   - Explicit `stage` + `step` columns (or `phase`, `activity`, etc.)
 *   - Numeric hierarchy: "2" → Stage 2, "2.1" → Step 1 within Stage 2
 *   - Running tracker — structure_rows update the active stage/step context
 */

import { v4 as uuid } from 'uuid';
import { LANE_KEYS, type LaneKey } from '../types';
import type { ExtractedRow } from './extract';
import type { MappedRow, MappingResult, RowRecordType } from './mapping-types';

// ---------------------------------------------------------------------------
// Lane keyword heuristics
// ---------------------------------------------------------------------------

interface LanePattern {
  laneKey: LaneKey;
  patterns: RegExp;
}

const LANE_PATTERNS: LanePattern[] = [
  {
    laneKey: 'actor',
    patterns: /\b(actor|persona|user|customer|citizen|client|stakeholder)\b/i,
  },
  {
    laneKey: 'user_action_event',
    patterns:
      /\b(action|does|clicks|submits|navigates|triggers|event|user step|journey step)\b/i,
  },
  {
    laneKey: 'user_need',
    patterns: /\b(need|want|goal|expect|require|motivation|job to be done|desire)\b/i,
  },
  {
    laneKey: 'pain_point',
    patterns:
      /\b(pain|issue|problem|frustrat|confus|barrier|obstacle|challenge|difficult|broken|fail)\b/i,
  },
  {
    laneKey: 'frontstage_touchpoint',
    patterns:
      /\b(touchpoint|ui|interface|screen|page|form|email|notification|channel|portal)\b/i,
  },
  {
    laneKey: 'activity',
    patterns: /\b(activity|task|step|action item|to.?do|checklist item|user task)\b/i,
  },
  {
    laneKey: 'backstage_process',
    patterns:
      /\b(process|workflow|manual process|staff|team|service desk|back.?stage|support task)\b/i,
  },
  {
    laneKey: 'system',
    patterns:
      /\b(system|api|database|service|integration|platform|backend|infrastructure|microservice)\b/i,
  },
  {
    laneKey: 'policy_intent',
    patterns:
      /\b(policy|intent|objective|goal|principle|regulation|compliance|requirement|mandate)\b/i,
  },
  {
    laneKey: 'business_rule',
    patterns:
      /\b(rule|constraint|validation|logic|condition|criteria|threshold|eligibility|check)\b/i,
  },
  {
    laneKey: 'data_input',
    patterns: /\b(input|data entry|capture|collect|field|form data|upload|ingest)\b/i,
  },
  {
    laneKey: 'data_output',
    patterns: /\b(output|report|export|result|response|notification sent|generate|produce)\b/i,
  },
  {
    laneKey: 'behaviour_change',
    patterns:
      /\b(behaviour change|desired behaviour|what good looks like|target behaviour|intended change|behaviour goal|good looks like)\b/i,
  },
];

/** Map normalised column header names to a lane key */
const HEADER_LANE_MAP: Record<string, LaneKey> = {
  actor: 'actor',
  user: 'actor',
  persona: 'actor',
  action: 'user_action_event',
  user_action: 'user_action_event',
  user_action_event: 'user_action_event',
  event: 'user_action_event',
  need: 'user_need',
  user_need: 'user_need',
  pain: 'pain_point',
  pain_point: 'pain_point',
  issue: 'pain_point',
  problem: 'pain_point',
  touchpoint: 'frontstage_touchpoint',
  frontstage_touchpoint: 'frontstage_touchpoint',
  channel: 'frontstage_touchpoint',
  activity: 'activity',
  task: 'activity',
  user_task: 'activity',
  process: 'backstage_process',
  backstage: 'backstage_process',
  backstage_process: 'backstage_process',
  system: 'system',
  technology: 'system',
  tech: 'system',
  policy: 'policy_intent',
  policy_intent: 'policy_intent',
  intent: 'policy_intent',
  rule: 'business_rule',
  business_rule: 'business_rule',
  data: 'data_input',
  data_input: 'data_input',
  input: 'data_input',
  data_output: 'data_output',
  output: 'data_output',
  behaviour_change: 'behaviour_change',
  desired_behaviour: 'behaviour_change',
  desired_behaviour_change: 'behaviour_change',
  what_good_looks_like: 'behaviour_change',
  target_behaviour: 'behaviour_change',
};

function normaliseHeaderKey(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, '_');
}

function inferLaneFromContent(text: string): { laneKey: LaneKey | null; confidence: number } {
  let bestLane: LaneKey | null = null;
  let bestScore = 0;

  for (const { laneKey, patterns } of LANE_PATTERNS) {
    const matches = text.match(new RegExp(patterns.source, patterns.flags + 'g'));
    if (matches) {
      const score = matches.length * 0.25;
      if (score > bestScore) {
        bestScore = score;
        bestLane = laneKey;
      }
    }
  }

  return { laneKey: bestLane, confidence: Math.min(bestScore + 0.1, 0.65) };
}

function inferLaneFromHeader(header: string): LaneKey | null {
  const key = normaliseHeaderKey(header);
  if (LANE_KEYS.includes(key as LaneKey)) return key as LaneKey;
  return HEADER_LANE_MAP[key] ?? null;
}

// ---------------------------------------------------------------------------
// Record type detection
// ---------------------------------------------------------------------------

function detectRecordType(row: ExtractedRow): RowRecordType {
  const cells = row.extractedCells;

  // Explicit column
  const explicit = cells['record_type']?.toLowerCase().trim();
  if (explicit) {
    if (explicit === 'structure' || explicit === 'structure_row') return 'structure_row';
    if (explicit === 'card' || explicit === 'card_row') return 'card_row';
    if (explicit === 'noise' || explicit === 'noise_row') return 'noise_row';
  }

  // Explicit lane_key column with a valid value → card_row
  const laneCol = cells['lane_key']?.toLowerCase().trim();
  if (laneCol && LANE_KEYS.includes(laneCol as LaneKey)) return 'card_row';

  const nonEmpty = Object.values(cells).filter((v) => v.trim() !== '');
  if (nonEmpty.length === 0) return 'noise_row';

  // Single-cell rows that look like section headings
  if (nonEmpty.length === 1) {
    const val = nonEmpty[0].trim();
    if (/^(phase|stage|section|part|step)\s*\d*/i.test(val)) return 'structure_row';
    if (val.length < 3) return 'noise_row';
    // Numeric-only prefix like "1." or "Phase 2" → structure
    if (/^\d+\.?\s*$/.test(val)) return 'structure_row';
  }

  return 'card_row';
}

// ---------------------------------------------------------------------------
// Stage / step inference
// ---------------------------------------------------------------------------

interface StageStepContext {
  currentStage: string;
  currentStep: string;
  stageCounter: number;
}

function inferStageAndStep(
  row: ExtractedRow,
  ctx: StageStepContext,
): { stage: string; step: string; looksLikeStructure: boolean } {
  const cells = row.extractedCells;

  // Explicit columns (various common header names)
  const stageVal =
    cells['stage']?.trim() ||
    cells['phase']?.trim() ||
    cells['stage_name']?.trim() ||
    cells['phase_name']?.trim() ||
    '';
  const stepVal =
    cells['step']?.trim() ||
    cells['activity']?.trim() ||
    cells['sub_step']?.trim() ||
    cells['step_name']?.trim() ||
    '';

  if (stageVal) {
    ctx.currentStage = stageVal;
    ctx.currentStep = stepVal || stageVal;
    return { stage: stageVal, step: stepVal || stageVal, looksLikeStructure: false };
  }

  if (stepVal && ctx.currentStage) {
    ctx.currentStep = stepVal;
    return { stage: ctx.currentStage, step: stepVal, looksLikeStructure: false };
  }

  // Numeric hierarchy in the first non-empty cell
  const firstVal = Object.values(cells).find((v) => v.trim()) ?? '';
  const numericMatch = firstVal.match(/^(\d+)(?:\.(\d+))?\s*(.*)/);
  if (numericMatch) {
    const major = parseInt(numericMatch[1], 10);
    const minor = numericMatch[2] ? parseInt(numericMatch[2], 10) : null;
    const label = numericMatch[3].trim();

    if (minor === null && major > 0) {
      // Top-level number → stage header
      const stageName = label || `Stage ${major}`;
      ctx.currentStage = stageName;
      ctx.currentStep = stageName;
      ctx.stageCounter = major;
      return { stage: stageName, step: stageName, looksLikeStructure: true };
    }

    if (minor !== null) {
      // Sub-level → step
      const stepName = label || `Step ${major}.${minor}`;
      if (!ctx.currentStage) ctx.currentStage = `Stage ${major}`;
      ctx.currentStep = stepName;
      return { stage: ctx.currentStage, step: stepName, looksLikeStructure: false };
    }
  }

  // Fall back to running context
  const stage = ctx.currentStage || 'Stage 1';
  const step = ctx.currentStep || stage;
  return { stage, step, looksLikeStructure: false };
}

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

export class MockImportMappingService {
  async mapRows(rows: ExtractedRow[]): Promise<MappingResult> {
    if (rows.length === 0) {
      return { rows: [], errors: ['No rows to map'], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const mapped: MappedRow[] = [];

    const headers = rows[0].extractedHeaders;

    // Pre-build a map of which column headers correspond to lane keys
    const headerLaneCols: Array<{ header: string; laneKey: LaneKey }> = [];
    for (const h of headers) {
      const lane = inferLaneFromHeader(h);
      if (lane) headerLaneCols.push({ header: h, laneKey: lane });
    }

    const ctx: StageStepContext = {
      currentStage: '',
      currentStep: '',
      stageCounter: 0,
    };

    for (const row of rows) {
      const flags: string[] = [];
      let laneConfidence = 0;

      // ── Record type ────────────────────────────────────────────────────
      const baseRecordType = detectRecordType(row);

      // ── Stage / step ───────────────────────────────────────────────────
      const { stage, step, looksLikeStructure } = inferStageAndStep(row, ctx);
      const recordType: RowRecordType = looksLikeStructure ? 'structure_row' : baseRecordType;

      // ── Lane key ───────────────────────────────────────────────────────
      let proposedLaneKey: LaneKey | '' = '';
      let proposedCardTitle = '';
      let proposedCardBody = '';
      let confidence = 0.5;

      // 1. Explicit lane_key column
      const explicitLane = row.extractedCells['lane_key']?.toLowerCase().trim();
      if (explicitLane && LANE_KEYS.includes(explicitLane as LaneKey)) {
        proposedLaneKey = explicitLane as LaneKey;
        laneConfidence = 0.95;
      }

      // 2. Explicit card_title column
      const explicitTitle = row.extractedCells['card_title']?.trim();
      if (explicitTitle) {
        proposedCardTitle = explicitTitle;
        proposedCardBody = row.extractedCells['card_body']?.trim() ?? '';
        confidence = laneConfidence > 0 ? 0.9 : 0.75;
      }

      // 3. Header-based lane inference (first matching column with content)
      if (!proposedLaneKey && recordType === 'card_row') {
        for (const { header, laneKey } of headerLaneCols) {
          const val = row.extractedCells[header]?.trim();
          if (val) {
            proposedLaneKey = laneKey;
            if (!proposedCardTitle) proposedCardTitle = val;
            laneConfidence = 0.70;
            break;
          }
        }
      }

      // 4. Content keyword scan
      if (!proposedLaneKey && recordType === 'card_row') {
        const { laneKey, confidence: kwConf } = inferLaneFromContent(row.rawText);
        if (laneKey) {
          proposedLaneKey = laneKey;
          laneConfidence = kwConf;
          flags.push('Lane inferred from content keywords — please verify');
        } else {
          flags.push('Could not infer lane key — assign manually before committing');
          confidence = 0.15;
        }
      }

      // 5. Title fallback — pick longest substantive cell
      if (!proposedCardTitle && recordType === 'card_row') {
        const contentCells = Object.entries(row.extractedCells)
          .filter(([, v]) => v.trim().length > 5)
          .sort(([, a], [, b]) => b.length - a.length);

        if (contentCells.length > 0) {
          proposedCardTitle = contentCells[0][1].slice(0, 120);
          if (contentCells.length > 1) {
            proposedCardBody = contentCells[1][1].slice(0, 400);
          }
          flags.push('Title inferred from longest content cell');
          confidence = Math.min(confidence, 0.45);
        }
      }

      // ── Final confidence ───────────────────────────────────────────────
      if (recordType === 'structure_row' || recordType === 'noise_row') {
        confidence = 0.90;
      } else if (proposedLaneKey) {
        confidence = Math.max(confidence, laneConfidence * 0.85 + 0.1);
      } else {
        confidence = 0.15;
      }

      // ── Tags ───────────────────────────────────────────────────────────
      const tagsRaw = row.extractedCells['tags'] ?? '';
      const proposedTags = tagsRaw
        ? tagsRaw
            .split(/[,;|]/)
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      mapped.push({
        id: uuid(),
        sourceRow: row,
        proposedRecordType: recordType,
        proposedStage: stage,
        proposedStep: step,
        proposedLaneKey,
        proposedCardTitle,
        proposedCardBody,
        proposedTags,
        confidence,
        flags,
        reviewStatus: 'pending',
      });
    }

    // Summary warnings
    const lowConf = mapped.filter(
      (r) => r.proposedRecordType === 'card_row' && r.confidence < 0.4,
    ).length;
    if (lowConf > 0) {
      warnings.push(
        `${lowConf} card row${lowConf > 1 ? 's' : ''} have low confidence and need manual review`,
      );
    }

    const noLane = mapped.filter(
      (r) => r.proposedRecordType === 'card_row' && !r.proposedLaneKey,
    ).length;
    if (noLane > 0) {
      warnings.push(
        `${noLane} card row${noLane > 1 ? 's' : ''} have no lane key — assign before committing`,
      );
    }

    return { rows: mapped, errors, warnings };
  }
}
