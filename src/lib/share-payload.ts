/**
 * Share payload: trim to a size gateways accept, insert from browser → Supabase,
 * or gzip POST /api/share only when the body is under Vercel’s ~4.5MB cap.
 */

import { gzip } from 'fflate';
import { createClient } from '@supabase/supabase-js';
import type { BlueprintState } from '@/lib/types';

const VERCEL_SHARE_BODY_BUDGET = 4_000_000;

/**
 * Hard target for JSON.stringify length. Keeps direct Supabase REST inserts and
 * gzip+API fallback under common ~4–5MB gateway limits (gzip typically 25–40% of JSON for text).
 */
const TARGET_JSON_STRING_CHARS = 900_000;

const TOO_LARGE =
  'This blueprint is too large to share even after trimming. Try removing storyboard images or use Export.';

function isBlueprintState(s: unknown): s is BlueprintState {
  if (typeof s !== 'object' || s === null) return false;
  const o = s as Record<string, unknown>;
  return o.blueprint != null && Array.isArray(o.storyboardImages);
}

/** Remove ids that must not be copied into public share payloads (prevents others from overwriting your link). */
function stripShareTransportSecrets(doc: BlueprintState): BlueprintState {
  const d = cloneBlueprintForShareTransport(doc);
  const walk = (x: BlueprintState) => {
    if (x.blueprint?.publishedShareId) {
      const bp = { ...x.blueprint };
      delete bp.publishedShareId;
      x.blueprint = bp;
    }
    for (const ch of x.childBlueprints ?? []) walk(ch);
  };
  walk(d);
  return d;
}

function cloneBlueprintForShareTransport(doc: BlueprintState): BlueprintState {
  try {
    return structuredClone(doc);
  } catch {
    return JSON.parse(JSON.stringify(doc)) as BlueprintState;
  }
}

export function blueprintHasStoryboardImageBytes(doc: BlueprintState): boolean {
  const walk = (d: BlueprintState): boolean => {
    if ((d.storyboardImages ?? []).some((img) => (img.dataUrl?.length ?? 0) > 0)) return true;
    return (d.childBlueprints ?? []).some(walk);
  };
  return walk(doc);
}

export function stripStoryboardImageBytesForTransport(doc: BlueprintState): BlueprintState {
  const clone = cloneBlueprintForShareTransport(doc);
  const walk = (d: BlueprintState) => {
    d.storyboardImages = (d.storyboardImages ?? []).map((img) => ({ ...img, dataUrl: '' }));
    for (const child of d.childBlueprints ?? []) walk(child);
  };
  walk(clone);
  return clone;
}

function clip(s: string | undefined | null, max: number): string {
  if (s == null || s.length <= max) return s ?? '';
  return `${s.slice(0, max)}…`;
}

function truncateCardBodies(doc: BlueprintState, maxLen: number): BlueprintState {
  const d = cloneBlueprintForShareTransport(doc);
  const walk = (x: BlueprintState) => {
    x.cards = (x.cards ?? []).map((c) => {
      const b = c.body ?? '';
      if (b.length <= maxLen) return c;
      return { ...c, body: `${b.slice(0, maxLen)}\n\n… [truncated for share link]` };
    });
    for (const ch of x.childBlueprints ?? []) walk(ch);
  };
  walk(d);
  return d;
}

