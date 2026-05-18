'use client';

/**
 * AiImportDialog
 *
 * Multi-step import workflow for messy/unstructured source material.
 *
 * Steps:
 *   upload     — file drop-zone or paste text area
 *   extracting — brief parsing spinner
 *   mapping    — AI mapping service runs (mock by default)
 *   review     — editable row-by-row review before commit
 *   done       — success confirmation
 *
 * The AI output NEVER writes directly to the store; it always goes through
 * the review step first. Only the user-confirmed commit triggers loadBlueprint.
 */

import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Upload,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  ClipboardPaste,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseXlsx, type SheetInfo } from '@/lib/import/parse';
import {
  extractFromCsv,
  extractFromXlsx,
  extractFromPastedText,
  type ExtractedRow,
} from '@/lib/import/extract';
import { MockImportMappingService } from '@/lib/import/mock-mapping-service';
import type { MappedRow, RowRecordType, ReviewStatus } from '@/lib/import/mapping-types';
import { commitMappedRows } from '@/lib/import/commit';
import { useBlueprintStore } from '@/store/blueprint-store';
import { LANE_KEYS, type LaneKey } from '@/lib/types';
import { LANE_TITLE_MAP } from '@/lib/lane-definitions';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AiImportStep = 'upload' | 'sheet-select' | 'extracting' | 'mapping' | 'review' | 'done';
type InputMode = 'file' | 'paste';
type RowFilter = 'all' | 'cards' | 'needs_attention' | 'accepted' | 'rejected';

interface AiImportDialogProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAPPING_SERVICE = new MockImportMappingService();

