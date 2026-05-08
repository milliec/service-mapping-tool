import { create } from 'zustand';
import { type BlueprintState } from '@/lib/types';

const LIBRARY_KEY = 'service-blueprint-library';

export interface LibraryEntry {
  id: string;
  serviceName: string;
  savedAt: string;
  stageCount: number;
  stepCount: number;
  cardCount: number;
  state: BlueprintState;
}

interface LibraryStore {
  entries: LibraryEntry[];
  hydrate: () => void;
  save: (state: BlueprintState) => LibraryEntry;
  remove: (id: string) => void;
}

function loadLibrary(): LibraryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LibraryEntry[];
  } catch {
    return [];
  }
}

function saveLibrary(entries: LibraryEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(entries));
  } catch {
    /* quota exceeded */
  }
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  entries: [],

  hydrate: () => {
    set({ entries: loadLibrary() });
  },

  save: (state) => {
    const entry: LibraryEntry = {
      id: state.blueprint.id,
      serviceName: state.blueprint.serviceName,
      savedAt: new Date().toISOString(),
      stageCount: state.stages.length,
      stepCount: state.steps.length,
      cardCount: state.cards.length,
      state,
    };
    const existing = get().entries;
    const next = existing.some((e) => e.id === entry.id)
      ? existing.map((e) => (e.id === entry.id ? entry : e))
      : [entry, ...existing];
    saveLibrary(next);
    set({ entries: next });
    return entry;
  },

  remove: (id) => {
    const next = get().entries.filter((e) => e.id !== id);
    saveLibrary(next);
    set({ entries: next });
  },
}));
