'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[service-blueprint] Client error boundary', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fafafa] px-6 text-center">
      <h1 className="text-lg font-semibold text-neutral-900">Something went wrong</h1>
      <p className="max-w-md text-sm text-neutral-600">
        The app hit a client error. You can try again, or clear site data for this domain if it keeps
        happening after an update.
      </p>
      {process.env.NODE_ENV === 'development' && (
        <pre className="max-h-40 max-w-full overflow-auto rounded-md bg-neutral-100 p-3 text-left text-xs text-red-800">
          {error.message}
        </pre>
      )}
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        Try again
      </button>
    </div>
  );
}
