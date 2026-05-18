import { v4 as uuid } from 'uuid';
import { type BlueprintState, type Card, type Opportunity, type Outcome, type Solution, type Assumption, type Stage, type Step, type StrategicGoal, type SystemOutcome, type BehaviourOutcome, type ServiceOutcome } from './types';
import { DEFAULT_LANES } from './lane-definitions';

function makeCard(
  blueprintId: string,
  stageId: string,
  stepId: string,
  laneKey: string,
  title: string,
  body: string,
  order: number,
  tags: string[] = [],
): Card {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    blueprintId,
    stageId,
    stepId,
    laneKey: laneKey as Card['laneKey'],
    title,
    body,
    order,
    tags,
    sourceFile: '',
    sourceSheet: '',
    sourceRow: null,
    sourceRef: 'seed',
    createdAt: now,
    updatedAt: now,
  };
}

export function createSeedBlueprint(): BlueprintState {
  const bpId = uuid();
  const now = new Date().toISOString();

  const stages: Stage[] = [
    { id: uuid(), blueprintId: bpId, title: 'Prepare', outcome: 'Producer understands obligations and has the required source information', order: 0, phase: 'Planning' },
    { id: uuid(), blueprintId: bpId, title: 'Submit', outcome: 'Producer successfully submits a valid return before the deadline', order: 1, phase: 'Submission' },
    { id: uuid(), blueprintId: bpId, title: 'Review', outcome: 'Regulator reviews submission and confirms or queries the data', order: 2, phase: 'Review' },
    { id: uuid(), blueprintId: bpId, title: 'Respond', outcome: 'Producer resolves any queries and receives confirmation of compliance', order: 3, phase: 'Resolution' },
  ];

  const steps: Step[] = [
    { id: uuid(), blueprintId: bpId, stageId: stages[0].id, title: 'Check whether reporting applies', order: 0 },
    { id: uuid(), blueprintId: bpId, stageId: stages[0].id, title: 'Gather packaging data', order: 1 },
    { id: uuid(), blueprintId: bpId, stageId: stages[1].id, title: 'Upload and review submission', order: 0 },
    { id: uuid(), blueprintId: bpId, stageId: stages[1].id, title: 'Confirm and submit return', order: 1 },
    { id: uuid(), blueprintId: bpId, stageId: stages[2].id, title: 'Assess submission quality', order: 0 },
    { id: uuid(), blueprintId: bpId, stageId: stages[3].id, title: 'Respond to queries', order: 0 },
    { id: uuid(), blueprintId: bpId, stageId: stages[3].id, title: 'Receive confirmation', order: 1 },
  ];

  const cards: Card[] = [
    // Stage 1, Step 1: Check whether reporting applies
    makeCard(bpId, stages[0].id, steps[0].id, 'actor', 'Producer', 'Small business owner trying to understand whether reporting applies', 0, ['user']),
    makeCard(bpId, stages[0].id, steps[0].id, 'user_action_event', 'Reviews guidance and checks packaging thresholds', 'Searches GOV.UK and cross-checks tonnage thresholds', 0, ['journey']),
    makeCard(bpId, stages[0].id, steps[0].id, 'user_need', 'As a producer, I need to know whether I am in scope and what I must report', '', 0, ['research']),
    makeCard(bpId, stages[0].id, steps[0].id, 'pain_point', 'Guidance is fragmented and threshold rules are hard to interpret', '', 0, ['research']),
    makeCard(bpId, stages[0].id, steps[0].id, 'frontstage_touchpoint', 'Guidance pages and obligation checker', '', 0, ['touchpoint']),
    makeCard(bpId, stages[0].id, steps[0].id, 'backstage_process', 'Maintain guidance content and obligation checker rules', '', 0, ['operations']),
    makeCard(bpId, stages[0].id, steps[0].id, 'system', 'CMS and obligation checker service', '', 0, ['tech']),
    makeCard(bpId, stages[0].id, steps[0].id, 'policy_intent', 'Help producers understand whether EPR applies to them', '', 0, ['policy']),
    makeCard(bpId, stages[0].id, steps[0].id, 'business_rule', 'If annual packaging placed on market exceeds the threshold, registration and reporting are required', '', 0, ['rules']),
    makeCard(bpId, stages[0].id, steps[0].id, 'data_input', 'Annual tonnage, company registration number, packaging activity type', '', 0, ['data']),
    makeCard(bpId, stages[0].id, steps[0].id, 'data_output', 'In-scope decision and reporting requirements summary', '', 0, ['data']),

    // Stage 1, Step 2: Gather packaging data
    makeCard(bpId, stages[0].id, steps[1].id, 'actor', 'Producer', '', 0, ['user']),
    makeCard(bpId, stages[0].id, steps[1].id, 'user_action_event', 'Collects packaging data from suppliers and internal records', '', 0, ['journey']),
    makeCard(bpId, stages[0].id, steps[1].id, 'user_need', 'As a producer, I need clarity on what data to collect and in what format', '', 0, ['research']),
    makeCard(bpId, stages[0].id, steps[1].id, 'pain_point', 'Suppliers do not provide packaging data easily', '', 0, ['research']),
    makeCard(bpId, stages[0].id, steps[1].id, 'frontstage_touchpoint', 'Data collection template and supplier portal', '', 0, ['touchpoint']),
    makeCard(bpId, stages[0].id, steps[1].id, 'backstage_process', 'Provide data templates and process supplier integrations', '', 0, ['operations']),
    makeCard(bpId, stages[0].id, steps[1].id, 'system', 'Packaging data schema and supplier integration API', '', 0, ['tech']),
    makeCard(bpId, stages[0].id, steps[1].id, 'data_input', 'Packaging material type, weight, recyclability rating, supplier ID', '', 0, ['data']),

    // Stage 2, Step 1: Upload and review submission
    makeCard(bpId, stages[1].id, steps[2].id, 'actor', 'Producer', '', 0, ['user']),
    makeCard(bpId, stages[1].id, steps[2].id, 'user_action_event', 'Uploads completed file and reviews validation messages', '', 0, ['journey']),
    makeCard(bpId, stages[1].id, steps[2].id, 'user_need', 'As a producer, I need quick feedback on whether my submission is valid', '', 0, ['research']),
    makeCard(bpId, stages[1].id, steps[2].id, 'pain_point', 'Validation errors are difficult to interpret and do not explain how to fix them', '', 0, ['research']),
    makeCard(bpId, stages[1].id, steps[2].id, 'frontstage_touchpoint', 'Upload form and validation screen', '', 0, ['touchpoint']),
    makeCard(bpId, stages[1].id, steps[2].id, 'backstage_process', 'Run validation rules and generate submission receipt', '', 0, ['operations']),
    makeCard(bpId, stages[1].id, steps[2].id, 'system', 'Submission portal and validation rules engine', '', 0, ['tech']),
    makeCard(bpId, stages[1].id, steps[2].id, 'policy_intent', 'Support compliant and timely submission of packaging data', '', 0, ['policy']),
    makeCard(bpId, stages[1].id, steps[2].id, 'business_rule', 'Submission must include all mandatory fields and pass validation before acceptance', '', 0, ['rules']),
    makeCard(bpId, stages[1].id, steps[2].id, 'data_input', 'Submission file, reporting period, producer identifier', '', 0, ['data']),
    makeCard(bpId, stages[1].id, steps[2].id, 'data_output', 'Validation result, accepted submission record, error report', '', 0, ['data']),

    // Stage 2, Step 2: Confirm and submit return
    makeCard(bpId, stages[1].id, steps[3].id, 'actor', 'Producer', '', 0, ['user']),
    makeCard(bpId, stages[1].id, steps[3].id, 'user_action_event', 'Reviews summary and confirms submission', '', 0, ['journey']),
    makeCard(bpId, stages[1].id, steps[3].id, 'frontstage_touchpoint', 'Submission confirmation screen and email', '', 0, ['touchpoint']),
    makeCard(bpId, stages[1].id, steps[3].id, 'data_output', 'Submission receipt and reference number', '', 0, ['data']),

    // Stage 3, Step 1: Assess submission quality
    makeCard(bpId, stages[2].id, steps[4].id, 'actor', 'Regulator', '', 0, ['internal']),
    makeCard(bpId, stages[2].id, steps[4].id, 'user_action_event', 'Reviews flagged submissions and runs compliance checks', '', 0, ['journey']),
    makeCard(bpId, stages[2].id, steps[4].id, 'frontstage_touchpoint', 'Query notification email', '', 0, ['touchpoint']),
    makeCard(bpId, stages[2].id, steps[4].id, 'backstage_process', 'Automated compliance scoring and manual review', '', 0, ['operations']),
    makeCard(bpId, stages[2].id, steps[4].id, 'system', 'Compliance review platform and risk scoring engine', '', 0, ['tech']),
    makeCard(bpId, stages[2].id, steps[4].id, 'business_rule', 'Submissions with anomalies above threshold are flagged for manual review', '', 0, ['rules']),
    makeCard(bpId, stages[2].id, steps[4].id, 'data_input', 'Submitted data, historical benchmarks, risk thresholds', '', 0, ['data']),
    makeCard(bpId, stages[2].id, steps[4].id, 'data_output', 'Review outcome, query list, compliance score', '', 0, ['data']),

    // Stage 4, Step 1: Respond to queries
    makeCard(bpId, stages[3].id, steps[5].id, 'actor', 'Producer', '', 0, ['user']),
    makeCard(bpId, stages[3].id, steps[5].id, 'user_action_event', 'Reviews query details and submits corrected data or evidence', '', 0, ['journey']),
    makeCard(bpId, stages[3].id, steps[5].id, 'user_need', 'As a producer, I need to understand what exactly is wrong and how to fix it', '', 0, ['research']),
    makeCard(bpId, stages[3].id, steps[5].id, 'pain_point', 'Query notifications lack detail and turnaround is too short', '', 0, ['research']),
    makeCard(bpId, stages[3].id, steps[5].id, 'frontstage_touchpoint', 'Query response portal and notification emails', '', 0, ['touchpoint']),
    makeCard(bpId, stages[3].id, steps[5].id, 'backstage_process', 'Track query responses and update compliance record', '', 0, ['operations']),
    makeCard(bpId, stages[3].id, steps[5].id, 'system', 'Query management system', '', 0, ['tech']),

    // Stage 4, Step 2: Receive confirmation
    makeCard(bpId, stages[3].id, steps[6].id, 'actor', 'Producer', '', 0, ['user']),
    makeCard(bpId, stages[3].id, steps[6].id, 'user_action_event', 'Receives compliance confirmation', '', 0, ['journey']),
    makeCard(bpId, stages[3].id, steps[6].id, 'frontstage_touchpoint', 'Compliance certificate and portal status', '', 0, ['touchpoint']),
    makeCard(bpId, stages[3].id, steps[6].id, 'data_output', 'Compliance status, certificate, next reporting period date', '', 0, ['data']),
  ];

  // ── Strategic Goals (circular economy) ────────────────────────────────────
  const goalReduceWasteId = uuid();
  const goalIncreaseRecyclingId = uuid();
  const goalPreventCrimeId = uuid();

  const strategicGoals: StrategicGoal[] = [
    { id: goalReduceWasteId, blueprintId: bpId, title: 'Reduce waste', description: 'Minimise packaging waste through accurate data and better compliance guidance.', color: 'emerald', order: 0, createdAt: now, updatedAt: now },
    { id: goalIncreaseRecyclingId, blueprintId: bpId, title: 'Increase recycling of materials', description: 'Improve quality and completeness of packaging data to support recycling targets.', color: 'blue', order: 1, createdAt: now, updatedAt: now },
    { id: goalPreventCrimeId, blueprintId: bpId, title: 'Prevent waste crime', description: 'Strengthen submission validation and compliance review to deter fraudulent reporting.', color: 'rose', order: 2, createdAt: now, updatedAt: now },
  ];

  // ── Outcomes ───────────────────────────────────────────────────────────────
  const out1Id = uuid(); // Reduce waste → producer self-service
  const out2Id = uuid(); // Increase recycling → data completeness
  const out3Id = uuid(); // Prevent crime → submission accuracy
  const out4Id = uuid(); // Prevent crime → query resolution

  const outcomes: Outcome[] = [
    { id: out1Id, blueprintId: bpId, goalId: goalReduceWasteId, title: '80% of producers successfully self-serve on obligation checks', metric: '80% self-serve rate', order: 0, createdAt: now, updatedAt: now },
    { id: out2Id, blueprintId: bpId, goalId: goalIncreaseRecyclingId, title: 'Producers submit complete and accurate packaging material data', metric: '>95% data completeness score', order: 0, createdAt: now, updatedAt: now },
    { id: out3Id, blueprintId: bpId, goalId: goalPreventCrimeId, title: '50% reduction in resubmissions caused by validation errors', metric: '50% resubmission reduction', order: 0, createdAt: now, updatedAt: now },
    { id: out4Id, blueprintId: bpId, goalId: goalPreventCrimeId, title: 'Compliance query resolution rate increases by 25%', metric: '+25% query resolution rate', order: 1, createdAt: now, updatedAt: now },
  ];

  // ── Opportunities ──────────────────────────────────────────────────────────
  const opp1Id = uuid();
  const opp2Id = uuid();
  const opp3Id = uuid();
  const opp4Id = uuid();

  const opportunities: Opportunity[] = [
    {
      id: opp1Id, blueprintId: bpId,
      title: 'Improve clarity of packaging obligation guidance',
      statement: 'Producers struggle to self-serve on whether EPR applies to them, leading to late or incorrect registrations.',
      rationale: 'Pain point: guidance is fragmented and threshold rules are hard to interpret.',
      sourceCardIds: [], affectedStages: [stages[0].id], affectedSteps: [],
      status: 'in_progress', outcomeId: out1Id,
      createdAt: now, updatedAt: now, traceabilityCode: 'OPP-001',
    },
    {
      id: opp2Id, blueprintId: bpId,
      title: 'Reduce burden of packaging data collection',
      statement: 'Producers manually chase suppliers for packaging data that could be shared digitally, creating delays and errors.',
      rationale: 'Pain point: suppliers do not provide packaging data easily.',
      sourceCardIds: [], affectedStages: [stages[0].id], affectedSteps: [],
      status: 'open', outcomeId: out2Id,
      createdAt: now, updatedAt: now, traceabilityCode: 'OPP-002',
    },
    {
      id: opp3Id, blueprintId: bpId,
      title: 'Make submission validation errors actionable',
      statement: 'Producers receive cryptic validation errors with no guidance on how to fix them, causing resubmissions and delays.',
      rationale: 'Pain point: validation errors are difficult to interpret.',
      sourceCardIds: [], affectedStages: [stages[1].id], affectedSteps: [],
      status: 'open', outcomeId: out3Id,
      createdAt: now, updatedAt: now, traceabilityCode: 'OPP-003',
    },
    {
      id: opp4Id, blueprintId: bpId,
      title: 'Improve query resolution experience',
      statement: 'Producers cannot effectively respond to compliance queries due to insufficient detail and unrealistic turnaround times.',
      rationale: 'Pain point: query notifications lack detail and turnaround is too short.',
      sourceCardIds: [], affectedStages: [stages[3].id], affectedSteps: [],
      status: 'open', outcomeId: out4Id,
      createdAt: now, updatedAt: now, traceabilityCode: 'OPP-004',
    },
  ];

  // ── Solutions ──────────────────────────────────────────────────────────────
  const sol1Id = uuid();
  const sol2Id = uuid();
  const sol3Id = uuid();
  const sol4Id = uuid();
  const sol5Id = uuid();

  const solutions: Solution[] = [
    { id: sol1Id, blueprintId: bpId, opportunityId: opp1Id, title: 'Interactive obligation checker with threshold calculator', status: 'building', createdAt: now, updatedAt: now },
    { id: sol2Id, blueprintId: bpId, opportunityId: opp1Id, title: 'Redesigned guidance pages with worked examples', status: 'shipped', createdAt: now, updatedAt: now },
    { id: sol3Id, blueprintId: bpId, opportunityId: opp2Id, title: 'Supplier data API — machine-readable packaging data exchange', status: 'validating', createdAt: now, updatedAt: now },
    { id: sol4Id, blueprintId: bpId, opportunityId: opp3Id, title: 'Plain-English error messages with inline fix suggestions', status: 'ideation', createdAt: now, updatedAt: now },
    { id: sol5Id, blueprintId: bpId, opportunityId: opp4Id, title: 'Structured query response portal with 14-day response window', status: 'ideation', createdAt: now, updatedAt: now },
  ];

  // ── Assumptions ────────────────────────────────────────────────────────────
  const assumptions: Assumption[] = [
    { id: uuid(), blueprintId: bpId, solutionId: sol1Id, title: 'Producers will use a self-serve checker rather than calling the helpline', status: 'validated', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sol1Id, title: 'Threshold rules are stable enough to encode without frequent updates', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sol3Id, title: 'Suppliers can expose packaging data via a standardised API', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sol3Id, title: 'Adoption rate will be high enough among large suppliers to reduce manual chasing', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sol4Id, title: 'Plain-English errors will reduce resubmission rate by >30%', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sol5Id, title: 'A 14-day window is sufficient for most query responses without regulatory risk', status: 'untested', createdAt: now, updatedAt: now },
  ];

  return {
    blueprint: {
      id: bpId,
      serviceName: 'Submit regulatory packaging data',
      description: 'End-to-end service blueprint for regulatory packaging data submission',
      createdAt: now,
      updatedAt: now,
    },
    stages,
    steps,
    lanes: DEFAULT_LANES.map(l => ({ ...l })),
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
    strategicGoals,
    outcomes,
    opportunities,
    solutions,
    assumptions,
    systemOutcomes: [],
    behaviourOutcomes: [],
    serviceOutcomes: [],
    stepLinks: [],
    requirements: [],
    apiContracts: [],
    uiScaffolds: [],
    traceabilityCounters: { OPP: 4 },
  };
}

