/**
 * GRIDLOCK LAB — Enhanced High-Fidelity Canvas 2D Renderer
 * Renders large, high-visibility, projector-ready intersection, cyber-vehicles,
 * headlight projection cones, illuminated signals, and glowing deadlock wait-for vectors.
 */

import { Simulation } from '../sim/Simulation';
import {
  BOX_MAX_Y,
  BOX_MIN_X,
  BOX_MIN_Y,
  CENTER,
  QUADRANT_BOUNDS
} from '../sim/geometry';
import { ArmId, QuadrantId } from '../sim/types';

export interface RenderOptions {
  showQuadrantLabels: boolean;
  showYellowBoxMesh: boolean;
  hoveredVehicleId: string | null;
  hoveredQuadrantId: QuadrantId | null;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: Simulation;
  private width: number = 1000;
  private height: number = 1000;
  private dpr: number = 1;
  private animTimer: number = 0;

  constructor(canvas: HTMLCanvasElement, sim: Simulation) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get Canvas 2D context');
    this.ctx = context;
    this.sim = sim;
    this.resize();
  }

  public resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.width = rect.width > 0 ? rect.width : (this.width || 500);
    this.height = rect.height > 0 ? rect.height : (this.height || 500);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
  }

  public render(dt: number, options: RenderOptions): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && (Math.abs(rect.width - this.width) > 4 || Math.abs(rect.height - this.height) > 4)) {
      this.resize();
    }

    this.animTimer += dt;
    const ctx = this.ctx;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Compute scale and translation to make the 1000x1000 world HEROIC & LARGE
    // Fill around 88% of the minimum dimension to maximize canvas real estate
    const minDim = Math.min(this.width, this.height);
    const scale = (minDim * 0.94) / 1000;
    const offsetX = (this.width - 1000 * scale) / 2;
    const offsetY = (this.height - 1000 * scale) / 2;

    // Deep modern dark background
    ctx.fillStyle = '#081318';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 1. Draw Road Geometry, Kerbs, & Markings
    this.drawRoads(ctx);

    // 2. Draw Roundabout Center Island (if in Roundabout mode)
    if (this.sim.activeMode === 'roundabout') {
      this.drawRoundaboutIsland(ctx);
    }

    // 3. Draw Yellow-Box Mesh
    if (options.showYellowBoxMesh || this.sim.activeMode === 'proposed' || this.sim.config.coffmanOverrides.holdAndWaitBroken) {
      this.drawYellowBoxMesh(ctx);
    }

    // 4. Draw Quadrant Resource Overlays & Labels
    this.drawQuadrantOverlays(ctx, options);

    // 5. Draw Exit Slots Overlays
    this.drawExitSlots(ctx);

    // 6. Draw Traffic Signals (if in Signal mode)
    if (this.sim.activeMode === 'signal') {
      this.drawTrafficSignals(ctx);
    }

    // 7. Draw Recovery Visuals (Cones, Police, Detour Arrows)
    this.drawRecoveryVisuals(ctx);

    // 8. Draw Flyover Visuals (if Mutual Exclusion broken)
    if (this.sim.config.coffmanOverrides.mutualExclusionBroken) {
      this.drawFlyover(ctx);
    }

    // 9. Draw Vehicles with Headlight Cones, Brake Lights, Badges
    this.drawVehicles(ctx, options);

    // 10. Draw Curved Wait-For Arrows (Laser-red cycle during deadlock)
    this.drawWaitForArrows(ctx);

    ctx.restore();

    // 11. Subtle Screen Vignette on Deadlock
    if (this.sim.activeCycle.length > 0) {
      this.drawDeadlockVignette(ctx);
    }

    ctx.restore();
  }

  private drawRoads(ctx: CanvasRenderingContext2D): void {
    // Rich asphalt texture
    ctx.fillStyle = '#111D24';

    // North-South Road
    ctx.fillRect(430, 0, 140, 1000);
    // East-West Road
    ctx.fillRect(0, 430, 1000, 140);

    // Asphalt edge borders (Kerbs)
    ctx.strokeStyle = '#25444D';
    ctx.lineWidth = 4;

    // Corner kerbs with slight bevel
    ctx.beginPath();
    // Top-Left
    ctx.moveTo(0, 430); ctx.lineTo(430, 430); ctx.lineTo(430, 0);
    // Top-Right
    ctx.moveTo(570, 0); ctx.lineTo(570, 430); ctx.lineTo(1000, 430);
    // Bottom-Right
    ctx.moveTo(1000, 570); ctx.lineTo(570, 570); ctx.lineTo(570, 1000);
    // Bottom-Left
    ctx.moveTo(430, 1000); ctx.lineTo(430, 570); ctx.lineTo(0, 570);
    ctx.stroke();

    // Dashed center dividing lines
    ctx.strokeStyle = 'rgba(74, 122, 130, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([18, 16]);

    ctx.beginPath(); ctx.moveTo(500, 0); ctx.lineTo(500, 420); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(500, 580); ctx.lineTo(500, 1000); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 500); ctx.lineTo(420, 500); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(580, 500); ctx.lineTo(1000, 500); ctx.stroke();
    ctx.setLineDash([]);

    // Stop / Yield Lines
    ctx.strokeStyle = '#FFFFFF';
    const isRoundabout = this.sim.activeMode === 'roundabout';
    if (isRoundabout) {
      // Double dashed Give-Way (Yield) lines for roundabout entries
      ctx.lineWidth = 3.5;
      ctx.setLineDash([8, 8]);
    } else {
      ctx.lineWidth = 5;
      ctx.setLineDash([]);
    }

    // North approach (East side, LHT)
    ctx.beginPath(); ctx.moveTo(500, 420); ctx.lineTo(570, 420); ctx.stroke();
    // East approach (South side, LHT)
    ctx.beginPath(); ctx.moveTo(580, 500); ctx.lineTo(580, 570); ctx.stroke();
    // South approach (West side, LHT)
    ctx.beginPath(); ctx.moveTo(430, 580); ctx.lineTo(500, 580); ctx.stroke();
    // West approach (North side, LHT)
    ctx.beginPath(); ctx.moveTo(420, 430); ctx.lineTo(420, 500); ctx.stroke();
    ctx.setLineDash([]);

    // Zebra Crossings
    this.drawZebraCrossing(ctx, 430, 385, 140, 26, 'horizontal');
    this.drawZebraCrossing(ctx, 430, 589, 140, 26, 'horizontal');
    this.drawZebraCrossing(ctx, 385, 430, 26, 140, 'vertical');
    this.drawZebraCrossing(ctx, 589, 430, 26, 140, 'vertical');

    // Directional Lane Arrows
    this.drawLaneArrow(ctx, 535, 290, Math.PI / 2);  // North approach
    this.drawLaneArrow(ctx, 465, 290, -Math.PI / 2); // North departure
    this.drawLaneArrow(ctx, 710, 535, Math.PI);      // East approach
    this.drawLaneArrow(ctx, 710, 465, 0);            // East departure
    this.drawLaneArrow(ctx, 465, 710, -Math.PI / 2); // South approach
    this.drawLaneArrow(ctx, 535, 710, Math.PI / 2);  // South departure
    this.drawLaneArrow(ctx, 290, 465, 0);            // West approach
    this.drawLaneArrow(ctx, 290, 535, Math.PI);      // West departure
  }

  private drawZebraCrossing(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, orient: 'horizontal' | 'vertical'): void {
    ctx.fillStyle = 'rgba(227, 253, 249, 0.18)';
    const stripes = 6;
    if (orient === 'horizontal') {
      const step = w / stripes;
      for (let i = 0; i < stripes; i += 2) {
        ctx.fillRect(x + i * step, y, step, h);
      }
    } else {
      const step = h / stripes;
      for (let i = 0; i < stripes; i += 2) {
        ctx.fillRect(x, y + i * step, w, step);
      }
    }
  }

  private drawLaneArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(227, 253, 249, 0.28)';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(3, -7);
    ctx.lineTo(3, -2.5);
    ctx.lineTo(-16, -2.5);
    ctx.lineTo(-16, 2.5);
    ctx.lineTo(3, 2.5);
    ctx.lineTo(3, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawYellowBoxMesh(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(BOX_MIN_X, BOX_MIN_Y, 140, 140);
    ctx.clip();

    ctx.strokeStyle = '#F2C230';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.45;

    // Cross-hatched diagonal mesh
    const spacing = 18;
    for (let offset = -140; offset <= 280; offset += spacing) {
      ctx.beginPath();
      ctx.moveTo(BOX_MIN_X + offset, BOX_MIN_Y);
      ctx.lineTo(BOX_MIN_X + offset + 140, BOX_MAX_Y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(BOX_MIN_X + offset, BOX_MAX_Y);
      ctx.lineTo(BOX_MIN_X + offset + 140, BOX_MIN_Y);
      ctx.stroke();
    }

    // Outer boundary border
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(BOX_MIN_X, BOX_MIN_Y, 140, 140);
    ctx.restore();
  }

  private drawRoundaboutIsland(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 1. Circulating asphalt ring track
    ctx.fillStyle = '#0E1A22';
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, 68, 0, Math.PI * 2);
    ctx.fill();

    // 2. Outer roundabout border kerb
    ctx.strokeStyle = '#25444D';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, 68, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Truck apron ring (textured safety overrun zone)
    ctx.fillStyle = '#142E3B';
    ctx.strokeStyle = '#2A5563';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 4. Central circular raised island (radius 26 leaves 13 units of clear margin for vehicles)
    ctx.fillStyle = '#0B232D';
    ctx.strokeStyle = '#386673';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 5. Clockwise circulation dashed chevron guide
    ctx.strokeStyle = 'rgba(227, 253, 249, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, 50, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 6. Center island badge
    ctx.fillStyle = '#4DA3FF';
    ctx.font = '800 13px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↻', CENTER.x, CENTER.y - 4);
    ctx.fillStyle = '#E3FDF9';
    ctx.font = '700 8px "Familjen Grotesk", sans-serif';
    ctx.fillText('ONE-WAY', CENTER.x, CENTER.y + 8);

    ctx.restore();
  }

  private drawQuadrantOverlays(ctx: CanvasRenderingContext2D, options: RenderOptions): void {
    for (const q of this.sim.quadrants) {
      const bounds = QUADRANT_BOUNDS[q.id];
      const isHovered = options.hoveredQuadrantId === q.id;
      const occupant = q.occupiedBy ? this.sim.vehicles.find(v => v.id === q.occupiedBy) : null;
      const isDeadlocked = this.sim.activeCycle.length > 0 && occupant && this.sim.activeCycle.includes(occupant.id);

      ctx.save();

      if (isDeadlocked) {
        // High visibility pulsing danger glow
        const pulse = 0.35 + 0.18 * Math.sin(this.animTimer * 6);
        ctx.fillStyle = `rgba(229, 72, 77, ${pulse})`;
        ctx.strokeStyle = '#E5484D';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#E5484D';
        ctx.shadowBlur = 14;
      } else if (occupant) {
        ctx.fillStyle = `${occupant.color}35`;
        ctx.strokeStyle = occupant.color;
        ctx.lineWidth = 2;
      } else if (q.reservedBy) {
        ctx.fillStyle = 'rgba(232, 102, 74, 0.15)';
        ctx.strokeStyle = '#E8664A';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
      } else {
        ctx.fillStyle = isHovered ? 'rgba(227, 253, 249, 0.14)' : 'rgba(227, 253, 249, 0.04)';
        ctx.strokeStyle = 'rgba(51, 85, 91, 0.45)';
        ctx.lineWidth = 1.5;
      }

      if (this.sim.activeMode === 'roundabout') {
        const angles: Record<QuadrantId, { start: number; end: number }> = {
          NE: { start: -Math.PI / 2, end: 0 },
          SE: { start: 0, end: Math.PI / 2 },
          SW: { start: Math.PI / 2, end: Math.PI },
          NW: { start: Math.PI, end: (3 * Math.PI) / 2 }
        };
        const { start, end } = angles[q.id];
        ctx.beginPath();
        ctx.arc(CENTER.x, CENTER.y, 68, start, end, false);
        ctx.arc(CENTER.x, CENTER.y, 34, end, start, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
        ctx.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
      }
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Quadrant Badge
      ctx.save();
      ctx.translate(bounds.center.x, bounds.center.y);
      ctx.fillStyle = isDeadlocked ? 'rgba(229, 72, 77, 0.8)' : 'rgba(14, 58, 82, 0.75)';
      ctx.beginPath();
      ctx.roundRect(-16, -10, 32, 20, 4);
      ctx.fill();

      ctx.fillStyle = isDeadlocked ? '#FFFFFF' : '#E3FDF9';
      ctx.font = '700 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(q.id, 0, 0);
      ctx.restore();

      ctx.restore();
    }
  }

  private drawExitSlots(ctx: CanvasRenderingContext2D): void {
    for (const es of this.sim.exitSlots) {
      if (es.occupiedBy === 'CHOKE_BLOCKAGE' || es.isBlockedByDownstream) {
        const coords = {
          EXIT_N_1: { x: 442, y: 240, w: 46, h: 36 },
          EXIT_E_1: { x: 720, y: 442, w: 36, h: 46 },
          EXIT_S_1: { x: 512, y: 720, w: 46, h: 36 },
          EXIT_W_1: { x: 240, y: 512, w: 36, h: 46 }
        }[es.id as 'EXIT_N_1' | 'EXIT_E_1' | 'EXIT_S_1' | 'EXIT_W_1'];

        if (coords) {
          ctx.save();
          ctx.fillStyle = 'rgba(229, 72, 77, 0.9)';
          ctx.fillRect(coords.x, coords.y, coords.w, coords.h);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(coords.x, coords.y, coords.w, coords.h);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '700 11px "IBM Plex Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('BLOCKED', coords.x + coords.w / 2, coords.y + coords.h / 2 + 4);
          ctx.restore();
        }
      }
    }
  }

  private drawTrafficSignals(ctx: CanvasRenderingContext2D): void {
    const signalState = this.sim.activeSignalState;
    if (!signalState) return;

    const signalPositions: Record<ArmId, { x: number; y: number; color: 'green' | 'yellow' | 'red'; orient: 'vert' | 'horiz' }> = {
      N: { x: 590, y: 385, color: signalState.nsColor, orient: 'vert' },
      E: { x: 605, y: 590, color: signalState.ewColor, orient: 'horiz' },
      S: { x: 410, y: 615, color: signalState.nsColor, orient: 'vert' },
      W: { x: 370, y: 410, color: signalState.ewColor, orient: 'horiz' }
    };

    for (const [_arm, sig] of Object.entries(signalPositions)) {
      ctx.save();
      ctx.translate(sig.x, sig.y);

      ctx.fillStyle = '#0B2433';
      ctx.strokeStyle = '#33555B';
      ctx.lineWidth = 2.5;
      const w = sig.orient === 'vert' ? 26 : 60;
      const h = sig.orient === 'vert' ? 60 : 26;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 6);
      ctx.fill();
      ctx.stroke();

      const colors: ('red' | 'yellow' | 'green')[] = ['red', 'yellow', 'green'];
      colors.forEach((col, idx) => {
        const isActive = sig.color === col;
        const lampX = sig.orient === 'vert' ? 0 : -20 + idx * 20;
        const lampY = sig.orient === 'vert' ? -20 + idx * 20 : 0;

        ctx.beginPath();
        ctx.arc(lampX, lampY, 7, 0, Math.PI * 2);

        if (isActive) {
          const hex = col === 'green' ? '#2FBF71' : col === 'yellow' ? '#F2C230' : '#E5484D';
          ctx.fillStyle = hex;
          ctx.shadowColor = hex;
          ctx.shadowBlur = 14;
        } else {
          ctx.fillStyle = 'rgba(15, 34, 41, 0.8)';
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      });

      ctx.restore();
    }
  }

  private drawRecoveryVisuals(ctx: CanvasRenderingContext2D): void {
    const recovery = this.sim.recoveryAction;
    if (!recovery.isRecovering) return;

    // Barrier Cones
    if (recovery.showCones) {
      const coneLocations = [
        { x: 535, y: 415 },
        { x: 585, y: 535 },
        { x: 465, y: 585 },
        { x: 415, y: 465 }
      ];

      for (const pos of coneLocations) {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.fillStyle = '#E8664A';
        ctx.shadowColor = '#E8664A';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(-9, 10);
        ctx.lineTo(9, 10);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-6, 0, 12, 4);
        ctx.restore();
      }
    }

    // Police Officer at center
    if (recovery.showPolice) {
      ctx.save();
      ctx.translate(CENTER.x, CENTER.y);
      ctx.shadowColor = '#2FBF71';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#2FBF71';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#081318';
      ctx.font = '700 14px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👮', 0, 1);
      ctx.restore();
    }

    // Detour guidance
    if (recovery.showDetourArrows) {
      ctx.save();
      ctx.strokeStyle = '#2FBF71';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(CENTER.x, CENTER.y, 90, 0, Math.PI * 1.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  private drawFlyover(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(77, 163, 255, 0.35)';
    ctx.strokeStyle = '#4DA3FF';
    ctx.lineWidth = 3.5;
    ctx.fillRect(490, 400, 50, 200);
    ctx.strokeRect(490, 400, 50, 200);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FLYOVER', 515, 500);
    ctx.restore();
  }

  private drawVehicles(ctx: CanvasRenderingContext2D, options: RenderOptions): void {
    const isDeadlocked = this.sim.activeCycle.length > 0;

    for (const v of this.sim.vehicles) {
      if (v.state === 'GONE') continue;

      ctx.save();
      ctx.translate(v.position.x, v.position.y);

      // Idle shiver on deadlock
      if (isDeadlocked && this.sim.activeCycle.includes(v.id)) {
        const shiverX = (Math.sin(this.animTimer * 50 + v.id.charCodeAt(0)) * 1.5);
        const shiverY = (Math.cos(this.animTimer * 50 + v.id.charCodeAt(0)) * 1.5);
        ctx.translate(shiverX, shiverY);
      }

      ctx.rotate(v.heading);

      // Vehicle body: 46 units long x 24 units wide (heroic visibility!)
      const w = 46;
      const h = 24;

      // Project Headlight Light Cones forward
      ctx.save();
      const lightGrad = ctx.createLinearGradient(w / 2, 0, w / 2 + 65, 0);
      lightGrad.addColorStop(0, 'rgba(255, 250, 220, 0.45)');
      lightGrad.addColorStop(1, 'rgba(255, 250, 220, 0)');
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(w / 2, -h / 2 + 2);
      ctx.lineTo(w / 2 + 65, -h / 2 - 18);
      ctx.lineTo(w / 2 + 65, h / 2 + 18);
      ctx.lineTo(w / 2, h / 2 - 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 2, -h / 2 + 2, w, h, 6);
      ctx.fill();

      // Main Vehicle Body
      ctx.fillStyle = v.color;
      ctx.strokeStyle = options.hoveredVehicleId === v.id ? '#FFFFFF' : '#0B1C24';
      ctx.lineWidth = options.hoveredVehicleId === v.id ? 3 : 2;

      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 6);
      ctx.fill();
      ctx.stroke();

      // Cyber Windshield
      ctx.fillStyle = '#081318';
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 8, -h / 2 + 4, w - 16, h - 8, 3);
      ctx.fill();

      // Vehicle Letter Badge (A, B, C, D)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 14px "Familjen Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(v.label, 0, 0);

      // Headlight LEDs
      ctx.fillStyle = '#FFF8DB';
      ctx.fillRect(w / 2 - 3, -h / 2 + 2, 4, 5);
      ctx.fillRect(w / 2 - 3, h / 2 - 7, 4, 5);

      // Rear Brake Lights (Glow bright red on brake/stop)
      if (v.brakeLights || v.speed < 1.0) {
        ctx.fillStyle = '#E5484D';
        ctx.shadowColor = '#E5484D';
        ctx.shadowBlur = 12;
        ctx.fillRect(-w / 2 - 2, -h / 2 + 2, 4, 5);
        ctx.fillRect(-w / 2 - 2, h / 2 - 7, 4, 5);
        ctx.shadowBlur = 0;
      }

      // Turn Indicators
      if (v.indicator !== 'none' && Math.sin(this.animTimer * 12) > 0) {
        ctx.fillStyle = '#F2C230';
        ctx.shadowColor = '#F2C230';
        ctx.shadowBlur = 10;
        const indY = v.indicator === 'left' ? -h / 2 - 1 : h / 2 - 3;
        ctx.fillRect(w / 2 - 4, indY, 5, 4);
        ctx.fillRect(-w / 2, indY, 5, 4);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    }
  }

  private drawWaitForArrows(ctx: CanvasRenderingContext2D): void {
    if (this.sim.waitForEdges.length === 0) return;

    for (const edge of this.sim.waitForEdges) {
      const fromVeh = this.sim.vehicles.find(v => v.id === edge.from);
      const toVeh = this.sim.vehicles.find(v => v.id === edge.to);

      if (!fromVeh || !toVeh) continue;

      ctx.save();
      const isCycleEdge = edge.isCycle;
      ctx.strokeStyle = isCycleEdge ? '#E5484D' : '#F59E4B';
      ctx.lineWidth = isCycleEdge ? 4 : 2;

      if (isCycleEdge) {
        ctx.shadowColor = '#E5484D';
        ctx.shadowBlur = 16;
      }

      const midX = (fromVeh.position.x + toVeh.position.x) / 2;
      const midY = (fromVeh.position.y + toVeh.position.y) / 2;

      const ctrlX = midX + (CENTER.x - midX) * 0.45;
      const ctrlY = midY + (CENTER.y - midY) * 0.45;

      ctx.beginPath();
      ctx.moveTo(fromVeh.position.x, fromVeh.position.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, toVeh.position.x, toVeh.position.y);
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(toVeh.position.y - ctrlY, toVeh.position.x - ctrlX);
      ctx.translate(toVeh.position.x, toVeh.position.y);
      ctx.rotate(angle);
      ctx.fillStyle = isCycleEdge ? '#E5484D' : '#F59E4B';
      ctx.beginPath();
      ctx.moveTo(-14, -8);
      ctx.lineTo(0, 0);
      ctx.lineTo(-14, 8);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  private drawDeadlockVignette(ctx: CanvasRenderingContext2D): void {
    const pulse = 0.28 + 0.12 * Math.sin(this.animTimer * 5);
    const grad = ctx.createRadialGradient(
      this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.35,
      this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.72
    );
    grad.addColorStop(0, 'rgba(229, 72, 77, 0)');
    grad.addColorStop(1, `rgba(229, 72, 77, ${pulse})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }
}
