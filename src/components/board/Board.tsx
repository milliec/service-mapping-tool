'use client';

import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ArrowUp, Hand, Maximize2, Minimize2, Film, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useBlueprintStore } from '@/store/blueprint-store';
import { type Card, type LaneKey, type StoryboardImage } from '@/lib/types';
import { LaneLabel } from './LaneLabel';
import { CellArea } from './CellArea';
import { StageHeader } from './StageHeader';
import { StageDescription } from './StageDescription';
import { StepHeader } from './StepHeader';
import { BlueprintCard } from './BlueprintCard';
import { StoryboardCell } from './StoryboardCell';
import { CardDetailPanel } from './CardDetailPanel';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DEFAULT_LANES, L2_LANE_KEYS, L2_LANE_TITLE_OVERRIDES, L3_LANE_KEYS, L3_LANE_TITLE_OVERRIDES, L1_MACRO_LANE_KEYS } from '@/lib/lane-definitions';
import { BOARD_STEP_WIDTH } from '@/lib/board-layout';

const FRONTSTAGE_BOUNDARY_KEY = 'frontstage_touchpoint';

const STEP_WIDTH = BOARD_STEP_WIDTH;
const MIN_STAGE_ROW_H = 56; // minimum; row grows when stage titles wrap
const LOV_H = 28;             // line of visibility divider height
const COLLAPSED_LANE_H = 56;
/** Minimum height; row grows with stacked / tall storyboard images (ResizeObserver syncs left label). */
const STORYBOARD_ROW_H = 180;
const HORIZONTAL_PAN_STEP = 120;
const VERTICAL_PAN_STEP = 96;

/** Right border between step columns: lighter within stage, heavier at stage boundary */
function stepBorderR(stepIdx: number, stageStepCount: number) {
  return stepIdx < stageStepCount - 1
    ? 'border-r border-neutral-100'
    : 'border-r border-neutral-200';
}

function stepHeaderBorderR(stepIdx: number, stageStepCount: number) {
  return stepIdx < stageStepCount - 1 ? 'border-r border-neutral-100' : '';
}

function isBoardInteractiveTarget(target: EventTarget | null) {
  const el =
    target instanceof Element ? target : target instanceof Text ? target.parentElement : null;
  if (!el) return false;
  return Boolean(
    el.closest(
      'button, input, textarea, select, a, [role="button"], [contenteditable="true"], [data-board-card], [data-no-pan]',
    ),
  );
}

/** Alternating monochrome bands: dark grey / white, then light grey / black */
const PHASE_MONO_STYLES = [
  { bg: '#3f3f46', border: '#52525b', text: '#fafafa' },
  { bg: '#7c7c7e', border: '#d4d4d8', text: '#f0f0f0' },
] as const;

function PhaseCell({ phase, width, stageIds, colorIndex, onSave }: {
  phase: string;
  width: number;
  stageIds: string[];
  colorIndex: number;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(phase);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(phase); }, [phase]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== phase) onSave(trimmed);
    setEditing(false);
  };

  const palette = phase ? PHASE_MONO_STYLES[colorIndex % PHASE_MONO_STYLES.length] : null;

  const sizeStyle = { width, minWidth: width } as const;

  if (editing) {
    return (
      <div
        className="box-border shrink-0 flex items-center border-b px-3"
        style={{
          ...sizeStyle,
          backgroundColor: palette?.bg ?? '#f5f5f5',
          borderBottomColor: palette?.border ?? '#d4d4d4',
          borderRightWidth: 1,
          borderRightColor: palette?.border ?? '#d4d4d4',
        }}
        data-no-pan
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(phase); setEditing(false); }
          }}
          className={cn(
            'w-full bg-transparent text-center text-xs font-semibold uppercase tracking-wider outline-none',
            colorIndex % 2 === 0 ? 'placeholder:text-neutral-400' : 'placeholder:text-neutral-500',
          )}
          style={{ color: palette?.text ?? '#525252' }}
          placeholder="Phase name"
        />
      </div>
    );
  }

  return (
    <div
      className="box-border flex shrink-0 cursor-pointer items-center justify-center border-b px-3 transition-colors"
      style={{
        ...sizeStyle,
        backgroundColor: palette?.bg ?? '#fafafa',
        borderBottomColor: palette?.border ?? '#e5e5e5',
        borderRightWidth: 1,
        borderRightColor: palette?.border ?? '#e5e5e5',
      }}
      onClick={() => setEditing(true)}
      title={phase || 'Click to set phase'}
    >
      {phase ? (
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: palette?.text }}
        >
          {phase}
        </span>
      ) : (
        <span className="text-[11px] font-medium tracking-wider text-neutral-300">
          + Phase
        </span>
      )}
    </div>
  );
}

