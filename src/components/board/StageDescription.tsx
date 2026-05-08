'use client';

import { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { type Stage } from '@/lib/types';
import { useBlueprintStore } from '@/store/blueprint-store';

interface StageDescriptionProps {
  stage: Stage;
  width: number;
}

export function StageDescription({ stage, width }: StageDescriptionProps) {
  const updateStage = useBlueprintStore((s) => s.updateStage);
  const readOnly = useBlueprintStore((s) => s.readOnly);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(stage.description ?? '');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (stage.description) inputRef.current.select();
    }
  }, [editing, stage.description]);

  const save = () => {
    updateStage(stage.id, { description: description.trim() });
    setEditing(false);
  };

  return (
    <div
      className="group flex min-h-[60px] shrink-0 items-start gap-1 border-b border-r border-neutral-200 bg-white px-3 py-2"
      style={{ width }}
    >
      {editing && !readOnly ? (
        <textarea
          ref={inputRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
            if (e.key === 'Escape') {
              setDescription(stage.description ?? '');
              setEditing(false);
            }
          }}
          onBlur={save}
          rows={3}
          aria-label="Stage description"
          className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-[12px] leading-snug text-neutral-700 outline-none focus:border-blue-400"
          placeholder="Stage description…"
        />
      ) : (
        <>
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-[12px] leading-snug text-neutral-600">
            {stage.description || (
              <span className="text-neutral-300">No description</span>
            )}
          </p>
          {!readOnly && (
            <button
              onClick={() => {
                setDescription(stage.description ?? '');
                setEditing(true);
              }}
              className="shrink-0 rounded p-0.5 text-neutral-300 opacity-0 transition-opacity hover:text-neutral-500 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label="Edit stage description"
            >
              <Pencil aria-hidden="true" className="h-3 w-3" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
