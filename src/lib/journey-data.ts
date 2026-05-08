/**
 * Static loader for L2 and L3 journey step reference data.
 * These are read-only artefacts extracted from the Excel journey maps —
 * they are not persisted in the store or modified by the user.
 */

import type { L2JourneyStep, L3ServiceStep } from './types';

let _l2: L2JourneyStep[] | null = null;
let _l3: L3ServiceStep[] | null = null;

export async function loadL2Steps(): Promise<L2JourneyStep[]> {
  if (_l2) return _l2;
  const res = await fetch('/journey-mapping/l2-journey-steps.json');
  _l2 = await res.json();
  return _l2!;
}

export async function loadL3Steps(): Promise<L3ServiceStep[]> {
  if (_l3) return _l3;
  const res = await fetch('/journey-mapping/l3-service-steps.json');
  _l3 = await res.json();
  return _l3!;
}

/**
 * Given a Defra opportunity area code (e.g. 'C1', 'AREA-C'), returns the
 * L2 steps whose areaCodes array contains a matching code.
 * Accepts both short codes ('C1') and full codes ('AREA-C').
 */
export function l2StepsForAreaCode(steps: L2JourneyStep[], areaCode: string): L2JourneyStep[] {
  // Normalise: 'AREA-C' → ['C1','C2','C3','C4'], 'C1' → exact match
  const norm = areaCode.replace(/^AREA-/, '');
  if (norm.length === 1) {
    // Full area letter — match any code starting with that letter
    return steps.filter((s) => s.areaCodes.some((c) => c.startsWith(norm)));
  }
  return steps.filter((s) => s.areaCodes.includes(norm));
}

export function l3StepsForL2(l3Steps: L3ServiceStep[], l2Id: string): L3ServiceStep[] {
  return l3Steps.filter((s) => s.l2ParentId === l2Id).sort((a, b) => a.order - b.order);
}
