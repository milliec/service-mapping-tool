import type { BlueprintState } from '@/lib/types';

/**
 * True for opportunity-solution-tree-first documents: no journey grid stages
 * but strategic OST entities exist (e.g. Defra Environmental Opportunity Map seed).
 */
export function isOstPrimarySnapshot(state: Pick<BlueprintState, 'stages' | 'strategicGoals' | 'outcomes'>): boolean {
  if ((state.stages?.length ?? 0) > 0) return false;
  return (state.strategicGoals?.length ?? 0) > 0 || (state.outcomes?.length ?? 0) > 0;
}
