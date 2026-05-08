/**
 * OpportunityClusteringService — provider interface.
 *
 * Swap providers by passing a different implementation to whatever calls
 * generateClusters(). Current implementations:
 *   - MockOpportunityClusteringService  (heuristic, deterministic)
 *   - OpenAIClusteringService           (gpt-4o single-prompt)
 *
 * Extension points:
 *   - Add ClusterOptions parameter for strategy configuration
 *   - Add streaming/progress callback for long-running LLM calls
 */

import type { ClusterInput, ClusterResult } from './types';

export interface OpportunityClusteringService {
  /**
   * Groups insight cards (pain_point and user_need) into proposed opportunity clusters.
   *
   * @param inputs - Insight cards to cluster
   * @returns Proposed clusters + any unclustered card IDs
   */
  generateClusters(inputs: ClusterInput[]): Promise<ClusterResult>;
}
