import { describe, expect, it } from 'vitest';
import type { BlueprintState } from '@/lib/types';
import { DEFAULT_LANES } from '@/lib/lane-definitions';
import {
  getLibraryEntryJourneyLevel,
  isActiveLibraryEntry,
} from '@/lib/blueprint-levels';

function makeBlueprintState(
  id: string,
  serviceName: string,
  overrides: Partial<BlueprintState> = {},
): BlueprintState {
  return {
    blueprint: {
      id,
      serviceName,
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    stages: [],
    steps: [],
    lanes: DEFAULT_LANES.map((lane) => ({ ...lane })),
    journeySpans: [],
    policyReformSpans: [],
    productTeamSpans: [],
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
    ...overrides,
  };
}

describe('getLibraryEntryJourneyLevel', () => {
  it('returns the saved entry level for each blueprint in the same document tree', () => {
    const l3 = makeBlueprintState('bp-l3', 'Micro journey');
    const l2 = makeBlueprintState('bp-l2', 'Macro journey', {
      childBlueprints: [l3],
      journeySpans: [
        {
          id: 'journey-l3',
          blueprintId: 'bp-l2',
          title: 'Micro journey',
          startStepId: 'step-1',
          endStepId: 'step-2',
          order: 0,
          childBlueprintId: 'bp-l3',
          level: 'L3',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      activeBlueprintId: 'bp-l2',
      rootBlueprintId: 'bp-root',
    });
    const root = makeBlueprintState('bp-root', 'Lifecycle', {
      childBlueprints: [l2],
      journeySpans: [
        {
          id: 'journey-l2',
          blueprintId: 'bp-root',
          title: 'Macro journey',
          startStepId: 'step-1',
          endStepId: 'step-2',
          order: 0,
          childBlueprintId: 'bp-l2',
          level: 'L2',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      activeBlueprintId: 'bp-l3',
      rootBlueprintId: 'bp-root',
    });

    l2.rootDocument = root;
    l3.rootDocument = l2;
    l3.activeBlueprintId = 'bp-l3';
    l3.rootBlueprintId = 'bp-root';

    expect(getLibraryEntryJourneyLevel(root, 'bp-root')).toBe('L1');
    expect(getLibraryEntryJourneyLevel(root, 'bp-l2')).toBe('L2');
    expect(getLibraryEntryJourneyLevel(root, 'bp-l3')).toBe('L3');
  });

  it('resolves L3 from rootDocument chain when L1’s embedded L2 is missing L3 (stale childBlueprints)', () => {
    const l3 = makeBlueprintState('bp-l3', 'Report packaging data service', {
      activeBlueprintId: 'bp-l3',
      rootBlueprintId: 'bp-root',
    });
    const l2 = makeBlueprintState('bp-l2', 'Macro', {
      childBlueprints: [],
      activeBlueprintId: 'bp-l3',
      rootBlueprintId: 'bp-root',
      journeySpans: [
        {
          id: 'span-l3',
          blueprintId: 'bp-l2',
          title: 'Micro',
          startStepId: 'step-1',
          endStepId: 'step-1',
          order: 0,
          childBlueprintId: 'bp-l3',
          level: 'L3',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    l3.rootDocument = l2;

    expect(getLibraryEntryJourneyLevel(l3, 'bp-l3')).toBe('L3');
  });
});

describe('isActiveLibraryEntry', () => {
  it('marks only the exact open blueprint as active within the current document tree', () => {
    const l3 = makeBlueprintState('bp-l3', 'Micro journey', {
      activeBlueprintId: 'bp-l3',
      rootBlueprintId: 'bp-root',
    });
    const l2 = makeBlueprintState('bp-l2', 'Macro journey', {
      childBlueprints: [l3],
      activeBlueprintId: 'bp-l3',
      rootBlueprintId: 'bp-root',
    });
    const root = makeBlueprintState('bp-root', 'Lifecycle', {
      childBlueprints: [l2],
      activeBlueprintId: 'bp-l3',
      rootBlueprintId: 'bp-root',
    });

    l2.rootDocument = root;
    l3.rootDocument = l2;

    expect(isActiveLibraryEntry(root, root, 'bp-root')).toBe(false);
    expect(isActiveLibraryEntry(root, l2, 'bp-l2')).toBe(false);
    expect(isActiveLibraryEntry(root, l3, 'bp-l3')).toBe(true);
  });
});
