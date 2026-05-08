import { gunzipSync } from 'node:zlib';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, SHARE_NOT_CONFIGURED_MESSAGE } from '@/lib/supabase';

// GET /api/share/[id]
// Returns: { snapshot: unknown, createdAt: string }
// The /view/[id] page calls this to hydrate a read-only board.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: SHARE_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  }

  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing share id.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('blueprints')
    .select('snapshot, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Share link not found.' }, { status: 404 });
  }

  return NextResponse.json({
    snapshot: data.snapshot,
    createdAt: data.created_at,
  });
}

export const runtime = 'nodejs';

// PATCH /api/share/[id]
// Body: same as POST /api/share — full snapshot JSON, optionally gzip-compressed.
// Updates the existing row so the same id continues to serve the latest map.
// Requires Supabase RLS (or policies) to allow UPDATE on `blueprints` for your deployment.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: SHARE_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  }

  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing share id.' }, { status: 400 });
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

  if (!snapshot || typeof snapshot !== 'object') {
    return NextResponse.json({ error: 'Snapshot must be an object.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('blueprints')
    .update({ snapshot })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.id) {
    return NextResponse.json({ error: 'Share link not found.' }, { status: 404 });
  }

  return NextResponse.json({ id: data.id });
}
