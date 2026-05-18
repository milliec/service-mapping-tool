import { v4 as uuid } from 'uuid';
import * as XLSX from 'xlsx';
import {
  type BlueprintState,
  type Card,
  type ImportResult,
  type ImportValidationError,
  type LaneKey,
  type Stage,
  type Step,
  type StepLink,
} from '../types';
import { DEFAULT_LANES, L1_MACRO_LANES, L1_MACRO_LANE_KEYS } from '../lane-definitions';
import { validateLaneKey, isEmptyRow } from './validate';
import { generateSourceRef, detectSourceType } from '../traceability/service';
import { generateTraceabilityCode, } from '../traceability/service';
import { getLanePrefix } from '../traceability/registry';

function safeNum(val: string | number | undefined | null, fallback: number): number {
  if (val === undefined || val === null || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function safeTrim(val: string | undefined | null): string {
  return val?.toString().trim() ?? '';
}

function capitalizeSentenceStart(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const firstLetterIndex = trimmed.search(/[A-Za-z]/);
  if (firstLetterIndex === -1) return trimmed;

  return `${trimmed.slice(0, firstLetterIndex)}${trimmed[firstLetterIndex].toUpperCase()}${trimmed.slice(firstLetterIndex + 1)}`;
}

const SWIMLANE_LANE_ALIASES: Record<string, LaneKey> = {
  user_action: 'user_action_event',
  actors: 'actor',
  primary_actor: 'actor',
  primary_actors: 'actor',
  secondary_actor: 'actor',
  secondary_actors: 'actor',
  user_needs: 'user_need',
  frontstage_touchpoints: 'frontstage_touchpoint',
  business_rule_refs: 'business_rule',
  business_rules: 'business_rule',
  data_in: 'data_input',
  data_out: 'data_output',
  backstage_actors: 'backstage_actor',
  // behaviour_change aliases
  desired_behaviour_change: 'behaviour_change',
  desired_behaviour: 'behaviour_change',
  what_good_looks_like: 'behaviour_change',
  target_behaviour: 'behaviour_change',
  // activity aliases
  activities: 'activity',
  user_activity: 'activity',
  user_activities: 'activity',
  user_task: 'activity',
  user_tasks: 'activity',
  tasks: 'activity',
  // L1 Macro aliases
  pain_points: 'pain_point',
};

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
  const isL1LikeSheet = isL1LikeSheetName(sourceSheet);
  if ((isL1LikeSheet || isL1MacroContext) && (label === 'success_measure' || label === 'success_measures')) {
    return 'performance_indicators';
  }
  if ((isExplicitL1SheetName(sourceSheet) || isL1MacroContext) && (label === 'ideas' || label === 'opportunities' || label === 'opportunities_lane')) {
    return 'opportunities_lane';
  }
  return (SWIMLANE_LANE_ALIASES[label] ?? label) as LaneKey;
}

function getIndefiniteArticle(label: string): 'a' | 'an' {
  return /^[aeiou]/i.test(label.trim()) ? 'an' : 'a';
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
 * Canonical first-column labels recognized in swimlane matrix format.
 * Structural rows (service_name, stage, etc.) and content lane keys.
 */
const SWIMLANE_FIRST_COL_KEYS = new Set([
  'service_name', 'stage', 'stage_outcome', 'step', 'next_step',
  'actor', 'actors', 'primary_actor', 'secondary_actor', 'secondary_actors',
  'primary_actors',
  'user_journeys',
  'user_action', 'user_need', 'user_needs', 'pain_point',
  'frontstage_touchpoint', 'frontstage_touchpoints', 'activity', 'activities',
  'user_activity', 'user_activities', 'user_task', 'user_tasks', 'tasks',
  'backstage_process',
  'description', 'behaviour_change', 'desired_behaviour_change', 'desired_behaviour',
  'what_good_looks_like', 'target_behaviour', 'success_measure', 'motivation', 'ability', 'prompts',
  'system', 'support_system',
  'policy_intent',
  'business_rule', 'business_rule_refs', 'business_rules',
  'data_input', 'data_in', 'data_output', 'data_out',
  'backstage_actor', 'backstage_actors',
  // L1 Macro keys
  'phase', 'policy_reform', 'policy_outcome', 'user_outcome',
  'operational_outcome', 'insights', 'pain_points',
  'impact_of_pain_points', 'performance_indicators',
  'opportunities', 'ideas', 'third_parties_involved',
]);

/**
 * Splits a swimlane cell into individual card texts.
 *
 * Splitting rules (in order):
 *  1. Line breaks (\n, \r\n)
 *  2. Semicolons (;) within a line
 *  3. Bullet prefixes at the start of a segment (-, *, •)
 *
 * Each resulting item is trimmed. Empty items are discarded.
 * Exported so tests can exercise it directly.
 */
export function splitCellItems(cell: string): string[] {
  if (!cell || cell.trim() === '') return [];
  return cell
    .split(/\r?\n/)
    .flatMap((line) => line.split(';'))
    .map((segment) => segment.replace(/^[-\u2022*\s]+/, '').trim())
    .filter(Boolean);
}

/**
 * Parses an optional inline traceability code from the start of a card item.
 *
 * Accepted format:  PREFIX-NNN text…
 * Examples:
 *   "PP-001 Validation unclear"  → { traceabilityCode: "PP-001", text: "Validation unclear" }
 *   "Validation unclear"         → { text: "Validation unclear" }
 *
 * The prefix must be one or more uppercase letters followed by a hyphen and
 * three or more digits. Everything after the first whitespace is the card text.
 *
 * Exported so tests can exercise it directly.
 */
export function parseInlineId(raw: string): { traceabilityCode?: string; text: string } {
  const match = raw.match(/^([A-Z]+-\d{3,})\s+(.+)$/);
  if (match) {
    return { traceabilityCode: match[1], text: match[2].trim() };
  }
  return { text: raw };
}

export function parseLeadingCodeLabel(raw: string): { traceabilityCode?: string; text: string } {
  const match = raw.match(/^([A-Z]+-\d{3,})\s*:\s+(.+)$/);
  if (match) {
    return { traceabilityCode: match[1], text: match[2].trim() };
  }
  return { text: raw };
}

/**
 * Splits merged performance indicator text when a second typed indicator starts
 * mid-string, e.g.:
 *   "% processed consistently... . Efficiency: SPI-007 Time per organisation..."
 */
export function splitEmbeddedTypedLaneItems(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(/(?<=.)\s+(?=[A-Z][A-Za-z\s/-]*:\s+[A-Z]+-\d{3,}\b)/g);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * Some L1 macro lane items are authored with both a type label and a
 * traceability code in the visible text, for example:
 *   "Effectiveness: SPI-001 % of submissions classified correctly..."
 *   "Guidance: WOA-001 Provide clearer step-by-step guidance"
 *
 * We keep the human-readable statement as the card title, preserve the code as
 * traceability, and surface the leading type as a tag.
 */
export function parseTypedTraceableLaneItem(
  raw: string,
): { traceabilityCode?: string; text: string; tags: string[] } {
  const trimmed = raw.trim();
  if (!trimmed) return { text: '', tags: [] };

  const leadingCode = parseLeadingCodeLabel(trimmed);
  if (leadingCode.traceabilityCode) {
    return {
      traceabilityCode: leadingCode.traceabilityCode,
      text: leadingCode.text.trim(),
      tags: [],
    };
  }

  const typeMatch = trimmed.match(/^([A-Za-z][A-Za-z\s/-]*):\s*(.+)$/);
  const typeLabel = typeMatch?.[1]?.trim().toLowerCase();
  const remainder = typeMatch?.[2]?.trim() ?? trimmed;
  const parsed = parseLeadingCodeLabel(remainder).traceabilityCode
    ? parseLeadingCodeLabel(remainder)
    : parseInlineId(remainder);

  return {
    traceabilityCode: parsed.traceabilityCode,
    text: parsed.text.trim(),
    tags: typeLabel ? [typeLabel] : [],
  };
}

/**
 * Builds a normalized empty BlueprintState with the four new arrays included.
 * Used as the base for all three normalizer functions.
 */
function emptyImportState(bpId: string, ts: string, serviceName: string): BlueprintState {
  return {
    blueprint: {
      id: bpId,
      serviceName: serviceName || 'Enter title',
      description: '',
      createdAt: ts,
      updatedAt: ts,
    },
    stages: [],
    steps: [],
    lanes: DEFAULT_LANES.map((l) => ({ ...l })),
    childBlueprints: [],
    rootDocument: null,
    activeBlueprintId: bpId,
    rootBlueprintId: bpId,
    cards: [],
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
  };
}

/**
 * If any card in the state uses an L1-Macro-only lane key, swap the lane
 * definitions to L1_MACRO_LANES so the board renders the correct swimlanes.
 */
function applyLaneSetFromCards(state: BlueprintState): void {
  const hasL1 = state.cards.some((c) => L1_MACRO_LANE_KEYS.has(c.laneKey));
  if (hasL1) {
    state.lanes = L1_MACRO_LANES.map((l) => ({ ...l }));
  }
}

/**
 * Resolves a `next_step` column value to a step ID.
 *
 * Lookup order:
 *  1. SS-NNN traceability code match
 *  2. stage::step composite key match
 *  3. Bare step title within the same stage (warns on ambiguity)
 *
 * Returns the resolved target step ID or null if unresolved.
 */
function resolveNextStep(
  value: string,
  currentStageName: string,
  stepMap: Map<string, Step>,
  warnings: ImportValidationError[],
  rowNum: number,
): Step | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const allSteps = Array.from(stepMap.values());

  // 1. SS-NNN code match
  if (/^SS-\d{3,}$/.test(trimmed)) {
    const match = allSteps.find((s) => s.traceabilityCode === trimmed);
    if (!match) {
      warnings.push({ row: rowNum, field: 'next_step', message: `next_step code "${trimmed}" not found, skipped` });
    }
    return match ?? null;
  }

  // 2. stage::step composite
  if (trimmed.includes('::')) {
    const match = stepMap.get(trimmed);
    if (!match) {
      warnings.push({ row: rowNum, field: 'next_step', message: `next_step "${trimmed}" (stage::step) not found, skipped` });
    }
    return match ?? null;
  }

  // 3. Bare title within same stage
  const candidates = Array.from(stepMap.entries())
    .filter(([key]) => key.startsWith(`${currentStageName}::`) && key.endsWith(`::${trimmed}`))
    .map(([, s]) => s);

  // Also try composite keys that exactly end with ::trimmed
  const exactCandidates = Array.from(stepMap.entries())
    .filter(([key]) => key === `${currentStageName}::${trimmed}`)
    .map(([, s]) => s);

  const resolved = exactCandidates.length > 0 ? exactCandidates : candidates;

  if (resolved.length === 0) {
    warnings.push({ row: rowNum, field: 'next_step', message: `next_step "${trimmed}" not found in stage "${currentStageName}", skipped` });
    return null;
  }
  if (resolved.length > 1) {
    warnings.push({ row: rowNum, field: 'next_step', message: `next_step "${trimmed}" is ambiguous (${resolved.length} matches), using first` });
  }
  return resolved[0];
}

export function normalizeImportRows(
  rows: Record<string, string>[],
  sourceFile: string,
  sourceSheet: string,
  existingCounters?: Record<string, number>,
): ImportResult {
  const errors: ImportValidationError[] = [];
  const warnings: ImportValidationError[] = [];

  const bpId = uuid();
  const ts = new Date().toISOString();
  const srcType = detectSourceType(sourceFile);
  let srcCounters: Record<string, number> = { ...(existingCounters ?? {}) };
  let traceCounters: Record<string, number> = { ...(existingCounters ?? {}) };

  let serviceName = '';
  const stageMap = new Map<string, Stage>();
  const stepMap = new Map<string, Step>();
  const cards: Card[] = [];
  const stepLinkRows: Array<{ rowNum: number; stageName: string; stepKey: string; nextStepValue: string }> = [];

  // -------------------------------------------------------------------------
  // Pass 1 — Build stage/step hierarchy
  // -------------------------------------------------------------------------
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const rowServiceName = safeTrim(row.service_name);
    const stageName = safeTrim(row.stage);
    const stageOrder = safeNum(row.stage_order, 0);
    const stageOutcome = safeTrim(row.stage_outcome);
    const stepName = safeTrim(row.step);
    const stepOrder = safeNum(row.step_order, 0);
    const rowTraceCode = safeTrim(row.traceability_code);
    const recordType = safeTrim(row.record_type).toLowerCase();

    if (rowServiceName && !serviceName) {
      serviceName = rowServiceName;
    }

    if (stageName && !stageMap.has(stageName)) {
      stageMap.set(stageName, {
        id: uuid(),
        blueprintId: bpId,
        title: stageName,
        outcome: stageOutcome,
        order: stageOrder,
        // Preserve imported ST code if provided on a structure row
        traceabilityCode: recordType === 'structure' && rowTraceCode.startsWith('ST-') ? rowTraceCode : undefined,
      });
    } else if (stageName && stageOutcome) {
      const existing = stageMap.get(stageName)!;
      if (!existing.outcome) existing.outcome = stageOutcome;
    }

    const stageObj = stageMap.get(stageName);
    const stepKey = `${stageName}::${stepName}`;
    if (stepName && stageObj && !stepMap.has(stepKey)) {
      stepMap.set(stepKey, {
        id: uuid(),
        blueprintId: bpId,
        stageId: stageObj.id,
        title: stepName,
        order: stepOrder,
        // Preserve imported SS code if provided on a structure row
        traceabilityCode: recordType === 'structure' && rowTraceCode.startsWith('SS-') ? rowTraceCode : undefined,
      });
    }

    // Collect next_step candidates for Pass 3
    const nextStep = safeTrim(row.next_step);
    if (nextStep && stepName) {
      stepLinkRows.push({ rowNum: i + 2, stageName, stepKey, nextStepValue: nextStep });
    }
  }

  // Assign ST codes to stages that don't have one yet
  for (const stage of stageMap.values()) {
    if (!stage.traceabilityCode) {
      const { code, updatedCounters } = generateTraceabilityCode('ST', traceCounters);
      stage.traceabilityCode = code;
      traceCounters = updatedCounters;
    }
  }

  // Assign SS codes to steps that don't have one yet
  for (const step of stepMap.values()) {
    if (!step.traceabilityCode) {
      const { code, updatedCounters } = generateTraceabilityCode('SS', traceCounters);
      step.traceabilityCode = code;
      traceCounters = updatedCounters;
    }
  }

  // -------------------------------------------------------------------------
  // Pass 2 — Create cards
  // -------------------------------------------------------------------------
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    if (isEmptyRow(row)) continue;

    const recordType = safeTrim(row.record_type).toLowerCase();
    if (recordType === 'structure') continue;

    const stageName = safeTrim(row.stage);
    const stepName = safeTrim(row.step);
    const laneKey = safeTrim(row.lane_key).toLowerCase().replace(/\s+/g, '_');
    const cardTitle = safeTrim(row.card_title);
    const cardBody = safeTrim(row.card_body);
    const cardOrder = safeNum(row.card_order, 0);
    const tags = safeTrim(row.tags);
    const sourceRef = safeTrim(row.source_ref);
    const rowTraceCode = safeTrim(row.traceability_code);
    const derivedFromRaw = safeTrim(row.derived_from_ids);

    if (recordType !== 'card' && !(recordType === '' && cardTitle)) continue;

    if (!laneKey) {
      if (cardTitle) {
        warnings.push({ row: rowNum, field: 'lane_key', message: 'Card row missing lane_key, skipped' });
      }
      continue;
    }

    const laneError = validateLaneKey(laneKey, rowNum);
    if (laneError) {
      errors.push(laneError);
      continue;
    }

    if (!cardTitle) {
      warnings.push({ row: rowNum, field: 'card_title', message: 'Card row has no title, skipped' });
      continue;
    }

    const stepKey = `${stageName}::${stepName}`;
    const stepObj = stepMap.get(stepKey);
    const stageObj = stageMap.get(stageName);

    if (!stepObj || !stageObj) {
      errors.push({ row: rowNum, field: 'step', message: `Cannot find step "${stepName}" in stage "${stageName}"` });
      continue;
    }

    // Parse derivedFromIds
    const derivedFromIds = derivedFromRaw
      ? derivedFromRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    // Support "||" delimiter for multiple cards in one cell
    const titleItems = cardTitle.includes('||')
      ? cardTitle.split('||').map((s) => s.trim()).filter(Boolean)
      : [cardTitle];

    titleItems.forEach((itemTitle, idx) => {
      // Assign source provenance ref
      let cardSourceRef = sourceRef;
      if (!cardSourceRef) {
        const { ref, updatedCounters } = generateSourceRef(srcType, srcCounters);
        cardSourceRef = ref;
        srcCounters = updatedCounters;
      }

      // Determine traceability code: use imported code for first item only; generate for splits
      let cardTraceCode: string | undefined;
      if (idx === 0 && rowTraceCode) {
        // Imported code preserved as-is
        cardTraceCode = rowTraceCode;
      } else {
        // Generate from lane prefix
        const prefix = getLanePrefix(laneKey as LaneKey);
        const { code, updatedCounters } = generateTraceabilityCode(prefix, traceCounters);
        cardTraceCode = code;
        traceCounters = updatedCounters;
      }

      cards.push({
        id: uuid(),
        blueprintId: bpId,
        stageId: stageObj.id,
        stepId: stepObj.id,
        laneKey: laneKey as LaneKey,
        title: capitalizeSentenceStart(itemTitle),
        body: idx === 0 ? cardBody : '',
        order: cardOrder + idx,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        sourceFile,
        sourceSheet,
        sourceRow: rowNum,
        sourceRef: cardSourceRef,
        traceabilityCode: cardTraceCode,
        derivedFromIds: idx === 0 ? derivedFromIds : undefined,
        createdAt: ts,
        updatedAt: ts,
      });
    });
  }

  // -------------------------------------------------------------------------
  // Pass 3 — Build StepLink records from next_step column values
  // -------------------------------------------------------------------------
  const stepLinks: StepLink[] = [];

  for (const { rowNum, stageName, stepKey, nextStepValue } of stepLinkRows) {
    const sourceStep = stepMap.get(stepKey);
    if (!sourceStep) continue;

    const targetStep = resolveNextStep(nextStepValue, stageName, stepMap, warnings, rowNum);
    if (!targetStep) continue;

    // Avoid duplicate links
    const alreadyLinked = stepLinks.some(
      (l) => l.sourceStepId === sourceStep.id && l.targetStepId === targetStep.id,
    );
    if (alreadyLinked) continue;

    const { code, updatedCounters } = generateTraceabilityCode('NS', traceCounters);
    traceCounters = updatedCounters;

    stepLinks.push({
      id: uuid(),
      blueprintId: bpId,
      sourceStepId: sourceStep.id,
      targetStepId: targetStep.id,
      traceabilityCode: code,
      createdAt: ts,
    });
  }

  // -------------------------------------------------------------------------
  // Assemble result
  // -------------------------------------------------------------------------
  const stages = Array.from(stageMap.values()).sort((a, b) => a.order - b.order);
  const steps = Array.from(stepMap.values());

  // Separate src counters (SRC_PDF, SRC_CSV, …) from semantic counters (ST, SS, PP, …)
  // srcCounters may contain semantic keys if existingCounters was passed — that's fine,
  // the store merges all of them. We keep them separated in the return value for clarity.
  const semanticKeys = new Set(Object.keys(traceCounters).filter((k) => !k.startsWith('SRC_')));
  const finalTraceCounters: Record<string, number> = {};
  for (const k of semanticKeys) finalTraceCounters[k] = traceCounters[k];

  const finalSrcCounters: Record<string, number> = {};
  for (const [k, v] of Object.entries(srcCounters)) {
    if (k.startsWith('SRC_')) finalSrcCounters[k] = v;
  }

  const state = emptyImportState(bpId, ts, serviceName);
  state.stages = stages;
  state.steps = steps;
  state.cards = cards;
  state.stepLinks = stepLinks;
  state.traceabilityCounters = finalTraceCounters;
  applyLaneSetFromCards(state);

  return {
    state,
    errors,
    warnings,
    srcRefCounters: finalSrcCounters,
    traceabilityCounters: finalTraceCounters,
  };
}

