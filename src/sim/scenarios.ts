/**
 * GRIDLOCK LAB — Scripted Presentation Scenarios
 * Mapped to Slide Deck (BACSE106 Module 2: Deadlock Management)
 */

import { ControlMode } from './types';

export interface ScenarioDefinition {
  id: number;
  name: string;
  slideBadge: string;
  slideRef: string;
  subtitle: string;
  mode: ControlMode;
  yellowBox: boolean;
  downstreamBlockageArm: 'N' | 'E' | 'S' | 'W' | null;
  spawnType: 'simultaneous_four' | 'continuous' | 'recovery_demo' | 'none';
  initialNarration: string;
  detailedNotes: string;
}

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 1,
    name: 'The Failure',
    slideBadge: 'Slides 2–3',
    slideRef: 'Slide 2: Failure Mode & Slide 3: Traffic Gridlock as Deadlock',
    subtitle: 'Uncontrolled intersection: simultaneous 4-way arrival deadlock',
    mode: 'uncontrolled',
    yellowBox: false,
    downstreamBlockageArm: null,
    spawnType: 'simultaneous_four',
    initialNarration:
      'Vehicles A, B, C, and D arrive simultaneously at an uncontrolled narrow intersection. Each claims its entry quadrant and attempts to advance. A waits for B, B waits for C, C waits for D, and D waits for A — forming an irreducible circular wait.',
    detailedNotes:
      'Key observation: Gridlock begins when limited space creates permanent waiting. Notice how each vehicle holds its immediate quadrant (hold) while requesting the next (wait).'
  },
  {
    id: 2,
    name: 'Four Conditions Tour',
    slideBadge: 'Slide 4',
    slideRef: 'Slide 4: The Four Coffman Conditions',
    subtitle: 'Guided inspection: Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait',
    mode: 'uncontrolled',
    yellowBox: false,
    downstreamBlockageArm: null,
    spawnType: 'simultaneous_four',
    initialNarration:
      'Coffman Conditions Analysis: 1. Mutual Exclusion (quadrant capacity = 1); 2. Hold and Wait (car occupies Q1, demands Q2); 3. No Preemption (vehicles cannot be pushed aside); 4. Circular Wait (A → B → C → D → A). Deadlock requires all four simultaneously.',
    detailedNotes:
      'Notice the Coffman condition cards on the right panel lighting up as each condition is satisfied in the live state.'
  },
  {
    id: 3,
    name: 'Exit-Clear Rule',
    slideBadge: 'Slide 5',
    slideRef: 'Slide 5: Prevention Strategies (Yellow-Box Junction)',
    subtitle: 'Yellow-box rule: Do not enter unless the exit is clear',
    mode: 'proposed',
    yellowBox: true,
    downstreamBlockageArm: null,
    spawnType: 'simultaneous_four',
    initialNarration:
      'Prevention in action: “Do not enter unless the exit is clear”. The controller evaluates full-path clearance before authorizing entry. Vehicles wait outside the box, breaking Hold-and-Wait and completely eliminating deadlock.',
    detailedNotes:
      'By enforcing atomic all-or-nothing allocation before crossing the stop line, no vehicle ever holds space inside without guaranteed departure.'
  },
  {
    id: 4,
    name: 'Green Light, Blocked Exit',
    slideBadge: 'Slides 6 & 8',
    slideRef: 'Slide 6: Control Techniques & Slide 8: Intersection Comparison',
    subtitle: 'Signal control failure: downstream queue spills back across green phase',
    mode: 'signal',
    yellowBox: false,
    downstreamBlockageArm: 'S',
    spawnType: 'continuous',
    initialNarration:
      'Traffic signals separate time, but signals alone do not prevent gridlock. With a blocked South exit, vehicles enter on green, become trapped in the box, and block cross-traffic on the subsequent green phase.',
    detailedNotes:
      'Crucial takeaway from Slide 8: “Traffic control helps reduce conflicts, but keeping the exit clear is important to prevent gridlock.”'
  },
  {
    id: 5,
    name: 'Roundabout Flow & Saturation',
    slideBadge: 'Slides 6 & 8',
    slideRef: 'Slide 6: Roundabouts & Slide 8: Comparison',
    subtitle: 'Clockwise circulation: reduces crossing conflicts but vulnerable to ring saturation',
    mode: 'roundabout',
    yellowBox: false,
    downstreamBlockageArm: 'W',
    spawnType: 'continuous',
    initialNarration:
      'Roundabouts replace crossing points with yield-at-entry circular flow. While highly efficient under open exits, a blocked downstream exit backs into the circulation ring, causing full ring saturation.',
    detailedNotes:
      'Left-hand traffic circulating clockwise: downstream blockage spills back through adjacent arms, demonstrating resource dependency propagation.'
  },
  {
    id: 6,
    name: '5-Step Recovery',
    slideBadge: 'Slide 7',
    slideRef: 'Slide 7: Recovery from Gridlock',
    subtitle: 'Detect → Stop conflicting entry → Manual control → Clear zones & reroute → Restore',
    mode: 'uncontrolled',
    yellowBox: false,
    downstreamBlockageArm: null,
    spawnType: 'recovery_demo',
    initialNarration:
      'Recovery State Machine: 1. Detect persistent blockage; 2. Stop conflicting entry with red signals and cones; 3. Safe manual control with victim selection; 4. Clear zones and reroute; 5. Restore normal coordination.',
    detailedNotes:
      'In OS terms: this is detection and recovery after deadlock, not prevention before it occurs. The traffic police corresponds to preemption and the chosen car corresponds to the victim process selected for rollback.'
  },
  {
    id: 7,
    name: 'Proposed Controller',
    slideBadge: 'Slide 9',
    slideRef: 'Slide 9: Proposed Controller & Architecture',
    subtitle: 'Exit-Clear Reservation Controller with live debugger execution',
    mode: 'proposed',
    yellowBox: true,
    downstreamBlockageArm: null,
    spawnType: 'continuous',
    initialNarration:
      'The Proposed Controller evaluates: if safe(movement, exit_space) then reserve(); authorize(); release_on_exit() else queue(); if stuck: stop_entry(); clear(). Watch the live code debugger highlight each line.',
    detailedNotes:
      'Note honesty rule from deck: The traffic scene is an analogy for OS deadlock, not an identical physical implementation; coordination ≠ formal Banker’s algorithm.'
  },
  {
    id: 8,
    name: 'Head-to-Head Comparison',
    slideBadge: 'Slide 8',
    slideRef: 'Slide 8: System Comparison & Synthesis',
    subtitle: '2×2 synchronous comparison: Uncontrolled vs Signal vs Roundabout vs Proposed',
    mode: 'proposed',
    yellowBox: true,
    downstreamBlockageArm: null,
    spawnType: 'none',
    initialNarration:
      'Four systems running simultaneously on identical seeded arrival traffic. Compare throughput, average wait times, and total deadlocks encountered live.',
    detailedNotes:
      'Direct visual demonstration proving that the Proposed Controller delivers zero deadlocks while maintaining balanced flow.'
  }
];
