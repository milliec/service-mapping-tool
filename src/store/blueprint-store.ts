import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
  type ApiContract,
  type ArtifactStatus,
  type Assumption,
  type AssumptionStatus,
  type Blueprint,
  type BlueprintState,
  type Card,
  type CardLink,
  type Evidence,
  type EvidenceType,
  type EvidenceStrength,
  type LaneDefinition,
  type LaneKey,
  type LinkRelation,
  type Opportunity,
  type OpportunityStatus,
  type Requirement,
  type Solution,
  type SolutionStatus,
  type Stage,
  type Step,
  type StepLink,
  type StoryboardImage,
  type UiScaffold,
  type StrategicGoal,
  type Outcome,
} from '@/lib/types';
import { useLibraryStore } from '@/store/library-store';
import {
  createRequirementFromOpportunity,
  createApiContractFromRequirement,
  createUiScaffoldFromRequirementAndApi,
} from '@/lib/traceability/downstream';
import { DEFAULT_LANES, L1_MACRO_LANES, L1_MACRO_LANE_KEYS, L3_LANE_KEYS } from '@/lib/lane-definitions';
import { createSeedBlueprint } from '@/lib/seed-data';
import { getLanePrefix } from '@/lib/traceability/registry';
import { generateTraceabilityCode } from '@/lib/traceability/service';

const STORAGE_KEY = 'service-blueprint-data';
const HISTORY_LIMIT = 50;

function now() {
  return new Date().toISOString();
}

function shouldForceLaneVisible(_key: LaneKey) {
  return false;
}

function isChildJourneyOpen(state: BlueprintState) {
  return Boolean(state.rootDocument && state.activeBlueprintId && state.rootBlueprintId && state.activeBlueprintId !== state.rootBlueprintId);
}

function upsertChildBlueprint(state: BlueprintState, child: BlueprintState): BlueprintState[] {
  const next = (state.childBlueprints ?? []).filter((doc) => doc.blueprint.id !== child.blueprint.id);
  return [...next, child];
}

function loadFromStorage(): BlueprintState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BlueprintState;
  } catch {
    return null;
  }
}

function saveToStorage(state: BlueprintState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[service-blueprint] Could not save to localStorage (quota or private mode).', e);
  }
}

function pickBaseLanes(state: BlueprintState) {
  const hasL1 = (state.lanes ?? []).some((l) => L1_MACRO_LANE_KEYS.has(l.key))
    || (state.cards ?? []).some((c) => L1_MACRO_LANE_KEYS.has(c.laneKey));
  return hasL1 ? L1_MACRO_LANES : DEFAULT_LANES;
}

function applyL3LaneVisibility(lanes: LaneDefinition[]): LaneDefinition[] {
  const existingByKey = new Map(lanes.map((lane) => [lane.key, lane]));
  const l3Keys = new Set<LaneKey>(L3_LANE_KEYS);
  const orderedDefaults = [
    ...L3_LANE_KEYS
      .map((key) => DEFAULT_LANES.find((lane) => lane.key === key))
      .filter((lane): lane is LaneDefinition => Boolean(lane)),
    ...DEFAULT_LANES.filter((lane) => !l3Keys.has(lane.key)),
  ];

  return orderedDefaults.map((defaultLane, order) => {
    const existingLane = existingByKey.get(defaultLane.key);
    return {
      ...defaultLane,
      ...existingLane,
      title: defaultLane.title,
      order,
      // Respect toggles from the lanes menu; only force visibility for lanes that
      // must always show (e.g. user_journey). Do not set all L3 keys visible —
      // that broke every return to L3 after normalizeState / openJourneySpan.
      visible: shouldForceLaneVisible(defaultLane.key)
        ? true
        : (existingLane?.visible ?? defaultLane.visible),
      collapsed: existingLane?.collapsed ?? defaultLane.collapsed,
    };
  });
}

function sanitizeTypedTraceableLaneCard(card: Card): Card {
  if (card.laneKey !== 'performance_indicators' && card.laneKey !== 'opportunities_lane') return card;

  const trimmedTitle = card.title.trim();
  const leadingCodeMatch = trimmedTitle.match(/^([A-Z]+-\d{3,})\s*:\s+(.+)$/);
  if (leadingCodeMatch) {
    return {
      ...card,
      title: leadingCodeMatch[2].trim(),
    };
  }

  const typeMatch = trimmedTitle.match(/^([A-Za-z][A-Za-z\s/-]*):\s*(.+)$/);
  const typeLabel = typeMatch?.[1]?.trim().toLowerCase();
  const remainder = typeMatch?.[2]?.trim() ?? trimmedTitle;
  const inlineCodeMatch = remainder.match(/^([A-Z]+-\d{3,})(?:\s+|:\s+)(.+)$/);
  const cleanedTitle = inlineCodeMatch?.[2]?.trim() ?? remainder;

  if (!cleanedTitle || cleanedTitle === card.title.trim()) {
    if (!typeLabel || card.tags.includes(typeLabel)) return card;
    return { ...card, tags: [...card.tags, typeLabel] };
  }

  return {
    ...card,
    title: cleanedTitle,
    tags: typeLabel && !card.tags.includes(typeLabel)
      ? [...card.tags, typeLabel]
      : card.tags,
  };
}

function expandMergedTypedTraceableCards(cards: Card[]): Card[] {
  const expanded: Card[] = [];

  cards.forEach((card) => {
    if (card.laneKey !== 'performance_indicators') {
      expanded.push(card);
      return;
    }

    const parts = card.title
      .trim()
      .split(/(?<=.)\s+(?=[A-Z][A-Za-z\s/-]*:\s+[A-Z]+-\d{3,}\b)/g)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length <= 1) {
      expanded.push(card);
      return;
    }

    expanded.push({ ...card, title: parts[0] });
    parts.slice(1).forEach((part, index) => {
      const leadingCodeMatch = part.match(/^([A-Za-z][A-Za-z\s/-]*):\s+([A-Z]+-\d{3,})\s+(.+)$/);
      expanded.push({
        ...card,
        id: uuid(),
        title: leadingCodeMatch?.[3]?.trim() ?? part,
        traceabilityCode: leadingCodeMatch?.[2] ?? card.traceabilityCode,
        tags: leadingCodeMatch?.[1]
          ? Array.from(new Set([...card.tags, leadingCodeMatch[1].trim().toLowerCase()]))
          : card.tags,
        order: card.order + index + 1,
      });
    });
  });

  return expanded;
}

const TRACEABILITY_CODE_PATTERN = /\b[A-Z]{1,5}-\d{3,}\b/g;

function getTraceabilityCodesFromText(value: string): string[] {
  return Array.from(new Set(value.match(TRACEABILITY_CODE_PATTERN) ?? []));
}

function isStandaloneTraceabilityCodeCard(card: Card): boolean {
  const value = `${card.title} ${card.body}`.trim();
  if (!value || getTraceabilityCodesFromText(value).length === 0) return false;
  return value
    .replace(TRACEABILITY_CODE_PATTERN, '')
    .replace(/[,\s.;:[\]()]+/g, '')
    .trim() === '';
}

function migrateStandaloneBehaviourChangeRollupCards(cards: Card[]): Card[] {
  const removedIds = new Set<string>();
  const codesByTargetId = new Map<string, string[]>();

  const behaviourChangeCards = cards.filter((card) => card.laneKey === 'behaviour_change');
  const standaloneCards = behaviourChangeCards.filter(isStandaloneTraceabilityCodeCard);

  for (const standalone of standaloneCards) {
    const codes = getTraceabilityCodesFromText(`${standalone.title} ${standalone.body}`);
    if (codes.length === 0) continue;

    const siblingTargets = behaviourChangeCards
      .filter((candidate) =>
        candidate.id !== standalone.id &&
        candidate.stepId === standalone.stepId &&
        !isStandaloneTraceabilityCodeCard(candidate),
      )
      .sort((a, b) => a.order - b.order);

    const target =
      siblingTargets.find((candidate) =>
        codes.some((code) => `${candidate.title} ${candidate.body}`.includes(code)),
      ) ?? siblingTargets[0];

    if (!target) continue;

    removedIds.add(standalone.id);
    codesByTargetId.set(target.id, [
      ...(codesByTargetId.get(target.id) ?? []),
      ...codes,
    ]);
  }

  if (removedIds.size === 0 && codesByTargetId.size === 0) return cards;

  return cards
    .filter((card) => !removedIds.has(card.id))
    .map((card) => {
      const codes = codesByTargetId.get(card.id);
      if (!codes?.length) return card;
      return {
        ...card,
        derivedFromIds: Array.from(new Set([...(card.derivedFromIds ?? []), ...codes])),
      };
    });
}

function removeAreaReferenceBehaviourChangeCards(cards: Card[]): Card[] {
  return cards.filter((card) => {
    if (card.laneKey !== 'behaviour_change') return true;
    return !/^areas?\s+[a-z](?:\s*,\s*[a-z])*(?:\s*(?:and|&)\s*[a-z])?(?:\b|[.:;-])/i.test(card.title.trim());
  });
}

