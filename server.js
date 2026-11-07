/**
 * Delhi Metro Radar — Backend Dispatch Engine (Continuous Loop)
 * Simulates active metro trains on two parallel railway tracks (Up & Down line).
 * Trains reverse at terminals (Samaypur Badli & Millennium City Centre) and cross each other.
 * Node.js Native HTTP & SSE.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;

// ══════════════════════════════════════════════════════════════
//  YELLOW LINE CORRIDOR (37 STATIONS)
// ══════════════════════════════════════════════════════════════
const STATIONS = [
  { id: 'samaypur_badli',       name: 'Samaypur Badli',        coords: [77.1465, 28.7429], terminus: true,  major: true },
  { id: 'rohini_18_19',         name: 'Rohini Sector 18, 19',  coords: [77.1356, 28.7402], terminus: false, major: false },
  { id: 'haiderpur_badli_mor',  name: 'Haiderpur Badli Mor',   coords: [77.1500, 28.7187], terminus: false, major: false },
  { id: 'jahangirpuri',         name: 'Jahangirpuri',          coords: [77.1612, 28.7282], terminus: false, major: false },
  { id: 'adarsh_nagar',         name: 'Adarsh Nagar',          coords: [77.1673, 28.7144], terminus: false, major: false },
  { id: 'azadpur',              name: 'Azadpur',               coords: [77.1799, 28.7073], terminus: false, major: true },
  { id: 'model_town',           name: 'Model Town',            coords: [77.1938, 28.7028], terminus: false, major: false },
  { id: 'gtb_nagar',            name: 'GTB Nagar',             coords: [77.2064, 28.6981], terminus: false, major: false },
  { id: 'vishwavidyalaya',      name: 'Vishwavidyalaya',       coords: [77.2124, 28.6948], terminus: false, major: false },
  { id: 'vidhan_sabha',         name: 'Vidhan Sabha',          coords: [77.2216, 28.6878], terminus: false, major: false },
  { id: 'civil_lines',          name: 'Civil Lines',           coords: [77.2250, 28.6769], terminus: false, major: false },
  { id: 'kashmere_gate',        name: 'Kashmere Gate',         coords: [77.2282, 28.6675], terminus: false, major: true },
  { id: 'chandni_chowk',        name: 'Chandni Chowk',        coords: [77.2292, 28.6564], terminus: false, major: false },
  { id: 'chawri_bazar',         name: 'Chawri Bazar',          coords: [77.2263, 28.6496], terminus: false, major: false },
  { id: 'new_delhi',            name: 'New Delhi',             coords: [77.2224, 28.6429], terminus: false, major: true },
  { id: 'rajiv_chowk',          name: 'Rajiv Chowk',          coords: [77.2196, 28.6329], terminus: false, major: true },
  { id: 'patel_chowk',          name: 'Patel Chowk',          coords: [77.2123, 28.6230], terminus: false, major: false },
  { id: 'central_secretariat',  name: 'Central Secretariat',  coords: [77.2120, 28.6150], terminus: false, major: true },
  { id: 'udyog_bhawan',         name: 'Udyog Bhawan',         coords: [77.2101, 28.6115], terminus: false, major: false },
  { id: 'lok_kalyan_marg',      name: 'Lok Kalyan Marg',      coords: [77.2091, 28.5975], terminus: false, major: false },
  { id: 'jor_bagh',             name: 'Jor Bagh',             coords: [77.2129, 28.5878], terminus: false, major: false },
  { id: 'dilli_haat_ina',       name: 'Dilli Haat - INA',     coords: [77.2108, 28.5741], terminus: false, major: true },
  { id: 'aiims',                name: 'AIIMS',                coords: [77.2078, 28.5669], terminus: false, major: false },
  { id: 'green_park',           name: 'Green Park',           coords: [77.2057, 28.5595], terminus: false, major: false },
  { id: 'hauz_khas',            name: 'Hauz Khas',            coords: [77.2067, 28.5443], terminus: false, major: true },
  { id: 'malviya_nagar',        name: 'Malviya Nagar',        coords: [77.2098, 28.5355], terminus: false, major: false },
  { id: 'saket',                name: 'Saket',                coords: [77.2069, 28.5238], terminus: false, major: false },
  { id: 'qutab_minar',          name: 'Qutab Minar',          coords: [77.1843, 28.5134], terminus: false, major: false },
  { id: 'chhatarpur',           name: 'Chhatarpur',           coords: [77.1706, 28.5082], terminus: false, major: false },
  { id: 'sultanpur',            name: 'Sultanpur',            coords: [77.1478, 28.4975], terminus: false, major: false },
  { id: 'ghitorni',             name: 'Ghitorni',             coords: [77.1352, 28.4891], terminus: false, major: false },
  { id: 'arjan_garh',           name: 'Arjan Garh',           coords: [77.1264, 28.4795], terminus: false, major: false },
  { id: 'guru_dronacharya',     name: 'Guru Dronacharya',     coords: [77.1084, 28.4802], terminus: false, major: false },
  { id: 'sikanderpur',          name: 'Sikanderpur',          coords: [77.0931, 28.4827], terminus: false, major: true },
  { id: 'mg_road',              name: 'MG Road',              coords: [77.0848, 28.4787], terminus: false, major: false },
  { id: 'iffco_chowk',          name: 'IFFCO Chowk',          coords: [77.0722, 28.4725], terminus: false, major: false },
  { id: 'millennium_city_centre', name: 'Millennium City Centre', coords: [77.0725, 28.4594], terminus: true, major: true }
];

const N = STATIONS.length;
const TRACK_OFFSET = 0.00010; // ~11m realistic flyover dual-track separation (both tracks on same viaduct deck)

// Precompute parallel track coordinates
// Track 1 (Southbound): +normal vector
// Track 2 (Northbound): -normal vector
const TRACK_SOUTH = [];
const TRACK_NORTH = [];

for (let i = 0; i < N; i++) {
  let dx = 0, dy = 0;
  if (i < N - 1) {
    dx = STATIONS[i + 1].coords[0] - STATIONS[i].coords[0];
    dy = STATIONS[i + 1].coords[1] - STATIONS[i].coords[1];
  } else {
    dx = STATIONS[i].coords[0] - STATIONS[i - 1].coords[0];
    dy = STATIONS[i].coords[1] - STATIONS[i - 1].coords[1];
  }
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;

  TRACK_SOUTH.push([
    STATIONS[i].coords[0] + nx * TRACK_OFFSET,
    STATIONS[i].coords[1] + ny * TRACK_OFFSET
  ]);

  TRACK_NORTH.push([
    STATIONS[i].coords[0] - nx * TRACK_OFFSET,
    STATIONS[i].coords[1] - ny * TRACK_OFFSET
  ]);
}

// ══════════════════════════════════════════════════════════════
//  PRECOMPUTE PHYSICAL STATION PLATFORMS & CANOPIES
// ══════════════════════════════════════════════════════════════
const PLATFORM_SLABS = [];
const TACTILE_EDGES = [];
const PLATFORM_CANOPIES = [];

const P_LEN = 0.00065; // ~70m length
const P_WID = 0.00016; // ~18m width (enveloping both tracks on flyover)

for (let i = 0; i < N; i++) {
  const s = STATIONS[i];
  let dx = 0, dy = 0;
  if (i < N - 1) {
    dx = STATIONS[i + 1].coords[0] - STATIONS[i].coords[0];
    dy = STATIONS[i + 1].coords[1] - STATIONS[i].coords[1];
  } else {
    dx = STATIONS[i].coords[0] - STATIONS[i - 1].coords[0];
    dy = STATIONS[i].coords[1] - STATIONS[i - 1].coords[1];
  }
  const L = Math.hypot(dx, dy) || 1;
  const tx = dx / L, ty = dy / L;
  const nx = -ty, ny = tx;

  const x = s.coords[0];
  const y = s.coords[1];

  // Platform Slab Polygon
  const c1 = [x - tx * P_LEN - nx * P_WID, y - ty * P_LEN - ny * P_WID];
  const c2 = [x + tx * P_LEN - nx * P_WID, y + ty * P_LEN - ny * P_WID];
  const c3 = [x + tx * P_LEN + nx * P_WID, y + ty * P_LEN + ny * P_WID];
  const c4 = [x - tx * P_LEN + nx * P_WID, y - ty * P_LEN + ny * P_WID];

  PLATFORM_SLABS.push({
    type: 'Feature',
    properties: { id: s.id, name: s.name, major: s.major, index: i },
    geometry: { type: 'Polygon', coordinates: [[c1, c2, c3, c4, c1]] }
  });

  // Tactile Yellow Hazard Edges along the platform facing the tracks
  TACTILE_EDGES.push({
    type: 'Feature',
    properties: { id: s.id + '_edge1', side: 'down' },
    geometry: {
      type: 'LineString',
      coordinates: [
        [x - tx * P_LEN + nx * (P_WID - 0.00002), y - ty * P_LEN + ny * (P_WID - 0.00002)],
        [x + tx * P_LEN + nx * (P_WID - 0.00002), y + ty * P_LEN + ny * (P_WID - 0.00002)]
      ]
    }
  });

  TACTILE_EDGES.push({
    type: 'Feature',
    properties: { id: s.id + '_edge2', side: 'up' },
    geometry: {
      type: 'LineString',
      coordinates: [
        [x - tx * P_LEN - nx * (P_WID - 0.00002), y - ty * P_LEN - ny * (P_WID - 0.00002)],
        [x + tx * P_LEN - nx * (P_WID - 0.00002), y + ty * P_LEN - ny * (P_WID - 0.00002)]
      ]
    }
  });

  // Modern Cantilevered Canopy Roof (Hovering in 3D above platform)
  const CL = P_LEN * 0.85;
  const CW = P_WID * 0.95;
  const k1 = [x - tx * CL - nx * CW, y - ty * CL - ny * CW];
  const k2 = [x + tx * CL - nx * CW, y + ty * CL - ny * CW];
  const k3 = [x + tx * CL + nx * CW, y + ty * CL + ny * CW];
  const k4 = [x - tx * CL + nx * CW, y - ty * CL + ny * CW];

  PLATFORM_CANOPIES.push({
    type: 'Feature',
    properties: { id: s.id, name: s.name, height: s.major ? 9 : 7, base: 4.5 },
    geometry: { type: 'Polygon', coordinates: [[k1, k2, k3, k4, k1]] }
  });
}

// ══════════════════════════════════════════════════════════════
//  CONTINUOUS CLOSED-LOOP TRAIN FLEET SIMULATOR
// ══════════════════════════════════════════════════════════════
// Total loop = 36 Southbound segments + 1 Millennium Crossover
//            + 36 Northbound segments + 1 Badli Crossover
//            = 74 continuous units!
const FLEET_SIZE = 16;
const LOOP_UNITS = (N - 1) * 2 + 2; // 74 units

// Speed multiplier (can be adjusted via /api/speed)
let simSpeed = 1.0;
let simulationTick = 0;

// Returns train state for given loop position (0.0 to LOOP_UNITS)
function getTrainAtLoopPosition(loopPos, trainIndex) {
  const normPos = ((loopPos % LOOP_UNITS) + LOOP_UNITS) % LOOP_UNITS;

  let coords, fromStation, toStation, directionLabel, speedKph, track, bearing;

  if (normPos < 36) {
    // 1. Southbound on Track 1 (Down Line): Stations 0 to 36
    const segIdx = Math.floor(normPos);
    const progress = normPos - segIdx; // 0.0 to 1.0
    const nextIdx = Math.min(N - 1, segIdx + 1);

    const c1 = TRACK_SOUTH[segIdx];
    const c2 = TRACK_SOUTH[nextIdx];
    coords = [
      c1[0] + (c2[0] - c1[0]) * progress,
      c1[1] + (c2[1] - c1[1]) * progress
    ];

    bearing = (Math.atan2(c2[0] - c1[0], c2[1] - c1[1]) * 180 / Math.PI + 360) % 360;

    fromStation = STATIONS[segIdx].name;
    toStation = STATIONS[nextIdx].name;
    directionLabel = 'Southbound ➔ Millennium City Centre';
    track = 'Track 1 (Down Line)';

    const bell = Math.sin(progress * Math.PI);
    speedKph = Math.round(25 + 45 * bell);

  } else if (normPos < 37) {
    // 2. Millennium City Centre Crossover Reversal (Track 1 ➔ Track 2)
    const progress = normPos - 36;
    const c1 = TRACK_SOUTH[N - 1];
    const c2 = TRACK_NORTH[N - 1];
    coords = [
      c1[0] + (c2[0] - c1[0]) * progress,
      c1[1] + (c2[1] - c1[1]) * progress
    ];

    bearing = (Math.atan2(c2[0] - c1[0], c2[1] - c1[1]) * 180 / Math.PI + 360) % 360;

    fromStation = 'Millennium City Centre (Platform 1)';
    toStation = 'Millennium City Centre (Platform 2)';
    directionLabel = '🔄 Terminal Crossover Switch ➔ Reversing North';
    track = 'Terminal Crossover Loop';
    speedKph = 15;

  } else if (normPos < 73) {
    // 3. Northbound on Track 2 (Up Line): Stations 36 down to 0
    const northPos = normPos - 37;
    const segIdx = Math.floor(northPos);
    const progress = northPos - segIdx;

    const fromStationIdx = N - 1 - segIdx;
    const toStationIdx = Math.max(0, fromStationIdx - 1);

    const c1 = TRACK_NORTH[fromStationIdx];
    const c2 = TRACK_NORTH[toStationIdx];
    coords = [
      c1[0] + (c2[0] - c1[0]) * progress,
      c1[1] + (c2[1] - c1[1]) * progress
    ];

    bearing = (Math.atan2(c2[0] - c1[0], c2[1] - c1[1]) * 180 / Math.PI + 360) % 360;

    fromStation = STATIONS[fromStationIdx].name;
    toStation = STATIONS[toStationIdx].name;
    directionLabel = 'Northbound ➔ Samaypur Badli';
    track = 'Track 2 (Up Line)';

    const bell = Math.sin(progress * Math.PI);
    speedKph = Math.round(25 + 45 * bell);

  } else {
    // 4. Samaypur Badli Crossover Reversal (Track 2 ➔ Track 1)
    const progress = normPos - 73;
    const c1 = TRACK_NORTH[0];
    const c2 = TRACK_SOUTH[0];
    coords = [
      c1[0] + (c2[0] - c1[0]) * progress,
      c1[1] + (c2[1] - c1[1]) * progress
    ];

    bearing = (Math.atan2(c2[0] - c1[0], c2[1] - c1[1]) * 180 / Math.PI + 360) % 360;

    fromStation = 'Samaypur Badli (Platform 2)';
    toStation = 'Samaypur Badli (Platform 1)';
    directionLabel = '🔄 Terminal Crossover Switch ➔ Reversing South';
    track = 'Terminal Crossover Loop';
    speedKph = 15;
  }

  return {
    id: `Y-${String(trainIndex + 1).padStart(2, '0')}`,
    coords,
    bearing: Math.round(bearing),
    fromStation,
    toStation,
    directionLabel,
    speedKph,
    track
  };
}

function getActiveFleet() {
  const trains = [];
  const spacing = LOOP_UNITS / FLEET_SIZE;

  for (let i = 0; i < FLEET_SIZE; i++) {
    const pos = simulationTick * 0.035 * simSpeed + i * spacing;
    trains.push(getTrainAtLoopPosition(pos, i));
  }

  return {
    timestamp: Date.now(),
    trainCount: trains.length,
    simSpeed,
    trains
  };
}

// Tick loop (10 Hz = every 100ms for ultra-smooth movement)
setInterval(() => {
  simulationTick += 0.1;
  broadcastSSE();
}, 100);

// ══════════════════════════════════════════════════════════════
//  HTTP SERVER & SERVER-SENT EVENTS (SSE)
// ══════════════════════════════════════════════════════════════
const sseClients = new Set();

function broadcastSSE() {
  if (sseClients.size === 0) return;
  const payload = JSON.stringify(getActiveFleet());
  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. SSE Stream
  if (pathname === '/api/trains/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify(getActiveFleet())}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // 2. Snapshot
  if (pathname === '/api/trains') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getActiveFleet()));
    return;
  }

  // 3. Topology (Stations, Dual Tracks, Platforms & Canopies GeoJSON)
  if (pathname === '/api/tracks') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      stations: STATIONS,
      viaductCenter: STATIONS.map(s => s.coords),
      trackSouth: TRACK_SOUTH,
      trackNorth: TRACK_NORTH,
      crossoverNorth: [TRACK_NORTH[0], TRACK_SOUTH[0]],
      crossoverSouth: [TRACK_SOUTH[N - 1], TRACK_NORTH[N - 1]],
      platformSlabs: { type: 'FeatureCollection', features: PLATFORM_SLABS },
      tactileEdges: { type: 'FeatureCollection', features: TACTILE_EDGES },
      platformCanopies: { type: 'FeatureCollection', features: PLATFORM_CANOPIES }
    }));
    return;
  }

  // 4. Adjust speed
  if (pathname === '/api/speed') {
    const s = parseFloat(parsedUrl.query.m);
    if (s && s > 0 && s <= 20) {
      simSpeed = s;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, simSpeed }));
    return;
  }

  // 5. Static Files
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚇 Delhi Metro Dual-Track Simulator running on http://localhost:${PORT}`);
});
