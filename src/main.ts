/**
 * GRIDLOCK LAB — Main Application Controller
 * High-Design Clean Cinematic Architecture with Hero Canvas & Collapsible Drawer
 */

import { Simulation } from './sim/Simulation';
import { CanvasRenderer } from './render/CanvasRenderer';
import { RAGRenderer } from './render/RAGRenderer';
import { MetricsRenderer } from './render/MetricsRenderer';
import { ComparisonManager } from './render/ComparisonManager';
import { sound } from './audio/sound';
import { SCENARIOS, ScenarioDefinition } from './sim/scenarios';
import { ControlMode, QuadrantId } from './sim/types';

class App {
  private sim: Simulation;
  private stageRenderer: CanvasRenderer;
  private ragRenderer: RAGRenderer;
  private metricsRenderer: MetricsRenderer;
  private comparisonManager: ComparisonManager;

  private isRunning: boolean = false;
  private activeScenario: ScenarioDefinition = SCENARIOS[0];
  private isPresenterMode: boolean = false;
  private isComparisonMode: boolean = false;
  private isDrawerOpen: boolean = false;
  private lastTimestamp: number = 0;

  // Hover states for tooltips
  private hoveredVehicleId: string | null = null;
  private hoveredQuadrantId: QuadrantId | null = null;

  // Sound event trackers
  private prevCycleLength: number = 0;
  private prevRecoveryRestored: boolean = false;

  constructor() {
    this.sim = new Simulation({ seed: 42 });

    const stageCanvas = document.getElementById('stage-canvas') as HTMLCanvasElement;
    this.stageRenderer = new CanvasRenderer(stageCanvas, this.sim);

    const ragCanvas = document.getElementById('rag-canvas') as HTMLCanvasElement;
    this.ragRenderer = new RAGRenderer(ragCanvas, this.sim);

    const metricsCanvas = document.getElementById('metrics-canvas') as HTMLCanvasElement;
    this.metricsRenderer = new MetricsRenderer(metricsCanvas, this.sim);

    this.comparisonManager = new ComparisonManager(42);
    this.bindComparisonCanvases();

    this.buildScenarioCarousel();
    this.bindEventListeners();
    this.bindKeyboardShortcuts();

    // Default: load scenario 1
    this.loadScenario(1);

    // Initial drawer closed for maximum screen real estate
    this.setDrawerOpen(false);

    window.addEventListener('resize', () => this.handleResize());
    requestAnimationFrame((ts) => this.loop(ts));
  }

  private bindComparisonCanvases(): void {
    const modes: ControlMode[] = ['uncontrolled', 'signal', 'roundabout', 'proposed'];
    for (const mode of modes) {
      const canvas = document.getElementById(`canvas-comp-${mode}`) as HTMLCanvasElement;
      if (canvas) {
        this.comparisonManager.bindCanvas(mode, canvas);
      }
    }
  }

  private buildScenarioCarousel(): void {
    const container = document.getElementById('scenarios-carousel');
    if (!container) return;

    container.innerHTML = '';
    SCENARIOS.forEach((sc) => {
      const pill = document.createElement('button');
      pill.className = `sc-pill ${sc.id === 1 ? 'active' : ''}`;
      pill.id = `scenario-pill-${sc.id}`;
      pill.innerHTML = `
        <span class="pill-num">${sc.id}</span>
        <span>${sc.name}</span>
      `;
      pill.addEventListener('click', () => this.loadScenario(sc.id));
      container.appendChild(pill);
    });
  }

