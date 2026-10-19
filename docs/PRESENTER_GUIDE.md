# PRESENTER GUIDE — GRIDLOCK LAB
### Interactive Traffic Deadlock Simulation & Live Defense Guide
**Course**: Operating Systems (BACSE106) · Module 2: Deadlock Management · DA-2  
**Team**: Group 03 | Team 13 — B Priyadarshan (25BLC1180), U Sudharson (25BLC1053), E Sharukesh (25BLC1125)

---

## 1. Quick Launch & Projector Setup

1. **Start Local Server**:
   ```bash
   npm run dev
   ```
2. **Open in Browser**: Navigate to `http://localhost:5173`.
3. **Projector Optimization**:
   - Press <kbd>F</kbd> for Fullscreen.
   - Press <kbd>H</kbd> for **Presenter Mode** (hides chrome, expands stage & captions).
   - Press <kbd>Space</kbd> or click **"Start Demo"** on the Intro Screen.

---

## 2. 5–6 Minute Presentation Run-of-Show

| Time | Key | Scenario / Slide | Audience Sees | Verbal Script (Match the Deck) |
|---|---|---|---|---|
| **0:00–0:45** | <kbd>Space</kbd> | **Intro Screen** (Slide 1) | Title card, Group 03 / Team 13 roster, animated top-down traffic preview. | *"Good morning Professor. We are Group 03, Team 13 presenting our project: Analyzing and Resolving Physical Traffic Gridlocks at Urban Intersections as a direct model for Operating System Deadlock Management."* |
| **0:45–1:30** | <kbd>1</kbd> | **The Failure** (Slides 2–3) | Vehicles A, B, C, D arrive simultaneously in Left-Hand Traffic. Each claims entry quadrant and freezes. Curved red wait-for arrows appear: A → B → C → D → A. | *"Here is the fundamental failure mode. Four vehicles arrive simultaneously at a narrow intersection. Vehicle A holds quadrant NE and requests SE, held by B; B requests SW, held by C; C requests NW, held by D; and D requests NE, held by A. As stated in Slide 2: Gridlock begins when limited space creates permanent waiting."* |
| **1:30–2:15** | <kbd>2</kbd> | **Four Conditions Tour** (Slide 4) | Tab 3 updates live; each Coffman condition card lights up with live real-time analysis. Pulsing red chip: `DEADLOCK DETECTED`. | *"In Slide 4, we examine the four Coffman conditions: Mutual Exclusion (unit quadrant capacity), Hold and Wait (vehicles hold space while waiting), No Preemption (vehicles cannot be pushed aside), and Circular Wait (A → B → C → D → A). Notice that all four must hold simultaneously for this gridlock to exist."* |
| **2:15–3:00** | <kbd>3</kbd> | **Exit-Clear Rule** (Slide 5) | Same simultaneous arrival, but yellow box junction is active. Vehicles are held outside at the stop line. | *"Now we apply Deadlock Prevention from Slide 5: 'Do not enter unless the exit is clear'. By requiring full-path and exit clearance before crossing the stop line, the controller enforces all-or-nothing allocation outside the box, breaking Hold-and-Wait."* |
| **3:00–3:45** | <kbd>4</kbd> | **Green Light, Blocked Exit** (Slides 6 & 8) | Signal-controlled mode with a blocked South exit. Green light admits vehicles, causing box spillback and locking cross-traffic. | *"Slide 6 demonstrates that traffic signals alone do not prevent gridlocks. When the downstream exit is blocked, vehicles enter on green and become trapped. As Slide 8 notes: 'Traffic control helps reduce conflicts, but keeping the exit clear is important to prevent gridlock.' "* |
| **3:45–4:30** | <kbd>6</kbd> | **5-Step Recovery** (Slide 7) | Deadlock occurs → red banner → red signals and cones deploy → traffic officer selects victim vehicle → victim reverses out → normal flow resumes. | *"When prevention is absent, we demonstrate the 5-step Recovery machine from Slide 7: Detect persistent cycle, Stop incoming entries, Safe manual control with victim selection, Clear zones and reroute, and Restore normal coordination. In OS terms, this is detection and recovery after deadlock, not prevention before it occurs."* |
| **4:30–5:15** | <kbd>7</kbd> | **Proposed Controller** (Slide 9) | Continuous high-demand traffic flowing smoothly. Tab 2 debugger highlights pseudocode line-by-line (`safe`, `reserve`, `authorize`, `release`). | *"Slide 9 presents our Exit-Clear Reservation Controller. The controller atomically checks if safe(movement, exit_space) before reserving the entire route. Notice the debugger live-highlighting lines 1 through 4 during vehicle admission."* |
| **5:15–5:45** | <kbd>8</kbd> | **Head-to-Head Benchmark** (Slide 8) | 2×2 grid of four simultaneous systems with live metrics HUDs and final Canvas bar chart. | *"Finally, our live head-to-head comparison runs all four coordination mechanisms under identical high-demand traffic. The Proposed Controller achieves the highest sustained throughput with zero deadlocks."* |
| **5:45–6:00** | <kbd>0</kbd> | **Conclusion** (Slide 10) | Prevent · Avoid · Recover takeaway cards and academic citations. | *"In conclusion: Prevent by breaking hold-and-wait, Avoid by checking safe states, and Recover via targeted preemption. Thank you, and we welcome your questions."* |

---

## 3. Defense Q&A: Anticipated Professor Questions & Crisp Answers

### Q1: "Is this physical traffic model identical to OS deadlock?"
> **Crisp Answer**: *"No, Professor. As explicitly noted on our honesty slide, the traffic scene is an intuitive analogy for OS deadlock, not an identical physical implementation. In an OS, processes are preemptible threads and resources are non-spatial memory or locks; in traffic, vehicles have physical momentum and spatial constraints."*

### Q2: "Does your Proposed Controller implement Banker's Algorithm?"
> **Crisp Answer**: *"No. As stated in Slide 9, coordination is NOT a formal Banker's algorithm. Banker's algorithm requires knowing the maximum claim of all resources in advance and computing safe execution sequences for multi-unit resource vectors. Our controller performs atomic route reservation and safe-state verification at admission."*

### Q3: "Which specific Coffman condition does the yellow-box junction break?"
> **Crisp Answer**: *"The yellow-box rule breaks **Hold and Wait**. In standard driving, a car holds quadrant 1 inside the box while waiting for quadrant 2. The yellow-box rule forces the vehicle to wait outside the intersection until all required quadrants and the exit slot are guaranteed available—achieving all-or-nothing allocation."*

### Q4: "What does the traffic police intervention correspond to in OS theory?"
> **Crisp Answer**: *"Traffic police intervention corresponds to **Preemption and Victim Selection** in a Deadlock Detection and Recovery scheme. The controller selects the vehicle with the lowest progress cost (the victim process) and forces a rollback/reroute to break the cycle."*

---

## 4. 60-Second Fallback Plan

If you ever need to reset or recover instantly during the live demo:
1. Press <kbd>R</kbd> to reload the active scenario from a clean, seeded initial state.
2. Press <kbd>1</kbd> to immediately jump back to the core failure demonstration.
3. If the professor asks to test an arbitrary condition, flip any toggle in the **"Break a Condition" Lab** on the left rail.
