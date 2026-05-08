/**
 * Clustering service types.
 *
 * Extension points:
 * - Add embedding vectors to ClusterInput for semantic clustering
 * - Add ClusterStrategy union to switch between heuristic, embedding, and LLM approaches
 * - Add confidence thresholds and minimum cluster size options to ClusterOptions
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export const ClusterInputSchema = z.object({
  cardId: z.string(),
  cardTitle: z.string(),
  cardBody: z.string(),
  stageId: z.string(),
  stageTitle: z.string(),
  stepId: z.string(),
  stepTitle: z.string(),
  tags: z.array(z.string()),
  /** Which lane this card comes from */
  sourceType: z.enum(['pain_point', 'user_need', 'insights']),
  /** Optional evidence references (quote, source) for richer clustering */
  evidenceRefs: z.array(z.string()).optional(),
});

export type ClusterInput = z.infer<typeof ClusterInputSchema>;

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export const ProposedClusterSchema = z.object({
  clusterId: z.string(),
  proposedTitle: z.string(),
  proposedSummary: z.string(),
  includedCardIds: z.array(z.string()),
  /** 0.0 – 1.0 confidence score */
  confidence: z.number().min(0).max(1),
  /** Stage IDs affected by this cluster */
  affectedStages: z.array(z.string()),
  /** Step IDs affected by this cluster */
  affectedSteps: z.array(z.string()),
});

export type ProposedCluster = z.infer<typeof ProposedClusterSchema>;

export const ClusterResultSchema = z.object({
  clusters: z.array(ProposedClusterSchema),
  /** Card IDs that did not fit any cluster */
  unclusteredCardIds: z.array(z.string()),
});

export type ClusterResult = z.infer<typeof ClusterResultSchema>;

// ---------------------------------------------------------------------------
// Review state (UI-only — not persisted)
// ---------------------------------------------------------------------------

export type ClusterReviewStatus = 'pending' | 'accepted' | 'rejected';

export interface ReviewableCluster extends ProposedCluster {
  /** User-edited title (starts equal to proposedTitle) */
  editedTitle: string;
  /** User-edited summary (starts equal to proposedSummary) */
  editedSummary: string;
  reviewStatus: ClusterReviewStatus;
}
