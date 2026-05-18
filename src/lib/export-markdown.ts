import { BlueprintState, LaneKey } from './types';
import {
  L1_MACRO_LANE_KEYS,
  L1_MACRO_LANES,
  L2_LANE_KEYS,
  L3_LANE_KEYS,
} from './lane-definitions';
import { getActiveBlueprintJourneyLevel } from './blueprint-levels';

const LANE_SWIMLANE_LABEL: Record<LaneKey, string> = {
  actor: 'actor',
  user_action_event: 'user_action',
  user_need: 'user_need',
  pain_point: 'pain_point',
  frontstage_touchpoint: 'frontstage_touchpoint',
  activity: 'activity',
  backstage_process: 'backstage_process',
  description: 'description',
  behaviour_change: 'behaviour_change',
  success_measure: 'success_measure',
  motivation: 'motivation',
  ability: 'ability',
  prompts: 'prompts',
  system: 'support_system',
  policy_intent: 'policy_intent',
  business_rule: 'business_rule',
  data_input: 'data_in',
  data_output: 'data_out',
  backstage_actor: 'backstage_actor',
  shared_services: 'shared_services',
  opportunities: 'opportunities',
  ideas: 'ideas',
  // L1 Macro lanes
  policy_outcome: 'policy_outcome',
  user_outcome: 'user_outcome',
  operational_outcome: 'operational_outcome',
  insights: 'insights',
  impact_of_pain_points: 'impact_of_pain_points',
  performance_indicators: 'performance_indicators',
  opportunities_lane: 'opportunities',
  third_parties_involved: 'third_parties_involved',
  support_system: 'support_system',
};

const LANE_ORDER: LaneKey[] = [
  'actor',
  'user_action_event',
  'user_need',
  'pain_point',
  'frontstage_touchpoint',
  'activity',
  'backstage_process',
  'description',
  'behaviour_change',
  'success_measure',
  'motivation',
  'ability',
  'prompts',
  'system',
  'policy_intent',
  'business_rule',
  'data_input',
  'data_output',
  'backstage_actor',
  'shared_services',
  'opportunities',
  'ideas',
  // L1 Macro lanes
  'policy_outcome',
  'user_outcome',
  'operational_outcome',
  'insights',
  'impact_of_pain_points',
  'performance_indicators',
  'opportunities_lane',
  'third_parties_involved',
  'support_system',
];

/**
 * Pick the right lane key list for the blueprint based on its journey level —
 * mirrors the logic in Board.tsx so the export shows exactly the lanes the
 * editor would show for that level.
 *
 * - L3 micro    → L3_LANE_KEYS (e.g. business_rule, product_teams, backstage_actor…)
 * - L2 macro    → L2_LANE_KEYS
 * - L1 macro    → L1_MACRO_LANES (lifecycle blueprints with policy_reform, etc.)
 * - Otherwise   → legacy LANE_ORDER (for the original report-packaging-style standalone)
 */
function getLaneOrderForState(state: BlueprintState): LaneKey[] {
  const activeJourneyLevel = getActiveBlueprintJourneyLevel(state);
  const isChildView = Boolean(
    state.rootDocument && state.activeBlueprintId !== state.rootBlueprintId,
  );
  const isL2Mode = isChildView && activeJourneyLevel === 'L2';
  const isL3Mode = isChildView && activeJourneyLevel === 'L3';
  const isL1MacroMode = state.lanes.some((l) => L1_MACRO_LANE_KEYS.has(l.key));

  if (isL3Mode) return [...L3_LANE_KEYS];
  if (isL2Mode) return [...L2_LANE_KEYS];
  if (isL1MacroMode) return L1_MACRO_LANES.map((l) => l.key);
  return LANE_ORDER;
}

function stageCode(index: number): string {
  return `STG-${String(index + 1).padStart(2, '0')}`;
}

