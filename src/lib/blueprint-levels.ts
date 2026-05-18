import type { BlueprintState } from '@/lib/types';

/** Walk upward to the lifecycle (L1) root so library rows don't recurse infinitely via rootDocument ↔ childBlueprints. */
function getCanonicalRootState(state: BlueprintState): BlueprintState {
  const seen = new Set<string>();
  let current: BlueprintState = state;
  for (let i = 0; i < 64; i++) {
    const next = current.rootDocument;
    if (!next) return current;
    const nextId = next.blueprint?.id;
    if (nextId && seen.has(nextId)) {
      console.warn('[service-blueprint] Cyclic rootDocument chain; using nearest stable root.');
      return current;
    }
    const id = current.blueprint?.id;
    if (id) seen.add(id);
    current = next;
  }
  console.warn('[service-blueprint] rootDocument chain exceeded max depth.');
  return current;
}

/**
 * Journey level for the blueprint this library row represents (`entry.id`),
 * not every level that appears anywhere under the lifecycle root.
 */
export function getLibraryEntryJourneyLevel(
  _state: BlueprintState,
  _entryBlueprintId: string,
): 'L1' | 'L2' | 'L3' {
  return 'L1';
}

export function getActiveBlueprintJourneyLevel(
  _state: BlueprintState,
): 'L1' | 'L2' | 'L3' {
  return 'L1';
}

/** Lifecycle root blueprint id for a snapshot (used to match library rows to the open document). */
export function getCanonicalRootBlueprintId(state: BlueprintState): string {
  return getCanonicalRootState(state).blueprint?.id ?? '';
}

/** True when a library row represents the exact blueprint currently open in the editor. */
export function isActiveLibraryEntry(
  currentState: BlueprintState,
  entry: BlueprintState,
  entryBlueprintId: string,
): boolean {
  return (
    getCanonicalRootBlueprintId(entry) === getCanonicalRootBlueprintId(currentState) &&
    entryBlueprintId === (currentState.activeBlueprintId ?? currentState.blueprint?.id ?? '')
  );
}

export const LIBRARY_LEVEL_PILL: Record<
  'L1' | 'L2' | 'L3',
  { label: string; className: string }
> = {
  L1: {
    label: 'L1 · Lifecycle',
    className:
      'border border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  L2: {
    label: 'L2 · Macro journey',
    className: 'border border-sky-200 bg-sky-50 text-sky-900',
  },
  L3: {
    label: 'L3 · Micro (Service or product)',
    className:
      'border border-violet-200 bg-violet-50 text-violet-900',
  },
};
