'use client';

import { Layers, Upload } from 'lucide-react';
import { useBlueprintStore } from '@/store/blueprint-store';

interface EmptyStateProps {
  onImport: () => void;
}

export function EmptyState({ onImport }: EmptyStateProps) {
  const addStage = useBlueprintStore((s) => s.addStage);

  return (
    <div className="flex flex-1 items-center justify-center bg-[#fafafa]">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100">
          <Layers className="h-8 w-8 text-neutral-400" />
        </div>
        <div>
          <h2 className="text-[18px] font-semibold text-neutral-800">Start a new blueprint</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-500">
            You are in a fresh blueprint. Add your first stage to start mapping, or import an existing blueprint from a spreadsheet.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => addStage('New stage')}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            <Layers className="h-4 w-4" />
            Add first stage
          </button>
          <button
            onClick={onImport}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-[14px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            <Upload className="h-4 w-4" />
            Import file
          </button>
        </div>
      </div>
    </div>
  );
}
