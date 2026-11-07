/* ============================================================
 * DELHI METRO — Interactive Three.js 3D WebGL Diorama Engine
 * True Orthographic Camera, Studio Clay PBR Lighting & Soft Shadows
 * Inspired by Nano Banana Pro, Seoul & Central Line Tube Dioramas
 * ============================================================ */

window.Diorama3D = (function () {
  'use strict';

  let container = null;
  let canvas = null;
  let scene, camera, renderer, controls;
  let animId = null;
  let isRunning = false;
  let simSpeed = 1.0;
  let isPaused = false;

  // Meshes & Materials
  let train1Group = null; // Southbound Train on Track 1
  let train2Group = null; // Northbound Train on Track 2
  let windowMaterials = [];
  let headlightMaterials = [];
  let platformLights = [];
  let sunLight, hemiLight, ambientFill;
  let currentLightingMode = 'day';
  let cameraMode = 'iso'; // 'iso' | 'platform' | 'chase1' | 'chase2'

  // Kinematic parameters
  let t1Progress = 0.15;
  let t2Progress = 0.65;
  const TRACK_LEN = 160;

  // Platform dynamic digital clock
  let clockCanvas = null, clockCtx = null, clockTexture = null;

  // Web Audio Context for DMRC Chime
  let audioCtx = null;

  function init(containerEl) {
    if (!containerEl) return;
    container = containerEl;
    canvas = document.getElementById('three-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'three-canvas';
      container.prepend(canvas);
    }

    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFDFBF7); // Warm Alabaster Canvas
    scene.fog = new THREE.FogExp2(0xFDFBF7, 0.0032);

    // 2. Camera: True Orthographic Isometric Camera
    const aspect = container.clientWidth / container.clientHeight;
    const d = 50;
    camera = new THREE.OrthographicCamera(
      -d * aspect, d * aspect,
      d, -d,
      1, 1000
    );
    camera.position.set(70, 60, 70);
    camera.lookAt(0, 4, 0);

    // 3. WebGL Renderer with High-DPI Soft Shadow Maps
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;

    // 4. OrbitControls
    if (window.THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI / 2.15; // Don't flip below ground
      controls.minPolarAngle = Math.PI / 8;
      controls.minZoom = 0.55;
      controls.maxZoom = 2.6;
      controls.target.set(0, 4, 0);
    }

    // 5. Studio Lighting
    setupLighting();

    // 6. Build the 3D Diorama World
    buildPedestalAndGround();
    buildMinimalistTrees();
    buildElevatedViaductAndTracks();
    buildStationPlatform();
    buildPlatformCommuters();
    build3DMetroTrains();

    // 7. Bind HUD controls
    bindHUDControls();

    window.addEventListener('resize', onWindowResize);
  }

  function setupLighting() {
    hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0xE2E8F0, 0.85);
    scene.add(hemiLight);

    ambientFill = new THREE.AmbientLight(0xFFFBEB, 0.35);
    scene.add(ambientFill);

    sunLight = new THREE.DirectionalLight(0xFFFBEB, 1.25);
    sunLight.position.set(75, 95, 55);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 280;
    const shadowD = 85;
    sunLight.shadow.camera.left = -shadowD;
    sunLight.shadow.camera.right = shadowD;
    sunLight.shadow.camera.top = shadowD;
    sunLight.shadow.camera.bottom = -shadowD;
    sunLight.shadow.bias = -0.0003;
    scene.add(sunLight);
  }

  function setLightingMode(mode) {
    currentLightingMode = mode;
    const isNight = mode === 'night';
    const isSunset = mode === 'sunset';

    if (isNight) {
      scene.background.set(0x0B132B);
      if (scene.fog) scene.fog.color.set(0x0B132B);
      hemiLight.color.set(0x1E293B);
      hemiLight.groundColor.set(0x0F172A);
      hemiLight.intensity = 0.25;
      ambientFill.intensity = 0.15;
      sunLight.color.set(0x38BDF8); // Cool moonlight
      sunLight.intensity = 0.45;
      sunLight.position.set(-60, 80, -40);

      // Turn on glowing train windows & headlights
      windowMaterials.forEach(m => {
        m.emissive.set(0xFDE047);
        m.emissiveIntensity = 0.85;
      });
      headlightMaterials.forEach(m => {
        m.color.set(0xFEF08A);
      });
      platformLights.forEach(l => l.intensity = 2.4);

    } else if (isSunset) {
      scene.background.set(0xFFF7ED);
      if (scene.fog) scene.fog.color.set(0xFFF7ED);
      hemiLight.color.set(0xFDE68A);
      hemiLight.groundColor.set(0x78350F);
      hemiLight.intensity = 0.75;
      ambientFill.intensity = 0.4;
      sunLight.color.set(0xF59E0B); // Amber golden hour
      sunLight.intensity = 1.4;
      sunLight.position.set(90, 45, 70);

      windowMaterials.forEach(m => {
        m.emissive.set(0xF59E0B);
        m.emissiveIntensity = 0.35;
      });
      platformLights.forEach(l => l.intensity = 0.8);

    } else {
      // Day
      scene.background.set(0xFDFBF7);
      if (scene.fog) scene.fog.color.set(0xFDFBF7);
      hemiLight.color.set(0xFFFFFF);
      hemiLight.groundColor.set(0xE2E8F0);
      hemiLight.intensity = 0.85;
      ambientFill.intensity = 0.35;
      sunLight.color.set(0xFFFBEB);
      sunLight.intensity = 1.25;
      sunLight.position.set(75, 95, 55);

      windowMaterials.forEach(m => {
        m.emissive.set(0x000000);
        m.emissiveIntensity = 0;
      });
      platformLights.forEach(l => l.intensity = 0.3);
    }
  }

  // ── 1. Pedestal and Sculpted Clay Ground ─────────────────────
  function buildPedestalAndGround() {
    const groundGroup = new THREE.Group();

    // Ivory architectural clay pedestal block
    const baseGeo = new THREE.BoxGeometry(160, 8, 90);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xF4EFE6, // Soft Warm Clay
      roughness: 0.88,
      metalness: 0.04
    });
    const pedestal = new THREE.Mesh(baseGeo, baseMat);
    pedestal.position.set(0, -4, 0);
    pedestal.receiveShadow = true;
    groundGroup.add(pedestal);

    // Bevelled green clay embankment terrace flanking the tracks
    const lawnMat = new THREE.MeshStandardMaterial({
      color: 0xE2E8D5, // Minimalist muted sage grass
      roughness: 0.9,
      metalness: 0.02
    });

    // South embankment
    const lawnS = new THREE.Mesh(new THREE.BoxGeometry(158, 1.2, 24), lawnMat);
    lawnS.position.set(0, 0.4, -30);
    lawnS.receiveShadow = true;
    groundGroup.add(lawnS);

    // North embankment
    const lawnN = new THREE.Mesh(new THREE.BoxGeometry(158, 1.2, 24), lawnMat);
    lawnN.position.set(0, 0.4, 30);
    lawnN.receiveShadow = true;
    groundGroup.add(lawnN);

    // Ground Contact Shadow Receiver Plane
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.16 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -8.05;
    ground.receiveShadow = true;
    groundGroup.add(ground);

    scene.add(groundGroup);
  }

  // ── 2. Seoul-Inspired Minimalist Trees ───────────────────────
  function buildMinimalistTrees() {
    const treesGroup = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350F, roughness: 0.85 });

    const foliageColors = [0xD97706, 0xEA580C, 0x65A30D, 0x84CC16, 0xCA8A04];

    const treePositions = [
      // South lawn trees
      [-65, -28], [-48, -32], [-32, -26], [28, -31], [50, -27], [68, -33],
      // North lawn trees
      [-60, 31], [-42, 27], [-22, 33], [25, 29], [46, 32], [64, 28]
    ];

    treePositions.forEach(([x, z], idx) => {
      const tree = new THREE.Group();
      tree.position.set(x, 1.0, z);

      const h = 4.5 + (idx % 3) * 1.5;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, h, 8), trunkMat);
      trunk.position.y = h / 2;
      trunk.castShadow = true;
      tree.add(trunk);

      const folCol = foliageColors[idx % foliageColors.length];
      const folMat = new THREE.MeshStandardMaterial({ color: folCol, roughness: 0.75, metalness: 0.05 });

      if (idx % 2 === 0) {
        // Conical tree crown
        const crown = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5.5, 8), folMat);
        crown.position.y = h + 2.2;
        crown.castShadow = true;
        crown.receiveShadow = true;
        tree.add(crown);
      } else {
        // Spherical rounded tree crown (Seoul style lollipop tree)
        const crown = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 10), folMat);
        crown.position.y = h + 2.2;
        crown.castShadow = true;
        crown.receiveShadow = true;
        tree.add(crown);
      }

      treesGroup.add(tree);
    });

    scene.add(treesGroup);
  }

  // ── 3. Elevated Viaduct & Dual Tracks ────────────────────────
  function buildElevatedViaductAndTracks() {
    const viaductGroup = new THREE.Group();

    // Viaduct Deck (Concrete elevated girder)
    const deckGeo = new THREE.BoxGeometry(TRACK_LEN, 4, 30);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0xE2E8F0,
      roughness: 0.75,
      metalness: 0.1
    });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(0, 2, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    viaductGroup.add(deck);

    // Ballast Beds (Crushed stone gravel bed beneath tracks)
    const ballastMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.95 });
    // Track 1 Ballast (Z = -7)
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(TRACK_LEN, 1.2, 9.5), ballastMat);
    b1.position.set(0, 4.2, -7);
    b1.receiveShadow = true;
    viaductGroup.add(b1);

    // Track 2 Ballast (Z = +7)
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(TRACK_LEN, 1.2, 9.5), ballastMat);
    b2.position.set(0, 4.2, 7);
    b2.receiveShadow = true;
    viaductGroup.add(b2);

    // Wooden Sleepers (Cross-Ties) along both tracks
    const sleeperGeo = new THREE.BoxGeometry(1.6, 0.6, 8.5);
    const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });

    for (let x = -TRACK_LEN / 2 + 3; x <= TRACK_LEN / 2 - 3; x += 3.6) {
      // Track 1 sleeper
      const s1 = new THREE.Mesh(sleeperGeo, sleeperMat);
      s1.position.set(x, 4.9, -7);
      s1.castShadow = true;
      s1.receiveShadow = true;
      viaductGroup.add(s1);

      // Track 2 sleeper
      const s2 = new THREE.Mesh(sleeperGeo, sleeperMat);
      s2.position.set(x, 4.9, 7);
      s2.castShadow = true;
      s2.receiveShadow = true;
      viaductGroup.add(s2);
    }

    // Steel Rails (Continuous metallic rails)
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.3
    });
    const yellowStripeMat = new THREE.MeshBasicMaterial({ color: 0xEAB308 });

    function addRails(zCenter) {
      // Left Rail
      const r1 = new THREE.Mesh(new THREE.BoxGeometry(TRACK_LEN, 0.7, 0.4), railMat);
      r1.position.set(0, 5.5, zCenter - 2.6);
      r1.castShadow = true;
      viaductGroup.add(r1);

      // Right Rail
      const r2 = new THREE.Mesh(new THREE.BoxGeometry(TRACK_LEN, 0.7, 0.4), railMat);
      r2.position.set(0, 5.5, zCenter + 2.6);
      r2.castShadow = true;
      viaductGroup.add(r2);

      // Yellow Center Line
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(TRACK_LEN, 0.05, 0.5), yellowStripeMat);
      stripe.position.set(0, 4.9, zCenter);
      viaductGroup.add(stripe);
    }

    addRails(-7); // Track 1 (Southbound)
    addRails(7);  // Track 2 (Northbound)

    // Concrete Viaduct Piers (Support pillars)
    const pierGeo = new THREE.CylinderGeometry(3.5, 4, 12, 16);
    const pierMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 0.8 });
    for (let px of [-55, 0, 55]) {
      const pier = new THREE.Mesh(pierGeo, pierMat);
      pier.position.set(px, -4, 0);
      pier.castShadow = true;
      pier.receiveShadow = true;
      viaductGroup.add(pier);
    }

    // Miniature Signal Masts (Seoul pin style)
    buildSignalMast(viaductGroup, -40, -11.5, true);  // Track 1 signal (green)
    buildSignalMast(viaductGroup, 40, 11.5, false);   // Track 2 signal (green)

    scene.add(viaductGroup);
  }

  function buildSignalMast(parent, x, z, facingSouth) {
    const mast = new THREE.Group();
    mast.position.set(x, 4.5, z);

    // Steel pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 7, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 })
    );
    pole.position.y = 3.5;
    pole.castShadow = true;
    mast.add(pole);

    // Signal housing box
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.4, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.5 })
    );
    box.position.set(0, 6.2, 0);
    box.castShadow = true;
    mast.add(box);

    // Green LED lens (illuminated)
    const greenLed = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 12),
      new THREE.MeshBasicMaterial({ color: 0x22C55E })
    );
    greenLed.position.set(0, 6.7, facingSouth ? 0.42 : -0.42);
    if (!facingSouth) greenLed.rotation.y = Math.PI;
    mast.add(greenLed);

    // Red LED lens (dim)
    const redLed = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 12),
      new THREE.MeshBasicMaterial({ color: 0x7F1D1D })
    );
    redLed.position.set(0, 5.7, facingSouth ? 0.42 : -0.42);
    if (!facingSouth) redLed.rotation.y = Math.PI;
    mast.add(redLed);

    parent.add(mast);
  }

  // ── 4. Central Station Platform & Dynamic LED Arrival Board ──
  function buildStationPlatform() {
    const platformGroup = new THREE.Group();

    const platLen = 64;
    const platWid = 6.4;
    const platH = 3.6;

    // Platform Concrete Deck
    const slabGeo = new THREE.BoxGeometry(platLen, platH, platWid);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.65,
      metalness: 0.05
    });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.set(0, 5.8, 0);
    slab.castShadow = true;
    slab.receiveShadow = true;
    platformGroup.add(slab);

    // Tactile Yellow Safety Hazard Strips (DMRC Yellow)
    const yellowEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xEAB308,
      roughness: 0.5,
      metalness: 0.1
    });
    // Edge 1 facing Track 1 (Z = -3.1)
    const edge1 = new THREE.Mesh(new THREE.BoxGeometry(platLen, 0.25, 0.65), yellowEdgeMat);
    edge1.position.set(0, 7.7, -platWid / 2 + 0.32);
    edge1.receiveShadow = true;
    platformGroup.add(edge1);

    // Edge 2 facing Track 2 (Z = +3.1)
    const edge2 = new THREE.Mesh(new THREE.BoxGeometry(platLen, 0.25, 0.65), yellowEdgeMat);
    edge2.position.set(0, 7.7, platWid / 2 - 0.32);
    edge2.receiveShadow = true;
    platformGroup.add(edge2);

    // Cantilevered Modern Glass & Steel Canopy Roof
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0xF8FAFC,
      roughness: 0.2,
      transmission: 0.35,
      thickness: 0.8,
      transparent: true,
      opacity: 0.92
    });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(platLen * 0.8, 0.8, platWid + 2.5), canopyMat);
    canopy.position.set(0, 15.5, 0);
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    platformGroup.add(canopy);

    // Stainless Steel Canopy Support Columns
    const colGeo = new THREE.CylinderGeometry(0.35, 0.35, 8, 12);
    const colMat = new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.85, roughness: 0.25 });
    for (let cx of [-20, -7, 7, 20]) {
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(cx, 11.5, 0);
      col.castShadow = true;
      platformGroup.add(col);
    }

    // Platform Downlights under canopy
    for (let lx of [-14, 0, 14]) {
      const pLight = new THREE.PointLight(0xFDE68A, 0.3, 18);
      pLight.position.set(lx, 14.8, 0);
      platformGroup.add(pLight);
      platformLights.push(pLight);
    }

    // Platform Waiting Benches (Wooden slats with steel legs)
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x92400E, roughness: 0.7 });
    for (let bx of [-14, 14]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.0, 1.4), benchMat);
      bench.position.set(bx, 8.2, 0);
      bench.castShadow = true;
      platformGroup.add(bench);
    }

    // Dynamic Canvas Digital Arrival Board (Central Line & Pinterest diorama style)
    buildDigitalArrivalBoard(platformGroup);

    // Subway Pavilion Entrance
    const stairGeo = new THREE.BoxGeometry(8, 3, 3.2);
    const stairMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 0.7 });
    const stairs = new THREE.Mesh(stairGeo, stairMat);
    stairs.position.set(-25, 7.2, 0);
    stairs.castShadow = true;
    platformGroup.add(stairs);

    // Red DMRC Totem Signpost
    const totemPillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.5, 0.8), new THREE.MeshStandardMaterial({ color: 0xE11D48 }));
    totemPillar.position.set(-25, 10.5, 0);
    totemPillar.castShadow = true;
    platformGroup.add(totemPillar);

    scene.add(platformGroup);
  }

  function buildDigitalArrivalBoard(parent) {
    clockCanvas = document.createElement('canvas');
    clockCanvas.width = 512;
    clockCanvas.height = 128;
    clockCtx = clockCanvas.getContext('2d');
    updateClockCanvas();

    clockTexture = new THREE.CanvasTexture(clockCanvas);
    clockTexture.minFilter = THREE.LinearFilter;

    const boardMat = new THREE.MeshBasicMaterial({ map: clockTexture });
    const boardGeo = new THREE.BoxGeometry(9, 2.2, 0.4);
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 13.2, 0);
    board.castShadow = true;
    parent.add(board);
  }

  function updateClockCanvas() {
    if (!clockCtx) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    clockCtx.fillStyle = '#0F172A';
    clockCtx.fillRect(0, 0, 512, 128);

    clockCtx.fillStyle = '#EAB308';
    clockCtx.font = 'bold 26px Inter, monospace';
    clockCtx.fillText(`RAJIV CHOWK · ${timeStr}`, 24, 42);

    clockCtx.fillStyle = '#F8FAFC';
    clockCtx.font = '22px Inter, sans-serif';
    clockCtx.fillText('P1: MILLENNIUM CITY  1 MIN (8-CAR)', 24, 82);

    clockCtx.fillStyle = '#38BDF8';
    clockCtx.fillText('P2: SAMAYPUR BADLI   3 MIN (8-CAR)', 24, 114);

    if (clockTexture) clockTexture.needsUpdate = true;
  }

  // ── 5. Platform Commuters (Stylized Minimalist Figurines) ────
  function buildPlatformCommuters() {
    const commutersGroup = new THREE.Group();

    const commuterPalette = [
      { shirt: 0x2563EB, pants: 0x1E293B }, // Navy suit
      { shirt: 0xE11D48, pants: 0x334155 }, // Crimson top
      { shirt: 0x059669, pants: 0x0F172A }, // Forest green
      { shirt: 0xD97706, pants: 0x475569 }, // Amber
      { shirt: 0xF8FAFC, pants: 0x1E293B }, // White shirt
      { shirt: 0x7C3AED, pants: 0x334155 }  // Violet
    ];

    const headGeo = new THREE.SphereGeometry(0.42, 10, 10);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xFBCFE8, roughness: 0.6 });
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.48, 1.4, 8);
    const legsGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 8);

    // Positions spaced along the platform behind safety edge
    const commuterPos = [
      [-18, -1.2], [-10, 1.4], [-4, -1.0], [3, 1.2], [10, -1.4], [18, 1.0], [22, -1.2]
    ];

    commuterPos.forEach(([x, z], idx) => {
      const c = new THREE.Group();
      c.position.set(x, 7.6, z);

      const pal = commuterPalette[idx % commuterPalette.length];
      const shirtMat = new THREE.MeshStandardMaterial({ color: pal.shirt, roughness: 0.7 });
      const pantsMat = new THREE.MeshStandardMaterial({ color: pal.pants, roughness: 0.8 });

      // Head
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 2.4;
      head.castShadow = true;
      c.add(head);

      // Body (Shirt)
      const body = new THREE.Mesh(bodyGeo, shirtMat);
      body.position.y = 1.4;
      body.castShadow = true;
      c.add(body);

      // Legs
      const legs = new THREE.Mesh(legsGeo, pantsMat);
      legs.position.y = 0.55;
      legs.castShadow = true;
      c.add(legs);

      commutersGroup.add(c);
    });

    scene.add(commutersGroup);
  }

  // ── 6. Build 3D Articulated Delhi Metro Train Consists ───────
  function createTrainMesh(colorLivery) {
    const train = new THREE.Group();

    const carLen = 14;
    const carWid = 4.2;
    const carH = 4.0;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xF8FAFC, // Aerodynamic Silver / White
      metalness: 0.65,
      roughness: 0.28
    });
    const stripeMat = new THREE.MeshBasicMaterial({ color: colorLivery });

    const winMat = new THREE.MeshStandardMaterial({
      color: 0x0F172A,
      metalness: 0.85,
      roughness: 0.15,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
    windowMaterials.push(winMat);

    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xFEF08A });
    headlightMaterials.push(headlightMat);

    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xEF4444 });

    const carOffsets = [-15.5, 0, 15.5];

    carOffsets.forEach((ox, idx) => {
      const carGroup = new THREE.Group();
      carGroup.position.x = ox;

      // Body box
      const body = new THREE.Mesh(new THREE.BoxGeometry(carLen, carH, carWid), bodyMat);
      body.castShadow = true;
      body.receiveShadow = true;
      carGroup.add(body);

      // DMRC Yellow Flank Stripes
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(carLen, 0.5, 0.05), stripeMat);
      s1.position.set(0, -0.4, carWid / 2 + 0.02);
      carGroup.add(s1);

      const s2 = new THREE.Mesh(new THREE.BoxGeometry(carLen, 0.5, 0.05), stripeMat);
      s2.position.set(0, -0.4, -carWid / 2 - 0.02);
      carGroup.add(s2);

      // Windows along flanks
      for (let wx = -4.5; wx <= 4.5; wx += 2.8) {
        const wLeft = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.05), winMat);
        wLeft.position.set(wx, 0.4, carWid / 2 + 0.03);
        carGroup.add(wLeft);

        const wRight = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.05), winMat);
        wRight.position.set(wx, 0.4, -carWid / 2 - 0.03);
        carGroup.add(wRight);
      }

      // Roof HVAC pod
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 2.2), new THREE.MeshStandardMaterial({ color: 0xCBD5E1 }));
      hvac.position.set(0, carH / 2 + 0.3, 0);
      carGroup.add(hvac);

      // Lead Car Aerodynamic Windshield & Headlights
      if (idx === 0) {
        const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, carWid - 0.6), winMat);
        windshield.position.set(-carLen / 2 - 0.02, 0.5, 0);
        carGroup.add(windshield);

        const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), headlightMat);
        hl1.position.set(-carLen / 2 - 0.05, -0.6, -1.2);
        carGroup.add(hl1);

        const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), headlightMat);
        hl2.position.set(-carLen / 2 - 0.05, -0.6, 1.2);
        carGroup.add(hl2);
      }

      // Rear Car Tail Lights
      if (idx === 2) {
        const tl1 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), taillightMat);
        tl1.position.set(carLen / 2 + 0.05, -0.6, -1.2);
        carGroup.add(tl1);

        const tl2 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), taillightMat);
        tl2.position.set(carLen / 2 + 0.05, -0.6, 1.2);
        carGroup.add(tl2);
      }

      train.add(carGroup);
    });

    // Flexible Accordion Gangways
    const gangwayMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    for (let gx of [-7.7, 7.7]) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(1.6, carH - 0.6, carWid - 0.6), gangwayMat);
      g.position.set(gx, 0, 0);
      train.add(g);
    }

    return train;
  }

  function build3DMetroTrains() {
    // Train 1 (Southbound on Track 1, Z = -7)
    train1Group = createTrainMesh(0xEAB308); // DMRC Yellow Line
    train1Group.position.set(0, 7.8, -7);
    scene.add(train1Group);

    // Train 2 (Northbound on Track 2, Z = +7)
    train2Group = createTrainMesh(0xEAB308);
    train2Group.rotation.y = Math.PI; // Heading opposite direction!
    train2Group.position.set(0, 7.8, 7);
    scene.add(train2Group);
  }

  // ── 7. Web Audio API DMRC Chime ─────────────────────────────
  function playDMRCChime() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const notes = [
        { freq: 698.46, start: 0, dur: 0.16 },    // F5
        { freq: 880.00, start: 0.18, dur: 0.16 }, // A5
        { freq: 1046.50, start: 0.36, dur: 0.40 } // C6
      ];

      notes.forEach(n => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, audioCtx.currentTime + n.start);

        gain.gain.setValueAtTime(0.001, audioCtx.currentTime + n.start);
        gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + n.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + n.start + n.dur);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime + n.start);
        osc.stop(audioCtx.currentTime + n.start + n.dur + 0.05);
      });
    } catch (e) {
      console.warn('Web Audio not allowed or failed:', e);
    }
  }

  // ── 8. Bind HUD Controls ────────────────────────────────────
  function bindHUDControls() {
    // Atmosphere Lighting
    const dayBtn = document.getElementById('btn-light-day');
    const sunsetBtn = document.getElementById('btn-light-sunset');
    const nightBtn = document.getElementById('btn-light-night');

    if (dayBtn && sunsetBtn && nightBtn) {
      dayBtn.addEventListener('click', () => {
        [dayBtn, sunsetBtn, nightBtn].forEach(b => b.classList.remove('active'));
        dayBtn.classList.add('active');
        setLightingMode('day');
      });
      sunsetBtn.addEventListener('click', () => {
        [dayBtn, sunsetBtn, nightBtn].forEach(b => b.classList.remove('active'));
        sunsetBtn.classList.add('active');
        setLightingMode('sunset');
      });
      nightBtn.addEventListener('click', () => {
        [dayBtn, sunsetBtn, nightBtn].forEach(b => b.classList.remove('active'));
        nightBtn.classList.add('active');
        setLightingMode('night');
      });
    }

    // Camera Modes
    const camIso = document.getElementById('btn-cam-iso');
    const camPlat = document.getElementById('btn-cam-plat');
    const camT1 = document.getElementById('btn-cam-train1');
    const camT2 = document.getElementById('btn-cam-train2');

    const camButtons = [camIso, camPlat, camT1, camT2].filter(Boolean);
    camButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        camButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (btn === camIso) {
          cameraMode = 'iso';
          camera.position.set(70, 60, 70);
          if (controls) controls.target.set(0, 4, 0);
        } else if (btn === camPlat) {
          cameraMode = 'platform';
          camera.position.set(-18, 9, 0);
          if (controls) controls.target.set(30, 8, -7);
        } else if (btn === camT1) {
          cameraMode = 'chase1';
        } else if (btn === camT2) {
          cameraMode = 'chase2';
        }
      });
    });

    // Kinetics Play / Pause
    const playBtn = document.getElementById('btn-sim-play');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        playBtn.textContent = isPaused ? '▶️ Run' : '⏸️ Pause';
        playBtn.classList.toggle('active', !isPaused);
      });
    }

    // Chime
    const chimeBtn = document.getElementById('btn-play-chime');
    if (chimeBtn) {
      chimeBtn.addEventListener('click', () => {
        playDMRCChime();
      });
    }

    // Speeds
    document.querySelectorAll('[data-3dspeed]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-3dspeed]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        simSpeed = parseFloat(btn.getAttribute('data-3dspeed')) || 1.0;
      });
    });
  }

  // ── 9. Kinematic 60 FPS Animation Loop ──────────────────────
  let lastClockTick = 0;

  function animate() {
    if (!isRunning) return;

    if (!isPaused) {
      // Advance Train 1 (Southbound: Moving in -X direction)
      let dwellFactor1 = 1.0;
      const x1 = (0.5 - t1Progress) * TRACK_LEN;
      if (Math.abs(x1) < 16) dwellFactor1 = 0.3; // Platform dwell deceleration

      t1Progress += 0.0015 * simSpeed * dwellFactor1;
      if (t1Progress > 1.0) t1Progress = 0;
      if (train1Group) train1Group.position.x = (0.5 - t1Progress) * TRACK_LEN;

      // Advance Train 2 (Northbound: Moving in +X direction)
      let dwellFactor2 = 1.0;
      const x2 = (-0.5 + t2Progress) * TRACK_LEN;
      if (Math.abs(x2) < 16) dwellFactor2 = 0.3;

      t2Progress += 0.0013 * simSpeed * dwellFactor2;
      if (t2Progress > 1.0) t2Progress = 0;
      if (train2Group) train2Group.position.x = (-0.5 + t2Progress) * TRACK_LEN;
    }

    // Camera chase modes
    if (cameraMode === 'chase1' && train1Group) {
      const tx = train1Group.position.x;
      camera.position.set(tx + 45, 35, 30);
      if (controls) controls.target.set(tx, 8, -7);
    } else if (cameraMode === 'chase2' && train2Group) {
      const tx = train2Group.position.x;
      camera.position.set(tx - 45, 35, 45);
      if (controls) controls.target.set(tx, 8, 7);
    }

    // Update dynamic clock texture once per second
    const nowMs = performance.now();
    if (nowMs - lastClockTick > 1000) {
      lastClockTick = nowMs;
      updateClockCanvas();
    }

    if (controls) controls.update();
    renderer.render(scene, camera);

    animId = requestAnimationFrame(animate);
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    animId = requestAnimationFrame(animate);
  }

  function stop() {
    isRunning = false;
    if (animId) cancelAnimationFrame(animId);
  }

  function onWindowResize() {
    if (!container || !camera || !renderer) return;
    const aspect = container.clientWidth / container.clientHeight;
    const d = 50;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  return {
    init,
    start,
    stop,
    setLightingMode,
    playDMRCChime
  };
})();
