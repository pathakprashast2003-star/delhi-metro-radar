/**
 * Delhi Metro Radar — Backend Dispatch Engine (Continuous Loop & 24h Timetable)
 * Features 100% authentic real-world physical track geometry from OpenStreetMap Relation 447210
 * with 389 smooth curvature nodes following MG Road, Sri Aurobindo Marg, and GT Karnal Road.
 * 
 * Includes:
 * 1. Physics-based CBTC Kinematics: Smooth Braking (75 -> 0 km/h), Station Dwell, and Acceleration (0 -> 75 km/h).
 * 2. Realistic Dwell Timings: Extended crowd dwell at Rajiv Chowk & Kashmere Gate + dynamic holds.
 * 3. Official DMRC 24-Hour Timetable: 
 *    - 05:30 AM: First Metro startup & depot rollouts
 *    - 08:00 - 11:30 AM & 16:30 - 20:30 PM: Peak rush (16 trains, heavy boarding)
 *    - 23:00 PM: Last Metro departs terminals
 *    - 23:00 - 00:15 AM: Final revenue trains in transit
 *    - 00:15 - 05:30 AM: Service Closed / Night Maintenance (NO passenger metros, tracks de-energized)
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
const TRACK_OFFSET = 0.00018; // ~20m physical dual-track separation

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

const trackSouthFlyoverNorth = TRACK_SOUTH.slice(0, NP_NODE_IDX + 1);
const trackNorthFlyoverNorth = TRACK_NORTH.slice(0, NP_NODE_IDX + 1);
const trackSouthTunnel = TRACK_SOUTH.slice(NP_NODE_IDX, SP_NODE_IDX + 1);
const trackNorthTunnel = TRACK_NORTH.slice(NP_NODE_IDX, SP_NODE_IDX + 1);
const trackSouthFlyoverSouth = TRACK_SOUTH.slice(SP_NODE_IDX);
const trackNorthFlyoverSouth = TRACK_NORTH.slice(SP_NODE_IDX);

// ══════════════════════════════════════════════════════════════
//  3. TUNNEL PORTALS, RAMPS & PLATFORMS
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
      properties: { id: 'ramp_south', name: 'Saket / Qutab Minar Portal Cutaway Ramp', type: 'portal_ramp' },
      geometry: { type: 'Polygon', coordinates: getPortalRampCoords(SP_NODE_IDX, 0.00065, 0.00028) }
    }
  ]
};

function getPlatformPolygon(st) {
  const idx = st.trackNodeIndex;
  const p = CENTERLINE[idx];
  const nextP = CENTERLINE[Math.min(M - 1, idx + 1)];
  const prevP = CENTERLINE[Math.max(0, idx - 1)];
  const dx = nextP[0] - prevP[0];
  const dy = nextP[1] - prevP[1];
  const L = Math.hypot(dx, dy) || 1;
  const tx = dx / L, ty = dy / L;
  const nx = -ty, ny = tx;

  const HALF_LEN = 0.00085;
  const HALF_WID = 0.00030;

  const c1 = [p[0] - tx * HALF_LEN - nx * HALF_WID, p[1] - ty * HALF_LEN - ny * HALF_WID];
  const c2 = [p[0] + tx * HALF_LEN - nx * HALF_WID, p[1] + ty * HALF_LEN - ny * HALF_WID];
  const c3 = [p[0] + tx * HALF_LEN + nx * HALF_WID, p[1] + ty * HALF_LEN + ny * HALF_WID];
  const c4 = [p[0] - tx * HALF_LEN + nx * HALF_WID, p[1] - ty * HALF_LEN + ny * HALF_WID];

  return [[c1, c2, c3, c4, c1]];
}

const PLATFORM_SLABS = STATIONS.map(s => ({
  type: 'Feature',
  properties: {
    id: s.id,
    name: s.name,
    structure: s.structure,
    elevM: s.elevM,
    major: s.major,
    terminus: s.terminus
  },
  geometry: {
    type: 'Polygon',
    coordinates: getPlatformPolygon(s)
  }
}));

const TACTILE_EDGES = STATIONS.map(s => {
  const idx = s.trackNodeIndex;
  const p = CENTERLINE[idx];
  const nextP = CENTERLINE[Math.min(M - 1, idx + 1)];
  const prevP = CENTERLINE[Math.max(0, idx - 1)];
  const dx = nextP[0] - prevP[0];
  const dy = nextP[1] - prevP[1];
  const L = Math.hypot(dx, dy) || 1;
  const tx = dx / L, ty = dy / L;
  const nx = -ty, ny = tx;
  const HALF_LEN = 0.00085;
  const EDGE_OFFSET = 0.00028;

  return {
    type: 'Feature',
    properties: { id: s.id + '_tactile' },
    geometry: {
      type: 'MultiLineString',
      coordinates: [
        [
          [p[0] - tx * HALF_LEN - nx * EDGE_OFFSET, p[1] - ty * HALF_LEN - ny * EDGE_OFFSET],
          [p[0] + tx * HALF_LEN - nx * EDGE_OFFSET, p[1] + ty * HALF_LEN - ny * EDGE_OFFSET]
        ],
        [
          [p[0] - tx * HALF_LEN + nx * EDGE_OFFSET, p[1] - ty * HALF_LEN + ny * EDGE_OFFSET],
          [p[0] + tx * HALF_LEN + nx * EDGE_OFFSET, p[1] + ty * HALF_LEN + ny * EDGE_OFFSET]
        ]
      ]
    }
  };
});

const PLATFORM_CANOPIES = STATIONS.filter(s => s.structure === 'elevated').map(s => {
  const idx = s.trackNodeIndex;
  const p = CENTERLINE[idx];
  const nextP = CENTERLINE[Math.min(M - 1, idx + 1)];
  const prevP = CENTERLINE[Math.max(0, idx - 1)];
  const dx = nextP[0] - prevP[0];
  const dy = nextP[1] - prevP[1];
  const L = Math.hypot(dx, dy) || 1;
  const tx = dx / L, ty = dy / L;
  const nx = -ty, ny = tx;

  const HALF_LEN = 0.00055;
  const HALF_WID = 0.00022;

  const c1 = [p[0] - tx * HALF_LEN - nx * HALF_WID, p[1] - ty * HALF_LEN - ny * HALF_WID];
  const c2 = [p[0] + tx * HALF_LEN - nx * HALF_WID, p[1] + ty * HALF_LEN - ny * HALF_WID];
  const c3 = [p[0] + tx * HALF_LEN + nx * HALF_WID, p[1] + ty * HALF_LEN + ny * HALF_WID];
  const c4 = [p[0] - tx * HALF_LEN + nx * HALF_WID, p[1] - ty * HALF_LEN + ny * HALF_WID];

  return {
    type: 'Feature',
    properties: { id: s.id + '_canopy', name: s.name },
    geometry: { type: 'Polygon', coordinates: [[c1, c2, c3, c4, c1]] }
  };
});

const UNDERGROUND_PLATFORMS = STATIONS.filter(s => s.structure === 'underground').map(s => ({
  type: 'Feature',
  properties: { id: s.id + '_ug', name: s.name, depthM: s.elevM },
  geometry: { type: 'Polygon', coordinates: getPlatformPolygon(s) }
}));

// ══════════════════════════════════════════════════════════════
//  4. 74 PRECOMPUTED STATION STOPS & DWELL CONFIGURATION
// ══════════════════════════════════════════════════════════════
function getStationDwellConfig(station) {
  const name = station.name;
  let baseDwell = 22; // default standard station dwell (seconds)
  let isMajorInterchange = false;
  let category = 'Standard Station';

  if (name.includes('Rajiv Chowk')) {
    baseDwell = 50; // Super-hub Blue line interchange
    isMajorInterchange = true;
    category = 'Interchange Super-Hub (Blue Line)';
  } else if (name.includes('Kashmere Gate')) {
    baseDwell = 55; // Triple interchange (Red & Violet Lines)
    isMajorInterchange = true;
    category = 'Triple Interchange Hub (Red & Violet Lines)';
  } else if (name.includes('Central Secretariat') || name.includes('New Delhi') || name.includes('Hauz Khas')) {
    baseDwell = 42;
    isMajorInterchange = true;
    category = 'Major Transit Interchange';
  } else if (name.includes('INA') || name.includes('Azadpur') || name.includes('Sikanderpur')) {
    baseDwell = 35;
    isMajorInterchange = true;
    category = 'Rapid/Pink Line Interchange';
  } else if (name.includes('Chandni Chowk') || name.includes('Chawri Bazar') || name.includes('AIIMS') || name.includes('MG Road') || name.includes('IFFCO Chowk')) {
    baseDwell = 30;
    category = 'High-Footfall Commercial Hub';
  } else if (station.terminus) {
    baseDwell = 65; // Terminal turnaround & crew change
    category = 'Terminal Turnaround & Reversal Platform';
  }

  return { baseDwell, isMajorInterchange, category };
}

const LOOP_STOPS = [];

// Southbound stops (Track 1)
for (let i = 0; i < N; i++) {
  const cfg = getStationDwellConfig(STATIONS[i]);
  LOOP_STOPS.push({
    loopMeters: STATION_DISTANCES[i],
    stationIndex: i,
    station: STATIONS[i],
    direction: 'south',
    platform: 'Platform 1 (Southbound)',
    trackName: 'Track 1 (Down Line)',
    baseDwell: cfg.baseDwell,
    isMajorInterchange: cfg.isMajorInterchange,
    category: cfg.category
  });
}

// Northbound stops (Track 2)
for (let i = N - 1; i >= 0; i--) {
  const cfg = getStationDwellConfig(STATIONS[i]);
  const loopM = HALF_LOOP_METERS + (TOTAL_ROUTE_METERS - STATION_DISTANCES[i]);
  LOOP_STOPS.push({
    loopMeters: loopM,
    stationIndex: i,
    station: STATIONS[i],
    direction: 'north',
    platform: 'Platform 2 (Northbound)',
    trackName: 'Track 2 (Up Line)',
    baseDwell: cfg.baseDwell,
    isMajorInterchange: cfg.isMajorInterchange,
    category: cfg.category
  });
}

LOOP_STOPS.sort((a, b) => a.loopMeters - b.loopMeters);

// ══════════════════════════════════════════════════════════════
//  5. 24-HOUR DMRC TIMETABLE & SCHEDULE STATE MACHINE
// ══════════════════════════════════════════════════════════════
let timeMode = 'live'; // 'live' (syncs to real IST) | 'custom' (user scrubbed)
let customTimeSeconds = 9 * 3600 + 20 * 60; // default 09:20 AM

function getSecondsOfDay() {
  if (timeMode === 'live') {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utcMs + (5.5 * 3600000));
    return ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds();
  }
  return customTimeSeconds;
}

function getServiceSchedule(sec) {
  // Real DMRC Schedule for Yellow Line:
  // 00:15 - 05:30: Night Non-Revenue Window (Track Maintenance, NO passenger metros)
  // 05:30 - 06:00: First Train Startup from Terminals & Depots
  // 06:00 - 08:00: Early Morning Service (~4-5 min headway)
  // 08:00 - 11:30: Morning Peak Rush (16 Trains, 2.5 min headway, Heavy Dwells)
  // 11:30 - 16:30: Midday Service (14 Trains, 3.5 min headway)
  // 16:30 - 20:30: Evening Peak Rush (16 Trains, Heavy Commute)
  // 20:30 - 23:00: Late Evening Service (10 Trains)
  // 23:00 - 00:15: Last Revenue Trains in Transit (Terminal departures ended at 23:00)

  if (sec >= 900 && sec < 19800) {
    // 00:15 to 05:30 (Night Maintenance)
    return {
      phase: 'SERVICE_CLOSED',
      badge: '🔴 SERVICE CLOSED · NIGHT TRACK MAINTENANCE',
      message: 'Tracks de-energized for ultrasonic rail testing & catenary maintenance. All passenger trains parked at depots. First train departs at 05:30 AM.',
      activeCount: 0,
      isRevenueOpen: false
    };
  } else if (sec >= 19800 && sec < 21600) {
    // 05:30 to 06:00 (First Metro Startup)
    return {
      phase: 'FIRST_TRAINS',
      badge: '🌅 FIRST METRO STARTUP (05:30 AM)',
      message: 'First trains dispatched from Samaypur Badli & Millennium City Centre terminals, with depot rollouts from Sultanpur & Khyber Pass.',
      activeCount: 6,
      isRevenueOpen: true
    };
  } else if (sec >= 21600 && sec < 28800) {
    // 06:00 to 08:00 (Early Morning)
    return {
      phase: 'EARLY_SERVICE',
      badge: '🟢 REVENUE SERVICE (EARLY MORNING)',
      message: 'Normal early revenue operations across 37 stations. Headway: 4 - 5 minutes.',
      activeCount: 12,
      isRevenueOpen: true
    };
  } else if (sec >= 28800 && sec < 41400) {
    // 08:00 to 11:30 (Morning Peak)
    return {
      phase: 'MORNING_PEAK',
      badge: '🏢 MORNING PEAK RUSH (HIGH VOLUME)',
      message: 'Maximum passenger volume. Headway: 2.5 minutes. Extended boarding dwell at Rajiv Chowk & Kashmere Gate.',
      activeCount: 16,
      isRevenueOpen: true
    };
  } else if (sec >= 41400 && sec < 59400) {
    // 11:30 to 16:30 (Midday)
    return {
      phase: 'MIDDAY_SERVICE',
      badge: '🟢 REVENUE SERVICE (MIDDAY REGULAR)',
      message: 'Standard revenue operations along 49.3 km corridor. Headway: 3.5 - 4.5 minutes.',
      activeCount: 14,
      isRevenueOpen: true
    };
  } else if (sec >= 59400 && sec < 73800) {
    // 16:30 to 20:30 (Evening Peak)
    return {
      phase: 'EVENING_PEAK',
      badge: '🌆 EVENING PEAK RUSH (HEAVY COMMUTE)',
      message: 'Commuter return rush across NCR. Headway: 2.5 minutes. Heavy crowd exchange at Central Secretariat & Rajiv Chowk.',
      activeCount: 16,
      isRevenueOpen: true
    };
  } else if (sec >= 73800 && sec < 82800) {
    // 20:30 to 23:00 (Late Evening)
    return {
      phase: 'LATE_EVENING',
      badge: '🌙 LATE EVENING SERVICE',
      message: 'Post-peak service tapering. Headway: 5 - 7 minutes. Last terminal departures scheduled at 23:00.',
      activeCount: 10,
      isRevenueOpen: true
    };
  } else {
    // 23:00 to 00:15 (Last Trains)
    return {
      phase: 'LAST_TRAINS',
      badge: '🟡 LAST REVENUE TRAINS (TERMINAL DEPARTURES ENDED)',
      message: 'Terminal departures closed at 23:00. Final trains clearing corridor via Central Delhi. Next revenue service: 05:30 AM.',
      activeCount: 4,
      isRevenueOpen: true
    };
  }
}

// ══════════════════════════════════════════════════════════════
//  6. PERSISTENT CBTC FLEET KINEMATIC SIMULATOR
// ══════════════════════════════════════════════════════════════
const FLEET_SIZE = 16;
let simSpeed = 1.0;

// Initialize 16 persistent trains spaced evenly around the 96 km loop
const FLEET_TRAINS = [];
const SPACING = FULL_LOOP_METERS / FLEET_SIZE;

for (let i = 0; i < FLEET_SIZE; i++) {
  FLEET_TRAINS.push({
    id: `Y-${String(i + 1).padStart(2, '0')}`,
    loopPos: (i * SPACING) % FULL_LOOP_METERS,
    speedKph: 0,
    state: 'CRUISING', // 'CRUISING' | 'BRAKING' | 'STOPPED' | 'ACCELERATING'
    dwellRemaining: 0,
    dwellTotal: 0,
    isExtendedDwell: false,
    dwellReason: 'Standard Passenger Boarding',
    currentStation: null
  });
}

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

// Physics simulation tick (runs at 10 Hz: dt = 0.1s)
const DT = 0.1;
const A_ACCEL = 0.85; // m/s^2 (standard DMRC electric traction)
const A_BRAKE = 0.95; // m/s^2 (standard service braking)
const V_CRUISE = 74;  // km/h

function stepKinematics() {
  const dtEff = DT * simSpeed;

  // Advance custom time if in custom mode
  if (timeMode === 'custom') {
    customTimeSeconds = (customTimeSeconds + dtEff) % 86400;
  }

  for (let i = 0; i < FLEET_SIZE; i++) {
    const train = FLEET_TRAINS[i];

    // Find next upcoming station stop ahead along the loop
    let nextStop = null;
    let minD = Infinity;

    for (const s of LOOP_STOPS) {
      let d = s.loopMeters - train.loopPos;
      if (d <= 0.05) d += FULL_LOOP_METERS;
      if (d < minD) {
        minD = d;
        nextStop = s;
      }
    }

    if (train.state === 'STOPPED') {
      train.dwellRemaining -= dtEff;
      train.speedKph = 0;
      if (train.dwellRemaining <= 0) {
        train.state = 'ACCELERATING';
        train.dwellRemaining = 0;
      }
    } else if (train.state === 'ACCELERATING') {
      train.speedKph = Math.min(V_CRUISE, train.speedKph + (A_ACCEL * dtEff * 3.6));
      const vMps = train.speedKph / 3.6;
      const brakeDist = (vMps * vMps) / (2 * A_BRAKE);

      if (minD <= brakeDist + 3.0) {
        train.state = 'BRAKING';
      } else if (train.speedKph >= V_CRUISE) {
        train.state = 'CRUISING';
      }
    } else if (train.state === 'CRUISING') {
      train.speedKph = V_CRUISE;
      const vMps = train.speedKph / 3.6;
      const brakeDist = (vMps * vMps) / (2 * A_BRAKE);

      if (minD <= brakeDist + 3.0) {
        train.state = 'BRAKING';
      }
    } else if (train.state === 'BRAKING') {
      if (minD <= 2.5) {
        // Berth cleanly at the station platform
        train.loopPos = nextStop.loopMeters;
        train.speedKph = 0;
        train.state = 'STOPPED';
        train.currentStation = nextStop.station.name;

        // Dwell time configuration ("Stopping more than usual" logic)
        let dwell = nextStop.baseDwell;
        let isExtended = false;
        let reason = nextStop.category;

        // Major hubs (Rajiv Chowk, Kashmere Gate) are ALWAYS extended (45-55s)
        if (nextStop.isMajorInterchange) {
          isExtended = true;
          reason = `High Passenger Crowds · ${nextStop.category}`;
          // 25% chance of severe crowd clearance delay
          if (Math.random() < 0.25) {
            dwell += 22;
            reason = `⚠️ Stopping More Than Usual: Platform Crowd Regulation at ${nextStop.station.name}`;
          }
        } else {
          // Standard stations: 10% chance of headway regulation delay
          if (Math.random() < 0.10) {
            dwell += 25;
            isExtended = true;
            reason = `⚠️ Stopping More Than Usual: Headway Regulation / Passenger Delay`;
          }
        }

        train.dwellRemaining = dwell;
        train.dwellTotal = dwell;
        train.isExtendedDwell = isExtended;
        train.dwellReason = reason;
      } else {
        // Smooth parabolic deceleration curve down to 0 at the stop line
        const targetV = Math.sqrt(Math.max(0, 2 * A_BRAKE * (minD - 2.0))) * 3.6;
        train.speedKph = Math.max(6, Math.min(train.speedKph, targetV));
      }
    }

    // Advance position by displacement: ds = v * dt
    if (train.speedKph > 0) {
      train.loopPos = (train.loopPos + (train.speedKph / 3.6) * dtEff) % FULL_LOOP_METERS;
    }
  }
}

// Map train loop position to exact 3D coordinates, headings and telemetry
function getTrainTelemetry(train, trainIndex) {
  const normMeters = train.loopPos;
  let coords, fromStation, toStation, directionLabel, track, bearing;
  let structure, elevM, elevLabel;

  if (normMeters < TOTAL_ROUTE_METERS) {
    // ── 1. SOUTHBOUND on Track 1 (Down Line): Samaypur Badli ➔ Millennium City Centre ──
    const targetD = normMeters;
    const res = getPointAlongPolyline(TRACK_SOUTH, targetD);
    coords = res.pt;
    bearing = Math.round(res.bearing);

    let k = 0;
    while (k < N - 1 && STATION_DISTANCES[k + 1] <= targetD) {
      k++;
    }
    fromStation = STATIONS[k].name;
    toStation = STATIONS[Math.min(N - 1, k + 1)].name;
    directionLabel = 'Southbound ➔ Millennium City Centre';
    track = 'Track 1 (Down Line)';

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
    // ── 2. Millennium City Centre Crossover Reversal ──
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
    structure = 'elevated';
    elevM = 16;
    elevLabel = 'Elevated Terminal (+16m)';

  } else if (normMeters < HALF_LOOP_METERS + TOTAL_ROUTE_METERS) {
    // ── 3. NORTHBOUND on Track 2 (Up Line): Millennium City Centre ➔ Samaypur Badli ──
    const targetD = TOTAL_ROUTE_METERS - (normMeters - HALF_LOOP_METERS);
    const res = getPointAlongPolyline(TRACK_NORTH, targetD);
    coords = res.pt;
    bearing = Math.round((res.bearing + 180) % 360);

    let k = N - 1;
    while (k > 0 && STATION_DISTANCES[k - 1] >= targetD) {
      k--;
    }
    fromStation = STATIONS[k].name;
    toStation = STATIONS[Math.max(0, k - 1)].name;
    directionLabel = 'Northbound ➔ Samaypur Badli';
    track = 'Track 2 (Up Line)';

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
    // ── 4. Samaypur Badli Crossover Reversal ──
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
    structure = 'elevated';
    elevM = 15;
    elevLabel = 'Elevated Terminal (+15m)';
  }

  // State formatting for UI
  let stateLabel = '🟢 CRUISING';
  if (train.state === 'STOPPED') {
    stateLabel = train.isExtendedDwell ? '⚠️ EXTENDED DWELL' : '🔴 STOPPED (BOARDING)';
  } else if (train.state === 'BRAKING') {
    stateLabel = '🟡 BRAKING FOR PLATFORM';
  } else if (train.state === 'ACCELERATING') {
    stateLabel = '⚡ ACCELERATING';
  }

  return {
    id: train.id,
    coords,
    bearing,
    speedKph: Math.round(train.speedKph),
    state: train.state,
    stateLabel,
    dwellRemaining: Math.ceil(Math.max(0, train.dwellRemaining)),
    dwellTotal: Math.round(train.dwellTotal),
    isExtendedDwell: train.isExtendedDwell,
    dwellReason: train.dwellReason,
    fromStation,
    toStation,
    currentStation: train.state === 'STOPPED' ? train.currentStation : null,
    directionLabel,
    track,
    structure,
    elevM,
    elevLabel
  };
}

function getActiveFleet() {
  const sec = getSecondsOfDay();
  const schedule = getServiceSchedule(sec);

  const hrs = String(Math.floor(sec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const secs = String(Math.floor(sec % 60)).padStart(2, '0');
  const timeStr = `${hrs}:${mins}:${secs} IST`;

  // Scale active trains according to DMRC time-of-day operational schedule
  let trains = [];
  if (schedule.isRevenueOpen) {
    const activeSlice = FLEET_TRAINS.slice(0, schedule.activeCount);
    trains = activeSlice.map((t, idx) => getTrainTelemetry(t, idx));
  }

  return {
    timestamp: Date.now(),
    simTimeSeconds: Math.floor(sec),
    timeStr,
    timeMode,
    simSpeed,
    servicePhase: schedule.phase,
    serviceBadge: schedule.badge,
    serviceMessage: schedule.message,
    firstTrainTime: '05:30 AM',
    lastTrainTime: '23:00 PM',
    trainCount: trains.length,
    trains,
    depots: {
      sultanpurDepot: { name: 'Sultanpur Depot (South)', coords: [77.1515, 28.4985], stabledCount: schedule.isRevenueOpen ? (16 - schedule.activeCount) / 2 : 8 },
      khyberPassDepot: { name: 'Khyber Pass Depot (North)', coords: [77.2235, 28.6975], stabledCount: schedule.isRevenueOpen ? (16 - schedule.activeCount) / 2 : 8 }
    }
  };
}

// Main 10 Hz physical integration loop
setInterval(() => {
  stepKinematics();
  broadcastSSE();
}, 100);

// ══════════════════════════════════════════════════════════════
//  7. HTTP SERVER & SERVER-SENT EVENTS (SSE)
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
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

  // 4. Adjust Speed
  if (pathname === '/api/speed') {
    const s = parseFloat(parsedUrl.query.m);
    if (s && s > 0 && s <= 20) {
      simSpeed = s;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, simSpeed }));
    return;
  }

  // 5. 24-Hour Time Mode & Timeline Scrubbing
  if (pathname === '/api/time') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.mode === 'live') {
            timeMode = 'live';
          } else if (data.mode === 'custom') {
            timeMode = 'custom';
            if (typeof data.timeSeconds === 'number') {
              customTimeSeconds = Math.max(0, Math.min(86399, data.timeSeconds));
            }
          }
          if (data.simSpeed && data.simSpeed > 0) {
            simSpeed = data.simSpeed;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, timeMode, customTimeSeconds, simSpeed }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        timeMode,
        simTimeSeconds: getSecondsOfDay(),
        simSpeed
      }));
      return;
    }
  }

  // 6. Static Files
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
