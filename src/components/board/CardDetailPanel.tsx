'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Link2,
  FileText,
  ChevronRight,
  Plus,
  Trash2,
  ExternalLink,
  Target,
} from 'lucide-react';
import { useBlueprintStore } from '@/store/blueprint-store';
import {
  type ApiContract,
  type ArtifactStatus,
  type Card,
  type CardLink,
  type Evidence,
  type EvidenceStrength,
  type EvidenceType,
  type LinkRelation,
  type Opportunity,
  type Requirement,
  type UiScaffold,
} from '@/lib/types';
import { getLaneTitle } from '@/lib/lane-definitions';
import { getCardColorTokens } from './LaneLabel';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import {
  getEvidenceCodesFromText,
  getTraceabilityCodesFromText,
  stripTraceabilityForDisplay,
} from '@/lib/traceability/display';

const RELATION_LABELS: Record<LinkRelation, string> = {
  causes: 'Causes',
  informs: 'Informs',
  addresses: 'Addresses',
  depends_on: 'Depends on',
  implements: 'Implements',
  generates: 'Generates',
  requires: 'Requires',
  relates_to: 'Relates to',
  next_step: 'Next step',
};

/** Relations the user can manually create — next_step is system-only (import mapping). */
const USER_VISIBLE_RELATIONS: LinkRelation[] = [
  'causes', 'informs', 'addresses', 'depends_on',
  'implements', 'generates', 'requires', 'relates_to',
];

const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  research: 'Research',
  data: 'Data',
  policy: 'Policy',
  assumption: 'Assumption',
  note: 'Note',
};

const STRENGTH_LABELS: Record<EvidenceStrength, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  weak: 'Weak',
};

const STRENGTH_COLORS: Record<EvidenceStrength, string> = {
  strong: 'bg-emerald-100 text-emerald-700',
  moderate: 'bg-amber-100 text-amber-700',
  weak: 'bg-neutral-100 text-neutral-500',
};

const STATUS_COLORS: Record<Opportunity['status'], string> = {
  open:        'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved:    'bg-emerald-100 text-emerald-700',
  wont_fix:    'bg-neutral-100 text-neutral-500',
};

const STATUS_LABELS: Record<Opportunity['status'], string> = {
  open:        'Open',
  in_progress: 'In progress',
  resolved:    'Resolved',
  wont_fix:    "Won't fix",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CardBreadcrumb({ card }: { card: Card }) {
  const stages = useBlueprintStore((s) => s.stages);
  const steps = useBlueprintStore((s) => s.steps);
  const stage = stages.find((s) => s.id === card.stageId);
  const step = steps.find((s) => s.id === card.stepId);
  const laneTitle = getLaneTitle(card.laneKey);
  const laneToken = getCardColorTokens(card.laneKey, card.tags);
  
  // Only show step if it's different from stage (i.e., in L2-Micro mode)
  const showStep = step && stage && step.title !== stage.title;

  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
      {stage && <span>{stage.title}</span>}
      {stage && showStep && <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0" />}
      {showStep && <span>{step.title}</span>}
      {laneTitle && (
        <>
          <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0" />
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 font-medium',
              laneToken?.bg ?? 'bg-neutral-100',
              laneToken?.text ?? 'text-neutral-600',
            )}
          >
            {laneTitle}
          </span>
        </>
      )}
    </div>
  );
}

