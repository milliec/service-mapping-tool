'use client';

/**
 * OpportunitiesPanel
 *
 * A right-side panel listing all Opportunity records for the current blueprint.
 * Allows viewing and basic status editing. Deliberately lightweight — advanced
 * opportunity management (scoring, prioritization, hypotheses) is a future extension.
 *
 * Extension points:
 * - Add opportunity scoring / prioritization
 * - Add AI hypothesis generation per opportunity
 * - Add filtering by status, stage, or owner
 */

import { useState, useCallback, useRef } from 'react';
import { X, Target, ChevronDown, ChevronUp, Trash2, Circle } from 'lucide-react';
import { useBlueprintStore } from '@/store/blueprint-store';
import { type Opportunity, type OpportunityStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: OpportunityStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'wont_fix', label: "Won't fix" },
];

function stripLeadingCode(value: string) {
  return value.replace(/^[A-Z]+-\d+\s+/, '');
}

function statusColor(status: OpportunityStatus) {
  switch (status) {
    case 'open':        return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'in_progress': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'resolved':    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'wont_fix':    return 'bg-neutral-100 text-neutral-500 border-neutral-200';
  }
}

// ---------------------------------------------------------------------------
// Opportunity row
// ---------------------------------------------------------------------------

interface OpportunityRowProps {
  opportunity: Opportunity;
  linkedPainPointCount: number;
  stageNames: string[];
  onUpdate: (patch: Partial<Pick<Opportunity, 'title' | 'statement' | 'owner' | 'status'>>) => void;
  onDelete: () => void;
}

function OpportunityRow({ opportunity, linkedPainPointCount, stageNames, onUpdate, onDelete }: OpportunityRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(opportunity.title);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveTitle = useCallback(() => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== opportunity.title) onUpdate({ title: trimmed });
    else setTitleDraft(opportunity.title);
    setEditingTitle(false);
  }, [titleDraft, opportunity.title, onUpdate]);

  return (
    <article
      aria-label={`Opportunity: ${stripLeadingCode(opportunity.title)}`}
      className="rounded-xl border border-neutral-200 bg-white"
    >
      {/* Row summary */}
      <div className="flex items-start gap-2 p-3.5">
        <Target aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') { setTitleDraft(opportunity.title); setEditingTitle(false); }
              }}
              className="w-full rounded border border-blue-300 bg-white px-2 py-0.5 text-[13px] font-semibold text-neutral-800 outline-none focus:ring-1 focus:ring-blue-400"
              aria-label="Edit opportunity title"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-left text-[13px] font-semibold leading-snug text-neutral-800 hover:text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label={`Opportunity title: ${stripLeadingCode(opportunity.title)}. Click to edit.`}
            >
              {stripLeadingCode(opportunity.title)}
            </button>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {/* Status picker */}
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu((v) => !v)}
                aria-label={`Status: ${opportunity.status}. Click to change.`}
                aria-expanded={showStatusMenu}
                aria-haspopup="listbox"
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                  statusColor(opportunity.status),
                )}
              >
                {STATUS_OPTIONS.find((o) => o.value === opportunity.status)?.label ?? opportunity.status}
              </button>
              {showStatusMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowStatusMenu(false)} />
                  <ul
                    role="listbox"
                    aria-label="Select status"
                    className="absolute left-0 top-full z-40 mt-1 w-36 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <li key={opt.value}>
                        <button
                          role="option"
                          aria-selected={opportunity.status === opt.value}
                          onClick={() => {
                            onUpdate({ status: opt.value });
                            setShowStatusMenu(false);
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-neutral-50',
                            opportunity.status === opt.value && 'font-semibold',
                          )}
                        >
                          <Circle aria-hidden="true" className="h-2 w-2" />
                          {opt.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {linkedPainPointCount > 0 && (
              <span className="text-[10px] text-neutral-500">
                {linkedPainPointCount} pain point{linkedPainPointCount !== 1 ? 's' : ''}
              </span>
            )}
            {stageNames.length > 0 && (
              <span className="text-[10px] text-neutral-500">{stageNames.join(', ')}</span>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse opportunity' : 'Expand opportunity'}
          aria-expanded={expanded}
          className="shrink-0 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {expanded ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-neutral-100 px-3.5 py-3 space-y-2.5">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Statement</p>
            <p className="text-[13px] leading-relaxed text-neutral-600">{opportunity.statement}</p>
          </div>
          {opportunity.rationale && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Rationale</p>
              <p className="text-[13px] leading-relaxed text-neutral-500">{opportunity.rationale}</p>
            </div>
          )}
          {opportunity.owner && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Owner</p>
              <p className="text-[13px] text-neutral-600">{opportunity.owner}</p>
            </div>
          )}

          {/* Delete */}
          <div className="pt-1">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-neutral-500">Delete this opportunity?</span>
                <button
                  onClick={onDelete}
                  className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  aria-label="Confirm delete opportunity"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  aria-label="Cancel delete"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 text-[12px] text-neutral-400 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                aria-label="Delete opportunity"
              >
                <Trash2 aria-hidden="true" className="h-3 w-3" /> Delete
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function OpportunitiesPanel() {
  const opportunitiesPanelOpen = useBlueprintStore((s) => s.opportunitiesPanelOpen);
  const setOpportunitiesPanelOpen = useBlueprintStore((s) => s.setOpportunitiesPanelOpen);
  const opportunities = useBlueprintStore((s) => s.opportunities);
  const stages = useBlueprintStore((s) => s.stages);
  const cards = useBlueprintStore((s) => s.cards);
  const updateOpportunity = useBlueprintStore((s) => s.updateOpportunity);
  const deleteOpportunity = useBlueprintStore((s) => s.deleteOpportunity);

  const panelRef = useRef<HTMLElement>(null);
  useFocusTrap(panelRef, opportunitiesPanelOpen);

  if (!opportunitiesPanelOpen) return null;

  const openCount = opportunities.filter((o) => o.status === 'open').length;

  return (
    <aside
      ref={panelRef}
      role="complementary"
      aria-label="Opportunities panel"
      className="relative flex h-full w-[380px] shrink-0 flex-col border-l border-neutral-200 bg-white"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
        <Target aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-500" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-neutral-800">Opportunities</h2>
          <p className="text-[11px] text-neutral-500">
            {opportunities.length === 0
              ? 'No opportunities yet'
              : `${opportunities.length} total · ${openCount} open`}
          </p>
        </div>
        <button
          onClick={() => setOpportunitiesPanelOpen(false)}
          aria-label="Close opportunities panel"
          className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {opportunities.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Target aria-hidden="true" className="h-8 w-8 text-neutral-200" />
            <div>
              <p className="text-sm font-medium text-neutral-400">No opportunities yet</p>
              <p className="mt-1 text-[12px] text-neutral-300">
                Select pain point cards on the board and run&nbsp;
                <span className="font-medium">Generate opportunity clusters</span>.
              </p>
            </div>
          </div>
        ) : (
          opportunities.map((opp) => {
            const stageNames = opp.affectedStages
              .map((id) => stages.find((s) => s.id === id)?.title)
              .filter(Boolean) as string[];
            return (
              <OpportunityRow
                key={opp.id}
                opportunity={opp}
                linkedPainPointCount={opp.sourceCardIds.filter((id) =>
                  cards.some((c) => c.id === id),
                ).length}
                stageNames={stageNames}
                onUpdate={(patch) => updateOpportunity(opp.id, patch)}
                onDelete={() => deleteOpportunity(opp.id)}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}