/** Shorten long string fields across the tree (OST + board prose dominates size). */
function clipTraceabilityProse(doc: BlueprintState, scale: number): BlueprintState {
  const d = cloneBlueprintForShareTransport(doc);
  const L = (n: number) => Math.max(80, Math.floor(n * scale));

  const walk = (x: BlueprintState) => {
    if (x.blueprint?.description) {
      x.blueprint = { ...x.blueprint, description: clip(x.blueprint.description, L(6000)) };
    }
    x.cards = (x.cards ?? []).map((c) => ({
      ...c,
      title: clip(c.title, L(1800)),
      body: clip(c.body, L(12000)),
      notes: c.notes ? clip(c.notes, L(4000)) : c.notes,
    }));
    x.opportunities = (x.opportunities ?? []).map((o) => ({
      ...o,
      title: clip(o.title, L(500)),
      statement: clip(o.statement, L(8000)),
      rationale: clip(o.rationale, L(8000)),
    }));
    x.outcomes = (x.outcomes ?? []).map((o) => ({
      ...o,
      title: clip(o.title, L(500)),
      description: o.description ? clip(o.description, L(12000)) : o.description,
      metric: o.metric ? clip(o.metric, L(8000)) : o.metric,
      priorityRationale: o.priorityRationale ? clip(o.priorityRationale, L(4000)) : o.priorityRationale,
    }));
    x.strategicGoals = (x.strategicGoals ?? []).map((g) => ({
      ...g,
      title: clip(g.title, L(400)),
      description: g.description ? clip(g.description, L(4000)) : g.description,
    }));
    x.systemOutcomes = (x.systemOutcomes ?? []).map((s) => ({
      ...s,
      title: clip(s.title, L(2500)),
    }));
    x.behaviourOutcomes = (x.behaviourOutcomes ?? []).map((b) => ({
      ...b,
      title: clip(b.title, L(2500)),
    }));
    x.serviceOutcomes = (x.serviceOutcomes ?? []).map((s) => ({
      ...s,
      title: clip(s.title, L(2500)),
    }));
    x.evidence = (x.evidence ?? []).map((e) => ({
      ...e,
      quote: clip(e.quote, L(4000)),
      source: clip(e.source, L(1200)),
    }));
    x.solutions = (x.solutions ?? []).map((s) => ({
      ...s,
      title: clip(s.title, L(500)),
      description: s.description ? clip(s.description, L(4000)) : s.description,
    }));
    x.assumptions = (x.assumptions ?? []).map((a) => ({
      ...a,
      title: clip(a.title, L(2000)),
      rationale: a.rationale ? clip(a.rationale, L(3000)) : a.rationale,
    }));
    x.requirements = (x.requirements ?? []).map((r) => ({
      ...r,
      title: clip(r.title, L(500)),
      description: r.description ? clip(r.description, L(4000)) : r.description,
      acceptanceCriteria: r.acceptanceCriteria ? clip(r.acceptanceCriteria, L(4000)) : r.acceptanceCriteria,
    }));
    x.apiContracts = (x.apiContracts ?? []).map((r) => ({
      ...r,
      title: clip(r.title, L(500)),
      description: r.description ? clip(r.description, L(4000)) : r.description,
    }));
    x.uiScaffolds = (x.uiScaffolds ?? []).map((r) => ({
      ...r,
      title: clip(r.title, L(500)),
      description: r.description ? clip(r.description, L(4000)) : r.description,
      componentName: r.componentName ? clip(r.componentName, L(500)) : r.componentName,
    }));
    x.stages = (x.stages ?? []).map((st) => ({
      ...st,
      title: clip(st.title, L(2000)),
      outcome: clip(st.outcome, L(4000)),
      description: st.description ? clip(st.description, L(4000)) : st.description,
    }));
    x.steps = (x.steps ?? []).map((st) => ({
      ...st,
      title: clip(st.title, L(2000)),
    }));
    for (const ch of x.childBlueprints ?? []) walk(ch);
  };
  walk(d);
  return d;
}

function jsonCharLength(obj: unknown): number {
  return JSON.stringify(obj).length;
}

/**
 * Card/link/evidence count dominates JSON size. Shrink each blueprint subtree until the
 * whole document fits — never rely on string clipping alone for huge boards.
 */
function thinCardsForShareBudget(doc: BlueprintState, keepRatio: number): BlueprintState {
  const d = cloneBlueprintForShareTransport(doc);
  const walk = (x: BlueprintState) => {
    const cards = [...(x.cards ?? [])].sort((a, b) => a.order - b.order);
    const keep = Math.max(0, Math.floor(cards.length * keepRatio));
    const kept = cards.slice(0, keep);
    const cardIds = new Set(kept.map((c) => c.id));
    x.cards = kept;
    x.cardLinks = (x.cardLinks ?? []).filter(
      (l) => cardIds.has(l.sourceCardId) && cardIds.has(l.targetCardId),
    );
    x.evidence = (x.evidence ?? []).filter((e) => cardIds.has(e.cardId));
    for (const ch of x.childBlueprints ?? []) walk(ch);
  };
  walk(d);
  return d;
}

