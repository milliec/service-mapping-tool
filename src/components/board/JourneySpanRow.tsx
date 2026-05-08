'use client';

import { Milestone, Pencil, Plus, ArrowRight } from 'lucide-react';
import { type JourneySpan, type Stage, type Step } from '@/lib/types';
import { getJourneySpanLayouts } from '@/lib/journeys/layout';
import { cn } from '@/lib/utils';
import { isThirdPartyProductTeam } from './product-team-options';

import { BOARD_STEP_WIDTH as STEP_WIDTH } from '@/lib/board-layout';

const LEVEL_LABELS: Record<'L1' | 'L2' | 'L3', string> = {
  L1: 'L1 — Lifecycle',
  L2: 'L2 — Macro',
  L3: 'L3 — Micro',
};
const COLLAPSED_ROW_H = 56;
const TRACK_HEIGHT = 72;
const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 56;
const ROW_PADDING = 16;

interface JourneySpanRowProps {
  collapsed: boolean;
  stages: Stage[];
  stepsPerStage: Map<string, Step[]>;
  journeySpans: JourneySpan[];
  selectedJourneySpanId: string | null;
  /** Shown beside "add new"; L2 nested-blueprint view uses "Service or product". */
  journeyRowTitle?: string;
  /** L2 macro: card link reads "View details"; L1 reads "Open journey". */
  isL2Mode?: boolean;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
}

