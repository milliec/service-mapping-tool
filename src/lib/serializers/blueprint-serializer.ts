import type {
  ApiContract,
  Blueprint,
  BlueprintState,
  Card,
  CardLink,
  Opportunity,
  Requirement,
  Stage,
  Step,
  StepLink,
  UiScaffold,
} from '../types';

/**
 * Pure serialization helpers.
 * Produce a normalized JSON representation of the blueprint suitable for
 * export, downstream tools, or AI consumption.
 *
 * No store access. No side effects. All inputs from BlueprintState.
 */

// ---------------------------------------------------------------------------
// Serialized entity shapes
// ---------------------------------------------------------------------------

export interface SerializedCard {
  id: string;
  traceabilityCode?: string;
  derivedFromIds?: string[];
  stageCode?: string;
  stepCode?: string;
  laneKey: string;
  title: string;
  body: string;
  tags: string[];
  sourceRef: string;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number | null;
}

export interface SerializedCardLink {
  id: string;
  relation: string;
  sourceId: string;
  targetId: string;
  /** Resolved from card.traceabilityCode — may be undefined if card has no code. */
  sourceCode?: string;
  targetCode?: string;
}

export interface SerializedStepLink {
  id: string;
  traceabilityCode?: string;
  sourceStepId: string;
  targetStepId: string;
  sourceStepCode?: string;
  targetStepCode?: string;
}

export interface SerializedStep {
  id: string;
  traceabilityCode?: string;
  title: string;
  order: number;
  cards: SerializedCard[];
}

export interface SerializedStage {
  id: string;
  traceabilityCode?: string;
  title: string;
  outcome: string;
  order: number;
  steps: SerializedStep[];
}

export interface SerializedBlueprint {
  blueprint: Pick<Blueprint, 'id' | 'serviceName' | 'description'>;
  stages: SerializedStage[];
  cardLinks: SerializedCardLink[];
  stepLinks: SerializedStepLink[];
  opportunities: Array<Opportunity & { requirementCodes: string[] }>;
  requirements: Requirement[];
  apiContracts: ApiContract[];
  uiScaffolds: UiScaffold[];
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

function serializeCard(
  card: Card,
  stageCode: string | undefined,
  stepCode: string | undefined,
): SerializedCard {
  return {
    id: card.id,
    traceabilityCode: card.traceabilityCode,
    derivedFromIds: card.derivedFromIds,
    stageCode,
    stepCode,
    laneKey: card.laneKey,
    title: card.title,
    body: card.body,
    tags: card.tags,
    sourceRef: card.sourceRef,
    sourceFile: card.sourceFile,
    sourceSheet: card.sourceSheet,
    sourceRow: card.sourceRow,
  };
}

function serializeStep(step: Step, cards: Card[], stageCode: string | undefined): SerializedStep {
  const stepCards = cards
    .filter((c) => c.stepId === step.id)
    .sort((a, b) => a.order - b.order)
    .map((c) => serializeCard(c, stageCode, step.traceabilityCode));

  return {
    id: step.id,
    traceabilityCode: step.traceabilityCode,
    title: step.title,
    order: step.order,
    cards: stepCards,
  };
}

function serializeStage(stage: Stage, steps: Step[], cards: Card[]): SerializedStage {
  const stageSteps = steps
    .filter((s) => s.stageId === stage.id)
    .sort((a, b) => a.order - b.order)
    .map((s) => serializeStep(s, cards, stage.traceabilityCode));

  return {
    id: stage.id,
    traceabilityCode: stage.traceabilityCode,
    title: stage.title,
    outcome: stage.outcome,
    order: stage.order,
    steps: stageSteps,
  };
}

function serializeCardLink(link: CardLink, cardCodeMap: Map<string, string>): SerializedCardLink {
  return {
    id: link.id,
    relation: link.relation,
    sourceId: link.sourceCardId,
    targetId: link.targetCardId,
    sourceCode: cardCodeMap.get(link.sourceCardId),
    targetCode: cardCodeMap.get(link.targetCardId),
  };
}

function serializeStepLink(link: StepLink, stepCodeMap: Map<string, string>): SerializedStepLink {
  return {
    id: link.id,
    traceabilityCode: link.traceabilityCode,
    sourceStepId: link.sourceStepId,
    targetStepId: link.targetStepId,
    sourceStepCode: stepCodeMap.get(link.sourceStepId),
    targetStepCode: stepCodeMap.get(link.targetStepId),
  };
}

// ---------------------------------------------------------------------------
// Main serializer
// ---------------------------------------------------------------------------

/**
 * Produces a fully normalized, nested JSON representation of the blueprint.
 *
 * Structure:
 *   stages (sorted by order)
 *     └── steps (sorted by order)
 *           └── cards (sorted by order, all lanes)
 *   cardLinks     (with resolved traceability codes on both ends)
 *   stepLinks     (with resolved step codes on both ends)
 *   opportunities (with `requirementCodes` appended — derived REQ codes)
 *   requirements
 *   apiContracts
 *   uiScaffolds
 */
export function serializeBlueprintToJson(state: BlueprintState): SerializedBlueprint {
  const {
    blueprint,
    stages,
    steps,
    cards,
    cardLinks,
    stepLinks,
    opportunities,
    requirements,
    apiContracts,
    uiScaffolds,
  } = state;

  // Build lookup maps for resolving codes in links
  const cardCodeMap = new Map<string, string>(
    cards.filter((c) => c.traceabilityCode).map((c) => [c.id, c.traceabilityCode!]),
  );
  const stepCodeMap = new Map<string, string>(
    steps.filter((s) => s.traceabilityCode).map((s) => [s.id, s.traceabilityCode!]),
  );

  const serializedStages = stages
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((stage) => serializeStage(stage, steps, cards));

  const serializedCardLinks = cardLinks.map((l) => serializeCardLink(l, cardCodeMap));

  const serializedStepLinks = (stepLinks ?? []).map((l) => serializeStepLink(l, stepCodeMap));

  // Annotate each opportunity with the REQ codes derived from it
  const opportunitiesWithRequirements = opportunities.map((opp) => {
    const requirementCodes = (requirements ?? [])
      .filter(
        (r) => opp.traceabilityCode && r.derivedFromIds.includes(opp.traceabilityCode),
      )
      .map((r) => r.traceabilityCode);
    return { ...opp, requirementCodes };
  });

  return {
    blueprint: {
      id: blueprint.id,
      serviceName: blueprint.serviceName,
      description: blueprint.description,
    },
    stages: serializedStages,
    cardLinks: serializedCardLinks,
    stepLinks: serializedStepLinks,
    opportunities: opportunitiesWithRequirements,
    requirements: requirements ?? [],
    apiContracts: apiContracts ?? [],
    uiScaffolds: uiScaffolds ?? [],
  };
}
