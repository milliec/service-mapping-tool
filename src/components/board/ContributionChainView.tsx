'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Plus, Minus, Maximize2, ChevronDown,
  Activity, Target, FlaskConical, Trash2, GitBranch, Lightbulb, Layers,
} from 'lucide-react';
import { useBlueprintStore } from '@/store/blueprint-store';
import { cn, formatSystemOutcomeCode, formatBehaviourOutcomeCode } from '@/lib/utils';
import { OST_BRANCHES, type OSTBranch } from '@/lib/ost-branch-data';
import type {
  StrategicGoal,
  SystemOutcome, BehaviourOutcome, Outcome,
  Opportunity, OpportunityStatus,
  Solution, SolutionStatus,
  Assumption, AssumptionStatus,
} from '@/lib/types';

// ── Layout constants (mirrors OpportunitySolutionTree) ────────────────────────
const CARD_W = 264;
const STEM_HALF = 14;
const ITEM_GAP = 20;
const BRANCH_GAP = 72;

// ── Theme palette (matches existing GOAL_COLORS_MAP) ─────────────────────────
const THEMES: Record<OSTBranch['color'], {
  bg: string; border: string; badge: string; text: string;
  outcomeBorder: string; outcomeBg: string; stem: string;
}> = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-300', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-800', outcomeBorder: 'border-emerald-200', outcomeBg: 'bg-emerald-50/40', stem: '#6ee7b7' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-300',    badge: 'bg-blue-100 text-blue-700',       text: 'text-blue-800',    outcomeBorder: 'border-blue-200',    outcomeBg: 'bg-blue-50/40',    stem: '#93c5fd' },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-300',  badge: 'bg-violet-100 text-violet-700',   text: 'text-violet-800',  outcomeBorder: 'border-violet-200',  outcomeBg: 'bg-violet-50/40',  stem: '#c4b5fd' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-300',   badge: 'bg-amber-100 text-amber-700',     text: 'text-amber-800',   outcomeBorder: 'border-amber-200',   outcomeBg: 'bg-amber-50/40',   stem: '#fcd34d' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-300',    badge: 'bg-teal-100 text-teal-700',       text: 'text-teal-800',    outcomeBorder: 'border-teal-200',    outcomeBg: 'bg-teal-50/40',    stem: '#5eead4' },
  sky:     { bg: 'bg-sky-50',     border: 'border-sky-300',     badge: 'bg-sky-100 text-sky-700',         text: 'text-sky-800',     outcomeBorder: 'border-sky-200',     outcomeBg: 'bg-sky-50/40',     stem: '#7dd3fc' },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-300',  badge: 'bg-orange-100 text-orange-700',   text: 'text-orange-800',  outcomeBorder: 'border-orange-200',  outcomeBg: 'bg-orange-50/40',  stem: '#fdba74' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-300',    badge: 'bg-rose-100 text-rose-700',       text: 'text-rose-800',    outcomeBorder: 'border-rose-200',    outcomeBg: 'bg-rose-50/40',    stem: '#fda4af' },
};

