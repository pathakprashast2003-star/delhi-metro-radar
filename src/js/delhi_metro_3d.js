/* ============================================================
 * DELHI METRO — 3D Architectural Map of Delhi & Yellow Line
 * Sculpted NCT Delhi Relief, Yamuna River + 5 Bridges, Ring Roads,
 * Urban Districts, 7 Monuments & Full 47.62 km Yellow Line with
 * all 37 Modular MetroKit Stations & Dual-Track Fleet.
 * ============================================================ */

window.DelhiMetro3D = (function () {
  'use strict';

  let container = null;
  let canvas = null;
  let scene, camera, renderer, controls;
  let animId = null;
  let isRunning = false;
  let isInitialized = false;
  let isPaused = false;
  let followTrainMode = false;
  let showInterchangeLines = false;

  // Data & Scene Objects
  let topologyData = null;
  let osmYellowData = null;
  let yellowServiceData = null;
  let plinthMesh = null;
  let plinthEdgeLines = null;
  let delhiPlateMesh = null;
  let haryanaPlateMesh = null;
  let yamunaMesh = null;
  let roadsGroup = null;
  let urbanBlocksMesh = null;
  let parksGroup = null;
  let landmarksGroup = null;
  let districtLabelsGroup = null;
  let yellowNetworkGroup = null;
  let interchangeNetworkGroup = null;
  let stationsGroup = null;
  let stationNodes = [];
  let beaconPulsers = [];

  // Raycasting & Tooltip
  let raycaster = null;
  let mouse = null;
  let tooltipEl = null;
  let pulseRingMesh = null;
  let pulseRingAnimStart = 0;

  // Fleet Simulation
  let yellowFleetGroup = null;
  let interchangeFleetGroup = null;
  let activeTrains = [];
  let yellowCurveRef = null;

  // Lighting & Smooth Theme State
  let sunLight, hemiLight, ambientFill, dirLight;
  let currentLighting = 'day';
  let currentSector = 'all';
  let lastFrameMs = performance.now();

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const springState = {
    active: false,
    posVel: new THREE.Vector3(),
    lookVel: new THREE.Vector3(),
    targetPos: new THREE.Vector3(-56, 250, 326),
    targetLook: new THREE.Vector3(-48, 0, 38)
  };

  function stepSpring(x, v, target, response, dt) {
    if (response <= 0.001) return [target, 0];
    const omega = 2.0 / response;
    const f = x - target;
    const e = Math.exp(-omega * dt);
    const k = (v + omega * f) * dt;
    return [target + (f + k) * e, (v - omega * k) * e];
  }

  const PALETTE = {
    day: {
      bg: 0xE7DFCE,
      fog: 0xE7DFCE,
      plinth: 0xCFC3AC,
      plinthEdge: 0xB3A58C,
      delhiPlate: 0xEDE5D4,
      haryanaPlate: 0xE3D9C4,
      yamuna: 0x2B7CA6,
      ridge: 0x3D7243,
      road: 0xBCAE92,
      block: 0xD2C6AE,
      landmark: 0xFFFFFF,
      ambient: 0xFFFDF8,
      hemiSky: 0xFFFDF7,
      hemiGround: 0xBFB199,
      sun: 0xFFF4DC,
      ambientInt: 0.22,
      hemiInt: 0.48,
      dirInt: 0.80
    },
    night: {
      bg: 0x050914,
      fog: 0x050914,
      plinth: 0x080D1A,
      plinthEdge: 0x1E293B,
      delhiPlate: 0x111A2E,
      haryanaPlate: 0x0D1526,
      yamuna: 0x0D2C4A,
      ridge: 0x11291A,
      road: 0x24334C,
      block: 0x1E293B,
      landmark: 0x64748B,
      ambient: 0x1E293B,
      hemiSky: 0x1E293B,
      hemiGround: 0x080D1A,
      sun: 0x7DD3FC,
      ambientInt: 0.34,
      hemiInt: 0.32,
      dirInt: 0.58
    }
  };

  const themeTargets = {
    animating: false,
    bg: new THREE.Color(PALETTE.day.bg),
    fog: new THREE.Color(PALETTE.day.fog),
    plinth: new THREE.Color(PALETTE.day.plinth),
    delhiPlate: new THREE.Color(PALETTE.day.delhiPlate),
    haryanaPlate: new THREE.Color(PALETTE.day.haryanaPlate),
    yamuna: new THREE.Color(PALETTE.day.yamuna),
    ridge: new THREE.Color(PALETTE.day.ridge),
    road: new THREE.Color(PALETTE.day.road),
    block: new THREE.Color(PALETTE.day.block),
    ambient: new THREE.Color(PALETTE.day.ambient),
    sun: new THREE.Color(PALETTE.day.sun),
    ambientInt: PALETTE.day.ambientInt,
    hemiInt: PALETTE.day.hemiInt,
    dirInt: PALETTE.day.dirInt
  };

  function C() { return window.MetroKit.CityNodes; }
  function M() { return window.MetroKit.Materials; }

  const SECTORS = {
    all: { pos: [-56, 250, 326], look: [-48, 0, 38], title: 'Samaypur Badli ↔ Millennium City Centre · 37 MetroKit Stations' },
    north_badli: { pos: [-26, 38, -56], look: [-56, 1.5, -100], title: 'North Elevated Viaduct · Badli, Azadpur & Model Town Portal' },
    kashmere: { pos: [34, 34, -12], look: [8, 1.8, -36], title: 'Kashmere Gate Hybrid Hub (Red Overpass × Yellow Tube) & Red Fort' },
    rajiv: { pos: [26, 32, 26], look: [0, 1.0, -2], title: 'Connaught Place · Rajiv Chowk, New Delhi & Chandni Chowk Deep Core' },
    hauz: { pos: [24, 34, 118], look: [-11, 1.0, 88], title: 'South Subway Spine · Dilli Haat INA, AIIMS & Hauz Khas Magenta Cross' },
    qutab: { pos: [-24, 46, 198], look: [-64, 2.0, 146], title: 'South Viaduct · Qutab Minar Portal ➔ Sikanderpur ➔ Millennium City' }
  };

  /* ── Projection & Corridor Elevation Helpers ─────────────── */
  function projectPts(lonLatPairs, y = 0.08) {
    return lonLatPairs.map(([lon, lat]) => {
      const [x, z] = C().projectToPlinth(lon, lat);
      return [x, y, z];
    });
  }

  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  // Elevation profile across 389 OSM Yellow Line nodes:
  // North Elevated (0..107) -> Ramp (107..113) -> Underground Cutaway (113..228) -> Ramp (228..236) -> South Elevated (236..388)
  const VIADUCT_Y = 2.65;
  const SUBWAY_Y = 0.14;
  function yellowNodeElevation(idx) {
    if (idx <= 107) return VIADUCT_Y;
    if (idx < 113) return VIADUCT_Y + (SUBWAY_Y - VIADUCT_Y) * smoothstep(107, 113, idx);
    if (idx <= 228) return SUBWAY_Y;
    if (idx < 236) return SUBWAY_Y + (VIADUCT_Y - SUBWAY_Y) * smoothstep(228, 236, idx);
    return VIADUCT_Y;
  }

  /* ───────────────────────────────────────────────────────────
   * 1. INITIALIZATION & SCENE SETUP
   * ─────────────────────────────────────────────────────────── */
  async function init(containerEl) {
    if (!containerEl) return;
    if (isInitialized) {
      onWindowResize();
      return;
    }

    container = containerEl;
    canvas = document.getElementById('three-plinth-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'three-plinth-canvas';
      canvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; display:none;';
      container.prepend(canvas);
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(PALETTE.day.bg);
    scene.fog = new THREE.FogExp2(PALETTE.day.fog, 0.0013);

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera = new THREE.PerspectiveCamera(42, w / h, 1, 1600);
    camera.position.copy(springState.targetPos);
    camera.lookAt(springState.targetLook);

    const isMobile3d = window.innerWidth <= 860 || (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile3d,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile3d ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.screenSpacePanning = true;
    controls.minDistance = 12;
    controls.maxDistance = 620;
    controls.minPolarAngle = 0.001;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.target.copy(springState.targetLook);
    controls.addEventListener('start', () => {
      springState.active = false;
      followTrainMode = false;
      document.getElementById('btn-follow-train-3d')?.classList.remove('active');
    });

    setupLighting();
    setupInteraction();
    bindHUDControls();
    window.addEventListener('resize', onWindowResize);

    try {
      const q = '?v=' + Date.now();
      const [topoRes, osmRes, svcRes] = await Promise.all([
        fetch('src/data/delhi_network_topology.json' + q),
        fetch('src/data/yellow_line_accurate_osm.json' + q),
        fetch('src/data/yellow_line_service.json' + q)
      ]);
      topologyData = await topoRes.json();
      osmYellowData = await osmRes.json();
      yellowServiceData = await svcRes.json();
      buildDelhiMapScene();
    } catch (err) {
      console.error('[DelhiMetro3D] Data load error:', err);
    }

    setInterchangeVisibility(showInterchangeLines);
    setLightingMode(currentLighting, true);
    isInitialized = true;
    const isThreeActive = document.getElementById('tab-threejs')?.classList.contains('active');
    if (isThreeActive) start();
  }

  function setupLighting() {
    ambientFill = new THREE.AmbientLight(PALETTE.day.ambient, PALETTE.day.ambientInt);
    scene.add(ambientFill);

    hemiLight = new THREE.HemisphereLight(PALETTE.day.hemiSky, PALETTE.day.hemiGround, PALETTE.day.hemiInt);
    hemiLight.position.set(0, 220, 0);
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(PALETTE.day.sun, PALETTE.day.dirInt);
    dirLight.position.set(110, 230, 130);
    dirLight.castShadow = true;
    const shadowSize3d = (window.innerWidth <= 860 || (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024)) ? 1024 : 2048;
    dirLight.shadow.mapSize.width = shadowSize3d;
    dirLight.shadow.mapSize.height = shadowSize3d;
    dirLight.shadow.camera.near = 15;
    dirLight.shadow.camera.far = 650;
    const d = 240;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.00025;
    scene.add(dirLight);
    scene.add(dirLight.target);
    sunLight = dirLight;
  }

  function syncChromeTheme(isNight) {
    [
      document.querySelector('.three-hud-panel'),
      document.querySelector('.three-header-pill'),
      document.querySelector('.three-instruction-badge'),
      document.querySelector('.master-mode-strip'),
      document.querySelector('.station-search-container')
    ].forEach(el => { if (el) el.classList.toggle('dark-hud', isNight); });
  }

  function setLightingMode(mode, immediate = false) {
    currentLighting = mode === 'night' ? 'night' : 'day';
    const isNight = currentLighting === 'night';
    const p = PALETTE[currentLighting];

    themeTargets.bg.setHex(p.bg);
    themeTargets.fog.setHex(p.fog);
    themeTargets.plinth.setHex(p.plinth);
    themeTargets.delhiPlate.setHex(p.delhiPlate);
    themeTargets.haryanaPlate.setHex(p.haryanaPlate);
    themeTargets.yamuna.setHex(p.yamuna);
    themeTargets.ridge.setHex(p.ridge);
    themeTargets.road.setHex(p.road);
    themeTargets.block.setHex(p.block);
    themeTargets.ambient.setHex(p.ambient);
    themeTargets.sun.setHex(p.sun);
    themeTargets.ambientInt = p.ambientInt;
    themeTargets.hemiInt = p.hemiInt;
    themeTargets.dirInt = p.dirInt;
    themeTargets.animating = true;

    activeTrains.forEach(tr => {
      if (tr.headlight) tr.headlight.visible = isNight && (tr.isYellow || showInterchangeLines);
    });

    if (immediate || prefersReducedMotion()) applyThemeStep(1.0);

    document.getElementById('btn-light-day')?.classList.toggle('active', !isNight);
    document.getElementById('btn-light-night')?.classList.toggle('active', isNight);
    if (isRunning) syncChromeTheme(isNight);
  }

  function applyThemeStep(dt) {
    if (!themeTargets.animating || !scene) return;
    const rate = dt >= 1.0 ? 1.0 : Math.min(1.0, 1 - Math.exp(-8.5 * dt));

    scene.background.lerp(themeTargets.bg, rate);
    if (scene.fog) scene.fog.color.lerp(themeTargets.fog, rate);
    if (ambientFill) {
      ambientFill.color.lerp(themeTargets.ambient, rate);
      ambientFill.intensity += (themeTargets.ambientInt - ambientFill.intensity) * rate;
    }
    if (hemiLight) hemiLight.intensity += (themeTargets.hemiInt - hemiLight.intensity) * rate;
    if (dirLight) {
      dirLight.color.lerp(themeTargets.sun, rate);
      dirLight.intensity += (themeTargets.dirInt - dirLight.intensity) * rate;
    }
    if (plinthMesh) plinthMesh.material.color.lerp(themeTargets.plinth, rate);
    if (delhiPlateMesh) delhiPlateMesh.material.color.lerp(themeTargets.delhiPlate, rate);
    if (haryanaPlateMesh) haryanaPlateMesh.material.color.lerp(themeTargets.haryanaPlate, rate);
    if (yamunaMesh) yamunaMesh.material.color.lerp(themeTargets.yamuna, rate);
    if (urbanBlocksMesh) urbanBlocksMesh.material.color.lerp(themeTargets.block, rate);
    if (roadsGroup) {
      roadsGroup.traverse(ch => {
        if (ch.isMesh && ch.userData.isRoadMatTarget) ch.material.color.lerp(themeTargets.road, rate);
      });
    }
    if (parksGroup) {
      parksGroup.traverse(ch => {
        if (ch.isMesh && ch.userData.isPark) ch.material.color.lerp(themeTargets.ridge, rate);
      });
    }

    const bgDiff = Math.abs(scene.background.r - themeTargets.bg.r) +
      Math.abs(scene.background.g - themeTargets.bg.g) +
      Math.abs(scene.background.b - themeTargets.bg.b);
    if (rate >= 0.999 || bgDiff < 0.004) {
      themeTargets.animating = false;
    }
  }

  /* ───────────────────────────────────────────────────────────
   * 2. DELHI ARCHITECTURAL GEOGRAPHY BUILDERS
   * ─────────────────────────────────────────────────────────── */
  function buildDelhiMapScene() {
    buildPlinth(topologyData.metadata.plinth);
    buildTerritoryPlates();
    buildYamunaAndBridges(topologyData.yamuna);
    buildDelhiArterials();
    buildParks(topologyData.parks);
    buildUrbanContextBlocks();
    buildLandmarks(topologyData.landmarks);
    buildDistrictLabels();

    buildYellowLineInfrastructure();
    buildInterchangeNetwork(topologyData.lines);
    buildYellowStationsWithMetroKit();
    buildAlignedFleet(topologyData.lines);
  }

  function buildPlinth(plinthMeta) {
    const w = plinthMeta.width || 520;
    const d = plinthMeta.depth || 540;
    const h = plinthMeta.height || 18;

    const group = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(w, h, d);
    const boxMat = new THREE.MeshStandardMaterial({
      color: PALETTE.day.plinth,
      roughness: 0.85,
      metalness: 0.04
    });
    plinthMesh = new THREE.Mesh(boxGeo, boxMat);
    plinthMesh.position.set(0, -h / 2, 0);
    plinthMesh.receiveShadow = true;
    group.add(plinthMesh);

    const edgeGeo = new THREE.EdgesGeometry(boxGeo);
    const edgeMat = new THREE.LineBasicMaterial({ color: PALETTE.day.plinthEdge });
    plinthEdgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    plinthEdgeLines.position.copy(plinthMesh.position);
    group.add(plinthEdgeLines);

    const grid = new THREE.GridHelper(w, 52, 0xD6CEBD, 0xE3DCCE);
    grid.position.set(0, 0.02, 0);
    grid.material.opacity = 0.42;
    grid.material.transparent = true;
    group.add(grid);

    scene.add(group);
  }

  function makeExtrudedGeoFromLonLat(lonLatRing, depth) {
    const pts = projectPts(lonLatRing, 0);
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], -pts[0][2]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][2]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  /** NCT Delhi + Gurugram NCR stepped architectural territory relief slabs */
  function buildTerritoryPlates() {
    // Stylized geodetic NCT Delhi silhouette (Narela -> Yamuna E -> Okhla/Badarpur -> Mehrauli -> Dwarka/Najafgarh -> Rohini)
    const nctLonLat = [
      [77.085, 28.835], [77.195, 28.810], [77.245, 28.745], [77.310, 28.695],
      [77.345, 28.640], [77.335, 28.580], [77.315, 28.500], [77.270, 28.478],
      [77.210, 28.490], [77.155, 28.496], [77.095, 28.515], [77.030, 28.555],
      [76.960, 28.590], [76.955, 28.665], [76.995, 28.735], [77.035, 28.795]
    ];
    delhiPlateMesh = new THREE.Mesh(
      makeExtrudedGeoFromLonLat(nctLonLat, 0.14),
      new THREE.MeshStandardMaterial({ color: PALETTE.day.delhiPlate, roughness: 0.90, metalness: 0.02 })
    );
    delhiPlateMesh.position.y = 0.01;
    delhiPlateMesh.receiveShadow = true;
    scene.add(delhiPlateMesh);

    const nctPts = projectPts(nctLonLat, 0.16);
    nctPts.push(nctPts[0]);
    const borderGeo = new THREE.BufferGeometry().setFromPoints(nctPts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    scene.add(new THREE.Line(borderGeo, new THREE.LineBasicMaterial({ color: 0x9C8E74 })));

    // Gurugram / Cyber City Southern Peninsula connecting Qutab Minar -> Millennium City Centre
    const ggnLonLat = [
      [77.145, 28.502], [77.115, 28.460], [77.080, 28.442], [77.042, 28.458],
      [77.045, 28.505], [77.085, 28.522]
    ];
    haryanaPlateMesh = new THREE.Mesh(
      makeExtrudedGeoFromLonLat(ggnLonLat, 0.12),
      new THREE.MeshStandardMaterial({ color: PALETTE.day.haryanaPlate, roughness: 0.90 })
    );
    haryanaPlateMesh.position.y = 0.01;
    haryanaPlateMesh.receiveShadow = true;
    scene.add(haryanaPlateMesh);

    const ggnPts = projectPts(ggnLonLat, 0.14);
    ggnPts.push(ggnPts[0]);
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ggnPts.map(p => new THREE.Vector3(p[0], p[1], p[2]))),
      new THREE.LineBasicMaterial({ color: 0xA89B82 })
    ));
  }

  /** Fixed-winding Yamuna River channel + floodplains + 5 Delhi bridges */
  function buildYamunaAndBridges(yamunaData) {
    if (!yamunaData || !yamunaData.ribbonLeft || !yamunaData.ribbonRight) return;

    const left = yamunaData.ribbonLeft;
    const right = yamunaData.ribbonRight;
    const count = Math.min(left.length, right.length);

    // 1. River water mesh with proper upward normals & DoubleSide safety
    const geom = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 0; i < count - 1; i++) {
      const y = 0.19;
      const l0 = [left[i][0] * 1.15 - 1.4, y, left[i][2] * 1.05];
      const r0 = [right[i][0] * 1.15 + 1.4, y, right[i][2] * 1.05];
      const l1 = [left[i + 1][0] * 1.15 - 1.4, y, left[i + 1][2] * 1.05];
      const r1 = [right[i + 1][0] * 1.15 + 1.4, y, right[i + 1][2] * 1.05];

      // Upward winding (+Y): (l0, l1, r0) and (r0, l1, r1)
      positions.push(l0[0], y, l0[2], l1[0], y, l1[2], r0[0], y, r0[2]);
      positions.push(r0[0], y, r0[2], l1[0], y, l1[2], r1[0], y, r1[2]);
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.computeVertexNormals();

    yamunaMesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({
        color: PALETTE.day.yamuna,
        roughness: 0.16,
        metalness: 0.32,
        side: THREE.DoubleSide
      })
    );
    yamunaMesh.receiveShadow = true;
    scene.add(yamunaMesh);

    // 2. Signature Bridge + 4 iconic Yamuna River Crossings
    const bridgeGeo = new THREE.BoxGeometry(10.5, 0.24, 1.4);
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.45 });
    const bridges = [
      { idx: 4, name: 'Signature Bridge', hasPylon: true },
      { idx: 6, name: 'Wazirabad Crossing' },
      { idx: 8, name: 'Old Yamuna / ISBT Bridge' },
      { idx: 10, name: 'ITO Yamuna Bridge' },
      { idx: 12, name: 'DND / Nizamuddin Bridge' }
    ];
    bridges.forEach((b) => {
      if (!left[b.idx] || !right[b.idx]) return;
      const cx = (left[b.idx][0] + right[b.idx][0]) * 0.5 * 1.15;
      const cz = (left[b.idx][2] + right[b.idx][2]) * 0.5 * 1.05;
      const deck = new THREE.Mesh(bridgeGeo, bridgeMat);
      deck.position.set(cx, 0.62, cz);
      deck.castShadow = true;
      scene.add(deck);

      if (b.hasPylon) {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.2, 0.45), bridgeMat);
        pylon.position.set(cx - 2.2, 2.8, cz);
        pylon.rotation.z = -0.34;
        pylon.castShadow = true;
        scene.add(pylon);
      }
    });

    const riverLabel = createTextSprite('Yamuna River (यमुना)', '#0369A1', '#FFFFFF', 240, 52);
    riverLabel.scale.set(14, 3.1, 1);
    riverLabel.position.set(52, 2.6, 20);
    scene.add(riverLabel);
  }

  /** Delhi Ring Roads, Outer Ring Road, NH-48, Lodhi Rd, Aurobindo & Kartavya Path */
  function buildDelhiArterials() {
    roadsGroup = new THREE.Group();
    const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.day.road, roughness: 0.88 });

    const arteries = [
      { coords: [[77.229, 28.668], [77.250, 28.628], [77.258, 28.584], [77.232, 28.567], [77.208, 28.567], [77.162, 28.590], [77.142, 28.625], [77.136, 28.672], [77.180, 28.707], [77.222, 28.690], [77.229, 28.668]], radius: 0.50 },
      { coords: [[77.256, 28.548], [77.206, 28.544], [77.162, 28.555], [77.110, 28.575], [77.088, 28.630], [77.118, 28.698], [77.150, 28.730], [77.210, 28.722]], radius: 0.42 },
      { coords: [[77.199, 28.614], [77.229, 28.613], [77.248, 28.612]], radius: 0.58 }, // Kartavya Path
      { coords: [[77.162, 28.590], [77.125, 28.550], [77.092, 28.508], [77.072, 28.459]], radius: 0.46 }, // NH-48
      { coords: [[77.202, 28.597], [77.224, 28.594], [77.246, 28.590]], radius: 0.40 }, // Lodhi Rd (Lok Kalyan / Jor Bagh)
      { coords: [[77.206, 28.590], [77.209, 28.566], [77.207, 28.544], [77.199, 28.520]], radius: 0.42 }, // Sri Aurobindo Marg
      { coords: [[77.242, 28.656], [77.232, 28.642], [77.224, 28.620], [77.244, 28.595], [77.254, 28.570]], radius: 0.38 }, // Subhash Marg / Mathura Rd
      { coords: [[77.195, 28.615], [77.219, 28.633], [77.236, 28.648]], radius: 0.36 }, // Sansad Marg / Barakhamba
      { coords: [[77.138, 28.745], [77.155, 28.722], [77.180, 28.707], [77.202, 28.685]], radius: 0.42 } // GT Karnal Rd
    ];

    const treeSpots = [];
    arteries.forEach((road, ri) => {
      const vecs = projectPts(road.coords, 0.19).map(p => new THREE.Vector3(p[0], p[1], p[2]));
      const curve = new THREE.CatmullRomCurve3(vecs);
      const geo = new THREE.TubeGeometry(curve, vecs.length * 10, road.radius, 6, false);
      geo.scale(1, 0.18, 1);
      const mesh = new THREE.Mesh(geo, roadMat);
      mesh.userData.isRoadMatTarget = true;
      mesh.receiveShadow = true;
      roadsGroup.add(mesh);

      if (ri < 7) {
        for (let u = 0.05; u < 0.96; u += 0.09) {
          const p = curve.getPointAt(u);
          const tan = curve.getTangentAt(u);
          const px = -tan.z; const pz = tan.x;
          const len = Math.hypot(px, pz) || 1;
          treeSpots.push([p.x + (px / len) * 1.15, p.z + (pz / len) * 1.15]);
        }
      }
    });

    scene.add(roadsGroup);
    roadsGroup.userData.avenueTreeSpots = treeSpots;
  }

  /** InstancedMesh textured urban blocks + avenue greenery cleared safely around Yellow Line */
  function buildUrbanContextBlocks() {
    const ylCurve = yellowNodeCurves().rawPts || [];
    const seeds = [
      // Connaught Place radial ring
      ...radialCluster(0, 0, 8.2, 16.5, 28, 1.3, 2.3),
      // Old Delhi / Chandni Chowk / Civil Lines
      ...gridCluster(15, -24, 28, 22, 34, 1.1, 2.1),
      ...gridCluster(2, -55, 26, 22, 28, 1.0, 1.8),
      // Lutyens, Lodhi Colony & Khan Market around Lok Kalyan / Jor Bagh
      ...gridCluster(-22, 38, 22, 22, 24, 0.8, 1.3),
      ...gridCluster(18, 36, 24, 22, 24, 0.9, 1.5),
      // South Extension / AIIMS / Green Park / Hauz Khas / Nehru Place
      ...gridCluster(18, 76, 38, 32, 36, 1.1, 2.2),
      ...gridCluster(-26, 86, 24, 26, 22, 1.0, 1.9),
      // Saket / Malviya Nagar / Qutab edge
      ...gridCluster(-8, 114, 28, 24, 24, 1.0, 1.8),
      // Model Town / Azadpur / Shalimar Bagh North Delhi
      ...gridCluster(-52, -92, 40, 32, 32, 1.1, 1.9),
      ...gridCluster(-78, -118, 28, 22, 22, 1.0, 1.6),
      // Gurugram Cyber City & MG Road high-rise skyline
      ...gridCluster(-114, 178, 42, 30, 36, 1.8, 4.8),
      ...gridCluster(-140, 198, 26, 22, 22, 1.6, 3.8)
    ];

    const clearYellow = (x, z, rSq) => {
      for (let i = 0; i < ylCurve.length; i += 2) {
        const dx = x - ylCurve[i][0];
        const dz = z - ylCurve[i][2];
        if (dx * dx + dz * dz < rSq) return false;
      }
      return true;
    };

    const filtered = seeds.filter(([bx, , bz]) => clearYellow(bx, bz, 64.0));

    if (filtered.length) {
      const facadeTex = M().makeBuildingFacadeTexture();
      const blockGeo = new THREE.BoxGeometry(1, 1, 1);
      const blockMat = new THREE.MeshStandardMaterial({
        color: PALETTE.day.block,
        map: facadeTex,
        roughness: 0.78
      });
      urbanBlocksMesh = new THREE.InstancedMesh(blockGeo, blockMat, filtered.length);
      urbanBlocksMesh.castShadow = true;
      urbanBlocksMesh.receiveShadow = true;
      urbanBlocksMesh.frustumCulled = false;

      const dummy = new THREE.Object3D();
      filtered.forEach(([bx, bh, bz, bw, bd], i) => {
        dummy.position.set(bx, 0.16 + bh * 0.5, bz);
        dummy.scale.set(bw, bh, bd);
        dummy.rotation.y = (i % 5) * 0.16;
        dummy.updateMatrix();
        urbanBlocksMesh.setMatrixAt(i, dummy.matrix);
      });
      urbanBlocksMesh.instanceMatrix.needsUpdate = true;
      scene.add(urbanBlocksMesh);
    }

    // Add avenue trees along Ring Roads, Lodhi Rd, Aurobindo & Gurugram streets cleanly clear of tracks
    const rawTrees = (roadsGroup && roadsGroup.userData.avenueTreeSpots) || [];
    const safeTrees = rawTrees.filter(([tx, tz]) => clearYellow(tx, tz, 25.0));
    if (safeTrees.length) {
      const trunks = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.08, 0.11, 0.55, 5),
        new THREE.MeshStandardMaterial({ color: 0x7C4D2B, roughness: 0.9 }),
        safeTrees.length
      );
      const crowns = new THREE.InstancedMesh(
        new THREE.DodecahedronGeometry(0.38, 0),
        new THREE.MeshStandardMaterial({ color: 0x5C9A5A, roughness: 0.82 }),
        safeTrees.length
      );
      trunks.castShadow = true;
      crowns.castShadow = true;
      trunks.frustumCulled = false;
      crowns.frustumCulled = false;
      const dummy = new THREE.Object3D();
      safeTrees.forEach(([tx, tz], i) => {
        dummy.position.set(tx, 0.44, tz);
        dummy.scale.setScalar(0.9);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        dummy.position.set(tx, 0.92, tz);
        dummy.updateMatrix();
        crowns.setMatrixAt(i, dummy.matrix);
      });
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      scene.add(trunks, crowns);
    }
  }

  function radialCluster(cx, cz, rMin, rMax, count, hMin, hMax) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = rMin + ((i * 37) % 100) / 100 * (rMax - rMin);
      const h = hMin + ((i * 53) % 100) / 100 * (hMax - hMin);
      out.push([cx + Math.cos(a) * r, h, cz + Math.sin(a) * r, 2.2, 2.0]);
    }
    return out;
  }

  function gridCluster(cx, cz, spanX, spanZ, count, hMin, hMax) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const rx = (((i * 73 + 19) % 97) / 97 - 0.5) * spanX;
      const rz = (((i * 41 + 7) % 89) / 89 - 0.5) * spanZ;
      const h = hMin + (((i * 29) % 100) / 100) * (hMax - hMin);
      const w = 1.6 + ((i * 13) % 16) / 10;
      const d = 1.6 + ((i * 17) % 16) / 10;
      out.push([cx + rx, h, cz + rz, w, d]);
    }
    return out;
  }

  function yellowNodeCurves() {
    const line = (topologyData && topologyData.lines || []).find(l => l.id === 'yellow-line');
    return { rawPts: line ? line.points : [] };
  }

  function buildParks(parksData) {
    if (!parksData) return;
    parksGroup = new THREE.Group();
    const parkMat = new THREE.MeshStandardMaterial({ color: PALETTE.day.ridge, roughness: 0.88 });
    const treePlacements = [];

    parksData.forEach((p) => {
      const pts = p.points;
      if (!pts || pts.length < 3) return;
      const shape = new THREE.Shape();
      shape.moveTo(pts[0][0], -pts[0][2]);
      for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][2]);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, parkMat);
      mesh.position.y = 0.135;
      mesh.receiveShadow = true;
      mesh.userData.isPark = true;
      parksGroup.add(mesh);

      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      pts.forEach(pt => {
        minX = Math.min(minX, pt[0]); maxX = Math.max(maxX, pt[0]);
        minZ = Math.min(minZ, pt[2]); maxZ = Math.max(maxZ, pt[2]);
      });
      const n = Math.min(18, Math.max(4, Math.floor((maxX - minX) * (maxZ - minZ) / 110)));
      for (let i = 0; i < n; i++) {
        const tx = minX + ((i * 61 + 11) % 97) / 97 * (maxX - minX);
        const tz = minZ + ((i * 37 + 23) % 89) / 89 * (maxZ - minZ);
        treePlacements.push([tx, tz, 0.75 + (i % 4) * 0.16]);
      }
    });

    if (treePlacements.length) {
      const trunkMesh = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.09, 0.13, 0.75, 5),
        new THREE.MeshStandardMaterial({ color: 0x7C4D2B, roughness: 0.9 }),
        treePlacements.length
      );
      const crownMesh = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(0.50, 1),
        new THREE.MeshStandardMaterial({ color: 0x35693E, roughness: 0.84 }),
        treePlacements.length
      );
      trunkMesh.frustumCulled = false;
      crownMesh.frustumCulled = false;
      const dummy = new THREE.Object3D();
      treePlacements.forEach(([tx, tz, sc], i) => {
        dummy.position.set(tx, 0.38 + 0.35 * sc, tz);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        dummy.position.set(tx, 0.38 + 0.85 * sc, tz);
        dummy.updateMatrix();
        crownMesh.setMatrixAt(i, dummy.matrix);
      });
      trunkMesh.instanceMatrix.needsUpdate = true;
      crownMesh.instanceMatrix.needsUpdate = true;
      parksGroup.add(trunkMesh, crownMesh);
    }

    scene.add(parksGroup);
  }

  function buildLandmarks(landmarksData) {
    if (!landmarksData) return;
    landmarksGroup = new THREE.Group();
    const lmMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.40, metalness: 0.10 });
    const sandstoneMat = new THREE.MeshStandardMaterial({ color: 0xB94B39, roughness: 0.62 });

    landmarksData.forEach((lm) => {
      const g = new THREE.Group();
      if (lm.type === 'arch') {
        const p1 = new THREE.Mesh(new THREE.BoxGeometry(lm.width * 0.28, lm.height, lm.width * 0.35), lmMat);
        p1.position.set(-lm.width * 0.36, lm.height / 2, 0);
        const p2 = p1.clone();
        p2.position.x = lm.width * 0.36;
        const beam = new THREE.Mesh(new THREE.BoxGeometry(lm.width, lm.height * 0.32, lm.width * 0.40), lmMat);
        beam.position.set(0, lm.height * 0.84, 0);
        g.add(p1, p2, beam);
      } else if (lm.type === 'tower') {
        const b1 = new THREE.Mesh(new THREE.CylinderGeometry(lm.width * 0.55, lm.width * 0.8, lm.height * 0.45, 16), sandstoneMat);
        b1.position.y = lm.height * 0.22;
        const b2 = new THREE.Mesh(new THREE.CylinderGeometry(lm.width * 0.30, lm.width * 0.55, lm.height * 0.55, 16), sandstoneMat);
        b2.position.y = lm.height * 0.72;
        g.add(b1, b2);
      } else if (lm.type === 'rampart') {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(lm.width, lm.height * 0.65, lm.width * 0.55), sandstoneMat);
        wall.position.y = lm.height * 0.32;
        const bast1 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, lm.height * 0.9, 10), sandstoneMat);
        bast1.position.set(-lm.width * 0.22, lm.height * 0.45, lm.width * 0.28);
        const bast2 = bast1.clone();
        bast2.position.x = lm.width * 0.22;
        g.add(wall, bast1, bast2);
      } else if (lm.type === 'petal_dome') {
        for (let p = 0; p < 6; p++) {
          const pet = new THREE.Mesh(new THREE.ConeGeometry(lm.width * 0.28, lm.height, 4), lmMat);
          const a = (p / 6) * Math.PI * 2;
          pet.position.set(Math.cos(a) * lm.width * 0.24, lm.height * 0.48, Math.sin(a) * lm.width * 0.24);
          pet.rotation.z = Math.cos(a) * 0.25;
          pet.rotation.x = -Math.sin(a) * 0.25;
          g.add(pet);
        }
      } else if (lm.type === 'circle') {
        const inner = new THREE.Mesh(new THREE.TorusGeometry(lm.width * 0.62, 0.28, 8, 36), lmMat);
        inner.rotateX(Math.PI / 2);
        inner.position.y = 0.26;
        const outer = new THREE.Mesh(new THREE.TorusGeometry(lm.width, 0.32, 8, 36), lmMat);
        outer.rotateX(Math.PI / 2);
        outer.position.y = 0.26;
        g.add(inner, outer);
      } else {
        const box = new THREE.Mesh(new THREE.BoxGeometry(lm.width, lm.height, lm.width * 0.7), lmMat);
        box.position.y = lm.height / 2;
        g.add(box);
      }

      const label = createTextSprite(lm.name, 'rgba(15,23,42,0.88)', '#FFFFFF', 220, 44);
      label.scale.set(11, 2.2, 1);
      label.position.set(0, lm.height + 3.0, 0);
      g.add(label);

      g.position.set(lm.x, 0.16, lm.z);
      g.userData = { isLandmark: true, name: lm.name, id: lm.id };
      landmarksGroup.add(g);
    });
    scene.add(landmarksGroup);
  }

  function buildDistrictLabels() {
    districtLabelsGroup = new THREE.Group();
    const districts = [
      { text: 'NORTH DELHI · BADLI', x: -64, z: -112 },
      { text: 'OLD DELHI · CHANDNI CHOWK', x: 16, z: -26 },
      { text: 'NEW DELHI · CENTRAL CORE', x: -16, z: 4 },
      { text: 'SOUTH DELHI · HAUZ KHAS', x: 8, z: 96 },
      { text: 'GURUGRAM · CYBER HUB', x: -124, z: 174 }
    ];
    districts.forEach((d) => {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 48;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'rgba(100, 116, 139, 0.72)';
      ctx.font = 'bold 17px -apple-system, Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.text, 128, 24);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(18, 3.4),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(d.x, 0.21, d.z);
      districtLabelsGroup.add(plane);
    });
    scene.add(districtLabelsGroup);
  }

  /* ───────────────────────────────────────────────────────────
   * 3. FULL 47.62 KM YELLOW LINE CORRIDOR & 37 STATIONS
   * ─────────────────────────────────────────────────────────── */
  function buildYellowLineInfrastructure() {
    yellowNetworkGroup = new THREE.Group();
    const pts = yellowNodeCurves().rawPts;
    if (!pts || pts.length < 2) return;

    const elevVecs = pts.map((p, idx) => new THREE.Vector3(p[0], yellowNodeElevation(idx), p[2]));
    yellowCurveRef = new THREE.CatmullRomCurve3(elevVecs);
    yellowCurveRef.curveType = 'centripetal';
    yellowCurveRef.tension = 0.45;

    const m = M().shared();
    const northVecs = elevVecs.slice(0, 110);
    const southVecs = elevVecs.slice(230);
    const tunnelVecs = elevVecs.slice(110, 232);

    const girderMat = new THREE.MeshStandardMaterial({ color: 0xF1F5F9, roughness: 0.48 });
    const webMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 0.65 });
    const railMat = m.railSteel;
    const thirdRailMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B });
    const oheWireMat = new THREE.MeshBasicMaterial({ color: 0x64748B });

    // Helper: add parallel dual steel rails (left + right lanes at ±0.34, gauge ±0.08) + shoulder yellow third rails
    function addDualRailGeometry(subVecs, yOff) {
      if (subVecs.length < 2) return;
      const subC = new THREE.CatmullRomCurve3(subVecs);
      const segs = Math.max(48, subVecs.length * 3);
      const samples = subC.getSpacedPoints(segs);

      const offsets = [-0.42, -0.26, 0.26, 0.42];
      offsets.forEach((off) => {
        const railPts = samples.map((pt, i) => {
          const u = i / segs;
          const tan = subC.getTangentAt(u);
          const len = Math.hypot(tan.x, tan.z) || 1;
          return new THREE.Vector3(pt.x + (-tan.z / len) * off, pt.y + yOff, pt.z + (tan.x / len) * off);
        });
        yellowNetworkGroup.add(new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), segs, 0.024, 5, false),
          railMat
        ));
      });

      // Crisp thin DMRC Yellow shoulder pinstripe along outer edges (replaces clunky center noodle!)
      [-0.51, 0.51].forEach((off) => {
        const sPts = samples.map((pt, i) => {
          const u = i / segs;
          const tan = subC.getTangentAt(u);
          const len = Math.hypot(tan.x, tan.z) || 1;
          return new THREE.Vector3(pt.x + (-tan.z / len) * off, pt.y + yOff + 0.01, pt.z + (tan.x / len) * off);
        });
        yellowNetworkGroup.add(new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sPts), Math.max(36, Math.floor(segs * 0.7)), 0.022, 4, false),
          thirdRailMat
        ));
      });
    }

    // 1. North & South Elevated Box-Girder Viaducts + Parapets + Dual Steel Rails + OHE Catenary Wire
    [northVecs, southVecs].forEach((segVecs) => {
      if (segVecs.length < 2) return;
      const subCurve = new THREE.CatmullRomCurve3(segVecs);
      const segs = segVecs.length * 3;
      const deckGeo = new THREE.TubeGeometry(subCurve, segs, 0.62, 6, false);
      deckGeo.scale(1, 0.26, 1);
      const deckMesh = new THREE.Mesh(deckGeo, girderMat);
      deckMesh.position.y -= 0.14;
      deckMesh.castShadow = true;
      deckMesh.receiveShadow = true;
      yellowNetworkGroup.add(deckMesh);

      const webGeo = new THREE.TubeGeometry(subCurve, Math.floor(segs * 0.7), 0.36, 5, false);
      webGeo.scale(1, 0.35, 1);
      const webMesh = new THREE.Mesh(webGeo, webMat);
      webMesh.position.y -= 0.28;
      yellowNetworkGroup.add(webMesh);

      addDualRailGeometry(segVecs, 0.05);

      // Subtle overhead OHE catenary contact wires above both elevated lanes
      [-0.34, 0.34].forEach((off) => {
        const wSamples = subCurve.getSpacedPoints(Math.max(24, segVecs.length * 2));
        const wPts = wSamples.map((pt, i) => {
          const u = i / (wSamples.length - 1);
          const tan = subCurve.getTangentAt(u);
          const len = Math.hypot(tan.x, tan.z) || 1;
          return new THREE.Vector3(pt.x + (-tan.z / len) * off, pt.y + 0.72, pt.z + (tan.x / len) * off);
        });
        yellowNetworkGroup.add(new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wPts), Math.max(24, segVecs.length * 2), 0.009, 3, false),
          oheWireMat
        ));
      });
    });

    // 2. Central Subterranean Recessed Trackbed + Dual Steel Rails (Index 110..231)
    if (tunnelVecs.length >= 2) {
      const tunCurve = new THREE.CatmullRomCurve3(tunnelVecs);
      const sleeveGeo = new THREE.TubeGeometry(tunCurve, tunnelVecs.length * 3, 0.58, 6, false);
      sleeveGeo.scale(1, 0.18, 1);
      const sleeveMesh = new THREE.Mesh(
        sleeveGeo,
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78 })
      );
      sleeveMesh.position.y -= 0.06;
      sleeveMesh.receiveShadow = true;
      yellowNetworkGroup.add(sleeveMesh);
      addDualRailGeometry(tunnelVecs, 0.04);
    }

    // 3. Instanced Transverse Precast Sleepers across FULL 47.62 km (North + Underground + South)
    const totalLen = yellowCurveRef.getLength();
    const sleeperStep = 0.52;
    const sleeperCount = Math.min(2200, Math.floor(totalLen / sleeperStep));
    const sleeperInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.11, 0.04, 0.28),
      m.sleeperWood,
      sleeperCount * 2
    );
    sleeperInst.receiveShadow = true;
    sleeperInst.frustumCulled = false;

    const dummy = new THREE.Object3D();
    let sIdx = 0;
    const oheCoords = [];
    for (let i = 0; i < sleeperCount; i++) {
      const u = (i + 0.5) / sleeperCount;
      const pt = yellowCurveRef.getPointAt(u);
      const tan = yellowCurveRef.getTangentAt(u);
      const len = Math.hypot(tan.x, tan.z) || 1;
      const px = -tan.z / len;
      const pz = tan.x / len;
      const yaw = Math.atan2(-tan.z, tan.x);
      const pitch = Math.asin(Math.max(-0.45, Math.min(0.45, tan.y)));

      [-0.34, 0.34].forEach((laneOff) => {
        dummy.position.set(pt.x + px * laneOff, pt.y + 0.02, pt.z + pz * laneOff);
        dummy.rotation.set(0, yaw, pitch);
        dummy.updateMatrix();
        sleeperInst.setMatrixAt(sIdx++, dummy.matrix);
      });

      if (i % 10 === 0 && pt.y > 1.8) {
        oheCoords.push({ pt, yaw });
      }
    }
    sleeperInst.count = sIdx;
    sleeperInst.instanceMatrix.needsUpdate = true;
    yellowNetworkGroup.add(sleeperInst);

    // 4. Instanced Steel OHE Catenary Portals on Elevated Viaduct
    if (oheCoords.length) {
      const oheTop = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 1.18), m.steelDark, oheCoords.length);
      const ohePosts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.85, 0.05), m.steelDark, oheCoords.length * 2);
      oheTop.frustumCulled = false;
      ohePosts.frustumCulled = false;
      let pIdx = 0;
      oheCoords.forEach(({ pt, yaw }, idx) => {
        const px = Math.sin(yaw) * 0.56;
        const pz = Math.cos(yaw) * 0.56;
        dummy.position.set(pt.x, pt.y + 0.78, pt.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.updateMatrix();
        oheTop.setMatrixAt(idx, dummy.matrix);

        [-1, 1].forEach((s) => {
          dummy.position.set(pt.x + px * s, pt.y + 0.38, pt.z + pz * s);
          dummy.updateMatrix();
          ohePosts.setMatrixAt(pIdx++, dummy.matrix);
        });
      });
      oheTop.instanceMatrix.needsUpdate = true;
      ohePosts.instanceMatrix.needsUpdate = true;
      yellowNetworkGroup.add(oheTop, ohePosts);
    }

    // 5. Instanced DMRC Cylindrical Viaduct Piers along elevated sections
    const pierPts = [];
    for (let i = 2; i < pts.length; i += 4) {
      const py = yellowNodeElevation(i);
      if (py > 0.65) pierPts.push([pts[i][0], py, pts[i][2]]);
    }
    if (pierPts.length) {
      const pierInst = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.17, 0.25, 1.0, 10),
        M().stdMat(0xDFDAD0, { roughness: 0.72 }),
        pierPts.length
      );
      pierInst.castShadow = true;
      pierInst.frustumCulled = false;
      pierPts.forEach(([px, py, pz], i) => {
        const h = Math.max(0.2, py - 0.16);
        dummy.position.set(px, h * 0.5 + 0.12, pz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        pierInst.setMatrixAt(i, dummy.matrix);
      });
      pierInst.instanceMatrix.needsUpdate = true;
      yellowNetworkGroup.add(pierInst);
    }

    // 6. North Portal (Model Town -> GTB) & South Portal (Saket -> Qutab) Concrete Gateway Collars
    const portalMat = new THREE.MeshStandardMaterial({ color: 0xE11D48, emissive: 0xBE123C, emissiveIntensity: 0.30, roughness: 0.35 });
    [110, 232].forEach((pIdx) => {
      if (!elevVecs[pIdx] || !yellowCurveRef) return;
      const pPos = elevVecs[pIdx];
      const tan = yellowCurveRef.getTangentAt(pIdx / (pts.length - 1));
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.16, 8, 18, Math.PI), portalMat);
      arch.rotation.y = Math.atan2(-tan.z, tan.x) + Math.PI / 2;
      arch.position.set(pPos.x, pPos.y + 0.14, pPos.z);
      yellowNetworkGroup.add(arch);
    });

    scene.add(yellowNetworkGroup);
  }

  /** Subtle muted rendering of the 7 crossing DMRC lines for interchange context */
  function buildInterchangeNetwork(linesData) {
    interchangeNetworkGroup = new THREE.Group();
    if (!linesData) return;

    linesData.forEach((line) => {
      if (line.id === 'yellow-line') return;
      const pts = line.points;
      if (!pts || pts.length < 2) return;

      const vectors = pts.map(p => new THREE.Vector3(p[0], p[1] > 0 ? p[1] + 0.35 : 0.22, p[2]));
      const curve = new THREE.CatmullRomCurve3(vectors);
      curve.curveType = 'centripetal';
      curve.tension = 0.4;
      line._curve = curve;

      const lineHex = parseInt(line.color.replace('#', '0x'), 16) || 0x94A3B8;
      const mat = new THREE.MeshStandardMaterial({
        color: lineHex,
        emissive: lineHex,
        emissiveIntensity: 0.22,
        roughness: 0.4,
        transparent: true,
        opacity: 0.45
      });
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(28, pts.length * 5), 0.22, 6, false), mat);
      interchangeNetworkGroup.add(mesh);
    });

    interchangeNetworkGroup.visible = showInterchangeLines;
    scene.add(interchangeNetworkGroup);
  }

  /** Instantiates all 37 Yellow Line stations using MetroKit.CityNodes */
  function buildYellowStationsWithMetroKit() {
    stationsGroup = new THREE.Group();
    stationNodes = [];
    beaconPulsers = [];

    const topoByName = new Map();
    (topologyData.stations || []).forEach((s) => {
      if (s.line === 'yellow-line') topoByName.set(s.name, s);
    });
    const svcStations = (yellowServiceData && yellowServiceData.stations) || [];
    const totalPts = (yellowNodeCurves().rawPts || []).length || 389;

    svcStations.forEach((svcSt, i) => {
      const cleanName = svcSt.name.replace(' Gurugram', '');
      const topoSt = topoByName.get(cleanName) || topoByName.get(svcSt.name);
      const osmSt = osmYellowData && osmYellowData.stations ? osmYellowData.stations[i] : null;

      let x, z;
      if (topoSt) {
        x = topoSt.x;
        z = topoSt.z;
      } else {
        const [lon, lat] = svcSt.coordinates;
        [x, z] = C().projectToPlinth(lon, lat);
      }

      const nodeIdx = osmSt ? osmSt.trackNodeIndex : Math.round((i / 36) * (totalPts - 1));
      const tNorm = Math.max(0.002, Math.min(0.998, nodeIdx / (totalPts - 1)));
      const tan = yellowCurveRef ? yellowCurveRef.getTangentAt(tNorm) : new THREE.Vector3(0, 0, 1);
      const yawRad = Math.atan2(-tan.z, tan.x);

      const stationRec = {
        ...svcSt,
        name: svcSt.name,
        x,
        z,
        y: svcSt.structure === 'elevated' ? VIADUCT_Y : SUBWAY_Y,
        line: 'yellow-line',
        lineColor: '#F59E0B',
        major: !!svcSt.major || (svcSt.interchanges && svcSt.interchanges.length > 0),
        terminus: !!svcSt.isTerminal,
        interchange: svcSt.interchanges && svcSt.interchanges.length ? svcSt.interchanges.join(' · ') : (topoSt ? topoSt.interchange : null)
      };

      const built = C().buildCityStationNode(stationRec, {
        yawRad,
        viaductY: VIADUCT_Y,
        subwayY: SUBWAY_Y
      });
      stationRec.archetype = built.archetype;
      built.group.userData = { isStation: true, station: stationRec, index: i };

      if (built.halo) beaconPulsers.push(built.halo);
      stationsGroup.add(built.group);
      stationNodes.push(stationRec);
    });

    scene.add(stationsGroup);
  }

  /* ───────────────────────────────────────────────────────────
   * 4. ARTICULATED METROKIT ROLLING STOCK FLEET
   * ─────────────────────────────────────────────────────────── */
  function buildAlignedFleet(linesData) {
    const TF = window.MetroKit && window.MetroKit.TrainFactory;
    yellowFleetGroup = new THREE.Group();
    interchangeFleetGroup = new THREE.Group();
    activeTrains = [];

    const addFleetCurve = (curve, lineHex, isYellow, count, targetGroup, laneOffsetAbs, speedRatio) => {
      if (!curve || !TF) return;
      const totalLen = curve.getLength();
      for (let i = 0; i < count; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const consist = TF.createArticulatedTrain({
          lineColor: lineHex,
          carCount: isYellow ? 4 : 3,
          directionSign: dir,
          carScale: isYellow ? 0.105 : 0.088,
          withPointLight: false
        });
        const dist = (i / count) * totalLen;
        const laneOff = dir > 0 ? laneOffsetAbs : -laneOffsetAbs;
        TF.updateTrainOnCurve(consist, curve, dist, totalLen, laneOff, 0.05);
        targetGroup.add(consist);
        activeTrains.push({
          id: `${isYellow ? 'YL' : 'INT'}-${i}`,
          isYellow,
          curve,
          totalLen,
          dist,
          speed: (isYellow ? 6.8 : 5.4) * speedRatio,
          direction: dir,
          trackOffset: laneOff,
          meshGroup: consist,
          headlight: null
        });
      }
    };

    if (yellowCurveRef) {
      addFleetCurve(yellowCurveRef, M().LINE_COLORS.yellow, true, 12, yellowFleetGroup, 0.34, 1.0);
    }

    (linesData || []).forEach((line) => {
      if (line.id === 'yellow-line' || !line._curve) return;
      const hex = parseInt(line.color.replace('#', '0x'), 16) || 0x94A3B8;
      addFleetCurve(line._curve, hex, false, 2, interchangeFleetGroup, 0.25, 0.9);
    });

    interchangeFleetGroup.visible = showInterchangeLines;
    scene.add(yellowFleetGroup, interchangeFleetGroup);
  }

  /* ───────────────────────────────────────────────────────────
   * 5. INTERACTIVITY & TEXT SPRITE HELPERS
   * ─────────────────────────────────────────────────────────── */
  function createTextSprite(text, bgColor, textColor, w = 256, h = 64) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bgColor || 'rgba(15, 23, 42, 0.88)';
    roundRect(ctx, 4, 4, w - 8, h - 8, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    roundRect(ctx, 4, 4, w - 8, h - 8, 12);
    ctx.stroke();

    ctx.fillStyle = textColor || '#FFFFFF';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(14, 3.5, 1);
    return sprite;
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function setupInteraction() {
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    tooltipEl = document.getElementById('three-station-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'three-station-tooltip';
      tooltipEl.className = 'three-station-tooltip hidden';
      document.body.appendChild(tooltipEl);
    }

    const ringGeo = new THREE.RingGeometry(2.2, 3.1, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B, transparent: true, opacity: 0.0, side: THREE.DoubleSide });
    pulseRingMesh = new THREE.Mesh(ringGeo, ringMat);
    pulseRingMesh.rotateX(-Math.PI / 2);
    pulseRingMesh.position.y = 0.24;
    scene.add(pulseRingMesh);

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('click', onPointerClick);
  }

  function findHitStation(ev) {
    if (!renderer || !camera || !stationsGroup) return null;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(stationsGroup.children, true);
    if (!hits.length) return null;
    let t = hits[0].object;
    while (t && t.parent && !t.userData.isStation) t = t.parent;
    return t && t.userData && t.userData.station ? t.userData.station : null;
  }

  function onPointerMove(e) {
    if (!isRunning) return;
    const st = findHitStation(e);
    if (st) {
      canvas.style.cursor = 'pointer';
      if (tooltipEl) {
        const struct = st.structure === 'elevated' ? `+${st.elevM || 15}m Elevated Viaduct` : `${st.elevM || -18}m Tube Cutaway`;
        tooltipEl.innerHTML = `
          <div class="tooltip-header">
            <span class="tooltip-line-badge" style="background:#F59E0B;"></span>
            <strong class="tooltip-name">${st.name}</strong>
          </div>
          <div class="tooltip-meta">
            <span>${struct}</span>
            ${st.interchange ? `<span class="tooltip-interchange">⇄ ${st.interchange}</span>` : ''}
          </div>
          <div class="tooltip-cta">Click to zoom & inspect MetroKit cutaway ➔</div>
        `;
        tooltipEl.style.left = `${e.clientX + 16}px`;
        tooltipEl.style.top = `${e.clientY + 12}px`;
        tooltipEl.classList.remove('hidden');
      }
      return;
    }

    if (landmarksGroup) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const lmHits = raycaster.intersectObjects(landmarksGroup.children, true);
      if (lmHits.length) {
        let t = lmHits[0].object;
        while (t && t.parent && !t.userData.isLandmark) t = t.parent;
        if (t && t.userData && t.userData.name) {
          canvas.style.cursor = 'pointer';
          if (tooltipEl) {
            tooltipEl.innerHTML = `
              <div class="tooltip-header"><span class="tooltip-icon">🏛️</span><strong class="tooltip-name">${t.userData.name}</strong></div>
              <div class="tooltip-meta">Delhi Architectural Landmark</div>
            `;
            tooltipEl.style.left = `${e.clientX + 16}px`;
            tooltipEl.style.top = `${e.clientY + 12}px`;
            tooltipEl.classList.remove('hidden');
          }
          return;
        }
      }
    }

    canvas.style.cursor = 'default';
    if (tooltipEl) tooltipEl.classList.add('hidden');
  }

  function onPointerClick(e) {
    if (!isRunning) return;
    const st = findHitStation(e);
    if (st) {
      flyToStation(st.name, st.x, st.z, st.y);
      if (window.openStationPanel) window.openStationPanel(st.index !== undefined ? st.index : st.name);
      playDMRCChime();
    }
  }

  /* ───────────────────────────────────────────────────────────
   * 6. ANIMATION LOOP & CAMERA SPRINGS
   * ─────────────────────────────────────────────────────────── */
  function animate() {
    if (!isRunning) return;
    animId = requestAnimationFrame(animate);

    const now = performance.now();
    const dt = Math.min(0.08, Math.max(0.001, (now - lastFrameMs) / 1000));
    lastFrameMs = now;

    const TF = window.MetroKit && window.MetroKit.TrainFactory;
    if (!isPaused && activeTrains.length && TF) {
      activeTrains.forEach((tr) => {
        if (!tr.isYellow && !showInterchangeLines) return;
        tr.dist += tr.speed * tr.direction * dt;
        if (tr.dist > tr.totalLen - 1.5) tr.dist = 1.5;
        if (tr.dist < 1.5) tr.dist = tr.totalLen - 1.5;
        TF.updateTrainOnCurve(tr.meshGroup, tr.curve, tr.dist, tr.totalLen, tr.trackOffset, 0.05);
      });
    }

    if (followTrainMode && yellowCurveRef) {
      const lead = activeTrains.find(t => t.isYellow);
      const leadCar = lead && lead.meshGroup && lead.meshGroup.userData.cars && lead.meshGroup.userData.cars[1];
      if (leadCar) {
        const p = leadCar.position;
        springState.targetLook.set(p.x, p.y + 0.5, p.z);
        springState.targetPos.set(p.x - 10, p.y + 12, p.z + 16);
        springState.active = true;
      }
    }

    if (springState.active && camera && controls) {
      const resp = 0.42;
      const [px, pvx] = stepSpring(camera.position.x, springState.posVel.x, springState.targetPos.x, resp, dt);
      const [py, pvy] = stepSpring(camera.position.y, springState.posVel.y, springState.targetPos.y, resp, dt);
      const [pz, pvz] = stepSpring(camera.position.z, springState.posVel.z, springState.targetPos.z, resp, dt);
      camera.position.set(px, py, pz);
      springState.posVel.set(pvx, pvy, pvz);

      const [lx, lvx] = stepSpring(controls.target.x, springState.lookVel.x, springState.targetLook.x, resp, dt);
      const [ly, lvy] = stepSpring(controls.target.y, springState.lookVel.y, springState.targetLook.y, resp, dt);
      const [lz, lvz] = stepSpring(controls.target.z, springState.lookVel.z, springState.targetLook.z, resp, dt);
      controls.target.set(lx, ly, lz);
      springState.lookVel.set(lvx, lvy, lvz);

      if (!followTrainMode && camera.position.distanceTo(springState.targetPos) < 0.25 && controls.target.distanceTo(springState.targetLook) < 0.2) {
        camera.position.copy(springState.targetPos);
        controls.target.copy(springState.targetLook);
        springState.posVel.set(0, 0, 0);
        springState.lookVel.set(0, 0, 0);
        springState.active = false;
      }
    }

    // Dynamic zoom-adaptive crisp studio shadows focused around controls.target
    if (dirLight && camera && controls) {
      const dist = camera.position.distanceTo(controls.target);
      const halfSpan = Math.max(26, Math.min(240, dist * 0.54));
      dirLight.target.position.copy(controls.target);
      dirLight.position.set(controls.target.x + halfSpan * 0.55, controls.target.y + halfSpan * 1.05, controls.target.z + halfSpan * 0.65);
      const sc = dirLight.shadow.camera;
      if (Math.abs(sc.right - halfSpan) > 2.5) {
        sc.left = -halfSpan;
        sc.right = halfSpan;
        sc.top = halfSpan;
        sc.bottom = -halfSpan;
        sc.far = halfSpan * 3.4;
        sc.updateProjectionMatrix();
      }
    }

    applyThemeStep(dt);

    if (beaconPulsers.length) {
      const t = now * 0.0028;
      const s = 1.0 + 0.14 * Math.sin(t);
      const op = 0.34 + 0.18 * Math.cos(t);
      beaconPulsers.forEach(b => {
        b.scale.set(s, s, 1);
        if (b.material) b.material.opacity = op;
      });
    }

    if (pulseRingMesh && pulseRingAnimStart > 0) {
      const t = (now - pulseRingAnimStart) / 1400;
      if (t < 1.0) {
        pulseRingMesh.scale.set(1 + t * 3.8, 1 + t * 3.8, 1);
        pulseRingMesh.material.opacity = (1 - t) * 0.75;
      } else {
        pulseRingMesh.material.opacity = 0;
        pulseRingAnimStart = 0;
      }
    }

    controls.update();
    renderer.render(scene, camera);
  }

  function start() {
    if (!isInitialized) return;
    isRunning = true;
    if (canvas) canvas.style.display = 'block';
    lastFrameMs = performance.now();

    const tagEl = document.querySelector('.diorama-tag');
    const titleEl = document.getElementById('diorama-stage-title');
    if (tagEl) tagEl.textContent = 'DELHI NCR · YELLOW LINE 3D ARCHITECTURAL MAP (47.62 KM)';
    if (titleEl) titleEl.textContent = (SECTORS[currentSector] || SECTORS.all).title;

    syncChromeTheme(currentLighting === 'night');
    onWindowResize();
    animate();
  }

  function stop() {
    isRunning = false;
    if (canvas) canvas.style.display = 'none';
    if (tooltipEl) tooltipEl.classList.add('hidden');
    document.querySelector('.master-mode-strip')?.classList.remove('dark-hud');
    document.querySelector('.station-search-container')?.classList.remove('dark-hud');
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function applyTarget(pos, look, immediate = false) {
    if (!camera || !controls) return;
    springState.targetPos.set(pos[0], pos[1], pos[2]);
    springState.targetLook.set(look[0], look[1], look[2]);
    if (immediate || prefersReducedMotion()) {
      camera.position.copy(springState.targetPos);
      controls.target.copy(springState.targetLook);
      controls.update();
      springState.active = false;
    } else {
      springState.active = true;
    }
  }

  function flyToSector(sectorKey) {
    currentSector = SECTORS[sectorKey] ? sectorKey : 'all';
    followTrainMode = false;
    document.getElementById('btn-follow-train-3d')?.classList.remove('active');
    const s = SECTORS[currentSector];
    const titleEl = document.getElementById('diorama-stage-title');
    if (titleEl && isRunning) titleEl.textContent = s.title;
    applyTarget(s.pos, s.look, false);
  }

  function flyToStation(stationName, x, z, y, immediate = false) {
    if (!camera || !controls) return;
    const st = getStationByName(stationName);
    const sx = x !== undefined ? x : (st ? st.x : null);
    const sz = z !== undefined ? z : (st ? st.z : null);
    const sy = y !== undefined ? y : (st ? st.y : 1.0);
    if (sx === null || sz === null) return;

    followTrainMode = false;
    document.getElementById('btn-follow-train-3d')?.classList.remove('active');
    applyTarget([sx - 5.2, sy + 5.8, sz + 7.6], [sx, sy, sz], !!immediate);

    if (pulseRingMesh) {
      pulseRingMesh.position.set(sx, sy + 0.16, sz);
      pulseRingAnimStart = performance.now();
    }
  }

  function setViewMode(mode) {
    if (!camera || !controls) return;
    followTrainMode = false;
    document.getElementById('btn-follow-train-3d')?.classList.remove('active');
    if (mode === '2d') {
      applyTarget([-34, 290, 22.001], [-34, 0, 22], false);
    } else {
      const s = SECTORS[currentSector] || SECTORS.all;
      applyTarget(s.pos, s.look, false);
    }
  }

  function setInterchangeVisibility(visible) {
    showInterchangeLines = !!visible;
    if (interchangeNetworkGroup) interchangeNetworkGroup.visible = showInterchangeLines;
    if (interchangeFleetGroup) interchangeFleetGroup.visible = showInterchangeLines;
    activeTrains.forEach(tr => {
      if (tr.headlight && !tr.isYellow) tr.headlight.visible = currentLighting === 'night' && showInterchangeLines;
    });
    const btnY = document.getElementById('btn-overlay-yellow');
    const btnAll = document.getElementById('btn-overlay-interchanges');
    if (btnY) btnY.classList.toggle('active', !showInterchangeLines);
    if (btnAll) btnAll.classList.toggle('active', showInterchangeLines);
  }

  function playDMRCChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      [293.66, 369.99, 440.0].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.18);
        gain.gain.setValueAtTime(0.001, now + idx * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.18 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.18 + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.18);
        osc.stop(now + idx * 0.18 + 0.46);
      });
    } catch (e) {}
  }

  function bindHUDControls() {
    document.querySelectorAll('.hud-sector-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isRunning) return;
        document.querySelectorAll('.hud-sector-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        flyToSector(btn.getAttribute('data-sector'));
      });
    });

    document.getElementById('btn-overlay-yellow')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isRunning) return;
      setInterchangeVisibility(false);
    });
    document.getElementById('btn-overlay-interchanges')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isRunning) return;
      setInterchangeVisibility(true);
    });
    document.querySelectorAll('[data-plinth-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isRunning) return;
        const mode = btn.getAttribute('data-plinth-view');
        document.querySelectorAll('[data-plinth-view]').forEach(b => b.classList.toggle('active', b === btn));
        setViewMode(mode);
      });
    });

    document.getElementById('btn-light-day')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isRunning) return;
      setLightingMode('day');
    });
    document.getElementById('btn-light-night')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isRunning) return;
      setLightingMode('night');
    });

    const followBtn = document.getElementById('btn-follow-train-3d');
    followBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isRunning) return;
      followTrainMode = !followTrainMode;
      followBtn.classList.toggle('active', followTrainMode);
      if (!followTrainMode) flyToSector(currentSector);
    });

    const pauseBtn = document.getElementById('btn-sim-toggle');
    pauseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isRunning) return;
      isPaused = !isPaused;
      pauseBtn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
      pauseBtn.classList.toggle('active', !isPaused);
    });

    document.getElementById('btn-play-chime')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isRunning) return;
      playDMRCChime();
    });
  }

  function getStations() {
    return stationNodes;
  }

  function getStationByName(name) {
    if (!name) return null;
    const q = String(name).toLowerCase().trim();
    return stationNodes.find(s =>
      s.name.toLowerCase() === q ||
      s.id === q ||
      s.name.toLowerCase().includes(q)
    ) || null;
  }

  function onWindowResize() {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  return {
    init,
    start,
    stop,
    flyToSector,
    flyToStation,
    setLightingMode,
    setViewMode,
    setInterchangeVisibility,
    playDMRCChime,
    getStations,
    getStationByName
  };
})();
