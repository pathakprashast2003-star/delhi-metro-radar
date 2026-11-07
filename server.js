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
//  YELLOW LINE CORRIDOR (37 STATIONS: ELEVATED FLYOVERS & UNDERGROUND TUNNELS)
// ══════════════════════════════════════════════════════════════
const STATIONS = [
  // North Elevated Flyover Viaduct Section (Stations 0..6: +15m Elevation)
  { id: 'samaypur_badli',       name: 'Samaypur Badli',        coords: [77.1465, 28.7429], terminus: true,  major: true,  structure: 'elevated', elevM: 15 },
  { id: 'rohini_18_19',         name: 'Rohini Sector 18, 19',  coords: [77.1356, 28.7402], terminus: false, major: false, structure: 'elevated', elevM: 15 },
  { id: 'haiderpur_badli_mor',  name: 'Haiderpur Badli Mor',   coords: [77.1500, 28.7187], terminus: false, major: false, structure: 'elevated', elevM: 16 },
  { id: 'jahangirpuri',         name: 'Jahangirpuri',          coords: [77.1612, 28.7282], terminus: false, major: false, structure: 'elevated', elevM: 15 },
  { id: 'adarsh_nagar',         name: 'Adarsh Nagar',          coords: [77.1673, 28.7144], terminus: false, major: false, structure: 'elevated', elevM: 15 },
  { id: 'azadpur',              name: 'Azadpur',               coords: [77.1799, 28.7073], terminus: false, major: true,  structure: 'elevated', elevM: 17 },
  { id: 'model_town',           name: 'Model Town',            coords: [77.1938, 28.7028], terminus: false, major: false, structure: 'elevated', elevM: 14 },

  // Central Subterranean Underground Tube Tunnel Section (Stations 7..26: -16m to -30m Depth)
  { id: 'gtb_nagar',            name: 'GTB Nagar',             coords: [77.2064, 28.6981], terminus: false, major: false, structure: 'underground', elevM: -16 },
  { id: 'vishwavidyalaya',      name: 'Vishwavidyalaya',       coords: [77.2124, 28.6948], terminus: false, major: false, structure: 'underground', elevM: -18 },
  { id: 'vidhan_sabha',         name: 'Vidhan Sabha',          coords: [77.2216, 28.6878], terminus: false, major: false, structure: 'underground', elevM: -18 },
  { id: 'civil_lines',          name: 'Civil Lines',           coords: [77.2250, 28.6769], terminus: false, major: false, structure: 'underground', elevM: -16 },
  { id: 'kashmere_gate',        name: 'Kashmere Gate',         coords: [77.2282, 28.6675], terminus: false, major: true,  structure: 'underground', elevM: -22 },
  { id: 'chandni_chowk',        name: 'Chandni Chowk',        coords: [77.2292, 28.6564], terminus: false, major: false, structure: 'underground', elevM: -20 },
  { id: 'chawri_bazar',         name: 'Chawri Bazar',          coords: [77.2263, 28.6496], terminus: false, major: false, structure: 'underground', elevM: -30 }, // Deepest station
  { id: 'new_delhi',            name: 'New Delhi',             coords: [77.2224, 28.6429], terminus: false, major: true,  structure: 'underground', elevM: -22 },
  { id: 'rajiv_chowk',          name: 'Rajiv Chowk',          coords: [77.2196, 28.6329], terminus: false, major: true,  structure: 'underground', elevM: -20 },
  { id: 'patel_chowk',          name: 'Patel Chowk',          coords: [77.2123, 28.6230], terminus: false, major: false, structure: 'underground', elevM: -18 },
  { id: 'central_secretariat',  name: 'Central Secretariat',  coords: [77.2120, 28.6150], terminus: false, major: true,  structure: 'underground', elevM: -18 },
  { id: 'udyog_bhawan',         name: 'Udyog Bhawan',         coords: [77.2101, 28.6115], terminus: false, major: false, structure: 'underground', elevM: -16 },
  { id: 'lok_kalyan_marg',      name: 'Lok Kalyan Marg',      coords: [77.2091, 28.5975], terminus: false, major: false, structure: 'underground', elevM: -16 },
  { id: 'jor_bagh',             name: 'Jor Bagh',             coords: [77.2129, 28.5878], terminus: false, major: false, structure: 'underground', elevM: -16 },
  { id: 'dilli_haat_ina',       name: 'Dilli Haat - INA',     coords: [77.2108, 28.5741], terminus: false, major: true,  structure: 'underground', elevM: -18 },
  { id: 'aiims',                name: 'AIIMS',                coords: [77.2078, 28.5669], terminus: false, major: false, structure: 'underground', elevM: -18 },
  { id: 'green_park',           name: 'Green Park',           coords: [77.2057, 28.5595], terminus: false, major: false, structure: 'underground', elevM: -16 },
  { id: 'hauz_khas',            name: 'Hauz Khas',            coords: [77.2067, 28.5443], terminus: false, major: true,  structure: 'underground', elevM: -28 },
  { id: 'malviya_nagar',        name: 'Malviya Nagar',        coords: [77.2098, 28.5355], terminus: false, major: false, structure: 'underground', elevM: -16 },
  { id: 'saket',                name: 'Saket',                coords: [77.2069, 28.5238], terminus: false, major: false, structure: 'underground', elevM: -16 },

  // South Elevated Flyover Viaduct Section (Stations 27..36: +15m Elevation)
  { id: 'qutab_minar',          name: 'Qutab Minar',          coords: [77.1843, 28.5134], terminus: false, major: false, structure: 'elevated', elevM: 15 },
  { id: 'chhatarpur',           name: 'Chhatarpur',           coords: [77.1706, 28.5082], terminus: false, major: false, structure: 'elevated', elevM: 16 },
  { id: 'sultanpur',            name: 'Sultanpur',            coords: [77.1478, 28.4975], terminus: false, major: false, structure: 'elevated', elevM: 15 },
  { id: 'ghitorni',             name: 'Ghitorni',             coords: [77.1352, 28.4891], terminus: false, major: false, structure: 'elevated', elevM: 15 },
  { id: 'arjan_garh',           name: 'Arjan Garh',           coords: [77.1264, 28.4795], terminus: false, major: false, structure: 'elevated', elevM: 15 },
  { id: 'guru_dronacharya',     name: 'Guru Dronacharya',     coords: [77.1084, 28.4802], terminus: false, major: false, structure: 'elevated', elevM: 16 },
  { id: 'sikanderpur',          name: 'Sikanderpur',          coords: [77.0931, 28.4827], terminus: false, major: true,  structure: 'elevated', elevM: 18 },
  { id: 'mg_road',              name: 'MG Road',              coords: [77.0848, 28.4787], terminus: false, major: false, structure: 'elevated', elevM: 15 },
  { id: 'iffco_chowk',          name: 'IFFCO Chowk',          coords: [77.0722, 28.4725], terminus: false, major: false, structure: 'elevated', elevM: 15 },
  { id: 'millennium_city_centre', name: 'Millennium City Centre', coords: [77.0725, 28.4594], terminus: true, major: true, structure: 'elevated', elevM: 16 }
];

