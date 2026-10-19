/**
 * GRIDLOCK LAB — Coffman Conditions Engine
 * Evaluates the 4 conditions necessary and sufficient for deadlock:
 * 1. Mutual Exclusion
 * 2. Hold and Wait
 * 3. No Preemption
 * 4. Circular Wait
 */

import { CoffmanConditions, Vehicle } from './types';

export interface CoffmanEvaluation {
  conditions: CoffmanConditions;
  allFourHold: boolean;
  statusText: string;
  isDeadlockPossible: boolean;
  brokenConditionName: string | null;
  explanations: Record<keyof CoffmanConditions, string>;
}

export class CoffmanEngine {
  public static evaluate(
    vehicles: Vehicle[],
    hasCycle: boolean,
    overrides: {
      mutualExclusionBroken: boolean;
      holdAndWaitBroken: boolean;
      noPreemptionBroken: boolean;
      circularWaitBroken: boolean;
    }
  ): CoffmanEvaluation {
    // 1. Mutual Exclusion: broken if flyover grade-separation active
    const mutualExclusion = !overrides.mutualExclusionBroken;

    // 2. Hold and Wait: broken if yellow-box atomic reservation active,
    // otherwise true if any vehicle holds a quadrant while requesting another
    const hasHoldingAndWaitingVehicle = vehicles.some(
      v => v.state === 'IN_BOX' && v.heldQuadrant !== null && (v.requestedQuadrant !== null || v.requestedExitSlot !== null)
    );
    const holdAndWait = !overrides.holdAndWaitBroken && hasHoldingAndWaitingVehicle;

    // 3. No Preemption: broken if police preemption is enabled
    const noPreemption = !overrides.noPreemptionBroken;

    // 4. Circular Wait: broken if ordered entry/one-way loop active,
    // otherwise true if a directed cycle exists in the wait-for graph
    const circularWait = !overrides.circularWaitBroken && hasCycle;

    const conditions: CoffmanConditions = {
      mutualExclusion,
      holdAndWait,
      noPreemption,
      circularWait
    };

    const allFourHold = mutualExclusion && holdAndWait && noPreemption && circularWait;
    const isDeadlockPossible = mutualExclusion && (!overrides.holdAndWaitBroken) && noPreemption && (!overrides.circularWaitBroken);

    let brokenConditionName: string | null = null;
    if (overrides.mutualExclusionBroken) brokenConditionName = 'Mutual Exclusion (Flyover)';
    else if (overrides.holdAndWaitBroken) brokenConditionName = 'Hold & Wait (Exit-Clear Rule)';
    else if (overrides.noPreemptionBroken) brokenConditionName = 'No Preemption (Police Preemption)';
    else if (overrides.circularWaitBroken) brokenConditionName = 'Circular Wait (Ordered Entry)';

    const statusText = allFourHold
      ? 'DEADLOCK DETECTED — all four Coffman conditions active'
      : brokenConditionName
      ? `DEADLOCK IMPOSSIBLE — ${brokenConditionName} broken`
      : 'DEADLOCK PREVENTED — condition not satisfied';

    const explanations: Record<keyof CoffmanConditions, string> = {
      mutualExclusion: mutualExclusion
        ? 'Active: Each quadrant admits only 1 vehicle at a time.'
        : 'Broken: Grade-separation (flyover) allows space sharing.',
      holdAndWait: holdAndWait
        ? 'Active: Vehicles inside hold current quadrant while waiting for next.'
        : 'Broken: Exit-clear rule enforces all-or-nothing allocation outside box.',
      noPreemption: noPreemption
        ? 'Active: Vehicles cannot be forcibly removed once inside.'
        : 'Broken: Police preemption permits targeted vehicle rollback.',
      circularWait: circularWait
        ? 'Active: Closed dependency chain exists (A → B → C → D → A).'
        : 'Broken: Strict resource ordering prevents circular dependencies.'
    };

    return {
      conditions,
      allFourHold,
      statusText,
      isDeadlockPossible,
      brokenConditionName,
      explanations
    };
  }
}
