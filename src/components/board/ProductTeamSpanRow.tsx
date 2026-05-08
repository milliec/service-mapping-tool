'use client';

import { Users, Pencil, Plus } from 'lucide-react';
import { type ProductTeamSpan, type Stage, type Step } from '@/lib/types';
import { cn } from '@/lib/utils';

import { BOARD_STEP_WIDTH as STEP_WIDTH } from '@/lib/board-layout';
const COLLAPSED_ROW_H = 56;
const TRACK_HEIGHT = 72;
const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 56;
const ROW_PADDING = 16;

interface ProductTeamSpanRowProps {
  collapsed: boolean;
  stages: Stage[];
  stepsPerStage: Map<string, Step[]>;
  productTeamSpans: ProductTeamSpan[];
  selectedProductTeamSpanId: string | null;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

function getOrderedSteps(stages: Stage[], stepsPerStage: Map<string, Step[]>) {
  return stages.flatMap((stage) => stepsPerStage.get(stage.id) || []);
}

function getLayouts(
  spans: ProductTeamSpan[],
  stages: Stage[],
  stepsPerStage: Map<string, Step[]>,
) {
  const orderedSteps = getOrderedSteps(stages, stepsPerStage);
  const stepIndex = new Map(orderedSteps.map((step, index) => [step.id, index]));
  const trackEndByIndex: number[] = [];

  return [...spans]
    .map((span, sourceOrder) => {
      const rawStart = stepIndex.get(span.startStepId) ?? 0;
      const rawEnd = stepIndex.get(span.endStepId) ?? rawStart;
      return {
        ...span,
        startIndex: Math.min(rawStart, rawEnd),
        endIndex: Math.max(rawStart, rawEnd),
        sourceOrder,
      };
    })
    .sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex || a.order - b.order || a.sourceOrder - b.sourceOrder)
    .map(({ sourceOrder: _sourceOrder, ...span }) => {
      let track = trackEndByIndex.findIndex((trackEnd) => span.startIndex > trackEnd);
      if (track === -1) {
        track = trackEndByIndex.length;
        trackEndByIndex.push(span.endIndex);
      } else {
        trackEndByIndex[track] = span.endIndex;
      }

      return { ...span, track };
    });
}

