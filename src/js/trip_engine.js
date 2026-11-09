/**
 * Delhi Metro Radar — Client-Side Symmetric Trip & Kinematic Engine
 * 100% Frontend-Only · Zero Backend Required · Static Hosting on Cloudflare Pages
 * 
 * Generates active trains dynamically from `src/data/yellow_line_service.json`
 * with perfect directional symmetry (Track 1 Down Line Southbound & Track 2 Up Line Northbound).
 * 
 * All runtimes and headways are configurable placeholders until physically verified.
 */

window.TripEngine = (function() {
  let serviceConfig = null;
  let osmData = null;

  let STATIONS = [];
  let CENTERLINE = [];
  let M = 0;
  let CUM_DIST = [];
  let TOTAL_ROUTE_METERS = 0;
  let STATION_DISTANCES = [];

  let TRACK_SOUTH = [];
  let TRACK_NORTH = [];

  let southSchedules = {};
  let northSchedules = {};

  let trackSouthFlyoverNorth = [];
  let trackNorthFlyoverNorth = [];
  let trackSouthTunnel = [];
  let trackNorthTunnel = [];
  let trackSouthFlyoverSouth = [];
  let trackNorthFlyoverSouth = [];

  let trackDataBundle = null;
  let currentAdvisory = null;

  const NP_NODE_IDX = 110; // North Portal Ramp (Khyber Pass transition)
  const SP_NODE_IDX = 232; // South Portal Ramp (Saket / Qutab Minar transition)

  async function loadData() {
    const [cfgRes, osmRes] = await Promise.all([
      fetch('src/data/yellow_line_service.json'),
      fetch('src/data/yellow_line_accurate_osm.json')
    ]);
    serviceConfig = await cfgRes.json();
    osmData = await osmRes.json();

    STATIONS = serviceConfig.stations;
    CENTERLINE = osmData.centerline;
    M = CENTERLINE.length;

    // 1. Precompute cumulative physical track distances
    CUM_DIST = [0];
    for (let i = 0; i < M - 1; i++) {
      const p1 = CENTERLINE[i];
      const p2 = CENTERLINE[i + 1];
      const latAvg = (p1[1] + p2[1]) / 2 * Math.PI / 180;
      const dx = (p2[0] - p1[0]) * 111320 * Math.cos(latAvg);
      const dy = (p2[1] - p1[1]) * 110852;
      CUM_DIST.push(CUM_DIST[CUM_DIST.length - 1] + Math.hypot(dx, dy));
    }
    TOTAL_ROUTE_METERS = CUM_DIST[M - 1];
    STATION_DISTANCES = STATIONS.map(s => CUM_DIST[s.trackNodeIndex]);

    // 2. Compute Left-Hand Running Dual Vector Tracks
    const TRACK_OFFSET = 0.00018; // ~20m physical dual-track separation
    TRACK_SOUTH = [];
    TRACK_NORTH = [];

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

      // In Delhi (LHR): Southbound on East track (+nx), Northbound on West track (-nx)
      TRACK_SOUTH.push([
        Number((CENTERLINE[i][0] + nx * TRACK_OFFSET).toFixed(6)),
        Number((CENTERLINE[i][1] + ny * TRACK_OFFSET).toFixed(6))
      ]);
      TRACK_NORTH.push([
        Number((CENTERLINE[i][0] - nx * TRACK_OFFSET).toFixed(6)),
        Number((CENTERLINE[i][1] - ny * TRACK_OFFSET).toFixed(6))
      ]);
    }

    trackSouthFlyoverNorth = TRACK_SOUTH.slice(0, NP_NODE_IDX + 1);
    trackNorthFlyoverNorth = TRACK_NORTH.slice(0, NP_NODE_IDX + 1);
    trackSouthTunnel = TRACK_SOUTH.slice(NP_NODE_IDX, SP_NODE_IDX + 1);
    trackNorthTunnel = TRACK_NORTH.slice(NP_NODE_IDX, SP_NODE_IDX + 1);
    trackSouthFlyoverSouth = TRACK_SOUTH.slice(SP_NODE_IDX);
    trackNorthFlyoverSouth = TRACK_NORTH.slice(SP_NODE_IDX);

    // 3. Precompute Geometry Entities (Portals, Ramps, Platforms)
    buildTrackDataBundle();

    // 4. Build Static Schedule Templates for all 3 Route Patterns
    southSchedules = buildDirectionSchedules('south');
    northSchedules = buildDirectionSchedules('north');

    return trackDataBundle;
  }

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
    const c4 = [p[0] - tx * HALF_LEN + nx * HALF_WID, p[1] - ty * HALF_LEN - ny * HALF_WID];

    return [[c1, c2, c3, c4, c1]];
  }

  function getPortalRampCoords(nodeIdx, lenM, widM) {
    const p = CENTERLINE[nodeIdx];
    const pNext = CENTERLINE[Math.min(M - 1, nodeIdx + 1)];
    const pPrev = CENTERLINE[Math.max(0, nodeIdx - 1)];
    const dx = pNext[0] - pPrev[0];
    const dy = pNext[1] - pPrev[1];
    const L = Math.hypot(dx, dy) || 1;
    const tx = dx / L, ty = dy / L;
    const nx = -ty, ny = tx;

    const c1 = [p[0] - tx * lenM - nx * widM, p[1] - ty * lenM - ny * widM];
    const c2 = [p[0] + tx * lenM - nx * widM, p[1] + ty * lenM - ny * widM];
    const c3 = [p[0] + tx * lenM + nx * widM, p[1] + ty * lenM - ny * widM];
    const c4 = [p[0] - tx * lenM + nx * widM, p[1] - ty * lenM + ny * widM];

    return [[c1, c2, c3, c4, c1]];
  }

  function buildTrackDataBundle() {
    const platformSlabs = STATIONS.map(s => ({
      type: 'Feature',
      properties: {
        id: s.id,
        name: s.name,
        index: (s.index !== undefined ? s.index : STATIONS.indexOf(s)),
        structure: s.structure,
        elevM: s.elevM,
        major: s.major,
        terminus: s.isTerminal
      },
      geometry: { type: 'Polygon', coordinates: getPlatformPolygon(s) }
    }));

    const tactileEdges = STATIONS.map(s => {
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
              [p[0] - tx * HALF_LEN + nx * EDGE_OFFSET, p[1] - ty * HALF_LEN - ny * EDGE_OFFSET],
              [p[0] + tx * HALF_LEN + nx * EDGE_OFFSET, p[1] + ty * HALF_LEN - ny * EDGE_OFFSET]
            ]
          ]
        }
      };
    });

    const platformCanopies = STATIONS.filter(s => s.structure === 'elevated').map(s => {
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

    const undergroundPlatforms = STATIONS.filter(s => s.structure === 'underground').map(s => ({
      type: 'Feature',
      properties: { id: s.id + '_ug', name: s.name, depthM: s.elevM },
      geometry: { type: 'Polygon', coordinates: getPlatformPolygon(s) }
    }));

    trackDataBundle = {
      stations: STATIONS,
      viaductCenter: CENTERLINE,
      flyoverNorthCenter: osmData.flyoverNorthCenter,
      tunnelCenter: osmData.tunnelCenter,
      flyoverSouthCenter: osmData.flyoverSouthCenter,
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
      tunnelPortals: {
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
            geometry: { type: 'Point', coordinates: osmData.portalNorth }
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
            geometry: { type: 'Point', coordinates: osmData.portalSouth }
          }
        ]
      },
      portalRamps: {
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
      },
      platformSlabs: { type: 'FeatureCollection', features: platformSlabs },
      tactileEdges: { type: 'FeatureCollection', features: tactileEdges },
      platformCanopies: { type: 'FeatureCollection', features: platformCanopies },
      undergroundPlatforms: { type: 'FeatureCollection', features: undergroundPlatforms }
    };
  }

  function buildDirectionSchedules(dir) {
    const isSouth = (dir === 'south');
    const result = {};

    for (const pattern of serviceConfig.routePatterns) {
      const stops = [];
      const indices = [];

      if (isSouth) {
        for (let k = pattern.fromIndex; k <= pattern.toIndex; k++) indices.push(k);
      } else {
        for (let k = pattern.toIndex; k >= pattern.fromIndex; k--) indices.push(k);
      }

      let cumSec = 0;
      for (let i = 0; i < indices.length; i++) {
        const stIdx = indices[i];
        const st = STATIONS[stIdx];

        if (i === 0) {
          stops.push({
            stIdx,
            st,
            arrSec: 0,
            depSec: st.dwellSeconds,
            distMeters: STATION_DISTANCES[stIdx]
          });
          cumSec = st.dwellSeconds;
        } else {
          const prevIdx = indices[i - 1];
          const secIdx = Math.min(stIdx, prevIdx);
          const sec = serviceConfig.sectionRuntimes[secIdx];
          const arr = cumSec + sec.runtimeSeconds;
          const dep = (i === indices.length - 1) ? arr : arr + st.dwellSeconds;
          cumSec = dep;

          stops.push({
            stIdx,
            st,
            arrSec: arr,
            depSec: dep,
            distMeters: STATION_DISTANCES[stIdx]
          });
        }
      }

      result[pattern.id] = {
        pattern,
        stops,
        totalSec: stops[stops.length - 1].arrSec
      };
    }
    return result;
  }

  // High-speed binary search along polyline
  function getPointAlongPolyline(pts, targetD) {
    if (targetD <= 0) {
      const p1 = pts[0], p2 = pts[1];
      const b = (Math.atan2(p2[0] - p1[0], p2[1] - p1[1]) * 180 / Math.PI + 360) % 360;
      return { pt: pts[0], bearing: b, seg: 0 };
    }
    if (targetD >= TOTAL_ROUTE_METERS) {
      const p1 = pts[M - 2], p2 = pts[M - 1];
      const b = (Math.atan2(p2[0] - p1[0], p2[1] - p1[1]) * 180 / Math.PI + 360) % 360;
      return { pt: pts[M - 1], bearing: b, seg: M - 2 };
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
    return { pt, bearing, seg };
  }

  function parseTimeToSec(tStr) {
    const [h, m, s] = tStr.split(':').map(Number);
    return h * 3600 + m * 60 + s;
  }

  function getActiveBand(secOfDay, dayVariant) {
    const variant = serviceConfig.serviceVariants[dayVariant] || serviceConfig.serviceVariants.weekday;
    const firstSec = parseTimeToSec(variant.firstTrain);
    const lastSec = parseTimeToSec(variant.lastTrain);

    if (secOfDay < firstSec || secOfDay > (lastSec + 1800)) {
      return {
        isClosed: true,
        phase: 'SERVICE_CLOSED',
        badge: '🔴 SERVICE CLOSED · NIGHT MAINTENANCE',
        message: 'Tracks de-energized for maintenance. First train begins at ' + variant.firstTrain + '.',
        headway_core_sec: 0,
        headway_outer_sec: 0
      };
    }

    for (const band of variant.bands) {
      const bStart = parseTimeToSec(band.start);
      const bEnd = parseTimeToSec(band.end);
      if (secOfDay >= bStart && secOfDay < bEnd) {
        return {
          isClosed: band.headway_core_sec === 0,
          phase: band.name.toUpperCase().replace(/\s+/g, '_'),
          badge: `🟢 ${band.name.toUpperCase()}`,
          message: `${band.description} · Core: ~${Math.round(band.headway_core_sec / 60)}m · Outer: ~${Math.round(band.headway_outer_sec / 60)}m (Unverified Placeholders)`,
          headway_core_sec: band.headway_core_sec,
          headway_outer_sec: band.headway_outer_sec,
          status: band.status
        };
      }
    }

    return {
      isClosed: false,
      phase: 'REGULAR_SERVICE',
      badge: '🟢 REVENUE SERVICE',
      message: 'Regular scheduled operations (Unverified Placeholders)',
      headway_core_sec: 240,
      headway_outer_sec: 480
    };
  }

  function getActiveFleet(secOfDay, dayVariant) {
    if (!serviceConfig) return { trains: [], schedule: {} };

    const band = getActiveBand(secOfDay, dayVariant);
    if (band.isClosed) {
      return { trains: [], schedule: band };
    }

    const hOuter = Math.max(120, band.headway_outer_sec || 360);
    const hCore = Math.max(90, band.headway_core_sec || 180);

    const activeTrains = [];
    const variant = serviceConfig.serviceVariants[dayVariant] || serviceConfig.serviceVariants.weekday;
    const startSec = parseTimeToSec(variant.firstTrain);
    const endSec = parseTimeToSec(variant.lastTrain);

    // Compute optimal offsets so short-turn departures interleave evenly in the core
    const southCstOffset = computeInterleavedShortTurnOffset('south', hOuter);
    const northCstOffset = computeInterleavedShortTurnOffset('north', hOuter);
    const southShuttleActive = !!(serviceConfig.corridorSections && serviceConfig.corridorSections.south_outer && serviceConfig.corridorSections.south_outer.enable_south_shuttle);
    const southSsOffset = southShuttleActive ? computeSouthShuttleOffset('south', hOuter) : 0;
    const northSsOffset = southShuttleActive ? computeSouthShuttleOffset('north', hOuter) : 0;

    // 1. Southbound Trips
    for (let t0 = startSec; t0 <= endSec; t0 += hOuter) {
      const sched = southSchedules.FULL_LINE;
      if (t0 <= secOfDay && secOfDay <= t0 + sched.totalSec) {
        const train = computeTrainState(t0, secOfDay, sched, 'south', 'FULL_LINE');
        if (train) activeTrains.push(train);
      }
    }
    for (let t0 = startSec + southCstOffset; t0 <= endSec; t0 += hOuter) {
      const sched = southSchedules.CENTRAL_SHORT_TURN;
      if (t0 <= secOfDay && secOfDay <= t0 + sched.totalSec) {
        const train = computeTrainState(t0, secOfDay, sched, 'south', 'CENTRAL_SHORT_TURN');
        if (train) activeTrains.push(train);
      }
    }
    if (southShuttleActive && southSchedules.SOUTH_SHUTTLE) {
      for (let t0 = startSec + southSsOffset; t0 <= endSec; t0 += hOuter) {
        const sched = southSchedules.SOUTH_SHUTTLE;
        if (t0 <= secOfDay && secOfDay <= t0 + sched.totalSec) {
          const train = computeTrainState(t0, secOfDay, sched, 'south', 'SOUTH_SHUTTLE');
          if (train) activeTrains.push(train);
        }
      }
    }

    // 2. Northbound Trips (Symmetric intervals and mirrored trip runtimes)
    for (let t0 = startSec; t0 <= endSec; t0 += hOuter) {
      const sched = northSchedules.FULL_LINE;
      if (t0 <= secOfDay && secOfDay <= t0 + sched.totalSec) {
        const train = computeTrainState(t0, secOfDay, sched, 'north', 'FULL_LINE');
        if (train) activeTrains.push(train);
      }
    }
    for (let t0 = startSec + northCstOffset; t0 <= endSec; t0 += hOuter) {
      const sched = northSchedules.CENTRAL_SHORT_TURN;
      if (t0 <= secOfDay && secOfDay <= t0 + sched.totalSec) {
        const train = computeTrainState(t0, secOfDay, sched, 'north', 'CENTRAL_SHORT_TURN');
        if (train) activeTrains.push(train);
      }
    }
    if (southShuttleActive && northSchedules.SOUTH_SHUTTLE) {
      for (let t0 = startSec + northSsOffset; t0 <= endSec; t0 += hOuter) {
        const sched = northSchedules.SOUTH_SHUTTLE;
        if (t0 <= secOfDay && secOfDay <= t0 + sched.totalSec) {
          const train = computeTrainState(t0, secOfDay, sched, 'north', 'SOUTH_SHUTTLE');
          if (train) activeTrains.push(train);
        }
      }
    }

    return {
      trains: activeTrains,
      schedule: band
    };
  }

  function computeTrainState(t0, secOfDay, routeSched, direction, routePatternId) {
    const elapsed = secOfDay - t0;
    const stops = routeSched.stops;
    const N = stops.length;
    const isSouth = (direction === 'south');

    let currentStopIdx = -1;
    let isStopped = false;
    let fromStop = null;
    let toStop = null;
    let segProgress = 0;

    for (let i = 0; i < N; i++) {
      const s = stops[i];
      if (elapsed >= s.arrSec && elapsed <= s.depSec) {
        isStopped = true;
        currentStopIdx = i;
        break;
      }
      if (i < N - 1 && elapsed > s.depSec && elapsed < stops[i + 1].arrSec) {
        fromStop = s;
        toStop = stops[i + 1];
        const segDuration = toStop.arrSec - fromStop.depSec;
        segProgress = (elapsed - fromStop.depSec) / Math.max(1, segDuration);
        break;
      }
    }

    let targetDistanceMeters = 0;
    let state = 'CRUISING';
    let speedKph = 0;
    let fromStationName = '';
    let toStationName = '';
    let currentStationName = null;
    let dwellRemaining = 0;
    let dwellTotal = 0;

    if (isStopped) {
      const stp = stops[currentStopIdx];
      state = 'STOPPED';
      speedKph = 0;
      targetDistanceMeters = stp.distMeters;
      currentStationName = stp.st.name;
      fromStationName = stp.st.name;
      toStationName = (currentStopIdx < N - 1) ? stops[currentStopIdx + 1].st.name : 'Terminal End';
      dwellRemaining = Math.max(0, Math.round(stp.depSec - elapsed));
      dwellTotal = Math.round(stp.depSec - stp.arrSec);
    } else if (fromStop && toStop) {
      const smoothP = 0.5 - 0.5 * Math.cos(segProgress * Math.PI);
      const d1 = fromStop.distMeters;
      const d2 = toStop.distMeters;
      targetDistanceMeters = d1 + smoothP * (d2 - d1);

      fromStationName = fromStop.st.name;
      toStationName = toStop.st.name;

      if (segProgress < 0.25) {
        state = 'ACCELERATING';
        speedKph = Math.round(65 * (segProgress / 0.25));
      } else if (segProgress > 0.75) {
        state = 'BRAKING';
        speedKph = Math.round(65 * ((1.0 - segProgress) / 0.25));
      } else {
        state = 'CRUISING';
        speedKph = 68;
      }
    } else {
      return null;
    }

    const trackPts = isSouth ? TRACK_SOUTH : TRACK_NORTH;
    const res = getPointAlongPolyline(trackPts, targetDistanceMeters);
    const bearing = isSouth ? Math.round(res.bearing) : Math.round((res.bearing + 180) % 360);

    let elevM = 15;
    let structure = 'elevated';
    let elevLabel = 'Elevated Viaduct (+15m)';

    if (res.seg < NP_NODE_IDX) {
      structure = 'elevated';
      elevM = 15;
      elevLabel = 'Elevated Viaduct (+15m)';
    } else if (res.seg === NP_NODE_IDX) {
      elevM = -6;
      structure = 'portal';
      elevLabel = 'North Portal Transition';
    } else if (res.seg > NP_NODE_IDX && res.seg < SP_NODE_IDX) {
      elevM = -18;
      structure = 'underground';
      elevLabel = 'Subterranean Tube (-18m)';
    } else if (res.seg === SP_NODE_IDX) {
      elevM = 5;
      structure = 'portal';
      elevLabel = 'South Portal Transition';
    } else {
      elevM = 15;
      structure = 'elevated';
      elevLabel = 'Elevated Viaduct (+15m)';
    }

    const dirLabel = isSouth ? 'Southbound ➔ Millennium City Centre' : 'Northbound ➔ Samaypur Badli';
    const trackLabel = isSouth ? 'Track 1 (Down Line)' : 'Track 2 (Up Line)';
    const trainId = `Y-${isSouth ? 'SB' : 'NB'}-${routePatternId === 'FULL_LINE' ? 'F' : 'C'}-${String(Math.floor(t0 / 60)).slice(-3)}`;

    return {
      id: trainId,
      routePattern: routePatternId,
      direction: direction,
      directionLabel: dirLabel,
      track: trackLabel,
      coords: res.pt,
      bearing: bearing,
      speedKph: speedKph,
      state: state,
      fromStation: fromStationName,
      toStation: toStationName,
      currentStation: currentStationName,
      dwellRemaining: dwellRemaining,
      dwellTotal: dwellTotal,
      structure: structure,
      elevM: elevM,
      elevLabel: elevLabel,
      isPlaceholder: true
    };
  }

  function computeInterleavedShortTurnOffset(dir, headwayOuter) {
    const scheds = (dir === 'south') ? southSchedules : northSchedules;
    const refIdx = 15; // Rajiv Chowk (central core reference station)
    const flStop = scheds.FULL_LINE ? scheds.FULL_LINE.stops.find(s => s.stIdx === refIdx) : null;
    const cstStop = scheds.CENTRAL_SHORT_TURN ? scheds.CENTRAL_SHORT_TURN.stops.find(s => s.stIdx === refIdx) : null;
    if (!flStop || !cstStop) return Math.round(headwayOuter / 2);

    const halfGap = Math.round(headwayOuter / 2);
    // Offset CST departure so CST arrives at Rajiv Chowk exactly halfGap seconds after Full Line
    const offset = ((flStop.arrSec - cstStop.arrSec + halfGap) % headwayOuter + headwayOuter) % headwayOuter;
    return offset;
  }

  function computeSouthShuttleOffset(dir, headwayOuter) {
    const scheds = (dir === 'south') ? southSchedules : northSchedules;
    const refIdx = 35; // IFFCO Chowk (south outer reference station)
    const flStop = scheds.FULL_LINE ? scheds.FULL_LINE.stops.find(s => s.stIdx === refIdx) : null;
    const ssStop = scheds.SOUTH_SHUTTLE ? scheds.SOUTH_SHUTTLE.stops.find(s => s.stIdx === refIdx) : null;
    if (!flStop || !ssStop) return Math.round(headwayOuter / 2);

    const halfGap = Math.round(headwayOuter / 2);
    const offset = ((flStop.arrSec - ssStop.arrSec + halfGap) % headwayOuter + headwayOuter) % headwayOuter;
    return offset;
  }

  function getStationCorridorSection(stIndex) {
    if (!serviceConfig || !serviceConfig.corridorSections) {
      if (stIndex < 8) return { id: 'north_outer', name: 'North Outer Section', reduced_frequency: true, frequency_status: 'unverified' };
      if (stIndex <= 27) return { id: 'central_core', name: 'Central Core Section', reduced_frequency: false, frequency_status: 'verified_high_frequency' };
      return { id: 'south_outer', name: 'South Outer Section', reduced_frequency: true, frequency_status: 'unverified' };
    }
    const secs = serviceConfig.corridorSections;
    if (stIndex <= secs.north_outer.toIndex) return secs.north_outer;
    if (stIndex <= secs.central_core.toIndex) return secs.central_core;
    return secs.south_outer;
  }

  function getStationArrivals(stIndex, direction, secOfDay, dayVariant, limit = 3) {
    const isSouth = (direction === 'south');
    const scheds = isSouth ? southSchedules : northSchedules;
    const candidateTrips = [];

    const variant = serviceConfig.serviceVariants[dayVariant] || serviceConfig.serviceVariants.weekday;
    const startSec = parseTimeToSec(variant.firstTrain);
    const endSec = parseTimeToSec(variant.lastTrain);
    const band = getActiveBand(secOfDay, dayVariant);
    const hOuter = Math.max(120, band.headway_outer_sec || 360);
    const hCore = Math.max(90, band.headway_core_sec || 180);

    const cstOffset = computeInterleavedShortTurnOffset(direction, hOuter);
    const southShuttleActive = !!(serviceConfig.corridorSections && serviceConfig.corridorSections.south_outer && serviceConfig.corridorSections.south_outer.enable_south_shuttle);
    const ssOffset = southShuttleActive ? computeSouthShuttleOffset(direction, hOuter) : 0;

    function checkArrivals(patternId, tStep, offset) {
      const sched = scheds[patternId];
      if (!sched) return;
      const stop = sched.stops.find(s => s.stIdx === stIndex);
      if (!stop) return;

      for (let t0 = startSec + offset; t0 <= endSec; t0 += tStep) {
        const arrTime = t0 + stop.arrSec;
        const depTime = t0 + stop.depSec;
        if (depTime >= secOfDay) {
          candidateTrips.push({
            t0,
            arrTime,
            depTime,
            patternId,
            origin: sched.stops[0].st.name,
            dest: sched.stops[sched.stops.length - 1].st.name
          });
        }
      }
    }

    checkArrivals('FULL_LINE', hOuter, 0);
    checkArrivals('CENTRAL_SHORT_TURN', hOuter, cstOffset);
    if (southShuttleActive) {
      checkArrivals('SOUTH_SHUTTLE', hOuter, ssOffset);
    }

    candidateTrips.sort((a, b) => a.arrTime - b.arrTime);
    if (!candidateTrips.length) {
      return [{
        text: 'Service Closed',
        status: 'closed',
        remainingSec: 0,
        clockTime: '--:--',
        dest: isSouth ? 'Millennium City Centre' : 'Samaypur Badli',
        patternId: 'FULL_LINE'
      }];
    }

    const isAdvisoryActive = currentAdvisory && currentAdvisory.active;
    const corridor = getStationCorridorSection(stIndex);
    const affectedByAdvisory = isAdvisoryActive && (!currentAdvisory.affectedSections || currentAdvisory.affectedSections.length === 0 || currentAdvisory.affectedSections.includes(corridor.id));

    return candidateTrips.slice(0, limit).map(trip => {
      const remainingSec = Math.max(0, trip.arrTime - secOfDay);
      let text = '';
      let status = 'scheduled';

      if (secOfDay >= trip.arrTime && secOfDay <= trip.depTime) {
        text = 'Boarding Now';
        status = 'boarding';
      } else if (remainingSec <= 45) {
        text = 'Approaching Platform';
        status = 'approaching';
      } else if (remainingSec <= 120) {
        text = 'Due in ~1–2 min';
        status = 'approaching';
      } else {
        const mins = Math.max(1, Math.round(remainingSec / 60));
        text = `Due in ~${mins} min`;
        status = 'scheduled';
      }

      if (affectedByAdvisory) {
        status = 'advisory';
      }

      const h = Math.floor(trip.arrTime / 3600) % 24;
      const m = Math.floor((trip.arrTime % 3600) / 60);
      const s = Math.floor(trip.arrTime % 60);
      const clockTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      return {
        text,
        status,
        remainingSec,
        clockTime,
        dest: trip.dest,
        patternId: trip.patternId,
        advisoryActive: affectedByAdvisory,
        advisoryMessage: affectedByAdvisory ? (currentAdvisory.title || 'Irregular Headways') : null
      };
    });
  }

  function getStationNextArrival(stIndex, direction, secOfDay, dayVariant) {
    const list = getStationArrivals(stIndex, direction, secOfDay, dayVariant, 1);
    return list[0] || { text: 'Service Closed', status: 'closed', remainingSec: 0 };
  }

  function setServiceAdvisory(advisory) {
    currentAdvisory = advisory;
  }

  function getServiceAdvisory() {
    return currentAdvisory;
  }

  return {
    loadData,
    getActiveFleet,
    getActiveBand,
    getStationNextArrival,
    getStationArrivals,
    getStationCorridorSection,
    setServiceAdvisory,
    getServiceAdvisory,
    getTrackData: () => trackDataBundle,
    getStations: () => STATIONS,
    getCenterline: () => CENTERLINE,
    getTrackSouth: () => TRACK_SOUTH,
    getTrackNorth: () => TRACK_NORTH,
    getServiceConfig: () => serviceConfig
  };
})();
