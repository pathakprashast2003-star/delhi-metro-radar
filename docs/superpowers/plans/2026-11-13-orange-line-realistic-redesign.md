# Realistic Orange Line (Airport Express) Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the 22.7 km Delhi Metro Airport Express (Orange Line) into a visually stunning, unbroken, authentic transit corridor with realistic station structures for all 7 stations (especially interchanges), continuous 3D cutaway track infrastructure without gaps, and authentic surrounding Delhi environments (Southern Ridge forest and IGI Airport tarmac).

**Architecture:** Refactor `buildTrackInfrastructure` in `src/js/metro_webgl_layer.js` to eliminate artificial 42m station fragmentation for Orange Line, generating continuous cutaway subterranean tunnels and seamless portal transitions. Upgrade all 7 Orange Line station builders to match genuine Delhi architecture (Dwarka 21 dual hub, Dhaula Kuan 710m skywalk, New Delhi NDLS bridge, IGI Airport T3 terminal, Yashobhoomi IICC halls, Aerocity Worldmark district, Shivaji Stadium CP terminal). Correct tree spatial coordinates around Dhaula Kuan Ridge and add airport ground apron detailing.

**Tech Stack:** Three.js WebGL Layer, MapLibre GL JS, Playwright Python verification suite, GeoJSON network topology.

