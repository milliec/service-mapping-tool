'use client';

import { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { type Stage } from '@/lib/types';
import { useBlueprintStore } from '@/store/blueprint-store';
import { stripTraceabilityForDisplay } from '@/lib/traceability/display';

interface StageOutcomeProps {
  stage: Stage;
  width: number;
}

export function StageOutcome({ stage, width }: StageOutcomeProps) {
  const updateStage = useBlueprintStore((s) => s.updateStage);
  const readOnly = useBlueprintStore((s) => s.readOnly);
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState(stage.outcome);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayOutcome = stripTraceabilityForDisplay(stage.outcome);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (stage.outcome) inputRef.current.select();
    }
  }, [editing, stage.outcome]);

  const save = () => {
    updateStage(stage.id, { outcome: outcome.trim() });
    setEditing(false);
  };

  return (
    <div
      className="group flex min-h-[48px] shrink-0 items-center border-b border-r border-neutral-200 bg-neutral-50 px-3 py-1"
      style={{ width }}
    >
      {editing && !readOnly ? (
        <input
          ref={inputRef}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              setOutcome(stage.outcome);
              setEditing(false);
            }
          }}
          onBlur={save}
          aria-label="Stage outcome"
          className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1 text-[15px] text-neutral-700 outline-none focus:border-blue-400"
          placeholder="Stage outcome…"
        />
      ) : (
        <>
          <p className="min-w-0 flex-1 text-[15px] leading-snug text-neutral-700">
            {displayOutcome || (
              <span className="text-neutral-300">No outcome defined</span>
            )}
          </p>
          {!readOnly && (
            <button
              onClick={() => {
                setOutcome(stage.outcome);
                setEditing(true);
              }}
              className="ml-1 shrink-0 rounded p-0.5 text-neutral-300 opacity-0 transition-opacity hover:text-neutral-500 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label="Edit stage outcome"
            >
              <Pencil aria-hidden="true" className="h-3 w-3" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
