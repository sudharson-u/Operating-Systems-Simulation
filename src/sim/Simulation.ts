/**
 * GRIDLOCK LAB — Pure TypeScript Simulation Engine
 * Fully decoupled from DOM and Canvas for deterministic headless unit testing.
 */

import { PRNG } from './prng';
import {
  ArmId,
  ControlMode,
  ControllerDebuggerState,
  ExitSlotId,
  ExitSlotResource,
  MovementType,
  QuadrantId,
  QuadrantResource,
  RAGGraph,
  SimConfig,
  SimMetrics,
  TrafficSignalState,
  Vehicle
} from './types';
import {
  generateVehiclePath,
  getPathMetrics,
  getQuadrantSequence,
  getStopLineProgress,
  getTargetArm,
  QUADRANT_BOUNDS,
  samplePath
} from './geometry';
import { buildRAG } from './rag';
import { IController } from './controllers/Controller';
import { UncontrolledController } from './controllers/UncontrolledController';
import { SignalController } from './controllers/SignalController';
import { RoundaboutController } from './controllers/RoundaboutController';
import { ProposedController } from './controllers/ProposedController';
import { CoffmanEngine, CoffmanEvaluation } from './coffman';
import { RecoveryAction, RecoveryEngine } from './recovery';

export class Simulation {
  public config: SimConfig;
  public prng: PRNG;
  public simTime: number = 0;

  // Resources
  public quadrants: QuadrantResource[];
  public exitSlots: ExitSlotResource[];

  // Vehicles
  public vehicles: Vehicle[] = [];
  private vehicleCounter: number = 0;

  // Controllers
  public activeMode: ControlMode = 'uncontrolled';
  private controllers: Record<ControlMode, IController>;
  public activeSignalState?: TrafficSignalState;
  public debuggerState?: ControllerDebuggerState;

  // Deadlock, Stall, & Recovery
  public activeCycle: string[] = [];
  public waitForEdges: { from: string; to: string; isCycle: boolean }[] = [];
  public ragGraph: RAGGraph = { nodes: [], edges: [], cycle: [] };
  public coffmanEvaluation: CoffmanEvaluation;
  public autoRecovery: boolean = false;
  public totalCompletedWaitTime: number = 0;
  public recoveryEngine: RecoveryEngine;
  public recoveryAction: RecoveryAction;

  // Stall detector
  public isStalled: boolean = false;
  public stallTimer: number = 0;

  // Metrics
  public metrics: SimMetrics = {
    throughput: 0,
    totalCompleted: 0,
    averageWaitTime: 0,
    maxWaitTime: 0,
    deadlockCount: 0,
    totalDeadlockTime: 0,
    currentInBoxCount: 0,
    queueLengths: { N: 0, E: 0, S: 0, W: 0 },
    stalledCount: 0
  };

  private spawnTimer: number = 0;
  private readonly VEHICLE_COLORS: Record<ArmId, { color: string; label: string }> = {
    N: { color: '#4DA3FF', label: 'A' },
    E: { color: '#B28CFF', label: 'B' },
    S: { color: '#F59E4B', label: 'C' },
    W: { color: '#5EE0D0', label: 'D' }
  };

