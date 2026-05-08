'use client';

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardTagEditorProps {
  value: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

function normalizeTag(tag: string) {
  return tag.trim().replace(/\s+/g, ' ');
}

export function getReusableTagSuggestions(
  cards: Array<{
    tags: string[];
    sourceFile: string;
    sourceSheet: string;
    sourceRow: number | null;
    sourceRef: string;
  }>,
) {
  return Array.from(
    new Set(
      cards
        .filter(
          (card) =>
            card.sourceFile === '' &&
            card.sourceSheet === '' &&
            card.sourceRow === null &&
            card.sourceRef === '',
        )
        .flatMap((card) => card.tags),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function CardTagEditor({
  value,
  suggestions,
  onChange,
  placeholder = 'Add a tag',
  className,
}: CardTagEditorProps) {
  const [draft, setDraft] = useState('');

  const filteredSuggestions = useMemo(() => {
    const query = draft.trim().toLowerCase();
    return suggestions
      .filter((tag) => !value.includes(tag))
      .filter((tag) => (query ? tag.toLowerCase().includes(query) : true))
      .slice(0, 6);
  }, [draft, suggestions, value]);

  const addTag = (rawTag: string) => {
    const nextTag = normalizeTag(rawTag);
    if (!nextTag || value.includes(nextTag)) {
      setDraft('');
      return;
    }
    onChange([...value, nextTag]);
    setDraft('');
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(draft);
    }

    if (event.key === 'Backspace' && draft.length === 0 && value.length > 0) {
      event.preventDefault();
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200 bg-white/80 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-600"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full text-neutral-400 transition-colors hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <div className="flex min-w-[120px] flex-1 items-center gap-1 text-neutral-400">
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-neutral-700 outline-none placeholder:text-neutral-400"
            placeholder={placeholder}
            aria-label="Add tag"
          />
        </div>
      </div>

      {filteredSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filteredSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
