/* ============================================================
 * DELHI METRO — Full Network 3D Architectural Exhibition Model
 * Museum-Grade Plinth, Yamuna River, Delhi Ridge, Landmarks & 8 Lines
 * Apple Design System: Fluid Springs, 60 FPS GPU Instancing, Zero Tile Bills
 * ============================================================ */

window.DelhiMetro3D = (function () {
  'use strict';

  let container = null;
  let canvas = null;
  let scene, camera, renderer, controls;
  let animId = null;
  let isRunning = false;
  let isInitialized = false;

  // Data & Scene Objects
  let topologyData = null;
  let plinthMesh = null;
  let yamunaMesh = null;
  let parksGroup = null;
  let landmarksGroup = null;
  let networkGroup = null;
  let stationsGroup = null;
  let beaconPulsers = [];

  // Interactive Raycasting & Hover Tooltip
  let raycaster = null;
  let mouse = null;
  let hoveredStation = null;
  let tooltipEl = null;
  let pulseRingMesh = null;
  let pulseRingAnimStart = 0;

  // Fleet simulation
  let fleetGroup = null;
  let activeTrains = [];
  const TRAIN_CAR_LENGTH = 1.35;
  const TRAIN_CAR_WIDTH = 0.44;
  const TRAIN_CAR_HEIGHT = 0.38;
  const CARS_PER_TRAIN = 6;

  // Lighting
  let sunLight, hemiLight, ambientFill, dirLight;
  let currentLighting = 'day'; // 'day' | 'night'
  let currentViewMode = '3d';   // '3d' | '2d'

  // Camera Animation State (Apple Fluid Spring)
  let isTransitioningCamera = false;
  let camTargetPos = new THREE.Vector3();
  let camTargetLookAt = new THREE.Vector3();
  let camStartPos = new THREE.Vector3();
  let camStartLookAt = new THREE.Vector3();
  let camTransitionStart = 0;
  let camTransitionDuration = 1200;

  // Audio Context for DMRC Chime
  let audioCtx = null;

  // Color Palette Constants
  const PALETTE = {
    day: {
      bg: 0xF8F6F0,           // Gallery ivory
      fog: 0xF8F6F0,
      plinth: 0xEEE9DF,       // Satin architectural clay
      plinthEdge: 0xD8D2C4,
      gridLines: 0xDCD5C6,
      yamuna: 0x3E6B89,       // Reflective slate blue
      ridge: 0x2E522B,        // Rich matte architectural forest green
      landmark: 0xFFFFFF,     // Pure white clay
      ambient: 0xFFFDF8,
      sun: 0xFFF9E8
    },
    night: {
      bg: 0x060911,           // Midnight space
      fog: 0x060911,
      plinth: 0x0A0E17,       // Deep obsidian slate
      plinthEdge: 0x1E293B,
      gridLines: 0x162032,
      yamuna: 0x0A2239,       // Dark reflective indigo
      ridge: 0x0D2012,        // Deep pine green
      landmark: 0x334155,     // Moonlit slate
      ambient: 0x1E293B,
      sun: 0x38BDF8
    }
  };

  // ───────────────────────────────────────────────────────────
  //  1. INITIALIZATION & SCENE SETUP
  // ───────────────────────────────────────────────────────────
  async function init(containerEl) {
    if (!containerEl) return;
    if (isInitialized) {
      onWindowResize();
      return;
    }

    container = containerEl;
    canvas = document.getElementById('three-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'three-canvas';
      container.prepend(canvas);
    }

    // 1. Scene with Architectural Fog
    scene = new THREE.Scene();
    scene.background = new THREE.Color(PALETTE.day.bg);
    scene.fog = new THREE.FogExp2(PALETTE.day.fog, 0.0016);

    // 2. Perspective Camera (Clean 45° angle)
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(42, aspect, 1, 1500);
    camera.position.set(0, 160, 200);
    camera.lookAt(0, 0, 15);

    // 3. WebGL Renderer with High-DPI & Soft Shadows
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

    // 4. OrbitControls with Apple Damped Physics
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 15;
    controls.maxDistance = 550;
    controls.minPolarAngle = Math.PI / 12; // Allow near top-down
    controls.maxPolarAngle = Math.PI / 2.08; // Prevent clipping under plinth
    controls.target.set(0, 0, 15);

    // 5. Studio Lighting
    setupLighting();

    // 6. Interactive Raycaster & HTML Tooltip
    setupInteraction();

    // 7. Load Master Topology Data
    try {
      const res = await fetch('src/data/delhi_network_topology.json?v=' + Date.now());
      topologyData = await res.json();
      buildSceneFromTopology(topologyData);
    } catch (err) {
      console.error('[DelhiMetro3D] Failed to load topology data:', err);
    }

    // 8. Event Listeners
    window.addEventListener('resize', onWindowResize);
    bindHUDControls();

    isInitialized = true;
    start();
  }

  // ───────────────────────────────────────────────────────────
  //  2. LIGHTING & ATMOSPHERE
  // ───────────────────────────────────────────────────────────
  function setupLighting() {
    ambientFill = new THREE.AmbientLight(PALETTE.day.ambient, 0.75);
    scene.add(ambientFill);

    hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0xE2E8F0, 0.55);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(PALETTE.day.sun, 1.15);
    dirLight.position.set(120, 240, 140);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 600;
    const shadowD = 220;
    dirLight.shadow.camera.left = -shadowD;
    dirLight.shadow.camera.right = shadowD;
    dirLight.shadow.camera.top = shadowD;
    dirLight.shadow.camera.bottom = -shadowD;
    dirLight.shadow.bias = -0.0004;
    scene.add(dirLight);
  }

  function setLightingMode(mode) {
    currentLighting = mode;
    const p = PALETTE[mode];
    const isNight = mode === 'night';

    scene.background.setHex(p.bg);
    scene.fog.color.setHex(p.fog);
    ambientFill.color.setHex(p.ambient);
    ambientFill.intensity = isNight ? 0.35 : 0.75;
    hemiLight.intensity = isNight ? 0.25 : 0.55;
    dirLight.color.setHex(p.sun);
    dirLight.intensity = isNight ? 0.45 : 1.15;

    if (plinthMesh) {
      plinthMesh.material.color.setHex(p.plinth);
    }
    if (yamunaMesh) {
      yamunaMesh.material.color.setHex(p.yamuna);
      yamunaMesh.material.emissive.setHex(isNight ? 0x051329 : 0x000000);
    }
    if (parksGroup) {
      parksGroup.traverse(child => {
        if (child.isMesh && child.userData.isPark) {
          child.material.color.setHex(p.ridge);
        }
      });
    }

    // Toggle train headlight SpotLights at night
    if (activeTrains && activeTrains.length > 0) {
      activeTrains.forEach(tr => {
        if (tr.headlight) {
          tr.headlight.visible = isNight;
        }
      });
    }

    // Toggle HUD theme
    const hud = document.querySelector('.three-hud-panel');
    const headerPill = document.querySelector('.three-header-pill');
    if (hud) hud.classList.toggle('dark-hud', isNight);
    if (headerPill) headerPill.classList.toggle('dark-hud', isNight);
  }

  // ───────────────────────────────────────────────────────────
  //  3. BUILD SCENE FROM TOPOLOGY
  // ───────────────────────────────────────────────────────────
  function buildSceneFromTopology(data) {
    if (!data) return;

    // 1. Plinth Pedestal
    buildPlinth(data.metadata.plinth);

    // 2. Yamuna River Ribbon
    buildYamuna(data.yamuna);

    // 3. Delhi Ridge & Parks
    buildParks(data.parks);

    // 4. Landmark Silhouettes
    buildLandmarks(data.landmarks);

    // 5. Transit Network (8 Lines)
    buildTransitNetwork(data.lines);

    // 6. Station Beacons & Labels (140+ Stations)
    buildStations(data.stations);

    // 7. Active Multi-Line Fleet Simulation
    buildFleet(data.lines);
  }

  // ── Plinth: The Museum Exhibition Baseboard ────────────────
  function buildPlinth(plinthMeta) {
    const w = plinthMeta.width || 520;
    const d = plinthMeta.depth || 540;
    const h = plinthMeta.height || 16;

    const group = new THREE.Group();

    // Main Pedestal Box
    const boxGeo = new THREE.BoxGeometry(w, h, d);
    const boxMat = new THREE.MeshStandardMaterial({
      color: PALETTE.day.plinth,
      roughness: 0.82,
      metalness: 0.05
    });
    plinthMesh = new THREE.Mesh(boxGeo, boxMat);
    plinthMesh.position.set(0, -h / 2, 0);
    plinthMesh.receiveShadow = true;
    group.add(plinthMesh);

    // Beveled Chamfer Edge Perimeter
    const edgeGeo = new THREE.EdgesGeometry(boxGeo);
    const edgeMat = new THREE.LineBasicMaterial({ color: PALETTE.day.plinthEdge, linewidth: 1.5 });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    edgeLines.position.copy(plinthMesh.position);
    group.add(edgeLines);

    // Subtle 1km Metric Coordinate Grid on Top Surface
    const gridHelper = new THREE.GridHelper(w, 52, 0xDCD5C6, 0xE8E2D5);
    gridHelper.position.set(0, 0.01, 0);
    gridHelper.material.opacity = 0.55;
    gridHelper.material.transparent = true;
    group.add(gridHelper);

    scene.add(group);
  }

  // ── Yamuna River: Reflective Water Ribbon ──────────────────
  function buildYamuna(yamunaData) {
    if (!yamunaData || !yamunaData.ribbonLeft || !yamunaData.ribbonRight) return;

    const left = yamunaData.ribbonLeft;
    const right = yamunaData.ribbonRight;
    const count = Math.min(left.length, right.length);

    const geom = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];

    for (let i = 0; i < count - 1; i++) {
      const y = 0.04;
      const p1 = [left[i][0] * 1.15, y, left[i][2] * 1.05];
      const p2 = [right[i][0] * 1.15, y, right[i][2] * 1.05];
      const p3 = [left[i + 1][0] * 1.15, y, left[i + 1][2] * 1.05];
      const p4 = [right[i + 1][0] * 1.15, y, right[i + 1][2] * 1.05];

      // Triangle 1
      positions.push(p1[0], p1[1], p1[2]);
      positions.push(p2[0], p2[1], p2[2]);
      positions.push(p3[0], p3[1], p3[2]);

      // Triangle 2
      positions.push(p2[0], p2[1], p2[2]);
      positions.push(p4[0], p4[1], p4[2]);
      positions.push(p3[0], p3[1], p3[2]);

      const u = i / (count - 1);
      const uNext = (i + 1) / (count - 1);
      uvs.push(0, u,  1, u,  0, uNext);
      uvs.push(1, u,  1, uNext,  0, uNext);
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.computeVertexNormals();

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2A759E,
      roughness: 0.12,
      metalness: 0.40,
      transparent: true,
      opacity: 0.95
    });

    yamunaMesh = new THREE.Mesh(geom, waterMat);
    yamunaMesh.receiveShadow = true;
    scene.add(yamunaMesh);

    // Add Yamuna River Label
    const riverLabel = createTextSprite('Yamuna River (यमुना)', '#0284C7', '#FFFFFF');
    riverLabel.position.set(45, 1.8, 30);
    scene.add(riverLabel);
  }

  // ── Helper: Crisp Canvas Text Sprite ───────────────────────
  function createTextSprite(text, bgColor, textColor) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d');

    // Rounded tag background
    ctx.fillStyle = bgColor || 'rgba(15, 23, 42, 0.85)';
    roundRect(ctx, 4, 4, 248, 56, 12);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    roundRect(ctx, 4, 4, 248, 56, 12);
    ctx.stroke();

    // Text
    ctx.fillStyle = textColor || '#FFFFFF';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(c);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(16, 4, 1);
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

  // ── Delhi Ridge: Sculpted Green Reserves ───────────────────
  function buildParks(parksData) {
    if (!parksData) return;
    parksGroup = new THREE.Group();

    const parkMat = new THREE.MeshStandardMaterial({
      color: PALETTE.day.ridge,
      roughness: 0.88,
      metalness: 0.0
    });

    parksData.forEach(p => {
      const pts = p.points;
      if (!pts || pts.length < 3) return;

      const shape = new THREE.Shape();
      shape.moveTo(pts[0][0], -pts[0][2]);
      for (let i = 1; i < pts.length; i++) {
        shape.lineTo(pts[i][0], -pts[i][2]);
      }
      shape.closePath();

      const extrudeSettings = {
        depth: 0.22,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.12,
        bevelThickness: 0.10
      };

      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.rotateX(-Math.PI / 2);

      const mesh = new THREE.Mesh(geo, parkMat);
      mesh.position.y = 0.02;
      mesh.receiveShadow = true;
      mesh.userData.isPark = true;
      mesh.userData.name = p.name;
      parksGroup.add(mesh);

      // Scatter low-poly trees across the Ridge
      scatterTreesOnRidge(pts, parksGroup);
    });

    scene.add(parksGroup);
  }

  function scatterTreesOnRidge(boundaryPts, parentGroup) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    boundaryPts.forEach(pt => {
      if (pt[0] < minX) minX = pt[0];
      if (pt[0] > maxX) maxX = pt[0];
      if (pt[2] < minZ) minZ = pt[2];
      if (pt[2] > maxZ) maxZ = pt[2];
    });

    const treeTrunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.7, 5);
    const treeTopGeo = new THREE.IcosahedronGeometry(0.45, 1);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x386641, roughness: 0.82 });

    const numTrees = Math.min(16, Math.floor((maxX - minX) * (maxZ - minZ) / 120));
    for (let i = 0; i < numTrees; i++) {
      const tx = minX + Math.random() * (maxX - minX);
      const tz = minZ + Math.random() * (maxZ - minZ);

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(treeTrunkGeo, trunkMat);
      trunk.position.y = 0.35;
      const top = new THREE.Mesh(treeTopGeo, leafMat);
      top.position.y = 0.85;
      tree.add(trunk, top);
      tree.position.set(tx, 0.22, tz);
      tree.scale.setScalar(0.7 + Math.random() * 0.5);
      parentGroup.add(tree);
    }
  }

  // ── Landmark Silhouettes: 3D Architectural Monuments ───────
  function buildLandmarks(landmarksData) {
    if (!landmarksData) return;
    landmarksGroup = new THREE.Group();

    const lmMat = new THREE.MeshStandardMaterial({
      color: PALETTE.day.landmark,
      roughness: 0.40,
      metalness: 0.12
    });

    landmarksData.forEach(lm => {
      const g = new THREE.Group();

      if (lm.type === 'arch') {
        // India Gate
        const p1 = new THREE.Mesh(new THREE.BoxGeometry(lm.width * 0.28, lm.height, lm.width * 0.35), lmMat);
        p1.position.set(-lm.width * 0.36, lm.height / 2, 0);
        p1.castShadow = true;
        const p2 = new THREE.Mesh(new THREE.BoxGeometry(lm.width * 0.28, lm.height, lm.width * 0.35), lmMat);
        p2.position.set(lm.width * 0.36, lm.height / 2, 0);
        p2.castShadow = true;
        const beam = new THREE.Mesh(new THREE.BoxGeometry(lm.width, lm.height * 0.32, lm.width * 0.40), lmMat);
        beam.position.set(0, lm.height * 0.84, 0);
        beam.castShadow = true;
        g.add(p1, p2, beam);
      } else if (lm.type === 'tower') {
        // Qutab Minar
        const minarMat = new THREE.MeshStandardMaterial({ color: 0xC84B31, roughness: 0.55 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(lm.width * 0.55, lm.width * 0.8, lm.height * 0.35, 16), minarMat);
        base.position.y = lm.height * 0.18;
        const mid = new THREE.Mesh(new THREE.CylinderGeometry(lm.width * 0.40, lm.width * 0.55, lm.height * 0.40, 16), minarMat);
        mid.position.y = lm.height * 0.55;
        const top = new THREE.Mesh(new THREE.CylinderGeometry(lm.width * 0.25, lm.width * 0.40, lm.height * 0.25, 16), minarMat);
        top.position.y = lm.height * 0.85;

        const balconyMat = new THREE.MeshStandardMaterial({ color: 0x8C2508 });
        const b1 = new THREE.Mesh(new THREE.TorusGeometry(lm.width * 0.60, 0.15, 6, 24), balconyMat);
        b1.rotateX(Math.PI / 2);
        b1.position.y = lm.height * 0.4;
        const b2 = new THREE.Mesh(new THREE.TorusGeometry(lm.width * 0.48, 0.12, 6, 24), balconyMat);
        b2.rotateX(Math.PI / 2);
        b2.position.y = lm.height * 0.72;

        g.add(base, mid, top, b1, b2);
      } else if (lm.type === 'circle') {
        // Connaught Place: Concentric Rings
        const innerRing = new THREE.Mesh(new THREE.TorusGeometry(lm.width * 0.6, 0.25, 8, 36), lmMat);
        innerRing.rotateX(Math.PI / 2);
        innerRing.position.y = 0.20;
        const outerRing = new THREE.Mesh(new THREE.TorusGeometry(lm.width, 0.30, 8, 36), lmMat);
        outerRing.rotateX(Math.PI / 2);
        outerRing.position.y = 0.20;
        g.add(innerRing, outerRing);
      } else {
        // Generalized Architectural Pavilion
        const box = new THREE.Mesh(new THREE.BoxGeometry(lm.width, lm.height, lm.width * 0.7), lmMat);
        box.position.y = lm.height / 2;
        box.castShadow = true;
        g.add(box);
      }

      // Add Floating Text Sprite Label for each landmark
      const lmLabel = createTextSprite(lm.name, '#0F172A', '#FFFFFF');
      lmLabel.position.set(0, lm.height + 3.2, 0);
      g.add(lmLabel);

      g.position.set(lm.x, lm.y, lm.z);
      g.userData = { isLandmark: true, name: lm.name, id: lm.id };
      landmarksGroup.add(g);
    });

    scene.add(landmarksGroup);
  }

  // ── Transit Network: Volumetric 3D Viaducts & Tubes ────────
  function buildTransitNetwork(linesData) {
    if (!linesData) return;
    networkGroup = new THREE.Group();

    const pierGeo = new THREE.CylinderGeometry(0.28, 0.38, 2.8, 8);
    const pierMat = new THREE.MeshStandardMaterial({ color: 0xD8D4CD, roughness: 0.75 });

    linesData.forEach(line => {
      const pts = line.points;
      if (!pts || pts.length < 2) return;

      const vectors = pts.map(p => new THREE.Vector3(p[0], p[1], p[2]));
      const curve = new THREE.CatmullRomCurve3(vectors);
      curve.curveType = 'centripetal';
      curve.tension = 0.4;

      line._curve = curve; // Store curve reference for fleet simulation

      // 1. 3D Track Ribbon
      const tubeGeo = new THREE.TubeGeometry(curve, Math.max(32, pts.length * 6), 0.30, 8, false);
      const lineHex = parseInt(line.color.replace('#', '0x'), 16) || 0xF59E0B;
      const lineMat = new THREE.MeshStandardMaterial({
        color: lineHex,
        roughness: 0.28,
        metalness: 0.45,
        emissive: lineHex,
        emissiveIntensity: 0.40
      });

      const tubeMesh = new THREE.Mesh(tubeGeo, lineMat);
      tubeMesh.castShadow = true;
      tubeMesh.receiveShadow = true;
      networkGroup.add(tubeMesh);

      // 2. Concrete Support Piers along Elevated Sections
      pts.forEach(p => {
        if (p[1] > 0.15) { // Elevated section above ground
          const pier = new THREE.Mesh(pierGeo, pierMat);
          pier.position.set(p[0], p[1] / 2, p[2]);
          pier.scale.set(1, p[1] / 2.8, 1);
          pier.castShadow = true;
          networkGroup.add(pier);
        }
      });
    });

    scene.add(networkGroup);
  }

  // ── Station Beacons & Anchors ──────────────────────────────
  function buildStations(stationsData) {
    if (!stationsData) return;
    stationsGroup = new THREE.Group();
    beaconPulsers = [];

    const regBaseGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.18, 16);
    const regCoreGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16);

    const interchangeOuterGeo = new THREE.TorusGeometry(1.2, 0.14, 8, 24);
    const interchangeInnerGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.28, 16);

    stationsData.forEach(s => {
      const g = new THREE.Group();
      const isInterchange = s.major || !!s.interchange;
      const lineHex = s.lineColor ? parseInt(s.lineColor.replace('#', '0x'), 16) : 0xF59E0B;

      if (isInterchange) {
        // Major Interchange: Concentric Ring Beacon
        const ringMat = new THREE.MeshStandardMaterial({
          color: lineHex,
          emissive: lineHex,
          emissiveIntensity: 0.6,
          roughness: 0.25
        });
        const outerRing = new THREE.Mesh(interchangeOuterGeo, ringMat);
        outerRing.rotateX(Math.PI / 2);
        outerRing.position.y = 0.05;

        const coreMat = new THREE.MeshStandardMaterial({
          color: 0xFFFFFF,
          emissive: lineHex,
          emissiveIntensity: 0.45,
          roughness: 0.2
        });
        const innerCore = new THREE.Mesh(interchangeInnerGeo, coreMat);
        innerCore.position.y = 0.14;

        // Pulsing Halo Mesh
        const haloGeo = new THREE.RingGeometry(1.2, 1.8, 24);
        const haloMat = new THREE.MeshBasicMaterial({
          color: lineHex,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide
        });
        const haloMesh = new THREE.Mesh(haloGeo, haloMat);
        haloMesh.rotateX(Math.PI / 2);
        haloMesh.position.y = 0.06;

        g.add(outerRing, innerCore, haloMesh);
        beaconPulsers.push(haloMesh);
      } else {
        // Regular Station Disc
        const baseMat = new THREE.MeshStandardMaterial({
          color: 0xFFFFFF,
          roughness: 0.35,
          metalness: 0.1
        });
        const base = new THREE.Mesh(regBaseGeo, baseMat);
        base.position.y = 0.09;

        const coreMat = new THREE.MeshStandardMaterial({
          color: lineHex,
          emissive: lineHex,
          emissiveIntensity: 0.4
        });
        const core = new THREE.Mesh(regCoreGeo, coreMat);
        core.position.y = 0.16;

        g.add(base, core);
      }

      g.position.set(s.x, Math.max(0.06, s.y), s.z);
      g.userData = { isStation: true, station: s };
      stationsGroup.add(g);
    });

    scene.add(stationsGroup);
  }

  // ── Fleet Simulation: Multi-Line Instanced Trains ──────────
  function buildFleet(linesData) {
    fleetGroup = new THREE.Group();
    activeTrains = [];

    // Distribute scheduled train consists across lines
    linesData.forEach(line => {
      if (!line._curve) return;

      const isYellow = line.id === 'yellow-line';
      const numTrains = isYellow ? 8 : (line.id === 'blue-line' ? 6 : 4);
      const lineHex = parseInt(line.color.replace('#', '0x'), 16) || 0xF59E0B;

      for (let i = 0; i < numTrains; i++) {
        activeTrains.push({
          lineId: line.id,
          curve: line._curve,
          color: line.color,
          lineHex: lineHex,
          progress: i / numTrains,
          speed: (0.00035 + (i % 2) * 0.00008) * (isYellow ? 1.0 : 0.85),
          direction: i % 2 === 0 ? 1 : -1
        });
      }
    });

    // Create Detailed 3D Train Consists with Livery Stripes & Headlights
    const carGeo = new THREE.BoxGeometry(TRAIN_CAR_LENGTH, TRAIN_CAR_HEIGHT, TRAIN_CAR_WIDTH);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xCBD5E1,       // Brushed stainless steel body
      roughness: 0.30,
      metalness: 0.65
    });

    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x0F172A,       // Tinted glass strip
      roughness: 0.15,
      metalness: 0.20
    });

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xFFFBEB,
      emissive: 0xFFFBEB,
      emissiveIntensity: 2.5
    });

    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xEF4444,
      emissive: 0xEF4444,
      emissiveIntensity: 2.0
    });

    activeTrains.forEach(tr => {
      const consistGroup = new THREE.Group();
      const lineStripeMat = new THREE.MeshStandardMaterial({
        color: tr.lineHex,
        emissive: tr.lineHex,
        emissiveIntensity: 0.35,
        roughness: 0.3
      });

      for (let c = 0; c < CARS_PER_TRAIN; c++) {
        const car = new THREE.Group();

        // 1. Car Stainless Body
        const body = new THREE.Mesh(carGeo, bodyMat);
        body.castShadow = true;
        car.add(body);

        // 2. Color Livery Beltline Stripe along sides
        const stripeGeo = new THREE.BoxGeometry(TRAIN_CAR_LENGTH + 0.01, 0.06, TRAIN_CAR_WIDTH + 0.02);
        const stripe = new THREE.Mesh(stripeGeo, lineStripeMat);
        stripe.position.y = -0.05;
        car.add(stripe);

        // 3. Dark Window Band
        const winGeo = new THREE.BoxGeometry(TRAIN_CAR_LENGTH * 0.85, 0.12, TRAIN_CAR_WIDTH + 0.03);
        const win = new THREE.Mesh(winGeo, windowMat);
        win.position.y = 0.08;
        car.add(win);

        // 4. Headlights / Taillights on Terminal Coaches
        if (c === CARS_PER_TRAIN - 1) {
          // Front Car: Dual Warm White Headlights
          const hl1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8), headlightMat);
          hl1.rotateZ(Math.PI / 2);
          hl1.position.set(TRAIN_CAR_LENGTH / 2 + 0.01, -0.06, -0.12);
          const hl2 = hl1.clone();
          hl2.position.set(TRAIN_CAR_LENGTH / 2 + 0.01, -0.06, 0.12);
          car.add(hl1, hl2);
        } else if (c === 0) {
          // Rear Car: Dual Red Taillights
          const tl1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8), taillightMat);
          tl1.rotateZ(Math.PI / 2);
          tl1.position.set(-TRAIN_CAR_LENGTH / 2 - 0.01, -0.06, -0.12);
          const tl2 = tl1.clone();
          tl2.position.set(-TRAIN_CAR_LENGTH / 2 - 0.01, -0.06, 0.12);
          car.add(tl1, tl2);
        }

        car.position.x = (c - (CARS_PER_TRAIN - 1) / 2) * (TRAIN_CAR_LENGTH + 0.06);
        consistGroup.add(car);
      }

      // Front directional SpotLight for Night Mode
      const spotLight = new THREE.SpotLight(0xFFFBEB, 2.5, 35, 0.40, 0.6, 1.2);
      spotLight.position.set((CARS_PER_TRAIN / 2) * TRAIN_CAR_LENGTH, 0.2, 0);
      const spotTarget = new THREE.Object3D();
      spotTarget.position.set((CARS_PER_TRAIN / 2) * TRAIN_CAR_LENGTH + 12, -0.5, 0);
      consistGroup.add(spotLight, spotTarget);
      spotLight.target = spotTarget;
      spotLight.visible = currentLighting === 'night';
      tr.headlight = spotLight;

      tr.meshGroup = consistGroup;
      fleetGroup.add(consistGroup);
    });

    scene.add(fleetGroup);
  }

  // ───────────────────────────────────────────────────────────
  //  4. INTERACTION, RAYCASTING & TOOLTIPS
  // ───────────────────────────────────────────────────────────
  function setupInteraction() {
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Create Floating Apple Tooltip element
    tooltipEl = document.getElementById('three-station-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'three-station-tooltip';
      tooltipEl.className = 'three-station-tooltip hidden';
      document.body.appendChild(tooltipEl);
    }

    // Temporary Pulsing Target Ring
    const ringGeo = new THREE.RingGeometry(1.5, 2.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xF59E0B,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide
    });
    pulseRingMesh = new THREE.Mesh(ringGeo, ringMat);
    pulseRingMesh.rotateX(-Math.PI / 2);
    pulseRingMesh.position.y = 0.08;
    scene.add(pulseRingMesh);

    if (canvas) {
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('click', onPointerClick);
    }
  }

  function onPointerMove(e) {
    if (!renderer || !camera || !stationsGroup) return;

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Test stations
    const intersects = raycaster.intersectObjects(stationsGroup.children, true);

    if (intersects.length > 0) {
      canvas.style.cursor = 'pointer';
      // Find top group with userData
      let target = intersects[0].object;
      while (target && target.parent && !target.userData.isStation) {
        target = target.parent;
      }

      if (target && target.userData && target.userData.station) {
        const s = target.userData.station;
        hoveredStation = s;
        showTooltip(e.clientX, e.clientY, s);
        return;
      }
    }

    // Test landmarks
    if (landmarksGroup) {
      const lmIntersects = raycaster.intersectObjects(landmarksGroup.children, true);
      if (lmIntersects.length > 0) {
        canvas.style.cursor = 'pointer';
        let target = lmIntersects[0].object;
        while (target && target.parent && !target.userData.isLandmark) {
          target = target.parent;
        }
        if (target && target.userData && target.userData.name) {
          showLandmarkTooltip(e.clientX, e.clientY, target.userData.name);
          return;
        }
      }
    }

    canvas.style.cursor = 'default';
    hoveredStation = null;
    hideTooltip();
  }

  function onPointerClick(e) {
    if (!renderer || !camera || !stationsGroup) return;

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Test stations
    const intersects = raycaster.intersectObjects(stationsGroup.children, true);
    if (intersects.length > 0) {
      let target = intersects[0].object;
      while (target && target.parent && !target.userData.isStation) {
        target = target.parent;
      }

      if (target && target.userData && target.userData.station) {
        const s = target.userData.station;
        flyToStation(s.name, s.x, s.z);
        if (window.openStationPanel) {
          window.openStationPanel(s.name);
        }
        playDMRCChime();
        return;
      }
    }

    // Test landmarks
    if (landmarksGroup) {
      const lmIntersects = raycaster.intersectObjects(landmarksGroup.children, true);
      if (lmIntersects.length > 0) {
        let target = lmIntersects[0].object;
        while (target && target.parent && !target.userData.isLandmark) {
          target = target.parent;
        }
        if (target && target.userData && target.userData.id) {
          flyToSector(target.userData.id);
        }
      }
    }
  }

  function showTooltip(clientX, clientY, s) {
    if (!tooltipEl) return;
    const lineTag = s.line ? s.line.replace('-line', '').toUpperCase() : 'METRO';
    const struct = s.structure === 'elevated' ? 'Viaduct (+15m)' : 'Subterranean (-14m)';
    const color = s.lineColor || '#F59E0B';

    tooltipEl.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-line-badge" style="background:${color};"></span>
        <strong class="tooltip-name">${s.name}</strong>
      </div>
      <div class="tooltip-meta">
        <span>${struct}</span>
        ${s.interchange ? `<span class="tooltip-interchange">⇄ Interchange</span>` : ''}
      </div>
      <div class="tooltip-cta">Click to inspect live timetable & gates ➔</div>
    `;

    tooltipEl.style.left = `${clientX + 16}px`;
    tooltipEl.style.top = `${clientY + 12}px`;
    tooltipEl.classList.remove('hidden');
  }

  function showLandmarkTooltip(clientX, clientY, name) {
    if (!tooltipEl) return;
    tooltipEl.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-icon">🏛️</span>
        <strong class="tooltip-name">${name}</strong>
      </div>
      <div class="tooltip-meta">Architectural Landmark of National Capital</div>
      <div class="tooltip-cta">Click to swoop camera ➔</div>
    `;
    tooltipEl.style.left = `${clientX + 16}px`;
    tooltipEl.style.top = `${clientY + 12}px`;
    tooltipEl.classList.remove('hidden');
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.classList.add('hidden');
    }
  }

  // ───────────────────────────────────────────────────────────
  //  5. ANIMATION LOOP & KINEMATICS
  // ───────────────────────────────────────────────────────────
  function animate() {
    animId = requestAnimationFrame(animate);

    // 1. Controls Update with Damped Inertia
    controls.update();

    // 2. Camera Glide Interpolation (Apple Fluid Spring)
    if (isTransitioningCamera) {
      const elapsed = performance.now() - camTransitionStart;
      const t = Math.min(1.0, elapsed / camTransitionDuration);
      // Apple fluid spring ease-out curve
      const ease = 1 - Math.pow(1 - t, 3.5);

      camera.position.lerpVectors(camStartPos, camTargetPos, ease);
      controls.target.lerpVectors(camStartLookAt, camTargetLookAt, ease);

      if (t >= 1.0) {
        isTransitioningCamera = false;
      }
    }

    // 3. Multi-Line Fleet Motion
    if (activeTrains && activeTrains.length > 0) {
      activeTrains.forEach(tr => {
        tr.progress += tr.speed * tr.direction;
        if (tr.progress > 1.0) tr.progress -= 1.0;
        if (tr.progress < 0.0) tr.progress += 1.0;

        if (tr.curve && tr.meshGroup) {
          const pt = tr.curve.getPointAt(tr.progress);
          const tangent = tr.curve.getTangentAt(tr.progress);

          tr.meshGroup.position.copy(pt);
          tr.meshGroup.position.y += 0.28; // Sit on rail surface

          const lookTarget = pt.clone().add(tangent.clone().multiplyScalar(tr.direction));
          tr.meshGroup.lookAt(lookTarget);
        }
      });
    }

    // 4. Animate Beacon Pulses
    if (beaconPulsers.length > 0) {
      const time = performance.now() * 0.003;
      const scale = 1.0 + 0.18 * Math.sin(time);
      const opacity = 0.35 + 0.20 * Math.cos(time);
      beaconPulsers.forEach(b => {
        b.scale.set(scale, scale, 1);
        b.material.opacity = opacity;
      });
    }

    // 5. Animate Pulse Ring on Station Selection
    if (pulseRingMesh && pulseRingAnimStart > 0) {
      const elapsed = performance.now() - pulseRingAnimStart;
      const t = elapsed / 1400;
      if (t < 1.0) {
        const s = 1.0 + t * 4.5;
        pulseRingMesh.scale.set(s, s, 1);
        pulseRingMesh.material.opacity = (1.0 - t) * 0.75;
      } else {
        pulseRingMesh.material.opacity = 0.0;
        pulseRingAnimStart = 0;
      }
    }

    // 6. Render Frame
    renderer.render(scene, camera);
  }

  function start() {
    if (!isRunning) {
      isRunning = true;
      animate();
    }
  }

  function stop() {
    isRunning = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  // ───────────────────────────────────────────────────────────
  //  6. CAMERA DIVE & SECTOR NAVIGATION
  // ───────────────────────────────────────────────────────────
  function flyToSector(sectorKey) {
    isTransitioningCamera = true;
    camTransitionStart = performance.now();
    camStartPos.copy(camera.position);
    camStartLookAt.copy(controls.target);

    if (sectorKey === 'all') {
      camTargetPos.set(0, 160, 200);
      camTargetLookAt.set(0, 0, 15);
      camTransitionDuration = 1200;
    } else if (sectorKey === 'qutab') {
      camTargetPos.set(-33, 22, 142);
      camTargetLookAt.set(-33, 0.3, 120);
      camTransitionDuration = 1000;
    } else if (sectorKey === 'rajiv') {
      camTargetPos.set(0, 24, 25);
      camTargetLookAt.set(0, -0.2, 0);
      camTransitionDuration = 1000;
    } else if (sectorKey === 'kashmere') {
      camTargetPos.set(8, 26, -22);
      camTargetLookAt.set(8, 0.2, -42);
      camTransitionDuration = 1000;
    } else if (sectorKey === 'india_gate') {
      camTargetPos.set(10, 18, 38);
      camTargetLookAt.set(9.7, 1.0, 22);
      camTransitionDuration = 1000;
    } else if (sectorKey === 'aerocity') {
      camTargetPos.set(-115, 25, 95);
      camTargetLookAt.set(-115, 0.5, 75);
      camTransitionDuration = 1000;
    }
  }

  function flyToStation(stationName, x, z) {
    // If coordinates are not passed, lookup station
    if (x === undefined || z === undefined) {
      const st = getStationByName(stationName);
      if (st) {
        x = st.x;
        z = st.z;
      } else {
        return;
      }
    }

    isTransitioningCamera = true;
    camTransitionStart = performance.now();
    camStartPos.copy(camera.position);
    camStartLookAt.copy(controls.target);

    // Architectural isometric framing over the station
    camTargetPos.set(x - 14, 20, z + 24);
    camTargetLookAt.set(x, 0.5, z);
    camTransitionDuration = 1000;

    // Trigger pulse ring beacon on ground
    if (pulseRingMesh) {
      pulseRingMesh.position.set(x, 0.12, z);
      pulseRingAnimStart = performance.now();
    }
  }

  function setViewMode(mode) {
    currentViewMode = mode;
    isTransitioningCamera = true;
    camTransitionStart = performance.now();
    camStartPos.copy(camera.position);
    camStartLookAt.copy(controls.target);

    if (mode === '2d') {
      // Top-Down True Plan
      camTargetPos.set(controls.target.x, 240, controls.target.z + 0.001);
      camTargetLookAt.copy(controls.target);
      camTransitionDuration = 900;
    } else {
      // 3D Perspective Orbit
      camTargetPos.set(controls.target.x, 140, controls.target.z + 180);
      camTargetLookAt.copy(controls.target);
      camTransitionDuration = 900;
    }
  }

  // ───────────────────────────────────────────────────────────
  //  7. AUDIO (DMRC CHIME)
  // ───────────────────────────────────────────────────────────
  function playDMRCChime() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;
      // DMRC signature ascending 3-tone chime: D4 -> F#4 -> A4
      const notes = [
        { freq: 293.66, start: 0.00, dur: 0.35 },
        { freq: 369.99, start: 0.18, dur: 0.38 },
        { freq: 440.00, start: 0.36, dur: 0.55 }
      ];

      notes.forEach(n => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.start);

        gain.gain.setValueAtTime(0.001, now + n.start);
        gain.gain.exponentialRampToValueAtTime(0.28, now + n.start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur + 0.05);
      });
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // ───────────────────────────────────────────────────────────
  //  8. HUD CONTROLS BINDING
  // ───────────────────────────────────────────────────────────
  function bindHUDControls() {
    // Sector buttons
    document.querySelectorAll('.hud-sector-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.hud-sector-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const sector = btn.getAttribute('data-sector');
        flyToSector(sector);
      });
    });

    // Day/Night Lighting
    const btnDay = document.getElementById('btn-light-day');
    const btnNight = document.getElementById('btn-light-night');
    if (btnDay && btnNight) {
      btnDay.addEventListener('click', () => {
        btnDay.classList.add('active');
        btnNight.classList.remove('active');
        setLightingMode('day');
      });
      btnNight.addEventListener('click', () => {
        btnNight.classList.add('active');
        btnDay.classList.remove('active');
        setLightingMode('night');
      });
    }

    // Audio Chime
    const btnChime = document.getElementById('btn-play-chime');
    if (btnChime) {
      btnChime.addEventListener('click', () => playDMRCChime());
    }
  }

  function getStations() {
    return (topologyData && topologyData.stations) ? topologyData.stations : [];
  }

  function getStationByName(name) {
    if (!topologyData || !topologyData.stations || !name) return null;
    const q = name.toLowerCase().trim();
    return topologyData.stations.find(s => s.name.toLowerCase() === q || s.id === q);
  }

  function onWindowResize() {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
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
    playDMRCChime,
    getStations,
    getStationByName
  };
})();