const N = STATIONS.length;
const TRACK_OFFSET = 0.00018; // ~20m clear physical dual-track separation (40m corridor envelope)

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
//  INFRASTRUCTURE SPLIT: ELEVATED FLYOVERS, SUBTERRANEAN TUNNELS & PORTALS
// ══════════════════════════════════════════════════════════════
// North Portal: Midpoint between Model Town (Station 6) and GTB Nagar (Station 7)
const PORTAL_NORTH = [
  (STATIONS[6].coords[0] + STATIONS[7].coords[0]) / 2,
  (STATIONS[6].coords[1] + STATIONS[7].coords[1]) / 2
];

// South Portal: Midpoint between Saket (Station 26) and Qutab Minar (Station 27)
const PORTAL_SOUTH = [
  (STATIONS[26].coords[0] + STATIONS[27].coords[0]) / 2,
  (STATIONS[26].coords[1] + STATIONS[27].coords[1]) / 2
];

// Vector tangents and offsets for Portals
const dxN = STATIONS[7].coords[0] - STATIONS[6].coords[0];
const dyN = STATIONS[7].coords[1] - STATIONS[6].coords[1];
const lenN = Math.hypot(dxN, dyN) || 1;
const nxN = -dyN / lenN, nyN = dxN / lenN;
const txN = dxN / lenN, tyN = dyN / lenN;
const portalNorthTrackSouth = [PORTAL_NORTH[0] + nxN * TRACK_OFFSET, PORTAL_NORTH[1] + nyN * TRACK_OFFSET];
const portalNorthTrackNorth = [PORTAL_NORTH[0] - nxN * TRACK_OFFSET, PORTAL_NORTH[1] - nyN * TRACK_OFFSET];

const dxS = STATIONS[27].coords[0] - STATIONS[26].coords[0];
const dyS = STATIONS[27].coords[1] - STATIONS[26].coords[1];
const lenS = Math.hypot(dxS, dyS) || 1;
const nxS = -dyS / lenS, nyS = dxS / lenS;
const txS = dxS / lenS, tyS = dyS / lenS;
const portalSouthTrackSouth = [PORTAL_SOUTH[0] + nxS * TRACK_OFFSET, PORTAL_SOUTH[1] + nyS * TRACK_OFFSET];
const portalSouthTrackNorth = [PORTAL_SOUTH[0] - nxS * TRACK_OFFSET, PORTAL_SOUTH[1] - nyS * TRACK_OFFSET];

