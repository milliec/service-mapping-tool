'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { type Card, type LaneKey } from '@/lib/types';
import { useBlueprintStore } from '@/store/blueprint-store';
import { BlueprintCard } from './BlueprintCard';
import { cn } from '@/lib/utils';
import { CardTagEditor, getReusableTagSuggestions } from './CardTagEditor';

interface CellAreaProps {
  stepId: string;
  laneKey: LaneKey;
  cards: Card[];
}

export function CellArea({ stepId, laneKey, cards }: CellAreaProps) {
  const addCard = useBlueprintStore((s) => s.addCard);
  const allCards = useBlueprintStore((s) => s.cards);
  const readOnly = useBlueprintStore((s) => s.readOnly);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const availableTags = useMemo(
    () => getReusableTagSuggestions(allCards),
    [allCards],
  );

  const droppableId = `${stepId}::${laneKey}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: 'cell', stepId, laneKey },
  });

  useEffect(() => {
    if (adding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [adding]);

  const handleSave = () => {
    const trimmed = newTitle.trim();
    if (trimmed) {
      addCard(stepId, laneKey, trimmed, '', newTags);
    }
    setNewTitle('');
    setNewTags([]);
    setAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setNewTitle('');
      setNewTags([]);
      setAdding(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group min-h-[52px] rounded-lg p-1.5 transition-colors',
        isOver && 'bg-blue-50/60 ring-1 ring-blue-200/50',
      )}
    >
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5">
          {cards.map((card) => (
            <BlueprintCard key={card.id} card={card} />
          ))}
        </div>
      </SortableContext>

      {adding && !readOnly ? (
        <div className={cn('mt-1.5 rounded-lg border border-blue-200 bg-white p-2 shadow-sm', cards.length === 0 && 'mt-0')}>
          <textarea
            ref={inputRef}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            aria-label="New card title"
            className="w-full resize-none rounded border-0 bg-transparent p-0 text-[13px] font-medium leading-snug text-neutral-800 outline-none placeholder:text-neutral-400"
            placeholder="Card title…"
            rows={2}
          />
          <CardTagEditor
            value={newTags}
            suggestions={availableTags}
            onChange={setNewTags}
            placeholder="Add or reuse tags"
            className="mt-2"
          />
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSave}
              className="rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Add
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setNewTitle('');
                setNewTags([]);
                setAdding(false);
              }}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : !readOnly ? (
        <button
          onClick={() => setAdding(true)}
          className={cn(
            'flex w-full items-center gap-1 rounded-lg border border-dashed border-transparent px-2 py-1.5 text-[12px] text-neutral-400 opacity-0 transition-[opacity,color,border-color] group-hover:opacity-100 hover:border-neutral-300 hover:text-neutral-500 focus:opacity-100 focus:outline-none focus-visible:border-blue-300 focus-visible:text-blue-500 focus-visible:opacity-100',
            isOver && 'opacity-100',
            cards.length === 0 && 'mt-0',
            cards.length > 0 && 'mt-1',
          )}
          aria-label={`Add card to ${laneKey}`}
        >
          <Plus aria-hidden="true" className="h-3 w-3" />
          <span>Add card</span>
        </button>
      ) : null}
    </div>
  );
}