export function Board() {
  const stages = useBlueprintStore((s) => s.stages);
  const steps = useBlueprintStore((s) => s.steps);
  const addStage = useBlueprintStore((s) => s.addStage);
  const readOnly = useBlueprintStore((s) => s.readOnly);
  const updateStage = useBlueprintStore((s) => s.updateStage);
  const lanes = useBlueprintStore((s) => s.lanes);
  const cards = useBlueprintStore((s) => s.cards);
  const rootDocument = useBlueprintStore((s) => s.rootDocument);
  const activeBlueprintId = useBlueprintStore((s) => s.activeBlueprintId);
  const rootBlueprintId = useBlueprintStore((s) => s.rootBlueprintId);
  const moveCard = useBlueprintStore((s) => s.moveCard);
  const reorderCard = useBlueprintStore((s) => s.reorderCard);
  const toggleLaneCollapsed = useBlueprintStore((s) => s.toggleLaneCollapsed);
  const storyboardImages = useBlueprintStore((s) => s.storyboardImages);
  const storyboardVisible = useBlueprintStore((s) => s.storyboardVisible);
  const storyboardCollapsed = useBlueprintStore((s) => s.storyboardCollapsed);
  const addStoryboardImage = useBlueprintStore((s) => s.addStoryboardImage);
  const updateStoryboardImage = useBlueprintStore((s) => s.updateStoryboardImage);
  const removeStoryboardImage = useBlueprintStore((s) => s.removeStoryboardImage);
  const toggleStoryboardCollapsed = useBlueprintStore((s) => s.toggleStoryboardCollapsed);
  const selectCard = useBlueprintStore((s) => s.selectCard);

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [isPointerPanning, setIsPointerPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Heights measured from right panel, mirrored to left panel
  const [stageRowH, setStageRowH] = useState(MIN_STAGE_ROW_H);
  const [descriptionRowH, setDescriptionRowH] = useState(60);

  // Panel refs
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const boardRootRef = useRef<HTMLDivElement>(null);

  // Right-panel row refs for height measurement
  const rightStageRowRef = useRef<HTMLDivElement>(null);
  const rightDescriptionRowRef = useRef<HTMLDivElement>(null);
  const rightStoryboardRowRef = useRef<HTMLDivElement>(null);
  const leftStoryboardLabelRef = useRef<HTMLDivElement>(null);

  const rightLaneRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const leftLaneRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pointerPanRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  const getRenderedHeight = useCallback((el: Element | null) => {
    if (!el) return 0;
    return Math.ceil(el.getBoundingClientRect().height);
  }, []);

  // Bidirectional vertical scroll sync (guard against infinite loops)
  const syncingRef = useRef(false);
  const handleRightScroll = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    requestAnimationFrame(() => {
      if (leftPanelRef.current && rightPanelRef.current) {
        leftPanelRef.current.scrollTop = rightPanelRef.current.scrollTop;
      }
      syncingRef.current = false;
    });
  }, []);
  const handleLeftScroll = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    requestAnimationFrame(() => {
      if (rightPanelRef.current && leftPanelRef.current) {
        rightPanelRef.current.scrollTop = leftPanelRef.current.scrollTop;
      }
      syncingRef.current = false;
    });
  }, []);

  // Measure stage row height (wraps with longest title)
  useLayoutEffect(() => {
    const el = rightStageRowRef.current;
    if (!el) return;
    const initialHeight = getRenderedHeight(el);
    if (initialHeight > 0) setStageRowH(initialHeight);
    const obs = new ResizeObserver(([entry]) => {
      const h = getRenderedHeight(entry.target);
      if (h > 0) setStageRowH(h);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [getRenderedHeight]);

  // Measure description row height (mirrors to left "Description" label).
  // Depends on whether any stage has a description — when that flips from
  // false→true (e.g. navigating into L2 Macro) the effect re-runs so the
  // ResizeObserver attaches to the newly-rendered row.
  const anyStageHasDescription = stages.some((s) => Boolean(s.description?.trim()));
  useLayoutEffect(() => {
    const el = rightDescriptionRowRef.current;
    if (!el) return;
    const initialHeight = getRenderedHeight(el);
    if (initialHeight > 0) setDescriptionRowH(initialHeight);
    const obs = new ResizeObserver(([entry]) => {
      const h = getRenderedHeight(entry.target);
      if (h > 0) setDescriptionRowH(h);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [getRenderedHeight, anyStageHasDescription]);

  // Sync storyboard label height: imperatively set left label to match right row.
  // We avoid putting height in the JSX style prop so React never overrides this on re-renders.
  useLayoutEffect(() => {
    const leftEl = leftStoryboardLabelRef.current;
    if (!leftEl) return;
    if (storyboardCollapsed) {
      leftEl.style.height = `${COLLAPSED_LANE_H}px`;
      return;
    }
    const rightEl = rightStoryboardRowRef.current;
    if (!rightEl) {
      leftEl.style.height = `${STORYBOARD_ROW_H}px`;
      return;
    }
    const sync = () => {
      const h = rightEl.offsetHeight;
      if (h > 0) leftEl.style.height = `${h}px`;
    };
    sync();
    const obs = new ResizeObserver(sync);
    obs.observe(rightEl);
    return () => obs.disconnect();
  }, [storyboardVisible, storyboardCollapsed]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.order - b.order),
    [stages],
  );

  const stepsPerStage = useMemo(() => {
    const map = new Map<string, typeof steps>();
    for (const stage of sortedStages) {
      map.set(
        stage.id,
        [...steps.filter((s) => s.stageId === stage.id)].sort((a, b) => a.order - b.order),
      );
    }
    return map;
  }, [sortedStages, steps]);

  const visibleLanes = useMemo(
    () => lanes.filter((l) => l.visible).sort((a, b) => a.order - b.order),
    [lanes],
  );

  const isChildView = Boolean(
    rootDocument && activeBlueprintId !== rootBlueprintId,
  );
  const isL2Mode = false;
  const isL3Mode = false;

  const isL1MacroMode = useMemo(
    () => lanes.some((l) => L1_MACRO_LANE_KEYS.has(l.key)),
    [lanes],
  );

  const effectiveVisibleLanes = useMemo(() => {
    // L3 (Micro) uses the canonical L3 lane order while respecting the user's
    // visibility toggles from the Lanes dropdown.
    if (isL3Mode) {
      return L3_LANE_KEYS
        .map((key) => lanes.find((l) => l.key === key) ?? DEFAULT_LANES.find((l) => l.key === key))
        .filter((lane): lane is NonNullable<typeof lane> => Boolean(lane))
        .filter((lane) => lane.visible);
    }
    // L2 (Macro) uses L2_LANE_KEYS (includes user_journey for nested L3 journeys)
    if (isL2Mode) {
      return L2_LANE_KEYS
        .map((key) => lanes.find((l) => l.key === key))
        .filter((lane): lane is NonNullable<typeof lane> => Boolean(lane))
        .filter((lane) => lane.visible);
    }
    return visibleLanes;
  }, [isL2Mode, isL3Mode, lanes, visibleLanes]);

  const lineOfVisibilityIndex = useMemo(() => {
    if (isL2Mode || isL3Mode || isL1MacroMode) return -1;
    const idx = effectiveVisibleLanes.findIndex((l) => l.key === FRONTSTAGE_BOUNDARY_KEY);
    return idx >= 0 ? idx : -1;
  }, [effectiveVisibleLanes, isL2Mode, isL3Mode, isL1MacroMode]);


  const phaseGroups = useMemo(() => {
    if (!isL1MacroMode) return [];
    const groups: Array<{ phase: string; stageIds: string[]; colSpan: number }> = [];
    for (const stage of sortedStages) {
      const phase = stage.phase ?? '';
      const stageSteps = stepsPerStage.get(stage.id) || [];
      const colCount = Math.max(stageSteps.length, 1);
      const last = groups[groups.length - 1];
      if (last && last.phase === phase) {
        last.stageIds.push(stage.id);
        last.colSpan += colCount;
      } else {
        groups.push({ phase, stageIds: [stage.id], colSpan: colCount });
      }
    }
    return groups;
  }, [sortedStages, stepsPerStage, isL1MacroMode]);

  const showStepHeaders = useMemo(
    () => {
      if (isL2Mode || isL3Mode) return false;

      return sortedStages.some((stage) => {
        const stageSteps = stepsPerStage.get(stage.id) || [];
        if (stageSteps.length !== 1) return true;
        const onlyStep = stageSteps[0];
        return Boolean(onlyStep && onlyStep.title.trim() !== stage.title.trim());
      });
    },
    [isL2Mode, isL3Mode, sortedStages, stepsPerStage],
  );

  const hasStageDescriptions = useMemo(
    () => sortedStages.some((stage) => Boolean(stage.description?.trim())),
    [sortedStages],
  );

  const cardsMap = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const card of cards) {
      const key = `${card.stepId}::${card.laneKey}`;
      const existing = map.get(key) || [];
      existing.push(card);
      map.set(key, existing);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => a.order - b.order);
    }
    return map;
  }, [cards]);

  const getCardsForCell = useCallback(
    (stepId: string, laneKey: LaneKey): Card[] =>
      cardsMap.get(`${stepId}::${laneKey}`) || [],
    [cardsMap],
  );

  const storyboardImagesByStep = useMemo(() => {
    const map = new Map<string, StoryboardImage[]>();
    for (const img of storyboardImages) {
      const list = map.get(img.stepId) ?? [];
      list.push(img);
      map.set(img.stepId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return map;
  }, [storyboardImages]);

  /** L1/L2: at most one image per step; L3: unlimited. */
  const addStoryboardImageIfAllowed = useCallback(
    (stepId: string, dataUrl: string) => {
      if (!isL3Mode && (storyboardImagesByStep.get(stepId)?.length ?? 0) >= 1) {
        return;
      }
      addStoryboardImage(stepId, dataUrl);
    },
    [isL3Mode, storyboardImagesByStep, addStoryboardImage],
  );

  // Sync each lane label height imperatively to match the right panel row.
  // We avoid putting height in JSX style so React never overwrites our DOM changes.
  useLayoutEffect(() => {
    const rightMap = rightLaneRowRefs.current;
    const leftMap = leftLaneRowRefs.current;
    const cleanups: (() => void)[] = [];
    for (const [key, rightEl] of rightMap.entries()) {
      const leftEl = leftMap.get(key);
      if (!leftEl) continue;
      const sync = () => {
        const h = rightEl.offsetHeight;
        if (h > 0) leftEl.style.height = `${h}px`;
      };
      sync();
      const obs = new ResizeObserver(sync);
      obs.observe(rightEl);
      cleanups.push(() => obs.disconnect());
    }
    return () => cleanups.forEach((fn) => fn());
  }, [effectiveVisibleLanes]);


  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === boardRootRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const card = cards.find((c) => c.id === event.active.id);
      if (card) setActiveCard(card);
    },
    [cards],
  );

  const handleDragOver = useCallback((_event: DragOverEvent) => {}, []);

  const focusBoardSurface = useCallback(() => {
    boardRootRef.current?.focus({ preventScroll: true });
  }, []);

  const handleBoardPointerDownCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (isBoardInteractiveTarget(event.target)) return;
    focusBoardSurface();
    // Deselect card when clicking on the blank canvas
    if (!(event.target as HTMLElement).closest('[data-board-card], [data-no-select]')) {
      selectCard(null);
    }
  }, [focusBoardSurface, selectCard]);

  const handleBoardKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isBoardInteractiveTarget(event.target)) return;
    const panel = rightPanelRef.current;
    if (!panel) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        panel.scrollBy({ left: -HORIZONTAL_PAN_STEP });
        break;
      case 'ArrowRight':
        event.preventDefault();
        panel.scrollBy({ left: HORIZONTAL_PAN_STEP });
        break;
      case 'ArrowUp':
        event.preventDefault();
        panel.scrollBy({ top: -VERTICAL_PAN_STEP });
        break;
      case 'ArrowDown':
        event.preventDefault();
        panel.scrollBy({ top: VERTICAL_PAN_STEP });
        break;
      case 'Home':
        event.preventDefault();
        panel.scrollTo({ left: 0, top: panel.scrollTop });
        break;
      case 'End':
        event.preventDefault();
        panel.scrollTo({ left: panel.scrollWidth, top: panel.scrollTop });
        break;
      case 'PageUp':
        event.preventDefault();
        panel.scrollBy({ top: -(panel.clientHeight * 0.8) });
        break;
      case 'PageDown':
        event.preventDefault();
        panel.scrollBy({ top: panel.clientHeight * 0.8 });
        break;
      default:
        break;
    }
  }, []);

  const handlePanPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!panMode || isBoardInteractiveTarget(event.target)) return;

    const panel = rightPanelRef.current;
    if (!panel) return;

    pointerPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: panel.scrollLeft,
      startTop: panel.scrollTop,
    };
    setIsPointerPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [panMode]);

  const handlePanPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointerPanRef.current;
    const panel = rightPanelRef.current;
    if (!drag || !panel || drag.pointerId !== event.pointerId) return;

    panel.scrollLeft = drag.startLeft - (event.clientX - drag.startX);
    panel.scrollTop = drag.startTop - (event.clientY - drag.startY);
  }, []);

  const stopPanPointer = useCallback((event?: React.PointerEvent<HTMLDivElement>) => {
    if (event && pointerPanRef.current && event.currentTarget.hasPointerCapture(pointerPanRef.current.pointerId)) {
      event.currentTarget.releasePointerCapture(pointerPanRef.current.pointerId);
    }
    pointerPanRef.current = null;
    setIsPointerPanning(false);
  }, []);

  const handleScrollToTop = useCallback(() => {
    const panel = rightPanelRef.current;
    if (!panel) return;
    panel.scrollTo({ top: 0, behavior: 'smooth' });
    focusBoardSurface();
  }, [focusBoardSurface]);

  const toggleFullscreen = useCallback(async () => {
    const container = boardRootRef.current;
    if (!container) return;

    if (document.fullscreenElement === container) {
      await document.exitFullscreen();
      return;
    }

    await container.requestFullscreen();
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveCard(null);
      const { active, over } = event;
      if (!over) return;
      const activeCardId = active.id as string;
      const card = cards.find((c) => c.id === activeCardId);
      if (!card) return;
      const overData = over.data.current;
      if (overData?.type === 'cell') {
        const toStepId = overData.stepId as string;
        const toLaneKey = overData.laneKey as LaneKey;
        if (card.stepId === toStepId && card.laneKey === toLaneKey) return;
        moveCard(activeCardId, toStepId, toLaneKey, getCardsForCell(toStepId, toLaneKey).length);
      } else if (overData?.type === 'card') {
        const overCard = overData.card as Card;
        if (card.stepId === overCard.stepId && card.laneKey === overCard.laneKey) {
          const cellCards = getCardsForCell(card.stepId, card.laneKey);
          const overIdx = cellCards.findIndex((c) => c.id === overCard.id);
          if (overIdx !== -1) reorderCard(activeCardId, overIdx);
        } else {
          moveCard(activeCardId, overCard.stepId, overCard.laneKey, overCard.order);
        }
      }
    },
    [cards, getCardsForCell, moveCard, reorderCard],
  );

  // Reset scroll when the active blueprint changes.
  useEffect(() => {
    const rightPanel = rightPanelRef.current;
    const leftPanel = leftPanelRef.current;
    rightPanel?.scrollTo({ left: 0, top: 0 });
    if (leftPanel) leftPanel.scrollTop = 0;
    focusBoardSurface();
  }, [activeBlueprintId, focusBoardSurface]);

  if (sortedStages.length === 0) return null;

  const totalStepColumns = sortedStages.reduce((sum, stage) => {
    const stageSteps = stepsPerStage.get(stage.id) || [];
    return sum + Math.max(stageSteps.length, 1);
  }, 0);
  // Content width for the RIGHT panel only (no lane label column)
  const contentWidth = totalStepColumns * STEP_WIDTH;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={boardRootRef}
        id="board-main"
        tabIndex={0}
        role="region"
        aria-label="Service blueprint board"
        aria-describedby="board-keyboard-help"
        onPointerDownCapture={handleBoardPointerDownCapture}
        onKeyDown={handleBoardKeyDown}
        className="relative z-0 flex h-full min-h-0 flex-1 overflow-hidden bg-[#fafafa] outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafa]"
      >
        <p id="board-keyboard-help" className="sr-only">
          Use the arrow keys to pan the board when this region is focused. Use Home and End to jump left and right, and Page Up and Page Down to move vertically.
        </p>

        {/* ── LEFT PANEL: frozen label column ──────────────────────────────── */}
        <div
          ref={leftPanelRef}
          onScroll={handleLeftScroll}
          className="flex w-[172px] shrink-0 flex-col overflow-y-scroll overflow-x-hidden border-r border-neutral-200 bg-[#fafafa] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* Sticky header labels — heights mirror right panel header rows */}
          <div className="sticky top-0 z-30 bg-[#fafafa]">
            {isL1MacroMode && (
              <div
                className="flex items-center border-b border-neutral-200 bg-neutral-50 px-4"
                style={{ minHeight: 36 }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Phase
                </span>
              </div>
            )}
            <div
              className="flex items-center border-b border-neutral-200 px-4"
              style={{ height: stageRowH }}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {(isL2Mode || isL3Mode) ? 'Steps' : 'Stages'}
              </span>
            </div>

            {/* Description label — only when any stage has a description,
                height mirrors right panel description row. */}
            {hasStageDescriptions && (
              <div
                className="flex items-center border-b border-neutral-200 px-4"
                style={{ height: descriptionRowH }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Description
                </span>
              </div>
            )}

            {/* Storyboard label — sticky, height mirrors right panel storyboard row.
                Uses `group` so the Generate button can appear on hover. */}
            {storyboardVisible && (
              <div
                ref={leftStoryboardLabelRef}
                className={cn(
                  'group/storyboard flex border-b border-neutral-200 px-3',
                  storyboardCollapsed ? 'items-center py-2.5' : 'items-start py-3',
                )}
                style={{ minHeight: storyboardCollapsed ? COLLAPSED_LANE_H : STORYBOARD_ROW_H }}
              >
                <div
                  className={cn(
                    'flex w-full flex-col gap-1.5 overflow-hidden rounded-xl border transition-colors',
                    storyboardCollapsed ? 'px-3 py-1.5' : 'px-3 py-2',
                    'bg-neutral-50 text-neutral-600 border-neutral-200',
                  )}
                >
                  {/* Header row: icon, title, collapse toggle */}
                  <div className="flex items-center gap-2">
                    <Film aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="min-w-0 flex-1 text-[13px] font-semibold leading-tight tracking-tight">
                      {isL3Mode ? 'Screens' : 'Storyboard'}
                    </span>
                    <button
                      type="button"
                      onClick={toggleStoryboardCollapsed}
                      aria-label={`${
                        storyboardCollapsed ? 'Expand' : 'Collapse'
                      } ${isL3Mode ? 'Screens' : 'Storyboard'}`}
                      aria-expanded={!storyboardCollapsed}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-transparent text-current/80 transition-colors hover:bg-white/60 hover:text-current focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      {storyboardCollapsed ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronUp aria-hidden="true" className="h-4 w-4" />}
                    </button>
                  </div>

                </div>
              </div>
            )}

          </div>

          {/* Lane labels — heights mirror right panel lane rows */}
          {effectiveVisibleLanes.map((lane, laneIdx) => {
            const isAfterVisibility =
              lineOfVisibilityIndex >= 0 && laneIdx === lineOfVisibilityIndex + 1;
            return (
              <div key={lane.key}>
                {isAfterVisibility && (
                  <div
                    className="flex items-center border-b border-t-2 border-t-neutral-400 bg-neutral-100 px-4"
                    style={{ height: LOV_H }}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                      Line of visibility
                    </span>
                  </div>
                )}
                <div
                  ref={(el) => {
                    if (el) leftLaneRowRefs.current.set(lane.key, el);
                    else leftLaneRowRefs.current.delete(lane.key);
                  }}
                  className={cn(
                    'flex border-b border-neutral-200 px-3 overflow-hidden',
                    lane.collapsed ? 'items-center py-2.5' : 'items-start py-3',
                  )}
                  style={{ minHeight: lane.collapsed ? COLLAPSED_LANE_H : 88 }}
                >
                  <LaneLabel
                    lane={lane}
                    collapsed={lane.collapsed}
                    onToggleCollapsed={() => toggleLaneCollapsed(lane.key)}
                    titleOverride={isL3Mode ? L3_LANE_TITLE_OVERRIDES[lane.key] : isL2Mode ? L2_LANE_TITLE_OVERRIDES[lane.key] : undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── RIGHT PANEL: scrollable stage/step/cell content ──────────────── */}
        <div
          ref={rightPanelRef}
          onScroll={handleRightScroll}
          onPointerDown={handlePanPointerDown}
          onPointerMove={handlePanPointerMove}
          onPointerUp={stopPanPointer}
          onPointerCancel={stopPanPointer}
          className={cn(
            'flex-1 overflow-auto bg-[#fafafa]',
            panMode && 'cursor-grab',
            isPointerPanning && 'cursor-grabbing',
          )}
        >
          <div style={{ minWidth: contentWidth }}>

            {/* Sticky header content — z-40 so lane rows (e.g. journey cards z-20–30) scroll beneath */}
            <div className="sticky top-0 z-40 bg-white">

              {/* Phase grouping row (L1 Macro only) */}
              {phaseGroups.length > 0 && (() => {
                const distinctPhases = [...new Set(phaseGroups.map(pg => pg.phase).filter(Boolean))];
                const phaseColorMap = new Map(distinctPhases.map((p, i) => [p, i]));
                return (
                  <div className="flex" style={{ minHeight: 36 }}>
                    {phaseGroups.map((pg, idx) => (
                      <PhaseCell
                        key={`${pg.stageIds[0]}-${idx}`}
                        phase={pg.phase}
                        width={pg.colSpan * STEP_WIDTH}
                        stageIds={pg.stageIds}
                        colorIndex={phaseColorMap.get(pg.phase) ?? 0}
                        onSave={(value) => {
                          for (const stageId of pg.stageIds) {
                            updateStage(stageId, { phase: value });
                          }
                        }}
                      />
                    ))}
                    <div className="box-border shrink-0 border-b border-neutral-200 bg-neutral-50" style={{ width: 120, minWidth: 120 }} />
                  </div>
                );
              })()}

              {/* Stage row */}
              <div
                ref={rightStageRowRef}
                className="group relative z-20 flex items-stretch"
                style={{ minHeight: MIN_STAGE_ROW_H }}
              >
                {sortedStages.map((stage) => {
                  const stageSteps = stepsPerStage.get(stage.id) || [];
                  const colCount = Math.max(stageSteps.length, 1);
                  return (
                    <StageHeader
                      key={stage.id}
                      stage={stage}
                      stepCount={colCount}
                      stepWidth={STEP_WIDTH}
                      isChildLevel={isL2Mode || isL3Mode}
                    />
                  );
                })}
                {!readOnly && (
                  <div
                    className="group/addstage relative min-h-[56px] shrink-0 self-stretch border-b border-r border-neutral-200 bg-white transition-colors hover:bg-neutral-50/80"
                    style={{ width: 120 }}
                  >
                    <div
                      className="pointer-events-none absolute inset-x-0 top-full z-30 flex justify-center border-x border-b border-neutral-200 bg-white py-1.5 shadow-sm opacity-0 transition-opacity duration-150 group-hover/addstage:pointer-events-auto group-hover/addstage:opacity-100 group-focus-within/addstage:pointer-events-auto group-focus-within/addstage:opacity-100"
                      role="toolbar"
                      aria-label={(isL2Mode || isL3Mode) ? 'Add step' : 'Add stage'}
                    >
                      <button
                        type="button"
                        onClick={() => addStage((isL2Mode || isL3Mode) ? 'New step' : 'New stage')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        aria-label={(isL2Mode || isL3Mode) ? 'Add step' : 'Add stage'}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {(isL2Mode || isL3Mode) ? 'Add step' : 'Add stage'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {hasStageDescriptions && (
                <div ref={rightDescriptionRowRef} className="flex">
                  {sortedStages.map((stage) => {
                    const stageSteps = stepsPerStage.get(stage.id) || [];
                    const colCount = Math.max(stageSteps.length, 1);
                    return (
                      <StageDescription
                        key={stage.id}
                        stage={stage}
                        width={colCount * STEP_WIDTH}
                      />
                    );
                  })}
                  <div
                    className="shrink-0 border-b border-r border-neutral-200 bg-white"
                    style={{ width: 120, minWidth: 120 }}
                  />
                </div>
              )}

              {showStepHeaders && (
                <div className="flex border-b border-neutral-200 bg-white">
                  {sortedStages.map((stage) => {
                    const stageSteps = stepsPerStage.get(stage.id) || [];
                    if (stageSteps.length === 0) {
                      return (
                        <div
                          key={stage.id}
                          className="shrink-0 border-r border-neutral-200 bg-white"
                          style={{ width: STEP_WIDTH, minHeight: 48 }}
                        />
                      );
                    }

                    return stageSteps.map((step, stepIdx) => (
                      <div
                        key={step.id}
                        className={cn('shrink-0 bg-white', stepHeaderBorderR(stepIdx, stageSteps.length))}
                        style={{ width: STEP_WIDTH, minHeight: 48 }}
                      >
                        <StepHeader
                          step={step}
                          stepWidth={STEP_WIDTH}
                          canMoveLeft={stepIdx > 0}
                          canMoveRight={stepIdx < stageSteps.length - 1}
                        />
                      </div>
                    ));
                  })}
                  <div
                    className="shrink-0 border-r border-neutral-200 bg-white"
                    style={{ width: 120, minWidth: 120 }}
                  />
                </div>
              )}

              {/* Storyboard row — image thumbnails per step */}
              {storyboardVisible && (
              <div
                ref={rightStoryboardRowRef}
                className={cn(
                  'flex border-b border-neutral-200',
                  storyboardCollapsed && 'bg-neutral-50/80',
                )}
                style={storyboardCollapsed ? { height: COLLAPSED_LANE_H } : { minHeight: STORYBOARD_ROW_H }}
              >
                {storyboardCollapsed
                  ? sortedStages.map((stage) => {
                      const stageSteps = stepsPerStage.get(stage.id) || [];
                      if (stageSteps.length === 0) {
                        return (
                          <div
                            key={stage.id}
                            className="shrink-0 border-r border-neutral-200"
                            style={{ width: STEP_WIDTH, height: COLLAPSED_LANE_H }}
                          />
                        );
                      }
                      return stageSteps.map((step, stepIdx) => {
                        const n = storyboardImagesByStep.get(step.id)?.length ?? 0;
                        return (
                          <div
                            key={step.id}
                            className={cn(
                              'flex shrink-0 items-center px-4',
                              stepBorderR(stepIdx, stageSteps.length),
                            )}
                            style={{ width: STEP_WIDTH, height: COLLAPSED_LANE_H }}
                          >
                            {n > 0 ? (
                              <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-500">
                                {n} image{n !== 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-[11px] text-neutral-300">&nbsp;</span>
                            )}
                          </div>
                        );
                      });
                    })
                  : sortedStages.map((stage) => {
                      const stageSteps = stepsPerStage.get(stage.id) || [];
                      if (stageSteps.length === 0) {
                        return (
                          <div
                            key={stage.id}
                            className="shrink-0 border-r border-neutral-200"
                            style={{ width: STEP_WIDTH, minHeight: STORYBOARD_ROW_H }}
                          />
                        );
                      }
                      return stageSteps.map((step, stepIdx) => (
                        <div
                          key={step.id}
                          className={cn(
                            'shrink-0',
                            stepBorderR(stepIdx, stageSteps.length),
                          )}
                          style={{ width: STEP_WIDTH, minHeight: STORYBOARD_ROW_H }}
                        >
                          <StoryboardCell
                            stepId={step.id}
                            microPageOnly={isL3Mode}
                            allowMultipleImages={isL3Mode}
                            images={storyboardImagesByStep.get(step.id) ?? []}
                            onAddImage={addStoryboardImageIfAllowed}
                            onUpdateImage={updateStoryboardImage}
                            onRemoveImage={removeStoryboardImage}
                          />
                        </div>
                      ));
                    })}
              </div>
            )}
            </div>

            {/* Lane rows — cells only, no label (label is in left panel). */}
            {effectiveVisibleLanes.map((lane, laneIdx) => {
              const isAfterVisibility =
                lineOfVisibilityIndex >= 0 && laneIdx === lineOfVisibilityIndex + 1;
              return (
                <div key={lane.key}>
                  {isAfterVisibility && (
                    <div
                      className="border-b border-t-2 border-t-neutral-400 bg-neutral-100"
                      style={{ height: LOV_H }}
                    />
                  )}
                  <div
                    ref={(el) => {
                      if (el) rightLaneRowRefs.current.set(lane.key, el);
                      else rightLaneRowRefs.current.delete(lane.key);
                    }}
                    className={cn(
                      'flex border-b border-neutral-200',
                      lane.collapsed && 'bg-neutral-50/80',
                    )}
                  >
                    {lane.collapsed
                      ? sortedStages.map((stage) => {
                          const stageSteps = stepsPerStage.get(stage.id) || [];
                          if (stageSteps.length === 0) {
                            return (
                              <div
                                key={stage.id}
                                className="shrink-0 border-r border-neutral-200"
                                style={{ width: STEP_WIDTH, height: COLLAPSED_LANE_H }}
                              />
                            );
                          }
                          return stageSteps.map((step, stepIdx) => {
                            const hiddenCards = getCardsForCell(step.id, lane.key).length;
                            return (
                              <div
                                key={step.id}
                                className={cn(
                                  'flex shrink-0 items-center px-4',
                                  stepBorderR(stepIdx, stageSteps.length),
                                )}
                                style={{ width: STEP_WIDTH, height: COLLAPSED_LANE_H }}
                              >
                                {hiddenCards > 0 ? (
                                  <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-500">
                                    {hiddenCards} hidden
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-neutral-300"> </span>
                                )}
                              </div>
                            );
                          });
                        })
                      : sortedStages.map((stage) => {
                          const stageSteps = stepsPerStage.get(stage.id) || [];
                          if (stageSteps.length === 0) {
                            return (
                              <div
                                key={stage.id}
                                className="shrink-0 border-r border-neutral-200 p-1"
                                style={{ width: STEP_WIDTH, minHeight: 88 }}
                              />
                            );
                          }
                          return stageSteps.map((step, stepIdx) => (
                            <div
                              key={step.id}
                              className={cn(
                                'shrink-0 p-1',
                                stepBorderR(stepIdx, stageSteps.length),
                              )}
                              style={{ width: STEP_WIDTH, minHeight: 88 }}
                            >
                              <CellArea
                                stepId={step.id}
                                laneKey={lane.key}
                                cards={getCardsForCell(step.id, lane.key)}
                              />
                            </div>
                          ));
                        })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <CardDetailPanel />

        <div
          data-no-pan
          className="pointer-events-none absolute bottom-4 right-4 z-30"
        >
          <div className="pointer-events-auto flex items-stretch gap-0 rounded-2xl border border-neutral-200/90 bg-white/95 p-1 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={() => setPanMode((current) => !current)}
                    aria-label={panMode ? 'Disable pan mode' : 'Enable pan mode'}
                    aria-pressed={panMode}
                    className={cn(
                      'inline-flex h-10 w-10 items-center justify-center rounded-xl text-neutral-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                      panMode ? 'bg-blue-50 text-blue-700' : 'hover:bg-neutral-50',
                    )}
                  />
                }
              >
                <Hand aria-hidden="true" className="h-4.5 w-4.5" />
              </TooltipTrigger>
              <TooltipContent className="items-center text-center">{panMode ? 'Disable hand panning' : 'Enable hand panning'}</TooltipContent>
            </Tooltip>
            <div className="my-1 w-px self-stretch bg-neutral-200" />
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={handleScrollToTop}
                    aria-label="Scroll board to top"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-neutral-600 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  />
                }
              >
                <ArrowUp aria-hidden="true" className="h-4.5 w-4.5" />
              </TooltipTrigger>
              <TooltipContent className="items-center text-center">Scroll to top</TooltipContent>
            </Tooltip>
            <div className="my-1 w-px self-stretch bg-neutral-200" />
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={() => {
                      void toggleFullscreen();
                    }}
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-neutral-600 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  />
                }
              >
                {isFullscreen ? (
                  <Minimize2 aria-hidden="true" className="h-4.5 w-4.5" />
                ) : (
                  <Maximize2 aria-hidden="true" className="h-4.5 w-4.5" />
                )}
              </TooltipTrigger>
              <TooltipContent className="items-center text-center">{isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeCard ? <BlueprintCard card={activeCard} isDragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
