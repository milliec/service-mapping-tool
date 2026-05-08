import { describe, expect, it } from 'vitest';
import type { JourneySpan, Stage, Step } from '@/lib/types';
import { getJourneySpanLayouts, getOrderedSteps } from '@/lib/journeys/layout';

function makeStage(id: string, order: number): Stage {
  return {
    id,
    blueprintId: 'bp-1',
    title: id,
    outcome: '',
    order,
  };
}

function makeStep(id: string, stageId: string, order: number): Step {
  return {
    id,
    blueprintId: 'bp-1',
    stageId,
    title: id,
    order,
  };
}

function makeJourney(id: string, startStepId: string, endStepId: string, order: number): JourneySpan {
  return {
    id,
    blueprintId: 'bp-1',
    title: id,
    description: '',
    startStepId,
    endStepId,
    order,
    childBlueprintId: `child-${id}`,
    level: 'L2',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('journey layout helpers', () => {
  it('orders steps across stages', () => {
    const stages = [makeStage('stage-1', 0), makeStage('stage-2', 1)];
    const stepsPerStage = new Map<string, Step[]>([
      ['stage-1', [makeStep('step-1', 'stage-1', 0), makeStep('step-2', 'stage-1', 1)]],
      ['stage-2', [makeStep('step-3', 'stage-2', 0)]],
    ]);

    expect(getOrderedSteps(stages, stepsPerStage).map((step) => step.id)).toEqual(['step-1', 'step-2', 'step-3']);
  });

  it('stacks overlapping journeys onto separate tracks and reuses free tracks', () => {
    const stages = [makeStage('stage-1', 0), makeStage('stage-2', 1)];
    const stepsPerStage = new Map<string, Step[]>([
      ['stage-1', [makeStep('step-1', 'stage-1', 0), makeStep('step-2', 'stage-1', 1)]],
      ['stage-2', [makeStep('step-3', 'stage-2', 0), makeStep('step-4', 'stage-2', 1)]],
    ]);

    const layouts = getJourneySpanLayouts(
      [
        makeJourney('journey-a', 'step-1', 'step-2', 0),
        makeJourney('journey-b', 'step-2', 'step-4', 1),
        makeJourney('journey-c', 'step-4', 'step-4', 2),
      ],
      stages,
      stepsPerStage,
    );

    expect(layouts.map((journey) => ({ id: journey.id, track: journey.track }))).toEqual([
      { id: 'journey-a', track: 0 },
      { id: 'journey-b', track: 1 },
      { id: 'journey-c', track: 0 },
    ]);
  });
});
