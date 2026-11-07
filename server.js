/**
 * Delhi Metro Radar — Backend Dispatch Engine (Continuous Loop)
 * Simulates active metro trains on two parallel railway tracks (Up & Down line).
 * Features 100% authentic real-world physical track geometry from OpenStreetMap Relation 447210
 * with 389 smooth curvature nodes following MG Road, Sri Aurobindo Marg, and GT Karnal Road.
 * Node.js Native HTTP & SSE.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;

// ══════════════════════════════════════════════════════════════
//  1. LOAD OFFICIAL OPENSTREETMAP RELATION 447210 GEOMETRY
// ══════════════════════════════════════════════════════════════
const OSM_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'yellow_line_accurate_osm.json'), 'utf-8'));

const STATIONS = OSM_DATA.stations;
const CENTERLINE = OSM_DATA.centerline;
const FLYOVER_NORTH_CENTER = OSM_DATA.flyoverNorthCenter;
const TUNNEL_CENTER = OSM_DATA.tunnelCenter;
const FLYOVER_SOUTH_CENTER = OSM_DATA.flyoverSouthCenter;
const PORTAL_NORTH = OSM_DATA.portalNorth;
const PORTAL_SOUTH = OSM_DATA.portalSouth;
const NP_NODE_IDX = OSM_DATA.portalNorthNodeIndex; // 110
const SP_NODE_IDX = OSM_DATA.portalSouthNodeIndex; // 232

const N = STATIONS.length;   // 37 stations
const M = CENTERLINE.length; // 389 physical curvature nodes

// Precompute cumulative physical distances in meters along the 389 nodes
const CUM_DIST = [0];
for (let i = 0; i < M - 1; i++) {
  const p1 = CENTERLINE[i];
  const p2 = CENTERLINE[i + 1];
  const latAvg = (p1[1] + p2[1]) / 2 * Math.PI / 180;
  const dx = (p2[0] - p1[0]) * 111320 * Math.cos(latAvg);
  const dy = (p2[1] - p1[1]) * 110852;
  const d = Math.hypot(dx, dy);
  CUM_DIST.push(CUM_DIST[CUM_DIST.length - 1] + d);
}

const TOTAL_ROUTE_METERS = CUM_DIST[M - 1]; // ~47.62 km
const CROSSOVER_METERS = 380; // Terminal switch turnaround length
const HALF_LOOP_METERS = TOTAL_ROUTE_METERS + CROSSOVER_METERS;
const FULL_LOOP_METERS = HALF_LOOP_METERS * 2; // ~96 km continuous loop

const STATION_DISTANCES = STATIONS.map(s => CUM_DIST[s.trackNodeIndex]);

// ══════════════════════════════════════════════════════════════
//  2. DUAL-TRACK OFFSET GEOMETRY (TRACK 1 SOUTHBOUND & TRACK 2 NORTHBOUND)
// ══════════════════════════════════════════════════════════════
const TRACK_OFFSET = 0.00018; // ~20m clear physical dual-track separation (40m corridor envelope)

const TRACK_SOUTH = [];
const TRACK_NORTH = [];

for (let i = 0; i < M; i++) {
  let dx = 0, dy = 0;
  if (i < M - 1) {
    dx = CENTERLINE[i + 1][0] - CENTERLINE[i][0];
    dy = CENTERLINE[i + 1][1] - CENTERLINE[i][1];
  } else {
    dx = CENTERLINE[i][0] - CENTERLINE[i - 1][0];
    dy = CENTERLINE[i][1] - CENTERLINE[i - 1][1];
  }
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;

  TRACK_SOUTH.push([
    Number((CENTERLINE[i][0] + nx * TRACK_OFFSET).toFixed(6)),
    Number((CENTERLINE[i][1] + ny * TRACK_OFFSET).toFixed(6))
  ]);

  TRACK_NORTH.push([
    Number((CENTERLINE[i][0] - nx * TRACK_OFFSET).toFixed(6)),
    Number((CENTERLINE[i][1] - ny * TRACK_OFFSET).toFixed(6))
  ]);
}

// Subdivided track segments for Flyovers (North/South) and Subterranean Tunnel
const trackSouthFlyoverNorth = TRACK_SOUTH.slice(0, NP_NODE_IDX + 1);
const trackNorthFlyoverNorth = TRACK_NORTH.slice(0, NP_NODE_IDX + 1);

const trackSouthTunnel = TRACK_SOUTH.slice(NP_NODE_IDX, SP_NODE_IDX + 1);
const trackNorthTunnel = TRACK_NORTH.slice(NP_NODE_IDX, SP_NODE_IDX + 1);

const trackSouthFlyoverSouth = TRACK_SOUTH.slice(SP_NODE_IDX);
const trackNorthFlyoverSouth = TRACK_NORTH.slice(SP_NODE_IDX);

// ══════════════════════════════════════════════════════════════
//  3. TUNNEL PORTALS & TRANSITION RAMPS (EXACT PHYSICAL COORDINATES)
// ══════════════════════════════════════════════════════════════
const TUNNEL_PORTALS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'portal_north',
      properties: {
        id: 'portal_north',
        name: 'Model Town ➔ GTB Nagar Tunnel Portal',
        shortName: 'North Tunnel Portal',
        desc: 'Elevated Flyover (+14m) ➔ Subterranean Tube Tunnel (-16m) Ramp',
        type: 'north_descent',
        elevFrom: '+14m',
        elevTo: '-16m'
      },
      geometry: { type: 'Point', coordinates: PORTAL_NORTH }
    },
    {
      type: 'Feature',
      id: 'portal_south',
      properties: {
        id: 'portal_south',
        name: 'Saket ➔ Qutab Minar Tunnel Portal',
        shortName: 'South Tunnel Portal',
        desc: 'Subterranean Tube Tunnel (-16m) ➔ Elevated Flyover (+15m) Ramp',
        type: 'south_ascent',
        elevFrom: '-16m',
        elevTo: '+15m'
      },
      geometry: { type: 'Point', coordinates: PORTAL_SOUTH }
    }
  ]
};

// Portal Cutaway Ramps oriented along the true track tangents
function getPortalRampCoords(nodeIdx, lenM, widM) {
  const p = CENTERLINE[nodeIdx];
  const pNext = CENTERLINE[Math.min(M - 1, nodeIdx + 1)];
  const pPrev = CENTERLINE[Math.max(0, nodeIdx - 1)];
  const dx = pNext[0] - pPrev[0];
  const dy = pNext[1] - pPrev[1];
  const L = Math.hypot(dx, dy) || 1;
  const tx = dx / L, ty = dy / L;
  const nx = -ty, ny = tx;

  const R_LEN = lenM;
  const R_WID = widM;

  const c1 = [p[0] - tx * R_LEN - nx * R_WID, p[1] - ty * R_LEN - ny * R_WID];
  const c2 = [p[0] + tx * R_LEN - nx * R_WID, p[1] + ty * R_LEN - ny * R_WID];
  const c3 = [p[0] + tx * R_LEN + nx * R_WID, p[1] + ty * R_LEN + ny * R_WID];
  const c4 = [p[0] - tx * R_LEN + nx * R_WID, p[1] - ty * R_LEN + ny * R_WID];

  return [[c1, c2, c3, c4, c1]];
}

const PORTAL_RAMPS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'ramp_north', name: 'Model Town Portal Cutaway Ramp', type: 'portal_ramp' },
      geometry: { type: 'Polygon', coordinates: getPortalRampCoords(NP_NODE_IDX, 0.00065, 0.00028) }
    },
    {
      type: 'Feature',
      properties: { id: 'ramp_south', name: 'Saket Portal Cutaway Ramp', type: 'portal_ramp' },
      geometry: { type: 'Polygon', coordinates: getPortalRampCoords(SP_NODE_IDX, 0.00065, 0.00028) }
    }
  ]
};

// ══════════════════════════════════════════════════════════════
//  4. PRECOMPUTE PHYSICAL STATION PLATFORMS, CANOPIES & CHAMBERS
// ══════════════════════════════════════════════════════════════
const PLATFORM_SLABS = [];
const TACTILE_EDGES = [];
const PLATFORM_CANOPIES = [];
const UNDERGROUND_PLATFORMS = [];

const P_LEN = 0.00065; // ~70m length
const P_WID = 0.00028; // ~30m width (enveloping both tracks comfortably)

for (let i = 0; i < N; i++) {
  const s = STATIONS[i];
  const nodeIdx = s.trackNodeIndex;

  let dx = 0, dy = 0;
  if (nodeIdx < M - 1) {
    dx = CENTERLINE[nodeIdx + 1][0] - CENTERLINE[nodeIdx][0];
    dy = CENTERLINE[nodeIdx + 1][1] - CENTERLINE[nodeIdx][1];
  } else {
    dx = CENTERLINE[nodeIdx][0] - CENTERLINE[nodeIdx - 1][0];
    dy = CENTERLINE[nodeIdx][1] - CENTERLINE[nodeIdx - 1][1];
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
    properties: { id: s.id, name: s.name, major: s.major, index: i, structure: s.structure, elevM: s.elevM },
    geometry: { type: 'Polygon', coordinates: [[c1, c2, c3, c4, c1]] }
  });

  // Tactile Yellow Hazard Edges along the platform facing the tracks
  TACTILE_EDGES.push({
    type: 'Feature',
    properties: { id: s.id + '_edge1', side: 'down', structure: s.structure },
    geometry: {
      type: 'LineString',
      coordinates: [
        [x - tx * P_LEN + nx * (P_WID - 0.00003), y - ty * P_LEN + ny * (P_WID - 0.00003)],
        [x + tx * P_LEN + nx * (P_WID - 0.00003), y + ty * P_LEN + ny * (P_WID - 0.00003)]
      ]
    }
  });

  TACTILE_EDGES.push({
    type: 'Feature',
    properties: { id: s.id + '_edge2', side: 'up', structure: s.structure },
    geometry: {
      type: 'LineString',
      coordinates: [
        [x - tx * P_LEN - nx * (P_WID - 0.00003), y - ty * P_LEN - ny * (P_WID - 0.00003)],
        [x + tx * P_LEN - nx * (P_WID - 0.00003), y + ty * P_LEN - ny * (P_WID - 0.00003)]
      ]
    }
  });

  if (s.structure === 'elevated') {
    // Modern Cantilevered Sky-Blue Canopy Roof (Hovering in 3D ONLY above elevated flyover stations)
    const CL = P_LEN * 0.85;
    const CW = P_WID * 0.95;
    const k1 = [x - tx * CL - nx * CW, y - ty * CL - ny * CW];
    const k2 = [x + tx * CL - nx * CW, y + ty * CL - ny * CW];
    const k3 = [x + tx * CL + nx * CW, y + ty * CL + ny * CW];
    const k4 = [x - tx * CL + nx * CW, y - ty * CL + ny * CW];

    PLATFORM_CANOPIES.push({
      type: 'Feature',
      properties: { id: s.id, name: s.name, height: s.major ? 9 : 7, base: 4.5, structure: 'elevated', elevM: s.elevM },
      geometry: { type: 'Polygon', coordinates: [[k1, k2, k3, k4, k1]] }
    });
  } else {
    // Subterranean Station Chamber Cutaway Box (Dark Slate Vault with Depth Badge)
    const UL = P_LEN * 1.1;
    const UW = P_WID * 1.25;
    const u1 = [x - tx * UL - nx * UW, y - ty * UL - ny * UW];
    const u2 = [x + tx * UL - nx * UW, y + ty * UL - ny * UW];
    const u3 = [x + tx * UL + nx * UW, y + ty * UL + ny * UW];
    const u4 = [x - tx * UL + nx * UW, y - ty * UL + ny * UW];

    UNDERGROUND_PLATFORMS.push({
      type: 'Feature',
      properties: { id: s.id, name: s.name, depth: s.elevM, major: s.major, structure: 'underground' },
      geometry: { type: 'Polygon', coordinates: [[u1, u2, u3, u4, u1]] }
    });
  }
}

// ══════════════════════════════════════════════════════════════
//  5. CONTINUOUS CLOSED-LOOP FLEET SIMULATOR (SMOOTH 389-NODE INTERPOLATION)
// ══════════════════════════════════════════════════════════════
const FLEET_SIZE = 16;
let simSpeed = 1.0;
let simulationTick = 0;

// High-speed binary search along precomputed physical cumulative distances
function getPointAlongPolyline(pts, targetD) {
  if (targetD <= 0) {
    const p1 = pts[0], p2 = pts[1];
    const b = (Math.atan2(p2[0] - p1[0], p2[1] - p1[1]) * 180 / Math.PI + 360) % 360;
    return { pt: pts[0], bearing: b, seg: 0, prog: 0 };
  }
  if (targetD >= TOTAL_ROUTE_METERS) {
    const p1 = pts[M - 2], p2 = pts[M - 1];
    const b = (Math.atan2(p2[0] - p1[0], p2[1] - p1[1]) * 180 / Math.PI + 360) % 360;
    return { pt: pts[M - 1], bearing: b, seg: M - 2, prog: 1 };
  }

  let low = 0, high = M - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (CUM_DIST[mid] <= targetD) low = mid + 1;
    else high = mid - 1;
  }
  const seg = Math.max(0, Math.min(M - 2, high));
  const d0 = CUM_DIST[seg];
  const d1 = CUM_DIST[seg + 1];
  const prog = (targetD - d0) / Math.max(1e-6, d1 - d0);
  const p1 = pts[seg];
  const p2 = pts[seg + 1];

  const pt = [
    Number((p1[0] + (p2[0] - p1[0]) * prog).toFixed(6)),
    Number((p1[1] + (p2[1] - p1[1]) * prog).toFixed(6))
  ];
  const bearing = (Math.atan2(p2[0] - p1[0], p2[1] - p1[1]) * 180 / Math.PI + 360) % 360;
  return { pt, bearing, seg, prog };
}

function getTrainAtLoopPosition(loopMeters, trainIndex) {
  const normMeters = ((loopMeters % FULL_LOOP_METERS) + FULL_LOOP_METERS) % FULL_LOOP_METERS;

  let coords, fromStation, toStation, directionLabel, speedKph, track, bearing;
  let structure, elevM, elevLabel;

  if (normMeters < TOTAL_ROUTE_METERS) {
    // ── 1. SOUTHBOUND on Track 1 (Down Line): Samaypur Badli ➔ Millennium City Centre ──
    const targetD = normMeters;
    const res = getPolylinePointSafe(TRACK_SOUTH, targetD);
    coords = res.pt;
    bearing = Math.round(res.bearing);

    // Find current station interval
    let k = 0;
    while (k < N - 1 && STATION_DISTANCES[k + 1] <= targetD) {
      k++;
    }
    fromStation = STATIONS[k].name;
    toStation = STATIONS[Math.min(N - 1, k + 1)].name;
    directionLabel = 'Southbound ➔ Millennium City Centre';
    track = 'Track 1 (Down Line)';

    // Smooth sinusoidal acceleration between stations
    const dFrom = STATION_DISTANCES[k];
    const dTo = STATION_DISTANCES[Math.min(N - 1, k + 1)];
    const stProgress = (targetD - dFrom) / Math.max(10, dTo - dFrom);
    const bell = Math.sin(Math.min(1.0, Math.max(0.0, stProgress)) * Math.PI);
    speedKph = Math.round(30 + 45 * bell);

    // Physical Elevation & Structure based on real-world node index
    if (res.seg < NP_NODE_IDX) {
      structure = 'elevated';
      elevM = 15;
      elevLabel = 'Elevated Viaduct (+15m)';
    } else if (res.seg === NP_NODE_IDX) {
      elevM = Math.round(14 + (-16 - 14) * res.prog);
      structure = res.prog < 0.5 ? 'elevated' : 'underground';
      elevLabel = `North Portal Ramp (${elevM >= 0 ? '+' : ''}${elevM}m)`;
    } else if (res.seg > NP_NODE_IDX && res.seg < SP_NODE_IDX) {
      elevM = -18;
      structure = 'underground';
      elevLabel = 'Subterranean Tube (-16m to -28m)';
    } else if (res.seg === SP_NODE_IDX) {
      elevM = Math.round(-16 + (15 - (-16)) * res.prog);
      structure = res.prog < 0.5 ? 'underground' : 'elevated';
      elevLabel = `South Portal Ramp (${elevM >= 0 ? '+' : ''}${elevM}m)`;
    } else {
      structure = 'elevated';
      elevM = 15;
      elevLabel = 'Elevated Viaduct (+15m)';
    }

  } else if (normMeters < HALF_LOOP_METERS) {
    // ── 2. Millennium City Centre Crossover Reversal (Track 1 ➔ Track 2) ──
    const revProg = (normMeters - TOTAL_ROUTE_METERS) / CROSSOVER_METERS;
    const c1 = TRACK_SOUTH[M - 1];
    const c2 = TRACK_NORTH[M - 1];
    coords = [
      Number((c1[0] + (c2[0] - c1[0]) * revProg).toFixed(6)),
      Number((c1[1] + (c2[1] - c1[1]) * revProg).toFixed(6))
    ];
    bearing = Math.round((Math.atan2(c2[0] - c1[0], c2[1] - c1[1]) * 180 / Math.PI + 360) % 360);

    fromStation = 'Millennium City Centre (Platform 1)';
    toStation = 'Millennium City Centre (Platform 2)';
    directionLabel = '🔄 Terminal Crossover Switch ➔ Reversing North';
    track = 'Terminal Crossover Loop';
    speedKph = 15;
    structure = 'elevated';
    elevM = 16;
    elevLabel = 'Elevated Terminal (+16m)';

  } else if (normMeters < HALF_LOOP_METERS + TOTAL_ROUTE_METERS) {
    // ── 3. NORTHBOUND on Track 2 (Up Line): Millennium City Centre ➔ Samaypur Badli ──
    const targetD = TOTAL_ROUTE_METERS - (normMeters - HALF_LOOP_METERS);
    const res = getPolylinePointSafe(TRACK_NORTH, targetD);
    coords = res.pt;
    // Reverse bearing because train is heading Northwards
    bearing = Math.round((res.bearing + 180) % 360);

    let k = N - 1;
    while (k > 0 && STATION_DISTANCES[k - 1] >= targetD) {
      k--;
    }
    fromStation = STATIONS[k].name;
    toStation = STATIONS[Math.max(0, k - 1)].name;
    directionLabel = 'Northbound ➔ Samaypur Badli';
    track = 'Track 2 (Up Line)';

    const dFrom = STATION_DISTANCES[k];
    const dTo = STATION_DISTANCES[Math.max(0, k - 1)];
    const stProgress = (dFrom - targetD) / Math.max(10, dFrom - dTo);
    const bell = Math.sin(Math.min(1.0, Math.max(0.0, stProgress)) * Math.PI);
    speedKph = Math.round(30 + 45 * bell);

    if (res.seg > SP_NODE_IDX) {
      structure = 'elevated';
      elevM = 15;
      elevLabel = 'Elevated Viaduct (+15m)';
    } else if (res.seg === SP_NODE_IDX) {
      elevM = Math.round(15 + (-16 - 15) * (1 - res.prog));
      structure = res.prog > 0.5 ? 'elevated' : 'underground';
      elevLabel = `South Portal Ramp (${elevM >= 0 ? '+' : ''}${elevM}m)`;
    } else if (res.seg > NP_NODE_IDX && res.seg < SP_NODE_IDX) {
      elevM = -18;
      structure = 'underground';
      elevLabel = 'Subterranean Tube (-16m to -28m)';
    } else if (res.seg === NP_NODE_IDX) {
      elevM = Math.round(-16 + (14 - (-16)) * (1 - res.prog));
      structure = res.prog > 0.5 ? 'elevated' : 'underground';
      elevLabel = `North Portal Ramp (${elevM >= 0 ? '+' : ''}${elevM}m)`;
    } else {
      structure = 'elevated';
      elevM = 15;
      elevLabel = 'Elevated Viaduct (+15m)';
    }

  } else {
    // ── 4. Samaypur Badli Crossover Reversal (Track 2 ➔ Track 1) ──
    const revProg = (normMeters - (HALF_LOOP_METERS + TOTAL_ROUTE_METERS)) / CROSSOVER_METERS;
    const c1 = TRACK_NORTH[0];
    const c2 = TRACK_SOUTH[0];
    coords = [
      Number((c1[0] + (c2[0] - c1[0]) * revProg).toFixed(6)),
      Number((c1[1] + (c2[1] - c1[1]) * revProg).toFixed(6))
    ];
    bearing = Math.round((Math.atan2(c2[0] - c1[0], c2[1] - c1[1]) * 180 / Math.PI + 360) % 360);

    fromStation = 'Samaypur Badli (Platform 2)';
    toStation = 'Samaypur Badli (Platform 1)';
    directionLabel = '🔄 Terminal Crossover Switch ➔ Reversing South';
    track = 'Terminal Crossover Loop';
    speedKph = 15;
    structure = 'elevated';
    elevM = 15;
    elevLabel = 'Elevated Terminal (+15m)';
  }

  return {
    id: `Y-${String(trainIndex + 1).padStart(2, '0')}`,
    coords,
    bearing,
    fromStation,
    toStation,
    directionLabel,
    speedKph,
    track,
    structure,
    elevM,
    elevLabel
  };
}

function getPolylinePointSafe(pts, targetD) {
  return getPointAlongPolyline(pts, targetD);
}

function getActiveFleet() {
  const trains = [];
  const spacing = FULL_LOOP_METERS / FLEET_SIZE;

  // 1 tick = 100ms. Average speed ~48 km/h = ~13.3 m/s = 1.33 m per 100ms tick
  for (let i = 0; i < FLEET_SIZE; i++) {
    const pos = simulationTick * 1.35 * simSpeed + i * spacing;
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
  simulationTick += 1.0;
  broadcastSSE();
}, 100);

// ══════════════════════════════════════════════════════════════
//  6. HTTP SERVER & SERVER-SENT EVENTS (SSE)
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

  // 3. Topology (Stations, Dual Tracks, Elevated Flyovers, Subterranean Tunnels & Portals)
  if (pathname === '/api/tracks') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      stations: STATIONS,
      viaductCenter: CENTERLINE,
      flyoverNorthCenter: FLYOVER_NORTH_CENTER,
      tunnelCenter: TUNNEL_CENTER,
      flyoverSouthCenter: FLYOVER_SOUTH_CENTER,
      trackSouth: TRACK_SOUTH,
      trackNorth: TRACK_NORTH,
      trackSouthFlyoverNorth,
      trackNorthFlyoverNorth,
      trackSouthTunnel,
      trackNorthTunnel,
      trackSouthFlyoverSouth,
      trackNorthFlyoverSouth,
      crossoverNorth: [TRACK_NORTH[0], TRACK_SOUTH[0]],
      crossoverSouth: [TRACK_SOUTH[M - 1], TRACK_NORTH[M - 1]],
      tunnelPortals: TUNNEL_PORTALS,
      portalRamps: PORTAL_RAMPS,
      platformSlabs: { type: 'FeatureCollection', features: PLATFORM_SLABS },
      tactileEdges: { type: 'FeatureCollection', features: TACTILE_EDGES },
      platformCanopies: { type: 'FeatureCollection', features: PLATFORM_CANOPIES },
      undergroundPlatforms: { type: 'FeatureCollection', features: UNDERGROUND_PLATFORMS }
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
