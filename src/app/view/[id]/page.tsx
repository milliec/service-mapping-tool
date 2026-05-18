'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useBlueprintStore } from '@/store/blueprint-store';
import { BoardToolbar } from '@/components/board/BoardToolbar';
import { Board } from '@/components/board/Board';
import type { BlueprintState } from '@/lib/types';

type FetchState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

export default function ViewSharePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const loadSharedSnapshot = useBlueprintStore((s) => s.loadSharedSnapshot);
  const stages = useBlueprintStore((s) => s.stages);

  const [fetchState, setFetchState] = useState<FetchState>({ status: 'loading' });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    // Fetch the snapshot from our API route and load it into the store. We
    // intentionally avoid hydrate() on this route so the viewer's own
    // localStorage is never overwritten by someone else's shared board.
    (async () => {
      try {
        const res = await fetch(`/api/share/${encodeURIComponent(id)}`);
        if (cancelled) return;
        if (res.status === 404) {
          setFetchState({ status: 'not-found' });
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setFetchState({ status: 'error', message: body.error ?? `HTTP ${res.status}` });
          return;
        }
        const body = (await res.json()) as { snapshot: BlueprintState };
        if (cancelled) return;
        loadSharedSnapshot(body.snapshot);
        setFetchState({ status: 'ready' });
      } catch (err) {
        if (cancelled) return;
        setFetchState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, loadSharedSnapshot]);

  if (fetchState.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafafa]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
      </div>
    );
  }

  if (fetchState.status === 'not-found') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-[#fafafa] px-6 text-center">
        <h1 className="text-lg font-semibold text-neutral-900">Share link not found</h1>
        <p className="max-w-md text-sm text-neutral-500">
          This link may have been mistyped or the snapshot no longer exists.
        </p>
      </div>
    );
  }

  if (fetchState.status === 'error') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-[#fafafa] px-6 text-center">
        <h1 className="text-lg font-semibold text-neutral-900">Couldn&rsquo;t load this share link</h1>
        <p className="max-w-md text-sm text-neutral-500">{fetchState.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Try again
        </button>
      </div>
    );
  }

  // Ready — render the same board UI. The readOnly flag (set by
  // loadSharedSnapshot) will be honoured to disable editing.
  return (
    <div className="flex h-screen flex-col bg-[#fafafa]">
      <BoardToolbar onImport={() => { /* no-op in read-only */ }} />
      {stages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-neutral-500">
          This shared blueprint is empty.
        </div>
      ) : (
        <Board />
      )}
    </div>
  );
}