export function ProductTeamSpanRow({
  collapsed,
  stages,
  stepsPerStage,
  productTeamSpans,
  selectedProductTeamSpanId,
  onAdd,
  onEdit,
}: ProductTeamSpanRowProps) {
  const layouts = getLayouts(productTeamSpans, stages, stepsPerStage);
  const hasSpans = layouts.length > 0;
  const totalColumns = stages.reduce((count, stage) => count + Math.max(stepsPerStage.get(stage.id)?.length ?? 0, 1), 0);
  const furthestColumn = layouts.length > 0 ? Math.max(...layouts.map((span) => span.endIndex + 1)) : totalColumns;
  const contentWidth = Math.max(totalColumns * STEP_WIDTH, furthestColumn * STEP_WIDTH);
  const trackCount = Math.max(1, layouts.reduce((maxTrack, span) => Math.max(maxTrack, span.track + 1), 0));
  const rowHeight = (hasSpans ? FOOTER_HEIGHT : HEADER_HEIGHT) + trackCount * TRACK_HEIGHT + ROW_PADDING;
  const footerTop = trackCount * TRACK_HEIGHT + 8;

  if (collapsed) {
    return (
      <div className="flex bg-[#E6F3EB]/60" style={{ width: contentWidth }}>
        {stages.map((stage) => {
          const stageSteps = stepsPerStage.get(stage.id) || [];
          if (stageSteps.length === 0) {
            return <div key={stage.id} className="shrink-0 border-r border-neutral-200" style={{ width: STEP_WIDTH, height: COLLAPSED_ROW_H }} />;
          }
          return stageSteps.map((step, stepIdx) => (
            <div
              key={step.id}
              className={cn('flex shrink-0 items-center px-4', stepIdx < stageSteps.length - 1 ? 'border-r border-neutral-100' : 'border-r border-neutral-200')}
              style={{ width: STEP_WIDTH, height: COLLAPSED_ROW_H }}
            >
              {stepIdx === 0 && stage.id === stages[0].id ? (
                <span className="rounded-full border border-[#B6DEC6] bg-white px-2.5 py-1 text-[11px] font-medium text-[#008938]">
                  {productTeamSpans.length} team{productTeamSpans.length === 1 ? '' : 's'}
                </span>
              ) : (
                <span className="text-[11px] text-neutral-300">&nbsp;</span>
              )}
            </div>
          ));
        })}
      </div>
    );
  }

  return (
    <div className="group relative isolate z-0 bg-[#E6F3EB]/40" style={{ width: contentWidth, minHeight: rowHeight }}>
      <div className="pointer-events-none absolute inset-0 flex">
        {stages.map((stage) => {
          const stageSteps = stepsPerStage.get(stage.id) || [];
          if (stageSteps.length === 0) {
            return <div key={stage.id} className="shrink-0 border-r border-neutral-200" style={{ width: STEP_WIDTH, minHeight: rowHeight }} />;
          }
          return stageSteps.map((step, stepIdx) => (
            <div
              key={step.id}
              className={cn('shrink-0 border-r', stepIdx < stageSteps.length - 1 ? 'border-neutral-100' : 'border-neutral-200')}
              style={{ width: STEP_WIDTH, minHeight: rowHeight }}
            />
          ));
        })}
      </div>

      {hasSpans && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-white/65 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100" />
      )}

      <div
        className={cn(
          'absolute left-0 top-0 z-[1] flex items-center gap-4 px-4 py-3 transition-opacity',
          hasSpans && 'hidden',
        )}
      >
        <p className="text-[12px] font-semibold text-[#008938]">Product teams</p>
        <button
          type="button"
          data-no-pan
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-full border border-[#B6DEC6] bg-white px-3 py-1.5 text-[12px] font-medium text-[#008938] transition-colors hover:bg-[#E6F3EB] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Plus className="h-3.5 w-3.5" />
          Team
        </button>
      </div>

      <div className={cn('relative px-2', hasSpans ? 'z-20 pb-16 pt-2' : 'pb-3 pt-16')}>
        {layouts.length === 0 && (
          <div className="flex min-h-[56px] items-center justify-center rounded-2xl border border-dashed border-[#B6DEC6] bg-white/80 text-[12px] text-neutral-500">
            Add a product team span to show which steps they own.
          </div>
        )}

        {layouts.map((span) => {
          const left = span.startIndex * STEP_WIDTH + 8;
          const width = Math.max(STEP_WIDTH - 16, (span.endIndex - span.startIndex + 1) * STEP_WIDTH - 16);
          const top = span.track * TRACK_HEIGHT + 8;
          const isSelected = selectedProductTeamSpanId === span.id;

          return (
            <div
              key={span.id}
              className={cn(
                'group absolute overflow-hidden rounded-2xl border bg-white/95 shadow-sm transition-shadow hover:z-50 hover:shadow-md focus-within:z-50',
                isSelected
                  ? 'z-40 border-[#008938] ring-2 ring-[#B6DEC6]'
                  : 'z-30 border-[#B6DEC6]',
              )}
              style={{ left, top, width, minHeight: 56 }}
            >
              <button
                type="button"
                data-no-pan
                onClick={() => onEdit(span.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label={`Edit product team ${span.title}`}
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E6F3EB] text-[#008938]">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-neutral-900">{span.title}</p>
                  {span.description && (
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-neutral-500">{span.description}</p>
                  )}
                </div>
              </button>
              <button
                type="button"
                data-no-pan
                onClick={() => onEdit(span.id)}
                className="absolute right-2 top-2 rounded-lg p-1 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label={`Edit product team ${span.title}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <div className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-b from-[#B6DEC6] via-[#6FBE8E] to-[#008938]" style={{ width: 6 }} />
            </div>
          );
        })}

        {hasSpans && (
          <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: footerTop }}>
            <div className="sticky left-4 w-max pointer-events-auto">
              <div className="flex items-center gap-4 rounded-2xl bg-white/95 px-3 py-2 shadow-md ring-1 ring-[#B6DEC6] transition-opacity opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                <p className="text-[12px] font-semibold text-[#008938]">Product teams</p>
                <button
                  type="button"
                  data-no-pan
                  onClick={onAdd}
                  className="inline-flex items-center gap-1 rounded-full border border-[#B6DEC6] bg-white px-3 py-1.5 text-[12px] font-medium text-[#008938] transition-colors hover:bg-[#E6F3EB] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Team
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
