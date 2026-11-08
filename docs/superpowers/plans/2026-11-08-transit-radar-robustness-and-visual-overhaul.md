# Transit Radar Robustness & Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Delhi Metro Radar into a visually stunning, architecturally grounded, and epistemically honest transit visualizer featuring dynamic LOD directional chevrons, full DMRC background network corridors, calibrated 3-phase kinematics, refined underground station chambers, and a RailRadar-style Station Ladder drawer.

**Architecture:** A static-first WebGL architecture running MapLibre GL JS with custom SVG directional symbols, dynamic zoom-interpolated symbol layers, vector background network layers, and a deterministic wall-clock kinematic integration loop. Decoupled from private backend scrapers for 100% stability.

**Tech Stack:** JavaScript (ES6+), MapLibre GL JS, HTML5, CSS3 Glassmorphism, Node.js (for local dev server).

**Spec Document:** `PROBLEMS_AND_SOLUTIONS.md`

---

## Global Constraints

- **Preserve Spatial Accuracy:** Never alter the 389 physical track nodes from OSM Relation 447210.
- **Epistemic Honesty:** Always label the operational status as `"SCHEDULED TIMETABLE · DMRC Operational Baseline"`. Never fake live GPS claims.
- **Zero Heavy DOM Markers:** All moving train markers must execute on the MapLibre WebGL canvas at 60 FPS without creating HTML DOM nodes.
- **Zero Third-Party Scraping:** Do not ping or rely on `backend.delhimetrorail.com` or contractor staging servers.

---

## Tasks

### Task 1: Dynamic LOD Directional Chevrons (Z9–Z13)
**Files to Modify:** `src/js/main.js`
- [ ] Create an SVG directional chevron icon (`train-chevron`) with a luminous yellow blade, dark slate border, and white center pip.
- [ ] Create a stopped train hazard icon (`train-stopped`) with a red pulsing core.
- [ ] Register both icons with `map.addImage()`.
- [ ] Add the `train-radar-chevrons` symbol layer to MapLibre, configured with:
  - `icon-image`: `['case', ['==', ['get', 'speedKph'], 0], 'train-stopped', 'train-chevron']`
  - `icon-rotate`: `['get', 'bearing']`
  - `icon-rotation-alignment`: `'map'`
  - `icon-size`: interpolated from 0.70 at Zoom 9 to 0.40 at Zoom 16.
- [ ] Verify that at Zoom 10 (city view), all 16 trains are bright, sharp, and clearly visible with heading arrows.

---

### Task 2: Background DMRC Interconnected Network Corridors
**Files to Modify:** `src/js/main.js`, `index.html`
- [ ] Load `dmrc_network_geojson.json` via `/api/network` or local fetch.
- [ ] Add the `dmrc-network-lines` GeoJSON source to MapLibre.
- [ ] Add the `dmrc-network-casing` and `dmrc-network-glow` layers with authentic line colors:
  - Blue Line (`#0055A5`)
  - Red Line (`#E21E26`)
  - Violet Line (`#7C3AED`)
  - Magenta Line (`#C026D3`)
  - Pink Line (`#DB2777`)
  - Airport Express (`#EA580C`)
  - Rapid Metro Gurugram (`#059669`)
- [ ] Set `line-opacity: 0.45` and `line-width: 2.5` so the Yellow Line remains the primary focus while the other lines provide rich metropolitan context.
- [ ] Add interchange node rings at the 8 major intersection points (Rajiv Chowk, Kashmere Gate, Central Secretariat, Hauz Khas, Azadpur, INA, New Delhi, Sikanderpur).

---

### Task 3: Refine Underground Station Chambers (Fix Green Park Box)
**Files to Modify:** `src/js/main.js`
- [ ] In `renderTrackInfrastructure()`, update `underground-chamber-casing`:
  - Change fill opacity from heavy `0.72` to a delicate architectural wash:
    `'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.10, 15, 0.20, 17, 0.32]`
- [ ] In `platform-tactile-strips`, reduce line-width to a crisp 1.5px–3px safety edge, preventing the heavy yellow caution tape look.
- [ ] Verify that elevated canopies (`platform-canopy-3d`) are completely disabled on subterranean stations.

---

### Task 4: Calibrated 3-Phase Kinematic Curve
**Files to Modify:** `src/js/main.js`, `server.js`
- [ ] In the kinematic calculation loop, replace simple sinusoidal easing with a 3-phase drive cycle:
  - Phase 1: Acceleration ($a = 0.85\text{ m/s}^2$ for ~18s).
  - Phase 2: Constant cruising at line speed (70–80 km/h).
  - Phase 3: Service deceleration ($a = -0.95\text{ m/s}^2$ for ~22s).
  - Phase 4: Calibrated station dwell (45–55s for Rajiv Chowk/Kashmere Gate, 22s for standard stops).
- [ ] Implement a 180s terminal reversal block at Samaypur Badli and Millennium City Centre to prevent 1-second visual bounces.

---

### Task 5: RailRadar-Style Station Ladder Drawer & Honest UI
**Files to Modify:** `index.html`, `src/css/style.css`, `src/js/main.js`
- [ ] Update the header badge in `index.html` from `"LIVE FLEET RUNNING"` to:
  `"SCHEDULED TIMETABLE · DMRC Operational Baseline"`.
- [ ] Add an operational advisory ribbon beneath the header dock:
  `"Normal Service · All 16 Corridor Trains On Schedule · Average Headway 3m 15s"`.
- [ ] Build the sliding **Station Ladder Drawer** (`#station-ladder-drawer`):
  - Train header with direction and current speed.
  - Vertical station progression ladder showing current station with live dwell bar.
  - Upcoming 5 stations with arrival countdowns and interchange pills.
  - Close button and "Focus Camera" toggle.
- [ ] Add glassmorphic styling in `src/css/style.css` for the drawer.
- [ ] Wire click handler on train markers to toggle the Station Ladder drawer.