// Center viaduct lines
const FLYOVER_NORTH_CENTER = [...STATIONS.slice(0, 7).map(s => s.coords), PORTAL_NORTH];
const TUNNEL_CENTER = [PORTAL_NORTH, ...STATIONS.slice(7, 27).map(s => s.coords), PORTAL_SOUTH];
const FLYOVER_SOUTH_CENTER = [PORTAL_SOUTH, ...STATIONS.slice(27, 37).map(s => s.coords)];

// Split parallel tracks for distinct styling
const trackSouthFlyoverNorth = [...TRACK_SOUTH.slice(0, 7), portalNorthTrackSouth];
const trackNorthFlyoverNorth = [...TRACK_NORTH.slice(0, 7), portalNorthTrackNorth];

const trackSouthTunnel = [portalNorthTrackSouth, ...TRACK_SOUTH.slice(7, 27), portalSouthTrackSouth];
const trackNorthTunnel = [portalNorthTrackNorth, ...TRACK_NORTH.slice(7, 27), portalSouthTrackNorth];

const trackSouthFlyoverSouth = [portalSouthTrackSouth, ...TRACK_SOUTH.slice(27, 37)];
const trackNorthFlyoverSouth = [portalSouthTrackNorth, ...TRACK_NORTH.slice(27, 37)];

// Transition Portals GeoJSON
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

// Portal Cutaway Ramps (Reinforced concrete U-troughs entering ground)
const R_LEN = 0.00065;
const R_WID = 0.00028; // Envelops both tracks comfortably
const rN1 = [PORTAL_NORTH[0] - txN * R_LEN - nxN * R_WID, PORTAL_NORTH[1] - tyN * R_LEN - nyN * R_WID];
const rN2 = [PORTAL_NORTH[0] + txN * R_LEN - nxN * R_WID, PORTAL_NORTH[1] + tyN * R_LEN - nyN * R_WID];
const rN3 = [PORTAL_NORTH[0] + txN * R_LEN + nxN * R_WID, PORTAL_NORTH[1] + tyN * R_LEN + nyN * R_WID];
const rN4 = [PORTAL_NORTH[0] - txN * R_LEN + nxN * R_WID, PORTAL_NORTH[1] - tyN * R_LEN + nyN * R_WID];

const rS1 = [PORTAL_SOUTH[0] - txS * R_LEN - nxS * R_WID, PORTAL_SOUTH[1] - tyS * R_LEN - nyS * R_WID];
const rS2 = [PORTAL_SOUTH[0] + txS * R_LEN - nxS * R_WID, PORTAL_SOUTH[1] + tyS * R_LEN - nyS * R_WID];
const rS3 = [PORTAL_SOUTH[0] + txS * R_LEN + nxS * R_WID, PORTAL_SOUTH[1] + tyS * R_LEN + nyS * R_WID];
const rS4 = [PORTAL_SOUTH[0] - txS * R_LEN + nxS * R_WID, PORTAL_SOUTH[1] - tyS * R_LEN - nyS * R_WID];

const PORTAL_RAMPS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'ramp_north', name: 'Model Town Portal Cutaway Ramp', type: 'portal_ramp' },
      geometry: { type: 'Polygon', coordinates: [[rN1, rN2, rN3, rN4, rN1]] }
    },
    {
      type: 'Feature',
      properties: { id: 'ramp_south', name: 'Saket Portal Cutaway Ramp', type: 'portal_ramp' },
      geometry: { type: 'Polygon', coordinates: [[rS1, rS2, rS3, rS4, rS1]] }
    }
  ]
};

// ══════════════════════════════════════════════════════════════
//  PRECOMPUTE PHYSICAL STATION PLATFORMS, CANOPIES & UNDERGROUND CHAMBERS
// ══════════════════════════════════════════════════════════════
const PLATFORM_SLABS = [];
const TACTILE_EDGES = [];
const PLATFORM_CANOPIES = [];
const UNDERGROUND_PLATFORMS = [];

