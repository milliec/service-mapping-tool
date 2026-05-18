export interface Blueprint {
  id: string;
  serviceName: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  /**
   * When set, "Copy share link" / OST publish reuses this Supabase row so the same
   * /view/:id URL shows updated content. Not included in shared snapshots (stripped server-side).
   */
  publishedShareId?: string;
}

export interface Stage {
  id: string;
  blueprintId: string;
  title: string;
  outcome: string;
  order: number;
  /** Human-readable traceability code, e.g. ST-003. Assigned once on creation; never regenerated. */
  traceabilityCode?: string;
  /** Optional phase grouping, e.g. "Production", "Consumption", "Waste management". */
  phase?: string;
  /** Optional description shown as a sub-header row below the stage title. */
  description?: string;
}

export interface Step {
  id: string;
  blueprintId: string;
  stageId: string;
  title: string;
  order: number;
  /** Human-readable traceability code, e.g. SS-007. Assigned once on creation; never regenerated. */
  traceabilityCode?: string;
}

export interface LaneDefinition {
  key: LaneKey;
  title: string;
  order: number;
  visible: boolean;
  collapsed: boolean;
}

export type CardStatus = 'draft' | 'in_review' | 'approved' | 'blocked';

export type LinkRelation =
  | 'causes'
  | 'informs'
  | 'addresses'
  | 'depends_on'
  | 'implements'
  | 'generates'
  | 'requires'
  | 'relates_to'
  /** System-only relation for step-to-step transitions. Not shown in the UI add-link dropdown. */
  | 'next_step';

export type EvidenceType = 'research' | 'data' | 'policy' | 'assumption' | 'note';

export type EvidenceStrength = 'strong' | 'moderate' | 'weak';

export interface CardLink {
  id: string;
  blueprintId: string;
  sourceCardId: string;
  targetCardId: string;
  relation: LinkRelation;
  createdAt: string;
}

export interface Evidence {
  id: string;
  blueprintId: string;
  cardId: string;
  quote: string;
  source: string;
  evidenceType: EvidenceType;
  strength: EvidenceStrength;
  createdAt: string;
  updatedAt: string;
  /** Human-readable traceability code, e.g. EVD-004. */
  traceabilityCode?: string;
}

export interface Card {
  id: string;
  blueprintId: string;
  stageId: string;
  stepId: string;
  laneKey: LaneKey;
  title: string;
  body: string;
  order: number;
  tags: string[];
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number | null;
  sourceRef: string;
  owner?: string;
  status?: CardStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  /** Human-readable traceability code derived from lane, e.g. PP-027, UN-018. Assigned once; stable. */
  traceabilityCode?: string;
  /**
   * Upstream traceability references — traceabilityCodes of entities this card was derived from.
   * Used for downstream artifact chains (e.g. a BP card derived from a PI policy card).
   */
  derivedFromIds?: string[];
}

export const LANE_KEYS = [
  // L2 Micro lanes
  'actor',
  'user_action_event',
  'user_need',
  'pain_point',
  'frontstage_touchpoint',
  'activity',
  'backstage_process',
  'description',
  'behaviour_change',
  'success_measure',
  'motivation',
  'ability',
  'prompts',
  'system',
  'policy_intent',
  'business_rule',
  'data_input',
  'data_output',
  'backstage_actor',
  'shared_services',
  'opportunities',
  'ideas',
  // L1 Macro lanes
  'policy_outcome',
  'user_outcome',
  'operational_outcome',
  'insights',
  'impact_of_pain_points',
  'performance_indicators',
  'opportunities_lane',
  'third_parties_involved',
  'support_system',
] as const;

export type LaneKey = (typeof LANE_KEYS)[number];

export interface StoryboardImage {
  id: string;
  blueprintId: string;
  stepId: string;
  dataUrl: string;
  createdAt: string;
  updatedAt: string;
}

export type OpportunityStatus = 'open' | 'in_progress' | 'resolved' | 'wont_fix';
export type OpportunityOrigin = 'seed' | 'imported' | 'generated' | 'user';

