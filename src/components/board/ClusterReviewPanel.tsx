'use client';

/**
 * ClusterReviewPanel
 *
 * A right-side slide-in panel where users review, edit, accept, or reject
 * proposed opportunity clusters before they are committed as Opportunity records.
 *
 * Extension points:
 * - Add confidence threshold filter to hide low-confidence clusters
 * - Add "merge clusters" action to combine two proposed clusters
 * - Replace mock service with OpenAIClusteringService by swapping the provider
 */

import { useState, useCallback, useRef } from 'react';
import {
  X,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import { useBlueprintStore } from '@/store/blueprint-store';
import { cn } from '@/lib/utils';
import type { ReviewableCluster } from '@/lib/clustering/types';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : pct >= 45
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-neutral-100 text-neutral-500 border-neutral-200';
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', color)}>
      {pct}% confidence
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single cluster card
// ---------------------------------------------------------------------------

interface ClusterCardProps {
  cluster: ReviewableCluster;
  stages: Array<{ id: string; title: string }>;
  cards: Array<{ id: string; title: string; body: string }>;
  onUpdate: (patch: Partial<Pick<ReviewableCluster, 'editedTitle' | 'editedSummary' | 'includedCardIds' | 'reviewStatus'>>) => void;
}

function ClusterCard({ cluster, stages, cards, onUpdate }: ClusterCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [titleDraft, setTitleDraft] = useState(cluster.editedTitle);
  const [summaryDraft, setSummaryDraft] = useState(cluster.editedSummary);

  const isRejected = cluster.reviewStatus === 'rejected';
  const isAccepted = cluster.reviewStatus === 'accepted';

  const saveTitle = useCallback(() => {
    const trimmed = titleDraft.trim();
    if (trimmed) onUpdate({ editedTitle: trimmed });
    else setTitleDraft(cluster.editedTitle);
    setEditingTitle(false);
  }, [titleDraft, cluster.editedTitle, onUpdate]);

  const saveSummary = useCallback(() => {
    onUpdate({ editedSummary: summaryDraft.trim() || cluster.editedSummary });
    setEditingBody(false);
  }, [summaryDraft, cluster.editedSummary, onUpdate]);

  const removeCard = useCallback(
    (cardId: string) => {
      onUpdate({ includedCardIds: cluster.includedCardIds.filter((id) => id !== cardId) });
    },
    [cluster.includedCardIds, onUpdate],
  );

  const includedCards = cluster.includedCardIds
    .map((id) => cards.find((c) => c.id === id))
    .filter(Boolean) as Array<{ id: string; title: string; body: string }>;

  const affectedStageNames = cluster.affectedStages
    .map((id) => stages.find((s) => s.id === id)?.title ?? id)
    .join(', ');

  return (
    <article
      aria-label={`Cluster: ${cluster.editedTitle}`}
      className={cn(
        'rounded-xl border bg-white transition-opacity',
        isRejected ? 'border-neutral-200 opacity-50' : 'border-neutral-200',
        isAccepted && 'border-emerald-300 bg-emerald-50/30',
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2 p-4 pb-3">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') { setTitleDraft(cluster.editedTitle); setEditingTitle(false); }
              }}
              className="w-full rounded border border-blue-300 bg-white px-2 py-1 text-sm font-semibold text-neutral-800 outline-none focus:ring-1 focus:ring-blue-400"
              aria-label="Edit cluster title"
            />
          ) : (
            <button
              onClick={() => !isRejected && !isAccepted && setEditingTitle(true)}
              className={cn(
                'text-left text-sm font-semibold leading-snug text-neutral-800',
                !isRejected && !isAccepted && 'cursor-text hover:text-blue-700 hover:underline',
              )}
              aria-label={`Cluster title: ${cluster.editedTitle}. Click to edit.`}
              disabled={isRejected || isAccepted}
            >
              {cluster.editedTitle}
            </button>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ConfidenceBadge value={cluster.confidence} />
            {affectedStageNames && (
              <span className="text-[10px] text-neutral-500">{affectedStageNames}</span>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse cluster' : 'Expand cluster'}
          aria-expanded={expanded}
          className="shrink-0 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {expanded ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Summary */}
          {editingBody ? (
            <textarea
              autoFocus
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              onBlur={saveSummary}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setSummaryDraft(cluster.editedSummary); setEditingBody(false); }
              }}
              rows={3}
              className="w-full resize-none rounded border border-blue-300 bg-white px-2 py-1.5 text-[13px] leading-relaxed text-neutral-600 outline-none focus:ring-1 focus:ring-blue-400"
              aria-label="Edit cluster summary"
            />
          ) : (
            <button
              onClick={() => !isRejected && !isAccepted && setEditingBody(true)}
              className={cn(
                'w-full text-left text-[13px] leading-relaxed text-neutral-600',
                !isRejected && !isAccepted && 'cursor-text hover:text-neutral-800',
              )}
              aria-label="Cluster summary. Click to edit."
              disabled={isRejected || isAccepted}
            >
              {cluster.editedSummary}
            </button>
          )}

          {/* Pain point list */}
          {includedCards.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Insights ({includedCards.length})
              </p>
              <ul className="space-y-1" role="list">
                {includedCards.map((card) => (
                  <li
                    key={card.id}
                    className="flex items-start gap-2 rounded-lg bg-neutral-50 px-2.5 py-2"
                  >
                    <span className="mt-0.5 flex-1 min-w-0 text-[12px] leading-snug text-neutral-700">
                      {card.title}
                    </span>
                    {!isRejected && !isAccepted && (
                      <button
                        onClick={() => removeCard(card.id)}
                        aria-label={`Remove "${card.title}" from cluster`}
                        className="shrink-0 rounded p-0.5 text-neutral-300 hover:bg-neutral-200 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      >
                        <X aria-hidden="true" className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Accept / Reject actions */}
          {!isAccepted && !isRejected && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => onUpdate({ reviewStatus: 'accepted' })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                aria-label="Accept cluster and convert to opportunity"
              >
                <Check aria-hidden="true" className="h-3.5 w-3.5" /> Accept
              </button>
              <button
                onClick={() => onUpdate({ reviewStatus: 'rejected' })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                aria-label="Reject cluster"
              >
                Reject
              </button>
            </div>
          )}

          {isAccepted && (
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
              <Check aria-hidden="true" className="h-3.5 w-3.5" /> Accepted — opportunity created
            </p>
          )}

          {isRejected && (
            <button
              onClick={() => onUpdate({ reviewStatus: 'pending' })}
              className="text-[12px] text-neutral-400 underline hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label="Undo reject"
            >
              Undo reject
            </button>
          )}
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function ClusterReviewPanel() {
  const clusterReviewOpen = useBlueprintStore((s) => s.clusterReviewOpen);
  const pendingClusters = useBlueprintStore((s) => s.pendingClusters);
  const stages = useBlueprintStore((s) => s.stages);
  const cards = useBlueprintStore((s) => s.cards);
  const closeClusterReview = useBlueprintStore((s) => s.closeClusterReview);
  const updatePendingCluster = useBlueprintStore((s) => s.updatePendingCluster);
  const addOpportunity = useBlueprintStore((s) => s.addOpportunity);
  const opportunities = useBlueprintStore((s) => s.opportunities);
  const clearInsightSelection = useBlueprintStore((s) => s.clearInsightSelection);

  // When a cluster moves to 'accepted', create the Opportunity record.
  // Guard: skip if an opportunity already covers the exact same source card IDs
  // (prevents duplicates when the user generates clusters twice on the same selection).
  const handleUpdate = useCallback(
    (cluster: ReviewableCluster, patch: Partial<ReviewableCluster>) => {
      updatePendingCluster(cluster.clusterId, patch);

      if (patch.reviewStatus === 'accepted') {
        const sourceIds = cluster.includedCardIds;
        const alreadyExists = opportunities.some((o) => {
          if (o.sourceCardIds.length !== sourceIds.length) return false;
          const existing = new Set(o.sourceCardIds);
          return sourceIds.every((id) => existing.has(id));
        });
        if (alreadyExists) return;

        const insightTitles = sourceIds
          .map((id) => cards.find((c) => c.id === id)?.title)
          .filter(Boolean)
          .map((t) => `"${t}"`)
          .join(', ');
        addOpportunity({
          title: cluster.editedTitle,
          statement: cluster.editedSummary,
          rationale: `Synthesised from ${sourceIds.length} insight${sourceIds.length !== 1 ? 's' : ''}: ${insightTitles}.`,
          sourceCardIds: sourceIds,
          affectedStages: cluster.affectedStages,
          affectedSteps: cluster.affectedSteps,
          status: 'open',
        });
      }
    },
    [updatePendingCluster, addOpportunity, opportunities, cards],
  );

  const handleClose = useCallback(() => {
    closeClusterReview();
    clearInsightSelection();
  }, [closeClusterReview, clearInsightSelection]);

  const pendingCount = pendingClusters.filter((c) => c.reviewStatus === 'pending').length;
  const acceptedCount = pendingClusters.filter((c) => c.reviewStatus === 'accepted').length;

  const panelRef = useRef<HTMLElement>(null);
  useFocusTrap(panelRef, clusterReviewOpen);

  if (!clusterReviewOpen) return null;

  return (
    <aside
      ref={panelRef}
      role="complementary"
      aria-label="Cluster review panel"
      className="relative flex h-full w-[380px] shrink-0 flex-col border-l border-neutral-200 bg-white"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
        <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-neutral-800">Review clusters</h2>
          <p className="text-[11px] text-neutral-500">
            {pendingCount > 0
              ? `${pendingCount} cluster${pendingCount !== 1 ? 's' : ''} to review`
              : `${acceptedCount} accepted`}
          </p>
        </div>
        <button
          onClick={handleClose}
          aria-label="Close cluster review panel"
          className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {/* Rule reminder */}
      <div className="flex items-start gap-2 border-b border-neutral-100 bg-blue-50 px-4 py-2.5">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden />
        <p className="text-[11px] leading-relaxed text-blue-700">
          Opportunity titles should describe a <strong>problem area</strong>, not propose a solution.
        </p>
      </div>

      {/* Cluster list */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {pendingClusters.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Lightbulb className="h-8 w-8 text-neutral-200" aria-hidden />
            <p className="text-sm text-neutral-400">No clusters to review.</p>
          </div>
        ) : (
          pendingClusters.map((cluster) => (
            <ClusterCard
              key={cluster.clusterId}
              cluster={cluster}
              stages={stages}
              cards={cards}
              onUpdate={(patch) => handleUpdate(cluster, patch)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {pendingClusters.length > 0 && (
        <div className="border-t border-neutral-200 px-4 py-3">
          <button
            onClick={handleClose}
            className="w-full rounded-lg border border-neutral-200 py-2 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="Done reviewing clusters"
          >
            Done
          </button>
        </div>
      )}
    </aside>
  );
}
