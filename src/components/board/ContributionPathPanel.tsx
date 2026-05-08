'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { X, Lightbulb, Target, Layers, GitBranch, ArrowUp } from 'lucide-react';
import { useBlueprintStore } from '@/store/blueprint-store';
import { cn, formatSystemOutcomeCode, formatBehaviourOutcomeCode, formatServiceOutcomeCode } from '@/lib/utils';
import type {
  BehaviourOutcome,
  Opportunity,
  Outcome,
  ServiceOutcome,
  StrategicGoal,
  SystemOutcome,
} from '@/lib/types';

// ─── Chain computation ────────────────────────────────────────────────────────
// Given an opportunity, walk UP the contribution chain:
//   Opportunity → AREA (via outcomeId)
//                  ↑
//                  ├─ SOs whose relatedAreaCodes include this AREA's code
//                  ├─ BEHs whose relatedAreaCodes include this AREA's code
//                  │   PLUS any extra BEHs the SOs link to via SO.behIds
//                  ├─ SYSs whose relatedAreaCodes include this AREA's code
//                  └─ ENV: the AREA's parent strategic goal (Outcome.goalId), not every SYS goalIds union
//
// Why the union of (BEH via AREA hub) + (BEH via SO.behIds)? The two
// mechanisms can disagree — relatedAreaCodes is the lateral hub model and
// SO.behIds is the direct foreign key. We want the union so product teams
// see every BEH that genuinely connects.

interface ContributionChain {
  opportunity: Opportunity;
  area: Outcome | null;
  sos: ServiceOutcome[];
  behs: BehaviourOutcome[];
  syss: SystemOutcome[];
  envs: StrategicGoal[];
}

function computeContributionChain(
  oppId: string,
  opportunities: Opportunity[],
  outcomes: Outcome[],
  serviceOutcomes: ServiceOutcome[],
  behaviourOutcomes: BehaviourOutcome[],
  systemOutcomes: SystemOutcome[],
  strategicGoals: StrategicGoal[],
): ContributionChain | null {
  const opportunity = opportunities.find((o) => o.id === oppId);
  if (!opportunity) return null;

  const area = outcomes.find((o) => o.id === opportunity.outcomeId) ?? null;
  // If there's no AREA we can't walk the chain — return just the opp.
  if (!area || !area.code) {
    return { opportunity, area: null, sos: [], behs: [], syss: [], envs: [] };
  }

  const areaCode = area.code;

  const sos = serviceOutcomes.filter((s) => s.relatedAreaCodes.includes(areaCode));

  // BEHs: union of (related via AREA hub) + (linked via any of these SOs' behIds)
  const behIdsFromSOs = new Set(sos.flatMap((s) => s.behIds));
  const behsViaArea = behaviourOutcomes.filter((b) => b.relatedAreaCodes.includes(areaCode));
  const behsViaSOs  = behaviourOutcomes.filter((b) => behIdsFromSOs.has(b.id));
  const behsMap = new Map<string, BehaviourOutcome>();
  [...behsViaArea, ...behsViaSOs].forEach((b) => behsMap.set(b.id, b));
  const behs = [...behsMap.values()].sort((a, b) => a.order - b.order);

  const syss = systemOutcomes
    .filter((s) => s.relatedAreaCodes.includes(areaCode))
    .sort((a, b) => a.order - b.order);

  // Environmental goal: the strategic branch this AREA sits under (Outcome.goalId),
  // not the union of all ENV goals every related SYS lists (often all three).
  const envIds = new Set(syss.flatMap((s) => s.goalIds));
  const envsFromSysUnion = strategicGoals.filter((g) => envIds.has(g.id)).sort((a, b) => a.order - b.order);
  const branchGoal = strategicGoals.find((g) => g.id === area.goalId);
  const envs = branchGoal ? [branchGoal] : envsFromSysUnion;

  return { opportunity, area, sos, behs, syss, envs };
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

const CHAIN_SECTION_TONE = {
  sys: {
    dot: 'bg-slate-400',
    card: 'border-2 border-slate-200 bg-slate-50/90',
    code: 'text-slate-600',
  },
  beh: {
    dot: 'bg-amber-500',
    card: 'border-2 border-amber-200 bg-amber-50/80',
    code: 'text-amber-700',
  },
  so: {
    dot: 'bg-sky-400',
    card: 'border-2 border-sky-200 bg-sky-50/70',
    code: 'text-sky-600',
  },
} as const;

type ChainSectionTone = keyof typeof CHAIN_SECTION_TONE;

function ChainSection({
  level, label, tone, items, render, relatedNounForEmpty,
}: {
  level: string;
  label: string;
  tone: ChainSectionTone;
  items: Array<{ id: string; code?: string; title: string }>;
  render?: (item: { id: string; code?: string; title: string }) => React.ReactNode;
  /** Used in empty state: "No related {phrase} found…" (defaults to label lowercased). */
  relatedNounForEmpty?: string;
}) {
  const t = CHAIN_SECTION_TONE[tone];
  const emptyPhrase = relatedNounForEmpty ?? label.toLowerCase();
  if (items.length === 0) {
    return (
      <div className="px-4 py-2.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className={cn('inline-block h-1.5 w-1.5 rounded-full', t.dot)} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{label}</span>
          <span className="text-[10px] text-neutral-300">{level}</span>
        </div>
        <p className="text-[11px] italic text-neutral-400">No related {emptyPhrase} found via this area.</p>
      </div>
    );
  }
  return (
    <div className="px-4 py-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <span className={cn('inline-block h-1.5 w-1.5 rounded-full', t.dot)} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{label}</span>
        <span className="text-[10px] text-neutral-300">{level}</span>
        <span className="ml-auto text-[10px] text-neutral-300">{items.length}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (render ? render(item) : (
          <div key={item.id} className={cn('rounded-lg border px-2.5 py-1.5', t.card)}>
            <div className="flex flex-col gap-0.5">
              {item.code && <span className={cn('text-[9px] font-bold', t.code)}>{item.code}</span>}
              <span className="text-[11px] leading-snug text-neutral-800">{item.title}</span>
            </div>
          </div>
        )))}
      </div>
    </div>
  );
}

