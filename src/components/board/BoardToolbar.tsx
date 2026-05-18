'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Plus,
  Download,
  Eye,
  EyeOff,
  ChevronDown,
  Undo2,
  Redo2,
  Film,
  BookOpen,
  Save,
  Target,
  Sparkles,
  Share2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { publishOrRefreshShare } from '@/lib/share-payload';
import { useBlueprintStore } from '@/store/blueprint-store';
import { LibrarySheet } from './LibrarySheet';
import { cn } from '@/lib/utils';
import { getLaneTitle, L1_HIDDEN_LANE_KEYS, L2_LANE_KEYS, L2_LANE_TITLE_OVERRIDES, L3_LANE_KEYS, L3_LANE_TITLE_OVERRIDES } from '@/lib/lane-definitions';
import { useLibraryStore } from '@/store/library-store';
import { exportMarkdown } from '@/lib/export-markdown';
import { blueprintTitleLabel } from '@/lib/blueprint-title';
import type { Card, Opportunity } from '@/lib/types';

const SHOW_EXAMPLE_TREE_MENU_ITEM = false;
/** Blank Goal → Outcome → Opportunity tree (“New opportunity tree” in UI). Hidden from menu; store action remains available. */
const SHOW_NEW_OPPORTUNITY_TREE_MENU_ITEM = false;

function countContextualUserOpportunities(opportunities: Opportunity[], cards: Card[]) {
  const currentCardIds = new Set(cards.map((card) => card.id));
  return opportunities.filter((opportunity) => {
    if (opportunity.origin === 'user' || opportunity.origin === 'generated') return true;
    return opportunity.sourceCardIds.some((id) => currentCardIds.has(id));
  }).length;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
}

/** Compare serialized snapshots for library “dirty” checks; never throws (e.g. BigInt or circular refs). */
function librarySnapshotsDiffer(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return true;
  }
}

interface BoardToolbarProps {
  onImport?: () => void;
}

