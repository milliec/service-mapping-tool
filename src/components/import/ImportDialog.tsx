'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { parseXlsx, processXlsxSheet, processMultiTabWorkbook, parseCsv, type SheetInfo } from '@/lib/import/parse';
import { detectMultiTabWorkbook } from '@/lib/import/normalize';
import { normalizeAiRows, type AiOutputRow } from '@/lib/import/normalize';
import { type ImportResult } from '@/lib/types';
import { useBlueprintStore } from '@/store/blueprint-store';
import { cn } from '@/lib/utils';
import { getLaneTitle } from '@/lib/lane-definitions';
import * as XLSX from 'xlsx';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

type ImportStep = 'upload' | 'sheet-select' | 'processing' | 'preview' | 'done';

export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const loadBlueprint = useBlueprintStore((s) => s.loadBlueprint);
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const isMultiTab = detectMultiTabWorkbook(sheets.map((s) => s.name));

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setSheets([]);
    setWorkbook(null);
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const emptyState = {
    blueprint: { id: '', serviceName: '', description: '', createdAt: '', updatedAt: '' },
    stages: [], steps: [], lanes: [], journeySpans: [], policyReformSpans: [], productTeamSpans: [], childBlueprints: [], rootDocument: null, activeBlueprintId: '', rootBlueprintId: '', cards: [], storyboardImages: [],
    storyboardVisible: true as const, storyboardCollapsed: false as const,
    cardLinks: [], evidence: [], opportunities: [], solutions: [], assumptions: [], strategicGoals: [], outcomes: [],
    systemOutcomes: [], behaviourOutcomes: [], serviceOutcomes: [], stepLinks: [], requirements: [], apiContracts: [], uiScaffolds: [],
    traceabilityCounters: {} as Record<string, number>,
  };

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      const text = await file.text();
      const importResult = parseCsv(text, file.name);
      setResult(importResult);
      setStep('preview');
      return;
    }

    if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      const { sheets: sheetList, workbook: wb } = parseXlsx(buffer, file.name);
      setWorkbook(wb);

      const visibleSheets = sheetList.filter((s) => s.rowCount > 1);
      setSheets(visibleSheets);

      if (visibleSheets.length === 0) {
        setResult({
          state: emptyState,
          errors: [{ row: 0, field: 'file', message: 'No sheets with data found' }],
          warnings: [],
        });
        setStep('preview');
      } else if (visibleSheets.length === 1) {
        const importResult = processXlsxSheet(wb, visibleSheets[0].name, file.name);
        setResult(importResult);
        setStep('preview');
      } else {
        setStep('sheet-select');
      }
      return;
    }

    if (ext === 'pdf') {
      setStep('processing');
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData });
        const data = await res.json() as { rows?: AiOutputRow[]; error?: string };
        if (!res.ok || data.error) {
          setResult({
            state: emptyState,
            errors: [{ row: 0, field: 'file', message: data.error ?? 'Failed to process PDF' }],
            warnings: [],
          });
          setStep('preview');
          return;
        }
        const importResult = normalizeAiRows(data.rows ?? [], file.name);
        setResult(importResult);
        setStep('preview');
      } catch (err) {
        setResult({
          state: emptyState,
          errors: [{ row: 0, field: 'file', message: err instanceof Error ? err.message : 'Failed to process PDF' }],
          warnings: [],
        });
        setStep('preview');
      }
      return;
    }

    setResult({
      state: emptyState,
      errors: [{ row: 0, field: 'file', message: `Unsupported file type: .${ext}. Please use .csv, .xlsx, .xls, or .pdf` }],
      warnings: [],
    });
    setStep('preview');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleSheetSelect = useCallback(
    (sheetName: string) => {
      if (!workbook) return;
      const importResult = processXlsxSheet(workbook, sheetName, fileName);
      setResult(importResult);
      setStep('preview');
    },
    [workbook, fileName],
  );

  const handleImport = useCallback(() => {
    if (!result?.state) return;
    loadBlueprint(result.state, {
      srcRefCounters: result.srcRefCounters,
      traceabilityCounters: result.traceabilityCounters,
    });
    setStep('done');
  }, [result, loadBlueprint]);

  const hasErrors = (result?.errors?.length ?? 0) > 0;
  const hasData = result?.state && result.state.stages.length > 0;
  const laneCounts = result
    ? Array.from(
        result.state.cards.reduce((map, card) => {
          map.set(card.laneKey, (map.get(card.laneKey) ?? 0) + 1);
          return map;
        }, new Map<string, number>()),
      ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    : [];
  const userNeedCount = laneCounts.find(([laneKey]) => laneKey === 'user_need')?.[1] ?? 0;
  const painPointCount = laneCounts.find(([laneKey]) => laneKey === 'pain_point')?.[1] ?? 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[16px]">
            <FileSpreadsheet className="h-5 w-5 text-neutral-400" />
            Import blueprint
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Upload a CSV or XLSX file using the service blueprint template, or a PDF for AI-assisted conversion.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 transition-colors',
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-neutral-200 bg-neutral-50/50',
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 text-neutral-300" />
            <p className="text-[14px] font-medium text-neutral-600">
              Drop a file here or{' '}
              <button
                onClick={() => fileRef.current?.click()}
                className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
              >
                browse
              </button>
            </p>
            <p className="text-[12px] text-neutral-400">CSV, XLSX or PDF</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            <p className="text-[14px] font-medium text-neutral-700">Analysing PDF with AI…</p>
            <p className="text-[12px] text-neutral-400">This may take a moment</p>
          </div>
        )}

        {step === 'sheet-select' && (
          <div className="space-y-3">
            <p className="text-[13px] text-neutral-600">
              Multiple sheets found in <span className="font-medium">{fileName}</span>.{' '}
              {isMultiTab ? 'Import all tabs at once, or select a single tab:' : 'Select one:'}
            </p>
            <div className="space-y-1.5">
              {isMultiTab && (
                <button
                  onClick={() => {
                    if (!workbook) return;
                    setResult(processMultiTabWorkbook(workbook, fileName));
                    setStep('preview');
                  }}
                  className="flex w-full items-center justify-between rounded-lg border-2 border-blue-400 bg-blue-50 px-4 py-3 text-left transition-colors hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <span className="text-[14px] font-semibold text-blue-800">Import all tabs</span>
                  <span className="text-[12px] text-blue-500">Service · Stages · Actors · Business Rules · Blueprint</span>
                </button>
              )}
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

        {step === 'preview' && result && (
          <div className="space-y-4">
            {hasErrors && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {result.errors.length} error{result.errors.length > 1 ? 's' : ''}
                </div>
                <ul className="space-y-1 text-[12px] text-red-600">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>…and {result.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}
                </div>
                <ul className="space-y-1 text-[12px] text-amber-600">
                  {result.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>
                      Row {w.row}: {w.message}
                    </li>
                  ))}
                  {result.warnings.length > 5 && (
                    <li>…and {result.warnings.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            {hasData && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Ready to import
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-emerald-700">
                  <span>Service: <span className="font-medium">{result.state.blueprint.serviceName}</span></span>
                  <span>Stages: <span className="font-medium">{result.state.stages.length}</span></span>
                  <span>Steps: <span className="font-medium">{result.state.steps.length}</span></span>
                  <span>Cards: <span className="font-medium">{result.state.cards.length}</span></span>
                </div>
              </div>
            )}

            {hasData && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                <div className="mb-2 text-[13px] font-semibold text-sky-800">
                  Lane diagnostics
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-sky-800">
                  <span>User need cards: <span className="font-semibold">{userNeedCount}</span></span>
                  <span>Pain point cards: <span className="font-semibold">{painPointCount}</span></span>
                </div>
                <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-[12px] text-sky-900">
                  {laneCounts.map(([laneKey, count]) => (
                    <li key={laneKey} className="flex items-center justify-between rounded bg-white/80 px-2 py-1">
                      <span>{getLaneTitle(laneKey as never)}</span>
                      <span className="font-mono font-medium">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasData && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div className="mb-2 text-[13px] font-semibold text-neutral-700">
                  Parsed stages preview
                </div>
                <ul className="max-h-56 space-y-1 overflow-auto text-[12px] text-neutral-600">
                  {result.state.stages.map((stage, index) => (
                    <li key={stage.id} className="rounded bg-white px-2 py-1 font-mono">
                      {index + 1}. {stage.phase || 'NO PHASE'} :: {stage.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2">
              {hasData && (
                <button
                  onClick={handleImport}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  Import blueprint
                </button>
              )}
              <button
                onClick={reset}
                className="rounded-lg px-4 py-2 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {hasData ? 'Choose a different file' : 'Try again'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-[15px] font-semibold text-neutral-800">Blueprint imported</p>
            <p className="text-[13px] text-neutral-500">
              {result?.state.cards.length} cards across {result?.state.stages.length} stages
            </p>
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
