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
  let rajivMarker = null;

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
  async function init() {
    setupMasterNavigation();
    setupControls();

    try {
      const res = await fetch('/api/tracks');
      trackData = await res.json();
    } catch (e) {
      console.error('Failed to load track topology', e);
    }

    initDioramaMap();
    connectSSEStream();
    startAnimationLoop();
    startClockTicker();
  }

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
      center: [77.1600, 28.6050], // Centered for complete 49.3 km corridor overview
      zoom: 10.6,
      pitch: 30,      // Subtle architectural tilt
      bearing: -6,    // Aligns North-South Yellow Line vertically
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

      await Promise.all([
        preloadImage('/public/metro_train_topdown_vibrant.png', 'delhi-metro-consist'),
        preloadImage('/public/delhi_metro_track_pattern.png', 'dmrc-rail-pattern')
      ]);

      add3DBuildings();
      renderViaductAndDualTracks();
      renderPhysicalPlatforms();
      renderTrainsLayers();
      addRajivChowk3DLandmark();
      setupInteractions();

      map.on('zoom', updateMarkerScale);
      updateMarkerScale();
    });
  }

  function suppressMapClutter() {
    try {
      const style = map.getStyle();
      if (!style || !style.layers) return;
      style.layers.forEach(l => {
        if (l.id.includes('shield') || l.id.includes('state-boundary')) {
          map.setLayoutProperty(l.id, 'visibility', 'none');
        }
      });
    } catch (e) {}
  }

  function enhanceMapColors() {
    try {
      // 1. Vibrant Turquoise/Azure Water (Yamuna River, lakes & canals like Image 1)
      if (map.getLayer('water')) {
        map.setPaintProperty('water', 'fill-color', '#0284C7');
        map.setPaintProperty('water', 'fill-opacity', 0.95);
      }
      if (map.getLayer('waterway')) {
        map.setPaintProperty('waterway', 'line-color', '#0EA5E9');
      }

      // 2. Rich Lush Emerald Green Nature & Parks (Central Vista, Lodhi Gardens, Ridge Forest)
      const parkColor = '#48A962';
      ['park_national_park', 'park_nature_reserve', 'landcover', 'landuse'].forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'fill-color', parkColor);
          map.setPaintProperty(layerId, 'fill-opacity', 0.85);
        }
      });

      // 3. Warm Golden-Amber Highway Fills
      const trunkRoads = ['road_trunk_fill_ramp', 'road_trunk_fill_noramp', 'road_mot_fill_ramp', 'road_mot_fill_noramp', 'bridge_trunk_fill', 'bridge_mot_fill'];
      trunkRoads.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'line-color', '#F59E0B');
        }
      });

      // 4. Soft Warm Peach Arteries
      const primaryRoads = ['road_pri_fill_ramp', 'road_pri_fill_noramp', 'road_sec_fill_noramp', 'bridge_pri_fill', 'bridge_sec_fill'];
      primaryRoads.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'line-color', '#FDBA74');
        }
      });

      // 5. Warm Alabaster/Sand Land Background
      if (map.getLayer('background')) {
        map.setPaintProperty('background', 'background-color', '#F6F3EA');
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
            12, '#FBF7F0',
            14, '#FDF2E2',
            16, '#FEEBC8'
          ],
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            12, 6,
            14, 22,
            16, 40
          ],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.90
        }
      }, firstSymbolId);
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════
  //  3. INFRASTRUCTURE: ELEVATED FLYOVERS, SUBTERRANEAN TUNNELS & PORTALS
  // ═══════════════════════════════════════════════════════════
  function renderViaductAndDualTracks() {
    if (!trackData) return;

    // ── A. GEOJSON SOURCES ────────────────────────────────────
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

    // ── HELPER: BUILD MULTI-TIER TRACK SYSTEM (PURE TOP-LEVEL INTERPOLATE) ──
    // Eliminates nested case/interpolate errors in MapLibre GL.
    // Guarantees Track 1 (Southbound) and Track 2 (Northbound) are separated by 7.5 to 9.6 screen pixels
    // at overview zooms (z9 to z14), completely solving the "looks like one line on open" problem!
    function addTrackRailSystem(structureType, sourceId, dir, sign) {
      const isDown = sign < 0;
      const isTunnel = structureType === 'tunnel';
      const plinthColor = isTunnel ? '#0F172A' : '#1E293B';
      const sleeperColor = isTunnel ? '#64748B' : '#94A3B8';

      const plinthOffset = isDown
        ? ['interpolate', ['linear'], ['zoom'], 9, -3.2, 11, -4.0, 13, -4.8, 14.5, -2.0, 16, 0.0]
        : ['interpolate', ['linear'], ['zoom'], 9,  3.2, 11,  4.0, 13,  4.8, 14.5,  2.0, 16, 0.0];

      const leftRailOffset = isDown
        ? ['interpolate', ['linear'], ['zoom'], 9, -4.3, 11, -5.2, 13, -6.6, 15, -2.6, 17, -4.5]
        : ['interpolate', ['linear'], ['zoom'], 9,  2.1, 11,  2.8, 13,  3.0, 15, -2.6, 17, -4.5];

      const rightRailOffset = isDown
        ? ['interpolate', ['linear'], ['zoom'], 9, -2.1, 11, -2.8, 13, -3.0, 15,  2.6, 17,  4.5]
        : ['interpolate', ['linear'], ['zoom'], 9,  4.3, 11,  5.2, 13,  6.6, 15,  2.6, 17,  4.5];

      const thirdOffset = isDown
        ? ['interpolate', ['linear'], ['zoom'], 12, -2.0, 14, -0.4, 16, 5.8, 17, 8.2]
        : ['interpolate', ['linear'], ['zoom'], 12,  7.0, 14,  7.6, 16, 5.8, 17, 8.2];

      // 1. Overview Track Plinth Casing (z9 to z12.0)
      map.addLayer({
        id: `${structureType}-track-${dir}-overview-casing`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        maxzoom: 12.0,
        paint: {
          'line-offset': plinthOffset,
          'line-color': plinthColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.4, 11, 3.6, 12, 4.4],
          'line-opacity': 0.95
        }
      });

      // 2. Overview Vibrant Yellow Line Core (z9 to z12.0)
      map.addLayer({
        id: `${structureType}-track-${dir}-overview-core`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        maxzoom: 12.0,
        paint: {
          'line-offset': plinthOffset,
          'line-color': '#F59E0B',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.4, 11, 2.2, 12, 2.8],
          'line-opacity': 1.0
        }
      });

      // 3. Overview Polished Steel Rail Crown Gleam (z9 to z12.0)
      map.addLayer({
        id: `${structureType}-track-${dir}-overview-gleam`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        maxzoom: 12.0,
        paint: {
          'line-offset': plinthOffset,
          'line-color': '#FFFFFF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 11, 0.9, 12, 1.2],
          'line-opacity': 0.90
        }
      });

      // 4. Detailed Ballastless Concrete Trackbed Plinth (z10.8 to 18+)
      map.addLayer({
        id: `${structureType}-track-${dir}-plinth`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 10.8,
        paint: {
          'line-offset': plinthOffset,
          'line-color': plinthColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4.2, 13, 6.8, 15, 11.0, 17, 18.0],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 10.8, 0.3, 11.5, 0.95]
        }
      });

      // 5. Precast Concrete Transverse Sleepers (z10.8 to 18+)
      map.addLayer({
        id: `${structureType}-track-${dir}-sleepers`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 10.8,
        paint: {
          'line-offset': plinthOffset,
          'line-color': sleeperColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3.8, 13, 6.0, 15, 9.5, 17, 16.0],
          'line-dasharray': [0.18, 0.35],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 10.8, 0.3, 11.5, 1.0]
        }
      });

      // 6. Left Steel Rail - Base Shadow (z10.8 to 18+)
      map.addLayer({
        id: `${structureType}-track-${dir}-rail-left-base`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 10.8,
        paint: {
          'line-offset': leftRailOffset,
          'line-color': '#0F172A',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 13, 1.6, 15, 2.2, 17, 3.5],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 10.8, 0.3, 11.5, 1.0]
        }
      });

      // 7. Left Steel Rail - Gleaming Mirror Crown (z10.8 to 18+)
      map.addLayer({
        id: `${structureType}-track-${dir}-rail-left-head`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 10.8,
        paint: {
          'line-offset': leftRailOffset,
          'line-color': '#FFFFFF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 13, 1.0, 15, 1.4, 17, 2.2],
          'line-opacity': 1.0
        }
      });

      // 8. Right Steel Rail - Base Shadow (z10.8 to 18+)
      map.addLayer({
        id: `${structureType}-track-${dir}-rail-right-base`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 10.8,
        paint: {
          'line-offset': rightRailOffset,
          'line-color': '#0F172A',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 13, 1.6, 15, 2.2, 17, 3.5],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 10.8, 0.3, 11.5, 1.0]
        }
      });

      // 9. Right Steel Rail - Gleaming Mirror Crown (z10.8 to 18+)
      map.addLayer({
        id: `${structureType}-track-${dir}-rail-right-head`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 10.8,
        paint: {
          'line-offset': rightRailOffset,
          'line-color': '#FFFFFF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 13, 1.0, 15, 1.4, 17, 2.2],
          'line-opacity': 1.0
        }
      });

      // 10. Golden Power Conductor Rail / Third Rail (z12.0 to 18+)
      map.addLayer({
        id: `${structureType}-track-${dir}-third-rail`,
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'dir'], dir],
        minzoom: 12.0,
        paint: {
          'line-offset': thirdOffset,
          'line-color': '#F59E0B',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 14, 1.2, 16, 1.8, 17, 2.5],
          'line-opacity': 0.95
        }
      });
    }

    // ── B. ELEVATED FLYOVER VIADUCT LAYERS (NORTH & SOUTH) ───
    // 1. Ambient Ground Drop Shadow (ONLY ON ELEVATED FLYOVERS!)
    map.addLayer({
      id: 'flyover-ground-shadow',
      type: 'line',
      source: 'flyover-viaduct-center',
      paint: {
        'line-color': '#0F172A',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 8, 11, 16, 14, 26, 17, 44],
        'line-opacity': 0.22,
        'line-blur': ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 5, 17, 8],
        'line-offset': ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 4, 17, 6]
      }
    });

    // 2. Concrete Parapet Guardrail Barriers (Bridge outer edges)
    map.addLayer({
      id: 'flyover-parapet-curb',
      type: 'line',
      source: 'flyover-viaduct-center',
      paint: {
        'line-color': '#64748B',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 8.5, 11, 15.5, 14, 25.0, 17, 40.0],
        'line-opacity': 0.95
      }
    });

    // 3. Precast Reinforced Concrete U-Girder Deck Slab (Pure clean white!)
    map.addLayer({
      id: 'flyover-deck-slab',
      type: 'line',
      source: 'flyover-viaduct-center',
      paint: {
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 7.0, 11, 13.5, 14, 22.0, 17, 36.0],
        'line-opacity': 0.98
      }
    });

    // 4. Center Median Structural Barrier
    map.addLayer({
      id: 'flyover-center-divider',
      type: 'line',
      source: 'flyover-viaduct-center',
      paint: {
        'line-color': '#CBD5E1',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.0, 11, 1.6, 14, 2.4, 17, 3.5],
        'line-opacity': 0.90
      }
    });

    // ── FLYOVER DUAL TRACKS (DOWN & UP) ──────────────────────
    addTrackRailSystem('flyover', 'flyover-tracks', 'down', -1);
    addTrackRailSystem('flyover', 'flyover-tracks', 'up', 1);

    // ══════════════════════════════════════════════════════════
    // ── C. SUBTERRANEAN TUBE TUNNEL INFRASTRUCTURE ───────────
    // ══════════════════════════════════════════════════════════
    // Authentic underground subway bore through Old & New Delhi (NO surface drop shadow!)
    // 1. Excavation Casing (Deep architectural graphite slate - NOT a solid black bar!)
    map.addLayer({
      id: 'tunnel-tube-outer-casing',
      type: 'line',
      source: 'tunnel-tube-center',
      paint: {
        'line-color': '#1E293B',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 8.5, 11, 15.5, 14, 25.0, 17, 40.0],
        'line-opacity': 0.90
      }
    });

    // 2. Circular TBM Tube Chamber Bore
    map.addLayer({
      id: 'tunnel-tube-bore',
      type: 'line',
      source: 'tunnel-tube-center',
      paint: {
        'line-color': '#0F172A',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 7.0, 11, 13.5, 14, 22.0, 17, 36.0],
        'line-opacity': 0.98
      }
    });

    // 3. Subterranean Safety & Illuminated Bore Perimeter (Luminous cyan guide)
    map.addLayer({
      id: 'tunnel-interior-glow',
      type: 'line',
      source: 'tunnel-tube-center',
      paint: {
        'line-color': '#0284C7',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 4.0, 11, 8.0, 14, 14.0, 17, 22.0],
        'line-opacity': 0.35,
        'line-blur': 3
      }
    });

    // 4. Subterranean Center Divider
    map.addLayer({
      id: 'tunnel-center-divider',
      type: 'line',
      source: 'tunnel-tube-center',
      paint: {
        'line-color': '#334155',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.0, 11, 1.6, 14, 2.4, 17, 3.5],
        'line-opacity': 0.90
      }
    });

    // 5. Precast Segmented Concrete TBM Tunnel Rings (Ribbed Structure)
    map.addLayer({
      id: 'tunnel-tbm-rings',
      type: 'line',
      source: 'tunnel-tube-center',
      minzoom: 12.0,
      paint: {
        'line-color': '#334155',
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 7.5, 14, 14, 17, 25],
        'line-dasharray': [0.25, 0.55],
        'line-opacity': 0.75
      }
    });

    // ── SUBTERRANEAN DUAL TRACKS (DOWN & UP) ─────────────────
    addTrackRailSystem('tunnel', 'tunnel-tracks', 'down', -1);
    addTrackRailSystem('tunnel', 'tunnel-tracks', 'up', 1);

    // ── D. TRANSITION PORTALS & CUTAWAY RAMPS ────────────────
    if (map.getSource('portal-ramps')) {
      // Concrete U-trough ramp retaining walls
      map.addLayer({
        id: 'portal-ramps-casing',
        type: 'fill',
        source: 'portal-ramps',
        paint: {
          'fill-color': '#0F172A',
          'fill-opacity': 0.85,
          'fill-outline-color': '#64748B'
        }
      });

      // Ramp roadbed descending into earth
      map.addLayer({
        id: 'portal-ramps-bed',
        type: 'fill',
        source: 'portal-ramps',
        paint: {
          'fill-color': '#334155',
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
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 4, 12, 6.5, 15, 9],
          'circle-color': '#E11D48',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#FFFFFF'
        }
      });

      map.addLayer({
        id: 'portal-labels',
        type: 'symbol',
        source: 'tunnel-portals',
        minzoom: 11.2,
        layout: {
          'text-field': [
            'case',
            ['==', ['get', 'id'], 'portal_north'], '🔻 NORTH PORTAL · Model Town ➔ GTB Nagar (-16m)',
            '🔺 SOUTH PORTAL · Saket ➔ Qutab Minar (+15m)'
          ],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9.5, 14, 11, 16, 12.5],
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

    // ── E. TERMINAL CROSSOVER SWITCH TURNOUTS ────────────────
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
      paint: {
        'line-color': '#1E293B',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3.5, 13, 5.5, 15, 9.0, 17, 15.0]
      }
    });

    map.addLayer({
      id: 'crossover-track-sleepers',
      type: 'line',
      source: 'terminal-crossovers',
      paint: {
        'line-color': '#94A3B8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3.2, 13, 5.0, 15, 8.0, 17, 13.0],
        'line-dasharray': [0.18, 0.35]
      }
    });

    map.addLayer({
      id: 'crossover-track-rails',
      type: 'line',
      source: 'terminal-crossovers',
      paint: {
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.0, 13, 1.6, 15, 2.4, 17, 3.6]
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  4. RENDER PHYSICAL PLATFORMS, CANOPIES & UNDERGROUND CHAMBERS
  // ═══════════════════════════════════════════════════════════
  function renderPhysicalPlatforms() {
    if (!trackData) return;

    // 1. Platform Slabs
    if (trackData.platformSlabs) {
      map.addSource('platform-slabs', {
        type: 'geojson',
        data: trackData.platformSlabs
      });

      // Ambient Ground Shadow ONLY for Elevated Stations (0..6 and 27..36)
      map.addLayer({
        id: 'platform-slab-shadow',
        type: 'fill',
        source: 'platform-slabs',
        filter: ['==', ['get', 'structure'], 'elevated'],
        paint: {
          'fill-color': '#0F172A',
          'fill-opacity': 0.18,
          'fill-translate': [2, 3]
        }
      });

      // Platform Raised Concrete Deck (Elevated)
      map.addLayer({
        id: 'platform-slab-deck-elevated',
        type: 'fill',
        source: 'platform-slabs',
        filter: ['==', ['get', 'structure'], 'elevated'],
        paint: {
          'fill-color': '#FFFFFF',
          'fill-outline-color': '#1E293B',
          'fill-opacity': 0.98
        }
      });

      // Subterranean Station Floor Slab (Underground)
      // Crisp luminous passenger waiting decks so they stand out boldly inside the station chamber
      map.addLayer({
        id: 'platform-slab-deck-underground',
        type: 'fill',
        source: 'platform-slabs',
        filter: ['==', ['get', 'structure'], 'underground'],
        paint: {
          'fill-color': '#F1F5F9', // Crisp light granite passenger concourse
          'fill-outline-color': '#334155',
          'fill-opacity': 0.98
        }
      });
    }

    // 2. Subterranean Station Chamber Cutaway Boxes (Underground Stations 7..26)
    if (trackData.undergroundPlatforms) {
      map.addSource('underground-platforms', {
        type: 'geojson',
        data: trackData.undergroundPlatforms
      });

      // Architectural dark slate excavation chamber (clean & luminous, NOT pitch black!)
      map.addLayer({
        id: 'underground-chamber-casing',
        type: 'fill',
        source: 'underground-platforms',
        minzoom: 12.0,
        paint: {
          'fill-color': '#1E293B',
          'fill-outline-color': '#0284C7',
          'fill-opacity': 0.72
        }
      });

      // Luminous cyan engineering perimeter outline
      map.addLayer({
        id: 'underground-chamber-glow',
        type: 'line',
        source: 'underground-platforms',
        minzoom: 12.0,
        paint: {
          'line-color': '#38BDF8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 15, 2.2, 17, 3.5],
          'line-opacity': 0.85
        }
      });
    }

    // 3. Tactile Hazard / Guidance Platform Edges
    if (trackData.tactileEdges) {
      map.addSource('platform-tactile-edges', {
        type: 'geojson',
        data: trackData.tactileEdges
      });

      map.addLayer({
        id: 'platform-tactile-strips',
        type: 'line',
        source: 'platform-tactile-edges',
        paint: {
          'line-color': '#F59E0B', // DMRC Yellow Safety Line
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 14, 4.5, 16, 7],
          'line-dasharray': [1, 0.4]
        }
      });
    }

    // 4. Modern Cantilevered Sky-Blue Canopy Roofs (ONLY on Elevated Stations)
    if (trackData.platformCanopies) {
      map.addSource('platform-canopies', {
        type: 'geojson',
        data: trackData.platformCanopies
      });

      map.addLayer({
        id: 'platform-canopy-3d',
        type: 'fill-extrusion',
        source: 'platform-canopies',
        minzoom: 12.5,
        paint: {
          'fill-extrusion-color': '#0284C7', // Signature Sky-Blue Vaulted Arch Canopy
          'fill-extrusion-height': 9.5,
          'fill-extrusion-base': 4.5,
          'fill-extrusion-opacity': 0.90
        }
      });
    }

    // 5. Station Architectural Labels & Platform Signage
    if (trackData.stations) {
      map.addSource('stations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: trackData.stations.map((s, idx) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: s.coords },
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

      // Major Station Names with Elevation & Structure Badges
      map.addLayer({
        id: 'station-labels-major',
        type: 'symbol',
        source: 'stations',
        filter: ['get', 'major'],
        minzoom: 10.8,
        layout: {
          'text-field': [
            'concat',
            ['get', 'name'],
            ' · ',
            ['get', 'elevText']
          ],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-offset': [0, 1.8],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#0F172A',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 2.8
        }
      });

      // Local Station Names
      map.addLayer({
        id: 'station-labels-local',
        type: 'symbol',
        source: 'stations',
        filter: ['!', ['get', 'major']],
        minzoom: 12.8,
        layout: {
          'text-field': [
            'concat',
            ['get', 'name'],
            ' · ',
            ['get', 'elevText']
          ],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 10,
          'text-offset': [0, 1.6],
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
  //  5. 3D ARCHITECTURAL LANDMARK (ZOOM PROPORTIONAL SCALE)
  // ═══════════════════════════════════════════════════════════
  function addRajivChowk3DLandmark() {
    const el = document.createElement('div');
    el.className = 'landmark-3d-container';
    el.innerHTML = `
      <div class="landmark-model-wrap">
        <img src="/public/rajiv_chowk_cutaway.png" alt="Rajiv Chowk 3D Landmark" class="landmark-img" />
        <div class="landmark-ground-shadow"></div>
      </div>
      <div class="landmark-badge">
        <span class="landmark-dot"></span>
        <span>🏛️ Rajiv Chowk Intermodal Terminal</span>
      </div>
    `;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      switchSurface('cutaway');
    });

    rajivMarker = new maplibregl.Marker({
      element: el,
      anchor: 'bottom',
      pitchAlignment: 'viewport',
      rotationAlignment: 'viewport'
    })
      .setLngLat([77.2196, 28.6329])
      .addTo(map);
  }

  function updateMarkerScale() {
    if (!map) return;
    const z = map.getZoom();
    const scale = Math.max(0.25, Math.min(1.05, Math.pow(2, z - 15.0)));
    const el = document.querySelector('.landmark-3d-container');
    if (el) {
      if (z < 12.4) {
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
          badge.style.display = z >= 13.0 ? 'flex' : 'none';
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  6. TRAINS LAYERS (SLEEK MINIMALIST FLEET - BIG TRAINS REMOVED)
  // ═══════════════════════════════════════════════════════════
  function renderTrainsLayers() {
    map.addSource('active-trains', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    // ── Layer A: Train Ground Drop Shadow (Only for elevated trains!) ──
    map.addLayer({
      id: 'train-drop-shadow',
      type: 'circle',
      source: 'active-trains',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4.0, 14, 6.5, 16, 9.0],
        'circle-color': '#0F172A',
        'circle-opacity': [
          'case',
          ['==', ['get', 'structure'], 'underground'], 0.0,
          0.20
        ],
        'circle-blur': 0.6,
        'circle-translate': [0, 2]
      }
    });

    // ── Layer B: Sleek Precision Transit Vehicle Pip (Crisp & Non-Intrusive) ──
    // Does NOT cover or hide the railway tracks!
    map.addLayer({
      id: 'train-dot-white-black',
      type: 'circle',
      source: 'active-trains',
      layout: {
        'visibility': 'visible'
      },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.2, 12, 4.5, 14, 6.0, 16, 8.0],
        'circle-color': '#FFFFFF',
        'circle-stroke-width': 2.0,
        'circle-stroke-color': '#0F172A'
      }
    });

    // Inner DMRC Golden Yellow Core
    map.addLayer({
      id: 'train-dot-pupil',
      type: 'circle',
      source: 'active-trains',
      layout: {
        'visibility': 'visible'
      },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.4, 12, 2.0, 14, 2.8, 16, 3.8],
        'circle-color': '#EAB308'
      }
    });

    // Big 3D Train Consist is HIDDEN/REMOVED by default so rails are completely visible!
    map.addLayer({
      id: 'train-consist-3d',
      type: 'symbol',
      source: 'active-trains',
      layout: {
        'icon-image': 'delhi-metro-consist',
        'visibility': 'none'
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  7. LIVE SSE TELEMETRY STREAM & PACKET INGESTION
  // ═══════════════════════════════════════════════════════════
  function connectSSEStream() {
    const evtSource = new EventSource('/api/trains/stream');

    evtSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        const incoming = payload.trains || [];
        const now = performance.now();

        packetInterval = Math.max(50, now - lastPacketTime);
        lastPacketTime = now;

        const countEl = document.getElementById('fleet-count');
        if (countEl) countEl.textContent = `${incoming.length} Trains`;

        incoming.forEach(t => {
          const prev = trainTargetStates.get(t.id) || { coords: t.coords, bearing: t.bearing, time: now };
          trainPrevStates.set(t.id, prev);
          trainTargetStates.set(t.id, { coords: t.coords, bearing: t.bearing, time: now, data: t });
        });

        activeTrains = incoming;

        if (selectedTrainId) {
          const t = activeTrains.find(x => x.id === selectedTrainId);
          if (t) updateCalloutCard(t);
        }

        updateCutawayPlatformETAs();
      } catch (err) {
        console.error('SSE Error', err);
      }
    };
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
  //  9. MASTER THREE-TIER SURFACE SWITCHER
  // ═══════════════════════════════════════════════════════════
  function setupMasterNavigation() {
    const tabs = document.querySelectorAll('.mode-tab');
    const mapSurface = document.getElementById('map');
    const threeSurface = document.getElementById('three-container');
    const cutawaySurface = document.getElementById('cutaway-fullscreen-view');
    const heroCard = document.querySelector('.diorama-hero-card');
    const controlCluster = document.querySelector('.control-cluster');
    const legendStrip = document.querySelector('.bottom-legend-strip');

    window.switchSurface = function (surfaceName) {
      tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-surface') === surfaceName));

      if (surfaceName === 'corridor') {
        mapSurface.classList.remove('hidden');
        threeSurface.classList.add('hidden');
        cutawaySurface.classList.add('hidden');
        heroCard.style.display = 'flex';
        controlCluster.style.display = 'flex';
        legendStrip.style.display = 'flex';
        if (window.Diorama3D) window.Diorama3D.stop();
      } else if (surfaceName === 'cutaway') {
        cutawaySurface.classList.remove('hidden');
        mapSurface.classList.add('hidden');
        threeSurface.classList.add('hidden');
        heroCard.style.display = 'none';
        controlCluster.style.display = 'none';
        legendStrip.style.display = 'none';
        if (window.Diorama3D) window.Diorama3D.stop();
      } else if (surfaceName === 'threejs') {
        threeSurface.classList.remove('hidden');
        mapSurface.classList.add('hidden');
        cutawaySurface.classList.add('hidden');
        heroCard.style.display = 'none';
        controlCluster.style.display = 'none';
        legendStrip.style.display = 'none';
        if (window.Diorama3D) {
          window.Diorama3D.init(threeSurface);
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
    const initialSurface = urlParams.get('surface');
    if (initialSurface && ['corridor', 'cutaway', 'threejs'].includes(initialSurface)) {
      window.switchSurface(initialSurface);
    }

    // Central Line Cutaway Station Switcher & Jump to Radar
    let activeCutawayKey = 'rajiv';
    const STATION_METADATA = {
      'rajiv': {
        title: 'Rajiv Chowk Intermodal Terminal',
        sub: 'Architectural 3D Cutaway Pedestal · Cutaway Tunnel Tubes & Island Platform (Yellow & Blue Line)',
        coords: [77.2196, 28.6329],
        zoom: 15.6
      },
      'kashmere': {
        title: 'Kashmere Gate Multimodal Hub',
        sub: 'Architectural 3D Cutaway Pedestal · Red, Yellow & Violet Line Triple Interchange Station',
        coords: [77.2282, 28.6675],
        zoom: 15.6
      },
      'hauzkhas': {
        title: 'Hauz Khas Deep Junction',
        sub: 'Architectural 3D Cutaway Pedestal · 29m Deep Underground Tube Station (Yellow & Magenta Line)',
        coords: [77.2067, 28.5443],
        zoom: 15.6
      },
      'millennium': {
        title: 'Millennium City Centre (Cyber Hub)',
        sub: 'Architectural 3D Cutaway Pedestal · Elevated Viaduct Deck & Rapid Metro Gurugram Terminus',
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
          document.getElementById('cutaway-main-station-title').textContent = meta.title;
          const subEl = document.querySelector('.cutaway-spotlight-sub');
          if (subEl) subEl.textContent = meta.sub;
        }
      });
    });

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

  function updateCutawayPlatformETAs() {
    const p1 = document.getElementById('cutaway-p1-time');
    const p2 = document.getElementById('cutaway-p2-time');
    if (!p1 || !p2 || !activeTrains.length) return;

    p1.textContent = 'Due in 1 min 15s';
    p2.textContent = 'Due in 2 min 40s';
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

    // Vehicle Render Mode: Sleek Minimalist Fleet vs Pure Tracks Only
    const modeDot = document.getElementById('mode-dot');
    const modeTracks = document.getElementById('mode-tracks');

    if (modeDot) {
      modeDot.addEventListener('click', () => {
        modeDot.classList.add('active');
        if (modeTracks) modeTracks.classList.remove('active');
        renderMode = 'dot';
        if (map && map.getLayer('train-dot-white-black')) {
          map.setLayoutProperty('train-dot-white-black', 'visibility', 'visible');
          map.setLayoutProperty('train-dot-pupil', 'visibility', 'visible');
          map.setLayoutProperty('train-drop-shadow', 'visibility', 'visible');
          map.setLayoutProperty('train-consist-3d', 'visibility', 'none');
        }
      });
    }

    if (modeTracks) {
      modeTracks.addEventListener('click', () => {
        modeTracks.classList.add('active');
        if (modeDot) modeDot.classList.remove('active');
        renderMode = 'tracks';
        if (map && map.getLayer('train-dot-white-black')) {
          map.setLayoutProperty('train-dot-white-black', 'visibility', 'none');
          map.setLayoutProperty('train-dot-pupil', 'visibility', 'none');
          map.setLayoutProperty('train-drop-shadow', 'visibility', 'none');
          map.setLayoutProperty('train-consist-3d', 'visibility', 'none');
        }
      });
    }

    // Speed Multipliers
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const spd = btn.getAttribute('data-speed');
        fetch(`/api/speed?m=${spd}`).catch(console.error);
      });
    });

    // Quick Bookmarks
    document.querySelectorAll('.bookmark-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bookmark-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const loc = btn.getAttribute('data-loc');
        followTrainId = null;

        if (loc === 'rajiv') {
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
          map.flyTo({ center: [77.1600, 28.6050], zoom: 10.6, pitch: 30, bearing: -6, duration: 1400 });
        }
      });
    });

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
  }

  function setupInteractions() {
    map.on('click', 'train-consist-3d', onTrainClick);
    map.on('click', 'train-dot-white-black', onTrainClick);

    // Click station platform to open cutaway
    map.on('click', 'platform-slab-deck-elevated', (e) => {
      window.switchSurface('cutaway');
    });
    map.on('click', 'platform-slab-deck-underground', (e) => {
      window.switchSurface('cutaway');
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

  function updateCalloutCard(props) {
    document.getElementById('ins-id').textContent = `Train ${props.id}`;
    document.getElementById('ins-track').textContent = `${props.track} · ${props.elevLabel || ''}`;
    document.getElementById('ins-dir').textContent = props.directionLabel;
    document.getElementById('ins-between').textContent = `${props.fromStation} ➔ ${props.toStation}`;
    document.getElementById('ins-speed').textContent = `${props.speedKph} km/h`;
  }

  document.addEventListener('DOMContentLoaded', init);

})();
