import { type LaneDefinition, type LaneKey } from './types';

export const DEFAULT_LANES: LaneDefinition[] = [
  { key: 'user_journey', title: 'User journey', order: 0, visible: true, collapsed: false },
  { key: 'actor', title: 'Actor', order: 1, visible: true, collapsed: false },
  { key: 'user_action_event', title: 'User action', order: 2, visible: true, collapsed: false },
  { key: 'user_need', title: 'User need', order: 3, visible: true, collapsed: false },
  { key: 'pain_point', title: 'Pain point', order: 4, visible: true, collapsed: false },
  { key: 'frontstage_touchpoint', title: 'Frontstage touchpoint', order: 5, visible: true, collapsed: false },
  { key: 'activity', title: 'Activity', order: 6, visible: true, collapsed: false },
  { key: 'backstage_process', title: 'Backstage process', order: 7, visible: true, collapsed: false },
  { key: 'description', title: 'Description', order: 8, visible: true, collapsed: false },
  { key: 'behaviour_change', title: 'Desired behaviour change', order: 9, visible: true, collapsed: false },
  { key: 'success_measure', title: 'Success measure', order: 10, visible: true, collapsed: false },
  { key: 'motivation', title: 'Motivation', order: 11, visible: true, collapsed: false },
  { key: 'ability', title: 'Ability', order: 12, visible: true, collapsed: false },
  { key: 'prompts', title: 'Prompts', order: 13, visible: true, collapsed: false },
  { key: 'system', title: 'System', order: 14, visible: true, collapsed: false },
  { key: 'policy_intent', title: 'Policy reform', order: 15, visible: true, collapsed: false },
  { key: 'business_rule', title: 'Business rule', order: 16, visible: false, collapsed: false },
  { key: 'data_input', title: 'Data input', order: 17, visible: false, collapsed: false },
  { key: 'data_output', title: 'Data output', order: 18, visible: false, collapsed: false },
  { key: 'backstage_actor', title: 'Backstage actor', order: 19, visible: false, collapsed: false },
  { key: 'shared_services', title: 'Shared services', order: 20, visible: false, collapsed: false },
  { key: 'product_teams', title: 'Product teams', order: 21, visible: false, collapsed: false },
  { key: 'opportunities', title: 'Opportunities', order: 22, visible: true, collapsed: false },
  { key: 'ideas', title: 'Ideas', order: 23, visible: true, collapsed: false },
];

/**
 * Lane definitions for L1-Macro lifecycle blueprints.
 *
 * Some lanes are `visible: false` by default (Success measure, Insights, Ideas) but stay in
 * this list and in the Lanes dropdown so they can be turned back on without code changes.
 */
export const L1_MACRO_LANES: LaneDefinition[] = [
  { key: 'policy_reform', title: 'Policy reform', order: 0, visible: true, collapsed: false },
  { key: 'user_journey', title: 'User journey', order: 1, visible: true, collapsed: false },
  { key: 'actor', title: 'Actors', order: 2, visible: true, collapsed: false },
  { key: 'policy_outcome', title: 'Policy outcome', order: 3, visible: true, collapsed: false },
  { key: 'user_outcome', title: 'User outcome', order: 4, visible: true, collapsed: false },
  { key: 'operational_outcome', title: 'Operational outcome', order: 5, visible: true, collapsed: false },
  { key: 'performance_indicators', title: 'Success measure', order: 6, visible: false, collapsed: false },
  { key: 'insights', title: 'Insights', order: 7, visible: false, collapsed: false },
  { key: 'pain_point', title: 'Pain points', order: 8, visible: true, collapsed: false },
  { key: 'impact_of_pain_points', title: 'Impact of pain points', order: 9, visible: true, collapsed: false },
  { key: 'opportunities_lane', title: 'Ideas', order: 10, visible: false, collapsed: false },
];

/** Lane keys that belong exclusively to L1-Macro blueprints. */
export const L1_MACRO_LANE_KEYS = new Set<LaneKey>([
  'policy_reform',
  'policy_outcome',
  'user_outcome',
  'operational_outcome',
  'insights',
  'impact_of_pain_points',
  'performance_indicators',
  'opportunities_lane',
]);