export function normalizeMuralExport(
  rows: Record<string, string>[],
  sourceFile: string,
  sourceSheet: string,
): ImportResult {
  const errors: ImportValidationError[] = [];
  const warnings: ImportValidationError[] = [];

  const bpId = uuid();
  const ts = new Date().toISOString();
  let srcCounters: Record<string, number> = {};

  let serviceName = '';
  const stageMap = new Map<string, Stage>();
  const stepMap = new Map<string, Step>();
  const cards: Card[] = [];

  // Lane number based mapping for the Mural format
  function laneFromNumber(laneNum: number, laneName: string): LaneKey | null {
    const ln = laneName.toLowerCase().trim();
    if (laneNum === 8) return 'user_action_event';
    if (laneNum === 11) return 'user_need';
    if (laneNum === 13) return 'pain_point';
    if (laneNum === 14) return 'frontstage_touchpoint';
    if (laneNum === 16) return 'backstage_process';
    if (laneNum === 18) return 'system';
    if (laneNum === 20) return 'data_input';
    if (ln === 'front-stage actions') return 'backstage_process';
    if (ln === 'back-stage actions') return 'system';
    return null;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const id = safeTrim(row.id);
    const stageNum = safeTrim(row['stage_#'] || row['stage #']);
    const stageLabel = safeTrim(row.stage_label || row['stage label']);
    const laneNum = safeNum(row['lane_#'] || row['lane #'], 0);
    const laneName = safeTrim(row.swim_lane_label || row['swim lane label']);
    const content = safeTrim(row.content);

    if (!content) continue;

    const lnLower = laneName.toLowerCase().trim();

    // Service name
    if (lnLower === 'service name') {
      serviceName = content;
      continue;
    }

    // Stage label
    if (lnLower === 'stages') {
      if (!stageMap.has(stageLabel)) {
        stageMap.set(stageLabel, {
          id: uuid(),
          blueprintId: bpId,
          title: content,
          outcome: '',
          order: safeNum(stageNum, stageMap.size),
        });
      }
      continue;
    }

    // Step
    if (lnLower === 'service steps') {
      const stage = stageMap.get(stageLabel);
      if (stage) {
        const stepKey = `${stageLabel}::${content}`;
        if (!stepMap.has(stepKey)) {
          const stepsInStage = Array.from(stepMap.values()).filter((s) => s.stageId === stage.id);
          stepMap.set(stepKey, {
            id: uuid(),
            blueprintId: bpId,
            stageId: stage.id,
            title: content,
            order: stepsInStage.length,
          });
        }
      }
      continue;
    }

    // Stage outcome
    if (lnLower === 'stage outcomes') {
      const stage = stageMap.get(stageLabel);
      if (stage) {
        stage.outcome = content;
      }
      continue;
    }

    // Card lanes
    const lane = laneFromNumber(laneNum, laneName);
    if (!lane) {
      if (lnLower !== 'service name' && lnLower !== 'stages' && lnLower !== 'service steps' && lnLower !== 'stage outcomes') {
        warnings.push({ row: rowNum, field: 'lane', message: `Unmapped lane "${laneName}" (lane# ${laneNum}), skipped` });
      }
      continue;
    }

    // Find the step for this card — match by stage
    const stage = stageMap.get(stageLabel);
    if (!stage) {
      warnings.push({ row: rowNum, field: 'stage', message: `No stage found for "${stageLabel}"` });
      continue;
    }

    const stepsInStage = Array.from(stepMap.entries())
      .filter(([, s]) => s.stageId === stage.id)
      .map(([, s]) => s);

    const step = stepsInStage[0]; // Mural format has one step per stage typically
    if (!step) {
      warnings.push({ row: rowNum, field: 'step', message: `No step found in stage "${stageLabel}"` });
      continue;
    }

    // Handle "||" delimited multi-cards
    const items = content.includes('||') ? content.split('||').map((s) => s.trim()).filter(Boolean) : [content];
    items.forEach((item, idx) => {
      // Mural rows have a native id — use as sourceRef; generate SRC-MURAL-NNN if absent
      let cardSourceRef = id;
      if (!cardSourceRef) {
        const { ref, updatedCounters } = generateSourceRef('mural', srcCounters);
        cardSourceRef = ref;
        srcCounters = updatedCounters;
      }
      cards.push({
        id: uuid(),
        blueprintId: bpId,
        stageId: stage.id,
        stepId: step.id,
        laneKey: lane,
        title: item,
        body: '',
        order: idx,
        tags: [],
        sourceFile,
        sourceSheet,
        sourceRow: rowNum,
        sourceRef: cardSourceRef,
        createdAt: ts,
        updatedAt: ts,
      });
    });
  }

  const state = emptyImportState(bpId, ts, serviceName);
  state.stages = Array.from(stageMap.values()).sort((a, b) => a.order - b.order);
  state.steps = Array.from(stepMap.values());
  state.cards = cards;
  applyLaneSetFromCards(state);

  return {
    state,
    errors,
    warnings,
    srcRefCounters: srcCounters,
  };
}

