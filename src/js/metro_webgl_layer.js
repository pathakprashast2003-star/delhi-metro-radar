/* ============================================================
 * Delhi Metro — MapLibre Custom WebGL 3D Layer (v5.2.0)
 * Real geographic tiles + Apple-grade architectural 3D infrastructure
 * on ONE shared WebGL canvas via MapLibre CustomLayerInterface
 * ============================================================ */

window.MetroWebGLLayer = (function () {
  'use strict';

  // Physically accurate, sleek architectural scale (fits road corridor, zero bloating)
  const ELEV_EXAG = 1.1;   // Viaduct elevated realistic ~12m visual height
  const SCALE_M   = 1.0;   // 1:1 true physical scale

  /* ── State ───────────────────────────────────────────────── */
  let scene, camera, renderer;
  let map = null;
  let topologyData = null;
  let activeTrains = [];
  let isReady = false;
  let beaconPulsers = [];

  // Curve cache: lineId -> THREE.CatmullRomCurve3 (in Mercator units)
  const lineCurves = {};

  // Groups
  let viaductGroup, piersGroup, stationsGroup, portalsGroup, fleetGroup;

  // Audio
  let audioCtx = null;

  // Hover & Raycasting
  let tooltipEl = null;
  let raycaster = null, mousePosNDC = null;

  /* ── Mercator Helpers using native MapLibre math ─────────── */
  function toMercator(coords, elevM = 0) {
    if (!window.maplibregl) {
      const mx = (coords[0] + 180) / 360;
      const my = (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (coords[1] * Math.PI) / 360))) / 360;
      const mz = (elevM * ELEV_EXAG) / 35175000;
      return { x: mx, y: my, z: mz, meterUnit: 2.84e-8 };
    }
    const c = window.maplibregl.MercatorCoordinate.fromLngLat(coords, elevM * ELEV_EXAG);
    return {
      x: c.x,
      y: c.y,
      z: c.z,
      meterUnit: c.meterInMercatorCoordinateUnits()
    };
  }

  /* ══════════════════════════════════════════════════════════
   *  CUSTOM LAYER INTERFACE (MapLibre contract)
   * ══════════════════════════════════════════════════════════ */
  const customLayer = {
    id: 'delhi-metro-3d',
    type: 'custom',
    renderingMode: '3d',

    onAdd(mapRef, gl) {
      map = mapRef;

      // Share MapLibre's existing WebGL canvas & context
      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true
      });
      renderer.autoClear = false;
      renderer.outputEncoding = THREE.sRGBEncoding;

      scene = new THREE.Scene();
      camera = new THREE.Camera(); // matrix driven by MapLibre

      // Studio Lighting positioned right over Delhi
      const ambient = new THREE.AmbientLight(0xFFFFFF, 0.92);
      scene.add(ambient);

      const sun = new THREE.DirectionalLight(0xFFFBEB, 1.35);
      sun.position.set(0.714 + 0.04, 0.417 - 0.04, 0.03);
      sun.target.position.set(0.714, 0.417, 0);
      scene.add(sun);
      scene.add(sun.target);

      const hemi = new THREE.HemisphereLight(0xF8FAFC, 0x64748B, 0.50);
      scene.add(hemi);

      // Raycaster for hover/click
      raycaster = new THREE.Raycaster();
      mousePosNDC = new THREE.Vector2();
      setupTooltip();

      // Load & build
      loadTopologyAndBuild();
    },

    render(gl, matrix) {
      if (!isReady) return;

      // Apply MapLibre's mercator projection matrix to Three.js camera
      camera.projectionMatrix.fromArray(matrix);

      renderer.resetState();
      // Clear depth buffer before 3D infrastructure so MapLibre terrain does not occlude 3D bridges
      gl.clear(gl.DEPTH_BUFFER_BIT);
      renderer.render(scene, camera);
      map.triggerRepaint();
    }
  };

  /* ══════════════════════════════════════════════════════════
   *  DATA LOADING
   * ══════════════════════════════════════════════════════════ */
  async function loadTopologyAndBuild() {
    try {
      const res = await fetch('src/data/delhi_network_topology_geo.json?v=' + Date.now());
      topologyData = await res.json();
      buildScene(topologyData);
      startAnimationLoop();
      isReady = true;
      console.log('[MetroWebGLLayer v5.2] Sleek 3D Infrastructure loaded:', topologyData.stations.length, 'stations,', topologyData.lines.length, 'lines');
    } catch (err) {
      console.error('[MetroWebGLLayer] Failed to load topology:', err);
    }
  }

  /* ══════════════════════════════════════════════════════════
   *  SCENE BUILDER: SLEEK ARCHITECTURAL INFRASTRUCTURE
   * ══════════════════════════════════════════════════════════ */
  function buildScene(data) {
    viaductGroup  = new THREE.Group();
    piersGroup    = new THREE.Group();
    stationsGroup = new THREE.Group();
    portalsGroup  = new THREE.Group();
    fleetGroup    = new THREE.Group();

    buildViaductsAndPiers(data.lines);
    build3DStations(data.stations);
    buildTunnelPortals();
    build3DFleet(data.lines);

    scene.add(piersGroup);
    scene.add(viaductGroup);
    scene.add(portalsGroup);
    scene.add(stationsGroup);
    scene.add(fleetGroup);
  }

  /* ── 1. Elevated Viaduct Girders & Vertical Piers ─────────── */
  function buildViaductsAndPiers(lines) {
    const pierMat = new THREE.MeshLambertMaterial({
      color: 0xCBD5E1 // Concrete grey
    });

    lines.forEach(line => {
      if (!line.centerline || line.centerline.length < 2) return;

      const color = parseInt(line.color.replace('#', ''), 16);
      const isYellow = line.id === 'yellow-line';

      const vecs = line.centerline.map(pt => {
        const mc = toMercator(pt.coords, pt.elevM);
        return new THREE.Vector3(mc.x, mc.y, mc.z);
      });

      const curve = new THREE.CatmullRomCurve3(vecs);
      curve.curveType = 'centripetal';
      curve.tension = 0.4;
      lineCurves[line.id] = curve;

      // 1a. Double-track Viaduct in Mercator units (Sleek 1.4m radius = 2.8m deck width)
      const refCoord = toMercator(line.centerline[0].coords, 0);
      const mScale = refCoord.meterUnit;

      const tubeRadius = (isYellow ? 1.6 : 1.4) * mScale * SCALE_M;
      const tubeGeo = new THREE.TubeGeometry(curve, Math.max(140, vecs.length * 6), tubeRadius, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x94A3B8, // Architectural light concrete
        roughness: 0.75,
        metalness: 0.15,
        emissive: color,
        emissiveIntensity: 0.12 // Subtle line accent, not a neon pipe
      });

      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      viaductGroup.add(tube);

      // 1b. Slim Vertical Concrete Piers along elevated stretches
      line.centerline.forEach((pt, idx) => {
        // Space piers cleanly along elevated track (~every 40m)
        if (pt.elevM > 0 && idx % 3 === 0) {
          const mc = toMercator(pt.coords, pt.elevM);
          const pierHeight = mc.z;
          const pierRadius = 0.85 * mc.meterUnit * SCALE_M;

          // Calculate track heading at this pier
          const nextPt = line.centerline[Math.min(idx + 1, line.centerline.length - 1)];
          const prevPt = line.centerline[Math.max(idx - 1, 0)];
          const heading = Math.atan2(nextPt.coords[1] - prevPt.coords[1], nextPt.coords[0] - prevPt.coords[0]);

          // Pier column: cylinder oriented vertically along Z
          const colGeo = new THREE.CylinderGeometry(pierRadius * 0.85, pierRadius, pierHeight, 8);
          const col = new THREE.Mesh(colGeo, pierMat);
          col.rotation.x = Math.PI / 2; // Orient along Z axis
          col.position.set(mc.x, mc.y, pierHeight / 2);
          piersGroup.add(col);

          // Neat concrete hammerhead cap supporting track (PERPENDICULAR to track heading!)
          const capGeo = new THREE.BoxGeometry(pierRadius * 3.2, pierRadius * 1.5, pierRadius * 0.7);
          const cap = new THREE.Mesh(capGeo, pierMat);
          cap.position.set(mc.x, mc.y, pierHeight - pierRadius * 0.35);
          cap.rotation.z = heading + Math.PI / 2; // Perfectly aligned under track
          piersGroup.add(cap);
        }
      });
    });
  }

  /* ── 2. Real 3D Station Canopies & Platforms ──────────────── */
  function getStationHeading(s) {
    if (!topologyData || !topologyData.lines) return 0;
    let closestDist = Infinity;
    let heading = 0;
    for (const line of topologyData.lines) {
      if (!line.centerline || line.centerline.length < 2) continue;
      for (let i = 0; i < line.centerline.length - 1; i++) {
        const p1 = line.centerline[i].coords;
        const p2 = line.centerline[i + 1].coords;
        const midX = (p1[0] + p2[0]) / 2;
        const midY = (p1[1] + p2[1]) / 2;
        const dx = s.coords[0] - midX;
        const dy = s.coords[1] - midY;
        const dist = dx * dx + dy * dy;
        if (dist < closestDist) {
          closestDist = dist;
          heading = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
        }
      }
    }
    return heading;
  }

  function build3DStations(stations) {
    const platformMat = new THREE.MeshLambertMaterial({
      color: 0xF8FAFC // Concrete platform deck
    });

    const yellowTactileMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B });

    const canopyRoofMat = new THREE.MeshStandardMaterial({
      color: 0xF1F5F9,
      roughness: 0.35,
      metalness: 0.25,
      side: THREE.DoubleSide
    });

    const steelArchMat = new THREE.MeshLambertMaterial({
      color: 0x334155
    });

    beaconPulsers = [];

    stations.forEach(s => {
      const isElev = (s.elevM || 0) > 0;
      const mc = toMercator(s.coords, s.elevM);
      const mScale = mc.meterUnit;
      const lineColor = parseInt((s.lineColor || '#F59E0B').replace('#', ''), 16);
      const stationHeading = getStationHeading(s);

      const stGroup = new THREE.Group();
      stGroup.position.set(mc.x, mc.y, mc.z);
      stGroup.rotation.z = stationHeading; // Perfectly aligned with track heading!
      stGroup.userData = { isStation: true, station: s };

      if (isElev) {
        // ── 2A. PROPORTIONAL 3D ELEVATED STATION CANOPY ──
        const pLen = 22 * mScale * SCALE_M;  // Proportional 22m canopy length
        const pWid = 4.2 * mScale * SCALE_M; // 4.2m double-track width
        const pH   = 0.8 * mScale * SCALE_M; // Concrete deck slab

        // Platform Concrete Deck
        const deck = new THREE.Mesh(new THREE.BoxGeometry(pLen, pWid, pH), platformMat);
        stGroup.add(deck);

        // Yellow tactile safety platform edges
        const edge1 = new THREE.Mesh(new THREE.BoxGeometry(pLen, 0.4 * mScale * SCALE_M, 0.15 * mScale * SCALE_M), yellowTactileMat);
        edge1.position.set(0, -pWid / 2 + 0.2 * mScale * SCALE_M, pH / 2 + 0.08 * mScale * SCALE_M);
        stGroup.add(edge1);

        const edge2 = new THREE.Mesh(new THREE.BoxGeometry(pLen, 0.4 * mScale * SCALE_M, 0.15 * mScale * SCALE_M), yellowTactileMat);
        edge2.position.set(0, pWid / 2 - 0.2 * mScale * SCALE_M, pH / 2 + 0.08 * mScale * SCALE_M);
        stGroup.add(edge2);

        // Arched Barrel-Vault Canopy Roof
        const archR = 2.4 * mScale * SCALE_M;
        const archGeo = new THREE.CylinderGeometry(archR, archR, pLen * 0.9, 16, 1, true, 0, Math.PI);
        const roof = new THREE.Mesh(archGeo, canopyRoofMat);
        roof.rotation.z = Math.PI / 2;
        roof.position.set(0, 0, archR * 0.55);
        stGroup.add(roof);

        // Steel Arch Rib Trusses
        for (let ox of [-pLen * 0.38, -pLen * 0.19, 0, pLen * 0.19, pLen * 0.38]) {
          const rib = new THREE.Mesh(
            new THREE.TorusGeometry(archR * 1.02, 0.22 * mScale * SCALE_M, 6, 16, Math.PI),
            steelArchMat
          );
          rib.position.set(ox, 0, archR * 0.55);
          rib.rotation.y = Math.PI / 2;
          stGroup.add(rib);
        }

        // Station Beacon Pulsing Ring on Roof
        const haloMat = new THREE.MeshBasicMaterial({ color: lineColor, transparent: true, opacity: 0.70 });
        const halo = new THREE.Mesh(new THREE.RingGeometry(pWid * 0.55, pWid * 0.85, 24), haloMat);
        halo.position.set(0, 0, archR * 1.25);
        stGroup.add(halo);
        beaconPulsers.push(halo);

      } else {
        // ── 2B. SUBTERRANEAN STATION SURFACE ENTRANCE ──
        const pWid = 4.2 * mScale * SCALE_M;
        const baseMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const coreMat = new THREE.MeshLambertMaterial({ color: lineColor });

        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(pWid * 0.6, pWid * 0.6, 0.4 * mScale * SCALE_M, 16),
          baseMat
        );
        disc.rotation.x = Math.PI / 2;
        stGroup.add(disc);

        const core = new THREE.Mesh(
          new THREE.CylinderGeometry(pWid * 0.38, pWid * 0.38, 0.6 * mScale * SCALE_M, 16),
          coreMat
        );
        core.rotation.x = Math.PI / 2;
        stGroup.add(core);

        const haloMat = new THREE.MeshBasicMaterial({ color: lineColor, transparent: true, opacity: 0.60, side: THREE.DoubleSide });
        const halo = new THREE.Mesh(new THREE.RingGeometry(pWid * 0.75, pWid * 1.15, 24), haloMat);
        halo.position.set(0, 0, 0.35 * mScale * SCALE_M);
        stGroup.add(halo);
        beaconPulsers.push(halo);
      }

      stationsGroup.add(stGroup);
    });
  }

  /* ── 3. Subterranean 3D Cutaway Tunnel Portals ───────────── */
  function buildTunnelPortals() {
    const portalMat = new THREE.MeshLambertMaterial({
      color: 0x334155 // Heavy dark concrete headwall
    });

    const tubeRingMat = new THREE.MeshLambertMaterial({
      color: 0x94A3B8
    });

    const boreVoidMat = new THREE.MeshBasicMaterial({ color: 0x050811 });

    const portals = [
      { name: 'South Portal (Saket)', coords: [77.1983, 28.5145], elev: 15, bearing: -35 },
      { name: 'North Portal (Kashmere Gate)', coords: [77.2285, 28.6675], elev: 15, bearing: 15 }
    ];

    portals.forEach(p => {
      const mc = toMercator(p.coords, p.elev);
      const mScale = mc.meterUnit * SCALE_M;

      const pGroup = new THREE.Group();
      pGroup.position.set(mc.x, mc.y, mc.z);
      pGroup.rotation.z = (p.bearing * Math.PI) / 180;

      // Concrete headwall cutting down to ground
      const headwall = new THREE.Mesh(
        new THREE.BoxGeometry(3.6 * mScale, 1.4 * mScale, mc.z),
        portalMat
      );
      headwall.position.set(0, 0, -mc.z / 2);
      pGroup.add(headwall);

      // Twin circular tunnel portal rings
      for (let tx of [-0.9 * mScale, 0.9 * mScale]) {
        const collar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.85 * mScale, 0.95 * mScale, 1.0 * mScale, 16),
          tubeRingMat
        );
        collar.rotation.x = Math.PI / 2;
        collar.position.set(tx, 0, 0);
        pGroup.add(collar);

        const voidDisc = new THREE.Mesh(
          new THREE.CircleGeometry(0.80 * mScale, 16),
          boreVoidMat
        );
        voidDisc.position.set(tx, 0.5 * mScale, 0);
        pGroup.add(voidDisc);

        const lantern = new THREE.Mesh(
          new THREE.SphereGeometry(0.18 * mScale, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xF59E0B })
        );
        lantern.position.set(tx, 0, 0.95 * mScale);
        pGroup.add(lantern);
      }

      portalsGroup.add(pGroup);
    });
  }

  /* ── 4. Real Solid 3D Metro Train Fleet with Headlights ──── */
  function build3DFleet(lines) {
    const CARS = 6;

    const bodyMat = new THREE.MeshLambertMaterial({
      color: 0xF8FAFC // Stainless steel silver
    });

    const winMat = new THREE.MeshBasicMaterial({
      color: 0x0F172A // Dark tinted glass
    });

    const hlMat = new THREE.MeshBasicMaterial({ color: 0xFEF08A }); // Bright yellow headlights
    const tlMat = new THREE.MeshBasicMaterial({ color: 0xEF4444 }); // Bright red taillights

    lines.forEach(line => {
      const curve = lineCurves[line.id];
      if (!curve) return;

      const lineColor = parseInt(line.color.replace('#', ''), 16);
      const stripeMat = new THREE.MeshBasicMaterial({ color: lineColor });

      const isYellow = line.id === 'yellow-line';
      const numTrains = isYellow ? 8 : (line.id === 'blue-line' ? 6 : 4);

      const refCoord = toMercator(line.centerline[0].coords, 0);
      const mScale = refCoord.meterUnit;

      const carL = 4.2 * mScale * SCALE_M;
      const carW = 1.6 * mScale * SCALE_M;
      const carH = 1.6 * mScale * SCALE_M;

      for (let i = 0; i < numTrains; i++) {
        const consist = new THREE.Group();

        for (let c = 0; c < CARS; c++) {
          const car = new THREE.Group();

          // Main body box
          const body = new THREE.Mesh(new THREE.BoxGeometry(carL, carW, carH), bodyMat);
          car.add(body);

          // Yellow / Line-colored roof stripe
          const roofStripe = new THREE.Mesh(
            new THREE.BoxGeometry(carL * 1.01, carW * 0.96, carH * 0.28),
            stripeMat
          );
          roofStripe.position.set(0, 0, carH * 0.38);
          car.add(roofStripe);

          // Dark passenger windows
          const winSide = new THREE.Mesh(
            new THREE.BoxGeometry(carL * 0.86, carW * 1.04, carH * 0.36),
            winMat
          );
          winSide.position.set(0, 0, carH * 0.08);
          car.add(winSide);

          // Lead car: headlights
          if (c === CARS - 1) {
            const hl1 = new THREE.Mesh(new THREE.SphereGeometry(carW * 0.16, 8, 8), hlMat);
            hl1.position.set(carL / 2 + carL * 0.05, -carW * 0.3, -carH * 0.08);
            const hl2 = new THREE.Mesh(new THREE.SphereGeometry(carW * 0.16, 8, 8), hlMat);
            hl2.position.set(carL / 2 + carL * 0.05, carW * 0.3, -carH * 0.08);
            car.add(hl1, hl2);
          } else if (c === 0) {
            // Rear tail lights
            const tl1 = new THREE.Mesh(new THREE.SphereGeometry(carW * 0.14, 8, 8), tlMat);
            tl1.position.set(-carL / 2 - carL * 0.02, -carW * 0.3, -carH * 0.08);
            const tl2 = new THREE.Mesh(new THREE.SphereGeometry(carW * 0.14, 8, 8), tlMat);
            tl2.position.set(-carL / 2 - carL * 0.02, carW * 0.3, -carH * 0.08);
            car.add(tl1, tl2);
          }

          car.position.x = (c - (CARS - 1) / 2) * (carL + 0.3 * mScale * SCALE_M);
          consist.add(car);
        }

        const tr = {
          lineId: line.id,
          curve,
          progress: i / numTrains,
          speed: (0.000007 + (i % 2) * 0.0000015) * (isYellow ? 1.0 : 0.85),
          direction: i % 2 === 0 ? 1 : -1,
          meshGroup: consist
        };

        fleetGroup.add(consist);
        activeTrains.push(tr);
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
   *  KINEMATIC 60 FPS ANIMATION LOOP
   * ══════════════════════════════════════════════════════════ */
  function startAnimationLoop() {
    function tick() {
      requestAnimationFrame(tick);

      // Move trains along real 3D CatmullRom curves
      activeTrains.forEach(tr => {
        tr.progress += tr.speed * tr.direction;
        if (tr.progress > 1) tr.progress -= 1;
        if (tr.progress < 0) tr.progress += 1;

        const pt = tr.curve.getPointAt(tr.progress);
        const tangent = tr.curve.getTangentAt(tr.progress);

        tr.meshGroup.position.copy(pt);
        const lookAt = pt.clone().add(tangent.multiplyScalar(tr.direction));
        tr.meshGroup.lookAt(lookAt);
      });

      // Pulse station beacon rings
      const t = performance.now() * 0.0028;
      const scale = 1 + 0.18 * Math.sin(t);
      const opacity = 0.45 + 0.25 * Math.cos(t);
      beaconPulsers.forEach(b => {
        b.scale.set(scale, scale, 1);
        if (b.material) b.material.opacity = opacity;
      });
    }
    tick();
  }

  /* ══════════════════════════════════════════════════════════
   *  INTERACTIONS & TOOLTIP
   * ══════════════════════════════════════════════════════════ */
  function setupTooltip() {
    tooltipEl = document.getElementById('three-station-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'three-station-tooltip';
      tooltipEl.className = 'three-station-tooltip hidden';
      document.body.appendChild(tooltipEl);
    }

    if (map) {
      map.getCanvas().addEventListener('mousemove', onCanvasMouseMove);
      map.getCanvas().addEventListener('click', onCanvasClick);
    }
  }

  function onCanvasMouseMove(e) {
    if (!isReady || !stationsGroup || !camera || !renderer) return;
    const rect = map.getCanvas().getBoundingClientRect();
    mousePosNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mousePosNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mousePosNDC, camera);
    const hits = raycaster.intersectObjects(stationsGroup.children, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.isStation) obj = obj.parent;
      if (obj && obj.userData.station) {
        map.getCanvas().style.cursor = 'pointer';
        showTooltip(e.clientX, e.clientY, obj.userData.station);
        return;
      }
    }
    map.getCanvas().style.cursor = '';
    hideTooltip();
  }

  function onCanvasClick(e) {
    if (!isReady || !stationsGroup || !camera) return;
    const rect = map.getCanvas().getBoundingClientRect();
    mousePosNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mousePosNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mousePosNDC, camera);
    const hits = raycaster.intersectObjects(stationsGroup.children, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.isStation) obj = obj.parent;
      if (obj && obj.userData.station) {
        const s = obj.userData.station;
        hideTooltip();
        if (window.openStationPanel) {
          window.openStationPanel(s.index >= 0 ? s.index : s.name);
        }
        playChime();
        if (map) {
          map.flyTo({ center: s.coords, zoom: Math.max(map.getZoom(), 15.5), pitch: 65, duration: 900 });
        }
      }
    }
  }

  function showTooltip(cx, cy, s) {
    if (!tooltipEl) return;
    const struct = s.elevM < 0 ? `Subterranean (${s.elevM}m)` : `Elevated Flyover (+${s.elevM}m)`;
    const color = s.lineColor || '#F59E0B';
    tooltipEl.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-line-badge" style="background:${color};box-shadow:0 0 8px ${color};"></span>
        <strong class="tooltip-name">${s.name}</strong>
      </div>
      <div class="tooltip-meta">
        <span class="tooltip-structure">${struct}</span>
        ${s.interchange ? '<span class="tooltip-interchange">⚡ Interchange</span>' : ''}
      </div>
      <div class="tooltip-cta">Click to inspect 3D station & timetable →</div>
    `;
    tooltipEl.style.left = `${cx + 14}px`;
    tooltipEl.style.top = `${cy + 14}px`;
    tooltipEl.classList.remove('hidden');
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.add('hidden');
  }

  function playChime() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      [[293.66, 0, 0.35], [369.99, 0.18, 0.38], [440.00, 0.36, 0.55]].forEach(([f, t, d]) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + t);
        gain.gain.setValueAtTime(0.001, now + t);
        gain.gain.exponentialRampToValueAtTime(0.28, now + t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + t);
        osc.stop(now + t + d + 0.05);
      });
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════
   *  PUBLIC API
   * ══════════════════════════════════════════════════════════ */
  function getStations() {
    return topologyData ? topologyData.stations : [];
  }

  function getStationByName(name) {
    if (!topologyData) return null;
    const q = name.toLowerCase().trim();
    return topologyData.stations.find(s => s.name.toLowerCase() === q || s.id === q) || null;
  }

  function flyToStation(name) {
    const st = getStationByName(name);
    if (!st || !map) return;
    map.flyTo({ center: st.coords, zoom: 16, pitch: 65, bearing: 20, duration: 1000 });
    playChime();
  }

  function install(mapInstance) {
    map = mapInstance;
    mapInstance.addLayer(customLayer);
  }

  return {
    install,
    getStations,
    getStationByName,
    flyToStation,
    playChime,
    _getDebug: () => ({ scene, camera, renderer, viaductGroup, piersGroup, stationsGroup, portalsGroup, fleetGroup, isReady })
  };
})();
