'use client';

import { useMemo, useState } from 'react';
import { Milestone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBlueprintStore } from '@/store/blueprint-store';
import { ProductTeamCombobox } from './ProductTeamCombobox';
import { USER_TYPE_OPTIONS } from './product-team-options';
import { stripTraceabilityForDisplay } from '@/lib/traceability/display';

interface CreateJourneyDialogProps {
  open: boolean;
  onClose: () => void;
  /** L2 nested blueprint: service/product + team copy. L1 lifecycle: journey + user-type copy. */
  isL2Mode?: boolean;
}

export function CreateJourneyDialog({ open, onClose, isL2Mode = false }: CreateJourneyDialogProps) {
  const steps = useBlueprintStore((s) => s.steps);
  const stages = useBlueprintStore((s) => s.stages);
  const addJourneySpan = useBlueprintStore((s) => s.addJourneySpan);

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

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-xl gap-2 overflow-hidden p-0" showCloseButton>
        <DialogHeader className="border-b border-neutral-100 px-6 py-2">
          <div className="flex items-start gap-3 pt-3">
            <div className="rounded-2xl bg-[#E6F3EB] p-2.5 text-[#008938]">
              <Milestone className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>{isL2Mode ? 'Create nested service or product' : 'Create nested journey'}</DialogTitle>
              <DialogDescription>
                {isL2Mode
                  ? 'The service or product may span across one or more steps.'
                  : 'The journey may span across one or more stages.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {open ? (
          <CreateJourneyDialogForm
            key={`${stagesWithStepBounds[0]?.stage.id ?? 'empty'}-${stagesWithStepBounds.length}`}
            stagesWithStepBounds={stagesWithStepBounds}
            isL2Mode={isL2Mode}
            onClose={onClose}
            onCreate={addJourneySpan}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface CreateJourneyDialogFormProps {
  stagesWithStepBounds: Array<{
    stage: { id: string; title: string };
    firstStepId: string;
    lastStepId: string;
  }>;
  isL2Mode: boolean;
  onClose: () => void;
  onCreate: ReturnType<typeof useBlueprintStore.getState>['addJourneySpan'];
}

function CreateJourneyDialogForm({ stagesWithStepBounds, isL2Mode, onClose, onCreate }: CreateJourneyDialogFormProps) {
  const defaultStageId = stagesWithStepBounds[0]?.stage.id ?? '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [productTeam, setProductTeam] = useState('');
  const [startStageId, setStartStageId] = useState(defaultStageId);
  const [endStageId, setEndStageId] = useState(defaultStageId);

  const canCreate = stagesWithStepBounds.length > 0 && startStageId && endStageId;

  const handleCreate = () => {
    if (!canCreate) return;
    const start = stagesWithStepBounds.find((s) => s.stage.id === startStageId);
    const end = stagesWithStepBounds.find((s) => s.stage.id === endStageId);
    if (!start || !end) return;
    onCreate({
      title,
      description,
      productTeam,
      startStepId: start.firstStepId,
      endStepId: end.lastStepId,
    });
    onClose();
  };

  return (
    <>
      <div className="space-y-5 px-6 py-0.5">
        <label className="block space-y-2">
          <span className="block text-[12px] font-semibold text-neutral-700">
            {isL2Mode ? 'Service or product name' : 'User journey'}
          </span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={
              isL2Mode ? 'For example, Report packaging data' : 'For example, Place packaging in the UK market'
            }
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          />
        </label>

        <label className="block space-y-2">
          <span className="block text-[12px] font-semibold text-neutral-700">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder={
              isL2Mode
                ? 'Optional context about what this service or product is about'
                : 'Optional context about what this journey is about'
            }
            className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          />
        </label>

        <ProductTeamCombobox
          label={isL2Mode ? 'Product team' : 'User type'}
          value={productTeam}
          onChange={setProductTeam}
          options={isL2Mode ? undefined : USER_TYPE_OPTIONS}
          placeholder={isL2Mode ? 'Search or add a team' : 'Search or add a user'}
          helperText={
            isL2Mode
              ? 'Choose an existing team or add a new one if the right team is not listed yet.'
              : 'Choose a user type or add one if the right type is not listed yet.'
          }
          addNewLabel={isL2Mode ? 'Add new team' : 'Add new user'}
          noMatchingLabel={isL2Mode ? 'No matching teams' : 'No matching users'}
        />

        <label className="block space-y-2">
          <span className="block text-[12px] font-semibold text-neutral-700">
            {isL2Mode ? 'Start step' : 'Start stage'}
          </span>
          <select
            value={startStageId}
            onChange={(event) => setStartStageId(event.target.value)}
            title={stripTraceabilityForDisplay(stagesWithStepBounds.find(({ stage }) => stage.id === startStageId)?.stage.title ?? '')}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[14px] text-neutral-900 focus:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {stagesWithStepBounds.map(({ stage }) => (
              <option key={stage.id} value={stage.id}>
                {stripTraceabilityForDisplay(stage.title) || stage.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="block text-[12px] font-semibold text-neutral-700">
            {isL2Mode ? 'End step' : 'End stage'}
          </span>
          <select
            value={endStageId}
            onChange={(event) => setEndStageId(event.target.value)}
            title={stripTraceabilityForDisplay(stagesWithStepBounds.find(({ stage }) => stage.id === endStageId)?.stage.title ?? '')}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[14px] text-neutral-900 focus:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {stagesWithStepBounds.map(({ stage }) => (
              <option key={stage.id} value={stage.id}>
                {stripTraceabilityForDisplay(stage.title) || stage.title}
              </option>
            ))}
          </select>
        </label>

        {stagesWithStepBounds.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-[13px] text-neutral-500">
            Add at least one stage with a step before creating a nested journey.
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-neutral-100 bg-neutral-50 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-[14px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          Close
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Create
        </button>
      </div>
    </>
  );
}