function removeEvidenceReferencePainPointCards(cards: Card[]): Card[] {
  return cards.filter((card) => {
    if (card.laneKey !== 'pain_point') return true;
    const value = `${card.title} ${card.body}`.trim();
    if (!/\bE-\d{3,}\b/i.test(value)) return true;
    return value
      .replace(/\bE-\d{3,}\b/gi, '')
      .replace(/[,\s.;:[\]()]+/g, '')
      .trim() !== '';
  });
}

function stripOpportunityTraceText(card: Card): Card {
  if (card.laneKey !== 'opportunities' && card.laneKey !== 'opportunities_lane') return card;
  const stripTrace = (value: string) =>
    value
      .replace(/(?:\s+|\n)*Trace:\s*OPP-\d{3,}(?:\s*\/\s*(?:OPP-)?\d{3,})*\.?\s*$/i, '')
      .trim();
  return {
    ...card,
    title: stripTrace(card.title),
    body: stripTrace(card.body),
  };
}

function stripRollupText(card: Card): Card {
  const prefix = card.laneKey === 'user_need' ? 'UN' : card.laneKey === 'pain_point' ? 'PP' : null;
  if (!prefix) return card;
  const pattern = new RegExp(`\\s*\\[Rolls up\\s+((?:${prefix}-\\d{3,})(?:\\s*,\\s*${prefix}-\\d{3,})*)\\]?\\s*$`, 'i');
  const match = card.title.match(pattern);
  if (!match) return card;
  const rollupCodes = match[1].match(new RegExp(`\\b${prefix}-\\d{3,}\\b`, 'g')) ?? [];
  return {
    ...card,
    title: card.title.slice(0, match.index).trim(),
    derivedFromIds: Array.from(new Set([...(card.derivedFromIds ?? []), ...rollupCodes])),
  };
}

function stripBehaviourChangeEvidenceBasis(card: Card): Card {
  if (card.laneKey !== 'behaviour_change') return card;
  const evidencePattern = /\s*Evidence basis[^.?!]*(?:UN|PP)-\d{3,}[^.?!]*[.?!]?/i;
  const match = card.title.match(evidencePattern);
  if (!match) return card;
  const evidenceText = match[0];
  const evidenceCodes = evidenceText.match(/\b(?:UN|PP)-\d{3,}\b/g) ?? [];
  return {
    ...card,
    title: card.title.replace(evidencePattern, '').replace(/\s{2,}/g, ' ').trim(),
    derivedFromIds: Array.from(new Set([...(card.derivedFromIds ?? []), ...evidenceCodes])),
  };
}

function stripSuccessMeasureReferenceText(card: Card): Card {
  if (card.laneKey !== 'success_measure') return card;
  const pattern = /(?:^|\s+)((?:PP-\d{3,})(?:\s*,\s*PP-\d{3,})*)\.?\s*$/i;
  const match = card.title.match(pattern);
  if (!match) return card;
  const evidenceCodes = match[1].match(/\bPP-\d{3,}\b/g) ?? [];
  return {
    ...card,
    title: card.title.slice(0, match.index).trim(),
    derivedFromIds: Array.from(new Set([...(card.derivedFromIds ?? []), ...evidenceCodes])),
  };
}

/**
 * Normalize one embedded child blueprint and recurse into grandchildren so L3
 * trees get the same lane/card migrations as L2 (embedded docs must never keep
 * a rootDocument pointer).
 */
function normalizeChildTreeNode(child: BlueprintState, parent: BlueprintState): BlueprintState {
  const childBaseLanes = pickBaseLanes(child);
  const childLanes = childBaseLanes.map((defaultLane) => {
    const existingLane = (child.lanes ?? []).find((lane) => lane.key === defaultLane.key);
    return existingLane
      ? {
          ...defaultLane,
          ...existingLane,
          title: defaultLane.title,
          order: defaultLane.order,
          visible: shouldForceLaneVisible(defaultLane.key) ? true : (existingLane.visible ?? defaultLane.visible),
          collapsed: existingLane.collapsed ?? false,
        }
      : { ...defaultLane };
  });
  const normalizedChildCards = removeEvidenceReferencePainPointCards(
    removeAreaReferenceBehaviourChangeCards(
      migrateStandaloneBehaviourChangeRollupCards(
        expandMergedTypedTraceableCards(child.cards ?? [])
          .map(sanitizeTypedTraceableLaneCard)
          .map(stripOpportunityTraceText)
          .map(stripRollupText)
          .map(stripBehaviourChangeEvidenceBasis)
          .map(stripSuccessMeasureReferenceText),
      ),
    ),
  );
  const nestedChildren = (child.childBlueprints ?? []).map((nested) => normalizeChildTreeNode(nested, child));
  return {
    ...child,
    childBlueprints: nestedChildren,
    rootDocument: null,
    activeBlueprintId: child.blueprint.id,
    rootBlueprintId: child.rootBlueprintId ?? child.blueprint.id,
    storyboardImages: child.storyboardImages ?? [],
    storyboardVisible: child.storyboardVisible ?? true,
    storyboardCollapsed: child.storyboardCollapsed ?? false,
    cardLinks: child.cardLinks ?? [],
    evidence: child.evidence ?? [],
    opportunities: child.opportunities ?? [],
    solutions: child.solutions ?? [],
    assumptions: child.assumptions ?? [],
    strategicGoals: child.strategicGoals ?? [],
    outcomes: child.outcomes ?? [],
    stepLinks: child.stepLinks ?? [],
    requirements: child.requirements ?? [],
    apiContracts: child.apiContracts ?? [],
    uiScaffolds: child.uiScaffolds ?? [],
    traceabilityCounters: child.traceabilityCounters ?? {},
    systemOutcomes: child.systemOutcomes ?? [],
    behaviourOutcomes: child.behaviourOutcomes ?? [],
    serviceOutcomes: child.serviceOutcomes ?? [],
    lanes: childLanes,
    cards: normalizedChildCards,
  };
}

function normalizeState(state: BlueprintState): BlueprintState {
  const lanesByKey = new Map(state.lanes.map((lane) => [lane.key, lane]));
  const baseLanes = pickBaseLanes(state);
  // Build the base normalized state first (backward-compat field defaults)
  const base: BlueprintState = {
    ...state,
    childBlueprints: (state.childBlueprints ?? []).map((child) => normalizeChildTreeNode(child, state)),
    rootDocument: state.rootDocument ?? null,
    activeBlueprintId: state.activeBlueprintId ?? state.blueprint.id,
    rootBlueprintId: state.rootBlueprintId ?? state.blueprint.id,
    storyboardImages: state.storyboardImages ?? [],
    storyboardVisible: state.storyboardVisible ?? true,
    storyboardCollapsed: state.storyboardCollapsed ?? false,
    cardLinks: state.cardLinks ?? [],
    evidence: state.evidence ?? [],
    opportunities: state.opportunities ?? [],
    solutions: state.solutions ?? [],
    assumptions: state.assumptions ?? [],
    strategicGoals: state.strategicGoals ?? [],
    outcomes: state.outcomes ?? [],
    // Backward compat: new arrays added post-initial release
    stepLinks: state.stepLinks ?? [],
    requirements: state.requirements ?? [],
    apiContracts: state.apiContracts ?? [],
    uiScaffolds: state.uiScaffolds ?? [],
    // Backward compat: existing blueprints in localStorage won't have this field
    traceabilityCounters: state.traceabilityCounters ?? {},
    lanes: baseLanes.map((defaultLane) => {
      const existingLane = lanesByKey.get(defaultLane.key);
      return existingLane
        ? {
            ...defaultLane,
            ...existingLane,
            title: defaultLane.title,
            order: defaultLane.order,
            visible: shouldForceLaneVisible(defaultLane.key) ? true : (existingLane.visible ?? defaultLane.visible),
            collapsed: existingLane.collapsed ?? false,
          }
        : { ...defaultLane };
    }),
  };

  // Backfill traceability codes for any stage/step/card that was loaded without one.
  // This covers seed data and blueprints imported before codes were introduced.
  // Entities that already have a code are skipped — codes are never overwritten.
  let counters = { ...base.traceabilityCounters };

  const stages = base.stages.map((stage) => {
    if (stage.traceabilityCode) return stage;
    const { code, updatedCounters } = generateTraceabilityCode('ST', counters);
    counters = updatedCounters;
    return { ...stage, traceabilityCode: code };
  });

  const steps = base.steps.map((step) => {
    if (step.traceabilityCode) return step;
    const { code, updatedCounters } = generateTraceabilityCode('SS', counters);
    counters = updatedCounters;
    return { ...step, traceabilityCode: code };
  });

  const cards = removeEvidenceReferencePainPointCards(
    removeAreaReferenceBehaviourChangeCards(
      migrateStandaloneBehaviourChangeRollupCards(
        expandMergedTypedTraceableCards(base.cards).map((originalCard) => {
          const card = stripBehaviourChangeEvidenceBasis(
            stripRollupText(stripOpportunityTraceText(sanitizeTypedTraceableLaneCard(originalCard))),
          );
          const normalizedCard = stripSuccessMeasureReferenceText(card);
          if (normalizedCard.traceabilityCode) return normalizedCard;
          const prefix = getLanePrefix(normalizedCard.laneKey);
          const { code, updatedCounters } = generateTraceabilityCode(prefix, counters);
          counters = updatedCounters;
          return { ...normalizedCard, traceabilityCode: code };
        }),
      ),
    ),
  );

  return {
    ...base,
    lanes: base.lanes,
    stages,
    steps,
    cards,
    traceabilityCounters: counters,
  };
}