function ChainArrow() {
  return (
    <div className="flex justify-center py-2" role="presentation">
      <ArrowUp className="h-6 w-6 text-[#cccccc]" strokeWidth={2.5} aria-hidden="true" />
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ContributionPathPanel() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevOppIdForScrollRef = useRef<string | null>(null);

  const oppId               = useBlueprintStore((s) => s.contributionPathOppId);
  const setOppId            = useBlueprintStore((s) => s.setContributionPathOppId);
  const opportunities       = useBlueprintStore((s) => s.opportunities);
  const outcomes            = useBlueprintStore((s) => s.outcomes);
  const serviceOutcomes     = useBlueprintStore((s) => s.serviceOutcomes ?? []);
  const behaviourOutcomes   = useBlueprintStore((s) => s.behaviourOutcomes ?? []);
  const systemOutcomes      = useBlueprintStore((s) => s.systemOutcomes ?? []);
  const strategicGoals      = useBlueprintStore((s) => s.strategicGoals);

  const chain = useMemo(
    () => oppId ? computeContributionChain(
      oppId, opportunities, outcomes, serviceOutcomes, behaviourOutcomes, systemOutcomes, strategicGoals,
    ) : null,
    [oppId, opportunities, outcomes, serviceOutcomes, behaviourOutcomes, systemOutcomes, strategicGoals],
  );

  // Esc closes
  useEffect(() => {
    if (!oppId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOppId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [oppId, setOppId]);

  /** Open / switch opportunity: start scrolled to bottom (opportunity) so user can scroll up for full chain. */
  useLayoutEffect(() => {
    if (!oppId || !chain) {
      prevOppIdForScrollRef.current = null;
      return;
    }
    if (prevOppIdForScrollRef.current === oppId) return;
    prevOppIdForScrollRef.current = oppId;

    const el = bodyRef.current;
    if (!el) return;
    const scrollToEnd = () => {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    };
    scrollToEnd();
    requestAnimationFrame(scrollToEnd);
  }, [oppId, chain]);

  if (!oppId) return null;
  if (!chain) {
    // Opportunity disappeared (deleted while panel was open). Auto-close.
    return null;
  }

  const { opportunity, area, sos, behs, syss, envs } = chain;

  return (
    <aside
      data-contribution-path-root
      // Sits inside the OST overlay at z-[60]; we use z-[70] so it floats above
      // the canvas but below any modal dialogs.
      className="absolute inset-y-0 right-0 z-[70] flex w-[380px] flex-col border-l border-neutral-200 bg-white shadow-xl"
      role="dialog"
      aria-modal="false"
      aria-label="Contribution path"
    >
      {/* ── Header ── */}
      <header className="flex shrink-0 items-center gap-2 border-b border-neutral-200 px-4 py-3">
        <GitBranch className="h-4 w-4 text-violet-500" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[12px] font-bold leading-tight text-neutral-900">Contribution path</p>
          <p className="text-[10.5px] leading-snug text-neutral-500">Provide line of sight from product-team delivery work to environmental outcomes</p>
        </div>
        <button
          onClick={() => setOppId(null)}
          aria-label="Close contribution path"
          className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      {/* ── Body — top-down: strategic goals → opportunity ── */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto">
        {area && (
          <>
            <div className="px-4 pb-1 pt-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Target className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Environmental goals</span>
              </div>
              {envs.length === 0 ? (
                <p className="text-[11px] italic text-neutral-400">No environmental goals connected via this chain.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {envs.map((g) => (
                    <div key={g.id} className="rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-2">
                      <span className="text-[10px] font-bold text-emerald-700">ENV-0{g.order + 1}</span>
                      <p className="mt-0.5 text-[11.5px] font-semibold leading-snug text-emerald-900">{g.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <ChainArrow />
            <ChainSection
              level="SYS"
              label="Contribute to system conditions"
              tone="sys"
              relatedNounForEmpty="system conditions"
              items={syss.map((s) => ({ id: s.id, code: formatSystemOutcomeCode(s.code), title: s.title }))}
            />

            <ChainArrow />
            <ChainSection
              level="BEH"
              label="Leads to behaviour change"
              tone="beh"
              relatedNounForEmpty="behaviour outcomes"
              items={behs.map((b) => ({ id: b.id, code: formatBehaviourOutcomeCode(b.code), title: b.title }))}
            />

            <ChainArrow />
            <ChainSection
              level="SO"
              label="Enable service outcomes"
              tone="so"
              relatedNounForEmpty="service outcomes"
              items={sos.map((s) => ({ id: s.id, code: formatServiceOutcomeCode(s.code), title: s.title }))}
            />

            <ChainArrow />
          </>
        )}

        {/* AREA — between spine and opportunity */}
        <div className="px-4 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-emerald-500" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Opportunity area</span>
            {area?.code && <span className="text-[10px] text-neutral-300">{area.code}</span>}
          </div>
          {area ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2">
              <p className="text-[11.5px] font-medium leading-snug text-neutral-800">{area.title}</p>
              {area.description && (
                <p className="mt-1 text-[10.5px] leading-snug text-neutral-500">{area.description}</p>
              )}
            </div>
          ) : (
            <p className="text-[11px] italic text-neutral-400">This opportunity isn't linked to an area yet — assign one to see the chain.</p>
          )}
        </div>

        <ChainArrow />

        {/* Opportunity — bottom anchor */}
        <div className="px-4 pb-3 pt-1">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Lightbulb className="h-3 w-3 text-violet-500" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600">This opportunity</span>
            {opportunity.traceabilityCode && (
              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-500">{opportunity.traceabilityCode}</span>
            )}
          </div>
          <div className="rounded-lg border-2 border-violet-200 bg-violet-50/40 px-3 py-2">
            <p className="text-[12px] font-semibold leading-snug text-neutral-800">{opportunity.title || '(untitled opportunity)'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
