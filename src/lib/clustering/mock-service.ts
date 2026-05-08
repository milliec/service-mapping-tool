/**
 * MockOpportunityClusteringService
 *
 * Deterministic heuristic clustering for development and testing.
 * Groups pain points by keyword presence in title + body text.
 *
 * Keyword groups (extend this map to add more clusters):
 *   clarity    → fragmented, unclear, inconsistent, confusing, ambiguous
 *   manual     → manual, duplicate, re-enter, repeated, copy, retype
 *   speed      → delays, waiting, wait, approval, slow, long time
 *
 * Cards matching no group are returned as unclusteredCardIds.
 */

import { v4 as uuid } from 'uuid';
import type { OpportunityClusteringService } from './service';
import type { ClusterInput, ClusterResult, ProposedCluster } from './types';

// ---------------------------------------------------------------------------
// Keyword → cluster definition map (deterministic for testing)
// ---------------------------------------------------------------------------

interface ClusterDef {
  id: string; // stable test ID
  title: string;
  summary: string;
  keywords: string[];
}

const CLUSTER_DEFS: ClusterDef[] = [
  {
    id: 'cluster-clarity',
    title: 'Improve clarity and consistency of guidance',
    summary:
      'Multiple pain points indicate that guidance, information or requirements are fragmented, unclear or inconsistent, causing confusion and rework.',
    keywords: ['fragmented', 'unclear', 'inconsistent', 'confusing', 'ambiguous', 'contradiction'],
  },
  {
    id: 'cluster-manual',
    title: 'Reduce manual effort and duplication',
    summary:
      'Pain points reveal significant manual, duplicated or repetitive work where automation or better data flow could reduce burden.',
    keywords: ['manual', 'duplicate', 're-enter', 'repeated', 'copy', 'retype', 'again', 'twice'],
  },
  {
    id: 'cluster-speed',
    title: 'Improve processing speed and predictability',
    summary:
      'Delays, waiting periods and approval bottlenecks are creating unpredictable timelines and eroding confidence in the service.',
    keywords: ['delay', 'delays', 'waiting', 'wait', 'approval', 'slow', 'long time', 'bottleneck'],
  },
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function matchesKeywords(input: ClusterInput, keywords: string[]): boolean {
  const text = `${input.cardTitle} ${input.cardBody} ${input.tags.join(' ')}`.toLowerCase();
  return keywords.some((kw) => text.includes(kw.toLowerCase()));
}

function buildSummaryFromCards(baseSummary: string, cards: ClusterInput[]): string {
  const titles = cards.slice(0, 3).map((c) => `"${c.cardTitle}"`);
  const suffix =
    cards.length > 3
      ? ` and ${cards.length - 3} more insight${cards.length - 3 > 1 ? 's' : ''}.`
      : '.';
  return `${baseSummary} Sourced from: ${titles.join(', ')}${suffix}`;
}

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

export class MockOpportunityClusteringService implements OpportunityClusteringService {
  async generateClusters(inputs: ClusterInput[]): Promise<ClusterResult> {
    // Map cardId → cluster def IDs that matched (a card can match multiple)
    const cardClusterMap = new Map<string, string[]>();
    for (const input of inputs) {
      const matched: string[] = [];
      for (const def of CLUSTER_DEFS) {
        if (matchesKeywords(input, def.keywords)) {
          matched.push(def.id);
        }
      }
      cardClusterMap.set(input.cardId, matched);
    }

    // Build clusters — each def aggregates its matched cards
    const clusters: ProposedCluster[] = [];
    for (const def of CLUSTER_DEFS) {
      const matchedInputs = inputs.filter((inp) =>
        cardClusterMap.get(inp.cardId)?.includes(def.id),
      );
      if (matchedInputs.length === 0) continue;

      const affectedStageIds = [...new Set(matchedInputs.map((i) => i.stageId))];
      const affectedStepIds = [...new Set(matchedInputs.map((i) => i.stepId))];

      // Confidence: higher when more cards match and they span multiple stages
      const confidence = Math.min(
        0.5 + matchedInputs.length * 0.1 + affectedStageIds.length * 0.05,
        0.95,
      );

      clusters.push({
        clusterId: def.id, // stable for testing
        proposedTitle: def.title,
        proposedSummary: buildSummaryFromCards(def.summary, matchedInputs),
        includedCardIds: matchedInputs.map((i) => i.cardId),
        confidence,
        affectedStages: affectedStageIds,
        affectedSteps: affectedStepIds,
      });
    }

    // Cards that matched nothing → unclustered; create a catch-all cluster if ≥2
    const clusteredIds = new Set(clusters.flatMap((c) => c.includedCardIds));
    const unclustered = inputs.filter((i) => !clusteredIds.has(i.cardId));

    if (unclustered.length >= 2) {
      const affectedStageIds = [...new Set(unclustered.map((i) => i.stageId))];
      const affectedStepIds = [...new Set(unclustered.map((i) => i.stepId))];
      clusters.push({
        clusterId: `cluster-other-${uuid()}`,
        proposedTitle: 'Other insights requiring investigation',
        proposedSummary:
          'These insights did not match a known theme. Review them together to identify a common opportunity area.',
        includedCardIds: unclustered.map((i) => i.cardId),
        confidence: 0.3,
        affectedStages: affectedStageIds,
        affectedSteps: affectedStepIds,
      });
      return { clusters, unclusteredCardIds: [] };
    }

    return {
      clusters,
      unclusteredCardIds: unclustered.map((i) => i.cardId),
    };
  }
}