function confidenceColor(conf: number): string {
  if (conf >= 0.75) return 'bg-emerald-100 text-emerald-700';
  if (conf >= 0.5) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function confidenceLabel(conf: number): string {
  if (conf >= 0.75) return `${Math.round(conf * 100)}%`;
  if (conf >= 0.5) return `${Math.round(conf * 100)}%`;
  return `${Math.round(conf * 100)}%`;
}

function recordTypeBadge(type: RowRecordType): { label: string; className: string } {
  switch (type) {
    case 'card_row':
      return { label: 'card', className: 'bg-blue-100 text-blue-700' };
    case 'structure_row':
      return { label: 'structure', className: 'bg-purple-100 text-purple-700' };
    case 'noise_row':
      return { label: 'noise', className: 'bg-neutral-100 text-neutral-500' };
  }
}

function truncate(text: string, max: number): string {
  if (!text) return '—';
  return text.length <= max ? text : text.slice(0, max) + '…';
}

const RECORD_TYPE_OPTIONS: RowRecordType[] = ['card_row', 'structure_row', 'noise_row'];
const RECORD_TYPE_LABELS: Record<RowRecordType, string> = {
  card_row: 'card',
  structure_row: 'structure',
  noise_row: 'noise',
};

// ---------------------------------------------------------------------------
// Row editor component
// ---------------------------------------------------------------------------

interface RowEditorProps {
  row: MappedRow;
  index: number;
  onChange: (id: string, patch: Partial<MappedRow>) => void;
}

function RowEditor({ row, index, onChange }: RowEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const resolved = {
    recordType: row.editedRecordType ?? row.proposedRecordType,
    stage: row.editedStage ?? row.proposedStage,
    step: row.editedStep ?? row.proposedStep,
    laneKey: row.editedLaneKey !== undefined ? row.editedLaneKey : row.proposedLaneKey,
    cardTitle: row.editedCardTitle ?? row.proposedCardTitle,
    cardBody: row.editedCardBody ?? row.proposedCardBody,
  };

  const isRejected = row.reviewStatus === 'rejected';
  const isAccepted = row.reviewStatus === 'accepted';
  const isCard = resolved.recordType === 'card_row';
  const needsAttention = isCard && (row.confidence < 0.5 || row.flags.length > 0);
  const { label: typeLabel, className: typeClassName } = recordTypeBadge(resolved.recordType);

  return (
    <div
      className={cn(
        'rounded-lg border text-[12px] transition-colors',
        isRejected
          ? 'border-neutral-200 bg-neutral-50 opacity-50'
          : needsAttention
            ? 'border-amber-200 bg-amber-50/40'
            : isAccepted
              ? 'border-emerald-200 bg-emerald-50/30'
              : 'border-neutral-200 bg-white',
      )}
    >
      {/* ── Compact row ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Row number */}
        <span className="w-8 shrink-0 text-center text-[11px] text-neutral-400">
          {row.sourceRow.sourceRowNumber}
        </span>

        {/* Record type badge */}
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold',
            typeClassName,
          )}
        >
          {typeLabel}
        </span>

        {/* Stage → Step breadcrumb */}
        {isCard && (
          <span className="w-36 shrink-0 truncate text-[11px] text-neutral-500">
            {truncate(resolved.stage, 14)}
            {resolved.step !== resolved.stage && (
              <>
                <span className="mx-0.5 text-neutral-300">/</span>
                {truncate(resolved.step, 14)}
              </>
            )}
          </span>
        )}

        {/* Lane key */}
        {isCard && (
          <span className="w-28 shrink-0 truncate text-[11px] font-medium text-neutral-700">
            {resolved.laneKey
              ? LANE_TITLE_MAP[resolved.laneKey as LaneKey] ?? resolved.laneKey
              : <span className="text-red-500 italic">no lane</span>}
          </span>
        )}

        {/* Title / content preview */}
        <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-800">
          {isCard
            ? truncate(resolved.cardTitle || row.sourceRow.rawText, 80)
            : truncate(row.sourceRow.rawText, 80)}
        </span>

        {/* Confidence */}
        {isCard && (
          <span
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold',
              confidenceColor(row.confidence),
            )}
          >
            {confidenceLabel(row.confidence)}
          </span>
        )}

        {/* Flags indicator */}
        {row.flags.length > 0 && (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        )}

        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          aria-label={expanded ? 'Collapse row' : 'Expand row'}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Accept / reject toggles */}
        <div className="flex shrink-0 gap-0.5">
          <button
            onClick={() =>
              onChange(row.id, {
                reviewStatus: isAccepted ? 'pending' : 'accepted',
              })
            }
            title={isAccepted ? 'Accepted — click to reset' : 'Accept this row'}
            className={cn(
              'rounded p-1 transition-colors',
              isAccepted
                ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                : 'text-neutral-300 hover:bg-neutral-100 hover:text-emerald-500',
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() =>
              onChange(row.id, {
                reviewStatus: isRejected ? 'pending' : 'rejected',
              })
            }
            title={isRejected ? 'Rejected — click to restore' : 'Reject this row'}
            className={cn(
              'rounded p-1 transition-colors',
              isRejected
                ? 'bg-red-100 text-red-500 hover:bg-red-200'
                : 'text-neutral-300 hover:bg-neutral-100 hover:text-red-400',
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Expanded editor ──────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-neutral-100 px-3 py-3">
          {/* Source preview */}
          <div className="mb-3 rounded bg-neutral-50 px-2 py-1.5">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Source row {row.sourceRow.sourceRowNumber} · {row.sourceRow.sourceSheetOrPage}
            </p>
            <p className="break-all text-[11px] text-neutral-600">{row.sourceRow.rawText || '(empty)'}</p>
          </div>

          {/* Flags */}
          {row.flags.length > 0 && (
            <div className="mb-3 flex flex-col gap-1">
              {row.flags.map((f, i) => (
                <p key={i} className="flex items-start gap-1 text-[11px] text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {f}
                </p>
              ))}
            </div>
          )}

          {/* Edit fields */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {/* Record type */}
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Type
              </span>
              <select
                value={resolved.recordType}
                onChange={(e) =>
                  onChange(row.id, { editedRecordType: e.target.value as RowRecordType })
                }
                className="rounded border border-neutral-200 bg-white px-2 py-1 text-[12px] text-neutral-700 focus:border-blue-400 focus:outline-none"
              >
                {RECORD_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {RECORD_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>

            {/* Stage */}
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Stage
              </span>
              <input
                type="text"
                value={resolved.stage}
                onChange={(e) => onChange(row.id, { editedStage: e.target.value })}
                className="rounded border border-neutral-200 bg-white px-2 py-1 text-[12px] text-neutral-700 focus:border-blue-400 focus:outline-none"
              />
            </label>

            {/* Step */}
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Step
              </span>
              <input
                type="text"
                value={resolved.step}
                onChange={(e) => onChange(row.id, { editedStep: e.target.value })}
                className="rounded border border-neutral-200 bg-white px-2 py-1 text-[12px] text-neutral-700 focus:border-blue-400 focus:outline-none"
              />
            </label>

            {/* Lane key */}
            <label className="flex flex-col gap-0.5 sm:col-span-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Lane
              </span>
              <select
                value={resolved.laneKey}
                onChange={(e) =>
                  onChange(row.id, { editedLaneKey: e.target.value as LaneKey | '' })
                }
                className={cn(
                  'rounded border bg-white px-2 py-1 text-[12px] focus:border-blue-400 focus:outline-none',
                  !resolved.laneKey ? 'border-red-300 text-red-500' : 'border-neutral-200 text-neutral-700',
                )}
              >
                <option value="">— assign lane —</option>
                {LANE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {LANE_TITLE_MAP[k]}
                  </option>
                ))}
              </select>
            </label>

            {/* Title */}
            <label className="flex flex-col gap-0.5 sm:col-span-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Card title
              </span>
              <input
                type="text"
                value={resolved.cardTitle}
                onChange={(e) => onChange(row.id, { editedCardTitle: e.target.value })}
                className="rounded border border-neutral-200 bg-white px-2 py-1 text-[12px] text-neutral-700 focus:border-blue-400 focus:outline-none"
              />
            </label>

            {/* Body */}
            <label className="flex flex-col gap-0.5 sm:col-span-3">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Card body (optional)
              </span>
              <textarea
                value={resolved.cardBody}
                onChange={(e) => onChange(row.id, { editedCardBody: e.target.value })}
                rows={2}
                className="rounded border border-neutral-200 bg-white px-2 py-1 text-[12px] text-neutral-700 focus:border-blue-400 focus:outline-none"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export function AiImportDialog({ open, onClose }: AiImportDialogProps) {
  const replaceActiveBlueprint = useBlueprintStore((s) => s.replaceActiveBlueprint);
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<AiImportStep>('upload');
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [dragOver, setDragOver] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [extractedRows, setExtractedRows] = useState<ExtractedRow[]>([]);
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [mappingWarnings, setMappingWarnings] = useState<string[]>([]);
  const [serviceName, setServiceName] = useState('Enter title');
  const [filter, setFilter] = useState<RowFilter>('all');
  const [commitWarnings, setCommitWarnings] = useState<string[]>([]);
  const [committedCardCount, setCommittedCardCount] = useState(0);
  const [committedStageCount, setCommittedStageCount] = useState(0);

  // ── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStep('upload');
    setInputMode('file');
    setDragOver(false);
    setPasteText('');
    setFileName('');
    setSheets([]);
    setWorkbook(null);
    setExtractedRows([]);
    setMappedRows([]);
    setMappingErrors([]);
    setMappingWarnings([]);
    setServiceName('Enter title');
    setFilter('all');
    setCommitWarnings([]);
    setCommittedCardCount(0);
    setCommittedStageCount(0);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // ── Run mapping service ───────────────────────────────────────────────────

  const runMapping = useCallback(async (rows: ExtractedRow[]) => {
    setStep('mapping');
    try {
      const result = await MAPPING_SERVICE.mapRows(rows);
      setMappedRows(result.rows);
      setMappingErrors(result.errors);
      setMappingWarnings(result.warnings);
      setStep('review');
    } catch (err) {
      setMappingErrors([err instanceof Error ? err.message : 'Mapping failed']);
      setMappedRows([]);
      setStep('review');
    }
  }, []);

  // ── Process a file ────────────────────────────────────────────────────────

  const processFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setStep('extracting');

      // Small delay so the spinner renders before synchronous parsing blocks the thread
      await new Promise((r) => setTimeout(r, 80));

      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'csv') {
        const text = await file.text();
        const extraction = extractFromCsv(text, file.name);
        setExtractedRows(extraction.rows);
        await runMapping(extraction.rows);
        return;
      }

      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const { sheets: sheetList, workbook: wb } = parseXlsx(buffer, file.name);
        setWorkbook(wb);

        const visibleSheets = sheetList.filter((s) => s.rowCount > 1);
        setSheets(visibleSheets);

        if (visibleSheets.length === 0) {
          setMappingErrors(['No sheets with data found']);
          setMappedRows([]);
          setStep('review');
          return;
        }

        if (visibleSheets.length === 1) {
          const extraction = extractFromXlsx(wb, visibleSheets[0].name, file.name);
          setExtractedRows(extraction.rows);
          await runMapping(extraction.rows);
        } else {
          setStep('sheet-select');
        }
        return;
      }

      setMappingErrors([
        `Unsupported file type: .${ext ?? 'unknown'}. Use CSV, XLSX, or paste text below.`,
      ]);
      setMappedRows([]);
      setStep('review');
    },
    [runMapping],
  );

  // ── Sheet selection ───────────────────────────────────────────────────────

  const handleSheetSelect = useCallback(
    async (sheetName: string) => {
      if (!workbook) return;
      setStep('extracting');
      await new Promise((r) => setTimeout(r, 80));
      const extraction = extractFromXlsx(workbook, sheetName, fileName);
      setExtractedRows(extraction.rows);
      await runMapping(extraction.rows);
    },
    [workbook, fileName, runMapping],
  );

  // ── Paste text ────────────────────────────────────────────────────────────

  const handlePasteSubmit = useCallback(async () => {
    if (!pasteText.trim()) return;
    setFileName('pasted');
    setStep('extracting');
    await new Promise((r) => setTimeout(r, 80));
    const extraction = extractFromPastedText(pasteText);
    setExtractedRows(extraction.rows);
    await runMapping(extraction.rows);
  }, [pasteText, runMapping]);

  // ── Row editing ───────────────────────────────────────────────────────────

  const handleRowChange = useCallback((id: string, patch: Partial<MappedRow>) => {
    setMappedRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }, []);

  // ── Bulk actions ──────────────────────────────────────────────────────────

  const handleAcceptAll = useCallback(() => {
    setMappedRows((prev) =>
      prev.map((r) =>
        r.reviewStatus !== 'rejected' ? { ...r, reviewStatus: 'accepted' } : r,
      ),
    );
  }, []);

  const handleRejectNoise = useCallback(() => {
    setMappedRows((prev) =>
      prev.map((r) => {
        const type = r.editedRecordType ?? r.proposedRecordType;
        return type === 'noise_row' ? { ...r, reviewStatus: 'rejected' } : r;
      }),
    );
  }, []);

  // ── Commit ────────────────────────────────────────────────────────────────

  const handleCommit = useCallback(() => {
    const { state, warnings } = commitMappedRows(mappedRows, serviceName, fileName);
    setCommitWarnings(warnings);
    setCommittedCardCount(state.cards.length);
    setCommittedStageCount(state.stages.length);
    replaceActiveBlueprint(state);
    setStep('done');
  }, [mappedRows, serviceName, fileName, replaceActiveBlueprint]);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const cardRows = mappedRows.filter(
    (r) => (r.editedRecordType ?? r.proposedRecordType) === 'card_row',
  );
  const acceptedCount = mappedRows.filter((r) => r.reviewStatus === 'accepted').length;
  const rejectedCount = mappedRows.filter((r) => r.reviewStatus === 'rejected').length;
  const pendingCount = mappedRows.filter((r) => r.reviewStatus === 'pending').length;
  const needsAttentionCount = cardRows.filter(
    (r) => r.reviewStatus !== 'rejected' && (r.confidence < 0.5 || r.flags.length > 0),
  ).length;

  // Rows that will be committed (pending + accepted, not rejected)
  const committableCards = cardRows.filter(
    (r) => r.reviewStatus !== 'rejected',
  ).length;

  const filteredRows = mappedRows.filter((r) => {
    const type = r.editedRecordType ?? r.proposedRecordType;
    switch (filter) {
      case 'cards':
        return type === 'card_row';
      case 'needs_attention':
        return type === 'card_row' && r.reviewStatus !== 'rejected' && (r.confidence < 0.5 || r.flags.length > 0);
      case 'accepted':
        return r.reviewStatus === 'accepted';
      case 'rejected':
        return r.reviewStatus === 'rejected';
      default:
        return true;
    }
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 p-0 transition-all',
          step === 'review' ? 'max-h-[90vh] max-w-5xl' : 'max-w-lg',
        )}
      >
        <DialogHeader className="border-b border-neutral-100 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-[16px]">
            <Sparkles className="h-4 w-4 text-violet-500" />
            AI-assisted import
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Upload a file or paste tabular content — the AI will propose mappings for you to
            review before committing to the board.
          </DialogDescription>
        </DialogHeader>

        {/* ── Upload ────────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="space-y-4 px-6 py-5">
            {/* Mode tabs */}
            <div className="flex rounded-lg border border-neutral-200 p-0.5">
              <button
                onClick={() => setInputMode('file')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition-colors',
                  inputMode === 'file'
                    ? 'bg-white text-neutral-800 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700',
                )}
              >
                <FileText className="h-3.5 w-3.5" /> Upload file
              </button>
              <button
                onClick={() => setInputMode('paste')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition-colors',
                  inputMode === 'paste'
                    ? 'bg-white text-neutral-800 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700',
                )}
              >
                <ClipboardPaste className="h-3.5 w-3.5" /> Paste text
              </button>
            </div>

            {inputMode === 'file' ? (
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 transition-colors',
                  dragOver ? 'border-violet-400 bg-violet-50' : 'border-neutral-200 bg-neutral-50/50',
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) processFile(file);
                }}
              >
                <Upload className="h-8 w-8 text-neutral-300" />
                <p className="text-[14px] font-medium text-neutral-600">
                  Drop a file here or{' '}
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="text-violet-600 underline underline-offset-2 hover:text-violet-700"
                  >
                    browse
                  </button>
                </p>
                <p className="text-[12px] text-neutral-400">CSV or XLSX</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processFile(file);
                  }}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[12px] text-neutral-500">
                  Paste a table (tab- or comma-separated). Include a header row for best results.
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Stage\tStep\tAction\nPrepare\tGather data\tUser downloads template"}
                  rows={8}
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[12px] text-neutral-700 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
                />
                <button
                  onClick={handlePasteSubmit}
                  disabled={!pasteText.trim()}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-neutral-700 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  Analyse content
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Sheet selection ────────────────────────────────────────────── */}
        {step === 'sheet-select' && (
          <div className="space-y-3 px-6 py-5">
            <p className="text-[13px] text-neutral-600">
              Multiple sheets found in <span className="font-medium">{fileName}</span>. Select one:
            </p>
            <div className="space-y-1.5">
              {sheets.map((sheet) => (
                <button
                  key={sheet.name}
                  onClick={() => handleSheetSelect(sheet.name)}
                  className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <span className="text-[14px] font-medium text-neutral-800">{sheet.name}</span>
                  <span className="text-[12px] text-neutral-400">{sheet.rowCount} rows</span>
                </button>
              ))}
            </div>
            <button
              onClick={reset}
              className="text-[13px] text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
            >
              Choose a different file
            </button>
          </div>
        )}

        {/* ── Extracting ─────────────────────────────────────────────────── */}
        {step === 'extracting' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            <p className="text-[14px] font-medium text-neutral-700">Reading source data…</p>
          </div>
        )}

        {/* ── Mapping ────────────────────────────────────────────────────── */}
        {step === 'mapping' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="relative">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-300" />
              <Sparkles className="absolute inset-0 m-auto h-4 w-4 text-violet-500" />
            </div>
            <p className="text-[14px] font-medium text-neutral-700">
              Analysing {extractedRows.length} rows…
            </p>
            <p className="text-[12px] text-neutral-400">Inferring stages, steps, and lane mappings</p>
          </div>
        )}

        {/* ── Review ─────────────────────────────────────────────────────── */}
        {step === 'review' && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Errors */}
            {mappingErrors.length > 0 && (
              <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {mappingErrors.length} error{mappingErrors.length > 1 ? 's' : ''}
                </div>
                <ul className="space-y-0.5 text-[12px] text-red-600">
                  {mappingErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {mappingWarnings.length > 0 && (
              <div className="mx-6 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  {mappingWarnings.length} warning{mappingWarnings.length > 1 ? 's' : ''}
                </div>
                <ul className="space-y-0.5 text-[12px] text-amber-600">
                  {mappingWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Controls bar */}
            <div className="flex items-center gap-3 border-b border-neutral-100 px-6 py-3">
              {/* Service name */}
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-neutral-500">Service:</span>
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="rounded border border-neutral-200 px-2 py-0.5 text-[13px] font-medium text-neutral-800 focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div className="flex-1" />

              {/* Bulk actions */}
              <button
                onClick={handleAcceptAll}
                className="rounded px-2 py-1 text-[12px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                Accept all
              </button>
              <button
                onClick={handleRejectNoise}
                className="rounded px-2 py-1 text-[12px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100"
              >
                Reject noise rows
              </button>
            </div>

            {/* Filter tabs + stats */}
            <div className="flex items-center gap-0.5 border-b border-neutral-100 px-6 py-2">
              {(
                [
                  { key: 'all', label: `All (${mappedRows.length})` },
                  { key: 'cards', label: `Cards (${cardRows.length})` },
                  {
                    key: 'needs_attention',
                    label: `Needs attention (${needsAttentionCount})`,
                    highlight: needsAttentionCount > 0,
                  },
                  { key: 'accepted', label: `Accepted (${acceptedCount})` },
                  { key: 'rejected', label: `Rejected (${rejectedCount})` },
                ] as Array<{ key: RowFilter; label: string; highlight?: boolean }>
              ).map(({ key, label, highlight }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                    filter === key
                      ? 'bg-neutral-900 text-white'
                      : highlight
                        ? 'text-amber-600 hover:bg-amber-50'
                        : 'text-neutral-500 hover:bg-neutral-100',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Row list */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
              {filteredRows.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-[13px] text-neutral-400">
                  No rows match this filter
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredRows.map((row, i) => (
                    <RowEditor key={row.id} row={row} index={i} onChange={handleRowChange} />
                  ))}
                </div>
              )}
            </div>

            {/* Bottom action bar */}
            <div className="flex items-center gap-3 border-t border-neutral-100 px-6 py-4">
              <div className="text-[12px] text-neutral-500">
                {pendingCount > 0 && (
                  <span className="mr-3">
                    <span className="font-medium text-neutral-700">{pendingCount}</span> pending
                  </span>
                )}
                <span className="mr-3">
                  <span className="font-medium text-emerald-700">{acceptedCount}</span> accepted
                </span>
                {rejectedCount > 0 && (
                  <span>
                    <span className="font-medium text-red-500">{rejectedCount}</span> rejected
                  </span>
                )}
              </div>
              <div className="flex-1" />
              <button
                onClick={reset}
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100"
              >
                Start over
              </button>
              <button
                onClick={handleCommit}
                disabled={committableCards === 0}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-neutral-700 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Commit {committableCards} card{committableCards !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* ── Done ───────────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 px-6 py-8">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-[15px] font-semibold text-neutral-800">Blueprint imported</p>
            <p className="text-[13px] text-neutral-500">
              {committedCardCount} card{committedCardCount !== 1 ? 's' : ''} across{' '}
              {committedStageCount} stage{committedStageCount !== 1 ? 's' : ''}
            </p>
            {commitWarnings.length > 0 && (
              <div className="mt-1 w-full rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="mb-1 text-[12px] font-semibold text-amber-700">
                  {commitWarnings.length} row{commitWarnings.length > 1 ? 's' : ''} skipped
                </p>
                <ul className="space-y-0.5 text-[11px] text-amber-600">
                  {commitWarnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {commitWarnings.length > 5 && (
                    <li>…and {commitWarnings.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
            <button
              onClick={handleClose}
              className="mt-2 rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Done
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