  public loadScenario(id: number): void {
    const sc = SCENARIOS.find((item) => item.id === id) || SCENARIOS[0];
    this.activeScenario = sc;

    // Dismiss intro modal if still open
    document.getElementById('intro-modal')?.classList.add('hidden');

    // Update active pill
    document.querySelectorAll('.sc-pill').forEach((p) => p.classList.remove('active'));
    document.getElementById(`scenario-pill-${sc.id}`)?.classList.add('active');

    // Reset simulation
    const currentSeed = parseInt((document.getElementById('input-seed') as HTMLInputElement).value) || 42;
    this.sim.reset(currentSeed);
    this.sim.setControlMode(sc.mode);

    // Apply scenario configs
    this.sim.config.coffmanOverrides.holdAndWaitBroken = sc.yellowBox;
    this.updateToggleState('exit-clear', sc.yellowBox);

    // Reset blockage
    const isBlocked = sc.downstreamBlockageArm !== null;
    this.sim.config.downstreamBlockage.S = isBlocked ? 1 : 0;
    this.sim.config.downstreamBlockage.W = sc.downstreamBlockageArm === 'W' ? 1 : 0;
    const btnBlockage = document.getElementById('btn-toggle-blockage');
    if (btnBlockage) {
      btnBlockage.classList.toggle('active', isBlocked);
      btnBlockage.textContent = isBlocked ? '🚧 South Exit: BLOCKED (B)' : '🚧 South Exit: Clear (B)';
    }

    // Reset other toggles
    this.sim.config.coffmanOverrides.mutualExclusionBroken = false;
    this.updateToggleState('flyover', false);
    this.sim.config.coffmanOverrides.noPreemptionBroken = false;
    this.updateToggleState('police', false);
    this.sim.config.coffmanOverrides.circularWaitBroken = false;
    this.updateToggleState('ordered', false);

    // Check Scenario 8 comparison mode
    if (sc.id === 8) {
      this.isComparisonMode = true;
      document.getElementById('comp-grid')?.classList.add('active');
      document.getElementById('stage-canvas')?.style.setProperty('display', 'none');
      document.getElementById('rag-island')?.style.setProperty('display', 'none');
      document.getElementById('coffman-island')?.style.setProperty('display', 'none');
      document.getElementById('recovery-stepper')?.style.setProperty('display', 'none');

      this.comparisonManager.reset(currentSeed, 60, sc.downstreamBlockageArm ? 1 : 0);
      const resizeAndRender = () => {
        for (const [mode, r] of Object.entries(this.comparisonManager.renderers) as [ControlMode, CanvasRenderer | null][]) {
          if (r) {
            r.resize();
            r.render(0, {
              showQuadrantLabels: true,
              showYellowBoxMesh: mode === 'proposed',
              hoveredVehicleId: null,
              hoveredQuadrantId: null
            });
          }
        }
      };
      requestAnimationFrame(resizeAndRender);
      setTimeout(resizeAndRender, 60);
    } else {
      this.isComparisonMode = false;
      document.getElementById('comp-grid')?.classList.remove('active');
      document.getElementById('stage-canvas')?.style.setProperty('display', 'block');
      document.getElementById('rag-island')?.style.removeProperty('display');
      document.getElementById('coffman-island')?.style.removeProperty('display');
      document.getElementById('recovery-stepper')?.style.removeProperty('display');
      setTimeout(() => this.stageRenderer.resize(), 50);
    }

    // Configure autoRecovery and demandLevel
    this.sim.autoRecovery = sc.spawnType === 'recovery_demo';
    this.sim.config.demandLevel = (sc.spawnType === 'simultaneous_four') ? 'low' : 'med';

    // Spawn vehicles
    if (sc.spawnType === 'simultaneous_four' || sc.spawnType === 'recovery_demo') {
      this.sim.spawnSimultaneousFour();
    }

    // Update Narration
    this.updateNarration(sc.initialNarration, sc.slideBadge);
    this.setPlaying(true);
  }

  private setPlaying(play: boolean): void {
    this.isRunning = play;
    const icon = document.getElementById('play-pause-icon');
    if (icon) {
      icon.textContent = this.isRunning ? '⏸' : '▶';
    }
  }

