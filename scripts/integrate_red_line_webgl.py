#!/usr/bin/env python3
"""
Integrates Delhi Metro Red Line (Line 1) into src/js/metro_webgl_layer.js
with exact string replacement assertions.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEBGL_FILE = ROOT / "src" / "js" / "metro_webgl_layer.js"

def main():
    content = WEBGL_FILE.read_text(encoding="utf-8")
    original_len = len(content)
    print(f"Read {WEBGL_FILE} ({original_len} bytes)")

    # 1. Variables
    t1 = """  let orangeCorridor = null;
  let magentaCorridor = null;
  let yamunaYardData = null;
  let yamunaYardGroup = null;
  let kalindiDepotData = null;
  let kalindiDepotGroup = null;
  let interchangeHubsData = null;"""
    r1 = """  let orangeCorridor = null;
  let magentaCorridor = null;
  let redCorridor = null;
  let yamunaYardData = null;
  let yamunaYardGroup = null;
  let kalindiDepotData = null;
  let kalindiDepotGroup = null;
  let shastriYardData = null;
  let shastriYardGroup = null;
  let interchangeHubsData = null;"""
    assert content.count(t1) == 1, f"T1 count: {content.count(t1)}"
    content = content.replace(t1, r1)

    # 2. makeMapPIDSTex
    t2 = """    const isOrange = lineId === 'orange';
    const isMagenta = lineId === 'magenta';
    const isBlue = lineId === 'blue' || lineId === 'blue-vaishali';
    const headerColor = isOrange ? '#F97316' : (isMagenta ? '#D946EF' : (isBlue ? '#2563EB' : '#EAB308'));
    const lineLabel = isOrange ? 'AIRPORT EXPRESS' : (isMagenta ? 'MAGENTA LINE' : (isBlue ? 'BLUE LINE' : 'YELLOW LINE'));

    ctx.fillStyle = headerColor;
    ctx.fillRect(10, 10, 492, 26);
    ctx.fillStyle = isBlue || isMagenta || isOrange ? '#FFFFFF' : '#0F172A';
    ctx.font = '800 17px -apple-system, Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${stName.toUpperCase()}  ·  ${lineLabel} PIDS`, 20, 23);

    ctx.fillStyle = isOrange ? '#FDBA74' : (isMagenta ? '#F0ABFC' : (isBlue ? '#93C5FD' : '#FACC15'));
    ctx.font = '700 22px "SF Mono", Menlo, monospace';
    if (isOrange) {"""
    r2 = """    const isRed = lineId === 'red';
    const isOrange = lineId === 'orange';
    const isMagenta = lineId === 'magenta';
    const isBlue = lineId === 'blue' || lineId === 'blue-vaishali';
    const headerColor = isRed ? '#DC2626' : (isOrange ? '#F97316' : (isMagenta ? '#D946EF' : (isBlue ? '#2563EB' : '#EAB308')));
    const lineLabel = isRed ? 'RED LINE (LINE 1)' : (isOrange ? 'AIRPORT EXPRESS' : (isMagenta ? 'MAGENTA LINE' : (isBlue ? 'BLUE LINE' : 'YELLOW LINE')));

    ctx.fillStyle = headerColor;
    ctx.fillRect(10, 10, 492, 26);
    ctx.fillStyle = isBlue || isMagenta || isOrange || isRed ? '#FFFFFF' : '#0F172A';
    ctx.font = '800 17px -apple-system, Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${stName.toUpperCase()}  ·  ${lineLabel} PIDS`, 20, 23);

    ctx.fillStyle = isRed ? '#FCA5A5' : (isOrange ? '#FDBA74' : (isMagenta ? '#F0ABFC' : (isBlue ? '#93C5FD' : '#FACC15')));
    ctx.font = '700 22px "SF Mono", Menlo, monospace';
    if (isRed) {
      ctx.fillText('P1  SHAHEED STHAL (GZB)  02 MIN', 20, 64);
      ctx.fillStyle = '#FECACA';
      ctx.fillText('P2  RITHALA (TERMINUS)   03 MIN', 20, 100);
    } else if (isOrange) {"""
    assert content.count(t2) == 1, f"T2 count: {content.count(t2)}"
    content = content.replace(t2, r2)

    # 3. Materials
    t3 = """      roundelRed: std(0xDC2626, { emissive: 0x991B1B, emissiveIntensity: 0.28, roughness: 0.42 }),"""
    r3 = """      roundelRed: std(0xDC2626, { emissive: 0x991B1B, emissiveIntensity: 0.28, roughness: 0.42 }),
      redAccent: new THREE.MeshBasicMaterial({ color: 0xDC2626 }),"""
    assert content.count(t3) == 1, f"T3 count: {content.count(t3)}"
    content = content.replace(t3, r3)

    # 4. buildCorridorCurve headers
    t4 = """    const isYellow = lineKey === 'yellow';
    const isBlueVaishali = lineKey === 'blue-vaishali';
    const isBlueMain = lineKey === 'blue';
    const isBlue = isBlueMain || isBlueVaishali;
    const isOrange = lineKey === 'orange';
    const isMagenta = lineKey === 'magenta';

    const topoLineKey = isYellow
      ? 'yellow-line'
      : (isOrange ? 'airport-express' : (isMagenta ? 'magenta-line' : 'blue-line'));
    const lineId = isYellow
      ? 'yellow'
      : (isOrange ? 'orange' : (isMagenta ? 'magenta' : (isBlueVaishali ? 'blue-vaishali' : 'blue')));
    const lineName = isYellow
      ? 'Yellow Line (Line 2)'
      : (isOrange
        ? 'Airport Express (Line 10)'
        : (isMagenta
          ? 'Magenta Line (Line 8)'
          : (isBlueVaishali ? 'Blue Line (Vaishali Branch)' : 'Blue Line (Line 3/4)')));
    const lineColorNum = isYellow
      ? 0xEAB308
      : (isOrange ? 0xF97316 : (isMagenta ? 0xD946EF : 0x2563EB));
    const lineColorHex = isYellow
      ? '#EAB308'
      : (isOrange ? '#F97316' : (isMagenta ? '#D946EF' : '#2563EB'));"""
    r4 = """    const isYellow = lineKey === 'yellow';
    const isBlueVaishali = lineKey === 'blue-vaishali';
    const isBlueMain = lineKey === 'blue';
    const isBlue = isBlueMain || isBlueVaishali;
    const isOrange = lineKey === 'orange';
    const isMagenta = lineKey === 'magenta';
    const isRed = lineKey === 'red';

    const topoLineKey = isYellow
      ? 'yellow-line'
      : (isRed
        ? 'red-line'
        : (isOrange ? 'airport-express' : (isMagenta ? 'magenta-line' : 'blue-line')));
    const lineId = isYellow
      ? 'yellow'
      : (isRed
        ? 'red'
        : (isOrange ? 'orange' : (isMagenta ? 'magenta' : (isBlueVaishali ? 'blue-vaishali' : 'blue'))));
    const lineName = isYellow
      ? 'Yellow Line (Line 2)'
      : (isRed
        ? 'Red Line (Line 1)'
        : (isOrange
          ? 'Airport Express (Line 10)'
          : (isMagenta
            ? 'Magenta Line (Line 8)'
            : (isBlueVaishali ? 'Blue Line (Vaishali Branch)' : 'Blue Line (Line 3/4)'))));
    const lineColorNum = isYellow
      ? 0xEAB308
      : (isRed
        ? 0xDC2626
        : (isOrange ? 0xF97316 : (isMagenta ? 0xD946EF : 0x2563EB)));
    const lineColorHex = isYellow
      ? '#EAB308'
      : (isRed
        ? '#DC2626'
        : (isOrange ? '#F97316' : (isMagenta ? '#D946EF' : '#2563EB')));"""
    assert content.count(t4) == 1, f"T4 count: {content.count(t4)}"
    content = content.replace(t4, r4)

    # 5. buildCorridorCurve Red elevation profile
    t5 = """        densePts.push(cur3D);
      }
    } else {
      // Blue Line 3D elevation profile:"""
    r5 = """        densePts.push(cur3D);
      }
    } else if (isRed) {
      // Red Line (Line 1) 3D elevation profile:
      // Node 0..147: Rithala -> Rohini -> Pitampura -> NSP -> Inderlok (+17.5m) -> Pul Bangash -> Tis Hazari -> Kashmere Gate (+16.8m)
      // Node 147..158: Ramp down from Kashmere Gate to Yamuna River Bridge (+16.8m -> +11.0m)
      // Node 158..165: Historic Yamuna River Bridge viaduct span (+11.0m)
      // Node 165..170: Ramp down from Yamuna Bridge east bank into Shastri Park ground level (+11.0m -> +1.35m)
      // Node 170..175: Shastri Park At-Grade Station & Depot throat (+1.35m)
      // Node 175..184: Ramp up from Shastri Park to Seelampur elevated viaduct (+1.35m -> +16.5m)
      // Node 184..334: Seelampur -> Welcome (+16.5m) -> Shahdara -> Dilshad Garden -> Hindon River (+17.5m) -> Shaheed Sthal
      const redElevAt = (idxF) => {
        if (idxF <= 147) {
          if (idxF >= 84 && idxF <= 92) return 17.5; // Inderlok upper tier crossing above Green Line
          if (idxF >= 143) return 16.8; // Kashmere Gate elevated tier
          return VIADUCT_Y;
        }
        if (idxF <= 158) {
          const u = (idxF - 147) / 11;
          return 16.8 + (11.0 - 16.8) * hermiteSmooth(u);
        }
        if (idxF <= 165) {
          return 11.0; // Yamuna River crossing span
        }
        if (idxF <= 170) {
          const u = (idxF - 165) / 5;
          return 11.0 + (1.35 - 11.0) * hermiteSmooth(u);
        }
        if (idxF <= 175) {
          return 1.35; // Shastri Park at-grade station
        }
        if (idxF <= 184) {
          const u = (idxF - 175) / 9;
          return 1.35 + (VIADUCT_Y - 1.35) * hermiteSmooth(u);
        }
        if (idxF >= 320 && idxF <= 328) {
          return 17.5; // Hindon River crossing
        }
        return VIADUCT_Y;
      };

      for (let i = 0; i < nTotal; i++) {
        const p = raw2D[i];
        const elev = redElevAt(i);
        const cur3D = new THREE.Vector3(p.x, elev, p.z);

        if (densePts.length > 0 && i > 0) {
          const prev3D = densePts[densePts.length - 1];
          const segD = prev3D.distanceTo(cur3D);
          const inGradeZone = (i >= 145 && i <= 186);
          if (segD > 85 || inGradeZone) {
            const steps = inGradeZone ? 10 : Math.min(8, Math.ceil(segD / 70));
            for (let s = 1; s < steps; s++) {
              const f = s / steps;
              const interp = new THREE.Vector3().lerpVectors(prev3D, cur3D, f);
              interp.y = redElevAt((i - 1) + f);
              densePts.push(interp);
            }
          }
        }
        densePts.push(cur3D);
      }
    } else {
      // Blue Line 3D elevation profile:"""
    assert content.count(t5) == 1, f"T5 count: {content.count(t5)}"
    content = content.replace(t5, r5)

    # 6. corridorObj property
    t6 = """      isBlue,
      isOrange,
      isMagenta,
      colorNum: lineColorNum,"""
    r6 = """      isBlue,
      isOrange,
      isMagenta,
      isRed,
      colorNum: lineColorNum,"""
    assert content.count(t6) == 1, f"T6 count: {content.count(t6)}"
    content = content.replace(t6, r6)

    # 7. sampleAtDist
    t7 = """    const corr = corridor || activeWalkCorridor || (
      activeLineId === 'blue' ? blueCorridor : (
        activeLineId === 'orange' ? orangeCorridor : (
          activeLineId === 'magenta' ? magentaCorridor : yellowCorridor
        )
      )
    ) || yellowCorridor;"""
    r7 = """    const corr = corridor || activeWalkCorridor || (
      activeLineId === 'blue' ? blueCorridor : (
        activeLineId === 'orange' ? orangeCorridor : (
          activeLineId === 'magenta' ? magentaCorridor : (
            activeLineId === 'red' ? redCorridor : yellowCorridor
          )
        )
      )
    ) || yellowCorridor;"""
    assert content.count(t7) == 1, f"T7 count: {content.count(t7)}"
    content = content.replace(t7, r7)

    # 8. buildTrackInfrastructure
    t8 = """    const isBlue = Boolean(c && (c.isBlue || c.lineId === 'blue' || c.lineKey === 'blue'));
    const isOrange = Boolean(c && (c.isOrange || c.lineId === 'orange' || c.lineKey === 'orange'));
    const isMagenta = Boolean(c && (c.isMagenta || c.lineId === 'magenta' || c.lineKey === 'magenta'));
    const spineMat = isOrange ? m.tactileOrange : (isMagenta ? m.tactileMagenta : (isBlue ? m.tactileBlue : m.tactileYellow));
    const guideMat = isOrange ? m.orangeAccent : (isMagenta ? m.magentaAccent : (isBlue ? m.blueAccent : m.yellowAccent));"""
    r8 = """    const isBlue = Boolean(c && (c.isBlue || c.lineId === 'blue' || c.lineKey === 'blue'));
    const isOrange = Boolean(c && (c.isOrange || c.lineId === 'orange' || c.lineKey === 'orange'));
    const isMagenta = Boolean(c && (c.isMagenta || c.lineId === 'magenta' || c.lineKey === 'magenta'));
    const isRed = Boolean(c && (c.isRed || c.lineId === 'red' || c.lineKey === 'red'));
    const spineMat = isRed ? m.roundelRed : (isOrange ? m.tactileOrange : (isMagenta ? m.tactileMagenta : (isBlue ? m.tactileBlue : m.tactileYellow)));
    const guideMat = isRed ? m.redAccent : (isOrange ? m.orangeAccent : (isMagenta ? m.magentaAccent : (isBlue ? m.blueAccent : m.yellowAccent)));"""
    assert content.count(t8) == 1, f"T8 count: {content.count(t8)}"
    content = content.replace(t8, r8)

    # 9. Clearance boxes
    t9 = """      toBox(77.2980, 28.5405, 77.3035, 28.5435), // Agra Canal Flyover & Bowstring Bridge Corridor
      toBox(77.3025, 28.5405, 77.3105, 28.5460)  // Kalindi Kunj Ground Depot & Incline Ramp"""
    r9 = """      toBox(77.2980, 28.5405, 77.3035, 28.5435), // Agra Canal Flyover & Bowstring Bridge Corridor
      toBox(77.3025, 28.5405, 77.3105, 28.5460), // Kalindi Kunj Ground Depot & Incline Ramp
      toBox(77.2410, 28.6670, 77.2515, 28.6730)  // Shastri Park Maintenance Depot & Training Academy"""
    assert content.count(t9) == 1, f"T9 count: {content.count(t9)}"
    content = content.replace(t9, r9)

    # 10. activeElevCorridors
    t10 = """    const activeElevCorridors = [yellowCorridor, blueCorridor, orangeCorridor, magentaCorridor].filter(Boolean);"""
    r10 = """    const activeElevCorridors = [yellowCorridor, blueCorridor, orangeCorridor, magentaCorridor, redCorridor].filter(Boolean);"""
    assert content.count(t10) == 1, f"T10 count: {content.count(t10)}"
    content = content.replace(t10, r10)

    # 11. ensureStationSignage
    t11 = """    const isOrange = st.lineId === 'orange' || st.lineKey === 'orange' || st.isOrange;
    const isMagenta = st.lineId === 'magenta' || st.lineKey === 'magenta' || st.isMagenta;
    const isBlue = st.lineId === 'blue' || st.lineId === 'blue-vaishali' || st.isBlue;
    const lineHex = isOrange
      ? '#F97316'
      : (isMagenta
        ? '#D946EF'
        : (isBlue ? '#2563EB' : '#EAB308'));
    const signTex = makeBilingualSignTex(st.hindi, st.name, subtitle, lineHex, secCss);
    const lineKeyStr = isOrange ? 'orange' : (isMagenta ? 'magenta' : (isBlue ? 'blue' : 'yellow'));"""
    r11 = """    const isOrange = st.lineId === 'orange' || st.lineKey === 'orange' || st.isOrange;
    const isMagenta = st.lineId === 'magenta' || st.lineKey === 'magenta' || st.isMagenta;
    const isRed = st.lineId === 'red' || st.lineKey === 'red' || st.isRed;
    const isBlue = st.lineId === 'blue' || st.lineId === 'blue-vaishali' || st.isBlue;
    const lineHex = isRed
      ? '#DC2626'
      : (isOrange
        ? '#F97316'
        : (isMagenta
          ? '#D946EF'
          : (isBlue ? '#2563EB' : '#EAB308')));
    const signTex = makeBilingualSignTex(st.hindi, st.name, subtitle, lineHex, secCss);
    const lineKeyStr = isRed ? 'red' : (isOrange ? 'orange' : (isMagenta ? 'magenta' : (isBlue ? 'blue' : 'yellow')));"""
    assert content.count(t11) == 1, f"T11 count: {content.count(t11)}"
    content = content.replace(t11, r11)

    # 12. buildShastriParkYardInfrastructure and buildElevatedStation
    t12 = """    const signMeshes = [];
    const pidsMesh = null;
    return { root, detail, signMeshes, pidsMesh };
  }

  function buildElevatedStation(st, secColor) {
    const m = getMaterials();
    const g = getSharedStationGeos();
    const root = new THREE.Group();
    const detail = new THREE.Group();
    const yV = VIADUCT_Y;
    // Out of all 17 elevated Yellow Line stations, ONLY Haiderpur Badli Mor has an Island platform.
    const isIsland = st.name === 'Haiderpur Badli Mor';
    const isHaiderpur = st.name === 'Haiderpur Badli Mor';
    const isAzadpur = st.name === 'Azadpur';
    const isSikanderpur = st.name === 'Sikanderpur';
    const isSamaypur = st.name === 'Samaypur Badli';
    const isMillennium = st.name === 'Millennium City Centre';
    const isModelTown = st.name === 'Model Town';
    const isHeritageRidge = HERITAGE_RIDGE_ELEVATED.has(st.name);
    const isCyberCorridor = CYBER_GURUGRAM_ELEVATED.has(st.name);
    const hubSpec = interchangeHubsData && interchangeHubsData.hubs && interchangeHubsData.hubs[st.name];
    const isFlatOverStacked = Boolean(hubSpec && hubSpec.flattenLowerCanopy);
    const wingSide = (!isAzadpur && !isHaiderpur && !isSikanderpur && (st.seqIndex % 2 === 1)) ? -1 : 1;

    // Compact architectural station forecourt plinth cleanly aligned inside right-of-way
    addBox(root, 94, 0.20, 32, m.plazaPave, 0, 0.24, 0);
    addBox(root, 92, 0.24, 4.6, m.sagePark, 0, 0.27, -13.4);
    addBox(root, 92, 0.24, 4.6, m.sagePark, 0, 0.27, 13.4);

    // 1. Concrete Box-Girder Deck + Under-Spine + Transverse Cross-Girders + 3 Flared Piers
    addBox(root, 86, 1.0, 14.2, m.concreteLight, 0, yV - 0.50, 0);
    addBox(root, 86, 2.0, 9.6, m.concreteWeb, 0, yV - 1.95, 0);
    [-34, -17, 0, 17, 34].forEach((cx) => {
      addBox(root, 1.3, 1.0, isIsland ? 16.4 : 28.6, m.concreteWeb, cx, yV - 0.52, 0);
    });

    [-32, 0, 32].forEach((px) => {
      addBox(root, 5.2, 0.9, 5.6, m.concreteWeb, px, 0.45, 0);
      const shaft = new THREE.Mesh(g.pierShaft, isHeritageRidge ? m.sandstoneBuff : m.pierCream);
      shaft.scale.set(1.25, yV - 3.6, 1.25);
      shaft.position.set(px, (yV - 3.6) * 0.5 + 0.75, 0);
      shaft.frustumCulled = false;
      root.add(shaft);
      addBox(root, 3.8, 2.5, 16.5, isHeritageRidge ? m.sandstoneBuff : m.concreteLight, px, yV - 2.9, 0);
    });

    // 2. Glazed Under-Viaduct Concourse Hall + Internal AFC Gates & Escalators + Sidewalk Glass Lift Wing
    const concFloorY = yV - 8.2;
    addBox(root, 58, 0.9, 18.6, m.concreteLight, 0, concFloorY, 0);
    addBox(root, 58, 0.6, 18.6, m.concreteWeb, 0, concFloorY + 5.6, 0);
    [-9.1, 9.1].forEach((cz) => {
      addBox(root, 57, 4.9, 0.22, isCyberCorridor ? m.cyberTeal : m.concourseGlass, 0, concFloorY + 2.8, cz);
      for (let mx = -26; mx <= 26; mx += 6.5) {
        addBox(detail, 0.34, 5.2, 0.34, m.steelDark, mx, concFloorY + 2.8, cz);
      }
    });
    addAFCTurnstiles(detail, -6, concFloorY + 0.45, 4.2, 5);
    [-8.5, 8.5].forEach((ez) => {
      const esc = addBox(detail, 2.2, 0.9, 14.0, m.escStep, -18, concFloorY + 4.8, ez);
      esc.rotation.z = 0.65;
    });

    // External Glass Lift + Sidewalk Escalator Wing (alternated side along corridor)
    const wingZ = wingSide * 13.6;
    const escZ = wingSide * 14.0;
    addBox(detail, 6.4, 0.5, 6.4, m.plazaPave, 22.0, 0.25, wingZ);
    addBox(detail, 5.4, yV + 2.6, 5.4, isCyberCorridor ? m.cyberTeal : m.glassBarrier, 22.0, (yV + 2.6) * 0.5, wingZ);
    addBox(detail, 5.8, 0.5, 5.8, isHeritageRidge ? m.qutabRedStone : m.dmrcBlueRoof, 22.0, yV + 2.9, wingZ);
    addBox(detail, 3.0, 2.4, 3.0, m.concreteWeb, 22.0, 6.2, wingZ);
    const wingEsc = addBox(detail, 2.8, 1.0, 14.2, m.escStep, 29.5, 5.2, escZ);
    wingEsc.rotation.z = -0.58;
    const wingGlass = addBox(detail, 3.0, 1.4, 14.2, m.escGlass, 29.5, 5.9, escZ);
    wingGlass.rotation.z = -0.58;

    const primaryAccentMat = st.isBlue ? m.blueAccent : m.yellowAccent;"""
    r12 = """    const signMeshes = [];
    const pidsMesh = null;
    return { root, detail, signMeshes, pidsMesh };
  }

  function buildShastriParkYardInfrastructure(parent, depotData) {
    if (!depotData || !depotData.tracks) return null;
    const m = getMaterials();
    const g = getSharedStationGeos();
    const grp = new THREE.Group();
    const tr = depotData.tracks;

    const toYardSpan = (poly, defaultElev = 1.35) => {
      if (!poly || poly.length < 2) return null;
      const pts3 = poly.map((c) => toLocalMeters([c[0], c[1]], Number.isFinite(c[2]) ? c[2] : defaultElev));
      let acc = 0;
      const out = [];
      for (let i = 0; i < pts3.length; i++) {
        if (i > 0) acc += Math.hypot(pts3[i].x - pts3[i - 1].x, pts3[i].z - pts3[i - 1].z);
        const prev = pts3[Math.max(0, i - 1)];
        const next = pts3[Math.min(pts3.length - 1, i + 1)];
        const tan = new THREE.Vector3(next.x - prev.x, 0, next.z - prev.z);
        if (tan.lengthSq() < 1e-6) tan.set(1, 0, 0);
        tan.normalize();
        out.push({ pos: pts3[i], tan, dist: acc, elev: Number.isFinite(poly[i][2]) ? poly[i][2] : defaultElev });
      }
      return out.length >= 2 ? out : null;
    };

    // 1. Lead turnouts from Shastri Park station into yard
    const turnoutSpans = (tr.turnouts || []).map((p) => toYardSpan(p, 1.35)).filter(Boolean);
    if (turnoutSpans.length) {
      const ballastProf = [[-2.4, 0.0], [2.4, 0.0], [2.2, 0.22], [-2.2, 0.22]];
      const bM = buildRibbonFromSpans(turnoutSpans, ballastProf, m.ballastSleeper, 1.2, false);
      if (bM) grp.add(bM);
      [-0.7175, 0.7175].forEach((lat) => {
        const railProf = [[lat - 0.035, 0.22], [lat + 0.035, 0.22], [lat + 0.035, 0.38], [lat - 0.035, 0.38]];
        const rM = buildRibbonFromSpans(turnoutSpans, railProf, m.steelRail, 1.2, false);
        if (rM) grp.add(rM);
      });
    }

    // 2. Stabling and inspection fan tracks
    const stablingSpans = (tr.stabling_tracks || []).map((p) => toYardSpan(p, 1.35)).filter(Boolean);
    if (stablingSpans.length) {
      const ballastProf = [[-2.2, 0.0], [2.2, 0.0], [2.0, 0.20], [-2.0, 0.20]];
      const bM = buildRibbonFromSpans(stablingSpans, ballastProf, m.ballastSleeper, 1.2, false);
      if (bM) grp.add(bM);
      [-0.7175, 0.7175].forEach((lat) => {
        const railProf = [[lat - 0.035, 0.20], [lat + 0.035, 0.20], [lat + 0.035, 0.36], [lat - 0.035, 0.36]];
        const rM = buildRibbonFromSpans(stablingSpans, railProf, m.steelRail, 1.2, false);
        if (rM) grp.add(rM);
      });
      // Overhead catenary wires
      const wireProf = [[-0.08, 5.6], [0.08, 5.6], [0.08, 5.75], [-0.08, 5.75]];
      const wM = buildRibbonFromSpans(stablingSpans, wireProf, m.steelDark, 1.2, false);
      if (wM) grp.add(wM);
    }

    // 3. Workshop Sheds and Maintenance Facilities
    (depotData.workshops || []).forEach((ws) => {
      const pos = toLocalMeters(ws.coords, ws.coords[2] || 1.35);
      const wsGroup = new THREE.Group();
      wsGroup.position.set(pos.x, 1.35, pos.z);
      if (ws.headingDeg) {
        wsGroup.rotation.y = THREE.MathUtils.degToRad(-ws.headingDeg);
      }
      // Main shed body
      addBox(wsGroup, ws.widthM, ws.heightM, ws.lengthM, m.concreteLight, 0, ws.heightM * 0.5, 0);
      // Pitched industrial roof with DMRC red accent trim
      addBox(wsGroup, ws.widthM + 1.2, 0.8, ws.lengthM + 1.2, m.redRoof, 0, ws.heightM + 0.4, 0);
      // Skylights
      for (let sz = -ws.lengthM * 0.4; sz <= ws.lengthM * 0.4; sz += 20) {
        addBox(wsGroup, ws.widthM * 0.6, 0.25, 8.0, m.skylightGlass, 0, ws.heightM + 0.85, sz);
      }
      // Workshop track doors
      if (ws.tracksInside > 0) {
        const spacing = ws.widthM / (ws.tracksInside + 1);
        for (let t = 1; t <= ws.tracksInside; t++) {
          const dx = -ws.widthM * 0.5 + t * spacing;
          addBox(wsGroup, 4.4, 6.2, 0.4, m.steelDark, dx, 3.1, ws.lengthM * 0.5);
          addBox(wsGroup, 4.4, 6.2, 0.4, m.steelDark, dx, 3.1, -ws.lengthM * 0.5);
        }
      }
      grp.add(wsGroup);
    });

    parent.add(grp);
    return grp;
  }

  function buildElevatedStation(st, secColor) {
    const m = getMaterials();
    const g = getSharedStationGeos();
    const root = new THREE.Group();
    const detail = new THREE.Group();
    const isAtGrade = (st.structure === 'at-grade' || (st.elevM !== undefined && st.elevM < 4.0));
    const yV = isAtGrade ? (st.elevM || 1.35) : (st.elevM ? st.elevM : VIADUCT_Y);
    // Out of all 17 elevated Yellow Line stations, ONLY Haiderpur Badli Mor has an Island platform.
    const isIsland = st.name === 'Haiderpur Badli Mor';
    const isHaiderpur = st.name === 'Haiderpur Badli Mor';
    const isAzadpur = st.name === 'Azadpur';
    const isSikanderpur = st.name === 'Sikanderpur';
    const isSamaypur = st.name === 'Samaypur Badli';
    const isMillennium = st.name === 'Millennium City Centre';
    const isModelTown = st.name === 'Model Town';
    const isHeritageRidge = HERITAGE_RIDGE_ELEVATED.has(st.name);
    const isCyberCorridor = CYBER_GURUGRAM_ELEVATED.has(st.name);
    const hubSpec = interchangeHubsData && interchangeHubsData.hubs && interchangeHubsData.hubs[st.name];
    const isFlatOverStacked = Boolean(hubSpec && hubSpec.flattenLowerCanopy);
    const wingSide = (!isAzadpur && !isHaiderpur && !isSikanderpur && (st.seqIndex % 2 === 1)) ? -1 : 1;

    // Compact architectural station forecourt plinth cleanly aligned inside right-of-way
    addBox(root, 94, 0.20, 32, m.plazaPave, 0, 0.24, 0);
    addBox(root, 92, 0.24, 4.6, m.sagePark, 0, 0.27, -13.4);
    addBox(root, 92, 0.24, 4.6, m.sagePark, 0, 0.27, 13.4);

    // 1. Concrete Box-Girder Deck + Under-Spine + Transverse Cross-Girders + 3 Flared Piers
    addBox(root, 86, 1.0, 14.2, m.concreteLight, 0, yV - 0.50, 0);
    addBox(root, 86, 2.0, 9.6, m.concreteWeb, 0, yV - 1.95, 0);
    [-34, -17, 0, 17, 34].forEach((cx) => {
      addBox(root, 1.3, 1.0, isIsland ? 16.4 : 28.6, m.concreteWeb, cx, yV - 0.52, 0);
    });

    [-32, 0, 32].forEach((px) => {
      addBox(root, 5.2, isAtGrade ? 0.4 : 0.9, 5.6, m.concreteWeb, px, isAtGrade ? 0.2 : 0.45, 0);
      if (!isAtGrade) {
        const shaft = new THREE.Mesh(g.pierShaft, isHeritageRidge ? m.sandstoneBuff : m.pierCream);
        shaft.scale.set(1.25, yV - 3.6, 1.25);
        shaft.position.set(px, (yV - 3.6) * 0.5 + 0.75, 0);
        shaft.frustumCulled = false;
        root.add(shaft);
        addBox(root, 3.8, 2.5, 16.5, isHeritageRidge ? m.sandstoneBuff : m.concreteLight, px, yV - 2.9, 0);
      }
    });

    if (!isAtGrade) {
      // 2. Glazed Under-Viaduct Concourse Hall + Internal AFC Gates & Escalators + Sidewalk Glass Lift Wing
      const concFloorY = yV - 8.2;
      addBox(root, 58, 0.9, 18.6, m.concreteLight, 0, concFloorY, 0);
      addBox(root, 58, 0.6, 18.6, m.concreteWeb, 0, concFloorY + 5.6, 0);
      [-9.1, 9.1].forEach((cz) => {
        addBox(root, 57, 4.9, 0.22, isCyberCorridor ? m.cyberTeal : m.concourseGlass, 0, concFloorY + 2.8, cz);
        for (let mx = -26; mx <= 26; mx += 6.5) {
          addBox(detail, 0.34, 5.2, 0.34, m.steelDark, mx, concFloorY + 2.8, cz);
        }
      });
      addAFCTurnstiles(detail, -6, concFloorY + 0.45, 4.2, 5);
      [-8.5, 8.5].forEach((ez) => {
        const esc = addBox(detail, 2.2, 0.9, 14.0, m.escStep, -18, concFloorY + 4.8, ez);
        esc.rotation.z = 0.65;
      });

      // External Glass Lift + Sidewalk Escalator Wing (alternated side along corridor)
      const wingZ = wingSide * 13.6;
      const escZ = wingSide * 14.0;
      addBox(detail, 6.4, 0.5, 6.4, m.plazaPave, 22.0, 0.25, wingZ);
      addBox(detail, 5.4, yV + 2.6, 5.4, isCyberCorridor ? m.cyberTeal : m.glassBarrier, 22.0, (yV + 2.6) * 0.5, wingZ);
      addBox(detail, 5.8, 0.5, 5.8, isHeritageRidge ? m.qutabRedStone : (st.isRed ? m.redRoof : m.dmrcBlueRoof), 22.0, yV + 2.9, wingZ);
      addBox(detail, 3.0, 2.4, 3.0, m.concreteWeb, 22.0, 6.2, wingZ);
      const wingEsc = addBox(detail, 2.8, 1.0, 14.2, m.escStep, 29.5, 5.2, escZ);
      wingEsc.rotation.z = -0.58;
      const wingGlass = addBox(detail, 3.0, 1.4, 14.2, m.escGlass, 29.5, 5.9, escZ);
      wingGlass.rotation.z = -0.58;
    } else {
      // Ground-level at-grade concourse entry hall & glass over-track pedestrian bridge
      addBox(root, 62, 0.5, 24, m.plazaPave, 0, 0.25, 0);
      addBox(root, 48, 5.0, 18.0, m.concreteLight, 0, 2.5, 0);
      addBox(detail, 46, 3.8, 0.22, m.concourseGlass, 0, 2.5, 9.1);
      addBox(detail, 46, 3.8, 0.22, m.concourseGlass, 0, 2.5, -9.1);
      addBox(root, 50, 0.8, 20.0, m.redRoof, 0, 5.4, 0);
    }

    const primaryAccentMat = st.isRed ? m.roundelRed : (st.isBlue ? m.blueAccent : m.yellowAccent);"""
    assert content.count(t12) == 1, f"T12 count: {content.count(t12)}"
    content = content.replace(t12, r12)

    # 13. Roof material
    t13 = """    const archCenterY = yV + 1.8;
    const isNoidaTerminus = (st.name === 'Noida Electronic City');
    const roofMat = isNoidaTerminus ? m.concreteLight : m.dmrcBlueRoof;"""
    r13 = """    const archCenterY = yV + 1.8;
    const isNoidaTerminus = (st.name === 'Noida Electronic City');
    const roofMat = st.isRed ? m.redRoof : (isNoidaTerminus ? m.concreteLight : m.dmrcBlueRoof);"""
    assert content.count(t13) == 1, f"T13 count: {content.count(t13)}"
    content = content.replace(t13, r13)

    # 14. hubSpec.arms in attachGenuineInterchangeGeometry
    t14 = """      if (arm.line === 'Magenta Line' && magentaCorridor) return;
      if (arm.line === 'Blue Line' && blueCorridor) return;
      if (arm.line === 'Yellow Line' && yellowCorridor) return;
      if ((arm.line === 'Airport Express' || arm.line === 'Orange Line') && orangeCorridor) return;
      if ((st.isMagenta && arm.line === 'Magenta Line') ||
          (st.isBlue && arm.line === 'Blue Line') ||
          (st.isYellow && arm.line === 'Yellow Line') ||
          (st.isOrange && (arm.line === 'Airport Express' || arm.line === 'Orange Line'))) {
        return;
      }"""
    r14 = """      if (arm.line === 'Red Line' && redCorridor) return;
      if (arm.line === 'Magenta Line' && magentaCorridor) return;
      if (arm.line === 'Blue Line' && blueCorridor) return;
      if (arm.line === 'Yellow Line' && yellowCorridor) return;
      if ((arm.line === 'Airport Express' || arm.line === 'Orange Line') && orangeCorridor) return;
      if ((st.isRed && arm.line === 'Red Line') ||
          (st.isMagenta && arm.line === 'Magenta Line') ||
          (st.isBlue && arm.line === 'Blue Line') ||
          (st.isYellow && arm.line === 'Yellow Line') ||
          (st.isOrange && (arm.line === 'Airport Express' || arm.line === 'Orange Line'))) {
        return;
      }"""
    assert content.count(t14) == 1, f"T14 count: {content.count(t14)}"
    content = content.replace(t14, r14)

    # 15. buildAllStations header & subtitles
    t15 = """    const isBlue = Boolean(c && (c.isBlue || c.lineId === 'blue' || c.lineKey === 'blue'));
    const isOrange = Boolean(c && (c.isOrange || c.lineId === 'orange' || c.lineKey === 'orange'));
    const isMagenta = Boolean(c && (c.isMagenta || c.lineId === 'magenta' || c.lineKey === 'magenta'));

    stList.forEach((st) => {
      st.corridor = c;
      if (!st.lineId) st.lineId = isOrange ? 'orange' : (isMagenta ? 'magenta' : (isBlue ? 'blue' : 'yellow'));
      st.isBlue = isBlue;
      st.isOrange = isOrange;
      st.isMagenta = isMagenta;
      st.isYellow = (!isBlue && !isOrange && !isMagenta);
      const secColor = pickInterchangeHex(st);
      const secCss = secColor ? ('#' + secColor.toString(16).padStart(6, '0')) : null;
      const isUgSide = st.structure !== 'elevated' && UNDERGROUND_SIDE_STATIONS.has(st.name);
      const isElIsland = st.structure === 'elevated' && st.name === 'Haiderpur Badli Mor';
      let subtitle;
      if (isOrange) {"""
    r15 = """    const isBlue = Boolean(c && (c.isBlue || c.lineId === 'blue' || c.lineKey === 'blue'));
    const isOrange = Boolean(c && (c.isOrange || c.lineId === 'orange' || c.lineKey === 'orange'));
    const isMagenta = Boolean(c && (c.isMagenta || c.lineId === 'magenta' || c.lineKey === 'magenta'));
    const isRed = Boolean(c && (c.isRed || c.lineId === 'red' || c.lineKey === 'red'));

    stList.forEach((st) => {
      st.corridor = c;
      if (!st.lineId) st.lineId = isRed ? 'red' : (isOrange ? 'orange' : (isMagenta ? 'magenta' : (isBlue ? 'blue' : 'yellow')));
      st.isBlue = isBlue;
      st.isOrange = isOrange;
      st.isMagenta = isMagenta;
      st.isRed = isRed;
      st.isYellow = (!isBlue && !isOrange && !isMagenta && !isRed);
      const secColor = pickInterchangeHex(st);
      const secCss = secColor ? ('#' + secColor.toString(16).padStart(6, '0')) : null;
      const isUgSide = st.structure !== 'elevated' && UNDERGROUND_SIDE_STATIONS.has(st.name);
      const isElIsland = st.structure === 'elevated' && st.name === 'Haiderpur Badli Mor';
      let subtitle;
      if (isRed) {
        if (st.name === 'Kashmere Gate') subtitle = 'RED × YELLOW × VIOLET MEGA HUB · +16.8M ELEVATED';
        else if (st.name === 'Inderlok') subtitle = 'RED × GREEN INTERCHANGE · UPPER VIADUCT +17.5M';
        else if (st.name === 'Netaji Subhash Place') subtitle = 'RED × PINK INTERCHANGE · +16.5M ELEVATED';
        else if (st.name === 'Welcome') subtitle = 'RED × PINK INTERCHANGE · +16.5M ELEVATED';
        else if (st.name === 'Shastri Park') subtitle = 'RED LINE · AT-GRADE STATION & FIRST DMRC DEPOT';
        else if (st.name === 'Shahdara') subtitle = 'RED LINE · SHAHDARA INDIAN RAILWAYS JUNCTION';
        else if (st.name === 'Hindon River') subtitle = 'RED LINE · HINDON RIVER BRIDGE VIADUCT';
        else if (st.name === 'Rithala') subtitle = 'RED LINE · WEST TERMINUS · SCISSORS CROSSOVER';
        else if (st.name === 'Shaheed Sthal') subtitle = 'RED LINE · GHAZIABAD EAST TERMINUS · NEW BUS ADDA';
        else if (st.terminus) subtitle = `RED LINE · TERMINUS · ${st.structure.toUpperCase()}`;
        else subtitle = `RED LINE · ${st.structure === 'at-grade' ? 'AT-GRADE GROUND LEVEL' : '+16M ELEVATED'}`;
      } else if (isOrange) {"""
    assert content.count(t15) == 1, f"T15 count: {content.count(t15)}"
    content = content.replace(t15, r15)

    # 16. buildElevatedStation vs buildUndergroundCutawayStation for at-grade
    t16 = """                                : (st.structure === 'elevated'
                                    ? buildElevatedStation(st, secColor)
                                    : buildUndergroundCutawayStation(st, secColor))))))));"""
    r16 = """                                : ((st.structure === 'elevated' || st.structure === 'at-grade')
                                    ? buildElevatedStation(st, secColor)
                                    : buildUndergroundCutawayStation(st, secColor))))))));"""
    assert content.count(t16) == 1, f"T16 count: {content.count(t16)}"
    content = content.replace(t16, r16)

    # 17. buildFleet
    t17 = """    const isVaishali = Boolean(c && (c.lineId === 'blue-vaishali' || c.lineKey === 'blue-vaishali'));
    const isBlue = Boolean(c && (c.isBlue || c.lineId === 'blue' || c.lineKey === 'blue' || isVaishali));
    const isOrange = Boolean(c && (c.isOrange || c.lineId === 'orange' || c.lineKey === 'orange'));
    const isMagenta = Boolean(c && (c.isMagenta || c.lineId === 'magenta' || c.lineKey === 'magenta'));
    const lineColor = isOrange ? 0xF97316 : (isMagenta ? 0xD946EF : (isBlue ? 0x2563EB : 0xEAB308));
    const idPrefix = isOrange ? 'OE' : (isMagenta ? 'ML' : (isVaishali ? 'BV' : (isBlue ? 'BL' : 'YL')));
    const trainsCount = isOrange ? 4 : (isVaishali ? 3 : (isMagenta ? 7 : FLEET_TRAINS_PER_DIR));

    const heroNames = isOrange
      ? ['IGI Airport', 'Dhaula Kuan', 'Shivaji Stadium', 'Delhi Aerocity', 'Yashobhoomi Dwarka Sector 25']
      : (isMagenta
        ? ['Janakpuri West', 'Terminal 1 IGI Airport', 'Hauz Khas', 'Kalkaji Mandir', 'Botanical Garden']
        : (isVaishali
          ? ['Anand Vihar ISBT', 'Karkarduma', 'Preet Vihar', 'Vaishali']
          : (isBlue
            ? ['Dwarka Sector 21', 'Rajiv Chowk', 'Akshardham', 'Botanical Garden', 'Noida City Centre']
            : ['Qutab Minar', 'Green Park', 'Lok Kalyan Marg', 'Rajiv Chowk', 'Kashmere Gate'])));"""
    r17 = """    const isVaishali = Boolean(c && (c.lineId === 'blue-vaishali' || c.lineKey === 'blue-vaishali'));
    const isBlue = Boolean(c && (c.isBlue || c.lineId === 'blue' || c.lineKey === 'blue' || isVaishali));
    const isOrange = Boolean(c && (c.isOrange || c.lineId === 'orange' || c.lineKey === 'orange'));
    const isMagenta = Boolean(c && (c.isMagenta || c.lineId === 'magenta' || c.lineKey === 'magenta'));
    const isRed = Boolean(c && (c.isRed || c.lineId === 'red' || c.lineKey === 'red'));
    const lineColor = isRed ? 0xDC2626 : (isOrange ? 0xF97316 : (isMagenta ? 0xD946EF : (isBlue ? 0x2563EB : 0xEAB308)));
    const idPrefix = isRed ? 'RL' : (isOrange ? 'OE' : (isMagenta ? 'ML' : (isVaishali ? 'BV' : (isBlue ? 'BL' : 'YL'))));
    const trainsCount = isRed ? 8 : (isOrange ? 4 : (isVaishali ? 3 : (isMagenta ? 7 : FLEET_TRAINS_PER_DIR)));

    let heroNames;
    if (isRed) {
      heroNames = ['Rithala', 'Netaji Subhash Place', 'Inderlok', 'Kashmere Gate', 'Welcome', 'Dilshad Garden', 'Shaheed Sthal'];
    } else if (isOrange) {
      heroNames = ['IGI Airport', 'Dhaula Kuan', 'Shivaji Stadium', 'Delhi Aerocity', 'Yashobhoomi Dwarka Sector 25'];
    } else if (isMagenta) {
      heroNames = ['Janakpuri West', 'Terminal 1 IGI Airport', 'Hauz Khas', 'Kalkaji Mandir', 'Botanical Garden'];
    } else if (isVaishali) {
      heroNames = ['Anand Vihar ISBT', 'Karkarduma', 'Preet Vihar', 'Vaishali'];
    } else if (isBlue) {
      heroNames = ['Dwarka Sector 21', 'Rajiv Chowk', 'Akshardham', 'Botanical Garden', 'Noida City Centre'];
    } else {
      heroNames = ['Qutab Minar', 'Green Park', 'Lok Kalyan Marg', 'Rajiv Chowk', 'Kashmere Gate'];
    }"""
    assert content.count(t17) == 1, f"T17 count: {content.count(t17)}"
    content = content.replace(t17, r17)

    # 18. ActiveLineId in train loop
    t18 = """        const matches = (activeLineId === 'blue' && (lineKey === 'blue' || lineKey === 'blue-vaishali')) ||
                        (activeLineId === 'yellow' && lineKey === 'yellow') ||
                        (activeLineId === 'orange' && lineKey === 'orange') ||
                        (activeLineId === 'magenta' && lineKey === 'magenta');"""
    r18 = """        const matches = (activeLineId === 'blue' && (lineKey === 'blue' || lineKey === 'blue-vaishali')) ||
                        (activeLineId === 'yellow' && lineKey === 'yellow') ||
                        (activeLineId === 'orange' && lineKey === 'orange') ||
                        (activeLineId === 'magenta' && lineKey === 'magenta') ||
                        (activeLineId === 'red' && lineKey === 'red');"""
    assert content.count(t18) == 1, f"T18 count: {content.count(t18)}"
    content = content.replace(t18, r18)

    # 19. Data fetching in initMetroWebGLLayer
    t19 = """      const kalindiDepotPromise = window.__kalindiDepotPromise || (
        window.__kalindiDepotPromise = fetch('src/data/kalindi_kunj_yard_tracks.json').then((r) => r.json()).catch(() => null)
      );
      const [
        osmData, topoData, svcData,
        blueOsmData, blueSvcData, vaishaliOsmData,
        yamunaYardJson, interchangeHubsJson,
        orangeOsmData, orangeSvcData,
        magentaOsmData, magentaSvcData,
        kalindiDepotJson
      ] = await Promise.all([
        osmPromise, topoPromise, svcPromise,
        blueOsmPromise, blueSvcPromise, vaishaliOsmPromise,
        yamunaYardPromise, interchangeHubsPromise,
        orangeOsmPromise, orangeSvcPromise,
        magentaOsmPromise, magentaSvcPromise,
        kalindiDepotPromise
      ]);
      yamunaYardData = yamunaYardJson;
      kalindiDepotData = kalindiDepotJson;
      interchangeHubsData = interchangeHubsJson;
      buildScene(osmData, topoData, svcData, blueOsmData, blueSvcData, vaishaliOsmData, orangeOsmData, orangeSvcData, magentaOsmData, magentaSvcData);"""
    r19 = """      const kalindiDepotPromise = window.__kalindiDepotPromise || (
        window.__kalindiDepotPromise = fetch('src/data/kalindi_kunj_yard_tracks.json').then((r) => r.json()).catch(() => null)
      );
      const redOsmPromise = window.__redLineOsmPromise || (
        window.__redLineOsmPromise = fetch('src/data/red_line_accurate_osm.json').then((r) => r.json()).catch(() => null)
      );
      const redSvcPromise = window.__redLineServicePromise || (
        window.__redLineServicePromise = fetch('src/data/red_line_service.json').then((r) => r.json()).catch(() => null)
      );
      const shastriYardPromise = window.__shastriYardPromise || (
        window.__shastriYardPromise = fetch('src/data/shastri_park_yard_tracks.json').then((r) => r.json()).catch(() => null)
      );
      const [
        osmData, topoData, svcData,
        blueOsmData, blueSvcData, vaishaliOsmData,
        yamunaYardJson, interchangeHubsJson,
        orangeOsmData, orangeSvcData,
        magentaOsmData, magentaSvcData,
        kalindiDepotJson,
        redOsmData, redSvcData,
        shastriYardJson
      ] = await Promise.all([
        osmPromise, topoPromise, svcPromise,
        blueOsmPromise, blueSvcPromise, vaishaliOsmPromise,
        yamunaYardPromise, interchangeHubsPromise,
        orangeOsmPromise, orangeSvcPromise,
        magentaOsmPromise, magentaSvcPromise,
        kalindiDepotPromise,
        redOsmPromise, redSvcPromise,
        shastriYardPromise
      ]);
      yamunaYardData = yamunaYardJson;
      kalindiDepotData = kalindiDepotJson;
      shastriYardData = shastriYardJson;
      interchangeHubsData = interchangeHubsJson;
      buildScene(osmData, topoData, svcData, blueOsmData, blueSvcData, vaishaliOsmData, orangeOsmData, orangeSvcData, magentaOsmData, magentaSvcData, redOsmData, redSvcData);"""
    assert content.count(t19) == 1, f"T19 count: {content.count(t19)}"
    content = content.replace(t19, r19)

    # 20. updateVisibilityAndCulling yard & station culling
    t20 = """      kalindiDepotGroup.visible = (activeLineId !== 'yellow' && activeLineId !== 'blue' && activeLineId !== 'orange') && (kdD2 <= yardR2);
    }

    const list = allStationsData.length ? allStationsData : stationsData;
    for (let i = 0; i < list.length; i++) {
      const st = list[i];
      if (activeLineId !== 'all' && !st._isSharedDualHub) {
        const stLineKey = st.lineKey || st.lineId || (st.corridor ? (st.corridor.lineKey || st.corridor.lineId) : (st.isBlue ? 'blue' : 'yellow'));
        const matches = (activeLineId === 'blue' && (stLineKey === 'blue' || stLineKey === 'blue-vaishali')) ||
                        (activeLineId === 'yellow' && stLineKey === 'yellow') ||
                        (activeLineId === 'orange' && stLineKey === 'orange') ||
                        (activeLineId === 'magenta' && stLineKey === 'magenta');"""
    r20 = """      kalindiDepotGroup.visible = (activeLineId !== 'yellow' && activeLineId !== 'blue' && activeLineId !== 'orange' && activeLineId !== 'red') && (kdD2 <= yardR2);
    }
    if (shastriYardGroup && redCorridor && redCorridor.stationsData) {
      const spSt = redCorridor.stationsData.find((s) => s.name && s.name.toLowerCase().includes('shastri park'));
      const spD2 = spSt ? ((spSt.pos.x - focusX) * (spSt.pos.x - focusX) + (spSt.pos.z - focusZ) * (spSt.pos.z - focusZ)) : 0;
      const yardR2 = Math.max(visR + 3200, 5500) * Math.max(visR + 3200, 5500);
      shastriYardGroup.visible = (activeLineId === 'all' || activeLineId === 'red') && (spD2 <= yardR2);
    }

    const list = allStationsData.length ? allStationsData : stationsData;
    for (let i = 0; i < list.length; i++) {
      const st = list[i];
      if (activeLineId !== 'all' && !st._isSharedDualHub) {
        const stLineKey = st.lineKey || st.lineId || (st.corridor ? (st.corridor.lineKey || st.corridor.lineId) : (st.isBlue ? 'blue' : 'yellow'));
        const matches = (activeLineId === 'blue' && (stLineKey === 'blue' || stLineKey === 'blue-vaishali')) ||
                        (activeLineId === 'yellow' && stLineKey === 'yellow') ||
                        (activeLineId === 'orange' && stLineKey === 'orange') ||
                        (activeLineId === 'magenta' && stLineKey === 'magenta') ||
                        (activeLineId === 'red' && stLineKey === 'red');"""
    assert content.count(t20) == 1, f"T20 count: {content.count(t20)}"
    content = content.replace(t20, r20)

    # 21. buildScene
    t21 = """  function buildScene(osmData, topoData, svcData, blueOsmData, blueSvcData, vaishaliOsmData, orangeOsmData, orangeSvcData, magentaOsmData, magentaSvcData) {
    if (!scene) return;
    initOrigin();

    infraGroup = new THREE.Group();
    yellowCorridor = buildCorridorCurve(osmData, topoData, svcData, 'yellow');
    samples = yellowCorridor.samples;
    totalLen = yellowCorridor.totalLen;
    stationsData = yellowCorridor.stationsData;
    fastCurveProxy = yellowCorridor.fastCurveProxy;

    if (blueOsmData) {
      blueCorridor = buildCorridorCurve(blueOsmData, topoData, blueSvcData, 'blue');
    }
    if (vaishaliOsmData) {
      vaishaliCorridor = buildCorridorCurve(vaishaliOsmData, topoData, null, 'blue-vaishali');
    }
    if (orangeOsmData) {
      orangeCorridor = buildCorridorCurve(orangeOsmData, topoData, orangeSvcData, 'orange');
    }
    if (magentaOsmData) {
      magentaCorridor = buildCorridorCurve(magentaOsmData, topoData, magentaSvcData, 'magenta');
    }
    allCorridors = [yellowCorridor, blueCorridor, vaishaliCorridor, orangeCorridor, magentaCorridor].filter(Boolean);
    allStationsData = allCorridors.flatMap((c) => (c === vaishaliCorridor ? c.stationsData.filter((s) => s.name !== 'Yamuna Bank') : c.stationsData));"""
    r21 = """  function buildScene(osmData, topoData, svcData, blueOsmData, blueSvcData, vaishaliOsmData, orangeOsmData, orangeSvcData, magentaOsmData, magentaSvcData, redOsmData, redSvcData) {
    if (!scene) return;
    initOrigin();

    infraGroup = new THREE.Group();
    yellowCorridor = buildCorridorCurve(osmData, topoData, svcData, 'yellow');
    samples = yellowCorridor.samples;
    totalLen = yellowCorridor.totalLen;
    stationsData = yellowCorridor.stationsData;
    fastCurveProxy = yellowCorridor.fastCurveProxy;

    if (blueOsmData) {
      blueCorridor = buildCorridorCurve(blueOsmData, topoData, blueSvcData, 'blue');
    }
    if (vaishaliOsmData) {
      vaishaliCorridor = buildCorridorCurve(vaishaliOsmData, topoData, null, 'blue-vaishali');
    }
    if (orangeOsmData) {
      orangeCorridor = buildCorridorCurve(orangeOsmData, topoData, orangeSvcData, 'orange');
    }
    if (magentaOsmData) {
      magentaCorridor = buildCorridorCurve(magentaOsmData, topoData, magentaSvcData, 'magenta');
    }
    if (redOsmData) {
      redCorridor = buildCorridorCurve(redOsmData, topoData, redSvcData, 'red');
    }
    allCorridors = [yellowCorridor, blueCorridor, vaishaliCorridor, orangeCorridor, magentaCorridor, redCorridor].filter(Boolean);
    allStationsData = allCorridors.flatMap((c) => (c === vaishaliCorridor ? c.stationsData.filter((s) => s.name !== 'Yamuna Bank') : c.stationsData));"""
    assert content.count(t21) == 1, f"T21 count: {content.count(t21)}"
    content = content.replace(t21, r21)

    # 22. buildScene track, yard, stations, fleet
    t22 = """    if (orangeCorridor) {
      buildTrackInfrastructure(infraGroup, orangeCorridor.portalCoords, orangeCorridor);
    }
    if (magentaCorridor) {
      buildTrackInfrastructure(infraGroup, magentaCorridor.portalCoords, magentaCorridor);
    }
    if (yamunaYardData) {
      yamunaYardGroup = buildYamunaYardInfrastructure(infraGroup, yamunaYardData);
    }
    if (kalindiDepotData) {
      kalindiDepotGroup = buildKalindiKunjGroundDepot(infraGroup, kalindiDepotData);
    }
    buildBeautifulDelhiEnvironment(infraGroup);
    buildAllStations(infraGroup, yellowCorridor);
    if (blueCorridor) {
      buildAllStations(infraGroup, blueCorridor);
    }
    if (vaishaliCorridor) {
      buildAllStations(infraGroup, vaishaliCorridor);
    }
    if (orangeCorridor) {
      buildAllStations(infraGroup, orangeCorridor);
    }
    if (magentaCorridor) {
      buildAllStations(infraGroup, magentaCorridor);
    }
    buildFleet(infraGroup, yellowCorridor);
    if (blueCorridor) {
      buildFleet(infraGroup, blueCorridor);
    }
    if (vaishaliCorridor) {
      buildFleet(infraGroup, vaishaliCorridor);
    }
    if (orangeCorridor) {
      buildFleet(infraGroup, orangeCorridor);
    }
    if (magentaCorridor) {
      buildFleet(infraGroup, magentaCorridor);
    }"""
    r22 = """    if (orangeCorridor) {
      buildTrackInfrastructure(infraGroup, orangeCorridor.portalCoords, orangeCorridor);
    }
    if (magentaCorridor) {
      buildTrackInfrastructure(infraGroup, magentaCorridor.portalCoords, magentaCorridor);
    }
    if (redCorridor) {
      buildTrackInfrastructure(infraGroup, redCorridor.portalCoords, redCorridor);
    }
    if (yamunaYardData) {
      yamunaYardGroup = buildYamunaYardInfrastructure(infraGroup, yamunaYardData);
    }
    if (kalindiDepotData) {
      kalindiDepotGroup = buildKalindiKunjGroundDepot(infraGroup, kalindiDepotData);
    }
    if (shastriYardData) {
      shastriYardGroup = buildShastriParkYardInfrastructure(infraGroup, shastriYardData);
    }
    buildBeautifulDelhiEnvironment(infraGroup);
    buildAllStations(infraGroup, yellowCorridor);
    if (blueCorridor) {
      buildAllStations(infraGroup, blueCorridor);
    }
    if (vaishaliCorridor) {
      buildAllStations(infraGroup, vaishaliCorridor);
    }
    if (orangeCorridor) {
      buildAllStations(infraGroup, orangeCorridor);
    }
    if (magentaCorridor) {
      buildAllStations(infraGroup, magentaCorridor);
    }
    if (redCorridor) {
      buildAllStations(infraGroup, redCorridor);
    }
    buildFleet(infraGroup, yellowCorridor);
    if (blueCorridor) {
      buildFleet(infraGroup, blueCorridor);
    }
    if (vaishaliCorridor) {
      buildFleet(infraGroup, vaishaliCorridor);
    }
    if (orangeCorridor) {
      buildFleet(infraGroup, orangeCorridor);
    }
    if (magentaCorridor) {
      buildFleet(infraGroup, magentaCorridor);
    }
    if (redCorridor) {
      buildFleet(infraGroup, redCorridor);
    }"""
    assert content.count(t22) == 1, f"T22 count: {content.count(t22)}"
    content = content.replace(t22, r22)

    # 23. Tooltip and pointer hit
    t23 = """        const dotColor = (hit.lineId === 'orange' || hit.lineKey === 'orange')
          ? '#F97316'
          : ((hit.lineId === 'magenta' || hit.lineKey === 'magenta')
            ? '#D946EF'
            : ((hit.lineId === 'blue' || hit.isBlue) ? '#3B82F6' : '#FACC15'));"""
    r23 = """        const dotColor = (hit.lineId === 'red' || hit.lineKey === 'red')
          ? '#DC2626'
          : ((hit.lineId === 'orange' || hit.lineKey === 'orange')
            ? '#F97316'
            : ((hit.lineId === 'magenta' || hit.lineKey === 'magenta')
              ? '#D946EF'
              : ((hit.lineId === 'blue' || hit.isBlue) ? '#3B82F6' : '#FACC15')));"""
    assert content.count(t23) == 1, f"T23 count: {content.count(t23)}"
    content = content.replace(t23, r23)

    t24 = """        const matches = (activeLineId === 'blue' && (stLineKey === 'blue' || stLineKey === 'blue-vaishali')) ||
                        (activeLineId === 'yellow' && stLineKey === 'yellow') ||
                        (activeLineId === 'orange' && stLineKey === 'orange') ||
                        (activeLineId === 'magenta' && stLineKey === 'magenta');
        if (!matches) continue;"""
    r24 = """        const matches = (activeLineId === 'blue' && (stLineKey === 'blue' || stLineKey === 'blue-vaishali')) ||
                        (activeLineId === 'yellow' && stLineKey === 'yellow') ||
                        (activeLineId === 'orange' && stLineKey === 'orange') ||
                        (activeLineId === 'magenta' && stLineKey === 'magenta') ||
                        (activeLineId === 'red' && stLineKey === 'red');
        if (!matches) continue;"""
    assert content.count(t24) == 1, f"T24 count: {content.count(t24)}"
    content = content.replace(t24, r24)

    # 25. Major station markers
    t25 = """        const matches = (activeLineId === 'blue' && (stLk === 'blue' || stLk === 'blue-vaishali')) ||
                        (activeLineId === 'yellow' && stLk === 'yellow') ||
                        (activeLineId === 'orange' && stLk === 'orange') ||
                        (activeLineId === 'magenta' && stLk === 'magenta');
        if (!matches && !sItem.st._isSharedDualHub) show = false;"""
    r25 = """        const matches = (activeLineId === 'blue' && (stLk === 'blue' || stLk === 'blue-vaishali')) ||
                        (activeLineId === 'yellow' && stLk === 'yellow') ||
                        (activeLineId === 'orange' && stLk === 'orange') ||
                        (activeLineId === 'magenta' && stLk === 'magenta') ||
                        (activeLineId === 'red' && stLk === 'red');
        if (!matches && !sItem.st._isSharedDualHub) show = false;"""
    assert content.count(t25) == 1, f"T25 count: {content.count(t25)}"
    content = content.replace(t25, r25)

    # 26. API setLineFilter, getCorridors, getActiveStations
    t26 = """      if (activeLineId === 'blue') {
        activeWalkCorridor = blueCorridor;
      } else if (activeLineId === 'yellow') {
        activeWalkCorridor = yellowCorridor;
      } else if (activeLineId === 'orange') {
        activeWalkCorridor = orangeCorridor;
      } else if (activeLineId === 'magenta') {
        activeWalkCorridor = magentaCorridor;
      }
      updateVisibilityAndCulling(performance.now(), 0, false);
      if (typeof window.syncStationStepper === 'function') {
        window.syncStationStepper();
      }
    },
    getActiveLine() { return activeLineId; },
    getCorridors() { return { yellow: yellowCorridor, blue: blueCorridor, vaishali: vaishaliCorridor, orange: orangeCorridor, magenta: magentaCorridor }; },
    getActiveStations() {
      if (activeLineId === 'blue') {
        const main = blueCorridor ? blueCorridor.stationsData : [];
        const vBranch = vaishaliCorridor ? vaishaliCorridor.stationsData.filter((s) => s.name !== 'Yamuna Bank') : [];
        return main.concat(vBranch);
      }
      if (activeLineId === 'yellow' && yellowCorridor) return yellowCorridor.stationsData;
      if (activeLineId === 'orange' && orangeCorridor) return orangeCorridor.stationsData;
      if (activeLineId === 'magenta' && magentaCorridor) return magentaCorridor.stationsData;
      return allStationsData.length ? allStationsData : stationsData;
    },"""
    r26 = """      if (activeLineId === 'blue') {
        activeWalkCorridor = blueCorridor;
      } else if (activeLineId === 'yellow') {
        activeWalkCorridor = yellowCorridor;
      } else if (activeLineId === 'orange') {
        activeWalkCorridor = orangeCorridor;
      } else if (activeLineId === 'magenta') {
        activeWalkCorridor = magentaCorridor;
      } else if (activeLineId === 'red') {
        activeWalkCorridor = redCorridor;
      }
      updateVisibilityAndCulling(performance.now(), 0, false);
      if (typeof window.syncStationStepper === 'function') {
        window.syncStationStepper();
      }
    },
    getActiveLine() { return activeLineId; },
    getCorridors() { return { yellow: yellowCorridor, blue: blueCorridor, vaishali: vaishaliCorridor, orange: orangeCorridor, magenta: magentaCorridor, red: redCorridor }; },
    getActiveStations() {
      if (activeLineId === 'blue') {
        const main = blueCorridor ? blueCorridor.stationsData : [];
        const vBranch = vaishaliCorridor ? vaishaliCorridor.stationsData.filter((s) => s.name !== 'Yamuna Bank') : [];
        return main.concat(vBranch);
      }
      if (activeLineId === 'yellow' && yellowCorridor) return yellowCorridor.stationsData;
      if (activeLineId === 'orange' && orangeCorridor) return orangeCorridor.stationsData;
      if (activeLineId === 'magenta' && magentaCorridor) return magentaCorridor.stationsData;
      if (activeLineId === 'red' && redCorridor) return redCorridor.stationsData;
      return allStationsData.length ? allStationsData : stationsData;
    },"""
    assert content.count(t26) == 1, f"T26 count: {content.count(t26)}"
    content = content.replace(t26, r26)

    WEBGL_FILE.write_text(content, encoding="utf-8")
    print(f"Successfully wrote {WEBGL_FILE} ({len(content)} bytes, net delta: {len(content) - original_len})")

if __name__ == "__main__":
    main()
