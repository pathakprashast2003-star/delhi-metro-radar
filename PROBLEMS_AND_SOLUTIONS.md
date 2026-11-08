# Delhi Metro Radar: Identified Problems & Creative, Safe Solutions

A definitive engineering record of real-world transit failure modes, visual rendering discrepancies, and their creative, safe solutions in the **Delhi Metro Radar** codebase.

---

## 1. Summary Matrix

| # | Problem Category | Symptom / Failure Mode | Root Cause | Creative & Safe Solution |
|:---:|:---|:---|:---|:---|
| **P1** | **Visual Disconnect** | Trains vanish into 0 pixels at city zoom (Image 2). | CSS/SVG circle marker radius fixed at 3.2px at Zoom 10. | **Dynamic LOD Directional Chevrons:** Scale-invariant 18px WebGL arrow markers rotating by track bearing. |
| **P2** | **"One Lonely Line"** | Map looks empty and awkward at global view (Image 2). | Only Yellow Line is drawn; Delhi NCR looks abandoned. | **Full DMRC Network Context:** Faint vector traces for Blue, Red, Violet, Pink, Magenta, Airport Express. |
| **P3** | **Station Box Bloat** | Green Park looks like a giant 60m black block with caution tape (Image 1). | Fixed excavation chamber polygon with high opacity and heavy dashed line. | **Architectural Glass Cutaway:** Subtle translucent slate fill (`0.25` opacity) revealing street grid beneath. |
| **P4** | **Smooth $\neq$ Accurate** | Promising "100% continuous tracking" without live OCC data. | Simulating positions with math formulas while implying live GPS. | **Transparent Designation:** Explicitly badge as `"SCHEDULED TIMETABLE · DMRC Operational Model"`. |
| **P5** | **The Easing Lie** | Trains continuously pull and stretch like rubber bands. | Simple sinusoidal / `cubic-bezier` easing without steady cruise. | **3-Phase Kinematic Curve:** Constant Max Accel $\to$ Constant Cruise (75 km/h) $\to$ Decel $\to$ Dwell. |
| **P6** | **Terminal "Bounce"** | Trains magically flip direction in 1 second at terminals. | Missing turnaround and driver cab change buffers. | **Staged Reversal Blocks:** 180s–240s dwell buffer at Samaypur Badli and Millennium City Centre. |
| **P7** | **Subterranean Drops** | Phone loses signal in -25m tube tunnels; trains freeze then teleport. | SSE stream disconnects and tries to catch up. | **Autonomous Dead Reckoning:** Browser local clock continues advancing train along 389 OSM nodes. |
| **P8** | **Mobile OS Sleep** | User locks phone; animation freezes or stutters on unlock. | iOS/Android throttle `requestAnimationFrame` to 0. | **Wall-Clock Epoch Math:** Train progress calculated directly from `Date.now()`, rendering instantly on unlock. |

---

## 2. In-Depth Problem & Solution Blueprints

### P1: The Vanishing Train Problem at City View
* **Symptom:** When a user zooms out to see Delhi NCR (Zoom 9–13), the trains completely disappear.
* **Root Cause:** In `src/js/main.js`, train circles are hardcoded to `circle-radius: 3.2px` at Zoom 10. On Retina screens (2x/3x pixel ratio), a 3.2px circle renders smaller than a single physical dot.
* **Creative & Safe Solution:**
  1. Add an SVG-based directional chevron icon (`train-chevron`) pointing along the train's heading angle.
  2. Implement MapLibre zoom-interpolated symbol layer:
     ```javascript
     'icon-size': [
       'interpolate', ['linear'], ['zoom'],
       9, 0.70,   // 22px at city zoom! Instantly visible across NCR!
       12, 0.85,  // 27px at regional corridor zoom
       14, 0.65,  // Transition as dual tracks separate
       16, 0.40   // Precision dot at track level
     ]
     ```
  3. Rotate icon by bearing (`icon-rotate: ['get', 'bearing']`) and align to map (`icon-rotation-alignment: 'map'`).

---

### P2: The "One Lonely Line" Awkwardness
* **Symptom:** Opening the app gives an empty, awkward impression because only a single yellow wire runs through an otherwise vacant map of Delhi.
* **Root Cause:** DMRC operates 10 lines with 250+ stations, but only the Yellow Line was loaded into the map canvas.
* **Creative & Safe Solution:**
  1. Load the authentic interconnecting geometries for **Blue Line (Line 3/4), Red Line (Line 1), Violet Line (Line 6), Magenta Line (Line 8), Pink Line (Line 7), Airport Express Line, and Rapid Metro Gurugram** from `dmrc_network_geojson.json`.
  2. Render as sleek, subtle background transit vectors (`line-opacity: 0.45`, `line-width: 2.5`) with their authentic DMRC brand colors.
  3. Add luminous junction rings at the 8 major interchange hubs (Rajiv Chowk, Kashmere Gate, Central Secretariat, Hauz Khas, Azadpur, INA, New Delhi, Sikanderpur).

---

### P3: Underground Station Chamber Bloat (Green Park)
* **Symptom:** At Zoom 18, underground tube stations (like Green Park in Image 1) look like solid 60-meter-wide black blocks dominating the streets.
* **Root Cause:** The `underground-chamber-casing` layer was styled with `'fill-color': '#1E293B', 'fill-opacity': 0.72` and a heavy tactile hazard border that obscured the underlying road network.
* **Creative & Safe Solution:**
  1. Reduce chamber fill opacity to a delicate architectural wash:
     ```javascript
     'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.12, 15, 0.22, 17, 0.35]
     ```
  2. Render platform slabs as crisp concrete ribbons flanked by subtle 1.5px yellow safety lines.
  3. Ensure elevated canopies (`platform-canopy-3d`) are strictly suppressed on underground stations.

