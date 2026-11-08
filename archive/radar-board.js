/* ============================================================
 * DELHI METRO — Pure Architectural Isometric Rail Board
 * Anti-Slop Swiss Editorial & Tactile Model Train Physics
 * 100% Zero Map Clutter · Pure Warm Alabaster Canvas
 * Inspired by Emons & Seoul Minimalist Dioramas
 * ============================================================ */

(function () {
  'use strict';

  // ── 1. Station Definitions & Topology ───────────────────────
  const STATIONS_DATA = [
    { id: 'badli', name: 'Samaypur Badli', x: 500, y: 160, major: true, terminus: true, lines: ['Yellow'] },
    { id: 'rohini18', name: 'Rohini Sector 18, 19', x: 520, y: 240, lines: ['Yellow'] },
    { id: 'haiderpur', name: 'Haiderpur Badli Mor', x: 545, y: 320, lines: ['Yellow'] },
    { id: 'jahangirpuri', name: 'Jahangirpuri', x: 575, y: 400, lines: ['Yellow'] },
    { id: 'adarsh', name: 'Adarsh Nagar', x: 610, y: 480, lines: ['Yellow'] },
    { id: 'azadpur', name: 'Azadpur', x: 650, y: 560, major: true, lines: ['Yellow', 'Pink'] },
    { id: 'modeltown', name: 'Model Town', x: 695, y: 640, lines: ['Yellow'] },
    { id: 'gtbnagar', name: 'GTB Nagar', x: 745, y: 720, lines: ['Yellow'] },
    { id: 'vishwa', name: 'Vishwavidyalaya', x: 800, y: 800, major: true, lines: ['Yellow'] },
    { id: 'vidhansabha', name: 'Vidhan Sabha', x: 855, y: 880, lines: ['Yellow'] },
    { id: 'civillines', name: 'Civil Lines', x: 910, y: 960, lines: ['Yellow'] },
    { id: 'kashmere', name: 'Kashmere Gate', x: 965, y: 1050, major: true, lines: ['Yellow', 'Red', 'Violet'] },
    { id: 'chandnichowk', name: 'Chandni Chowk', x: 1010, y: 1140, major: true, lines: ['Yellow'] },
    { id: 'chawribazar', name: 'Chawri Bazar', x: 1050, y: 1225, lines: ['Yellow'] },
    { id: 'newdelhi', name: 'New Delhi Railway', x: 1090, y: 1315, major: true, lines: ['Yellow', 'Airport'] },
    { id: 'rajivchowk', name: 'Rajiv Chowk', x: 1130, y: 1410, major: true, lines: ['Yellow', 'Blue'] },
    { id: 'patelchowk', name: 'Patel Chowk', x: 1165, y: 1500, lines: ['Yellow'] },
    { id: 'centralsec', name: 'Central Secretariat', x: 1195, y: 1590, major: true, lines: ['Yellow', 'Violet'] },
    { id: 'udyogbhawan', name: 'Udyog Bhawan', x: 1220, y: 1675, lines: ['Yellow'] },
    { id: 'lokkalyan', name: 'Lok Kalyan Marg', x: 1240, y: 1760, lines: ['Yellow'] },
    { id: 'jorbagh', name: 'Jor Bagh', x: 1255, y: 1845, lines: ['Yellow'] },
    { id: 'dillihaat', name: 'Dilli Haat - INA', x: 1265, y: 1930, major: true, lines: ['Yellow', 'Pink'] },
    { id: 'aiims', name: 'AIIMS', x: 1270, y: 2015, major: true, lines: ['Yellow'] },
    { id: 'greenpark', name: 'Green Park', x: 1270, y: 2100, lines: ['Yellow'] },
    { id: 'hauzkhas', name: 'Hauz Khas', x: 1265, y: 2190, major: true, lines: ['Yellow', 'Magenta'] },
    { id: 'malviyanagar', name: 'Malviya Nagar', x: 1255, y: 2275, lines: ['Yellow'] },
    { id: 'saket', name: 'Saket', x: 1240, y: 2360, lines: ['Yellow'] },
    { id: 'qutabminar', name: 'Qutab Minar', x: 1220, y: 2450, major: true, lines: ['Yellow'] },
    { id: 'chhatarpur', name: 'Chhatarpur', x: 1195, y: 2540, lines: ['Yellow'] },
    { id: 'sultanpur', name: 'Sultanpur', x: 1165, y: 2630, lines: ['Yellow'] },
    { id: 'ghitorni', name: 'Ghitorni', x: 1130, y: 2720, lines: ['Yellow'] },
    { id: 'arjangarh', name: 'Arjan Garh', x: 1090, y: 2810, lines: ['Yellow'] },
    { id: 'gurudronacharya', name: 'Guru Dronacharya', x: 1045, y: 2900, lines: ['Yellow'] },
    { id: 'sikanderpur', name: 'Sikanderpur', x: 995, y: 2990, major: true, lines: ['Yellow', 'Rapid Metro'] },
    { id: 'mgroad', name: 'MG Road', x: 940, y: 3080, lines: ['Yellow'] },
    { id: 'iffcochowk', name: 'IFFCO Chowk', x: 880, y: 3170, lines: ['Yellow'] },
    { id: 'millennium', name: 'Millennium City Centre', x: 815, y: 3260, major: true, terminus: true, lines: ['Yellow'] }
  ];

  // ── 2. Canvas & Viewport State ──────────────────────────────
  let canvas, ctx;
  let width = 0, height = 0;
  let dpr = window.devicePixelRatio || 1;

  let camera = {
    x: 1000,
    y: 1600,
    zoom: 0.65,
    minZoom: 0.25,
    maxZoom: 2.5,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    camStartX: 0,
    camStartY: 0
  };

  let followTrainId = null;
  let selectedTrainId = null;
  let selectedStationId = 'rajivchowk';
  let renderMode = 'dot'; // Default to user's requested white-black dot
  let simSpeed = 1.0;
  let isPaused = false;
  let audioCtx = null;

  // Track geometry precomputations
  let splinePoints = [];
  let trackLength = 0;
  let stationProgress = []; // Normalized [0..1] progress for each station

  // 16 Active Trains (8 Southbound, 8 Northbound)
  const FLEET_SIZE = 16;
  let trains = [];

  // Consist sprite
  let trainConsistImg = new Image();
  let trainConsistLoaded = false;
  trainConsistImg.onload = () => { trainConsistLoaded = true; };
  trainConsistImg.src = '/public/metro_train_consist.png';

  // ── 3. Initialization ───────────────────────────────────────
  function init() {
    canvas = document.getElementById('radar-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize);

    buildSplineTopology();
    initFleet();
    setupInteractions();
    setupHUD();

    // Center camera on Rajiv Chowk by default
    centerOnStation('rajivchowk', false);

    requestAnimationFrame(renderLoop);
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  }

  // ── 4. Spline Interpolation & Geometry Math ─────────────────
  function buildSplineTopology() {
    // Generate fine-grained points along Catmull-Rom spline
    splinePoints = [];
    const pts = STATIONS_DATA.map(s => ({ x: s.x, y: s.y }));
    const numStations = pts.length;

    const subdivisions = 24;
    for (let i = 0; i < numStations - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(numStations - 1, i + 2)];

      for (let s = 0; s < subdivisions; s++) {
        const t = s / subdivisions;
        const x = catmullRom(p0.x, p1.x, p2.x, p3.x, t);
        const y = catmullRom(p0.y, p1.y, p2.y, p3.y, t);
        splinePoints.push({ x, y });
      }
    }
    // Append final station point
    splinePoints.push({ x: pts[numStations - 1].x, y: pts[numStations - 1].y });

    // Compute cumulative distances
    let total = 0;
    splinePoints[0].dist = 0;
    for (let i = 1; i < splinePoints.length; i++) {
      const dx = splinePoints[i].x - splinePoints[i - 1].x;
      const dy = splinePoints[i].y - splinePoints[i - 1].y;
      total += Math.hypot(dx, dy);
      splinePoints[i].dist = total;
    }
    trackLength = total;

    // Compute tangent normals
    for (let i = 0; i < splinePoints.length; i++) {
      const prev = splinePoints[Math.max(0, i - 1)];
      const next = splinePoints[Math.min(splinePoints.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const tx = dx / len;
      const ty = dy / len;
      splinePoints[i].tx = tx;
      splinePoints[i].ty = ty;
      // Perpendicular normal pointing right
      splinePoints[i].nx = -ty;
      splinePoints[i].ny = tx;
      splinePoints[i].angle = Math.atan2(dy, dx);
    }

    // Match stations to normalized track progress [0..1]
    stationProgress = STATIONS_DATA.map(st => {
      let closestIdx = 0;
      let minDist = Infinity;
      splinePoints.forEach((sp, idx) => {
        const d = Math.hypot(sp.x - st.x, sp.y - st.y);
        if (d < minDist) {
          minDist = d;
          closestIdx = idx;
        }
      });
      return splinePoints[closestIdx].dist / trackLength;
    });
  }

  function catmullRom(p0, p1, p2, p3, t) {
    const v0 = (p2 - p0) * 0.5;
    const v1 = (p3 - p1) * 0.5;
    const t2 = t * t;
    const t3 = t * t * t;
    return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
  }

  function getPointAtProgress(u) {
    // Clamped progress [0..1]
    u = Math.max(0, Math.min(1, u));
    const targetDist = u * trackLength;

    // Binary search
    let low = 0, high = splinePoints.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (splinePoints[mid].dist < targetDist) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.min(splinePoints.length - 1, Math.max(1, low));
    const pPrev = splinePoints[idx - 1];
    const pNext = splinePoints[idx];
    const segDist = pNext.dist - pPrev.dist;
    const factor = segDist > 0 ? (targetDist - pPrev.dist) / segDist : 0;

    const x = pPrev.x + (pNext.x - pPrev.x) * factor;
    const y = pPrev.y + (pNext.y - pPrev.y) * factor;
    const tx = pPrev.tx + (pNext.tx - pPrev.tx) * factor;
    const ty = pPrev.ty + (pNext.ty - pPrev.ty) * factor;
    const nx = pPrev.nx + (pNext.nx - pPrev.nx) * factor;
    const ny = pPrev.ny + (pNext.ny - pPrev.ny) * factor;
    const angle = Math.atan2(ty, tx);

    return { x, y, tx, ty, nx, ny, angle };
  }

  // ── 5. Fleet Simulation & Physics ───────────────────────────
  function initFleet() {
    trains = [];
    const spacing = 1.0 / (FLEET_SIZE / 2);

    // 8 Southbound Trains (Track 1)
    for (let i = 0; i < 8; i++) {
      trains.push({
        id: `Y-${String(i + 1).padStart(2, '0')}`,
        track: 1, // Track 1 = Southbound
        dir: 1,  // 1 = Southbound, -1 = Northbound
        u: (i * spacing) % 1.0,
        speed: 60,
        dwellTimer: 0,
        isDwelling: false,
        isReversing: false,
        reversalProgress: 0,
        currentStationIdx: -1
      });
    }

    // 8 Northbound Trains (Track 2)
    for (let i = 0; i < 8; i++) {
      trains.push({
        id: `Y-${String(i + 9).padStart(2, '0')}`,
        track: 2, // Track 2 = Northbound
        dir: -1, // Heading North
        u: (1.0 - i * spacing + 0.05) % 1.0,
        speed: 60,
        dwellTimer: 0,
        isDwelling: false,
        isReversing: false,
        reversalProgress: 0,
        currentStationIdx: -1
      });
    }
  }

  function updateFleet(dt) {
    if (isPaused) return;
    const step = 0.00032 * simSpeed * dt;

    trains.forEach(t => {
      // 1. Station Dwell & Boarding Physics
      if (t.isDwelling) {
        t.dwellTimer -= dt * simSpeed;
        t.speed = 0;
        if (t.dwellTimer <= 0) {
          t.isDwelling = false;
          t.dwellTimer = 0;
        }
        return;
      }

      // 2. Terminal Reversal Loop (Crossover switches)
      if (t.isReversing) {
        t.reversalProgress += dt * 0.0008 * simSpeed;
        t.speed = 20;
        if (t.reversalProgress >= 1.0) {
          t.isReversing = false;
          t.reversalProgress = 0;
          // Flip track and direction
          if (t.track === 1) {
            t.track = 2;
            t.dir = -1; // Now heading North on Track 2
            t.u = 1.0;
          } else {
            t.track = 1;
            t.dir = 1; // Now heading South on Track 1
            t.u = 0.0;
          }
        }
        return;
      }

      // 3. Check for Station Approaches & Dwells
      let nearStation = false;
      for (let sIdx = 0; sIdx < stationProgress.length; sIdx++) {
        const su = stationProgress[sIdx];
        const distToStation = Math.abs(t.u - su);

        if (distToStation < 0.0028) {
          // If train just reached station and hasn't dwelled yet
          if (t.currentStationIdx !== sIdx) {
            t.currentStationIdx = sIdx;
            t.isDwelling = true;
            t.dwellTimer = 2.4; // 2.4 seconds realistic passenger dwell
            nearStation = true;
            break;
          }
        } else if (distToStation > 0.015 && t.currentStationIdx === sIdx) {
          t.currentStationIdx = -1; // Cleared station zone
        }
      }

      if (nearStation) return;

      // 4. Cruising Speed Acceleration / Deceleration
      t.speed = 75; // km/h

      // 5. Normal Track Motion
      t.u += t.dir * step;

      // Check for Southern Terminus (Millennium City Centre)
      if (t.dir === 1 && t.u >= 1.0) {
        t.u = 1.0;
        t.isReversing = true;
        t.reversalProgress = 0;
      }
      // Check for Northern Terminus (Samaypur Badli)
      else if (t.dir === -1 && t.u <= 0.0) {
        t.u = 0.0;
        t.isReversing = true;
        t.reversalProgress = 0;
      }
    });

    // Update Follow Train Camera
    if (followTrainId) {
      const ft = trains.find(x => x.id === followTrainId);
      if (ft) {
        const pos = getTrainCoordinates(ft);
        camera.x += (pos.x - camera.x) * 0.08;
        camera.y += (pos.y - camera.y) * 0.08;
      }
    }
  }

  function getTrainCoordinates(t) {
    const base = getPointAtProgress(t.u);
    const TRACK_OFFSET = 14; // Distance from center spline to each rail center

    if (t.isReversing) {
      // Reversal S-curve crossover from Track 1 to Track 2 or vice versa
      const p = t.reversalProgress;
      const startSign = t.track === 1 ? -1 : 1;
      const endSign = -startSign;
      const currentSign = startSign + (endSign - startSign) * p;

      const x = base.x + base.nx * (currentSign * TRACK_OFFSET);
      const y = base.y + base.ny * (currentSign * TRACK_OFFSET);
      const rot = base.angle + (t.track === 1 ? Math.PI * p : -Math.PI * p);
      return { x, y, angle: rot, track: t.track, u: t.u };
    }

    const sign = t.track === 1 ? -1 : 1;
    const x = base.x + base.nx * (sign * TRACK_OFFSET);
    const y = base.y + base.ny * (sign * TRACK_OFFSET);
    const angle = t.dir === 1 ? base.angle : base.angle + Math.PI;

    return { x, y, angle, track: t.track, u: t.u };
  }

  // ── 6. Canvas Rendering Pipeline ────────────────────────────
  let lastTime = performance.now();

  function renderLoop(now) {
    const dt = Math.min(50, now - lastTime);
    lastTime = now;

    updateFleet(dt);
    drawScene();

    requestAnimationFrame(renderLoop);
  }

  function drawScene() {
    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Warm Alabaster Canvas Background
    ctx.fillStyle = '#FDFBF7';
    ctx.fillRect(0, 0, width, height);

    // 2. Camera Transform Matrix (World ➔ Screen)
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // 3. Subtle Architectural Micro-Grid (Emons Style)
    drawArchitecturalGrid();

    // 4. Ballast Beds & Cross-Ties (Sleepers)
    drawBallastAndSleepers();

    // 5. Continuous Steel Rails & DMRC Yellow Centerline
    drawContinuousRails();

    // 6. Terminal Crossover Switches
    drawTerminalCrossovers();

    // 7. Physical Raised Platforms & Tactile Hazard Edges
    drawPhysicalPlatforms();

    // 8. Active Fleet Trains
    drawActiveFleet();

    // 9. Station Names & Badges
    drawStationLabels();

    ctx.restore(); // End World Space

    // 10. Screen-Space HUD & Mini Radar
    updateHUDTelemetry();

    ctx.restore();
  }

  // ── A. Architectural Grid ───────────────────────────────────
  function drawArchitecturalGrid() {
    const gridStep = 48;
    const viewL = camera.x - (width / camera.zoom) / 2 - 100;
    const viewR = camera.x + (width / camera.zoom) / 2 + 100;
    const viewT = camera.y - (height / camera.zoom) / 2 - 100;
    const viewB = camera.y + (height / camera.zoom) / 2 + 100;

    const startX = Math.floor(viewL / gridStep) * gridStep;
    const startY = Math.floor(viewT / gridStep) * gridStep;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.035)';
    for (let x = startX; x <= viewR; x += gridStep) {
      for (let y = startY; y <= viewB; y += gridStep) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2 / camera.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── B. Ballast Bed & Wooden Sleepers ─────────────────────────
  function drawBallastAndSleepers() {
    const TRACK_OFFSET = 14;

    // 1. Soft Viaduct / Ballast Ground Shadow
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.06)';
    ctx.lineWidth = 48;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < splinePoints.length; i++) {
      const p = splinePoints[i];
      if (i === 0) ctx.moveTo(p.x + 4, p.y + 6);
      else ctx.lineTo(p.x + 4, p.y + 6);
    }
    ctx.stroke();

    // 2. Concrete Viaduct Slab (Light warm grey)
    ctx.beginPath();
    ctx.strokeStyle = '#F1EFEA';
    ctx.lineWidth = 44;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < splinePoints.length; i++) {
      const p = splinePoints[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // 3. Crushed-Stone Ballast Beds (Two bands)
    [-TRACK_OFFSET, TRACK_OFFSET].forEach(offset => {
      ctx.beginPath();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < splinePoints.length; i++) {
        const p = splinePoints[i];
        const x = p.x + p.nx * offset;
        const y = p.y + p.ny * offset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    // 4. Wooden Sleepers (Cross-Ties) along both tracks
    const sleeperSpacing = 11;
    const numSleepers = Math.floor(trackLength / sleeperSpacing);
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 2.2;

    for (let i = 0; i < numSleepers; i++) {
      const u = (i * sleeperSpacing) / trackLength;
      const pt = getPointAtProgress(u);

      // Track 1 sleeper
      const t1x = pt.x + pt.nx * -TRACK_OFFSET;
      const t1y = pt.y + pt.ny * -TRACK_OFFSET;
      ctx.beginPath();
      ctx.moveTo(t1x - pt.nx * 5.5, t1y - pt.ny * 5.5);
      ctx.lineTo(t1x + pt.nx * 5.5, t1y + pt.ny * 5.5);
      ctx.stroke();

      // Track 2 sleeper
      const t2x = pt.x + pt.nx * TRACK_OFFSET;
      const t2y = pt.y + pt.ny * TRACK_OFFSET;
      ctx.beginPath();
      ctx.moveTo(t2x - pt.nx * 5.5, t2y - pt.ny * 5.5);
      ctx.lineTo(t2x + pt.nx * 5.5, t2y + pt.ny * 5.5);
      ctx.stroke();
    }
  }

  // ── C. Continuous Steel Rails & Yellow Centerline ───────────
  function drawContinuousRails() {
    const TRACK_OFFSET = 14;
    const RAIL_GAUGE = 3.8;

    [-TRACK_OFFSET, TRACK_OFFSET].forEach(trackCenter => {
      // Outer & Inner Steel Rails
      [-RAIL_GAUGE, RAIL_GAUGE].forEach(railOffset => {
        const offset = trackCenter + railOffset;
        ctx.beginPath();
        ctx.strokeStyle = '#334155'; // Dark metallic rail steel
        ctx.lineWidth = 1.6;
        for (let i = 0; i < splinePoints.length; i++) {
          const p = splinePoints[i];
          const x = p.x + p.nx * offset;
          const y = p.y + p.ny * offset;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      // Bright DMRC Yellow Center Guidance Stripe
      ctx.beginPath();
      ctx.strokeStyle = '#EAB308';
      ctx.lineWidth = 1.0;
      for (let i = 0; i < splinePoints.length; i++) {
        const p = splinePoints[i];
        const x = p.x + p.nx * trackCenter;
        const y = p.y + p.ny * trackCenter;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }

  // ── D. Terminal Crossover Switches ──────────────────────────
  function drawTerminalCrossovers() {
    const TRACK_OFFSET = 14;

    // 1. Samaypur Badli Crossover (Top)
    const topP0 = getPointAtProgress(0.01);
    const topP1 = getPointAtProgress(0.05);
    ctx.beginPath();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.0;
    ctx.setLineDash([4, 3]);
    ctx.moveTo(topP0.x + topP0.nx * TRACK_OFFSET, topP0.y + topP0.ny * TRACK_OFFSET);
    ctx.lineTo(topP1.x + topP1.nx * -TRACK_OFFSET, topP1.y + topP1.ny * -TRACK_OFFSET);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Millennium City Crossover (Bottom)
    const botP0 = getPointAtProgress(0.95);
    const botP1 = getPointAtProgress(0.99);
    ctx.beginPath();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.0;
    ctx.setLineDash([4, 3]);
    ctx.moveTo(botP0.x + botP0.nx * -TRACK_OFFSET, botP0.y + botP0.ny * -TRACK_OFFSET);
    ctx.lineTo(botP1.x + botP1.nx * TRACK_OFFSET, botP1.y + botP1.ny * TRACK_OFFSET);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── E. Physical Raised Platforms & Tactile Edges ────────────
  function drawPhysicalPlatforms() {
    STATIONS_DATA.forEach((st, idx) => {
      const u = stationProgress[idx];
      const pt = getPointAtProgress(u);

      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.angle);

      const isSelected = selectedStationId === st.id;
      const platLen = st.major ? 92 : 68;
      const platHalfLen = platLen / 2;
      const platWid = 22;
      const platHalfWid = platWid / 2;

      // Selection Glow
      if (isSelected) {
        ctx.fillStyle = 'rgba(234, 179, 8, 0.22)';
        ctx.beginPath();
        ctx.roundRect(-platHalfLen - 5, -platHalfWid - 5, platLen + 10, platWid + 10, 6);
        ctx.fill();
      }

      // Platform Ambient Drop Shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
      ctx.fillRect(-platHalfLen + 3, -platHalfWid + 4, platLen, platWid);

      // Raised Concrete Island Deck (White alabaster)
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = isSelected ? '#EAB308' : 'rgba(15, 23, 42, 0.18)';
      ctx.lineWidth = isSelected ? 1.8 : 1.0;
      ctx.beginPath();
      ctx.roundRect(-platHalfLen, -platHalfWid, platLen, platWid, 3);
      ctx.fill();
      ctx.stroke();

      // Tactile DMRC Yellow Safety Hazard Stripes (Along both platform edges)
      ctx.strokeStyle = '#EAB308';
      ctx.lineWidth = 2.4;

      // Edge facing Track 1 (Top edge)
      ctx.beginPath();
      ctx.moveTo(-platHalfLen + 2, -platHalfWid + 1.6);
      ctx.lineTo(platHalfLen - 2, -platHalfWid + 1.6);
      ctx.stroke();

      // Edge facing Track 2 (Bottom edge)
      ctx.beginPath();
      ctx.moveTo(-platHalfLen + 2, platHalfWid - 1.6);
      ctx.lineTo(platHalfLen - 2, platHalfWid - 1.6);
      ctx.stroke();

      // Platform Designation Indicators ("P1" / "P2")
      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 6.5px "JetBrains Mono", monospace';
      ctx.fillText('P1', -platHalfLen + 6, -platHalfWid + 7.5);
      ctx.fillText('P2', -platHalfLen + 6, platHalfWid - 3.5);

      // Platform Waiting Commuters (Little stylized dots behind yellow line)
      const passengerColors = ['#2563EB', '#E11D48', '#059669', '#475569', '#D97706'];
      for (let px = -platHalfLen + 20; px <= platHalfLen - 16; px += 14) {
        ctx.fillStyle = passengerColors[Math.abs(Math.floor(px + idx)) % passengerColors.length];
        ctx.beginPath();
        ctx.arc(px, (Math.sin(px + idx) * 3), 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }

  // ── F. Active Fleet Trains ──────────────────────────────────
  function drawActiveFleet() {
    trains.forEach(t => {
      const pos = getTrainCoordinates(t);

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(pos.angle);

      if (renderMode === 'dot') {
        // ── USER SPECIFICATION: White-Black Concentric Target Dot ──
        // Ambient soft drop shadow
        ctx.beginPath();
        ctx.arc(0, 2, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
        ctx.fill();

        // White Body with Crisp Solid Black Outer Border
        ctx.beginPath();
        ctx.arc(0, 0, 7.0, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.6;
        ctx.stroke();

        // Inner Solid Black Pupil
        ctx.beginPath();
        ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();

        // Direction indicator chevron
        ctx.fillStyle = '#EAB308';
        ctx.beginPath();
        ctx.arc(5.2, 0, 1.4, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // ── Sleek 3-Car Articulated Delhi Metro Consist ──
        if (trainConsistLoaded) {
          const trainLen = 52;
          const trainWid = 13;
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(trainConsistImg, -trainWid / 2, -trainLen / 2, trainWid, trainLen);
        } else {
          // Fallback vector train
          ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
          ctx.fillRect(-22, -4.5, 44, 11);

          ctx.fillStyle = '#F8FAFC';
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(-22, -5.5, 44, 11, 2);
          ctx.fill();
          ctx.stroke();

          // Yellow Livery Band
          ctx.fillStyle = '#EAB308';
          ctx.fillRect(-22, -1, 44, 2);

          // Headlights
          ctx.fillStyle = '#FEF08A';
          ctx.beginPath();
          ctx.arc(21, -3, 1.2, 0, Math.PI * 2);
          ctx.arc(21, 3, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    });
  }

  // ── G. Station Labels & Badges ───────────────────────────────
  function drawStationLabels() {
    STATIONS_DATA.forEach((st, idx) => {
      const u = stationProgress[idx];
      const pt = getPointAtProgress(u);

      const isSelected = selectedStationId === st.id;
      const isMajor = st.major;

      // Draw label offset to the right of the tracks
      const labelX = pt.x + pt.nx * 28;
      const labelY = pt.y + pt.ny * 28;

      ctx.save();
      ctx.translate(labelX, labelY);

      // Station Number Badge
      const numStr = String(idx + 1).padStart(2, '0');
      ctx.font = '600 9px "JetBrains Mono", monospace';
      const numW = ctx.measureText(numStr).width;

      // Station Name
      ctx.font = isMajor ? '700 12px "Plus Jakarta Sans", sans-serif' : '500 11px "Inter", sans-serif';
      const nameW = ctx.measureText(st.name).width;

      const totalW = numW + nameW + 18;
      const boxH = 20;

      // Station Pill Background
      ctx.fillStyle = isSelected ? '#0F172A' : (isMajor ? '#FFFFFF' : 'rgba(255, 255, 255, 0.88)');
      ctx.strokeStyle = isSelected ? '#0F172A' : (isMajor ? 'rgba(15, 23, 42, 0.18)' : 'rgba(15, 23, 42, 0.08)');
      ctx.lineWidth = isSelected ? 1.5 : 1.0;

      ctx.beginPath();
      ctx.roundRect(0, -boxH / 2, totalW, boxH, 10);
      ctx.fill();
      ctx.stroke();

      // Station Number
      ctx.fillStyle = isSelected ? '#EAB308' : '#94A3B8';
      ctx.font = '600 8.5px "JetBrains Mono", monospace';
      ctx.fillText(numStr, 6, 2.5);

      // Station Name Text
      ctx.fillStyle = isSelected ? '#FFFFFF' : (isMajor ? '#0F172A' : '#334155');
      ctx.font = isMajor ? '700 10.5px "Plus Jakarta Sans", sans-serif' : '500 10px "Inter", sans-serif';
      ctx.fillText(st.name, numW + 11, 2.5);

      ctx.restore();
    });
  }

  // ── 7. User Interactions (Pan, Zoom, Clicks) ─────────────────
  function setupInteractions() {
    canvas.addEventListener('mousedown', e => {
      camera.isDragging = true;
      camera.dragStartX = e.clientX;
      camera.dragStartY = e.clientY;
      camera.camStartX = camera.x;
      camera.camStartY = camera.y;
      canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
      if (!camera.isDragging) return;
      followTrainId = null; // Break camera lock on manual pan
      const dx = (e.clientX - camera.dragStartX) / camera.zoom;
      const dy = (e.clientY - camera.dragStartY) / camera.zoom;
      camera.x = camera.camStartX - dx;
      camera.y = camera.camStartY - dy;
    });

    window.addEventListener('mouseup', () => {
      camera.isDragging = false;
      canvas.style.cursor = 'grab';
    });

    // Smooth Wheel Zoom clamped
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * zoomFactor));
    }, { passive: false });

    // Click on canvas to select station or train
    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      const clickScreenX = e.clientX - rect.left;
      const clickScreenY = e.clientY - rect.top;

      // Screen ➔ World coordinates
      const worldX = camera.x + (clickScreenX - width / 2) / camera.zoom;
      const worldY = camera.y + (clickScreenY - height / 2) / camera.zoom;

      // Check trains first
      let clickedTrain = null;
      trains.forEach(t => {
        const pos = getTrainCoordinates(t);
        const dist = Math.hypot(worldX - pos.x, worldY - pos.y);
        if (dist < 18 / camera.zoom) clickedTrain = t;
      });

      if (clickedTrain) {
        selectedTrainId = clickedTrain.id;
        followTrainId = clickedTrain.id;
        showTrainInspector(clickedTrain);
        return;
      }

      // Check stations
      let clickedStation = null;
      STATIONS_DATA.forEach((st, idx) => {
        const u = stationProgress[idx];
        const pt = getPointAtProgress(u);
        const dist = Math.hypot(worldX - pt.x, worldY - pt.y);
        if (dist < 32 / camera.zoom) clickedStation = st;
      });

      if (clickedStation) {
        selectedStationId = clickedStation.id;
        showStationInspector(clickedStation);
      }
    });
  }

  function centerOnStation(stationId, smooth = true, targetZoom = 1.15) {
    const st = STATIONS_DATA.find(s => s.id === stationId);
    if (!st) return;
    selectedStationId = st.id;
    followTrainId = null;

    if (smooth) {
      const startX = camera.x, startY = camera.y, startZ = camera.zoom;
      const targetX = st.x, targetY = st.y;
      const startTime = performance.now();
      const dur = 600;

      function step(now) {
        const p = Math.min(1, (now - startTime) / dur);
        const ease = 0.5 - Math.cos(p * Math.PI) / 2;
        camera.x = startX + (targetX - startX) * ease;
        camera.y = startY + (targetY - startY) * ease;
        camera.zoom = startZ + (targetZoom - startZ) * ease;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    } else {
      camera.x = st.x;
      camera.y = st.y;
      camera.zoom = targetZoom;
    }

    showStationInspector(st);
  }

  // ── 8. HUD & UI Bindings ────────────────────────────────────
  function setupHUD() {
    // Mode toggle (Dot vs 3D)
    const btnDot = document.getElementById('hud-mode-dot');
    const btn3D = document.getElementById('hud-mode-3d');
    if (btnDot && btn3D) {
      btnDot.addEventListener('click', () => {
        btnDot.classList.add('active');
        btn3D.classList.remove('active');
        renderMode = 'dot';
      });
      btn3D.addEventListener('click', () => {
        btn3D.classList.add('active');
        btnDot.classList.remove('active');
        renderMode = '3d';
      });
    }

    // Speeds
    document.querySelectorAll('[data-board-speed]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-board-speed]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        simSpeed = parseFloat(btn.getAttribute('data-board-speed')) || 1.0;
      });
    });

    // Station quick jump bookmarks
    document.querySelectorAll('[data-jump-st]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-jump-st]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const stId = btn.getAttribute('data-jump-st');
        if (stId === 'all') {
          // Corridor Overview
          camera.x = 1050;
          camera.y = 1710;
          camera.zoom = 0.27;
          followTrainId = null;
        } else {
          centerOnStation(stId, true, 1.15);
        }
      });
    });

    // Zoom in / out buttons
    const zoomInBtn = document.getElementById('btn-zoom-in');
    const zoomOutBtn = document.getElementById('btn-zoom-out');
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        camera.zoom = Math.min(camera.maxZoom, camera.zoom * 1.3);
      });
    }
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        camera.zoom = Math.max(camera.minZoom, camera.zoom * 0.77);
      });
    }

    // Chime
    const chimeBtn = document.getElementById('btn-board-chime');
    if (chimeBtn) chimeBtn.addEventListener('click', playDMRCChime);

    // Follow train release button
    const stopFollowBtn = document.getElementById('btn-stop-follow');
    if (stopFollowBtn) {
      stopFollowBtn.addEventListener('click', () => {
        followTrainId = null;
        stopFollowBtn.classList.add('hidden');
      });
    }
  }

  function showStationInspector(st) {
    const card = document.getElementById('hud-station-card');
    if (!card) return;
    card.classList.remove('hidden');

    document.getElementById('hud-st-name').textContent = st.name;
    document.getElementById('hud-st-lines').textContent = st.lines.join(' · ') + ' Line';

    // Calculate nearest trains
    const sIdx = STATIONS_DATA.findIndex(s => s.id === st.id);
    const su = stationProgress[sIdx];

    // Southbound train approaching
    const southApproaching = trains
      .filter(t => t.dir === 1 && t.u <= su)
      .sort((a, b) => b.u - a.u)[0] || trains.find(t => t.dir === 1);

    // Northbound train approaching
    const northApproaching = trains
      .filter(t => t.dir === -1 && t.u >= su)
      .sort((a, b) => a.u - b.u)[0] || trains.find(t => t.dir === -1);

    const p1ETA = southApproaching ? Math.max(15, Math.round((su - southApproaching.u) * 600)) : 45;
    const p2ETA = northApproaching ? Math.max(15, Math.round((northApproaching.u - su) * 600)) : 90;

    document.getElementById('hud-p1-train').textContent = southApproaching ? `${southApproaching.id} (Due in ${formatSeconds(p1ETA)})` : 'Due in 1m';
    document.getElementById('hud-p2-train').textContent = northApproaching ? `${northApproaching.id} (Due in ${formatSeconds(p2ETA)})` : 'Due in 2m';
  }

  function showTrainInspector(t) {
    const card = document.getElementById('hud-station-card');
    if (!card) return;
    card.classList.remove('hidden');

    document.getElementById('hud-st-name').textContent = `Train ${t.id}`;
    document.getElementById('hud-st-lines').textContent = t.track === 1 ? 'Track 1 (Southbound ➔ Millennium City)' : 'Track 2 (Northbound ➔ Samaypur Badli)';

    const stopFollowBtn = document.getElementById('btn-stop-follow');
    if (stopFollowBtn) stopFollowBtn.classList.remove('hidden');

    document.getElementById('hud-p1-train').textContent = `Speed: ${t.speed} km/h · ${t.isDwelling ? 'Boarding at Platform' : 'In Transit'}`;
    document.getElementById('hud-p2-train').textContent = `Tracking Camera: Locked 📹`;
  }

  function updateHUDTelemetry() {
    // Dynamic ticker updates
    const activeTrainsCount = trains.length;
    const countEl = document.getElementById('stat-active-trains');
    if (countEl) countEl.textContent = `${activeTrainsCount} Trains`;
  }

  function formatSeconds(sec) {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  }

  function playDMRCChime() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const notes = [
        { freq: 698.46, start: 0, dur: 0.16 },
        { freq: 880.00, start: 0.18, dur: 0.16 },
        { freq: 1046.50, start: 0.36, dur: 0.38 }
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
    } catch (e) {}
  }

  // Auto-boot on DOM ready
  document.addEventListener('DOMContentLoaded', init);

  window.RadarBoard = {
    centerOnStation,
    setSpeed: s => { simSpeed = s; },
    setMode: m => { renderMode = m; },
    getRenderMode: () => renderMode,
    followTrain: id => { followTrainId = id; },
    getFollowTrainId: () => followTrainId,
    getTrains: () => trains,
    isTrainConsistLoaded: () => trainConsistLoaded,
    camera
  };
})();