interface BlueprintStore extends BlueprintState {
  _hydrated: boolean;
  _past: BlueprintState[];
  _future: BlueprintState[];
  canUndo: boolean;
  canRedo: boolean;
  hydrate: () => void;
  undo: () => void;
  redo: () => void;

  // Blueprint
  setServiceName: (name: string) => void;
  setDescription: (desc: string) => void;
  /** Persists the current document to localStorage without changing undo history. */
  flushLocalPersistence: () => void;
  /** Stored when you publish a share link so the same URL can be updated in place. */
  setPublishedShareId: (id: string | undefined) => void;
  newBlueprint: () => void;
  loadBlueprint: (state: BlueprintState, opts?: { srcRefCounters?: Record<string, number>; traceabilityCounters?: Record<string, number> }) => void;
  /**
   * Load a snapshot fetched from a share link into memory ONLY — never persists
   * to localStorage, so the viewer's own saved work is untouched. Sets
   * `readOnly: true` so the UI can disable editing affordances.
   */
  loadSharedSnapshot: (state: BlueprintState) => void;
  /** True when viewing a shared snapshot via /view/[id]; editing UI must be disabled. */
  readOnly: boolean;
  /**
   * Replace the content of the currently-active blueprint (root OR child) with
   * imported state. Preserves parent/sibling hierarchy when in a child view so
   * L1→L2→L3 navigation keeps working. Used by the import pipeline so the
   * button targets whichever level the user is viewing.
   */
  replaceActiveBlueprint: (state: BlueprintState) => void;
  /** Retroactively assigns a traceability code to an existing entity that doesn't have one yet. */
  assignTraceabilityCode: (entityId: string, entityType: 'stage' | 'step' | 'card' | 'evidence' | 'opportunity') => string | null;
  loadSeed: () => void;

  // Stages
  addStage: (title: string) => void;
  insertStageAfter: (stageId: string, title: string) => void;
  updateStage: (id: string, patch: Partial<Pick<Stage, 'title' | 'outcome' | 'phase' | 'description'>>) => void;
  deleteStage: (id: string) => void;
  reorderStage: (id: string, newOrder: number) => void;

  // Steps
  addStep: (stageId: string, title: string) => void;
  updateStep: (id: string, patch: Partial<Pick<Step, 'title'>>) => void;
  deleteStep: (id: string) => void;
  reorderStep: (id: string, newOrder: number) => void;

  // Lanes
  toggleLane: (key: LaneKey) => void;
  setLaneVisibility: (key: LaneKey, visible: boolean) => void;
  toggleLaneCollapsed: (key: LaneKey) => void;


  // Cards
  addCard: (stepId: string, laneKey: LaneKey, title: string, body?: string, tags?: string[]) => void;
  updateCard: (id: string, patch: Partial<Pick<Card, 'title' | 'body' | 'tags' | 'owner' | 'status' | 'notes'>>) => void;
  deleteCard: (id: string) => void;
  moveCard: (cardId: string, toStepId: string, toLaneKey: LaneKey, toOrder: number) => void;
  reorderCard: (cardId: string, newOrder: number) => void;

  // Card selection (ephemeral — not persisted, not in undo history)
  selectedCardId: string | null;
  selectCard: (id: string | null) => void;

  // Card links
  addCardLink: (sourceCardId: string, targetCardId: string, relation: LinkRelation) => void;
  deleteCardLink: (id: string) => void;

  // Evidence
  addEvidence: (cardId: string, quote: string, source: string, evidenceType: EvidenceType, strength: EvidenceStrength) => void;
  updateEvidence: (id: string, patch: Partial<Pick<Evidence, 'quote' | 'source' | 'evidenceType' | 'strength'>>) => void;
  deleteEvidence: (id: string) => void;

  // Storyboard (multiple images per step)
  addStoryboardImage: (stepId: string, dataUrl: string) => string;
  updateStoryboardImage: (id: string, dataUrl: string) => void;
  removeStoryboardImage: (id: string) => void;
  toggleStoryboardVisible: () => void;
  toggleStoryboardCollapsed: () => void;