export function normalizeSwimlaneMatrix(
  headers: string[],
  rows: Record<string, string>[],
  sourceFile: string,
  sourceSheet: string,
): ImportResult {
  const errors: ImportValidationError[] = [];
  const warnings: ImportValidationError[] = [];

  const bpId = uuid();
  const ts = new Date().toISOString();
  const srcType = detectSourceType(sourceFile);
  let srcCounters: Record<string, number> = {};
  let traceCounters: Record<string, number> = {};

  // ---------------------------------------------------------------------------
  // Derive column keys
  // ---------------------------------------------------------------------------
  const normalizeKey = (h: string) => h.toLowerCase().trim().replace(/\s+/g, '_');
  const laneColKey = normalizeKey(headers[0]); // "swimlane"
  const stepColKeys = headers.slice(1).map(normalizeKey); // ["step_1", "step_2", ...]

  if (stepColKeys.length === 0) {
    errors.push({ row: 0, field: 'headers', message: 'Swimlane matrix has no step columns' });
    return { state: emptyImportState(bpId, ts, ''), errors, warnings };
  }

  // ---------------------------------------------------------------------------
  // Scan rows into metadata buckets and lane rows
  // ---------------------------------------------------------------------------
  let serviceNameRow: Record<string, string> | undefined;
  let stageRow: Record<string, string> | undefined;
  let stageOutcomeRow: Record<string, string> | undefined;
  let stepRow: Record<string, string> | undefined;
  let primaryActorRow: Record<string, string> | undefined;
  let phaseRow: Record<string, string> | undefined;
  let nextStepRow: Record<string, string> | undefined;
  let nextStepRowIndex = 0;
  const laneRows: Array<{ laneKey: LaneKey; sourceTags: string[]; row: Record<string, string>; rowIndex: number }> = [];
  const isL1MacroContext = rows.some((row) => {
    const label = (row[laneColKey] ?? '').trim().toLowerCase().replace(/\s+/g, '_');
    return isL1MacroSwimlaneLabel(label);
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cellVal = (row[laneColKey] ?? '').trim().toLowerCase().replace(/\s+/g, '_');

    if (cellVal === 'service_name') { serviceNameRow = row; continue; }
    if (cellVal === 'phase') { phaseRow = row; continue; }
    if (cellVal === 'stage') { stageRow = row; continue; }
    if (cellVal === 'stage_outcome') { stageOutcomeRow = row; continue; }
    if (cellVal === 'step') { stepRow = row; continue; }
    if (cellVal === 'primary_actor' || cellVal === 'primary_actors') primaryActorRow = row;
    if (cellVal === 'next_step') { nextStepRow = row; nextStepRowIndex = i + 2; continue; }

    if (!cellVal) continue;

    const resolvedLane = resolveSwimlaneLaneKey(cellVal, sourceSheet, isL1MacroContext);
    const laneError = validateLaneKey(resolvedLane, i + 2);
    if (laneError) {
      warnings.push({
        row: i + 2,
        field: 'lane',
        message: `Unknown swimlane label "${row[laneColKey]}", row skipped`,
      });
      continue;
    }

    laneRows.push({
      laneKey: resolvedLane,
      sourceTags: getSwimlaneSourceTags(cellVal),
      row,
      rowIndex: i + 2,
    });
  }

  // ---------------------------------------------------------------------------
  // Extract service name
  // ---------------------------------------------------------------------------
  let serviceName = 'Enter title';
  if (serviceNameRow) {
    for (const colKey of stepColKeys) {
      const val = (serviceNameRow[colKey] ?? '').trim();
      if (val) { serviceName = val; break; }
    }
  }

  // ---------------------------------------------------------------------------
  // Build stage/step structure (one step per column, stages deduplicated by name)
  // ---------------------------------------------------------------------------
  const stageMap = new Map<string, Stage>();
  const stepMap = new Map<string, Step>(); // "stageName::stepTitle" → Step
  const colIndexToStep = new Map<string, Step>(); // stepColKey → Step
  const preservedStepIds = new Set<string>();

  let lastStageName = 'Stage 1';
  let lastPhaseName = '';

  for (const [colIdx, colKey] of stepColKeys.entries()) {
    const originalHeader = headers[colIdx + 1]; // e.g. "Step 1"

    const stageCell = (stageRow?.[colKey] ?? '').trim();
    const stageName = stageCell || lastStageName;
    if (stageCell) lastStageName = stageCell;

    const phaseCell = (phaseRow?.[colKey] ?? '').trim();
    const phaseName = phaseCell || lastPhaseName;
    if (phaseCell) lastPhaseName = phaseCell;
    const phaseVal = phaseName || undefined;
    const stageOutcomeCell = (stageOutcomeRow?.[colKey] ?? '').trim();
    const nextStepCell = (nextStepRow?.[colKey] ?? '').trim();

    let stage = stageMap.get(stageName);
    if (!stage) {
      stage = {
        id: uuid(),
        blueprintId: bpId,
        title: stageName,
        outcome: stageOutcomeCell,
        order: stageMap.size,
        phase: phaseVal,
      };
      stageMap.set(stageName, stage);
    } else {
      if (!stage.outcome && stageOutcomeRow) {
        const outcomeVal = (stageOutcomeRow[colKey] ?? '').trim();
        if (outcomeVal) stage.outcome = outcomeVal;
      }
      if (!stage.phase && phaseVal) stage.phase = phaseVal;
    }

    const rawStepTitle = (stepRow?.[colKey] ?? '').trim();
    const stepTitle = rawStepTitle || (originalHeader.startsWith('_col_') ? stageName : originalHeader);
    const stepKey = `${stageName}::${stepTitle}`;

    let step = stepMap.get(stepKey);
    if (!step) {
      const stepsInStage = Array.from(stepMap.values()).filter((s) => s.stageId === stage!.id);
      step = {
        id: uuid(),
        blueprintId: bpId,
        stageId: stage.id,
        title: stepTitle,
        order: stepsInStage.length,
      };
      stepMap.set(stepKey, step);
    }

    colIndexToStep.set(colKey, step);

    // Preserve columns that are structurally meaningful even when no cards land in them.
    // This keeps explicitly-authored lifecycle stages and phases visible in the board.
    if (stageCell || phaseCell || stageOutcomeCell || rawStepTitle || nextStepCell) {
      preservedStepIds.add(step.id);
    }
  }

  // ---------------------------------------------------------------------------
  // Create cards from lane rows × step columns
  // ---------------------------------------------------------------------------
  const cards: Card[] = [];

  // Track assigned traceability codes → card title for duplicate detection.
  // code → first title seen with that code
  const seenCodes = new Map<string, string>();

  for (const { laneKey, sourceTags, row, rowIndex } of laneRows) {
    for (const colKey of stepColKeys) {
      const cellValue = (row[colKey] ?? '').trim();
      const step = colIndexToStep.get(colKey);
      if (!step) continue;

      const stage = Array.from(stageMap.values()).find((s) => s.id === step.stageId);
      if (!stage) continue;

      const items = splitCellItems(cellValue);
      if (items.length === 0) continue;

      const normalizedItems = laneKey === 'performance_indicators'
        ? items.flatMap((item) => splitEmbeddedTypedLaneItems(item))
        : items;

      normalizedItems.forEach((rawItem, idx) => {
        // Some L1 macro lanes may carry both a type label and a traceability code.
        const parsedItem = laneKey === 'performance_indicators' || laneKey === 'opportunities_lane'
          ? parseTypedTraceableLaneItem(rawItem)
          : { ...parseInlineId(rawItem), tags: [] as string[] };
        const { traceabilityCode: inlineCode, text: itemTitle, tags: parsedTags } = parsedItem;
        const primaryActor = (primaryActorRow?.[colKey] ?? '').trim();
        const resolvedTitle = laneKey === 'user_need'
          ? qualifyUserNeedWithActor(itemTitle, primaryActor)
          : capitalizeSentenceStart(itemTitle);

        const { ref, updatedCounters: sc } = generateSourceRef(srcType, srcCounters);
        srcCounters = sc;

        let cardTraceCode: string;

        if (inlineCode) {
          const previous = seenCodes.get(inlineCode);
          if (previous !== undefined) {
            if (previous !== itemTitle) {
              // Same code, different text → error (conflicting IDs)
              errors.push({
                row: rowIndex,
                field: 'traceability_code',
                message: `Duplicate ID "${inlineCode}" with conflicting text: previously "${previous}", now "${itemTitle}"`,
              });
            } else {
              // Same code, same text → warn (exact duplicate)
              warnings.push({
                row: rowIndex,
                field: 'traceability_code',
                message: `Duplicate ID "${inlineCode}" ("${itemTitle}") — card imported once`,
              });
              return; // skip exact duplicates
            }
          }
          seenCodes.set(inlineCode, itemTitle);
          cardTraceCode = inlineCode;
        } else {
          const prefix = getLanePrefix(laneKey);
          const { code, updatedCounters: tc } = generateTraceabilityCode(prefix, traceCounters);
          traceCounters = tc;
          cardTraceCode = code;
          seenCodes.set(cardTraceCode, itemTitle);
        }

        cards.push({
          id: uuid(),
          blueprintId: bpId,
          stageId: stage.id,
          stepId: step.id,
          laneKey,
          title: capitalizeSentenceStart(resolvedTitle),
          body: '',
          order: idx,
          tags: Array.from(new Set([...sourceTags, ...parsedTags])),
          sourceFile,
          sourceSheet,
          sourceRow: rowIndex,
          sourceRef: ref,
          traceabilityCode: cardTraceCode,
          createdAt: ts,
          updatedAt: ts,
        });
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Remove empty step columns (template columns with no card content)
  // ---------------------------------------------------------------------------
  const stepsWithCards = new Set(cards.map((c) => c.stepId));
  for (const [key, step] of stepMap) {
    if (!stepsWithCards.has(step.id) && !preservedStepIds.has(step.id)) {
      stepMap.delete(key);
      for (const [ck, s] of colIndexToStep) {
        if (s.id === step.id) colIndexToStep.delete(ck);
      }
    }
  }

  // Assign ST codes to stages
  for (const stage of stageMap.values()) {
    const { code, updatedCounters } = generateTraceabilityCode('ST', traceCounters);
    stage.traceabilityCode = code;
    traceCounters = updatedCounters;
  }

  // Assign SS codes to steps (only those that survived pruning)
  for (const step of stepMap.values()) {
    const { code, updatedCounters } = generateTraceabilityCode('SS', traceCounters);
    step.traceabilityCode = code;
    traceCounters = updatedCounters;
  }

  // ---------------------------------------------------------------------------
  // Build StepLink records from next_step row
  // ---------------------------------------------------------------------------
  const stepLinks: StepLink[] = [];

  if (nextStepRow) {
    for (const colKey of stepColKeys) {
      const nextStepValue = (nextStepRow[colKey] ?? '').trim();
      if (!nextStepValue) continue;

      const sourceStep = colIndexToStep.get(colKey);
      if (!sourceStep) continue;

      const sourceStageName =
        Array.from(stageMap.entries()).find(([, s]) => s.id === sourceStep.stageId)?.[0] ?? '';

      const targetStep = resolveNextStep(nextStepValue, sourceStageName, stepMap, warnings, nextStepRowIndex);
      if (!targetStep) continue;

      const alreadyLinked = stepLinks.some(
        (l) => l.sourceStepId === sourceStep.id && l.targetStepId === targetStep.id,
      );
      if (alreadyLinked) continue;

      const { code, updatedCounters } = generateTraceabilityCode('NS', traceCounters);
      traceCounters = updatedCounters;

      stepLinks.push({
        id: uuid(),
        blueprintId: bpId,
        sourceStepId: sourceStep.id,
        targetStepId: targetStep.id,
        traceabilityCode: code,
        createdAt: ts,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Assemble result
  // ---------------------------------------------------------------------------
  const stages = Array.from(stageMap.values()).sort((a, b) => a.order - b.order);
  const steps = Array.from(stepMap.values());

  const semanticKeys = new Set(Object.keys(traceCounters).filter((k) => !k.startsWith('SRC_')));
  const finalTraceCounters: Record<string, number> = {};
  for (const k of semanticKeys) finalTraceCounters[k] = traceCounters[k];

  const finalSrcCounters: Record<string, number> = {};
  for (const [k, v] of Object.entries(srcCounters)) {
    if (k.startsWith('SRC_')) finalSrcCounters[k] = v;
  }

  const state = emptyImportState(bpId, ts, serviceName);
  state.stages = stages;
  state.steps = steps;
  state.cards = cards;
  state.stepLinks = stepLinks;
  state.traceabilityCounters = finalTraceCounters;
  applyLaneSetFromCards(state);

  return {
    state,
    errors,
    warnings,
    srcRefCounters: finalSrcCounters,
    traceabilityCounters: finalTraceCounters,
  };
}

/**
 * Detects the spreadsheet format from headers and optional data rows.
 *
 * Priority order:
 *  1. template  — has `record_type` AND `lane_key` columns
 *  2. mural     — has `swim_lane_label` AND `stage_label` columns
 *  3. swimlane  — first column of data rows contains known lane/structural keys
 *                 AND there is at least one non-empty step header after the first cell
 *                 (also matches legacy format where header[0] === 'swimlane')
 *  4. unknown
 *
 * @param headers  Normalized header row (first row of the sheet).
 * @param rows     Parsed data rows. Required for reliable swimlane detection.
 */
// =============================================================================
// Multi-tab workbook import
// =============================================================================

/**
 * Known tab names for the structured multi-tab format.
 * Detection is case-insensitive and requires ≥2 matches to trigger.
 */
export const MULTI_TAB_SHEET_NAMES = ['service', 'stages', 'actors', 'business rules', 'blueprint'] as const;

/**
 * Returns true when the workbook appears to use the structured multi-tab format
 * (Service / Stages / Actors / Business Rules / Blueprint tabs).
 * Requires the 'stages' tab to be present (it drives stage/step structure)
 * and at least one other recognised tab.
 */
export function detectMultiTabWorkbook(sheetNames: string[]): boolean {
  const norm = sheetNames.map((n) => n.toLowerCase().trim());
  if (!norm.includes('stages')) return false;
  return MULTI_TAB_SHEET_NAMES.filter((t) => norm.includes(t)).length >= 2;
}

/**
 * Converts an XLSX worksheet to an array of row objects.
 * Header row keys are lower-cased and spaces replaced with underscores.
 * Kept private — used only by normalizeMultiTabBlueprint to avoid circular
 * deps with parse.ts which has its own copy.
 */
function multiTabSheetRows(ws: XLSX.WorkSheet): Record<string, string>[] {
  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
  if (raw.length < 2) return [];
  const headers = (raw[0] as string[]).map((h) => String(h).trim().toLowerCase().replace(/\s+/g, '_'));
  return (raw.slice(1) as string[][]).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = String(row[i] ?? '').trim();
    });
    return obj;
  });
}

/** Finds a sheet by trying candidate names case-insensitively. */
function findSheet(wb: XLSX.WorkBook, candidates: string[]): XLSX.WorkSheet | null {
  for (const candidate of candidates) {
    const match = wb.SheetNames.find((n) => n.toLowerCase().trim() === candidate.toLowerCase());
    if (match) return wb.Sheets[match];
  }
  return null;
}

/**
 * Imports all five structured tabs (Service, Stages, Actors, Business Rules, Blueprint)
 * into a single BlueprintState. Stage column headers in the Blueprint tab are resolved
 * to proper stage names from the Stages tab so cards are placed under real stage titles.
 */
export function normalizeMultiTabBlueprint(
  workbook: XLSX.WorkBook,
  sourceFile: string,
): ImportResult {
  const bpId = uuid();
  const ts = new Date().toISOString();
  const errors: ImportValidationError[] = [];
  const warnings: ImportValidationError[] = [];
  let traceCounters: Record<string, number> = {};
  let srcCounters: Record<string, number> = {};

  // ── Service tab ────────────────────────────────────────────────────────────
  let serviceName = 'Enter title';
  let description = '';
  const serviceSheet = findSheet(workbook, ['service']);
  if (serviceSheet) {
    const rows = multiTabSheetRows(serviceSheet).filter((r) => Object.values(r).some(Boolean));
    if (rows[0]) {
      serviceName = rows[0]['service_name'] || serviceName;
      description = rows[0]['description'] || '';
    }
  } else {
    warnings.push({ row: 0, field: 'sheet', message: 'Service tab not found — using default service name' });
  }

  // ── Stages tab ─────────────────────────────────────────────────────────────
  const stagesSheet = findSheet(workbook, ['stages']);
  if (!stagesSheet) {
    errors.push({ row: 0, field: 'sheet', message: 'Stages tab not found — cannot resolve stage names' });
    const state = emptyImportState(bpId, ts, serviceName);
    state.blueprint.description = description;
    return { state, errors, warnings };
  }

  const stageById = new Map<string, Stage>();   // "STG-01" → Stage (for Blueprint tab headers)
  const stageByName = new Map<string, Stage>(); // lowercase name → Stage (for Business Rules tab)
  const stages: Stage[] = [];

  const stageRows = multiTabSheetRows(stagesSheet).filter((r) => r['stage_id'] || r['stage_name']);
  const sortedStageRows = [...stageRows].sort((a, b) => {
    const na = parseInt(a['stage_number'] || '0', 10) || 0;
    const nb = parseInt(b['stage_number'] || '0', 10) || 0;
    return na - nb;
  });

  sortedStageRows.forEach((row, i) => {
    const stageId = row['stage_id']?.toUpperCase().trim();
    const stageName = row['stage_name']?.trim() || stageId || `Stage ${i + 1}`;
    if (!stageName) return;
    if (stageById.has(stageId)) {
      warnings.push({ row: i + 2, field: 'stage_id', message: `Duplicate stage_id "${stageId}" — first occurrence used` });
      return;
    }

    const { code: stCode, updatedCounters: tc } = generateTraceabilityCode('ST', traceCounters);
    traceCounters = tc;

    const stage: Stage = {
      id: uuid(),
      blueprintId: bpId,
      title: stageName,
      outcome: row['stage_outcome']?.trim() || '',
      order: i,
      traceabilityCode: stCode,
    };

    stages.push(stage);
    if (stageId) stageById.set(stageId, stage);
    stageByName.set(stageName.toLowerCase(), stage);
  });

  // ── Default Steps (one per Stage) ─────────────────────────────────────────
  const steps: Step[] = [];
  const stepByStageId = new Map<string, Step>(); // stageId → default Step

  for (const stage of stages) {
    const { code: ssCode, updatedCounters: tc } = generateTraceabilityCode('SS', traceCounters);
    traceCounters = tc;

    const step: Step = {
      id: uuid(),
      blueprintId: bpId,
      stageId: stage.id,
      title: stage.title,
      order: 0,
      traceabilityCode: ssCode,
    };
    steps.push(step);
    stepByStageId.set(stage.id, step);
  }

  // ── Actors tab ─────────────────────────────────────────────────────────────
  const actorCards: Card[] = [];
  const actorsSheet = findSheet(workbook, ['actors']);
  if (actorsSheet && stages.length > 0) {
    const firstStage = stages[0];
    const firstStep = stepByStageId.get(firstStage.id)!;
    const actorRows = multiTabSheetRows(actorsSheet).filter((r) => r['actor_name']);
    warnings.push({
      row: 0,
      field: 'actors',
      message: `Actor cards placed in stage 1 ("${firstStage.title}"). Drag to other stages as needed.`,
    });

    actorRows.forEach((row, i) => {
      const bodyParts = [row['description']?.trim(), row['goals']?.trim() ? `Goals: ${row['goals'].trim()}` : ''].filter(Boolean);
      const tags = row['actor_type']?.trim() ? [row['actor_type'].trim()] : [];

      const { ref, updatedCounters: sc } = generateSourceRef('xlsx', srcCounters);
      srcCounters = sc;
      const { code, updatedCounters: tc } = generateTraceabilityCode(getLanePrefix('actor'), traceCounters);
      traceCounters = tc;

      actorCards.push({
        id: uuid(),
        blueprintId: bpId,
        stageId: firstStage.id,
        stepId: firstStep.id,
        laneKey: 'actor',
        title: row['actor_name']?.trim() || `Actor ${i + 1}`,
        body: bodyParts.join('\n\n'),
        order: i,
        tags,
        sourceFile,
        sourceSheet: 'Actors',
        sourceRow: i + 2,
        sourceRef: ref,
        traceabilityCode: code,
        createdAt: ts,
        updatedAt: ts,
      });
    });
  } else if (!actorsSheet) {
    warnings.push({ row: 0, field: 'sheet', message: 'Actors tab not found — actor cards skipped' });
  }

  // ── Blueprint tab ──────────────────────────────────────────────────────────
  const matrixCards: Card[] = [];
  const blueprintSheet = findSheet(workbook, ['blueprint']);
  if (blueprintSheet) {
    const raw = XLSX.utils.sheet_to_json<string[]>(blueprintSheet, { header: 1, defval: '' }) as string[][];
    if (raw.length >= 2) {
      const rawHeaders = raw[0].map((h) => String(h).trim());
      // First col is the swimlane label column; remaining are stage ID references
      const stageColHeaders = rawHeaders.slice(1);
      const resolvedStageForCol: (Stage | null)[] = stageColHeaders.map((hdr) => {
        const key = hdr.toUpperCase().trim();
        const stage = stageById.get(key) ?? null;
        if (!stage && hdr.trim()) {
          warnings.push({
            row: 1,
            field: 'blueprint_header',
            message: `Blueprint column "${hdr}" does not match any stage_id — column skipped`,
          });
        }
        return stage;
      });

      const STRUCTURAL_KEYS = new Set(['stage', 'stage_outcome', 'step', 'service_name', 'next_step', 'phase']);
      const primaryActorMatrixRow = raw
        .slice(1)
        .find((row) => String(row[0] ?? '').trim().toLowerCase().replace(/\s+/g, '_') === 'primary_actor');

      const phaseMatrixRow = raw
        .slice(1)
        .find((row) => String(row[0] ?? '').trim().toLowerCase().replace(/\s+/g, '_') === 'phase');
      if (phaseMatrixRow) {
        stageColHeaders.forEach((_, colIdx) => {
          const stage = resolvedStageForCol[colIdx];
          if (!stage) return;
          const val = String(phaseMatrixRow[colIdx + 1] ?? '').trim();
          if (val && !stage.phase) stage.phase = val;
        });
      }

      raw.slice(1).forEach((row, rowIdx) => {
        const firstCell = String(row[0] ?? '').trim().toLowerCase().replace(/\s+/g, '_');
        if (!firstCell) return;
        if (STRUCTURAL_KEYS.has(firstCell)) return;

        // Resolve lane key
        const resolvedLaneKey =
          firstCell === 'opportunities' || firstCell === 'ideas'
            ? 'opportunities_lane'
            : resolveSwimlaneLaneKey(firstCell, 'Blueprint');
        if (validateLaneKey(resolvedLaneKey, rowIdx + 2) !== null) return;
        const laneKey = resolvedLaneKey as LaneKey;
        const sourceTags = getSwimlaneSourceTags(firstCell);

        stageColHeaders.forEach((_, colIdx) => {
          const stage = resolvedStageForCol[colIdx];
          if (!stage) return;
          const step = stepByStageId.get(stage.id);
          if (!step) return;

          const cellValue = String(row[colIdx + 1] ?? '').trim();
          if (!cellValue) return;

          const items = splitCellItems(cellValue);
          const normalizedItems = laneKey === 'performance_indicators'
            ? items.flatMap((item) => splitEmbeddedTypedLaneItems(item))
            : items;
          normalizedItems.forEach((rawItem, itemIdx) => {
            const parsedItem = laneKey === 'performance_indicators' || laneKey === 'opportunities_lane'
              ? parseTypedTraceableLaneItem(rawItem)
              : { ...parseInlineId(rawItem), tags: [] as string[] };
            const { traceabilityCode: inlineCode, text: itemTitle, tags: parsedTags } = parsedItem;
            if (!itemTitle) return;
            const primaryActor = String(primaryActorMatrixRow?.[colIdx + 1] ?? '').trim();
            const resolvedTitle = laneKey === 'user_need'
              ? qualifyUserNeedWithActor(itemTitle, primaryActor)
              : capitalizeSentenceStart(itemTitle);

            const { ref, updatedCounters: sc } = generateSourceRef('xlsx', srcCounters);
            srcCounters = sc;

            let cardTraceCode: string;
            if (inlineCode) {
              cardTraceCode = inlineCode;
            } else {
              const { code, updatedCounters: tc } = generateTraceabilityCode(getLanePrefix(laneKey), traceCounters);
              traceCounters = tc;
              cardTraceCode = code;
            }

            matrixCards.push({
              id: uuid(),
              blueprintId: bpId,
              stageId: stage.id,
              stepId: step.id,
              laneKey,
              title: capitalizeSentenceStart(resolvedTitle),
              body: '',
              order: itemIdx,
              tags: Array.from(new Set([...sourceTags, ...parsedTags])),
              sourceFile,
              sourceSheet: 'Blueprint',
              sourceRow: rowIdx + 2,
              sourceRef: ref,
              traceabilityCode: cardTraceCode,
              createdAt: ts,
              updatedAt: ts,
            });
          });
        });
      });
    }
  } else {
    warnings.push({ row: 0, field: 'sheet', message: 'Blueprint tab not found — swimlane cards skipped' });
  }

  // ── Business Rules tab ─────────────────────────────────────────────────────
  const bizRuleCards: Card[] = [];
  const bizSheet = findSheet(workbook, ['business rules', 'business_rules']);
  if (bizSheet) {
    const bizRows = multiTabSheetRows(bizSheet).filter((r) => r['description']);
    bizRows.forEach((row, i) => {
      const stageNameRaw = row['stage_name']?.trim() ?? '';
      const stage = stageByName.get(stageNameRaw.toLowerCase()) ?? null;
      if (!stage) {
        if (stageNameRaw) {
          warnings.push({
            row: i + 2,
            field: 'stage_name',
            message: `Business rule row ${i + 2}: stage_name "${stageNameRaw}" not found — row skipped`,
          });
        }
        return;
      }
      const step = stepByStageId.get(stage.id);
      if (!step) return;

      const desc = row['description'].trim();
      const title = desc.length > 80 ? desc.slice(0, desc.indexOf(' ', 70) + 1 || 80).trim() : desc;
      const tags = row['actor_id']?.trim() ? [row['actor_id'].trim()] : [];

      const { ref, updatedCounters: sc } = generateSourceRef('xlsx', srcCounters);
      srcCounters = sc;
      const { code, updatedCounters: tc } = generateTraceabilityCode(getLanePrefix('business_rule'), traceCounters);
      traceCounters = tc;

      bizRuleCards.push({
        id: uuid(),
        blueprintId: bpId,
        stageId: stage.id,
        stepId: step.id,
        laneKey: 'business_rule',
        title,
        body: desc,
        order: i,
        tags,
        sourceFile,
        sourceSheet: 'Business Rules',
        sourceRow: i + 2,
        sourceRef: ref,
        traceabilityCode: code,
        createdAt: ts,
        updatedAt: ts,
      });
    });
  } else {
    warnings.push({ row: 0, field: 'sheet', message: 'Business Rules tab not found — business rule cards skipped' });
  }

  // ── Assemble ───────────────────────────────────────────────────────────────
  const state = emptyImportState(bpId, ts, serviceName);
  state.blueprint.description = description;
  state.stages = stages;
  state.steps = steps;
  state.cards = [...actorCards, ...matrixCards, ...bizRuleCards];
  state.traceabilityCounters = traceCounters;
  applyLaneSetFromCards(state);

  const finalSrcCounters: Record<string, number> = {};
  for (const [k, v] of Object.entries(srcCounters)) {
    if (k.startsWith('SRC_')) finalSrcCounters[k] = v;
  }

  return { state, errors, warnings, srcRefCounters: finalSrcCounters, traceabilityCounters: traceCounters };
}

export function detectFormat(
  headers: string[],
  rows?: Record<string, string>[],
): 'template' | 'mural' | 'swimlane' | 'unknown' {
  const normalized = headers.map((h) => h.toLowerCase().trim().replace(/\s+/g, '_'));

  if (normalized.includes('record_type') && normalized.includes('lane_key')) {
    return 'template';
  }
  if (normalized.includes('swim_lane_label') && normalized.includes('stage_label')) {
    return 'mural';
  }

  // Swimlane matrix: at least one step-column header after the first cell …
  const hasStepHeaders = normalized.slice(1).some(Boolean);
  if (hasStepHeaders) {
    // … and the first column of data rows contains known lane/structural keys.
    const firstColKey = normalized[0];
    const firstColValues = (rows ?? []).map((r) =>
      (r[firstColKey] ?? '').toLowerCase().trim().replace(/\s+/g, '_'),
    );
    const hasLaneRows = firstColValues.some((v) => SWIMLANE_FIRST_COL_KEYS.has(v));

    // Also accept the legacy explicit label for backwards compatibility.
    const legacyLabel = firstColKey === 'swimlane';

    if (hasLaneRows || legacyLabel) {
      return 'swimlane';
    }
  }

  return 'unknown';
}
