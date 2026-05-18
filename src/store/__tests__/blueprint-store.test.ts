import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import type { BlueprintState, Card, LaneKey } from '@/lib/types';
import { DEFAULT_LANES, L3_LANE_KEYS } from '@/lib/lane-definitions';
import { useBlueprintStore } from '@/store/blueprint-store';
import { processXlsxSheet } from '@/lib/import/parse';
import * as XLSX from 'xlsx';

function makeFixture(overrides: Partial<BlueprintState> = {}): BlueprintState {
  return {
    blueprint: {
      id: 'bp-root',
      serviceName: 'Root blueprint',
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    stages: [
      { id: 'stage-1', blueprintId: 'bp-root', title: 'Stage 1', outcome: '', order: 0 },
      { id: 'stage-2', blueprintId: 'bp-root', title: 'Stage 2', outcome: '', order: 1 },
    ],
    steps: [
      { id: 'step-1', blueprintId: 'bp-root', stageId: 'stage-1', title: 'Step 1', order: 0 },
      { id: 'step-2', blueprintId: 'bp-root', stageId: 'stage-2', title: 'Step 2', order: 0 },
    ],
    lanes: DEFAULT_LANES.map((lane) => ({ ...lane })),
    childBlueprints: [],
    rootDocument: null,
    activeBlueprintId: 'bp-root',
    rootBlueprintId: 'bp-root',
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
    ...overrides,
  };
}

function makeCard(overrides: Partial<Card> & { id: string; laneKey: LaneKey; title: string; order: number }): Card {
  return {
    blueprintId: 'bp-root',
    stageId: 'stage-1',
    stepId: 'step-1',
    body: '',
    tags: [],
    sourceFile: 'test.xlsx',
    sourceSheet: 'Blueprint',
    sourceRow: 2,
    sourceRef: 'SRC-001',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('blueprint journey state', () => {
  beforeEach(() => {
    useBlueprintStore.getState().loadBlueprint(makeFixture());
  });

  it('normalizes legacy documents without nested journey fields', () => {
    const legacyState = {
      blueprint: {
        id: 'bp-legacy',
        serviceName: 'Legacy blueprint',
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      stages: [{ id: 'stage-legacy', blueprintId: 'bp-legacy', title: 'Legacy stage', outcome: '', order: 0 }],
      steps: [{ id: 'step-legacy', blueprintId: 'bp-legacy', stageId: 'stage-legacy', title: 'Legacy step', order: 0 }],
      lanes: DEFAULT_LANES.map((lane) => ({ ...lane })),
      cards: [],
      storyboardImages: [],
      storyboardVisible: true,
      storyboardCollapsed: false,
      cardLinks: [],
      evidence: [],
      opportunities: [],
      solutions: [],
      assumptions: [],
      stepLinks: [],
      requirements: [],
      apiContracts: [],
      uiScaffolds: [],
      traceabilityCounters: {},
    };

    useBlueprintStore.getState().loadBlueprint(legacyState as unknown as BlueprintState);

    const state = useBlueprintStore.getState();
    expect(state.childBlueprints).toEqual([]);
    expect(state.activeBlueprintId).toBe('bp-legacy');
    expect(state.rootBlueprintId).toBe('bp-legacy');
  });

  it('marks opportunities created in the app with a user-facing origin', () => {
    const store = useBlueprintStore.getState();

    const manualId = store.addOpportunity({
      title: 'Manual opportunity',
      statement: '',
      rationale: '',
      sourceCardIds: [],
      affectedStages: [],
      affectedSteps: [],
      status: 'open',
    });
    const generatedId = useBlueprintStore.getState().addOpportunity({
      title: 'Generated opportunity',
      statement: '',
      rationale: '',
      sourceCardIds: ['card-1'],
      affectedStages: [],
      affectedSteps: [],
      status: 'open',
    });

    const state = useBlueprintStore.getState();
    expect(state.opportunities.find((item) => item.id === manualId)?.origin).toBe('user');
    expect(state.opportunities.find((item) => item.id === generatedId)?.origin).toBe('generated');
  });


  it('sanitizes persisted performance indicator titles on load', () => {
    const stateWithIndicator = makeFixture({
      lanes: DEFAULT_LANES.map((lane) => ({ ...lane })),
      cards: [
        {
          id: 'card-pi-1',
          blueprintId: 'bp-root',
          stageId: 'stage-1',
          stepId: 'step-1',
          laneKey: 'performance_indicators',
          title: 'Effectiveness: SPI-001 % of submissions classified correctly at first attempt',
          body: '',
          order: 0,
          tags: [],
          sourceFile: 'test.xlsx',
          sourceSheet: 'Blueprint',
          sourceRow: 2,
          sourceRef: 'SRC-001',
          traceabilityCode: 'SPI-001',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    useBlueprintStore.getState().loadBlueprint(stateWithIndicator);

    const card = useBlueprintStore.getState().cards[0];
    expect(card?.title).toBe('% of submissions classified correctly at first attempt');
    expect(card?.traceabilityCode).toBe('SPI-001');
    expect(card?.tags).toContain('effectiveness');
  });

  it('sanitizes persisted opportunities swimlane titles on load', () => {
    const stateWithOpportunity = makeFixture({
      cards: [
        {
          id: 'card-woa-1',
          blueprintId: 'bp-root',
          stageId: 'stage-1',
          stepId: 'step-1',
          laneKey: 'opportunities_lane',
          title: 'Guidance: WOA-001 Provide clearer step-by-step submission guidance',
          body: '',
          order: 0,
          tags: [],
          sourceFile: 'test.xlsx',
          sourceSheet: 'Blueprint',
          sourceRow: 2,
          sourceRef: 'SRC-001',
          traceabilityCode: 'WOA-001',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    useBlueprintStore.getState().loadBlueprint(stateWithOpportunity);

    const card = useBlueprintStore.getState().cards[0];
    expect(card?.title).toBe('Provide clearer step-by-step submission guidance');
    expect(card?.traceabilityCode).toBe('WOA-001');
    expect(card?.tags).toContain('guidance');
  });

  it('sanitizes persisted opportunities titles that use leading code labels', () => {
    const stateWithOpportunity = makeFixture({
      cards: [
        {
          id: 'card-woa-2',
          blueprintId: 'bp-root',
          stageId: 'stage-1',
          stepId: 'step-1',
          laneKey: 'opportunities_lane',
          title: 'WOA-001: Guided classification tool with real-time validation and correction prompts',
          body: '',
          order: 0,
          tags: [],
          sourceFile: 'test.xlsx',
          sourceSheet: 'Blueprint',
          sourceRow: 2,
          sourceRef: 'SRC-002',
          traceabilityCode: 'WOA-001',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    useBlueprintStore.getState().loadBlueprint(stateWithOpportunity);

    const card = useBlueprintStore.getState().cards[0];
    expect(card?.title).toBe('Guided classification tool with real-time validation and correction prompts');
    expect(card?.traceabilityCode).toBe('WOA-001');
  });

  it('strips persisted L2 opportunity trace footers on load', () => {
    const stateWithOpportunity = makeFixture({
      cards: [
        makeCard({
          id: 'card-opp-trace',
          laneKey: 'opportunities',
          title: 'Make reuse guidance easier to act on. Trace: OPP-003/004/008/014/029.',
          body: 'Evidence summary.\nTrace: OPP-003/004/008/014/029.',
          order: 0,
          traceabilityCode: 'OPP-030',
        }),
      ],
    });

    useBlueprintStore.getState().loadBlueprint(stateWithOpportunity);

    const card = useBlueprintStore.getState().cards[0];
    expect(card?.title).toBe('Make reuse guidance easier to act on.');
    expect(card?.body).toBe('Evidence summary.');
    expect(card?.traceabilityCode).toBe('OPP-030');
  });

  it('moves persisted user-need roll-up suffixes into drawer traceability on load', () => {
    const stateWithUserNeed = makeFixture({
      cards: [
        makeCard({
          id: 'card-un-rollup',
          laneKey: 'user_need',
          title: 'As a producer, I need clearer reuse guidance [Rolls up UN-056, UN-057, UN-058, UN-062, UN-064',
          order: 0,
          derivedFromIds: ['UN-050'],
          traceabilityCode: 'UN-070',
        }),
      ],
    });

    useBlueprintStore.getState().loadBlueprint(stateWithUserNeed);

    const card = useBlueprintStore.getState().cards[0];
    expect(card?.title).toBe('As a producer, I need clearer reuse guidance');
    expect(card?.derivedFromIds).toEqual(['UN-050', 'UN-056', 'UN-057', 'UN-058', 'UN-062', 'UN-064']);
    expect(card?.traceabilityCode).toBe('UN-070');
  });

  it('moves persisted pain-point roll-up suffixes into drawer traceability on load', () => {
    const stateWithPainPoint = makeFixture({
      cards: [
        makeCard({
          id: 'card-pp-rollup',
          laneKey: 'pain_point',
          title: 'Reuse requirements are hard to interpret [Rolls up PP-040, PP-042, PP-048, PP-053',
          order: 0,
          derivedFromIds: ['PP-030'],
          traceabilityCode: 'PP-070',
        }),
      ],
    });

    useBlueprintStore.getState().loadBlueprint(stateWithPainPoint);

    const card = useBlueprintStore.getState().cards[0];
    expect(card?.title).toBe('Reuse requirements are hard to interpret');
    expect(card?.derivedFromIds).toEqual(['PP-030', 'PP-040', 'PP-042', 'PP-048', 'PP-053']);
    expect(card?.traceabilityCode).toBe('PP-070');
  });

  it('removes evidence-reference-only pain point cards on load', () => {
    const stateWithEvidenceReferences = makeFixture({
      cards: [
        makeCard({
          id: 'pp-evidence-only',
          laneKey: 'pain_point',
          title: 'E-108, E-109, E-113, E-115, E-117]',
          order: 0,
          traceabilityCode: 'PP-071',
        }),
        makeCard({
          id: 'pp-main',
          laneKey: 'pain_point',
          title: 'Reuse requirements are hard to interpret (E-108)',
          order: 1,
          traceabilityCode: 'PP-072',
        }),
      ],
    });

    useBlueprintStore.getState().loadBlueprint(stateWithEvidenceReferences);

    const painPointCards = useBlueprintStore.getState().cards.filter((card) => card.laneKey === 'pain_point');
    expect(painPointCards.map((card) => card.id)).toEqual(['pp-main']);
  });

  it('splits persisted merged performance indicators on load', () => {
    const stateWithMergedIndicator = makeFixture({
      cards: [
        {
          id: 'card-pi-merged',
          blueprintId: 'bp-root',
          stageId: 'stage-1',
          stepId: 'step-1',
          laneKey: 'performance_indicators',
          title: '% processed consistently regardless of caseworker. Efficiency: SPI-007 Time per organisation to determine status and begin registration',
          body: '',
          order: 0,
          tags: [],
          sourceFile: 'test.xlsx',
          sourceSheet: 'Blueprint',
          sourceRow: 2,
          sourceRef: 'SRC-003',
          traceabilityCode: 'SPI-006',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    useBlueprintStore.getState().loadBlueprint(stateWithMergedIndicator);

    const cards = useBlueprintStore.getState().cards.filter((card) => card.laneKey === 'performance_indicators');
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.title)).toEqual([
      '% processed consistently regardless of caseworker.',
      'Time per organisation to determine status and begin registration',
    ]);
    expect(cards[0]?.traceabilityCode).toBe('SPI-006');
    expect(cards[1]?.traceabilityCode).toBe('SPI-007');
    expect(cards[1]?.tags).toContain('efficiency');
  });

  it('moves standalone behaviour-change roll-up code cards into the sibling drawer traceability', () => {
    const stateWithRollupCodes = makeFixture({
      cards: [
        makeCard({
          id: 'bc-main',
          laneKey: 'behaviour_change',
          title: 'Design out hard-to-recycle packaging [Rolls up PP-056, PP-058, PP-062, PP-064]',
          order: 0,
          derivedFromIds: ['PP-050'],
          traceabilityCode: 'BC-001',
        }),
        makeCard({
          id: 'bc-codes',
          laneKey: 'behaviour_change',
          title: 'PP-056, PP-057, PP-058, PP-062, PP-064.',
          order: 1,
          traceabilityCode: 'BC-002',
        }),
      ],
    });

    useBlueprintStore.getState().loadBlueprint(stateWithRollupCodes);

    const behaviourChangeCards = useBlueprintStore.getState().cards.filter((card) => card.laneKey === 'behaviour_change');
    expect(behaviourChangeCards.map((card) => card.id)).toEqual(['bc-main']);
    expect(behaviourChangeCards[0]?.derivedFromIds).toEqual([
      'PP-050',
      'PP-056',
      'PP-057',
      'PP-058',
      'PP-062',
      'PP-064',
    ]);
  });

  it('moves persisted desired behaviour change evidence-basis codes into drawer traceability on load', () => {
    const stateWithEvidenceBasis = makeFixture({
      cards: [
        makeCard({
          id: 'bc-evidence-basis',
          laneKey: 'behaviour_change',
          title: 'Supply-chain actors understand RAM and legislation clarity. Evidence basis is adjacent and limited: UN-063 and PP-063 show supply-chain actors need RAM/legislation clarity to support customers.',
          order: 0,
          derivedFromIds: ['UN-050'],
          traceabilityCode: 'BC-010',
        }),
      ],
    });

    useBlueprintStore.getState().loadBlueprint(stateWithEvidenceBasis);

    const card = useBlueprintStore.getState().cards[0];
    expect(card?.title).toBe('Supply-chain actors understand RAM and legislation clarity.');
    expect(card?.derivedFromIds).toEqual(['UN-050', 'UN-063', 'PP-063']);
    expect(card?.traceabilityCode).toBe('BC-010');
  });

  it('moves persisted success measure reference codes into drawer traceability on load', () => {
    const stateWithReferenceCodes = makeFixture({
      cards: [
        makeCard({
          id: 'sm-reference-codes',
          laneKey: 'success_measure',
          title: 'Track whether guidance reduces repeated clarification requests. PP-043, PP-044, PP-045, PP-047, PP-057, PP-066.',
          order: 0,
          derivedFromIds: ['PP-010'],
          traceabilityCode: 'SM-010',
        }),
      ],
    });

    useBlueprintStore.getState().loadBlueprint(stateWithReferenceCodes);

    const card = useBlueprintStore.getState().cards[0];
    expect(card?.title).toBe('Track whether guidance reduces repeated clarification requests.');
    expect(card?.derivedFromIds).toEqual([
      'PP-010',
      'PP-043',
      'PP-044',
      'PP-045',
      'PP-047',
      'PP-057',
      'PP-066',
    ]);
    expect(card?.traceabilityCode).toBe('SM-010');
  });

  it('removes area-reference placeholder behaviour-change cards on load', () => {
    const stateWithAreaReferences = makeFixture({
      cards: [
        makeCard({
          id: 'bc-area',
          laneKey: 'behaviour_change',
          title: 'Areas B, C, D, H',
          order: 0,
          traceabilityCode: 'BC-001',
        }),
        makeCard({
          id: 'bc-area-detail',
          laneKey: 'behaviour_change',
          title: 'Areas C: reference only',
          order: 1,
          traceabilityCode: 'BC-002',
        }),
        makeCard({
          id: 'bc-main',
          laneKey: 'behaviour_change',
          title: 'Design out hard-to-recycle packaging',
          order: 2,
          traceabilityCode: 'BC-003',
        }),
      ],
    });

    useBlueprintStore.getState().loadBlueprint(stateWithAreaReferences);

    const behaviourChangeCards = useBlueprintStore.getState().cards.filter((card) => card.laneKey === 'behaviour_change');
    expect(behaviourChangeCards.map((card) => card.id)).toEqual(['bc-main']);
  });

  it('preserves waste lifecycle stage order and phases after loading imported state', () => {
    const workbookPath = path.resolve(process.cwd(), 'public/waste_lifecycle.xlsx');
    const workbook = XLSX.readFile(workbookPath);
    const result = processXlsxSheet(workbook, 'Lifecycle', 'waste_lifecycle.xlsx');

    useBlueprintStore.getState().loadBlueprint(result.state, {
      srcRefCounters: result.srcRefCounters,
      traceabilityCounters: result.traceabilityCounters,
    });

    const state = useBlueprintStore.getState();
    expect(state.stages.map((stage) => ({ title: stage.title, phase: stage.phase }))).toEqual([
      { title: 'Selection of materials (raw or recycled)', phase: 'Production' },
      { title: 'Product design and manufacture of product', phase: 'Production' },
      { title: 'Placement of product on the market', phase: 'Production' },
      { title: 'Purchase products from the market', phase: 'Consumption' },
      { title: 'Product use (households and businesses)', phase: 'Consumption' },
      { title: 'Discard waste', phase: 'Consumption' },
      { title: 'Collect waste to transfer stations, maintain duty-of-care documentation', phase: 'Waste management' },
      { title: 'Materials recovery facilities sort, separate material streams and pre-treatment', phase: 'Waste management' },
      { title: 'Materials turned into secondary raw materials that re-enter manufacturing', phase: 'Waste management' },
      { title: 'Residual waste processed in EfW plants, energy generated and ash handled safely', phase: 'Waste management' },
      { title: 'Landfill disposal or exporting', phase: 'Waste management' },
    ]);
    const stageById = new Map(state.stages.map((stage) => [stage.id, stage]));
    expect(state.steps.map((step) => ({
      title: step.title,
      stage: stageById.get(step.stageId)?.title,
      phase: stageById.get(step.stageId)?.phase,
    }))).toEqual([
      { title: 'Selection of materials (raw or recycled)', stage: 'Selection of materials (raw or recycled)', phase: 'Production' },
      { title: 'Product design and manufacture of product', stage: 'Product design and manufacture of product', phase: 'Production' },
      { title: 'Placement of product on the market', stage: 'Placement of product on the market', phase: 'Production' },
      { title: 'Purchase products from the market', stage: 'Purchase products from the market', phase: 'Consumption' },
      { title: 'Product use (households and businesses)', stage: 'Product use (households and businesses)', phase: 'Consumption' },
      { title: 'Discard waste', stage: 'Discard waste', phase: 'Consumption' },
      { title: 'Collect waste to transfer stations, maintain duty-of-care documentation', stage: 'Collect waste to transfer stations, maintain duty-of-care documentation', phase: 'Waste management' },
      { title: 'Materials recovery facilities sort, separate material streams and pre-treatment', stage: 'Materials recovery facilities sort, separate material streams and pre-treatment', phase: 'Waste management' },
      { title: 'Materials turned into secondary raw materials that re-enter manufacturing', stage: 'Materials turned into secondary raw materials that re-enter manufacturing', phase: 'Waste management' },
      { title: 'Residual waste processed in EfW plants, energy generated and ash handled safely', stage: 'Residual waste processed in EfW plants, energy generated and ash handled safely', phase: 'Waste management' },
      { title: 'Landfill disposal or exporting', stage: 'Landfill disposal or exporting', phase: 'Waste management' },
    ]);
  });

  it('hydrates to a blank blueprint when there is no saved document', () => {
    const getItem = vi.fn(() => null);
    const setItem = vi.fn();
    const removeItem = vi.fn();
    const storage = { getItem, setItem, removeItem };
    vi.stubGlobal('window', {
      localStorage: storage,
    });
    vi.stubGlobal('localStorage', storage);

    useBlueprintStore.getState().hydrate();

    const state = useBlueprintStore.getState();
    expect(state._hydrated).toBe(true);
    expect(state.blueprint.serviceName).toBe('Untitled Blueprint');
    expect(state.stages).toEqual([]);
    expect(state.steps).toEqual([]);
    expect(state.cards).toEqual([]);
    expect(getItem).toHaveBeenCalledWith('service-blueprint-data');
    expect(setItem).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });








});
