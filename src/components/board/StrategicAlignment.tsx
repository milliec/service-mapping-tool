'use client';

import { useEffect, useMemo, useRef } from 'react';
import { X, Layers, Target, GitBranch, Sparkles, Lightbulb, Wrench, FlaskConical, Check } from 'lucide-react';
import { useBlueprintStore } from '@/store/blueprint-store';
import type { Assumption, BlueprintState, Card, JourneySpan, Opportunity, Solution, Stage } from '@/lib/types';
import { stripTraceabilityForDisplay } from '@/lib/traceability/display';

// Walk upward to the lifecycle (L1) root so the tree always starts from the top,
// even if the user is currently drilled into an L2 or L3 blueprint.
function getLifecycleRoot(state: BlueprintState): BlueprintState {
  let current = state;
  while (current.rootDocument) {
    current = current.rootDocument;
  }
  return current;
}

// Navigation target: identify where a clicked node lives in the L1→L2→L3 tree.
// Omit fields higher than the target level. For example, to navigate to an L3
// card, pass { l2SpanId, l3SpanId, cardId }. For an L1 card, just { cardId }.
export type StrategicAlignmentNavTarget = {
  l2SpanId?: string;
  l3SpanId?: string;
  cardId?: string;
};

export function StrategicAlignment() {
  const setStrategicAlignmentOpen = useBlueprintStore((s) => s.setStrategicAlignmentOpen);
  const closeJourneyView = useBlueprintStore((s) => s.closeJourneyView);
  const openJourneySpan = useBlueprintStore((s) => s.openJourneySpan);
  const selectCard = useBlueprintStore((s) => s.selectCard);
  // Subscribe to the whole store so we always re-render when any nested blueprint changes.
  const state = useBlueprintStore((s) => s);
  const overlayRef = useRef<HTMLDivElement>(null);

  const root = getLifecycleRoot(state);

  // Compute how many levels deep the user currently is, so we know how many
  // times to call closeJourneyView() before walking down to the target.
  const currentDepth = useMemo(() => {
    let d = 0;
    let walker: BlueprintState | null | undefined = state.rootDocument;
    while (walker) {
      d++;
      walker = walker.rootDocument;
    }
    return d;
  }, [state.rootDocument]);

  // Navigate to a card or journey in the tree. Always starts by closing the
  // overlay, then walks up to the L1 root, then walks back down to the target.
  // Using the existing closeJourneyView / openJourneySpan primitives means we
  // don't invent a new navigation path — just sequence them correctly.
  const navigate = (target: StrategicAlignmentNavTarget) => {
    setStrategicAlignmentOpen(false);
    // Walk up to root (n closes based on captured depth at click time).
    for (let i = 0; i < currentDepth; i++) closeJourneyView();
    // Walk down to the target.
    if (target.l2SpanId) openJourneySpan(target.l2SpanId);
    if (target.l3SpanId) openJourneySpan(target.l3SpanId);
    if (target.cardId) selectCard(target.cardId);
  };

  // Derive lookups from the L1 root document. Memoised so unrelated state
  // changes (e.g. UI flags) don't re-sort or re-group on every render.
  const {
    sortedStages,
    userOutcomesByStage,
    performanceIndicatorsByStage,
    spansByStage,
    l2ByBlueprintId,
  } = useMemo(() => {
    const sorted = [...root.stages].sort((a, b) => a.order - b.order);

    // step.id → stage.id (used to place each L2 span under its start-step's stage)
    const stepToStage = new Map<string, string>();
    for (const step of root.steps) stepToStage.set(step.id, step.stageId);

    // Group user_outcome / performance_indicators cards by their stage.
    const userOutcomes = new Map<string, Card[]>();
    const performanceIndicators = new Map<string, Card[]>();
    for (const card of root.cards) {
      if (card.laneKey === 'user_outcome') {
        const list = userOutcomes.get(card.stageId) ?? [];
        list.push(card);
        userOutcomes.set(card.stageId, list);
      } else if (card.laneKey === 'performance_indicators') {
        const list = performanceIndicators.get(card.stageId) ?? [];
        list.push(card);
        performanceIndicators.set(card.stageId, list);
      }
    }
    const byOrder = (a: Card, b: Card) => a.order - b.order;
    for (const list of userOutcomes.values()) list.sort(byOrder);
    for (const list of performanceIndicators.values()) list.sort(byOrder);

    // L2 spans grouped under each L1 stage (start-step rule: use startStepId's stage).
    const byStage = new Map<string, JourneySpan[]>();
    for (const span of root.journeySpans) {
      const stageId = stepToStage.get(span.startStepId);
      if (!stageId) continue;
      const list = byStage.get(stageId) ?? [];
      list.push(span);
      byStage.set(stageId, list);
    }
    for (const list of byStage.values()) list.sort((a, b) => a.order - b.order);

    // childBlueprintId → BlueprintState lookup for quick span → L2 resolution.
    const byId = new Map<string, BlueprintState>();
    for (const child of root.childBlueprints) byId.set(child.blueprint.id, child);

    return {
      sortedStages: sorted,
      userOutcomesByStage: userOutcomes,
      performanceIndicatorsByStage: performanceIndicators,
      spansByStage: byStage,
      l2ByBlueprintId: byId,
    };
  }, [root.stages, root.steps, root.cards, root.journeySpans, root.childBlueprints]);

  // Close on Escape (matches OpportunitySolutionTree behaviour)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStrategicAlignmentOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setStrategicAlignmentOpen]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex min-h-0 flex-col bg-neutral-50"
      role="dialog"
      aria-modal="true"
      aria-label="Strategic alignment"
    >
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-6 py-3.5">
        <Layers className="h-5 w-5 text-violet-500" aria-hidden="true" />
        <div>
          <h2 className="text-[15px] font-bold leading-tight text-neutral-900">Strategic alignment</h2>
          <p className="text-[12px] text-neutral-500">{root.blueprint.serviceName}</p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-[12px] text-neutral-400">
          <span className="hidden sm:inline">Press Esc to close</span>
        </div>
        <button
          onClick={() => setStrategicAlignmentOpen(false)}
          aria-label="Close Strategic alignment"
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          {sortedStages.length === 0 ? (
            <p className="text-[13px] text-neutral-400">
              No stages yet. Add stages to your lifecycle blueprint to see the cascade.
            </p>
          ) : (
            sortedStages.map((stage) => (
              <StageBranch
                key={stage.id}
                stage={stage}
                userOutcomes={userOutcomesByStage.get(stage.id) ?? []}
                performanceIndicators={performanceIndicatorsByStage.get(stage.id) ?? []}
                l2Spans={spansByStage.get(stage.id) ?? []}
                l2ByBlueprintId={l2ByBlueprintId}
                onNavigate={navigate}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stage branch ─────────────────────────────────────────────────────────────
// A stage heading followed by its user_outcome cards. performance_indicators
// cards in the same stage are rendered as supplementary caption text under each
// outcome (per decision: PIs are supporting text, not outcome cards).
function StageBranch({
  stage,
  userOutcomes,
  performanceIndicators,
  l2Spans,
  l2ByBlueprintId,
  onNavigate,
}: {
  stage: Stage;
  userOutcomes: Card[];
  performanceIndicators: Card[];
  l2Spans: JourneySpan[];
  l2ByBlueprintId: Map<string, BlueprintState>;
  onNavigate: (target: StrategicAlignmentNavTarget) => void;
}) {
  // Performance indicators aren't card-linked to specific user_outcomes yet, so
  // we show them as a shared caption under each outcome in the stage. If the
  // stage has multiple outcomes, each sees the same PI text — fine for now.
  const piCaption = performanceIndicators
    .map((pi) => stripTraceabilityForDisplay(pi.title))
    .filter((t) => t.trim().length > 0)
    .join(' · ');
  const stageTitle = stripTraceabilityForDisplay(stage.title);

  return (
    <section className="flex flex-col gap-3">
      {/* Stage heading */}
      <div className="flex items-baseline gap-2 border-b border-neutral-200 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Stage</span>
        <h3 className="text-[15px] font-semibold text-neutral-900">{stageTitle || stage.title}</h3>
      </div>

      {/* User outcomes in this stage */}
      {userOutcomes.length === 0 ? (
        <p className="pl-1 text-[12px] italic text-neutral-400">No user outcomes defined for this stage yet.</p>
      ) : (
        <ul className="flex flex-col gap-3 pl-1">
          {userOutcomes.map((outcome) => (
            <li key={outcome.id}>
              <button
                type="button"
                onClick={() => onNavigate({ cardId: outcome.id })}
                className="w-full rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                aria-label={`Open user outcome: ${outcome.title}`}
              >
                <div className="flex items-start gap-2">
                  <Target className="mt-[3px] h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">User outcome</p>
                    <p className="text-[14px] font-medium leading-snug text-neutral-900">
                      {stripTraceabilityForDisplay(outcome.title) || outcome.title}
                    </p>
                    {stripTraceabilityForDisplay(outcome.body) && (
                      <p className="mt-1 text-[12px] leading-snug text-neutral-600">
                        {stripTraceabilityForDisplay(outcome.body)}
                      </p>
                    )}
                    {piCaption && (
                      <p className="mt-2 text-[11px] italic leading-snug text-neutral-500">
                        <span className="font-semibold not-italic text-neutral-600">Performance indicators:</span>{' '}
                        {piCaption}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* L2 journeys mapped to this stage (via start-step rule) */}
      {l2Spans.length === 0 ? (
        <p className="pl-1 text-[12px] italic text-neutral-400">No journeys mapped to this stage yet.</p>
      ) : (
        <ul className="ml-4 flex flex-col gap-3 border-l-2 border-sky-100 pl-4">
          {l2Spans.map((span) => (
            <L2Branch
              key={span.id}
              span={span}
              l2={l2ByBlueprintId.get(span.childBlueprintId)}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── L2 branch ────────────────────────────────────────────────────────────────
// A journey span (mapped from an L1 step range) and the behaviour_change cards
// living inside that L2 blueprint. behaviour_changes are shown as a flat list
// because there's no card-to-card link between L1 user_outcomes and specific
// L2 behaviour_changes yet (authoring layer deferred to later).
function L2Branch({
  span,
  l2,
  onNavigate,
}: {
  span: JourneySpan;
  l2: BlueprintState | undefined;
  onNavigate: (target: StrategicAlignmentNavTarget) => void;
}) {
  // If a span exists but its child blueprint isn't loaded (rare data-integrity
  // case), surface it clearly rather than hiding.
  if (!l2) {
    return (
      <li className="rounded-lg border border-dashed border-sky-200 bg-white px-3 py-2 text-[12px] italic text-sky-600">
        Journey &ldquo;{span.title}&rdquo; has no linked blueprint.
      </li>
    );
  }

  const behaviourChanges = l2.cards
    .filter((c) => c.laneKey === 'behaviour_change')
    .sort((a, b) => a.order - b.order);

  // L3 spans and child-lookup within this L2 blueprint.
  const l3Spans = [...l2.journeySpans].sort((a, b) => a.order - b.order);
  const l3ByBlueprintId = new Map<string, BlueprintState>();
  for (const child of l2.childBlueprints) l3ByBlueprintId.set(child.blueprint.id, child);

  return (
    <li className="rounded-xl border border-sky-200 bg-white px-4 py-3">
      <div className="flex items-start gap-2">
        <GitBranch className="mt-[3px] h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {/* Clicking the L2 header navigates into the L2 blueprint. */}
          <button
            type="button"
            onClick={() => onNavigate({ l2SpanId: span.id })}
            className="group -mx-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            aria-label={`Open L2 journey: ${span.title || l2.blueprint.serviceName}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">L2 journey</p>
            <p className="text-[13px] font-medium leading-snug text-neutral-900 group-hover:text-sky-800">
              {stripTraceabilityForDisplay(span.title || l2.blueprint.serviceName) || span.title || l2.blueprint.serviceName}
            </p>
          </button>

          {/* Behaviour changes in this L2 (flat list — no outcome-to-outcome nesting yet) */}
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Behaviour changes
            </p>
            {behaviourChanges.length === 0 ? (
              <p className="text-[12px] italic text-neutral-400">No behaviour changes defined yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {behaviourChanges.map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate({ l2SpanId: span.id, cardId: card.id })}
                      className="flex w-full items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-1.5 text-left transition-colors hover:border-amber-300 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      aria-label={`Open behaviour change: ${card.title}`}
                    >
                      <Sparkles className="mt-[2px] h-3 w-3 shrink-0 text-amber-600" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium leading-snug text-neutral-900">
                          {stripTraceabilityForDisplay(card.title) || card.title}
                        </p>
                        {stripTraceabilityForDisplay(card.body) && (
                          <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">
                            {stripTraceabilityForDisplay(card.body)}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Nested L3 journeys under this L2 */}
          {l3Spans.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                L3 journeys
              </p>
              <ul className="ml-2 flex flex-col gap-2 border-l-2 border-violet-100 pl-3">
                {l3Spans.map((l3Span) => (
                  <L3Branch
                    key={l3Span.id}
                    span={l3Span}
                    l3={l3ByBlueprintId.get(l3Span.childBlueprintId)}
                    parentL2SpanId={span.id}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// ─── L3 branch ────────────────────────────────────────────────────────────────
// An L3 journey span and the behaviour_change cards in that L3 blueprint.
// Same "flat list" caveat applies as L2: no outcome-to-outcome linkage yet.
function L3Branch({
  span,
  l3,
  parentL2SpanId,
  onNavigate,
}: {
  span: JourneySpan;
  l3: BlueprintState | undefined;
  parentL2SpanId: string;
  onNavigate: (target: StrategicAlignmentNavTarget) => void;
}) {
  if (!l3) {
    return (
      <li className="rounded-lg border border-dashed border-violet-200 bg-white px-3 py-2 text-[12px] italic text-violet-600">
        Journey &ldquo;{span.title}&rdquo; has no linked blueprint.
      </li>
    );
  }

  const behaviourChanges = l3.cards
    .filter((c) => c.laneKey === 'behaviour_change')
    .sort((a, b) => a.order - b.order);

  // Opportunities → Solutions → Assumptions are scoped to this L3 blueprint.
  const opportunities = [...l3.opportunities].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const solutionsByOpportunity = new Map<string, Solution[]>();
  for (const sol of l3.solutions) {
    const list = solutionsByOpportunity.get(sol.opportunityId) ?? [];
    list.push(sol);
    solutionsByOpportunity.set(sol.opportunityId, list);
  }
  const assumptionsBySolution = new Map<string, Assumption[]>();
  for (const ass of l3.assumptions) {
    const list = assumptionsBySolution.get(ass.solutionId) ?? [];
    list.push(ass);
    assumptionsBySolution.set(ass.solutionId, list);
  }

  return (
    <li className="rounded-lg border border-violet-200 bg-white px-3 py-2">
      <div className="flex items-start gap-2">
        <GitBranch className="mt-[3px] h-3 w-3 shrink-0 text-violet-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {/* Clicking the L3 header navigates into the L3 blueprint. */}
          <button
            type="button"
            onClick={() => onNavigate({ l2SpanId: parentL2SpanId, l3SpanId: span.id })}
            className="group -mx-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            aria-label={`Open L3 journey: ${span.title || l3.blueprint.serviceName}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">L3 journey</p>
            <p className="text-[12px] font-medium leading-snug text-neutral-900 group-hover:text-violet-800">
              {stripTraceabilityForDisplay(span.title || l3.blueprint.serviceName) || span.title || l3.blueprint.serviceName}
            </p>
          </button>

          <div className="mt-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Behaviour changes
            </p>
            {behaviourChanges.length === 0 ? (
              <p className="text-[11px] italic text-neutral-400">No behaviour changes defined yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {behaviourChanges.map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({ l2SpanId: parentL2SpanId, l3SpanId: span.id, cardId: card.id })
                      }
                      className="flex w-full items-start gap-2 rounded border border-amber-200 bg-amber-50/40 px-2 py-1 text-left transition-colors hover:border-amber-300 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      aria-label={`Open behaviour change: ${card.title}`}
                    >
                      <Sparkles className="mt-[2px] h-2.5 w-2.5 shrink-0 text-amber-600" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium leading-snug text-neutral-900">
                          {stripTraceabilityForDisplay(card.title) || card.title}
                        </p>
                        {stripTraceabilityForDisplay(card.body) && (
                          <p className="mt-0.5 text-[10px] leading-snug text-neutral-600">
                            {stripTraceabilityForDisplay(card.body)}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Opportunity → Solution → Assumption cascade under this L3 */}
          {opportunities.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Opportunities
              </p>
              <ul className="flex flex-col gap-1.5">
                {opportunities.map((opp) => (
                  <OpportunitySubtree
                    key={opp.id}
                    opportunity={opp}
                    solutions={solutionsByOpportunity.get(opp.id) ?? []}
                    assumptionsBySolution={assumptionsBySolution}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// ─── Opportunity / Solution / Assumption subtree ──────────────────────────────
// Each opportunity is a muted-or-active block depending on status:
//   open / in_progress → normal styling
//   resolved           → muted grey with a ✓ indicator
//   wont_fix           → muted grey with strikethrough on the title
function OpportunitySubtree({
  opportunity,
  solutions,
  assumptionsBySolution,
}: {
  opportunity: Opportunity;
  solutions: Solution[];
  assumptionsBySolution: Map<string, Assumption[]>;
}) {
  const isMuted = opportunity.status === 'resolved' || opportunity.status === 'wont_fix';
  const isStruck = opportunity.status === 'wont_fix';

  return (
    <li
      className={
        'rounded border px-2 py-1.5 ' +
        (isMuted
          ? 'border-neutral-200 bg-neutral-50/70'
          : 'border-fuchsia-200 bg-fuchsia-50/50')
      }
    >
      <div className="flex items-start gap-2">
        <Lightbulb
          className={
            'mt-[2px] h-2.5 w-2.5 shrink-0 ' + (isMuted ? 'text-neutral-400' : 'text-fuchsia-600')
          }
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className={
                'text-[11px] font-medium leading-snug ' +
                (isMuted ? 'text-neutral-500 ' : 'text-neutral-900 ') +
                (isStruck ? 'line-through' : '')
              }
            >
              {stripTraceabilityForDisplay(opportunity.title) || opportunity.title}
            </p>
            {opportunity.status === 'resolved' && (
              <Check className="h-3 w-3 text-neutral-400" aria-hidden="true" />
            )}
          </div>
          {opportunity.statement && (
            <p className={'mt-0.5 text-[10px] leading-snug ' + (isMuted ? 'text-neutral-400' : 'text-neutral-600')}>
              {stripTraceabilityForDisplay(opportunity.statement) || opportunity.statement}
            </p>
          )}

          {solutions.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-1 border-l border-blue-100 pl-2">
              {solutions.map((sol) => (
                <li key={sol.id} className="rounded border border-blue-200 bg-blue-50/40 px-2 py-1">
                  <div className="flex items-start gap-1.5">
                    <Wrench className="mt-[2px] h-2.5 w-2.5 shrink-0 text-blue-600" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-medium leading-snug text-neutral-900">
                        {stripTraceabilityForDisplay(sol.title) || sol.title}
                      </p>
                      {(assumptionsBySolution.get(sol.id) ?? []).length > 0 && (
                        <ul className="mt-1 flex flex-col gap-0.5 border-l border-amber-100 pl-2">
                          {(assumptionsBySolution.get(sol.id) ?? []).map((ass) => (
                            <li key={ass.id} className="flex items-start gap-1">
                              <FlaskConical className="mt-[2px] h-2.5 w-2.5 shrink-0 text-amber-600" aria-hidden="true" />
                              <p className="text-[10px] leading-snug text-neutral-700">
                                {stripTraceabilityForDisplay(ass.title) || ass.title}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
