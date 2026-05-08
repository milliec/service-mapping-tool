import { v4 as uuid } from 'uuid';
import type { ApiContract, Opportunity, Requirement, UiScaffold } from '../types';
import { generateTraceabilityCode } from './service';

/**
 * Deterministic downstream artifact generators.
 *
 * All functions are pure — they accept current state as arguments and return the new
 * entity plus updated counters. No store access, no side effects.
 *
 * Traceability chain:
 *   Pain Point → Opportunity (OPP) → Requirement (REQ) → ApiContract (API)
 *                                                       → UiScaffold  (UI)
 *
 * Callers are responsible for:
 *   - Ensuring the source entity already has a `traceabilityCode` before calling
 *   - Appending the returned entity to the appropriate state array
 *   - Persisting the returned `updatedCounters`
 */

// ---------------------------------------------------------------------------
// Requirement
// ---------------------------------------------------------------------------

/**
 * Derives a draft Requirement from an Opportunity.
 *
 * @param opp         - The source Opportunity. Must have a non-empty `traceabilityCode`.
 * @param counters    - Current `traceabilityCounters` from BlueprintState.
 * @param blueprintId - ID of the current blueprint.
 */
export function createRequirementFromOpportunity(
  opp: Opportunity,
  counters: Record<string, number>,
  blueprintId: string,
): { requirement: Requirement; updatedCounters: Record<string, number> } {
  const { code, updatedCounters } = generateTraceabilityCode('REQ', counters);
  const ts = new Date().toISOString();

  const requirement: Requirement = {
    id: uuid(),
    blueprintId,
    traceabilityCode: code,
    title: opp.title,
    description: opp.statement || undefined,
    derivedFromIds: [opp.traceabilityCode ?? ''],
    sourceCardIds: [...opp.sourceCardIds],
    status: 'draft',
    owner: opp.owner,
    createdAt: ts,
    updatedAt: ts,
  };

  return { requirement, updatedCounters };
}

// ---------------------------------------------------------------------------
// ApiContract
// ---------------------------------------------------------------------------

/**
 * Derives a draft ApiContract from a Requirement.
 *
 * @param req         - The source Requirement. Must have a non-empty `traceabilityCode`.
 * @param counters    - Current `traceabilityCounters` from BlueprintState.
 * @param blueprintId - ID of the current blueprint.
 */
export function createApiContractFromRequirement(
  req: Requirement,
  counters: Record<string, number>,
  blueprintId: string,
): { apiContract: ApiContract; updatedCounters: Record<string, number> } {
  const { code, updatedCounters } = generateTraceabilityCode('API', counters);
  const ts = new Date().toISOString();

  const apiContract: ApiContract = {
    id: uuid(),
    blueprintId,
    traceabilityCode: code,
    title: req.title,
    description: req.description,
    derivedFromIds: [req.traceabilityCode],
    sourceCardIds: [...req.sourceCardIds],
    status: 'draft',
    owner: req.owner,
    createdAt: ts,
    updatedAt: ts,
  };

  return { apiContract, updatedCounters };
}

// ---------------------------------------------------------------------------
// UiScaffold
// ---------------------------------------------------------------------------

/**
 * Derives a draft UiScaffold from a Requirement and an ApiContract.
 *
 * @param req         - The source Requirement. Must have a non-empty `traceabilityCode`.
 * @param api         - The source ApiContract. Must have a non-empty `traceabilityCode`.
 * @param counters    - Current `traceabilityCounters` from BlueprintState.
 * @param blueprintId - ID of the current blueprint.
 */
export function createUiScaffoldFromRequirementAndApi(
  req: Requirement,
  api: ApiContract,
  counters: Record<string, number>,
  blueprintId: string,
): { uiScaffold: UiScaffold; updatedCounters: Record<string, number> } {
  const { code, updatedCounters } = generateTraceabilityCode('UI', counters);
  const ts = new Date().toISOString();

  // Deduplicate sourceCardIds across both upstream artifacts
  const sourceCardIds = [...new Set([...req.sourceCardIds, ...api.sourceCardIds])];

  const uiScaffold: UiScaffold = {
    id: uuid(),
    blueprintId,
    traceabilityCode: code,
    title: req.title,
    description: req.description,
    derivedFromIds: [req.traceabilityCode, api.traceabilityCode],
    sourceCardIds,
    status: 'draft',
    owner: req.owner,
    createdAt: ts,
    updatedAt: ts,
  };

  return { uiScaffold, updatedCounters };
}