const OPP_STATUS_LABELS: Record<OpportunityStatus, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', wont_fix: "Won't fix" };
const OPP_STATUS_CLASSES: Record<OpportunityStatus, string> = { open: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700', resolved: 'bg-emerald-100 text-emerald-700', wont_fix: 'bg-neutral-100 text-neutral-500' };
const SOL_STATUS_LABELS: Record<SolutionStatus, string> = { research: 'Research', ideation: 'Ideation', validating: 'Validating', building: 'Building', shipped: 'Shipped', dropped: 'Dropped' };
const SOL_STATUS_CLASSES: Record<SolutionStatus, string> = { research: 'bg-purple-100 text-purple-700', ideation: 'bg-slate-100 text-slate-600', validating: 'bg-amber-100 text-amber-700', building: 'bg-blue-100 text-blue-700', shipped: 'bg-emerald-100 text-emerald-700', dropped: 'bg-neutral-100 text-neutral-500' };
const ASS_STATUS_LABELS: Record<AssumptionStatus, string> = { untested: 'Untested', validated: 'Validated', invalidated: 'Invalidated' };
const ASS_STATUS_CLASSES: Record<AssumptionStatus, string> = { untested: 'bg-amber-100 text-amber-700', validated: 'bg-emerald-100 text-emerald-700', invalidated: 'bg-red-100 text-red-600' };


// ── Layout primitives ─────────────────────────────────────────────────────────

// Flat horizontal row without add button (SYS / BEH levels)
function FlatRow<T extends { id: string }>({ items, gap = ITEM_GAP, renderItem }: {
  items: T[]; gap?: number; renderItem: (item: T) => React.ReactNode;
}) {
  const half = gap / 2;
  const n = items.length;
  return (
    <div className="flex items-start" style={{ gap }}>
      {items.map((item, idx) => (
        <div key={item.id} className="relative flex flex-col items-center">
          {n > 1 && (
            <div className="absolute top-0 border-t-2 border-dashed border-neutral-200"
              style={{ left: idx === 0 ? '50%' : -half, right: idx === n - 1 ? '50%' : -half }} />
          )}
          <div className="border-l-2 border-dashed border-neutral-200" style={{ height: STEM_HALF * 2 }} />
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}

// Horizontal row with trailing add ghost (AREA / OPP / SOL / ASS levels)
function BranchRow<T extends { id: string }>({ items, gap = ITEM_GAP, renderItem, addLabel, onAdd }: {
  items: T[]; gap?: number; renderItem: (item: T) => React.ReactNode;
  addLabel: string; onAdd: () => void;
}) {
  const half = gap / 2;
  const total = items.length + 1;
  const wrap = (content: React.ReactNode, key: string, idx: number) => (
    <div key={key} className="relative flex flex-col items-center">
      {total > 1 && (
        <div className="absolute top-0 border-t-2 border-dashed border-neutral-300"
          style={{ left: idx === 0 ? '50%' : -half, right: idx === total - 1 ? '50%' : -half, height: 0 }} />
      )}
      <div className="border-l-2 border-dashed border-neutral-300" style={{ height: STEM_HALF * 2 }} />
      {content}
    </div>
  );
  return (
    <div className="flex items-start" style={{ gap }}>
      {items.map((item, i) => wrap(renderItem(item), item.id, i))}
      {wrap(
        <button onClick={onAdd}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-neutral-300 py-5 text-[11px] font-medium text-neutral-400 transition-colors hover:border-violet-300 hover:bg-violet-50/40 hover:text-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          style={{ width: CARD_W, minHeight: 64 }}>
          <Plus className="h-4 w-4" aria-hidden />{addLabel}
        </button>,
        '__add__', items.length,
      )}
    </div>
  );
}

function TreeStem({ count, open, onToggle, color = '#d4d4d4' }: {
  count: number; open: boolean; onToggle: () => void; color?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="border-l-2 border-dashed" style={{ height: STEM_HALF, borderColor: color }} />
      {count > 0
        ? <button onClick={onToggle}
            className="flex items-center gap-1 rounded-full bg-neutral-700 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-neutral-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
            {count} <ChevronDown className={cn('h-2.5 w-2.5 transition-transform duration-150', !open && '-rotate-90')} aria-hidden />
          </button>
        : <div />}
      <div className="border-l-2 border-dashed" style={{ height: STEM_HALF, borderColor: color }} />
    </div>
  );
}

// ── Shared editing primitives ─────────────────────────────────────────────────

function EditableTitle({ value, onSave, placeholder, className }: {
  value: string; onSave: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) { setDraft(value); setTimeout(() => ref.current?.focus(), 0); } }, [editing, value]);
  const save = () => { const t = draft.trim(); if (t && t !== value) onSave(t); setEditing(false); };
  if (editing) {
    return (
      <textarea ref={ref} value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') setEditing(false); }}
        rows={2}
        className={cn('w-full resize-none rounded border border-blue-300 bg-white px-1.5 py-1 text-[13px] leading-snug outline-none focus:ring-2 focus:ring-blue-400', className)} />
    );
  }
  return (
    <button onClick={() => setEditing(true)}
      className={cn('w-full cursor-text text-left text-[13px] leading-snug hover:underline decoration-dashed underline-offset-2 focus:outline-none focus-visible:underline', !value && 'text-neutral-400', className)}>
      {value || placeholder || 'Click to edit…'}
    </button>
  );
}

function StatusPicker<T extends string>({ value, options, labelFn, classFn, onChange }: {
  value: T; options: T[]; labelFn: (v: T) => string; classFn: (v: T) => string; onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors hover:opacity-80', classFn(value))}>
        {labelFn(value)} <ChevronDown className="h-2.5 w-2.5" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[130px] rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
          {options.map((opt) => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              className={cn('flex w-full items-center rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-neutral-50', opt === value ? classFn(opt) : 'text-neutral-600')}>
              {labelFn(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card components ───────────────────────────────────────────────────────────

// Branch top card: desired outcome + ENV contributions + first experiment
function BranchTopCard({ branch }: { branch: OSTBranch }) {
  const t = THEMES[branch.color];
  return (
    <div style={{ width: CARD_W }} className={cn('rounded-2xl border-2 p-4 shadow-md', t.bg, t.border)}>
      <div className="mb-2 flex items-start gap-2">
        <GitBranch className={cn('mt-0.5 h-4 w-4 shrink-0', t.text)} aria-hidden />
        <span className={cn('text-[12px] font-bold leading-snug', t.text)}>{branch.name}</span>
      </div>

      {/* Desired outcome */}
      <p className={cn('mb-3 text-[12px] font-medium leading-snug', t.text)}>{branch.headline}</p>

      {/* Divider */}
      <div className={cn('mb-3 h-px', t.outcomeBorder.replace('border-', 'bg-'))} />

      {/* First experiment */}
      <div className="flex items-start gap-2">
        <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
        <div>
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">First experiment</p>
          <p className="text-[11px] leading-snug text-neutral-600">{branch.firstExperiment}</p>
        </div>
      </div>
    </div>
  );
}

// SYS card: compact, read-only, slate tones
function SysCard({ sys }: { sys: SystemOutcome }) {
  return (
    <div style={{ width: CARD_W }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5">
        <Activity className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{formatSystemOutcomeCode(sys.code)}</span>
      </div>
      <p className="text-[11px] leading-snug text-slate-700 line-clamp-3">{sys.title}</p>
    </div>
  );
}

// BEH card: compact, read-only, neutral tones
function BehCard({ beh }: { beh: BehaviourOutcome }) {
  return (
    <div style={{ width: CARD_W }} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5">
        <Target className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{formatBehaviourOutcomeCode(beh.code)}</span>
      </div>
      <p className="text-[11px] leading-snug text-neutral-700 line-clamp-3">{beh.title}</p>
    </div>
  );
}

// ENV card: uses the goal's own color (same palette as THEMES)
function EnvCard({ goal, envCode }: { goal: StrategicGoal; envCode: string }) {
  const t = THEMES[goal.color as OSTBranch['color']] ?? THEMES.emerald;
  return (
    <div style={{ width: CARD_W }} className={cn('rounded-xl border-2 px-3 py-2.5 shadow-sm', t.bg, t.border)}>
      <div className="mb-1">
        <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', t.badge)}>{envCode}</span>
      </div>
      <p className={cn('text-[12px] font-semibold leading-snug', t.text)}>{goal.title}</p>
      {goal.description && (
        <p className={cn('mt-1 text-[10.5px] leading-snug opacity-70 line-clamp-2', t.text)}>{goal.description}</p>
      )}
    </div>
  );
}

// AREA card: read-only outcome card, tinted by branch color
function AreaCard({ outcome, t }: { outcome: Outcome; t: typeof THEMES[OSTBranch['color']] }) {
  const label = (outcome.title ?? '').replace(/^AREA-[A-J]+:\s*/i, '');
  return (
    <div style={{ width: CARD_W }} className={cn('rounded-xl border-2 px-3 py-2.5 shadow-sm', t.outcomeBorder, t.outcomeBg)}>
      <div className="mb-1 flex items-center gap-1.5">
        <Layers className="h-3 w-3 shrink-0" style={{ color: t.stem }} aria-hidden />
        <span className={cn('text-[10px] font-bold uppercase tracking-wide', t.text)}>{outcome.code}</span>
      </div>
      <p className="text-[11.5px] font-medium leading-snug text-neutral-800 line-clamp-2">{label}</p>
      {outcome.description && (
        <p className="mt-1 text-[10.5px] leading-snug text-neutral-500 line-clamp-2">{outcome.description}</p>
      )}
    </div>
  );
}

// OPP card: editable opportunity
function OppCard({ opp, onTitle, onStatus, onDelete }: {
  opp: Opportunity;
  onTitle: (v: string) => void;
  onStatus: (v: OpportunityStatus) => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ width: CARD_W }}
      className="rounded-xl border-2 border-neutral-200 bg-white p-3 shadow-sm"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="mb-2 flex items-start justify-between gap-1">
        <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
          <Target className="h-2.5 w-2.5" aria-hidden /> {opp.traceabilityCode || 'Opp'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <StatusPicker value={opp.status ?? 'open'} options={['open', 'in_progress', 'resolved', 'wont_fix'] as OpportunityStatus[]}
            labelFn={(v) => OPP_STATUS_LABELS[v]} classFn={(v) => OPP_STATUS_CLASSES[v]} onChange={onStatus} />
          {hovered && (
            <button onClick={onDelete} className="rounded p-0.5 text-neutral-300 hover:bg-red-50 hover:text-red-400 transition-colors focus:outline-none" aria-label="Delete opportunity">
              <Trash2 className="h-3 w-3" aria-hidden />
            </button>
          )}
        </div>
      </div>
      <EditableTitle value={opp.title} onSave={onTitle} placeholder="Describe the opportunity…" className="font-medium text-neutral-800" />
    </div>
  );
}

// SOL card: editable solution / product bet (no type label)
function SolCard({ sol, onTitle, onStatus, onDelete }: {
  sol: Solution;
  onTitle: (v: string) => void;
  onStatus: (v: SolutionStatus) => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ width: CARD_W }}
      className="rounded-xl border-2 border-neutral-200 bg-white p-3 shadow-sm"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="mb-2 flex items-start justify-between gap-1">
        <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
          <Lightbulb className="h-2.5 w-2.5" aria-hidden /> Bet
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <StatusPicker value={sol.status} options={['research', 'ideation', 'validating', 'building', 'shipped', 'dropped'] as SolutionStatus[]}
            labelFn={(v) => SOL_STATUS_LABELS[v]} classFn={(v) => SOL_STATUS_CLASSES[v]} onChange={onStatus} />
          {hovered && (
            <button onClick={onDelete} className="rounded p-0.5 text-neutral-300 hover:bg-red-50 hover:text-red-400 transition-colors focus:outline-none" aria-label="Delete bet">
              <Trash2 className="h-3 w-3" aria-hidden />
            </button>
          )}
        </div>
      </div>
      <EditableTitle value={sol.title} onSave={onTitle} placeholder="Describe the bet…" />
    </div>
  );
}

// ASS card: editable assumption
function AssCard({ ass, onTitle, onStatus, onDelete }: {
  ass: Assumption;
  onTitle: (v: string) => void;
  onStatus: (v: AssumptionStatus) => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ width: CARD_W }}
      className="rounded-xl border-2 border-dashed border-neutral-200 bg-white p-3 shadow-sm"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="mb-2 flex items-start justify-between gap-1">
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600">
          <FlaskConical className="h-2.5 w-2.5" aria-hidden /> Assumption
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <StatusPicker value={ass.status} options={['untested', 'validated', 'invalidated'] as AssumptionStatus[]}
            labelFn={(v) => ASS_STATUS_LABELS[v]} classFn={(v) => ASS_STATUS_CLASSES[v]} onChange={onStatus} />
          {hovered && (
            <button onClick={onDelete} className="rounded p-0.5 text-neutral-300 hover:bg-red-50 hover:text-red-400 transition-colors focus:outline-none" aria-label="Delete assumption">
              <Trash2 className="h-3 w-3" aria-hidden />
            </button>
          )}
        </div>
      </div>
      <EditableTitle value={ass.title} onSave={onTitle} placeholder="We believe that…" />
    </div>
  );
}

// ── Subtrees ──────────────────────────────────────────────────────────────────

function AssumptionSubtree({ solId, assumptions, updateAssumption, deleteAssumption, addAssumption }: {
  solId: string;
  assumptions: Assumption[];
  updateAssumption: (id: string, patch: Partial<Pick<Assumption, 'title' | 'status'>>) => void;
  deleteAssumption: (id: string) => void;
  addAssumption: (data: Omit<Assumption, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
}) {
  const mine = assumptions.filter((a) => a.solutionId === solId);
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col items-center">
      <TreeStem count={mine.length} open={open} onToggle={() => setOpen((v) => !v)} />
      {open && (
        <BranchRow
          items={mine}
          renderItem={(ass) => (
            <AssCard
              ass={ass}
              onTitle={(v) => updateAssumption(ass.id, { title: v })}
              onStatus={(v) => updateAssumption(ass.id, { status: v })}
              onDelete={() => deleteAssumption(ass.id)}
            />
          )}
          addLabel="Add assumption"
          onAdd={() => addAssumption({ solutionId: solId, title: 'We believe that…', status: 'untested', rationale: '' })}
        />
      )}
    </div>
  );
}

function SolutionSubtree({ sol, assumptions, updateSolution, deleteSolution, updateAssumption, deleteAssumption, addAssumption }: {
  sol: Solution;
  assumptions: Assumption[];
  updateSolution: (id: string, patch: Partial<Pick<Solution, 'title' | 'status'>>) => void;
  deleteSolution: (id: string) => void;
  updateAssumption: (id: string, patch: Partial<Pick<Assumption, 'title' | 'status'>>) => void;
  deleteAssumption: (id: string) => void;
  addAssumption: (data: Omit<Assumption, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
}) {
  return (
    <div className="flex flex-col items-center">
      <SolCard
        sol={sol}
        onTitle={(v) => updateSolution(sol.id, { title: v })}
        onStatus={(v) => updateSolution(sol.id, { status: v })}
        onDelete={() => deleteSolution(sol.id)}
      />
      <AssumptionSubtree
        solId={sol.id}
        assumptions={assumptions}
        updateAssumption={updateAssumption}
        deleteAssumption={deleteAssumption}
        addAssumption={addAssumption}
      />
    </div>
  );
}

function OppSubtree({ opp, solutions, assumptions, updateOpportunity, deleteOpportunity, addSolution, updateSolution, deleteSolution, updateAssumption, deleteAssumption, addAssumption }: {
  opp: Opportunity;
  solutions: Solution[];
  assumptions: Assumption[];
  updateOpportunity: (id: string, patch: Partial<Pick<Opportunity, 'title' | 'status'>>) => void;
  deleteOpportunity: (id: string) => void;
  addSolution: (data: Omit<Solution, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
  updateSolution: (id: string, patch: Partial<Pick<Solution, 'title' | 'status'>>) => void;
  deleteSolution: (id: string) => void;
  updateAssumption: (id: string, patch: Partial<Pick<Assumption, 'title' | 'status'>>) => void;
  deleteAssumption: (id: string) => void;
  addAssumption: (data: Omit<Assumption, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
}) {
  const mine = solutions.filter((s) => s.opportunityId === opp.id);
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col items-center">
      <OppCard
        opp={opp}
        onTitle={(v) => updateOpportunity(opp.id, { title: v })}
        onStatus={(v) => updateOpportunity(opp.id, { status: v })}
        onDelete={() => deleteOpportunity(opp.id)}
      />
      <TreeStem count={mine.length} open={open} onToggle={() => setOpen((v) => !v)} />
      {open && (
        <BranchRow
          items={mine}
          renderItem={(sol) => (
            <SolutionSubtree
              sol={sol}
              assumptions={assumptions}
              updateSolution={updateSolution}
              deleteSolution={deleteSolution}
              updateAssumption={updateAssumption}
              deleteAssumption={deleteAssumption}
              addAssumption={addAssumption}
            />
          )}
          addLabel="Add bet"
          onAdd={() => addSolution({ opportunityId: opp.id, title: 'New product bet…', status: 'ideation', description: '' })}
        />
      )}
    </div>
  );
}

function AreaSubtree({ area, opportunities, solutions, assumptions, t, addOpportunity, updateOpportunity, deleteOpportunity, addSolution, updateSolution, deleteSolution, updateAssumption, deleteAssumption, addAssumption }: {
  area: Outcome;
  opportunities: Opportunity[];
  solutions: Solution[];
  assumptions: Assumption[];
  t: typeof THEMES[OSTBranch['color']];
  addOpportunity: (data: Omit<Opportunity, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
  updateOpportunity: (id: string, patch: Partial<Pick<Opportunity, 'title' | 'status'>>) => void;
  deleteOpportunity: (id: string) => void;
  addSolution: (data: Omit<Solution, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
  updateSolution: (id: string, patch: Partial<Pick<Solution, 'title' | 'status'>>) => void;
  deleteSolution: (id: string) => void;
  updateAssumption: (id: string, patch: Partial<Pick<Assumption, 'title' | 'status'>>) => void;
  deleteAssumption: (id: string) => void;
  addAssumption: (data: Omit<Assumption, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
}) {
  const mine = opportunities.filter((o) => o.outcomeId === area.id);
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col items-center">
      <AreaCard outcome={area} t={t} />
      <TreeStem count={mine.length} open={open} onToggle={() => setOpen((v) => !v)} color={t.stem} />
      {open && (
        <BranchRow
          items={mine}
          renderItem={(opp) => (
            <OppSubtree
              opp={opp}
              solutions={solutions}
              assumptions={assumptions}
              updateOpportunity={updateOpportunity}
              deleteOpportunity={deleteOpportunity}
              addSolution={addSolution}
              updateSolution={updateSolution}
              deleteSolution={deleteSolution}
              updateAssumption={updateAssumption}
              deleteAssumption={deleteAssumption}
              addAssumption={addAssumption}
            />
          )}
          addLabel="Add opportunity"
          onAdd={() => addOpportunity({
            outcomeId: area.id,
            title: 'New opportunity…',
            statement: '',
            rationale: '',
            sourceCardIds: [],
            affectedStages: [],
            affectedSteps: [],
            status: 'open',
          })}
        />
      )}
    </div>
  );
}

// ── BranchSubtree ─────────────────────────────────────────────────────────────

function BranchSubtree({ branch, strategicGoals, systemOutcomes, behaviourOutcomes, outcomes, opportunities, solutions, assumptions, addOpportunity, updateOpportunity, deleteOpportunity, addSolution, updateSolution, deleteSolution, updateAssumption, deleteAssumption, addAssumption }: {
  branch: OSTBranch;
  strategicGoals: StrategicGoal[];
  systemOutcomes: SystemOutcome[];
  behaviourOutcomes: BehaviourOutcome[];
  outcomes: Outcome[];
  opportunities: Opportunity[];
  solutions: Solution[];
  assumptions: Assumption[];
  addOpportunity: (data: Omit<Opportunity, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
  updateOpportunity: (id: string, patch: Partial<Pick<Opportunity, 'title' | 'status'>>) => void;
  deleteOpportunity: (id: string) => void;
  addSolution: (data: Omit<Solution, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
  updateSolution: (id: string, patch: Partial<Pick<Solution, 'title' | 'status'>>) => void;
  deleteSolution: (id: string) => void;
  updateAssumption: (id: string, patch: Partial<Pick<Assumption, 'title' | 'status'>>) => void;
  deleteAssumption: (id: string) => void;
  addAssumption: (data: Omit<Assumption, 'id' | 'blueprintId' | 'createdAt' | 'updatedAt'>) => string;
}) {
  const t = THEMES[branch.color];

  const branchSys  = systemOutcomes.filter((s) => branch.sysCodes.includes(s.code));
  // Derive ENV goals via which goals the branch's SYS outcomes contribute to
  const sysGoalIds = new Set(branchSys.flatMap((s) => s.goalIds));
  const branchEnv  = strategicGoals.filter((g) => sysGoalIds.has(g.id)).sort((a, b) => a.order - b.order);
  const branchBeh  = behaviourOutcomes.filter((b) => branch.behCodes.includes(b.code));
  const branchAreas = outcomes.filter((o) => branch.areaCodes.includes(o.code ?? ''));

  const [envOpen,  setEnvOpen]  = useState(true);
  const [sysOpen, setSysOpen] = useState(true);
  const [behOpen, setBehOpen] = useState(true);
  const [areaOpen, setAreaOpen] = useState(true);

  return (
    <div className="flex flex-col items-center">

      {/* ── Branch card (desired outcome + first experiment) ── */}
      <BranchTopCard branch={branch} />

      {/* ── ENV level ── */}
      {branchEnv.length > 0 && (
        <>
          <TreeStem count={branchEnv.length} open={envOpen} onToggle={() => setEnvOpen((v) => !v)} color={t.stem} />
          {envOpen && (
            <FlatRow items={branchEnv} renderItem={(g) => <EnvCard goal={g} envCode={`ENV-0${g.order + 1}`} />} />
          )}
        </>
      )}

      {/* ── SYS level ── */}
      {branchSys.length > 0 && (
        <>
          <TreeStem count={branchSys.length} open={sysOpen} onToggle={() => setSysOpen((v) => !v)} color={t.stem} />
          {sysOpen && (
            <FlatRow items={branchSys} renderItem={(s) => <SysCard sys={s} />} />
          )}
        </>
      )}

      {/* ── BEH level ── */}
      {branchBeh.length > 0 && (
        <>
          <TreeStem count={branchBeh.length} open={behOpen} onToggle={() => setBehOpen((v) => !v)} color={t.stem} />
          {behOpen && (
            <FlatRow items={branchBeh} renderItem={(b) => <BehCard beh={b} />} />
          )}
        </>
      )}

      {/* ── AREA → OPP → SOL → ASS ── */}
      {branchAreas.length > 0 && (
        <>
          <TreeStem count={branchAreas.length} open={areaOpen} onToggle={() => setAreaOpen((v) => !v)} color={t.stem} />
          {areaOpen && (
            <FlatRow
              items={branchAreas}
              renderItem={(area) => (
                <AreaSubtree
                  area={area}
                  opportunities={opportunities}
                  solutions={solutions}
                  assumptions={assumptions}
                  t={t}
                  addOpportunity={addOpportunity}
                  updateOpportunity={updateOpportunity}
                  deleteOpportunity={deleteOpportunity}
                  addSolution={addSolution}
                  updateSolution={updateSolution}
                  deleteSolution={deleteSolution}
                  updateAssumption={updateAssumption}
                  deleteAssumption={deleteAssumption}
                  addAssumption={addAssumption}
                />
              )}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ContributionChainView({ onClose }: { onClose: () => void }) {
  const strategicGoals    = useBlueprintStore((s) => s.strategicGoals);
  const systemOutcomes    = useBlueprintStore((s) => s.systemOutcomes ?? []);
  const behaviourOutcomes = useBlueprintStore((s) => s.behaviourOutcomes ?? []);
  const outcomes          = useBlueprintStore((s) => s.outcomes);
  const opportunities     = useBlueprintStore((s) => s.opportunities);
  const solutions         = useBlueprintStore((s) => s.solutions);
  const assumptions       = useBlueprintStore((s) => s.assumptions);

  const addOpportunity    = useBlueprintStore((s) => s.addOpportunity);
  const updateOpportunity = useBlueprintStore((s) => s.updateOpportunity);
  const deleteOpportunity = useBlueprintStore((s) => s.deleteOpportunity);
  const addSolution       = useBlueprintStore((s) => s.addSolution);
  const updateSolution    = useBlueprintStore((s) => s.updateSolution);
  const deleteSolution    = useBlueprintStore((s) => s.deleteSolution);
  const addAssumption     = useBlueprintStore((s) => s.addAssumption);
  const updateAssumption  = useBlueprintStore((s) => s.updateAssumption);
  const deleteAssumption  = useBlueprintStore((s) => s.deleteAssumption);

  // ── Pan / zoom ─────────────────────────────────────────────────────────────
  const [transform, setTransform] = useState({ x: 60, y: 40, scale: 0.65 });
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const lastPtrRef = useRef({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);

  const clamp = (s: number) => Math.min(2.5, Math.max(0.15, s));

  const zoomAt = useCallback((factor: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.width / 2; const cy = rect.height / 2;
    const t = transformRef.current;
    const ns = clamp(t.scale * factor);
    setTransform({ x: cx - (cx - t.x) * (ns / t.scale), y: cy - (cy - t.y) * (ns / t.scale), scale: ns });
  }, []);

  const fitToView = useCallback(() => setTransform({ x: 60, y: 40, scale: 0.65 }), []);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left; const py = e.clientY - rect.top;
    const t = transformRef.current;
    const ns = clamp(t.scale * factor);
    setTransform({ x: px - (px - t.x) * (ns / t.scale), y: py - (py - t.y) * (ns / t.scale), scale: ns });
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpaceDown(true);
      if (e.key === 'Escape') onClose();
    };
    const ku = (e: KeyboardEvent) => { if (e.key === ' ') setSpaceDown(false); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [onClose]);

  const onPtrDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isPanningRef.current = true;
    lastPtrRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPtrMove = useCallback((e: React.PointerEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastPtrRef.current.x;
    const dy = e.clientY - lastPtrRef.current.y;
    lastPtrRef.current = { x: e.clientX, y: e.clientY };
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);
  const onPtrUp = useCallback(() => { isPanningRef.current = false; }, []);

  const sharedActions = {
    addOpportunity, updateOpportunity, deleteOpportunity,
    addSolution, updateSolution, deleteSolution,
    addAssumption, updateAssumption, deleteAssumption,
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f0f4f8]">
      {/* ── Header ── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-6 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold text-neutral-900">Contribution chains</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">OST branches · Defra EPR</span>
        </div>
        <div className="flex-1" />
        <p className="text-[11px] text-neutral-400 hidden sm:block">Scroll to zoom · Drag to pan · Space+drag over cards</p>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label="Back to goal map"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        className="relative flex-1 overflow-hidden"
        style={{ cursor: isPanningRef.current || spaceDown ? 'grabbing' : 'default' }}
        onPointerDown={onPtrDown}
        onPointerMove={onPtrMove}
        onPointerUp={onPtrUp}
        onPointerLeave={onPtrUp}
      >
        <div
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            display: 'inline-flex',
            alignItems: 'flex-start',
            gap: BRANCH_GAP,
            padding: '60px 80px 120px',
            willChange: 'transform',
            cursor: isPanningRef.current || spaceDown ? 'grabbing' : 'default',
          }}
        >
          {OST_BRANCHES.map((branch) => (
            <BranchSubtree
              key={branch.id}
              branch={branch}
              strategicGoals={strategicGoals}
              systemOutcomes={systemOutcomes}
              behaviourOutcomes={behaviourOutcomes}
              outcomes={outcomes}
              opportunities={opportunities}
              solutions={solutions}
              assumptions={assumptions}
              {...sharedActions}
            />
          ))}
        </div>

        {/* ── Zoom controls ── */}
        <div className="absolute bottom-5 right-5 flex items-center gap-0.5 rounded-xl border border-neutral-200 bg-white px-1 py-1 shadow-md">
          <button onClick={() => zoomAt(1 / 1.2)} aria-label="Zoom out"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors focus:outline-none">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setTransform((t) => ({ ...t, scale: 1 }))}
            className="h-7 min-w-[48px] rounded-lg text-center text-[12px] font-semibold tabular-nums text-neutral-700 hover:bg-neutral-100 transition-colors focus:outline-none">
            {Math.round(transform.scale * 100)}%
          </button>
          <button onClick={() => zoomAt(1.2)} aria-label="Zoom in"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors focus:outline-none">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <div className="mx-1 h-4 w-px bg-neutral-200" />
          <button onClick={fitToView} aria-label="Fit to view"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors focus:outline-none">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Level legend (bottom-left) ── */}
        <div className="pointer-events-none absolute bottom-6 left-6 flex flex-wrap items-center gap-4 text-[10px] text-neutral-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> ENV-01 Reduce waste</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-400 inline-block" /> ENV-02 Circularity</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400 inline-block" /> ENV-03 Prevent crime</span>
          <span className="mx-1 h-3 w-px bg-neutral-300 inline-block" />
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300 inline-block" /> System conditions</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-neutral-300 inline-block" /> Behaviour outcomes</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-neutral-200 border border-neutral-300 inline-block" /> Opportunity areas</span>
          <span className="flex items-center gap-1"><Target className="h-2.5 w-2.5" /> Opportunities</span>
          <span className="flex items-center gap-1"><Lightbulb className="h-2.5 w-2.5" /> Bets</span>
          <span className="flex items-center gap-1"><FlaskConical className="h-2.5 w-2.5 text-amber-400" /> Assumptions</span>
        </div>
      </div>
    </div>
  );
}
