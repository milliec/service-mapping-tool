/**
 * commit.ts
 *
 * Converts reviewed MappedRow[] into a BlueprintState that can be passed
 * directly to useBlueprintStore.loadBlueprint().
 *
 * Only rows with reviewStatus !== 'rejected' and recordType !== 'noise_row'
 * are included. Provenance is preserved on every card (sourceFile, sourceSheet,
 * sourceRow).
 */

import { v4 as uuid } from 'uuid';
import type { BlueprintState, Card, LaneKey, Stage, Step } from '../types';
import { DEFAULT_LANES, L1_MACRO_LANES, L1_MACRO_LANE_KEYS } from '../lane-definitions';
import type { MappedRow } from './mapping-types';
import { resolveRow } from './mapping-types';
import { LANE_KEYS } from '../types';

export interface CommitResult {
  state: BlueprintState;
  errors: string[];
  warnings: string[];
}

function isL1MacroImport(rows: MappedRow[]): boolean {
  return rows.some((row) => {
    const resolved = resolveRow(row);
    const firstCell = Object.values(row.sourceRow.extractedCells)[0]?.toLowerCase().trim().replace(/\s+/g, '_') ?? '';
    return L1_MACRO_LANE_KEYS.has(resolved.laneKey as LaneKey)
      || Boolean(row.sourceRow.extractedCells['phase']?.trim())
      || [
        'phase',
        'policy_reform',
        'policy_outcome',
        'user_outcome',
        'operational_outcome',
        'insights',
        'impact_of_pain_points',
        'performance_indicators',
        'opportunities_lane',
      ].includes(firstCell);
  });
}

function resolveCommitLaneKey(laneKey: LaneKey, isL1Macro: boolean): LaneKey {
  if (isL1Macro && (laneKey === 'ideas' || laneKey === 'opportunities')) {
    return 'opportunities_lane';
  }
  return laneKey;
}

function isAreaReferenceBehaviourChangeCard(laneKey: LaneKey, title: string): boolean {
  return laneKey === 'behaviour_change' && /^areas?\s+[a-z](?:\s*,\s*[a-z])*(?:\s*(?:and|&)\s*[a-z])?(?:\b|[.:;-])/i.test(title.trim());
}

function isEvidenceReferencePainPointCard(laneKey: LaneKey, title: string, body = ''): boolean {
  if (laneKey !== 'pain_point') return false;
  const value = `${title} ${body}`.trim();
  if (!/\bE-\d{3,}\b/i.test(value)) return false;
  return value
    .replace(/\bE-\d{3,}\b/gi, '')
    .replace(/[,\s.;:[\]()]+/g, '')
    .trim() === '';
}

function stripOpportunityTraceText(laneKey: LaneKey, text: string): string {
  if (laneKey !== 'opportunities' && laneKey !== 'opportunities_lane') return text;
  return text
    .replace(/(?:\s+|\n)*Trace:\s*OPP-\d{3,}(?:\s*\/\s*(?:OPP-)?\d{3,})*\.?\s*$/i, '')
    .trim();
}

function stripRollupText(laneKey: LaneKey, title: string): { title: string; derivedFromIds?: string[] } {
  const prefix = laneKey === 'user_need' ? 'UN' : laneKey === 'pain_point' ? 'PP' : null;
  if (!prefix) return { title };
  const pattern = new RegExp(`\\s*\\[Rolls up\\s+((?:${prefix}-\\d{3,})(?:\\s*,\\s*${prefix}-\\d{3,})*)\\]?\\s*$`, 'i');
  const match = title.match(pattern);
  if (!match) return { title };
  return {
    title: title.slice(0, match.index).trim(),
    derivedFromIds: Array.from(new Set(match[1].match(new RegExp(`\\b${prefix}-\\d{3,}\\b`, 'g')) ?? [])),
  };
}

function stripBehaviourChangeEvidenceBasis(laneKey: LaneKey, title: string): { title: string; derivedFromIds?: string[] } {
  if (laneKey !== 'behaviour_change') return { title };
  const evidencePattern = /\s*Evidence basis[^.?!]*(?:UN|PP)-\d{3,}[^.?!]*[.?!]?/i;
  const match = title.match(evidencePattern);
  if (!match) return { title };
  const evidenceText = match[0];
  return {
    title: title.replace(evidencePattern, '').replace(/\s{2,}/g, ' ').trim(),
    derivedFromIds: Array.from(new Set(evidenceText.match(/\b(?:UN|PP)-\d{3,}\b/g) ?? [])),
  };
}

function stripSuccessMeasureReferenceText(laneKey: LaneKey, title: string): { title: string; derivedFromIds?: string[] } {
  if (laneKey !== 'success_measure') return { title };
  const pattern = /(?:^|\s+)((?:PP-\d{3,})(?:\s*,\s*PP-\d{3,})*)\.?\s*$/i;
  const match = title.match(pattern);
  if (!match) return { title };
  return {
    title: title.slice(0, match.index).trim(),
    derivedFromIds: Array.from(new Set(match[1].match(/\bPP-\d{3,}\b/g) ?? [])),
  };
}

