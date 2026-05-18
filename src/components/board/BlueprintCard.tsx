'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Check, Pencil, ChevronUp, ChevronDown, MoreHorizontal, Trash2 } from 'lucide-react';
import { type Card } from '@/lib/types';
import { useBlueprintStore } from '@/store/blueprint-store';
import { cn } from '@/lib/utils';
import { getCardColorTokens } from './LaneLabel';
import { CardTagEditor, getReusableTagSuggestions } from './CardTagEditor';
import { stripRollupsForCardDisplay, stripTraceabilityForDisplay } from '@/lib/traceability/display';

interface BlueprintCardProps {
  card: Card;
  isDragOverlay?: boolean;
}

export function BlueprintCard({ card, isDragOverlay }: BlueprintCardProps) {
  const updateCard = useBlueprintStore((s) => s.updateCard);
  const deleteCard = useBlueprintStore((s) => s.deleteCard);
  const reorderCard = useBlueprintStore((s) => s.reorderCard);
  const cards = useBlueprintStore((s) => s.cards);
  const steps = useBlueprintStore((s) => s.steps);
  const moveCard = useBlueprintStore((s) => s.moveCard);
  const selectCard = useBlueprintStore((s) => s.selectCard);
  const selectedCardId = useBlueprintStore((s) => s.selectedCardId);
  const readOnly = useBlueprintStore((s) => s.readOnly);
  const isSelected = selectedCardId === card.id;

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [tags, setTags] = useState(card.tags);
  const [showActions, setShowActions] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: 'card', card },
    disabled: editing || readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  useEffect(() => {
    if (editing && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [editing]);

  const save = useCallback(() => {
    const trimmed = title.trim();
    if (trimmed) {
      updateCard(card.id, { title: trimmed, tags });
    }
    setEditing(false);
  }, [title, card.id, tags, updateCard, setEditing]);

  const cancel = useCallback(() => {
    setTitle(card.title);
    setTags(card.tags);
    setEditing(false);
  }, [card.title, card.tags, setEditing]);

  const availableTags = useMemo(
    () => getReusableTagSuggestions(cards),
    [cards],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        save();
      }
      if (e.key === 'Escape') {
        cancel();
      }
    },
    [save, cancel],
  );

  // Cell siblings for keyboard reorder
  const cellCards = cards
    .filter((c) => c.stepId === card.stepId && c.laneKey === card.laneKey)
    .sort((a, b) => a.order - b.order);
  const cellIdx = cellCards.findIndex((c) => c.id === card.id);
  const canMoveUp = cellIdx > 0;
  const canMoveDown = cellIdx < cellCards.length - 1;

  // Adjacent steps for keyboard move left/right
  const stageSteps = steps
    .filter((s) => s.stageId === card.stageId)
    .sort((a, b) => a.order - b.order);
  const stepIdx = stageSteps.findIndex((s) => s.id === card.stepId);
  const canMoveLeft = stepIdx > 0;
  const canMoveRight = stepIdx < stageSteps.length - 1;

  if (editing) {
    return (
      <div
        data-board-card
        ref={setNodeRef}
        style={style}
        className="rounded-lg border border-blue-200 bg-white p-2.5 shadow-sm ring-1 ring-blue-100"
      >
        <textarea
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Card title"
          className="min-h-[4.5rem] w-full resize-y rounded border-0 bg-transparent p-0 text-sm font-medium leading-snug text-neutral-800 outline-none placeholder:text-neutral-400"
          placeholder="Card title"
          rows={4}
        />
        <CardTagEditor
          value={tags}
          suggestions={availableTags}
          onChange={setTags}
          placeholder="Add or reuse tags"
          className="mt-2"
        />
        <div className="mt-2 flex items-center gap-1.5">
          <button
            onClick={save}
            className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="Save card"
          >
            <Check aria-hidden="true" className="h-3 w-3" /> Save
          </button>
          <button
            onClick={cancel}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="Cancel editing"
          >
            Cancel
          </button>
          <button
            onClick={() => deleteCard(card.id)}
            className="ml-auto inline-flex items-center rounded-md p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label="Delete card"
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const laneToken = getCardColorTokens(card.laneKey, card.tags);
  const displayTitle = stripRollupsForCardDisplay(stripTraceabilityForDisplay(card.title));
  const displayBody = stripRollupsForCardDisplay(stripTraceabilityForDisplay(card.body));

  return (
    <div
      data-board-card
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      onClick={(e) => {
        if (isDragOverlay) return;
        e.stopPropagation();
        selectCard(isSelected ? null : card.id);
      }}
      className={cn(
        'group relative rounded-lg border p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
        laneToken.bg,
        laneToken.border,
        isSelected && 'ring-2 ring-blue-400 ring-offset-1',
        isDragOverlay && 'rotate-1 shadow-lg',
      )}
    >
      <div className="flex items-start gap-1.5">
        {!readOnly && (
          <button
            className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-neutral-300 opacity-0 transition-opacity hover:text-neutral-500 focus:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-neutral-800">{displayTitle}</p>
          {displayBody && (
            <p className="mt-1 text-[13px] leading-snug text-neutral-500">{displayBody}</p>
          )}
          {card.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {card.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {!readOnly && (
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          <button
            onClick={() => setEditing(true)}
            className="rounded p-0.5 text-neutral-300 opacity-0 transition-opacity hover:text-neutral-600 focus:opacity-100 group-hover:opacity-100"
            aria-label="Edit card"
          >
            <Pencil aria-hidden="true" className="h-3 w-3" />
          </button>

          {/* Keyboard accessible move actions */}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="rounded p-0.5 text-neutral-300 opacity-0 transition-opacity hover:text-neutral-600 focus:opacity-100 group-hover:opacity-100"
              aria-label="Card actions"
            >
              <MoreHorizontal aria-hidden="true" className="h-3 w-3" />
            </button>
            {showActions && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 top-full z-40 mt-1 w-36 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
                  {canMoveUp && (
                    <button
                      onClick={() => { reorderCard(card.id, cellIdx - 1); setShowActions(false); }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-neutral-600 hover:bg-neutral-50"
                    >
                      <ChevronUp aria-hidden="true" className="h-3 w-3" /> Move up
                    </button>
                  )}
                  {canMoveDown && (
                    <button
                      onClick={() => { reorderCard(card.id, cellIdx + 1); setShowActions(false); }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-neutral-600 hover:bg-neutral-50"
                    >
                      <ChevronDown aria-hidden="true" className="h-3 w-3" /> Move down
                    </button>
                  )}
                  {canMoveLeft && (
                    <button
                      onClick={() => {
                        const targetStep = stageSteps[stepIdx - 1];
                        moveCard(card.id, targetStep.id, card.laneKey, 0);
                        setShowActions(false);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-neutral-600 hover:bg-neutral-50"
                    >
                      ← Move left
                    </button>
                  )}
                  {canMoveRight && (
                    <button
                      onClick={() => {
                        const targetStep = stageSteps[stepIdx + 1];
                        moveCard(card.id, targetStep.id, card.laneKey, 0);
                        setShowActions(false);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-neutral-600 hover:bg-neutral-50"
                    >
                      → Move right
                    </button>
                  )}
                  <div className="my-1 border-t border-neutral-100" />
                  <button
                    onClick={() => { deleteCard(card.id); setShowActions(false); }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-red-600 hover:bg-red-50"
                  >
                    <Trash2 aria-hidden="true" className="h-3 w-3" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
