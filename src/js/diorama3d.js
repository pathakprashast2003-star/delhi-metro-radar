/* ============================================================
 * DELHI METRO — Interactive Three.js 3D WebGL Diorama Engine
 * Dual-Archetype Architecture: Elevated Viaduct + Underground Tube Cutaway
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
  let isInitialized = false;
  let simSpeed = 1.0;
  let isPaused = false;
  let soundEnabled = true;

  // Scene Root Archetype Groups
  let elevatedGroup = null;
  let undergroundGroup = null;
  let currentArchetype = 'elevated'; // 'elevated' | 'underground'

  // Meshes & Materials
  let train1Group = null; // Southbound Train on Track 1
  let train2Group = null; // Northbound Train on Track 2
  let windowMaterials = [];
  let headlightMaterials = [];
  let platformLights = [];
  let sunLight, hemiLight, ambientFill;
  let currentLightingMode = 'day';
  let cameraMode = 'iso'; // 'iso' | 'platform'

  // Kinematic parameters & State Machine
  let t1Progress = 0.15;
  let t2Progress = 0.65;
  const TRACK_LEN = 160;

  let t1DwellTimer = 0;
  let t2DwellTimer = 0;
  let t1HasChimed = false;
  let t2HasChimed = false;

  // Idle Turntable Auto-Dampener
  let lastUserInteraction = performance.now();

  // Platform dynamic digital clock
  let clockCanvas = null, clockCtx = null, clockTexture = null;

  // Web Audio Context for DMRC Chime
  let audioCtx = null;

  function init(containerEl) {
    if (!containerEl) return;
    if (isInitialized) {
      // Already built, ensure viewport fits and start
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

    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFDFBF7); // Warm Alabaster Canvas
    scene.fog = new THREE.FogExp2(0xFDFBF7, 0.0030);

    // 2. Camera: True Orthographic Isometric Camera
    const aspect = container.clientWidth / container.clientHeight;
    const d = 36;
    camera = new THREE.OrthographicCamera(
      -d * aspect, d * aspect,
      d, -d,
      1, 1000
    );
    camera.position.set(62, 52, 62);
    camera.lookAt(0, 7.5, 0);

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

    // 4. OrbitControls with Touch Shielding
    if (window.THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI / 2.15; // Don't flip below ground
      controls.minPolarAngle = Math.PI / 8;
      controls.minZoom = 0.55;
      controls.maxZoom = 2.6;
      controls.target.set(0, 7.5, 0);

      controls.addEventListener('start', () => {
        lastUserInteraction = performance.now();
        controls.autoRotate = false;
      });
      controls.addEventListener('change', () => {
        lastUserInteraction = performance.now();
      });
    }

    // 5. Studio Lighting
    setupLighting();

    // 6. Build the Archetype Worlds
    elevatedGroup = new THREE.Group();
    undergroundGroup = new THREE.Group();

    buildElevatedArchetype(elevatedGroup);
    buildUndergroundArchetype(undergroundGroup);

    scene.add(elevatedGroup);
    scene.add(undergroundGroup);

    // Build Shared Tracks & Platforms & Trains
    buildSharedTracks();
    buildStationPlatform();
    buildPlatformCommuters();
    build3DMetroTrains();

    // Set Default Archetype (Elevated)
    setArchetype('elevated');

    // 7. Bind HUD controls
    bindHUDControls();

    // 8. Safe Web Audio Unlock Handler (One-shot)
    const unlockAudio = () => {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      window.removeEventListener('pointerdown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });

    window.addEventListener('resize', onWindowResize);
  }

  // ── STUDIO LIGHTING ─────────────────────────────────────────
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
    const isUnderground = currentArchetype === 'underground';

    // Warm architectural studio clay background for exhibition feel (NanoBanana style)
    const bgCol = isNight ? (isUnderground ? 0x050811 : 0x080E1E) : (isSunset ? 0xFFF7ED : 0xEDE8E1);

    scene.background.set(bgCol);
    if (scene.fog) scene.fog.color.set(bgCol);

    if (isNight) {
      hemiLight.color.set(0x1E293B);
      hemiLight.groundColor.set(0x0F172A);
      hemiLight.intensity = 0.25;
      ambientFill.intensity = 0.15;
      sunLight.color.set(0x38BDF8); // Cool moonlight
      sunLight.intensity = 0.45;
      sunLight.position.set(-60, 80, -40);

      windowMaterials.forEach(m => {
        m.emissive.set(0xFDE047);
        m.emissiveIntensity = 0.90;
      });
      headlightMaterials.forEach(m => {
        m.color.set(0xFEF08A);
      });
      platformLights.forEach(l => l.intensity = 2.4);

    } else if (isSunset) {
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
      if (isUnderground) {
        hemiLight.color.set(0x94A3B8);
        hemiLight.groundColor.set(0x0F172A);
        hemiLight.intensity = 0.6;
        ambientFill.intensity = 0.35;
        sunLight.color.set(0xFFFBEB);
        sunLight.intensity = 0.9;
        sunLight.position.set(45, 80, 40);
      } else {
        hemiLight.color.set(0xFFFFFF);
        hemiLight.groundColor.set(0xE2E8F0);
        hemiLight.intensity = 0.85;
        ambientFill.intensity = 0.35;
        sunLight.color.set(0xFFFBEB);
        sunLight.intensity = 1.25;
        sunLight.position.set(75, 95, 55);
      }

      windowMaterials.forEach(m => {
        m.emissive.set(0x000000);
        m.emissiveIntensity = 0;
      });
      platformLights.forEach(l => l.intensity = isUnderground ? 1.8 : 0.3);
    }
  }

  // ── ARCHETYPE A: ELEVATED VIADUCT STATION ───────────────────
  function buildElevatedArchetype(group) {
    // 1. Ivory architectural clay pedestal block
    const baseGeo = new THREE.BoxGeometry(160, 8, 90);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xF4EFE6, // Soft Warm Clay
      roughness: 0.88,
      metalness: 0.04
    });
    const pedestal = new THREE.Mesh(baseGeo, baseMat);
    pedestal.position.set(0, -4, 0);
    pedestal.receiveShadow = true;
    group.add(pedestal);

    // 2. Bevelled green clay embankment terrace flanking the tracks
    const lawnMat = new THREE.MeshStandardMaterial({
      color: 0xE2E8D5, // Minimalist muted sage grass
      roughness: 0.9,
      metalness: 0.02
    });
    const lawnS = new THREE.Mesh(new THREE.BoxGeometry(158, 1.2, 24), lawnMat);
    lawnS.position.set(0, 0.4, -30);
    lawnS.receiveShadow = true;
    group.add(lawnS);

    const lawnN = new THREE.Mesh(new THREE.BoxGeometry(158, 1.2, 24), lawnMat);
    lawnN.position.set(0, 0.4, 30);
    lawnN.receiveShadow = true;
    group.add(lawnN);

    // 3. Ground Contact Shadow Receiver Plane
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.16 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -8.05;
    ground.receiveShadow = true;
    group.add(ground);

    // 4. Low-Poly Architectural Forest Trees (Apple/Behance Clay Diorama Style)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4A3525, roughness: 0.85 });
    const foliageTones = [0x2D5A27, 0x386641, 0x4A7C59, 0x1F4E38, 0x345E37];
    const treePositions = [
      [-65, -28], [-48, -32], [-32, -26], [28, -31], [50, -27], [68, -33],
      [-60, 31], [-42, 27], [-22, 33], [25, 29], [46, 32], [64, 28]
    ];
    treePositions.forEach(([x, z], idx) => {
      const tree = new THREE.Group();
      tree.position.set(x, 1.0, z);
      const h = 4.2 + (idx % 3) * 1.4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, h, 6), trunkMat);
      trunk.position.y = h / 2;
      trunk.castShadow = true;
      tree.add(trunk);

      const folCol = foliageTones[idx % foliageTones.length];
      const folMat = new THREE.MeshStandardMaterial({
        color: folCol,
        roughness: 0.72,
        metalness: 0.05,
        flatShading: true
      });
      // Faceted Icosahedron Crown catching light across polygon faces
      const crownGeo = (idx % 2 === 0) ? new THREE.IcosahedronGeometry(2.3, 1) : new THREE.IcosahedronGeometry(2.7, 0);
      const crown = new THREE.Mesh(crownGeo, folMat);
      crown.position.y = h + 2.0;
      crown.castShadow = true;
      crown.receiveShadow = true;
      tree.add(crown);
      group.add(tree);
    });

    // 5. Concrete Viaduct Piers with Flared Capital Caps
    const pierMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 0.8 });
    for (let px of [-55, 0, 55]) {
      const pierGroup = new THREE.Group();
      pierGroup.position.set(px, 0, 0);

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 10, 16), pierMat);
      shaft.position.y = -5;
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      pierGroup.add(shaft);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 26), pierMat);
      cap.position.y = 0.5;
      cap.castShadow = true;
      pierGroup.add(cap);

      group.add(pierGroup);
    }

    // 6. Iconic DMRC Arched Platform Canopy & Steel Portal Trusses
    const canopyGroup = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.7, roughness: 0.35 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xBAE6FD,
      roughness: 0.15,
      metalness: 0.15,
      transparent: true,
      opacity: 0.55
    });

    // Arched portal frames across platform spanning x = -30 to +30
    for (let rx = -28; rx <= 28; rx += 9.3) {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(12, 0.32, 8, 20, Math.PI),
        steelMat
      );
      arch.position.set(rx, 8.5, 0);
      arch.rotation.y = Math.PI / 2;
      arch.castShadow = true;
      canopyGroup.add(arch);

      // Vertical support columns down to platform deck
      for (let cz of [-3.1, 3.1]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 8), steelMat);
        col.position.set(rx, 12, cz);
        col.castShadow = true;
        canopyGroup.add(col);
      }
    }

    // Translucent barrel-vault roof canopy covering platform
    const roofGeo = new THREE.CylinderGeometry(12.1, 12.1, 58, 24, 1, true, 0, Math.PI);
    const roof = new THREE.Mesh(roofGeo, glassMat);
    roof.position.set(0, 8.5, 0);
    roof.rotation.z = Math.PI / 2;
    roof.rotation.x = Math.PI / 2;
    roof.castShadow = true;
    roof.receiveShadow = true;
    canopyGroup.add(roof);

    // Platform Glass Balustrades with DMRC Yellow Trim
    const balustradeMat = new THREE.MeshStandardMaterial({
      color: 0xE2E8F0,
      transparent: true,
      opacity: 0.45,
      roughness: 0.2
    });
    const yellowRailMat = new THREE.MeshBasicMaterial({ color: 0xEAB308 });

    for (let bz of [-3.15, 3.15]) {
      const glassRailing = new THREE.Mesh(new THREE.BoxGeometry(60, 1.8, 0.15), balustradeMat);
      glassRailing.position.set(0, 8.5, bz);
      canopyGroup.add(glassRailing);

      const topRail = new THREE.Mesh(new THREE.BoxGeometry(60, 0.18, 0.25), yellowRailMat);
      topRail.position.set(0, 9.4, bz);
      canopyGroup.add(topRail);
    }

    group.add(canopyGroup);
  }

  // ── ARCHETYPE B: SUBTERRANEAN TUBE CUTAWAY (NANO BANANA PRO FIDELITY) ──
  function buildUndergroundArchetype(group) {
    const cutawayBox = new THREE.Group();

    // 0. Museum Studio Shadow Catcher Plane
    const shadowFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(350, 350),
      new THREE.ShadowMaterial({ opacity: 0.18 })
    );
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = -8.05;
    shadowFloor.receiveShadow = true;
    cutawayBox.add(shadowFloor);

    // 1. Excavation Bedrock Cutaway Box (Architectural Shale Plinth)
    const bedrockMat = new THREE.MeshStandardMaterial({
      color: 0x222C38, // Rich deep slate architectural shale
      roughness: 0.88,
      metalness: 0.12
    });

    // Foundation Excavation Bedrock Plinth
    const baseBedrock = new THREE.Mesh(new THREE.BoxGeometry(160, 8, 42), bedrockMat);
    baseBedrock.position.set(0, -4, 0);
    baseBedrock.receiveShadow = true;
    cutawayBox.add(baseBedrock);

    // Back Retaining Wall with DMRC Subway Tiling
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(158, 28, 4), bedrockMat);
    backWall.position.set(0, 12, -20);
    backWall.receiveShadow = true;
    cutawayBox.add(backWall);

    // Subway Ceramic Wall Lining (White gloss tiles + Yellow accent stripe)
    const tileMat = new THREE.MeshStandardMaterial({
      color: 0xFAFAFA, // Crisp subway white
      roughness: 0.22,
      metalness: 0.15
    });
    const tileLining = new THREE.Mesh(new THREE.BoxGeometry(156, 18, 0.4), tileMat);
    tileLining.position.set(0, 11.5, -17.8);
    tileLining.receiveShadow = true;
    cutawayBox.add(tileLining);

    // Iconic DMRC Yellow Wall Perimeter Line
    const yellowStripe = new THREE.Mesh(
      new THREE.BoxGeometry(156, 1.4, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xEAB308 })
    );
    yellowStripe.position.set(0, 14.8, -17.7);
    cutawayBox.add(yellowStripe);

    // Subway Station Name Signboard ("RAJIV CHOWK · YELLOW LINE")
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(42, 3.2, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.4 })
    );
    signBoard.position.set(0, 17.6, -17.6);
    cutawayBox.add(signBoard);

    // Station Name Text on Wall (Canvas Texture)
    const wallSignCanvas = document.createElement('canvas');
    wallSignCanvas.width = 512;
    wallSignCanvas.height = 128;
    const wCtx = wallSignCanvas.getContext('2d');
    wCtx.fillStyle = '#0F172A';
    wCtx.fillRect(0, 0, 512, 128);
    // DMRC Roundel graphic on sign
    wCtx.fillStyle = '#DC2626';
    wCtx.beginPath();
    wCtx.arc(54, 64, 38, 0, Math.PI * 2);
    wCtx.fill();
    wCtx.fillStyle = '#2563EB';
    wCtx.fillRect(14, 52, 80, 24);
    // Text
    wCtx.fillStyle = '#F8FAFC';
    wCtx.font = 'bold 36px Inter, sans-serif';
    wCtx.fillText('RAJIV CHOWK', 115, 62);
    wCtx.fillStyle = '#EAB308';
    wCtx.font = 'bold 22px Inter, sans-serif';
    wCtx.fillText('YELLOW LINE · PLATFORM 1 & 2', 115, 96);

    const wallSignTex = new THREE.CanvasTexture(wallSignCanvas);
    const wallSignMesh = new THREE.Mesh(
      new THREE.BoxGeometry(41.6, 3.0, 0.1),
      new THREE.MeshBasicMaterial({ map: wallSignTex })
    );
    wallSignMesh.position.set(0, 17.6, -17.25);
    cutawayBox.add(wallSignMesh);

    // Upper Concourse & Street Slab
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.85 });
    const concourseSlab = new THREE.Mesh(new THREE.BoxGeometry(158, 2.5, 12), ceilingMat);
    concourseSlab.position.set(0, 22.0, -15);
    concourseSlab.castShadow = true;
    cutawayBox.add(concourseSlab);

    // Exposed Overhead Structural Excavation Struts (Steel I-beams)
    const strutMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.65, roughness: 0.35 });
    for (let sx of [-50, -20, 20, 50]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 34), strutMat);
      strut.position.set(sx, 22.0, -2);
      strut.castShadow = true;
      cutawayBox.add(strut);
    }

    // Left and Right Excavation Cutaway Plinths
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(6, 28, 38), bedrockMat);
    wallL.position.set(-78, 12, -2);
    cutawayBox.add(wallL);

    const wallR = new THREE.Mesh(new THREE.BoxGeometry(6, 28, 38), bedrockMat);
    wallR.position.set(78, 12, -2);
    cutawayBox.add(wallR);

    // Low Front Cutaway Curb (museum pedestal framing edge)
    const frontCurb = new THREE.Mesh(new THREE.BoxGeometry(160, 2.4, 2.5), bedrockMat);
    frontCurb.position.set(0, 5.0, 17.0);
    cutawayBox.add(frontCurb);

    // 2. Circular Precast Concrete Tube Tunnels (NanoBanana Style TBM Rings)
    const tubeRingMat = new THREE.MeshStandardMaterial({
      color: 0x94A3B8, // Precast segmented concrete
      roughness: 0.68,
      metalness: 0.22
    });
    const tubeBoreMat = new THREE.MeshBasicMaterial({ color: 0x070B14 }); // Deep tunnel void

    function createTubePortal(xCenter, zCenter, isLeft) {
      const portalGroup = new THREE.Group();
      portalGroup.position.set(xCenter, 8.5, zCenter);

      // Heavy bevelled portal collar
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(5.9, 6.4, 5.5, 28),
        tubeRingMat
      );
      collar.rotation.z = Math.PI / 2;
      collar.castShadow = true;
      collar.receiveShadow = true;
      portalGroup.add(collar);

      // Ribbed Segmented TBM Rings extending into the bedrock
      for (let r = 1; r <= 3; r++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(5.5, 0.48, 12, 28),
          tubeRingMat
        );
        ring.rotation.y = Math.PI / 2;
        ring.position.x = isLeft ? -r * 4.2 : r * 4.2;
        portalGroup.add(ring);
      }

      // Interior dark bore cylinder
      const bore = new THREE.Mesh(
        new THREE.CylinderGeometry(5.1, 5.1, 18, 28, 1, true),
        tubeBoreMat
      );
      bore.rotation.z = Math.PI / 2;
      bore.position.x = isLeft ? -9 : 9;
      portalGroup.add(bore);

      // Interior Amber Signal Lantern
      const signal = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xF59E0B })
      );
      signal.position.set(isLeft ? -1.5 : 1.5, 4.3, 0);
      portalGroup.add(signal);

      // Warm amber interior tunnel glow
      const tunnelLight = new THREE.PointLight(0xF59E0B, 2.0, 30, 1.2);
      tunnelLight.position.set(isLeft ? -6 : 6, 3.6, 0);
      portalGroup.add(tunnelLight);

      return portalGroup;
    }

    // West Tunnel Portals (Track 1 Southbound & Track 2 Northbound)
    cutawayBox.add(createTubePortal(-45, -7, true));
    cutawayBox.add(createTubePortal(-45, 7, true));

    // East Tunnel Portals (Track 1 Southbound & Track 2 Northbound)
    cutawayBox.add(createTubePortal(45, -7, false));
    cutawayBox.add(createTubePortal(45, 7, false));

    // ── 2B. EXTENDED SLICED CUTAWAY TUBE (THE NANO BANANA ICONIC ELEMENT) ──
    // A concrete tube tunnel sliced in half along Track 1 so the train is seen INSIDE!
    const cutTubeLen = 32;
    const cutTubeGeo = new THREE.CylinderGeometry(
      5.6, 5.6, cutTubeLen, 28, 1, true,
      0, Math.PI // Half cylinder cut along the top-front!
    );
    const cutTubeMat = new THREE.MeshStandardMaterial({
      color: 0x94A3B8,
      roughness: 0.72,
      metalness: 0.20,
      side: THREE.DoubleSide
    });
    const cutTube = new THREE.Mesh(cutTubeGeo, cutTubeMat);
    cutTube.position.set(45 - cutTubeLen / 2 + 3, 8.5, -7);
    cutTube.rotation.z = Math.PI / 2;
    cutTube.rotation.y = -Math.PI / 2;
    cutTube.castShadow = true;
    cutTube.receiveShadow = true;
    cutawayBox.add(cutTube);

    // Segmented Expansion Rings along the sliced tube
    for (let rx = 24; rx <= 42; rx += 5) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(5.75, 0.35, 8, 24, Math.PI),
        tubeRingMat
      );
      rib.position.set(rx, 8.5, -7);
      rib.rotation.y = -Math.PI / 2;
      rib.castShadow = true;
      cutawayBox.add(rib);
    }

    // ── 3. SURFACE STREET-LEVEL ENTRANCE KIOSK (NANO BANANA PAVILION) ──
    const streetKioskGroup = new THREE.Group();
    streetKioskGroup.position.set(16, 23.25, -14);

    // Paved sidewalk terrace
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.7 });
    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(28, 0.8, 14), sidewalkMat);
    sidewalk.receiveShadow = true;
    streetKioskGroup.add(sidewalk);

    // Kiosk Building Box (Subway white tiles)
    const kioskBuilding = new THREE.Mesh(new THREE.BoxGeometry(18, 5.2, 8), tileMat);
    kioskBuilding.position.set(0, 2.8, 0);
    kioskBuilding.castShadow = true;
    kioskBuilding.receiveShadow = true;
    streetKioskGroup.add(kioskBuilding);

    // Modern Navy / Blue Roof Fascia Canopy
    const roofFascia = new THREE.Mesh(
      new THREE.BoxGeometry(19.2, 0.9, 9.2),
      new THREE.MeshStandardMaterial({ color: 0x1E3A8A, roughness: 0.4 })
    );
    roofFascia.position.set(0, 5.6, 0);
    roofFascia.castShadow = true;
    streetKioskGroup.add(roofFascia);

    // Glass Entrance Vestibule
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38BDF8,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.45
    });
    const glassDoor = new THREE.Mesh(new THREE.BoxGeometry(12, 3.4, 0.3), glassMat);
    glassDoor.position.set(0, 2.0, 4.05);
    streetKioskGroup.add(glassDoor);

    // Iconic Red/Blue Subway Roundel on Entrance Roof
    const roundelGroup = new THREE.Group();
    roundelGroup.position.set(0, 7.2, 4.2);

    const redRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.32, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xDC2626, roughness: 0.3 })
    );
    roundelGroup.add(redRing);

    const blueBar = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.65, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x1D4ED8, roughness: 0.3 })
    );
    roundelGroup.add(blueBar);

    streetKioskGroup.add(roundelGroup);

    // Minimalist Street Lamp Post
    const lampPost = new THREE.Group();
    lampPost.position.set(-11, 0.4, 4.5);
    const postPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5.5, 6), strutMat);
    postPole.position.y = 2.75;
    postPole.castShadow = true;
    lampPost.add(postPole);

    const postHead = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.6), strutMat);
    postHead.position.set(0.4, 5.4, 0);
    lampPost.add(postHead);

    const postBulb = new THREE.PointLight(0xFFFBEB, 1.2, 14);
    postBulb.position.set(0.4, 5.2, 0);
    lampPost.add(postBulb);
    streetKioskGroup.add(lampPost);

    cutawayBox.add(streetKioskGroup);

    // ── 4. DUAL INCLINED ESCALATOR TRUSSES (RISING TO CONCOURSE) ──
    const escGroup = new THREE.Group();
    const escFrameMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, metalness: 0.8, roughness: 0.3 });
    const escHandrailMat = new THREE.MeshBasicMaterial({ color: 0x22C55E }); // Glowing green guide rail

    for (let ez of [-1.5, 1.5]) {
      const truss = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 2.2), escFrameMat);
      truss.position.set(-8, 12, ez);
      truss.rotation.z = -Math.PI / 6.5; // 28-degree incline
      truss.castShadow = true;
      escGroup.add(truss);

      const rail = new THREE.Mesh(new THREE.BoxGeometry(22, 0.25, 0.2), escHandrailMat);
      rail.position.set(-8, 13.2, ez);
      rail.rotation.z = -Math.PI / 6.5;
      escGroup.add(rail);
    }
    cutawayBox.add(escGroup);

    // ── 5. UNDERGROUND PLATFORM FLUORESCENT DOWNLIGHTS ──
    const lightStripMat = new THREE.MeshBasicMaterial({ color: 0xFFFBEB });
    for (let lx of [-24, 0, 24]) {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 1.2), lightStripMat);
      fixture.position.set(lx, 21.8, 0);
      cutawayBox.add(fixture);

      const downlight = new THREE.PointLight(0xFFFBEB, 1.8, 42);
      downlight.position.set(lx, 20.5, 0);
      cutawayBox.add(downlight);
      platformLights.push(downlight);
    }

    group.add(cutawayBox);
  }

  // ── 3. SHARED TRACKS & RAILS ────────────────────────────────
  function buildSharedTracks() {
    const viaductGroup = new THREE.Group();

    // Track Deck Girder
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
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(TRACK_LEN, 1.2, 9.5), ballastMat);
    b1.position.set(0, 4.2, -7);
    b1.receiveShadow = true;
    viaductGroup.add(b1);

    const b2 = new THREE.Mesh(new THREE.BoxGeometry(TRACK_LEN, 1.2, 9.5), ballastMat);
    b2.position.set(0, 4.2, 7);
    b2.receiveShadow = true;
    viaductGroup.add(b2);

    // Wooden Sleepers along both tracks
    const sleeperGeo = new THREE.BoxGeometry(1.6, 0.6, 8.5);
    const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
    for (let x = -TRACK_LEN / 2 + 3; x <= TRACK_LEN / 2 - 3; x += 3.6) {
      const s1 = new THREE.Mesh(sleeperGeo, sleeperMat);
      s1.position.set(x, 4.9, -7);
      s1.castShadow = true;
      s1.receiveShadow = true;
      viaductGroup.add(s1);

      const s2 = new THREE.Mesh(sleeperGeo, sleeperMat);
      s2.position.set(x, 4.9, 7);
      s2.castShadow = true;
      s2.receiveShadow = true;
      viaductGroup.add(s2);
    }

    // Steel Rails & DMRC Yellow Track Guideline
    const railMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 });
    const yellowStripeMat = new THREE.MeshBasicMaterial({ color: 0xEAB308 });

    function addRails(zCenter) {
      const r1 = new THREE.Mesh(new THREE.BoxGeometry(TRACK_LEN, 0.7, 0.4), railMat);
      r1.position.set(0, 5.5, zCenter - 2.6);
      r1.castShadow = true;
      viaductGroup.add(r1);

      const r2 = new THREE.Mesh(new THREE.BoxGeometry(TRACK_LEN, 0.7, 0.4), railMat);
      r2.position.set(0, 5.5, zCenter + 2.6);
      r2.castShadow = true;
      viaductGroup.add(r2);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(TRACK_LEN, 0.05, 0.5), yellowStripeMat);
      stripe.position.set(0, 4.9, zCenter);
      viaductGroup.add(stripe);
    }
    addRails(-7); // Track 1 (Southbound)
    addRails(7);  // Track 2 (Northbound)

    scene.add(viaductGroup);
  }

  // ── 4. CENTRAL STATION PLATFORM & CLOCK ──────────────────────
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

    // Yellow Safety Tactile Edge Stripes
    const tactileMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B });
    const tEdgeS = new THREE.Mesh(new THREE.BoxGeometry(platLen, 0.1, 0.5), tactileMat);
    tEdgeS.position.set(0, 7.65, -platWid / 2 + 0.3);
    platformGroup.add(tEdgeS);

    const tEdgeN = new THREE.Mesh(new THREE.BoxGeometry(platLen, 0.1, 0.5), tactileMat);
    tEdgeN.position.set(0, 7.65, platWid / 2 - 0.3);
    platformGroup.add(tEdgeN);

    // Platform Waiting Benches (Wooden slats with cast iron legs)
    const benchMat = new THREE.MeshStandardMaterial({ color: 0xD97706, roughness: 0.75 });
    for (let bx of [-16, 0, 16]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.6, 1.4), benchMat);
      bench.position.set(bx, 8.0, 0);
      bench.castShadow = true;
      platformGroup.add(bench);
    }

    // Dynamic LED Digital Passenger Info Display (PIDS)
    buildDigitalArrivalBoard(platformGroup);

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
    const stName = (currentArchetype === 'underground') ? 'RAJIV CHOWK' : 'QUTAB MINAR';

    clockCtx.fillStyle = '#0F172A';
    clockCtx.fillRect(0, 0, 512, 128);

    clockCtx.fillStyle = '#EAB308';
    clockCtx.font = 'bold 26px Inter, monospace';
    clockCtx.fillText(`${stName} · ${timeStr}`, 24, 42);

    clockCtx.fillStyle = '#F8FAFC';
    clockCtx.font = '22px Inter, sans-serif';
    clockCtx.fillText('P1: MILLENNIUM CITY  1 MIN (8-CAR)', 24, 82);

    clockCtx.fillStyle = '#38BDF8';
    clockCtx.fillText('P2: SAMAYPUR BADLI   3 MIN (8-CAR)', 24, 114);

    if (clockTexture) clockTexture.needsUpdate = true;
  }

  // ── 5. PLATFORM COMMUTERS (NANO BANANA STYLE FIGURINES) ─────────
  function buildPlatformCommuters() {
    const commutersGroup = new THREE.Group();

    // Architectural figurine palettes: rich stylish wool coats, blazers, and scarves
    const palettes = [
      { coat: 0xC2410C, pants: 0x1E293B, skin: 0xFBCFE8, hair: 0x1F2937, scarf: 0xF59E0B }, // Terracotta trench
      { coat: 0x1E40AF, pants: 0x334155, skin: 0xFDE68A, hair: 0x4B5563, scarf: 0x38BDF8 }, // Navy wool coat
      { coat: 0x047857, pants: 0x0F172A, skin: 0xFBCFE8, hair: 0x111827, scarf: 0xA7F3D0 }, // Emerald coat
      { coat: 0x854D0E, pants: 0x1E293B, skin: 0xFDE047, hair: 0x374151, scarf: 0xFDE68A }, // Camel overcoat
      { coat: 0xBE123C, pants: 0x475569, skin: 0xFBCFE8, hair: 0x1F2937, scarf: 0xFECDD3 }, // Crimson parka
      { coat: 0x374151, pants: 0x111827, skin: 0xFBCFE8, hair: 0x030712, scarf: 0xE2E8F0 }, // Charcoal suit
      { coat: 0x6D28D9, pants: 0x1E293B, skin: 0xFDE68A, hair: 0x1F2937, scarf: 0xC4B5FD }, // Violet cardigan
      { coat: 0xD97706, pants: 0x334155, skin: 0xFBCFE8, hair: 0x4B5563, scarf: 0xFDE68A }, // Amber sweater
      { coat: 0x0284C7, pants: 0x0F172A, skin: 0xFDE68A, hair: 0x1F2937, scarf: 0xBAE6FD }, // Sky blue jacket
      { coat: 0xF8FAFC, pants: 0x1E293B, skin: 0xFBCFE8, hair: 0x111827, scarf: 0x94A3B8 }, // Crisp white trench
    ];

    function createCommuterFigure(cfg) {
      const { x, z, rotY = 0, palIdx = 0, isSitting = false, hasBag = false, hasPhone = false, isStationMaster = false } = cfg;
      const person = new THREE.Group();
      person.position.set(x, isSitting ? 8.0 : 7.6, z);
      person.rotation.y = rotY;

      const pal = palettes[palIdx % palettes.length];
      const skinMat = new THREE.MeshStandardMaterial({ color: isStationMaster ? 0xFBCFE8 : pal.skin, roughness: 0.5 });
      const coatMat = new THREE.MeshStandardMaterial({ color: isStationMaster ? 0x0F172A : pal.coat, roughness: 0.7 });
      const pantsMat = new THREE.MeshStandardMaterial({ color: isStationMaster ? 0x0F172A : pal.pants, roughness: 0.8 });
      const hairMat = new THREE.MeshStandardMaterial({ color: pal.hair, roughness: 0.9 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.8 });

      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), skinMat);
      head.position.y = isSitting ? 1.85 : 2.45;
      head.castShadow = true;
      person.add(head);

      if (isStationMaster) {
        // Station Master peaked white cap
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.42, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
        cap.position.y = 2.65;
        person.add(cap);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.25), darkMat);
        visor.position.set(0, 2.58, 0.32);
        person.add(visor);
      } else {
        // Hair cap / beanie
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.40, 8, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), hairMat);
        hair.position.y = isSitting ? 1.95 : 2.55;
        hair.castShadow = true;
        person.add(hair);
      }

      // Torso / Coat
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 1.25, 8), coatMat);
      torso.position.y = isSitting ? 1.05 : 1.5;
      torso.castShadow = true;
      person.add(torso);

      // Scarf / Accent collar
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.10, 6, 8), new THREE.MeshBasicMaterial({ color: isStationMaster ? 0xEAB308 : pal.scarf }));
      scarf.rotation.x = Math.PI / 2;
      scarf.position.y = isSitting ? 1.62 : 2.12;
      person.add(scarf);

      if (isSitting) {
        // Sitting legs bent 90 degrees forward over bench
        const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.32, 0.85), pantsMat);
        thigh.position.set(0, 0.42, 0.38);
        thigh.castShadow = true;
        person.add(thigh);

        const shin = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.72, 0.32), pantsMat);
        shin.position.set(0, 0.05, 0.72);
        shin.castShadow = true;
        person.add(shin);
      } else {
        // Standing legs
        const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.1, 6), pantsMat);
        leg1.position.set(-0.2, 0.55, 0);
        leg1.castShadow = true;
        person.add(leg1);

        const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.1, 6), pantsMat);
        leg2.position.set(0.2, 0.55, 0);
        leg2.castShadow = true;
        person.add(leg2);

        // Shoes
        const shoe1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.38), darkMat);
        shoe1.position.set(-0.2, 0.07, 0.08);
        person.add(shoe1);

        const shoe2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.38), darkMat);
        shoe2.position.set(0.2, 0.07, 0.08);
        person.add(shoe2);
      }

      // Arms
      const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 6), coatMat);
      armL.position.set(-0.54, isSitting ? 1.05 : 1.45, 0);
      armL.castShadow = true;
      person.add(armL);

      const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 6), coatMat);
      if (hasPhone) {
        armR.position.set(0.48, isSitting ? 1.25 : 1.65, 0.28);
        armR.rotation.x = -Math.PI / 3.2;
        // Glowing smartphone screen
        const phone = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.04), new THREE.MeshBasicMaterial({ color: 0x38BDF8 }));
        phone.position.set(0.48, isSitting ? 1.45 : 1.85, 0.48);
        person.add(phone);
      } else {
        armR.position.set(0.54, isSitting ? 1.05 : 1.45, 0);
      }
      armR.castShadow = true;
      person.add(armR);

      // Briefcase or luggage
      if (hasBag) {
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.65, 0.55), new THREE.MeshStandardMaterial({ color: 0x78350F, roughness: 0.6 }));
        bag.position.set(0.72, 0.32, 0);
        bag.castShadow = true;
        person.add(bag);
      }

      return person;
    }

    // 22 Curated Commuters mirroring the bustling NanoBanana diorama
    const commutersData = [
      // Waiting along Track 1 (Southbound, z = -1.8, facing train)
      { x: -22, z: -1.8, rotY: Math.PI, palIdx: 0, hasPhone: true },
      { x: -18, z: -2.0, rotY: Math.PI * 0.95, palIdx: 1 },
      { x: -12, z: -1.7, rotY: Math.PI * 1.05, palIdx: 2, hasBag: true },
      { x: -5,  z: -2.1, rotY: Math.PI, palIdx: 3, hasPhone: true },
      { x: 3,   z: -1.9, rotY: Math.PI * 0.9, palIdx: 4 },
      { x: 9,   z: -2.2, rotY: Math.PI * 1.1, palIdx: 5, hasBag: true },
      { x: 14,  z: -1.8, rotY: Math.PI, palIdx: 6 },
      { x: 21,  z: -2.0, rotY: Math.PI * 0.95, palIdx: 7, hasPhone: true },

      // Waiting along Track 2 (Northbound, z = 1.8, facing track 2)
      { x: -20, z: 1.8, rotY: 0, palIdx: 8, hasBag: true },
      { x: -14, z: 2.1, rotY: 0.15, palIdx: 9 },
      { x: -7,  z: 1.9, rotY: -0.1, palIdx: 1, hasPhone: true },
      { x: 2,   z: 2.0, rotY: 0, palIdx: 3 },
      { x: 8,   z: 1.8, rotY: 0.2, palIdx: 0, hasBag: true },
      { x: 16,  z: 2.2, rotY: -0.15, palIdx: 2 },
      { x: 23,  z: 1.9, rotY: 0, palIdx: 4, hasPhone: true },

      // Sitting relaxed on platform wooden benches (x = -16, 0, 16)
      { x: -16.8, z: 0.1, rotY: 0, palIdx: 5, isSitting: true, hasPhone: true },
      { x: -15.2, z: -0.1, rotY: Math.PI, palIdx: 6, isSitting: true },
      { x: -0.8,  z: 0.1, rotY: 0, palIdx: 7, isSitting: true },
      { x: 0.8,   z: -0.1, rotY: Math.PI, palIdx: 8, isSitting: true, hasBag: true },
      { x: 15.8,  z: 0.1, rotY: 0, palIdx: 9, isSitting: true, hasPhone: true },

      // Station Master in navy uniform on platform center
      { x: -2, z: 0.2, rotY: Math.PI / 4, isStationMaster: true },

      // Commuter walking near escalator
      { x: -8, z: 0.0, rotY: Math.PI / 2, palIdx: 0, hasBag: true }
    ];

    commutersData.forEach(cfg => {
      commutersGroup.add(createCommuterFigure(cfg));
    });

    scene.add(commutersGroup);
  }

  // ── 6. 3D DELHI METRO TRAINS ────────────────────────────────
  function createTrainMesh(colorLivery) {
    const train = new THREE.Group();
    const carLen = 14;
    const carWid = 4.2;
    const carH = 4.0;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xF8FAFC,
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

      const body = new THREE.Mesh(new THREE.BoxGeometry(carLen, carH, carWid), bodyMat);
      body.castShadow = true;
      body.receiveShadow = true;
      carGroup.add(body);

      // Yellow Flank Stripes
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(carLen, 0.5, 0.05), stripeMat);
      s1.position.set(0, -0.4, carWid / 2 + 0.02);
      carGroup.add(s1);

      const s2 = new THREE.Mesh(new THREE.BoxGeometry(carLen, 0.5, 0.05), stripeMat);
      s2.position.set(0, -0.4, -carWid / 2 - 0.02);
      carGroup.add(s2);

      // Windows
      for (let wx = -4.5; wx <= 4.5; wx += 2.8) {
        const wLeft = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.05), winMat);
        wLeft.position.set(wx, 0.4, carWid / 2 + 0.03);
        carGroup.add(wLeft);

        const wRight = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.05), winMat);
        wRight.position.set(wx, 0.4, -carWid / 2 - 0.03);
        carGroup.add(wRight);
      }

      // Roof HVAC
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 2.2), new THREE.MeshStandardMaterial({ color: 0xCBD5E1 }));
      hvac.position.set(0, carH / 2 + 0.3, 0);
      carGroup.add(hvac);

      // Lead Windshield & Headlights with dynamic illumination
      if (idx === 0) {
        // Aerodynamic beveled cab wedge
        const cabGeo = new THREE.BoxGeometry(2.2, carH - 0.2, carWid - 0.2);
        const cab = new THREE.Mesh(cabGeo, bodyMat);
        cab.position.set(-carLen / 2 - 1.0, 0, 0);
        cab.castShadow = true;
        carGroup.add(cab);

        // Slanted dark driver windscreen
        const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.9, carWid - 0.7), winMat);
        windshield.position.set(-carLen / 2 - 2.1, 0.45, 0);
        windshield.rotation.z = -0.15; // Slanted rake aerodynamic angle
        carGroup.add(windshield);

        const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), headlightMat);
        hl1.position.set(-carLen / 2 - 2.12, -0.65, -1.2);
        carGroup.add(hl1);

        const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), headlightMat);
        hl2.position.set(-carLen / 2 - 2.12, -0.65, 1.2);
        carGroup.add(hl2);

        // Dynamic forward headlight casting real light ahead along tracks & inside tunnel!
        const dynamicHeadlight = new THREE.PointLight(0xFEF08A, 1.6, 32, 1.3);
        dynamicHeadlight.position.set(-carLen / 2 - 3.0, 0.2, 0);
        carGroup.add(dynamicHeadlight);
      }

      // Rear Tail Lights
      if (idx === 2) {
        const tl1 = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), taillightMat);
        tl1.position.set(carLen / 2 + 0.08, -0.65, -1.2);
        carGroup.add(tl1);

        const tl2 = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), taillightMat);
        tl2.position.set(carLen / 2 + 0.08, -0.65, 1.2);
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
    train1Group = createTrainMesh(0xEAB308); // Yellow Line
    train1Group.position.set(0, 7.8, -7);
    scene.add(train1Group);

    train2Group = createTrainMesh(0xEAB308);
    train2Group.rotation.y = Math.PI; // Heading northbound
    train2Group.position.set(0, 7.8, 7);
    scene.add(train2Group);
  }

  // ── 7. AUDIO CHIME ──────────────────────────────────────────
  function playDMRCChime() {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

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
        gain.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + n.start + 0.02);
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

  // ── 8. ARCHETYPE SWITCHER ───────────────────────────────────
  function setArchetype(type) {
    currentArchetype = type;
    const isUnderground = type === 'underground';

    if (elevatedGroup) elevatedGroup.visible = !isUnderground;
    if (undergroundGroup) undergroundGroup.visible = isUnderground;

    // Keep HUD archetype buttons in sync
    const btnArchetypeElev = document.getElementById('btn-arch-viaduct');
    const btnArchetypeTube = document.getElementById('btn-arch-tube');
    if (btnArchetypeElev && btnArchetypeTube) {
      btnArchetypeElev.classList.toggle('active', !isUnderground);
      btnArchetypeTube.classList.toggle('active', isUnderground);
    }

    // Adapt HUD panels to frosted obsidian slate in underground cutaway
    const hudPanel = document.querySelector('.three-hud-panel');
    const headerPill = document.querySelector('.three-header-pill');
    const instructionBadge = document.querySelector('.three-instruction-badge');
    [hudPanel, headerPill, instructionBadge].forEach(el => {
      if (el) el.classList.toggle('dark-hud', isUnderground);
    });

    // Update Title Badge
    const titleEl = document.querySelector('.diorama-title');
    const tagEl = document.querySelector('.diorama-tag');
    if (titleEl && tagEl) {
      if (isUnderground) {
        tagEl.textContent = 'WEBGL 3D TUBE CUTAWAY · COMPLETE 3D STAGE';
        titleEl.textContent = 'Rajiv Chowk · Central Subway Chamber (-18m)';
      } else {
        tagEl.textContent = 'WEBGL 3D VIADUCT · COMPLETE 3D STAGE';
        titleEl.textContent = 'Qutab Minar · Elevated Flyover (+15m)';
      }
    }

    // Refresh lighting background
    setLightingMode(currentLightingMode);
    updateClockCanvas();
  }

  // ── 9. BIND GOLDEN 3-SEGMENT HUD CONTROLS ───────────────────
  function bindHUDControls() {
    // 1. Structure Archetype (Viaduct vs Tube)
    const btnArchetypeElev = document.getElementById('btn-arch-viaduct');
    const btnArchetypeTube = document.getElementById('btn-arch-tube');
    if (btnArchetypeElev && btnArchetypeTube) {
      btnArchetypeElev.addEventListener('click', (e) => {
        e.stopPropagation();
        btnArchetypeElev.classList.add('active');
        btnArchetypeTube.classList.remove('active');
        setArchetype('elevated');
      });
      btnArchetypeTube.addEventListener('click', (e) => {
        e.stopPropagation();
        btnArchetypeTube.classList.add('active');
        btnArchetypeElev.classList.remove('active');
        setArchetype('underground');
      });
    }

    // 2. Atmosphere Lighting (Day / Sunset / Night)
    const dayBtn = document.getElementById('btn-light-day');
    const sunsetBtn = document.getElementById('btn-light-sunset');
    const nightBtn = document.getElementById('btn-light-night');
    if (dayBtn && sunsetBtn && nightBtn) {
      const lights = [dayBtn, sunsetBtn, nightBtn];
      dayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        lights.forEach(b => b.classList.remove('active'));
        dayBtn.classList.add('active');
        setLightingMode('day');
      });
      sunsetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        lights.forEach(b => b.classList.remove('active'));
        sunsetBtn.classList.add('active');
        setLightingMode('sunset');
      });
      nightBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        lights.forEach(b => b.classList.remove('active'));
        nightBtn.classList.add('active');
        setLightingMode('night');
      });
    }

    // 3. Camera Modes (45° Diorama vs Platform Commuter)
    const camIso = document.getElementById('btn-cam-iso');
    const camPlat = document.getElementById('btn-cam-plat');
    if (camIso && camPlat) {
      camIso.addEventListener('click', (e) => {
        e.stopPropagation();
        camIso.classList.add('active');
        camPlat.classList.remove('active');
        cameraMode = 'iso';
        camera.position.set(70, 60, 70);
        if (controls) controls.target.set(0, 7.5, 0);
      });
      camPlat.addEventListener('click', (e) => {
        e.stopPropagation();
        camPlat.classList.add('active');
        camIso.classList.remove('active');
        cameraMode = 'platform';
        camera.position.set(-18, 9, 0);
        if (controls) controls.target.set(30, 8, -7);
      });
    }

    // 4. Sound & Chime Trigger
    const chimeBtn = document.getElementById('btn-play-chime');
    if (chimeBtn) {
      chimeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playDMRCChime();
      });
    }

    const soundBtn = document.getElementById('btn-sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        soundEnabled = !soundEnabled;
        soundBtn.textContent = soundEnabled ? '🔊 Sound' : '🔇 Muted';
        soundBtn.classList.toggle('active', soundEnabled);
        if (soundEnabled) playDMRCChime();
      });
    }

    // 5. Kinetics Play / Pause & Speed
    const playBtn = document.getElementById('btn-sim-play');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isPaused = !isPaused;
        playBtn.textContent = isPaused ? '▶️ Run' : '⏸️ Pause';
        playBtn.classList.toggle('active', !isPaused);
      });
    }

    const speedChips = document.querySelectorAll('[data-3dspeed]');
    speedChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        speedChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        simSpeed = parseFloat(chip.getAttribute('data-3dspeed')) || 1.0;
      });
    });
  }

  // ── 10. KINEMATIC 60 FPS ANIMATION LOOP ─────────────────────
  let lastClockTick = 0;

  function animate() {
    if (!isRunning) return;

    if (!isPaused) {
      // Train 1 Kinematics (Southbound on Track 1, moving right to left: X decreases)
      const x1 = (0.5 - t1Progress) * TRACK_LEN;
      const distFromPlatform1 = Math.abs(x1);

      if (distFromPlatform1 < 2.0 && t1DwellTimer < 140) {
        // Dwell at station platform
        if (!t1HasChimed) {
          playDMRCChime();
          t1HasChimed = true;
        }
        t1DwellTimer++;
        // Very slow drift during boarding
        t1Progress += 0.00008 * simSpeed;
      } else {
        if (distFromPlatform1 >= 10.0) t1HasChimed = false;
        t1DwellTimer = 0;

        let speedFactor1 = 1.0;
        if (distFromPlatform1 < 16.0) speedFactor1 = 0.45; // Smooth braking
        t1Progress += 0.0014 * simSpeed * speedFactor1;
      }
      if (t1Progress > 1.0) t1Progress = 0;
      if (train1Group) train1Group.position.x = (0.5 - t1Progress) * TRACK_LEN;

      // Train 2 Kinematics (Northbound on Track 2, moving left to right: X increases)
      const x2 = (-0.5 + t2Progress) * TRACK_LEN;
      const distFromPlatform2 = Math.abs(x2);

      if (distFromPlatform2 < 2.0 && t2DwellTimer < 140) {
        if (!t2HasChimed) {
          playDMRCChime();
          t2HasChimed = true;
        }
        t2DwellTimer++;
        t2Progress += 0.00008 * simSpeed;
      } else {
        if (distFromPlatform2 >= 10.0) t2HasChimed = false;
        t2DwellTimer = 0;

        let speedFactor2 = 1.0;
        if (distFromPlatform2 < 16.0) speedFactor2 = 0.45;
        t2Progress += 0.0012 * simSpeed * speedFactor2;
      }
      if (t2Progress > 1.0) t2Progress = 0;
      if (train2Group) train2Group.position.x = (-0.5 + t2Progress) * TRACK_LEN;
    }

    // Idle Auto-Orbit Turntable (activates after 4s idle in ISO camera)
    if (controls && cameraMode === 'iso') {
      if (performance.now() - lastUserInteraction > 4000) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.4;
      } else {
        controls.autoRotate = false;
      }
    }

    // Dynamic Clock update
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
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function onWindowResize() {
    if (!container || !camera || !renderer) return;
    const aspect = container.clientWidth / container.clientHeight;
    const d = 36;
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
    setArchetype,
    playDMRCChime
  };
})();
