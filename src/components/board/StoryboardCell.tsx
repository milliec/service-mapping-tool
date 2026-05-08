'use client';

import { useState, useCallback, useMemo } from 'react';
import { ImagePlus, Loader2, Pencil, Sparkles, Trash2, Plus } from 'lucide-react';
import { ImageCropModal } from './ImageCropModal';
import { cn } from '@/lib/utils';
import type { StoryboardImage } from '@/lib/types';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface StoryboardCellProps {
  stepId: string;
  /** L3 micro: only offer page/screen adds (no 3:2 slide). */
  microPageOnly?: boolean;
  /** L1/L2: one image per step; L3: multiple allowed. */
  allowMultipleImages?: boolean;
  images: StoryboardImage[];
  isGenerating?: boolean;
  isAnyGenerating?: boolean;
  onAddImage: (stepId: string, dataUrl: string) => void;
  onUpdateImage: (id: string, dataUrl: string) => void;
  onRemoveImage: (id: string) => void;
  onGenerate?: (stepId: string) => void;
}

export function StoryboardCell({
  stepId,
  microPageOnly = false,
  allowMultipleImages = true,
  images,
  isGenerating,
  isAnyGenerating,
  onAddImage,
  onUpdateImage,
  onRemoveImage,
  onGenerate,
}: StoryboardCellProps) {
  const sorted = useMemo(
    () => [...images].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [images],
  );

  const canAddMore = allowMultipleImages || sorted.length === 0;

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [edit, setEdit] = useState<{ id: string; defaultFormat: 'slide' | 'page' } | null>(null);
  const [preview, setPreview] = useState<StoryboardImage | null>(null);

  const handleAddConfirm = useCallback(
    (dataUrl: string) => {
      onAddImage(stepId, dataUrl);
    },
    [stepId, onAddImage],
  );

  const handleEditConfirm = useCallback(
    (dataUrl: string) => {
      if (edit) onUpdateImage(edit.id, dataUrl);
    },
    [edit, onUpdateImage],
  );

  const openAdd = () => {
    setEdit(null);
    setAddModalOpen(true);
  };

  const openEdit = (id: string) => {
    setAddModalOpen(false);
    setEdit({ id, defaultFormat: microPageOnly ? 'page' : 'slide' });
  };

  if (sorted.length === 0) {
    if (isGenerating) {
      return (
        <div className="flex items-center justify-center bg-transparent p-2">
          <div className="flex min-h-24 w-full animate-pulse flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/60 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            <span className="text-[11px] font-medium text-blue-400">Generating…</span>
          </div>
        </div>
      );
    }
    return (
      <>
        <div className="flex flex-col gap-2 bg-transparent p-2">
          {microPageOnly ? (
            <button
              type="button"
              onClick={openAdd}
              className="w-full rounded border-0 bg-transparent py-0.5 text-left text-[11px] font-medium text-neutral-400/90 transition-colors hover:text-neutral-800 hover:underline"
            >
              <span className="inline-flex items-baseline gap-1.5">
                <ImagePlus className="h-3.5 w-3.5 opacity-50" strokeWidth={1.5} />
                Add image / screen
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openAdd}
              className="flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-neutral-200 bg-white/60 p-2 text-center transition-colors hover:border-neutral-300 hover:bg-white"
            >
              <ImagePlus className="h-5 w-5 text-neutral-400" />
              <span className="text-[11px] font-medium text-neutral-600">Add image / screen</span>
            </button>
          )}
        </div>
        <ImageCropModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          onConfirm={handleAddConfirm}
          defaultFormat="page"
          lockFormat="page"
          onGenerateWithAI={onGenerate && !microPageOnly && canAddMore ? () => onGenerate(stepId) : undefined}
          generateWithAIDisabled={isAnyGenerating}
        />
      </>
    );
  }

  const isMicroStrip = microPageOnly && sorted.length > 0;

  return (
    <>
      <div className="flex flex-col gap-2 bg-transparent p-2">
        {isGenerating && (
          <div className="flex min-h-14 w-full flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-blue-200 bg-blue-50/60 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            <span className="text-[10px] font-medium text-blue-500">Generating new image…</span>
          </div>
        )}
        <div
          className={cn(
            isMicroStrip
              ? 'flex w-full min-w-0 flex-wrap content-start items-stretch justify-center gap-2'
              : 'flex flex-col gap-2',
          )}
        >
        {sorted.map((img) => (
          <div
            key={img.id}
            className={cn(
              'group/thumb relative min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
              isMicroStrip ? 'w-32 shrink-0 sm:w-36' : 'w-full',
            )}
          >
            <div
              className={cn(
                'w-full cursor-zoom-in overflow-y-auto overflow-x-hidden bg-neutral-100',
                isMicroStrip
                  ? 'max-h-[min(50vh,420px)]'
                  : 'max-h-[min(75vh,900px)]',
              )}
              onClick={() => setPreview(img)}
              role="button"
              tabIndex={0}
              aria-label="Open full-size image preview"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPreview(img);
                }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.dataUrl}
                alt=""
                className="block w-full max-w-full object-top"
                style={{ height: 'auto' }}
                draggable={false}
              />
            </div>
            <div
              className={cn(
                'pointer-events-none absolute left-0 right-0 top-0 flex justify-center gap-1.5 p-1.5',
                'bg-gradient-to-b from-black/25 to-transparent opacity-0 transition-opacity',
                'group-hover/thumb:opacity-100',
              )}
            >
              <div className="pointer-events-auto flex gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(img.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-neutral-700 shadow-sm transition-colors hover:bg-white"
                  aria-label="Replace image"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {onGenerate && !microPageOnly && allowMultipleImages && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerate(stepId);
                    }}
                    disabled={isAnyGenerating}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-blue-600 shadow-sm transition-colors hover:bg-white disabled:opacity-50"
                    aria-label="Add AI image to this step"
                    title="Generate another with AI"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveImage(img.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-rose-600 shadow-sm transition-colors hover:bg-white"
                  aria-label="Remove image"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {canAddMore &&
          (microPageOnly ? (
            <button
              type="button"
              onClick={openAdd}
              className={cn(
                'border-0 bg-transparent p-0 text-[10px] font-medium text-neutral-400/80 shadow-none transition-colors',
                'hover:text-neutral-800 hover:underline',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/30 focus-visible:ring-offset-1',
                isMicroStrip
                  ? 'mx-auto min-h-0 w-auto shrink-0 basis-full text-center'
                  : 'mt-0.5 w-full text-left',
              )}
            >
              <span className="inline-flex items-center gap-1">
                <Plus className="h-3 w-3 opacity-40" strokeWidth={2} />
                Add image / screen
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openAdd}
              className="mt-0.5 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-200 bg-white py-1.5 text-[10px] font-medium text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700"
            >
              <Plus className="h-3 w-3" />
              Add image / screen
            </button>
          ))}
        </div>
      </div>

      <ImageCropModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onConfirm={handleAddConfirm}
        defaultFormat="page"
        lockFormat="page"
        onGenerateWithAI={onGenerate && !microPageOnly && canAddMore ? () => onGenerate(stepId) : undefined}
        generateWithAIDisabled={isAnyGenerating}
      />
      <ImageCropModal
        key={edit?.id ?? 'e'}
        open={!!edit}
        onOpenChange={(o) => { if (!o) setEdit(null); }}
        onConfirm={handleEditConfirm}
        defaultFormat={edit?.defaultFormat}
        existingImage={edit ? sorted.find((i) => i.id === edit.id)?.dataUrl : undefined}
        lockFormat={microPageOnly ? 'page' : undefined}
      />
      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-[min(1200px,calc(100vw-2rem))]">
          <DialogTitle className="sr-only">Image preview</DialogTitle>
          <div className="max-h-[calc(100vh-2rem)] overflow-auto bg-neutral-950 p-3">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.dataUrl}
                alt=""
                className="mx-auto block h-auto max-w-full rounded bg-white"
                draggable={false}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