const P_LEN = 0.00065; // ~70m length
const P_WID = 0.00028; // Envelops both tracks comfortably (40m envelope)

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
        [x - tx * P_LEN + nx * (P_WID - 0.00002), y - ty * P_LEN + ny * (P_WID - 0.00002)],
        [x + tx * P_LEN + nx * (P_WID - 0.00002), y + ty * P_LEN + ny * (P_WID - 0.00002)]
      ]
    }
  });

  TACTILE_EDGES.push({
    type: 'Feature',
    properties: { id: s.id + '_edge2', side: 'up', structure: s.structure },
    geometry: {
      type: 'LineString',
      coordinates: [
        [x - tx * P_LEN - nx * (P_WID - 0.00002), y - ty * P_LEN - ny * (P_WID - 0.00002)],
        [x + tx * P_LEN - nx * (P_WID - 0.00002), y + ty * P_LEN - ny * (P_WID - 0.00002)]
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
  let structure, elevM, elevLabel;

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

    // Structure & Elevation calculation (Southbound)
    if (segIdx < 6) {
      // Elevated Flyover North (Badli to Model Town)
      structure = 'elevated';
      elevM = STATIONS[segIdx].elevM || 15;
      elevLabel = `Elevated Viaduct (+${elevM}m)`;
    } else if (segIdx === 6) {
      // Model Town (+14m) ➔ GTB Nagar (-16m) Portal Ramp Descent
      elevM = Math.round(14 + (-16 - 14) * progress);
      structure = progress < 0.5 ? 'elevated' : 'underground';
      elevLabel = `North Portal Ramp (${elevM >= 0 ? '+' : ''}${elevM}m)`;
    } else if (segIdx >= 7 && segIdx < 26) {
      // Subterranean Tube Tunnel (GTB Nagar to Saket)
      const e1 = STATIONS[segIdx].elevM;
      const e2 = STATIONS[nextIdx].elevM;
      elevM = Math.round(e1 + (e2 - e1) * progress);
      structure = 'underground';
      elevLabel = `Subterranean Tube (${elevM}m)`;
    } else if (segIdx === 26) {
      // Saket (-16m) ➔ Qutab Minar (+15m) Portal Ramp Ascent
      elevM = Math.round(-16 + (15 - (-16)) * progress);
      structure = progress < 0.5 ? 'underground' : 'elevated';
      elevLabel = `South Portal Ramp (${elevM >= 0 ? '+' : ''}${elevM}m)`;
    } else {
      // Elevated Flyover South (Qutab Minar to Millennium)
      structure = 'elevated';
      elevM = STATIONS[segIdx].elevM || 15;
      elevLabel = `Elevated Viaduct (+${elevM}m)`;
    }

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
    structure = 'elevated';
    elevM = 16;
    elevLabel = 'Elevated Terminal (+16m)';

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

    // Structure & Elevation calculation (Northbound)
    if (fromStationIdx > 27) {
      // Elevated Flyover South (Millennium to Qutab Minar)
      structure = 'elevated';
      elevM = STATIONS[fromStationIdx].elevM || 15;
      elevLabel = `Elevated Viaduct (+${elevM}m)`;
    } else if (fromStationIdx === 27) {
      // Qutab Minar (+15m) ➔ Saket (-16m) Portal Ramp Descent
      elevM = Math.round(15 + (-16 - 15) * progress);
      structure = progress < 0.5 ? 'elevated' : 'underground';
      elevLabel = `South Portal Ramp (${elevM >= 0 ? '+' : ''}${elevM}m)`;
    } else if (fromStationIdx <= 26 && fromStationIdx > 7) {
      // Subterranean Tube Tunnel (Saket to GTB Nagar)
      const e1 = STATIONS[fromStationIdx].elevM;
      const e2 = STATIONS[toStationIdx].elevM;
      elevM = Math.round(e1 + (e2 - e1) * progress);
      structure = 'underground';
      elevLabel = `Subterranean Tube (${elevM}m)`;
    } else if (fromStationIdx === 7) {
      // GTB Nagar (-16m) ➔ Model Town (+14m) Portal Ramp Ascent
      elevM = Math.round(-16 + (14 - (-16)) * progress);
      structure = progress < 0.5 ? 'underground' : 'elevated';
      elevLabel = `North Portal Ramp (${elevM >= 0 ? '+' : ''}${elevM}m)`;
    } else {
      // Elevated Flyover North (Model Town to Badli)
      structure = 'elevated';
      elevM = STATIONS[fromStationIdx].elevM || 15;
      elevLabel = `Elevated Viaduct (+${elevM}m)`;
    }

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
    structure = 'elevated';
    elevM = 15;
    elevLabel = 'Elevated Terminal (+15m)';
  }

  return {
    id: `Y-${String(trainIndex + 1).padStart(2, '0')}`,
    coords,
    bearing: Math.round(bearing),
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

  // 3. Topology (Stations, Dual Tracks, Elevated Flyovers, Subterranean Tunnels & Portals)
  if (pathname === '/api/tracks') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      stations: STATIONS,
      viaductCenter: STATIONS.map(s => s.coords),
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
      crossoverSouth: [TRACK_SOUTH[N - 1], TRACK_NORTH[N - 1]],
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