export interface Opportunity {
  id: string;
  blueprintId: string;
  title: string;
  /** Problem area or improvement opportunity — must NOT propose a specific solution */
  statement: string;
  rationale: string;
  sourceCardIds: string[];
  affectedStages: string[];
  affectedSteps: string[];
  owner?: string;
  status: OpportunityStatus;
  /** Where this opportunity came from. Missing on legacy/seed records. */
  origin?: OpportunityOrigin;
  createdAt: string;
  updatedAt: string;
  /** Human-readable traceability code, e.g. OPP-003. Assigned once on acceptance; never regenerated. */
  traceabilityCode?: string;
  /** Upstream traceabilityCodes of source entities (pain points, user needs) that informed this opportunity. */
  derivedFromIds?: string[];
  /** Parent outcome this opportunity contributes to. Null/undefined = unassigned. */
  outcomeId?: string;
  /** Parent opportunity ID for nested product-team findings (Teresa Torres sub-opportunity). */
  parentOpportunityId?: string;
}

export type SolutionStatus = 'research' | 'ideation' | 'validating' | 'building' | 'shipped' | 'dropped';
export type AssumptionStatus = 'untested' | 'validated' | 'invalidated';

/** Status lifecycle shared by downstream artifacts (Requirement, ApiContract, UiScaffold). */
export type ArtifactStatus = 'draft' | 'reviewed' | 'approved' | 'deprecated';

/**
 * Explicit step-to-step transition link.
 * Models the `next_step` relationship from import data or manual authoring.
 * Kept separate from CardLink (which is card-to-card) to preserve semantic clarity.
 */
export interface StepLink {
  id: string;
  blueprintId: string;
  sourceStepId: string;
  targetStepId: string;
  /** Traceability code NS-NNN. Assigned on creation; never regenerated. */
  traceabilityCode?: string;
  createdAt: string;
}

/**
 * A functional or non-functional requirement derived from one or more Opportunities.
 * Traceability chain: Pain Point → Opportunity → Requirement
 */