export function JourneySpanRow({
  collapsed,
  stages,
  stepsPerStage,
  journeySpans,
  selectedJourneySpanId,
  journeyRowTitle = 'Nested journey',
  isL2Mode = false,
  onAdd,
  onOpen,
  onEdit,
}: JourneySpanRowProps) {
  const journeyLayouts = getJourneySpanLayouts(journeySpans, stages, stepsPerStage);
  const hasJourneys = journeyLayouts.length > 0;
  const totalColumns = stages.reduce((count, stage) => count + Math.max(stepsPerStage.get(stage.id)?.length ?? 0, 1), 0);
  const furthestJourneyColumn = journeyLayouts.length > 0
    ? Math.max(...journeyLayouts.map((journey) => journey.endIndex + 1))
    : totalColumns;
  const contentWidth = Math.max(totalColumns * STEP_WIDTH, furthestJourneyColumn * STEP_WIDTH);
  const trackCount = Math.max(1, journeyLayouts.reduce((maxTrack, journey) => Math.max(maxTrack, journey.track + 1), 0));
  const rowHeight = (hasJourneys ? FOOTER_HEIGHT : HEADER_HEIGHT) + trackCount * TRACK_HEIGHT + ROW_PADDING;
  const footerTop = trackCount * TRACK_HEIGHT + 8;

  const anyThirdPartyJourney = journeySpans.some((j) => isThirdPartyProductTeam(j.productTeam));

  if (collapsed) {
    return (
      <div
        className={cn('flex', anyThirdPartyJourney ? 'bg-neutral-100/70' : 'bg-[#E6F3EB]/70')}
        style={{ width: contentWidth }}
      >
        {stages.map((stage) => {
          const stageSteps = stepsPerStage.get(stage.id) || [];
          if (stageSteps.length === 0) {
            return (
              <div
                key={stage.id}
                className="shrink-0 border-r border-neutral-200"
                style={{ width: STEP_WIDTH, height: COLLAPSED_ROW_H }}
              />
            );
          }
          return stageSteps.map((step, stepIdx) => (
            <div
              key={step.id}
              className={cn(
                'flex shrink-0 items-center px-4',
                stepIdx < stageSteps.length - 1 ? 'border-r border-neutral-100' : 'border-r border-neutral-200',
              )}
              style={{ width: STEP_WIDTH, height: COLLAPSED_ROW_H }}
            >
              {stepIdx === 0 && stage.id === stages[0].id ? (
                <span
                  className={cn(
                    'rounded-full border bg-white px-2.5 py-1 text-[11px] font-medium',
                    anyThirdPartyJourney
                      ? 'border-neutral-300 text-neutral-600'
                      : 'border-[#B6DEC6] text-[#008938]',
                  )}
                >
                  {journeySpans.length} journey{journeySpans.length === 1 ? '' : 's'}
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
    <div
      className={cn(
        'group relative',
        anyThirdPartyJourney ? 'bg-gradient-to-b from-neutral-100/55 via-neutral-50/30 to-[#E6F3EB]/35' : 'bg-[#E6F3EB]/45',
      )}
      style={{ width: contentWidth, minHeight: rowHeight }}
    >
      <div className="pointer-events-none absolute inset-0 flex">
        {stages.map((stage) => {
          const stageSteps = stepsPerStage.get(stage.id) || [];
          if (stageSteps.length === 0) {
            return (
              <div
                key={stage.id}
                className="shrink-0 border-r border-neutral-200"
                style={{ width: STEP_WIDTH, minHeight: rowHeight }}
              />
            );
          }
          return stageSteps.map((step, stepIdx) => (
            <div
              key={step.id}
              className={cn(
                'shrink-0 border-r',
                stepIdx < stageSteps.length - 1 ? 'border-neutral-100' : 'border-neutral-200',
              )}
              style={{ width: STEP_WIDTH, minHeight: rowHeight }}
            />
          ));
        })}
      </div>

      {hasJourneys && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-white/65 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100" />
      )}

      <div
        className={cn(
          'absolute left-0 top-0 z-10 flex items-center gap-4 px-4 py-3 transition-opacity',
          hasJourneys && 'hidden',
        )}
      >
        <p className="text-[12px] font-semibold text-[#008938]">{journeyRowTitle}</p>
        <button
          type="button"
          data-no-pan
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-full border border-[#B6DEC6] bg-white px-3 py-1.5 text-[12px] font-medium text-[#008938] transition-colors hover:bg-[#E6F3EB] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Plus className="h-3.5 w-3.5" />
          add new
        </button>
      </div>

      <div className={cn('relative px-2', hasJourneys ? 'z-20 pb-16 pt-2' : 'pb-3 pt-16')}>
        {journeyLayouts.map((journey) => {
          const left = journey.startIndex * STEP_WIDTH + 8;
          const width = Math.max(STEP_WIDTH - 16, (journey.endIndex - journey.startIndex + 1) * STEP_WIDTH - 16);
          const top = journey.track * TRACK_HEIGHT + 8;
          const isSelected = selectedJourneySpanId === journey.id;
          const isThirdParty = isThirdPartyProductTeam(journey.productTeam);

          return (
            <div
              key={journey.id}
              className={cn(
                // z-30 default; z-[35] on hover/focus-within so overlapping cards do not block each other; stay under Board sticky (z-40)
                'group absolute z-30 overflow-hidden rounded-2xl border bg-white/95 shadow-sm transition-shadow hover:z-[35] hover:shadow-md focus-within:z-[35]',
                isThirdParty
                  ? isSelected
                    ? 'border-neutral-500 ring-2 ring-neutral-200'
                    : 'border-neutral-200'
                  : isSelected
                    ? 'border-[#008938] ring-2 ring-[#B6DEC6]'
                    : 'border-[#B6DEC6]',
              )}
              style={{ left, top, width, minHeight: 56 }}
            >
              <button
                type="button"
                onClick={() => onOpen(journey.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label={
                  isL2Mode
                    ? `View details for ${journey.title}, spanning ${journey.endIndex - journey.startIndex + 1} steps`
                    : `Open nested journey ${journey.title}, spanning ${journey.endIndex - journey.startIndex + 1} steps`
                }
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                    isThirdParty ? 'bg-neutral-100 text-neutral-600' : 'bg-[#E6F3EB] text-[#008938]',
                  )}
                >
                  <Milestone className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-neutral-900">{journey.title}</p>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        isThirdParty ? 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-300/80' : 'bg-[#E6F3EB] text-[#008938]',
                      )}
                    >
                      {LEVEL_LABELS[journey.level] ?? journey.level}
                    </span>
                  </div>
                  {journey.description && (
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-neutral-500">{journey.description}</p>
                  )}
                  <div
                    className={cn(
                      'mt-2 flex items-center gap-1 text-[11px] font-medium',
                      isThirdParty ? 'text-neutral-600' : 'text-[#008938]',
                    )}
                  >
                    <span>{isL2Mode ? 'View details' : 'Open journey'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onEdit(journey.id)}
                className="absolute right-2 top-2 rounded-lg p-1 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label={`Edit journey ${journey.title}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <div
                className={cn(
                  'pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-b',
                  isThirdParty ? 'from-neutral-300 via-neutral-400 to-neutral-500' : 'from-[#57B57B] via-[#20A356] to-[#008938]',
                )}
                style={{ width: 6 }}
              />
            </div>
          );
        })}

        {hasJourneys && (
          <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: footerTop }}>
            <div className="sticky left-4 w-max pointer-events-auto">
              <div className="flex items-center gap-4 rounded-full bg-white/95 px-3 py-2 shadow-md ring-1 ring-[#B6DEC6] transition-opacity opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                <p className="text-[12px] font-semibold text-[#008938]">{journeyRowTitle}</p>
                <button
                  type="button"
                  data-no-pan
                  onClick={onAdd}
                  className="inline-flex items-center gap-1 rounded-full border border-[#B6DEC6] bg-white px-3 py-1.5 text-[12px] font-medium text-[#008938] transition-colors hover:bg-[#E6F3EB] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  add new
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