---

### P4: Epistemic Honesty (Smooth $\neq$ Accurate)
* **Symptom:** Claiming "100% continuous live tracking" without an active OCC SCADA feed misleads users.
* **Root Cause:** Pure timetable math was branded as real-time tracking.
* **Creative & Safe Solution:**
  1. Label the system transparently in the hero HUD:
     `SCHEDULED TIMETABLE · DMRC Operational Baseline`
  2. Add an **Operational Status Ribbon**:
     `Normal Operations · All 16 Corridor Trains On Schedule · 3m 15s Headway`
  3. Provide an informational badge explaining that positions represent the official DMRC operational timetable.

---

### P5: The Realistic Kinematic Motion Curve
* **Symptom:** Trains pull and stretch like rubber bands between stations instead of moving like 300-ton steel vehicles.
* **Root Cause:** Using sinusoidal or simple cubic easing across the entire inter-station distance.
* **Creative & Safe Solution:**
  Replace sinusoidal easing with a segmented 3-phase kinematic profile:
  1. **Phase 1: Acceleration ($0 \le \tau < \tau_{\text{accel}}$):** Smooth quadratic acceleration ($a = 0.85\text{ m/s}^2$).
  2. **Phase 2: Cruising ($\tau_{\text{accel}} \le \tau < \tau_{\text{cruise}}$):** Constant velocity ($v = 75\text{ km/h}$).
  3. **Phase 3: Service Braking ($\tau_{\text{cruise}} \le \tau < 1.0$):** Smooth quadratic deceleration ($a = -0.95\text{ m/s}^2$) into platform stopping zone.
  4. **Station Dwell:** True stationary halt ($v = 0$) with calibrated door timers (50s at Rajiv Chowk/Kashmere Gate; 22s at local stops).

---

### P6: Terminal Turnaround Reversal Buffer
* **Symptom:** Trains hitting Badli or Millennium City immediately bounce backward in 1 second.
* **Root Cause:** Loop progression was a simple mod operator without terminal reversal staging.
* **Creative & Safe Solution:**
  Allocate dedicated 180s terminal buffers at both termini:
  - North Terminus: Samaypur Badli (Platform 2 Arrival $\to$ Crossover Pocket $\to$ Platform 1 Dispatch).
  - South Terminus: Millennium City Centre (Platform 1 Arrival $\to$ Crossover Pocket $\to$ Platform 2 Dispatch).
  During this buffer, the train status shows `CREW CHANGEOVER & TURNAROUND · DEPARTURE IN Xs`.

---

### P7: RailRadar-Style Station Ladder Drawer
* **Symptom:** Clicking a train only updates a small top badge with no station progression context.
* **Root Cause:** Lack of a dedicated route inspector drawer.
* **Creative & Safe Solution:**
  Add a slide-out Swiss-editorial drawer on train click:
  - Train ID & Running Track (`Track 1 Down ➔ Millennium City Centre`).
  - Real-time kinematic speed gauge (`72 km/h · Cruising`).
  - Vertical Station Ladder showing the next 6 stations with arrival countdowns, platform numbers, and interchange badges.

---

### P8: Subterranean Drops & Autonomous Dead Reckoning
* **Symptom:** Commuter's phone enters underground tube tunnel (-16m to -30m depth); 4G/5G connection drops. Trains freeze mid-tunnel and violently teleport across 5 stations when signal returns.
* **Root Cause:** App previously depended entirely on continuous server socket updates.
* **Creative & Safe Solution:**
  1. Store the pre-calculated 389-node track spline and scheduled timetable locally in the client runtime.
  2. If the SSE/network connection disconnects, the browser's local animation loop continues autonomously advancing trains along the track according to the timetable.
  3. When network reconnects, apply a gentle 2-second Kalman smoothing filter rather than an instant visual jump.

---

### P9: Mobile OS Sleep & Wall-Clock Epoch Math
* **Symptom:** Commuter locks phone or switches apps; returning 10 minutes later causes stuttering catch-up frames or frozen trains.
* **Root Cause:** Mobile browsers aggressively throttle `requestAnimationFrame` and `setInterval` to zero while in the background. Accumulating delta-time (`pos += speed * dt`) breaks down.
* **Creative & Safe Solution:**
  Compute train progress strictly as an absolute function of current wall-clock epoch time:
  $$\text{LoopProgress}(t) = \frac{(t_{\text{now}} - t_{\text{dispatch}}) \pmod{T_{\text{loop}}}}{T_{\text{loop}}}$$
  When the user unlocks their phone, reading `Date.now()` paints every train at its exact current physical coordinate instantaneously.

---

### P10: Crowdsourcing Traps (The Stationary Chai Stall Passenger)
* **Symptom:** A commuter sitting at a café outside Rajiv Chowk taps "In Metro", sending stationary GPS pings ($v = 0$) for 20 minutes, falsely triggering an emergency stop alert for everyone.
* **Root Cause:** Blindly trusting user telemetry without kinematic gating.
* **Creative & Safe Solution:**
  Implement a 3-tier Gating Filter before accepting any commuter telemetry:
  1. **Spatial Gate:** GPS coordinate must be within 15 meters of the physical rail centerline.
  2. **Velocity Gate:** Must register $v \ge 25\text{ km/h}$ between stations.
  3. **Heading Gate:** Movement vector must align with track tangent within $\pm 25^\circ$.


