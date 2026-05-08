'use client';

import { useEffect, useMemo, useRef, useState, useCallback, useContext, createContext, useLayoutEffect, type ReactNode } from 'react';
import { X, Plus, Minus, Trash2, ChevronDown, GitBranch, Target, Star, Lightbulb, Wrench, FlaskConical, Maximize2, Layers, MapPin, Package, Network, Route, ChevronsUp, Save, Link2, Loader2, Check, AlertCircle } from 'lucide-react';
import { EvidenceStatementLine } from './EvidenceStatementLine';
import { ContributionChainView } from './ContributionChainView';
import { ContributionPathPanel } from './ContributionPathPanel';
import { useBlueprintStore } from '@/store/blueprint-store';
import { publishOrRefreshShare } from '@/lib/share-payload';
import { cn, formatSystemOutcomeCode, formatBehaviourOutcomeCode, formatServiceOutcomeCode } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { loadL2Steps, loadL3Steps, l2StepsForAreaCode, l3StepsForL2 } from '@/lib/journey-data';
import type {
  Assumption, AssumptionStatus,
  BehaviourOutcome,
  L2JourneyStep, L3ServiceStep,
  Opportunity, OpportunityStatus,
  Outcome,
  ServiceOutcome,
  Solution, SolutionStatus,
  StrategicGoal, StrategicGoalColor,
  SystemOutcome,
} from '@/lib/types';

/** Bumped from the OST toolbar to fold branches below opportunity-area cards. */
const OstFoldToGoalsAndAreasGenContext = createContext(0);
const OstExpandBranchesGenContext = createContext(0);

function useOstFoldToGoalsAndAreasGen(): number {
  return useContext(OstFoldToGoalsAndAreasGenContext);
}

function useOstExpandBranchesGen(): number {
  return useContext(OstExpandBranchesGenContext);
}

// ─── Status helpers ────────────────────────────────────────────────────────────

const SOLUTION_STATUSES: SolutionStatus[] = ['research', 'ideation', 'validating', 'building', 'shipped', 'dropped'];
const ASSUMPTION_STATUSES: AssumptionStatus[] = ['untested', 'validated', 'invalidated'];
const OPPORTUNITY_STATUSES: OpportunityStatus[] = ['open', 'in_progress', 'resolved', 'wont_fix'];
const GOAL_COLORS: StrategicGoalColor[] = ['emerald', 'blue', 'violet', 'amber', 'rose', 'sky', 'teal', 'orange'];

const solutionStatusLabel = (s: SolutionStatus) =>
  ({ research: 'Research', ideation: 'Ideation', validating: 'Validating', building: 'Building', shipped: 'Shipped', dropped: 'Dropped' }[s]);
const assumptionStatusLabel = (s: AssumptionStatus) =>
  ({ untested: 'Untested', validated: 'Validated', invalidated: 'Invalidated' }[s]);
const opportunityStatusLabel = (s: OpportunityStatus) =>
  ({ open: 'Open', in_progress: 'In progress', resolved: 'Resolved', wont_fix: "Won't fix" }[s]);

const solutionStatusClasses = (s: SolutionStatus) => ({
  research: 'bg-purple-100 text-purple-700',
  ideation: 'bg-slate-100 text-slate-600', validating: 'bg-amber-100 text-amber-700',
  building: 'bg-blue-100 text-blue-700', shipped: 'bg-emerald-100 text-emerald-700',
  dropped: 'bg-neutral-100 text-neutral-500',
}[s]);

const assumptionStatusClasses = (s: AssumptionStatus) => ({
  untested: 'bg-amber-100 text-amber-700', validated: 'bg-emerald-100 text-emerald-700',
  invalidated: 'bg-red-100 text-red-600',
}[s]);

const opportunityStatusClasses = (s: OpportunityStatus) => ({
  open: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700', wont_fix: 'bg-neutral-100 text-neutral-500',
}[s]);

const GOAL_COLORS_MAP: Record<StrategicGoalColor, {
  bg: string; border: string; badge: string; text: string;
  outcomeBorder: string; outcomeBg: string; stem: string;
}> = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-300', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-800', outcomeBorder: 'border-emerald-200', outcomeBg: 'bg-emerald-50/40', stem: '#6ee7b7' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-300',    badge: 'bg-blue-100 text-blue-700',       text: 'text-blue-800',    outcomeBorder: 'border-blue-200',    outcomeBg: 'bg-blue-50/40',    stem: '#93c5fd' },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-300',  badge: 'bg-violet-100 text-violet-700',   text: 'text-violet-800',  outcomeBorder: 'border-violet-200',  outcomeBg: 'bg-violet-50/40',  stem: '#c4b5fd' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-300',   badge: 'bg-amber-100 text-amber-700',     text: 'text-amber-800',   outcomeBorder: 'border-amber-200',   outcomeBg: 'bg-amber-50/40',   stem: '#fcd34d' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-300',    badge: 'bg-rose-100 text-rose-700',       text: 'text-rose-800',    outcomeBorder: 'border-rose-200',    outcomeBg: 'bg-rose-50/40',    stem: '#fda4af' },
  sky:     { bg: 'bg-sky-50',     border: 'border-sky-300',     badge: 'bg-sky-100 text-sky-700',         text: 'text-sky-800',     outcomeBorder: 'border-sky-200',     outcomeBg: 'bg-sky-50/40',     stem: '#7dd3fc' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-300',    badge: 'bg-teal-100 text-teal-700',       text: 'text-teal-800',    outcomeBorder: 'border-teal-200',    outcomeBg: 'bg-teal-50/40',    stem: '#5eead4' },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-300',  badge: 'bg-orange-100 text-orange-700',   text: 'text-orange-800',  outcomeBorder: 'border-orange-200',  outcomeBg: 'bg-orange-50/40',  stem: '#fdba74' },
};

const AREA_OUTCOME_CODE_RE = /^AREA-[A-Z]+$/;

/** Stored titles use `AREA-X: headline`; the card chip already shows AREA-X, so edit/display the headline only. */
function opportunityAreaTitleForEdit(title: string, code: string | undefined | null): string {
  if (!title || !code || !AREA_OUTCOME_CODE_RE.test(code)) return title;
  const prefix = `${code}:`;
  if (title.startsWith(prefix)) return title.slice(prefix.length).trimStart();
  const stripped = title.replace(/^AREA-[A-Z]+:\s*/i, '').trimStart();
  return stripped || title;
}

function persistOpportunityAreaTitle(editedBody: string, code: string | undefined | null): string {
  const t = editedBody.trim();
  if (!code || !AREA_OUTCOME_CODE_RE.test(code)) return t;
  return `${code}: ${t}`;
}

/** Assign-outcome picker: show `A: headline` instead of repeating `AREA-A: …`. */
function outcomePickerLabel(outcome: Outcome): string {
  const code = outcome.code;
  if (!code || !AREA_OUTCOME_CODE_RE.test(code)) return outcome.title;
  const letter = code.slice('AREA-'.length);
  const headline = opportunityAreaTitleForEdit(outcome.title, code);
  return headline ? `${letter}: ${headline}` : letter;
}

const COLOR_DOTS: Record<StrategicGoalColor, string> = {
  emerald: 'bg-emerald-400', blue: 'bg-blue-400', violet: 'bg-violet-400',
  amber: 'bg-amber-400', rose: 'bg-rose-400', sky: 'bg-sky-400', teal: 'bg-teal-400', orange: 'bg-orange-400',
};

// ─── Tree layout constants ─────────────────────────────────────────────────────

const CARD_W = 264; // px — fixed card width for all levels
const STEM_HALF = 14; // px — half-height of each connector stem segment

// ─── BranchRow ─────────────────────────────────────────────────────────────────
// Lays items out horizontally. Each item is centred over its subtree.
// A horizontal "bus" line connects all items at the top, with a short vertical
// drop from the bus down into each item. The add-card is always the last item.

function BranchRow<T extends { id: string }>({
  items,
  gap,
  renderItem,
  addLabel,
  onAdd,
  addButtonDataAttrs,
}: {
  items: T[];
  gap: number;
  renderItem: (item: T) => ReactNode;
  addLabel: string;
  onAdd: () => void;
  addButtonDataAttrs?: Record<string, string>;
}) {
  const half = gap / 2;
  const total = items.length + 1; // real items + add ghost

  const wrapCell = (content: ReactNode, key: string, idx: number) => {
    const isFirst = idx === 0;
    const isLast = idx === total - 1;
    const isOnly = total === 1;
    return (
      <div key={key} className="relative flex flex-col items-center">
        {/* Horizontal bus segment */}
        {!isOnly && (
          <div
            className="absolute top-0 border-t-2 border-dashed border-neutral-300"
            style={{
              left: isFirst ? '50%' : -half,
              right: isLast ? '50%' : -half,
              height: 0,
            }}
          />
        )}
        {/* Vertical drop from bus to content */}
        <div className="border-l-2 border-dashed border-neutral-300" style={{ height: STEM_HALF * 2 }} />
        {content}
      </div>
    );
  };

  return (
    <div className="flex items-start" style={{ gap }}>
      {items.map((item, i) => wrapCell(renderItem(item), item.id, i))}
      {wrapCell(
        <AddCard label={addLabel} onClick={onAdd} dataAttrs={addButtonDataAttrs} />,
        '__add__',
        items.length,
      )}
    </div>
  );
}

// ─── TreeStem ──────────────────────────────────────────────────────────────────
// Vertical connector between a parent card and its BranchRow.
// Shows a count badge (collapse toggle) when children > 0.

function TreeStem({
  count,
  open,
  onToggle,
  color = '#d4d4d4',
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="border-l-2 border-dashed" style={{ height: STEM_HALF, borderColor: color }} />
      {count > 0 ? (
        <button
          onClick={onToggle}
          className="flex items-center gap-1 rounded-full bg-neutral-700 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-neutral-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          {count}
          <ChevronDown className={cn('h-2.5 w-2.5 transition-transform duration-150', !open && '-rotate-90')} aria-hidden="true" />
        </button>
      ) : (
        <div />
      )}
      <div className="border-l-2 border-dashed" style={{ height: STEM_HALF, borderColor: color }} />
    </div>
  );
}

// ─── AddCard ───────────────────────────────────────────────────────────────────

