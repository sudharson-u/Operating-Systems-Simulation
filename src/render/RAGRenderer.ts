/**
 * GRIDLOCK LAB — Live RAG & Wait-For Graph Canvas Renderer (Tab 1)
 * Visualizes bipartite Operating Systems graph and cycle glows.
 */

import { Simulation } from '../sim/Simulation';

export class RAGRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: Simulation;
  private graphMode: 'rag' | 'wait_for' = 'rag';
  private animTimer: number = 0;

  constructor(canvas: HTMLCanvasElement, sim: Simulation) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get RAG canvas 2D context');
    this.ctx = context;
    this.sim = sim;
  }

  public setGraphMode(mode: 'rag' | 'wait_for'): void {
    this.graphMode = mode;
  }

  public getGraphMode(): 'rag' | 'wait_for' {
    return this.graphMode;
  }

  public render(dt: number): void {
    this.animTimer += dt;
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const w = rect.width || 310;
    const h = rect.height || 240;

    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Dark canvas background
    ctx.fillStyle = '#071216';
    ctx.fillRect(0, 0, w, h);

    if (this.graphMode === 'rag') {
      this.renderRAG(ctx, w, h);
    } else {
      this.renderWaitFor(ctx, w, h);
    }

    ctx.restore();
  }

  private renderRAG(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Layout: Quadrants in the inner circle, Vehicles on the outer ring
    const centerX = w / 2;
    const centerY = h / 2;

    const quadPositions: Record<string, { x: number; y: number }> = {
      NW: { x: centerX - 35, y: centerY - 35 },
      NE: { x: centerX + 35, y: centerY - 35 },
      SE: { x: centerX + 35, y: centerY + 35 },
      SW: { x: centerX - 35, y: centerY + 35 }
    };

    const activeVehicles = this.sim.vehicles.filter(v => v.state !== 'GONE');
    const vehiclePositions = new Map<string, { x: number; y: number }>();

    activeVehicles.forEach((v, idx) => {
      const angle = (idx / Math.max(activeVehicles.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = Math.min(w, h) * 0.40;
      vehiclePositions.set(v.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    });

    // 1. Draw Edges
    for (const edge of this.sim.ragGraph.edges) {
      const isFromProcess = vehiclePositions.has(edge.from);
      const fromPos = isFromProcess ? vehiclePositions.get(edge.from) : quadPositions[edge.from];
      const toPos = !isFromProcess ? vehiclePositions.get(edge.to) : quadPositions[edge.to];

      if (!fromPos || !toPos) continue;

      ctx.save();
      const isCycleEdge = edge.isCycle;
      ctx.strokeStyle = isCycleEdge ? '#E5484D' : edge.type === 'assignment' ? '#2FBF71' : '#F59E4B';
      ctx.lineWidth = isCycleEdge ? 2.5 : 1.5;

      if (edge.type === 'request') {
        ctx.setLineDash([4, 4]);
      }

      if (isCycleEdge) {
        ctx.shadowColor = '#E5484D';
        ctx.shadowBlur = 8;
      }

      ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y);
      ctx.lineTo(toPos.x, toPos.y);
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
      ctx.translate(toPos.x - Math.cos(angle) * 12, toPos.y - Math.sin(angle) * 12);
      ctx.rotate(angle);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(-6, -4); ctx.lineTo(0, 0); ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // 2. Draw Quadrant Resource Nodes (Squares)
    for (const [qId, pos] of Object.entries(quadPositions)) {
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.fillStyle = '#0E3A52';
      ctx.strokeStyle = '#33555B';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-12, -12, 24, 24);
      ctx.strokeRect(-12, -12, 24, 24);

      ctx.fillStyle = '#E3FDF9';
      ctx.font = '700 9px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(qId, 0, 0);
      ctx.restore();
    }

    // 3. Draw Vehicle Process Nodes (Circles)
    for (const v of activeVehicles) {
      const pos = vehiclePositions.get(v.id);
      if (!pos) continue;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      const isCycle = this.sim.activeCycle.includes(v.id);

      if (isCycle) {
        ctx.shadowColor = '#E5484D';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#E5484D';
      } else {
        ctx.fillStyle = v.color;
      }

      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0F2229';
      ctx.font = '700 10px "Familjen Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(v.label, 0, 0);
      ctx.restore();
    }
  }

  private renderWaitFor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const centerX = w / 2;
    const centerY = h / 2;
    const radius = Math.min(w, h) * 0.36;

    const activeVehicles = this.sim.vehicles.filter(v => v.state !== 'GONE');
    const vehiclePositions = new Map<string, { x: number; y: number }>();

    activeVehicles.forEach((v, idx) => {
      const angle = (idx / Math.max(activeVehicles.length, 1)) * Math.PI * 2 - Math.PI / 2;
      vehiclePositions.set(v.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    });

    // 1. Draw Direct Process-to-Process Wait-For Edges
    for (const edge of this.sim.waitForEdges) {
      const fromPos = vehiclePositions.get(edge.from);
      const toPos = vehiclePositions.get(edge.to);
      if (!fromPos || !toPos) continue;

      ctx.save();
      const isCycle = edge.isCycle;
      ctx.strokeStyle = isCycle ? '#E5484D' : '#F59E4B';
      ctx.lineWidth = isCycle ? 3 : 1.5;

      if (isCycle) {
        ctx.shadowColor = '#E5484D';
        ctx.shadowBlur = 10;
      }

      // Curved Bezier edge
      const midX = (fromPos.x + toPos.x) / 2;
      const midY = (fromPos.y + toPos.y) / 2;
      const ctrlX = midX + (centerX - midX) * 0.4;
      const ctrlY = midY + (centerY - midY) * 0.4;

      ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, toPos.x, toPos.y);
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(toPos.y - ctrlY, toPos.x - ctrlX);
      ctx.translate(toPos.x - Math.cos(angle) * 14, toPos.y - Math.sin(angle) * 14);
      ctx.rotate(angle);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(-8, -5); ctx.lineTo(0, 0); ctx.lineTo(-8, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 2. Draw Process Nodes
    for (const v of activeVehicles) {
      const pos = vehiclePositions.get(v.id);
      if (!pos) continue;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      const isCycle = this.sim.activeCycle.includes(v.id);

      if (isCycle) {
        ctx.shadowColor = '#E5484D';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#E5484D';
      } else {
        ctx.fillStyle = v.color;
      }

      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0F2229';
      ctx.font = '700 12px "Familjen Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(v.label, 0, 0);
      ctx.restore();
    }
  }
}