**Spec:** [orange_line_realistic_redesign.md](file:///Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/orange_line_realistic_redesign.md)

## Global Constraints
- **Unbroken Track Continuity**: Dual steel rails, sleeper ballast, and power guides must run 100% seamlessly from Yashobhoomi to New Delhi without missing spans, severed track ends, or mid-air terminations.
- **Architectural Authenticity**: Interchange stations (Dwarka Sec 21, Dhaula Kuan, New Delhi) must accurately represent their real-world multi-modal connections, platforms, and signature structures.
- **Visual Performance**: Instanced geometry or shared geometries must be used for repetitive elements (trees, piers, sleepers, catenary masts, vehicles) to preserve 60 FPS rendering.
- **Zero Console Errors**: All changes must pass cleanly with no WebGL shader compile errors, undefined reference exceptions, or map layer errors.

## Review Focus
- **Subterranean Cutaway Continuity**: When camera pans along underground sections (e.g. Dwarka 21 to IGI Airport or Shivaji Stadium to New Delhi), tracks and tunnels must never disappear into empty ground voids.
- **Portal Watertightness**: At South Portal (NH-48) and North Portal (Vande Mataram Marg), the transition from underground cutaway to elevated ramp must have zero gap.
- **Station-Track Alignment**: Station platforms and tracks must align with zero coordinate drift or misalignment.
- **Ridge Tree Placement**: Trees must surround Kitchener Lake and Dhaula Kuan viaduct, not spawn in Dwarka.
- **Interchange Dual Hub Clarity**: Blue Line and Orange Line at Dwarka 21 must show distinct, parallel tracks and shared concourse.

---

### Task 1: Continuous Unbroken Track Infrastructure for Orange Line

**Files:**
- Modify: `src/js/metro_webgl_layer.js:1840-2040`
- Test: `scripts/test_orange_tracks_continuity.py`

- [ ] **Step 1: Write verification script to detect track span gaps along Orange Line**
  Write `scripts/test_orange_tracks_continuity.py` using Playwright and Three.js scene traversal to measure the bounding distance between consecutive track spans along `orangeCorridor` and assert max gap < 1.0 meter.
- [ ] **Step 2: Run verification script to confirm current failure**
  Run `python3 scripts/test_orange_tracks_continuity.py` and document detected gap distances between stations.
- [ ] **Step 3: Update `buildTrackInfrastructure` for Orange Line continuous spans**
  In `src/js/metro_webgl_layer.js`:
  - Ensure `surfaceTrackSpans` and `buriedTrackSpans` for Orange Line do not omit intermediate underground spans when `subwayRailsVisible` is enabled or in corridor view.
  - Generate continuous cutaway trench beds (`m.slateCut`), coping walls (`m.concreteLight`), and dual-tone rails (`m.railWeb`, `m.railCrown`) with ballast (`m.ballastSleeper`) throughout the entire subterranean corridor from Yashobhoomi (0m) to South Ramp (9,928m) and from North Ramp (17,566m) to New Delhi (23,640m).
  - Bridge the portal transition gaps at South Portal and North Portal with concrete abutments and retaining headwalls.
- [ ] **Step 4: Re-run verification script and verify unbroken continuity**
  Run `python3 scripts/test_orange_tracks_continuity.py` to confirm zero gaps along the entire 22.7 km track.

---

### Task 2: Authentic Station Architecture for Interchanges (Dwarka 21, Dhaula Kuan, New Delhi)

**Files:**
- Modify: `src/js/metro_webgl_layer.js:4379-4550` (`buildDhaulaKuanAeroHub`)
- Modify: `src/js/metro_webgl_layer.js:4610-4755` (`buildDwarkaSector21DualHub`)
- Modify: `src/js/metro_webgl_layer.js:4897-5039` (`buildNewDelhiAirportHub`)
- Test: `scripts/test_orange_interchanges_live.py`

- [ ] **Step 1: Write Playwright test for the 3 Orange Line interchanges**
  Create `scripts/test_orange_interchanges_live.py` navigating to Dwarka Sector 21, Dhaula Kuan, and New Delhi, inspecting mesh hierarchies and taking screenshots.
- [ ] **Step 2: Upgrade `buildDwarkaSector21DualHub`**
  - Add parallel continuous tracks for both Blue Line and Orange Line through the station throat.
  - Model the shared glass-canopied transfer concourse with escalators and DMRC signage.
  - Add multi-bay DTC bus terminal bays with shelters, parking areas, and Pacific D21 mall context.
- [ ] **Step 3: Upgrade `buildDhaulaKuanAeroHub`**
  - Add the authentic aerodynamic curved wing canopy over the elevated platforms.
  - Complete the 710m covered travellator skywalk structure with glass window bands crossing Kitchener Lake and connecting to the Durgabai Deshmukh South Campus (Pink Line) station.
  - Refine the multi-tier Ring Road & Benito Juarez Marg flyover decks and traffic underneath.
- [ ] **Step 4: Upgrade `buildNewDelhiAirportHub`**
  - Model the dedicated City Airport Terminal concourse with airline baggage check-in hall on Bhavbhuti Marg.
  - Add the covered pedestrian skywalk crossing over Bhavbhuti Marg directly connecting to Indian Railways Platform 16 and Yellow Line concourse.
  - Add adjacent multi-track Indian Railways electrified tracks and platform roofs.
- [ ] **Step 5: Run Playwright test and verify screenshots**
  Run `python3 scripts/test_orange_interchanges_live.py` and inspect visual fidelity of all three interchange hubs.

---

### Task 3: Realistic Architecture for Intermediate & Expo Stations (Yashobhoomi, IGI Airport T3, Aerocity, Shivaji Stadium)

**Files:**
- Modify: `src/js/metro_webgl_layer.js:4756-4896` (`buildIgiAirportT3Station`)
- Modify: `src/js/metro_webgl_layer.js:5040-5200` (`buildAirportExpressStation`)
- Create: `buildYashobhoomiExpoTerminal` and `buildAerocityWorldmarkStation` helper builders in `src/js/metro_webgl_layer.js`
- Test: `scripts/test_orange_stations_live.py`

- [ ] **Step 1: Write Playwright test for Yashobhoomi, IGI Airport, Aerocity, Shivaji Stadium**
  Create `scripts/test_orange_stations_live.py` to inspect mesh counts and capture screenshots.
- [ ] **Step 2: Build `buildYashobhoomiExpoTerminal`**
  - Model twin vaulted exhibition hall complexes (IICC Halls 1 & 2) flanking the station with solar panel arrays.
  - Model the central Grand Foyer canopy with gold/warm metallic trim and sunken glass atrium escalators.
  - Add ceremonial arrival driveway, flagpoles, and pedestrian entrance plazas.
- [ ] **Step 3: Upgrade `buildIgiAirportT3Station`**
  - Model the curved aerodynamic silver wing roof of IGI Terminal 3.
  - Add the elevated departures roadway ramp with overhead signage and taxi drop-off lanes.
  - Add covered air bridges connecting the metro concourse directly into the T3 arrivals hall.
  - Add the airport ATC tower landmark and baggage building structures.
- [ ] **Step 4: Build `buildAerocityWorldmarkStation`**
  - Model modern Worldmark commercial glass office blocks with blue/graphite curtain wall glazing.
  - Add sunken open-air central plaza with seating, palm trees, and glass cube entrance pavilions.
  - Add drop-off loops and street parking along Aerocity hospitality boulevard.
- [ ] **Step 5: Upgrade Shivaji Stadium**
  - Model the multi-level commercial and parking terminal block on Baba Kharak Singh Marg.
  - Add classical Connaught Place heritage colonnades and sandstone pillars.
  - Add airline city check-in signage and glass entrance pavilions.
- [ ] **Step 6: Run Playwright test and verify screenshots**
  Run `python3 scripts/test_orange_stations_live.py` and verify all stations look genuine and realistic.

---

### Task 4: Surrounding Environment & Delhi Southern Ridge Forest

**Files:**
- Modify: `src/js/metro_webgl_layer.js:2588-2615`
- Test: `scripts/test_orange_environment.py`

- [ ] **Step 1: Fix Southern Ridge Forest tree sampling coordinates**
  - In `src/js/metro_webgl_layer.js`, update Dhaula Kuan tree loop to sample points along `orangeCorridor` around Dhaula Kuan station (`st.dist ≈ 15,000m`, samples index 1450 to 1600) instead of index 90 to 160.
  - Populate 500+ dense native ridge trees (Kikar, Neem, Peepal, Amaltas) on both sides of Ring Road and enveloping Kitchener Lake.
- [ ] **Step 2: Add IGI Airport Aviation Environment**
  - Add tarmac asphalt aprons, runway/taxiway striping decals, and perimeter security fencing around Terminal 3.
  - Add ground handling service vehicles (luggage tugs, airport shuttle buses).
- [ ] **Step 3: Add landscaped medians and streetscapes**
  - Add street trees and landscaped center medians at Aerocity, Yashobhoomi, and Shivaji Stadium.
- [ ] **Step 4: Run Playwright test and capture environmental screenshots**
  Run `scripts/test_orange_environment.py` and visually verify lush forest around Dhaula Kuan and airport apron at IGI Airport.

---

### Task 5: Full Line Comprehensive Verification & Regression Check

**Files:**
- Test: `scripts/verify_all_orange_corridor.py`

- [ ] **Step 1: Write end-to-end corridor sweep test**
  Write `scripts/verify_all_orange_corridor.py` that walks the camera from Yashobhoomi to New Delhi along the track curve in 500m increments, capturing screenshots and checking for any broken tracks or console errors.
- [ ] **Step 2: Run end-to-end corridor test**
  Execute `python3 scripts/verify_all_orange_corridor.py` and assert zero errors, zero broken track spans, and consistent 60fps performance.
- [ ] **Step 3: Document visual proof and report findings**
  Present the before/after comparisons of stations, tracks, and environments.

