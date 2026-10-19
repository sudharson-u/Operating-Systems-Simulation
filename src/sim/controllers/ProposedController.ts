/**
 * GRIDLOCK LAB — Proposed Controller ("Exit-Clear Reservation Controller")
 * Implements Slide 9 algorithm with Atomic All-or-Nothing Path Reservation.
 * Breaks Hold-and-Wait condition: guarantees zero deadlocks.
 */

import { ControllerContext, ControllerDecisions, IController } from './Controller';
import { ArmId, ControlMode, ControllerDebuggerState, ExitSlotId, QuadrantId, Vehicle } from '../types';

export class ProposedController implements IController {
  readonly mode: ControlMode = 'proposed';

  private reservations = new Map<QuadrantId, string>(); // QuadrantId -> VehicleId
  private exitSlotReservations = new Map<ExitSlotId, string>(); // ExitSlotId -> VehicleId
  private roundRobinIndex = 0;
  private readonly ARM_ORDER: ArmId[] = ['N', 'E', 'S', 'W'];

  private debuggerState: ControllerDebuggerState = {
    activeVehicleId: null,
    currentStepIndex: 1,
    evaluatingArm: null,
    safe: true,
    exitSpace: true,
    conflict: false,
    explanation: 'System idle: monitoring queue'
  };

  reset(): void {
    this.reservations.clear();
    this.exitSlotReservations.clear();
    this.roundRobinIndex = 0;
    this.debuggerState = {
      activeVehicleId: null,
      currentStepIndex: 1,
      evaluatingArm: null,
      safe: true,
      exitSpace: true,
      conflict: false,
      explanation: 'System idle: monitoring queue'
    };
  }

  update(ctx: ControllerContext): ControllerDecisions {
    const authorizations = new Set<string>();

    // 1. Release reservations for vehicles that have exited the box
    this.cleanupReservations(ctx.activeVehicles);

    // 2. If system is stuck, trigger emergency stop_entry
    if (ctx.isStalled) {
      this.debuggerState = {
        activeVehicleId: null,
        currentStepIndex: 8,
        evaluatingArm: null,
        safe: false,
        exitSpace: false,
        conflict: true,
        explanation: 'stuck detected: stop_entry() and execute recovery'
      };
      return { authorizations, debuggerState: { ...this.debuggerState } };
    }

    // 3. Collect queued candidates
    const queuedVehicles = ctx.activeVehicles
      .filter(v => v.state === 'QUEUED')
      .sort((a, b) => {
        // Primary: FIFO arrival ticket
        if (Math.abs(a.arrivalTime - b.arrivalTime) > 0.001) {
          return a.arrivalTime - b.arrivalTime;
        }
        // Tie-breaker: round-robin arm priority
        const aArmIdx = (this.ARM_ORDER.indexOf(a.originArm) - this.roundRobinIndex + 4) % 4;
        const bArmIdx = (this.ARM_ORDER.indexOf(b.originArm) - this.roundRobinIndex + 4) % 4;
        return aArmIdx - bArmIdx;
      });

    if (queuedVehicles.length === 0) {
      this.debuggerState = {
        activeVehicleId: null,
        currentStepIndex: 1,
        evaluatingArm: null,
        safe: true,
        exitSpace: true,
        conflict: false,
        explanation: 'Queue empty: all channels green for clear movements'
      };
      return { authorizations, debuggerState: { ...this.debuggerState } };
    }

    // 4. Evaluate candidates
    for (const v of queuedVehicles) {
      // Only the front vehicle at the stop line of its approach arm can be evaluated/authorized
      const isFront = !ctx.activeVehicles.some(
        other => other.id !== v.id && other.originArm === v.originArm && other.state !== 'GONE' && other.pathProgress > v.pathProgress
      );
      if (!isFront) continue;

      const exitSlot0Id = `EXIT_${v.targetArm}_0` as ExitSlotId;
      const targetSlot = ctx.exitSlots.find(s => s.id === exitSlot0Id);

      // Check exit space (yellow-box rule)
      const hasExitSpace =
        !targetSlot?.isBlockedByDownstream &&
        !targetSlot?.occupiedBy &&
        (!this.exitSlotReservations.has(exitSlot0Id) || this.exitSlotReservations.get(exitSlot0Id) === v.id);

      // Check conflict across all quadrants along movement route
      let hasConflict = false;
      for (const qId of v.quadrantSequence) {
        const qResource = ctx.quadrants.find(item => item.id === qId);
        const isOccupied = !ctx.flyoverActive && !!qResource?.occupiedBy && qResource.occupiedBy !== v.id;
        const isReservedByOther = !ctx.flyoverActive && this.reservations.has(qId) && this.reservations.get(qId) !== v.id;

        if (isOccupied || isReservedByOther) {
          hasConflict = true;
          break;
        }
      }

      const isSafe = !hasConflict && hasExitSpace;

      // Update live debugger state for the evaluated vehicle
      this.debuggerState = {
        activeVehicleId: v.id,
        currentStepIndex: isSafe ? 2 : 6,
        evaluatingArm: v.originArm,
        safe: isSafe,
        exitSpace: hasExitSpace,
        conflict: hasConflict,
        explanation: isSafe
          ? `evaluating: Vehicle ${v.label} (Arm ${v.originArm}) -> safe=true, exit_space=clear -> reserve & authorize`
          : `evaluating: Vehicle ${v.label} (Arm ${v.originArm}) -> held outside: ${hasConflict ? 'quadrant conflict' : 'exit not clear'}`
      };

      if (isSafe) {
        // Step 2 & 3: reserve() and authorize() atomically
        for (const qId of v.quadrantSequence) {
          this.reservations.set(qId, v.id);
        }
        this.exitSlotReservations.set(exitSlot0Id, v.id);
        authorizations.add(v.id);

        this.roundRobinIndex = (this.roundRobinIndex + 1) % 4;
      }
    }

    return {
      authorizations,
      debuggerState: { ...this.debuggerState }
    };
  }

  private cleanupReservations(activeVehicles: Vehicle[]): void {
    const activeMap = new Map<string, Vehicle>();
    for (const v of activeVehicles) {
      activeMap.set(v.id, v);
    }

    // Free quadrant reservations when vehicle is exiting or gone
    for (const [qId, vId] of Array.from(this.reservations.entries())) {
      const v = activeMap.get(vId);
      if (!v || v.state === 'EXITING' || v.state === 'GONE') {
        this.reservations.delete(qId);
      }
    }

    // Free exit slot reservations when vehicle has cleared slot 0
    for (const [slotId, vId] of Array.from(this.exitSlotReservations.entries())) {
      const v = activeMap.get(vId);
      if (!v || v.state === 'GONE') {
        this.exitSlotReservations.delete(slotId);
      }
    }
  }
}
