/**
 * GRIDLOCK LAB — Simulation Type Definitions
 * Operating Systems Deadlock Management (BACSE106)
 */

export type ArmId = 'N' | 'E' | 'S' | 'W';

export interface ArmConfig {
  id: ArmId;
  name: string;
  label: string; // 'A' | 'B' | 'C' | 'D'
  vehicleColor: string;
}

export type QuadrantId = 'NW' | 'NE' | 'SE' | 'SW';

export type ExitSlotId = 'EXIT_N_0' | 'EXIT_N_1' | 'EXIT_E_0' | 'EXIT_E_1' | 'EXIT_S_0' | 'EXIT_S_1' | 'EXIT_W_0' | 'EXIT_W_1';

export type MovementType = 'straight' | 'left' | 'right';

export type VehicleState =
  | 'APPROACHING' // Moving towards stop line
  | 'QUEUED'      // Waiting at stop line
  | 'ENTERING'    // Crossing stop line into first quadrant
  | 'IN_BOX'      // Inside intersection holding a quadrant
  | 'EXITING'     // Leaving intersection into exit slot
  | 'GONE';       // Completely cleared

export interface Vector2D {
  x: number;
  y: number;
}

export interface PathWaypoint extends Vector2D {
  speed?: number;
  quadrant?: QuadrantId;
  exitSlot?: ExitSlotId;
}

export interface Vehicle {
  id: string;             // e.g. "A1", "B2", "C3"
  label: string;          // Primary letter 'A' | 'B' | 'C' | 'D'
  originArm: ArmId;
  targetArm: ArmId;
  movement: MovementType;
  color: string;

  // Path & Quadrants
  quadrantSequence: QuadrantId[];
  currentQuadrantIndex: number; // -1 if not yet in box
  heldQuadrant: QuadrantId | null;
  requestedQuadrant: QuadrantId | null;
  requestedExitSlot: ExitSlotId | null;

  // State Machine
  state: VehicleState;
  position: Vector2D;
  heading: number; // in radians
  speed: number;
  targetSpeed: number;
  path: PathWaypoint[];
  pathProgress: number; // 0 to 1

  // Timing & Performance Metrics
  arrivalTime: number;
  entryTime: number | null;
  exitTime: number | null;
  waitTime: number;
  isStalled: boolean;
  stalledDuration: number;

  // Visual cues
  brakeLights: boolean;
  indicator: 'none' | 'left' | 'right';
  isVictim?: boolean;
  reverseProgress?: number;
}

export interface QuadrantResource {
  id: QuadrantId;
  name: string;
  occupiedBy: string | null;     // Vehicle ID
  reservedBy: string | null;     // Vehicle ID (for Proposed Controller)
  isShared: boolean;             // True if Flyover / Mutual Exclusion broken
  center: Vector2D;
}

export interface ExitSlotResource {
  id: ExitSlotId;
  arm: ArmId;
  slotIndex: number;             // 0 = closest to box, 1 = downstream
  occupiedBy: string | null;
  isBlockedByDownstream: boolean;// Manual choke simulation
}

export interface RAGEdge {
  from: string;      // process ID or resource ID
  to: string;        // process ID or resource ID
  type: 'assignment' | 'request';
  isCycle: boolean;
}

export interface RAGNode {
  id: string;
  type: 'process' | 'resource';
  label: string;
  color: string;
  isCycle: boolean;
}

export interface RAGGraph {
  nodes: RAGNode[];
  edges: RAGEdge[];
  cycle: string[]; // Vehicle IDs participating in cycle
}

export interface CoffmanConditions {
  mutualExclusion: boolean; // false if Flyover enabled
  holdAndWait: boolean;      // false if Exit-Clear / Yellow Box enabled
  noPreemption: boolean;     // false if Police Preemption enabled
  circularWait: boolean;     // false if One-Way Loop / Ordered entry enabled
}

export type ControlMode =
  | 'uncontrolled'
  | 'signal'
  | 'roundabout'
  | 'proposed';

export type SignalPhase =
  | 'NS_GREEN'
  | 'NS_YELLOW'
  | 'ALL_RED_1'
  | 'EW_GREEN'
  | 'EW_YELLOW'
  | 'ALL_RED_2';

export interface TrafficSignalState {
  currentPhase: SignalPhase;
  phaseTimer: number;
  phaseDuration: number;
  nsColor: 'green' | 'yellow' | 'red';
  ewColor: 'green' | 'yellow' | 'red';
}

export type RecoveryStep =
  | 'IDLE'
  | 'DETECT'
  | 'STOP'
  | 'MANUAL_CONTROL'
  | 'CLEAR_REROUTE'
  | 'RESTORE';

export interface RecoveryMachineState {
  step: RecoveryStep;
  timer: number;
  victimVehicleId: string | null;
  rerouteActive: boolean;
  clearedVehicles: string[];
  restored: boolean;
}

export interface SimMetrics {
  throughput: number;          // vehicles completed / min
  totalCompleted: number;
  averageWaitTime: number;     // seconds
  maxWaitTime: number;
  deadlockCount: number;
  totalDeadlockTime: number;   // seconds
  currentInBoxCount: number;
  queueLengths: Record<ArmId, number>;
  stalledCount: number;
}

export interface ControllerDebuggerState {
  activeVehicleId: string | null;
  currentStepIndex: number;
  evaluatingArm: ArmId | null;
  safe: boolean;
  exitSpace: boolean;
  conflict: boolean;
  explanation: string;
}

export interface SimConfig {
  driveSide: 'left' | 'right';
  targetSpeed: number;
  simSpeedMultiplier: number;
  tStuck: number; // seconds before marked stalled (default 4.0)
  downstreamBlockage: Record<ArmId, number>; // 0 to 1
  demandLevel: 'low' | 'med' | 'high';
  coffmanOverrides: {
    mutualExclusionBroken: boolean; // Flyover
    holdAndWaitBroken: boolean;      // Exit-clear reservation
    noPreemptionBroken: boolean;     // Police preemption
    circularWaitBroken: boolean;     // Ordered entry / one-way loop
  };
  seed: number;
}
