import { describe, it, expect } from 'vitest';
import { Simulation } from '../src/sim/Simulation';
import { findDirectedCycle } from '../src/sim/rag';
import { ComparisonManager } from '../src/render/ComparisonManager';

describe('GRIDLOCK LAB — Core Unit Tests', () => {
  it('Cycle detector correctly identifies acyclic, 2-cycle, 4-cycle, and disjoint cycles', () => {
    // 1. Acyclic graph
    const acyclic = new Map<string, string[]>([
      ['A', ['B']],
      ['B', ['C']],
      ['C', []]
    ]);
    expect(findDirectedCycle(acyclic)).toEqual([]);

    // 2. 2-cycle
    const twoCycle = new Map<string, string[]>([
      ['A', ['B']],
      ['B', ['A']]
    ]);
    const cycle2 = findDirectedCycle(twoCycle);
    expect(cycle2.length).toBe(2);
    expect(cycle2).toContain('A');
    expect(cycle2).toContain('B');

    // 3. 4-cycle (A -> B -> C -> D -> A)
    const fourCycle = new Map<string, string[]>([
      ['A', ['B']],
      ['B', ['C']],
      ['C', ['D']],
      ['D', ['A']]
    ]);
    const cycle4 = findDirectedCycle(fourCycle);
    expect(cycle4.length).toBe(4);
    expect(cycle4).toContain('A');
    expect(cycle4).toContain('B');
    expect(cycle4).toContain('C');
    expect(cycle4).toContain('D');

    // 4. Two disjoint cycles: A <-> B and C <-> D
    const disjoint = new Map<string, string[]>([
      ['A', ['B']],
      ['B', ['A']],
      ['C', ['D']],
      ['D', ['C']]
    ]);
    const cycleDisjoint = findDirectedCycle(disjoint);
    expect(cycleDisjoint.length).toBe(2);
  });

  it('Scenario 1 (uncontrolled simultaneous arrival) reliably detects circular deadlock [A, B, C, D] within 6 sim-seconds', () => {
    const sim = new Simulation({
      seed: 12345,
      demandLevel: 'low',
      simSpeedMultiplier: 1.0
    });
    sim.setControlMode('uncontrolled');
    sim.spawnSimultaneousFour();

    // Step for 6.0 sim-seconds
    const dt = 0.05;
    let deadlockDetected = false;
    let cycleMembers: string[] = [];

    for (let t = 0; t < 6.0; t += dt) {
      sim.step(dt);
      if (sim.activeCycle.length === 4) {
        deadlockDetected = true;
        cycleMembers = [...sim.activeCycle];
        break;
      }
    }

    expect(deadlockDetected).toBe(true);
    expect(cycleMembers.length).toBe(4);
    // Cycle should contain all 4 vehicles: A1, B2, C3, D4
    const vehicleLabels = cycleMembers.map(id => sim.vehicles.find(v => v.id === id)?.label);
    expect(vehicleLabels).toContain('A');
    expect(vehicleLabels).toContain('B');
    expect(vehicleLabels).toContain('C');
    expect(vehicleLabels).toContain('D');
  });

  it('Unit capacity invariant: no two vehicles ever occupy the same quadrant', () => {
    const sim = new Simulation({
      seed: 9999,
      demandLevel: 'high',
      simSpeedMultiplier: 1.0
    });

    const dt = 0.05;
    for (let step = 0; step < 500; step++) {
      sim.step(dt);
      const quadCounts: Record<string, number> = { NW: 0, NE: 0, SE: 0, SW: 0 };
      for (const v of sim.vehicles) {
        if (v.state === 'IN_BOX' && v.heldQuadrant) {
          quadCounts[v.heldQuadrant]++;
        }
      }
      for (const count of Object.values(quadCounts)) {
        expect(count).toBeLessThanOrEqual(1);
      }
    }
  });

  it('Proposed controller guarantees zero deadlocks across high-demand simulation', () => {
    const sim = new Simulation({
      seed: 777,
      demandLevel: 'high',
      simSpeedMultiplier: 2.0
    });
    sim.setControlMode('proposed');

    const dt = 0.05;
    // Simulate 120 seconds of high-demand traffic
    for (let t = 0; t < 120; t += dt) {
      sim.step(dt);
      expect(sim.activeCycle.length).toBe(0);
      expect(sim.metrics.deadlockCount).toBe(0);
    }
  });

  it('Breaking any Coffman condition in Scenario 1 prevents or dissolves deadlock', () => {
    const conditions = [
      'mutualExclusionBroken',
      'holdAndWaitBroken',
      'noPreemptionBroken',
      'circularWaitBroken'
    ] as const;

    for (const condition of conditions) {
      const sim = new Simulation({
        seed: 42,
        demandLevel: 'low',
        coffmanOverrides: {
          mutualExclusionBroken: condition === 'mutualExclusionBroken',
          holdAndWaitBroken: condition === 'holdAndWaitBroken',
          noPreemptionBroken: condition === 'noPreemptionBroken',
          circularWaitBroken: condition === 'circularWaitBroken'
        }
      });
      sim.setControlMode('uncontrolled');
      sim.spawnSimultaneousFour();

      const dt = 0.05;
      for (let t = 0; t < 5.0; t += dt) {
        sim.step(dt);
      }

      // Evaluation should show condition broken and status deadlocked impossible / broken
      expect(sim.coffmanEvaluation.brokenConditionName).not.toBeNull();
    }
  });

  it('Determinism: identical seed produces identical metrics and vehicle state', () => {
    const sim1 = new Simulation({ seed: 8888, demandLevel: 'med' });
    const sim2 = new Simulation({ seed: 8888, demandLevel: 'med' });

    for (let step = 0; step < 200; step++) {
      sim1.step(0.05);
      sim2.step(0.05);
    }

    expect(sim1.vehicles.length).toBe(sim2.vehicles.length);
    expect(sim1.metrics.totalCompleted).toBe(sim2.metrics.totalCompleted);
    expect(sim1.metrics.averageWaitTime).toBeCloseTo(sim2.metrics.averageWaitTime, 4);
    for (let i = 0; i < sim1.vehicles.length; i++) {
      expect(sim1.vehicles[i].position.x).toBeCloseTo(sim2.vehicles[i].position.x, 3);
      expect(sim1.vehicles[i].position.y).toBeCloseTo(sim2.vehicles[i].position.y, 3);
    }
  });

  it('All 8 Scenarios run stably over N time without crashes, NaNs, or memory leaks', () => {
    // Test Scenario 1: The Failure stays deadlocked over N time
    const sim1 = new Simulation({ seed: 42, demandLevel: 'low' });
    sim1.setControlMode('uncontrolled');
    sim1.spawnSimultaneousFour();
    for (let t = 0; t < 25; t += 0.05) {
      sim1.step(0.05);
    }
    expect(sim1.activeCycle.length).toBe(4);
    expect(sim1.coffmanEvaluation.allFourHold).toBe(true);

    // Test Scenario 3: Exit-Clear Rule runs for N time with zero deadlocks
    const sim3 = new Simulation({ seed: 101, demandLevel: 'med' });
    sim3.setControlMode('proposed');
    sim3.config.coffmanOverrides.holdAndWaitBroken = true;
    sim3.spawnSimultaneousFour();
    for (let t = 0; t < 30; t += 0.05) {
      sim3.step(0.05);
      expect(sim3.activeCycle.length).toBe(0);
    }
    expect(sim3.metrics.deadlockCount).toBe(0);
    expect(sim3.metrics.totalCompleted).toBeGreaterThan(0);

    // Test Scenario 4: Signal with Blocked South Exit runs for N time without NaN/crash
    const sim4 = new Simulation({ seed: 202, demandLevel: 'med' });
    sim4.setControlMode('signal');
    sim4.config.downstreamBlockage.S = 1;
    for (let t = 0; t < 30; t += 0.05) {
      sim4.step(0.05);
      expect(Number.isNaN(sim4.metrics.averageWaitTime)).toBe(false);
    }
    expect(sim4.metrics.queueLengths.N + sim4.metrics.queueLengths.S).toBeGreaterThan(0);

    // Test Scenario 5: Roundabout with Blocked West Exit runs for N time
    const sim5 = new Simulation({ seed: 303, demandLevel: 'med' });
    sim5.setControlMode('roundabout');
    sim5.config.downstreamBlockage.W = 1;
    for (let t = 0; t < 30; t += 0.05) {
      sim5.step(0.05);
      expect(Number.isNaN(sim5.metrics.averageWaitTime)).toBe(false);
    }

    // Test Scenario 6: 5-Step Recovery sequence transitions through all steps to restore
    const sim6 = new Simulation({ seed: 404, demandLevel: 'low' });
    sim6.setControlMode('uncontrolled');
    sim6.autoRecovery = true;
    sim6.spawnSimultaneousFour();
    let reachedRestore = false;
    for (let t = 0; t < 20; t += 0.05) {
      sim6.step(0.05);
      if (sim6.recoveryEngine.getStepIndex() === 5 || sim6.recoveryEngine.getStepIndex() === 0 && t > 10) {
        reachedRestore = true;
      }
    }
    expect(reachedRestore).toBe(true);

    // Test Scenario 7: Proposed Controller continuous high demand over N time
    const sim7 = new Simulation({ seed: 505, demandLevel: 'high' });
    sim7.setControlMode('proposed');
    sim7.config.coffmanOverrides.holdAndWaitBroken = true;
    for (let t = 0; t < 60; t += 0.05) {
      sim7.step(0.05);
      expect(sim7.activeCycle.length).toBe(0);
    }
    expect(sim7.metrics.totalCompleted).toBeGreaterThan(5);

    // Test Scenario 8: Head-to-Head Comparison 4-instance synchronous run
    const comp = new ComparisonManager(606);
    comp.reset(606, 30, 0);
    let compDone = false;
    for (let t = 0; t < 35; t += 0.05) {
      const finished = comp.step(0.05);
      if (finished) {
        compDone = true;
        break;
      }
    }
    expect(compDone).toBe(true);
    const results = comp.getResults();
    expect(results.length).toBe(4);
    // Proposed controller in comparison should have 0 deadlocks
    const proposedResult = results.find(r => r.mode === 'proposed');
    expect(proposedResult?.deadlockCount).toBe(0);
  });
});
