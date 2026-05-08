/**
 * OpenAIClusteringService — semantic AI-powered clustering via gpt-4o.
 *
 * Uses a single chat completion call with response_format: json_object to
 * cluster insight cards (pain_point and user_need) into thematic opportunity areas.
 *
 * Requires NEXT_PUBLIC_OPENAI_API_KEY to be set. Because this is a NEXT_PUBLIC_*
 * variable it is embedded in the client bundle — dangerouslyAllowBrowser is set
 * accordingly. This is consistent with the project's no-backend architecture.
 *
 * Swap provider:
 *   const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
 *   const service = apiKey
 *     ? new OpenAIClusteringService(apiKey)
 *     : new MockOpportunityClusteringService();
 */

import OpenAI from 'openai';
import { v4 as uuid } from 'uuid';
import type { OpportunityClusteringService } from './service';
import { ClusterResultSchema } from './types';
import type { ClusterInput, ClusterResult } from './types';

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a service design analyst. Your task is to group insight cards from a service blueprint into thematic opportunity clusters for a service improvement team.

Each card has a sourceType of either "pain_point" (something currently going wrong) or "user_need" (what the user is trying to achieve). Both types are valuable inputs for identifying improvement opportunities.

RULES:
- Each cluster must describe a PROBLEM AREA or IMPROVEMENT OPPORTUNITY — never a specific solution or feature request.
- A pain_point card and a user_need card in the same stage/step that share a theme SHOULD be placed in the same cluster.
- Cluster titles should be human-centred problem statements (e.g. "Lack of clarity around submission requirements", NOT "Build a help widget").
- Confidence is a float 0.0–1.0 reflecting thematic coherence: high confidence (0.7+) when cards strongly align; low (below 0.4) when grouping is loose.
- Each card may appear in at most one cluster. Cards that do not fit any cluster belong in unclusteredCardIds.
- affectedStages must contain only stageId values from the input; affectedSteps must contain only stepId values from the input.
- clusterId must be a unique string for each cluster.

RESPONSE FORMAT — return ONLY this JSON object, no prose, no markdown fences:
{
  "clusters": [
    {
      "clusterId": "<unique string>",
      "proposedTitle": "<problem area title>",
      "proposedSummary": "<2-3 sentence opportunity statement>",
      "includedCardIds": ["<cardId>", ...],
      "confidence": 0.85,
      "affectedStages": ["<stageId>", ...],
      "affectedSteps": ["<stepId>", ...]
    }
  ],
  "unclusteredCardIds": ["<cardId>", ...]
}`;

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

export class OpenAIClusteringService implements OpportunityClusteringService {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string = 'gpt-4o',
  ) {
    // dangerouslyAllowBrowser is required because NEXT_PUBLIC_* env vars are
    // embedded in the client bundle. Acceptable for this no-backend tool.
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }

  async generateClusters(inputs: ClusterInput[]): Promise<ClusterResult> {
    if (inputs.length === 0) {
      return { clusters: [], unclusteredCardIds: [] };
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(inputs) },
      ],
    });

    const raw = JSON.parse(response.choices[0].message.content ?? '{}');

    // Validate with Zod — throws ZodError with descriptive message on failure
    const validated = ClusterResultSchema.parse(raw);

    // Re-assign fresh UUIDs to prevent the model returning duplicate cluster IDs
    const result: ClusterResult = {
      ...validated,
      clusters: validated.clusters.map((c) => ({ ...c, clusterId: uuid() })),
    };

    return result;
  }
}
