import { type JourneySpan, type Stage, type Step } from '@/lib/types';

export interface JourneySpanLayout extends JourneySpan {
  startIndex: number;
  endIndex: number;
  track: number;
}

export function getOrderedSteps(stages: Stage[], stepsPerStage: Map<string, Step[]>) {
  return stages.flatMap((stage) => stepsPerStage.get(stage.id) || []);
}

export function getJourneySpanLayouts(
  journeySpans: JourneySpan[],
  stages: Stage[],
  stepsPerStage: Map<string, Step[]>,
): JourneySpanLayout[] {
  const orderedSteps = getOrderedSteps(stages, stepsPerStage);
  const stepIndex = new Map(orderedSteps.map((step, index) => [step.id, index]));
  const trackEndByIndex: number[] = [];

  return [...journeySpans]
    .map((journey, sourceOrder) => {
      const rawStart = stepIndex.get(journey.startStepId) ?? 0;
      const rawEnd = stepIndex.get(journey.endStepId) ?? rawStart;
      return {
        ...journey,
        startIndex: Math.min(rawStart, rawEnd),
        endIndex: Math.max(rawStart, rawEnd),
        sourceOrder,
      };
    })
    .sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex || a.order - b.order || a.sourceOrder - b.sourceOrder)
    .map(({ sourceOrder: _sourceOrder, ...journey }) => {
      let track = trackEndByIndex.findIndex((trackEnd) => journey.startIndex > trackEnd);
      if (track === -1) {
        track = trackEndByIndex.length;
        trackEndByIndex.push(journey.endIndex);
      } else {
        trackEndByIndex[track] = journey.endIndex;
      }

      return {
        ...journey,
        track,
      };
    });
}
