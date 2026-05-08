'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Trash2, FolderOpen } from 'lucide-react';
import { useLibraryStore, type LibraryEntry } from '@/store/library-store';
import { useBlueprintStore } from '@/store/blueprint-store';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { blueprintTitleLabel } from '@/lib/blueprint-title';
import {
  getCanonicalRootBlueprintId,
  getLibraryEntryJourneyLevel,
  isActiveLibraryEntry,
  LIBRARY_LEVEL_PILL,
} from '@/lib/blueprint-levels';

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function LibrarySheet({ open, onClose }: Props) {
  const entries = useLibraryStore((s) => s.entries);
  const hydrateLibrary = useLibraryStore((s) => s.hydrate);
  const saveToLibrary = useLibraryStore((s) => s.save);
  const removeFromLibrary = useLibraryStore((s) => s.remove);

  const blueprint = useBlueprintStore((s) => s.blueprint);
  const liveDoc = useBlueprintStore.getState().getLiveDocumentSnapshot();
  const persistableDocument = useBlueprintStore.getState().getPersistableDocument();
  const loadBlueprint = useBlueprintStore((s) => s.loadBlueprint);

  const [savedId, setSavedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    hydrateLibrary();
  }, [hydrateLibrary]);

  const handleSave = () => {
    const entry = saveToLibrary(persistableDocument);
    setSavedId(entry.id);
    setTimeout(() => setSavedId(null), 2000);
  };

  const handleOpen = (entry: LibraryEntry) => {
    loadBlueprint(entry.state);
    onClose();
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      removeFromLibrary(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  const isCurrentlySaved = entries.some((e) => e.id === persistableDocument.blueprint.id);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] flex flex-col p-0">
        <SheetHeader className="border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-neutral-500" />
            <SheetTitle className="text-base font-semibold text-neutral-900">Service Design Library</SheetTitle>
          </div>
          <SheetDescription className="text-[12px] text-neutral-500">
            Browse and manage your saved service blueprints and user journeys.
          </SheetDescription>
        </SheetHeader>

        {/* Library list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-neutral-400">
              <BookOpen className="h-8 w-8 opacity-30" />
              <p className="text-[13px]">No saved blueprints yet.<br />Save the current one to get started.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => {
                const sessionRootId =
                  liveDoc.rootBlueprintId ?? liveDoc.blueprint.id;
                const isSameDocument =
                  getCanonicalRootBlueprintId(entry.state) === sessionRootId;
                const isActive = isActiveLibraryEntry(
                  liveDoc,
                  entry.state,
                  entry.id,
                );
                const listTitle = isActive
                  ? blueprintTitleLabel(blueprint.serviceName)
                  : entry.serviceName;
                const levelState = isSameDocument ? liveDoc : entry.state;
                const levelTargetId = entry.id;
                const entryLevel = getLibraryEntryJourneyLevel(
                  levelState,
                  levelTargetId,
                );
                const levelPill = LIBRARY_LEVEL_PILL[entryLevel];
                return (
                  <li
                    key={entry.id}
                    className={`group relative rounded-xl border bg-white p-4 transition-colors ${
                      isActive
                        ? 'border-blue-200 bg-blue-50/50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-neutral-900">
                          {listTitle}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-400">
                          Saved {formatDate(entry.savedAt)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex max-w-full rounded-md px-2.5 py-0.5 text-[10px] font-semibold leading-snug ${levelPill.className}`}
                          >
                            {levelPill.label}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {!isActive && (
                          <button
                            onClick={() => handleOpen(entry)}
                            title="Open blueprint"
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-blue-600 transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            Open
                          </button>
                        )}
                        {isActive && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-600">
                            Active
                          </span>
                        )}
                        <button
                          onClick={() => handleDelete(entry.id)}
                          title={confirmDeleteId === entry.id ? 'Click again to confirm' : 'Delete from library'}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
                            confirmDeleteId === entry.id
                              ? 'bg-red-50 text-red-600'
                              : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
                          }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {confirmDeleteId === entry.id && (
                      <p className="mt-2 text-[11px] text-red-500">Click delete again to confirm removal.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