function LinkedCardRow({ link, currentCardId }: { link: CardLink; currentCardId: string }) {
  const cards = useBlueprintStore((s) => s.cards);
  const selectCard = useBlueprintStore((s) => s.selectCard);
  const deleteCardLink = useBlueprintStore((s) => s.deleteCardLink);

  const isSource = link.sourceCardId === currentCardId;
  const otherId = isSource ? link.targetCardId : link.sourceCardId;
  const other = cards.find((c) => c.id === otherId);
  if (!other) return null;

  const laneToken = getCardColorTokens(other.laneKey, other.tags);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-neutral-400">
          {RELATION_LABELS[link.relation]}
        </p>
        <button
          onClick={() => selectCard(other.id)}
          className="text-left text-[13px] font-medium text-neutral-800 hover:text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label={`Open card: ${other.title}`}
        >
          {other.title}
        </button>
        <p
          className={cn(
            'mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            laneToken?.bg ?? 'bg-neutral-100',
            laneToken?.text ?? 'text-neutral-500',
          )}
        >
          {getLaneTitle(other.laneKey)}
        </p>
      </div>
      <button
        onClick={() => deleteCardLink(link.id)}
        className="shrink-0 rounded p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        aria-label="Remove link"
      >
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Inbound link row — read-only, shows who links TO this card */
function InboundCardRow({ link, currentCardId }: { link: CardLink; currentCardId: string }) {
  const cards = useBlueprintStore((s) => s.cards);
  const selectCard = useBlueprintStore((s) => s.selectCard);

  const sourceId = link.sourceCardId;
  const source = cards.find((c) => c.id === sourceId);
  if (!source || sourceId === currentCardId) return null;

  const laneToken = getCardColorTokens(source.laneKey, source.tags);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-neutral-400">
          ← {RELATION_LABELS[link.relation]}
        </p>
        <button
          onClick={() => selectCard(source.id)}
          className="text-left text-[13px] font-medium text-neutral-800 hover:text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label={`Open card: ${source.title}`}
        >
          {source.title}
        </button>
        <p
          className={cn(
            'mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            laneToken?.bg ?? 'bg-neutral-100',
            laneToken?.text ?? 'text-neutral-500',
          )}
        >
          {getLaneTitle(source.laneKey)}
        </p>
      </div>
    </div>
  );
}

/** Row showing an Opportunity that references this card via sourceCardIds */
function LinkedOpportunityRow({
  opportunity,
  onOpenPanel,
}: {
  opportunity: Opportunity;
  onOpenPanel: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
      <Target aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
      <div className="min-w-0 flex-1">
        <button
          onClick={onOpenPanel}
          className="text-left text-[13px] font-medium text-neutral-800 hover:text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label={`View opportunity: ${opportunity.title}`}
        >
          {opportunity.title}
        </button>
        <span
          className={cn(
            'ml-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            STATUS_COLORS[opportunity.status],
          )}
        >
          {STATUS_LABELS[opportunity.status]}
        </span>
      </div>
    </div>
  );
}

