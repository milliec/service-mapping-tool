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
  it('always returns L1 (journey hierarchy removed)', () => {
    const root = makeBlueprintState('bp-root', 'Lifecycle');
    expect(getLibraryEntryJourneyLevel(root, 'bp-root')).toBe('L1');
    expect(getLibraryEntryJourneyLevel(root, 'bp-other')).toBe('L1');
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
