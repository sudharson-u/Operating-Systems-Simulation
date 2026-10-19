/**
 * GRIDLOCK LAB — Multi-Canvas Comparison Engine (Slide 8)
 * Synchronously executes 4 simulation instances (Uncontrolled, Signal, Roundabout, Proposed)
 * on identical seeded arrival sequences, rendering live mini-HUDs and canvas bar charts.
 */

import { Simulation } from '../sim/Simulation';
import { CanvasRenderer } from './CanvasRenderer';
import { ControlMode } from '../sim/types';

export interface ComparisonResults {
  mode: ControlMode;
  name: string;
  throughput: number;
  averageWait: number;
  maxWait: number;
  deadlockCount: number;
  totalDeadlockTime: number;
  completedVehicles: number;
}

export class ComparisonManager {
  public simulations: Record<ControlMode, Simulation>;
  public renderers: Record<ControlMode, CanvasRenderer | null>;
  public isRunning: boolean = false;
  public simSpeed: number = 1.0;
  public runDuration: number = 60; // 60 sim-seconds (1 min), 180s (3 min), 300s (5 min)
  public elapsedSimTime: number = 0;

  private readonly MODES: { id: ControlMode; name: string }[] = [
    { id: 'uncontrolled', name: '1. Uncontrolled' },
    { id: 'signal', name: '2. Signal-Controlled' },
    { id: 'roundabout', name: '3. Roundabout' },
    { id: 'proposed', name: '4. Proposed Controller' }
  ];

  constructor(seed: number = 42) {
    this.simulations = {
      uncontrolled: new Simulation({ seed, demandLevel: 'high' }),
      signal: new Simulation({ seed, demandLevel: 'high' }),
      roundabout: new Simulation({ seed, demandLevel: 'high' }),
      proposed: new Simulation({ seed, demandLevel: 'high' })
    };

    this.simulations.uncontrolled.setControlMode('uncontrolled');
    this.simulations.signal.setControlMode('signal');
    this.simulations.roundabout.setControlMode('roundabout');
    this.simulations.proposed.setControlMode('proposed');

    this.renderers = {
      uncontrolled: null,
      signal: null,
      roundabout: null,
      proposed: null
    };
  }

  public bindCanvas(mode: ControlMode, canvas: HTMLCanvasElement): void {
    this.renderers[mode] = new CanvasRenderer(canvas, this.simulations[mode]);
  }

  public reset(seed: number = 42, duration: number = 60, blockage: number = 0): void {
    this.elapsedSimTime = 0;
    this.runDuration = duration;
    for (const mode of Object.keys(this.simulations) as ControlMode[]) {
      this.simulations[mode].reset(seed);
      this.simulations[mode].setControlMode(mode);
      this.simulations[mode].config.simSpeedMultiplier = this.simSpeed;
      this.simulations[mode].config.downstreamBlockage.S = blockage;
      this.simulations[mode].config.downstreamBlockage.W = blockage;
    }
  }

  public step(dt: number): boolean {
    const delta = dt * this.simSpeed;
    this.elapsedSimTime += delta;

    for (const mode of Object.keys(this.simulations) as ControlMode[]) {
      this.simulations[mode].step(dt);
      const renderer = this.renderers[mode];
      if (renderer) {
        renderer.render(dt, {
          showQuadrantLabels: true,
          showYellowBoxMesh: mode === 'proposed',
          hoveredVehicleId: null,
          hoveredQuadrantId: null
        });
      }
    }

    // Check if run length reached
    return this.elapsedSimTime >= this.runDuration;
  }

  public getResults(): ComparisonResults[] {
    return this.MODES.map(item => {
      const sim = this.simulations[item.id];
      return {
        mode: item.id,
        name: item.name,
        throughput: Number(sim.metrics.throughput.toFixed(1)),
        averageWait: Number(sim.metrics.averageWaitTime.toFixed(1)),
        maxWait: Number(sim.metrics.maxWaitTime.toFixed(1)),
        deadlockCount: sim.metrics.deadlockCount,
        totalDeadlockTime: Number(sim.metrics.totalDeadlockTime.toFixed(1)),
        completedVehicles: sim.metrics.totalCompleted
      };
    });
  }

  /**
   * Generates a high-resolution comparison chart directly on a canvas (zero chart library).
   */
  public renderResultsChart(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const results = this.getResults();

    ctx.fillStyle = '#0F2229';
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.fillStyle = '#E3FDF9';
    ctx.font = '700 22px "Familjen Grotesk", sans-serif';
    ctx.fillText('HEAD-TO-HEAD COMPARISON RESULTS (LIVE SIMULATION)', 30, 42);

    ctx.fillStyle = '#4A7A82';
    ctx.font = '500 13px "Wix Madefor Text", sans-serif';
    ctx.fillText(`Duration: ${this.runDuration}s · Identical Seed · High Demand · Left-Hand Traffic`, 30, 64);

    // Columns: 4 modes
    const barColors = ['#E5484D', '#F59E4B', '#4DA3FF', '#2FBF71'];
    const metricsToDraw = [
      { key: 'throughput', label: 'Throughput (veh/min)', unit: '' },
      { key: 'averageWait', label: 'Avg Wait (s)', unit: 's' },
      { key: 'deadlockCount', label: 'Deadlocks Encountered', unit: '' }
    ] as const;

    const cardWidth = (w - 80) / 3;

    metricsToDraw.forEach((m, colIdx) => {
      const cardX = 30 + colIdx * (cardWidth + 10);
      const cardY = 85;
      const cardH = h - 160;

      // Card panel
      ctx.fillStyle = '#0E3A52';
      ctx.strokeStyle = '#33555B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardWidth, cardH, 8);
      ctx.fill();
      ctx.stroke();

      // Metric Header
      ctx.fillStyle = '#E3FDF9';
      ctx.font = '700 14px "Familjen Grotesk", sans-serif';
      ctx.fillText(m.label, cardX + 16, cardY + 28);

      // Bars
      const maxVal = Math.max(...results.map(r => r[m.key] as number), 1);
      const barAreaY = cardY + 50;
      const barAreaH = cardH - 70;
      const slotH = barAreaH / 4;

      results.forEach((r, rowIdx) => {
        const val = r[m.key] as number;
        const barY = barAreaY + rowIdx * slotH;
        const norm = val / maxVal;
        const barW = Math.max(8, norm * (cardWidth - 110));

        // Label
        ctx.fillStyle = 'rgba(227, 253, 249, 0.75)';
        ctx.font = '500 12px "Wix Madefor Text", sans-serif';
        ctx.fillText(r.name.split('. ')[1] || r.name, cardX + 16, barY + 14);

        // Bar
        ctx.fillStyle = barColors[rowIdx];
        ctx.beginPath();
        ctx.roundRect(cardX + 16, barY + 22, barW, 14, 3);
        ctx.fill();

        // Value
        ctx.fillStyle = '#E3FDF9';
        ctx.font = '700 12px "IBM Plex Mono", monospace';
        ctx.fillText(`${val}${m.unit}`, cardX + 24 + barW, barY + 34);
      });
    });

    // Bottom Conclusion Takeaway (deck citation)
    ctx.fillStyle = 'rgba(232, 102, 74, 0.15)';
    ctx.strokeStyle = '#E8664A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(30, h - 60, w - 60, 42, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#E3FDF9';
    ctx.font = '600 14px "Wix Madefor Text", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('“Traffic control helps reduce conflicts, but keeping the exit clear is important to prevent gridlock.”', w / 2, h - 34);
    ctx.textAlign = 'start';
  }
}
