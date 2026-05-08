'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRODUCT_TEAM_OPTIONS, isThirdPartyProductTeam } from './product-team-options';

interface ProductTeamComboboxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Defaults to product-team suggestions. */
  options?: readonly string[];
  placeholder?: string;
  helperText?: string;
  addNewLabel?: string;
  noMatchingLabel?: string;
  className?: string;
}

export function ProductTeamCombobox({
  label,
  value,
  onChange,
  options,
  placeholder = 'Search or add a team',
  helperText,
  addNewLabel = 'Add new team',
  noMatchingLabel = 'No matching teams',
  className,
}: ProductTeamComboboxProps) {
  const sourceOptions = options ?? PRODUCT_TEAM_OPTIONS;
  const thirdPartyAccent = isThirdPartyProductTeam(value);
  const inputId = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [...sourceOptions];
    return sourceOptions.filter((option) => option.toLowerCase().includes(normalizedQuery));
  }, [query, sourceOptions]);

  const exactMatch = sourceOptions.find((option) => option.toLowerCase() === query.trim().toLowerCase()) ?? null;
  const canCreate = query.trim().length > 0 && !exactMatch;

  const commitValue = (nextValue: string) => {
    const trimmed = nextValue.trim();
    setQuery(trimmed);
    onChange(trimmed);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('space-y-2', className)}>
      <label htmlFor={inputId} className="block text-[12px] font-semibold text-neutral-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => onChange(query.trim())}
          placeholder={placeholder}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 pr-12 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? 'Hide suggestions' : 'Show suggestions'}
          className="absolute inset-y-0 right-3 inline-flex w-5 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600 focus:outline-none focus-visible:text-neutral-700"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 max-h-64 overflow-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
            {canCreate && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commitValue(query)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                <Plus className="h-3.5 w-3.5 text-neutral-400" />
                <span>{addNewLabel}</span>
                <span className="truncate text-neutral-400">&ldquo;{query.trim()}&rdquo;</span>
              </button>
            )}
            {filteredOptions.map((option) => {
              const isSelected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commitValue(option)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  <Check
                    className={cn(
                      'h-3.5 w-3.5',
                      isSelected
                        ? thirdPartyAccent
                          ? 'text-neutral-600'
                          : 'text-[#008938]'
                        : 'text-transparent',
                    )}
                  />
                  <span className="truncate">{option}</span>
                </button>
              );
            })}
            {!canCreate && filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-[13px] text-neutral-400">
                {noMatchingLabel}
              </div>
            )}
          </div>
        )}
      </div>
      {helperText && (
        <p className="text-[12px] leading-relaxed text-neutral-500">{helperText}</p>
      )}
    </div>
  );
}