function EvidenceRow({ ev }: { ev: Evidence }) {
  const deleteEvidence = useBlueprintStore((s) => s.deleteEvidence);

  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {ev.traceabilityCode && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-600">
                {ev.traceabilityCode}
              </span>
            )}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                STRENGTH_COLORS[ev.strength],
              )}
            >
              {STRENGTH_LABELS[ev.strength]}
            </span>
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
              {EVIDENCE_TYPE_LABELS[ev.evidenceType]}
            </span>
          </div>
          {ev.quote && (
            <p className="mt-1.5 text-[12px] italic leading-snug text-neutral-600">
              &ldquo;{ev.quote}&rdquo;
            </p>
          )}
          {ev.source && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-neutral-400">
              <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
              {ev.source}
            </p>
          )}
        </div>
        <button
          onClick={() => deleteEvidence(ev.id)}
          className="shrink-0 rounded p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          aria-label="Delete evidence"
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function AddLinkForm({ card, onDone }: { card: Card; onDone: () => void }) {
  const cards = useBlueprintStore((s) => s.cards);
  const addCardLink = useBlueprintStore((s) => s.addCardLink);
  const cardLinks = useBlueprintStore((s) => s.cardLinks);

  const [targetId, setTargetId] = useState('');
  const [relation, setRelation] = useState<LinkRelation>('relates_to');

  const alreadyLinkedIds = new Set(
    cardLinks
      .filter((l) => l.sourceCardId === card.id || l.targetCardId === card.id)
      .flatMap((l) => [l.sourceCardId, l.targetCardId]),
  );

  const candidates = cards.filter((c) => c.id !== card.id && !alreadyLinkedIds.has(c.id));

  const handleAdd = () => {
    if (!targetId) return;
    addCardLink(card.id, targetId, relation);
    onDone();
  };

  return (
    <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <option value="">Select a card…</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {getLaneTitle(c.laneKey)}: {c.title}
          </option>
        ))}
      </select>
      <select
        value={relation}
        onChange={(e) => setRelation(e.target.value as LinkRelation)}
        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        {USER_VISIBLE_RELATIONS.map((r) => (
          <option key={r} value={r}>
            {RELATION_LABELS[r]}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={!targetId}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40 hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Add link
        </button>
        <button
          onClick={onDone}
          className="rounded-md px-3 py-1.5 text-[12px] text-neutral-500 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddEvidenceForm({ card, onDone }: { card: Card; onDone: () => void }) {
  const addEvidence = useBlueprintStore((s) => s.addEvidence);
  const [quote, setQuote] = useState('');
  const [source, setSource] = useState('');
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('note');
  const [strength, setStrength] = useState<EvidenceStrength>('moderate');

  const handleAdd = () => {
    addEvidence(card.id, quote.trim(), source.trim(), evidenceType, strength);
    onDone();
  };

  return (
    <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
      <textarea
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
        placeholder="Quote or summary (optional)"
        rows={2}
        className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      />
      <input
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Source (optional)"
        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      />
      <div className="flex gap-2">
        <select
          value={evidenceType}
          onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
          className="flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {(Object.keys(EVIDENCE_TYPE_LABELS) as EvidenceType[]).map((t) => (
            <option key={t} value={t}>
              {EVIDENCE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={strength}
          onChange={(e) => setStrength(e.target.value as EvidenceStrength)}
          className="flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {(Object.keys(STRENGTH_LABELS) as EvidenceStrength[]).map((s) => (
            <option key={s} value={s}>
              {STRENGTH_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Add evidence
        </button>
        <button
          onClick={onDone}
          className="rounded-md px-3 py-1.5 text-[12px] text-neutral-500 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Downstream artifact display
// ---------------------------------------------------------------------------

const ARTIFACT_STATUS_COLORS: Record<ArtifactStatus, string> = {
  draft:      'bg-neutral-100 text-neutral-500',
  reviewed:   'bg-amber-100 text-amber-700',
  approved:   'bg-emerald-100 text-emerald-700',
  deprecated: 'bg-red-100 text-red-400',
};

const ARTIFACT_STATUS_LABELS: Record<ArtifactStatus, string> = {
  draft:      'Draft',
  reviewed:   'Reviewed',
  approved:   'Approved',
  deprecated: 'Deprecated',
};

const ARTIFACT_PREFIX_COLORS: Record<string, string> = {
  REQ: 'bg-violet-100 text-violet-700',
  API: 'bg-sky-100 text-sky-700',
  UI:  'bg-teal-100 text-teal-700',
};

function DownstreamArtifactRow({
  artifact,
}: {
  artifact: Pick<Requirement | ApiContract | UiScaffold, 'traceabilityCode' | 'title' | 'status'>;
}) {
  const prefix = artifact.traceabilityCode.split('-')[0];
  const prefixColor = ARTIFACT_PREFIX_COLORS[prefix] ?? 'bg-neutral-100 text-neutral-600';

  return (
    <div className="flex items-start gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
      <span
        className={cn('mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold', prefixColor)}
      >
        {artifact.traceabilityCode}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-neutral-800">{artifact.title}</p>
        <span
          className={cn(
            'mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            ARTIFACT_STATUS_COLORS[artifact.status],
          )}
        >
          {ARTIFACT_STATUS_LABELS[artifact.status]}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function CardDetailPanel() {
  const selectedCardId = useBlueprintStore((s) => s.selectedCardId);
  const selectCard = useBlueprintStore((s) => s.selectCard);
  const cards = useBlueprintStore((s) => s.cards);
  const cardLinks = useBlueprintStore((s) => s.cardLinks);
  const evidence = useBlueprintStore((s) => s.evidence);
  const opportunities = useBlueprintStore((s) => s.opportunities);
  const updateCard = useBlueprintStore((s) => s.updateCard);
  const readOnly = useBlueprintStore((s) => s.readOnly);

  const requirements = useBlueprintStore((s) => s.requirements);
  const apiContracts = useBlueprintStore((s) => s.apiContracts);
  const uiScaffolds = useBlueprintStore((s) => s.uiScaffolds);

  const [showAddLink, setShowAddLink] = useState(false);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [downstreamOpen, setDownstreamOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, !!selectedCardId);

  const card = selectedCardId ? cards.find((c) => c.id === selectedCardId) ?? null : null;
  const displayTitle = card ? stripTraceabilityForDisplay(card.title) : '';
  const displayBody = card ? stripTraceabilityForDisplay(card.body) : '';
  const textTraceabilityCodes = card
    ? getTraceabilityCodesFromText(`${card.title} ${card.body}`)
      .filter((code) => code !== card.traceabilityCode)
    : [];
  const evidenceCodes = card
    ? getEvidenceCodesFromText(`${card.title} ${card.body}`)
    : [];
  const referenceCodes = textTraceabilityCodes.filter((code) => !evidenceCodes.includes(code));

  // Outbound links: this card → other cards
  const outboundLinks = cardLinks.filter((l) => l.sourceCardId === card?.id);
  // Inbound links: other cards → this card (impact)
  const inboundLinks = cardLinks.filter((l) => l.targetCardId === card?.id);
  const cardEvidence = evidence.filter((e) => e.cardId === card?.id);

  // Opportunities that reference this card via sourceCardIds
  const linkedOpportunities = card
    ? opportunities.filter((o) => o.sourceCardIds.includes(card.id))
    : [];

  // Downstream artifacts derived from this card
  const linkedRequirements = card ? requirements.filter((r) => r.sourceCardIds.includes(card.id)) : [];
  const linkedApiContracts = card ? apiContracts.filter((a) => a.sourceCardIds.includes(card.id)) : [];
  const linkedUiScaffolds = card ? uiScaffolds.filter((u) => u.sourceCardIds.includes(card.id)) : [];
  const hasDownstream = linkedRequirements.length > 0 || linkedApiContracts.length > 0 || linkedUiScaffolds.length > 0;

  const handleClose = useCallback(() => {
    selectCard(null);
    setShowAddLink(false);
    setShowAddEvidence(false);
    setEditingTitle(false);
    setEditingNotes(false);
  }, [selectCard]);

  const saveTitle = useCallback(() => {
    if (!card) return;
    const t = titleValue.trim();
    if (!t) {
      setTitleValue(card.title);
      setEditingTitle(false);
      return;
    }
    if (t !== card.title) {
      updateCard(card.id, { title: t });
    }
    setEditingTitle(false);
  }, [card, titleValue, updateCard]);

  // Close on Escape (cancel inline edits first, then close panel)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !selectedCardId) return;
      if (editingTitle && card) {
        e.preventDefault();
        setTitleValue(card.title);
        setEditingTitle(false);
        return;
      }
      if (editingNotes && card) {
        e.preventDefault();
        setNotesValue(card.notes ?? '');
        setEditingNotes(false);
        return;
      }
      handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedCardId, handleClose, editingTitle, editingNotes, card]);

  // Reset sub-forms when card changes
  useEffect(() => {
    setShowAddLink(false);
    setShowAddEvidence(false);
    setEditingTitle(false);
    setEditingNotes(false);
  }, [selectedCardId]);

  // Sync title / notes local state when card changes
  useEffect(() => {
    if (card) {
      setTitleValue(card.title);
      setNotesValue(card.notes ?? '');
    }
  }, [card]);

  const saveNotes = useCallback(() => {
    if (card) updateCard(card.id, { notes: notesValue.trim() });
    setEditingNotes(false);
  }, [card, notesValue, updateCard]);

  if (!card) return null;

  return (
    <div
      ref={panelRef}
      data-no-pan
      data-no-select
      className="pointer-events-auto absolute inset-y-0 right-0 z-40 flex w-[380px] flex-col border-l border-neutral-200 bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.06)]"
    >
      {/* Header — close is absolute so title row matches Notes content width (full px-5 gutter) */}
      <div className="relative shrink-0 border-b border-neutral-100 px-5 py-4">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-5 top-4 z-10 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label="Close panel"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <CardBreadcrumb card={card} />
          <SectionHeader
            label="Description"
            action={
              editingTitle
                ? undefined
                : { label: 'Edit', onClick: () => setEditingTitle(true) }
            }
            className="mt-3"
          />
          {editingTitle ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                rows={8}
                placeholder="Card title"
                aria-label="Card title"
                className="field-sizing-content min-h-32 w-full resize-y rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[15px] font-semibold leading-snug text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveTitle}
                  disabled={!titleValue.trim()}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitleValue(card.title);
                    setEditingTitle(false);
                  }}
                  className="rounded-md px-3 py-1.5 text-[12px] text-neutral-500 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <h2 className="text-[15px] font-semibold leading-snug text-neutral-900">
              {displayTitle || card.title}
            </h2>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-6">

          {/* Body */}
          {displayBody && (
            <section>
              <p className="text-[13px] leading-relaxed text-neutral-600">{displayBody}</p>
            </section>
          )}

          {/* Tags */}
          {card.tags.length > 0 && (
            <section>
              <div className="flex flex-wrap gap-1.5">
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Comments */}
          <section>
            <SectionHeader
              label="Comments"
              action={editingNotes ? undefined : { label: 'Edit', onClick: () => setEditingNotes(true) }}
            />
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={4}
                  placeholder="Add notes…"
                  className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] leading-relaxed text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveNotes}
                    className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setNotesValue(card.notes ?? ''); setEditingNotes(false); }}
                    className="rounded-md px-3 py-1.5 text-[12px] text-neutral-500 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[13px] leading-relaxed text-neutral-500">
                {card.notes || <span className="italic text-neutral-300">No notes yet</span>}
              </p>
            )}
          </section>

          {/* Traceability */}
          {(card.traceabilityCode
            || referenceCodes.length > 0
            || evidenceCodes.length > 0
            || card.sourceRef
            || (card.derivedFromIds && card.derivedFromIds.length > 0)) && (
            <section>
              <SectionHeader label="Traceability" />
              <dl className="space-y-1 text-[12px]">
                {card.traceabilityCode && (
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-neutral-500">Code</dt>
                    <dd className="font-mono font-semibold text-neutral-800">{card.traceabilityCode}</dd>
                  </div>
                )}
                {referenceCodes.length > 0 && (
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-neutral-500">Refs</dt>
                    <dd className="flex flex-wrap gap-1">
                      {referenceCodes.map((code) => (
                        <span key={code} className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">
                          {code}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {evidenceCodes.length > 0 && (
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-neutral-500">Evidence</dt>
                    <dd className="flex flex-wrap gap-1">
                      {evidenceCodes.map((code) => (
                        <span key={code} className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">
                          {code}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {card.derivedFromIds && card.derivedFromIds.length > 0 && (
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-neutral-500">Derived from</dt>
                    <dd className="flex flex-wrap gap-1">
                      {card.derivedFromIds.map((code) => (
                        <span key={code} className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">
                          {code}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {cardEvidence.length > 0 && (
            <section>
              <SectionHeader label="Evidence" />
              <div className="space-y-2">
                {cardEvidence.map((ev) => (
                  <EvidenceRow key={ev.id} ev={ev} />
                ))}
              </div>
            </section>
          )}

          {/* Linked opportunities — opportunities that reference this card */}
          {linkedOpportunities.length > 0 && (
            <section>
              <SectionHeader
                label="Opportunities"
              />
              <div className="space-y-2">
                {linkedOpportunities.map((opp) => (
                  <LinkedOpportunityRow
                    key={opp.id}
                    opportunity={opp}
                    onOpenPanel={() => {}}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Downstream artifacts — REQ / API / UI derived from this card */}
          {hasDownstream && (
            <section>
              <SectionHeader
                label={`Downstream · REQ ${linkedRequirements.length} / API ${linkedApiContracts.length} / UI ${linkedUiScaffolds.length}`}
                action={{ label: downstreamOpen ? 'Collapse' : 'Expand', onClick: () => setDownstreamOpen((v) => !v) }}
              />
              {downstreamOpen && (
                <div className="space-y-2">
                  {linkedRequirements.map((r) => (
                    <DownstreamArtifactRow key={r.id} artifact={r} />
                  ))}
                  {linkedApiContracts.map((a) => (
                    <DownstreamArtifactRow key={a.id} artifact={a} />
                  ))}
                  {linkedUiScaffolds.map((u) => (
                    <DownstreamArtifactRow key={u.id} artifact={u} />
                  ))}
                </div>
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  label,
  action,
  className,
}: {
  label: string;
  action?: { label: string; icon?: React.ReactNode; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={cn('mb-2 flex items-center justify-between', className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</h3>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-1 rounded text-[11px] font-medium text-neutral-400 transition-colors hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {action.icon ?? <Plus aria-hidden="true" className="h-3 w-3" />}
          {action.label}
        </button>
      )}
    </div>
  );
}
