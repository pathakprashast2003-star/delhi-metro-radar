import os

# 1. Reset file
os.system('git checkout src/js/metro_webgl_layer.js')

with open('src/js/metro_webgl_layer.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 2. Extract helpers
with open('extracted_helpers.js', 'r', encoding='utf-8') as f:
    raw_helpers = f.read()

h_start = raw_helpers.find('function makeLocalitySignTex')
clean_helpers = raw_helpers[h_start:].strip()

# 3. Extract Janakpuri & Krishna Park
with open('clean_localities_raw.txt', 'r', encoding='utf-8') as f:
    raw_localities = f.read()

loc_start = raw_localities.find('// ──────────')
clean_west_localities = raw_localities[loc_start:].strip()

# 4. Jasola Depot
jasola_depot_code = '''
  // ─────────────────────────────────────────────────────────────
  // DMRC MAGENTA LINE: JASOLA VIHAR ELEVATED DEPOT & STABLING YARD
  // INDIA'S FIRST ELEVATED METRO DEPOT (1.3km DECK, 27 TRAINS, SOLAR PV)
  // ─────────────────────────────────────────────────────────────

  function buildJasolaViharElevatedDepot(parent, st, m, g) {
    const root = new THREE.Group();
    const yDeck = VIADUCT_Y; // 14.5m
    const groundY = 1.35;

    // ───────────────────────────────────────────────────────────
    // 1. ELEVATED STABLING DECK VIADUCT STRUCTURE (340m x 38m)
    // ───────────────────────────────────────────────────────────
    const deckGrp = new THREE.Group();
    deckGrp.position.set(0, 0, 0);

    // Main 38m wide elevated concrete deck slab extending parallel to station
    addBox(deckGrp, 340, 1.2, 38.0, m.concreteLight, 10, yDeck - 0.6, -32);
    addBox(deckGrp, 340, 1.8, 34.0, m.concreteWeb, 10, yDeck - 2.1, -32);

    // Parapets and safety barriers
    // Outer parapet (canal side, z = -51.0)
    addBox(deckGrp, 340, 1.3, 0.45, m.concreteLight, 10, yDeck + 0.65, -51.0);
    addBox(deckGrp, 340, 0.25, 0.50, m.magentaAccent, 10, yDeck + 1.35, -51.0);
    // Inner parapet dividing from running viaduct
    addBox(deckGrp, 270, 1.1, 0.35, m.concreteLight, 35, yDeck + 0.55, -13.0);

    // Heavy portal straddle bents supporting the elevated deck every 32m
    const pierX = [-140, -105, -70, -35, 0, 35, 70, 105, 140];
    pierX.forEach((px) => {
      // Straddle crosshead beam spanning under the deck (z = -13 to -51)
      addBox(deckGrp, 4.2, 2.2, 40.0, m.concreteLight, px, yDeck - 3.2, -32);
      // Outer portal column (canal side)
      addBox(deckGrp, 4.4, 0.9, 4.4, m.concreteWeb, px, 0.45, -50);
      const outerShaft = addBox(deckGrp, 2.6, yDeck - 4.5, 2.6, m.pierCream, px, (yDeck - 4.5) * 0.5 + 0.9, -50);
      outerShaft.castShadow = true;
      // Inner portal column (road side)
      addBox(deckGrp, 4.4, 0.9, 4.4, m.concreteWeb, px, 0.45, -14);
      const innerShaft = addBox(deckGrp, 2.6, yDeck - 4.5, 2.6, m.pierCream, px, (yDeck - 4.5) * 0.5 + 0.9, -14);
      innerShaft.castShadow = true;
    });

    // ───────────────────────────────────────────────────────────
    // 2. PARALLEL ELEVATED STABLING TRACKS (5 STABLING LANES)
    // ───────────────────────────────────────────────────────────
    const stablingZ = [-18.5, -24.5, -30.5, -36.5, -42.5];
    stablingZ.forEach((tz, tIdx) => {
      const trackLen = 270;
      const trackCenterX = 15;
      // Ballasted concrete track bed plinth
      addBox(deckGrp, trackLen, 0.22, 3.2, m.ballastSleeper, trackCenterX, yDeck + 0.11, tz);
      // Running rails (standard gauge 1435mm)
      addBox(deckGrp, trackLen, 0.16, 0.10, m.railCrown, trackCenterX, yDeck + 0.28, tz - 0.717);
      addBox(deckGrp, trackLen, 0.16, 0.10, m.railCrown, trackCenterX, yDeck + 0.28, tz + 0.717);
      // Third rail conductor
      addBox(deckGrp, trackLen, 0.12, 0.12, m.tactileYellow, trackCenterX, yDeck + 0.25, tz + 1.15);

      // Dead-end heavy hydraulic buffer stop at x = -118
      addBox(deckGrp, 2.2, 1.6, 2.6, m.bufferRed, -118, yDeck + 0.8, tz);
      addBox(deckGrp, 0.35, 0.4, 0.4, m.whiteMarble, -116.8, yDeck + 0.8, tz - 0.7);
      addBox(deckGrp, 0.35, 0.4, 0.4, m.whiteMarble, -116.8, yDeck + 0.8, tz + 0.7);
      addBox(deckGrp, 2.6, 0.25, 0.25, m.steelDark, -119.5, yDeck + 0.45, tz);

      // Inspection catwalks between tracks
      if (tIdx < stablingZ.length - 1) {
        const catwalkZ = (tz + stablingZ[tIdx + 1]) * 0.5;
        addBox(deckGrp, 210, 0.12, 1.2, m.concreteLight, -10, yDeck + 0.45, catwalkZ);
        for (let hx = -110; hx <= 90; hx += 18) {
          addBox(deckGrp, 0.08, 0.95, 0.08, m.tactileYellow, hx, yDeck + 0.95, catwalkZ - 0.55);
          addBox(deckGrp, 0.08, 0.95, 0.08, m.tactileYellow, hx, yDeck + 0.95, catwalkZ + 0.55);
        }
        addBox(deckGrp, 200, 0.06, 0.06, m.tactileYellow, -10, yDeck + 1.4, catwalkZ - 0.55);
        addBox(deckGrp, 200, 0.06, 0.06, m.tactileYellow, -10, yDeck + 1.4, catwalkZ + 0.55);
      }
    });

    // Elevated Turnout Ramps (Connecting Main Viaduct z = -4.6m to Stabling Deck z = -18.5m & -24.5m)
    [-18.5, -24.5].forEach((targetZ) => {
      const turnoutLen = 75;
      const turnoutStartX = 70;
      const turnoutMidX = turnoutStartX + turnoutLen * 0.5;
      const turnoutMidZ = (-4.6 + targetZ) * 0.5;
      const turnoutAngle = Math.atan2(targetZ - (-4.6), turnoutLen);
      const ramp = addBox(deckGrp, turnoutLen + 4, 1.0, 3.4, m.concreteLight, turnoutMidX, yDeck - 0.5, turnoutMidZ);
      ramp.rotation.y = turnoutAngle;
      const rTrack = addBox(deckGrp, turnoutLen + 2, 0.22, 2.8, m.ballastSleeper, turnoutMidX, yDeck + 0.11, turnoutMidZ);
      rTrack.rotation.y = turnoutAngle;
    });

    // ───────────────────────────────────────────────────────────
    // 3. STABLED DRIVERLESS HYUNDAI ROTEM 6-CAR TRAINSETS
    // ───────────────────────────────────────────────────────────
    const buildStabledMagentaTrain = (startX, trackZ, nCars) => {
      const trainGrp = new THREE.Group();
      trainGrp.position.set(0, yDeck + 0.28, trackZ);
      const carLen = 17.5;
      for (let c = 0; c < nCars; c++) {
        const cx = startX + c * (carLen + 0.5);
        const isLeading = (c === nCars - 1);
        const isTrailing = (c === 0);
        const car = new THREE.Group();
        car.position.x = cx;

        // Stainless-steel aerodynamic carbody
        addBox(car, carLen, 2.65, 2.88, m.steelChrome, 0, 1.55, 0);
        // Signature Magenta Line front & side livery stripe (#D946EF)
        addBox(car, carLen + 0.1, 0.42, 2.92, m.magentaAccent, 0, 1.1, 0);
        addBox(car, carLen + 0.1, 0.20, 2.92, m.magentaAccent, 0, 2.68, 0);

        // Window apertures with passenger glass
        for (let wx = -5.8; wx <= 5.8; wx += 2.4) {
          addBox(car, 1.8, 0.95, 2.94, m.concourseGlass, wx, 1.85, 0);
        }

        // Aerodynamic driverless cab nose
        if (isLeading) {
          addBox(car, 2.2, 2.3, 2.80, m.steelChrome, carLen * 0.5 + 1.0, 1.45, 0);
          addBox(car, 2.22, 0.55, 2.84, m.magentaAccent, carLen * 0.5 + 1.0, 1.1, 0);
          addBox(car, 0.2, 0.28, 0.42, m.lampGlow, carLen * 0.5 + 2.1, 1.1, 0.82);
          addBox(car, 0.2, 0.28, 0.42, m.lampGlow, carLen * 0.5 + 2.1, 1.1, -0.82);
          addBox(car, 1.2, 1.05, 2.5, m.slateDark, carLen * 0.5 + 1.25, 1.95, 0);
        }
        if (isTrailing) {
          addBox(car, 1.6, 2.3, 2.80, m.steelChrome, -carLen * 0.5 - 0.7, 1.45, 0);
          addBox(car, 0.2, 0.24, 0.38, m.airIndiaRed, -carLen * 0.5 - 1.5, 1.1, 0.82);
          addBox(car, 0.2, 0.24, 0.38, m.airIndiaRed, -carLen * 0.5 - 1.5, 1.1, -0.82);
        }

        // Roof AC units & steel bogies
        addBox(car, 5.2, 0.38, 1.8, m.aeroTitanium, 0, 3.05, 0);
        [-5.2, 5.2].forEach((bx) => addBox(car, 3.0, 0.60, 2.4, m.steelDark, bx, 0.32, 0));

        trainGrp.add(car);
      }
      deckGrp.add(trainGrp);
    };

    // Stabled Fleet: 4 Realistic Parked Trainsets
    buildStabledMagentaTrain(-75, -18.5, 6); // Track 1: 6-car train parked
    buildStabledMagentaTrain(-95, -24.5, 6); // Track 2: 6-car train parked
    buildStabledMagentaTrain(-45, -30.5, 4); // Track 3: 4-car train parked
    buildStabledMagentaTrain(-60, -42.5, 4); // Track 5: 4-car train in outer siding

    // ───────────────────────────────────────────────────────────
    // 4. MAINTENANCE WORKSHOP SHED & ROOFTOP SOLAR PV PLANT
    // ───────────────────────────────────────────────────────────
    // Covered heavy inspection bay over tracks 4 & 5 (z = -36.5 & -42.5)
    const shedGrp = new THREE.Group();
    shedGrp.position.set(-25, yDeck, -39.5);

    // High-bay portal shed massing (110m x 7.2m x 15m)
    addBox(shedGrp, 110, 7.2, 15.0, m.concreteLight, 0, 3.6, 0);
    // Industrial portal framing ribs & translucent side daylighting
    for (let sx = -50; sx <= 50; sx += 12.5) {
      addBox(shedGrp, 0.85, 7.6, 15.4, m.steelDark, sx, 3.8, 0);
    }
    // High-level clerestory daylight louvers on side walls
    addBox(shedGrp, 106, 2.2, 15.2, m.concourseGlass, 0, 5.4, 0);
    // Dark fascia trim with DMRC corporate magenta band
    addBox(shedGrp, 110.4, 0.35, 15.4, m.magentaAccent, 0, 7.3, 0);

    // DMRC Rooftop Solar PV Power Plant (Arrays of dark blue photovoltaic cells)
    for (let rx = -48; rx <= 48; rx += 16) {
      [-4.0, 4.0].forEach((rz) => {
        addBox(shedGrp, 14.5, 0.25, 6.2, m.solarpvBlue, rx, 7.5, rz);
      });
    }

    // High-Mast Floodlight Masts (22m tall illuminating the yard)
    [-100, -35, 30, 95].forEach((lx) => {
      const mastH = 22.0;
      addBox(deckGrp, 0.7, mastH, 0.7, m.catenarySteel, lx, yDeck + mastH * 0.5, -50.5);
      // Quad LED floodlight head
      addBox(deckGrp, 2.4, 0.45, 1.8, m.steelDark, lx, yDeck + mastH + 0.2, -50.5);
      [-0.8, 0.8].forEach((fx) => {
        addBox(deckGrp, 0.6, 0.25, 0.6, m.lampGlow, lx + fx, yDeck + mastH - 0.2, -50.5);
      });
    });

    root.add(deckGrp);
    root.add(shedGrp);

    // ───────────────────────────────────────────────────────────
    // 5. GROUND-LEVEL TRANSIT & AGRA CANAL EMBANKMENT
    // ───────────────────────────────────────────────────────────
    const groundGrp = new THREE.Group();
    groundGrp.position.set(10, groundY, -32);

    // Paved under-deck asphalt pavement
    addBox(groundGrp, 320, 0.10, 36.0, m.asphaltRoad, 0, 0.05, 0);

    // Sheltered DTC electric bus bays & auto parking
    addBox(groundGrp, 65, 0.22, 6.0, m.plazaPave, -50, 0.11, 8.0);
    addBox(groundGrp, 65, 2.8, 0.15, m.steelDark, -50, 1.4, 11.0);
    addBox(groundGrp, 65, 0.35, 6.4, m.steelDark, -50, 2.9, 8.0);

    // Parked DTC Green Electric Buses and Auto-Rickshaws
    addDelhiVehicles(groundGrp, [
      { type: 'bus', color: 'green', x: -68, y: 0.08, z: 8.0, rotY: 0 },
      { type: 'bus', color: 'green', x: -50, y: 0.08, z: 8.0, rotY: 0 },
      { type: 'bus', color: 'green', x: -32, y: 0.08, z: 8.0, rotY: 0 },
      { type: 'auto', x: 5, y: 0.08, z: 8.0, rotY: 0 },
      { type: 'auto', x: 15, y: 0.08, z: 8.0, rotY: 0 },
      { type: 'auto', x: 25, y: 0.08, z: 8.0, rotY: 0 },
      { type: 'cab', x: 45, y: 0.08, z: 8.0, rotY: 0 }
    ]);

    // Agra Canal Bank Landscaping (Canal side, z = -20 from ground center)
    addBox(groundGrp, 340, 0.35, 6.0, m.sagePark, 0, 0.18, -19.0);
    for (let tx = -140; tx <= 140; tx += 28) {
      addStreetTree(groundGrp, tx, 0.35, -19.0, true, 1.25, 0.4);
    }

    // High-Definition Illuminated 3D DMRC Signboards
    addDwarkaLocalitySign(deckGrp, 15, yDeck + 1.8, -51.3, 52, 2.8, 'DMRC JASOLA VIHAR ELEVATED STABLING YARD', 'INDIA\\\'S FIRST ELEVATED METRO DEPOT · 27 TRAINS · MAGENTA LINE', '#D946EF', 0);
    addDwarkaLocalitySign(deckGrp, -25, yDeck + 7.8, -31.8, 44, 2.4, 'DMRC CAPTIVE SOLAR PV PLANT', '1 MWp ROOFTOP CLEAN ENERGY GENERATION', '#1E3A8A', 0);
    addDwarkaLocalitySign(groundGrp, -50, 3.4, 11.2, 38, 2.0, 'DTC SHAHEEN BAGH FEEDER TERMINAL', 'ELECTRIC AC FEEDER BUSES · E-RICKSHAW CHARGING HUB', '#047857', 0);

    root.add(groundGrp);

    parent.add(root);
    return root;
  }
'''

# Combine helpers + west localities + jasola depot
all_block = clean_helpers + '\n\n' + clean_west_localities + '\n\n' + jasola_depot_code

target_hub = 'function buildDwarkaSector21DualHub(blueSt, orangeSt, secColor) {'
if target_hub in code:
    code = code.replace(target_hub, all_block + '\n\n  ' + target_hub, 1)
    print('Inserted helpers, west localities & Jasola depot before buildDwarkaSector21DualHub')
else:
    print('Error: target_hub not found!')

# In attachGenuineInterchangeGeometry: suppress same-line duplicate arms
target_arms = '(hubSpec.arms || []).forEach((arm) => {'
repl_arms = '''(hubSpec.arms || []).forEach((arm) => {
      if ((st.isMagenta && arm.line === 'Magenta Line') ||
          (st.isBlue && arm.line === 'Blue Line') ||
          (st.isYellow && arm.line === 'Yellow Line') ||
          (st.isOrange && (arm.line === 'Airport Express' || arm.line === 'Orange Line'))) {
        return;
      }'''
if target_arms in code:
    code = code.replace(target_arms, repl_arms, 1)
    print('Updated arm suppression')

# In createStationMeshes: exclude Janakpuri West and attach 3 localities
old_hub_attach = '''if (hubSpec && !isSharedRajiv && st.name !== 'Yamuna Bank' && !isSharedDwarka21 && st.name !== 'New Delhi') {
        attachGenuineInterchangeGeometry(built, st, hubSpec, m, g);
      }'''
repl_hub_attach = '''if (hubSpec && !isSharedRajiv && st.name !== 'Yamuna Bank' && !isSharedDwarka21 && st.name !== 'New Delhi' && st.name !== 'Janakpuri West' && st.name !== 'Janak Puri West') {
        attachGenuineInterchangeGeometry(built, st, hubSpec, m, g);
      }

      // Attach 3D Localities for Janakpuri West, Krishna Park Extension & Jasola Vihar Elevated Depot
      const isJanakpuriSt = (st.name === 'Janakpuri West' || st.name === 'Janak Puri West');
      const isKrishnaParkSt = (st.name === 'Krishna Park Extension' || st.name === 'Krishna Park Ext');
      const isJasolaSt = st.name && st.name.toLowerCase().includes('jasola');

      if (isJanakpuriSt && !parent.__janakpuriLocalitiesAttached) {
        parent.__janakpuriLocalitiesAttached = true;
        buildJanakpuriWestLocalities(built.root, st, m, g);
      }
      if (isKrishnaParkSt && !parent.__krishnaParkLocalitiesAttached) {
        parent.__krishnaParkLocalitiesAttached = true;
        buildKrishnaParkExtLocalities(built.root, st, m, g);
      }
      if (isJasolaSt && !parent.__jasolaDepotAttached) {
        parent.__jasolaDepotAttached = true;
        buildJasolaViharElevatedDepot(built.root, st, m, g);
      }'''
if old_hub_attach in code:
    code = code.replace(old_hub_attach, repl_hub_attach, 1)
    print('Updated station mesh attachments')

# In majorStationMarkers: tags
old_markers = '''} else if (st.name === 'Janakpuri West') {
          tag = 'MAGENTA × BLUE INTERCHANGE';
          dotColor = '#D946EF';'''
repl_markers = '''} else if (st.name === 'Janakpuri West') {
          tag = 'MAGENTA × BLUE INTERCHANGE';
          dotColor = '#D946EF';
        } else if (st.name === 'Krishna Park Extension') {
          tag = 'PHASE-4 WESTERN TERMINUS';
          dotColor = '#D946EF';
        } else if (st.name && st.name.toLowerCase().includes('jasola')) {
          tag = 'ELEVATED STABLING DEPOT (+14m)';
          dotColor = '#D946EF';'''
if old_markers in code:
    code = code.replace(old_markers, repl_markers, 1)
    print('Updated station badge tags')

with open('src/js/metro_webgl_layer.js', 'w', encoding='utf-8') as f:
    f.write(code)

print('Master rebuild complete!')