export interface Requirement {
  id: string;
  blueprintId: string;
  /** Traceability code REQ-NNN. Always assigned on creation. */
  traceabilityCode: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  /** Traceability codes of upstream Opportunities this was derived from. */
  derivedFromIds: string[];
  /** Blueprint card IDs that are the upstream source of this requirement. */
  sourceCardIds: string[];
  status: ArtifactStatus;
  owner?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * An API contract specification derived from one or more Requirements.
 * Traceability chain: Requirement → ApiContract
 */
export interface ApiContract {
  id: string;
  blueprintId: string;
  /** Traceability code API-NNN. Always assigned on creation. */
  traceabilityCode: string;
  title: string;
  endpoint?: string;
  method?: string;
  description?: string;
  /** Traceability codes of upstream Requirements this was derived from. */
  derivedFromIds: string[];
  /** Blueprint card IDs that are the upstream source of this contract. */
  sourceCardIds: string[];
  status: ArtifactStatus;
  owner?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A UI component/screen scaffold derived from Requirements and optionally ApiContracts.
 * Traceability chain: Requirement (+ ApiContract) → UiScaffold
 */
export interface UiScaffold {
  id: string;
  blueprintId: string;
  /** Traceability code UI-NNN. Always assigned on creation. */
  traceabilityCode: string;
  title: string;
  componentName?: string;
  description?: string;
  /** Traceability codes of upstream Requirements and ApiContracts this was derived from. */
  derivedFromIds: string[];
  /** Blueprint card IDs that are the upstream source of this scaffold. */
  sourceCardIds: string[];
  status: ArtifactStatus;
  owner?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Solution {
  id: string;
  blueprintId: string;
  opportunityId: string;
  title: string;
  description?: string;
  status: SolutionStatus;
  owner?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Assumption {
  id: string;
  blueprintId: string;
  solutionId: string;
  /** Hypothesis: "We believe that..." */
  title: string;
  rationale?: string;
  status: AssumptionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SystemOutcome {
  id: string;
  blueprintId: string;
  code: string; // 'SYS-01'
  title: string;
  /** Strategic goal IDs (ENV) this system condition supports. */
  goalIds: string[];
  /** Opportunity area codes (e.g. 'AREA-E') connected to this system condition. */
  relatedAreaCodes: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface BehaviourOutcome {
  id: string;
  blueprintId: string;
  code: string; // 'BEH-01'
  title: string;
  actors: string[];
  /** Opportunity area codes connected to this behaviour. */
  relatedAreaCodes: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceOutcome {
  id: string;
  blueprintId: string;
  code: string; // 'SO-01'
  title: string;
  /** Behaviour outcome IDs this service outcome enables. */
  behIds: string[];
  /** Opportunity area codes connected to this service outcome. */
  relatedAreaCodes: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type StrategicGoalColor = 'emerald' | 'blue' | 'violet' | 'amber' | 'rose' | 'sky' | 'teal' | 'orange';

export interface StrategicGoal {
  id: string;
  blueprintId: string;
  title: string;
  description?: string;
  color: StrategicGoalColor;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Outcome {
  id: string;
  blueprintId: string;
  /** Parent strategic goal. */
  goalId: string;
  title: string;
  description?: string;
  /** Stable domain code used for strategy spine filtering, e.g. 'AREA-E'. */
  code?: string;
  /** Optional measurable target, e.g. "80% first-time submission accuracy by 2027". */
  metric?: string;
  /** User-marked priority opportunity area (OST). */
  priorityStarred?: boolean;
  /** Why this area is prioritised (shown when priorityStarred). */
  priorityRationale?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlueprintState {
  blueprint: Blueprint;
  stages: Stage[];
  steps: Step[];
  lanes: LaneDefinition[];
  childBlueprints: BlueprintState[];
  /** Root board snapshot while a child journey is open. Null/undefined when viewing the root board. */
  rootDocument?: BlueprintState | null;
  /** Active board context. Defaults to blueprint.id. */
  activeBlueprintId?: string;
  /** Root board id for breadcrumb/context. Defaults to blueprint.id. */
  rootBlueprintId?: string;
  cards: Card[];
  storyboardImages: StoryboardImage[];
  storyboardVisible: boolean;
  storyboardCollapsed: boolean;
  cardLinks: CardLink[];
  evidence: Evidence[];
  opportunities: Opportunity[];
  solutions: Solution[];
  assumptions: Assumption[];
  strategicGoals: StrategicGoal[];
  outcomes: Outcome[];
  systemOutcomes: SystemOutcome[];
  behaviourOutcomes: BehaviourOutcome[];
  serviceOutcomes: ServiceOutcome[];
  stepLinks: StepLink[];
  requirements: Requirement[];
  apiContracts: ApiContract[];
  uiScaffolds: UiScaffold[];
  /**
   * Per-prefix sequence counters for traceability code generation.
   * Key: prefix string (e.g. 'PP', 'ST', 'OPP', 'SRC_PDF').
   * Value: last-used sequence number.
   * Persisted and participates in undo/redo so codes are stable across history.
   */
  traceabilityCounters: Record<string, number>;
}

export interface ImportRow {
  record_type: string;
  service_name: string;
  stage: string;
  stage_order: number;
  stage_outcome: string;
  step: string;
  step_order: number;
  lane_key: string;
  card_title: string;
  card_body: string;
  card_order: number;
  tags: string;
  source_ref: string;
  /** Pre-assigned traceability code from source data (e.g. PP-027). Preserved as-is; never overwritten. */
  traceability_code?: string;
  /** Comma-separated upstream traceability codes this card was derived from. */
  derived_from_ids?: string;
  /** Target step for a next_step transition. Accepts: SS-NNN code, stage::step composite, or bare step title. */
  next_step?: string;
}

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  state: BlueprintState;
  errors: ImportValidationError[];
  warnings: ImportValidationError[];
  /**
   * Source provenance counters generated during import (SRC_PDF, SRC_XLSX, etc.).
   * The store merges these into BlueprintState.traceabilityCounters on load.
   */
  srcRefCounters?: Record<string, number>;
  /**
   * Semantic traceability counters assigned during import (ST, SS, PP, UN, etc.).
   * Kept separate from srcRefCounters; the store merges both on load.
   */
  traceabilityCounters?: Record<string, number>;
}
