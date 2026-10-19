/**
 * GRIDLOCK LAB — 5-Step Recovery State Machine
 * Implements Slide 7:
 * Step 1: Detect
 * Step 2: Stop conflicting entry
 * Step 3: Safe manual control (victim selection)
 * Step 4: Clear zones and reroute
 * Step 5: Restore normal coordination
 */

import { RecoveryMachineState, RecoveryStep, Vehicle } from './types';

export interface RecoveryAction {
  machineState: RecoveryMachineState;
  showCones: boolean;
  showPolice: boolean;
  showDetourArrows: boolean;
  caption: string;
  isRecovering: boolean;
  victimVehicle: Vehicle | null;
}

export class RecoveryEngine {
  private state: RecoveryMachineState = {
    step: 'IDLE',
    timer: 0,
    victimVehicleId: null,
    rerouteActive: false,
    clearedVehicles: [],
    restored: false
  };

  private readonly STEP_DURATIONS: Record<RecoveryStep, number> = {
    IDLE: 0,
    DETECT: 2.5,
    STOP: 2.0,
    MANUAL_CONTROL: 3.0,
    CLEAR_REROUTE: 4.5,
    RESTORE: 2.5
  };

  public reset(): void {
    this.state = {
      step: 'IDLE',
      timer: 0,
      victimVehicleId: null,
      rerouteActive: false,
      clearedVehicles: [],
      restored: false
    };
  }

  public trigger(cycleVehicleIds: string[], vehicles: Vehicle[]): void {
    if (this.state.step !== 'IDLE') return;

    // Pick victim vehicle: candidate with least progress or first in cycle
    let victimId = cycleVehicleIds[0] || null;
    let minProgress = 999;

    for (const vId of cycleVehicleIds) {
      const v = vehicles.find(item => item.id === vId);
      if (v && v.pathProgress < minProgress) {
        minProgress = v.pathProgress;
        victimId = v.id;
      }
    }

    this.state = {
      step: 'DETECT',
      timer: 0,
      victimVehicleId: victimId,
      rerouteActive: false,
      clearedVehicles: [],
      restored: false
    };
  }

  public update(delta: number, vehicles: Vehicle[], hasCycle: boolean): RecoveryAction {
    if (this.state.step === 'IDLE') {
      return {
        machineState: { ...this.state },
        showCones: false,
        showPolice: false,
        showDetourArrows: false,
        caption: '',
        isRecovering: false,
        victimVehicle: null
      };
    }

    this.state.timer += delta;
    const currentDuration = this.STEP_DURATIONS[this.state.step];

    const victim = vehicles.find(v => v.id === this.state.victimVehicleId) || null;

    // Step Transitions
    if (this.state.timer >= currentDuration) {
      this.advanceStep(vehicles, hasCycle);
    }

    // Dynamic actions based on current step
    let showCones = false;
    let showPolice = false;
    let showDetourArrows = false;
    let caption = '';

    switch (this.state.step) {
      case 'DETECT':
        caption = 'Step 1: DETECT — Persistent circular wait confirmed. In OS terms: deadlock detection algorithm identified a cycle.';
        break;

      case 'STOP':
        showCones = true;
        caption = 'Step 2: STOP — All stop-line entries barred. Red signal clearance enforced to prevent further resource starvation.';
        break;

      case 'MANUAL_CONTROL':
        showCones = true;
        showPolice = true;
        const victimName = victim ? `Vehicle ${victim.label}` : 'Lowest-progress vehicle';
        caption = `Step 3: SAFE MANUAL CONTROL — Traffic officer deploys. Victim selection: ${victimName} chosen for targeted release (rollback).`;
        break;

      case 'CLEAR_REROUTE':
        showCones = true;
        showPolice = true;
        showDetourArrows = true;
        caption = 'Step 4: CLEAR & REROUTE — Victim reversed/cleared; remaining vehicles advance sequentially along cleared vectors.';
        // Apply preemption / rollback to victim vehicle
        if (victim) {
          victim.isVictim = true;
          victim.reverseProgress = Math.min(1, (victim.reverseProgress || 0) + delta * 0.4);
        }
        break;

      case 'RESTORE':
        caption = 'Step 5: RESTORE — Safe state verified (box clear, wait-for graph acyclic). In OS terms: this is detection and recovery after deadlock, not prevention before it occurs.';
        break;
    }

    return {
      machineState: { ...this.state },
      showCones,
      showPolice,
      showDetourArrows,
      caption,
      isRecovering: true,
      victimVehicle: victim
    };
  }

  private advanceStep(vehicles: Vehicle[], _hasCycle: boolean): void {
    this.state.timer = 0;

    switch (this.state.step) {
      case 'DETECT':
        this.state.step = 'STOP';
        break;

      case 'STOP':
        this.state.step = 'MANUAL_CONTROL';
        break;

      case 'MANUAL_CONTROL':
        this.state.step = 'CLEAR_REROUTE';
        break;

      case 'CLEAR_REROUTE':
        // Forcibly clear victim from box and allow other trapped vehicles to progress
        if (this.state.victimVehicleId) {
          const victim = vehicles.find(v => v.id === this.state.victimVehicleId);
          if (victim) {
            victim.state = 'GONE';
            victim.heldQuadrant = null;
            victim.requestedQuadrant = null;
          }
        }
        this.state.step = 'RESTORE';
        break;

      case 'RESTORE':
        this.state.step = 'IDLE';
        this.state.restored = true;
        this.state.victimVehicleId = null;
        break;
    }
  }

  public getStepIndex(): number {
    const steps: RecoveryStep[] = ['IDLE', 'DETECT', 'STOP', 'MANUAL_CONTROL', 'CLEAR_REROUTE', 'RESTORE'];
    return steps.indexOf(this.state.step);
  }
}