  constructor(initialConfig?: Partial<SimConfig>) {
    this.config = {
      driveSide: 'left',
      targetSpeed: 85,
      simSpeedMultiplier: 1.0,
      tStuck: 4.0,
      downstreamBlockage: { N: 0, E: 0, S: 0, W: 0 },
      demandLevel: 'med',
      coffmanOverrides: {
        mutualExclusionBroken: false,
        holdAndWaitBroken: false,
        noPreemptionBroken: false,
        circularWaitBroken: false
      },
      seed: 42,
      ...initialConfig
    };

    this.prng = new PRNG(this.config.seed);

    // Initialize quadrants
    this.quadrants = [
      { id: 'NW', name: 'North-West', occupiedBy: null, reservedBy: null, isShared: false, center: QUADRANT_BOUNDS.NW.center },
      { id: 'NE', name: 'North-East', occupiedBy: null, reservedBy: null, isShared: false, center: QUADRANT_BOUNDS.NE.center },
      { id: 'SE', name: 'South-East', occupiedBy: null, reservedBy: null, isShared: false, center: QUADRANT_BOUNDS.SE.center },
      { id: 'SW', name: 'South-West', occupiedBy: null, reservedBy: null, isShared: false, center: QUADRANT_BOUNDS.SW.center }
    ];

    // Initialize exit slots (2 per arm)
    this.exitSlots = [
      { id: 'EXIT_N_0', arm: 'N', slotIndex: 0, occupiedBy: null, isBlockedByDownstream: false },
      { id: 'EXIT_N_1', arm: 'N', slotIndex: 1, occupiedBy: null, isBlockedByDownstream: false },
      { id: 'EXIT_E_0', arm: 'E', slotIndex: 0, occupiedBy: null, isBlockedByDownstream: false },
      { id: 'EXIT_E_1', arm: 'E', slotIndex: 1, occupiedBy: null, isBlockedByDownstream: false },
      { id: 'EXIT_S_0', arm: 'S', slotIndex: 0, occupiedBy: null, isBlockedByDownstream: false },
      { id: 'EXIT_S_1', arm: 'S', slotIndex: 1, occupiedBy: null, isBlockedByDownstream: false },
      { id: 'EXIT_W_0', arm: 'W', slotIndex: 0, occupiedBy: null, isBlockedByDownstream: false },
      { id: 'EXIT_W_1', arm: 'W', slotIndex: 1, occupiedBy: null, isBlockedByDownstream: false }
    ];

    // Initialize controllers
    this.controllers = {
      uncontrolled: new UncontrolledController(),
      signal: new SignalController(),
      roundabout: new RoundaboutController(),
      proposed: new ProposedController()
    };

    this.recoveryEngine = new RecoveryEngine();
    this.recoveryAction = this.recoveryEngine.update(0, [], false);
    this.coffmanEvaluation = CoffmanEngine.evaluate([], false, this.config.coffmanOverrides);
  }

  public reset(newSeed?: number): void {
    if (newSeed !== undefined) {
      this.config.seed = newSeed;
    }
    this.prng.setSeed(this.config.seed);
    this.simTime = 0;
    this.vehicleCounter = 0;
    this.vehicles = [];
    this.totalCompletedWaitTime = 0;
    this.spawnTimer = 0;
    this.stallTimer = 0;
    this.isStalled = false;
    this.activeCycle = [];
    this.waitForEdges = [];

    for (const q of this.quadrants) {
      q.occupiedBy = null;
      q.reservedBy = null;
    }

    for (const es of this.exitSlots) {
      es.occupiedBy = null;
      es.isBlockedByDownstream = false;
    }

    for (const controller of Object.values(this.controllers)) {
      controller.reset();
    }

    this.recoveryEngine.reset();
    this.recoveryAction = this.recoveryEngine.update(0, [], false);

    this.metrics = {
      throughput: 0,
      totalCompleted: 0,
      averageWaitTime: 0,
      maxWaitTime: 0,
      deadlockCount: 0,
      totalDeadlockTime: 0,
      currentInBoxCount: 0,
      queueLengths: { N: 0, E: 0, S: 0, W: 0 },
      stalledCount: 0
    };

    this.coffmanEvaluation = CoffmanEngine.evaluate([], false, this.config.coffmanOverrides);
  }

  public setControlMode(mode: ControlMode): void {
    this.activeMode = mode;
    this.controllers[mode].reset();
  }

  public spawnSimultaneousFour(): void {
    const arms: ArmId[] = ['N', 'E', 'S', 'W'];
    for (const arm of arms) {
      this.spawnVehicle(arm, 'straight');
    }
  }