function AddCard({ label, onClick, dataAttrs }: { label: string; onClick: () => void; dataAttrs?: Record<string, string> }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-neutral-300 py-5 text-[11px] font-medium text-neutral-400 transition-colors hover:border-violet-300 hover:bg-violet-50/40 hover:text-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      style={{ width: CARD_W, minHeight: 64 }}
      {...(dataAttrs ?? {})}
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

// ─── Inline editable title ────────────────────────────────────────────────────

function EditableTitle({ value, onSave, placeholder, className }: {
  value: string; onSave: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const closedFromPointerRef = useRef(false);

  useEffect(() => {
    if (editing) { setDraft(value); setTimeout(() => ref.current?.focus(), 0); }
  }, [editing, value]);

  const save = useCallback(() => {
    const t = draft.trim();
    if (t && t !== value) onSave(t);
    setEditing(false);
  }, [draft, value, onSave]);

  useEffect(() => {
    if (!editing) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      closedFromPointerRef.current = true;
      save();
    };
    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [editing, save]);

  const onBlur = () => {
    if (closedFromPointerRef.current) {
      closedFromPointerRef.current = false;
      return;
    }
    save();
  };

  if (editing) {
    return (
      <textarea ref={ref} value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') setEditing(false); }}
        rows={4}
        className={cn('w-full resize-none rounded border border-blue-300 bg-white px-1.5 py-1 text-[13px] leading-snug outline-none focus:ring-2 focus:ring-blue-400', className)}
      />
    );
  }
  return (
    <button onClick={() => setEditing(true)}
      className={cn('w-full cursor-text text-left text-[13px] leading-snug hover:underline decoration-dashed underline-offset-2 focus:outline-none focus-visible:underline', !value && 'text-neutral-400', className)}>
      {value || placeholder || 'Click to edit…'}
    </button>
  );
}

// ─── StatusPicker ──────────────────────────────────────────────────────────────

function StatusPicker<T extends string>({
  value,
  options,
  labelFn,
  classFn,
  onChange,
  coachTarget,
  coachMeta,
}: {
  value: T;
  options: T[];
  labelFn: (v: T) => string;
  classFn: (v: T) => string;
  onChange: (v: T) => void;
  coachTarget?: string;
  coachMeta?: Record<string, string>;
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
    <div ref={ref} className="relative" data-defra-coach-target={coachTarget} {...(coachMeta ?? {})}>
      <button onClick={() => setOpen(!open)}
        className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors hover:opacity-80', classFn(value))}>
        {labelFn(value)} <ChevronDown className="h-2.5 w-2.5" aria-hidden="true" />
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

// ─── ColorPicker ───────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: StrategicGoalColor; onChange: (c: StrategicGoalColor) => void }) {
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
      <button onClick={() => setOpen(!open)} className="rounded p-0.5 hover:bg-black/10 focus:outline-none" aria-label="Change colour">
        <span className={cn('block h-3.5 w-3.5 rounded-full', COLOR_DOTS[value])} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 flex gap-1 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-lg">
          {GOAL_COLORS.map((c) => (
            <button key={c} onClick={() => { onChange(c); setOpen(false); }}
              className={cn('h-5 w-5 rounded-full transition-transform hover:scale-110', COLOR_DOTS[c], c === value && 'ring-2 ring-offset-1 ring-neutral-400')} aria-label={c} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── OutcomePicker (on Opportunity card) ──────────────────────────────────────

function OutcomePicker({ value, goals, outcomes, onChange }: {
  value: string | undefined; goals: StrategicGoal[]; outcomes: Outcome[]; onChange: (id: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const current = outcomes.find((o) => o.id === value);
  const parentGoal = current ? goals.find((g) => g.id === current.goalId) : undefined;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="inline-flex max-w-[160px] items-center gap-1.5 rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-500 hover:border-neutral-400 hover:text-neutral-700 focus:outline-none transition-colors">
        {current ? (
          <>
            {parentGoal && <span className={cn('h-2 w-2 shrink-0 rounded-full', COLOR_DOTS[parentGoal.color])} />}
            <span className="truncate">{outcomePickerLabel(current)}</span>
          </>
        ) : 'Assign outcome'}
        <ChevronDown className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
          {goals.map((g) => {
            const go = outcomes.filter((o) => o.goalId === g.id);
            if (!go.length) return null;
            return (
              <div key={g.id}>
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{g.title}</p>
                {go.map((o) => (
                  <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }}
                    className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-neutral-50', o.id === value && 'font-semibold bg-neutral-50')}>
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', COLOR_DOTS[g.color])} />
                    <span className="truncate">{outcomePickerLabel(o)}</span>
                  </button>
                ))}
              </div>
            );
          })}
          {value && (
            <button onClick={() => { onChange(undefined); setOpen(false); }}
              className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-neutral-100 px-2 py-1.5 pt-2 text-[12px] text-neutral-400 hover:bg-neutral-50">
              Remove link
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Assumption card ───────────────────────────────────────────────────────────

function AssumptionCard({ assumption }: { assumption: Assumption }) {
  const updateAssumption = useBlueprintStore((s) => s.updateAssumption);
  const deleteAssumption = useBlueprintStore((s) => s.deleteAssumption);
  const [confirm, setConfirm] = useState(false);
  return (
    <div
      className="group relative rounded-xl border border-amber-200 bg-white p-3 shadow-sm"
      style={{ width: CARD_W }}
      data-defra-coach-target="assumption-card"
      data-defra-coach-assumption-id={assumption.id}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <FlaskConical className="h-3 w-3 text-amber-500" aria-hidden="true" />
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">Assumption</span>
        </div>
        <button onClick={() => setConfirm(true)} aria-label="Delete"
          className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-neutral-400 hover:text-red-500 focus:outline-none focus-visible:opacity-100 transition-opacity">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <EditableTitle value={assumption.title} onSave={(v) => updateAssumption(assumption.id, { title: v })} placeholder="We believe that…" className="text-neutral-800" />
      <div className="mt-2">
        <StatusPicker
          value={assumption.status}
          options={ASSUMPTION_STATUSES}
          labelFn={assumptionStatusLabel}
          classFn={assumptionStatusClasses}
          onChange={(v) => updateAssumption(assumption.id, { status: v })}
          coachTarget="assumption-status"
          coachMeta={{ 'data-defra-coach-assumption-id': assumption.id }}
        />
      </div>
      {confirm && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 p-2">
          <span className="flex-1 text-[11px] text-red-700">Delete?</span>
          <button onClick={() => deleteAssumption(assumption.id)} className="rounded bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-600">Delete</button>
          <button onClick={() => setConfirm(false)} className="text-[11px] text-neutral-500 hover:text-neutral-700">Cancel</button>
        </div>
      )}
    </div>
  );
}

// ─── Solution subtree ──────────────────────────────────────────────────────────

function SolutionSubtree({ solution }: { solution: Solution }) {
  const allAssumptions = useBlueprintStore((s) => s.assumptions);
  const assumptions = useMemo(() => allAssumptions.filter((a) => a.solutionId === solution.id), [allAssumptions, solution.id]);
  const updateSolution = useBlueprintStore((s) => s.updateSolution);
  const deleteSolution = useBlueprintStore((s) => s.deleteSolution);
  const addAssumption = useBlueprintStore((s) => s.addAssumption);
  const [open, setOpen] = useState(true);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex flex-col items-center">
      {/* Solution card */}
      <div
        className="group relative rounded-xl border border-blue-200 bg-white p-3 shadow-sm"
        style={{ width: CARD_W }}
        data-defra-coach-target="solution-card"
        data-defra-coach-solution-id={solution.id}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Wrench className="h-3 w-3 text-blue-500" aria-hidden="true" />
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600">Solution</span>
          </div>
          <button onClick={() => setConfirm(true)} aria-label="Delete"
            className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-neutral-400 hover:text-red-500 focus:outline-none focus-visible:opacity-100 transition-opacity">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
        <EditableTitle value={solution.title} onSave={(v) => updateSolution(solution.id, { title: v })} placeholder="Describe the solution…" className="font-medium text-neutral-800" />
        <div className="mt-2">
          <StatusPicker
            value={solution.status}
            options={SOLUTION_STATUSES}
            labelFn={solutionStatusLabel}
            classFn={solutionStatusClasses}
            onChange={(v) => updateSolution(solution.id, { status: v })}
            coachTarget="solution-status"
            coachMeta={{ 'data-defra-coach-solution-id': solution.id }}
          />
        </div>
        {confirm && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 p-2">
            <span className="flex-1 text-[11px] text-red-700">Delete + assumptions?</span>
            <button onClick={() => deleteSolution(solution.id)} className="rounded bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-600">Delete</button>
            <button onClick={() => setConfirm(false)} className="text-[11px] text-neutral-500 hover:text-neutral-700">Cancel</button>
          </div>
        )}
      </div>

      {/* Assumptions branch */}
      <TreeStem count={assumptions.length} open={open} onToggle={() => setOpen(!open)} />
      {open && (
        <BranchRow
          items={assumptions}
          gap={20}
          renderItem={(ass) => <AssumptionCard assumption={ass} />}
          addLabel="Add assumption"
          addButtonDataAttrs={{
            'data-defra-coach-target': 'assumption-add',
            'data-defra-coach-solution-id': solution.id,
          }}
          onAdd={() => { addAssumption({ solutionId: solution.id, title: '', status: 'untested' }); setOpen(true); }}
        />
      )}
    </div>
  );
}

// ─── Opportunity subtree ───────────────────────────────────────────────────────

function OpportunitySubtree({ opportunity, goals, outcomes, depth = 0 }: {
  opportunity: Opportunity; goals: StrategicGoal[]; outcomes: Outcome[]; depth?: number;
}) {
  const allSolutions = useBlueprintStore((s) => s.solutions);
  const solutions = useMemo(() => allSolutions.filter((s) => s.opportunityId === opportunity.id), [allSolutions, opportunity.id]);
  const allOpportunities = useBlueprintStore((s) => s.opportunities);
  const subOpps = useMemo(() => allOpportunities.filter((o) => o.parentOpportunityId === opportunity.id), [allOpportunities, opportunity.id]);
  const cards = useBlueprintStore((s) => s.cards);
  const updateOpportunity = useBlueprintStore((s) => s.updateOpportunity);
  const deleteOpportunity = useBlueprintStore((s) => s.deleteOpportunity);
  const assignOpportunityToOutcome = useBlueprintStore((s) => s.assignOpportunityToOutcome);
  const addSolution = useBlueprintStore((s) => s.addSolution);
  const addOpportunity = useBlueprintStore((s) => s.addOpportunity);
  const setContributionPathOppId = useBlueprintStore((s) => s.setContributionPathOppId);
  const [open, setOpen] = useState(true);
  const [subOpen, setSubOpen] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [kpiOpen, setKpiOpen] = useState(false);

  const isProductFinding = depth > 0;
  const painCount = opportunity.sourceCardIds.filter((id) => cards.some((c) => c.id === id)).length;

  return (
    <div className="flex flex-col items-center">
      {/* Opportunity card */}
      <div
        data-defra-coach-target={isProductFinding ? 'product-team-finding-card' : undefined}
        data-defra-coach-opportunity-id={isProductFinding ? opportunity.id : undefined}
        className={cn(
          'group relative rounded-xl border p-3.5 shadow-sm',
          isProductFinding
            ? 'border-amber-200 bg-amber-50/30'
            : 'border-violet-200 bg-white',
        )}
        style={{ width: CARD_W }}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Lightbulb
              className={cn('h-3.5 w-3.5 shrink-0', isProductFinding ? 'text-amber-500' : 'text-violet-500')}
              aria-hidden="true"
            />
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                isProductFinding ? 'bg-amber-50 text-amber-600' : 'bg-violet-50 text-violet-600',
              )}
            >
              {isProductFinding ? 'Product team finding' : 'Opportunity'}
            </span>
            {!isProductFinding && opportunity.traceabilityCode && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold text-neutral-500">{opportunity.traceabilityCode}</span>
            )}
            {painCount > 0 && <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{painCount} pain pt{painCount !== 1 ? 's' : ''}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => setContributionPathOppId(opportunity.id)}
              data-defra-coach-target="contribution-path"
              data-defra-coach-opportunity-id={opportunity.id}
              aria-label="View contribution path"
              title="View contribution path (AREA → SO → BEH → SYS → ENV)"
              className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-neutral-400 hover:text-violet-600 focus:outline-none focus-visible:opacity-100 transition-opacity"
            >
              <Route className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setConfirm(true)} aria-label="Delete"
              className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-neutral-400 hover:text-red-500 focus:outline-none focus-visible:opacity-100 transition-opacity">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <EditableTitle value={opportunity.title} onSave={(v) => updateOpportunity(opportunity.id, { title: v })} placeholder="Describe the opportunity…" className="font-semibold text-neutral-900" />

        {/* Evidence codes — strategic only */}
        {!isProductFinding && opportunity.statement && (
          <EvidenceStatementLine
            statement={opportunity.statement}
            className="mt-1.5 font-mono text-[9px] leading-relaxed text-neutral-400"
          />
        )}

        {/* KPI signals — strategic only */}
        {!isProductFinding && opportunity.rationale && (
          <button
            onClick={() => setKpiOpen((v) => !v)}
            className="mt-1.5 flex w-full items-center gap-1 text-left text-[9px] font-semibold uppercase tracking-wide text-sky-500 hover:text-sky-700 focus:outline-none"
          >
            <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', !kpiOpen && '-rotate-90')} aria-hidden="true" />
            KPI signals
          </button>
        )}
        {!isProductFinding && kpiOpen && opportunity.rationale && (
          <p className="mt-1 rounded bg-sky-50 px-2 py-1.5 text-[10px] leading-relaxed text-sky-700">{opportunity.rationale}</p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <StatusPicker value={opportunity.status} options={OPPORTUNITY_STATUSES} labelFn={opportunityStatusLabel} classFn={opportunityStatusClasses} onChange={(v) => updateOpportunity(opportunity.id, { status: v })} />
          {!isProductFinding && (
            <OutcomePicker value={opportunity.outcomeId} goals={goals} outcomes={outcomes} onChange={(id) => assignOpportunityToOutcome(opportunity.id, id)} />
          )}
        </div>
        {confirm && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 p-2">
            <span className="flex-1 text-[11px] text-red-700">Delete + solutions?</span>
            <button onClick={() => deleteOpportunity(opportunity.id)} className="rounded bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-600">Delete</button>
            <button onClick={() => setConfirm(false)} className="text-[11px] text-neutral-500 hover:text-neutral-700">Cancel</button>
          </div>
        )}
      </div>

      {/* Sub-opportunities (product team findings) — strategic level only */}
      {!isProductFinding && (
        <>
          <TreeStem count={subOpps.length} open={subOpen} onToggle={() => setSubOpen((v) => !v)} color="#f59e0b" />
          {subOpen && (
            <BranchRow
              items={subOpps}
              gap={24}
              renderItem={(sub) => (
                <OpportunitySubtree opportunity={sub} goals={goals} outcomes={outcomes} depth={1} />
              )}
              addLabel="Add product team finding"
              addButtonDataAttrs={{
                'data-defra-coach-target': 'product-team-finding-add',
                'data-defra-coach-opportunity-id': opportunity.id,
              }}
              onAdd={() => {
                addOpportunity({
                  outcomeId: opportunity.outcomeId,
                  parentOpportunityId: opportunity.id,
                  title: 'Product team finding…',
                  statement: '',
                  rationale: '',
                  sourceCardIds: [],
                  affectedStages: [],
                  affectedSteps: [],
                  status: 'open',
                });
                setSubOpen(true);
              }}
            />
          )}
        </>
      )}

      {/* Solutions branch — only for product team findings */}
      {isProductFinding && (
        <>
          <TreeStem count={solutions.length} open={open} onToggle={() => setOpen(!open)} />
          {open && (
            <BranchRow
              items={solutions}
              gap={24}
              renderItem={(sol) => <SolutionSubtree solution={sol} />}
              addLabel="Add solution"
              addButtonDataAttrs={{
                'data-defra-coach-target': 'solution-add',
                'data-defra-coach-opportunity-id': opportunity.id,
              }}
              onAdd={() => { addSolution({ opportunityId: opportunity.id, title: '', status: 'ideation' }); setOpen(true); }}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Outcome subtree ───────────────────────────────────────────────────────────

function OutcomePriorityRationale({ outcomeId, stored, updateOutcome, onSaved }: {
  outcomeId: string;
  stored: string | undefined;
  updateOutcome: (id: string, patch: Partial<Pick<Outcome, 'priorityRationale'>>) => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(() => stored ?? '');
  const inputId = `priority-rationale-${outcomeId}`;
  const current = (stored ?? '').trim();
  const draftTrimmed = draft.trim();
  const isDirty = draftTrimmed !== current;
  const canSave = draftTrimmed.length > 0 && isDirty;

  const save = (rawValue?: string) => {
    const next = (rawValue ?? draft).trim();
    if (next === current) return;
    updateOutcome(outcomeId, { priorityRationale: next || undefined });
    setDraft(next);
  };

  const clear = () => {
    setDraft('');
    updateOutcome(outcomeId, { priorityRationale: undefined });
    onSaved();
  };

  return (
    <form
      className="mt-2 rounded-lg border border-amber-200/70 bg-amber-50/50 p-2"
      onPointerDown={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        save(draft);
        onSaved();
      }}
    >
      <label htmlFor={inputId} className="block text-[10px] font-semibold uppercase tracking-wide text-amber-900/70">
        Leverage point
      </label>
      <textarea
        id={inputId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            save();
          }
        }}
        placeholder="Why this area has stronger leverage points for connecting product/service work to environmental outcomes?"
        rows={5}
        className="mt-1 w-full resize-y rounded-md border border-amber-200/80 bg-white/95 px-2 py-1.5 text-[12px] leading-snug text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/45"
      />
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={clear}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded px-2 py-1 text-[11px] font-medium text-amber-900/80 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={!canSave}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            'rounded px-2 py-1 text-[11px] font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
            canSave ? 'bg-amber-600 hover:bg-amber-700' : 'cursor-not-allowed bg-amber-300/80',
          )}
        >
          Save
        </button>
      </div>
    </form>
  );
}

function OutcomeSubtree({ outcome, goalColor, goals, allOutcomes, opportunities }: {
  outcome: Outcome; goalColor: StrategicGoalColor; goals: StrategicGoal[]; allOutcomes: Outcome[]; opportunities: Opportunity[];
}) {
  const updateOutcome = useBlueprintStore((s) => s.updateOutcome);
  const deleteOutcome = useBlueprintStore((s) => s.deleteOutcome);
  const addOpportunity = useBlueprintStore((s) => s.addOpportunity);
  const systemOutcomes = useBlueprintStore((s) => s.systemOutcomes ?? []);
  const behaviourOutcomes = useBlueprintStore((s) => s.behaviourOutcomes ?? []);
  const serviceOutcomes = useBlueprintStore((s) => s.serviceOutcomes ?? []);
  const spineFilter = useBlueprintStore((s) => s.spineFilter);
  const [open, setOpen] = useState(true);
  const [priorityEditorOpen, setPriorityEditorOpen] = useState(() => outcome.priorityStarred && !outcome.priorityRationale);
  const foldGen = useOstFoldToGoalsAndAreasGen();
  const expandGen = useOstExpandBranchesGen();

  // Only show root (strategic) opportunities at the outcome level — sub-opps are nested inside their parent
  const rootOpps = useMemo(() => opportunities.filter((o) => !o.parentOpportunityId), [opportunities]);
  const [confirm, setConfirm] = useState(false);
  const colors = GOAL_COLORS_MAP[goalColor];

  useEffect(() => {
    if (foldGen > 0) setOpen(false);
  }, [foldGen]);

  useEffect(() => {
    if (expandGen > 0) setOpen(true);
  }, [expandGen]);

  const relatedBeh = outcome.code ? behaviourOutcomes.filter((b) => b.relatedAreaCodes.includes(outcome.code!)) : [];
  const relatedSo  = outcome.code ? serviceOutcomes.filter((s) => s.relatedAreaCodes.includes(outcome.code!))  : [];

  // Dimming: when a spine filter is active, fade this card if its area code isn't in the filter node's relatedAreaCodes
  const matchesFilter = useMemo(() => {
    if (!spineFilter || !outcome.code) return true;
    const { type, code } = spineFilter;
    if (type === 'sys') { const node = systemOutcomes.find((s) => s.code === code); return node?.relatedAreaCodes.includes(outcome.code!) ?? false; }
    if (type === 'beh') { const node = behaviourOutcomes.find((b) => b.code === code); return node?.relatedAreaCodes.includes(outcome.code!) ?? false; }
    if (type === 'so')  { const node = serviceOutcomes.find((s) => s.code === code);  return node?.relatedAreaCodes.includes(outcome.code!) ?? false; }
    return true;
  }, [spineFilter, outcome.code, systemOutcomes, behaviourOutcomes, serviceOutcomes]);

  return (
    <div className={cn('flex flex-col items-center transition-opacity', !matchesFilter && 'opacity-25 pointer-events-none')}>
      {/* Outcome card */}
      <div
        data-defra-coach-target="outcome-card"
        data-defra-coach-outcome-code={outcome.code ?? ''}
        className={cn(
          'group relative rounded-xl border-2 shadow-sm',
          colors.outcomeBg,
          colors.outcomeBorder,
          outcome.priorityStarred && 'ring-2 ring-amber-400/60 ring-offset-2 ring-offset-neutral-100',
        )}
        style={{ width: CARD_W }}
      >
        <div className="p-3.5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', colors.badge)}>Opportunity area</span>
              {outcome.code && <span className="text-[9px] font-bold text-neutral-400">{outcome.code}</span>}
              {outcome.priorityStarred && (
                <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">Strong evidence</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  if (!outcome.priorityStarred) {
                    updateOutcome(outcome.id, { priorityStarred: true });
                  }
                  setPriorityEditorOpen(true);
                }}
                data-defra-coach-target="priority-star"
                data-defra-coach-outcome-code={outcome.code ?? ''}
                aria-label={outcome.priorityStarred ? 'Edit priority rationale' : 'Mark as priority area'}
                aria-pressed={outcome.priorityStarred}
                title={outcome.priorityStarred ? 'Edit priority rationale' : 'Mark as priority area'}
                className={cn(
                  'rounded p-0.5 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1',
                  outcome.priorityStarred
                    ? 'text-amber-500 opacity-100'
                    : 'text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-amber-500 focus-visible:opacity-100',
                )}
              >
                <Star className={cn('h-3.5 w-3.5', outcome.priorityStarred && 'fill-amber-400 text-amber-600')} strokeWidth={outcome.priorityStarred ? 1.5 : 2} />
              </button>
              <button onClick={() => setConfirm(true)} aria-label="Delete"
                className="opacity-0 group-hover:opacity-100 shrink-0 rounded p-0.5 text-neutral-400 hover:text-red-500 focus:outline-none focus-visible:opacity-100 transition-opacity">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <EditableTitle
            value={opportunityAreaTitleForEdit(outcome.title, outcome.code)}
            onSave={(v) => {
              const next = persistOpportunityAreaTitle(v, outcome.code);
              if (next && next !== outcome.title) updateOutcome(outcome.id, { title: next });
            }}
            placeholder="Enter goal"
            className={cn('font-semibold', colors.text)}
          />

          {outcome.description && (
            <p className="mt-1 text-[12px] leading-snug text-neutral-500">{outcome.description}</p>
          )}

          {outcome.priorityStarred && (
            priorityEditorOpen ? (
              <OutcomePriorityRationale
                key={`${outcome.id}-${outcome.priorityRationale ?? ''}`}
                outcomeId={outcome.id}
                stored={outcome.priorityRationale}
                updateOutcome={updateOutcome}
                onSaved={() => setPriorityEditorOpen(false)}
              />
            ) : (
              <div className="mt-2 rounded-lg border border-amber-200/70 bg-amber-50/50 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/70">Leverage point</p>
                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-snug text-neutral-700">
                  {outcome.priorityRationale?.trim() || 'No rationale added yet. Click the star icon to add one.'}
                </p>
              </div>
            )
          )}

          {/* BEH / SO context chips */}
          {(relatedBeh.length > 0 || relatedSo.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {relatedBeh.map((b) => (
                <Tooltip key={b.code}>
                  <TooltipTrigger
                    render={
                      <span className="cursor-help rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-500 outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1" />
                    }
                  >
                    {formatBehaviourOutcomeCode(b.code)}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-left">
                    <span className="block font-semibold tracking-tight">{formatBehaviourOutcomeCode(b.code)}</span>
                    <span className="mt-0.5 block font-normal">{b.title}</span>
                    {b.actors.length > 0 && (
                      <span className="mt-1.5 block border-t border-background/20 pt-1.5 opacity-90">
                        {b.actors.join(' · ')}
                      </span>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
              {relatedSo.map((s) => (
                <Tooltip key={s.code}>
                  <TooltipTrigger
                    render={
                      <span className="cursor-help rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold text-sky-500 outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1" />
                    }
                  >
                    {formatServiceOutcomeCode(s.code)}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-left">
                    <span className="block font-semibold tracking-tight">{formatServiceOutcomeCode(s.code)}</span>
                    <span className="mt-0.5 block font-normal">{s.title}</span>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}

          {confirm && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 p-2">
              <span className="flex-1 text-[11px] text-red-700">Delete? Opportunities will be unlinked.</span>
              <button onClick={() => deleteOutcome(outcome.id)} className="rounded bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-600">Delete</button>
              <button onClick={() => setConfirm(false)} className="text-[11px] text-neutral-500 hover:text-neutral-700">Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Opportunities branch — coloured stem matches goal */}
      <TreeStem count={rootOpps.length} open={open} onToggle={() => setOpen(!open)} color={colors.stem} />
      {open && (
        <BranchRow
          items={rootOpps}
          gap={32}
          renderItem={(opp) => <OpportunitySubtree opportunity={opp} goals={goals} outcomes={allOutcomes} />}
          addLabel="Add opportunity"
          onAdd={() => { addOpportunity({ title: '', statement: '', rationale: '', sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'open', outcomeId: outcome.id }); setOpen(true); }}
        />
      )}
    </div>
  );
}

// ─── Goal subtree ──────────────────────────────────────────────────────────────

function GoalSubtree({ goal, outcomes, allGoals, allOutcomes, opportunitiesByOutcome }: {
  goal: StrategicGoal; outcomes: Outcome[]; allGoals: StrategicGoal[]; allOutcomes: Outcome[]; opportunitiesByOutcome: Map<string, Opportunity[]>;
}) {
  const updateStrategicGoal = useBlueprintStore((s) => s.updateStrategicGoal);
  const deleteStrategicGoal = useBlueprintStore((s) => s.deleteStrategicGoal);
  const addOutcome = useBlueprintStore((s) => s.addOutcome);
  const systemOutcomes = useBlueprintStore((s) => s.systemOutcomes ?? []);
  const [open, setOpen] = useState(true);
  const foldGen = useOstFoldToGoalsAndAreasGen();
  const expandGen = useOstExpandBranchesGen();
  const [confirm, setConfirm] = useState(false);
  const colors = GOAL_COLORS_MAP[goal.color];

  const goalSys = systemOutcomes.filter((s) => s.goalIds.includes(goal.id));

  useEffect(() => {
    if (foldGen > 0) setOpen(true);
  }, [foldGen]);

  useEffect(() => {
    if (expandGen > 0) setOpen(true);
  }, [expandGen]);

  return (
    <div className="flex flex-col items-center">
      {/* Goal card */}
      <div className={cn('group relative rounded-2xl border-2 p-4 shadow-sm', colors.bg, colors.border)} style={{ width: CARD_W }}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className={cn('h-4 w-4 shrink-0', colors.text)} aria-hidden="true" />
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', colors.badge)}>Environmental outcome</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ColorPicker value={goal.color} onChange={(c) => updateStrategicGoal(goal.id, { color: c })} />
            <button onClick={() => setConfirm(true)} aria-label="Delete goal" className="rounded p-0.5 text-neutral-400 hover:text-red-500 focus:outline-none">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <EditableTitle value={goal.title} onSave={(v) => updateStrategicGoal(goal.id, { title: v })} placeholder="Name this goal…" className={cn('text-[15px] font-bold', colors.text)} />
        {goal.description && <p className="mt-1 text-[12px] leading-snug text-neutral-500">{goal.description}</p>}
        {goalSys.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {goalSys.map((s) => (
              <Tooltip key={s.code}>
                <TooltipTrigger
                  render={
                    <span className="cursor-help rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1" />
                  }
                >
                  {formatSystemOutcomeCode(s.code)}
                </TooltipTrigger>
                <TooltipContent side="top" className="text-left">
                  <span className="block font-semibold tracking-tight">{formatSystemOutcomeCode(s.code)}</span>
                  <span className="mt-0.5 block font-normal">{s.title}</span>
                  {s.relatedAreaCodes.length > 0 && (
                    <span className="mt-1.5 block border-t border-background/20 pt-1.5 opacity-90">
                      {s.relatedAreaCodes.join(' · ')}
                    </span>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
        {confirm && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 p-2">
            <span className="flex-1 text-[11px] text-red-700">Delete goal and all its outcomes?</span>
            <button onClick={() => deleteStrategicGoal(goal.id)} className="rounded bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-600">Delete</button>
            <button onClick={() => setConfirm(false)} className="text-[11px] text-neutral-500 hover:text-neutral-700">Cancel</button>
          </div>
        )}
      </div>

      {/* Outcomes branch — coloured stem */}
      <TreeStem count={outcomes.length} open={open} onToggle={() => setOpen(!open)} color={colors.stem} />
      {open && (
        <BranchRow
          items={outcomes}
          gap={32}
          renderItem={(outcome) => (
            <OutcomeSubtree
              outcome={outcome}
              goalColor={goal.color}
              goals={allGoals}
              allOutcomes={allOutcomes}
              opportunities={opportunitiesByOutcome.get(outcome.id) ?? []}
            />
          )}
          addLabel="Add opportunity area"
          onAdd={() => { addOutcome({ goalId: goal.id, title: '', order: outcomes.length }); setOpen(true); }}
        />
      )}
    </div>
  );
}

// ─── Unassigned section ────────────────────────────────────────────────────────

function UnassignedSection({ opportunities, goals, outcomes }: {
  opportunities: Opportunity[]; goals: StrategicGoal[]; outcomes: Outcome[];
}) {
  const addOpportunity = useBlueprintStore((s) => s.addOpportunity);
  const [open, setOpen] = useState(true);
  const foldGen = useOstFoldToGoalsAndAreasGen();
  const expandGen = useOstExpandBranchesGen();

  useEffect(() => {
    if (foldGen > 0) setOpen(false);
  }, [foldGen]);

  useEffect(() => {
    if (expandGen > 0) setOpen(true);
  }, [expandGen]);

  if (opportunities.length === 0) return null;

  return (
    <div className="flex flex-col items-center">
      <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-4 text-center" style={{ width: CARD_W }}>
        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Unassigned</span>
        <p className="mt-1 text-[12px] text-neutral-400">No outcome linked</p>
      </div>
      <TreeStem count={opportunities.length} open={open} onToggle={() => setOpen(!open)} />
      {open && (
        <BranchRow
          items={opportunities}
          gap={32}
          renderItem={(opp) => <OpportunitySubtree opportunity={opp} goals={goals} outcomes={outcomes} />}
          addLabel="Add opportunity"
          onAdd={() => addOpportunity({ title: '', statement: '', rationale: '', sourceCardIds: [], affectedStages: [], affectedSteps: [], status: 'open' })}
        />
      )}
    </div>
  );
}


type SpineFilter = { type: 'sys' | 'beh' | 'so'; code: string };

// ─── Strategy spine ────────────────────────────────────────────────────────────

function SpineNode({ code, label, sublabel, active, onClick, colorClass }: {
  code: string; label: string; sublabel?: string; active: boolean; onClick: () => void; colorClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        active
          ? `${colorClass} shadow-sm`
          : 'border-transparent bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
      )}
    >
      <span className="block text-[10px] font-bold uppercase tracking-wide opacity-60">{code}</span>
      <span className="mt-0.5 block text-[12px] font-medium leading-snug">{label}</span>
      {sublabel && <span className="mt-0.5 block text-[10px] leading-snug opacity-60">{sublabel}</span>}
    </button>
  );
}

function StrategySpine({
  strategicGoals,
  systemOutcomes,
  behaviourOutcomes,
  serviceOutcomes,
  filter,
  onFilter,
}: {
  strategicGoals: StrategicGoal[];
  systemOutcomes: SystemOutcome[];
  behaviourOutcomes: BehaviourOutcome[];
  serviceOutcomes: ServiceOutcome[];
  filter: SpineFilter | null;
  onFilter: (f: SpineFilter | null) => void;
}) {
  const toggle = (f: SpineFilter) =>
    filter?.type === f.type && filter.code === f.code ? onFilter(null) : onFilter(f);

  const goalColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    strategicGoals.forEach((g) => { m[g.id] = g.color; });
    return m;
  }, [strategicGoals]);

  const GOAL_COLOR_BADGE: Record<StrategicGoalColor, string> = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    teal: 'bg-teal-100 text-teal-800 border-teal-300',
    rose: 'bg-rose-100 text-rose-800 border-rose-300',
    sky: 'bg-sky-100 text-sky-800 border-sky-300',
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    violet: 'bg-violet-100 text-violet-800 border-violet-300',
    amber: 'bg-amber-100 text-amber-800 border-amber-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
  };

  const byOrder = <T extends { order: number }>(arr: T[]) => [...arr].sort((a, b) => a.order - b.order);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* ENV goals — read-only reference */}
      <div className="px-3 pb-1 pt-3">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Environmental outcomes</p>
        <div className="flex flex-col gap-1">
          {strategicGoals.filter(g => ['Reduce waste','Increase circularity','Prevent waste crime'].some(t => g.title.includes(t))).map((g) => (
            <div key={g.id} className={cn('rounded-lg border px-3 py-1.5 text-[11px] font-semibold', GOAL_COLOR_BADGE[g.color] ?? 'bg-neutral-100 text-neutral-700 border-neutral-200')}>
              {g.title}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-3 my-2 h-px bg-neutral-200" />

      {/* SYS */}
      <div className="px-3 pb-1">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">System conditions</p>
        <div className="flex flex-col gap-0.5">
          {byOrder(systemOutcomes).map((s) => {
            const goalColors = s.goalIds.map((gid) => goalColorMap[gid]).filter(Boolean) as StrategicGoalColor[];
            const activeColor = goalColors[0] ? GOAL_COLOR_BADGE[goalColors[0]] : 'bg-blue-50 text-blue-800 border-blue-200';
            return (
              <SpineNode
                key={s.code}
                code={formatSystemOutcomeCode(s.code)}
                label={s.title.length > 72 ? s.title.slice(0, 72) + '…' : s.title}
                active={filter?.type === 'sys' && filter.code === s.code}
                colorClass={activeColor}
                onClick={() => toggle({ type: 'sys', code: s.code })}
              />
            );
          })}
        </div>
      </div>

      <div className="mx-3 my-2 h-px bg-neutral-200" />

      {/* BEH */}
      <div className="px-3 pb-1">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Behaviour outcomes</p>
        <div className="flex flex-col gap-0.5">
          {byOrder(behaviourOutcomes).map((b) => (
            <SpineNode
              key={b.code}
              code={formatBehaviourOutcomeCode(b.code)}
              label={b.title.length > 72 ? b.title.slice(0, 72) + '…' : b.title}
              sublabel={b.actors.slice(0, 3).join(', ')}
              active={filter?.type === 'beh' && filter.code === b.code}
              colorClass="bg-violet-50 text-violet-800 border-violet-200"
              onClick={() => toggle({ type: 'beh', code: b.code })}
            />
          ))}
        </div>
      </div>

      <div className="mx-3 my-2 h-px bg-neutral-200" />

      {/* SO */}
      <div className="px-3 pb-3">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Strategic service outcomes</p>
        <p className="mb-1.5 text-[10px] text-neutral-400">Click to filter the tree →</p>
        <div className="flex flex-col gap-0.5">
          {byOrder(serviceOutcomes).map((so) => (
            <SpineNode
              key={so.code}
              code={formatServiceOutcomeCode(so.code)}
              label={so.title.length > 72 ? so.title.slice(0, 72) + '…' : so.title}
              active={filter?.type === 'so' && filter.code === so.code}
              colorClass="bg-sky-50 text-sky-800 border-sky-200"
              onClick={() => toggle({ type: 'so', code: so.code })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Journey coverage (L2 → L3 steps under each area) ────────────────────────

function L3StepCard({ step }: { step: L3ServiceStep }) {
  const [open, setOpen] = useState(false);
  const teams = step.productTeams.split(/[;\n]/).map((t) => t.trim()).filter(Boolean);
  return (
    <div className="border-l-2 border-orange-100 pl-3 py-1.5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-2 text-left focus:outline-none">
        <ChevronDown className={cn('mt-0.5 h-3 w-3 shrink-0 text-neutral-400 transition-transform duration-150', !open && '-rotate-90')} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wide text-orange-400">{step.id}</span>
            {teams.slice(0, 2).map((t) => (
              <span key={t} className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium text-orange-600">{t}</span>
            ))}
          </div>
          <p className="mt-0.5 text-[12px] font-semibold leading-snug text-neutral-800">{step.title}</p>
        </div>
      </button>
      {open && (
        <div className="ml-5 mt-1.5 space-y-1.5">
          {step.opportunity && (
            <p className="text-[11px] leading-relaxed text-neutral-600">{step.opportunity}</p>
          )}
          {step.successMeasure && (
            <div className="rounded bg-orange-50 px-2 py-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-orange-500">Success measures</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-orange-800">{step.successMeasure}</p>
            </div>
          )}
          {step.ideas && (
            <div className="rounded bg-neutral-50 px-2 py-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400">Ideas</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-600">{step.ideas}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function L2StepCard({ step, l3Steps }: { step: L2JourneyStep; l3Steps: L3ServiceStep[] }) {
  const [open, setOpen] = useState(true);
  const children = l3StepsForL2(l3Steps, step.id);
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-2 px-3 py-2.5 text-left focus:outline-none">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <span className="text-[9px] font-bold uppercase tracking-wide text-amber-400">{step.id} · L2 Journey step</span>
          <p className="mt-0.5 text-[12px] font-bold text-amber-900">{step.title}</p>
          {step.opportunity && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700">{step.opportunity}</p>
          )}
        </div>
        <ChevronDown className={cn('mt-1 h-3.5 w-3.5 shrink-0 text-amber-400 transition-transform', !open && '-rotate-90')} aria-hidden="true" />
      </button>

      {open && (
        <div className="border-t border-amber-100 px-3 pb-2 pt-1.5 space-y-1">
          {step.ideas && (
            <div className="mb-2 rounded bg-white/70 px-2 py-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-amber-500">Journey ideas</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-700">{step.ideas}</p>
            </div>
          )}
          {children.length > 0 && (
            <div>
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-neutral-400">L3 service steps</p>
              <div className="space-y-1">
                {children.map((l3) => <L3StepCard key={l3.id} step={l3} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function JourneyCoverage({ areaCode }: { areaCode: string }) {
  const [l2Steps, setL2Steps] = useState<L2JourneyStep[]>([]);
  const [l3Steps, setL3Steps] = useState<L3ServiceStep[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([loadL2Steps(), loadL3Steps()]).then(([l2, l3]) => {
      setL2Steps(l2);
      setL3Steps(l3);
      setLoaded(true);
    });
  }, []);

  const matchedL2 = useMemo(
    () => loaded ? l2StepsForAreaCode(l2Steps, areaCode) : [],
    [l2Steps, areaCode, loaded],
  );

  if (!loaded) return null;
  if (matchedL2.length === 0) return null;

  return (
    <div className="border-t border-neutral-100 px-4 pb-3 pt-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <Package className="h-3 w-3 text-amber-500" aria-hidden="true" />
        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Journey coverage</p>
        <span className="text-[10px] text-neutral-400">L2 whole journey → L3 service steps</span>
      </div>
      <div className="space-y-2">
        {matchedL2.map((l2) => <L2StepCard key={l2.id} step={l2} l3Steps={l3Steps} />)}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const MIN_SCALE = 0.1;
const MAX_SCALE = 2.5;

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function OpportunitySolutionTree() {
  const setOstPanelOpen = useBlueprintStore((s) => s.setOstPanelOpen);
  const ostViewMode = useBlueprintStore((s) => s.ostViewMode ?? 'goal-map');
  const setOstViewMode = useBlueprintStore((s) => s.setOstViewMode);
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const readOnly = useBlueprintStore((s) => s.readOnly);
  const flushLocalPersistence = useBlueprintStore((s) => s.flushLocalPersistence);
  const opportunities = useBlueprintStore((s) => s.opportunities);
  const strategicGoals = useBlueprintStore((s) => s.strategicGoals);
  const outcomes = useBlueprintStore((s) => s.outcomes);
  const solutions = useBlueprintStore((s) => s.solutions);
  const assumptions = useBlueprintStore((s) => s.assumptions);
  const systemOutcomes = useBlueprintStore((s) => s.systemOutcomes ?? []);
  const behaviourOutcomes = useBlueprintStore((s) => s.behaviourOutcomes ?? []);
  const serviceOutcomes = useBlueprintStore((s) => s.serviceOutcomes ?? []);
  const spineFilter = useBlueprintStore((s) => s.spineFilter);
  const setSpineFilter = useBlueprintStore((s) => s.setSpineFilter);
  const addStrategicGoal = useBlueprintStore((s) => s.addStrategicGoal);
  const contributionPathOppId = useBlueprintStore((s) => s.contributionPathOppId);
  const contributionPathOpen = contributionPathOppId != null;
  const [spineOpen, setSpineOpen] = useState(false);
  const [ostFoldToGoalsAndAreasGen, setOstFoldToGoalsAndAreasGen] = useState(0);
  const [ostExpandBranchesGen, setOstExpandBranchesGen] = useState(0);
  const [branchesCollapsed, setBranchesCollapsed] = useState(false);
  const [saveMapHint, setSaveMapHint] = useState<'idle' | 'saved'>('idle');
  const [publishState, setPublishState] = useState<'idle' | 'loading'>('idle');
  const [publishToast, setPublishToast] = useState<null | { message: string; variant: 'success' | 'error' }>(null);

  // ── Defra Opportunity Tree tutorial (first-time coach marks) ─────────────
  type DefraCoachStep = 1 | 2 | 3 | 4 | 5;
  const DEFRA_OST_COACH_KEY = 'defra_opportunity_tree_coach_marks_v1';
  const isDefraOst = blueprint.serviceName?.toLowerCase().includes('defra') ?? false;
  const [defraCoachOpen, setDefraCoachOpen] = useState(false);
  const [defraCoachStep, setDefraCoachStep] = useState<DefraCoachStep>(1);
  const [defraCoachRects, setDefraCoachRects] = useState<Array<{ key: string; left: number; top: number; width: number; height: number }>>([]);
  const defraCoachAutoFocusRef = useRef<{ step: DefraCoachStep; targetKey: string } | null>(null);
  // Mirror defraCoachOpen into a ref so the initial fitToView rAF can decide
  // whether to skip without depending on closed-over state.
  const defraCoachOpenRef = useRef(false);
  useEffect(() => { defraCoachOpenRef.current = defraCoachOpen; }, [defraCoachOpen]);

  useEffect(() => {
    if (saveMapHint !== 'saved') return;
    const t = window.setTimeout(() => setSaveMapHint('idle'), 2000);
    return () => window.clearTimeout(t);
  }, [saveMapHint]);

  useEffect(() => {
    if (!publishToast) return;
    const t = window.setTimeout(() => setPublishToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [publishToast]);

  // Start the tutorial once per browser (localStorage) for Defra OST.
  // NOTE: previously gated on `!readOnly` so shared/view links wouldn't show
  // the tutorial. Removed so viewers landing on /view/<id> URLs see it too.
  useEffect(() => {
    if (!isDefraOst) return;
    if (defraCoachOpen) return;
    if ((outcomes?.length ?? 0) === 0) return;
    if ((opportunities?.length ?? 0) === 0) return;

    try {
      const existing = window.localStorage.getItem(DEFRA_OST_COACH_KEY);
      if (existing) return;
    } catch {
      // If localStorage is unavailable, we simply skip the tutorial.
      return;
    }

    setDefraCoachStep(1);
    setDefraCoachOpen(true);
  }, [DEFRA_OST_COACH_KEY, defraCoachOpen, isDefraOst, outcomes, opportunities]);

  // Derive the set of area codes visible under the current filter
  const filteredAreaCodes = useMemo((): Set<string> | null => {
    if (!spineFilter) return null;
    const { type, code } = spineFilter;
    if (type === 'sys') {
      const node = systemOutcomes.find((s) => s.code === code);
      return node ? new Set(node.relatedAreaCodes) : new Set();
    }
    if (type === 'beh') {
      const node = behaviourOutcomes.find((b) => b.code === code);
      return node ? new Set(node.relatedAreaCodes) : new Set();
    }
    if (type === 'so') {
      const node = serviceOutcomes.find((so) => so.code === code);
      return node ? new Set(node.relatedAreaCodes) : new Set();
    }
    return null;
  }, [spineFilter, systemOutcomes, behaviourOutcomes, serviceOutcomes]);

  // ── Canvas transform ────────────────────────────────────────────────────────
  const [transform, setTransformState] = useState({ x: 80, y: 60, scale: 1 });
  const transformRef = useRef({ x: 80, y: 60, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const panStartRef = useRef({ mx: 0, my: 0, origX: 0, origY: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const setTransform = useCallback((t: { x: number; y: number; scale: number }) => {
    const clamped = { ...t, scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale)) };
    transformRef.current = clamped;
    setTransformState(clamped);
  }, []);

  const zoomAt = useCallback((factor: number, vpX: number, vpY: number) => {
    const { x, y, scale } = transformRef.current;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
    const ratio = newScale / scale;
    setTransform({ x: vpX - (vpX - x) * ratio, y: vpY - (vpY - y) * ratio, scale: newScale });
  }, [setTransform]);

  const zoomAtCenter = useCallback((factor: number) => {
    if (!viewportRef.current) return;
    const { clientWidth: w, clientHeight: h } = viewportRef.current;
    zoomAt(factor, w / 2, h / 2);
  }, [zoomAt]);

  const fitToView = useCallback(() => {
    if (!viewportRef.current || !contentRef.current) return;
    const vpW = viewportRef.current.clientWidth;
    const vpH = viewportRef.current.clientHeight;
    const rect = contentRef.current.getBoundingClientRect();
    const naturalW = rect.width / transformRef.current.scale;
    const naturalH = rect.height / transformRef.current.scale;
    if (naturalW === 0 || naturalH === 0) return;
    const pad = 72;
    const newScale = Math.min((vpW - pad * 2) / naturalW, (vpH - pad * 2) / naturalH, 1);
    setTransform({ x: (vpW - naturalW * newScale) / 2, y: pad, scale: newScale });
  }, [setTransform]);

  // Fit to view on first render — but skip if the Defra tutorial is open,
  // because the coach-mark logic will frame a specific card instead.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (defraCoachOpenRef.current) return;
      fitToView();
    }));
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Wheel: pan or zoom ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (contributionPathOpen) {
        if ((e.target as Element | null)?.closest('[data-contribution-path-root]')) return;
        e.preventDefault();
        return;
      }
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+scroll → pan
        const dx = e.deltaMode === 0 ? e.deltaX : e.deltaX * 16;
        const dy = e.deltaMode === 0 ? e.deltaY : e.deltaY * 16;
        const { x, y, scale } = transformRef.current;
        setTransform({ x: x - dx, y: y - dy, scale });
      } else {
        // Plain scroll → zoom at cursor
        const rect = el.getBoundingClientRect();
        const delta = e.deltaMode === 0 ? e.deltaY : e.deltaY * 16;
        zoomAt(Math.pow(0.999, delta), e.clientX - rect.left, e.clientY - rect.top);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, setTransform, contributionPathOpen]);

  // ── Mouse pan ───────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (contributionPathOpen && !(e.target as HTMLElement).closest('[data-contribution-path-root]')) return;
    const target = e.target as HTMLElement;
    const isInteractive = !spaceDown && !!target.closest('button, input, textarea, a, [role="button"]');
    if (isInteractive) return;
    e.preventDefault();
    isPanningRef.current = true;
    setIsPanning(true);
    panStartRef.current = { mx: e.clientX, my: e.clientY, origX: transformRef.current.x, origY: transformRef.current.y };
  }, [spaceDown, contributionPathOpen]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const { mx, my, origX, origY } = panStartRef.current;
    setTransform({ ...transformRef.current, x: origX + (e.clientX - mx), y: origY + (e.clientY - my) });
  }, [setTransform]);

  const onMouseUp = useCallback(() => {
    isPanningRef.current = false;
    setIsPanning(false);
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const inInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable);

      if (e.code === 'Space' && !inInput) { e.preventDefault(); setSpaceDown(true); }
      if (e.key === 'Escape') {
        if (defraCoachOpen) {
          setDefraCoachOpen(false);
          return;
        }
        setOstPanelOpen(false);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !inInput) {
        if (contributionPathOpen) return;
        if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomAtCenter(1.25); }
        if (e.key === '-') { e.preventDefault(); zoomAtCenter(1 / 1.25); }
        if (e.key === '0') { e.preventDefault(); setTransform({ ...transformRef.current, scale: 1 }); }
        if (e.shiftKey && e.key === '0') { e.preventDefault(); fitToView(); }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceDown(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [setOstPanelOpen, zoomAtCenter, setTransform, fitToView, contributionPathOpen, defraCoachOpen]);

  // ── Tree data ───────────────────────────────────────────────────────────────
  const sortedGoals = useMemo(() => [...strategicGoals].sort((a, b) => a.order - b.order), [strategicGoals]);

  const outcomesByGoal = useMemo(() => {
    const map = new Map<string, Outcome[]>();
    for (const o of outcomes) {
      const list = map.get(o.goalId) ?? [];
      list.push(o);
      map.set(o.goalId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order);
    return map;
  }, [outcomes]);

  const opportunitiesByOutcome = useMemo(() => {
    const map = new Map<string, Opportunity[]>();
    for (const opp of opportunities) {
      if (!opp.outcomeId) continue;
      if (opp.parentOpportunityId) continue; // sub-opps are nested inside their parent, not shown at outcome level
      const list = map.get(opp.outcomeId) ?? [];
      list.push(opp);
      map.set(opp.outcomeId, list);
    }
    return map;
  }, [opportunities]);

  const unassigned = useMemo(
    () => opportunities.filter((o) => !o.parentOpportunityId && (!o.outcomeId || !outcomes.some((out) => out.id === o.outcomeId))),
    [opportunities, outcomes],
  );

  const handleAddGoal = useCallback(() => {
    const nextOrder = sortedGoals.length > 0 ? sortedGoals[sortedGoals.length - 1].order + 1 : 0;
    addStrategicGoal({ title: 'New goal', color: 'violet', order: nextOrder });
  }, [sortedGoals, addStrategicGoal]);

  const handleSaveMap = useCallback(() => {
    flushLocalPersistence();
    setSaveMapHint('saved');
  }, [flushLocalPersistence]);

  const handlePublishViewerLink = useCallback(async () => {
    setPublishState('loading');
    try {
      const store = useBlueprintStore.getState();
      const existingShareId = store.blueprint.publishedShareId;
      const { id, storyboardImagesStripped, shareTextTrimmed } = await publishOrRefreshShare(
        store.getPersistableDocument(),
        existingShareId,
      );
      if (!existingShareId || id !== existingShareId) {
        store.setPublishedShareId(id);
      }
      const shareUrl = `${window.location.origin}/view/${encodeURIComponent(id)}`;
      await copyTextToClipboard(shareUrl);
      let message: string;
      if (storyboardImagesStripped || shareTextTrimmed) {
        const parts: string[] = [];
        if (storyboardImagesStripped) parts.push('storyboard images were not included');
        if (shareTextTrimmed) parts.push('some text was shortened');
        message = `${parts.join('; ')} (share size limit). Link copied.`;
      } else {
        message = 'Viewer link copied. Refresh the page to see the latest map.';
      }
      setPublishToast({ message, variant: 'success' });
    } catch (err) {
      setPublishToast({
        message: err instanceof Error ? err.message : 'Could not publish.',
        variant: 'error',
      });
    } finally {
      setPublishState('idle');
    }
  }, []);

  const hasSpineData = systemOutcomes.length > 0 || behaviourOutcomes.length > 0 || serviceOutcomes.length > 0;

  // When a filter is active, filter outcomes per goal
  const filteredOutcomesByGoal = useMemo(() => {
    if (!filteredAreaCodes) return outcomesByGoal;
    const map = new Map<string, Outcome[]>();
    for (const [goalId, outs] of outcomesByGoal) {
      const visible = outs.filter((o) => !o.code || filteredAreaCodes.has(o.code));
      if (visible.length > 0) map.set(goalId, visible);
    }
    return map;
  }, [filteredAreaCodes, outcomesByGoal]);

  const isEmpty = sortedGoals.length === 0 && unassigned.length === 0;

  // ── Cursor class ────────────────────────────────────────────────────────────
  const cursorClass = contributionPathOpen
    ? 'cursor-default'
    : isPanning || spaceDown
      ? 'cursor-grabbing'
      : 'cursor-grab';

  const coachTargetsForStep = useMemo(() => {
    if (!defraCoachOpen) return [];
    if ((outcomes?.length ?? 0) === 0) return [];
    if ((opportunities?.length ?? 0) === 0) return [];

    const updatedMs = (s: { updatedAt: string }) => {
      const t = new Date(s.updatedAt).getTime();
      return Number.isFinite(t) ? t : 0;
    };

    const sortedOutcomes = [...outcomes]
      .filter((o) => typeof o.code === 'string' && o.code.length > 0)
      .sort((a, b) => a.order - b.order);
    const priorityOutcomeCode = sortedOutcomes[0]?.code ?? null;

    const rootOpps = [...opportunities]
      .filter((o) => !o.parentOpportunityId)
      .sort((a, b) => updatedMs(b) - updatedMs(a));
    const rootOpp = rootOpps[0] ?? null;

    const productFindingOpps = rootOpp
      ? [...opportunities]
          .filter((o) => o.parentOpportunityId === rootOpp.id)
          .sort((a, b) => updatedMs(b) - updatedMs(a))
      : [];
    const productFindingOpp = productFindingOpps[0] ?? null;

    const solutionOpportunityId = productFindingOpp?.id ?? rootOpp?.id ?? null;
    const solutionsForOpportunity = solutionOpportunityId
      ? [...solutions].filter((s) => s.opportunityId === solutionOpportunityId).sort((a, b) => updatedMs(b) - updatedMs(a))
      : [];
    const firstSolution = solutionsForOpportunity[0] ?? null;

    const solutionFallback = solutions.length > 0
      ? [...solutions].sort((a, b) => updatedMs(b) - updatedMs(a))[0]
      : null;
    const solutionIdForAssumption = firstSolution?.id ?? solutionFallback?.id ?? null;

    const assumptionsForSolution = solutionIdForAssumption
      ? [...assumptions].filter((a) => a.solutionId === solutionIdForAssumption).sort((a, b) => updatedMs(b) - updatedMs(a))
      : [];
    const firstAssumption = assumptionsForSolution[0] ?? null;

    const targets: Array<{ key: string; selector: string; zoomSelector?: string }> = [];
    if (defraCoachStep === 1 && priorityOutcomeCode) {
      targets.push({
        key: 'priority-star',
        selector: `[data-defra-coach-target="priority-star"][data-defra-coach-outcome-code="${priorityOutcomeCode}"]`,
        // Step 1 zooms to the surrounding opportunity area card (close-up)
        // while keeping the highlight + mouse pointer on the star itself.
        zoomSelector: `[data-defra-coach-target="outcome-card"][data-defra-coach-outcome-code="${priorityOutcomeCode}"]`,
      });
    }

    if (defraCoachStep === 2 && rootOpp) {
      targets.push({
        key: 'contribution-path',
        selector: `[data-defra-coach-target="contribution-path"][data-defra-coach-opportunity-id="${rootOpp.id}"]`,
      });
    }

    if (defraCoachStep === 3 && rootOpp) {
      if (productFindingOpp) {
        targets.push({
          key: 'product-team-card',
          selector: `[data-defra-coach-target="product-team-finding-card"][data-defra-coach-opportunity-id="${productFindingOpp.id}"]`,
        });
      } else {
        targets.push({
          key: 'product-team-add',
          selector: `[data-defra-coach-target="product-team-finding-add"][data-defra-coach-opportunity-id="${rootOpp.id}"]`,
        });
      }
    }

    if (defraCoachStep === 4 && solutionOpportunityId) {
      if (firstSolution) {
        targets.push({
          key: 'solution-card',
          selector: `[data-defra-coach-target="solution-card"][data-defra-coach-solution-id="${firstSolution.id}"]`,
        });
        targets.push({
          key: 'solution-status',
          selector: `[data-defra-coach-target="solution-status"][data-defra-coach-solution-id="${firstSolution.id}"]`,
        });
      } else {
        targets.push({
          key: 'solution-add',
          selector: `[data-defra-coach-target="solution-add"][data-defra-coach-opportunity-id="${solutionOpportunityId}"]`,
        });
      }
    }

    if (defraCoachStep === 5 && solutionIdForAssumption) {
      if (firstAssumption) {
        targets.push({
          key: 'assumption-card',
          selector: `[data-defra-coach-target="assumption-card"][data-defra-coach-assumption-id="${firstAssumption.id}"]`,
        });
        targets.push({
          key: 'assumption-status',
          selector: `[data-defra-coach-target="assumption-status"][data-defra-coach-assumption-id="${firstAssumption.id}"]`,
        });
      } else {
        targets.push({
          key: 'assumption-add',
          selector: `[data-defra-coach-target="assumption-add"][data-defra-coach-solution-id="${solutionIdForAssumption}"]`,
        });
      }
    }

    return targets;
  }, [defraCoachOpen, defraCoachStep, outcomes, opportunities, solutions, assumptions]);

  // Force-highlight targeted controls while coach marks are open.
  useLayoutEffect(() => {
    if (!defraCoachOpen) {
      setDefraCoachRects([]);
      return;
    }

    const highlightClass = 'defra-coach-highlight-visible';

    const compute = () => {
      const rects: Array<{ key: string; left: number; top: number; width: number; height: number }> = [];

      for (const t of coachTargetsForStep) {
        const el = document.querySelector(t.selector) as HTMLElement | null;
        if (!el) continue;

        el.classList.add(highlightClass);
        const r = el.getBoundingClientRect();
        rects.push({
          key: t.key,
          left: r.left,
          top: r.top,
          width: Math.max(1, r.width),
          height: Math.max(1, r.height),
        });
      }

      // Remove highlight from previously targeted elements that no longer match.
      // (This keeps the UI clean when step changes.)
      for (const t of coachTargetsForStep) {
        const el = document.querySelector(t.selector) as HTMLElement | null;
        if (!el) continue;
        // no-op: we already added highlightClass above
      }

      setDefraCoachRects(rects);
    };

    compute();

    const onResize = () => compute();
    window.addEventListener('resize', onResize);

    return () => {
      for (const t of coachTargetsForStep) {
        const el = document.querySelector(t.selector) as HTMLElement | null;
        if (!el) continue;
        el.classList.remove(highlightClass);
      }
      setDefraCoachRects([]);
      window.removeEventListener('resize', onResize);
    };
  }, [defraCoachOpen, defraCoachStep, coachTargetsForStep, transform.x, transform.y, transform.scale]);

  // When stepping through coach marks, auto-pan/zoom so the highlighted control is in view.
  useLayoutEffect(() => {
    if (!defraCoachOpen) return;
    if (contributionPathOpen) return;
    const vp = viewportRef.current;
    if (!vp) return;
    const primaryTarget = coachTargetsForStep[0];
    if (!primaryTarget) return;
    // Use zoomSelector when present so we can frame a larger surrounding element
    // (e.g. an entire card) while still highlighting a smaller control inside it.
    const zoomSelector = (primaryTarget as { zoomSelector?: string }).zoomSelector ?? primaryTarget.selector;
    const el = document.querySelector(zoomSelector) as HTMLElement | null;
    if (!el) return;

    const vpRect = vp.getBoundingClientRect();
    const pad = 64;

    const r = el.getBoundingClientRect();
    const primary = {
      key: primaryTarget.key,
      left: r.left,
      top: r.top,
      width: Math.max(1, r.width),
      height: Math.max(1, r.height),
    };

    const targetCx = primary.left + primary.width / 2;
    const targetCy = primary.top + primary.height / 2;

    const withinX = primary.left >= vpRect.left + pad && (primary.left + primary.width) <= vpRect.right - pad;
    const withinY = primary.top >= vpRect.top + pad && (primary.top + primary.height) <= vpRect.bottom - pad;

    const currentScale = transformRef.current.scale;
    const targetPx = Math.max(primary.width, primary.height);
    const isCardTarget = (primary.key ?? '').includes('card');

    // Cards benefit from a stronger zoom-in to make the full card readable.
    const minCardScale = 1.15;
    const minBoostedScale = isCardTarget ? minCardScale : 0.85;

    let desiredScale = currentScale;
    if (targetPx < (isCardTarget ? 220 : 26)) {
      desiredScale = Math.min(MAX_SCALE, Math.max(currentScale * (isCardTarget ? 1.55 : 1.35), minBoostedScale));
    }
    if (targetPx > 110) desiredScale = Math.max(MIN_SCALE, Math.min(currentScale / 1.25, 1));

    // Step 1 wants a close-up of the opportunity area card — override the
    // generic heuristic above and force a larger, readable scale.
    if (defraCoachStep === 1) {
      desiredScale = Math.min(MAX_SCALE, 1.6);
    }

    // Guard against infinite loops: auto-focus only once per step+target key
    // (unless the target isn't yet in a good viewport position).
    const focusKey = `${defraCoachStep}:${primary.key}`;
    const alreadyFocused = defraCoachAutoFocusRef.current?.step === defraCoachStep
      && defraCoachAutoFocusRef.current?.targetKey === focusKey;
    const needsWork = !withinX || !withinY || Math.abs(desiredScale - currentScale) > 0.06;
    if (alreadyFocused && !needsWork) return;

    // Step 1 special-case: pan the card to the LEFT side of the viewport so
    // the centered tutorial bubble at the top doesn't cover it. We also do
    // pan + zoom in a single composed pass so the final card position lands
    // exactly where we want (the generic pan-then-zoom path below zooms on
    // the pre-pan target position, which causes drift).
    if (defraCoachStep === 1) {
      // Where on screen we want the card centred (in viewport-local coords).
      // 28% from the left clears the 520px bubble centred at the top on
      // typical 1440-wide+ screens. Pulled inward on smaller screens.
      const desiredLocalX = vpRect.width * 0.28;
      const desiredLocalY = vpRect.height * 0.5;

      // 1) Pan the card centre to (desiredLocalX, desiredLocalY).
      const desiredCx = vpRect.left + desiredLocalX;
      const desiredCy = vpRect.top + desiredLocalY;
      const dx = desiredCx - targetCx;
      const dy = desiredCy - targetCy;
      setTransform({
        ...transformRef.current,
        x: transformRef.current.x + dx,
        y: transformRef.current.y + dy,
      });

      // 2) Zoom centred on the new card position so the pan is preserved.
      const factor = desiredScale / transformRef.current.scale;
      if (Math.abs(factor - 1) > 0.04) {
        zoomAt(factor, desiredLocalX, desiredLocalY);
      }

      defraCoachAutoFocusRef.current = { step: defraCoachStep, targetKey: focusKey };
      return;
    }

    // Pan to center if needed.
    if (!withinX || !withinY) {
      const desiredCx = vpRect.left + vpRect.width / 2;
      const desiredCy = vpRect.top + vpRect.height / 2;
      const dx = desiredCx - targetCx;
      const dy = desiredCy - targetCy;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        setTransform({ ...transformRef.current, x: transformRef.current.x + dx, y: transformRef.current.y + dy });
      }
    }

    if (Math.abs(desiredScale - currentScale) > 0.06) {
      const vpX = targetCx - vpRect.left;
      const vpY = targetCy - vpRect.top;
      zoomAt(desiredScale / currentScale, vpX, vpY);
    }
    defraCoachAutoFocusRef.current = { step: defraCoachStep, targetKey: focusKey };
  }, [defraCoachOpen, defraCoachStep, coachTargetsForStep, contributionPathOpen, zoomAt, setTransform]);

  const coachStepCopy: Record<DefraCoachStep, { title: string; body: string; nextLabel: string }> = {
    1: {
      title: 'Opportunity areas with strong evidence and leverage',
      body: 'Click the star next to an Opportunity area to mark it as strong leverage points. Enter description to explain rationale.',
      nextLabel: 'Next',
    },
    2: {
      title: 'View contribution path',
      body: 'On an opportunity card, click the route icon to open the contribution chain (line of sight to environmental outcomes).',
      nextLabel: 'Next',
    },
    3: {
      title: 'Add product team finding',
      body: 'Under the Opportunity card, use “Add product team finding” to capture product-delivery insights.',
      nextLabel: 'Next',
    },
    4: {
      title: 'Add a solution',
      body: 'Use “Add solution” to capture ideas to test, you can also set the move the status from Ideation to the right lifecycle stage.',
      nextLabel: 'Next',
    },
    5: {
      title: 'Add an assumption',
      body: 'Use “Add assumption” under a solution to set the assumption status (Untested → Validated/Invalidated).',
      nextLabel: 'Finish tutorial',
    },
  };

  const coachStep = coachStepCopy[defraCoachStep];
  const coachTargetsFound = defraCoachRects.length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex min-h-0 flex-col bg-neutral-100" role="dialog" aria-modal="true" aria-label="Opportunity tree">

      {publishToast ? (
        <div
          role="status"
          aria-live={publishToast.variant === 'error' ? 'assertive' : 'polite'}
          className={cn(
            'pointer-events-none fixed left-1/2 top-4 z-[70] flex max-w-md -translate-x-1/2 items-start gap-2.5 rounded-lg border bg-white px-4 py-3 text-[13px] leading-snug shadow-lg',
            publishToast.variant === 'error'
              ? 'border-red-200 text-red-900'
              : 'border-neutral-200 text-neutral-900',
          )}
        >
          {publishToast.variant === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          ) : (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          )}
          <p className="min-w-0 flex-1">{publishToast.message}</p>
        </div>
      ) : null}

      {defraCoachOpen && (
        <>
          <style>{`
            .defra-coach-highlight-visible { opacity: 1 !important; }
            @keyframes defraCoachMouseFloat {
              0%, 100% { transform: translate3d(0, 0, 0); }
              50% { transform: translate3d(0, -6px, 0); }
            }
          `}</style>

          {/* Visual highlights (non-blocking) */}
          <div className="pointer-events-none fixed inset-0 z-[85]" aria-hidden="true">
            {defraCoachRects.map((r) => (
              <div
                key={r.key}
                className="absolute rounded-xl border-2 border-amber-300 bg-amber-200/15 shadow-xl"
                style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
              />
            ))}

            {defraCoachRects[0] ? (() => {
              const r = defraCoachRects[0];
              // Position pointer near the bottom-right of the highlighted element.
              // Keep a small offset so it doesn't occlude the control.
              const mx = Math.max(12, r.left + r.width - 10);
              const my = Math.max(12, r.top + r.height - 10);
              return (
                <>
                  {/* Mouse pointer */}
                  <div
                    className="absolute"
                    style={{
                      left: mx,
                      top: my,
                      animation: 'defraCoachMouseFloat 1.6s ease-in-out infinite',
                      filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.18))',
                    }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M4 3l7.2 16.3 2.3-6.2 6.2 2.3L4 3z"
                        fill="white"
                        stroke="rgba(120,113,108,0.8)"
                        strokeWidth="1"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </>
              );
            })() : null}
          </div>

          {/* Coach bubble */}
          <div
            role="dialog"
            aria-modal="false"
            aria-label="Defra opportunity tree tutorial"
            className="fixed left-1/2 top-24 z-[90] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 pointer-events-auto"
          >
            <div className="rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur">
              <div className="flex items-start gap-3">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                    GETTING STARTED {defraCoachStep} / 5
                  </p>
                  <p className="mt-1 text-[14px] font-bold text-neutral-900">{coachStep.title}</p>
                  <p className="mt-1 text-[12.5px] leading-snug text-neutral-700">{coachStep.body}</p>

                  {!coachTargetsFound && defraCoachStep !== 4 && defraCoachStep !== 5 && (
                    <p className="mt-2 text-[12px] leading-snug text-neutral-500">
                      Tip: expand branches / scroll until you see the highlighted control.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.localStorage.setItem(DEFRA_OST_COACH_KEY, 'done');
                    } catch {
                      // ignore
                    }
                    setDefraCoachOpen(false);
                  }}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  Skip
                </button>

                <div className="flex items-center gap-2">
                  {defraCoachStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => { defraCoachAutoFocusRef.current = null; setDefraCoachStep((s) => (s > 1 ? ((s - 1) as DefraCoachStep) : s)); }}
                      className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      Back
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      if (defraCoachStep >= 5) {
                        try {
                          window.localStorage.setItem(DEFRA_OST_COACH_KEY, 'done');
                        } catch {
                          // ignore
                        }
                        setDefraCoachOpen(false);
                        return;
                      }
                      defraCoachAutoFocusRef.current = null;
                      setDefraCoachStep((s) => (s < 5 ? ((s + 1) as DefraCoachStep) : s));
                    }}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    {defraCoachStep >= 5 ? coachStep.nextLabel : 'Next'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Header ── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-6 py-3.5">
        <GitBranch className="h-5 w-5 text-violet-500" aria-hidden="true" />
        <div>
          <h2 className="text-[15px] font-bold leading-tight text-neutral-900">Opportunity tree</h2>
          <p className="text-[12px] text-neutral-500">{blueprint.serviceName}</p>
        </div>
        <div className="flex-1" />
        {hasSpineData && (
          <button
            onClick={() => setSpineOpen((v) => !v)}
            title={spineOpen ? 'Hide strategy filter' : 'Filter by strategy node'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
              spineOpen ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
              spineFilter && 'ring-2 ring-sky-300',
            )}
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            Filter
            {spineFilter && <span className="ml-1 rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{spineFilter.code}</span>}
          </button>
        )}
        {/* View mode toggle */}
        <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          <button
            onClick={() => setOstViewMode('goal-map')}
            title="Goal map"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors focus:outline-none',
              ostViewMode === 'goal-map'
                ? 'bg-white text-neutral-800 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700',
            )}
          >
            <GitBranch className="h-3 w-3" aria-hidden="true" /> Goal map
          </button>
          {/* Contribution chains button — temporarily hidden, uncomment to restore
          <button
            onClick={() => setOstViewMode('contribution-chain')}
            title="Contribution chains"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors focus:outline-none',
              ostViewMode === 'contribution-chain'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700',
            )}
          >
            <Network className="h-3 w-3" aria-hidden="true" /> Contribution chains
          </button>
          */}
        </div>
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={handleSaveMap}
              title="Save this map to this browser (same as automatic save; confirms localStorage is up to date)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors"
            >
              {saveMapHint === 'saved' ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {saveMapHint === 'saved' ? 'Saved' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => void handlePublishViewerLink()}
              disabled={publishState === 'loading'}
              title={
                blueprint.publishedShareId
                  ? 'Upload the latest map and copy the same viewer link'
                  : 'Create a viewer link and copy it; use again after edits to update what people see'
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                publishState === 'loading' && 'cursor-wait opacity-80',
              )}
            >
              {publishState === 'loading' ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
              ) : (
                <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              Publish link
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            if (branchesCollapsed) {
              setOstExpandBranchesGen((g) => g + 1);
              setBranchesCollapsed(false);
              return;
            }
            setOstFoldToGoalsAndAreasGen((g) => g + 1);
            setBranchesCollapsed(true);
          }}
          title={
            branchesCollapsed
              ? 'Show opportunity, solution, and assumption branches again.'
              : 'Hide opportunity, solution, and assumption branches. Keeps environmental outcome and opportunity area cards visible; expand any branch again from its stem.'
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors"
        >
          <ChevronsUp className={cn('h-3.5 w-3.5 shrink-0 transition-transform', branchesCollapsed && 'rotate-180')} aria-hidden="true" />
          {branchesCollapsed ? 'Expand branches' : 'Collapse branches'}
        </button>
        <button onClick={() => setOstPanelOpen(false)} aria-label="Close"
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {/* ── Contribution chain view (full-screen overlay within OST) ── */}
      {ostViewMode === 'contribution-chain' && (
        <ContributionChainView onClose={() => setOstViewMode('goal-map')} />
      )}

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">

        {/* Strategy filter spine */}
        {hasSpineData && spineOpen && (
          <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-4 py-2.5">
              <span className="block text-[12px] font-semibold text-neutral-700">Filter by strategy</span>
              {spineFilter && (
                <button onClick={() => setSpineFilter(null)} className="rounded px-1.5 py-0.5 text-[10px] font-medium text-sky-600 hover:bg-sky-50 focus:outline-none">Clear</button>
              )}
            </div>
            <StrategySpine
              strategicGoals={strategicGoals}
              systemOutcomes={systemOutcomes}
              behaviourOutcomes={behaviourOutcomes}
              serviceOutcomes={serviceOutcomes}
              filter={spineFilter}
              onFilter={setSpineFilter}
            />
          </aside>
        )}

      <div
        ref={viewportRef}
        className={cn('relative min-w-0 flex-1 overflow-hidden select-none', cursorClass)}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >

        {/* Transformed tree content */}
        <div
          ref={contentRef}
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            position: 'absolute',
            top: 0,
            left: 0,
            willChange: 'transform',
            cursor: isPanning || spaceDown ? 'grabbing' : 'default',
          }}
        >
          {isEmpty ? (
            <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-10" style={{ width: 360 }}>
                  <Target className="mx-auto mb-3 h-8 w-8 text-neutral-300" aria-hidden="true" />
                  <p className="text-[14px] font-semibold text-neutral-600">No goals yet</p>
                  <p className="mt-1 text-[12px] text-neutral-400">Add a strategic goal to start mapping how outcomes, opportunities, solutions and assumptions connect.</p>
                  <button onClick={handleAddGoal}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors">
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add first goal
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <OstFoldToGoalsAndAreasGenContext.Provider value={ostFoldToGoalsAndAreasGen}>
            <OstExpandBranchesGenContext.Provider value={ostExpandBranchesGen}>
            <div className="p-20 pb-32">
              <div className="flex items-start gap-16">
                {sortedGoals.map((goal) => (
                  <GoalSubtree
                    key={goal.id}
                    goal={goal}
                    outcomes={outcomesByGoal.get(goal.id) ?? []}
                    allGoals={sortedGoals}
                    allOutcomes={outcomes}
                    opportunitiesByOutcome={opportunitiesByOutcome}
                  />
                ))}
                <div className="flex flex-col items-center">
                  <button onClick={handleAddGoal}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-neutral-300 bg-white/70 py-6 text-[12px] font-medium text-neutral-400 transition-colors hover:border-violet-300 hover:bg-violet-50/60 hover:text-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                    style={{ width: CARD_W }}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add goal
                  </button>
                </div>
              </div>

              {unassigned.length > 0 && (
                <div className="mt-24 flex flex-col items-center border-t-2 border-dashed border-neutral-300 pt-14">
                  <UnassignedSection opportunities={unassigned} goals={sortedGoals} outcomes={outcomes} />
                </div>
              )}
            </div>
            </OstExpandBranchesGenContext.Provider>
            </OstFoldToGoalsAndAreasGenContext.Provider>
          )}
        </div>

        {/* ── Zoom controls (bottom-right) ── */}
        <div className="absolute bottom-5 right-5 flex items-center gap-0.5 rounded-xl border border-neutral-200 bg-white px-1 py-1 shadow-md">
          <button
            onClick={() => zoomAtCenter(1 / 1.25)}
            title="Zoom out (⌘−)"
            aria-label="Zoom out"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={() => setTransform({ ...transformRef.current, scale: 1 })}
            title="Reset zoom to 100% (⌘0)"
            aria-label="Reset zoom"
            className="h-7 min-w-[48px] rounded-lg px-1 text-center text-[12px] font-semibold tabular-nums text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors"
          >
            {Math.round(transform.scale * 100)}%
          </button>
          <button
            onClick={() => zoomAtCenter(1.25)}
            title="Zoom in (⌘+)"
            aria-label="Zoom in"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div className="mx-1 h-4 w-px bg-neutral-200" />
          <button
            onClick={fitToView}
            title="Fit to view (⌘⇧0)"
            aria-label="Fit to view"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* ── Controls hint (bottom-left) ── */}
        <div className="pointer-events-none absolute bottom-6 left-5 flex items-center gap-3 text-[11px] text-neutral-400">
          <span>Scroll to zoom</span>
          <span>·</span>
          <span>Drag to pan</span>
          <span>·</span>
          <span>Space+drag to pan over cards</span>
        </div>

        {/* ── Dim board + block pointer events; contribution path stays above (z-70) ── */}
        {contributionPathOpen && (
          <div
            className="pointer-events-auto absolute inset-0 z-[65] bg-black/40 supports-backdrop-filter:backdrop-blur-xs"
            aria-hidden="true"
          />
        )}

        {/* ── Contribution path panel — slides in from right when an opp is selected ── */}
        <ContributionPathPanel />
      </div>

      </div>{/* end body */}
    </div>
  );
}
