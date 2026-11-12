/* ============================================================
 * DELHI METRO — Interactive Kit-of-Parts 3D Diorama Engine
 * Powered by window.MetroKit (Materials, PlatformParts,
 * TrackSystem, TrainFactory & StationArchetypes) +
 * Apple-Design Critically-Damped Springs & Smooth Theme Crossfade.
 *
 * Modes:
 *   • 'corridor': Connected 2-Station Corridor
 *       Rajiv Chowk (Underground Island) ↔ Ramp ↔ Qutab Minar (Elevated Side)
 *   • 6 Standalone DMRC Archetypes:
 *       1. elevatedSide            (Qutab Minar)
 *       2. elevatedIsland          (Botanical Garden)
 *       3. undergroundIsland       (Rajiv Chowk)
 *       4. surfaceMultiBay         (Yamuna Bank — 4-Track + Y-Branch)
 *       5. stackedCrossInterchange (Hauz Khas — -12m × -21m Cross)
 *       6. hybridMegaHub           (Kashmere Gate — Elev Red + Tube Yellow)
 * ============================================================ */

window.Diorama3D = (function () {
  'use strict';

  let container = null;
  let canvas = null;
  let scene, camera, renderer, controls;
  let animId = null;
  let isRunning = false;
  let isInitialized = false;
  let simSpeed = 1.0;
  let isPaused = false;
  let soundEnabled = true;

  let rootStage = null;
  let corridorGroup = null;
  let rajivAnchor = null;
  let qutabAnchor = null;

  // Cached standalone archetype stages
  const archetypeCache = new Map();
  let activeStageKey = 'corridor'; // 'corridor' | one of 6 archetype keys

  let sunLight, hemiLight, ambientFill;
  let currentLightingMode = 'day';
  let currentView = 'overview';
  let followTrainMode = false;

  const CORRIDOR_HALF_LEN = 92;
  const RAJIV_X = -48;
  const PORTAL_X = -22;
  const RAMP_END_X = 22;
  const QUTAB_X = 54;
  const TRACK_Z_SOUTH = -3.6;
  const TRACK_Z_NORTH = 3.6;
  const SUBWAY_Y = 0.0;
  const VIADUCT_Y = 10.5;
  const PLINTH_TOP_Y = -10.0;

  // Corridor Fleet Kinematics
  let train1Group = null;
  let train2Group = null;
  let t1X = -2.0;
  let t2X = 46.0;
  let t1Dwell = 0;
  let t2Dwell = 0;
  let t1LastChime = '';
  let t2LastChime = '';

  // Active standalone archetype trains & PIDS references
  let qutabPidsData = null;
  let lastUserInteraction = performance.now();
  let audioCtx = null;

  function M() { return window.MetroKit.Materials; }
  function P() { return window.MetroKit.PlatformParts; }
  function T() { return window.MetroKit.TrackSystem; }
  function F() { return window.MetroKit.TrainFactory; }
  function A() { return window.MetroKit.StationArchetypes; }

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Critically damped physical spring state (damping = 1.0, response = 0.44s)
  const springState = {
    active: false,
    posVel: new THREE.Vector3(),
    lookVel: new THREE.Vector3(),
    zoomVel: 0,
    targetPos: new THREE.Vector3(24, 68, 128),
    targetLook: new THREE.Vector3(4, 3, 0),
    targetZoom: 1.0
  };

  // Smooth Theme Transition Targets (Apple Design §14)
  const themeTargets = {
    bg: new THREE.Color(0xEFEAE0),
    hemiSky: new THREE.Color(0xFFFDF8),
    hemiGround: new THREE.Color(0xC6B9A6),
    hemiIntensity: 0.72,
    ambientIntensity: 0.20,
    sunColor: new THREE.Color(0xFFF4DC),
    sunIntensity: 0.98,
    winEmissiveIntensity: 0.14,
    ugLightIntensity: 1.45,
    elLightIntensity: 0.42,
    stLightIntensity: 0.25,
    animating: false
  };

  function getTrackY(x) {
    if (x <= PORTAL_X) return SUBWAY_Y;
    if (x >= RAMP_END_X) return VIADUCT_Y;
    const t = (x - PORTAL_X) / (RAMP_END_X - PORTAL_X);
    return SUBWAY_Y + (VIADUCT_Y - SUBWAY_Y) * (t * t * (3 - 2 * t));
  }

  function getTrackPitch(x) {
    if (x <= PORTAL_X || x >= RAMP_END_X) return 0;
    const span = RAMP_END_X - PORTAL_X;
    const t = (x - PORTAL_X) / span;
    return Math.atan((VIADUCT_Y - SUBWAY_Y) * (6 * t * (1 - t)) / span);
  }

  function stepCriticallyDampedScalar(val, vel, target, responseSec, dt) {
    const omega = (2 * Math.PI) / Math.max(0.12, responseSec);
    const x = val - target;
    const exp = Math.exp(-omega * dt);
    const nextVal = target + (x + (vel + omega * x) * dt) * exp;
    const nextVel = (vel - omega * (vel + omega * x) * dt) * exp;
    return [nextVal, nextVel];
  }

  // ── INITIALIZATION ──────────────────────────────────────────
  function init(containerEl) {
    if (!containerEl) return;
    if (isInitialized) {
      onWindowResize();
      return;
    }
    isInitialized = true;
    container = containerEl;
    canvas = document.getElementById('three-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'three-canvas';
      container.prepend(canvas);
    }

    M().resetDynamicPools();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xEFEAE0);
    scene.fog = new THREE.FogExp2(0xEFEAE0, 0.0012);

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const aspect = w / h;
    const d = 60;
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1400);
    camera.position.set(24, 68, 128);
    camera.lookAt(4, 3, 0);

    const isMobileDio = window.innerWidth <= 860 || (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: !isMobileDio,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobileDio ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.90;

    if (window.THREE && window.THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.075;
      controls.maxPolarAngle = Math.PI / 2.12;
      controls.minPolarAngle = Math.PI / 9;
      controls.minZoom = 0.60;
      controls.maxZoom = 3.5;
      controls.target.set(4, 3, 0);

      controls.addEventListener('start', () => {
        lastUserInteraction = performance.now();
        controls.autoRotate = false;
        springState.active = false;
        springState.posVel.set(0, 0, 0);
        springState.lookVel.set(0, 0, 0);
        springState.zoomVel = 0;
        if (followTrainMode) {
          followTrainMode = false;
          const followBtn = document.getElementById('btn-follow-train-3d');
          if (followBtn) followBtn.classList.remove('active');
        }
      });
      controls.addEventListener('change', () => {
        lastUserInteraction = performance.now();
      });
    }

    setupLighting();

    rootStage = new THREE.Group();
    scene.add(rootStage);

    // Build shared shadow catcher beneath everything
    const shadowFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(540, 360),
      new THREE.ShadowMaterial({ opacity: 0.16 })
    );
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = -24.8;
    shadowFloor.receiveShadow = true;
    rootStage.add(shadowFloor);

    corridorGroup = buildConnectedTwoStationCorridor();
    rootStage.add(corridorGroup);

    setupStationClicking();
    bindHUDControls();

    window.addEventListener('pointerdown', () => {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
      } catch (e) {}
    }, { once: true });
    window.addEventListener('resize', onWindowResize);

    setLightingMode('day');
    switchStage('corridor', true);
  }

  function setupLighting() {
    hemiLight = new THREE.HemisphereLight(0xFFFDF8, 0xC6B9A6, 0.72);
    scene.add(hemiLight);

    ambientFill = new THREE.AmbientLight(0xFFF7E5, 0.20);
    scene.add(ambientFill);

    sunLight = new THREE.DirectionalLight(0xFFF4DC, 0.98);
    sunLight.position.set(76, 112, 74);
    sunLight.castShadow = true;
    const dioShadowRes = (window.innerWidth <= 860 || (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024)) ? 1024 : 2048;
    sunLight.shadow.mapSize.width = dioShadowRes;
    sunLight.shadow.mapSize.height = dioShadowRes;
    sunLight.shadow.camera.near = 15;
    sunLight.shadow.camera.far = 380;
    const shadowExtent = 130;
    sunLight.shadow.camera.left = -shadowExtent;
    sunLight.shadow.camera.right = shadowExtent;
    sunLight.shadow.camera.top = shadowExtent;
    sunLight.shadow.camera.bottom = -shadowExtent;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);
  }

  // ── CORRIDOR BUILDER (COMPOSED PURELY FROM METROKIT!) ───────
  function buildConnectedTwoStationCorridor() {
    const cg = new THREE.Group();
    const mat = M().shared();

    // 1. Continuous Plinth & Delhi Arterial Urban Context
    M().addBox(cg, 178, 6.2, 60, mat.plinth, 7, PLINTH_TOP_Y - 3.1, -1);
    M().addBox(cg, 175, 0.8, 57, mat.plinthTrim, 7, PLINTH_TOP_Y - 6.6, -1);
    M().addBox(cg, 118, 0.7, 56, mat.sageGround, 37, PLINTH_TOP_Y + 0.35, -1);

    const roadLineMat = new THREE.MeshBasicMaterial({ color: 0xFAF8F3 });
    M().addBox(cg, 112, 0.16, 13.0, mat.roadSandstone, 39, PLINTH_TOP_Y + 0.76, 13.5);
    M().addBox(cg, 13.0, 0.17, 52.0, mat.roadSandstone, 38, PLINTH_TOP_Y + 0.77, -1);
    for (let z = -22; z <= 22; z += 5.0) M().addBox(cg, 0.35, 0.18, 2.2, roadLineMat, 38, PLINTH_TOP_Y + 0.79, z, false);
    for (let x = -12; x <= 88; x += 6.0) M().addBox(cg, 2.6, 0.18, 0.32, roadLineMat, x, PLINTH_TOP_Y + 0.79, 13.5, false);
    for (let zx = 33; zx <= 43; zx += 1.8) {
      M().addBox(cg, 0.75, 0.19, 2.2, roadLineMat, zx, PLINTH_TOP_Y + 0.80, 4.5, false);
      M().addBox(cg, 0.75, 0.19, 2.2, roadLineMat, zx, PLINTH_TOP_Y + 0.80, 22.0, false);
    }

    [[28, 11.2, Math.PI / 2], [41, 18.0, 0.1], [64, 15.8, -Math.PI / 2]].forEach(([ax, az, r]) => {
      const a = new THREE.Group();
      a.position.set(ax, PLINTH_TOP_Y + 0.88, az);
      a.rotation.y = r;
      M().addBox(a, 1.35, 0.65, 2.3, M().stdMat(0x16A34A), 0, 0.42, 0);
      M().addBox(a, 1.28, 0.80, 1.85, M().stdMat(0xFACC15), 0, 1.12, -0.1);
      cg.add(a);
    });

    [[14, 11, 10, 11, -21], [28, 8.5, 9, 9, -22], [78, 12.5, 11, 10, -21], [89, 9.5, 9, 9, -19]].forEach(([bx, bh, bw, bd, bz]) => {
      M().addBox(cg, bw, bh, bd, mat.buildingFacade, bx, PLINTH_TOP_Y + 0.7 + bh / 2, bz);
    });

    [[-8, -18, 0.95], [8, -20, 1.05], [22, -16, 0.9], [66, -18, 1.0], [88, -11, 0.95],
     [-6, 22, 1.0], [14, 22, 0.9], [26, 22, 1.05], [56, 22, 1.0], [74, 22, 0.95], [88, 22, 0.9]
    ].forEach(([tx, tz, sc]) => {
      const tree = new THREE.Group();
      tree.position.set(tx, PLINTH_TOP_Y + 0.7, tz);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * sc, 0.34 * sc, 2.8 * sc, 6), M().stdMat(0x5C4033));
      trunk.position.y = 1.4 * sc; trunk.castShadow = true; tree.add(trunk);
      const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7 * sc, 1), M().stdMat(0x4D7C4D, { flatShading: true }));
      c1.position.y = 3.6 * sc; c1.castShadow = true; tree.add(c1);
      cg.add(tree);
    });

    P().buildStreetTotem(cg, 29, PLINTH_TOP_Y + 0.7, 21.5);

    // 2. Left Station (Rajiv Chowk Underground Island) & Right Station (Qutab Minar Elevated Side)
    const rajivRes = A().buildUndergroundIsland(cg, { xCenter: RAJIV_X, plinthTopY: PLINTH_TOP_Y });
    rajivAnchor = rajivRes.group;

    const qutabRes = A().buildElevatedSide(cg, { xCenter: QUTAB_X, yViaduct: VIADUCT_Y, plinthTopY: PLINTH_TOP_Y });
    qutabAnchor = qutabRes.group;
    qutabPidsData = qutabRes.pids;

    // 3. Center Tunnel Portal Headwall & Box-Girder Transition Ramp
    const portalVoidMat = new THREE.MeshBasicMaterial({ color: 0x050912 });
    M().addBox(cg, 3.2, 27.0, 12.0, mat.concreteLight, PORTAL_X, 3.5, -15.5);
    M().addBox(cg, 3.2, 18.0, 2.8, mat.concreteLight, PORTAL_X, -1.0, 0);
    M().addBox(cg, 3.2, 11.8, 9.0, mat.concreteLight, PORTAL_X, -4.1, 10.8);
    M().addBox(cg, 3.6, 10.0, 24.5, mat.concreteLight, PORTAL_X, 11.8, -5.0);

    [TRACK_Z_SOUTH, TRACK_Z_NORTH].forEach((tz) => {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.38, 10, 22, Math.PI), mat.concreteWeb);
      arch.position.set(PORTAL_X + 1.75, 2.3, tz);
      arch.rotation.y = Math.PI / 2;
      arch.castShadow = true;
      cg.add(arch);
      const sig = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), mat.ledGreen);
      sig.position.set(PORTAL_X + 2.1, 5.25, tz);
      cg.add(sig);
      M().addBox(cg, 0.35, 4.8, 4.8, portalVoidMat, PORTAL_X - 1.4, 2.4, tz, false);
    });

    const stepX = (RAMP_END_X - PORTAL_X) / 22;
    for (let i = 0; i < 22; i++) {
      const x0 = PORTAL_X + i * stepX;
      const x1 = x0 + stepX;
      const xm = (x0 + x1) * 0.5;
      const y0 = getTrackY(x0);
      const y1 = getTrackY(x1);
      const ym = (y0 + y1) * 0.5;
      if (xm < 1.0) {
        const fillH = ym - PLINTH_TOP_Y;
        M().addBox(cg, stepX + 0.12, fillH, 11.0, mat.concreteWeb, xm, PLINTH_TOP_Y + fillH / 2, 0);
      }
      T().buildBoxGirderSegment(cg, { x: xm, y: ym, length: Math.hypot(stepX, y1 - y0) + 0.22, width: 11.8, pitch: Math.atan2(y1 - y0, stepX) });
    }
    [7, 21].forEach(px => T().buildDMRCViaductPier(cg, { x: px, bottomY: PLINTH_TOP_Y + 0.7, topDeckBottomY: getTrackY(px) }));
    T().buildBoxGirderSegment(cg, { x: 26.5, y: VIADUCT_Y, length: 10.5, width: 11.8 });
    T().buildBoxGirderSegment(cg, { x: 86.5, y: VIADUCT_Y, length: 18.0, width: 11.8 });

    // East Exhibition End-Cap & Buffer Stops
    M().addBox(cg, 0.45, 2.4, 12.0, mat.concreteWeb, 95.3, VIADUCT_Y - 0.65, 0);
    [TRACK_Z_SOUTH, TRACK_Z_NORTH].forEach(tz => M().addBox(cg, 0.55, 0.85, 2.2, M().stdMat(0xDC2626), 94.5, VIADUCT_Y + 0.48, tz));

    // 4. Continuous Instanced Dual Tracks & OHE
    T().buildTracksAlongAxis(cg, {
      xStart: -74, xEnd: 94, trackZs: [TRACK_Z_SOUTH, TRACK_Z_NORTH],
      lineColor: M().LINE_COLORS.yellow, yFn: getTrackY, pitchFn: getTrackPitch,
      oheStart: -20, oheXs: [-16, -3, 10, 20, 82, 91]
    });

    // 5. Articulated Corridor Trains
    train1Group = F().createArticulatedTrain({ lineColor: M().LINE_COLORS.yellow, carCount: 3, directionSign: -1 });
    F().updateTrainOnAxis(train1Group, t1X, TRACK_Z_SOUTH, 'x', getTrackY, getTrackPitch);
    cg.add(train1Group);

    train2Group = F().createArticulatedTrain({ lineColor: M().LINE_COLORS.yellow, carCount: 3, directionSign: 1 });
    F().updateTrainOnAxis(train2Group, t2X, TRACK_Z_NORTH, 'x', getTrackY, getTrackPitch);
    cg.add(train2Group);

    return cg;
  }

  // ── STANDALONE ARCHETYPE STAGE BUILDER (ALL 6 KIT TYPES!) ─────
  const STAGE_METADATA = {
    corridor: {
      tag: 'DELHI METRO 3D · TWO-STATION KIT CORRIDOR',
      title: 'Rajiv Chowk (Underground Island) ↔ Qutab Minar (Elevated Side)',
      pos: [30, 68, 134], look: [11, 3, 0], zoom: 0.96,
      platformPos: [-8, 22, 74], platformLook: [8, 6.5, 0], platformZoom: 1.60
    },
    elevatedSide: {
      tag: 'ARCHETYPE 1 · ELEVATED SIDE-PLATFORM (2 TRACKS, 2 OUTER DECKS)',
      title: 'Qutab Minar — Blue Arch Canopy, Lift Wing & Glazed Concourse',
      pos: [80, 48, 86], look: [54, 7.5, 1], zoom: 1.85,
      platformPos: [20, 18.5, 34], platformLook: [54, 12.2, 0], platformZoom: 2.35
    },
    elevatedIsland: {
      tag: 'ARCHETYPE 2 · ELEVATED ISLAND-PLATFORM (SPLIT TRACKS, CENTRAL DECK)',
      title: 'Botanical Garden — Blue × Magenta Split-Track Island Viaduct',
      pos: [34, 46, 84], look: [0, 7.5, 0], zoom: 1.75,
      platformPos: [-32, 18.5, 28], platformLook: [4, 12.2, 0], platformZoom: 2.30
    },
    undergroundIsland: {
      tag: 'ARCHETYPE 3 · UNDERGROUND CUTAWAY ISLAND (-12m TBM CHAMBER)',
      title: 'Rajiv Chowk — TBM Collars, PSDs, Mezzanine AFC & Escalators',
      pos: [-18, 44, 82], look: [-46, 4.5, -2], zoom: 1.75,
      platformPos: [-74, 8.5, 30], platformLook: [-44, 2.8, 0], platformZoom: 2.30
    },
    surfaceMultiBay: {
      tag: 'ARCHETYPE 4 · AT-GRADE 4-TRACK Y-BRANCH JUNCTION (SURFACE)',
      title: 'Yamuna Bank — 4 Tracks, 2 Islands, Y-Turnout & Overhead FOB',
      pos: [36, 54, 96], look: [2, 2.5, 2], zoom: 1.48,
      platformPos: [40, 12.0, 44], platformLook: [0, 3.2, 4], platformZoom: 2.05
    },
    stackedCrossInterchange: {
      tag: 'ARCHETYPE 5 · CROSS-STACKED UNDERGROUND (-12m × -21m ORTHOGONAL)',
      title: 'Hauz Khas — Yellow E–W Over Magenta N–S Transfer Core',
      pos: [52, 54, 82], look: [0, -3.5, 0], zoom: 1.42,
      platformPos: [38, 6.0, 40], platformLook: [0, -4.5, 0], platformZoom: 1.95
    },
    hybridMegaHub: {
      tag: 'ARCHETYPE 6 · HYBRID MEGA INTERCHANGE (ELEVATED + UNDERGROUND)',
      title: 'Kashmere Gate — Red Elevated (+14m) Over Yellow Tube (-12m)',
      pos: [38, 52, 92], look: [0, 6.0, 0], zoom: 1.55,
      platformPos: [34, 13.5, 42], platformLook: [0, 6.5, 0], platformZoom: 2.05
    }
  };

  function getOrBuildArchetypeStage(key) {
    if (archetypeCache.has(key)) return archetypeCache.get(key);

    const stage = new THREE.Group();
    const trains = [];
    let branchCurve = null;

    if (key === 'elevatedSide') {
      A().buildElevatedSide(stage, { xCenter: 54, yViaduct: 10.5, standalonePlinth: true });
      const tr = F().createArticulatedTrain({ lineColor: M().LINE_COLORS.yellow, carCount: 4, directionSign: 1 });
      stage.add(tr);
      trains.push({ group: tr, x: 38, minX: 16, maxX: 92, dir: 1, z: 3.6, y: 10.5, axis: 'x' });
    } else if (key === 'elevatedIsland') {
      A().buildElevatedIsland(stage, { xCenter: 0, yViaduct: 10.5 });
      const tr1 = F().createArticulatedTrain({ lineColor: M().LINE_COLORS.blue, carCount: 4, directionSign: -1 });
      const tr2 = F().createArticulatedTrain({ lineColor: M().LINE_COLORS.magenta, carCount: 4, directionSign: 1 });
      stage.add(tr1, tr2);
      trains.push({ group: tr1, x: 10, minX: -40, maxX: 40, dir: -1, z: -4.9, y: 10.5, axis: 'x' });
      trains.push({ group: tr2, x: -14, minX: -40, maxX: 40, dir: 1, z: 4.9, y: 10.5, axis: 'x' });
    } else if (key === 'undergroundIsland') {
      A().buildUndergroundIsland(stage, { xCenter: -48, standalonePlinth: true });
      const tr = F().createArticulatedTrain({ lineColor: M().LINE_COLORS.yellow, carCount: 3, directionSign: 1 });
      stage.add(tr);
      trains.push({ group: tr, x: -50, minX: -72, maxX: -14, dir: 1, z: 3.6, y: 0, axis: 'x' });
    } else if (key === 'surfaceMultiBay') {
      const res = A().buildSurfaceMultiBay(stage, { xCenter: 0 });
      branchCurve = res.branchCurve;
      const tr1 = F().createArticulatedTrain({ lineColor: M().LINE_COLORS.blue, carCount: 4, directionSign: -1 });
      const tr2 = F().createArticulatedTrain({ lineColor: M().LINE_COLORS.blue, carCount: 4, directionSign: 1 });
      const trBranch = F().createArticulatedTrain({ lineColor: M().LINE_COLORS.blue, carCount: 3, directionSign: 1 });
      stage.add(tr1, tr2, trBranch);
      trains.push({ group: tr1, x: 14, minX: -46, maxX: 46, dir: -1, z: -11.5, y: 0.18, axis: 'x' });
      trains.push({ group: tr2, x: -16, minX: -46, maxX: 46, dir: 1, z: 4.5, y: 0.18, axis: 'x' });
      trains.push({ group: trBranch, curve: branchCurve, dist: 16, totalLen: branchCurve.getLength(), speed: 9.0 });
    } else if (key === 'stackedCrossInterchange') {
      const res = A().buildStackedCrossInterchange(stage, { xCenter: 0 });
      const trU = F().createArticulatedTrain({ lineColor: M().LINE_COLORS.yellow, carCount: 3, directionSign: -1 });
      const trL = F().createArticulatedTrain({ lineColor: M().LINE_COLORS.magenta, carCount: 3, directionSign: 1 });
      stage.add(trU, trL);
      trains.push({ group: trU, x: 6, minX: -32, maxX: 32, dir: -1, z: -3.6, y: res.upperY, axis: 'x' });
      trains.push({ group: trL, x: -6, minX: -32, maxX: 32, dir: 1, z: 3.6, y: res.lowerY, axis: 'z' });
    } else if (key === 'hybridMegaHub') {
      A().buildHybridMegaHub(stage, { xCenter: 0, yViaduct: 12.5 });
      const trTop = F().createArticulatedTrain({ lineColor: M().LINE_COLORS.red, carCount: 4, directionSign: -1 });
      const trBot = F().createArticulatedTrain({ lineColor: M().LINE_COLORS.yellow, carCount: 3, directionSign: 1 });
      stage.add(trTop, trBot);
      trains.push({ group: trTop, x: 8, minX: -40, maxX: 40, dir: -1, z: -3.6, y: 12.5, axis: 'x' });
      trains.push({ group: trBot, x: -8, minX: -40, maxX: 40, dir: 1, z: 3.6, y: 0.0, axis: 'x' });
    }

    const entry = { group: stage, trains };
    archetypeCache.set(key, entry);
    return entry;
  }

  function switchStage(stageKey, immediate = false) {
    activeStageKey = STAGE_METADATA[stageKey] ? stageKey : 'corridor';
    const isCorridor = activeStageKey === 'corridor';

    if (corridorGroup) corridorGroup.visible = isCorridor;
    archetypeCache.forEach((entry, k) => {
      entry.group.visible = (!isCorridor && k === activeStageKey);
    });

    if (!isCorridor) {
      const entry = getOrBuildArchetypeStage(activeStageKey);
      if (!entry.group.parent && rootStage) rootStage.add(entry.group);
      entry.group.visible = true;
    }

    // Re-apply lighting intensities to newly created pools
    setLightingMode(currentLightingMode);

    // Update active chip styling for Kit buttons
    document.querySelectorAll('[data-kit]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-kit') === activeStageKey);
    });

    const meta = STAGE_METADATA[activeStageKey];
    const tagEl = document.querySelector('.diorama-tag');
    const titleEl = document.getElementById('diorama-stage-title');
    if (tagEl) tagEl.textContent = meta.tag;
    if (titleEl) titleEl.textContent = meta.title;

    if (isCorridor) {
      setCameraView('overview', immediate);
    } else {
      currentView = 'overview';
      followTrainMode = false;
      const followBtn = document.getElementById('btn-follow-train-3d');
      if (followBtn) followBtn.classList.remove('active');
      document.getElementById('btn-arch-both')?.classList.remove('active');
      document.getElementById('btn-arch-tube')?.classList.remove('active');
      document.getElementById('btn-arch-viaduct')?.classList.remove('active');
      document.getElementById('btn-cam-iso')?.classList.add('active');
      document.getElementById('btn-cam-platform')?.classList.remove('active');
      applyCameraTarget(meta.pos, meta.look, meta.zoom, immediate);
    }
  }

  // ── CAMERA SPRINGS & THEME INTERPOLATION ────────────────────
  function applyCameraTarget(posArr, lookArr, zoomVal, immediate) {
    if (!camera) return;
    springState.targetPos.set(posArr[0], posArr[1], posArr[2]);
    springState.targetLook.set(lookArr[0], lookArr[1], lookArr[2]);
    springState.targetZoom = zoomVal;

    if (immediate || prefersReducedMotion()) {
      camera.position.copy(springState.targetPos);
      camera.zoom = springState.targetZoom;
      camera.updateProjectionMatrix();
      if (controls) {
        controls.target.copy(springState.targetLook);
        controls.update();
      }
      springState.posVel.set(0, 0, 0);
      springState.lookVel.set(0, 0, 0);
      springState.zoomVel = 0;
      springState.active = false;
    } else {
      springState.active = true;
    }
  }

  function setCameraView(viewName, immediate = false) {
    if (!camera) return;
    // Corridor-only presets switch back to the 2-station corridor; overview/platform preserve active stage!
    if ((viewName === 'rajiv' || viewName === 'qutab') && activeStageKey !== 'corridor') {
      switchStage('corridor', false);
    }
    currentView = viewName || 'overview';
    if (viewName !== 'follow') {
      followTrainMode = false;
      document.getElementById('btn-follow-train-3d')?.classList.remove('active');
    }

    const meta = STAGE_METADATA[activeStageKey] || STAGE_METADATA.corridor;
    const tagEl = document.querySelector('.diorama-tag');
    const titleEl = document.getElementById('diorama-stage-title');

    if (currentView === 'rajiv') {
      applyCameraTarget([-22, 46, 82], [RAJIV_X + 4, 4.5, -3], 1.95, immediate);
      if (tagEl) tagEl.textContent = 'UNDERGROUND ISLAND STATION · RAJIV CHOWK (-12M)';
      if (titleEl) titleEl.textContent = 'Rajiv Chowk (Mezzanine, PSDs & TBM Cutaway) ↔ Qutab Minar';
    } else if (currentView === 'qutab') {
      applyCameraTarget([82, 46, 88], [QUTAB_X + 6, 7.5, 1], 2.05, immediate);
      if (tagEl) tagEl.textContent = 'ELEVATED SIDE-PLATFORM VIADUCT · QUTAB MINAR (+14M)';
      if (titleEl) titleEl.textContent = 'Qutab Minar (Blue Canopy, Glass Concourse & Piers) ↔ Rajiv Chowk';
    } else if (currentView === 'platform') {
      applyCameraTarget(meta.platformPos, meta.platformLook, meta.platformZoom, immediate);
      if (activeStageKey === 'corridor') {
        if (tagEl) tagEl.textContent = 'TRACK-LEVEL PERSPECTIVE · RAMP TRANSITION';
        if (titleEl) titleEl.textContent = 'Rajiv Chowk Portal ➔ Box-Girder Ramp ➔ Qutab Minar';
      } else {
        if (tagEl) tagEl.textContent = meta.tag + ' · PLATFORM EYE LEVEL';
        if (titleEl) titleEl.textContent = meta.title;
      }
    } else {
      applyCameraTarget(meta.pos, meta.look, meta.zoom, immediate);
      if (tagEl) tagEl.textContent = meta.tag;
      if (titleEl) titleEl.textContent = meta.title;
    }

    document.getElementById('btn-arch-tube')?.classList.toggle('active', activeStageKey === 'corridor' && currentView === 'rajiv');
    document.getElementById('btn-arch-viaduct')?.classList.toggle('active', activeStageKey === 'corridor' && currentView === 'qutab');
    document.getElementById('btn-arch-both')?.classList.toggle('active', activeStageKey === 'corridor' && currentView === 'overview');
    document.getElementById('btn-cam-iso')?.classList.toggle('active', currentView === 'overview');
    document.getElementById('btn-cam-platform')?.classList.toggle('active', currentView === 'platform');
  }

  function setArchetype(type) {
    if (type === 'underground') setCameraView('rajiv');
    else if (type === 'elevated') setCameraView('qutab');
    else setCameraView('overview');
  }

  function setLightingMode(mode) {
    currentLightingMode = mode === 'night' ? 'night' : 'day';
    const isNight = currentLightingMode === 'night';

    if (isNight) {
      themeTargets.bg.setHex(0x080E1B);
      themeTargets.hemiSky.setHex(0x1E293B);
      themeTargets.hemiGround.setHex(0x0B1120);
      themeTargets.hemiIntensity = 0.44;
      themeTargets.ambientIntensity = 0.22;
      themeTargets.sunColor.setHex(0x7DD3FC);
      themeTargets.sunIntensity = 0.56;
      if (sunLight) sunLight.position.set(-70, 90, 50);
      themeTargets.winEmissiveIntensity = 0.95;
      themeTargets.ugLightIntensity = 2.4;
      themeTargets.elLightIntensity = 1.9;
      themeTargets.stLightIntensity = 1.8;
      M().windowMaterials.forEach(m => m.emissive.setHex(0xFDE047));
      M().headlightMaterials.forEach(m => m.color.setHex(0xFEF9C3));
    } else {
      themeTargets.bg.setHex(0xEFEAE0);
      themeTargets.hemiSky.setHex(0xFFFDF8);
      themeTargets.hemiGround.setHex(0xC6B9A6);
      themeTargets.hemiIntensity = 0.72;
      themeTargets.ambientIntensity = 0.20;
      themeTargets.sunColor.setHex(0xFFF4DC);
      themeTargets.sunIntensity = 0.98;
      if (sunLight) sunLight.position.set(76, 112, 74);
      themeTargets.winEmissiveIntensity = 0.14;
      themeTargets.ugLightIntensity = 1.45;
      themeTargets.elLightIntensity = 0.42;
      themeTargets.stLightIntensity = 0.25;
      M().windowMaterials.forEach(m => m.emissive.setHex(0xF59E0B));
      M().headlightMaterials.forEach(m => m.color.setHex(0xFEF08A));
    }
    themeTargets.animating = true;

    document.getElementById('btn-light-day')?.classList.toggle('active', !isNight);
    document.getElementById('btn-light-night')?.classList.toggle('active', isNight);
    [
      document.querySelector('.three-hud-panel'),
      document.querySelector('.three-header-pill'),
      document.querySelector('.three-instruction-badge'),
      document.querySelector('.master-mode-strip'),
      document.querySelector('.station-search-container')
    ].forEach(el => { if (el) el.classList.toggle('dark-hud', isNight); });
  }

  function applyThemeTransition(dt) {
    if (!themeTargets.animating || !scene) return;
    const rate = prefersReducedMotion() ? 1.0 : Math.min(1.0, 1 - Math.exp(-9.0 * dt));

    scene.background.lerp(themeTargets.bg, rate);
    if (scene.fog) scene.fog.color.lerp(themeTargets.bg, rate);
    if (hemiLight) {
      hemiLight.color.lerp(themeTargets.hemiSky, rate);
      hemiLight.groundColor.lerp(themeTargets.hemiGround, rate);
      hemiLight.intensity += (themeTargets.hemiIntensity - hemiLight.intensity) * rate;
    }
    if (ambientFill) ambientFill.intensity += (themeTargets.ambientIntensity - ambientFill.intensity) * rate;
    if (sunLight) {
      sunLight.color.lerp(themeTargets.sunColor, rate);
      sunLight.intensity += (themeTargets.sunIntensity - sunLight.intensity) * rate;
    }
    M().windowMaterials.forEach(m => { m.emissiveIntensity += (themeTargets.winEmissiveIntensity - m.emissiveIntensity) * rate; });
    M().undergroundLights.forEach(l => { l.intensity += (themeTargets.ugLightIntensity - l.intensity) * rate; });
    M().elevatedLights.forEach(l => { l.intensity += (themeTargets.elLightIntensity - l.intensity) * rate; });
    M().streetLampLights.forEach(l => { l.intensity += (themeTargets.stLightIntensity - l.intensity) * rate; });

    if (rate >= 0.999 || Math.abs(hemiLight.intensity - themeTargets.hemiIntensity) < 0.002) {
      scene.background.copy(themeTargets.bg);
      if (scene.fog) scene.fog.color.copy(themeTargets.bg);
      themeTargets.animating = false;
    }
  }

  function playDMRCChime() {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      [{ freq: 698.46, start: 0, dur: 0.16 }, { freq: 880.00, start: 0.18, dur: 0.16 }, { freq: 1046.50, start: 0.36, dur: 0.38 }].forEach(n => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, audioCtx.currentTime + n.start);
        gain.gain.setValueAtTime(0.001, audioCtx.currentTime + n.start);
        gain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + n.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + n.start + n.dur);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + n.start);
        osc.stop(audioCtx.currentTime + n.start + n.dur + 0.04);
      });
    } catch (e) {}
  }

  function setupStationClicking() {
    if (!renderer || !renderer.domElement) return;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0, downY = 0;

    renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (!isRunning || activeStageKey !== 'corridor') return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([rajivAnchor, qutabAnchor].filter(Boolean), true);
      if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj) {
          if (obj === rajivAnchor) { setCameraView('rajiv'); return; }
          if (obj === qutabAnchor) { setCameraView('qutab'); return; }
          obj = obj.parent;
        }
      }
    });
  }

  function bindHUDControls() {
    document.getElementById('btn-arch-both')?.addEventListener('click', (e) => { e.stopPropagation(); setCameraView('overview'); });
    document.getElementById('btn-arch-tube')?.addEventListener('click', (e) => { e.stopPropagation(); setCameraView('rajiv'); });
    document.getElementById('btn-arch-viaduct')?.addEventListener('click', (e) => { e.stopPropagation(); setCameraView('qutab'); });
    document.getElementById('btn-cam-iso')?.addEventListener('click', (e) => { e.stopPropagation(); setCameraView('overview'); });
    document.getElementById('btn-cam-platform')?.addEventListener('click', (e) => { e.stopPropagation(); setCameraView('platform'); });
    document.getElementById('btn-light-day')?.addEventListener('click', (e) => { e.stopPropagation(); if (isRunning) setLightingMode('day'); });
    document.getElementById('btn-light-night')?.addEventListener('click', (e) => { e.stopPropagation(); if (isRunning) setLightingMode('night'); });
    document.getElementById('btn-play-chime')?.addEventListener('click', (e) => { e.stopPropagation(); if (isRunning) playDMRCChime(); });

    const followBtn = document.getElementById('btn-follow-train-3d');
    if (followBtn) {
      followBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isRunning) return;
        followTrainMode = !followTrainMode;
        followBtn.classList.toggle('active', followTrainMode);
        if (followTrainMode) {
          springState.targetZoom = activeStageKey === 'corridor' ? 1.9 : 2.15;
          springState.active = true;
        } else {
          setCameraView('overview');
        }
      });
    }

    const pauseBtn = document.getElementById('btn-sim-toggle');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isRunning) return;
        isPaused = !isPaused;
        pauseBtn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
        pauseBtn.classList.toggle('active', !isPaused);
      });
    }

    document.querySelectorAll('[data-kit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isRunning) return;
        switchStage(btn.getAttribute('data-kit'));
      });
    });
  }

  // ── KINEMATIC 60 FPS SPRING LOOP ────────────────────────────
  let lastClockTick = 0;
  let lastFrameMs = performance.now();

  function stepCorridorTrain(xVal, dir, dwellTimer, lastChime, stepScale) {
    const distRajiv = Math.abs(xVal - RAJIV_X);
    const distQutab = Math.abs(xVal - QUTAB_X);
    const nearStation = distRajiv < 1.4 ? 'rajiv' : (distQutab < 1.4 ? 'qutab' : '');

    if (nearStation && dwellTimer < 1.8) {
      if (lastChime !== nearStation) { playDMRCChime(); lastChime = nearStation; }
      dwellTimer += stepScale;
      xVal += dir * 0.72 * stepScale * simSpeed;
    } else {
      if (distRajiv > 8.0 && distQutab > 8.0) lastChime = '';
      dwellTimer = 0;
      const braking = (distRajiv < 12.0 || distQutab < 12.0) ? 0.48 : 1.0;
      xVal += dir * 14.4 * stepScale * simSpeed * braking;
    }

    if (dir === -1 && xVal < -CORRIDOR_HALF_LEN) xVal = CORRIDOR_HALF_LEN + 12;
    if (dir === 1 && xVal > CORRIDOR_HALF_LEN + 12) xVal = -CORRIDOR_HALF_LEN;

    return { xVal, dwellTimer, lastChime };
  }

  function animate() {
    if (!isRunning) return;

    const nowMs = performance.now();
    const dt = Math.min(0.08, Math.max(0.001, (nowMs - lastFrameMs) / 1000));
    lastFrameMs = nowMs;

    if (!isPaused) {
      if (activeStageKey === 'corridor') {
        const s1 = stepCorridorTrain(t1X, -1, t1Dwell, t1LastChime, dt);
        t1X = s1.xVal; t1Dwell = s1.dwellTimer; t1LastChime = s1.lastChime;
        F().updateTrainOnAxis(train1Group, t1X, TRACK_Z_SOUTH, 'x', getTrackY, getTrackPitch);

        const s2 = stepCorridorTrain(t2X, 1, t2Dwell, t2LastChime, dt);
        t2X = s2.xVal; t2Dwell = s2.dwellTimer; t2LastChime = s2.lastChime;
        F().updateTrainOnAxis(train2Group, t2X, TRACK_Z_NORTH, 'x', getTrackY, getTrackPitch);
      } else {
        const entry = archetypeCache.get(activeStageKey);
        if (entry) {
          entry.trains.forEach((tr) => {
            if (tr.curve) {
              tr.dist += tr.speed * simSpeed * dt;
              if (tr.dist > tr.totalLen - 10) tr.dist = 10;
              F().updateTrainOnCurve(tr.group, tr.curve, tr.dist, tr.totalLen);
            } else {
              tr.x += tr.dir * 12.5 * simSpeed * dt;
              if (tr.dir === -1 && tr.x < tr.minX) tr.x = tr.maxX;
              if (tr.dir === 1 && tr.x > tr.maxX) tr.x = tr.minX;
              F().updateTrainOnAxis(tr.group, tr.x, tr.z, tr.axis, () => tr.y, () => 0);
            }
          });
        }
      }
    }

    if (followTrainMode) {
      if (activeStageKey === 'corridor') {
        const focusY = getTrackY(t1X) + 2.5;
        springState.targetLook.set(t1X, focusY, TRACK_Z_SOUTH);
        springState.targetPos.set(t1X + 26, focusY + 42, 74);
        springState.active = true;
      } else {
        const entry = archetypeCache.get(activeStageKey);
        const tr = entry && entry.trains[0];
        if (tr && tr.group) {
          const tx = tr.axis === 'z' ? 0 : tr.x;
          const tz = tr.axis === 'z' ? tr.x : (tr.z || 0);
          const ty = (tr.y || 0) + 2.5;
          springState.targetLook.set(tx, ty, tz);
          springState.targetPos.set(tx + 24, ty + 38, tz + 68);
          springState.active = true;
        }
      }
    }

    if (springState.active && camera && controls) {
      const resp = 0.44;
      const [px, pvx] = stepCriticallyDampedScalar(camera.position.x, springState.posVel.x, springState.targetPos.x, resp, dt);
      const [py, pvy] = stepCriticallyDampedScalar(camera.position.y, springState.posVel.y, springState.targetPos.y, resp, dt);
      const [pz, pvz] = stepCriticallyDampedScalar(camera.position.z, springState.posVel.z, springState.targetPos.z, resp, dt);
      camera.position.set(px, py, pz);
      springState.posVel.set(pvx, pvy, pvz);

      const [lx, lvx] = stepCriticallyDampedScalar(controls.target.x, springState.lookVel.x, springState.targetLook.x, resp, dt);
      const [ly, lvy] = stepCriticallyDampedScalar(controls.target.y, springState.lookVel.y, springState.targetLook.y, resp, dt);
      const [lz, lvz] = stepCriticallyDampedScalar(controls.target.z, springState.lookVel.z, springState.targetLook.z, resp, dt);
      controls.target.set(lx, ly, lz);
      springState.lookVel.set(lvx, lvy, lvz);

      const [nz, nzv] = stepCriticallyDampedScalar(camera.zoom, springState.zoomVel, springState.targetZoom, resp, dt);
      camera.zoom = nz;
      springState.zoomVel = nzv;
      camera.updateProjectionMatrix();

      if (
        !followTrainMode &&
        camera.position.distanceTo(springState.targetPos) < 0.15 &&
        controls.target.distanceTo(springState.targetLook) < 0.15 &&
        Math.abs(camera.zoom - springState.targetZoom) < 0.008 &&
        springState.posVel.length() < 0.05
      ) {
        camera.position.copy(springState.targetPos);
        controls.target.copy(springState.targetLook);
        camera.zoom = springState.targetZoom;
        camera.updateProjectionMatrix();
        springState.posVel.set(0, 0, 0);
        springState.lookVel.set(0, 0, 0);
        springState.zoomVel = 0;
        springState.active = false;
      }
    }

    applyThemeTransition(dt);

    if (controls && currentView === 'overview' && activeStageKey === 'corridor' && !springState.active && !followTrainMode && !prefersReducedMotion()) {
      if (nowMs - lastUserInteraction > 6000) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.25;
      } else {
        controls.autoRotate = false;
      }
    } else if (controls) {
      controls.autoRotate = false;
    }

    if (nowMs - lastClockTick > 1000 && qutabPidsData && activeStageKey === 'corridor') {
      lastClockTick = nowMs;
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      M().drawPIDSToContext(
        qutabPidsData.ctx,
        `QUTAB MINAR ↔ RAJIV CHOWK · ${timeStr}`,
        'P1: VIA RAMP ➔ RAJIV CHOWK (01 MIN)',
        'P2: MILLENNIUM CITY CENTRE (LIVE)'
      );
      qutabPidsData.texture.needsUpdate = true;
    }

    if (controls) controls.update();
    renderer.render(scene, camera);

    animId = requestAnimationFrame(animate);
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    if (canvas) canvas.style.display = 'block';
    setLightingMode(currentLightingMode);
    lastFrameMs = performance.now();
    animId = requestAnimationFrame(animate);
  }

  function stop() {
    isRunning = false;
    if (canvas) canvas.style.display = 'none';
    document.querySelector('.master-mode-strip')?.classList.remove('dark-hud');
    document.querySelector('.station-search-container')?.classList.remove('dark-hud');
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function onWindowResize() {
    if (!container || !camera || !renderer) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const aspect = w / h;
    const d = 60;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  return {
    init,
    start,
    stop,
    setLightingMode,
    setCameraView,
    setArchetype,
    switchStage,
    playDMRCChime
  };
})();
