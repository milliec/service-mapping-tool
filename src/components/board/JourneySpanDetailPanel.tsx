'use client';

import { useMemo } from 'react';
import { ArrowLeft, ExternalLink, Trash2, X } from 'lucide-react';
import { useBlueprintStore } from '@/store/blueprint-store';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { cn } from '@/lib/utils';
import { getLaneColor } from './LaneLabel';
import { useRef } from 'react';
import { ProductTeamCombobox } from './ProductTeamCombobox';
import { USER_TYPE_OPTIONS, isThirdPartyProductTeam } from './product-team-options';
import { stripTraceabilityForDisplay } from '@/lib/traceability/display';

interface JourneySpanDetailPanelProps {
  onOpenJourney: (journeyId: string) => void;
}

export function JourneySpanDetailPanel({ onOpenJourney }: JourneySpanDetailPanelProps) {
  const selectedJourneySpanId = useBlueprintStore((s) => s.selectedJourneySpanId);
  const selectJourneySpan = useBlueprintStore((s) => s.selectJourneySpan);
  const journeySpans = useBlueprintStore((s) => s.journeySpans);
  const steps = useBlueprintStore((s) => s.steps);
  const stages = useBlueprintStore((s) => s.stages);
  const updateJourneySpan = useBlueprintStore((s) => s.updateJourneySpan);
  const deleteJourneySpan = useBlueprintStore((s) => s.deleteJourneySpan);
  const rootDocument = useBlueprintStore((s) => s.rootDocument);
  const activeBlueprintId = useBlueprintStore((s) => s.activeBlueprintId);
  const rootBlueprintId = useBlueprintStore((s) => s.rootBlueprintId);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, !!selectedJourneySpanId);

  const journey = selectedJourneySpanId
    ? journeySpans.find((item) => item.id === selectedJourneySpanId) ?? null
    : null;

  const stagesWithStepBounds = useMemo(() => {
    const sortedStages = [...stages].sort((a, b) => a.order - b.order);
    return sortedStages
      .map((stage) => {
        const stageSteps = [...steps.filter((s) => s.stageId === stage.id)].sort((a, b) => a.order - b.order);
        const firstStepId = stageSteps[0]?.id;
        const lastStepId = stageSteps[stageSteps.length - 1]?.id;
        return firstStepId && lastStepId ? { stage, firstStepId, lastStepId } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [steps, stages]);

  if (!journey) return null;

  /** Aligned with Board / CreateJourneyDialog: product team only on the L2 child blueprint, not the L1 lifecycle root. */
  const currentJourneySpanForView = useMemo(
    () => rootDocument?.journeySpans.find((j) => j.childBlueprintId === activeBlueprintId) ?? null,
    [rootDocument, activeBlueprintId],
  );
  const isChildBlueprintView = Boolean(
    rootDocument && activeBlueprintId && rootBlueprintId && activeBlueprintId !== rootBlueprintId,
  );
  const isL2ServiceBoard = isChildBlueprintView && currentJourneySpanForView?.level === 'L2';
  const isUserJourneyLifecycle = !isL2ServiceBoard;

  const startStep = steps.find((step) => step.id === journey.startStepId) ?? null;
  const endStep = steps.find((step) => step.id === journey.endStepId) ?? null;
  const startStage = startStep ? stages.find((s) => s.id === startStep.stageId) ?? null : null;
  const endStage = endStep ? stages.find((s) => s.id === endStep.stageId) ?? null : null;
  const laneColor = getLaneColor('user_journey');

  const isThirdParty = isThirdPartyProductTeam(journey.productTeam);

  return (
    <div
      ref={panelRef}
      data-no-pan
      data-no-select
      className="pointer-events-auto absolute inset-y-0 right-0 z-40 flex w-[380px] flex-col border-l border-neutral-200 bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.06)]"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 font-medium',
                isThirdParty ? 'bg-neutral-100 text-neutral-700 ring-1 ring-neutral-300' : laneColor,
              )}
            >
              {journey.level}
            </span>
            <span>{isUserJourneyLifecycle ? 'Nested user journey' : 'Nested service or product'}</span>
          </div>
          <h2 className="mt-1.5 text-[15px] font-semibold leading-snug text-neutral-900">{journey.title}</h2>
        </div>
        <button
          onClick={() => selectJourneySpan(null)}
          className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-6">
          <section className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Title
            </label>
            <input
              type="text"
              value={journey.title}
              onChange={(event) => updateJourneySpan(journey.id, { title: event.target.value })}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            />
          </section>

          <section className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Description
            </label>
            <textarea
              value={journey.description ?? ''}
              onChange={(event) => updateJourneySpan(journey.id, { description: event.target.value })}
              rows={4}
              placeholder="Summarise what this is about"
              className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-800 placeholder:text-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            />
          </section>

          <section className="space-y-2">
            <ProductTeamCombobox
              label={isUserJourneyLifecycle ? 'User type' : 'Product team'}
              value={journey.productTeam ?? ''}
              onChange={(value) => updateJourneySpan(journey.id, { productTeam: value })}
              options={isUserJourneyLifecycle ? USER_TYPE_OPTIONS : undefined}
              placeholder={isUserJourneyLifecycle ? 'Search or add a user' : 'Search or add a team'}
              helperText={
                isUserJourneyLifecycle
                  ? 'Choose a user type or add one if the right type is not listed yet.'
                  : 'Keep ownership visible on the service or product so it is easy to route follow-up work.'
              }
              addNewLabel={isUserJourneyLifecycle ? 'Add new user' : 'Add new team'}
              noMatchingLabel={isUserJourneyLifecycle ? 'No matching users' : 'No matching teams'}
            />
          </section>

          <section className="space-y-3">
            <label className="space-y-2">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {isUserJourneyLifecycle ? 'Start stage' : 'Start step'}
              </span>
              <select
                value={startStage?.id ?? ''}
                onChange={(event) => {
                  const row = stagesWithStepBounds.find((s) => s.stage.id === event.target.value);
                  if (row) updateJourneySpan(journey.id, { startStepId: row.firstStepId });
                }}
                title={
                  stripTraceabilityForDisplay(startStage?.title ?? '') || startStage?.title || ''
                }
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {stagesWithStepBounds.map(({ stage }) => (
                  <option key={stage.id} value={stage.id}>
                    {stripTraceabilityForDisplay(stage.title) || stage.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {isUserJourneyLifecycle ? 'End stage' : 'End step'}
              </span>
              <select
                value={endStage?.id ?? ''}
                onChange={(event) => {
                  const row = stagesWithStepBounds.find((s) => s.stage.id === event.target.value);
                  if (row) updateJourneySpan(journey.id, { endStepId: row.lastStepId });
                }}
                title={stripTraceabilityForDisplay(endStage?.title ?? '') || endStage?.title || ''}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {stagesWithStepBounds.map(({ stage }) => (
                  <option key={stage.id} value={stage.id}>
                    {stripTraceabilityForDisplay(stage.title) || stage.title}
                  </option>
                ))}
              </select>
            </label>
          </section>
        </div>
      </div>

      <div className="border-t border-neutral-100 px-5 py-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenJourney(journey.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open journey
          </button>
          <button
            type="button"
            onClick={() => selectJourneySpan(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Close
          </button>
          <button
            type="button"
            onClick={() => deleteJourneySpan(journey.id)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
