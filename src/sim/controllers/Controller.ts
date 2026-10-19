/**
 * GRIDLOCK LAB — Controller Interface
 */

import { ArmId, ControlMode, ControllerDebuggerState, TrafficSignalState, Vehicle } from '../types';

export interface ControllerContext {
  simTime: number;
  delta: number;
  activeVehicles: Vehicle[];
  quadrants: {
    id: string;
    occupiedBy: string | null;
    reservedBy: string | null;
  }[];
  exitSlots: {
    id: string;
    arm: ArmId;
    slotIndex: number;
    occupiedBy: string | null;
    isBlockedByDownstream: boolean;
  }[];
  yellowBoxRule: boolean; // Hold-and-wait prevention
  flyoverActive: boolean; // Mutual exclusion broken
  isStalled: boolean;
}

export interface ControllerDecisions {
  authorizations: Set<string>; // Vehicle IDs authorized to enter the box
  signalState?: TrafficSignalState;
  debuggerState?: ControllerDebuggerState;
}

export interface IController {
  readonly mode: ControlMode;
  reset(): void;
  update(ctx: ControllerContext): ControllerDecisions;
}
