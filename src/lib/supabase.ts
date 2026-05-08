import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Reads from NEXT_PUBLIC_* env vars so the same client works in both:
//   - server-side API routes (src/app/api/...)
//   - browser code (if we add client-side Supabase later)
// The anon key is *designed* for browser exposure; row-level security policies
// will constrain what it can do once we add auth for team features (E).

let cached: SupabaseClient | null | undefined;

/**
 * Server / API routes must call this instead of assuming Supabase exists.
 * Returns null when env is not configured — share routes then respond with 503
 * instead of crashing the module on import.
 */
export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    cached = null;
    return null;
  }
  cached = createClient(url, anonKey);
  return cached;
}

/** Message for clients when share storage is not wired up. */
export const SHARE_NOT_CONFIGURED_MESSAGE =
  'Share is not configured on this server. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (e.g. in .env.local or Vercel env).';

// Shape of a row in the `blueprints` table. Keep in sync with the Supabase
// table schema. `snapshot` is the entire Zustand state serialised as JSON.
export type BlueprintRow = {
  id: string;
  snapshot: unknown;
  created_at: string;
};