/** Reduce opportunity/solution/assumption rows when the graph is huge (e.g. OST-heavy). */
function thinOpportunityGraphForShareBudget(doc: BlueprintState, keepRatio: number): BlueprintState {
  const d = cloneBlueprintForShareTransport(doc);
  const walk = (x: BlueprintState) => {
    const opps = [...(x.opportunities ?? [])].sort((a, b) =>
      (a.traceabilityCode ?? a.id).localeCompare(b.traceabilityCode ?? b.id),
    );
    const keep = Math.max(0, Math.floor(opps.length * keepRatio));
    const kept = opps.slice(0, keep);
    const oppIds = new Set(kept.map((o) => o.id));
    x.opportunities = kept;
    x.solutions = (x.solutions ?? []).filter((s) => !s.opportunityId || oppIds.has(s.opportunityId));
    const solIds = new Set((x.solutions ?? []).map((s) => s.id));
    x.assumptions = (x.assumptions ?? []).filter((a) => !a.solutionId || solIds.has(a.solutionId));
    for (const ch of x.childBlueprints ?? []) walk(ch);
  };
  walk(d);
  return d;
}

/**
 * Ensures JSON.stringify(doc).length ≤ TARGET. Drops cards and OST rows (by ratio)
 * across the tree until it fits — PostgREST sends uncompressed JSON.
 */
function finalizeBlueprintSharePayload(
  doc: BlueprintState,
  storyboardImagesStripped: boolean,
  shareTextTrimmed: boolean,
): PreparedShareSnapshot {
  let trimmed = shareTextTrimmed;
  let out = doc;
  let ratio = 0.92;
  let guard = 0;
  while (jsonCharLength(out) > TARGET_JSON_STRING_CHARS && guard < 72) {
    out = thinCardsForShareBudget(out, ratio);
    out = thinOpportunityGraphForShareBudget(out, ratio);
    trimmed = true;
    ratio *= 0.88;
    guard += 1;
  }
  if (jsonCharLength(out) > TARGET_JSON_STRING_CHARS) {
    throw new Error(TOO_LARGE);
  }
  return {
    payload: out,
    storyboardImagesStripped,
    shareTextTrimmed: trimmed,
  };
}

export type PreparedShareSnapshot = {
  payload: unknown;
  storyboardImagesStripped: boolean;
  /** True when card bodies or traceability text was clipped for size. */
  shareTextTrimmed: boolean;
};

export function prepareSnapshotForShare(snapshot: unknown): PreparedShareSnapshot {
  if (!isBlueprintState(snapshot)) {
    const len = jsonCharLength(snapshot);
    if (len > TARGET_JSON_STRING_CHARS) {
      throw new Error(TOO_LARGE);
    }
    return {
      payload: snapshot,
      storyboardImagesStripped: false,
      shareTextTrimmed: false,
    };
  }

  const storyboardImagesStripped = blueprintHasStoryboardImageBytes(snapshot);
  let shareTextTrimmed = false;
  const baseForShare = stripShareTransportSecrets(snapshot);
  let doc = stripStoryboardImageBytesForTransport(baseForShare);

  const cardSteps = [6_000, 2_500, 900, 300, 100, 40] as const;
  for (const max of cardSteps) {
    if (jsonCharLength(doc) <= TARGET_JSON_STRING_CHARS) break;
    doc = truncateCardBodies(stripStoryboardImageBytesForTransport(baseForShare), max);
    shareTextTrimmed = true;
  }

  const scales = [1, 0.45, 0.2, 0.08] as const;
  for (const scale of scales) {
    if (jsonCharLength(doc) <= TARGET_JSON_STRING_CHARS) break;
    doc = clipTraceabilityProse(doc, scale);
    shareTextTrimmed = true;
  }

  let safety = 0;
  while (jsonCharLength(doc) > TARGET_JSON_STRING_CHARS && safety < 12) {
    doc = truncateCardBodies(doc, 20);
    doc = clipTraceabilityProse(doc, 0.08);
    shareTextTrimmed = true;
    if (jsonCharLength(doc) > TARGET_JSON_STRING_CHARS * 1.2) {
      doc = truncateCardBodies(doc, 0);
      shareTextTrimmed = true;
    }
    safety += 1;
  }

  return finalizeBlueprintSharePayload(doc, storyboardImagesStripped, shareTextTrimmed);
}

function byteLength(body: ArrayBuffer): number {
  return body.byteLength;
}

function gzipUtf8WithFflate(json: string): Promise<ArrayBuffer> {
  const input = new TextEncoder().encode(json);
  return new Promise((resolve, reject) => {
    gzip(input, { level: 6 }, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(new Uint8Array(result).buffer);
    });
  });
}

