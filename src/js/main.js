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
  let renderMode = '3d';
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

  function applyRenderMode(mode) {
    renderMode = mode;
    ['3d', 'dot', 'tracks'].forEach(m => {
      const btn = document.getElementById(`mode-${m}`);
      if (btn) btn.classList.toggle('active', m === mode);
    });
    if (!map) return;

    const hasThreeLayer = !!(window.MetroWebGLLayer || map.getLayer('metro-webgl-3d-layer'));

    // True 3D MetroKit WebGL layer handles viaducts, tunnels & stations above MapLibre
    if (!hasThreeLayer) {
      const allViaductLayers = [
        'flyover-ground-shadow',
        'flyover-parapet-curb',
        'flyover-deck-slab',
        'flyover-center-divider',
        'flyover-viaduct-track-1',
        'flyover-viaduct-track-2',
        'flyover-viaduct-track-ties',
        'tunnel-tube-outer-casing',
        'tunnel-tube-bed'
      ];
      allViaductLayers.forEach(id => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
      });
    }

    if (hasThreeLayer) {
      ['train-consist-3d', 'train-dot-white-black', 'train-dot-pupil', 'train-drop-shadow'].forEach(id => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
      });
      return;
    }

    if (mode === '3d') {
      if (map.getLayer('train-consist-3d')) map.setLayoutProperty('train-consist-3d', 'visibility', 'none');
      if (map.getLayer('train-dot-white-black')) {
        map.setLayoutProperty('train-dot-white-black', 'visibility', 'visible');
        map.setPaintProperty('train-dot-white-black', 'circle-opacity', [
          'interpolate', ['linear'], ['zoom'],
          11.0, 1.0,
          12.5, 0.0
        ]);
      }
      if (map.getLayer('train-dot-pupil')) {
        map.setLayoutProperty('train-dot-pupil', 'visibility', 'visible');
        map.setPaintProperty('train-dot-pupil', 'circle-opacity', [
          'interpolate', ['linear'], ['zoom'],
          11.0, 1.0,
          12.5, 0.0
        ]);
      }
      if (map.getLayer('train-drop-shadow')) map.setLayoutProperty('train-drop-shadow', 'visibility', 'none');
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

  function init() {
    setupMasterNavigation();

    // 1. Pre-warm shared topology JSON promise; calibrate server clock skew after first paint
    window.__delhiTopoPromise = window.__delhiTopoPromise ||
      fetch('src/data/delhi_network_topology_geo.json').then((r) => r.json()).catch(() => null);

    setTimeout(() => {
      fetch('./', { method: 'HEAD' })
        .then((headRes) => {
          const serverDate = headRes.headers.get('date');
          if (serverDate) {
            window.CLOCK_SKEW_MS = new Date(serverDate).getTime() - Date.now();
          }
        })
        .catch(() => { window.CLOCK_SKEW_MS = 0; });
    }, 3000);

    const trackPromise = TripEngine.loadData()
      .then((td) => {
        trackData = td;
        return td;
      })
      .catch((e) => {
        console.error('Failed to load track topology from TripEngine', e);
        return null;
      });

    checkServiceAdvisories();
    setInterval(checkServiceAdvisories, 60000);

    if (window.LiveClient) {
      try {
        Promise.resolve(LiveClient.init()).catch((e) => console.warn('[LiveClient] Init warning:', e));
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

    initDioramaMap(trackPromise);
    setupControls();
    trackPromise.then(() => {
      if (typeof window.syncStationStepper === 'function') window.syncStationStepper(0);
    });
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

  const isMobileViewport = () => (typeof window !== 'undefined') && (
    window.innerWidth <= 860 ||
    (navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.screen ? window.screen.width : window.innerWidth) <= 1024)
  );

  function initDioramaMap(trackPromise) {
    const mobileView = isMobileViewport();
    if (window.maplibregl && typeof window.maplibregl.setWorkerCount === 'function') {
      const cores = Number(navigator.hardwareConcurrency) || 4;
      const targetWorkers = mobileView ? Math.min(2, Math.max(1, cores >> 1)) : Math.min(4, Math.max(2, cores >> 1));
      try { window.maplibregl.setWorkerCount(targetWorkers); } catch (_) { }
    }
    // Rich OpenFreeMap Liberty OSM 3D urban vector style (detailed parks, campuses, walkways & 3D buildings)
    map = new maplibregl.Map({
      container: 'map',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [77.1383, 28.7446], // Yellow Line Station #1: Samaypur Badli Terminus
      zoom: 18.35,
      pitch: 54,
      bearing: -24,
      minZoom: 9.0,
      maxZoom: 20.5,
      maxPitch: 74,
      pixelRatio: Math.min(window.devicePixelRatio || 1, mobileView ? 1.75 : 2),
      maxTileCacheSize: mobileView ? 64 : 160,
      maxTileCacheZoomLevels: mobileView ? 5 : 8,
      dragRotate: true,
      pitchWithRotate: true,
      touchPitch: true,
      touchZoomRotate: true,
      canvasContextAttributes: { antialias: !mobileView },
      maxBounds: [
        [76.50, 28.10], // Southwest NCR
        [77.70, 29.10]  // Northeast NCR
      ],
      attributionControl: false
    });
    window.map = map;
    window.mapInstance = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({
      compact: mobileView,
      customAttribution: 'Unofficial · Not affiliated with DMRC | © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
    }), 'bottom-left');
    if (mobileView) {
      const collapseMobileAttrib = () => {
        const attribEl = map.getContainer && map.getContainer().querySelector('.maplibregl-ctrl-attrib');
        if (attribEl) attribEl.classList.remove('maplibregl-compact-show');
      };
      setTimeout(collapseMobileAttrib, 0);
      map.once('load', collapseMobileAttrib);
      map.on('style.load', () => setTimeout(collapseMobileAttrib, 50));
    }

    map.on('styleimagemissing', (e) => {
      if (e.id === 'delhi-metro-consist') {
        preloadImage('/public/metro_train_topdown_vibrant.png', 'delhi-metro-consist');
      } else if (e.id === 'dmrc-rail-pattern') {
        preloadImage('/public/delhi_metro_track_pattern.png', 'dmrc-rail-pattern');
      }
    });

    let styleLoaded = false;
    let dataReady = !!trackData;
    let geoRendered = false;

    function tryRenderGeoJson() {
      if (geoRendered || !styleLoaded || !dataReady || !trackData) return;
      geoRendered = true;
      const hasThreeLayer = !!window.MetroWebGLLayer;
      if (!hasThreeLayer) add3DBuildings();
      renderViaductAndDualTracks(!hasThreeLayer);
      renderPhysicalPlatforms(!hasThreeLayer);
      if (!hasThreeLayer) renderTrainsLayers();
      add3DStationLandmarks();
      setupInteractions();
      applyRenderMode(renderMode);
      if (window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo().isReady) {
        window.MetroWebGLLayer.configureMapLibreVisualHarmony();
      }
    }

    if (trackPromise && typeof trackPromise.then === 'function') {
      trackPromise.then((td) => {
        if (td) trackData = td;
        dataReady = !!trackData;
        tryRenderGeoJson();
      });
    }

    map.on('style.load', () => {
      styleLoaded = true;
      suppressMapClutter();
      enhanceMapColors();

      // Directional Warm Daylight for 3D Extrusions & Landmarks
      try {
        map.setLight({
          anchor: 'map',
          color: '#FFFDF8',
          intensity: 0.40,
          position: [1.15, 138, 30]
        });
      } catch (e) { }

      // Skip legacy 2D train sprite preloads when WebGL 3D layer renders the live fleet
      if (!window.MetroWebGLLayer) {
        preloadImage('/public/metro_train_topdown_vibrant.png', 'delhi-metro-consist');
        preloadImage('/public/delhi_metro_track_pattern.png', 'dmrc-rail-pattern');
      }

      map.on('zoom', updateMarkerScale);
      updateMarkerScale();
      tryRenderGeoJson();

      if (window.MetroWebGLLayer) {
        window.MetroWebGLLayer.install(map);
        console.log('[main.js] MetroWebGLLayer installed on MapLibre style.load');
      }
    });
  }

  function suppressMapClutter() {
    try {
      const style = map.getStyle();
      if (!style || !style.layers) return;
      // Hide only dense micro-clutter & US highway shields; preserve rich OpenFreeMap parks, landmarks & street names
      const clutterIds = new Set([
        'poi_r20', 'road_one_way_arrow', 'road_one_way_arrow_opposite',
        'highway-shield-us-interstate', 'road_shield_us', 'housenumber'
      ]);
      style.layers.forEach((l) => {
        if (clutterIds.has(l.id)) {
          map.setLayoutProperty(l.id, 'visibility', 'none');
        }
      });
    } catch (e) { }
  }

  function enhanceMapColors() {
    try {
      if (map.getLayer('background')) {
        map.setPaintProperty('background', 'background-color', '#F2EDE2');
      }
      if (map.getLayer('water')) {
        map.setPaintProperty('water', 'fill-color', '#79C2EC');
        map.setPaintProperty('water', 'fill-opacity', 0.88);
      }
    } catch (e) { }
  }

  // ═══════════════════════════════════════════════════════════
  //  2. LEGACY PROTOMAPS 3D EXTRUSION FALLBACK (SKIPPED ON LIBERTY)
  // ═══════════════════════════════════════════════════════════
  function add3DBuildings() {
    if (!map.getSource('protomaps')) return;
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
    } catch (e) { }
  }

  // ═══════════════════════════════════════════════════════════
  //  3. INFRASTRUCTURE: ELEVATED FLYOVERS, SUBTERRANEAN TUNNELS & PORTALS
  // ═══════════════════════════════════════════════════════════
  function renderViaductAndDualTracks(includeLegacy3D = true) {
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

    if (!includeLegacy3D) return;

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
        : ['interpolate', ['linear'], ['zoom'], 13.5, 3.2, 15, 2.0, 16, 0.0];

      const leftRailOffset = isDown
        ? ['interpolate', ['linear'], ['zoom'], 13.5, -4.8, 15, -2.6, 17, -4.5]
        : ['interpolate', ['linear'], ['zoom'], 13.5, 2.4, 15, -2.6, 17, -4.5];

      const rightRailOffset = isDown
        ? ['interpolate', ['linear'], ['zoom'], 13.5, -2.4, 15, 2.6, 17, 4.5]
        : ['interpolate', ['linear'], ['zoom'], 13.5, 4.8, 15, 2.6, 17, 4.5];

      const thirdOffset = isDown
        ? ['interpolate', ['linear'], ['zoom'], 14, -0.4, 16, 5.8, 17, 8.2]
        : ['interpolate', ['linear'], ['zoom'], 14, 7.6, 16, 5.8, 17, 8.2];

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
          'text-font': ['Noto Sans Bold'],
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
  function renderPhysicalPlatforms(includeLegacy3D = true) {
    if (!trackData) return;

    // 1. Platform Slabs (Reveals at z >= 13.5 close-up views; skipped when WebGL 3D layer active)
    if (includeLegacy3D && trackData.platformSlabs) {
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

      // Clean 2.5D Platform Footprint (Elevated Stations, z >= 13.5)
      map.addLayer({
        id: 'platform-slab-deck-elevated',
        type: 'fill',
        source: 'platform-slabs',
        filter: ['==', ['get', 'structure'], 'elevated'],
        minzoom: 13.5,
        paint: {
          'fill-color': '#F8FAFC',
          'fill-outline-color': '#CBD5E1',
          'fill-opacity': 0.92
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
    if (includeLegacy3D && trackData.undergroundPlatforms) {
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

      // Surface Glass Entrance Footprint at Street Level
      map.addLayer({
        id: 'underground-portal-cubes',
        type: 'fill',
        source: 'underground-platforms',
        minzoom: 13.8,
        paint: {
          'fill-color': '#FFFFFF',
          'fill-outline-color': '#64748B',
          'fill-opacity': 0.85
        }
      });
    }

    // 3. Tactile Hazard Platform Edges (z >= 14.0)
    if (includeLegacy3D && trackData.tactileEdges) {
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
          'line-width': ['interpolate', ['linear'], ['zoom'], 14, 3.5, 16, 5],
          'line-dasharray': [1, 0.4]
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
          'text-font': ['Noto Sans Bold'],
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
          'text-font': ['Noto Sans Regular'],
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
        modeBtn.classList.toggle('custom-scrub', timeMode === 'custom');
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

      // Night Maintenance Banner (Dismissible Toast)
      const nightBanner = document.getElementById('night-maintenance-banner');
      if (nightBanner && !window.isNightBannerDismissed) {
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
      if (window.MetroWebGLLayer && window.MetroWebGLLayer.setTimeOfDay) {
        window.MetroWebGLLayer.setTimeOfDay(sec);
      }
    }

    lastSimulationTick = performance.now();
    tick();
    setInterval(tick, 100); // 10 Hz simulation step
  }

  // ═══════════════════════════════════════════════════════════
  //  8. 60 FPS INTERPOLATION LOOP (Silky-Smooth Movement & Rotation)
  // ═══════════════════════════════════════════════════════════
  function startAnimationLoop() {
    const mapEl = document.getElementById('map');
    let lastDotPush = 0;

    function animate(now) {
      if (document.hidden || (mapEl && mapEl.classList.contains('hidden'))) {
        requestAnimationFrame(animate);
        return;
      }

      if (map && trainTargetStates.size > 0) {
        const hasThreeLayer = !!(window.MetroWebGLLayer || map.getLayer('metro-webgl-3d-layer'));
        const needsGeoJson = !hasThreeLayer && map.getSource('active-trains') && (now - lastDotPush >= 40);

        if (followTrainId) {
          const target = trainTargetStates.get(followTrainId);
          if (target) {
            const prev = trainPrevStates.get(followTrainId) || target;
            const factor = Math.min(1.0, Math.max(0.0, (now - target.time) / packetInterval));
            const curLng = prev.coords[0] + (target.coords[0] - prev.coords[0]) * factor;
            const curLat = prev.coords[1] + (target.coords[1] - prev.coords[1]) * factor;
            map.setCenter([curLng, curLat]);
          }
        }

        if (needsGeoJson) {
          lastDotPush = now;
          const features = [];
          const currentZoom = map.getZoom();

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
          });

          map.getSource('active-trains').setData({
            type: 'FeatureCollection',
            features: features
          });
        }
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
    const threeSurface = document.getElementById('three-container');
    const timetableDock = document.querySelector('.timetable-dock');

    window.switchSurface = function (surfaceName, optArchetype) {
      tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-surface') === surfaceName));

      const mapPerspectivePill = document.getElementById('map-perspective-pill');
      const stationStepperPill = document.getElementById('station-stepper-pill');

      const archGroup = document.getElementById('hud-archetype-group');
      const camGroup = document.getElementById('hud-camera-group');
      const kitGroup = document.getElementById('hud-kit-group');
      const sectorGroup = document.getElementById('hud-sector-group');

      if (surfaceName === 'corridor') {
        if (mapSurface) mapSurface.classList.remove('hidden');
        if (threeSurface) threeSurface.classList.add('hidden');
        if (timetableDock) timetableDock.style.display = 'flex';
        if (mapPerspectivePill) mapPerspectivePill.classList.remove('hidden');
        if (stationStepperPill) stationStepperPill.classList.remove('hidden');
        if (window.Diorama3D) window.Diorama3D.stop();
        if (window.DelhiMetro3D) window.DelhiMetro3D.stop();
        if (window.MetroWebGLLayer && window.MetroWebGLLayer.syncHudTheme) window.MetroWebGLLayer.syncHudTheme();
        requestAnimationFrame(() => {
          if (map) map.resize();
        });
      } else if (surfaceName === 'diorama') {
        if (window.MetroWebGLLayer && window.MetroWebGLLayer.hideTooltip) window.MetroWebGLLayer.hideTooltip();
        if (window.MetroWebGLLayer && window.MetroWebGLLayer.closeMonumentSpotlight) window.MetroWebGLLayer.closeMonumentSpotlight();
        if (threeSurface) threeSurface.classList.remove('hidden');
        if (mapSurface) mapSurface.classList.add('hidden');
        if (window.MetroWebGLLayer && window.MetroWebGLLayer.syncMonumentMarkersVisibility) window.MetroWebGLLayer.syncMonumentMarkersVisibility();
        if (timetableDock) timetableDock.style.display = 'none';
        if (mapPerspectivePill) mapPerspectivePill.classList.add('hidden');
        if (stationStepperPill) stationStepperPill.classList.add('hidden');
        if (archGroup) archGroup.style.display = 'block';
        if (camGroup) camGroup.style.display = 'block';
        if (kitGroup) kitGroup.style.display = 'block';
        if (sectorGroup) sectorGroup.style.display = 'none';
        const stPanel = document.getElementById('station-panel');
        if (stPanel) stPanel.classList.add('hidden');
        const inspCard = document.getElementById('inspector-card');
        if (inspCard) inspCard.classList.add('hidden');
        if (window.DelhiMetro3D) window.DelhiMetro3D.stop();
        if (window.Diorama3D && threeSurface) {
          window.Diorama3D.init(threeSurface);
          if (optArchetype === 'elevated') {
            window.Diorama3D.setCameraView('qutab');
          } else if (optArchetype === 'underground') {
            window.Diorama3D.setCameraView('rajiv');
          } else {
            window.Diorama3D.setCameraView('overview');
          }
          window.Diorama3D.start();
        }
      } else if (surfaceName === 'threejs') {
        if (window.MetroWebGLLayer && window.MetroWebGLLayer.hideTooltip) window.MetroWebGLLayer.hideTooltip();
        if (window.MetroWebGLLayer && window.MetroWebGLLayer.closeMonumentSpotlight) window.MetroWebGLLayer.closeMonumentSpotlight();
        if (threeSurface) threeSurface.classList.remove('hidden');
        if (mapSurface) mapSurface.classList.add('hidden');
        if (window.MetroWebGLLayer && window.MetroWebGLLayer.syncMonumentMarkersVisibility) window.MetroWebGLLayer.syncMonumentMarkersVisibility();
        if (timetableDock) timetableDock.style.display = 'none';
        if (mapPerspectivePill) mapPerspectivePill.classList.add('hidden');
        if (stationStepperPill) stationStepperPill.classList.add('hidden');
        if (archGroup) archGroup.style.display = 'none';
        if (camGroup) camGroup.style.display = 'none';
        if (kitGroup) kitGroup.style.display = 'none';
        if (sectorGroup) sectorGroup.style.display = 'block';
        const stPanel = document.getElementById('station-panel');
        if (stPanel) stPanel.classList.add('hidden');
        const inspCard = document.getElementById('inspector-card');
        if (inspCard) inspCard.classList.add('hidden');
        if (window.Diorama3D) window.Diorama3D.stop();
        if (window.DelhiMetro3D && threeSurface) {
          window.DelhiMetro3D.init(threeSurface);
          window.DelhiMetro3D.setViewMode('3d');
          window.DelhiMetro3D.start();
        }
      }
    };

    const btnThreeToMap = document.getElementById('btn-three-to-map');
    if (btnThreeToMap) {
      btnThreeToMap.addEventListener('click', (e) => {
        e.stopPropagation();
        window.switchSurface('corridor');
      });
    }

    tabs.forEach(t => {
      t.addEventListener('click', () => {
        const surf = t.getAttribute('data-surface');
        tabs.forEach(tab => tab.classList.toggle('active', tab === t));
        if (surf === 'threejs') {
          window.switchSurface('threejs');
          if (window.DelhiMetro3D) {
            window.DelhiMetro3D.setViewMode('3d');
          }
        } else if (surf === 'diorama') {
          window.switchSurface('diorama');
        } else if (surf === 'corridor') {
          window.switchSurface('corridor');
        }
      });
    });

    const urlParams = new URLSearchParams(window.location.search);
    // Default to Real Delhi Street Map + True 3D MetroKit Yellow Line (with 2-Station & Plinth modes 1 click away)
    const initialSurface = urlParams.get('surface') || 'corridor';
    window.switchSurface(initialSurface);
    // Update tab active state to match
    tabs.forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-surface') === initialSurface);
    });

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
    // 3D WebGL Viaducts vs 2D Flat Plan on MapLibre
    const btn3D = document.getElementById('btn-3d-map-view') || document.getElementById('btn-3d-view');
    const btn2D = document.getElementById('btn-2d-map-view') || document.getElementById('btn-2d-view');

    if (btn3D) {
      btn3D.addEventListener('click', () => {
        btn3D.classList.add('active');
        if (btn2D) btn2D.classList.remove('active');
        applyRenderMode('3d');
        if (map) {
          // Smoothly fly to first station (Samaypur Badli elevated terminus)
          map.flyTo({ center: [77.1383, 28.7446], zoom: 18.35, pitch: 54, bearing: -24, duration: 1100 });
        }
      });
    }

    if (btn2D) {
      btn2D.addEventListener('click', () => {
        btn2D.classList.add('active');
        if (btn3D) btn3D.classList.remove('active');
        applyRenderMode('dot');
        if (map) {
          map.flyTo({ center: [77.1400, 28.5850], zoom: 10.35, pitch: 0, bearing: 0, duration: 1000 });
        }
      });
    }

    // Keep 3D/2D pill synchronized when user pitches/rotates map manually
    if (map) {
      map.on('pitch', () => {
        const pitch = map.getPitch();
        if (btn3D && btn2D) {
          if (pitch >= 25) {
            btn3D.classList.add('active');
            btn2D.classList.remove('active');
            applyRenderMode('3d');
          } else if (pitch < 12) {
            btn2D.classList.add('active');
            btn3D.classList.remove('active');
            applyRenderMode('dot');
          }
        }
      });
    }

    const closeNightBtn = document.getElementById('btn-close-night-modal');
    if (closeNightBtn) {
      closeNightBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.isNightBannerDismissed = true;
        const nb = document.getElementById('night-maintenance-banner');
        if (nb) nb.classList.add('hidden');
      });
    }

    // Vehicle Render Mode: 3D Trains vs Radar Dots vs Rails Only
    const mode3D = document.getElementById('mode-3d');
    const modeDot = document.getElementById('mode-dot');
    const modeTracks = document.getElementById('mode-tracks');

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

    const BOOKMARK_VIEWS = {
      samaypur: { center: [77.1383, 28.7446], zoom: 18.35, pitch: 54, bearing: -24, duration: 1100 },
      qutab: { center: [77.1865, 28.5129], zoom: 18.4, pitch: 54, bearing: -22, duration: 1100 },
      greenpark: { center: [77.2068, 28.5580], zoom: 18.5, pitch: 54, bearing: -22, duration: 1100 },
      rajiv: { center: [77.2194, 28.6327], zoom: 18.45, pitch: 54, bearing: -20, duration: 1100 },
      kashmere: { center: [77.2282, 28.6675], zoom: 18.4, pitch: 54, bearing: -24, duration: 1100 },
      hauzkhas: { center: [77.2067, 28.5443], zoom: 18.45, pitch: 54, bearing: -20, duration: 1100 },
      gurgaon: { center: [77.0725, 28.4594], zoom: 18.35, pitch: 54, bearing: -18, duration: 1100 },
      centralsec: { center: [77.2123, 28.6159], zoom: 18.45, pitch: 54, bearing: -18, duration: 1200 },
      dwarka: { center: [77.0583, 28.5523], zoom: 18.4, pitch: 54, bearing: -22, duration: 1100 },
      akshardham: { center: [77.2782, 28.6152], zoom: 16.3, pitch: 58, bearing: -42, duration: 1100 },
      noida: { center: [77.3732, 28.6258], zoom: 18.4, pitch: 54, bearing: -20, duration: 1100 },
      dhaulakuan: { center: [77.16168, 28.59191], zoom: 17.5, pitch: 58, bearing: -32, duration: 1100 },
      igiairport: { center: [77.0867, 28.5565], zoom: 18.0, pitch: 55, bearing: -20, duration: 1100 },
      yashobhoomi: { center: [77.0453, 28.5508], zoom: 18.0, pitch: 55, bearing: -20, duration: 1100 },
      janakpuri: { center: [77.0779, 28.6289], zoom: 18.0, pitch: 55, bearing: -20, duration: 1100 },
      botanical: { center: [77.3338, 28.5639], zoom: 18.0, pitch: 55, bearing: -20, duration: 1100 }
    };

    const BOOKMARK_STATION_NAMES = {
      samaypur: 'Samaypur Badli',
      kashmere: 'Kashmere Gate',
      rajiv: 'Rajiv Chowk',
      greenpark: 'Green Park',
      hauzkhas: 'Hauz Khas',
      qutab: 'Qutab Minar',
      gurgaon: 'Millennium City Centre',
      centralsec: 'Central Secretariat',
      dwarka: 'Dwarka Sector 21',
      akshardham: 'Akshardham',
      noida: 'Noida Electronic City',
      dhaulakuan: 'Dhaula Kuan',
      igiairport: 'IGI Airport',
      yashobhoomi: 'Yashobhoomi Dwarka Sector 25',
      janakpuri: 'Janakpuri West',
      botanical: 'Botanical Garden'
    };

    let currentStepperIndex = 0;

    function getOrderedYellowStations() {
      if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getActiveStations === 'function') {
        const list = window.MetroWebGLLayer.getActiveStations();
        if (list && list.length) return list;
      }
      if (window.TripEngine && typeof window.TripEngine.getStations === 'function') {
        const list = window.TripEngine.getStations();
        if (list && list.length) return list;
      }
      if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getStations === 'function') {
        return window.MetroWebGLLayer.getStations() || [];
      }
      return [];
    }

    function syncStationStepper(indexOrName) {
      const stations = getOrderedYellowStations();
      if (!stations.length) return -1;
      let idx = -1;
      if (typeof indexOrName === 'number' && Number.isFinite(indexOrName)) {
        idx = Math.max(0, Math.min(stations.length - 1, Math.round(indexOrName)));
      } else if (indexOrName) {
        const norm = String(indexOrName || '').toLowerCase().replace(/\s+gurugram\b/, '').trim();
        idx = stations.findIndex((s) => String(s.name || '').toLowerCase().replace(/\s+gurugram\b/, '').trim() === norm);
      } else {
        idx = Math.max(0, Math.min(stations.length - 1, currentStepperIndex));
      }
      if (idx < 0) idx = 0;
      currentStepperIndex = idx;
      const st = stations[idx];
      const countEl = document.getElementById('station-step-count');
      const nameEl = document.getElementById('station-step-name');
      const lineTag = document.getElementById('station-step-line-tag');
      const activeLine = (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getActiveLine === 'function')
        ? window.MetroWebGLLayer.getActiveLine()
        : 'all';
      const isOrange = st && (st.lineId === 'orange' || st.lineKey === 'orange' || (activeLine === 'orange' && !st.lineId));
      const isMagenta = st && (st.lineId === 'magenta' || st.lineKey === 'magenta' || (activeLine === 'magenta' && !st.lineId));
      const isVaishali = st && (st.lineId === 'blue-vaishali' || (st.corridor && st.corridor.lineId === 'blue-vaishali'));
      const isBlue = !isOrange && !isMagenta && st && (st.lineId === 'blue' || isVaishali || (activeLine === 'blue' && !st.lineId));

      if (lineTag) {
        if (isOrange) {
          lineTag.textContent = 'OE';
          lineTag.className = 'station-step-line-tag line-orange';
        } else if (isMagenta) {
          lineTag.textContent = 'ML';
          lineTag.className = 'station-step-line-tag line-magenta';
        } else if (isVaishali) {
          lineTag.textContent = 'BV';
          lineTag.className = 'station-step-line-tag line-blue';
        } else if (isBlue) {
          lineTag.textContent = 'BL';
          lineTag.className = 'station-step-line-tag line-blue';
        } else {
          lineTag.textContent = 'YL';
          lineTag.className = 'station-step-line-tag line-yellow';
        }
      }
      if (countEl) countEl.textContent = `${idx + 1}/${stations.length}`;
      if (nameEl && st) nameEl.textContent = st.name;

      const isFirst = idx <= 0;
      const isLast = idx >= stations.length - 1;
      ['btn-prev-station', 'btn-panel-prev-station'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = isFirst;
      });
      ['btn-next-station', 'btn-panel-next-station'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = isLast;
      });
      updateTrackOffsetUI(0);
      return idx;
    }
    window.syncStationStepper = syncStationStepper;

    function updateTrackOffsetUI(offsetM) {
      const pill = document.getElementById('station-stepper-pill');
      const offsetEl = document.getElementById('station-step-offset');
      const n = Math.round(Number(offsetM) || 0);
      if (offsetEl) {
        if (n === 0) {
          offsetEl.classList.add('hidden');
          offsetEl.textContent = '+0m';
        } else {
          offsetEl.classList.remove('hidden');
          offsetEl.textContent = n > 0 ? `+${n}m` : `${n}m`;
        }
      }
      if (pill) pill.classList.toggle('has-offset', n !== 0);
    }

    function walkAlongTrack(deltaM) {
      if (!window.MetroWebGLLayer || typeof window.MetroWebGLLayer.stepAlongTrack !== 'function') return;
      followTrainId = null;
      const res = window.MetroWebGLLayer.stepAlongTrack(deltaM);
      if (res && typeof res.offsetM === 'number') {
        updateTrackOffsetUI(res.offsetM);
      }
    }

    function stepStation(delta, forceOpenPanel) {
      const stations = getOrderedYellowStations();
      if (!stations.length) return;
      const nextIdx = Math.max(0, Math.min(stations.length - 1, currentStepperIndex + delta));
      const st = stations[nextIdx];
      if (!st) return;

      followTrainId = null;
      syncStationStepper(nextIdx);
      if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.closeMonumentSpotlight === 'function') {
        window.MetroWebGLLayer.closeMonumentSpotlight();
      }

      const isThreePlinth = document.getElementById('tab-threejs')?.classList.contains('active');
      if (isThreePlinth && window.DelhiMetro3D) {
        window.DelhiMetro3D.flyToStation(st.name);
      } else if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.flyToStation === 'function') {
        window.MetroWebGLLayer.flyToStation(st.name);
      }

      const panel = document.getElementById('station-panel');
      const isPanelOpen = panel && !panel.classList.contains('hidden');
      if (forceOpenPanel || isPanelOpen) {
        openStationPanel(nextIdx, true);
      }
    }

    // Initialize stepper label to first station (Samaypur Badli)
    syncStationStepper(0);

    document.getElementById('btn-prev-station')?.addEventListener('click', () => stepStation(-1, false));
    document.getElementById('btn-next-station')?.addEventListener('click', () => stepStation(1, false));
    document.getElementById('btn-step-back-100')?.addEventListener('click', () => walkAlongTrack(-100));
    document.getElementById('btn-step-ahead-100')?.addEventListener('click', () => walkAlongTrack(100));
    document.getElementById('btn-panel-prev-station')?.addEventListener('click', () => stepStation(-1, true));
    document.getElementById('btn-panel-next-station')?.addEventListener('click', () => stepStation(1, true));
    // ── Station Stepper Dropdown Menu Controller ────────────────────────
    const dropdownEl = document.getElementById('station-stepper-dropdown');
    const searchInput = document.getElementById('stepper-station-search');
    const searchClearBtn = document.getElementById('btn-stepper-search-clear');
    const dropdownList = document.getElementById('stepper-dropdown-list');
    let currentDropdownTab = 'active'; // 'active' | 'all' | 'yellow' | 'blue'

    function closeStepperDropdown() {
      if (!dropdownEl || dropdownEl.classList.contains('hidden')) return;
      dropdownEl.classList.add('hidden');
      document.getElementById('btn-station-step-info')?.setAttribute('aria-expanded', 'false');
    }

    function openStepperDropdown() {
      if (!dropdownEl) return;
      dropdownEl.classList.remove('hidden');
      document.getElementById('btn-station-step-info')?.setAttribute('aria-expanded', 'true');
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      if (searchClearBtn) searchClearBtn.classList.add('hidden');
      renderDropdownStations();
    }

    function toggleStepperDropdown() {
      if (dropdownEl && !dropdownEl.classList.contains('hidden')) {
        closeStepperDropdown();
      } else {
        openStepperDropdown();
      }
    }

    function getStationsForDropdownTab(tab) {
      const activeLine = (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getActiveLine === 'function')
        ? window.MetroWebGLLayer.getActiveLine()
        : 'yellow';
      const allStations = (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getStations === 'function')
        ? window.MetroWebGLLayer.getStations()
        : (window.TripEngine ? TripEngine.getStations() : []);

      if (tab === 'yellow') {
        return allStations.filter(s => s.lineId === 'yellow' || s.isYellow || (!s.isBlue && !s.isOrange && !s.isMagenta && s.lineId !== 'blue' && s.lineId !== 'blue-vaishali' && s.lineId !== 'orange' && s.lineId !== 'magenta'));
      }
      if (tab === 'blue') {
        return allStations.filter(s => s.lineId === 'blue' || s.lineId === 'blue-vaishali' || s.isBlue);
      }
      if (tab === 'orange') {
        return allStations.filter(s => s.lineId === 'orange' || s.lineKey === 'orange' || s.isOrange);
      }
      if (tab === 'magenta') {
        return allStations.filter(s => s.lineId === 'magenta' || s.lineKey === 'magenta' || s.isMagenta);
      }
      if (tab === 'all') {
        return allStations;
      }
      // 'active'
      if (activeLine === 'orange') {
        return allStations.filter(s => s.lineId === 'orange' || s.lineKey === 'orange' || s.isOrange);
      }
      if (activeLine === 'magenta') {
        return allStations.filter(s => s.lineId === 'magenta' || s.lineKey === 'magenta' || s.isMagenta);
      }
      if (activeLine === 'blue') {
        return allStations.filter(s => s.lineId === 'blue' || s.lineId === 'blue-vaishali' || s.isBlue);
      }
      if (activeLine === 'yellow') {
        return allStations.filter(s => s.lineId === 'yellow' || s.isYellow || (!s.isBlue && !s.isOrange && !s.isMagenta && s.lineId !== 'blue' && s.lineId !== 'blue-vaishali' && s.lineId !== 'orange' && s.lineId !== 'magenta'));
      }
      return allStations;
    }

    function renderDropdownStations() {
      if (!dropdownList) return;
      const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
      const rawStations = getStationsForDropdownTab(currentDropdownTab);
      const filtered = q
        ? rawStations.filter(s => {
          const name = String(s.name || '').toLowerCase();
          const hindi = String(s.hindi || '').toLowerCase();
          const inter = String(s.interchange || '').toLowerCase();
          const inters = Array.isArray(s.interchanges) ? s.interchanges.join(' ').toLowerCase() : '';
          return name.includes(q) || hindi.includes(q) || inter.includes(q) || inters.includes(q);
        })
        : rawStations;

      if (!filtered.length) {
        dropdownList.innerHTML = `
          <div style="padding: 24px 12px; text-align: center; color: rgba(248,250,252,0.50); font-size: 11px;">
            No stations match "<strong>${q}</strong>"
          </div>
        `;
        return;
      }

      const activeStations = getOrderedYellowStations();
      const curSt = activeStations[currentStepperIndex];
      const curNameNorm = curSt ? String(curSt.name || '').toLowerCase().replace(/[-–—]/g, ' ').trim() : '';

      dropdownList.innerHTML = filtered.map((st, idx) => {
        const isOrange = Boolean(st.lineId === 'orange' || st.lineKey === 'orange' || st.isOrange);
        const isMagenta = Boolean(st.lineId === 'magenta' || st.lineKey === 'magenta' || st.isMagenta);
        const isVaishali = Boolean(st.lineId === 'blue-vaishali' || (st.corridor && st.corridor.lineId === 'blue-vaishali'));
        const isB = Boolean(!isOrange && !isMagenta && (st.isBlue || st.lineId === 'blue' || isVaishali));
        const lineTag = isOrange ? 'OE' : (isMagenta ? 'ML' : (isVaishali ? 'BV' : (isB ? 'BL' : 'YL')));
        const lineClass = isOrange ? 'line-orange' : (isMagenta ? 'line-magenta' : (isB ? 'line-blue' : 'line-yellow'));
        const lineAttr = isOrange ? 'orange' : (isMagenta ? 'magenta' : (isB ? 'blue' : 'yellow'));
        const stNameNorm = String(st.name || '').toLowerCase().replace(/[-–—]/g, ' ').trim();
        const isActive = curNameNorm && stNameNorm === curNameNorm;
        const totalLineCount = isOrange ? 7 : (isMagenta ? 25 : (isVaishali ? 8 : (isB ? 50 : 37)));
        const seqText = `${(st.seqIndex !== undefined ? st.seqIndex : idx) + 1}/${totalLineCount}`;

        let structBadge = '';
        if (st.structure === 'at-grade') {
          structBadge = '<span class="stepper-badge stepper-badge-fork">At-Grade 0m</span>';
        } else if (st.structure === 'elevated') {
          structBadge = `<span class="stepper-badge stepper-badge-structure">Elevated +${st.elevM || 15}m</span>`;
        } else {
          structBadge = `<span class="stepper-badge stepper-badge-structure">Tube ${st.elevM || -18}m</span>`;
        }

        let termBadge = st.terminus ? '<span class="stepper-badge stepper-badge-terminus">TERMINUS</span>' : '';
        let intBadge = '';
        if (st.name === 'Yamuna Bank') {
          intBadge = '<span class="stepper-badge stepper-badge-fork">NOIDA × VAISHALI FORK</span>';
        } else if (st.interchange || (st.interchanges && st.interchanges.length)) {
          const intText = st.interchange || st.interchanges[0];
          intBadge = `<span class="stepper-badge stepper-badge-interchange">${intText}</span>`;
        }

        return `
          <button class="stepper-item ${isActive ? 'active' : ''}" type="button" data-name="${st.name}" data-line="${lineAttr}" role="option" aria-selected="${isActive}">
            <span class="stepper-item-num ${lineClass}">${lineTag}</span>
            <div class="stepper-item-info">
              <div class="stepper-item-top">
                <span class="stepper-item-name">${st.name}</span>
                ${st.hindi ? `<span class="stepper-item-hindi">${st.hindi}</span>` : ''}
              </div>
              <div class="stepper-item-sub">
                <span style="font-family: var(--font-mono); font-size: 8.5px; opacity: 0.60;">${seqText}</span>
                ${structBadge}
                ${termBadge}
                ${intBadge}
              </div>
            </div>
            ${isActive ? '<span class="stepper-item-active-dot"></span>' : ''}
          </button>
        `;
      }).join('');

      const activeEl = dropdownList.querySelector('.stepper-item.active');
      if (activeEl && !q) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }

    document.getElementById('btn-station-step-info')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStepperDropdown();
    });

    searchInput?.addEventListener('input', () => {
      if (searchClearBtn) searchClearBtn.classList.toggle('hidden', !searchInput.value);
      renderDropdownStations();
    });

    searchClearBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (searchClearBtn) searchClearBtn.classList.add('hidden');
      renderDropdownStations();
      searchInput?.focus();
    });

    document.querySelectorAll('.stepper-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.stepper-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentDropdownTab = e.currentTarget.getAttribute('data-tab') || 'active';
        renderDropdownStations();
      });
    });

    dropdownList?.addEventListener('click', (e) => {
      const item = e.target.closest('.stepper-item');
      if (!item) return;
      const stName = item.getAttribute('data-name');
      const stLine = item.getAttribute('data-line');
      if (!stName) return;

      closeStepperDropdown();

      const activeLine = (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getActiveLine === 'function')
        ? window.MetroWebGLLayer.getActiveLine()
        : 'all';
      if (activeLine !== 'all' && activeLine !== stLine) {
        const btnId = stLine === 'orange'
          ? 'btn-line-orange'
          : (stLine === 'magenta'
            ? 'btn-line-magenta'
            : (stLine === 'blue' ? 'btn-line-blue' : 'btn-line-yellow'));
        document.getElementById(btnId)?.click();
      }

      syncStationStepper(stName);
      if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.flyToStation === 'function') {
        window.MetroWebGLLayer.flyToStation(stName);
      }
    });

    document.addEventListener('click', (e) => {
      if (!dropdownEl || dropdownEl.classList.contains('hidden')) return;
      if (!dropdownEl.contains(e.target) && !document.getElementById('station-stepper-pill')?.contains(e.target)) {
        closeStepperDropdown();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dropdownEl && !dropdownEl.classList.contains('hidden')) {
        closeStepperDropdown();
      }
    });

    // Quick Bookmarks
    document.querySelectorAll('.bookmark-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bookmark-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const loc = btn.getAttribute('data-loc');
        followTrainId = null;
        if (BOOKMARK_STATION_NAMES[loc]) {
          syncStationStepper(BOOKMARK_STATION_NAMES[loc]);
          if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.anchorTrackToStation === 'function') {
            window.MetroWebGLLayer.anchorTrackToStation(BOOKMARK_STATION_NAMES[loc]);
          }
        }

        const targetView = BOOKMARK_VIEWS[loc];
        if (targetView) {
          if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.prewarmOvertureAtLngLat === 'function') {
            window.MetroWebGLLayer.prewarmOvertureAtLngLat(targetView.center[0], targetView.center[1], true);
          }
          map.flyTo(targetView);
        } else if (loc === 'all') {
          if (typeof stop360Orbit === 'function') stop360Orbit();
          map.flyTo({ center: [77.1550, 28.5980], zoom: 9.85, pitch: 0, bearing: 0, duration: 1200 });
          const btn2D = document.getElementById('btn-2d-map-view') || document.getElementById('btn-2d-view');
          const btn3D = document.getElementById('btn-3d-map-view') || document.getElementById('btn-3d-view');
          if (btn2D && btn3D) {
            btn2D.classList.add('active');
            btn3D.classList.remove('active');
          }
          return;
        }
        const btn2D = document.getElementById('btn-2d-map-view') || document.getElementById('btn-2d-view');
        const btn3D = document.getElementById('btn-3d-map-view') || document.getElementById('btn-3d-view');
        if (btn2D && btn3D) {
          btn3D.classList.add('active');
          btn2D.classList.remove('active');
        }
      });
    });

    // Full 360° Interactive Orbit + Pan Mode + Turntable Spin + Rails/X-Ray toggles on MapLibre
    const btnDragOrbit = document.getElementById('btn-drag-orbit');
    const btnDragPan = document.getElementById('btn-drag-pan');
    const btn360Spin = document.getElementById('btn-360-orbit');
    const btnRailsVisible = document.getElementById('btn-rails-visible');
    const btnXrayUnderground = document.getElementById('btn-xray-underground');

    if (btnRailsVisible) {
      btnRailsVisible.addEventListener('click', () => {
        if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.setSubwayRailsVisible === 'function') {
          const next = !(window.MetroWebGLLayer.isSubwayRailsVisible && window.MetroWebGLLayer.isSubwayRailsVisible());
          window.MetroWebGLLayer.setSubwayRailsVisible(next);
          btnRailsVisible.classList.toggle('active', next);
        }
      });
    }

    if (btnXrayUnderground) {
      btnXrayUnderground.addEventListener('click', () => {
        if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.setUndergroundXRay === 'function') {
          const next = !(window.MetroWebGLLayer.isUndergroundXRay && window.MetroWebGLLayer.isUndergroundXRay());
          window.MetroWebGLLayer.setUndergroundXRay(next);
          btnXrayUnderground.classList.toggle('active', next);
        }
      });
    }

    ['btn-line-all', 'btn-line-yellow', 'btn-line-blue', 'btn-line-orange', 'btn-line-magenta'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', (e) => {
        ['btn-line-all', 'btn-line-yellow', 'btn-line-blue', 'btn-line-orange', 'btn-line-magenta'].forEach((bId) => {
          document.getElementById(bId)?.classList.remove('active');
        });
        e.currentTarget.classList.add('active');
        const lineId = id === 'btn-line-blue'
          ? 'blue'
          : (id === 'btn-line-yellow'
            ? 'yellow'
            : (id === 'btn-line-orange'
              ? 'orange'
              : (id === 'btn-line-magenta' ? 'magenta' : 'all')));
        if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.setLineFilter === 'function') {
          window.MetroWebGLLayer.setLineFilter(lineId);
        }
        syncStationStepper(0);
        if (lineId === 'blue') {
          if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.flyToStation === 'function') {
            window.MetroWebGLLayer.flyToStation('Dwarka Sector - 21');
          }
        } else if (lineId === 'yellow') {
          if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.flyToStation === 'function') {
            window.MetroWebGLLayer.flyToStation('Samaypur Badli');
          }
        } else if (lineId === 'orange') {
          if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.flyToStation === 'function') {
            window.MetroWebGLLayer.flyToStation('Dhaula Kuan');
          }
        } else if (lineId === 'magenta') {
          if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.flyToStation === 'function') {
            window.MetroWebGLLayer.flyToStation('Janakpuri West');
          }
        } else {
          if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.flyToStation === 'function') {
            window.MetroWebGLLayer.flyToStation('Rajiv Chowk');
          }
        }
      });
    });

    let leftDragMode = 'orbit'; // Default in 3D Fleet & Map: Left-Drag rotates 360° & tilts 8°–82°!
    let autoSpinActive = false;
    let spinRaf = null;
    let spinLast = 0;

    // Smooth unified Orbit / Pan pointer controller with velocity-handoff momentum (§2, §5, §6 Apple Design)
    let dragKind = null; // 'orbit' | 'pan'
    let lastPtrX = 0;
    let lastPtrY = 0;
    let lastMoveTs = 0;
    let orbitVelB = 0;
    let orbitVelP = 0;
    let momentumRaf = null;
    const reducedMotionMQ = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

    function stopOrbitMomentum() {
      orbitVelB = 0;
      orbitVelP = 0;
      if (momentumRaf) {
        cancelAnimationFrame(momentumRaf);
        momentumRaf = null;
      }
    }

    function startOrbitMomentum() {
      if (reducedMotionMQ && reducedMotionMQ.matches) {
        stopOrbitMomentum();
        return;
      }
      if (Math.abs(orbitVelB) < 6 && Math.abs(orbitVelP) < 4) {
        stopOrbitMomentum();
        return;
      }
      let prevTs = performance.now();
      function glide(now) {
        if (!map || dragKind || autoSpinActive) {
          stopOrbitMomentum();
          return;
        }
        const dt = Math.min(0.05, Math.max(0.001, (now - prevTs) / 1000));
        prevTs = now;
        const decay = Math.exp(-dt * 8.2);
        orbitVelB *= decay;
        orbitVelP *= decay;
        if (Math.abs(orbitVelB) < 2.0 && Math.abs(orbitVelP) < 1.5) {
          stopOrbitMomentum();
          return;
        }
        map.jumpTo({
          bearing: map.getBearing() + orbitVelB * dt,
          pitch: Math.max(8, Math.min(74, map.getPitch() - orbitVelP * dt))
        });
        momentumRaf = requestAnimationFrame(glide);
      }
      if (!momentumRaf) momentumRaf = requestAnimationFrame(glide);
    }

    function syncCameraDragMode(mode) {
      leftDragMode = mode;
      stopOrbitMomentum();
      if (btnDragOrbit) btnDragOrbit.classList.toggle('active', mode === 'orbit');
      if (btnDragPan) btnDragPan.classList.toggle('active', mode === 'pan');
      if (!map) return;

      if (mode === 'orbit') {
        if (map.dragPan) map.dragPan.disable();
        if (map.dragRotate) map.dragRotate.disable();
        map.getCanvas().style.cursor = 'grab';
      } else {
        if (map.dragPan) map.dragPan.enable();
        if (map.dragRotate) map.dragRotate.enable();
        map.getCanvas().style.cursor = '';
      }
    }

    function stop360Orbit() {
      autoSpinActive = false;
      if (spinRaf) {
        cancelAnimationFrame(spinRaf);
        spinRaf = null;
      }
      if (btn360Spin) btn360Spin.classList.remove('active');
    }

    function start360Orbit() {
      if (!map) return;
      stopOrbitMomentum();
      autoSpinActive = true;
      if (btn360Spin) btn360Spin.classList.add('active');
      syncCameraDragMode('orbit');
      if (btn3D && btn2D) {
        btn3D.classList.add('active');
        btn2D.classList.remove('active');
      }
      if (map.getPitch() < 45) {
        map.easeTo({ pitch: 60, duration: 500 });
      }
      spinLast = performance.now();

      function spinTick(now) {
        if (!autoSpinActive || !map) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - spinLast) / 1000));
        spinLast = now;
        map.setBearing((map.getBearing() + dt * 15) % 360);
        spinRaf = requestAnimationFrame(spinTick);
      }
      if (!spinRaf) spinRaf = requestAnimationFrame(spinTick);
    }

    if (btnDragOrbit) {
      btnDragOrbit.addEventListener('click', () => {
        syncCameraDragMode('orbit');
        if (map && map.getPitch() < 25) map.easeTo({ pitch: 54, duration: 500 });
      });
    }
    if (btnDragPan) {
      btnDragPan.addEventListener('click', () => {
        stop360Orbit();
        syncCameraDragMode('pan');
      });
    }
    if (btn360Spin) {
      btn360Spin.addEventListener('click', () => {
        if (autoSpinActive) stop360Orbit();
        else start360Orbit();
      });
    }
    if (btn3D) {
      btn3D.addEventListener('click', () => {
        syncCameraDragMode('orbit');
      });
    }
    if (btn2D) {
      btn2D.addEventListener('click', () => {
        stop360Orbit();
        syncCameraDragMode('pan');
      });
    }

    // Apply default Left-Drag 360° Orbit immediately & sync on style.load
    if (map) {
      syncCameraDragMode('orbit');
      map.on('style.load', () => syncCameraDragMode(leftDragMode));
      map.on('wheel', stopOrbitMomentum);
    }

    const mapContainerEl = document.getElementById('map');
    if (mapContainerEl) {
      const activeTouchIds = new Set();
      let activeDragPtrId = null;

      mapContainerEl.addEventListener('contextmenu', (e) => {
        if (leftDragMode === 'orbit') e.preventDefault();
      });
      mapContainerEl.addEventListener('pointerdown', (e) => {
        if (!map) return;
        if (e.pointerType === 'touch') {
          activeTouchIds.add(e.pointerId);
          // Immediately yield multi-finger pinch/pan/tilt gestures to MapLibre native touchZoomRotate/touchPitch
          if (activeTouchIds.size > 1) {
            if (activeDragPtrId !== null) {
              try { mapContainerEl.releasePointerCapture(activeDragPtrId); } catch (_) { }
              activeDragPtrId = null;
            }
            dragKind = null;
            stopOrbitMomentum();
            return;
          }
        }
        if (autoSpinActive) stop360Orbit();
        stopOrbitMomentum();

        if (leftDragMode === 'orbit') {
          if (e.button === 0 && !e.shiftKey) {
            dragKind = 'orbit';
          } else if (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey)) {
            dragKind = 'pan';
          }
          if (dragKind) {
            activeDragPtrId = e.pointerId;
            lastPtrX = e.clientX;
            lastPtrY = e.clientY;
            lastMoveTs = performance.now();
            orbitVelB = 0;
            orbitVelP = 0;
            try { mapContainerEl.setPointerCapture(e.pointerId); } catch (_) { }
            map.getCanvas().style.cursor = 'grabbing';
          }
        }
      });

      window.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch' && activeTouchIds.size > 1) {
          dragKind = null;
          return;
        }
        if (!dragKind || !map || (activeDragPtrId !== null && e.pointerId !== activeDragPtrId)) return;
        const now = performance.now();
        const dt = Math.max(0.004, (now - lastMoveTs) / 1000);
        const dx = e.clientX - lastPtrX;
        const dy = e.clientY - lastPtrY;
        lastPtrX = e.clientX;
        lastPtrY = e.clientY;
        lastMoveTs = now;
        if (dragKind === 'orbit') {
          const dB = dx * 0.45;
          const dP = dy * 0.36;
          orbitVelB = Math.max(-420, Math.min(420, orbitVelB * 0.62 + (dB / dt) * 0.38));
          orbitVelP = Math.max(-260, Math.min(260, orbitVelP * 0.62 + (dP / dt) * 0.38));
          const nextBearing = map.getBearing() + dB;
          const nextPitch = Math.max(8, Math.min(74, map.getPitch() - dP));
          map.jumpTo({ bearing: nextBearing, pitch: nextPitch });
        } else if (dragKind === 'pan') {
          map.panBy([-dx, -dy], { animate: false });
        }
      });

      const endDrag = (e) => {
        if (e && e.pointerType === 'touch') {
          activeTouchIds.delete(e.pointerId);
        }
        if (!dragKind) return;
        if (e && activeDragPtrId !== null && e.pointerId !== activeDragPtrId) return;
        const wasOrbit = dragKind === 'orbit';
        dragKind = null;
        activeDragPtrId = null;
        if (e && e.pointerId !== undefined) {
          try { mapContainerEl.releasePointerCapture(e.pointerId); } catch (_) { }
        }
        if (map) map.getCanvas().style.cursor = leftDragMode === 'orbit' ? 'grab' : '';
        if (wasOrbit && activeTouchIds.size === 0 && (performance.now() - lastMoveTs < 85)) {
          startOrbitMomentum();
        } else {
          stopOrbitMomentum();
        }
      };
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
    }

    // Keyboard Q/E/Arrows 360° camera rotation & pitch when MapLibre tab is active
    window.addEventListener('keydown', (e) => {
      if (!map || !document.getElementById('tab-corridor')?.classList.contains('active')) return;
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') {
        map.easeTo({ bearing: map.getBearing() - 18, duration: 160 });
      } else if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') {
        map.easeTo({ bearing: map.getBearing() + 18, duration: 160 });
      } else if (e.key === 'ArrowUp') {
        map.easeTo({ pitch: Math.min(74, map.getPitch() + 8), duration: 160 });
      } else if (e.key === 'ArrowDown') {
        map.easeTo({ pitch: Math.max(8, map.getPitch() - 8), duration: 160 });
      }
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
        if (window.MetroWebGLLayer && window.MetroWebGLLayer.setSelectedStation) {
          window.MetroWebGLLayer.setSelectedStation(null);
        }
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
        if (window.MetroWebGLLayer && window.MetroWebGLLayer.setTimeOfDay) {
          window.MetroWebGLLayer.setTimeOfDay(sec);
        }
      });

      timelineSlider.addEventListener('change', () => {
        isDraggingSlider = false;
        const sec = parseInt(timelineSlider.value, 10);
        customTimeSeconds = sec;
        timeMode = 'custom';
        document.querySelectorAll('.time-preset-chip').forEach(c => c.classList.remove('active'));
        if (window.MetroWebGLLayer && window.MetroWebGLLayer.setTimeOfDay) {
          window.MetroWebGLLayer.setTimeOfDay(sec, true);
        }
      });
    }

    // Toggle between Live IST Clock & Custom Scrub Mode
    const toggleTimeModeBtn = document.getElementById('btn-toggle-time-mode');
    if (toggleTimeModeBtn) {
      toggleTimeModeBtn.addEventListener('click', () => {
        timeMode = (timeMode === 'live') ? 'custom' : 'live';
        if (timeMode === 'live') {
          document.querySelectorAll('.time-preset-chip').forEach(c => c.classList.remove('active'));
          const now = new Date(Date.now() + (window.CLOCK_SKEW_MS || 0));
          const utc = now.getTime() + now.getTimezoneOffset() * 60000;
          const ist = new Date(utc + 5.5 * 3600000);
          const liveSec = ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds();
          if (window.MetroWebGLLayer && window.MetroWebGLLayer.setTimeOfDay) {
            window.MetroWebGLLayer.setTimeOfDay(liveSec, true);
          }
        } else if (window.MetroWebGLLayer && window.MetroWebGLLayer.setTimeOfDay) {
          window.MetroWebGLLayer.setTimeOfDay(customTimeSeconds, true);
        }
      });
    }

    // Quick 24h Timeline Preset Buttons (05:30 First, 09:15 Peak, 18:10 Dusk, 23:00 Last, 02:00 Maintenance)
    document.querySelectorAll('.time-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.time-preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const sec = parseInt(chip.getAttribute('data-time'), 10);
        customTimeSeconds = sec;
        timeMode = 'custom';
        if (window.MetroWebGLLayer && window.MetroWebGLLayer.setTimeOfDay) {
          window.MetroWebGLLayer.setTimeOfDay(sec, true);
        }
      });
    });

    initStationTabs();
    initStationSearch();
  }

  function setupInteractions() {
    ['train-consist-3d', 'train-dot-white-black'].forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.on('click', layerId, onTrainClick);
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
      }
    });

    // Click station platform to open Station Schedule Panel (legacy GeoJSON fallback layers)
    ['platform-slab-deck-elevated', 'platform-slab-deck-underground'].forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.on('click', layerId, (e) => {
          const feat = e.features && e.features[0];
          if (feat && feat.properties) {
            const val = (feat.properties.index !== undefined && feat.properties.index !== null) ? parseInt(feat.properties.index, 10) : feat.properties.name;
            openStationPanel(val);
          }
        });
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
      }
    });
    if (map.getLayer('platform-canopy-3d')) {
      map.on('click', 'platform-canopy-3d', (e) => {
        const feat = e.features && e.features[0];
        if (feat && feat.properties) {
          openStationPanel(feat.properties.name);
        }
      });
    }

    ['station-labels-major', 'station-labels-local'].forEach(layerId => {
      if (!map.getLayer(layerId)) return;
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
  }

  function openStationPanel(stIndexOrName, skipFly = false) {
    let stIdx = -1;
    let stationObj = null;
    const normStation = (s) => String(s || '').toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+gurugram\b/, '').replace(/\s+/g, ' ').trim();

    const activeList = (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getActiveStations === 'function')
      ? window.MetroWebGLLayer.getActiveStations()
      : [];
    const allList = (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getStations === 'function')
      ? window.MetroWebGLLayer.getStations()
      : (window.TripEngine ? TripEngine.getStations() : []);

    if (typeof stIndexOrName === 'number') {
      if (activeList[stIndexOrName]) {
        stationObj = activeList[stIndexOrName];
        stIdx = stIndexOrName;
      } else if (allList[stIndexOrName]) {
        stationObj = allList[stIndexOrName];
        stIdx = stIndexOrName;
      }
    } else if (stIndexOrName) {
      const q = normStation(stIndexOrName);
      stIdx = activeList.findIndex((s) => normStation(s.name) === q || s.id === stIndexOrName);
      if (stIdx >= 0) {
        stationObj = activeList[stIdx];
      } else {
        const globalIdx = allList.findIndex((s) => normStation(s.name) === q || s.id === stIndexOrName);
        if (globalIdx >= 0) {
          stationObj = allList[globalIdx];
          stIdx = globalIdx;
        }
      }
    }

    if (!stationObj && window.DelhiMetro3D) {
      stationObj = window.DelhiMetro3D.getStationByName(stIndexOrName);
    }

    if (!stationObj) return;
    activeStationIndex = stIdx;

    if (window.MetroWebGLLayer && window.MetroWebGLLayer.closeMonumentSpotlight) {
      window.MetroWebGLLayer.closeMonumentSpotlight();
    }
    if (window.MetroWebGLLayer && window.MetroWebGLLayer.setSelectedStation && stationObj.name) {
      window.MetroWebGLLayer.setSelectedStation(stationObj.name);
    }
    if (typeof window.syncStationStepper === 'function') {
      window.syncStationStepper(stIdx >= 0 ? stIdx : stationObj.name);
    }

    // Fly camera in 3D or MapLibre unless caller already triggered flyToStation
    if (!skipFly) {
      if (window.DelhiMetro3D && stationObj.name) {
        window.DelhiMetro3D.flyToStation(stationObj.name, stationObj.x, stationObj.z);
      }
      if (map && stationObj.coords) {
        map.easeTo({ center: stationObj.coords, zoom: Math.max(map.getZoom(), 14.5), duration: 800 });
      }
    }

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

    if (stIdx >= 0) {
      renderStationPanel(stIdx, sec, dayVariant);
    } else {
      renderNetworkStationPanel(stationObj, sec);
    }

    const panel = document.getElementById('station-panel');
    if (panel) panel.classList.remove('hidden');
  }

  function renderNetworkStationPanel(st, sec) {
    const titleEl = document.getElementById('st-panel-title');
    const codeEl = document.getElementById('st-panel-code');
    const interchangesEl = document.getElementById('st-panel-interchanges');
    const subEl = document.getElementById('st-panel-sub');
    const freqTextEl = document.getElementById('st-panel-freq-text');
    const p1List = document.getElementById('st-p1-arrivals');
    const p2List = document.getElementById('st-p2-arrivals');

    if (titleEl) titleEl.textContent = st.name;
    if (codeEl) codeEl.textContent = (st.id || 'DMRC').toUpperCase().slice(0, 5);

    if (interchangesEl) {
      if (st.interchange) {
        interchangesEl.innerHTML = `<span class="interchange-pill interchange-blue">⇄ ${st.interchange}</span>`;
        interchangesEl.classList.remove('hidden');
      } else {
        interchangesEl.innerHTML = '';
        interchangesEl.classList.add('hidden');
      }
    }

    if (subEl) {
      const struct = st.structure === 'elevated' ? 'Elevated Viaduct (+15m)' : 'Underground Subway (-14m)';
      const lineName = st.line ? st.line.replace('-', ' ').toUpperCase() : 'METRO CORRIDOR';
      subEl.textContent = `${struct} · ${lineName}`;
    }

    if (freqTextEl) {
      freqTextEl.textContent = 'Standard DMRC High-Capacity Transit · Trains every 3-5 min';
    }

    function formatTime(s) {
      const h = Math.floor(s / 3600) % 24;
      const m = Math.floor((s % 3600) / 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    if (p1List) {
      p1List.innerHTML = `
        <div class="st-arrival-item">
          <span class="st-arr-clock">${formatTime(sec + 120)}</span>
          <span class="st-arr-dest">➔ Down Line</span>
          <span class="st-arr-badge badge-approaching">2 min</span>
        </div>
        <div class="st-arrival-item">
          <span class="st-arr-clock">${formatTime(sec + 360)}</span>
          <span class="st-arr-dest">➔ Down Line</span>
          <span class="st-arr-badge badge-scheduled">6 min</span>
        </div>
      `;
    }

    if (p2List) {
      p2List.innerHTML = `
        <div class="st-arrival-item">
          <span class="st-arr-clock">${formatTime(sec + 180)}</span>
          <span class="st-arr-dest">➔ Up Line</span>
          <span class="st-arr-badge badge-approaching">3 min</span>
        </div>
        <div class="st-arrival-item">
          <span class="st-arr-clock">${formatTime(sec + 480)}</span>
          <span class="st-arr-dest">➔ Up Line</span>
          <span class="st-arr-badge badge-scheduled">8 min</span>
        </div>
      `;
    }

    const gatesCountEl = document.getElementById('st-gates-count');
    if (gatesCountEl) gatesCountEl.textContent = '4';
    const gatesListEl = document.getElementById('st-gates-list');
    if (gatesListEl) {
      gatesListEl.innerHTML = `
        <div class="gate-card">
          <div class="gate-header"><span class="gate-number">Gate 1</span><span class="gate-access">♿ Wheelchair Accessible</span></div>
          <div class="gate-landmarks">Main Arterial Road & Feeder Terminal</div>
        </div>
        <div class="gate-card">
          <div class="gate-header"><span class="gate-number">Gate 2</span></div>
          <div class="gate-landmarks">Market Complex & Metro Station Concourse</div>
        </div>
        <div class="gate-card">
          <div class="gate-header"><span class="gate-number">Gate 3</span></div>
          <div class="gate-landmarks">Pedestrian Subway & Public Transit Interchange</div>
        </div>
        <div class="gate-card">
          <div class="gate-header"><span class="gate-number">Gate 4</span><span class="gate-access">♿ Lift Access</span></div>
          <div class="gate-landmarks">Auto / Taxi Stand & Kiss-and-Ride Bay</div>
        </div>
      `;
    }
  }

  function renderStationPanel(stIdx, sec, dayVariant) {
    const activeList = (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getActiveStations === 'function')
      ? window.MetroWebGLLayer.getActiveStations()
      : (window.TripEngine ? TripEngine.getStations() : []);
    const st = activeList[stIdx] || (window.TripEngine ? TripEngine.getStations()[stIdx] : null);
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
        if (document.getElementById('tab-threejs')?.classList.contains('active') && window.DelhiMetro3D) {
          document.getElementById('btn-follow-train-3d')?.click();
          followNextBtn.textContent = 'Tracking Live 3D Train 🟢';
          return;
        }
        if (activeTrains && activeTrains.length > 0) {
          const match = activeTrains.find(t => t.toStation === st.name || t.currentStation === st.name) || activeTrains[0];
          if (match) {
            followTrainId = match.id;
            selectedTrainId = match.id;
            updateCalloutCard(match);
            document.getElementById('inspector-card').classList.remove('hidden');
            followNextBtn.textContent = `Tracking ${match.id} 🟢`;
            if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.prewarmOvertureAtLngLat === 'function' && match.coords) {
              window.MetroWebGLLayer.prewarmOvertureAtLngLat(match.coords[0], match.coords[1], true);
            }
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
        freqTextEl.textContent = 'Central High-Frequency Zone · Trains every ~2.5 min (150s headway)';
      } else if (isNorthOuter) {
        freqTextEl.textContent = 'North Outer Sector (Samaypur Badli–Vishwavidyalaya) · Trains every ~5.0 min';
      } else {
        const shuttleActive = secInfo && secInfo.enable_south_shuttle;
        if (shuttleActive) {
          freqTextEl.textContent = 'South Outer Sector (Qutab–Gurugram Shuttle) · Trains every ~2.5 min';
        } else {
          freqTextEl.textContent = 'South Outer Sector (Qutab Minar–Millennium City) · Trains every ~5.0 min';
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

    // 3D Stage / Cutaway Trigger Buttons inside station drawer -> opens matching MetroKit archetype
    const openMatchingArchetype = () => {
      const rawArch = window.MetroKit && window.MetroKit.CityNodes
        ? window.MetroKit.CityNodes.resolveArchetype(st)
        : (st.structure === 'underground' ? 'undergroundIsland' : 'elevatedSide');
      const arch = rawArch === 'undergroundSide' ? 'undergroundIsland' : rawArch;
      window.switchSurface('diorama');
      if (window.Diorama3D && window.Diorama3D.switchStage) {
        window.Diorama3D.switchStage(arch);
      }
    };
    const view3dBtn = document.getElementById('btn-view-3d-stage');
    if (view3dBtn) view3dBtn.onclick = openMatchingArchetype;

    const cutawayBtn = document.getElementById('btn-open-station-cutaway');
    const cutawayBlock = document.getElementById('st-cutaway-link-block');
    if (cutawayBtn && cutawayBlock) {
      cutawayBtn.textContent = '📐 View 3D Station Cutaway Stage →';
      cutawayBtn.onclick = openMatchingArchetype;
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
      const q = query.trim().toLowerCase();
      if (!q) return [];

      let allStations = [];
      const isThreePlinth = document.getElementById('tab-threejs')?.classList.contains('active');
      if (isThreePlinth && window.DelhiMetro3D && window.DelhiMetro3D.getStations) {
        allStations = window.DelhiMetro3D.getStations();
      }
      if ((!allStations || allStations.length === 0) && window.MetroWebGLLayer && window.MetroWebGLLayer.getStations) {
        allStations = window.MetroWebGLLayer.getStations();
      }
      if (!allStations || allStations.length === 0) {
        if (window.DelhiMetro3D && window.DelhiMetro3D.getStations) {
          allStations = window.DelhiMetro3D.getStations();
        }
      }
      if (!allStations || allStations.length === 0) {
        if (window.TripEngine) allStations = TripEngine.getStations();
      }

      return allStations.filter(st => {
        const matchName = st.name.toLowerCase().includes(q);
        const matchCode = st.code && st.code.toLowerCase().includes(q);
        const matchInterchange = (st.interchange && st.interchange.toLowerCase().includes(q)) ||
          (st.interchanges && st.interchanges.some(i => i.toLowerCase().includes(q)));
        return matchName || matchCode || matchInterchange;
      });
    }

    searchInput.addEventListener('input', () => {
      const q = searchInput.value;
      if (clearBtn) clearBtn.classList.toggle('hidden', !q);
      const qLower = q.trim().toLowerCase();
      const matches = filterStations(q);
      const monuments = (qLower && window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getMonuments === 'function')
        ? window.MetroWebGLLayer.getMonuments().filter((m) =>
          m.name.toLowerCase().includes(qLower) ||
          (m.era && m.era.toLowerCase().includes(qLower))
        )
        : [];
      const railHubs = (qLower && window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getRailwayHubs === 'function')
        ? window.MetroWebGLLayer.getRailwayHubs().filter((rh) =>
          rh.name.toLowerCase().includes(qLower) ||
          rh.code.toLowerCase().includes(qLower) ||
          (Array.isArray(rh.aliases) && rh.aliases.some((a) => a.toLowerCase().includes(qLower))) ||
          'indian railways'.includes(qLower)
        ).sort((a, b) => {
          const aExact = a.code.toLowerCase() === qLower || a.name.toLowerCase().startsWith(qLower) ? 0 : 1;
          const bExact = b.code.toLowerCase() === qLower || b.name.toLowerCase().startsWith(qLower) ? 0 : 1;
          return aExact - bExact;
        }).slice(0, 8)
        : [];
      const stationStartsFirst = matches.some((st) => st.name.toLowerCase().startsWith(qLower));

      const railHtml = railHubs.map((rh) => `
          <div class="search-result-item" data-rail-hub-id="${rh.id}">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="width:8px; height:8px; border-radius:50%; background:#1D4ED8; display:inline-block; flex-shrink:0;"></span>
              <span class="search-result-name">🚉 ${rh.name}</span>
            </div>
            <div class="search-result-meta">
              <span class="interchange-pill interchange-railways">${rh.platformsLabel}</span>
              <span class="dmrc-code-badge">${rh.code}</span>
            </div>
          </div>
        `).join('');

      const landmarkHtml = monuments.slice(0, 4).map((m) => {
        const nearList = (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getNearestStationsForLngLat === 'function')
          ? window.MetroWebGLLayer.getNearestStationsForLngLat(m.coords, 2)
          : [];
        const nearStr = nearList.length
          ? nearList.map((n) => `${n.station.name} (${n.distanceM >= 1000 ? `${(n.distanceM / 1000).toFixed(1)}km` : `${n.distanceM}m`})`).join(' · ')
          : m.station;
        return `
          <div class="search-result-item" data-monument-id="${m.id}">
            <div style="display:flex; align-items:center; gap:8px;">
              <img src="${m.img}" alt="" style="width:22px; height:22px; border-radius:6px; object-fit:cover; flex-shrink:0;" />
              <span class="search-result-name">🏛️ ${m.name}</span>
            </div>
            <div class="search-result-meta">
              <span class="interchange-pill interchange-blue">🚇 ${nearStr}</span>
            </div>
          </div>
        `;
      }).join('');

      const stationHtml = matches.slice(0, 8).map(st => `
          <div class="search-result-item" data-st-name="${st.name}" data-st-idx="${st.index !== undefined ? st.index : -1}">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="width:8px; height:8px; border-radius:50%; background:${st.lineColor || (st.lineId === 'blue' ? '#2563EB' : '#EAB308')}; display:inline-block; flex-shrink:0;"></span>
              <span class="search-result-name">${st.name}</span>
            </div>
            <div class="search-result-meta">
              ${st.interchange ? `<span class="interchange-pill interchange-blue">⇄ Interchange</span>` : (st.interchanges && st.interchanges.length > 0 ? `<span class="interchange-pill interchange-blue">⇄ ${st.interchanges[0]}</span>` : '')}
              <span class="dmrc-code-badge">${st.code || 'DMRC'}</span>
            </div>
          </div>
        `).join('');

      if (landmarkHtml || railHtml || stationHtml) {
        searchResults.innerHTML = stationStartsFirst ? (stationHtml + railHtml + landmarkHtml) : (landmarkHtml + railHtml + stationHtml);
        searchResults.classList.remove('hidden');
      } else if (qLower) {
        searchResults.innerHTML = '<div class="search-result-item" style="cursor:default; color:#94A3B8;">No station or landmark matches found</div>';
        searchResults.classList.remove('hidden');
      } else {
        searchResults.classList.add('hidden');
      }
    });

    searchResults.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (!item) return;
      const railId = item.getAttribute('data-rail-hub-id');
      if (railId && window.MetroWebGLLayer && typeof window.MetroWebGLLayer.flyToRailwayHub === 'function') {
        const tabCorridor = document.getElementById('tab-corridor');
        if (tabCorridor && !tabCorridor.classList.contains('active')) tabCorridor.click();
        window.MetroWebGLLayer.flyToRailwayHub(railId);
        searchResults.classList.add('hidden');
        searchInput.value = '';
        if (clearBtn) clearBtn.classList.add('hidden');
        return;
      }
      const monId = item.getAttribute('data-monument-id');
      if (monId && window.MetroWebGLLayer && typeof window.MetroWebGLLayer.flyToMonument === 'function') {
        const tabCorridor = document.getElementById('tab-corridor');
        if (tabCorridor && !tabCorridor.classList.contains('active')) tabCorridor.click();
        window.MetroWebGLLayer.flyToMonument(monId);
        searchResults.classList.add('hidden');
        searchInput.value = '';
        if (clearBtn) clearBtn.classList.add('hidden');
        return;
      }
      if (!item.hasAttribute('data-st-name')) return;
      const stName = item.getAttribute('data-st-name');
      const stIdx = parseInt(item.getAttribute('data-st-idx'), 10);

      // Fly in active surface: 3D Delhi Map (threejs) vs MapLibre street map
      const isThreePlinth = document.getElementById('tab-threejs')?.classList.contains('active');
      if (isThreePlinth && window.DelhiMetro3D) {
        window.DelhiMetro3D.flyToStation(stName);
      } else if (window.MetroWebGLLayer) {
        window.MetroWebGLLayer.flyToStation(stName);
      } else if (window.DelhiMetro3D) {
        window.DelhiMetro3D.flyToStation(stName);
      }
      if (window.openStationPanel) {
        window.openStationPanel(stName, true);
      }
      searchResults.classList.add('hidden');
      searchInput.value = '';
      if (clearBtn) clearBtn.classList.add('hidden');
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

    // Shortcut keys: "/" to focus search, "[" / "]" to step previous/next station
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (e.key === '/' && !inField) {
        e.preventDefault();
        searchInput.focus();
      } else if (e.key === '[' && !inField) {
        document.getElementById('btn-prev-station')?.click();
      } else if (e.key === ']' && !inField) {
        document.getElementById('btn-next-station')?.click();
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