export function commitMappedRows(
  rows: MappedRow[],
  serviceName: string,
  sourceFile: string,
): CommitResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const bpId = uuid();
  const ts = new Date().toISOString();

  const stageMap = new Map<string, Stage>();
  const stepMap = new Map<string, Step>();
  const cards: Card[] = [];

  // Only process accepted rows (not rejected; pending rows are treated as accepted)
  const includedRows = rows.filter((r) => r.reviewStatus !== 'rejected');
  const isL1Macro = isL1MacroImport(includedRows);

  for (const row of includedRows) {
    const resolved = resolveRow(row);

    if (resolved.recordType === 'noise_row') continue;

    const stageName = resolved.stage.trim() || 'Stage 1';
    const stepName = resolved.step.trim() || stageName;
    // Phase + description are carried through on each extracted row by
    // extract.ts for the swimlane matrix format. Both optional for other paths.
    const phase = row.sourceRow.extractedCells['phase']?.trim() || undefined;
    const description = row.sourceRow.extractedCells['description']?.trim() || undefined;

    // ── Ensure stage exists ───────────────────────────────────────────────
    if (!stageMap.has(stageName)) {
      stageMap.set(stageName, {
        id: uuid(),
        blueprintId: bpId,
        title: stageName,
        outcome: '',
        order: stageMap.size,
        phase,
        description,
      });
    } else {
      // Backfill phase/description onto an existing stage if it was created by
      // an earlier card row that didn't carry that info.
      const existing = stageMap.get(stageName)!;
      if (phase && !existing.phase) existing.phase = phase;
      if (description && !existing.description) existing.description = description;
    }
    const stage = stageMap.get(stageName)!;

    // ── Ensure step exists ────────────────────────────────────────────────
    const stepKey = `${stageName}::${stepName}`;
    if (!stepMap.has(stepKey)) {
      const stepsInStage = Array.from(stepMap.values()).filter((s) => s.stageId === stage.id);
      stepMap.set(stepKey, {
        id: uuid(),
        blueprintId: bpId,
        stageId: stage.id,
        title: stepName,
        order: stepsInStage.length,
      });
    }

    // structure_row rows establish hierarchy only — no card created.
    if (resolved.recordType === 'structure_row') {
      continue;
    }

    // ── Validate lane key ─────────────────────────────────────────────────
    const laneKey = resolved.laneKey
      ? resolveCommitLaneKey(resolved.laneKey as LaneKey, isL1Macro)
      : '';
    if (!laneKey || !LANE_KEYS.includes(laneKey as LaneKey)) {
      warnings.push(
        `Row ${row.sourceRow.sourceRowNumber}: no valid lane key — skipped`,
      );
      continue;
    }

    // ── Validate title ────────────────────────────────────────────────────
    const titleWithoutTrace = stripOpportunityTraceText(laneKey as LaneKey, resolved.cardTitle);
    const titleRollup = stripRollupText(laneKey as LaneKey, titleWithoutTrace);
    const titleEvidenceBasis = stripBehaviourChangeEvidenceBasis(laneKey as LaneKey, titleRollup.title);
    const titleSuccessMeasureRefs = stripSuccessMeasureReferenceText(laneKey as LaneKey, titleEvidenceBasis.title);
    const title = titleSuccessMeasureRefs.title;
    if (!title) {
      warnings.push(
        `Row ${row.sourceRow.sourceRowNumber}: no card title — skipped`,
      );
      continue;
    }
    if (isAreaReferenceBehaviourChangeCard(laneKey as LaneKey, title)) {
      continue;
    }
    if (isEvidenceReferencePainPointCard(laneKey as LaneKey, title, resolved.cardBody)) {
      continue;
    }

    const step = stepMap.get(stepKey)!;
    const cellOrder = cards.filter(
      (c) => c.stepId === step.id && c.laneKey === laneKey,
    ).length;

    cards.push({
      id: uuid(),
      blueprintId: bpId,
      stageId: stage.id,
      stepId: step.id,
      laneKey: laneKey as LaneKey,
      title,
      body: stripOpportunityTraceText(laneKey as LaneKey, resolved.cardBody),
      order: cellOrder,
      tags: resolved.tags,
      sourceFile,
      sourceSheet: row.sourceRow.sourceSheetOrPage,
      sourceRow: row.sourceRow.sourceRowNumber,
      sourceRef: '',
      createdAt: ts,
      updatedAt: ts,
      derivedFromIds: [
        ...(titleRollup.derivedFromIds ?? []),
        ...(titleEvidenceBasis.derivedFromIds ?? []),
        ...(titleSuccessMeasureRefs.derivedFromIds ?? []),
      ].length
        ? Array.from(new Set([
            ...(titleRollup.derivedFromIds ?? []),
            ...(titleEvidenceBasis.derivedFromIds ?? []),
            ...(titleSuccessMeasureRefs.derivedFromIds ?? []),
          ]))
        : undefined,
    });
  }

  const stages = Array.from(stageMap.values()).sort((a, b) => a.order - b.order);
  const steps = Array.from(stepMap.values());

  return {
    state: {
      blueprint: {
        id: bpId,
        serviceName: serviceName.trim() || 'Enter title',
        description: '',
        createdAt: ts,
        updatedAt: ts,
      },
      stages,
      steps,
      lanes: (isL1Macro ? L1_MACRO_LANES : DEFAULT_LANES).map((l) => ({ ...l })),
      childBlueprints: [],
      rootDocument: null,
      activeBlueprintId: bpId,
      rootBlueprintId: bpId,
      cards,
      storyboardImages: [],
      storyboardVisible: true,
      storyboardCollapsed: false,
      cardLinks: [],
      evidence: [],
      opportunities: [],
      solutions: [],
      assumptions: [],
      strategicGoals: [],
      outcomes: [],
      systemOutcomes: [],
      behaviourOutcomes: [],
      serviceOutcomes: [],
      stepLinks: [],
      requirements: [],
      apiContracts: [],
      uiScaffolds: [],
      traceabilityCounters: {},
    },
    errors,
    warnings,
  };
}