// ─── Example Opportunity Tree blueprint ───────────────────────────────────────
// A standalone blueprint pre-populated with a rich Goal → Outcome → Opportunity
// → Solution → Assumption hierarchy, used by the "Example opportunity tree"
// menu action.
export function createExampleOstBlueprint(): BlueprintState {
  const bpId = uuid();
  const now = new Date().toISOString();

  // Minimal canvas — no stages/steps/cards needed for the OST example.
  const stages: Stage[] = [];
  const steps: Step[] = [];

  // ── Goals ──────────────────────────────────────────────────────────────────
  const gReduceId = uuid();
  const gRecycleId = uuid();
  const gCrimeId = uuid();

  const strategicGoals: StrategicGoal[] = [
    { id: gReduceId, blueprintId: bpId, title: 'Reduce waste', description: 'Cut total packaging waste through better data and guidance.', color: 'emerald', order: 0, createdAt: now, updatedAt: now },
    { id: gRecycleId, blueprintId: bpId, title: 'Increase recycling of materials', description: 'Raise the quality of recycling data to support circular economy targets.', color: 'blue', order: 1, createdAt: now, updatedAt: now },
    { id: gCrimeId, blueprintId: bpId, title: 'Prevent waste crime', description: 'Strengthen compliance checks to deter fraudulent reporting.', color: 'rose', order: 2, createdAt: now, updatedAt: now },
  ];

  // ── Outcomes ───────────────────────────────────────────────────────────────
  const oR1 = uuid(); const oR2 = uuid();
  const oC1 = uuid(); const oC2 = uuid();
  const oP1 = uuid(); const oP2 = uuid();

  const outcomes: Outcome[] = [
    { id: oR1, blueprintId: bpId, goalId: gReduceId, title: '80% of producers self-serve on obligation checks', metric: '80% self-serve rate', order: 0, createdAt: now, updatedAt: now },
    { id: oR2, blueprintId: bpId, goalId: gReduceId, title: '50% reduction in resubmissions from data errors', metric: '50% resubmission reduction', order: 1, createdAt: now, updatedAt: now },
    { id: oC1, blueprintId: bpId, goalId: gRecycleId, title: '>95% packaging data completeness on first submission', metric: '>95% completeness score', order: 0, createdAt: now, updatedAt: now },
    { id: oC2, blueprintId: bpId, goalId: gRecycleId, title: '3× increase in recyclability classification accuracy', metric: '3× accuracy improvement', order: 1, createdAt: now, updatedAt: now },
    { id: oP1, blueprintId: bpId, goalId: gCrimeId, title: '25% increase in compliance query resolution rate', metric: '+25% query resolution', order: 0, createdAt: now, updatedAt: now },
    { id: oP2, blueprintId: bpId, goalId: gCrimeId, title: 'Zero tolerance for duplicate or fraudulent submissions', metric: '0 confirmed fraud cases undetected', order: 1, createdAt: now, updatedAt: now },
  ];

  // ── Opportunities ──────────────────────────────────────────────────────────
  const op1 = uuid(); const op2 = uuid(); const op3 = uuid();
  const op4 = uuid(); const op5 = uuid(); const op6 = uuid();
  const op7 = uuid(); const op8 = uuid();

  const opportunities: Opportunity[] = [
    { id: op1, blueprintId: bpId, title: 'Guidance on obligation thresholds is hard to navigate', statement: 'Producers cannot easily determine if EPR applies to them without expert help.', rationale: '', sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'in_progress', outcomeId: oR1, createdAt: now, updatedAt: now, traceabilityCode: 'OPP-001' },
    { id: op2, blueprintId: bpId, title: 'No digital self-service for registration eligibility checks', statement: 'Producers must call a helpline to confirm registration requirements.', rationale: '', sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'open', outcomeId: oR1, createdAt: now, updatedAt: now, traceabilityCode: 'OPP-002' },
    { id: op3, blueprintId: bpId, title: 'Validation errors are cryptic and not actionable', statement: 'Error messages do not explain what is wrong or how to fix the data.', rationale: '', sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'open', outcomeId: oR2, createdAt: now, updatedAt: now, traceabilityCode: 'OPP-003' },
    { id: op4, blueprintId: bpId, title: 'Packaging data collection from suppliers is manual', statement: 'Producers spend days emailing suppliers for data that could be exchanged digitally.', rationale: '', sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'open', outcomeId: oC1, createdAt: now, updatedAt: now, traceabilityCode: 'OPP-004' },
    { id: op5, blueprintId: bpId, title: 'Recyclability classifications change without producer notification', statement: 'Producers submit data with stale recyclability ratings, reducing accuracy.', rationale: '', sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'open', outcomeId: oC2, createdAt: now, updatedAt: now, traceabilityCode: 'OPP-005' },
    { id: op6, blueprintId: bpId, title: 'Query notifications lack the detail needed to respond', statement: 'Producers receive vague queries with no reference to the specific data in question.', rationale: '', sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'in_progress', outcomeId: oP1, createdAt: now, updatedAt: now, traceabilityCode: 'OPP-006' },
    { id: op7, blueprintId: bpId, title: 'Query response window is too short for complex cases', statement: 'A 5-day turnaround is insufficient for producers who need to gather evidence.', rationale: '', sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'open', outcomeId: oP1, createdAt: now, updatedAt: now, traceabilityCode: 'OPP-007' },
    { id: op8, blueprintId: bpId, title: 'No duplicate detection across multiple submissions', statement: 'The same data can be submitted twice by different entities without detection.', rationale: '', sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'open', outcomeId: oP2, createdAt: now, updatedAt: now, traceabilityCode: 'OPP-008' },
  ];

  // ── Solutions ──────────────────────────────────────────────────────────────
  const s1 = uuid(); const s2 = uuid(); const s3 = uuid(); const s4 = uuid();
  const s5 = uuid(); const s6 = uuid(); const s7 = uuid(); const s8 = uuid();
  const s9 = uuid(); const s10 = uuid();

  const solutions: Solution[] = [
    { id: s1, blueprintId: bpId, opportunityId: op1, title: 'Interactive obligation checker with threshold calculator', status: 'building', createdAt: now, updatedAt: now },
    { id: s2, blueprintId: bpId, opportunityId: op1, title: 'Redesigned guidance pages with plain-English worked examples', status: 'shipped', createdAt: now, updatedAt: now },
    { id: s3, blueprintId: bpId, opportunityId: op2, title: 'Self-service eligibility portal with instant result', status: 'ideation', createdAt: now, updatedAt: now },
    { id: s4, blueprintId: bpId, opportunityId: op3, title: 'Contextual error messages with inline fix suggestions', status: 'validating', createdAt: now, updatedAt: now },
    { id: s5, blueprintId: bpId, opportunityId: op4, title: 'Supplier data API — machine-readable packaging exchange', status: 'validating', createdAt: now, updatedAt: now },
    { id: s6, blueprintId: bpId, opportunityId: op5, title: 'Live recyclability reference API embedded in submission form', status: 'ideation', createdAt: now, updatedAt: now },
    { id: s7, blueprintId: bpId, opportunityId: op6, title: 'Structured query portal with direct data links', status: 'building', createdAt: now, updatedAt: now },
    { id: s8, blueprintId: bpId, opportunityId: op7, title: 'Extended 14-day response window for complex queries', status: 'shipped', createdAt: now, updatedAt: now },
    { id: s9, blueprintId: bpId, opportunityId: op7, title: 'Guided evidence submission template', status: 'ideation', createdAt: now, updatedAt: now },
    { id: s10, blueprintId: bpId, opportunityId: op8, title: 'Cross-submission deduplication engine using producer ID + period hash', status: 'ideation', createdAt: now, updatedAt: now },
  ];

  // ── Assumptions ────────────────────────────────────────────────────────────
  const assumptions: Assumption[] = [
    { id: uuid(), blueprintId: bpId, solutionId: s1, title: 'Producers will use a self-serve checker rather than calling the helpline', status: 'validated', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: s1, title: 'Threshold rules are stable enough to encode without weekly updates', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: s3, title: 'A digital portal reduces helpline call volume by >40%', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: s4, title: 'Plain-language errors reduce resubmission rate by >30%', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: s5, title: 'Major suppliers can implement the API within 6 months', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: s5, title: 'API adoption among large suppliers is sufficient to reduce manual chasing', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: s6, title: 'An embedded reference API improves classification accuracy without slowing submission', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: s7, title: 'Linking query notices to specific data fields reduces back-and-forth by >50%', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: s8, title: 'A 14-day window is sufficient without creating regulatory risk', status: 'validated', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: s10, title: 'Producer ID + reporting period hash is a reliable deduplication key', status: 'untested', createdAt: now, updatedAt: now },
  ];

  return {
    blueprint: { id: bpId, serviceName: 'Example opportunity tree', description: 'A pre-populated example showing the Goal → Outcome → Opportunity → Solution → Assumption hierarchy.', createdAt: now, updatedAt: now },
    stages,
    steps,
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
    strategicGoals,
    outcomes,
    opportunities,
    solutions,
    assumptions,
    systemOutcomes: [],
    behaviourOutcomes: [],
    serviceOutcomes: [],
    stepLinks: [],
    requirements: [],
    apiContracts: [],
    uiScaffolds: [],
    traceabilityCounters: { OPP: 8 },
  };
}

