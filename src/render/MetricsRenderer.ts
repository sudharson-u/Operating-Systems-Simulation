/**
 * GRIDLOCK LAB — Real-Time Metrics & Sparkline Canvas Renderer (Tab 4)
 */

import { Simulation } from '../sim/Simulation';

export class MetricsRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: Simulation;
  private history: { time: number; inBox: number; throughput: number }[] = [];
  private lastRecordTime: number = 0;

  constructor(canvas: HTMLCanvasElement, sim: Simulation) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get metrics canvas context');
    this.ctx = context;
    this.sim = sim;
  }

  public render(): void {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width || 310;
    const h = rect.height || 120;

    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Record sample every 0.5s
    if (this.sim.simTime - this.lastRecordTime >= 0.5) {
      this.lastRecordTime = this.sim.simTime;
      this.history.push({
        time: this.sim.simTime,
        inBox: this.sim.metrics.currentInBoxCount,
        throughput: this.sim.metrics.throughput
      });
      if (this.history.length > 50) {
        this.history.shift();
      }
    }

    ctx.fillStyle = '#071216';
    ctx.fillRect(0, 0, w, h);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(51, 85, 91, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, h / 2); ctx.lineTo(w - 10, h / 2);
    ctx.stroke();

    if (this.history.length < 2) {
      ctx.restore();
      return;
    }

    // Sparkline 1: Vehicles in Box (Coral line)
    ctx.strokeStyle = '#E8664A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const maxInBox = 4;
    this.history.forEach((pt, idx) => {
      const x = 10 + (idx / (this.history.length - 1)) * (w - 20);
      const y = h - 15 - (pt.inBox / maxInBox) * (h - 30);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Sparkline 2: Throughput (Green dashed line)
    ctx.strokeStyle = '#2FBF71';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    const maxTput = Math.max(...this.history.map(pt => pt.throughput), 20);
    this.history.forEach((pt, idx) => {
      const x = 10 + (idx / (this.history.length - 1)) * (w - 20);
      const y = h - 15 - (pt.throughput / maxTput) * (h - 30);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.font = '600 10px "Wix Madefor Text", sans-serif';
    ctx.fillStyle = '#E8664A';
    ctx.fillText('— In-Box Count', 12, 14);
    ctx.fillStyle = '#2FBF71';
    ctx.fillText('-- Throughput (veh/min)', 110, 14);

    ctx.restore();
  }
}