async function encodeShareJsonToGzip(json: string): Promise<ArrayBuffer> {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
      const buf = await new Response(stream).arrayBuffer();
      if (buf.byteLength > 0) return buf;
    } catch {
      // fall through
    }
  }
  return gzipUtf8WithFflate(json);
}

async function gzipBytesUnderVercelLimit(prepared: PreparedShareSnapshot): Promise<boolean> {
  const json = JSON.stringify(prepared.payload);
  const body = await encodeShareJsonToGzip(json);
  return byteLength(body) <= VERCEL_SHARE_BODY_BUDGET;
}

export type SharePostRequest = {
  init: RequestInit;
  storyboardImagesStripped: boolean;
  shareTextTrimmed: boolean;
};

async function buildSharePostInitFromPrepared(prepared: PreparedShareSnapshot): Promise<SharePostRequest> {
  const json = JSON.stringify(prepared.payload);
  const body = await encodeShareJsonToGzip(json);

  if (byteLength(body) > VERCEL_SHARE_BODY_BUDGET) {
    throw new Error(TOO_LARGE);
  }

  return {
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Encoding': 'gzip',
      },
      body,
    },
    storyboardImagesStripped: prepared.storyboardImagesStripped,
    shareTextTrimmed: prepared.shareTextTrimmed,
  };
}

export async function buildSharePostInit(snapshot: unknown): Promise<SharePostRequest> {
  return buildSharePostInitFromPrepared(prepareSnapshotForShare(snapshot));
}

export type ShareCreated = {
  id: string;
  storyboardImagesStripped: boolean;
  shareTextTrimmed: boolean;
};

export async function createShareAndGetId(snapshot: unknown): Promise<ShareCreated> {
  const prepared = prepareSnapshotForShare(snapshot);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase
      .from('blueprints')
      .insert({ snapshot: prepared.payload })
      .select('id')
      .single();

    if (!error && data?.id) {
      return {
        id: data.id,
        storyboardImagesStripped: prepared.storyboardImagesStripped,
        shareTextTrimmed: prepared.shareTextTrimmed,
      };
    }
    console.warn('[share] Direct Supabase insert failed:', error?.message);

    const canTryApi = await gzipBytesUnderVercelLimit(prepared);
    if (!canTryApi) {
      throw new Error(
        error?.message
          ? `Could not create share: ${error.message}`
          : 'Could not create share (storage rejected the payload and it is too large for the API fallback).',
      );
    }
  } else {
    const ok = await gzipBytesUnderVercelLimit(prepared);
    if (!ok) {
      throw new Error(TOO_LARGE);
    }
  }

  const { init, storyboardImagesStripped, shareTextTrimmed } = await buildSharePostInitFromPrepared(prepared);
  const res = await fetch('/api/share', init);
  const resBody = await res.json().catch(() => ({}));
  if (!res.ok || !resBody.id) {
    const msg =
      typeof resBody.error === 'string'
        ? resBody.error
        : res.status === 413
          ? 'Share payload is too large for this server.'
          : `Share failed with HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    id: resBody.id as string,
    storyboardImagesStripped,
    shareTextTrimmed,
  };
}

/**
 * Publishes the document to Supabase. Reuses `existingShareId` when set so `/view/:id`
 * keeps serving the latest snapshot after PATCH. Stale ids (404) fall back to a new insert.
 */
export async function publishOrRefreshShare(
  snapshot: unknown,
  existingShareId?: string | null,
): Promise<ShareCreated> {
  if (!existingShareId) {
    return createShareAndGetId(snapshot);
  }

  const prepared = prepareSnapshotForShare(snapshot);
  const json = JSON.stringify(prepared.payload);
  const body = await encodeShareJsonToGzip(json);

  if (byteLength(body) > VERCEL_SHARE_BODY_BUDGET) {
    throw new Error(TOO_LARGE);
  }

  const res = await fetch(`/api/share/${encodeURIComponent(existingShareId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Encoding': 'gzip',
    },
    body,
  });

  const resBody = await res.json().catch(() => ({}));

  if (res.status === 404) {
    return createShareAndGetId(snapshot);
  }

  if (!res.ok) {
    const msg =
      typeof resBody.error === 'string'
        ? resBody.error
        : res.status === 413
          ? 'Share payload is too large for this server.'
          : `Publish failed with HTTP ${res.status}`;
    throw new Error(msg);
  }

  return {
    id: existingShareId,
    storyboardImagesStripped: prepared.storyboardImagesStripped,
    shareTextTrimmed: prepared.shareTextTrimmed,
  };
}