// ─── Defra Environmental Opportunity Map ──────────────────────────────────────
// Pre-populated from defra-environmental-opportunity-map-2026-04-28.area-tree.mmd
// Goals = ENV-01/02/03, Outcomes = AREA-A…J, Opportunities = A1-J5.
export function createDefraEnvironmentalOstBlueprint(): BlueprintState {
  const bpId = uuid();
  const now = new Date().toISOString();

  // ── Strategic Goals ────────────────────────────────────────────────────────
  const gEnv01 = uuid();
  const gEnv02 = uuid();
  const gEnv03 = uuid();

  const gPackUK = uuid();

  const strategicGoals: StrategicGoal[] = [
    { id: gEnv01, blueprintId: bpId, title: 'Reduce waste', description: 'Improve prevention and packaging-design incentives; reduce avoidable reporting friction that blocks lower-material choices; give policy teams better data to evaluate waste reduction.', color: 'emerald', order: 0, createdAt: now, updatedAt: now },
    { id: gEnv02, blueprintId: bpId, title: 'Increase circularity', description: 'Make reuse, refill, recyclability, evidence, and material-flow data easier to understand, report, monitor, and act on.', color: 'teal', order: 1, createdAt: now, updatedAt: now },
    { id: gEnv03, blueprintId: bpId, title: 'Prevent waste crime', description: 'Improve end-to-end traceability, permit legitimacy checks, anomaly detection, audit trails, and investigation workflows.', color: 'rose', order: 2, createdAt: now, updatedAt: now },
    { id: gPackUK, blueprintId: bpId, title: 'PackUK Operational Outcomes', description: 'Service-level outcomes connecting product delivery to Defra environmental goals through waste movement tracking performance.', color: 'sky', order: 3, createdAt: now, updatedAt: now },
  ];

  // ── Outcomes (Opportunity Areas) ───────────────────────────────────────────
  // Each area is assigned to its primary environmental outcome.
  const oAreaA = uuid(); // → ENV-01
  const oAreaB = uuid(); // → ENV-02
  const oAreaC = uuid(); // → ENV-01
  const oAreaD = uuid(); // → ENV-02
  const oAreaE = uuid(); // → ENV-03
  const oAreaF = uuid(); // → ENV-03
  const oAreaG = uuid(); // → ENV-01
  const oAreaH = uuid(); // → ENV-01
  const oAreaI = uuid(); // → ENV-01
  const oAreaJ = uuid(); // → ENV-03

  // PackUK operational outcomes (OST-2026-04-26 product layer)
  const oPackUKEfficiency = uuid();
  const oPackUKValue = uuid();
  const oPackUKData = uuid();

  const outcomes: Outcome[] = [
    { id: oAreaA, blueprintId: bpId, goalId: gEnv01, code: 'AREA-A', title: 'AREA-A: Align Packaging Incentives With Environmental Intent', description: 'Producers make packaging decisions with clearer environmental and fee consequences before design choices are locked in.', order: 0, createdAt: now, updatedAt: now },
    { id: oAreaC, blueprintId: bpId, goalId: gEnv01, code: 'AREA-C', title: 'AREA-C: Improve Reporting, Validation, And Fee Transparency', description: 'Users classify, validate, submit, and understand charging obligations correctly first time.', order: 1, createdAt: now, updatedAt: now },
    { id: oAreaG, blueprintId: bpId, goalId: gEnv01, code: 'AREA-G', title: 'AREA-G: Make Ecosystem Adoption Proportionate And Stable', description: 'Organisations can comply and adapt without excessive disruption, confusion, or innovation lock-in.', order: 2, createdAt: now, updatedAt: now },
    { id: oAreaH, blueprintId: bpId, goalId: gEnv01, code: 'AREA-H', title: 'AREA-H: Simplify EPR Policy And Make Charging More Predictable And Proportionate', description: 'Producers make packaging decisions earlier with clearer fee signals and less EPR policy complexity.', metric: "This area is adjacent to 'policy barriers to innovation', but it is not the same thing. The evidence points to a more specific opportunity: simplify EPR policy and charging logic so producers can make better packaging decisions earlier, and so the policy burden is fairer across different organisation types.", order: 3, createdAt: now, updatedAt: now },
    { id: oAreaI, blueprintId: bpId, goalId: gEnv01, code: 'AREA-I', title: 'AREA-I: Influence Upstream Design Before Waste Exists', description: 'Producers can compare packaging options and understand environmental and fee consequences before design choices are locked in.', metric: 'This is the most prevention-oriented branch. It focuses on design decisions made before packaging becomes waste: material choice, packaging size, recyclability, compostability, reuse/refill potential, supply-chain configuration, and commercial lock-in. The opportunity is to move EPR from a downstream reporting obligation into an upstream design signal.', order: 4, createdAt: now, updatedAt: now },
    { id: oAreaB, blueprintId: bpId, goalId: gEnv02, code: 'AREA-B', title: 'AREA-B: Make Obligations, Roles, And Classification Easier To Apply', description: 'Users classify, validate, submit, and understand charging obligations correctly first time.', order: 0, createdAt: now, updatedAt: now },
    { id: oAreaD, blueprintId: bpId, goalId: gEnv02, code: 'AREA-D', title: 'AREA-D: Create Trusted, Reusable Data For Policy And Accountability', description: 'Internal users trust reusable data enough to stop recreating parallel evidence bases.', order: 1, createdAt: now, updatedAt: now },
    { id: oAreaE, blueprintId: bpId, goalId: gEnv03, code: 'AREA-E', title: 'AREA-E: Strengthen Waste Traceability And Real-World Movement Recording', description: 'Waste movements are recorded with complete, timely, and accurate tracking data from collection to destination.', order: 0, createdAt: now, updatedAt: now },
    { id: oAreaF, blueprintId: bpId, goalId: gEnv03, code: 'AREA-F', title: 'AREA-F: Improve Risk Detection, Investigation, And Enforcement Capability', description: 'Regulators can detect, prioritise, investigate, and evidence risk without rebuilding context manually.', order: 1, createdAt: now, updatedAt: now },
    { id: oAreaJ, blueprintId: bpId, goalId: gEnv03, code: 'AREA-J', title: 'AREA-J: Strengthen Operational Control And Status Visibility', description: 'Compliance and operational status is visible early enough for teams to intervene before gaps become persistent risk.', metric: 'This area came through more clearly when cross-checking the older opportunities/outcomes matrix. It is not mainly about policy design or environmental incentives. It is about whether the operational system can prove who is authorised to act, whether reporting is complete, whether evidence and payments reconcile, whether accreditation cases are progressing, and whether regulated capacity constraints are being respected.', order: 2, createdAt: now, updatedAt: now },

    // PackUK operational outcomes — product delivery layer (OST-2026-04-26)
    { id: oPackUKEfficiency, blueprintId: bpId, goalId: gPackUK, title: 'Efficiency — reduce time creating, correcting, validating, and reusing waste movement records', metric: 'SPI-022: time per waste movement record from collection to receipt', order: 0, createdAt: now, updatedAt: now },
    { id: oPackUKValue, blueprintId: bpId, goalId: gPackUK, title: 'Value for money — reduce avoidable manual reconciliation, support queries, rework, and duplicated reporting effort', order: 1, createdAt: now, updatedAt: now },
    { id: oPackUKData, blueprintId: bpId, goalId: gPackUK, title: 'Data accuracy — increase complete, timely, accurate, and reusable service data', metric: 'SPI-021: % of waste movements with complete, timely, and accurate tracking data from collection to destination', order: 2, createdAt: now, updatedAt: now },
  ];

  // ── Opportunities ──────────────────────────────────────────────────────────
  const opA1 = uuid(); const opA2 = uuid(); const opA3 = uuid(); const opA4 = uuid();
  const opB1 = uuid(); const opB2 = uuid(); const opB3 = uuid(); const opB4 = uuid();
  const opC1 = uuid(); const opC2 = uuid(); const opC3 = uuid(); const opC4 = uuid();
  const opD1 = uuid(); const opD2 = uuid(); const opD3 = uuid(); const opD4 = uuid();
  const opE1 = uuid(); const opE2 = uuid(); const opE3 = uuid(); const opE4 = uuid();
  const opF1 = uuid(); const opF2 = uuid(); const opF3 = uuid(); const opF4 = uuid();
  const opG1 = uuid(); const opG2 = uuid(); const opG3 = uuid(); const opG4 = uuid();
  const opH1 = uuid(); const opH2 = uuid(); const opH3 = uuid(); const opH4 = uuid(); const opH5 = uuid();
  const opI1 = uuid(); const opI2 = uuid(); const opI3 = uuid(); const opI4 = uuid(); const opI5 = uuid();
  const opJ1 = uuid(); const opJ2 = uuid(); const opJ3 = uuid(); const opJ4 = uuid(); const opJ5 = uuid();

  // Sub-opportunity IDs (product team findings — need named consts for solution references)
  const subH1a = uuid(); // product finding under H1
  const subB1a = uuid(); // product finding under B1
  const subB4a = uuid(); // product finding under B4
  const subC1a = uuid(); // product finding under C1

  const mkOpp = (id: string, code: string, title: string, outcomeId: string): Opportunity => ({
    id, blueprintId: bpId, title, statement: '', rationale: '',
    sourceCardIds: [], affectedStages: [], affectedSteps: [],
    status: 'open', outcomeId, createdAt: now, updatedAt: now, traceabilityCode: code,
  });

  const mkSubOpp = (id: string, title: string, parentOpportunityId: string): Opportunity => ({
    id, blueprintId: bpId, title, statement: '', rationale: '',
    sourceCardIds: [], affectedStages: [], affectedSteps: [],
    status: 'open', createdAt: now, updatedAt: now, parentOpportunityId,
  });

  // Evidence codes per opportunity — from defra-environmental-opportunity-map-2026-04-28.graph.json
  // (supported_by edges). Used to populate `statement` in the chain view.
  const evidenceByCode: Record<string, string> = {
    A1: 'E-110, E-111, E-112, E-118, E-121',   A2: 'E-111, E-118, E-119',
    A3: 'E-119, E-120',                          A4: 'E-107, E-121',
    B1: 'E-037, E-056, E-063, E-068, E-094, E-095', B2: 'E-108',
    B3: 'E-038, E-039, E-041, E-054, E-055, E-077, E-098', B4: 'E-064, E-065, E-076, E-093, E-098',
    C1: 'E-042, E-048, E-065, E-076, E-084, E-092, E-093', C2: 'E-045, E-047, E-057, E-066, E-071, E-119',
    C3: 'E-117',                                  C4: 'E-102',
    D1: 'E-002, E-008, E-014, E-027, E-089, E-090, E-099, E-101',
    D2: 'E-003, E-004, E-005, E-022, E-026, E-030, E-100',
    D3: 'E-012, E-024, E-052, E-061, E-087, E-088, E-090, E-105, E-115', D4: 'E-115',
    E1: 'E-028, E-067, E-072, E-073, E-081, E-083, E-090, E-091',
    E2: 'E-093, E-097',                          E3: 'E-079, E-098',
    E4: 'E-081, E-084, E-085, E-091, E-092',
    F1: 'E-009, E-011, E-023, E-033',            F2: 'E-001, E-010, E-018, E-019, E-026, E-031, E-091',
    F3: 'E-007, E-020, E-032, E-079',            F4: 'E-021, E-070, E-074',
    G1: 'E-056, E-116',                          G2: 'E-114',
    G3: 'E-075, E-080, E-096',                   G4: 'E-049, E-059, E-060, E-070, E-074, E-083, E-106',
    H1: 'E-109, E-117',                          H2: 'E-057, E-064, E-066, E-110, E-112, E-118, E-121',
    H3: 'E-113, E-114, E-115, E-116',            H4: 'E-113, E-115, E-119',
    H5: 'E-089, E-090, E-105, E-115',
    I1: 'E-057, E-064, E-066, E-110, E-111, E-118, E-119',
    I2: 'E-110, E-111, E-112, E-118',            I3: 'E-064, E-110, E-112, E-121',
    I4: 'E-114, E-116',                          I5: 'E-105, E-115, E-118, E-119',
    J1: 'E-038, E-041, E-050, E-103',            J2: 'E-029, E-049, E-104, E-106',
    J3: 'E-006, E-016, E-017, E-043, E-044',     J4: 'E-013, E-015, E-016, E-017, E-074',
    J5: 'E-034, E-068, E-072',
  };

  // KPI signals per opportunity — from ost-priority-branches-2026-04-30.md.
  // Reads top-to-bottom: product KPI → service outcome → behaviour → system condition → environmental outcome.
  const kpiByCode: Record<string, string> = {
    // Branch 1: Packaging incentives and material switching (AREA-A, H, I)
    A1: 'KPI signals: Scenario completion rate; confidence in packaging decision; reduction in support questions about fee consequences; number of design alternatives compared.',
    A2: 'KPI signals: Material-mix changes over time; policy-team confidence in charging rationale; industry understanding of fee model.',
    A3: 'KPI signals: Material-mix changes over time; policy-team confidence in charging rationale; industry understanding of fee model.',
    A4: 'KPI signals: Reuse/refill readiness assessments completed; producer confidence; follow-up actions started.',
    H2: 'KPI signals: Scenario completion rate; confidence in packaging decision; reduction in support questions about fee consequences; number of design alternatives compared.',
    H5: 'KPI signals: Availability of design-change data; completeness of packaging profile history; policy evaluation questions answered.',
    I1: 'KPI signals: Scenario completion rate; confidence in packaging decision; reduction in support questions about fee consequences; number of design alternatives compared.',
    I2: 'KPI signals: Material-mix changes over time; policy-team confidence in charging rationale; industry understanding of fee model.',
    I3: 'KPI signals: Scenario completion rate; confidence in packaging decision; number of design alternatives compared.',
    I4: 'KPI signals: Change preview use; packaging/data changes completed; perceived risk of change.',
    I5: 'KPI signals: Availability of design-change data; completeness of packaging profile history; policy evaluation questions answered.',
    // Branch 2: Obligations, classification, reporting, fee transparency (AREA-B, C, H)
    B1: 'KPI signals: Checker completion rate; support contacts about applicability; wrong-route corrections.',
    B2: 'KPI signals: Classification error rates; repeated correction loops; confidence after classification.',
    B3: 'KPI signals: Classification error rates; repeated correction loops; confidence after classification.',
    B4: 'KPI signals: Classification error rates; repeated correction loops; confidence after classification.',
    C1: 'KPI signals: Upload success rate; validation error resolution rate; drop-off at reporting steps.',
    C2: 'KPI signals: Fee explanation views used; support contacts about charges; successful self-serve charge reconciliation.',
    C3: 'KPI signals: Upload success rate; validation error resolution rate; drop-off at reporting steps.',
    C4: 'KPI signals: Upload success rate; validation error resolution rate; drop-off at reporting steps.',
    H1: 'KPI signals: Checker completion rate; support contacts about applicability; wrong-route corrections.',
    H3: 'KPI signals: Completion rate by actor type; assisted-route use; route time and error rate.',
    H4: 'KPI signals: Material-mix changes over time; policy-team confidence in charging rationale; industry understanding of fee model.',
    // Branch 3: Trusted, reusable data (AREA-D)
    D1: 'KPI signals: Reduction in bespoke extracts; repeat use of standard datasets; analyst satisfaction.',
    D2: 'KPI signals: Time to reconstruct a history; completeness of amendment lineage; confidence in historical comparison.',
    D3: 'KPI signals: Policy questions answered from reusable data; fields mapped to decisions; reduced manual reconciliation.',
    D4: 'KPI signals: Fields with clear decision owner; retired or inferred low-value fields; user burden indicators.',
    // Branch 4 (AREA-E) — product KPIs come from ost-2026-04-26.md
    E1: 'KPI signals: Completion rates for waste movement records; error rates in waste descriptions; satisfaction with recording guidance.',
    E2: 'KPI signals: Completion rates for amendments; error rates in corrected records; repeat sessions for the same movement.',
    E3: 'KPI signals: Completion rates for movement creation; error rates for missing/invalid fields; satisfaction with recording guidance.',
    E4: 'KPI signals: Completion rates for receipt decisions; error rates in accept/refuse decisions; session duration for receipt checks.',
    // Branch 4: Risk detection (AREA-F)
    F1: 'KPI signals: Time to identify high-risk cases; queue action rate; regulator confidence in prioritisation.',
    F2: 'KPI signals: Time to assemble case context; completeness of case records; handover quality.',
    F3: 'KPI signals: Lookup time; checks recorded; incorrect or missed legitimacy decisions.',
    F4: 'KPI signals: Missing document rate; overdue confirmation rate; time to resolve export exceptions.',
    // Branch 5: Ecosystem adoption (AREA-G)
    G1: 'KPI signals: Support contacts about changes; update comprehension; missed deadline rates.',
    G2: 'KPI signals: Change preview use; packaging/data changes completed; perceived risk of change.',
    G3: 'KPI signals: Completion rate by actor type; assisted-route use; route time and error rate.',
    G4: 'KPI signals: Time to publish change guidance; repeated support themes; developer satisfaction.',
    // Branch 6: Operational control (AREA-J)
    J1: 'KPI signals: Permission-related errors; manual checks; unresolved authority conflicts.',
    J2: 'KPI signals: Missing submission resolution time; successful contact rate; manual chase volume.',
    J3: 'KPI signals: Reconciliation exceptions; time to confirm compliance status; payment/evidence mismatch rate.',
    J4: 'KPI signals: Renewal completion rate; overdue evidence; case history completeness.',
    J5: 'KPI signals: Near-limit alerts reviewed; manual lookup time; capacity-related risk cases identified.',
  };

  // ── OST opportunities (OST-2026-04-26) under PackUK operational outcomes ───
  const opCarrierField = uuid();
  const opAmendment = uuid();
  const opReceiver = uuid();
  const opSoftware = uuid();
  const opRegulator = uuid();

  const ostOpps: Opportunity[] = [
    {
      id: opCarrierField, blueprintId: bpId, outcomeId: oPackUKEfficiency,
      title: 'Carriers need to know exactly what to record at collection and handover without slowing routes down',
      statement: 'E-073 shows carriers need a clear view of phase-2 digital tracking duties and when to record information during collection and transfer. E-084 says carriers need clear mandatory-versus-optional data requirements so they can produce complete records without delaying routes. E-096 shows carriers may have low digital skills, weak connectivity, outdated or costly software, and heavy training overhead.',
      rationale: 'KPI signals: completion rates for movement creation; drop-off rates at required-field steps; error rates for missing/invalid fields; satisfaction with recording guidance.',
      sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'open', traceabilityCode: 'OST-01', createdAt: now, updatedAt: now,
    },
    {
      id: opAmendment, blueprintId: bpId, outcomeId: oPackUKEfficiency,
      title: 'Carriers and controllers need movement records to handle real-world changes without losing traceability',
      statement: 'E-093 says controllers need workflows for repeat collections, multiple EWC codes, and reclassification without recreating records from scratch. E-097 reports misdescribed waste, mixed loads, receiver changes, weight corrections, contaminated skips, missing paperwork, and repeat visits.',
      rationale: 'KPI signals: completion rates for amendments; error rates in corrected records; repeat sessions for the same movement; satisfaction with exception handling.',
      sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'open', traceabilityCode: 'OST-02', createdAt: now, updatedAt: now,
    },
    {
      id: opReceiver, blueprintId: bpId, outcomeId: oPackUKData,
      title: 'Receivers need to verify incoming waste against documentation and permit scope quickly',
      statement: 'E-081 shows receivers must confirm waste matches transfer notes and permit scope before accepting it, while doing this under time pressure. The service outcomes also identify receiver verification as a low-confidence but important adjacent stage through OUT-016 and SPI-027.',
      rationale: 'KPI signals: completion rates for receipt decisions; error rates in accept/refuse decisions; session duration for receipt checks; satisfaction among receiver users.',
      sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'open', traceabilityCode: 'OST-03', createdAt: now, updatedAt: now,
    },
    {
      id: opSoftware, blueprintId: bpId, outcomeId: oPackUKValue,
      title: 'Software providers need stable, timely integration guidance so customer workflows stay compliant',
      statement: 'E-072 identifies uncertainty around API-led rollout, phased compliance, and receipt-of-waste implementation. E-083 shows software developers need timely requirement changes and stable API integration support so waste-industry software can remain compliant.',
      rationale: 'KPI signals: API-related error rates; completion rates for successful submissions through integrations; daily active software/API users; satisfaction with developer guidance.',
      sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'open', traceabilityCode: 'OST-04', createdAt: now, updatedAt: now,
    },
    {
      id: opRegulator, blueprintId: bpId, outcomeId: oPackUKData,
      title: 'Regulators and analysts need reusable trusted data products for investigations and reporting',
      statement: 'E-001 shows compliance casework is tracked across spreadsheets and ad hoc records. E-008 shows regulators export raw data into master spreadsheets because they do not trust system data as a single source of truth. E-028 shows regulators manually link records from production through transport to final treatment or disposal. E-052 and E-089 show reporting consumers and analysts need both reusable outputs and raw transactional data to validate quality issues and investigate anomalies.',
      rationale: 'KPI signals: completion rates for reporting/investigation tasks; session duration for analysis tasks; error rates or quality flags in extracted data; satisfaction with data confidence.',
      sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'open', traceabilityCode: 'OST-05', createdAt: now, updatedAt: now,
    },
  ];

  const opportunities: Opportunity[] = [
    mkOpp(opA1, 'A1', 'Producers struggle to tell whether lower-material, compostable, reusable, or heavier recyclable packaging will reduce environmental impact without increasing charges.', oAreaA),
    mkOpp(opA2, 'A2', 'Weight-based pEPR charging may create a material-switching incentive from glass or metal toward plastic.', oAreaA),
    mkOpp(opA3, 'A3', 'The rationale for retaining weight-based fee apportionment is hard for industry to inspect, challenge, or translate into design decisions.', oAreaA),
    mkOpp(opA4, 'A4', 'Reuse and refill are positioned as a route to reduce recurring liability, but producers need clearer practical transition paths.', oAreaA),

    mkOpp(opB1, 'B1', 'Producers, importers, and supply-chain actors may not know whether EPR, RAM, or DWT applies to them, especially when guidance, thresholds, or roles change.', oAreaB),
    mkOpp(opB2, 'B2', 'Policy terminology does not always match how businesses understand themselves.', oAreaB),
    mkOpp(opB3, 'B3', 'Responsibility boundaries across producers, schemes, consultants, supply chains, and waste actors are unclear.', oAreaB),
    mkOpp(opB4, 'B4', 'Material-specific, household/non-household, nation-of-sale, dual-use, EWC, and RAM classification rules are hard to apply consistently.', oAreaB),

    mkOpp(opC1, 'C1', 'Reporting templates, validation messages, and field requirements are unclear or inconsistent.', oAreaC),
    mkOpp(opC2, 'C2', 'Fees, disposal charges, PRN/PERN obligations, RAM tiers, and offset rules are opaque.', oAreaC),
    mkOpp(opC3, 'C3', 'Ambiguous obligations create interpretation burden, paid advice, training cost, poor data quality, inaccurate charges, and market distortion.', oAreaC),
    mkOpp(opC4, 'C4', 'Duplicate or conflicting scheme submissions can enter reporting before prevention controls catch them.', oAreaC),

    mkOpp(opD1, 'D1', 'Regulatory, producer, and waste data is fragmented across pages, exports, spreadsheets, dashboards, and external sources.', oAreaD),
    mkOpp(opD2, 'D2', 'Historical comparisons, submission histories, and amendments are hard to trace.', oAreaD),
    mkOpp(opD3, 'D3', 'Policy and reporting users need data designed around explicit questions: evaluation, accountability, fair charging, and behaviour change.', oAreaD),
    mkOpp(opD4, 'D4', 'Data collection may be heavier than necessary if fields are collected by default rather than because they answer a clear decision or evidence question.', oAreaD),

    mkOpp(opE1, 'E1', 'End-to-end waste traceability is fragmented across collection, transfer, receipt, treatment, and export.', oAreaE),
    mkOpp(opE2, 'E2', 'Real-world collection variability breaks neat digital records: mixed loads, partial receipts, receiver changes, weight corrections, contamination, and repeat visits.', oAreaE),
    mkOpp(opE3, 'E3', 'Waste producers often hand over incomplete or inaccurate descriptions, pushing correction and policing work downstream.', oAreaE),
    mkOpp(opE4, 'E4', 'Receivers, carriers, and frontline officers need permit, movement, and classification data in context to act confidently.', oAreaE),

    mkOpp(opF1, 'F1', 'Risk signals, workload prioritisation, and anomaly detection are not surfaced inside regulator workflows.', oAreaF),
    mkOpp(opF2, 'F2', 'Investigations, inspections, decisions, and case histories are scattered across spreadsheets and informal notes.', oAreaF),
    mkOpp(opF3, 'F3', 'Legitimacy and permit checks rely on manual lookups across external sources.', oAreaF),
    mkOpp(opF4, 'F4', 'Export and shipment compliance checks are document-heavy and difficult to monitor consistently.', oAreaF),

    mkOpp(opG1, 'G1', 'Organisations experience change fatigue from unstable rules, fragmented communications, and uncertainty about UK/EU requirements.', oAreaG),
    mkOpp(opG2, 'G2', 'Once producers have made a difficult submission work, the perceived cost of changing packaging or data practices can suppress innovation.', oAreaG),
    mkOpp(opG3, 'G3', 'Small, low-digital, or low-margin operators need proportionate routes to comply without excessive disruption.', oAreaG),
    mkOpp(opG4, 'G4', 'Helpdesk, interim guidance, developer updates, manual support, and service status feedback are inconsistent or too slow to reduce avoidable support demand.', oAreaG),

    mkOpp(opH1, 'H1', 'EPR policy is experienced as unusually hard to comply with, creating burden that can conflict with growth, participation, and effective compliance.', oAreaH),
    mkOpp(opH2, 'H2', 'Producers lack forward fee visibility while designing packaging, so they cannot easily design out unrecyclable elements before decisions are locked in.', oAreaH),
    mkOpp(opH3, 'H3', 'Charging and support are not yet sufficiently segmented by real packaging complexity, submission complexity, packaging variety, and supply-chain depth.', oAreaH),
    mkOpp(opH4, 'H4', 'Fair taxation or charging depends on better organisation typologies than blunt large/small producer categories.', oAreaH),
    mkOpp(opH5, 'H5', 'Flexible policy and targeted service support require real packaging and registration data to identify where burden, risk, and environmental leverage actually sit.', oAreaH),

    mkOpp(opI1, 'I1', 'Producers do not have early enough cost and environmental impact signals to compare packaging options before design choices are committed.', oAreaI),
    mkOpp(opI2, 'I2', 'Current rules can unintentionally make lower-material or lower-impact choices look commercially worse once classification and fee rules are applied.', oAreaI),
    mkOpp(opI3, 'I3', 'Producers need scenario modelling for design choices, such as removing unrecyclable elements, changing materials, reducing size, moving to compostable formats, or adopting reuse/refill.', oAreaI),
    mkOpp(opI4, 'I4', 'Compliance effort can lock producers into existing packaging and data practices after they have made a difficult submission work.', oAreaI),
    mkOpp(opI5, 'I5', 'Policy teams lack enough product-design feedback data to see whether EPR is changing packaging decisions upstream or only collecting downstream reports.', oAreaI),

    mkOpp(opJ1, 'J1', 'Delegated access, approved-person responsibility, and authority to act are not visible enough across producer, consultant, scheme, and regulator workflows.', oAreaJ),
    mkOpp(opJ2, 'J2', 'Missing submissions, incomplete reporting, completion status, and unreliable contact data create manual chasing and leave gaps in compliance coverage.', oAreaJ),
    mkOpp(opJ3, 'J3', 'Evidence sufficiency, evidence reconciliation, fee status, and payment status are still too manual or fragmented to provide a shared compliance picture.', oAreaJ),
    mkOpp(opJ4, 'J4', 'Accreditation casework, renewals, and compliance evidence are fragmented, making it harder to manage regulated actors consistently over time.', oAreaJ),
    mkOpp(opJ5, 'J5', "Facility capacity and permit-limit checks are manual, limiting the system's ability to detect operational risk before it becomes non-compliance or waste crime.", oAreaJ),

    ...ostOpps,

    // Sub-opportunities: product team findings from L3 research (depth=1, nested inside strategic opps)
    mkSubOpp(subH1a, 'Producers find GOV.UK guidance too long, too general and jargon-heavy — they often have multiple browser tabs open or print guidance to complete a task, leading to poor compliance and heavy helpdesk demand.', opH1),
    mkSubOpp(subB1a, 'Businesses have no straightforward way to find out whether they need to register under EPR — guidance is complex, often misunderstood, and fails to reach all producers who may be obligated.', opB1),
    mkSubOpp(subB4a, 'The current CSV upload process is manual, time-consuming and error-prone with poor validation — large schemes must export to CSV from internal portals before uploading, creating multi-stage failure points.', opB4),
    mkSubOpp(subC1a, 'Registration is fragmented, heavily dependent on CSV uploads, error-prone with unclear error messaging — producers must navigate separate processes for organisation details, subsidiaries, packaging data, fees, and charges.', opC1),
  ].map((opp) => ({
    ...opp,
    // Backfill evidence and KPI signals for AREA opportunities from the lookup tables.
    // OST opportunities already have statement/rationale set inline, so || preserves them.
    statement: opp.statement || (opp.traceabilityCode && evidenceByCode[opp.traceabilityCode]
      ? `Evidence: ${evidenceByCode[opp.traceabilityCode]}`
      : ''),
    rationale: opp.rationale || (opp.traceabilityCode && kpiByCode[opp.traceabilityCode]
      ? kpiByCode[opp.traceabilityCode]
      : ''),
  }));

  // ── Solutions (illustrative sample across areas) ────────────────────────────
  const sA1a = uuid(); const sA1b = uuid();
  const sC1a = uuid();
  const sF1a = uuid();
  const sI3a = uuid();
  const sJ1a = uuid();

  // OST solution IDs (needed for assumption references)
  const sCarrierChecklist = uuid();
  const sAmendmentFlow = uuid();
  const sReceiptCheck = uuid();
  const sApiChangeLog = uuid();
  const sTransactionExtract = uuid();

  const solutions: Solution[] = [
    { id: sA1a, blueprintId: bpId, opportunityId: opA1, title: 'Packaging impact simulator — fee and environmental impact side-by-side for material options', status: 'ideation', createdAt: now, updatedAt: now },
    { id: sA1b, blueprintId: bpId, opportunityId: opA1, title: 'Redesigned fee explainer pages with material-switching scenario tables', status: 'building', createdAt: now, updatedAt: now },
    { id: sC1a, blueprintId: bpId, opportunityId: opC1, title: 'Plain-English validation errors with field-level fix suggestions', status: 'validating', createdAt: now, updatedAt: now },
    { id: sF1a, blueprintId: bpId, opportunityId: opF1, title: 'Automated risk dashboard surfacing anomalies inside regulator workflows', status: 'ideation', createdAt: now, updatedAt: now },
    { id: sI3a, blueprintId: bpId, opportunityId: opI3, title: 'Packaging redesign scenario calculator — model fee and impact before committing to a design', status: 'ideation', createdAt: now, updatedAt: now },
    { id: sJ1a, blueprintId: bpId, opportunityId: opJ1, title: 'Unified delegated-access registry visible across producer, consultant, scheme, and regulator views', status: 'ideation', createdAt: now, updatedAt: now },

    // OST-01: Carrier field clarity
    { id: sCarrierChecklist, blueprintId: bpId, opportunityId: opCarrierField, title: 'Role-specific field checklist for collection and handover', status: 'validating', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, opportunityId: opCarrierField, title: 'Guided movement creation with mandatory/optional field explanations', status: 'ideation', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, opportunityId: opCarrierField, title: 'Pre-filled repeat movement templates for common collections', status: 'ideation', createdAt: now, updatedAt: now },

    // OST-02: Amendment and exception flows
    { id: sAmendmentFlow, blueprintId: bpId, opportunityId: opAmendment, title: 'Amendment flow for corrected weights, receiver changes, and mixed loads', status: 'building', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, opportunityId: opAmendment, title: 'Partial receipt and exception capture at handover', status: 'ideation', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, opportunityId: opAmendment, title: 'Reclassification workflow that preserves original record history', status: 'ideation', createdAt: now, updatedAt: now },

    // OST-03: Receiver verification
    { id: sReceiptCheck, blueprintId: bpId, opportunityId: opReceiver, title: 'Receipt check screen showing transfer details, permit scope, and accept/refuse actions', status: 'validating', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, opportunityId: opReceiver, title: 'Weighbridge exception queue for missing or inconsistent documentation', status: 'ideation', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, opportunityId: opReceiver, title: 'Standard refusal reason codes with audit trail', status: 'ideation', createdAt: now, updatedAt: now },

    // OST-04: Software integration
    { id: sApiChangeLog, blueprintId: bpId, opportunityId: opSoftware, title: 'Versioned API change log with migration windows', status: 'ideation', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, opportunityId: opSoftware, title: 'Sandbox and conformance test pack for receipt and transfer APIs', status: 'validating', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, opportunityId: opSoftware, title: 'Developer office hours before each mandatory phase', status: 'ideation', createdAt: now, updatedAt: now },

    // OST-05: Regulator and analyst data products
    { id: sTransactionExtract, blueprintId: bpId, opportunityId: opRegulator, title: 'Transaction-level data extract with quality flags and lineage', status: 'validating', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, opportunityId: opRegulator, title: 'Compliance dashboard linked to movement records and case history', status: 'ideation', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, opportunityId: opRegulator, title: 'Standard reporting templates for cross-nation reconciliation', status: 'ideation', createdAt: now, updatedAt: now },

    // Solutions for product team findings
    { id: uuid(), blueprintId: bpId, opportunityId: subH1a, title: 'Task-focused guidance with worked examples for EPR obligations, fees, and evidence requirements', status: 'ideation', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, opportunityId: subB1a, title: 'Eligibility checker: enter business activity, packaging role, and thresholds to get a clear in/out/scheme decision', status: 'validating', createdAt: now, updatedAt: now },
  ];

  // ── Assumptions ────────────────────────────────────────────────────────────
  const assumptions: Assumption[] = [
    { id: uuid(), blueprintId: bpId, solutionId: sA1a, title: 'Producers will trust a tool that shows fee impact alongside environmental impact without expert facilitation', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sA1a, title: 'Fee and recyclability data is stable enough to power a live simulator without frequent recalibration', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sC1a, title: 'Plain-language errors will reduce resubmission rate by at least 30%', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sF1a, title: 'Regulators will act on automated risk signals rather than continuing to rely on manual review', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sI3a, title: 'Producers engage with design tools before packaging decisions are commercially locked in', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sJ1a, title: 'A single access registry reduces onboarding errors and unauthorised submissions', status: 'untested', createdAt: now, updatedAt: now },

    // OST-2026-04-26 experiment assumptions
    { id: uuid(), blueprintId: bpId, solutionId: sCarrierChecklist, title: 'Clearer field guidance will reduce incomplete records without increasing route time', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sAmendmentFlow, title: 'Users can update records accurately if amendment reasons are structured and presented at the point of change', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sReceiptCheck, title: 'Receivers can make lawful accept/refuse decisions faster when permit checks are brought into the same workflow as transfer details', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sApiChangeLog, title: 'Earlier change visibility will reduce reactive development sprints and customer disruption before compliance deadlines', status: 'untested', createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, solutionId: sTransactionExtract, title: 'Analysts need drill-down to transaction level to diagnose quality issues — aggregated dashboards alone are insufficient', status: 'untested', createdAt: now, updatedAt: now },
  ];

  // ── System outcomes (SYS) ─────────────────────────────────────────────────
  const systemOutcomes: SystemOutcome[] = [
    { id: uuid(), blueprintId: bpId, code: 'SYS-01', title: 'Packaging incentives align with the waste hierarchy and do not accidentally push producers toward worse materials.', goalIds: [gEnv01, gEnv02], relatedAreaCodes: ['AREA-A', 'AREA-H', 'AREA-I'], order: 0, createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, code: 'SYS-02', title: 'Producers, schemes, and regulators can understand fee, evidence, and obligation rules consistently.', goalIds: [gEnv01, gEnv02], relatedAreaCodes: ['AREA-B', 'AREA-C', 'AREA-H'], order: 1, createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, code: 'SYS-03', title: 'Packaging and waste data is accurate, timely, trusted, and reusable for policy, compliance, and operational decisions.', goalIds: [gEnv01, gEnv02, gEnv03], relatedAreaCodes: ['AREA-C', 'AREA-D', 'AREA-H', 'AREA-I'], order: 2, createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, code: 'SYS-04', title: 'Waste movements and handovers are traceable across actors, sites, and lifecycle stages.', goalIds: [gEnv02, gEnv03], relatedAreaCodes: ['AREA-B', 'AREA-E', 'AREA-J'], order: 3, createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, code: 'SYS-05', title: 'Regulators can detect risk, investigate anomalies, and maintain defensible enforcement records.', goalIds: [gEnv03], relatedAreaCodes: ['AREA-C', 'AREA-D', 'AREA-F', 'AREA-J'], order: 4, createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, code: 'SYS-06', title: 'The ecosystem has proportionate routes for different actor types, including small producers, schemes, carriers, low-digital users, and complex supply chains.', goalIds: [gEnv01, gEnv02, gEnv03], relatedAreaCodes: ['AREA-D', 'AREA-G', 'AREA-H', 'AREA-I', 'AREA-J'], order: 5, createdAt: now, updatedAt: now },
  ];

  // ── Behaviour outcomes (BEH) ───────────────────────────────────────────────
  const bBeh01 = uuid(); const bBeh02 = uuid(); const bBeh03 = uuid();
  const bBeh04 = uuid(); const bBeh05 = uuid(); const bBeh06 = uuid();

  const behaviourOutcomes: BehaviourOutcome[] = [
    { id: bBeh01, blueprintId: bpId, code: 'BEH-01', title: 'Producers choose packaging, reuse, refill, and material strategies with a clear understanding of environmental and fee consequences.', actors: ['Producers', 'compliance leads', 'policy teams'], relatedAreaCodes: ['AREA-A', 'AREA-H', 'AREA-I'], order: 0, createdAt: now, updatedAt: now },
    { id: bBeh02, blueprintId: bpId, code: 'BEH-02', title: 'Producers and schemes classify, validate, and submit data correctly first time.', actors: ['Producers', 'compliance schemes', 'consultants'], relatedAreaCodes: ['AREA-B', 'AREA-C'], order: 1, createdAt: now, updatedAt: now },
    { id: bBeh03, blueprintId: bpId, code: 'BEH-03', title: 'Waste producers, carriers, controllers, and receivers record what actually happened, including exceptions and corrections.', actors: ['Waste producers', 'carriers', 'controllers', 'receivers'], relatedAreaCodes: ['AREA-E'], order: 2, createdAt: now, updatedAt: now },
    { id: bBeh04, blueprintId: bpId, code: 'BEH-04', title: 'Regulators use trusted service data rather than parallel spreadsheets for monitoring, investigation, and reporting.', actors: ['Regulators', 'analysts', 'policy advisors'], relatedAreaCodes: ['AREA-D', 'AREA-F'], order: 3, createdAt: now, updatedAt: now },
    { id: bBeh05, blueprintId: bpId, code: 'BEH-05', title: 'Policy and data teams use explicit evidence questions to decide what data to collect, reuse, infer, or remove.', actors: ['Policy teams', 'data teams', 'analysts'], relatedAreaCodes: ['AREA-D', 'AREA-H', 'AREA-I'], order: 4, createdAt: now, updatedAt: now },
    { id: bBeh06, blueprintId: bpId, code: 'BEH-06', title: 'Users seek the right support route early, understand their role, and avoid misrouting obligations or responsibilities.', actors: ['producers', 'CSO', 'importers', 'waste operators', 'helpdesk'], relatedAreaCodes: ['AREA-B', 'AREA-G', 'AREA-J'], order: 5, createdAt: now, updatedAt: now },
  ];

  // ── Strategic service outcomes (SO) ───────────────────────────────────────
  const serviceOutcomes: ServiceOutcome[] = [
    { id: uuid(), blueprintId: bpId, code: 'SO-01', title: 'Users can understand obligations, roles, deadlines, evidence requirements, and fee logic before they act.', behIds: [bBeh01, bBeh02, bBeh06], relatedAreaCodes: ['AREA-B', 'AREA-H', 'AREA-I'], order: 0, createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, code: 'SO-02', title: 'Users can submit, validate, amend, and trace data with clear feedback and less rework.', behIds: [bBeh02, bBeh03], relatedAreaCodes: ['AREA-C', 'AREA-E'], order: 1, createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, code: 'SO-03', title: 'Regulators and analysts can access trusted current and historical data in reusable views and exports.', behIds: [bBeh04, bBeh05], relatedAreaCodes: ['AREA-D', 'AREA-F'], order: 2, createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, code: 'SO-04', title: 'Waste movements can be tracked across collection, transfer, receipt, treatment, export, and exception events.', behIds: [bBeh03, bBeh04], relatedAreaCodes: ['AREA-E', 'AREA-J'], order: 3, createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, code: 'SO-05', title: 'Risk, anomaly, legitimacy, duplicate-submission, and investigation signals are visible inside operational workflows.', behIds: [bBeh04], relatedAreaCodes: ['AREA-F', 'AREA-J'], order: 4, createdAt: now, updatedAt: now },
    { id: uuid(), blueprintId: bpId, code: 'SO-06', title: 'Guidance, support, and transition routes are stable, coordinated, and proportionate to actor complexity.', behIds: [bBeh01, bBeh06], relatedAreaCodes: ['AREA-G', 'AREA-B'], order: 5, createdAt: now, updatedAt: now },
  ];

  return {
    blueprint: { id: bpId, serviceName: 'Defra Environmental Opportunity Map', description: 'Goals → Outcome Areas → Opportunities from the Defra environmental opportunity map (2026-04-28). ENV-01 Reduce waste · ENV-02 Increase circularity · ENV-03 Prevent waste crime.', createdAt: now, updatedAt: now },
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
    strategicGoals,
    outcomes,
    systemOutcomes,
    behaviourOutcomes,
    serviceOutcomes,
    opportunities,
    solutions,
    assumptions,
    stepLinks: [],
    requirements: [],
    apiContracts: [],
    uiScaffolds: [],
    traceabilityCounters: { OPP: 51 },
  };
}
