'use client';

import { useState, useRef, useEffect } from 'react';
import { Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { type Step } from '@/lib/types';
import { useBlueprintStore } from '@/store/blueprint-store';

interface StepHeaderProps {
  step: Step;
  stepWidth: number;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}

export function StepHeader({ step, stepWidth, canMoveLeft, canMoveRight }: StepHeaderProps) {
  const updateStep = useBlueprintStore((s) => s.updateStep);
  const deleteStep = useBlueprintStore((s) => s.deleteStep);
  const reorderStep = useBlueprintStore((s) => s.reorderStep);
  const readOnly = useBlueprintStore((s) => s.readOnly);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(step.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const save = () => {
    const trimmed = title.trim();
    if (trimmed) {
      updateStep(step.id, { title: trimmed });
    } else {
      setTitle(step.title);
    }
    setEditing(false);
  };

  return (
    <div
      className="group flex min-h-[48px] shrink-0 items-center bg-white px-3 py-1"
      style={{ width: stepWidth }}
    >
      {editing && !readOnly ? (
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              setTitle(step.title);
              setEditing(false);
            }
          }}
          onBlur={save}
          aria-label="Step title"
          className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1 text-center text-[15px] font-semibold text-neutral-800 outline-none focus:border-blue-400"
        />
      ) : (
        <div className="flex w-full min-w-0 items-center">
          <div className="min-w-0 flex-1" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 justify-center overflow-hidden px-1">
            <p className="w-full min-w-0 truncate text-center text-[15px] font-semibold leading-snug text-neutral-800">
              {step.title}
            </p>
          </div>
          <div className="flex min-w-0 flex-1 justify-end">
          {!readOnly && (
          <div className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {canMoveLeft && (
              <button
                onClick={() => reorderStep(step.id, step.order - 1)}
                className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label="Move step left"
              >
                <ChevronLeft aria-hidden="true" className="h-3 w-3" />
              </button>
            )}
            {canMoveRight && (
              <button
                onClick={() => reorderStep(step.id, step.order + 1)}
                className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label="Move step right"
              >
                <ChevronRight aria-hidden="true" className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label="Edit step title"
            >
              <Pencil aria-hidden="true" className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete step "${step.title}" and all its cards?`)) {
                  deleteStep(step.id);
                }
              }}
              className="rounded p-0.5 text-neutral-400 hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              aria-label="Delete step"
            >
              <Trash2 aria-hidden="true" className="h-3 w-3" />
            </button>
          </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