  // Opportunities (persisted)
  addOpportunity: (data: Omit<Opportunity, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
  updateOpportunity: (id: string, patch: Partial<Pick<Opportunity, 'title' | 'statement' | 'rationale' | 'owner' | 'status' | 'sourceCardIds' | 'affectedStages' | 'affectedSteps' | 'outcomeId' | 'parentOpportunityId'>>) => void;
  deleteOpportunity: (id: string) => void;

  // StepLinks (persisted)
  addStepLink: (sourceStepId: string, targetStepId: string) => string;
  deleteStepLink: (id: string) => void;

  // Requirements (persisted)
  addRequirement: (data: Omit<Requirement, 'id' | 'blueprintId' | 'traceabilityCode' | 'createdAt' | 'updatedAt'>) => string;
  updateRequirement: (id: string, patch: Partial<Pick<Requirement, 'title' | 'description' | 'acceptanceCriteria' | 'status' | 'owner'>>) => void;
  deleteRequirement: (id: string) => void;

  // ApiContracts (persisted)
  addApiContract: (data: Omit<ApiContract, 'id' | 'blueprintId' | 'traceabilityCode' | 'createdAt' | 'updatedAt'>) => string;
  updateApiContract: (id: string, patch: Partial<Pick<ApiContract, 'title' | 'endpoint' | 'method' | 'description' | 'status' | 'owner'>>) => void;
  deleteApiContract: (id: string) => void;

  // UiScaffolds (persisted)
  addUiScaffold: (data: Omit<UiScaffold, 'id' | 'blueprintId' | 'traceabilityCode' | 'createdAt' | 'updatedAt'>) => string;
  updateUiScaffold: (id: string, patch: Partial<Pick<UiScaffold, 'title' | 'componentName' | 'description' | 'status' | 'owner'>>) => void;
  deleteUiScaffold: (id: string) => void;

  // Downstream generation (persisted, undoable)
  /** Derives a draft Requirement from an Opportunity. Returns the new Requirement ID, or null if the opportunity is not found. */
  generateRequirementFromOpportunity: (opportunityId: string) => string | null;
  /** Derives a draft ApiContract from a Requirement. Returns the new ApiContract ID, or null if the requirement is not found. */
  generateApiContractFromRequirement: (requirementId: string) => string | null;
  /** Derives a draft UiScaffold from a Requirement and an ApiContract. Returns the new UiScaffold ID, or null if either source is not found. */
  generateUiScaffoldFromRequirementAndApi: (requirementId: string, apiContractId: string) => string | null;

  // Solutions (persisted)
  addSolution: (data: Omit<Solution, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
  updateSolution: (id: string, patch: Partial<Pick<Solution, 'title' | 'description' | 'status' | 'owner'>>) => void;
  deleteSolution: (id: string) => void;

  // Assumptions (persisted)
  addAssumption: (data: Omit<Assumption, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
  updateAssumption: (id: string, patch: Partial<Pick<Assumption, 'title' | 'rationale' | 'status'>>) => void;
  deleteAssumption: (id: string) => void;

  // Strategic Goals (persisted)
  addStrategicGoal: (data: Omit<StrategicGoal, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
  updateStrategicGoal: (id: string, patch: Partial<Pick<StrategicGoal, 'title' | 'description' | 'color' | 'order'>>) => void;
  deleteStrategicGoal: (id: string) => void;
  assignOpportunityToGoal: (opportunityId: string, goalId: string | undefined) => void;

  // Outcomes (persisted)
  addOutcome: (data: Omit<Outcome, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
  updateOutcome: (id: string, patch: Partial<Pick<Outcome, 'title' | 'description' | 'metric' | 'order' | 'priorityStarred' | 'priorityRationale'>>) => void;
  deleteOutcome: (id: string) => void;
  assignOpportunityToOutcome: (opportunityId: string, outcomeId: string | undefined) => void;

  // Helpers
  /** Root-level snapshot with merged nested journeys (matches localStorage). */
  getPersistableDocument: () => BlueprintState;
  /** Current editable document slice (parent chain + active id), for UI that must reflect drill-down. */
  getLiveDocumentSnapshot: () => BlueprintState;
  getStepsForStage: (stageId: string) => Step[];
  getCardsForCell: (stepId: string, laneKey: LaneKey) => Card[];
}

function emptyBlueprint(): BlueprintState {
  const id = uuid();
  const ts = now();
  return {
    blueprint: { id, serviceName: 'Untitled Blueprint', description: '', createdAt: ts, updatedAt: ts },
    stages: [],
    steps: [],
    lanes: DEFAULT_LANES.map(l => ({ ...l })),
    childBlueprints: [],
    rootDocument: null,
    activeBlueprintId: id,
    rootBlueprintId: id,
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

function pickDocumentState(state: BlueprintState): BlueprintState {
  const bp = state.blueprint;
  if (!bp) {
    return pickDocumentState(emptyBlueprint());
  }
  return {
    blueprint: bp,
    stages: state.stages,
    steps: state.steps,
    lanes: state.lanes,
    childBlueprints: state.childBlueprints ?? [],
    rootDocument: state.rootDocument ?? null,
    activeBlueprintId: state.activeBlueprintId ?? bp.id,
    rootBlueprintId: state.rootBlueprintId ?? bp.id,
    cards: state.cards,
    storyboardImages: state.storyboardImages,
    storyboardVisible: state.storyboardVisible,
    storyboardCollapsed: state.storyboardCollapsed,
    cardLinks: state.cardLinks,
    evidence: state.evidence,
    opportunities: state.opportunities,
    solutions: state.solutions,
    assumptions: state.assumptions,
    strategicGoals: state.strategicGoals ?? [],
    outcomes: state.outcomes ?? [],
    systemOutcomes: state.systemOutcomes ?? [],
    behaviourOutcomes: state.behaviourOutcomes ?? [],
    serviceOutcomes: state.serviceOutcomes ?? [],
    stepLinks: state.stepLinks ?? [],
    requirements: state.requirements ?? [],
    apiContracts: state.apiContracts ?? [],
    uiScaffolds: state.uiScaffolds ?? [],
    traceabilityCounters: state.traceabilityCounters,
  };
}

/**
 * Fold an open journey drill-down into the root snapshot so embedded `childBlueprints`
 * match the live active level. Without this, localStorage would keep stale nested
 * copies under parents in `rootDocument` while edits only exist on the active leaf.
 */
function collapseDocumentStackToRoot(state: BlueprintState, depth = 0): BlueprintState {
  if (depth > 32) {
    console.warn('[service-blueprint] Journey drill stack exceeded safe depth; opening root view only.');
    const doc = pickDocumentState(state);
    const rootId = doc.rootBlueprintId ?? doc.blueprint.id;
    return cloneDocumentState({
      ...doc,
      rootDocument: null,
      activeBlueprintId: rootId,
      rootBlueprintId: rootId,
    });
  }
  if (!state.rootDocument) {
    return cloneDocumentState({
      ...pickDocumentState(state),
      rootDocument: null,
    });
  }
  const leaf = cloneDocumentState(pickDocumentState(state));
  const embeddedLeaf = cloneDocumentState({
    ...leaf,
    rootDocument: null,
    activeBlueprintId: leaf.blueprint.id,
    rootBlueprintId: leaf.rootBlueprintId ?? leaf.blueprint.id,
  });
  const parent = cloneDocumentState(state.rootDocument);
  const merged = cloneDocumentState({
    ...parent,
    childBlueprints: upsertChildBlueprint(parent, embeddedLeaf),
    activeBlueprintId: parent.blueprint.id,
    rootBlueprintId: parent.rootBlueprintId ?? parent.blueprint.id,
    rootDocument: parent.rootDocument ?? null,
  });
  return collapseDocumentStackToRoot(merged, depth + 1);
}

function cloneDocumentState(state: BlueprintState): BlueprintState {
  const bp = state.blueprint;
  if (!bp) {
    return cloneDocumentState(emptyBlueprint());
  }
  return {
    blueprint: { ...bp },
    stages: (state.stages ?? []).map((stage) => ({ ...stage })),
    steps: (state.steps ?? []).map((step) => ({ ...step })),
    lanes: (state.lanes ?? []).map((lane) => ({ ...lane })),
    childBlueprints: (state.childBlueprints ?? []).map((child) => cloneDocumentState(child)),
    rootDocument: state.rootDocument ? cloneDocumentState(state.rootDocument) : null,
    activeBlueprintId: state.activeBlueprintId ?? bp.id,
    rootBlueprintId: state.rootBlueprintId ?? bp.id,
    cards: (state.cards ?? []).map((card) => ({
      ...card,
      tags: [...(card.tags ?? [])],
      // derivedFromIds is optional — must be cloned explicitly to avoid shared array references
      derivedFromIds: card.derivedFromIds ? [...card.derivedFromIds] : undefined,
    })),
    storyboardImages: (state.storyboardImages ?? []).map((img) => ({ ...img })),
    storyboardVisible: state.storyboardVisible ?? true,
    storyboardCollapsed: state.storyboardCollapsed ?? false,
    cardLinks: (state.cardLinks ?? []).map((l) => ({ ...l })),
    evidence: (state.evidence ?? []).map((e) => ({ ...e })),
    opportunities: (state.opportunities ?? []).map((o) => ({
      ...o,
      sourceCardIds: [...(o.sourceCardIds ?? [])],
      affectedStages: [...(o.affectedStages ?? [])],
      affectedSteps: [...(o.affectedSteps ?? [])],
      // derivedFromIds is optional — must be cloned explicitly
      derivedFromIds: o.derivedFromIds ? [...o.derivedFromIds] : undefined,
    })),
    solutions: (state.solutions ?? []).map((s) => ({ ...s })),
    assumptions: (state.assumptions ?? []).map((a) => ({ ...a })),
    strategicGoals: (state.strategicGoals ?? []).map((g) => ({ ...g })),
    outcomes: (state.outcomes ?? []).map((o) => ({ ...o })),
    systemOutcomes: (state.systemOutcomes ?? []).map((s) => ({
      ...s,
      goalIds: [...(s.goalIds ?? [])],
      relatedAreaCodes: [...(s.relatedAreaCodes ?? [])],
    })),
    behaviourOutcomes: (state.behaviourOutcomes ?? []).map((b) => ({
      ...b,
      actors: [...(b.actors ?? [])],
      relatedAreaCodes: [...(b.relatedAreaCodes ?? [])],
    })),
    serviceOutcomes: (state.serviceOutcomes ?? []).map((so) => ({
      ...so,
      behIds: [...(so.behIds ?? [])],
      relatedAreaCodes: [...(so.relatedAreaCodes ?? [])],
    })),
    stepLinks: (state.stepLinks ?? []).map((l) => ({ ...l })),
    requirements: (state.requirements ?? []).map((r) => ({
      ...r,
      derivedFromIds: [...(r.derivedFromIds ?? [])],
      sourceCardIds: [...(r.sourceCardIds ?? [])],
    })),
    apiContracts: (state.apiContracts ?? []).map((a) => ({
      ...a,
      derivedFromIds: [...(a.derivedFromIds ?? [])],
      sourceCardIds: [...(a.sourceCardIds ?? [])],
    })),
    uiScaffolds: (state.uiScaffolds ?? []).map((u) => ({
      ...u,
      derivedFromIds: [...(u.derivedFromIds ?? [])],
      sourceCardIds: [...(u.sourceCardIds ?? [])],
    })),
    // Shallow clone — values are primitives (numbers), no deep clone needed
    traceabilityCounters: { ...(state.traceabilityCounters ?? {}) },
  };
}

function isSameDocument(a: BlueprintState, b: BlueprintState) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Collapse drill-down for disk / library / share; never throws — falls back to a safe document. */
function toPersistableSnapshot(state: BlueprintState): BlueprintState {
  try {
    return collapseDocumentStackToRoot(state);
  } catch (e) {
    console.warn('[service-blueprint] Could not flatten journey stack for save; saving a safe slice.', e);
    try {
      const doc = pickDocumentState(state);
      return cloneDocumentState({
        ...doc,
        rootDocument: null,
        activeBlueprintId: state.rootBlueprintId ?? state.blueprint?.id ?? doc.blueprint.id,
        rootBlueprintId: state.rootBlueprintId ?? state.blueprint?.id ?? doc.blueprint.id,
      });
    } catch {
      return normalizeState(emptyBlueprint());
    }
  }
}

/**
 * Disk and hydrate always use the lifecycle root: no drill pointer, and
 * activeBlueprintId must match the top-level blueprint so reload never opens
 * on a stale child id without the parent chain in memory.
 */
function coercePersistedRootPointers(state: BlueprintState): BlueprintState {
  const rootId = state.blueprint?.id;
  if (!rootId) return cloneDocumentState(state);
  return cloneDocumentState({
    ...state,
    rootDocument: null,
    activeBlueprintId: rootId,
    rootBlueprintId: rootId,
  });
}

function persist(state: BlueprintState) {
  const collapsed = toPersistableSnapshot(state);
  const rootId = collapsed.blueprint?.id;
  if (!rootId) {
    console.warn('[service-blueprint] persist: missing blueprint id, skip save');
    return;
  }
  const forDisk = coercePersistedRootPointers(collapsed);
  saveToStorage({
    blueprint: forDisk.blueprint,
    stages: forDisk.stages,
    steps: forDisk.steps,
    lanes: forDisk.lanes,
    childBlueprints: forDisk.childBlueprints ?? [],
    rootDocument: forDisk.rootDocument ?? null,
    activeBlueprintId: forDisk.activeBlueprintId ?? forDisk.blueprint.id,
    rootBlueprintId: forDisk.rootBlueprintId ?? forDisk.blueprint.id,
    cards: forDisk.cards,
    storyboardImages: forDisk.storyboardImages,
    storyboardVisible: forDisk.storyboardVisible,
    storyboardCollapsed: forDisk.storyboardCollapsed,
    cardLinks: forDisk.cardLinks,
    evidence: forDisk.evidence,
    opportunities: forDisk.opportunities,
    solutions: forDisk.solutions,
    assumptions: forDisk.assumptions,
    strategicGoals: forDisk.strategicGoals ?? [],
    outcomes: forDisk.outcomes ?? [],
    systemOutcomes: forDisk.systemOutcomes ?? [],
    behaviourOutcomes: forDisk.behaviourOutcomes ?? [],
    serviceOutcomes: forDisk.serviceOutcomes ?? [],
    stepLinks: forDisk.stepLinks ?? [],
    requirements: forDisk.requirements ?? [],
    apiContracts: forDisk.apiContracts ?? [],
    uiScaffolds: forDisk.uiScaffolds ?? [],
    traceabilityCounters: forDisk.traceabilityCounters,
  });
}

export const useBlueprintStore = create<BlueprintStore>((set, get) => ({
  ...emptyBlueprint(),
  _hydrated: false,
  _past: [],
  _future: [],
  canUndo: false,
  canRedo: false,
  selectedCardId: null,
  readOnly: false,

  hydrate: () => {
    const raw = loadFromStorage() ?? emptyBlueprint();
    // normalizeState backfills any missing traceability codes (among other defaults).
    // If a previous session saved an incompatible import shape, recover to a
    // blank board instead of leaving the app on a client-side blank screen.
    let normalized: BlueprintState;
    try {
      normalized = normalizeState(raw);
    } catch (error) {
      console.error('Failed to hydrate saved blueprint state', error);
      normalized = normalizeState(emptyBlueprint());
      saveToStorage(normalized);
    }
    const collapsed = toPersistableSnapshot(normalized);
    const atRoot = coercePersistedRootPointers(collapsed);
    try {
      set({
        ...cloneDocumentState(atRoot),
        _hydrated: true,
        _past: [],
        _future: [],
        canUndo: false,
        canRedo: false,
        // Clear read-only in case the user is returning from /view/[id]
        // and should regain editing on their own board.
        readOnly: false,
      });
    } catch (error) {
      console.error('Failed to clone hydrated blueprint', error);
      const recovered = normalizeState(emptyBlueprint());
      set({
        ...cloneDocumentState(recovered),
        _hydrated: true,
        _past: [],
        _future: [],
        canUndo: false,
        canRedo: false,
        readOnly: false,
      });
      persist(recovered);
      return;
    }
    // Persist the normalized state so backfilled codes survive the next page load
    persist(atRoot);
  },

  undo: () => {
    set((s) => {
      if (s._past.length === 0) return s;
      const previous = cloneDocumentState(s._past[s._past.length - 1]);
      const current = cloneDocumentState(pickDocumentState(s));
      const nextPast = s._past.slice(0, -1);
      const nextFuture = [current, ...s._future].slice(0, HISTORY_LIMIT);
      persist(previous);
      return {
        ...s,
        ...previous,
        _past: nextPast,
        _future: nextFuture,
        canUndo: nextPast.length > 0,
        canRedo: nextFuture.length > 0,
      };
    });
  },

  redo: () => {
    set((s) => {
      if (s._future.length === 0) return s;
      const nextDocument = cloneDocumentState(s._future[0]);
      const current = cloneDocumentState(pickDocumentState(s));
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      const nextFuture = s._future.slice(1);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: nextFuture,
        canUndo: nextPast.length > 0,
        canRedo: nextFuture.length > 0,
      };
    });
  },

  setServiceName: (name) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        blueprint: { ...current.blueprint, serviceName: name, updatedAt: now() },
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  setDescription: (desc) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        blueprint: { ...current.blueprint, description: desc, updatedAt: now() },
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  flushLocalPersistence: () => {
    const collapsed = toPersistableSnapshot(pickDocumentState(get()));
    persist(coercePersistedRootPointers(collapsed));
  },

  setPublishedShareId: (publishedShareId) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const bp = { ...current.blueprint, updatedAt: ts } as typeof current.blueprint;
      if (publishedShareId) {
        bp.publishedShareId = publishedShareId;
      } else {
        delete bp.publishedShareId;
      }
      const nextDocument = cloneDocumentState({
        ...current,
        blueprint: bp,
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  newBlueprint: () => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const fresh = cloneDocumentState(emptyBlueprint());
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(fresh);
      return {
        ...s,
        ...fresh,
        _hydrated: true,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  loadBlueprint: (state, opts) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const normalized = normalizeState(state);
      // Merge source provenance counters (SRC_PDF, SRC_CSV, …) from the import pipeline
      if (opts?.srcRefCounters) {
        normalized.traceabilityCounters = { ...normalized.traceabilityCounters, ...opts.srcRefCounters };
      }
      // Merge semantic traceability counters (ST, SS, PP, …) assigned during normalization
      if (opts?.traceabilityCounters) {
        normalized.traceabilityCounters = { ...normalized.traceabilityCounters, ...opts.traceabilityCounters };
      }
      const loaded = cloneDocumentState(normalized);
      if (isSameDocument(current, loaded)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(loaded);
      return {
        ...s,
        ...loaded,
        _hydrated: true,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  loadSharedSnapshot: (state) => {
    // Viewer-only path. Intentionally does NOT call persist() — the user's own
    // localStorage must remain untouched so navigating back to "/" restores
    // their saved work via hydrate().
    set((s) => {
      const normalized = normalizeState(state);
      const loaded = cloneDocumentState(normalized);
      return {
        ...s,
        ...loaded,
        _hydrated: true,
        _past: [],
        _future: [],
        canUndo: false,
        canRedo: false,
        readOnly: true,
      };
    });
  },

  replaceActiveBlueprint: (state) => {
    set((s) => {
      const inChildView = isChildJourneyOpen(s);

      // Root view → behave like loadBlueprint (full replace)
      if (!inChildView) {
        const current = cloneDocumentState(pickDocumentState(s));
        const normalized = normalizeState(state);
        const loaded = cloneDocumentState(normalized);
        if (isSameDocument(current, loaded)) return s;
        const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
        persist(loaded);
        return {
          ...s,
          ...loaded,
          _hydrated: true,
          _past: nextPast,
          _future: [],
          canUndo: nextPast.length > 0,
          canRedo: false,
        };
      }

      // Child view → replace only this child's content. Keep:
      //   - rootDocument + rootBlueprintId (the parent chain)
      //   - activeBlueprintId (so parent's journey link stays valid)
      // Drop this child's own descendants (childBlueprints)
      // per user's choice: new import invalidates any L3 children.
      const current = cloneDocumentState(pickDocumentState(s));
      const normalized = normalizeState(state);
      const imported = cloneDocumentState(normalized);

      const next: BlueprintState = {
        // keep the current child's identity so parent spans still reference it
        blueprint: {
          ...imported.blueprint,
          id: s.blueprint.id,
        },
        stages: imported.stages,
        steps: imported.steps,
        lanes: imported.lanes,
        cards: imported.cards,
        storyboardImages: imported.storyboardImages,
        storyboardVisible: imported.storyboardVisible,
        storyboardCollapsed: imported.storyboardCollapsed,
        cardLinks: imported.cardLinks,
        evidence: imported.evidence,
        opportunities: imported.opportunities,
        solutions: imported.solutions,
        assumptions: imported.assumptions,
        strategicGoals: imported.strategicGoals ?? [],
        outcomes: imported.outcomes ?? [],
        systemOutcomes: imported.systemOutcomes ?? [],
        behaviourOutcomes: imported.behaviourOutcomes ?? [],
        serviceOutcomes: imported.serviceOutcomes ?? [],
        stepLinks: imported.stepLinks,
        requirements: imported.requirements,
        apiContracts: imported.apiContracts,
        uiScaffolds: imported.uiScaffolds,
        traceabilityCounters: imported.traceabilityCounters,
        // wipe this child's own descendants — they belonged to old data
        childBlueprints: [],
        // preserve hierarchy
        rootDocument: s.rootDocument,
        rootBlueprintId: s.rootBlueprintId,
        activeBlueprintId: s.blueprint.id,
      };

      const cloned = cloneDocumentState(next);
      if (isSameDocument(current, cloned)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(cloned);
      return {
        ...s,
        ...cloned,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  assignTraceabilityCode: (entityId, entityType) => {
    let assigned: string | null = null;
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      let counters = { ...current.traceabilityCounters };

      if (entityType === 'card') {
        const card = current.cards.find((c) => c.id === entityId);
        if (!card || card.traceabilityCode) return s;
        const prefix = getLanePrefix(card.laneKey);
        const { code, updatedCounters } = generateTraceabilityCode(prefix, counters);
        counters = updatedCounters;
        assigned = code;
        const nextDocument = cloneDocumentState({
          ...current,
          cards: current.cards.map((c) => c.id === entityId ? { ...c, traceabilityCode: code } : c),
          traceabilityCounters: counters,
        });
        const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
        persist(nextDocument);
        return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
      }

      if (entityType === 'stage') {
        const stage = current.stages.find((st) => st.id === entityId);
        if (!stage || stage.traceabilityCode) return s;
        const { code, updatedCounters } = generateTraceabilityCode('ST', counters);
        counters = updatedCounters;
        assigned = code;
        const nextDocument = cloneDocumentState({
          ...current,
          stages: current.stages.map((st) => st.id === entityId ? { ...st, traceabilityCode: code } : st),
          traceabilityCounters: counters,
        });
        const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
        persist(nextDocument);
        return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
      }

      if (entityType === 'step') {
        const step = current.steps.find((st) => st.id === entityId);
        if (!step || step.traceabilityCode) return s;
        const { code, updatedCounters } = generateTraceabilityCode('SS', counters);
        counters = updatedCounters;
        assigned = code;
        const nextDocument = cloneDocumentState({
          ...current,
          steps: current.steps.map((st) => st.id === entityId ? { ...st, traceabilityCode: code } : st),
          traceabilityCounters: counters,
        });
        const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
        persist(nextDocument);
        return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
      }

      if (entityType === 'evidence') {
        const ev = current.evidence.find((e) => e.id === entityId);
        if (!ev || ev.traceabilityCode) return s;
        const { code, updatedCounters } = generateTraceabilityCode('EVD', counters);
        counters = updatedCounters;
        assigned = code;
        const nextDocument = cloneDocumentState({
          ...current,
          evidence: current.evidence.map((e) => e.id === entityId ? { ...e, traceabilityCode: code } : e),
          traceabilityCounters: counters,
        });
        const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
        persist(nextDocument);
        return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
      }

      if (entityType === 'opportunity') {
        const opp = current.opportunities.find((o) => o.id === entityId);
        if (!opp || opp.traceabilityCode) return s;
        const { code, updatedCounters } = generateTraceabilityCode('OPP', counters);
        assigned = code;
        const nextDocument = cloneDocumentState({
          ...current,
          opportunities: current.opportunities.map((o) => o.id === entityId ? { ...o, traceabilityCode: code } : o),
          traceabilityCounters: updatedCounters,
        });
        const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
        persist(nextDocument);
        return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
      }

      return s;
    });
    return assigned;
  },

  loadSeed: () => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const seed = cloneDocumentState(createSeedBlueprint());
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(seed);
      return {
        ...s,
        ...seed,
        _hydrated: true,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  // Stages
  addStage: (title) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const maxOrder = s.stages.reduce((m, st) => Math.max(m, st.order), -1);
      const { code: stCode, updatedCounters: countersAfterSt } = generateTraceabilityCode('ST', current.traceabilityCounters);
      const stage: Stage = { id: uuid(), blueprintId: s.blueprint.id, title, outcome: '', order: maxOrder + 1, traceabilityCode: stCode };
      const nextDocument = cloneDocumentState({
        ...current,
        stages: [...current.stages, stage],
        blueprint: { ...current.blueprint, updatedAt: now() },
        traceabilityCounters: countersAfterSt,
      });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  insertStageAfter: (stageId, title) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const anchor = current.stages.find((st) => st.id === stageId);
      if (!anchor) return s;
      const insertOrder = anchor.order + 1;
      const { code: stCode, updatedCounters: countersAfterSt } = generateTraceabilityCode('ST', current.traceabilityCounters);
      const newStage: Stage = {
        id: uuid(),
        blueprintId: s.blueprint.id,
        title,
        outcome: '',
        order: insertOrder,
        phase: anchor.phase,
        traceabilityCode: stCode,
      };
      // Seed a default step so the new stage matches the "1 step per stage"
      // invariant the rest of the board assumes (otherwise showStepHeaders
      // flips on and an empty step-header row appears across every stage).
      const { code: ssCode, updatedCounters: countersAfterSs } = generateTraceabilityCode('SS', countersAfterSt);
      const newStep: Step = {
        id: uuid(),
        blueprintId: s.blueprint.id,
        stageId: newStage.id,
        title,
        order: 0,
        traceabilityCode: ssCode,
      };
      const shifted = current.stages.map((st) =>
        st.order >= insertOrder ? { ...st, order: st.order + 1 } : st,
      );
      const nextDocument = cloneDocumentState({
        ...current,
        stages: [...shifted, newStage],
        steps: [...current.steps, newStep],
        blueprint: { ...current.blueprint, updatedAt: now() },
        traceabilityCounters: countersAfterSs,
      });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  updateStage: (id, patch) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        stages: current.stages.map((st) => (st.id === id ? { ...st, ...patch } : st)),
        blueprint: { ...current.blueprint, updatedAt: now() },
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  deleteStage: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const stepIds = s.steps.filter((st) => st.stageId === id).map((st) => st.id);
      const stepIdSet = new Set(stepIds);
      const removedCardIds = new Set(current.cards.filter((c) => stepIdSet.has(c.stepId)).map((c) => c.id));
      const nextDocument = cloneDocumentState({
        ...current,
        stages: current.stages.filter((st) => st.id !== id),
        steps: current.steps.filter((st) => st.stageId !== id),
        cards: current.cards.filter((c) => !stepIdSet.has(c.stepId)),
        storyboardImages: current.storyboardImages.filter((img) => !stepIdSet.has(img.stepId)),
        cardLinks: current.cardLinks.filter((l) => !removedCardIds.has(l.sourceCardId) && !removedCardIds.has(l.targetCardId)),
        evidence: current.evidence.filter((e) => !removedCardIds.has(e.cardId)),
        stepLinks: current.stepLinks.filter((l) => !stepIdSet.has(l.sourceStepId) && !stepIdSet.has(l.targetStepId)),
        blueprint: { ...current.blueprint, updatedAt: now() },
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  reorderStage: (id, newOrder) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const sorted = [...s.stages].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((st) => st.id === id);
      if (idx === -1) return s;
      const [moved] = sorted.splice(idx, 1);
      sorted.splice(newOrder, 0, moved);
      const reordered = sorted.map((st, i) => ({ ...st, order: i }));
      const nextDocument = cloneDocumentState({
        ...current,
        stages: reordered,
        blueprint: { ...current.blueprint, updatedAt: now() },
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  // Steps
  addStep: (stageId, title) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const stepsInStage = s.steps.filter((st) => st.stageId === stageId);
      const maxOrder = stepsInStage.reduce((m, st) => Math.max(m, st.order), -1);
      const { code: ssCode, updatedCounters: countersAfterSs } = generateTraceabilityCode('SS', current.traceabilityCounters);
      const step: Step = { id: uuid(), blueprintId: s.blueprint.id, stageId, title, order: maxOrder + 1, traceabilityCode: ssCode };
      const nextDocument = cloneDocumentState({
        ...current,
        steps: [...current.steps, step],
        blueprint: { ...current.blueprint, updatedAt: now() },
        traceabilityCounters: countersAfterSs,
      });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  updateStep: (id, patch) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        steps: current.steps.map((st) => (st.id === id ? { ...st, ...patch } : st)),
        blueprint: { ...current.blueprint, updatedAt: now() },
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  deleteStep: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const removedCardIds = new Set(current.cards.filter((c) => c.stepId === id).map((c) => c.id));
      const nextDocument = cloneDocumentState({
        ...current,
        steps: current.steps.filter((st) => st.id !== id),
        cards: current.cards.filter((c) => c.stepId !== id),
        storyboardImages: current.storyboardImages.filter((img) => img.stepId !== id),
        cardLinks: current.cardLinks.filter((l) => !removedCardIds.has(l.sourceCardId) && !removedCardIds.has(l.targetCardId)),
        evidence: current.evidence.filter((e) => !removedCardIds.has(e.cardId)),
        stepLinks: current.stepLinks.filter((l) => l.sourceStepId !== id && l.targetStepId !== id),
        blueprint: { ...current.blueprint, updatedAt: now() },
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  reorderStep: (id, newOrder) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const step = s.steps.find((st) => st.id === id);
      if (!step) return s;
      const stepsInStage = [...s.steps.filter((st) => st.stageId === step.stageId)].sort((a, b) => a.order - b.order);
      const idx = stepsInStage.findIndex((st) => st.id === id);
      if (idx === -1) return s;
      const [moved] = stepsInStage.splice(idx, 1);
      stepsInStage.splice(newOrder, 0, moved);
      const reordered = stepsInStage.map((st, i) => ({ ...st, order: i }));
      const otherSteps = s.steps.filter((st) => st.stageId !== step.stageId);
      const nextDocument = cloneDocumentState({
        ...current,
        steps: [...otherSteps, ...reordered],
        blueprint: { ...current.blueprint, updatedAt: now() },
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  // Lanes
  toggleLane: (key) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        lanes: current.lanes.map((l) => (l.key === key ? { ...l, visible: !l.visible } : l)),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  setLaneVisibility: (key, visible) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        lanes: current.lanes.map((l) => (l.key === key ? { ...l, visible } : l)),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  toggleLaneCollapsed: (key) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        lanes: current.lanes.map((l) => (l.key === key ? { ...l, collapsed: !l.collapsed } : l)),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  // Cards
  addCard: (stepId, laneKey, title, body = '', tags = []) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const step = s.steps.find((st) => st.id === stepId);
      if (!step) return s;
      const cellCards = s.cards.filter((c) => c.stepId === stepId && c.laneKey === laneKey);
      const maxOrder = cellCards.reduce((m, c) => Math.max(m, c.order), -1);
      const ts = now();
      const prefix = getLanePrefix(laneKey);
      const { code: cardCode, updatedCounters: countersAfterCard } = generateTraceabilityCode(prefix, current.traceabilityCounters);
      const card: Card = {
        id: uuid(),
        blueprintId: s.blueprint.id,
        stageId: step.stageId,
        stepId,
        laneKey,
        title,
        body,
        order: maxOrder + 1,
        tags,
        sourceFile: '',
        sourceSheet: '',
        sourceRow: null,
        sourceRef: '',
        createdAt: ts,
        updatedAt: ts,
        traceabilityCode: cardCode,
      };
      const nextDocument = cloneDocumentState({
        ...current,
        cards: [...current.cards, card],
        blueprint: { ...current.blueprint, updatedAt: ts },
        traceabilityCounters: countersAfterCard,
      });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  updateCard: (id, patch) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const timestamp = now();
      const nextDocument = cloneDocumentState({
        ...current,
        cards: current.cards.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: timestamp } : c)),
        blueprint: { ...current.blueprint, updatedAt: timestamp },
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  deleteCard: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        cards: current.cards.filter((c) => c.id !== id),
        cardLinks: current.cardLinks.filter((l) => l.sourceCardId !== id && l.targetCardId !== id),
        evidence: current.evidence.filter((e) => e.cardId !== id),
        blueprint: { ...current.blueprint, updatedAt: now() },
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  moveCard: (cardId, toStepId, toLaneKey, toOrder) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const step = s.steps.find((st) => st.id === toStepId);
      if (!step) return s;
      const timestamp = now();
      const nextDocument = cloneDocumentState({
        ...current,
        cards: current.cards.map((c) =>
          c.id === cardId
            ? { ...c, stepId: toStepId, stageId: step.stageId, laneKey: toLaneKey, order: toOrder, updatedAt: timestamp }
            : c,
        ),
        blueprint: { ...current.blueprint, updatedAt: timestamp },
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  reorderCard: (cardId, newOrder) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const card = s.cards.find((c) => c.id === cardId);
      if (!card) return s;
      const cellCards = [...s.cards.filter((c) => c.stepId === card.stepId && c.laneKey === card.laneKey)].sort(
        (a, b) => a.order - b.order,
      );
      const idx = cellCards.findIndex((c) => c.id === cardId);
      if (idx === -1) return s;
      const [moved] = cellCards.splice(idx, 1);
      cellCards.splice(newOrder, 0, moved);
      const reorderedIds = new Map(cellCards.map((c, i) => [c.id, i]));
      const timestamp = now();
      const nextDocument = cloneDocumentState({
        ...current,
        cards: current.cards.map((c) => {
          const newIdx = reorderedIds.get(c.id);
          return newIdx !== undefined ? { ...c, order: newIdx, updatedAt: timestamp } : c;
        }),
        blueprint: { ...current.blueprint, updatedAt: timestamp },
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  // Storyboard
  addStoryboardImage: (stepId, dataUrl) => {
    let newId = '';
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const step = s.steps.find((st) => st.id === stepId);
      if (!step) return s;
      const ts = now();
      newId = uuid();
      const nextImages = [
        ...current.storyboardImages,
        { id: newId, blueprintId: s.blueprint.id, stepId, dataUrl, createdAt: ts, updatedAt: ts } as StoryboardImage,
      ];
      const nextDocument = cloneDocumentState({
        ...current,
        storyboardImages: nextImages,
        blueprint: { ...current.blueprint, updatedAt: ts },
      });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
    return newId;
  },

  updateStoryboardImage: (id, dataUrl) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      if (!current.storyboardImages.some((img) => img.id === id)) return s;
      const ts = now();
      const nextImages = current.storyboardImages.map((img) =>
        img.id === id ? { ...img, dataUrl, updatedAt: ts } : img,
      );
      const nextDocument = cloneDocumentState({
        ...current,
        storyboardImages: nextImages,
        blueprint: { ...current.blueprint, updatedAt: ts },
      });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  removeStoryboardImage: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      if (!current.storyboardImages.some((img) => img.id === id)) return s;
      const nextDocument = cloneDocumentState({
        ...current,
        storyboardImages: current.storyboardImages.filter((img) => img.id !== id),
        blueprint: { ...current.blueprint, updatedAt: now() },
      });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  toggleStoryboardVisible: () => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        storyboardVisible: !current.storyboardVisible,
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  toggleStoryboardCollapsed: () => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        storyboardCollapsed: !current.storyboardCollapsed,
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return {
        ...s,
        ...nextDocument,
        _past: nextPast,
        _future: [],
        canUndo: nextPast.length > 0,
        canRedo: false,
      };
    });
  },

  // Card selection (ephemeral)
  selectCard: (id) => set((s) => ({
    ...s,
    selectedCardId: id,
  })),

  // Card links
  addCardLink: (sourceCardId, targetCardId, relation) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const link: CardLink = { id: uuid(), blueprintId: s.blueprint.id, sourceCardId, targetCardId, relation, createdAt: ts };
      const nextDocument = cloneDocumentState({ ...current, cardLinks: [...current.cardLinks, link] });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  deleteCardLink: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({ ...current, cardLinks: current.cardLinks.filter((l) => l.id !== id) });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  // Evidence
  addEvidence: (cardId, quote, source, evidenceType, strength) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const { code: evdCode, updatedCounters: countersAfterEvd } = generateTraceabilityCode('EVD', current.traceabilityCounters);
      const ev: Evidence = { id: uuid(), blueprintId: s.blueprint.id, cardId, quote, source, evidenceType, strength, createdAt: ts, updatedAt: ts, traceabilityCode: evdCode };
      const nextDocument = cloneDocumentState({ ...current, evidence: [...current.evidence, ev], traceabilityCounters: countersAfterEvd });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  updateEvidence: (id, patch) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const nextDocument = cloneDocumentState({
        ...current,
        evidence: current.evidence.map((e) => e.id === id ? { ...e, ...patch, updatedAt: ts } : e),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  deleteEvidence: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({ ...current, evidence: current.evidence.filter((e) => e.id !== id) });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  // Opportunities
  addOpportunity: (data) => {
    const id = uuid();
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const { code: oppCode, updatedCounters: countersAfterOpp } = generateTraceabilityCode('OPP', current.traceabilityCounters);
      const origin = data.origin ?? (data.sourceCardIds.length > 0 ? 'generated' : 'user');
      const opp: Opportunity = { id, blueprintId: s.blueprint.id, ...data, origin, createdAt: ts, updatedAt: ts, traceabilityCode: oppCode };
      const nextDocument = cloneDocumentState({ ...current, opportunities: [...current.opportunities, opp], traceabilityCounters: countersAfterOpp });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
    return id;
  },

  updateOpportunity: (id, patch) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const nextDocument = cloneDocumentState({
        ...current,
        opportunities: current.opportunities.map((o) => o.id === id ? { ...o, ...patch, updatedAt: ts } : o),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  deleteOpportunity: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        opportunities: current.opportunities.filter((o) => o.id !== id),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  // Solutions
  addSolution: (data) => {
    const id = uuid();
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const solution: Solution = { id, blueprintId: s.blueprint.id, ...data, createdAt: ts, updatedAt: ts };
      const nextDocument = cloneDocumentState({ ...current, solutions: [...current.solutions, solution] });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
    return id;
  },

  updateSolution: (id, patch) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const nextDocument = cloneDocumentState({
        ...current,
        solutions: current.solutions.map((sol) => sol.id === id ? { ...sol, ...patch, updatedAt: ts } : sol),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  deleteSolution: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        solutions: current.solutions.filter((sol) => sol.id !== id),
        assumptions: current.assumptions.filter((a) => a.solutionId !== id),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  // Assumptions
  addAssumption: (data) => {
    const id = uuid();
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const assumption: Assumption = { id, blueprintId: s.blueprint.id, ...data, createdAt: ts, updatedAt: ts };
      const nextDocument = cloneDocumentState({ ...current, assumptions: [...current.assumptions, assumption] });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
    return id;
  },

  updateAssumption: (id, patch) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const nextDocument = cloneDocumentState({
        ...current,
        assumptions: current.assumptions.map((a) => a.id === id ? { ...a, ...patch, updatedAt: ts } : a),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  deleteAssumption: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        assumptions: current.assumptions.filter((a) => a.id !== id),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  // Strategic Goals
  addStrategicGoal: (data) => {
    const id = uuid();
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const goal: StrategicGoal = { id, blueprintId: s.blueprint.id, ...data, createdAt: ts, updatedAt: ts };
      const nextDocument = cloneDocumentState({ ...current, strategicGoals: [...current.strategicGoals, goal] });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
    return id;
  },

  updateStrategicGoal: (id, patch) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const nextDocument = cloneDocumentState({
        ...current,
        strategicGoals: current.strategicGoals.map((g) => g.id === id ? { ...g, ...patch, updatedAt: ts } : g),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  deleteStrategicGoal: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const orphanedOutcomeIds = new Set(current.outcomes.filter((o) => o.goalId === id).map((o) => o.id));
      const nextDocument = cloneDocumentState({
        ...current,
        strategicGoals: current.strategicGoals.filter((g) => g.id !== id),
        outcomes: current.outcomes.filter((o) => o.goalId !== id),
        opportunities: current.opportunities.map((o) =>
          orphanedOutcomeIds.has(o.outcomeId ?? '') ? { ...o, outcomeId: undefined } : o,
        ),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  assignOpportunityToGoal: (opportunityId, goalId) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const nextDocument = cloneDocumentState({
        ...current,
        opportunities: current.opportunities.map((o) =>
          o.id === opportunityId ? { ...o, goalId, updatedAt: ts } : o,
        ),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  // Outcomes
  addOutcome: (data) => {
    const id = uuid();
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const outcome: Outcome = { id, blueprintId: s.blueprint.id, ...data, createdAt: ts, updatedAt: ts };
      const nextDocument = cloneDocumentState({ ...current, outcomes: [...current.outcomes, outcome] });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
    return id;
  },

  updateOutcome: (id, patch) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const nextDocument = cloneDocumentState({
        ...current,
        outcomes: current.outcomes.map((o) => o.id === id ? { ...o, ...patch, updatedAt: ts } : o),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  deleteOutcome: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({
        ...current,
        outcomes: current.outcomes.filter((o) => o.id !== id),
        opportunities: current.opportunities.map((o) =>
          o.outcomeId === id ? { ...o, outcomeId: undefined } : o,
        ),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  assignOpportunityToOutcome: (opportunityId, outcomeId) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const nextDocument = cloneDocumentState({
        ...current,
        opportunities: current.opportunities.map((o) =>
          o.id === opportunityId ? { ...o, outcomeId, updatedAt: ts } : o,
        ),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  // StepLinks
  addStepLink: (sourceStepId, targetStepId) => {
    const id = uuid();
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const { code: nsCode, updatedCounters } = generateTraceabilityCode('NS', current.traceabilityCounters);
      const link: StepLink = { id, blueprintId: s.blueprint.id, sourceStepId, targetStepId, traceabilityCode: nsCode, createdAt: ts };
      const nextDocument = cloneDocumentState({ ...current, stepLinks: [...current.stepLinks, link], traceabilityCounters: updatedCounters });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
    return id;
  },

  deleteStepLink: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({ ...current, stepLinks: current.stepLinks.filter((l) => l.id !== id) });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  // Requirements
  addRequirement: (data) => {
    const id = uuid();
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const { code: reqCode, updatedCounters } = generateTraceabilityCode('REQ', current.traceabilityCounters);
      const req: Requirement = { id, blueprintId: s.blueprint.id, ...data, traceabilityCode: reqCode, createdAt: ts, updatedAt: ts };
      const nextDocument = cloneDocumentState({ ...current, requirements: [...current.requirements, req], traceabilityCounters: updatedCounters });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
    return id;
  },

  updateRequirement: (id, patch) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const nextDocument = cloneDocumentState({
        ...current,
        requirements: current.requirements.map((r) => r.id === id ? { ...r, ...patch, updatedAt: ts } : r),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  deleteRequirement: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({ ...current, requirements: current.requirements.filter((r) => r.id !== id) });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  // ApiContracts
  addApiContract: (data) => {
    const id = uuid();
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const { code: apiCode, updatedCounters } = generateTraceabilityCode('API', current.traceabilityCounters);
      const contract: ApiContract = { id, blueprintId: s.blueprint.id, ...data, traceabilityCode: apiCode, createdAt: ts, updatedAt: ts };
      const nextDocument = cloneDocumentState({ ...current, apiContracts: [...current.apiContracts, contract], traceabilityCounters: updatedCounters });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
    return id;
  },

  updateApiContract: (id, patch) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const nextDocument = cloneDocumentState({
        ...current,
        apiContracts: current.apiContracts.map((a) => a.id === id ? { ...a, ...patch, updatedAt: ts } : a),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  deleteApiContract: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({ ...current, apiContracts: current.apiContracts.filter((a) => a.id !== id) });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  // UiScaffolds
  addUiScaffold: (data) => {
    const id = uuid();
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const { code: uiCode, updatedCounters } = generateTraceabilityCode('UI', current.traceabilityCounters);
      const scaffold: UiScaffold = { id, blueprintId: s.blueprint.id, ...data, traceabilityCode: uiCode, createdAt: ts, updatedAt: ts };
      const nextDocument = cloneDocumentState({ ...current, uiScaffolds: [...current.uiScaffolds, scaffold], traceabilityCounters: updatedCounters });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
    return id;
  },

  updateUiScaffold: (id, patch) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const ts = now();
      const nextDocument = cloneDocumentState({
        ...current,
        uiScaffolds: current.uiScaffolds.map((u) => u.id === id ? { ...u, ...patch, updatedAt: ts } : u),
      });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  deleteUiScaffold: (id) => {
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const nextDocument = cloneDocumentState({ ...current, uiScaffolds: current.uiScaffolds.filter((u) => u.id !== id) });
      if (isSameDocument(current, nextDocument)) return s;
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
  },

  // Downstream generation
  generateRequirementFromOpportunity: (opportunityId) => {
    let newId: string | null = null;
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      let opp = current.opportunities.find((o) => o.id === opportunityId);
      if (!opp) return s;

      let counters = { ...current.traceabilityCounters };
      let updatedOpportunities = current.opportunities;

      // Ensure the opportunity has a traceability code before deriving from it
      if (!opp.traceabilityCode) {
        const { code, updatedCounters } = generateTraceabilityCode('OPP', counters);
        counters = updatedCounters;
        opp = { ...opp, traceabilityCode: code };
        updatedOpportunities = current.opportunities.map((o) => o.id === opportunityId ? opp! : o);
      }

      const { requirement, updatedCounters: countersAfterReq } = createRequirementFromOpportunity(opp, counters, s.blueprint.id);
      newId = requirement.id;

      const nextDocument = cloneDocumentState({
        ...current,
        opportunities: updatedOpportunities,
        requirements: [...current.requirements, requirement],
        traceabilityCounters: countersAfterReq,
      });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
    return newId;
  },

  generateApiContractFromRequirement: (requirementId) => {
    let newId: string | null = null;
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const req = current.requirements.find((r) => r.id === requirementId);
      if (!req) return s;

      const { apiContract, updatedCounters } = createApiContractFromRequirement(req, current.traceabilityCounters, s.blueprint.id);
      newId = apiContract.id;

      const nextDocument = cloneDocumentState({
        ...current,
        apiContracts: [...current.apiContracts, apiContract],
        traceabilityCounters: updatedCounters,
      });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
    return newId;
  },

  generateUiScaffoldFromRequirementAndApi: (requirementId, apiContractId) => {
    let newId: string | null = null;
    set((s) => {
      const current = cloneDocumentState(pickDocumentState(s));
      const req = current.requirements.find((r) => r.id === requirementId);
      const api = current.apiContracts.find((a) => a.id === apiContractId);
      if (!req || !api) return s;

      const { uiScaffold, updatedCounters } = createUiScaffoldFromRequirementAndApi(req, api, current.traceabilityCounters, s.blueprint.id);
      newId = uiScaffold.id;

      const nextDocument = cloneDocumentState({
        ...current,
        uiScaffolds: [...current.uiScaffolds, uiScaffold],
        traceabilityCounters: updatedCounters,
      });
      const nextPast = [...s._past, current].slice(-HISTORY_LIMIT);
      persist(nextDocument);
      return { ...s, ...nextDocument, _past: nextPast, _future: [], canUndo: true, canRedo: false };
    });
    return newId;
  },

  // OST panel (ephemeral)

  // Strategic alignment overlay (ephemeral)

  // Opportunities panel (ephemeral)

  // Helpers
  getPersistableDocument: () => coercePersistedRootPointers(toPersistableSnapshot(pickDocumentState(get()))),
  getLiveDocumentSnapshot: () => pickDocumentState(get()),

  getStepsForStage: (stageId) => {
    return get()
      .steps.filter((st) => st.stageId === stageId)
      .sort((a, b) => a.order - b.order);
  },

  getCardsForCell: (stepId, laneKey) => {
    return get()
      .cards.filter((c) => c.stepId === stepId && c.laneKey === laneKey)
      .sort((a, b) => a.order - b.order);
  },
}));