export function exportMarkdown(state: BlueprintState): string {
  const { blueprint, stages, steps, cards, cardLinks, evidence, opportunities } = state;

  const sortedStages = [...stages].sort((a, b) => a.order - b.order);
  const laneOrder = getLaneOrderForState(state);
  const lines: string[] = [];

  // ── Header ───────────────────────────────────────────────────────────────
  lines.push(`# Service Blueprint: ${blueprint.serviceName}`);
  lines.push('');
  if (blueprint.description) {
    lines.push(`> ${blueprint.description}`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  // ── Section 1: Service ────────────────────────────────────────────────────
  lines.push('## 1. Service');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|---|---|');
  lines.push(`| **service_name** | ${blueprint.serviceName} |`);
  lines.push(`| **description** | ${blueprint.description || '—'} |`);
  lines.push(`| **last_updated** | ${blueprint.updatedAt.split('T')[0]} |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Section 2: Stages ─────────────────────────────────────────────────────
  lines.push('## 2. Stages');
  lines.push('');
  lines.push('| stage_id | stage_number | stage_name | stage_outcome | preceding_stage_id |');
  lines.push('|---|---|---|---|---|');
  sortedStages.forEach((stage, i) => {
    const id = stage.traceabilityCode || stageCode(i);
    const precedingId = i === 0 ? '—' : (sortedStages[i - 1].traceabilityCode || stageCode(i - 1));
    const precedingCell = i === 0 ? '—' : `\`${precedingId}\``;
    lines.push(`| \`${id}\` | ${i + 1} | ${stage.title} | ${stage.outcome || '—'} | ${precedingCell} |`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Section 3: Actors ─────────────────────────────────────────────────────
  const actorCards = cards.filter((c) => c.laneKey === 'actor');
  lines.push('## 3. Actors');
  lines.push('');
  if (actorCards.length > 0) {
    lines.push('| actor_id | actor_name | description | tags |');
    lines.push('|---|---|---|---|');
    actorCards.forEach((card) => {
      const id = card.traceabilityCode || card.id.slice(0, 8);
      lines.push(
        `| \`${id}\` | ${card.title} | ${card.body || '—'} | ${card.tags.join(', ') || '—'} |`,
      );
    });
  } else {
    lines.push('_No actors defined._');
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Section 4: Blueprint ──────────────────────────────────────────────────
  lines.push('## 4. Blueprint');
  lines.push('');
  lines.push(
    'The core swimlane grid. Rows are swimlane categories; columns are steps (one per stage).',
  );
  lines.push('');

  sortedStages.forEach((stage, i) => {
    const stageId = stage.traceabilityCode || stageCode(i);
    const stageSteps = [...steps]
      .filter((s) => s.stageId === stage.id)
      .sort((a, b) => a.order - b.order);

    lines.push(`### ${stageId}: ${stage.title}`);
    lines.push('');
    lines.push('| Swimlane | Value |');
    lines.push('|---|---|');
    lines.push(`| **stage** | \`${stageId}\` |`);
    lines.push(`| **step** | ${stageSteps.map((s) => s.title).join('; ') || '—'} |`);

    for (const laneKey of laneOrder) {
      const laneCards = cards
        .filter((c) => c.stageId === stage.id && c.laneKey === laneKey)
        .sort((a, b) => a.order - b.order);
      const label = LANE_SWIMLANE_LABEL[laneKey];
      const value = laneCards.length ? laneCards.map((c) => c.title).join('; ') : '—';
      lines.push(`| **${label}** | ${value} |`);
    }

    lines.push('');
  });

  lines.push('---');
  lines.push('');

  // ── Section 5: Opportunities ──────────────────────────────────────────────
  lines.push('## 5. Opportunities');
  lines.push('');
  if (opportunities.length > 0) {
    lines.push(
      '| opportunity_id | title | statement | rationale | status | affected_stages | source_cards |',
    );
    lines.push('|---|---|---|---|---|---|---|');
    opportunities.forEach((opp) => {
      const id = opp.traceabilityCode || opp.id.slice(0, 8);
      const affectedStages = opp.affectedStages.length
        ? opp.affectedStages.join('; ')
        : '—';
      const sourceCards = opp.sourceCardIds
        .map((cardId) => {
          const c = cards.find((card) => card.id === cardId);
          return c ? (c.traceabilityCode || c.id.slice(0, 8)) : cardId.slice(0, 8);
        })
        .join('; ') || '—';
      lines.push(
        `| \`${id}\` | ${opp.title} | ${opp.statement || '—'} | ${opp.rationale || '—'} | ${opp.status} | ${affectedStages} | ${sourceCards} |`,
      );
    });
  } else {
    lines.push('_No opportunities defined._');
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Section 6: Card Links ─────────────────────────────────────────────────
  lines.push('## 6. Card Links');
  lines.push('');
  const visibleLinks = cardLinks.filter((l) => l.relation !== 'next_step');
  if (visibleLinks.length > 0) {
    lines.push('| link_id | source_card | relation | target_card |');
    lines.push('|---|---|---|---|');
    visibleLinks.forEach((link) => {
      const source = cards.find((c) => c.id === link.sourceCardId);
      const target = cards.find((c) => c.id === link.targetCardId);
      if (!source || !target) return;
      const srcId = source.traceabilityCode || source.id.slice(0, 8);
      const tgtId = target.traceabilityCode || target.id.slice(0, 8);
      lines.push(
        `| \`${link.id.slice(0, 8)}\` | ${source.title} (\`${srcId}\`) | ${link.relation} | ${target.title} (\`${tgtId}\`) |`,
      );
    });
  } else {
    lines.push('_No card links defined._');
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Section 7: Evidence ───────────────────────────────────────────────────
  lines.push('## 7. Evidence');
  lines.push('');
  if (evidence.length > 0) {
    lines.push('| evidence_id | card | quote | source | type | strength |');
    lines.push('|---|---|---|---|---|---|');
    evidence.forEach((ev) => {
      const card = cards.find((c) => c.id === ev.cardId);
      const cardRef = card
        ? `${card.title} (\`${card.traceabilityCode || card.id.slice(0, 8)}\`)`
        : ev.cardId.slice(0, 8);
      const evId = ev.traceabilityCode || ev.id.slice(0, 8);
      lines.push(
        `| \`${evId}\` | ${cardRef} | ${ev.quote || '—'} | ${ev.source || '—'} | ${ev.evidenceType} | ${ev.strength} |`,
      );
    });
  } else {
    lines.push('_No evidence records defined._');
  }
  lines.push('');

  return lines.join('\n');
}
