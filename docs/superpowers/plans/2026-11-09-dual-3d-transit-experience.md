# Dual-Engine 3D Transit Experience Implementation Plan

> **Goal:** Build and polish both the **Pure Three.js 3D WebGL Diorama Stage** and the **MapLibre 49km Corridor Radar** side-by-side with instant tab switching, so the user can test both in real-time on `localhost:8080` and decide which suits better.

**Architecture:**
- **Surface 1: Three.js WebGL Diorama Stage (`src/js/diorama3d.js`)**: An interactive 3D architectural diorama inspired by the Pinterest references (Central Line tube cutaway & Seoul miniature viaduct). Features dual environments (Elevated Viaduct Station vs. Underground Subterranean Tube Cutaway), 3D multi-car consists entering circular tunnel tubes, PBR studio clay lighting, and 360° orbit/chase cameras.
- **Surface 2: MapLibre Corridor Radar (`src/js/main.js`)**: The full 49.3 km continuous Yellow Line from Samaypur Badli to Millennium City Centre Gurugram. Uses a clean 2-tier Level of Detail (LOD) system—radiant glowing ribbon at macro overview, smoothly revealing physical 3D viaducts, platforms, and consist models when zoomed in.
- **Unified Switcher & Bridge**: Seamless top navigation pill allowing instant zero-latency flipping between the 3D Diorama Stage and the Corridor Radar, with station click-through linking.

**Tech Stack:** Three.js r128, OrbitControls, MapLibre GL JS v3, Web Audio API, Vanilla JS, HTML5/CSS3.

---

## Global Constraints
- Zero external build tooling or bundlers; pure vanilla ES6 modules running directly in browser over static HTTP.
- Maintain 60 FPS performance on both WebGL renderers with proper animation loop management (pause Three.js when on Map, pause MapLibre ticks when on Three.js).
- Ensure cache-busting version tags on all script/style inclusions.
- Non-destructive: Both systems must work seamlessly without breaking each other.

---

## Review Focus & Failure Modes
1. **WebGL Context Collision**: Running MapLibre and Three.js simultaneously can exhaust WebGL contexts or drop FPS. *Guard: Explicitly stop/start animation loops (`cancelAnimationFrame`) when switching surfaces.*
2. **Camera Isolation**: OrbitControls in Three.js must not intercept touch/mouse events meant for the Map or UI cards.
3. **Tunnel Occlusion Realism**: When the train enters the underground tube cutaway, it must genuinely disappear inside the cylindrical tube geometry rather than clipping through walls.
4. **Lighting State Memory**: Switching between Studio Day, Sunset, and Night Glow must correctly update ambient, hemisphere, and directional light colors without memory leaks.
5. **Mobile & Viewport Scaling**: Canvas resize handlers must update camera aspect ratio and renderer projection matrix on window resize.

---

## Task Decomposition

### Task 1: Underground Subterranean Tube Cutaway Environment in Three.js
Add a toggleable **Underground Tube Cutaway Station** (Rajiv Chowk / Kashmere Gate style) to `src/js/diorama3d.js`:
- [ ] Build concrete excavation chamber box with open front face (architectural cutaway).
- [ ] Add dual circular concrete tube tunnels entering the chamber from the left and right.
- [ ] Add central island passenger platform, tiled floor texture, warning tactile edges, and illuminated station signage roundel.
- [ ] Create escalator shafts rising toward the surface concourse.
- [ ] Add a station environment toggle in the UI: `[🌁 Elevated Viaduct]` vs `[🚇 Underground Tube Cutaway]`.
- [ ] Test in browser and capture screenshot proof for both environments.

### Task 2: Advanced Train Kinematics & Tunnel Entry/Exit
Enhance the 3D metro rake movement in `src/js/diorama3d.js`:
- [ ] Model realistic braking deceleration as the train approaches the platform.
- [ ] Add station dwell time with automated door chime sound effect via Web Audio API.
- [ ] Model smooth acceleration as the train departs and disappears into the circular tube tunnel.
- [ ] Ensure train headlights illuminate the interior of the tube tunnel dynamically.
- [ ] Verify 60 FPS animation loop and kinematic state transitions.

### Task 3: Polish MapLibre Macro Radar & LOD Handoff
Ensure the MapLibre Corridor Radar is flawless:
- [ ] Verify that at overview (z < 13.5), only the radiant glowing yellow ribbon, clean station nodes, and modern train capsules render.
- [ ] Verify that at zoom >= 13.5, the physical elevated viaduct, dual rails, platform slabs, and 3D consist sprites smoothly emerge without popping.
- [ ] Wire station clicks on the map so clicking "View in 3D Stage" immediately transitions to the Three.js Diorama focused on that station type (Elevated vs Underground).

### Task 4: UI Navigation & Side-by-Side Comparison Switcher
Unify the experience in `index.html` and `src/css/style.css`:
- [ ] Refine the top header switcher: `[📐 3D Diorama Stage]` (Hero) | `[🗺️ Corridor Radar]` | `[🏛️ Station Cutaways]`.
- [ ] Ensure active state styling, tooltips, and smooth fade transitions between viewports.
- [ ] Support URL query parameters (`?surface=threejs` and `?surface=corridor`) for direct sharing/bookmarking.
- [ ] Run full automated test suite (`archive/test_schedule_and_stopping.js`).

### Task 5: Live Verification & Proof Deliverables
- [ ] Capture side-by-side screenshots of both engines via Puppeteer:
  1. Three.js Elevated Viaduct Stage (Day & Sunset)
  2. Three.js Underground Tube Cutaway Stage (Central Line / Rajiv Chowk style)
  3. MapLibre 49km Full Corridor Radar (clean 2D overview)
  4. MapLibre 3D Station close-up (Qutab Minar portal)
- [ ] Present both engines to the user with exact instructions on how to toggle and test them live.