  private stepSingleFrame(): void {
    this.setPlaying(false);
    const dt = 0.05;
    if (this.isComparisonMode) {
      this.comparisonManager.step(dt);
    } else {
      this.sim.step(dt);
    }
    this.updateUI();
  }

  private setDrawerOpen(open: boolean): void {
    this.isDrawerOpen = open;
    const drawer = document.getElementById('inspector-drawer');
    const toggleBtn = document.getElementById('btn-inspector-toggle');
    if (drawer) {
      drawer.classList.toggle('closed', !this.isDrawerOpen);
    }
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', this.isDrawerOpen);
    }
    setTimeout(() => this.handleResize(), 250);
  }

  private loop(timestamp: number): void {
    if (!this.lastTimestamp) this.lastTimestamp = timestamp;
    const rawDt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    if (this.isRunning) {
      if (this.isComparisonMode) {
        const finished = this.comparisonManager.step(rawDt);
        this.updateComparisonHUDs();
        if (finished) {
          this.showComparisonResults();
          this.setPlaying(false);
        }
      } else {
        this.sim.step(rawDt);
      }
    }

    // Render Canvas Stage
    if (!this.isComparisonMode) {
      this.stageRenderer.render(rawDt, {
        showQuadrantLabels: true,
        showYellowBoxMesh: this.sim.activeMode === 'proposed' || this.sim.config.coffmanOverrides.holdAndWaitBroken,
        hoveredVehicleId: this.hoveredVehicleId,
        hoveredQuadrantId: this.hoveredQuadrantId
      });
    } else if (!this.isRunning) {
      // Keep paused comparison view crisp and visible
      for (const [mode, r] of Object.entries(this.comparisonManager.renderers) as [ControlMode, CanvasRenderer | null][]) {
        if (r) {
          r.render(0, {
            showQuadrantLabels: true,
            showYellowBoxMesh: mode === 'proposed',
            hoveredVehicleId: null,
            hoveredQuadrantId: null
          });
        }
      }
    }

    // Render side-drawers if open
    if (this.isDrawerOpen) {
      this.ragRenderer.render(rawDt);
      this.metricsRenderer.render();
    }

    // Sound triggers
    if (this.sim.activeCycle.length > 0 && this.prevCycleLength === 0) {
      sound.playDeadlockTone();
    }
    this.prevCycleLength = this.sim.activeCycle.length;

    if (this.sim.recoveryEngine.getStepIndex() === 5 && !this.prevRecoveryRestored) {
      sound.playRecoveryChime();
    }
    this.prevRecoveryRestored = this.sim.recoveryEngine.getStepIndex() === 5;

    this.updateUI();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  private updateUI(): void {
    // 1. Sim Time Display
    const minutes = Math.floor(this.sim.simTime / 60);
    const seconds = (this.sim.simTime % 60).toFixed(1);
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(4, '0')}`;
    const timeEl = document.getElementById('sim-time-display');
    if (timeEl) timeEl.textContent = timeStr;

    // 2. Cycle Banner Pill in Top-Left Island
    const cycleDot = document.getElementById('rag-status-dot');
    const cycleStateText = document.getElementById('cycle-state-text');
    const cyclePill = document.getElementById('cycle-pill-banner');

    if (this.sim.activeCycle.length > 0) {
      const labels = this.sim.activeCycle
        .map((id) => this.sim.vehicles.find((v) => v.id === id)?.label || id)
        .join(' → ');
      const cycleString = `${labels} → ${this.sim.vehicles.find((v) => v.id === this.sim.activeCycle[0])?.label || ''}`;

      if (cycleDot) cycleDot.className = 'status-indicator danger';
      if (cycleStateText) cycleStateText.textContent = `DEADLOCK CYCLE: ${cycleString}`;
      if (cyclePill) cyclePill.className = 'cycle-pill active-cycle';
    } else {
      if (cycleDot) cycleDot.className = 'status-indicator';
      if (cycleStateText) cycleStateText.textContent = 'NO CYCLE · FLOW STABLE';
      if (cyclePill) cyclePill.className = 'cycle-pill';
    }

    // 3. Coffman Status Badge in Top-Right Island
    const evalResult = this.sim.coffmanEvaluation;
    const badge = document.getElementById('coffman-status-badge');
    if (badge) {
      badge.textContent = evalResult.statusText;
      badge.className = `coffman-badge ${evalResult.allFourHold ? 'danger' : 'ok'}`;
    }

    // 4. Recovery Progress Banner (Slide 7)
    const recoveryStep = this.sim.recoveryEngine.getStepIndex();
    const recoveryToast = document.getElementById('recovery-stepper');
    if (recoveryToast) {
      recoveryToast.classList.toggle('active', this.sim.recoveryAction.isRecovering);
    }

    const stepElements = ['step-detect', 'step-stop', 'step-control', 'step-clear', 'step-restore'];
    stepElements.forEach((stepId, idx) => {
      const el = document.getElementById(stepId);
      if (!el) return;
      el.classList.remove('active', 'done');
      if (idx + 1 === recoveryStep) el.classList.add('active');
      else if (idx + 1 < recoveryStep) el.classList.add('done');
    });

    if (this.sim.recoveryAction.isRecovering && this.sim.recoveryAction.caption) {
      this.updateNarration(this.sim.recoveryAction.caption, 'Slide 7: Recovery Sequence');
    }

    // 5. Drawer Tab 2 (Code Debugger)
    if (this.sim.debuggerState) {
      const activeLine = this.sim.debuggerState.currentStepIndex;
      for (let i = 1; i <= 9; i++) {
        const lineEl = document.getElementById(`code-line-${i}`);
        if (lineEl) {
          lineEl.classList.toggle('active', i === activeLine);
        }
      }
      const evalTag = document.getElementById('evaluating-tag');
      if (evalTag) {
        evalTag.textContent = this.sim.debuggerState.explanation;
      }
    }

    // 6. Drawer Tab 3 (Coffman Cards)
    const indMutual = document.getElementById('ind-mutual');
    const indHold = document.getElementById('ind-hold');
    const indPreempt = document.getElementById('ind-preempt');
    const indCircular = document.getElementById('ind-circular');

    if (indMutual) {
      indMutual.textContent = evalResult.conditions.mutualExclusion ? 'HOLDING' : 'BROKEN';
      indMutual.className = `tag-status ${evalResult.conditions.mutualExclusion ? 'holding' : 'broken'}`;
      document.getElementById('text-mutual')!.textContent = evalResult.explanations.mutualExclusion;
    }
    if (indHold) {
      indHold.textContent = evalResult.conditions.holdAndWait ? 'HOLDING' : 'BROKEN';
      indHold.className = `tag-status ${evalResult.conditions.holdAndWait ? 'holding' : 'broken'}`;
      document.getElementById('text-hold')!.textContent = evalResult.explanations.holdAndWait;
    }
    if (indPreempt) {
      indPreempt.textContent = evalResult.conditions.noPreemption ? 'HOLDING' : 'BROKEN';
      indPreempt.className = `tag-status ${evalResult.conditions.noPreemption ? 'holding' : 'broken'}`;
      document.getElementById('text-preempt')!.textContent = evalResult.explanations.noPreemption;
    }
    if (indCircular) {
      indCircular.textContent = evalResult.conditions.circularWait ? 'HOLDING' : 'BROKEN';
      indCircular.className = `tag-status ${evalResult.conditions.circularWait ? 'holding' : 'broken'}`;
      document.getElementById('text-circular')!.textContent = evalResult.explanations.circularWait;
    }

    // 7. Drawer Tab 4 (Metrics)
    document.getElementById('val-throughput')!.textContent = this.sim.metrics.throughput.toFixed(1);
    document.getElementById('val-completed')!.textContent = this.sim.metrics.totalCompleted.toString();
    document.getElementById('val-avg-wait')!.textContent = `${this.sim.metrics.averageWaitTime.toFixed(1)}s`;
    document.getElementById('val-max-wait')!.textContent = `${this.sim.metrics.maxWaitTime.toFixed(1)}s`;
    document.getElementById('val-deadlocks')!.textContent = this.sim.metrics.deadlockCount.toString();
    document.getElementById('val-in-box')!.textContent = this.sim.metrics.currentInBoxCount.toString();
  }

  private updateToggleState(id: 'flyover' | 'exit-clear' | 'police' | 'ordered', active: boolean): void {
    const btn = document.getElementById(`btn-toggle-${id}`);
    const st = document.getElementById(`st-${id}`);
    if (btn && st) {
      btn.classList.toggle('active', active);
      st.textContent = active ? 'ON' : 'OFF';
    }
  }

  private updateComparisonHUDs(): void {
    const modes: ControlMode[] = ['uncontrolled', 'signal', 'roundabout', 'proposed'];
    for (const mode of modes) {
      const s = this.comparisonManager.simulations[mode];
      const el = document.getElementById(`hud-${mode}`);
      if (el) {
        el.textContent = `Deadlocks: ${s.metrics.deadlockCount} | Passed: ${s.metrics.totalCompleted} | Avg Wait: ${s.metrics.averageWaitTime.toFixed(1)}s`;
      }
    }
  }

  private showComparisonResults(): void {
    const modal = document.getElementById('comp-results-modal');
    const chartCanvas = document.getElementById('comp-chart-canvas') as HTMLCanvasElement;
    if (modal && chartCanvas) {
      this.comparisonManager.renderResultsChart(chartCanvas);
      modal.classList.remove('hidden');
    }
  }

  private updateNarration(text: string, slideTag?: string): void {
    const textEl = document.getElementById('caption-text');
    const tagEl = document.getElementById('caption-slide-tag');
    if (textEl) textEl.textContent = text;
    if (tagEl && slideTag) tagEl.textContent = slideTag.toUpperCase();
  }

  private bindEventListeners(): void {
    // Intro start button
    document.getElementById('btn-start-demo')?.addEventListener('click', () => {
      document.getElementById('intro-modal')?.classList.add('hidden');
      sound.setEnabled(true);
      (document.getElementById('btn-sound') as HTMLElement).classList.add('active');
      document.getElementById('sound-icon')!.textContent = '🔊';
      this.setPlaying(true);
    });

    // Sound toggle
    document.getElementById('btn-sound')?.addEventListener('click', () => {
      const nextState = !sound.isEnabled();
      sound.setEnabled(nextState);
      const btn = document.getElementById('btn-sound');
      const icon = document.getElementById('sound-icon');
      if (btn && icon) {
        btn.classList.toggle('active', nextState);
        icon.textContent = nextState ? '🔊' : '🔇';
      }
    });

    // Inspector Drawer Toggle
    document.getElementById('btn-inspector-toggle')?.addEventListener('click', () => {
      this.setDrawerOpen(!this.isDrawerOpen);
    });
    document.getElementById('btn-close-drawer')?.addEventListener('click', () => {
      this.setDrawerOpen(false);
    });

    // Presenter mode toggle
    document.getElementById('btn-presenter')?.addEventListener('click', () => {
      this.togglePresenterMode();
    });

    // Fullscreen toggle
    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Conclusion modal
    document.getElementById('btn-conclusion-top')?.addEventListener('click', () => {
      document.getElementById('conclusion-modal')?.classList.remove('hidden');
    });
    document.getElementById('btn-close-conclusion')?.addEventListener('click', () => {
      document.getElementById('conclusion-modal')?.classList.add('hidden');
    });

    // Comparison results modal
    document.getElementById('btn-close-comp-results')?.addEventListener('click', () => {
      document.getElementById('comp-results-modal')?.classList.add('hidden');
    });
    document.getElementById('btn-download-comp-png')?.addEventListener('click', () => {
      const canvas = document.getElementById('comp-chart-canvas') as HTMLCanvasElement;
      if (canvas) {
        const link = document.createElement('a');
        link.download = `gridlock-lab-comparison-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    });

    // Transport buttons in bottom dock
    document.getElementById('btn-play-pause')?.addEventListener('click', () => {
      this.setPlaying(!this.isRunning);
    });
    document.getElementById('btn-step')?.addEventListener('click', () => {
      this.stepSingleFrame();
    });
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      this.loadScenario(this.activeScenario.id);
    });

    // Speed selector
    document.querySelectorAll('.speed-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const speed = parseFloat(target.dataset.speed || '1.0');
        this.sim.config.simSpeedMultiplier = speed;
        this.comparisonManager.simSpeed = speed;
      });
    });

    // Random seed button
    document.getElementById('btn-random-seed')?.addEventListener('click', () => {
      const newSeed = Math.floor(Math.random() * 10000);
      (document.getElementById('input-seed') as HTMLInputElement).value = newSeed.toString();
      this.loadScenario(this.activeScenario.id);
    });

    // Spawn 4 simultaneous button
    document.getElementById('btn-spawn-four')?.addEventListener('click', () => {
      this.sim.spawnSimultaneousFour();
      this.updateNarration(
        'Simultaneous 4-vehicle arrival dispatched: A, B, C, D entering intersection arms.',
        'Manual Injection'
      );
    });

    // Break a condition toggles
    document.getElementById('btn-toggle-flyover')?.addEventListener('click', () => {
      const next = !this.sim.config.coffmanOverrides.mutualExclusionBroken;
      this.sim.config.coffmanOverrides.mutualExclusionBroken = next;
      this.updateToggleState('flyover', next);
    });

    document.getElementById('btn-toggle-exit-clear')?.addEventListener('click', () => {
      const next = !this.sim.config.coffmanOverrides.holdAndWaitBroken;
      this.sim.config.coffmanOverrides.holdAndWaitBroken = next;
      this.updateToggleState('exit-clear', next);
    });

    document.getElementById('btn-toggle-police')?.addEventListener('click', () => {
      const next = !this.sim.config.coffmanOverrides.noPreemptionBroken;
      this.sim.config.coffmanOverrides.noPreemptionBroken = next;
      this.updateToggleState('police', next);
    });

    document.getElementById('btn-toggle-ordered')?.addEventListener('click', () => {
      const next = !this.sim.config.coffmanOverrides.circularWaitBroken;
      this.sim.config.coffmanOverrides.circularWaitBroken = next;
      this.updateToggleState('ordered', next);
    });

    // Downstream South blockage button
    document.getElementById('btn-toggle-blockage')?.addEventListener('click', () => {
      const cur = this.sim.config.downstreamBlockage.S;
      const next = cur > 0.5 ? 0 : 1;
      this.sim.config.downstreamBlockage.S = next;
      const btn = document.getElementById('btn-toggle-blockage');
      if (btn) {
        btn.classList.toggle('active', next > 0.5);
        btn.textContent = next > 0.5 ? '🚧 South Exit: BLOCKED (B)' : '🚧 South Exit: Clear (B)';
      }
      this.updateNarration(
        next > 0.5 ? 'South downstream exit blocked! Box spillback imminent.' : 'South exit cleared. Downstream flow open.',
        'Blockage'
      );
    });

    // Inject stall button
    document.getElementById('btn-inject-stall')?.addEventListener('click', () => {
      const inBox = this.sim.vehicles.find((v) => v.state === 'IN_BOX');
      if (inBox) {
        inBox.speed = 0;
        inBox.stalledDuration = 10;
        inBox.isStalled = true;
        this.updateNarration(
          `Vehicle ${inBox.label} stalled inside box. Emergency response triggered.`,
          'Fault Injected'
        );
      } else {
        this.sim.config.downstreamBlockage.S = 1;
        this.updateNarration('Downstream South exit blocked (100%). Spillback imminent.', 'Fault Injected');
      }
    });

    // Drawer Tabs switching
    document.querySelectorAll('.drawer-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.drawer-tab').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach((c) => c.classList.remove('active'));

        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const tabId = target.dataset.tab;
        if (tabId) {
          document.getElementById(tabId)?.classList.add('active');
        }
      });
    });

    // RAG / Wait-for graph toggle button
    document.getElementById('btn-toggle-rag-mode')?.addEventListener('click', (e) => {
      const current = this.ragRenderer.getGraphMode();
      const next = current === 'rag' ? 'wait_for' : 'rag';
      this.ragRenderer.setGraphMode(next);
      (e.currentTarget as HTMLElement).textContent =
        next === 'rag' ? 'Switch to Wait-For' : 'Switch to RAG Graph';
    });

    // Stage canvas mouse interactions
    const stageCanvas = document.getElementById('stage-canvas') as HTMLCanvasElement;
    stageCanvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
    stageCanvas.addEventListener('mouseleave', () => {
      this.hoveredVehicleId = null;
      this.hoveredQuadrantId = null;
      this.hideTooltip();
    });
    stageCanvas.addEventListener('click', (e) => this.handleCanvasClick(e));
  }

  private handleCanvasMouseMove(e: MouseEvent): void {
    const stageCanvas = document.getElementById('stage-canvas') as HTMLCanvasElement;
    const rect = stageCanvas.getBoundingClientRect();
    const minDim = Math.min(rect.width, rect.height);
    const scale = (minDim * 0.94) / 1000;
    const offsetX = (rect.width - 1000 * scale) / 2;
    const offsetY = (rect.height - 1000 * scale) / 2;

    const worldX = (e.clientX - rect.left - offsetX) / scale;
    const worldY = (e.clientY - rect.top - offsetY) / scale;

    let foundVeh = false;
    for (const v of this.sim.vehicles) {
      if (v.state === 'GONE') continue;
      const dist = Math.hypot(v.position.x - worldX, v.position.y - worldY);
      if (dist < 26) {
        this.hoveredVehicleId = v.id;
        foundVeh = true;
        this.showTooltip(
          e.clientX,
          e.clientY,
          `Vehicle ${v.id} (${v.originArm} → ${v.targetArm})\nState: ${v.state}\nHolds: ${v.heldQuadrant || 'none'}\nRequests: ${v.requestedQuadrant || v.requestedExitSlot || 'none'}\nWait: ${v.waitTime.toFixed(1)}s`
        );
        break;
      }
    }

    if (!foundVeh) {
      this.hoveredVehicleId = null;
      if (worldX >= 430 && worldX <= 570 && worldY >= 430 && worldY <= 570) {
        const qId: QuadrantId =
          worldX < 500 ? (worldY < 500 ? 'NW' : 'SW') : worldY < 500 ? 'NE' : 'SE';
        this.hoveredQuadrantId = qId;
        const q = this.sim.quadrants.find((item) => item.id === qId);
        this.showTooltip(
          e.clientX,
          e.clientY,
          `Quadrant ${qId}\nStatus: ${q?.occupiedBy ? `Occupied by ${q.occupiedBy}` : q?.reservedBy ? `Reserved by ${q.reservedBy}` : 'Free'}`
        );
      } else {
        this.hoveredQuadrantId = null;
        this.hideTooltip();
      }
    }
  }

  private handleCanvasClick(e: MouseEvent): void {
    const stageCanvas = document.getElementById('stage-canvas') as HTMLCanvasElement;
    const rect = stageCanvas.getBoundingClientRect();
    const minDim = Math.min(rect.width, rect.height);
    const scale = (minDim * 0.94) / 1000;
    const offsetX = (rect.width - 1000 * scale) / 2;
    const offsetY = (rect.height - 1000 * scale) / 2;

    const worldX = (e.clientX - rect.left - offsetX) / scale;
    const worldY = (e.clientY - rect.top - offsetY) / scale;

    // Spawn on arm click
    if (worldY < 430 && worldX >= 430 && worldX <= 570) {
      this.sim.spawnVehicle('N', 'straight');
    } else if (worldX > 570 && worldY >= 430 && worldY <= 570) {
      this.sim.spawnVehicle('E', 'straight');
    } else if (worldY > 570 && worldX >= 430 && worldX <= 570) {
      this.sim.spawnVehicle('S', 'straight');
    } else if (worldX < 430 && worldY >= 430 && worldY <= 570) {
      this.sim.spawnVehicle('W', 'straight');
    }
  }

  private showTooltip(x: number, y: number, text: string): void {
    const tip = document.getElementById('hover-tooltip');
    if (tip) {
      tip.style.display = 'block';
      tip.style.left = `${x + 15}px`;
      tip.style.top = `${y + 15}px`;
      tip.innerText = text;
    }
  }

  private hideTooltip(): void {
    const tip = document.getElementById('hover-tooltip');
    if (tip) tip.style.display = 'none';
  }

  private togglePresenterMode(): void {
    this.isPresenterMode = !this.isPresenterMode;
    document.body.classList.toggle('presenter-mode', this.isPresenterMode);
    document.getElementById('btn-presenter')?.classList.toggle('active', this.isPresenterMode);
    setTimeout(() => this.handleResize(), 50);
  }

  private bindKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      const introModal = document.getElementById('intro-modal');
      if (introModal && !introModal.classList.contains('hidden')) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          introModal.classList.add('hidden');
          sound.setEnabled(true);
          (document.getElementById('btn-sound') as HTMLElement).classList.add('active');
          document.getElementById('sound-icon')!.textContent = '🔊';
          this.setPlaying(true);
          return;
        }
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.setPlaying(!this.isRunning);
          break;

        case 'ArrowRight':
          e.preventDefault();
          this.stepSingleFrame();
          break;

        case 'r':
        case 'R':
          this.loadScenario(this.activeScenario.id);
          break;

        case 'i':
        case 'I':
          this.setDrawerOpen(!this.isDrawerOpen);
          break;

        case 'h':
        case 'H':
          this.togglePresenterMode();
          break;

        case 'f':
        case 'F':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;

        case 'd':
        case 'D':
          this.sim.spawnSimultaneousFour();
          break;

        case 'b':
        case 'B':
          const currentB = this.sim.config.downstreamBlockage.S;
          const nextB = currentB > 0.5 ? 0 : 1;
          this.sim.config.downstreamBlockage.S = nextB;
          const btnB = document.getElementById('btn-toggle-blockage');
          if (btnB) {
            btnB.classList.toggle('active', nextB > 0.5);
            btnB.textContent = nextB > 0.5 ? '🚧 South Exit: BLOCKED (B)' : '🚧 South Exit: Clear (B)';
          }
          break;

        case 'y':
        case 'Y':
          const currentY = this.sim.config.coffmanOverrides.holdAndWaitBroken;
          this.sim.config.coffmanOverrides.holdAndWaitBroken = !currentY;
          this.updateToggleState('exit-clear', !currentY);
          break;

        case '0':
          document.getElementById('conclusion-modal')?.classList.toggle('hidden');
          break;

        case '1': case '2': case '3': case '4':
        case '5': case '6': case '7': case '8':
          this.loadScenario(parseInt(e.key));
          break;
      }
    });
  }

  private handleResize(): void {
    if (this.isComparisonMode) {
      for (const r of Object.values(this.comparisonManager.renderers)) {
        if (r) r.resize();
      }
    } else {
      this.stageRenderer.resize();
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});