  public spawnVehicle(origin: ArmId, movement: MovementType): Vehicle {
    this.vehicleCounter++;
    const { color, label } = this.VEHICLE_COLORS[origin];
    const id = `${label}${this.vehicleCounter}`;
    const targetArm = getTargetArm(origin, movement);
    const quadrantSequence = getQuadrantSequence(origin, movement);
    const path = generateVehiclePath(origin, movement);

    const vehicle: Vehicle = {
      id,
      label,
      originArm: origin,
      targetArm,
      movement,
      color,
      quadrantSequence,
      currentQuadrantIndex: -1,
      heldQuadrant: null,
      requestedQuadrant: quadrantSequence[0] || null,
      requestedExitSlot: null,
      state: 'APPROACHING',
      position: { x: path[0].x, y: path[0].y },
      heading: 0,
      speed: this.config.targetSpeed,
      targetSpeed: this.config.targetSpeed,
      path,
      pathProgress: 0,
      arrivalTime: this.simTime,
      entryTime: null,
      exitTime: null,
      waitTime: 0,
      isStalled: false,
      stalledDuration: 0,
      brakeLights: false,
      indicator: movement === 'left' ? 'left' : movement === 'right' ? 'right' : 'none'
    };

    this.vehicles.push(vehicle);
    return vehicle;
  }

  public step(dt: number): void {
    const delta = dt * this.config.simSpeedMultiplier;
    this.simTime += delta;

    // 1. Update exit slot downstream blockages from config
    for (const es of this.exitSlots) {
      if (es.slotIndex === 1) {
        es.isBlockedByDownstream = this.config.downstreamBlockage[es.arm] > 0.5;
      }
    }

    // 2. Continuous vehicle spawning if in normal mode
    if (this.config.demandLevel !== 'low' || this.vehicles.length === 0) {
      this.handleSpawning(delta);
    }

    // 3. Controller coordination
    const currentController = this.controllers[this.activeMode];
    const ctrlContext = {
      simTime: this.simTime,
      delta,
      activeVehicles: this.vehicles,
      quadrants: this.quadrants,
      exitSlots: this.exitSlots,
      yellowBoxRule: this.activeMode === 'proposed' || !this.config.coffmanOverrides.holdAndWaitBroken,
      flyoverActive: this.config.coffmanOverrides.mutualExclusionBroken,
      isStalled: this.isStalled
    };

    const decisions = currentController.update(ctrlContext);
    this.activeSignalState = decisions.signalState;
    this.debuggerState = decisions.debuggerState;

    // 4. Update vehicle kinematics and states
    this.updateVehicles(delta, decisions.authorizations);

    // 5. Build RAG and cycle detection
    const { rag, waitForCycle, waitForEdges } = buildRAG(this.vehicles, this.quadrants, this.exitSlots);
    this.ragGraph = rag;
    this.activeCycle = waitForCycle;
    this.waitForEdges = waitForEdges;

    // 6. Check for circular wait override
    if (this.config.coffmanOverrides.circularWaitBroken) {
      this.activeCycle = [];
    }

    // 7. Deadlock tracking & stall detection
    const hasDeadlockCycle = this.activeCycle.length > 0;
    if (hasDeadlockCycle) {
      this.metrics.totalDeadlockTime += delta;
      if (this.metrics.deadlockCount === 0 || !this.isStalled) {
        this.metrics.deadlockCount++;
      }
      this.isStalled = true;
    }

    // Stall detector on in-box vehicles (progress check)
    const inBoxVehicles = this.vehicles.filter(v => v.state === 'IN_BOX');
    let anyStalled = false;
    for (const v of inBoxVehicles) {
      if (v.speed < 1.0) {
        v.stalledDuration += delta;
        if (v.stalledDuration >= this.config.tStuck) {
          v.isStalled = true;
          anyStalled = true;
        }
      } else {
        v.stalledDuration = 0;
        v.isStalled = false;
      }
    }

    if (!hasDeadlockCycle && anyStalled) {
      this.isStalled = true;
    } else if (!hasDeadlockCycle && !anyStalled) {
      this.isStalled = false;
    }

    // 8. Recovery engine step
    const shouldAutoRecover = this.autoRecovery || this.config.coffmanOverrides.noPreemptionBroken;
    if (hasDeadlockCycle && shouldAutoRecover && this.recoveryEngine.getStepIndex() === 0) {
      this.recoveryEngine.trigger(this.activeCycle, this.vehicles);
    }
    this.recoveryAction = this.recoveryEngine.update(delta, this.vehicles, hasDeadlockCycle);

    // 9. Coffman condition live evaluation
    this.coffmanEvaluation = CoffmanEngine.evaluate(
      this.vehicles,
      hasDeadlockCycle,
      this.config.coffmanOverrides
    );

    // 10. Compute aggregated metrics
    this.updateMetrics();
  }

