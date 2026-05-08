import { gunzipSync } from 'node:zlib';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, SHARE_NOT_CONFIGURED_MESSAGE } from '@/lib/supabase';

export const runtime = 'nodejs';

// POST /api/share
// Body: JSON of the Zustand snapshot, optionally gzip-compressed (Content-Encoding: gzip).
// Returns: { id: string } — use it to build the /view/<id> URL.
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: SHARE_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  }

  let snapshot: unknown;
  try {
    const raw = Buffer.from(await req.arrayBuffer());
    const encoding = req.headers.get('content-encoding')?.toLowerCase();
    const utf8 =
      encoding === 'gzip'
        ? gunzipSync(raw, { maxOutputLength: 80 * 1024 * 1024 }).toString('utf8')
        : raw.toString('utf8');
    snapshot = JSON.parse(utf8) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Basic shape guard: must be an object. Everything else (stages, cards,
  // lanes) is validated on load by the existing normalizeState() function,
  // so we don't re-validate here.
  if (!snapshot || typeof snapshot !== 'object') {
    return NextResponse.json({ error: 'Snapshot must be an object.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('blueprints')
    .insert({ snapshot })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