/** Lanes permanently hidden in L1-Macro view — not shown in the lanes toggle dropdown. */
export const L1_HIDDEN_LANE_KEYS = new Set([
  'user_action_event',
  'business_rule',
  'data_input',
  'data_output',
  'backstage_actor',
  'shared_services',
  'product_teams',
] as const);

/** Ordered set of lanes shown in L2-Macro view (includes user_journey for nested L3 journeys). */
export const L2_LANE_KEYS = [
  'user_journey', 'actor', 'frontstage_touchpoint', 'activity', 'user_need', 'pain_point',
  'backstage_process', 'behaviour_change', 'success_measure',
  'motivation', 'ability', 'prompts',
  'opportunities', 'ideas',
] as const;

/** Ordered set of lanes shown in L3-Micro view. Matches xlsx row order. */
export const L3_LANE_KEYS = [
  'product_teams',
  'actor',
  'user_action_event',
  'user_need',
  'pain_point',
  'frontstage_touchpoint',
  'backstage_actor',
  'backstage_process',
  'business_rule',
  'behaviour_change',
  'success_measure',
  'data_input',
  'data_output',
  'shared_services',
  'system',
  'opportunities',
  'ideas',
] as const;

/** Title overrides applied in L2-Macro view. */
export const L2_LANE_TITLE_OVERRIDES: Partial<Record<string, string>> = {
  user_journey: 'Service or product',
  system: 'Shared capabilities',
};

/** Title overrides applied in L3-Micro view. */
export const L3_LANE_TITLE_OVERRIDES: Partial<Record<string, string>> = {
  system: 'Shared capabilities',
  behaviour_change: 'What good looks like',
};

/** Lane keys eligible for insight multi-select / clustering in L1-Macro mode. */
export const L1_INSIGHT_LANE_KEYS = new Set<LaneKey>([
  'pain_point',
  'insights',
]);

/** Lane keys eligible for insight multi-select / clustering in L2-Macro mode (default). */
export const L2_INSIGHT_LANE_KEYS = new Set<LaneKey>([
  'pain_point',
  'user_need',
]);

/** Lane keys eligible for insight multi-select / clustering in L3-Micro mode (same as L2). */
export const L3_INSIGHT_LANE_KEYS = new Set<LaneKey>([
  'pain_point',
  'user_need',
]);

export const LANE_TITLE_MAP = Object.fromEntries(
  [...DEFAULT_LANES, ...L1_MACRO_LANES].map((lane) => [lane.key, lane.title]),
) as Record<LaneDefinition['key'], string>;

export function getLaneTitle(key: LaneDefinition['key']): string {
  return LANE_TITLE_MAP[key];
}

export const LANE_ICON_MAP: Record<string, string> = {
  user_journey: 'Milestone',
  actor: 'User',
  user_action_event: 'MousePointerClick',
  user_need: 'Heart',
  pain_point: 'AlertTriangle',
  frontstage_touchpoint: 'Monitor',
  activity: 'ListChecks',
  backstage_process: 'Settings',
  description: 'BookOpen',
  behaviour_change: 'Sparkles',
  success_measure: 'BarChart3',
  motivation: 'Target',
  ability: 'Cog',
  prompts: 'Lightbulb',
  system: 'Database',
  policy_intent: 'Scale',
  business_rule: 'BookOpen',
  data_input: 'DatabaseBackup',
  data_output: 'DatabaseZap',
  backstage_actor: 'UserCog',
  shared_services: 'Share2',
  product_teams: 'Users',
  opportunities: 'Sparkles',
  ideas: 'Lightbulb',
  // L1 Macro lanes
  policy_reform: 'Landmark',
  policy_outcome: 'Scale',
  user_outcome: 'Target',
  operational_outcome: 'Cog',
  insights: 'Lightbulb',
  impact_of_pain_points: 'Flame',
  performance_indicators: 'BarChart3',
  opportunities_lane: 'Sparkles',
  third_parties_involved: 'Users',
  support_system: 'LifeBuoy',
};
