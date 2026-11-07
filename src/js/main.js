/* ============================================================
 * DELHI METRO RADAR  —  Yellow Line (L2)
 * Unofficial project. Not affiliated with DMRC.
 * Positions are estimated from public timetable data, not GPS.
 * ============================================================ */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  //  CONFIG
  // ═══════════════════════════════════════════════════════════
  const CFG = {
    // Map
    MAP_STYLE  : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    MAP_CENTER : [77.1800, 28.5900],
    MAP_ZOOM   : 10.4,
    MAP_MIN    : 8,
    MAP_MAX    : 17,

    // Colors
    LINE_COLOR  : '#FFD500',
    TRAIN_COLOR : '#00FFCC',

    // Service window (seconds since midnight)
    SVC_START : 5  * 3600 + 50 * 60,   // 05:50
    SVC_END   : 23 * 3600 + 30 * 60,   // 23:30 (last departure)

    // Timetable
    HEADWAY_S : 5 * 60,   // 5-minute headway
    SPEED_KPH : 44,       // average cruising speed between stations
    DWELL_S   : 20,       // dwell time per intermediate station (seconds)
  };

  // ═══════════════════════════════════════════════════════════
  //  YELLOW LINE STATION DATA
  //  Coordinates: [longitude, latitude]
  //  Approximate positions based on DMRC route mapping.
  //  For precision, replace with OpenStreetMap node coordinates.
  // ═══════════════════════════════════════════════════════════
  const STATIONS = [
    { id: 'samaypur_badli',         name: 'Samaypur Badli',         coords: [77.1407, 28.7268], terminus: true,  interchange: false },
    { id: 'rohini_18_19',           name: 'Rohini Sec 18, 19',      coords: [77.1382, 28.7196], terminus: false, interchange: false },
    { id: 'haiderpur_badli_mor',    name: 'Haiderpur Badli Mor',    coords: [77.1398, 28.7116], terminus: false, interchange: false },
    { id: 'jahangirpuri',           name: 'Jahangirpuri',           coords: [77.1407, 28.7047], terminus: false, interchange: true  },
    { id: 'adarsh_nagar',           name: 'Adarsh Nagar',           coords: [77.1485, 28.6974], terminus: false, interchange: false },
    { id: 'azadpur',                name: 'Azadpur',                coords: [77.1569, 28.6929], terminus: false, interchange: true  },
    { id: 'bharat_nagar',           name: 'Bharat Nagar',           coords: [77.1817, 28.6829], terminus: false, interchange: false },
    { id: 'vidhan_sabha',           name: 'Vidhan Sabha',           coords: [77.2219, 28.6701], terminus: false, interchange: false },
    { id: 'civil_lines',            name: 'Civil Lines',            coords: [77.2255, 28.6749], terminus: false, interchange: false },
    { id: 'kashmere_gate',          name: 'Kashmere Gate',          coords: [77.2283, 28.6677], terminus: false, interchange: true  },
    { id: 'chandni_chowk',          name: 'Chandni Chowk',         coords: [77.2308, 28.6565], terminus: false, interchange: false },
    { id: 'chawri_bazar',           name: 'Chawri Bazar',           coords: [77.2283, 28.6490], terminus: false, interchange: false },
    { id: 'new_delhi',              name: 'New Delhi',              coords: [77.2210, 28.6420], terminus: false, interchange: true  },
    { id: 'rajiv_chowk',            name: 'Rajiv Chowk',           coords: [77.2192, 28.6330], terminus: false, interchange: true  },
    { id: 'patel_chowk',            name: 'Patel Chowk',           coords: [77.2124, 28.6243], terminus: false, interchange: false },
    { id: 'central_secretariat',    name: 'Central Secretariat',   coords: [77.2101, 28.6155], terminus: false, interchange: true  },
    { id: 'udyog_bhawan',           name: 'Udyog Bhawan',          coords: [77.2075, 28.6085], terminus: false, interchange: false },
    { id: 'lok_kalyan_marg',        name: 'Lok Kalyan Marg',       coords: [77.2051, 28.6005], terminus: false, interchange: false },
    { id: 'jor_bagh',               name: 'Jor Bagh',              coords: [77.2075, 28.5918], terminus: false, interchange: false },
    { id: 'ina',                    name: 'INA',                   coords: [77.2098, 28.5789], terminus: false, interchange: true  },
    { id: 'aiims',                  name: 'AIIMS',                 coords: [77.2097, 28.5680], terminus: false, interchange: false },
    { id: 'green_park',             name: 'Green Park',            coords: [77.2062, 28.5591], terminus: false, interchange: false },
    { id: 'hauz_khas',              name: 'Hauz Khas',             coords: [77.2061, 28.5443], terminus: false, interchange: true  },
    { id: 'malviya_nagar',          name: 'Malviya Nagar',         coords: [77.2029, 28.5293], terminus: false, interchange: false },
    { id: 'saket',                  name: 'Saket',                 coords: [77.2046, 28.5205], terminus: false, interchange: false },
    { id: 'qutab_minar',            name: 'Qutab Minar',           coords: [77.1850, 28.5041], terminus: false, interchange: false },
    { id: 'chhattarpur',            name: 'Chhattarpur',           coords: [77.1699, 28.4938], terminus: false, interchange: false },
    { id: 'sultanpur',              name: 'Sultanpur',             coords: [77.1570, 28.4832], terminus: false, interchange: false },
    { id: 'ghitorni',               name: 'Ghitorni',              coords: [77.1529, 28.4738], terminus: false, interchange: false },
    { id: 'arjangarh',              name: 'Arjangarh',             coords: [77.1313, 28.4568], terminus: false, interchange: false },
    { id: 'guru_dronacharya',       name: 'Guru Dronacharya',      coords: [77.0869, 28.4592], terminus: false, interchange: false },
    { id: 'sikanderpur',            name: 'Sikanderpur',           coords: [77.0921, 28.4699], terminus: false, interchange: true  },
    { id: 'mg_road',                name: 'MG Road',               coords: [77.0973, 28.4756], terminus: false, interchange: false },
    { id: 'iffco_chowk',            name: 'IFFCO Chowk',           coords: [77.0697, 28.4726], terminus: false, interchange: false },
    { id: 'millennium_city_centre', name: 'Millennium City Centre',coords: [77.0738, 28.4607], terminus: true,  interchange: false },
  ];

  const N = STATIONS.length; // 35

  // ═══════════════════════════════════════════════════════════
  //  TIMETABLE GEOMETRY  (precomputed once at startup)
  // ═══════════════════════════════════════════════════════════

  /** Haversine distance in km between two [lng, lat] points */
  function hvDist(a, b) {
    const R = 6371, DEG = Math.PI / 180;
    const dLat = (b[1] - a[1]) * DEG, dLon = (b[0] - a[0]) * DEG;
    const h = Math.sin(dLat / 2) ** 2 +
              Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // Segment distances (km) and travel times (seconds)
  // segTime[i] = transit time from station[i] → station[i+1] PLUS dwell at i+1
  const segDist = [], segTime = [], cumTime = [0];
  let totalDist = 0;
  for (let i = 0; i < N - 1; i++) {
    const d = hvDist(STATIONS[i].coords, STATIONS[i + 1].coords);
    segDist.push(d);
    totalDist += d;
    const transit = (d / CFG.SPEED_KPH) * 3600;
    // Apply dwell only at intermediate stations (not the final terminus)
    const dwell = (i < N - 2) ? CFG.DWELL_S : 0;
    segTime.push(transit + dwell);
    cumTime.push(cumTime[i] + segTime[i]);
  }
  const TOTAL_S = cumTime[N - 1]; // total one-way trip time in seconds

  // Reversed arrays for northbound (MCC → SB) trains
  // revCumTime[k] = time from MCC to reach the k-th station (in reverse order)
  // revCumTime[0]=0 (at MCC, station[N-1])
  // revCumTime[k] corresponds to being at station[N-1-k]
  const revCumTime = Array.from({ length: N }, (_, k) =>
    TOTAL_S - cumTime[N - 1 - k]
  );
  const STATIONS_REV = [...STATIONS].reverse();

  console.log(
    `Yellow Line: ${N} stations | ${totalDist.toFixed(1)} km | ` +
    `~${Math.round(TOTAL_S / 60)} min one-way`
  );

  // ═══════════════════════════════════════════════════════════
  //  TRAIN POSITION INTERPOLATION
  // ═══════════════════════════════════════════════════════════

  /** Smooth ease-in-out for realistic acceleration/deceleration */
  function easeIO(t) {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }

  /**
   * Returns [lng, lat] for a train at `elapsedS` seconds after departing terminus.
   * direction: 0 = SB→MCC (southbound), 1 = MCC→SB (northbound)
   */
  function trainPos(elapsedS, direction) {
    if (elapsedS < 0 || elapsedS > TOTAL_S) return null;
    const sts  = direction === 0 ? STATIONS     : STATIONS_REV;
    const cums = direction === 0 ? cumTime      : revCumTime;

    // Binary-search for the segment
    let lo = 0, hi = N - 2;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cums[mid + 1] <= elapsedS) lo = mid + 1;
      else hi = mid;
    }
    const seg = lo;
    const tA = cums[seg], tB = cums[seg + 1];
    if (tB <= tA) return sts[seg].coords.slice();

    let t = (elapsedS - tA) / (tB - tA);
    t = Math.max(0, Math.min(1, t));
    t = easeIO(t);

    const a = sts[seg].coords, b = sts[seg + 1].coords;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  /**
   * Compute all active train positions right now.
   * Returns array of { coords:[lng,lat], direction:0|1 }
   */
  function computeAllTrains(nowMs) {
    const d  = new Date(nowMs);
    const s  = d.getHours() * 3600 + d.getMinutes() * 60 +
               d.getSeconds() + d.getMilliseconds() / 1000;
    const trains = [];
    for (let dir = 0; dir < 2; dir++) {
      for (let dep = CFG.SVC_START; dep <= CFG.SVC_END; dep += CFG.HEADWAY_S) {
        const elapsed = s - dep;
        if (elapsed >= 0 && elapsed <= TOTAL_S) {
          const coords = trainPos(elapsed, dir);
          if (coords) trains.push({ coords, direction: dir });
        }
      }
    }
    return trains;
  }

  // ═══════════════════════════════════════════════════════════
  //  NEXT TRAIN CALCULATION  (for station popup)
  // ═══════════════════════════════════════════════════════════

  /**
   * Returns next arrivals at station[idx] in the given direction.
   * direction 0 = toward MCC, 1 = toward SB
   * Returns up to 3 entries: [{ timeUntil (seconds) }, ...]
   */
  function nextTrains(idx, direction, nowMs) {
    const d = new Date(nowMs);
    const s = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();

    // Time from origin terminus to reach station[idx]
    const tFromOrigin = direction === 0
      ? cumTime[idx]           // SB→MCC: origin = station[0]
      : revCumTime[N - 1 - idx]; // MCC→SB: origin = station[N-1]

    const results = [];
    for (let dep = CFG.SVC_START; dep <= CFG.SVC_END + TOTAL_S; dep += CFG.HEADWAY_S) {
      const arrival = dep + tFromOrigin;
      const delta   = arrival - s;
      if (delta >= -60 && delta < 30 * 60) {
        results.push({ timeUntil: delta });
        if (results.length >= 3) break;
      }
    }
    return results;
  }

  function fmtDelta(sec) {
    if (sec < 0)   return 'Now';
    if (sec < 60)  return `${Math.round(sec)}s`;
    const m = Math.floor(sec / 60), s2 = Math.round(sec % 60);
    return s2 > 0 ? `${m}m ${s2}s` : `${m} min`;
  }

  function fmtSeconds(s) {
    const h = Math.floor(s / 3600) % 24, m = Math.floor((s % 3600) / 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  // ═══════════════════════════════════════════════════════════
  //  MAP  —  initialisation
  // ═══════════════════════════════════════════════════════════

  let map;
  let selectedStation = null;
  let stationClickLatch = false; // prevents map click from closing popup immediately

  function initMap() {
    map = new maplibregl.Map({
      container: 'map',
      style    : CFG.MAP_STYLE,
      center   : CFG.MAP_CENTER,
      zoom     : CFG.MAP_ZOOM,
      minZoom  : CFG.MAP_MIN,
      maxZoom  : CFG.MAP_MAX,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', onLoad);
    map.on('error', e => console.warn('MapLibre error:', e));
  }

  // ─── Map load ────────────────────────────────────────────

  function onLoad() {
    addTrackLayers();
    addStationLayers();
    addTrainLayers();
    addInteractions();
    startAnimation();
    startClock();
    updateStatus();
  }

  // ─── Track ───────────────────────────────────────────────

  function addTrackLayers() {
    map.addSource('track', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: STATIONS.map(s => s.coords) },
      },
    });

    // Outer glow
    map.addLayer({ id: 'track-glow', type: 'line', source: 'track',
      paint: {
        'line-color': CFG.LINE_COLOR,
        'line-width': 18,
        'line-opacity': 0.12,
        'line-blur': 5,
      },
    });

    // Main line (zoom-responsive width)
    map.addLayer({ id: 'track-line', type: 'line', source: 'track',
      paint: {
        'line-color': CFG.LINE_COLOR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 11, 3, 15, 5],
        'line-opacity': 0.92,
      },
    });
  }

  // ─── Stations ─────────────────────────────────────────────

  function addStationLayers() {
    // Single source for all stations
    map.addSource('stations', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: STATIONS.map((s, i) => ({
          type: 'Feature',
          properties: {
            id         : s.id,
            name       : s.name,
            index      : i,
            interchange: s.interchange === true,
            terminus   : s.terminus   === true,
            special    : (s.interchange === true || s.terminus === true),
          },
          geometry: { type: 'Point', coordinates: s.coords },
        })),
      },
    });

    // Glow halo for interchange/terminus
    map.addLayer({ id: 'st-special-glow', type: 'circle', source: 'stations',
      filter: ['==', ['get', 'special'], true],
      paint: {
        'circle-radius'  : ['interpolate', ['linear'], ['zoom'], 9, 9, 15, 20],
        'circle-color'   : CFG.LINE_COLOR,
        'circle-opacity' : 0.14,
        'circle-blur'    : 1,
      },
    });

    // Regular station dots (white with yellow border)
    map.addLayer({ id: 'st-regular', type: 'circle', source: 'stations',
      filter: ['==', ['get', 'special'], false],
      minzoom: 9,
      paint: {
        'circle-radius'       : ['interpolate', ['linear'], ['zoom'], 9, 2.5, 13, 5, 16, 8],
        'circle-color'        : '#FFFFFF',
        'circle-stroke-width' : 1.5,
        'circle-stroke-color' : CFG.LINE_COLOR,
        'circle-opacity'      : 0.9,
      },
    });

    // Interchange / terminus dots (yellow with white border)
    map.addLayer({ id: 'st-special', type: 'circle', source: 'stations',
      filter: ['==', ['get', 'special'], true],
      paint: {
        'circle-radius'       : ['interpolate', ['linear'], ['zoom'], 8, 4, 13, 8, 16, 12],
        'circle-color'        : CFG.LINE_COLOR,
        'circle-stroke-width' : 2,
        'circle-stroke-color' : '#FFFFFF',
        'circle-opacity'      : 1,
      },
    });

    // Station name labels
    map.addLayer({ id: 'st-labels', type: 'symbol', source: 'stations',
      minzoom: 11,
      layout: {
        'text-field'            : ['get', 'name'],
        'text-font'             : ['Noto Sans Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size'             : ['interpolate', ['linear'], ['zoom'], 11, 10, 14, 13],
        'text-offset'           : [0, 1.5],
        'text-anchor'           : 'top',
        'text-allow-overlap'    : false,
        'text-ignore-placement' : false,
        'text-max-width'        : 8,
      },
      paint: {
        'text-color'       : '#D8DCEE',
        'text-halo-color'  : '#050510',
        'text-halo-width'  : 1.5,
        'text-opacity'     : ['interpolate', ['linear'], ['zoom'], 11, 0, 11.6, 1],
      },
    });

    // Invisible wide click-catcher on top (easier to tap on mobile)
    map.addLayer({ id: 'st-click', type: 'circle', source: 'stations',
      paint: {
        'circle-radius'  : ['interpolate', ['linear'], ['zoom'], 9, 12, 15, 20],
        'circle-opacity' : 0,
        'circle-stroke-opacity': 0,
      },
    });
  }

  // ─── Trains ───────────────────────────────────────────────

  function addTrainLayers() {
    map.addSource('trains', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Animated pulse halo (radius & opacity driven each frame)
    map.addLayer({ id: 'tr-pulse', type: 'circle', source: 'trains',
      paint: {
        'circle-radius'  : 20,
        'circle-color'   : CFG.TRAIN_COLOR,
        'circle-opacity' : 0.25,
        'circle-blur'    : 1,
      },
    });

    // Outer ring
    map.addLayer({ id: 'tr-ring', type: 'circle', source: 'trains',
      paint: {
        'circle-radius'          : ['interpolate', ['linear'], ['zoom'], 9, 9, 15, 14],
        'circle-color'           : 'transparent',
        'circle-stroke-width'    : 1.5,
        'circle-stroke-color'    : CFG.TRAIN_COLOR,
        'circle-stroke-opacity'  : 0.65,
      },
    });

    // Inner dot
    map.addLayer({ id: 'tr-dot', type: 'circle', source: 'trains',
      paint: {
        'circle-radius'       : ['interpolate', ['linear'], ['zoom'], 9, 5, 15, 8],
        'circle-color'        : CFG.TRAIN_COLOR,
        'circle-stroke-width' : 1.5,
        'circle-stroke-color' : '#FFFFFF',
      },
    });
  }

  // ─── Interactions ─────────────────────────────────────────

  function addInteractions() {
    // Cursor change
    map.on('mouseenter', 'st-click', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'st-click', () => { map.getCanvas().style.cursor = ''; });

    // Station click → popup
    map.on('click', 'st-click', e => {
      if (!e.features.length) return;
      stationClickLatch = true;
      setTimeout(() => { stationClickLatch = false; }, 50);
      const p = e.features[0].properties;
      openStationPopup(p.index, p.name, p.interchange, p.terminus);
    });

    // Click on map background → dismiss popup
    map.on('click', () => {
      if (!stationClickLatch) closePopup();
    });

    // Train hover tooltip
    map.on('mouseenter', 'tr-dot', e => {
      map.getCanvas().style.cursor = 'default';
      if (e.features.length) {
        const dir = e.features[0].properties.direction === 0
          ? '→ Millennium City Centre'
          : '← Samaypur Badli';
        map.getCanvas().title = dir;
      }
    });
    map.on('mouseleave', 'tr-dot', () => {
      map.getCanvas().title = '';
      map.getCanvas().style.cursor = '';
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  STATION POPUP
  // ═══════════════════════════════════════════════════════════

  function openStationPopup(idx, name, isInterchange, isTerminus) {
    selectedStation = idx;
    document.getElementById('popup-name').textContent = name;

    let meta = 'Yellow Line (L2)';
    if (isInterchange) meta += '  ·  Interchange';
    if (isTerminus)    meta += '  ·  Terminus';
    document.getElementById('popup-meta').textContent = meta;

    renderPopupTrains(idx);
    document.getElementById('station-popup').classList.remove('hidden');
  }

  function closePopup() {
    document.getElementById('station-popup').classList.add('hidden');
    selectedStation = null;
  }

  function renderPopupTrains(idx) {
    const nowMs = Date.now();
    const now   = new Date(nowMs);
    const curS  = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    const container = document.getElementById('popup-trains');

    // No service check
    const inService = curS >= CFG.SVC_START && curS <= CFG.SVC_END + TOTAL_S;
    if (!inService) {
      container.innerHTML =
        `<div class="popup-no-service">🌙 No service until ${fmtSeconds(CFG.SVC_START)}</div>`;
      return;
    }

    const isFirst = (idx === 0);
    const isLast  = (idx === N - 1);

    const directions = [];
    if (!isFirst) directions.push({ label: '→ Millennium City Centre', dir: 0 });
    if (!isLast)  directions.push({ label: '← Samaypur Badli',         dir: 1 });

    let html = '';
    directions.forEach(({ label, dir }) => {
      html += `<div class="popup-dir-label">${label}</div>`;
      const trains = nextTrains(idx, dir, nowMs);

      if (!trains.length) {
        html += '<div class="popup-no-service">No more trains today</div>';
      } else {
        trains.forEach(({ timeUntil }, i) => {
          const cls  = timeUntil < 90  ? 't-arriving'
                     : timeUntil < 300 ? 't-soon'
                     : 't-later';
          const lbl  = i === 0
            ? (timeUntil < 60 ? 'Arriving' : 'Next')
            : `+${Math.ceil(timeUntil / 60)} min`;
          html += `
            <div class="popup-train-row">
              <span class="popup-train-label">${lbl}</span>
              <span class="popup-train-time ${cls}">${fmtDelta(timeUntil)}</span>
            </div>`;
        });
      }
    });

    container.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════
  //  CLOCK & STATUS
  // ═══════════════════════════════════════════════════════════

  function startClock() {
    tick();
    setInterval(tick, 1000);
  }

  function tick() {
    const now = new Date();
    const h   = String(now.getHours()).padStart(2,'0');
    const m   = String(now.getMinutes()).padStart(2,'0');
    const s   = String(now.getSeconds()).padStart(2,'0');
    document.getElementById('clock').textContent = `${h}:${m}:${s}`;

    updateStatus();
    if (selectedStation !== null) renderPopupTrains(selectedStation);
  }

  function updateStatus() {
    const now = new Date();
    const s   = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const on  = s >= CFG.SVC_START && s <= CFG.SVC_END + TOTAL_S;

    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('status-text');
    dot.className = 'status-dot ' + (on ? 'active' : 'inactive');
    txt.textContent = on ? 'Service Active' : 'No Service';
  }

  // ═══════════════════════════════════════════════════════════
  //  ANIMATION LOOP
  // ═══════════════════════════════════════════════════════════

  function startAnimation() {
    function frame() {
      const nowMs  = Date.now();
      const trains = computeAllTrains(nowMs);

      // Update sidebar count
      document.getElementById('train-count').textContent =
        `${trains.length} train${trains.length !== 1 ? 's' : ''} active`;

      // Push new positions to map
      map.getSource('trains').setData({
        type: 'FeatureCollection',
        features: trains.map(t => ({
          type: 'Feature',
          properties: { direction: t.direction },
          geometry  : { type: 'Point', coordinates: t.coords },
        })),
      });

      // Animate pulse: sinusoidal radius + opacity
      const p = (Math.sin(nowMs / 650) + 1) * 0.5; // 0→1
      map.setPaintProperty('tr-pulse', 'circle-opacity', 0.07 + p * 0.22);
      map.setPaintProperty('tr-pulse', 'circle-radius',  14   + p * 10);

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ═══════════════════════════════════════════════════════════
  //  STARTUP
  // ═══════════════════════════════════════════════════════════

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('popup-close').addEventListener('click', closePopup);
    initMap();
  });

})();
