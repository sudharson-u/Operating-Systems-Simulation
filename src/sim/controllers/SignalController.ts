/**
 * GRIDLOCK LAB — Signal Controller (Fixed-Time 2-Phase)
 * Alternates between N-S and E-W movements.
 * Demonstrates: Gridlock can still happen when vehicles enter on green while exit lane is blocked.
 */

import { ControllerContext, ControllerDecisions, IController } from './Controller';
import { ControlMode, SignalPhase, TrafficSignalState } from '../types';

export class SignalController implements IController {
  readonly mode: ControlMode = 'signal';

  private signalState: TrafficSignalState = {
    currentPhase: 'NS_GREEN',
    phaseTimer: 0,
    phaseDuration: 6.0,
    nsColor: 'green',
    ewColor: 'red'
  };

  private readonly PHASE_DURATIONS: Record<SignalPhase, number> = {
    NS_GREEN: 7.0,
    NS_YELLOW: 2.0,
    ALL_RED_1: 1.0,
    EW_GREEN: 7.0,
    EW_YELLOW: 2.0,
    ALL_RED_2: 1.0
  };

  reset(): void {
    this.signalState = {
      currentPhase: 'NS_GREEN',
      phaseTimer: 0,
      phaseDuration: this.PHASE_DURATIONS.NS_GREEN,
      nsColor: 'green',
      ewColor: 'red'
    };
  }

  update(ctx: ControllerContext): ControllerDecisions {
    const authorizations = new Set<string>();

    // Advance signal timer
    this.signalState.phaseTimer += ctx.delta;
    if (this.signalState.phaseTimer >= this.signalState.phaseDuration) {
      this.advancePhase();
    }

    const queuedVehicles = ctx.activeVehicles.filter(v => v.state === 'QUEUED');

    for (const v of queuedVehicles) {
      // Only the front vehicle at the stop line of its approach arm can enter
      const isFront = !ctx.activeVehicles.some(
        other => other.id !== v.id && other.originArm === v.originArm && other.state !== 'GONE' && other.pathProgress > v.pathProgress
      );
      if (!isFront) continue;

      const isGreen =
        (v.originArm === 'N' || v.originArm === 'S') ? this.signalState.nsColor === 'green' :
        this.signalState.ewColor === 'green';

      if (!isGreen) continue;

      const firstQuadId = v.quadrantSequence[0];
      const q = ctx.quadrants.find(item => item.id === firstQuadId);
      if (!q) continue;

      const quadClear = ctx.flyoverActive || !q.occupiedBy;
      if (!quadClear) continue;

      // Check Yellow-Box Rule if active
      if (ctx.yellowBoxRule) {
        // Yellow box rule: enter only if exit slot is free
        const exitSlotId = `EXIT_${v.targetArm}_0`;
        const slot = ctx.exitSlots.find(s => s.id === exitSlotId);
        if (slot && (slot.occupiedBy || slot.isBlockedByDownstream)) {
          // Exit not clear -> wait outside even though light is green!
          continue;
        }
      }

      authorizations.add(v.id);
    }

    return {
      authorizations,
      signalState: { ...this.signalState }
    };
  }

  private advancePhase(): void {
    const phaseSequence: SignalPhase[] = [
      'NS_GREEN',
      'NS_YELLOW',
      'ALL_RED_1',
      'EW_GREEN',
      'EW_YELLOW',
      'ALL_RED_2'
    ];

    const currentIdx = phaseSequence.indexOf(this.signalState.currentPhase);
    const nextPhase = phaseSequence[(currentIdx + 1) % phaseSequence.length];

    let nsColor: 'green' | 'yellow' | 'red' = 'red';
    let ewColor: 'green' | 'yellow' | 'red' = 'red';

    if (nextPhase === 'NS_GREEN') nsColor = 'green';
    else if (nextPhase === 'NS_YELLOW') nsColor = 'yellow';

    if (nextPhase === 'EW_GREEN') ewColor = 'green';
    else if (nextPhase === 'EW_YELLOW') ewColor = 'yellow';

    this.signalState = {
      currentPhase: nextPhase,
      phaseTimer: 0,
      phaseDuration: this.PHASE_DURATIONS[nextPhase],
      nsColor,
      ewColor
    };
  }
}
