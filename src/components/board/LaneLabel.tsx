'use client';

import {
  User,
  UserCog,
  Users,
  MousePointerClick,
  Heart,
  AlertTriangle,
  Monitor,
  Settings,
  Database,
  DatabaseBackup,
  DatabaseZap,
  Scale,
  BookOpen,
  Milestone,
  ChevronDown,
  ChevronUp,
  Landmark,
  Target,
  Cog,
  Lightbulb,
  Flame,
  BarChart3,
  Share2,
  Sparkles,
  LifeBuoy,
  ListChecks,
} from 'lucide-react';
import { type LaneDefinition } from '@/lib/types';
import { getLaneTitle } from '@/lib/lane-definitions';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  actor: User,
  user_journey: Milestone,
  user_action_event: MousePointerClick,
  user_need: Heart,
  pain_point: AlertTriangle,
  frontstage_touchpoint: Monitor,
  activity: ListChecks,
  backstage_process: Settings,
  description: BookOpen,
  behaviour_change: Sparkles,
  success_measure: BarChart3,
  motivation: Target,
  ability: Cog,
  prompts: Lightbulb,
  system: Database,
  policy_intent: Scale,
  business_rule: BookOpen,
  data_input: DatabaseBackup,
  data_output: DatabaseZap,
  backstage_actor: UserCog,
  shared_services: Share2,
  product_teams: Users,
  opportunities: Sparkles,
  ideas: Lightbulb,
  // L1 Macro lanes
  policy_reform: Landmark,
  policy_outcome: Scale,
  user_outcome: Target,
  operational_outcome: Cog,
  insights: Lightbulb,
  impact_of_pain_points: Flame,
  performance_indicators: BarChart3,
  opportunities_lane: Sparkles,
  third_parties_involved: Users,
  support_system: LifeBuoy,
};

export const LANE_COLOR_TOKENS: Record<string, { bg: string; text: string; border: string }> = {
  user_journey: { bg: 'bg-[#E6F3EB]', text: 'text-[#008938]', border: 'border-[#B6DEC6]' },
  actor: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  user_action_event: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  user_need: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  pain_point: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  frontstage_touchpoint: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  backstage_process: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  description: { bg: 'bg-stone-50', text: 'text-stone-700', border: 'border-stone-200' },
  behaviour_change: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200' },
  success_measure: { bg: 'bg-lime-50', text: 'text-lime-700', border: 'border-lime-200' },
  motivation: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  ability: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  prompts: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  system: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  policy_intent: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  business_rule: { bg: 'bg-[#F6EFE3]', text: 'text-[#8A6A2F]', border: 'border-[#E7D8B5]' },
  data_input: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  data_output: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  backstage_actor: { bg: 'bg-zinc-50', text: 'text-zinc-700', border: 'border-zinc-200' },
  shared_services: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  product_teams: { bg: 'bg-[#E6F3EB]', text: 'text-[#008938]', border: 'border-[#B6DEC6]' },
  opportunities: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  ideas: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  // L1 Macro lanes
  policy_reform: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  policy_outcome: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  user_outcome: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  operational_outcome: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  insights: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  impact_of_pain_points: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  performance_indicators: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  opportunities_lane: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  third_parties_involved: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  support_system: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

const DEFAULT_TOKEN = { bg: 'bg-neutral-50', text: 'text-neutral-600', border: 'border-neutral-200' };
const SECONDARY_ACTOR_TOKEN = { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-300' };

interface LaneLabelProps {
  lane: LaneDefinition;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  className?: string;
  titleOverride?: string;
}

export function LaneLabel({
  lane,
  collapsed = false,
  onToggleCollapsed,
  className,
  titleOverride,
}: LaneLabelProps) {
  const Icon = ICON_MAP[lane.key];
  const token = LANE_COLOR_TOKENS[lane.key] || DEFAULT_TOKEN;
  const ChevronIcon = collapsed ? ChevronDown : ChevronUp;
  const laneTitle = titleOverride ?? getLaneTitle(lane.key);

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2 overflow-hidden rounded-xl border transition-colors',
        collapsed ? 'px-3 py-1.5' : 'px-3 py-2',
        token.bg,
        token.text,
        token.border,
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-70" />}
      <span className="min-w-0 flex-1 text-[13px] font-semibold leading-tight tracking-tight">
        {laneTitle}
      </span>
      {onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? `Expand ${laneTitle}` : `Collapse ${laneTitle}`}
          aria-expanded={!collapsed}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-transparent text-current/80 transition-colors hover:bg-white/60 hover:text-current focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <ChevronIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function getLaneColor(key: string): string {
  const t = LANE_COLOR_TOKENS[key] || DEFAULT_TOKEN;
  return `${t.bg} ${t.text} ${t.border}`;
}

export function getCardColorTokens(laneKey: string, tags: string[] = []) {
  if (laneKey === 'actor' && tags.includes('secondary')) {
    return SECONDARY_ACTOR_TOKEN;
  }
  return LANE_COLOR_TOKENS[laneKey] || DEFAULT_TOKEN;
}