export function BoardToolbar({ onImport }: BoardToolbarProps = {}) {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const rootDocument = useBlueprintStore((s) => s.rootDocument);
  const stages = useBlueprintStore((s) => s.stages);
  const steps = useBlueprintStore((s) => s.steps);
  const lanes = useBlueprintStore((s) => s.lanes);
  const cards = useBlueprintStore((s) => s.cards);
  const childBlueprints = useBlueprintStore((s) => s.childBlueprints);
  const activeBlueprintId = useBlueprintStore((s) => s.activeBlueprintId);
  const rootBlueprintId = useBlueprintStore((s) => s.rootBlueprintId);
  const storyboardImages = useBlueprintStore((s) => s.storyboardImages);
  const storyboardVisible = useBlueprintStore((s) => s.storyboardVisible);
  const storyboardCollapsed = useBlueprintStore((s) => s.storyboardCollapsed);
  const cardLinks = useBlueprintStore((s) => s.cardLinks);
  const evidence = useBlueprintStore((s) => s.evidence);
  const traceabilityCounters = useBlueprintStore((s) => s.traceabilityCounters);
  const setServiceName = useBlueprintStore((s) => s.setServiceName);
  const addStage = useBlueprintStore((s) => s.addStage);
  const toggleLane = useBlueprintStore((s) => s.toggleLane);
  const toggleStoryboardVisible = useBlueprintStore((s) => s.toggleStoryboardVisible);
  const newBlueprint = useBlueprintStore((s) => s.newBlueprint);
  const undo = useBlueprintStore((s) => s.undo);
  const redo = useBlueprintStore((s) => s.redo);
  const canUndo = useBlueprintStore((s) => s.canUndo);
  const canRedo = useBlueprintStore((s) => s.canRedo);
  const opportunities = useBlueprintStore((s) => s.opportunities);
  const solutions = useBlueprintStore((s) => s.solutions);
  const assumptions = useBlueprintStore((s) => s.assumptions);
  const strategicGoals = useBlueprintStore((s) => s.strategicGoals);
  const outcomes = useBlueprintStore((s) => s.outcomes);
  const stepLinks = useBlueprintStore((s) => s.stepLinks);
  const requirements = useBlueprintStore((s) => s.requirements);
  const apiContracts = useBlueprintStore((s) => s.apiContracts);
  const uiScaffolds = useBlueprintStore((s) => s.uiScaffolds);
  const readOnly = useBlueprintStore((s) => s.readOnly);

  const entries = useLibraryStore((s) => s.entries);
  const hydrateLibrary = useLibraryStore((s) => s.hydrate);
  const saveToLibrary = useLibraryStore((s) => s.save);

  const isChildView = Boolean(rootDocument && activeBlueprintId !== rootBlueprintId);
  const levelLabel = 'Lifecycle';
  const isL2Mode = false;
  const isL3Mode = false;

  // Show only the lanes relevant to the current view level.
  const dropdownLanes = isL3Mode
    ? L3_LANE_KEYS.map((key) => lanes.find((l) => l.key === key)).filter(Boolean) as typeof lanes
    : isL2Mode
      ? L2_LANE_KEYS
          .map((key) => lanes.find((l) => l.key === key))
          .filter(Boolean) as typeof lanes
      : lanes.filter((lane) => !L1_HIDDEN_LANE_KEYS.has(lane.key as never));

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(() => blueprintTitleLabel(blueprint.serviceName));
  const [showLanes, setShowLanes] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle');
  const [shareError, setShareError] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const nameRef = useRef<HTMLInputElement>(null);
  const lanesTriggerRef = useRef<HTMLButtonElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  const persistableDocument = useBlueprintStore.getState().getPersistableDocument();

  const savedEntry = entries.find((e) => e.id === persistableDocument.blueprint.id);
  const hasUnsavedLibraryChanges = !savedEntry || librarySnapshotsDiffer(savedEntry.state, persistableDocument);
  const contextualOpportunityCount = countContextualUserOpportunities(opportunities, cards);

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed) {
      setServiceName(trimmed);
    } else {
      setName(blueprintTitleLabel(blueprint.serviceName));
    }
    setEditingName(false);
  };

  const handleExportMarkdown = () => {
    const state = useBlueprintStore.getState();
    const md = exportMarkdown(state);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.blueprint.serviceName.replace(/\s+/g, '_').toLowerCase()}_blueprint.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleQuickSaveToLibrary = () => {
    saveToLibrary(useBlueprintStore.getState().getPersistableDocument());
    setSaveStatus('saved');
  };

  const copyShareUrl = async (url: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  };

  const handleShare = async () => {
    setShareStatus('loading');
    setShareError('');
    setShareNotice('');

    try {
      if (readOnly) {
        await copyShareUrl(window.location.href);
        setShareStatus('copied');
        return;
      }

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
      await copyShareUrl(shareUrl);
      if (storyboardImagesStripped || shareTextTrimmed) {
        const parts: string[] = [];
        if (storyboardImagesStripped) parts.push('storyboard images were not included');
        if (shareTextTrimmed) parts.push('some text was shortened');
        setShareNotice(`${parts.join('; ')} (share size limit).`);
      }
      setShareStatus('copied');
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not create a share link.');
      setShareStatus('error');
    }
  };

  useEffect(() => {
    hydrateLibrary();
  }, [hydrateLibrary]);

  useEffect(() => {
    if (saveStatus !== 'saved') return;
    const timeout = window.setTimeout(() => setSaveStatus('idle'), 2000);
    return () => window.clearTimeout(timeout);
  }, [saveStatus]);

  useEffect(() => {
    if (shareStatus !== 'copied' && shareStatus !== 'error') return;
    const timeout = window.setTimeout(() => {
      setShareStatus('idle');
      setShareError('');
      setShareNotice('');
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [shareStatus]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const hasModifier = isMac ? event.metaKey : event.ctrlKey;
      if (!hasModifier || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      if (event.key.toLowerCase() === 'z' && event.shiftKey) {
        if (!canRedo) return;
        event.preventDefault();
        redo();
        return;
      }

      if (event.key.toLowerCase() === 'z') {
        if (!canUndo) return;
        event.preventDefault();
        undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canRedo, canUndo, redo, undo]);

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-neutral-200 bg-white px-5 py-3">
        {/* Blueprint name */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="w-fit rounded-full bg-[#E6F3EB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#008938]">
              {levelLabel}
            </span>
            <h1 className="m-0 min-w-0 w-full text-xl font-bold leading-tight">
              {readOnly ? (
                <span className="block w-full max-w-full break-words px-1 py-0.5 text-xl font-bold text-neutral-900">
                  {blueprintTitleLabel(blueprint.serviceName)}
                </span>
              ) : editingName ? (
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') {
                      setName(blueprintTitleLabel(blueprint.serviceName));
                      setEditingName(false);
                    }
                  }}
                  onBlur={saveName}
                  autoFocus
                  aria-label="Blueprint name"
                  className="w-full min-w-0 rounded border border-neutral-300 px-2 py-1 text-xl font-bold text-neutral-900 outline-none focus:border-blue-400"
                />
              ) : (
                <button
                  onClick={() => {
                    setName(blueprintTitleLabel(blueprint.serviceName));
                    setEditingName(true);
                  }}
                  aria-label={`Blueprint name: ${blueprintTitleLabel(blueprint.serviceName)}. Click to edit.`}
                  className="block w-full max-w-full text-left break-words rounded px-1 py-0.5 text-xl font-bold text-neutral-900 transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {blueprintTitleLabel(blueprint.serviceName)}
                </button>
              )}
            </h1>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {!readOnly && (
            <div className="mr-1 flex h-[34px] items-center rounded-lg border border-neutral-200 bg-white p-0 shadow-sm">
              <button
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Cmd/Ctrl+Z)"
                aria-label="Undo"
                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-l-lg text-neutral-600 transition-colors hover:bg-neutral-50 disabled:text-neutral-300 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <Undo2 aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Shift+Cmd/Ctrl+Z)"
                aria-label="Redo"
                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-r-lg text-neutral-600 transition-colors hover:bg-neutral-50 disabled:text-neutral-300 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <Redo2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          )}

          {!readOnly && (hasUnsavedLibraryChanges || saveStatus === 'saved') && (
            <button
              onClick={handleQuickSaveToLibrary}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {saveStatus === 'saved' ? (
                <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Save aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              {saveStatus === 'saved' ? 'Saved' : 'Save'}
            </button>
          )}

          {!readOnly && (
            <button
              onClick={() => addStage((isL2Mode || isL3Mode) ? 'New step' : 'New stage')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" /> {(isL2Mode || isL3Mode) ? 'Step' : 'Stage'}
            </button>
          )}

          <div className="relative">
            <button
              ref={lanesTriggerRef}
              onClick={() => setShowLanes(!showLanes)}
              aria-expanded={showLanes}
              aria-haspopup="menu"
              aria-label="Toggle lanes visibility"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Eye aria-hidden="true" className="h-3.5 w-3.5" /> Lanes
              <ChevronDown aria-hidden="true" className="h-3 w-3" />
            </button>
            {showLanes && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowLanes(false)} />
                <div
                  role="menu"
                  aria-label="Lanes visibility"
                  className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowLanes(false);
                      lanesTriggerRef.current?.focus();
                    }
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
                      const idx = items.indexOf(document.activeElement as HTMLElement);
                      const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
                      items[next]?.focus();
                    }
                  }}
                >
                  <button
                    role="menuitem"
                    onClick={toggleStoryboardVisible}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    {storyboardVisible ? (
                      <Eye aria-hidden="true" className="h-3.5 w-3.5 text-neutral-600" />
                    ) : (
                      <EyeOff aria-hidden="true" className="h-3.5 w-3.5 text-neutral-300" />
                    )}
                    <Film aria-hidden="true" className="h-3.5 w-3.5 text-neutral-500" />
                    <span className={cn('font-medium', !storyboardVisible && 'text-neutral-500')}>
                      {isL3Mode ? 'Screens' : 'Storyboard'}
                    </span>
                  </button>
                  <div className="my-1 h-px bg-neutral-100" />
                  {dropdownLanes.map((lane) => (
                    <button
                      key={lane.key}
                      role="menuitem"
                      onClick={() => toggleLane(lane.key)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      {lane.visible ? (
                        <Eye aria-hidden="true" className="h-3.5 w-3.5 text-neutral-600" />
                      ) : (
                        <EyeOff aria-hidden="true" className="h-3.5 w-3.5 text-neutral-300" />
                      )}
                      <span className={cn('font-medium', !lane.visible && 'text-neutral-500')}>
                        {(isL3Mode && L3_LANE_TITLE_OVERRIDES[lane.key]) || (isL2Mode && L2_LANE_TITLE_OVERRIDES[lane.key]) || getLaneTitle(lane.key)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              ref={menuTriggerRef}
              onClick={() => setShowMenu(!showMenu)}
              aria-expanded={showMenu}
              aria-haspopup="menu"
              aria-label="More actions"
              className="inline-flex h-[34px] items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div
                  role="menu"
                  aria-label="More actions"
                  className="absolute right-0 top-full z-40 mt-1 w-48 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowMenu(false);
                      menuTriggerRef.current?.focus();
                    }
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
                      const idx = items.indexOf(document.activeElement as HTMLElement);
                      const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
                      items[next]?.focus();
                    }
                  }}
                >
                  {!readOnly && onImport && (
                    <>
                      <button
                        role="menuitem"
                        onClick={() => {
                          onImport();
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-violet-700 transition-colors hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        <Sparkles aria-hidden="true" className="h-3.5 w-3.5" /> Import
                      </button>
                      <div className="my-1 h-px bg-neutral-100" />
                    </>
                  )}
                  {!readOnly && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setShowLibrary(true);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <BookOpen aria-hidden="true" className="h-3.5 w-3.5" /> Library
                    </button>
                  )}
                  {!readOnly && (
                    <>
                      <div className="my-1 h-px bg-neutral-100" />
                      <button
                        role="menuitem"
                        onClick={() => {
                          newBlueprint();
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        <Plus aria-hidden="true" className="h-3.5 w-3.5" /> New blueprint
                      </button>
                    </>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => {
                      handleExportMarkdown();
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    <Download aria-hidden="true" className="h-3.5 w-3.5" /> Export Markdown
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      void handleShare();
                    }}
                    disabled={shareStatus === 'loading'}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                      shareStatus === 'copied'
                        ? 'bg-emerald-50 text-emerald-700'
                        : shareStatus === 'error'
                          ? 'bg-red-50 text-red-700'
                          : 'text-neutral-700 hover:bg-neutral-50',
                      shareStatus === 'loading' && 'cursor-wait text-neutral-500',
                    )}
                    title={
                      shareStatus === 'error'
                        ? shareError
                        : shareStatus === 'copied' && shareNotice
                          ? shareNotice
                          : undefined
                    }
                  >
                    {shareStatus === 'copied' ? (
                      <Check aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : shareStatus === 'error' ? (
                      <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : (
                      <Share2 aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
                    {shareStatus === 'loading'
                      ? 'Creating link...'
                      : shareStatus === 'copied'
                        ? 'Link copied'
                        : shareStatus === 'error'
                          ? 'Share failed'
                          : 'Copy share link'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <LibrarySheet open={showLibrary} onClose={() => setShowLibrary(false)} />
    </>
  );
}
