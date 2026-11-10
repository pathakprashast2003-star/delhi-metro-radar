/* ============================================================
 * Delhi Metro — MapLibre Custom WebGL 3D Layer
 * Real geographic tiles + Three.js PBR metro infrastructure
 * on ONE shared WebGL canvas via MapLibre CustomLayerInterface
 *
 * Architecture:
 *   MapLibre GL: Renders CARTO Voyager map tiles (real Delhi)
 *   Three.js:    Shares MapLibre's WebGL context via addLayer({type:'custom'})
 *                Renders 3D metro viaducts / tubes / trains / stations
 *                using MapLibre's mercator projection matrices
 * ============================================================ */

window.MetroWebGLLayer = (function () {
  'use strict';

  /* ── Mercator helpers (MercatorCoordinate style) ─────────── */
  const EARTH_CIRCUMFERENCE = 40_075_016.686;   // metres at equator
  const TILE_SIZE = 512;

  function mercatorX(lon) {
    return (180 + lon) / 360;
  }
  function mercatorY(lat) {
    const sinLat = Math.sin(lat * Math.PI / 180);
    return (180 - (180 / Math.PI) * Math.log((1 + sinLat) / (1 - sinLat))) / 360;
  }
  function mercatorZScale(lat) {
    // metres → mercator units at a given latitude
    return 1 / (EARTH_CIRCUMFERENCE * Math.cos(lat * Math.PI / 180));
  }

  /* ── State ───────────────────────────────────────────────── */
  let scene, camera, renderer;
  let map = null;
  let topologyData = null;
  let activeTrains = [];
  let isReady = false;
  let beaconPulsers = [];

  // per-line Three.js objects
  const lineCurves = {};   // lineId → THREE.CatmullRomCurve3 (in mercator units)

  // Groups
  let viaductGroup, stationsGroup, fleetGroup;

  // Audio
  let audioCtx = null;

  /* ── Tooltip ─────────────────────────────────────────────── */
  let tooltipEl = null;
  let raycaster = null, mousePosNDC = null;

  /* ── Elevation scale ─────────────────────────────────────── */
  // We pick a reference latitude to convert metres ↔ mercator-z
  const REF_LAT = 28.63;
  const M_PER_MERCATOR = EARTH_CIRCUMFERENCE * Math.cos(REF_LAT * Math.PI / 180);

  function elevMercator(elev_m) {
    return elev_m / M_PER_MERCATOR;
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

      // Lighting
      const ambient = new THREE.AmbientLight(0xFFFFFF, 0.80);
      scene.add(ambient);

      const sun = new THREE.DirectionalLight(0xFFF5D6, 1.1);
      sun.position.set(0.5, 1, 0.3);
      scene.add(sun);

      const hemi = new THREE.HemisphereLight(0xE0F4FF, 0xD6C47E, 0.45);
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
      console.log('[MetroWebGLLayer] Scene built:', topologyData.stations.length, 'stations,', topologyData.lines.length, 'lines');
    } catch (err) {
      console.error('[MetroWebGLLayer] Failed to load topology:', err);
    }
  }

  /* ══════════════════════════════════════════════════════════
   *  SCENE BUILDER
   * ══════════════════════════════════════════════════════════ */
  function buildScene(data) {
    viaductGroup  = new THREE.Group();
    stationsGroup = new THREE.Group();
    fleetGroup    = new THREE.Group();

    scene.add(viaductGroup, stationsGroup, fleetGroup);

    buildLines(data.lines);
    buildStations(data.stations);
    buildFleet(data.lines);
  }

  /* ── Line Viaducts & Tubes ─────────────────────────────── */
  function buildLines(lines) {
    const pierGeo = new THREE.CylinderGeometry(0.000006, 0.000008, 1, 7);
    const pierMat = new THREE.MeshStandardMaterial({ color: 0xD0CCB8, roughness: 0.75 });

    lines.forEach(line => {
      if (!line.centerline || line.centerline.length < 2) return;

      const color = parseInt(line.color.replace('#', ''), 16);

      const vecs = line.centerline.map(pt => {
        const mx = mercatorX(pt.coords[0]);
        const my = mercatorY(pt.coords[1]);
        const mz = -elevMercator(pt.elevM) * 1.5;
        return new THREE.Vector3(mx, my, mz);
      });

      const curve = new THREE.CatmullRomCurve3(vecs);
      curve.curveType = 'centripetal';
      curve.tension = 0.4;
      lineCurves[line.id] = curve;

      // Tube radius in mercator units (~2.5m street width visually)
      const tubeRadius = 0.000005;
      const tubeGeo = new THREE.TubeGeometry(curve, Math.max(60, vecs.length * 4), tubeRadius, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.25,
        metalness: 0.55,
        emissive: color,
        emissiveIntensity: 0.35
      });

      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      viaductGroup.add(tube);

      // Concrete piers only for elevated sections
      line.centerline.forEach(pt => {
        if (pt.elevM > 0) {
          const mx = mercatorX(pt.coords[0]);
          const my = mercatorY(pt.coords[1]);
          const height = elevMercator(pt.elevM) * 1.5;
          const pier = new THREE.Mesh(pierGeo, pierMat);
          pier.position.set(mx, my - height / 2, 0);
          pier.scale.set(1, height, 1);
          viaductGroup.add(pier);
        }
      });
    });
  }

  /* ── Station Beacons ───────────────────────────────────── */
  function buildStations(stations) {
    // Regular disc
    const regGeo = new THREE.CylinderGeometry(0.000012, 0.000012, 0.0000035, 16);
    // Interchange ring
    const intGeo = new THREE.TorusGeometry(0.000020, 0.000005, 8, 20);
    // Halo
    const haloGeo = new THREE.RingGeometry(0.000020, 0.000030, 24);

    beaconPulsers = [];

    stations.forEach(s => {
      const mx = mercatorX(s.coords[0]);
      const my = mercatorY(s.coords[1]);
      const mz = -elevMercator(s.elevM) * 1.5;
      const lineColor = parseInt((s.lineColor || '#F59E0B').replace('#', ''), 16);
      const isInterchange = s.major || !!s.interchange;

      const g = new THREE.Group();
      g.position.set(mx, my, mz);
      g.userData = { isStation: true, station: s };

      if (isInterchange) {
        const ringMat = new THREE.MeshStandardMaterial({ color: lineColor, emissive: lineColor, emissiveIntensity: 0.65, roughness: 0.2 });
        const ring = new THREE.Mesh(intGeo, ringMat);
        ring.rotateX(Math.PI / 2);

        const coreMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, emissive: lineColor, emissiveIntensity: 0.4, roughness: 0.2 });
        const core = new THREE.Mesh(new THREE.CylinderGeometry(0.000012, 0.000012, 0.000004, 16), coreMat);

        const haloMat = new THREE.MeshBasicMaterial({ color: lineColor, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.rotateX(Math.PI / 2);

        g.add(ring, core, halo);
        beaconPulsers.push(halo);
      } else {
        const baseMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.35, metalness: 0.1 });
        const coreMat = new THREE.MeshStandardMaterial({ color: lineColor, emissive: lineColor, emissiveIntensity: 0.4 });

        const base = new THREE.Mesh(regGeo, baseMat);
        base.position.y = 0;

        const coreDisc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.000007, 0.000007, 0.000005, 16),
          coreMat
        );
        g.add(base, coreDisc);
      }

      stationsGroup.add(g);
    });
  }

  /* ── Train Fleet ───────────────────────────────────────── */
  function buildFleet(lines) {
    const CAR_L = 0.000090;   // ~18m in mercator units
    const CAR_W = 0.000016;   // ~3m
    const CAR_H = 0.000010;   // ~2m
    const CARS  = 6;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 0.28, metalness: 0.65 });
    const winMat  = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.1 });
    const hlMat   = new THREE.MeshStandardMaterial({ color: 0xFFFBEB, emissive: 0xFFFBEB, emissiveIntensity: 2.5 });
    const tlMat   = new THREE.MeshStandardMaterial({ color: 0xEF4444, emissive: 0xEF4444, emissiveIntensity: 2.0 });

    lines.forEach(line => {
      const curve = lineCurves[line.id];
      if (!curve) return;

      const lineColor = parseInt(line.color.replace('#', ''), 16);
      const stripeMat = new THREE.MeshStandardMaterial({ color: lineColor, emissive: lineColor, emissiveIntensity: 0.4 });

      const isYellow = line.id === 'yellow-line';
      const numTrains = isYellow ? 8 : (line.id === 'blue-line' ? 6 : 4);

      for (let i = 0; i < numTrains; i++) {
        const consist = new THREE.Group();

        for (let c = 0; c < CARS; c++) {
          const car = new THREE.Group();

          const body = new THREE.Mesh(new THREE.BoxGeometry(CAR_L, CAR_H, CAR_W), bodyMat);
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(CAR_L * 1.01, CAR_H * 0.22, CAR_W * 1.02), stripeMat);
          stripe.position.y = -CAR_H * 0.14;
          const win = new THREE.Mesh(new THREE.BoxGeometry(CAR_L * 0.84, CAR_H * 0.30, CAR_W * 1.02), winMat);
          win.position.y = CAR_H * 0.22;

          car.add(body, stripe, win);

          if (c === CARS - 1) {
            const hl1 = new THREE.Mesh(new THREE.CylinderGeometry(CAR_H * 0.09, CAR_H * 0.09, CAR_W * 0.03, 8), hlMat);
            hl1.rotateZ(Math.PI / 2);
            hl1.position.set(CAR_L / 2 + 0.000001, -CAR_H * 0.14, -CAR_W * 0.3);
            const hl2 = hl1.clone();
            hl2.position.set(CAR_L / 2 + 0.000001, -CAR_H * 0.14, CAR_W * 0.3);
            car.add(hl1, hl2);
          } else if (c === 0) {
            const tl1 = new THREE.Mesh(new THREE.CylinderGeometry(CAR_H * 0.09, CAR_H * 0.09, CAR_W * 0.03, 8), tlMat);
            tl1.rotateZ(Math.PI / 2);
            tl1.position.set(-CAR_L / 2 - 0.000001, -CAR_H * 0.14, -CAR_W * 0.3);
            const tl2 = tl1.clone();
            tl2.position.set(-CAR_L / 2 - 0.000001, -CAR_H * 0.14, CAR_W * 0.3);
            car.add(tl1, tl2);
          }

          car.position.x = (c - (CARS - 1) / 2) * (CAR_L + 0.000005);
          consist.add(car);
        }

        const tr = {
          lineId:   line.id,
          curve,
          progress: i / numTrains,
          speed:    (0.000006 + (i % 2) * 0.0000012) * (isYellow ? 1.0 : 0.85),
          direction: i % 2 === 0 ? 1 : -1,
          meshGroup: consist
        };

        fleetGroup.add(consist);
        activeTrains.push(tr);
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
   *  ANIMATION LOOP
   * ══════════════════════════════════════════════════════════ */
  function startAnimationLoop() {
    function tick() {
      requestAnimationFrame(tick);

      // Drive trains along their curves
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

      // Pulse interchange beacons
      const t = performance.now() * 0.0025;
      const scale = 1 + 0.18 * Math.sin(t);
      const opacity = 0.35 + 0.22 * Math.cos(t);
      beaconPulsers.forEach(b => {
        b.scale.set(scale, scale, 1);
        b.material.opacity = opacity;
      });
    }
    tick();
  }

  /* ══════════════════════════════════════════════════════════
   *  HOVER TOOLTIP (HTML overlay)
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
          map.flyTo({ center: s.coords, zoom: Math.max(map.getZoom(), 15), pitch: 60, duration: 800 });
        }
      }
    }
  }

  function showTooltip(cx, cy, s) {
    if (!tooltipEl) return;
    const struct = s.elevM < 0 ? `Subterranean (${s.elevM}m)` : `Elevated (+${s.elevM}m)`;
    const color = s.lineColor || '#F59E0B';
    tooltipEl.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-line-badge" style="background:${color};box-shadow:0 0 8px ${color};"></span>
        <strong class="tooltip-name">${s.name}</strong>
      </div>
      <div class="tooltip-meta">
        <span>${struct}</span>
        ${s.interchange ? `<span class="tooltip-interchange">⇄ Interchange</span>` : ''}
      </div>
      <div class="tooltip-cta">Click to open timetable ➔</div>
    `;
    tooltipEl.style.left = `${cx + 16}px`;
    tooltipEl.style.top  = `${cy + 12}px`;
    tooltipEl.classList.remove('hidden');
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.add('hidden');
  }

  /* ══════════════════════════════════════════════════════════
   *  AUDIO
   * ══════════════════════════════════════════════════════════ */
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
   *  PUBLIC API (called from main.js)
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
    map.flyTo({ center: st.coords, zoom: 16, pitch: 65, bearing: 15, duration: 1000 });
    playChime();
  }

  function install(mapInstance) {
    map = mapInstance;
    mapInstance.addLayer(customLayer);
  }

  return { install, getStations, getStationByName, flyToStation, playChime };
})();

