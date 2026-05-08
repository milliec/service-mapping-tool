'use client';

import { useMemo, useRef } from 'react';
import { ArrowLeft, Trash2, X } from 'lucide-react';
import { useBlueprintStore } from '@/store/blueprint-store';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { getActiveBlueprintJourneyLevel } from '@/lib/blueprint-levels';
import { cn } from '@/lib/utils';
import { getLaneColor } from './LaneLabel';
import type { Stage } from '@/lib/types';

function stageSelectLabel(stage: Stage): string {
  const t = stage.title.trim();
  const code = stage.traceabilityCode?.trim();
  if (code) {
    const prefix = `${code}:`;
    if (t.toUpperCase().startsWith(prefix.toUpperCase())) {
      return t.slice(prefix.length).trim() || t;
    }
  }
  const stripped = t.replace(/^[A-Z]{1,6}-\d{1,4}:\s*/i, '').trim();
  return stripped || t;
}

export function ProductTeamDetailPanel() {
  const activeJourneyLevel = useBlueprintStore((s) =>
    getActiveBlueprintJourneyLevel({
      blueprint: s.blueprint,
      stages: s.stages,
      steps: s.steps,
      lanes: s.lanes,
      journeySpans: s.journeySpans,
      policyReformSpans: s.policyReformSpans,
      productTeamSpans: s.productTeamSpans ?? [],
      childBlueprints: s.childBlueprints,
      rootDocument: s.rootDocument,
      activeBlueprintId: s.activeBlueprintId,
      rootBlueprintId: s.rootBlueprintId,
      cards: s.cards,
      storyboardImages: s.storyboardImages,
      storyboardVisible: s.storyboardVisible,
      storyboardCollapsed: s.storyboardCollapsed,
      cardLinks: s.cardLinks,
      evidence: s.evidence,
      opportunities: s.opportunities,
      solutions: s.solutions,
      assumptions: s.assumptions,
      strategicGoals: s.strategicGoals,
      outcomes: s.outcomes,
      systemOutcomes: s.systemOutcomes ?? [],
      behaviourOutcomes: s.behaviourOutcomes ?? [],
      serviceOutcomes: s.serviceOutcomes ?? [],
      stepLinks: s.stepLinks,
      requirements: s.requirements,
      apiContracts: s.apiContracts,
      uiScaffolds: s.uiScaffolds,
      traceabilityCounters: s.traceabilityCounters,
    }),
  );
  const isL3Copy = activeJourneyLevel === 'L3';

  const selectedProductTeamSpanId = useBlueprintStore((s) => s.selectedProductTeamSpanId);
  const selectProductTeamSpan = useBlueprintStore((s) => s.selectProductTeamSpan);
  const productTeamSpans = useBlueprintStore((s) => s.productTeamSpans ?? []);
  const steps = useBlueprintStore((s) => s.steps);
  const stages = useBlueprintStore((s) => s.stages);
  const updateProductTeamSpan = useBlueprintStore((s) => s.updateProductTeamSpan);
  const deleteProductTeamSpan = useBlueprintStore((s) => s.deleteProductTeamSpan);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, !!selectedProductTeamSpanId);

  const span = selectedProductTeamSpanId
    ? productTeamSpans.find((item) => item.id === selectedProductTeamSpanId) ?? null
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

  if (!span) return null;

  const startStep = steps.find((step) => step.id === span.startStepId) ?? null;
  const endStep = steps.find((step) => step.id === span.endStepId) ?? null;
  const startStage = startStep ? stages.find((s) => s.id === startStep.stageId) ?? null : null;
  const endStage = endStep ? stages.find((s) => s.id === endStep.stageId) ?? null : null;
  const laneColor = getLaneColor('product_teams');

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
            <span className={cn('rounded-full px-2 py-0.5 font-medium', laneColor)}>Product team</span>
            {!isL3Copy ? <span>Stage-spanning item</span> : null}
          </div>
          <h2 className="mt-1.5 text-[15px] font-semibold leading-snug text-neutral-900">{span.title}</h2>
        </div>
        <button
          onClick={() => selectProductTeamSpan(null)}
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
              Team title
            </label>
            <input
              type="text"
              value={span.title}
              onChange={(event) => updateProductTeamSpan(span.id, { title: event.target.value })}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            />
          </section>

          <section className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Description
            </label>
            <textarea
              value={span.description ?? ''}
              onChange={(event) => updateProductTeamSpan(span.id, { description: event.target.value })}
              rows={14}
              placeholder="Summarize responsibilities or scope…"
              className="h-[208px] w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-800 placeholder:text-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            />
          </section>

          <section className="space-y-4">
            <label className="block space-y-2">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {isL3Copy ? 'Start step' : 'Start stage'}
              </span>
              <select
                value={startStage?.id ?? ''}
                onChange={(event) => {
                  const row = stagesWithStepBounds.find((s) => s.stage.id === event.target.value);
                  if (row) updateProductTeamSpan(span.id, { startStepId: row.firstStepId });
                }}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {stagesWithStepBounds.map(({ stage }) => (
                  <option key={stage.id} value={stage.id}>
                    {stageSelectLabel(stage)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {isL3Copy ? 'End step' : 'End stage'}
              </span>
              <select
                value={endStage?.id ?? ''}
                onChange={(event) => {
                  const row = stagesWithStepBounds.find((s) => s.stage.id === event.target.value);
                  if (row) updateProductTeamSpan(span.id, { endStepId: row.lastStepId });
                }}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {stagesWithStepBounds.map(({ stage }) => (
                  <option key={stage.id} value={stage.id}>
                    {stageSelectLabel(stage)}
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
            onClick={() => selectProductTeamSpan(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Close
          </button>
          <button
            type="button"
            onClick={() => deleteProductTeamSpan(span.id)}
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
