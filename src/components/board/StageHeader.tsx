'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { type Stage } from '@/lib/types';
import { useBlueprintStore } from '@/store/blueprint-store';
import { stripTraceabilityForDisplay } from '@/lib/traceability/display';

interface StageHeaderProps {
  stage: Stage;
  stepCount: number;
  stepWidth: number;
  /** When true, this header represents a "step" (L2/L3 child view) rather than a "stage" (L1). */
  isChildLevel?: boolean;
}

export function StageHeader({ stage, stepCount, stepWidth, isChildLevel = false }: StageHeaderProps) {
  const entityLabel = isChildLevel ? 'step' : 'stage';
  const entityLabelCap = isChildLevel ? 'Step' : 'Stage';
  const updateStage = useBlueprintStore((s) => s.updateStage);
  const deleteStage = useBlueprintStore((s) => s.deleteStage);
  const insertStageAfter = useBlueprintStore((s) => s.insertStageAfter);
  const reorderStage = useBlueprintStore((s) => s.reorderStage);
  const stages = useBlueprintStore((s) => s.stages);
  const readOnly = useBlueprintStore((s) => s.readOnly);

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(stage.title);
  const titleRef = useRef<HTMLInputElement>(null);

  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const stageIdx = sorted.findIndex((s) => s.id === stage.id);
  const canMoveLeft = stageIdx > 0;
  const canMoveRight = stageIdx < sorted.length - 1;
  const displayTitle = stripTraceabilityForDisplay(stage.title);

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [editingTitle]);

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed) {
      updateStage(stage.id, { title: trimmed });
    } else {
      setTitle(stage.title);
    }
    setEditingTitle(false);
  };

  const toolbarClass =
    'pointer-events-none absolute inset-x-0 top-full z-30 flex flex-wrap items-center gap-0.5 border-x border-b border-neutral-200 bg-white px-2 py-1.5 shadow-sm opacity-0 transition-opacity duration-150 group-hover/stageheader:pointer-events-auto group-hover/stageheader:opacity-100 group-focus-within/stageheader:pointer-events-auto group-focus-within/stageheader:opacity-100';

  return (
    <div
      className="group/stageheader relative min-h-[56px] min-w-0 shrink-0 self-stretch border-b border-r border-neutral-200 bg-white px-4 py-1.5"
      style={{ width: stepCount * stepWidth }}
    >
      {editingTitle && !readOnly ? (
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveTitle();
            if (e.key === 'Escape') {
              setTitle(stage.title);
              setEditingTitle(false);
            }
          }}
          onBlur={saveTitle}
          aria-label={`${entityLabelCap} title`}
          className="mt-0.5 w-full max-w-full rounded border border-neutral-300 bg-white px-2.5 py-1 text-[17px] font-semibold text-neutral-900 outline-none focus:border-blue-400"
        />
      ) : (
        <h3 className="break-words text-[17px] font-bold leading-snug tracking-tight text-neutral-900">
          {displayTitle || stage.title}
        </h3>
      )}

      {!readOnly && (
      <div
        className={toolbarClass}
        role="toolbar"
        aria-label={`Actions for ${entityLabel} ${stage.title}`}
      >
        {canMoveLeft && (
          <button
            type="button"
            onClick={() => reorderStage(stage.id, stageIdx - 1)}
            className="rounded p-0.5 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label={`Move ${entityLabel} left`}
          >
            <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
        {canMoveRight && (
          <button
            type="button"
            onClick={() => reorderStage(stage.id, stageIdx + 1)}
            className="rounded p-0.5 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label={`Move ${entityLabel} right`}
          >
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setTitle(stage.title);
            setEditingTitle(true);
          }}
          className="rounded p-0.5 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label={`Edit ${entityLabel} title`}
        >
          <Pencil aria-hidden="true" className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            insertStageAfter(stage.id, `New ${entityLabel}`);
            e.currentTarget.blur();
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label={`Insert ${entityLabel} after this one`}
        >
          <Plus aria-hidden="true" className="h-3 w-3" /> {entityLabelCap}
        </button>
        <button
          type="button"
          onClick={() => {
            const confirmMsg = isChildLevel
              ? `Delete step "${stage.title}" and all its cards?`
              : `Delete stage "${stage.title}" and all its steps and cards?`;
            if (confirm(confirmMsg)) {
              deleteStage(stage.id);
            }
          }}
          className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          aria-label={`Delete ${entityLabel}`}
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
      )}
    </div>
  );
}
