'use client';

import { useMemo, useState } from 'react';
import { Landmark } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBlueprintStore } from '@/store/blueprint-store';
import { stripTraceabilityForDisplay } from '@/lib/traceability/display';

interface CreatePolicyReformDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreatePolicyReformDialog({ open, onClose }: CreatePolicyReformDialogProps) {
  const steps = useBlueprintStore((s) => s.steps);
  const stages = useBlueprintStore((s) => s.stages);
  const addPolicyReformSpan = useBlueprintStore((s) => s.addPolicyReformSpan);

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

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startStageId, setStartStageId] = useState('');
  const [endStageId, setEndStageId] = useState('');
  const defaultStageId = stagesWithStepBounds[0]?.stage.id ?? '';
  const effectiveStartStageId = startStageId || defaultStageId;
  const effectiveEndStageId = endStageId || defaultStageId;
  const canCreate = stagesWithStepBounds.length > 0 && effectiveStartStageId && effectiveEndStageId;

  const reset = () => {
    setTitle('');
    setDescription('');
    setStartStageId('');
    setEndStageId('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = () => {
    if (!canCreate) return;
    const start = stagesWithStepBounds.find((s) => s.stage.id === effectiveStartStageId);
    const end = stagesWithStepBounds.find((s) => s.stage.id === effectiveEndStageId);
    if (!start || !end) return;
    addPolicyReformSpan({
      title,
      description,
      startStepId: start.firstStepId,
      endStepId: end.lastStepId,
    });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="max-w-xl gap-2 overflow-hidden p-0" showCloseButton>
        <DialogHeader className="border-b border-neutral-100 px-6 py-2">
          <div className="flex items-start gap-3 pt-3">
            <div className="rounded-2xl bg-indigo-50 p-2.5 text-indigo-700">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>Create Policy Reform</DialogTitle>
              <DialogDescription>
                Add a policy reform and place it across the stages it influences.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <label className="block space-y-2">
            <span className="block text-[12px] font-semibold text-neutral-700">Policy reform title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="For example: Simplify smaller producer registration criteria"
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            />
          </label>

          <label className="block space-y-2">
            <span className="block text-[12px] font-semibold text-neutral-700">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Optional context about what the reform changes"
              className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block space-y-2">
              <span className="block text-[12px] font-semibold text-neutral-700">Start stage</span>
              <select
                value={effectiveStartStageId}
                onChange={(event) => setStartStageId(event.target.value)}
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
              <span className="block text-[12px] font-semibold text-neutral-700">End stage</span>
              <select
                value={effectiveEndStageId}
                onChange={(event) => setEndStageId(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[14px] text-neutral-900 focus:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {stagesWithStepBounds.map(({ stage }) => (
                  <option key={stage.id} value={stage.id}>
                    {stripTraceabilityForDisplay(stage.title) || stage.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-100 bg-neutral-50 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
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
            Create reform
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
