/* ============================================================
 * DELHI METRO — Architectural 3D Diorama Transit Interface
 * Three-Tier Architecture: 
 *  1. Corridor Radar (49 km Live Dual-Track with Physical Platforms)
 *  2. Station Cutaway (Central Line Tube Cutaway Diorama)
 *  3. 3D WebGL Stage (Interactive Three.js Orthographic Clay Diorama)
 * ============================================================ */
(function () {
  'use strict';

  let map = null;
  let trackData = null;
  let activeTrains = [];
  let trainPrevStates = new Map(); // For 60fps interpolation
  let trainTargetStates = new Map();
  let lastPacketTime = performance.now();
  let packetInterval = 100; // ms
  let selectedTrainId = null;
  let followTrainId = null;
  let renderMode = 'dot'; // Default to sleek, non-intrusive transit vehicle dot (big trains removed)
  let currentCutawayStation = 'rajiv_chowk';
  let activeStationIndex = null;
  let rajivMarker = null;
  let isDraggingSlider = false;
  let timeMode = 'live'; // 'live' | 'custom'
  let customTimeSeconds = 9 * 3600 + 15 * 60; // default 09:15 AM
  let simSpeed = 1.0;
  let lastSimulationTick = performance.now();

  const STATION_DETAILS = {
    'kashmere_gate': {
      id: 'kashmere_gate',
      title: 'Kashmere Gate Multimodal Hub',
      interchange: 'Red, Yellow & Violet Line Triple Interchange',
      interchangeClass: 'red',
      img: '/public/rajiv_chowk_cutaway.png',
      coords: [77.2282, 28.6675],
      zoom: 15.2,
      index: 11
    },
    'rajiv_chowk': {
      id: 'rajiv_chowk',
      title: 'Rajiv Chowk Intermodal Terminal',
      interchange: 'Yellow & Blue Line Interchange',
      interchangeClass: 'blue',
      img: '/public/rajiv_chowk_cutaway.png',
      coords: [77.2196, 28.6329],
      zoom: 15.2,
      index: 15
    },
    'hauz_khas': {
      id: 'hauz_khas',
      title: 'Hauz Khas Junction',
      interchange: 'Yellow & Magenta Line Interchange',
      interchangeClass: 'magenta',
      img: '/public/rajiv_chowk_cutaway.png',
      coords: [77.2067, 28.5443],
      zoom: 15.2,
      index: 24
    },
    'millennium_city_centre': {
      id: 'millennium_city_centre',
      title: 'Millennium City Centre (Cyber Hub)',
      interchange: 'Rapid Metro Gurugram & Southern Terminus',
      interchangeClass: 'blue',
      img: '/public/rajiv_chowk_cutaway.png',
      coords: [77.0725, 28.4594],
      zoom: 15.0,
      index: 36
    }
  };

  // ═══════════════════════════════════════════════════════════
  //  1. INITIALIZATION & DATA FETCH
  // ═══════════════════════════════════════════════════════════
  window.CLOCK_SKEW_MS = 0;

  async function checkServiceAdvisories() {
    try {
      const res = await fetch('src/data/service_advisories.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const advisory = await res.json();
      if (window.TripEngine) {
        TripEngine.setServiceAdvisory(advisory);
      }
      updateAdvisoryUI(advisory);
    } catch (e) {
      console.warn('Advisory check failed, falling back to scheduled status', e);
    }
  }

  function updateAdvisoryUI(advisory) {
    const banner = document.getElementById('service-advisory-banner');
    const bannerText = document.getElementById('advisory-banner-text');
    const lineDot = document.getElementById('line-status-dot');
    const lineText = document.getElementById('line-status-text');

    if (advisory && advisory.active) {
      if (banner && bannerText) {
        bannerText.textContent = `⚠️ DMRC ADVISORY: ${advisory.title} — ${advisory.message}`;
        banner.classList.remove('hidden');
      }
      if (lineDot) lineDot.textContent = '🟡';
      if (lineText) lineText.textContent = `DMRC Advisory: ${advisory.title} · Frequency may vary`;
    } else {
      if (banner) banner.classList.add('hidden');
      if (lineDot) lineDot.textContent = '🟢';
      if (lineText) lineText.textContent = 'Normal Operations · Scheduled estimates';
    }
  }

  async function init() {
    setupMasterNavigation();
    setupControls();

    // 1. Clock Skew Calibration via HTTP Date Header
    try {
      const headRes = await fetch('src/data/yellow_line_service.json', { method: 'HEAD' });
      const serverDate = headRes.headers.get('date');
      if (serverDate) {
        const serverMs = new Date(serverDate).getTime();
        window.CLOCK_SKEW_MS = serverMs - Date.now();
        console.log(`[Clock Sync] Calibrated server clock offset: ${window.CLOCK_SKEW_MS}ms`);
      } else {
        window.CLOCK_SKEW_MS = 0;
      }
    } catch (e) {
      window.CLOCK_SKEW_MS = 0;
    }

    try {
      trackData = await TripEngine.loadData();
    } catch (e) {
      console.error('Failed to load track topology from TripEngine', e);
    }

    await checkServiceAdvisories();
    setInterval(checkServiceAdvisories, 60000);

    if (window.LiveClient) {
      try {
        await LiveClient.init();
        LiveClient.onStateUpdate((state) => {
          if (state && state.alerts && state.alerts.length > 0) {
            updateAdvisoryUI({
              active: true,
              title: state.alerts[0].title || 'Rider-Reported Hold',
              message: state.alerts[0].message || 'Crowd observations indicate unusual delay.'
            });
          }
        });
      } catch (e) {
        console.warn('[LiveClient] Init warning:', e);
      }
    }

    initDioramaMap();
    startClientSimulationTicker();
    startAnimationLoop();
  }

  // Page Visibility API Re-Anchoring (Anti-freeze upon tab wake)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      trainPrevStates.clear();
      lastSimulationTick = performance.now();
    }
  });

  function preloadImage(url, id) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (map && !map.hasImage(id)) {
          map.addImage(id, img);
        }
        resolve(img);
      };
      img.onerror = (e) => {
        console.error('Failed to load image', url, e);
        resolve(null);
      };
      img.src = url;
    });
  }

  function initDioramaMap() {
    // Vibrant, colorful architectural MapLibre foundation
    map = new maplibregl.Map({
      container: 'map',
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [77.1400, 28.5850], // Centered for complete 49.3 km corridor overview from Samaypur Badli to Millennium City
      zoom: 10.35,
      pitch: 0,       // Clean 2D plan on overview load (no squashed foreshortening)
      bearing: 0,
      minZoom: 9.0,
      maxZoom: 18.0,
      maxBounds: [
        [76.50, 28.10], // Southwest NCR
        [77.70, 29.10]  // Northeast NCR
      ],
      attributionControl: false
    });
    window.map = map;
    window.mapInstance = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({
      compact: false,
      customAttribution: 'Unofficial · Not affiliated with DMRC | © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
    }), 'bottom-left');

    map.on('styleimagemissing', (e) => {
      if (e.id === 'delhi-metro-consist') {
        preloadImage('/public/metro_train_topdown_vibrant.png', 'delhi-metro-consist');
      } else if (e.id === 'dmrc-rail-pattern') {
        preloadImage('/public/delhi_metro_track_pattern.png', 'dmrc-rail-pattern');
      }
    });

    map.on('load', async () => {
      suppressMapClutter();
      enhanceMapColors();

      // Directional Sunlight for 3D Architectural Extrusions (Canopies & Platforms)
      try {
        map.setLight({
          anchor: 'viewport',
          color: '#FFFFFF',
          intensity: 0.65,
          position: [1.5, 180, 50]
        });
      } catch (e) {}

      await Promise.all([
        preloadImage('/public/metro_train_topdown_vibrant.png', 'delhi-metro-consist'),
        preloadImage('/public/delhi_metro_track_pattern.png', 'dmrc-rail-pattern')
      ]);

      add3DBuildings();
      renderViaductAndDualTracks();
      renderPhysicalPlatforms();
      renderTrainsLayers();
      add3DStationLandmarks();
      setupInteractions();

      map.on('zoom', updateMarkerScale);
      updateMarkerScale();
    });
  }

  function suppressMapClutter() {
    try {
      const style = map.getStyle();
      if (!style || !style.layers) return;
      const clutterPatterns = [
        'shield', 'boundary', 'roadname', 'housenumber', 
        'poi_', 'place_hamlet', 'place_suburbs', 'place_villages', 
        'place_town', 'watername', 'waterway_label'
      ];
      style.layers.forEach(l => {
        if (clutterPatterns.some(pat => l.id.includes(pat))) {
          map.setLayoutProperty(l.id, 'visibility', 'none');
        }
      });
    } catch (e) {}
  }

  function enhanceMapColors() {
    try {
      // 1. Soft Architectural Studio Slate-Teal Water (Calm, elegant diorama reflection)
      if (map.getLayer('water')) {
        map.setPaintProperty('water', 'fill-color', '#8BA8B7');
        map.setPaintProperty('water', 'fill-opacity', 0.82);
      }
      if (map.getLayer('waterway')) {
        map.setPaintProperty('waterway', 'line-color', '#7B9AA9');
      }

      // 2. Muted Studio Sage / Soft Foam Clay Nature & Parks (Architectural Model Flora)
      const parkColor = '#DCE4D5'; // Soft warm architectural sage
      ['park_national_park', 'park_nature_reserve', 'landcover', 'landuse'].forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'fill-color', parkColor);
          map.setPaintProperty(layerId, 'fill-opacity', 0.68);
        }
      });

      // 3. Architectural Chalk Sandstone Highway Fills (Muted warm sand, NOT electric orange!)
      const trunkRoads = ['road_trunk_fill_ramp', 'road_trunk_fill_noramp', 'road_mot_fill_ramp', 'road_mot_fill_noramp', 'bridge_trunk_fill', 'bridge_mot_fill'];
      trunkRoads.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'line-color', '#E8E2D5');
        }
      });
      const trunkCases = ['road_trunk_case_ramp', 'road_trunk_case_noramp', 'road_mot_case_ramp', 'road_mot_case_noramp'];
      trunkCases.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'line-color', '#DCD5C6');
        }
      });

      // 4. Subtle Alabaster Local Arteries & Secondary Roads
      const primaryRoads = ['road_pri_fill_ramp', 'road_pri_fill_noramp', 'road_sec_fill_noramp', 'bridge_pri_fill', 'bridge_sec_fill', 'road_minor_fill', 'road_service_fill'];
      primaryRoads.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'line-color', '#F5F2EB');
        }
      });
      const primaryCases = ['road_pri_case_ramp', 'road_pri_case_noramp', 'road_sec_case_noramp', 'road_minor_case', 'road_service_case'];
      primaryCases.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'line-color', '#E5E0D5');
        }
      });

      // 5. Warm Museum Diorama Pedestal Background (Nano Banana Alabaster)
      if (map.getLayer('background')) {
        map.setPaintProperty('background', 'background-color', '#FAF8F5');
      }
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════
  //  2. 3D WHITE-CLAY BUILDINGS EXTRUSION
  // ═══════════════════════════════════════════════════════════
  function add3DBuildings() {
    try {
      const layers = map.getStyle().layers;
      let firstSymbolId;
      for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === 'symbol') {
          firstSymbolId = layers[i].id;
          break;
        }
      }

      map.addLayer({
        id: '3d-clay-buildings',
        source: 'protomaps',
        'source-layer': 'buildings',
        type: 'fill-extrusion',
        minzoom: 12,
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['zoom'],
            12, '#FAF8F5',
            14, '#F5F2EB',
            16, '#EDE8DE'
          ],
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            12, 6,
            14, 20,
            16, 36
          ],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.82
        }
      }, firstSymbolId);
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════
  //  3. INFRASTRUCTURE: ELEVATED FLYOVERS, SUBTERRANEAN TUNNELS & PORTALS
  // ═══════════════════════════════════════════════════════════
  function renderViaductAndDualTracks() {
    if (!trackData) return;

    // ── 0. UNIFIED OVERVIEW CORRIDOR RIBBON (z < 13.5) ────────
    // Continuous 49.3 km route centerline for a flawless, glowing jewel-ribbon at overview zooms.
    // Zero seams, zero aliased sleepers, zero cluttered CAD borders.
    const continuousOverviewRoute = [
      ...trackData.flyoverNorthCenter,
      ...trackData.tunnelCenter,
      ...trackData.flyoverSouthCenter
    ];
    map.addSource('corridor-overview-centerline', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: { name: 'Delhi Metro Yellow Line Corridor' },
        geometry: {
          type: 'LineString',
          coordinates: continuousOverviewRoute
        }
      }
    });

    // 0a. Soft Amber Ambient Luminous Glow (z9 to z13.5)
    map.addLayer({
      id: 'overview-corridor-aura',
      type: 'line',
      source: 'corridor-overview-centerline',
      maxzoom: 13.5,
      paint: {
        'line-color': '#F59E0B',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 7.0, 11, 13.0, 13.5, 18.0],
        'line-opacity': 0.28,
        'line-blur': ['interpolate', ['linear'], ['zoom'], 9, 3, 11, 5, 13.5, 7]
      }
    });

    // 0b. Deep Obsidian Slate Contrast Casing (z9 to z13.5)
    map.addLayer({
      id: 'overview-corridor-casing',
      type: 'line',
      source: 'corridor-overview-centerline',
      maxzoom: 13.5,
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#0F172A',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3.6, 11, 5.8, 13.5, 8.8],
        'line-opacity': 0.95
      }
    });

    // 0c. Radiant DMRC Yellow Line Core (z9 to z13.5)
    map.addLayer({
      id: 'overview-corridor-core',
      type: 'line',
      source: 'corridor-overview-centerline',
      maxzoom: 13.5,
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#FBBF24',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.2, 11, 3.8, 13.5, 6.2],
        'line-opacity': 1.0
      }
    });

    // 0d. Polished Mirror Crown Light Sheen (z9 to z13.5)
    map.addLayer({
      id: 'overview-corridor-gleam',
      type: 'line',
      source: 'corridor-overview-centerline',
      maxzoom: 13.5,
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#FEF3C7',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 11, 1.1, 13.5, 1.6],
        'line-opacity': 0.90
      }
    });

    // ── A. GEOJSON SOURCES FOR CLOSE-UP 3D (z >= 13.5) ────────
    // 1. Flyover Viaduct Centers (North & South Elevated Sections)
    map.addSource('flyover-viaduct-center', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { section: 'north', name: 'North Elevated Flyover Viaduct (+15m)' },
            geometry: { type: 'LineString', coordinates: trackData.flyoverNorthCenter }
          },
          {
            type: 'Feature',
            properties: { section: 'south', name: 'South Elevated Flyover Viaduct (+15m)' },
            geometry: { type: 'LineString', coordinates: trackData.flyoverSouthCenter }
          }
        ]
      }
    });

    // 2. Central Subterranean Tube Tunnel Center (GTB Nagar -> Saket)
    map.addSource('tunnel-tube-center', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: { section: 'central', name: 'Central Subterranean Tube Tunnel (-16m to -30m)' },
        geometry: { type: 'LineString', coordinates: trackData.tunnelCenter }
      }
    });

    // 3. Flyover Tracks (North & South)
    map.addSource('flyover-tracks', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { line: 'down_north', dir: 'down' }, geometry: { type: 'LineString', coordinates: trackData.trackSouthFlyoverNorth } },
          { type: 'Feature', properties: { line: 'up_north', dir: 'up' }, geometry: { type: 'LineString', coordinates: trackData.trackNorthFlyoverNorth } },
          { type: 'Feature', properties: { line: 'down_south', dir: 'down' }, geometry: { type: 'LineString', coordinates: trackData.trackSouthFlyoverSouth } },
          { type: 'Feature', properties: { line: 'up_south', dir: 'up' }, geometry: { type: 'LineString', coordinates: trackData.trackNorthFlyoverSouth } }
        ]
      }
    });

    // 4. Central Tunnel Tracks (Subterranean Dual Tracks)
    map.addSource('tunnel-tracks', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { line: 'down_tunnel', dir: 'down' }, geometry: { type: 'LineString', coordinates: trackData.trackSouthTunnel } },
          { type: 'Feature', properties: { line: 'up_tunnel', dir: 'up' }, geometry: { type: 'LineString', coordinates: trackData.trackNorthTunnel } }
        ]
      }
    });

    // 5. Tunnel Portals & Transition Ramps
    if (trackData.tunnelPortals) {
      map.addSource('tunnel-portals', {
        type: 'geojson',
        data: trackData.tunnelPortals
      });
    }

    if (trackData.portalRamps) {
      map.addSource('portal-ramps', {
        type: 'geojson',
        data: trackData.portalRamps
      });
    }

    // ── HELPER: BUILD MULTI-TIER TRACK SYSTEM FOR CLOSE-UP 3D (z >= 13.5) ──
    function addTrackRailSystem(structureType, sourceId, dir, sign) {
      const isDown = sign < 0;
      const isTunnel = structureType === 'tunnel';
      const plinthColor = isTunnel ? '#0F172A' : '#1E293B';
      const sleeperColor = isTunnel ? '#64748B' : '#94A3B8';

      const plinthOffset = isDown
        ? ['interpolate', ['linear'], ['zoom'], 13.5, -3.2, 15, -2.0, 16, 0.0]
        : ['interpolate', ['linear'], ['zoom'], 13.5,  3.2, 15,  2.0, 16, 0.0];

      const leftRailOffset = isDown
        ? ['interpolate', ['linear'], ['zoom'], 13.5, -4.8, 15, -2.6, 17, -4.5]
        : ['interpolate', ['linear'], ['zoom'], 13.5,  2.4, 15, -2.6, 17, -4.5];

      const rightRailOffset = isDown
        ? ['interpolate', ['linear'], ['zoom'], 13.5, -2.4, 15,  2.6, 17,  4.5]
        : ['interpolate', ['linear'], ['zoom'], 13.5,  4.8, 15,  2.6, 17,  4.5];

      const thirdOffset = isDown
        ? ['interpolate', ['linear'], ['zoom'], 14, -0.4, 16, 5.8, 17, 8.2]
        : ['interpolate', ['linear'], ['zoom'], 14,  7.6, 16, 5.8, 17, 8.2];

      // 1. Detailed Ballastless Concrete Trackbed Plinth (z >= 13.5)
      map.addLayer({
        id: `${structureType}-track-${dir}-plinth`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 13.5,
        paint: {
          'line-offset': plinthOffset,
          'line-color': plinthColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 5.0, 15, 11.0, 17, 18.0],
          'line-opacity': 0.95
        }
      });

      // 2. Precast Concrete Transverse Sleepers (z >= 14.0)
      map.addLayer({
        id: `${structureType}-track-${dir}-sleepers`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 14.0,
        paint: {
          'line-offset': plinthOffset,
          'line-color': sleeperColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 14.0, 6.5, 15, 9.5, 17, 16.0],
          'line-dasharray': [0.18, 0.35],
          'line-opacity': 1.0
        }
      });

      // 3. Left Steel Rail - Base Shadow (z >= 14.0)
      map.addLayer({
        id: `${structureType}-track-${dir}-rail-left-base`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 14.0,
        paint: {
          'line-offset': leftRailOffset,
          'line-color': '#0F172A',
          'line-width': ['interpolate', ['linear'], ['zoom'], 14.0, 1.8, 15, 2.2, 17, 3.5],
          'line-opacity': 1.0
        }
      });

      // 4. Left Steel Rail - Gleaming Mirror Crown (z >= 14.0)
      map.addLayer({
        id: `${structureType}-track-${dir}-rail-left-head`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 14.0,
        paint: {
          'line-offset': leftRailOffset,
          'line-color': '#FFFFFF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 14.0, 1.1, 15, 1.4, 17, 2.2],
          'line-opacity': 1.0
        }
      });

      // 5. Right Steel Rail - Base Shadow (z >= 14.0)
      map.addLayer({
        id: `${structureType}-track-${dir}-rail-right-base`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 14.0,
        paint: {
          'line-offset': rightRailOffset,
          'line-color': '#0F172A',
          'line-width': ['interpolate', ['linear'], ['zoom'], 14.0, 1.8, 15, 2.2, 17, 3.5],
          'line-opacity': 1.0
        }
      });

      // 6. Right Steel Rail - Gleaming Mirror Crown (z >= 14.0)
      map.addLayer({
        id: `${structureType}-track-${dir}-rail-right-head`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 14.0,
        paint: {
          'line-offset': rightRailOffset,
          'line-color': '#FFFFFF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 14.0, 1.1, 15, 1.4, 17, 2.2],
          'line-opacity': 1.0
        }
      });

      // 7. Golden Power Conductor Rail / Third Rail (z >= 14.2)
      map.addLayer({
        id: `${structureType}-track-${dir}-third-rail`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 14.2,
        paint: {
          'line-offset': thirdOffset,
          'line-color': '#F59E0B',
          'line-width': ['interpolate', ['linear'], ['zoom'], 14.2, 1.2, 16, 1.8, 17, 2.5],
          'line-opacity': 0.95
        }
      });
    }

    // ── B. ELEVATED FLYOVER VIADUCT LAYERS (NORTH & SOUTH, z >= 13.5) ───
    // 1. Ambient Ground Drop Shadow (ONLY ON ELEVATED FLYOVERS!)
    map.addLayer({
      id: 'flyover-ground-shadow',
      type: 'line',
      source: 'flyover-viaduct-center',
      minzoom: 13.5,
      paint: {
        'line-color': '#0F172A',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 22, 15, 30, 17, 44],
        'line-opacity': 0.22,
        'line-blur': ['interpolate', ['linear'], ['zoom'], 13.5, 4, 17, 8],
        'line-offset': ['interpolate', ['linear'], ['zoom'], 13.5, 3, 17, 6]
      }
    });

    // 2. Concrete Parapet Guardrail Barriers (Bridge outer edges)
    map.addLayer({
      id: 'flyover-parapet-curb',
      type: 'line',
      source: 'flyover-viaduct-center',
      minzoom: 13.5,
      paint: {
        'line-color': '#64748B',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 20.0, 15, 28.0, 17, 40.0],
        'line-opacity': 0.95
      }
    });

    // 3. Precast Reinforced Concrete U-Girder Deck Slab (Pure clean white!)
    map.addLayer({
      id: 'flyover-deck-slab',
      type: 'line',
      source: 'flyover-viaduct-center',
      minzoom: 13.5,
      paint: {
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 17.0, 15, 25.0, 17, 36.0],
        'line-opacity': 0.98
      }
    });

    // 4. Center Median Structural Barrier
    map.addLayer({
      id: 'flyover-center-divider',
      type: 'line',
      source: 'flyover-viaduct-center',
      minzoom: 13.5,
      paint: {
        'line-color': '#CBD5E1',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 1.8, 15, 2.6, 17, 3.5],
        'line-opacity': 0.90
      }
    });

    // ── FLYOVER DUAL TRACKS (DOWN & UP) ──────────────────────
    addTrackRailSystem('flyover', 'flyover-tracks', 'down', -1);
    addTrackRailSystem('flyover', 'flyover-tracks', 'up', 1);

    // ══════════════════════════════════════════════════════════
    // ── C. SUBTERRANEAN TUBE TUNNEL INFRASTRUCTURE (z >= 13.5)
    // ══════════════════════════════════════════════════════════
    // Authentic underground subway bore through Old & New Delhi (NO surface drop shadow!)
    // 1. Excavation Casing (Deep architectural graphite slate - NOT a solid black bar!)
    map.addLayer({
      id: 'tunnel-tube-outer-casing',
      type: 'line',
      source: 'tunnel-tube-center',
      minzoom: 13.5,
      paint: {
        'line-color': '#1E293B',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 20.0, 15, 28.0, 17, 40.0],
        'line-opacity': 0.90
      }
    });

    // 2. Circular TBM Tube Chamber Bore
    map.addLayer({
      id: 'tunnel-tube-bore',
      type: 'line',
      source: 'tunnel-tube-center',
      minzoom: 13.5,
      paint: {
        'line-color': '#0F172A',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 17.0, 15, 25.0, 17, 36.0],
        'line-opacity': 0.98
      }
    });

    // 3. Subterranean Depth Ambient Base (Soft architectural concrete depth)
    map.addLayer({
      id: 'tunnel-interior-glow',
      type: 'line',
      source: 'tunnel-tube-center',
      minzoom: 13.5,
      paint: {
        'line-color': '#334155',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 8.0, 15, 12.0, 17, 16.0],
        'line-opacity': 0.22,
        'line-blur': 2
      }
    });

    // 4. Subterranean Center Divider
    map.addLayer({
      id: 'tunnel-center-divider',
      type: 'line',
      source: 'tunnel-tube-center',
      minzoom: 13.5,
      paint: {
        'line-color': '#334155',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 1.8, 15, 2.6, 17, 3.5],
        'line-opacity': 0.90
      }
    });

    // 5. Precast Segmented Concrete TBM Tunnel Rings (Ribbed Structure)
    map.addLayer({
      id: 'tunnel-tbm-rings',
      type: 'line',
      source: 'tunnel-tube-center',
      minzoom: 13.8,
      paint: {
        'line-color': '#334155',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13.8, 12, 15, 18, 17, 25],
        'line-dasharray': [0.25, 0.55],
        'line-opacity': 0.75
      }
    });

    // ── SUBTERRANEAN DUAL TRACKS (DOWN & UP) ─────────────────
    addTrackRailSystem('tunnel', 'tunnel-tracks', 'down', -1);
    addTrackRailSystem('tunnel', 'tunnel-tracks', 'up', 1);

    // ── D. TRANSITION PORTALS & CUTAWAY RAMPS ────────────────
    if (map.getSource('portal-ramps')) {
      // Precast concrete U-trough ramp retaining walls (Blends seamlessly into viaduct)
      map.addLayer({
        id: 'portal-ramps-casing',
        type: 'fill',
        source: 'portal-ramps',
        minzoom: 13.5,
        paint: {
          'fill-color': '#E2E8F0',
          'fill-opacity': 0.95,
          'fill-outline-color': '#94A3B8'
        }
      });

      // Smooth concrete ramp roadbed descending into earth
      map.addLayer({
        id: 'portal-ramps-bed',
        type: 'fill',
        source: 'portal-ramps',
        minzoom: 13.5,
        paint: {
          'fill-color': '#F1F5F9',
          'fill-opacity': 0.95
        }
      });
    }

    if (map.getSource('tunnel-portals')) {
      // High-visibility engineering portal beacons
      map.addLayer({
        id: 'portal-markers-outer',
        type: 'circle',
        source: 'tunnel-portals',
        minzoom: 13.8,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13.8, 5, 15, 8, 17, 10],
          'circle-color': '#E11D48',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#FFFFFF'
        }
      });

      map.addLayer({
        id: 'portal-labels',
        type: 'symbol',
        source: 'tunnel-portals',
        minzoom: 14.0,
        layout: {
          'text-field': [
            'case',
            ['==', ['get', 'id'], 'portal_north'], '🔻 NORTH PORTAL · Model Town ➔ GTB Nagar (-16m)',
            '🔺 SOUTH PORTAL · Saket ➔ Qutab Minar (+15m)'
          ],
          'text-font': ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Regular', 'Noto Sans CJK JP Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 11, 16, 12.5],
          'text-offset': [0, 1.8],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#BE123C',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 3.0
        }
      });
    }

    // ── E. TERMINAL CROSSOVER SWITCH TURNOUTS (z >= 14.0) ────
    map.addSource('terminal-crossovers', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'LineString', coordinates: trackData.crossoverNorth } },
          { type: 'Feature', geometry: { type: 'LineString', coordinates: trackData.crossoverSouth } }
        ]
      }
    });

    map.addLayer({
      id: 'crossover-track-plinth',
      type: 'line',
      source: 'terminal-crossovers',
      minzoom: 14.0,
      paint: {
        'line-color': '#1E293B',
        'line-width': ['interpolate', ['linear'], ['zoom'], 14, 6.0, 15, 9.0, 17, 15.0]
      }
    });

    map.addLayer({
      id: 'crossover-track-sleepers',
      type: 'line',
      source: 'terminal-crossovers',
      minzoom: 14.0,
      paint: {
        'line-color': '#94A3B8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 14, 5.5, 15, 8.0, 17, 13.0],
        'line-dasharray': [0.18, 0.35]
      }
    });

    map.addLayer({
      id: 'crossover-track-rails',
      type: 'line',
      source: 'terminal-crossovers',
      minzoom: 14.0,
      paint: {
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1.8, 15, 2.4, 17, 3.6]
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  4. RENDER PHYSICAL PLATFORMS, CANOPIES & UNDERGROUND CHAMBERS
  // ═══════════════════════════════════════════════════════════
  function renderPhysicalPlatforms() {
    if (!trackData) return;

    // 1. Platform Slabs (Reveals at z >= 13.5 close-up views)
    if (trackData.platformSlabs) {
      map.addSource('platform-slabs', {
        type: 'geojson',
        data: trackData.platformSlabs
      });

      // Ambient Ground Shadow ONLY for Elevated Stations (z >= 13.5)
      map.addLayer({
        id: 'platform-slab-shadow',
        type: 'fill',
        source: 'platform-slabs',
        filter: ['==', ['get', 'structure'], 'elevated'],
        minzoom: 13.5,
        paint: {
          'fill-color': '#0F172A',
          'fill-opacity': 0.18,
          'fill-translate': [2, 3]
        }
      });

      // Platform Raised Concrete Deck & Ground Concourse Piers (Elevated Stations, z >= 13.5)
      map.addLayer({
        id: 'platform-slab-deck-elevated',
        type: 'fill-extrusion',
        source: 'platform-slabs',
        filter: ['==', ['get', 'structure'], 'elevated'],
        minzoom: 13.5,
        paint: {
          'fill-extrusion-color': '#FFFFFF',
          'fill-extrusion-height': 15.0,
          'fill-extrusion-base': 0.0,
          'fill-extrusion-opacity': 0.98
        }
      });

      // Subterranean Station Floor Slab (Underground Stations, z >= 13.5)
      map.addLayer({
        id: 'platform-slab-deck-underground',
        type: 'fill',
        source: 'platform-slabs',
        filter: ['==', ['get', 'structure'], 'underground'],
        minzoom: 13.5,
        paint: {
          'fill-color': '#F8FAFC',
          'fill-outline-color': '#334155',
          'fill-opacity': 0.98
        }
      });
    }

    // 2. Subterranean Station Chamber Cutaway Boxes (Underground Stations, z >= 13.5)
    if (trackData.undergroundPlatforms) {
      map.addSource('underground-platforms', {
        type: 'geojson',
        data: trackData.undergroundPlatforms
      });

      // Architectural dark slate excavation chamber (Clean cutaway stone)
      map.addLayer({
        id: 'underground-chamber-casing',
        type: 'fill',
        source: 'underground-platforms',
        minzoom: 13.5,
        paint: {
          'fill-color': '#1E293B',
          'fill-outline-color': '#475569',
          'fill-opacity': 0.85
        }
      });

      // Subtle architectural concrete edge perimeter
      map.addLayer({
        id: 'underground-chamber-glow',
        type: 'line',
        source: 'underground-platforms',
        minzoom: 13.5,
        paint: {
          'line-color': '#64748B',
          'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 1.4, 15, 1.8, 17, 2.8],
          'line-opacity': 0.65
        }
      });

      // Surface Glass Entrance Pavilion at Street Level (+0m to +4.5m)
      map.addLayer({
        id: 'underground-portal-cubes',
        type: 'fill-extrusion',
        source: 'underground-platforms',
        minzoom: 13.8,
        paint: {
          'fill-extrusion-color': '#FFFFFF',
          'fill-extrusion-height': 4.5,
          'fill-extrusion-base': 0.0,
          'fill-extrusion-opacity': 0.82
        }
      });
    }

    // 3. Tactile Hazard Platform Edges (z >= 14.0)
    if (trackData.tactileEdges) {
      map.addSource('platform-tactile-edges', {
        type: 'geojson',
        data: trackData.tactileEdges
      });

      map.addLayer({
        id: 'platform-tactile-strips',
        type: 'line',
        source: 'platform-tactile-edges',
        minzoom: 14.0,
        paint: {
          'line-color': '#F59E0B',
          'line-width': ['interpolate', ['linear'], ['zoom'], 14, 4.5, 16, 7],
          'line-dasharray': [1, 0.4]
        }
      });
    }

    // 4. Modern Vaulted Arch Steel Canopy Roofs (ONLY on Elevated Stations, z >= 14.0)
    if (trackData.platformCanopies) {
      map.addSource('platform-canopies', {
        type: 'geojson',
        data: trackData.platformCanopies
      });

      map.addLayer({
        id: 'platform-canopy-3d',
        type: 'fill-extrusion',
        source: 'platform-canopies',
        minzoom: 14.0,
        paint: {
          'fill-extrusion-color': '#E2E8F0',
          'fill-extrusion-height': 24.0,
          'fill-extrusion-base': 15.0,
          'fill-extrusion-opacity': 0.88
        }
      });

      map.addLayer({
        id: 'platform-canopy-ridge',
        type: 'fill-extrusion',
        source: 'platform-canopies',
        minzoom: 14.0,
        paint: {
          'fill-extrusion-color': '#94A3B8',
          'fill-extrusion-height': 24.8,
          'fill-extrusion-base': 23.8,
          'fill-extrusion-opacity': 0.95
        }
      });
    }

    // 5. Station Architectural Nodes & Typography
    if (trackData.stations) {
      map.addSource('stations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: trackData.stations.map((s, idx) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: s.coordinates || s.coords },
            properties: {
              id: s.id,
              name: s.name,
              major: s.major,
              terminus: s.terminus,
              structure: s.structure,
              elevM: s.elevM,
              elevText: s.structure === 'elevated' ? `+${s.elevM}m Viaduct` : `${s.elevM}m Tube`,
              index: idx
            }
          }))
        }
      });

      // 5a. Clean Modern Transit Station Nodes (Major Transfer Hubs)
      map.addLayer({
        id: 'station-nodes-major',
        type: 'circle',
        source: 'stations',
        filter: ['get', 'major'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3.8, 11, 5.2, 14, 7.5],
          'circle-color': '#FFFFFF',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 2.0, 11, 2.4, 14, 3.2],
          'circle-stroke-color': '#0F172A'
        }
      });

      // Inner DMRC Golden Yellow Core Pupil
      map.addLayer({
        id: 'station-nodes-major-pupil',
        type: 'circle',
        source: 'stations',
        filter: ['get', 'major'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 1.4, 11, 2.2, 14, 3.2],
          'circle-color': '#F59E0B'
        }
      });

      // 5b. Local Station Minimalist Dots (Reveals as user zooms past z11.2)
      map.addLayer({
        id: 'station-nodes-local',
        type: 'circle',
        source: 'stations',
        filter: ['!', ['get', 'major']],
        minzoom: 11.2,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11.2, 1.8, 13, 2.6, 15, 4.2],
          'circle-color': '#FFFFFF',
          'circle-stroke-width': 1.2,
          'circle-stroke-color': '#475569'
        }
      });

      // 5c. Major Station Names (Clean typography, no cluttered -18m Tube badges at overview!)
      map.addLayer({
        id: 'station-labels-major',
        type: 'symbol',
        source: 'stations',
        filter: ['get', 'major'],
        minzoom: 10.2,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Regular', 'Noto Sans CJK JP Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10.5, 12, 11.5, 14, 13.0],
          'text-offset': [0, 1.4],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#0F172A',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 3.0
        }
      });

      // 5d. Local Station Names (Reveals cleanly when zoomed into neighborhood)
      map.addLayer({
        id: 'station-labels-local',
        type: 'symbol',
        source: 'stations',
        filter: ['!', ['get', 'major']],
        minzoom: 12.8,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Montserrat Medium', 'Open Sans Regular', 'Noto Sans Regular', 'Noto Sans CJK JP Regular'],
          'text-size': 10,
          'text-offset': [0, 1.3],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#475569',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 2.2
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  5. 3D ARCHITECTURAL LANDMARKS (SIGNATURE HUBS ON MAP)
  // ═══════════════════════════════════════════════════════════
  const SIGNATURE_LANDMARKS = [
    {
      id: 'qutab_minar',
      name: 'Qutab Minar',
      badge: '🏛️ Qutab Minar · Elevated +15m',
      coords: [77.1793, 28.5132],
      img: '/public/dmrc_elevated_viaduct_diorama.png',
      index: 28
    },
    {
      id: 'saket',
      name: 'Saket Portal',
      badge: '🚇 Saket · Subterranean Portal',
      coords: [77.1994, 28.5204],
      img: '/public/dmrc_underground_tube_diorama.png',
      index: 26
    },
    {
      id: 'rajiv_chowk',
      name: 'Rajiv Chowk',
      badge: '🏛️ Rajiv Chowk · Intermodal Tube',
      coords: [77.2196, 28.6329],
      img: '/public/dmrc_underground_tube_diorama.png',
      index: 15
    },
    {
      id: 'kashmere_gate',
      name: 'Kashmere Gate',
      badge: '🏛️ Kashmere Gate · Triple Interchange',
      coords: [77.2282, 28.6675],
      img: '/public/dmrc_underground_tube_diorama.png',
      index: 11
    },
    {
      id: 'hauz_khas',
      name: 'Hauz Khas',
      badge: '🚇 Hauz Khas · Deep Tube (-29m)',
      coords: [77.2067, 28.5443],
      img: '/public/dmrc_underground_tube_diorama.png',
      index: 24
    },
    {
      id: 'millennium',
      name: 'Millennium City Centre',
      badge: '🏛️ Millennium City Centre · Elevated Terminus',
      coords: [77.0725, 28.4594],
      img: '/public/dmrc_elevated_viaduct_diorama.png',
      index: 36
    }
  ];

  let landmarkMarkers = [];

  function add3DStationLandmarks() {
    // Clean map view: remove heavy floating image cards from map view so rails,
    // physical 3D station slabs, and moving trains remain crisp and unoccluded.
    landmarkMarkers.forEach(m => m.remove());
    landmarkMarkers = [];
  }

  function updateMarkerScale() {
    if (!map) return;
    const z = map.getZoom();
    const scale = Math.max(0.25, Math.min(1.05, Math.pow(2, z - 15.0)));
    const markers = document.querySelectorAll('.landmark-3d-container');
    markers.forEach(el => {
      if (z < 11.8) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.style.transform = 'scale(0.5)';
      } else {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.style.transform = 'scale(1)';
        el.style.setProperty('--marker-scale', scale.toFixed(3));
        const badge = el.querySelector('.landmark-badge');
        if (badge) {
          badge.style.display = z >= 12.6 ? 'flex' : 'none';
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  6. TRAINS LAYERS (VIBRANT 3D RUNNING FLEET AT 60 FPS)
  // ═══════════════════════════════════════════════════════════
  function renderTrainsLayers() {
    map.addSource('active-trains', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    // ── Layer A: Train Ground Drop Shadow (Close-up 3D only, z >= 13.2) ──
    map.addLayer({
      id: 'train-drop-shadow',
      type: 'circle',
      source: 'active-trains',
      minzoom: 13.2,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13.2, 7.0, 15, 11.0, 17, 16.0],
        'circle-color': '#0F172A',
        'circle-opacity': [
          'case',
          ['==', ['get', 'structure'], 'underground'], 0.0,
          0.26
        ],
        'circle-blur': 0.7,
        'circle-translate': [2, 4]
      }
    });

    // ── Layer B: Real 3D Delhi Metro Train Consist (Close-up 3D only, z >= 13.2) ──
    map.addLayer({
      id: 'train-consist-3d',
      type: 'symbol',
      source: 'active-trains',
      minzoom: 13.2,
      layout: {
        'icon-image': 'delhi-metro-consist',
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          13.2, 0.70,
          15, 1.05,
          17, 1.65
        ],
        'visibility': 'visible'
      }
    });

    // ── Layer C: Overview Radar Dots (Sleek transit capsule, z < 13.5) ──
    map.addLayer({
      id: 'train-dot-white-black',
      type: 'circle',
      source: 'active-trains',
      maxzoom: 13.5,
      layout: {
        'visibility': 'visible'
      },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3.4, 11, 4.4, 13, 5.8],
        'circle-color': ['case', ['==', ['get', 'speedKph'], 0], '#EF4444', '#FFFFFF'],
        'circle-stroke-width': ['case', ['==', ['get', 'speedKph'], 0], 2.5, 2.0],
        'circle-stroke-color': ['case', ['==', ['get', 'speedKph'], 0], '#991B1B', '#0F172A'],
        'circle-opacity': 1.0
      }
    });

    // Inner DMRC Golden Yellow Core Pupil (z < 13.5)
    map.addLayer({
      id: 'train-dot-pupil',
      type: 'circle',
      source: 'active-trains',
      maxzoom: 13.5,
      layout: {
        'visibility': 'visible'
      },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 1.4, 11, 2.0, 13, 2.8],
        'circle-color': '#F59E0B',
        'circle-opacity': 1.0
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  7. CLIENT-SIDE SYMMETRIC TRIP SIMULATION ENGINE (100% FRONTEND)
  // ═══════════════════════════════════════════════════════════
  function startClientSimulationTicker() {
    function tick() {
      const nowPerf = performance.now();
      const dt = Math.min(1.0, (nowPerf - lastSimulationTick) / 1000);
      lastSimulationTick = nowPerf;

      let sec = 0;
      let dayVariant = 'weekday';
      let timeStr = '';

      if (timeMode === 'live') {
        const now = new Date(Date.now() + (window.CLOCK_SKEW_MS || 0));
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const ist = new Date(utc + 5.5 * 3600000);
        sec = ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds();
        const d = ist.getDay();
        dayVariant = (d === 0) ? 'sunday' : (d === 6 ? 'saturday' : 'weekday');
        timeStr = `${String(ist.getHours()).padStart(2, '0')}:${String(ist.getMinutes()).padStart(2, '0')}:${String(ist.getSeconds()).padStart(2, '0')} IST`;
      } else {
        customTimeSeconds = (customTimeSeconds + dt * simSpeed) % 86400;
        sec = Math.floor(customTimeSeconds);
        dayVariant = 'weekday';
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} IST (${simSpeed}x)`;
      }

      if (!window.TripEngine) return;

      const { trains, schedule } = TripEngine.getActiveFleet(sec, dayVariant);
      const incoming = trains || [];
      const now = performance.now();

      packetInterval = 100;
      lastPacketTime = now;

      const countEl = document.getElementById('fleet-count');
      if (countEl) countEl.textContent = `${incoming.length} Trains (${schedule.phase || 'ACTIVE'})`;

      const clockEl = document.getElementById('live-clock-text');
      if (clockEl) clockEl.textContent = timeStr;

      const modeBtn = document.getElementById('btn-toggle-time-mode');
      if (modeBtn) {
        modeBtn.textContent = timeMode === 'live' ? '⏱️ Current IST' : '⏱️ Custom Scrub';
        modeBtn.style.background = timeMode === 'live' ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.4)';
      }

      if (schedule.phase) {
        const phaseTitle = document.getElementById('phase-title');
        const phaseDetail = document.getElementById('phase-detail');
        const phaseIcon = document.getElementById('phase-icon');

        if (phaseTitle) phaseTitle.textContent = schedule.phase.replace(/_/g, ' ');
        if (phaseDetail) phaseDetail.textContent = schedule.message || '';

        if (schedule.phase === 'SERVICE_CLOSED') {
          if (phaseIcon) phaseIcon.textContent = '🛑';
        } else if (schedule.phase === 'FIRST_TRAINS') {
          if (phaseIcon) phaseIcon.textContent = '🌅';
        } else if (schedule.phase.includes('PEAK')) {
          if (phaseIcon) phaseIcon.textContent = '🏢';
        } else if (schedule.phase === 'LAST_TRAINS') {
          if (phaseIcon) phaseIcon.textContent = '🌙';
        } else {
          if (phaseIcon) phaseIcon.textContent = '🟢';
        }
      }

      // Night Maintenance Banner
      const nightBanner = document.getElementById('night-maintenance-banner');
      if (nightBanner) {
        if (schedule.phase === 'SERVICE_CLOSED') {
          nightBanner.classList.remove('hidden');
        } else {
          nightBanner.classList.add('hidden');
        }
      }

      // Sync slider when not dragging
      if (!isDraggingSlider) {
        const slider = document.getElementById('timeline-slider');
        if (slider) slider.value = sec;
        const label = document.getElementById('timeline-current-label');
        if (label) {
          const h = Math.floor(sec / 3600);
          const m = Math.floor((sec % 3600) / 60);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 || 12;
          label.textContent = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
        }
      }

      // Clean up old trains not active anymore
      const activeIds = new Set(incoming.map(t => t.id));
      for (const id of trainTargetStates.keys()) {
        if (!activeIds.has(id)) {
          trainTargetStates.delete(id);
          trainPrevStates.delete(id);
        }
      }

      incoming.forEach(t => {
        const prev = trainTargetStates.get(t.id) || { coords: t.coords, bearing: t.bearing, time: now };
        trainPrevStates.set(t.id, prev);
        trainTargetStates.set(t.id, { coords: t.coords, bearing: t.bearing, time: now, data: t });
      });

      activeTrains = incoming;

      if (incoming.length === 0) {
        const card = document.getElementById('inspector-card');
        if (card) card.classList.add('hidden');
        selectedTrainId = null;
      } else if (selectedTrainId) {
        const t = activeTrains.find(x => x.id === selectedTrainId);
        if (t) updateCalloutCard(t);
      }

      updateCutawayPlatformETAs(sec, dayVariant);
      if (activeStationIndex !== null) {
        renderStationPanel(activeStationIndex, sec, dayVariant);
      }
    }

    lastSimulationTick = performance.now();
    setInterval(tick, 100); // 10 Hz simulation step
  }

  // ═══════════════════════════════════════════════════════════
  //  8. 60 FPS INTERPOLATION LOOP (Silky-Smooth Movement & Rotation)
  // ═══════════════════════════════════════════════════════════
  function startAnimationLoop() {
    function animate() {
      if (map && map.getSource('active-trains') && trainTargetStates.size > 0) {
        const now = performance.now();
        const features = [];

        trainTargetStates.forEach((target, id) => {
          const prev = trainPrevStates.get(id) || target;
          const elapsed = now - target.time;
          const factor = Math.min(1.0, Math.max(0.0, elapsed / packetInterval));

          let curLng = prev.coords[0] + (target.coords[0] - prev.coords[0]) * factor;
          let curLat = prev.coords[1] + (target.coords[1] - prev.coords[1]) * factor;

          const prevB = prev.bearing !== undefined ? prev.bearing : target.bearing;
          let dAngle = (target.bearing - prevB) % 360;
          if (dAngle > 180) dAngle -= 360;
          if (dAngle < -180) dAngle += 360;
          const curBearing = Math.round((prevB + dAngle * factor + 360) % 360);

          // Dynamic screen-pixel normal offset at overview zooms (< 14.5)
          // Ensures train dots sit perfectly centered on their visually offset tracks!
          const currentZoom = map.getZoom();
          if (currentZoom < 14.5) {
            const visualOffsetPx = Math.max(0, (14.5 - currentZoom) * 0.92);
            if (visualOffsetPx > 0) {
              const metersPerPixel = 156543.03392 * Math.cos(curLat * Math.PI / 180) / Math.pow(2, currentZoom);
              const offsetDegLng = (visualOffsetPx * metersPerPixel) / (111320 * Math.cos(curLat * Math.PI / 180));
              const offsetDegLat = (visualOffsetPx * metersPerPixel) / 111320;

              const rad = (curBearing || 0) * Math.PI / 180;
              curLng += -Math.cos(rad) * offsetDegLng;
              curLat += Math.sin(rad) * offsetDegLat;
            }
          }

          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [curLng, curLat] },
            properties: {
              id: id,
              bearing: curBearing,
              track: target.data.track,
              directionLabel: target.data.directionLabel,
              fromStation: target.data.fromStation,
              toStation: target.data.toStation,
              speedKph: target.data.speedKph,
              state: target.data.state,
              stateLabel: target.data.stateLabel,
              dwellRemaining: target.data.dwellRemaining,
              dwellTotal: target.data.dwellTotal,
              isExtendedDwell: target.data.isExtendedDwell,
              dwellReason: target.data.dwellReason,
              currentStation: target.data.currentStation,
              structure: target.data.structure || 'elevated',
              elevM: target.data.elevM || 15,
              elevLabel: target.data.elevLabel || 'Elevated Viaduct (+15m)'
            }
          });

          if (followTrainId === id) {
            map.setCenter([curLng, curLat]);
          }
        });

        map.getSource('active-trains').setData({
          type: 'FeatureCollection',
          features: features
        });
      }

      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  // ═══════════════════════════════════════════════════════════
  //  9. MASTER TRANSIT SURFACE SWITCHER
  // ═══════════════════════════════════════════════════════════
  function setupMasterNavigation() {
    const tabs = document.querySelectorAll('.mode-tab');
    const mapSurface = document.getElementById('map');
    const cutawaySurface = document.getElementById('cutaway-fullscreen-view');
    const threeSurface = document.getElementById('three-container');
    const heroCard = document.querySelector('.diorama-hero-card');
    const controlCluster = document.querySelector('.control-cluster');
    const legendStrip = document.querySelector('.bottom-legend-strip');
    const timetableDock = document.querySelector('.timetable-dock');
    const lineStatusPill = document.getElementById('line-status-pill');

    window.switchSurface = function (surfaceName, optArchetype) {
      tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-surface') === surfaceName));

      if (surfaceName === 'corridor') {
        mapSurface.classList.remove('hidden');
        cutawaySurface.classList.add('hidden');
        if (threeSurface) threeSurface.classList.add('hidden');
        if (heroCard) heroCard.style.display = 'flex';
        if (controlCluster) controlCluster.style.display = 'flex';
        if (legendStrip) legendStrip.style.display = 'flex';
        if (timetableDock) timetableDock.style.display = 'flex';
        if (lineStatusPill) lineStatusPill.style.display = 'flex';
        if (window.Diorama3D) window.Diorama3D.stop();
        // Resize MapLibre so canvas dimensions match unhidden viewport smoothly
        requestAnimationFrame(() => {
          if (map) map.resize();
        });
      } else if (surfaceName === 'cutaway') {
        cutawaySurface.classList.remove('hidden');
        mapSurface.classList.add('hidden');
        if (threeSurface) threeSurface.classList.add('hidden');
        if (heroCard) heroCard.style.display = 'none';
        if (controlCluster) controlCluster.style.display = 'none';
        if (legendStrip) legendStrip.style.display = 'none';
        if (timetableDock) timetableDock.style.display = 'none';
        if (lineStatusPill) lineStatusPill.style.display = 'none';
        if (window.Diorama3D) window.Diorama3D.stop();
      } else if (surfaceName === 'threejs') {
        if (threeSurface) threeSurface.classList.remove('hidden');
        mapSurface.classList.add('hidden');
        cutawaySurface.classList.add('hidden');
        if (heroCard) heroCard.style.display = 'none';
        if (controlCluster) controlCluster.style.display = 'none';
        if (legendStrip) legendStrip.style.display = 'none';
        if (timetableDock) timetableDock.style.display = 'none';
        if (lineStatusPill) lineStatusPill.style.display = 'none';
        const stPanel = document.getElementById('station-panel');
        if (stPanel) stPanel.classList.add('hidden');
        const inspCard = document.getElementById('inspector-card');
        if (inspCard) inspCard.classList.add('hidden');
        if (window.Diorama3D && threeSurface) {
          window.Diorama3D.init(threeSurface);
          if (optArchetype) {
            window.Diorama3D.setArchetype(optArchetype);
          }
          window.Diorama3D.start();
        }
      }
    };

    tabs.forEach(t => {
      t.addEventListener('click', () => {
        window.switchSurface(t.getAttribute('data-surface'));
      });
    });

    const urlParams = new URLSearchParams(window.location.search);
    const initialSurface = urlParams.get('surface') || 'corridor';
    window.switchSurface(initialSurface);

    // Central Line Cutaway Station Switcher & Jump to Radar
    let activeCutawayKey = 'rajiv';
    const STATION_METADATA = {
      'rajiv': {
        title: 'Rajiv Chowk Intermodal Terminal',
        sub: 'Architectural 3D Cutaway Pedestal · Cutaway Tunnel Tubes & Island Platform (Yellow & Blue Line)',
        image: '/public/dmrc_underground_tube_diorama.png',
        type: 'Underground Tube (Cutaway)',
        firstLast: '05:29 AM – 23:47 PM',
        gates: 'Gate 1 & Gate 2 (♿ Divyang)',
        phone: '011-23417910',
        leftAnnot: 'Platform 1 · Towards Millennium',
        rightAnnot: 'Platform 2 · Towards Badli',
        fleetAnnot: '8-Car Wide-Body Consist',
        coords: [77.2196, 28.6329],
        zoom: 15.6
      },
      'kashmere': {
        title: 'Kashmere Gate Multimodal Hub',
        sub: 'Architectural 3D Cutaway Pedestal · Red, Yellow & Violet Line Triple Interchange Station',
        image: '/public/dmrc_underground_tube_diorama.png',
        type: 'Underground Multi-Level Tube',
        firstLast: '05:25 AM – 23:55 PM',
        gates: 'Gate 1, 2 & 5 (♿ Divyang Ramp)',
        phone: '011-23860012',
        leftAnnot: 'Platform 3 · Towards Millennium',
        rightAnnot: 'Platform 4 · Towards Badli',
        fleetAnnot: 'Triple Interchange Junction',
        coords: [77.2282, 28.6675],
        zoom: 15.6
      },
      'hauzkhas': {
        title: 'Hauz Khas Deep Junction',
        sub: 'Architectural 3D Cutaway Pedestal · 29m Deep Underground Tube Station (Yellow & Magenta Line)',
        image: '/public/dmrc_underground_tube_diorama.png',
        type: 'Subterranean Deep Tube (-29m)',
        firstLast: '05:38 AM – 23:42 PM',
        gates: 'Gate 2 & Gate 4 (♿ Accessible)',
        phone: '011-26511234',
        leftAnnot: 'Platform 1 · Towards Millennium',
        rightAnnot: 'Platform 2 · Towards Badli',
        fleetAnnot: '29m Subterranean Bore',
        coords: [77.2067, 28.5443],
        zoom: 15.6
      },
      'millennium': {
        title: 'Millennium City Centre (Cyber Hub)',
        sub: 'Architectural 3D Cutaway Pedestal · Elevated Viaduct Deck, Steel Arch Canopy & Rapid Metro Terminus',
        image: '/public/dmrc_elevated_viaduct_diorama.png',
        type: 'Elevated Viaduct (+15m)',
        firstLast: '05:50 AM – 23:05 PM',
        gates: 'Gate 1, 2 & 4 (♿ Elevator Access)',
        phone: '0124-2804567',
        leftAnnot: 'Platform 1 · Southbound Terminal',
        rightAnnot: 'Platform 2 · Turnaround Siding',
        fleetAnnot: 'Viaduct Piers & Arched Canopy',
        coords: [77.0725, 28.4594],
        zoom: 15.4
      }
    };

    document.querySelectorAll('.station-switch-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.station-switch-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const st = b.getAttribute('data-st');
        activeCutawayKey = st;
        const meta = STATION_METADATA[st];
        if (meta) {
          const titleEl = document.getElementById('cutaway-main-station-title');
          if (titleEl) titleEl.textContent = meta.title;
          const subEl = document.getElementById('cutaway-main-station-sub') || document.querySelector('.cutaway-spotlight-sub');
          if (subEl) subEl.textContent = meta.sub;
          const typeBadge = document.getElementById('cutaway-station-type-badge');
          if (typeBadge) typeBadge.textContent = meta.type;
          
          const flEl = document.getElementById('meta-first-last-val');
          if (flEl && meta.firstLast) flEl.textContent = meta.firstLast;
          const gatesEl = document.getElementById('meta-gates-val');
          if (gatesEl && meta.gates) gatesEl.textContent = meta.gates;
          const phoneEl = document.getElementById('meta-phone-link');
          if (phoneEl && meta.phone) {
            phoneEl.textContent = '📞 ' + meta.phone;
            phoneEl.href = 'tel:' + meta.phone.replace(/[^0-9]/g, '');
          }

          const al = document.getElementById('annot-left-text');
          if (al && meta.leftAnnot) al.textContent = meta.leftAnnot;
          const ar = document.getElementById('annot-right-text');
          if (ar && meta.rightAnnot) ar.textContent = meta.rightAnnot;
          const af = document.getElementById('annot-fleet-text');
          if (af && meta.fleetAnnot) af.textContent = meta.fleetAnnot;

          const imgEl = document.getElementById('cutaway-img-element') || document.querySelector('.cutaway-centerpiece-img');
          if (imgEl && meta.image && imgEl.src !== meta.image) {
            imgEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            imgEl.style.opacity = '0.3';
            imgEl.style.transform = 'scale(0.98)';
            setTimeout(() => {
              imgEl.src = meta.image;
              imgEl.style.opacity = '1';
              imgEl.style.transform = 'scale(1)';
            }, 150);
          }
        }
      });
    });

    // Interactive 3D Mouse Parallax Tilt on Pedestal Stage
    const cutawayStage = document.querySelector('.cutaway-render-stage');
    const cutawayImg = document.getElementById('cutaway-img-element');
    if (cutawayStage && cutawayImg) {
      cutawayStage.addEventListener('mousemove', (e) => {
        const rect = cutawayStage.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width - 0.5;
        const normY = (e.clientY - rect.top) / rect.height - 0.5;
        cutawayImg.style.transform = `perspective(1000px) rotateY(${normX * 12}deg) rotateX(${-normY * 12}deg) scale(1.02)`;
      });
      cutawayStage.addEventListener('mouseleave', () => {
        cutawayImg.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) scale(1)';
      });
    }

    const jumpBtn = document.getElementById('btn-jump-radar-from-cutaway');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', () => {
        const meta = STATION_METADATA[activeCutawayKey] || STATION_METADATA['rajiv'];
        window.switchSurface('corridor');
        if (map) {
          map.easeTo({
            center: meta.coords,
            zoom: meta.zoom,
            pitch: 48,
            bearing: -14,
            duration: 1200
          });
        }
      });
    }
  }

  function updateCutawayPlatformETAs(secOfDay, dayVariant) {
    const p1 = document.getElementById('cutaway-p1-time');
    const p2 = document.getElementById('cutaway-p2-time');
    if (!p1 || !p2 || !currentCutawayStation) return;

    const meta = STATION_DETAILS[currentCutawayStation];
    const stIdx = meta ? meta.index : 15; // default Rajiv Chowk (15)

    if (window.TripEngine) {
      const eta1 = TripEngine.getStationNextArrival(stIdx, 'south', secOfDay, dayVariant);
      const eta2 = TripEngine.getStationNextArrival(stIdx, 'north', secOfDay, dayVariant);
      p1.textContent = eta1 ? eta1.text : 'Scheduled';
      p2.textContent = eta2 ? eta2.text : 'Scheduled';
    }
  }

  function startClockTicker() {
    function tick() {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      // Update any live clocks
    }
    tick();
    setInterval(tick, 1000);
  }

  // ═══════════════════════════════════════════════════════════
  //  10. CAMERA PERSPECTIVES & USER INTERACTION
  // ═══════════════════════════════════════════════════════════
  function setupControls() {
    // 3D Diorama vs 2D Plan
    const btn3D = document.getElementById('btn-3d-view');
    const btn2D = document.getElementById('btn-2d-view');

    btn3D.addEventListener('click', () => {
      btn3D.classList.add('active');
      btn2D.classList.remove('active');
      map.easeTo({ pitch: 48, bearing: -14, duration: 900 });
    });

    btn2D.addEventListener('click', () => {
      btn2D.classList.add('active');
      btn3D.classList.remove('active');
      map.easeTo({ pitch: 0, bearing: 0, duration: 900 });
    });

    // Vehicle Render Mode: 3D Trains vs Radar Dots vs Rails Only
    const mode3D = document.getElementById('mode-3d');
    const modeDot = document.getElementById('mode-dot');
    const modeTracks = document.getElementById('mode-tracks');

    function applyRenderMode(mode) {
      renderMode = mode;
      [mode3D, modeDot, modeTracks].forEach(btn => {
        if (btn) btn.classList.toggle('active', btn.id === `mode-${mode}`);
      });
      if (!map) return;
      if (mode === '3d') {
        if (map.getLayer('train-consist-3d')) map.setLayoutProperty('train-consist-3d', 'visibility', 'visible');
        if (map.getLayer('train-dot-white-black')) {
          map.setLayoutProperty('train-dot-white-black', 'visibility', 'visible');
          map.setPaintProperty('train-dot-white-black', 'circle-opacity', [
            'interpolate', ['linear'], ['zoom'],
            11.0, 1.0,
            12.8, 0.0
          ]);
        }
        if (map.getLayer('train-dot-pupil')) {
          map.setLayoutProperty('train-dot-pupil', 'visibility', 'visible');
          map.setPaintProperty('train-dot-pupil', 'circle-opacity', [
            'interpolate', ['linear'], ['zoom'],
            11.0, 1.0,
            12.8, 0.0
          ]);
        }
        if (map.getLayer('train-drop-shadow')) map.setLayoutProperty('train-drop-shadow', 'visibility', 'visible');
      } else if (mode === 'dot') {
        if (map.getLayer('train-consist-3d')) map.setLayoutProperty('train-consist-3d', 'visibility', 'none');
        if (map.getLayer('train-dot-white-black')) {
          map.setLayoutProperty('train-dot-white-black', 'visibility', 'visible');
          map.setPaintProperty('train-dot-white-black', 'circle-opacity', 1.0);
        }
        if (map.getLayer('train-dot-pupil')) {
          map.setLayoutProperty('train-dot-pupil', 'visibility', 'visible');
          map.setPaintProperty('train-dot-pupil', 'circle-opacity', 1.0);
        }
        if (map.getLayer('train-drop-shadow')) map.setLayoutProperty('train-drop-shadow', 'visibility', 'visible');
      } else if (mode === 'tracks') {
        if (map.getLayer('train-consist-3d')) map.setLayoutProperty('train-consist-3d', 'visibility', 'none');
        if (map.getLayer('train-dot-white-black')) map.setLayoutProperty('train-dot-white-black', 'visibility', 'none');
        if (map.getLayer('train-dot-pupil')) map.setLayoutProperty('train-dot-pupil', 'visibility', 'none');
        if (map.getLayer('train-drop-shadow')) map.setLayoutProperty('train-drop-shadow', 'visibility', 'none');
      }
    }

    if (mode3D) mode3D.addEventListener('click', () => applyRenderMode('3d'));
    if (modeDot) modeDot.addEventListener('click', () => applyRenderMode('dot'));
    if (modeTracks) modeTracks.addEventListener('click', () => applyRenderMode('tracks'));

    // Speed Multipliers (Pure Client-Side)
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const spd = parseFloat(btn.getAttribute('data-speed')) || 1.0;
        simSpeed = spd;
        timeMode = 'custom';
      });
    });

    // Quick Bookmarks
    document.querySelectorAll('.bookmark-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bookmark-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const loc = btn.getAttribute('data-loc');
        followTrainId = null;

        if (loc === 'qutab') {
          map.flyTo({ center: [77.1793, 28.5132], zoom: 15.6, pitch: 52, bearing: -14, duration: 1100 });
        } else if (loc === 'rajiv') {
          map.flyTo({ center: [77.2196, 28.6329], zoom: 15.2, pitch: 50, bearing: -14, duration: 1100 });
        } else if (loc === 'kashmere') {
          map.flyTo({ center: [77.2282, 28.6675], zoom: 15.2, pitch: 50, bearing: -14, duration: 1100 });
        } else if (loc === 'hauzkhas') {
          map.flyTo({ center: [77.2067, 28.5443], zoom: 15.2, pitch: 50, bearing: -14, duration: 1100 });
        } else if (loc === 'gurgaon') {
          map.flyTo({ center: [77.0725, 28.4594], zoom: 15.0, pitch: 50, bearing: -14, duration: 1100 });
        } else if (loc === 'centralsec') {
          map.flyTo({ center: [77.2120, 28.6150], zoom: 15.2, pitch: 50, bearing: -14, duration: 1200 });
        } else if (loc === 'all') {
          map.flyTo({ center: [77.1400, 28.5850], zoom: 10.35, pitch: 0, bearing: 0, duration: 1200 });
          const btn2D = document.getElementById('btn-2d-view');
          const btn3D = document.getElementById('btn-3d-view');
          if (btn2D && btn3D) {
            btn2D.classList.add('active');
            btn3D.classList.remove('active');
          }
        }
      });
    });

    // Hero Card Collapse / Expand Toggle
    const heroCollapseBtn = document.getElementById('hero-collapse-btn');
    const heroCardEl = document.getElementById('diorama-hero-card');
    if (heroCollapseBtn && heroCardEl) {
      heroCollapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        heroCardEl.classList.toggle('collapsed');
        heroCollapseBtn.textContent = heroCardEl.classList.contains('collapsed') ? '+' : '—';
      });
    }

    // Follow train button
    const followBtn = document.getElementById('btn-follow-train');
    if (followBtn) {
      followBtn.addEventListener('click', () => {
        if (selectedTrainId) {
          followTrainId = selectedTrainId;
          followBtn.textContent = 'Tracking Active 🟢';
        }
      });
    }

    // Close Inspector
    document.getElementById('close-inspector').addEventListener('click', () => {
      document.getElementById('inspector-card').classList.add('hidden');
      selectedTrainId = null;
      followTrainId = null;
    });

    // Close Station Panel
    const closeStationBtn = document.getElementById('close-station-panel');
    if (closeStationBtn) {
      closeStationBtn.addEventListener('click', () => {
        document.getElementById('station-panel').classList.add('hidden');
        activeStationIndex = null;
      });
    }

    // 24-Hour Timeline Scrubbing
    const timelineSlider = document.getElementById('timeline-slider');
    const timelineLabel = document.getElementById('timeline-current-label');

    if (timelineSlider) {
      timelineSlider.addEventListener('input', () => {
        isDraggingSlider = true;
        const sec = parseInt(timelineSlider.value, 10);
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        if (timelineLabel) timelineLabel.textContent = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
      });

      timelineSlider.addEventListener('change', () => {
        isDraggingSlider = false;
        const sec = parseInt(timelineSlider.value, 10);
        customTimeSeconds = sec;
        timeMode = 'custom';
        document.querySelectorAll('.time-preset-chip').forEach(c => c.classList.remove('active'));
      });
    }

    // Toggle between Live IST Clock & Custom Scrub Mode
    const toggleTimeModeBtn = document.getElementById('btn-toggle-time-mode');
    if (toggleTimeModeBtn) {
      toggleTimeModeBtn.addEventListener('click', () => {
        timeMode = (timeMode === 'live') ? 'custom' : 'live';
      });
    }

    // Quick 24h Timeline Preset Buttons (05:30 First, 09:15 Peak, 23:00 Last, 02:00 Maintenance)
    document.querySelectorAll('.time-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.time-preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const sec = parseInt(chip.getAttribute('data-time'), 10);
        customTimeSeconds = sec;
        timeMode = 'custom';
      });
    });

    initStationTabs();
    initStationSearch();
  }

  function setupInteractions() {
    map.on('click', 'train-consist-3d', onTrainClick);
    map.on('click', 'train-dot-white-black', onTrainClick);

    // Click station platform to open Station Schedule Panel
    map.on('click', 'platform-slab-deck-elevated', (e) => {
      const feat = e.features && e.features[0];
      if (feat && feat.properties) {
        const val = (feat.properties.index !== undefined && feat.properties.index !== null) ? parseInt(feat.properties.index, 10) : feat.properties.name;
        openStationPanel(val);
      }
    });
    map.on('click', 'platform-slab-deck-underground', (e) => {
      const feat = e.features && e.features[0];
      if (feat && feat.properties) {
        const val = (feat.properties.index !== undefined && feat.properties.index !== null) ? parseInt(feat.properties.index, 10) : feat.properties.name;
        openStationPanel(val);
      }
    });
    map.on('click', 'platform-canopy-3d', (e) => {
      const feat = e.features && e.features[0];
      if (feat && feat.properties) {
        openStationPanel(feat.properties.name);
      }
    });

    ['station-labels-major', 'station-labels-local'].forEach(layerId => {
      map.on('click', layerId, (e) => {
        const feat = e.features && e.features[0];
        if (feat && feat.properties) {
          const val = (feat.properties.index !== undefined && feat.properties.index !== null) ? parseInt(feat.properties.index, 10) : feat.properties.name;
          openStationPanel(val);
        }
      });
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    });

    map.on('dragstart', () => {
      if (followTrainId) {
        followTrainId = null;
        const followBtn = document.getElementById('btn-follow-train');
        if (followBtn) followBtn.textContent = 'Follow This Train 📹';
        const followNextBtn = document.getElementById('btn-follow-next-train');
        if (followNextBtn) followNextBtn.textContent = '📹 Follow Next Arriving Train';
      }
    });

    function onTrainClick(e) {
      const feat = e.features[0];
      if (feat) {
        selectedTrainId = feat.properties.id;
        updateCalloutCard(feat.properties);
        document.getElementById('inspector-card').classList.remove('hidden');
        const followBtn = document.getElementById('btn-follow-train');
        if (followBtn) followBtn.textContent = 'Follow This Train 📹';
      }
    }

    map.on('mouseenter', 'train-consist-3d', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'train-consist-3d', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'train-dot-white-black', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'train-dot-white-black', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'platform-slab-deck-elevated', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'platform-slab-deck-elevated', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'platform-slab-deck-underground', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'platform-slab-deck-underground', () => { map.getCanvas().style.cursor = ''; });
  }

  function openStationPanel(stIndexOrName) {
    if (!window.TripEngine) return;
    const stations = TripEngine.getStations();
    let stIdx = -1;
    if (typeof stIndexOrName === 'number') {
      stIdx = stIndexOrName;
    } else {
      stIdx = stations.findIndex(s => s.name.toLowerCase() === String(stIndexOrName).toLowerCase() || s.id === stIndexOrName);
    }
    if (stIdx < 0 || stIdx >= stations.length) return;
    activeStationIndex = stIdx;

    let sec = 0;
    let dayVariant = 'weekday';
    if (timeMode === 'live') {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const ist = new Date(utc + 5.5 * 3600000);
      sec = ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds();
      const d = ist.getDay();
      dayVariant = (d === 0) ? 'sunday' : (d === 6 ? 'saturday' : 'weekday');
    } else {
      sec = Math.floor(customTimeSeconds);
      dayVariant = 'weekday';
    }

    renderStationPanel(activeStationIndex, sec, dayVariant);
    const panel = document.getElementById('station-panel');
    if (panel) panel.classList.remove('hidden');

    const st = stations[activeStationIndex];
    if (map && st && st.coords) {
      map.easeTo({ center: st.coords, zoom: Math.max(map.getZoom(), 14.5), duration: 800 });
    }
  }

  function renderStationPanel(stIdx, sec, dayVariant) {
    if (!window.TripEngine) return;
    const stations = TripEngine.getStations();
    const st = stations[stIdx];
    if (!st) return;

    const titleEl = document.getElementById('st-panel-title');
    const codeEl = document.getElementById('st-panel-code');
    const interchangesEl = document.getElementById('st-panel-interchanges');
    const subEl = document.getElementById('st-panel-sub');
    const freqTextEl = document.getElementById('st-panel-freq-text');
    const p1List = document.getElementById('st-p1-arrivals');
    const p2List = document.getElementById('st-p2-arrivals');

    if (titleEl) titleEl.textContent = st.name;
    if (codeEl) codeEl.textContent = st.code || ('ST-' + (stIdx + 1));

    if (interchangesEl) {
      if (st.interchanges && st.interchanges.length > 0) {
        interchangesEl.innerHTML = st.interchanges.map(name => {
          let colorClass = 'interchange-blue';
          const n = name.toLowerCase();
          if (n.includes('blue')) colorClass = 'interchange-blue';
          else if (n.includes('pink')) colorClass = 'interchange-pink';
          else if (n.includes('magenta')) colorClass = 'interchange-magenta';
          else if (n.includes('red')) colorClass = 'interchange-red';
          else if (n.includes('violet')) colorClass = 'interchange-violet';
          else if (n.includes('orange') || n.includes('airport')) colorClass = 'interchange-orange';
          else if (n.includes('rapid')) colorClass = 'interchange-rapid';
          else if (n.includes('railways')) colorClass = 'interchange-railways';
          return `<span class="interchange-pill ${colorClass}">⇄ ${name}</span>`;
        }).join('');
        interchangesEl.classList.remove('hidden');
      } else {
        interchangesEl.innerHTML = '';
        interchangesEl.classList.add('hidden');
      }
    }

    if (subEl) {
      const structText = st.structure === 'underground' 
        ? `Underground Tube Chamber (${st.elevM || -16}m)` 
        : `Elevated Viaduct (+${st.elevM || 15}m)`;
      subEl.textContent = `${structText} · Station ${stIdx + 1} of ${stations.length}`;
    }

    // ── Architectural 3D Diorama Showcase Header ──
    const dioramaImg = document.getElementById('st-panel-diorama-img');
    const dioramaOverlay = document.getElementById('st-diorama-badge-overlay');
    if (dioramaImg && dioramaOverlay) {
      if (st.structure === 'underground') {
        dioramaImg.src = '/public/dmrc_underground_tube_diorama.png';
        dioramaOverlay.textContent = `SUBTERRANEAN TUBE DIORAMA · DEEP BORE (${st.elevM || -16}M)`;
      } else {
        dioramaImg.src = '/public/dmrc_elevated_viaduct_diorama.png';
        dioramaOverlay.textContent = `ELEVATED VIADUCT DIORAMA · ARCH CANOPY (+${st.elevM || 15}M)`;
      }
    }

    const followNextBtn = document.getElementById('btn-follow-next-train');
    if (followNextBtn) {
      followNextBtn.textContent = '📹 Follow Next Arriving Train';
      followNextBtn.onclick = () => {
        if (activeTrains && activeTrains.length > 0) {
          const match = activeTrains.find(t => t.toStation === st.name || t.currentStation === st.name) || activeTrains[0];
          if (match) {
            followTrainId = match.id;
            selectedTrainId = match.id;
            updateCalloutCard(match);
            document.getElementById('inspector-card').classList.remove('hidden');
            followNextBtn.textContent = `Tracking ${match.id} 🟢`;
            map.flyTo({ center: match.coords, zoom: 15.6, pitch: 52, duration: 800 });
          }
        }
      };
    }

    // ── Real-Time Coach Occupancy (DMRC Notice 555 Model) ──
    const coachStripEl = document.getElementById('coach-strip');
    const coachSubEl = document.getElementById('coach-meter-sub');
    if (coachStripEl) {
      const hr = Math.floor(sec / 3600);
      const isMorningPeak = (hr >= 8 && hr < 11);
      const isEveningPeak = (hr >= 17 && hr < 21);
      const isPeak = isMorningPeak || isEveningPeak;
      const isAdvisoryActive = window.activeAdvisory && window.activeAdvisory.status === 'active';

      let statusText = 'Low · Light Passenger Load';
      if (isAdvisoryActive) statusText = 'Crowded · Delay Surge Across Rake';
      else if (isPeak) statusText = 'High · Peak Crush Load (Mid-train)';
      else if (hr >= 6 && hr <= 22) statusText = 'Moderate · Evenly Distributed';

      if (coachSubEl) coachSubEl.textContent = statusText;

      const coaches = [
        { num: 1, type: 'women', label: 'C1 ♀' },
        { num: 2, type: 'gen', label: 'C2' },
        { num: 3, type: 'gen', label: 'C3' },
        { num: 4, type: 'gen', label: 'C4' },
        { num: 5, type: 'gen', label: 'C5' },
        { num: 6, type: 'gen', label: 'C6' },
        { num: 7, type: 'gen', label: 'C7' },
        { num: 8, type: 'gen', label: 'C8' }
      ];

      coachStripEl.innerHTML = coaches.map(c => {
        let occClass = 'c-low';
        if (c.type === 'women') {
          occClass = 'c-women';
        } else if (isAdvisoryActive) {
          occClass = 'c-high';
        } else if (isPeak) {
          occClass = (c.num >= 3 && c.num <= 6) ? 'c-high' : 'c-med';
        } else if (hr >= 6 && hr <= 22) {
          occClass = (c.num >= 3 && c.num <= 6) ? 'c-med' : 'c-low';
        } else {
          occClass = 'c-low';
        }
        return `<div class="coach-box ${occClass}" title="Coach ${c.num}">${c.label}</div>`;
      }).join('');
    }

    const secInfo = TripEngine.getStationCorridorSection ? TripEngine.getStationCorridorSection(stIdx) : null;
    const isCore = secInfo ? (secInfo.id === 'central_core') : (stIdx >= 8 && stIdx <= 27);
    const isNorthOuter = secInfo ? (secInfo.id === 'north_outer') : (stIdx < 8);

    if (freqTextEl) {
      if (isCore) {
        freqTextEl.textContent = 'Central High-Frequency Zone · Trains every ~2.5 min (150s evenly spaced)';
      } else if (isNorthOuter) {
        freqTextEl.textContent = 'North Outer Sector (Samaypur Badli–Vishwavidyalaya) · Trains every ~5.0 min (unverified)';
      } else {
        const shuttleActive = secInfo && secInfo.enable_south_shuttle;
        if (shuttleActive) {
          freqTextEl.textContent = 'South Outer Sector (Qutab–Gurugram Shuttle Active) · Trains every ~2.5 min (unverified)';
        } else {
          freqTextEl.textContent = 'South Outer Sector (Qutab Minar–Millennium City) · Trains every ~5.0 min (unverified)';
        }
      }
    }

    const p1Arrivals = TripEngine.getStationArrivals(stIdx, 'south', sec, dayVariant, 3);
    const p2Arrivals = TripEngine.getStationArrivals(stIdx, 'north', sec, dayVariant, 3);

    function buildArrivalsHTML(list) {
      if (!list || !list.length || list[0].status === 'closed') {
        return '<div class="st-arrival-item"><span class="st-arr-clock">--:--</span><span class="st-arr-dest">Service Closed</span><span class="st-arr-badge badge-scheduled">Closed</span></div>';
      }
      return list.map(item => {
        let badgeClass = 'badge-scheduled';
        if (item.status === 'boarding') badgeClass = 'badge-boarding';
        else if (item.status === 'approaching') badgeClass = 'badge-approaching';
        else if (item.status === 'advisory') badgeClass = 'badge-advisory';

        return `<div class="st-arrival-item">
          <span class="st-arr-clock">${item.clockTime}</span>
          <span class="st-arr-dest">➔ ${item.dest}</span>
          <span class="st-arr-badge ${badgeClass}">${item.text}</span>
        </div>`;
      }).join('');
    }

    if (p1List) p1List.innerHTML = buildArrivalsHTML(p1Arrivals);
    if (p2List) p2List.innerHTML = buildArrivalsHTML(p2Arrivals);

    // ── Local Passenger Delay Report (Zero-Backend localStorage) ──
    const delayKey = 'dmrc_reported_delay_' + stIdx;
    const reportBtn = document.getElementById('btn-report-delay');
    const reportMsg = document.getElementById('st-delay-report-msg');
    const savedReport = localStorage.getItem(delayKey);
    const nowMs = Date.now();
    const isReported = savedReport && (nowMs - Number(savedReport) < 900000); // 15 min expiry

    if (reportBtn && reportMsg) {
      if (isReported) {
        const minsAgo = Math.max(1, Math.round((nowMs - Number(savedReport)) / 60000));
        reportBtn.textContent = '✓ Delay Logged (' + minsAgo + 'm ago) · Click to Clear';
        reportBtn.classList.add('active');
        reportMsg.textContent = '⚠️ You logged irregular frequency here. Local adjustments active.';
        reportMsg.classList.remove('hidden');
      } else {
        reportBtn.textContent = '⚠️ Report Delay at this station';
        reportBtn.classList.remove('active');
        reportMsg.classList.add('hidden');
      }

      reportBtn.onclick = () => {
        const currentSaved = localStorage.getItem(delayKey);
        if (currentSaved && (Date.now() - Number(currentSaved) < 900000)) {
          localStorage.removeItem(delayKey);
          if (window.LiveClient) {
            LiveClient.submitReport({ kind: 'cleared', stationIdx: stIdx, direction: 1 });
          }
        } else {
          localStorage.setItem(delayKey, Date.now());
          if (window.LiveClient) {
            LiveClient.submitReport({ kind: 'stuck', stationIdx: stIdx, direction: 1 });
          }
        }
        renderStationPanel(stIdx, sec, dayVariant);
      };
    }

    // ── TAB 2: Exit Gates & Landmarks Directory ──
    const gatesCountEl = document.getElementById('st-gates-count');
    const gatesListEl = document.getElementById('st-gates-list');
    if (gatesCountEl) gatesCountEl.textContent = st.gates ? st.gates.length : 0;
    if (gatesListEl) {
      if (st.gates && st.gates.length > 0) {
        gatesListEl.innerHTML = st.gates.map(g => `
          <div class="gate-card">
            <div class="gate-card-top">
              <span class="gate-num">${g.gate || 'Exit Gate'}</span>
              ${g.divyang ? '<span class="gate-badge-accessible">♿ Accessible</span>' : ''}
            </div>
            <div class="gate-loc">${g.location || 'Station concourse street exit'}</div>
          </div>
        `).join('');
      } else {
        gatesListEl.innerHTML = '<div class="gate-card"><div class="gate-loc">No street exit gate data available for this station.</div></div>';
      }
    }

    // ── TAB 3: Operational Timings & Facilities Info ──
    const hoursValEl = document.getElementById('st-hours-val');
    const phoneLinkEl = document.getElementById('st-phone-link');
    const sbFirstEl = document.getElementById('st-fl-sb-first');
    const sbLastEl = document.getElementById('st-fl-sb-last');
    const nbFirstEl = document.getElementById('st-fl-nb-first');
    const nbLastEl = document.getElementById('st-fl-nb-last');

    if (hoursValEl) hoursValEl.textContent = `${st.openingTime || '05:30:00'} – ${st.closingTime || '23:45:00'}`;
    if (phoneLinkEl) {
      const cleanPhone = st.contactPhone ? st.contactPhone.split(',')[0].trim() : '155370';
      phoneLinkEl.textContent = '📞 ' + cleanPhone;
      phoneLinkEl.href = 'tel:' + cleanPhone;
    }
    if (sbFirstEl) sbFirstEl.textContent = st.firstTrainSouth || '06:00 AM';
    if (sbLastEl) sbLastEl.textContent = st.lastTrainSouth || '11:00 PM';
    if (nbFirstEl) nbFirstEl.textContent = st.firstTrainNorth || '06:00 AM';
    if (nbLastEl) nbLastEl.textContent = st.lastTrainNorth || '11:00 PM';

    // 3D Stage / Cutaway Trigger Buttons inside station drawer
    const view3dBtn = document.getElementById('btn-view-3d-stage');
    if (view3dBtn) {
      view3dBtn.onclick = () => {
        const isUnderground = st.structure === 'underground';
        window.switchSurface('threejs', isUnderground ? 'underground' : 'elevated');
      };
    }

    const cutawayBtn = document.getElementById('btn-open-station-cutaway');
    const cutawayBlock = document.getElementById('st-cutaway-link-block');
    if (cutawayBtn && cutawayBlock) {
      cutawayBtn.textContent = '📐 View 3D Station Cutaway Stage →';
      cutawayBtn.onclick = () => {
        const isUnderground = st.structure === 'underground';
        window.switchSurface('threejs', isUnderground ? 'underground' : 'elevated');
      };
    }
  }

  function initStationTabs() {
    const tabBtns = document.querySelectorAll('.st-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.st-tab-pane').forEach(p => p.classList.add('hidden'));
        const activePane = document.getElementById('pane-' + targetTab);
        if (activePane) activePane.classList.remove('hidden');
      });
    });
  }

  function initStationSearch() {
    const searchInput = document.getElementById('station-search-input');
    const searchResults = document.getElementById('station-search-results');
    const clearBtn = document.getElementById('station-search-clear');
    if (!searchInput || !searchResults) return;

    function filterStations(query) {
      if (!window.TripEngine) return [];
      const stations = TripEngine.getStations();
      const q = query.trim().toLowerCase();
      if (!q) return [];
      return stations.filter(st => {
        const matchName = st.name.toLowerCase().includes(q);
        const matchCode = st.code && st.code.toLowerCase().includes(q);
        const matchInterchange = st.interchanges && st.interchanges.some(i => i.toLowerCase().includes(q));
        return matchName || matchCode || matchInterchange;
      });
    }

    searchInput.addEventListener('input', () => {
      const q = searchInput.value;
      if (clearBtn) clearBtn.classList.toggle('hidden', !q);
      const matches = filterStations(q);
      if (matches.length > 0) {
        searchResults.innerHTML = matches.slice(0, 8).map(st => `
          <div class="search-result-item" data-st-idx="${st.index}">
            <span class="search-result-name">${st.name}</span>
            <div class="search-result-meta">
              ${st.interchanges && st.interchanges.length > 0 ? `<span class="interchange-pill interchange-blue">⇄ ${st.interchanges[0]}</span>` : ''}
              <span class="dmrc-code-badge">${st.code || 'ST'}</span>
            </div>
          </div>
        `).join('');
        searchResults.classList.remove('hidden');
      } else if (q.trim()) {
        searchResults.innerHTML = '<div class="search-result-item" style="cursor:default; color:#94A3B8;">No station matches found</div>';
        searchResults.classList.remove('hidden');
      } else {
        searchResults.classList.add('hidden');
      }
    });

    searchResults.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (!item) return;
      const stIdx = parseInt(item.getAttribute('data-st-idx'), 10);
      if (!isNaN(stIdx) && window.openStationPanel) {
        window.openStationPanel(stIdx);
        searchResults.classList.add('hidden');
        searchInput.value = '';
        if (clearBtn) clearBtn.classList.add('hidden');
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchResults.classList.add('hidden');
        clearBtn.classList.add('hidden');
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#station-search-container')) {
        searchResults.classList.add('hidden');
      }
    });

    // Shortcut key: "/" to focus search
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      } else if (e.key === 'Escape') {
        searchResults.classList.add('hidden');
      }
    });
  }

  window.openStationPanel = openStationPanel;

  function updateCalloutCard(props) {
    document.getElementById('ins-id').textContent = `Train ${props.id}`;
    document.getElementById('ins-track').textContent = `${props.track} · ${props.elevLabel || ''}`;
    document.getElementById('ins-dir').textContent = props.directionLabel;
    document.getElementById('ins-between').textContent = props.currentStation ? `📍 At Platform: ${props.currentStation}` : `${props.fromStation} ➔ ${props.toStation}`;
    document.getElementById('ins-speed').textContent = `${props.speedKph} km/h`;

    const stateEl = document.getElementById('ins-state');
    if (stateEl) {
      stateEl.textContent = props.stateLabel || props.state || 'CRUISING';
      stateEl.className = 'spec-v state-badge';
      if (props.state === 'STOPPED') {
        stateEl.classList.add('state-stopped');
      } else if (props.state === 'BRAKING') {
        stateEl.classList.add('state-braking');
      } else if (props.state === 'ACCELERATING') {
        stateEl.classList.add('state-accel');
      } else {
        stateEl.classList.add('state-cruising');
      }
    }

    const dwellRow = document.getElementById('ins-dwell-row');
    if (dwellRow) {
      if (props.state === 'STOPPED') {
        dwellRow.classList.remove('hidden');
        const timerEl = document.getElementById('ins-dwell-timer');
        const totalEl = document.getElementById('ins-dwell-total');
        const reasonEl = document.getElementById('ins-dwell-reason');
        const fillEl = document.getElementById('ins-dwell-fill');

        if (timerEl) timerEl.textContent = `${props.dwellRemaining}s remaining`;
        if (totalEl) totalEl.textContent = `/ ${props.dwellTotal}s dwell`;
        if (reasonEl) reasonEl.textContent = props.dwellReason || 'Passenger Boarding';
        if (fillEl && props.dwellTotal > 0) {
          const pct = Math.max(0, Math.min(100, (props.dwellRemaining / props.dwellTotal) * 100));
          fillEl.style.width = `${pct}%`;
        }
      } else {
        dwellRow.classList.add('hidden');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})();
