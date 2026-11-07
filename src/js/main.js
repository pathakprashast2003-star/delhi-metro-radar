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
  let renderMode = 'dot'; // Default to user's requested white-black dot
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
        preloadImage('/public/metro_train_consist.png', 'delhi-metro-consist');
      } else if (e.id === 'dmrc-rail-pattern') {
        preloadImage('/public/delhi_metro_track_pattern.png', 'dmrc-rail-pattern');
      }
    });

    map.on('load', async () => {
      suppressMapClutter();
      enhanceMapColors();

      await Promise.all([
        preloadImage('/public/metro_train_consist.png', 'delhi-metro-consist'),
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
      // 1. Vibrant Azure Water (Yamuna River, lakes & canals)
      if (map.getLayer('water')) {
        map.setPaintProperty('water', 'fill-color', '#8AD0DE');
        map.setPaintProperty('water', 'fill-opacity', 0.95);
      }
      if (map.getLayer('waterway')) {
        map.setPaintProperty('waterway', 'line-color', '#65BED0');
      }

      // 2. Fresh Pastel Green Parks (Central Vista, Lodhi Gardens, Ridge Forest, Mughal Gardens)
      const parkColor = '#C4E8C2';
      ['park_national_park', 'park_nature_reserve', 'landcover', 'landuse'].forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'fill-color', parkColor);
          map.setPaintProperty(layerId, 'fill-opacity', 0.70);
        }
      });

      // 3. Warm Golden-Amber Highway Fills
      const trunkRoads = ['road_trunk_fill_ramp', 'road_trunk_fill_noramp', 'road_mot_fill_ramp', 'road_mot_fill_noramp', 'bridge_trunk_fill', 'bridge_mot_fill'];
      trunkRoads.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'line-color', '#FCD34D');
        }
      });

      // 4. Soft Peach & Cream Arteries
      const primaryRoads = ['road_pri_fill_ramp', 'road_pri_fill_noramp', 'road_sec_fill_noramp', 'bridge_pri_fill', 'bridge_sec_fill'];
      primaryRoads.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'line-color', '#FED7AA');
        }
      });

      // 5. Warm Alabaster Land Background
      if (map.getLayer('background')) {
        map.setPaintProperty('background', 'background-color', '#FAF8F3');
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
  //  3. ELEVATED FLYOVER VIADUCT & DUAL TRACKS (LOD-AWARE)
  // ═══════════════════════════════════════════════════════════
  function renderViaductAndDualTracks() {
    if (!trackData) return;

    map.addSource('track-south', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: trackData.trackSouth }
      }
    });

    map.addSource('track-north', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: trackData.trackNorth }
      }
    });

    // ── 1. ELEVATED FLYOVER AMBIENT GROUND DROP SHADOW ────────
    // Cast on the terrain/roads below to make the viaduct float 15m in the air
    map.addLayer({
      id: 'flyover-shadow-south',
      type: 'line',
      source: 'track-south',
      paint: {
        'line-color': '#0F172A',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 4, 11, 7, 14, 16, 17, 26],
        'line-opacity': 0.16,
        'line-blur': ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 5, 17, 8],
        'line-offset': ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 4, 17, 6]
      }
    });

    map.addLayer({
      id: 'flyover-shadow-north',
      type: 'line',
      source: 'track-north',
      paint: {
        'line-color': '#0F172A',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 4, 11, 7, 14, 16, 17, 26],
        'line-opacity': 0.16,
        'line-blur': ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 5, 17, 8],
        'line-offset': ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 4, 17, 6]
      }
    });

    // ── 2. ELEVATED CONCRETE FLYOVER DECK (U-GIRDER SPAN) ─────
    // Clean, modern precast concrete deck slab
    map.addLayer({
      id: 'flyover-deck-south',
      type: 'line',
      source: 'track-south',
      paint: {
        'line-color': '#E2E8F0',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3, 11, 5, 14, 13, 17, 22],
        'line-opacity': 0.96
      }
    });

    map.addLayer({
      id: 'flyover-deck-north',
      type: 'line',
      source: 'track-north',
      paint: {
        'line-color': '#E2E8F0',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3, 11, 5, 14, 13, 17, 22],
        'line-opacity': 0.96
      }
    });

    // Elevated Parapet Safety Curbs (Bridge guardrails)
    map.addLayer({
      id: 'flyover-curb-south',
      type: 'line',
      source: 'track-south',
      paint: {
        'line-color': '#94A3B8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3.8, 11, 6.2, 14, 14.5, 17, 24],
        'line-opacity': 0.70
      }
    }, 'flyover-deck-south');

    map.addLayer({
      id: 'flyover-curb-north',
      type: 'line',
      source: 'track-north',
      paint: {
        'line-color': '#94A3B8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3.8, 11, 6.2, 14, 14.5, 17, 24],
        'line-opacity': 0.70
      }
    }, 'flyover-deck-north');

    // ── 3. OVERVIEW CORRIDOR RAILS (ZOOM 9 TO 14) ─────────────
    // Sleek, razor-sharp architectural dual tracks (eliminates giant ladder clutter at overview!)
    map.addLayer({
      id: 'track-1-overview-casing',
      type: 'line',
      source: 'track-south',
      maxzoom: 14.2,
      paint: {
        'line-color': '#1E293B',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.0, 11, 3.2, 13, 4.5],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 0.90, 14.2, 0.0]
      }
    });

    map.addLayer({
      id: 'track-1-overview-core',
      type: 'line',
      source: 'track-south',
      maxzoom: 14.2,
      paint: {
        'line-color': '#EAB308',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.2, 11, 1.8, 13, 2.6],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 1.0, 14.2, 0.0]
      }
    });

    map.addLayer({
      id: 'track-2-overview-casing',
      type: 'line',
      source: 'track-north',
      maxzoom: 14.2,
      paint: {
        'line-color': '#1E293B',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.0, 11, 3.2, 13, 4.5],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 0.90, 14.2, 0.0]
      }
    });

    map.addLayer({
      id: 'track-2-overview-core',
      type: 'line',
      source: 'track-north',
      maxzoom: 14.2,
      paint: {
        'line-color': '#EAB308',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.2, 11, 1.8, 13, 2.6],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 1.0, 14.2, 0.0]
      }
    });

    // ── 4. CLOSE-UP VECTOR RAILWAY STRUCTURE (ZOOM 13.6 TO 18+) ─
    // Fades in seamlessly as user zooms in to street / station level
    map.addLayer({
      id: 'track-1-railroad',
      type: 'line',
      source: 'track-south',
      minzoom: 13.4,
      paint: {
        'line-pattern': 'dmrc-rail-pattern',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 7, 15, 11, 17, 16],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 0.0, 14.0, 1.0]
      }
    });

    map.addLayer({
      id: 'track-2-railroad',
      type: 'line',
      source: 'track-north',
      minzoom: 13.4,
      paint: {
        'line-pattern': 'dmrc-rail-pattern',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 7, 15, 11, 17, 16],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 0.0, 14.0, 1.0]
      }
    });

    // ── 5. TERMINAL CROSSOVER SWITCH TURNOUTS ────────────────
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

    // Crossover overview line
    map.addLayer({
      id: 'crossover-track-overview',
      type: 'line',
      source: 'terminal-crossovers',
      maxzoom: 14.2,
      paint: {
        'line-color': '#EAB308',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.0, 11, 1.6, 13, 2.4],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 0.9, 14.2, 0.0]
      }
    });

    // Crossover close-up pattern
    map.addLayer({
      id: 'crossover-track-railroad',
      type: 'line',
      source: 'terminal-crossovers',
      minzoom: 13.4,
      paint: {
        'line-pattern': 'dmrc-rail-pattern',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 6, 15, 10, 17, 14],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 0.0, 14.0, 1.0]
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  4. RENDER PHYSICAL STATION PLATFORMS, TACTILE EDGES & 3D CANOPIES
  // ═══════════════════════════════════════════════════════════
  function renderPhysicalPlatforms() {
    if (!trackData) return;

    // 1. Platform Slabs (Concrete Raised Platform Deck)
    if (trackData.platformSlabs) {
      map.addSource('platform-slabs', {
        type: 'geojson',
        data: trackData.platformSlabs
      });

      // Platform Ambient Ground Shadow
      map.addLayer({
        id: 'platform-slab-shadow',
        type: 'fill',
        source: 'platform-slabs',
        paint: {
          'fill-color': '#0F172A',
          'fill-opacity': 0.16,
          'fill-translate': [2, 3]
        }
      });

      // Platform Concrete Deck
      map.addLayer({
        id: 'platform-slab-deck',
        type: 'fill',
        source: 'platform-slabs',
        paint: {
          'fill-color': '#FFFFFF',
          'fill-outline-color': '#1E293B',
          'fill-opacity': 0.98
        }
      });
    }

    // 2. Yellow Tactile Hazard Edges along the Platform (facing tracks)
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
          'line-color': '#EAB308', // DMRC Yellow Safety Line
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 14, 4.5, 16, 7],
          'line-dasharray': [1, 0.4]
        }
      });
    }

    // 3. 3D Cantilevered Canopy Roofs (Hovering in 3D above the platform)
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
          'fill-extrusion-color': '#F8FAFC',
          'fill-extrusion-height': 8.5,
          'fill-extrusion-base': 4.5,
          'fill-extrusion-opacity': 0.94
        }
      });
    }

    // 4. Station Architectural Labels & Platforms Signage
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
              index: idx
            }
          }))
        }
      });

      // Major Station Names (Swiss Typography)
      map.addLayer({
        id: 'station-labels-major',
        type: 'symbol',
        source: 'stations',
        filter: ['get', 'major'],
        minzoom: 11,
        layout: {
          'text-field': ['concat', ['get', 'name'], ' · P1/P2'],
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
        minzoom: 13,
        layout: {
          'text-field': ['get', 'name'],
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
  //  6. TRAINS LAYERS (DELHI METRO TRAIN CONSISTS & DOTS)
  // ═══════════════════════════════════════════════════════════
  function renderTrainsLayers() {
    map.addSource('active-trains', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    // ── Layer A: Train Ground Drop Shadow ──
    map.addLayer({
      id: 'train-drop-shadow',
      type: 'circle',
      source: 'active-trains',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 14, 9, 16, 14],
        'circle-color': '#0F172A',
        'circle-opacity': 0.22,
        'circle-blur': 0.6,
        'circle-translate': [0, 3]
      }
    });

    // ── Layer B: Real Delhi Metro Train Consist (3-Car Aerodynamic Model) ──
    map.addLayer({
      id: 'train-consist-3d',
      type: 'symbol',
      source: 'active-trains',
      layout: {
        'icon-image': 'delhi-metro-consist',
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map', // Rotates and curves with the rails!
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          11, 0.12,
          13, 0.22,
          14.5, 0.40,
          16, 0.72,
          17, 1.10
        ],
        'visibility': 'none'
      }
    });

    // ── Layer C: Simple White-Black Concentric Target Dot (Default) ──
    map.addLayer({
      id: 'train-dot-white-black',
      type: 'circle',
      source: 'active-trains',
      layout: {
        'visibility': 'visible'
      },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4.0, 12, 6.0, 14, 8.5, 16, 12],
        'circle-color': '#FFFFFF',
        'circle-stroke-width': 2.6,
        'circle-stroke-color': '#000000'
      }
    });

    map.addLayer({
      id: 'train-dot-pupil',
      type: 'circle',
      source: 'active-trains',
      layout: {
        'visibility': 'visible'
      },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.8, 12, 2.8, 14, 3.8, 16, 5.0],
        'circle-color': '#000000'
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

          const curLng = prev.coords[0] + (target.coords[0] - prev.coords[0]) * factor;
          const curLat = prev.coords[1] + (target.coords[1] - prev.coords[1]) * factor;

          const prevB = prev.bearing !== undefined ? prev.bearing : target.bearing;
          let dAngle = (target.bearing - prevB) % 360;
          if (dAngle > 180) dAngle -= 360;
          if (dAngle < -180) dAngle += 360;
          const curBearing = Math.round((prevB + dAngle * factor + 360) % 360);

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
              speedKph: target.data.speedKph
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

    // Vehicle Render Mode: Real 3D Train Consist vs White-Black Dot
    const modeDot = document.getElementById('mode-dot');
    const mode3D = document.getElementById('mode-3d');

    modeDot.addEventListener('click', () => {
      modeDot.classList.add('active');
      mode3D.classList.remove('active');
      renderMode = 'dot';
      if (map && map.getLayer('train-dot-white-black')) {
        map.setLayoutProperty('train-dot-white-black', 'visibility', 'visible');
        map.setLayoutProperty('train-dot-pupil', 'visibility', 'visible');
        map.setLayoutProperty('train-consist-3d', 'visibility', 'none');
      }
    });

    mode3D.addEventListener('click', () => {
      mode3D.classList.add('active');
      modeDot.classList.remove('active');
      renderMode = '3d';
      if (map && map.getLayer('train-dot-white-black')) {
        map.setLayoutProperty('train-dot-white-black', 'visibility', 'none');
        map.setLayoutProperty('train-dot-pupil', 'visibility', 'none');
        map.setLayoutProperty('train-consist-3d', 'visibility', 'visible');
      }
    });

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
    map.on('click', 'platform-slab-deck', (e) => {
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
    map.on('mouseenter', 'platform-slab-deck', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'platform-slab-deck', () => { map.getCanvas().style.cursor = ''; });
  }

  function updateCalloutCard(props) {
    document.getElementById('ins-id').textContent = `Train ${props.id}`;
    document.getElementById('ins-track').textContent = props.track;
    document.getElementById('ins-dir').textContent = props.directionLabel;
    document.getElementById('ins-between').textContent = `${props.fromStation} ➔ ${props.toStation}`;
    document.getElementById('ins-speed').textContent = `${props.speedKph} km/h`;
  }

  document.addEventListener('DOMContentLoaded', init);

})();