  private handleSpawning(delta: number): void {
    const spawnInterval =
      this.config.demandLevel === 'high' ? 2.5 :
      this.config.demandLevel === 'med' ? 4.5 : 8.0;

    this.spawnTimer += delta;
    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      const arms: ArmId[] = ['N', 'E', 'S', 'W'];
      const chosenArm = this.prng.nextChoice(arms);
      const movements: MovementType[] = ['straight', 'left', 'right'];
      // Weigh straight slightly higher
      const chosenMovement = this.prng.next() < 0.6 ? 'straight' : this.prng.nextChoice(movements);

      // Check if approach lane has space and spawn origin is clear
      const approachVehicles = this.vehicles.filter(
        v => v.originArm === chosenArm && (v.state === 'APPROACHING' || v.state === 'QUEUED')
      );
      const hasSpaceAtSpawn = !approachVehicles.some(v => v.pathProgress < 0.10);
      if (approachVehicles.length < 3 && hasSpaceAtSpawn) {
        this.spawnVehicle(chosenArm, chosenMovement);
      }
    }
  }

  private updateVehicles(delta: number, authorizations: Set<string>): void {
    // Synchronize quadrant occupancy
    const quadOccupants = new Map<QuadrantId, string | null>([
      ['NW', null],
      ['NE', null],
      ['SE', null],
      ['SW', null]
    ]);

    const activeVehicles = this.vehicles.filter(v => v.state !== 'GONE');

    for (const v of activeVehicles) {
      const metrics = getPathMetrics(v.path);
      const totalLen = metrics.totalLength;
      const stopProgress = getStopLineProgress(v.path);
      const distanceToLeader = this.getDistanceToLeader(v);
      const minSafeDistance = 55; // units

      switch (v.state) {
        case 'APPROACHING': {
          // Calculate allowed target progress towards stop line or behind queued leader
          let targetProgress = stopProgress;
          if (distanceToLeader < minSafeDistance + 250) {
            const currentDist = v.pathProgress * totalLen;
            const allowedDist = Math.max(0, currentDist + (distanceToLeader - minSafeDistance));
            targetProgress = Math.min(stopProgress, allowedDist / totalLen);
          }

          if (v.pathProgress < targetProgress - 0.001) {
            v.speed = this.config.targetSpeed;
            v.brakeLights = false;
            v.pathProgress = Math.min(targetProgress, v.pathProgress + (v.speed * delta) / totalLen);
          } else {
            v.pathProgress = Math.min(targetProgress, v.pathProgress);
            v.speed = 0;
            v.brakeLights = true;
            v.state = 'QUEUED';
            v.waitTime += delta;
          }
          break;
        }

        case 'QUEUED': {
          v.waitTime += delta;
          v.speed = 0;
          v.brakeLights = true;

          // Check if controller authorizes entry
          if (authorizations.has(v.id)) {
            v.state = 'IN_BOX';
            v.entryTime = this.simTime;
            v.currentQuadrantIndex = 0;
            v.heldQuadrant = v.quadrantSequence[0];
            v.requestedQuadrant = v.quadrantSequence[1] || null;
            if (!v.requestedQuadrant) {
              v.requestedExitSlot = `EXIT_${v.targetArm}_0` as ExitSlotId;
            }
          }
          break;
        }

        case 'ENTERING':
        case 'IN_BOX': {
          v.state = 'IN_BOX';
          // Quadrant traversal checkpoints:
          const currentQuadWpIdx = 2 + v.currentQuadrantIndex;
          const currentQuadProgress = metrics.waypointProgress[currentQuadWpIdx] || 0.454;
          const exitWpIdx = 2 + v.quadrantSequence.length;
          const exitProgress = metrics.waypointProgress[exitWpIdx] || 0.633;

          const nextQuad = v.requestedQuadrant;
          const nextSlot = v.requestedExitSlot;

          let isNextBlocked = false;
          if (nextQuad && !this.config.coffmanOverrides.mutualExclusionBroken) {
            const occupant = this.quadrants.find(q => q.id === nextQuad)?.occupiedBy;
            if (occupant && occupant !== v.id) {
              isNextBlocked = true;
            }
          }

          if (nextSlot) {
            const slotRes = this.exitSlots.find(s => s.id === nextSlot);
            if (slotRes && ((slotRes.occupiedBy && slotRes.occupiedBy !== v.id) || slotRes.isBlockedByDownstream)) {
              isNextBlocked = true;
            }
          }

          // If next resource is blocked, vehicle advances into and holds its current quadrant center
          const maxAllowedProgress = isNextBlocked ? currentQuadProgress : 1.0;

          if (v.pathProgress < maxAllowedProgress - 0.001) {
            v.speed = this.config.targetSpeed;
            v.brakeLights = false;
            v.pathProgress = Math.min(maxAllowedProgress, v.pathProgress + (v.speed * delta) / totalLen);

            // Update quadrant indexes as vehicle advances past quadrant boundaries
            const nextQuadWpIdx = currentQuadWpIdx + 1;
            if (v.currentQuadrantIndex + 1 < v.quadrantSequence.length && metrics.waypointProgress[nextQuadWpIdx]) {
              const boundary = (currentQuadProgress + metrics.waypointProgress[nextQuadWpIdx]) / 2;
              if (v.pathProgress >= boundary) {
                v.currentQuadrantIndex++;
                v.heldQuadrant = v.quadrantSequence[v.currentQuadrantIndex];
                v.requestedQuadrant = v.quadrantSequence[v.currentQuadrantIndex + 1] || null;
                if (!v.requestedQuadrant) {
                  v.requestedExitSlot = `EXIT_${v.targetArm}_0` as ExitSlotId;
                }
              }
            }

            if (v.pathProgress >= exitProgress) {
              v.state = 'EXITING';
              v.heldQuadrant = null;
              v.requestedQuadrant = null;
              v.requestedExitSlot = null;
            }
          } else {
            // Blocked: hold current quadrant and wait
            v.pathProgress = Math.min(maxAllowedProgress, v.pathProgress);
            v.speed = 0;
            v.brakeLights = true;
            v.waitTime += delta;
          }
          break;
        }

        case 'EXITING': {
          const targetSlot1 = this.exitSlots.find(s => s.id === `EXIT_${v.targetArm}_1`);
          const isSlot1Blocked = (targetSlot1?.occupiedBy && targetSlot1.occupiedBy !== v.id) || !!targetSlot1?.isBlockedByDownstream;

          if (!isSlot1Blocked && distanceToLeader > minSafeDistance) {
            v.speed = this.config.targetSpeed;
            v.brakeLights = false;
            v.pathProgress += (v.speed * delta) / totalLen;

            if (v.pathProgress >= 1.0) {
              v.state = 'GONE';
              v.exitTime = this.simTime;
              this.totalCompletedWaitTime += v.waitTime;
              this.metrics.totalCompleted++;
            }
          } else {
            v.speed = 0;
            v.brakeLights = true;
            v.waitTime += delta;
          }
          break;
        }
      }

      // Update spatial coordinates and heading from path
      const sample = samplePath(v.path, Math.min(1, v.pathProgress));
      v.position = sample.pos;
      v.heading = sample.heading;

      // Update quadrant resource occupancy
      if (v.heldQuadrant) {
        quadOccupants.set(v.heldQuadrant, v.id);
      }
    }

    // Apply quadrant occupancies
    for (const q of this.quadrants) {
      q.occupiedBy = quadOccupants.get(q.id) || null;
    }

    // Update exit slot occupancies based on active vehicles
    for (const es of this.exitSlots) {
      if (es.slotIndex === 1 && this.config.downstreamBlockage[es.arm] > 0.5) {
        es.occupiedBy = 'CHOKE_BLOCKAGE';
      } else {
        const occupant = activeVehicles.find(v => {
          return v.targetArm === es.arm && (
            (es.slotIndex === 0 && v.pathProgress >= 0.65 && v.pathProgress < 0.85) ||
            (es.slotIndex === 1 && v.pathProgress >= 0.85 && v.pathProgress < 1.0)
          );
        });
        es.occupiedBy = occupant ? occupant.id : null;
      }
    }
  }

  private getDistanceToLeader(v: Vehicle): number {
    let minDistance = 9999;

    for (const other of this.vehicles) {
      if (other.id === v.id || other.state === 'GONE') continue;

      // Case 1: Same approach arm before or at the stop line
      if (
        (v.state === 'APPROACHING' || v.state === 'QUEUED') &&
        other.originArm === v.originArm &&
        other.pathProgress > v.pathProgress
      ) {
        const dx = other.position.x - v.position.x;
        const dy = other.position.y - v.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist < minDistance) {
          minDistance = dist;
        }
      }

      // Case 2: In exit lane (both exiting to the same arm)
      if (
        v.state === 'EXITING' &&
        other.targetArm === v.targetArm &&
        other.pathProgress > v.pathProgress
      ) {
        const dx = other.position.x - v.position.x;
        const dy = other.position.y - v.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist < minDistance) {
          minDistance = dist;
        }
      }
    }

    return minDistance;
  }

  private updateMetrics(): void {
    const queueLengths: Record<ArmId, number> = { N: 0, E: 0, S: 0, W: 0 };
    let currentInBox = 0;
    let totalWait = this.totalCompletedWaitTime;
    let maxWait = 0;

    for (const v of this.vehicles) {
      if (v.state === 'QUEUED') {
        queueLengths[v.originArm]++;
      }
      if (v.state === 'IN_BOX' || v.state === 'ENTERING') {
        currentInBox++;
      }
      if (v.state !== 'GONE') {
        totalWait += v.waitTime;
        if (v.waitTime > maxWait) {
          maxWait = v.waitTime;
        }
      }
    }

    const totalCount = this.metrics.totalCompleted + this.vehicles.filter(v => v.state !== 'GONE').length;
    this.metrics.queueLengths = queueLengths;
    this.metrics.currentInBoxCount = currentInBox;
    this.metrics.maxWaitTime = maxWait;
    this.metrics.averageWaitTime = totalCount > 0 ? totalWait / totalCount : 0;
    this.metrics.throughput = this.simTime > 0 ? (this.metrics.totalCompleted / (this.simTime / 60)) : 0;

    // Periodically prune old GONE vehicles to keep memory and array lookups constant for N time
    if (this.vehicles.length > 24) {
      this.vehicles = this.vehicles.filter(v => v.state !== 'GONE');
    }
  }
}
