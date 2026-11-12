/* ============================================================
 * DELHI METRO KIT — The 6 Distinct DMRC Station Archetypes
 * Composes every station from Materials, PlatformParts, and
 * TrackSystem with zero duplicated furniture or track code:
 *   1. elevatedSide           (Qutab Minar)
 *   2. elevatedIsland         (Botanical Garden)
 *   3. undergroundIsland      (Rajiv Chowk Yellow Level)
 *   4. surfaceMultiBay        (Yamuna Bank 4-Track + Y-Branch)
 *   5. stackedCrossInterchange(Hauz Khas -12m / -21m Cross)
 *   6. hybridMegaHub          (Kashmere Gate Elev + Underground)
 * ============================================================ */

window.MetroKit = window.MetroKit || {};

window.MetroKit.StationArchetypes = (function () {
  'use strict';

  function M() { return window.MetroKit.Materials; }
  function P() { return window.MetroKit.PlatformParts; }
  function T() { return window.MetroKit.TrackSystem; }

  /** Shared curved DMRC Sky-Blue corrugated + frosted skylight vault canopy */
  function buildDMRCVaultCanopy(parent, cfg) {
    const mat = M().shared();
    const {
      xCenter = 0, yViaduct = 10.5,
      archR = 13.1, length = 48.2,
      arcSpan = Math.PI * 0.56,
      blueBays = [-19, 0, 19],
      roofLineColor = null,
      withHaunchColumns = true
    } = cfg;

    const archCenterY = yViaduct + 1.0;
    const arcStart = (Math.PI - arcSpan) / 2;
    const haunchZ = archR * Math.cos(arcStart);
    const haunchY = archCenterY + archR * Math.sin(arcStart);
    const colH = haunchY - (yViaduct + 1.65);

    const bayMat = roofLineColor ? M().stdMat(roofLineColor, { roughness: 0.38, metalness: 0.24, side: THREE.DoubleSide }) : mat.dmrcBlueRoof;

    const fullSkylight = new THREE.Mesh(
      new THREE.CylinderGeometry(archR + 0.08, archR + 0.08, length, 28, 1, true, arcStart, arcSpan),
      mat.skylightGlass
    );
    fullSkylight.position.set(xCenter, archCenterY, 0);
    fullSkylight.rotation.z = Math.PI / 2;
    fullSkylight.receiveShadow = true;
    parent.add(fullSkylight);

    blueBays.forEach((bx) => {
      const bay = new THREE.Mesh(
        new THREE.CylinderGeometry(archR + 0.24, archR + 0.24, 10.2, 28, 1, true, arcStart, arcSpan),
        bayMat
      );
      bay.position.set(xCenter + bx, archCenterY, 0);
      bay.rotation.z = Math.PI / 2;
      bay.castShadow = true;
      bay.receiveShadow = true;
      parent.add(bay);
    });

    [-haunchZ, haunchZ].forEach((ez) => {
      M().addBox(parent, length + 0.8, 0.34, 0.34, mat.steelDark, xCenter, haunchY, ez);
    });

    const halfL = length / 2 - 0.6;
    const step = (halfL * 2) / 8;
    for (let rx = xCenter - halfL; rx <= xCenter + halfL + 0.05; rx += step) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(archR, 0.22, 8, 24, arcSpan), mat.steelDark);
      arch.position.set(rx, archCenterY, 0);
      arch.rotation.y = Math.PI / 2;
      arch.rotation.z = arcStart;
      arch.castShadow = true;
      parent.add(arch);

      if (withHaunchColumns) {
        for (let cz of [-haunchZ, haunchZ]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, colH, 8), mat.steelDark);
          col.position.set(rx, yViaduct + 1.65 + colH / 2, cz);
          col.castShadow = true;
          parent.add(col);
          M().addBox(parent, 0.62, 0.22, 0.62, mat.steelDark, rx, yViaduct + 1.72, cz);
        }
      }
    }

    for (let theta of [arcStart + 0.28, Math.PI / 2 - 0.32, Math.PI / 2, Math.PI / 2 + 0.32, Math.PI - arcStart - 0.28]) {
      const py = archCenterY + (archR + 0.04) * Math.sin(theta);
      const pz = (archR + 0.04) * Math.cos(theta);
      M().addBox(parent, length, 0.16, 0.20, mat.steelDark, xCenter, py, pz, false);
    }

    [-14, 0, 14].forEach((lx) => {
      M().addBox(parent, 6.2, 0.16, 0.45, M().stdMat(0xFEF9C3, { emissive: 0xFEF9C3, emissiveIntensity: 0.6 }), xCenter + lx, archCenterY + archR - 0.45, 0, false);
      const light = new THREE.PointLight(0xFFFBEB, 0.42, 30, 1.3);
      light.position.set(xCenter + lx, yViaduct + 10.5, 0);
      parent.add(light);
      M().elevatedLights.push(light);
    });

    return { haunchZ, crownY: archCenterY + archR };
  }

  /** Helper: Bilingual DMRC board bolted flush on front & rear fascia */
  function attachFasciaSign(parent, x, y, zDist, signTex, rotY = 0) {
    const mat = M().shared();
    const sMat = new THREE.MeshBasicMaterial({ map: signTex });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(16.5, 2.5, 0.24), sMat);
    mesh.position.set(x, y, zDist);
    mesh.rotation.y = rotY;
    parent.add(mesh);
    const dir = Math.sign(zDist);
    M().addBox(parent, 0.24, 1.8, 0.30, mat.steelDark, x - 5.0, y + 0.15, zDist - dir * 0.16);
    M().addBox(parent, 0.24, 1.8, 0.30, mat.steelDark, x + 5.0, y + 0.15, zDist - dir * 0.16);
  }

  /** Shared glazed under-viaduct concourse box with AFC gates & interior escalators */
  function buildGlazedConcourseBox(parent, cfg) {
    const mat = M().shared();
    const { xCenter = 0, yViaduct = 10.5, concLen = 36, concWid = 15.6, escZs = [-6.6, 6.6], withElevatorWing = true, plinthTopY = -10.0 } = cfg;
    const concFloorY = yViaduct - 6.2;

    M().addBox(parent, concLen, 0.65, concWid, mat.concreteLight, xCenter, concFloorY, 0);
    M().addBox(parent, concLen, 0.45, concWid, mat.concreteWeb, xCenter, concFloorY + 4.4, 0);

    [-concWid / 2 + 0.1, concWid / 2 - 0.1].forEach((cz) => {
      M().addBox(parent, concLen - 0.4, 3.8, 0.14, mat.concourseGlass, xCenter, concFloorY + 2.2, cz, false);
      for (let mx = xCenter - concLen / 2 + 1; mx <= xCenter + concLen / 2 - 1; mx += 3.4) {
        M().addBox(parent, 0.22, 4.1, 0.24, mat.steelDark, mx, concFloorY + 2.2, cz);
      }
    });

    P().buildAFCTurnstileBank(parent, xCenter - 3, concFloorY + 0.35, 3.5, 6);
    M().addBox(parent, 5.5, 2.8, 2.2, M().stdMat(0xF8FAFC), xCenter + 7, concFloorY + 1.7, -3.5);

    escZs.forEach((ez) => {
      P().buildEscalatorFlight(parent, {
        x: xCenter - 11.5, y: concFloorY + 4.0, z: ez,
        length: 10.6, width: 1.65, rotZ: 0.74
      });
    });

    if (withElevatorWing) {
      const towerX = xCenter + 14.5;
      const towerZ = 9.95;
      P().buildElevatorShaft(parent, {
        x: towerX, z: towerZ, yBottom: plinthTopY + 0.7, yTop: yViaduct + 2.0,
        width: 4.6, depth: 4.6, cabY: 3.8, withApron: true
      });
      P().buildEscalatorFlight(parent, {
        x: xCenter + 20.0, y: plinthTopY + 4.3, z: 10.6,
        length: 12.0, width: 2.2, rotZ: -0.58, enclosed: true
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
   * ARCHETYPE 1: ELEVATED SIDE-PLATFORM (e.g. Qutab Minar)
   * ═══════════════════════════════════════════════════════════ */
  function buildElevatedSide(parent, cfg) {
    const mat = M().shared();
    const {
      xCenter = 54, yViaduct = 10.5, plinthTopY = -10.0,
      hindiName = 'क़ुतुब मीनार', engName = 'QUTAB MINAR',
      subtitle = 'YELLOW LINE · ELEVATED VIADUCT (+14m)',
      lineColorHex = '#EAB308', lineColor = M().LINE_COLORS.yellow,
      standalonePlinth = false
    } = cfg || {};

    const g = new THREE.Group();
    if (standalonePlinth) {
      M().addBox(g, 96, 6.2, 54, mat.plinth, xCenter, plinthTopY - 3.1, 0);
      M().addBox(g, 94, 0.7, 50, mat.sageGround, xCenter, plinthTopY + 0.35, 0);
      T().buildBoxGirderSegment(g, { x: xCenter - 33, y: yViaduct, length: 18, width: 11.8 });
      T().buildBoxGirderSegment(g, { x: xCenter + 33, y: yViaduct, length: 18, width: 11.8 });
      T().buildTracksAlongAxis(g, {
        xStart: xCenter - 44, xEnd: xCenter + 44, trackZs: [-3.6, 3.6],
        lineColor, yFn: () => yViaduct, oheStart: xCenter - 44, oheXs: [xCenter - 36, xCenter + 34]
      });
    }

    M().addBox(g, 48, 0.72, 11.4, mat.concreteLight, xCenter, yViaduct - 0.36, 0);
    M().addBox(g, 48, 1.45, 7.6, mat.concreteWeb, xCenter, yViaduct - 1.40, 0);
    [-21, 0, 21, 36].forEach((px) => {
      T().buildDMRCViaductPier(g, { x: xCenter + px, bottomY: plinthTopY + 0.7, topDeckBottomY: yViaduct });
    });

    buildGlazedConcourseBox(g, { xCenter, yViaduct, plinthTopY, withElevatorWing: true });

    for (let cx of [-21, -10.5, 0, 10.5, 21]) {
      M().addBox(g, 0.9, 0.75, 21.2, mat.concreteWeb, xCenter + cx, yViaduct - 0.38, 0);
    }

    const lineAccentMat = new THREE.MeshBasicMaterial({ color: lineColor });
    const commuters = [];

    [-8.0, 8.0].forEach((pz) => {
      const sign = Math.sign(pz);
      const platTop = P().buildPlatformDeck(g, {
        x: xCenter, yCenter: yViaduct + 0.82, zCenter: pz,
        length: 48, width: 5.0, thickness: 1.65,
        edges: [sign < 0 ? 'south' : 'north']
      });
      P().buildPSDBank(g, {
        xStart: xCenter - 22, xEnd: xCenter + 22, yBase: platTop - 0.02,
        zPos: pz - sign * 2.38, gapXs: [xCenter - 14, xCenter - 4, xCenter + 6, xCenter + 16], lineColor
      });

      M().addBox(g, 48, 1.25, 0.12, mat.balustradeGlass, xCenter, yViaduct + 2.3, pz + sign * 2.36, false);
      M().addBox(g, 48, 0.45, 0.24, lineAccentMat, xCenter, yViaduct + 1.0, pz + sign * 2.52, false);
      M().addBox(g, 0.14, 1.15, 4.7, mat.steelDark, xCenter - 23.8, yViaduct + 2.22, pz);
      M().addBox(g, 0.14, 1.15, 4.7, mat.steelDark, xCenter + 23.8, yViaduct + 2.22, pz);

      P().buildSteelBench(g, xCenter - 11, platTop - 0.02, pz + sign * 0.95);
      P().buildSteelBench(g, xCenter + 11, platTop - 0.02, pz + sign * 0.95);
      P().buildDualWasteBins(g, xCenter - 4, platTop - 0.02, pz + sign * 1.1);

      [-17, -9, 1, 9, 17].forEach((cx, i) => {
        commuters.push([xCenter + cx, platTop - 0.02, pz - sign * 1.2, sign > 0 ? Math.PI : 0, (i + (sign > 0 ? 3 : 1)) % 8]);
      });
    });

    P().buildCommuters(g, commuters);

    const canopy = buildDMRCVaultCanopy(g, { xCenter, yViaduct, archR: 13.1, length: 48.2 });
    const signTex = M().makeDMRCBilingualSign(hindiName, engName, subtitle, lineColorHex);
    attachFasciaSign(g, xCenter - 7.5, yViaduct + 0.55, 10.68, signTex, 0);
    attachFasciaSign(g, xCenter, yViaduct + 0.55, -10.68, signTex, Math.PI);

    const pids = P().buildSuspendedPIDS(g, {
      x: xCenter, yBoard: yViaduct + 7.6, roofY: canopy.crownY - 0.4,
      header: `${engName} · LIVE PIDS`,
      p1: 'P1: TOWARDS RAJIV CHOWK   01 MIN',
      p2: 'P2: MILLENNIUM CITY CTR   03 MIN'
    });

    parent.add(g);
    return { group: g, pids };
  }

  /* ═══════════════════════════════════════════════════════════
   * ARCHETYPE 2: ELEVATED ISLAND-PLATFORM (e.g. Botanical Garden)
   * ═══════════════════════════════════════════════════════════ */
  function buildElevatedIsland(parent, cfg) {
    const mat = M().shared();
    const {
      xCenter = 0, yViaduct = 10.5, plinthTopY = -10.0,
      hindiName = 'बोटैनिकल गार्डन', engName = 'BOTANICAL GARDEN',
      subtitle = 'BLUE & MAGENTA LINE · ELEVATED ISLAND (+14m)',
      lineColorHex = '#2563EB', secondaryHex = '#DB2777',
      lineColor = M().LINE_COLORS.blue, secondaryColor = M().LINE_COLORS.magenta
    } = cfg || {};

    const g = new THREE.Group();
    M().addBox(g, 96, 6.2, 54, mat.plinth, xCenter, plinthTopY - 3.1, 0);
    M().addBox(g, 94, 0.7, 50, mat.sageGround, xCenter, plinthTopY + 0.35, 0);

    // Split tracks (±4.8) wrapping a wide central elevated island platform!
    T().buildBoxGirderSegment(g, { x: xCenter - 33, y: yViaduct, length: 18, width: 14.0 });
    T().buildBoxGirderSegment(g, { x: xCenter + 33, y: yViaduct, length: 18, width: 14.0 });
    M().addBox(g, 48, 0.72, 16.4, mat.concreteLight, xCenter, yViaduct - 0.36, 0);
    M().addBox(g, 48, 1.45, 9.4, mat.concreteWeb, xCenter, yViaduct - 1.40, 0);
    T().buildTracksAlongAxis(g, {
      xStart: xCenter - 44, xEnd: xCenter + 44, trackZs: [-4.9, 4.9],
      lineColor, yFn: () => yViaduct, oheStart: xCenter - 44, oheXs: [xCenter - 34, xCenter + 34], oheSpanWidth: 13.6
    });

    [-32, -16, 0, 16, 32].forEach((px) => {
      T().buildDMRCViaductPier(g, { x: xCenter + px, bottomY: plinthTopY + 0.7, topDeckBottomY: yViaduct, capWidth: 12.6 });
    });

    // Under-viaduct concourse with central escalators rising into central island!
    buildGlazedConcourseBox(g, { xCenter, yViaduct, plinthTopY, concWid: 13.6, escZs: [-1.4, 1.4], withElevatorWing: false });
    P().buildElevatorShaft(g, { x: xCenter + 15, z: 0, yBottom: plinthTopY + 0.7, yTop: yViaduct + 2.0, width: 3.4, depth: 3.4, cabY: 2.5, withApron: true });

    const platTop = P().buildPlatformDeck(g, {
      x: xCenter, yCenter: yViaduct + 0.82, zCenter: 0,
      length: 46, width: 5.4, thickness: 1.65,
      edges: ['north', 'south'], centerGuide: true
    });
    P().buildPSDBank(g, { xStart: xCenter - 20, xEnd: xCenter + 20, yBase: platTop - 0.02, zPos: -2.55, gapXs: [-14, -4, 6, 16], lineColor });
    P().buildPSDBank(g, { xStart: xCenter - 20, xEnd: xCenter + 20, yBase: platTop - 0.02, zPos: 2.55, gapXs: [-14, -4, 6, 16], lineColor });

    [-14, -4, 6, 16].forEach(cx => P().buildBandedColumn(g, xCenter + cx, platTop - 0.02, 11.2, [lineColor, secondaryColor]));
    P().buildSteelBench(g, xCenter - 9, platTop - 0.02, 0);
    P().buildSteelBench(g, xCenter + 10, platTop - 0.02, 0);
    P().buildDualWasteBins(g, xCenter + 1, platTop - 0.02, 0.2);

    P().buildCommuters(g, [
      [-16, platTop - 0.02, -1.5, Math.PI, 0], [-8, platTop - 0.02, -1.6, Math.PI, 2], [4, platTop - 0.02, -1.4, Math.PI, 4],
      [-15, platTop - 0.02, 1.5, 0, 1], [3, platTop - 0.02, 1.6, 0, 5], [14, platTop - 0.02, 1.4, 0, 6]
    ]);

    const canopy = buildDMRCVaultCanopy(g, { xCenter, yViaduct, archR: 10.6, length: 46.2, blueBays: [-18, 0, 18], roofLineColor: 0x3B82C4 });
    const signTex = M().makeDMRCBilingualSign(hindiName, engName, subtitle, lineColorHex, secondaryHex);
    attachFasciaSign(g, xCenter, yViaduct + 0.55, 8.32, signTex, 0);
    attachFasciaSign(g, xCenter, yViaduct + 0.55, -8.32, signTex, Math.PI);

    const pids = P().buildSuspendedPIDS(g, {
      x: xCenter, yBoard: yViaduct + 6.8, roofY: canopy.crownY - 0.4,
      header: `${engName} · ELEVATED ISLAND`,
      p1: 'P1: DWARKA SEC 21      02 MIN',
      p2: 'P2: NOIDA ELEC CITY    01 MIN'
    });

    parent.add(g);
    return { group: g, pids };
  }

  /* ═══════════════════════════════════════════════════════════
   * ARCHETYPE 3: UNDERGROUND CUTAWAY ISLAND (e.g. Rajiv Chowk)
   * ═══════════════════════════════════════════════════════════ */
  function buildUndergroundIsland(parent, cfg) {
    const mat = M().shared();
    const {
      xCenter = -48, plinthTopY = -10.0,
      hindiName = 'राजीव चौक', engName = 'RAJIV CHOWK',
      subtitle = 'YELLOW & BLUE LINE INTERCHANGE · PLATFORM 1 & 2',
      lineColorHex = '#EAB308', secondaryHex = '#2563EB',
      lineColor = M().LINE_COLORS.yellow, secondaryColor = M().LINE_COLORS.blue,
      standalonePlinth = false
    } = cfg || {};

    const g = new THREE.Group();
    if (standalonePlinth) {
      M().addBox(g, 74, 6.2, 54, mat.plinth, xCenter + 4, plinthTopY - 3.1, -1);
      T().buildTracksAlongAxis(g, { xStart: xCenter - 26, xEnd: xCenter + 38, trackZs: [-3.6, 3.6], lineColor, withOHE: false });
    }

    M().addBox(g, 56, 9.2, 46, mat.slateDark, xCenter - 1, -5.4, -1);
    M().addBox(g, 56, 1.7, 2.2, mat.slateCut, xCenter - 1, 0.05, 14.8);
    M().addBox(g, 8.0, 17.5, 42, mat.slateDark, xCenter - 25, 7.8, -1);
    M().addBox(g, 54, 18.0, 3.6, mat.slateDark, xCenter, 8.0, -21.2);
    M().addBox(g, 56, 1.5, 16.5, mat.concreteLight, xCenter - 1, 16.2, -14.2);

    for (let sx = xCenter - 18; sx <= xCenter + 20; sx += 9.5) {
      M().addBox(g, 0.75, 0.9, 22, mat.steelDark, sx, 16.0, -3.5);
    }

    M().addBox(g, 48, 15.2, 0.45, mat.subwayTileWall, xCenter + 2, 7.6, -19.2);
    M().addBox(g, 48, 0.75, 0.52, new THREE.MeshBasicMaterial({ color: lineColor }), xCenter + 2, 8.8, -19.1, false);
    M().addBox(g, 48, 0.38, 0.52, new THREE.MeshBasicMaterial({ color: secondaryColor }), xCenter + 2, 8.0, -19.1, false);

    const signTex = M().makeDMRCBilingualSign(hindiName, engName, subtitle, lineColorHex, secondaryHex);
    const sMat = new THREE.MeshBasicMaterial({ map: signTex });
    [-10, 15].forEach((dx, idx) => {
      const lower = new THREE.Mesh(new THREE.BoxGeometry(13.0, 2.8, 0.32), sMat);
      lower.position.set(xCenter + dx, 4.6, -18.85);
      g.add(lower);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.85, 0.28), sMat);
      upper.position.set(xCenter + (idx === 0 ? -3.8 : 15.2), 9.2, -10.55);
      g.add(upper);
    });

    T().buildTBMCollars(g, { xPortal: xCenter - 22, y: 2.2, trackZs: [-3.6, 3.6], depth: 9.0 });

    // Mezzanine Concourse Balcony + AFC Turnstiles + Escalators
    M().addBox(g, 24, 0.65, 8.2, mat.concreteLight, xCenter + 2, 7.4, -14.8);
    P().buildAFCTurnstileBank(g, xCenter + 2, 7.72, -13.0, 5);
    M().addBox(g, 24, 1.0, 0.12, mat.balustradeGlass, xCenter + 2, 8.2, -10.8, false);
    [-0, 4].forEach((dx) => {
      P().buildEscalatorFlight(g, { x: xCenter + dx, y: 4.8, z: -6.2, length: 12.2, width: 1.55, rotX: 0.58 });
    });

    const platTop = P().buildPlatformDeck(g, {
      x: xCenter + 3, yCenter: 0.7, zCenter: 0,
      length: 34, width: 4.2, thickness: 1.8, edges: ['north', 'south']
    });
    P().buildPSDBank(g, { xStart: xCenter - 12, xEnd: xCenter + 18, yBase: platTop - 0.02, zPos: -2.02, gapXs: [xCenter - 6, xCenter + 4, xCenter + 14], lineColor });
    P().buildPSDBank(g, { xStart: xCenter - 12, xEnd: xCenter + 18, yBase: platTop - 0.02, zPos: 2.02, gapXs: [xCenter - 6, xCenter + 4, xCenter + 14], lineColor });

    [-9, 0, 9, 18].forEach(dx => P().buildBandedColumn(g, xCenter + dx, platTop - 0.02, 13.6, [lineColor, secondaryColor]));
    P().buildSteelBench(g, xCenter - 5, platTop - 0.02, 0);
    P().buildSteelBench(g, xCenter + 13, platTop - 0.02, 0);
    P().buildDualWasteBins(g, xCenter + 3, platTop - 0.02, 0.2);

    const pids = P().buildSuspendedPIDS(g, {
      x: xCenter + 3, yBoard: 6.1, roofY: 15.6,
      header: `${engName} · LIVE PIDS`,
      p1: 'P1: MILLENNIUM CITY  01 MIN',
      p2: 'P2: SAMAYPUR BADLI   02 MIN'
    });

    P().buildCommuters(g, [
      [xCenter - 9, platTop - 0.02, -1.3, Math.PI, 0], [xCenter - 3, platTop - 0.02, -1.4, Math.PI, 1],
      [xCenter + 3, platTop - 0.02, -1.3, Math.PI, 2], [xCenter + 11, platTop - 0.02, -1.4, Math.PI, 3],
      [xCenter - 8, platTop - 0.02, 1.3, 0, 5], [xCenter + 1, platTop - 0.02, 1.4, 0, 6],
      [xCenter + 9, platTop - 0.02, 1.3, 0, 7], [xCenter - 3, 7.72, -14.2, 0, 1], [xCenter + 6, 7.72, -14.5, Math.PI, 3]
    ]);

    [-8, 3, 14].forEach((dx) => {
      M().addBox(g, 7.5, 0.24, 0.7, mat.ledWarm, xCenter + dx, 15.2, -3.5, false);
      const light = new THREE.PointLight(0xFBBF24, 1.45, 34, 1.2);
      light.position.set(xCenter + dx, 13.6, -3.5);
      g.add(light);
      M().undergroundLights.push(light);
    });

    // Street Entrance Kiosk
    const kiosk = new THREE.Group();
    kiosk.position.set(xCenter + 2, 17.0, -14.2);
    M().addBox(kiosk, 16, 4.2, 7.2, M().stdMat(0xF8FAFC, { roughness: 0.35 }), 0, 2.1, 0);
    M().addBox(kiosk, 17.4, 0.8, 8.4, M().stdMat(0x2563EB, { roughness: 0.38 }), 0, 4.5, 0);
    M().addBox(kiosk, 10.5, 3.0, 0.22, mat.concourseGlass, 0, 1.65, 3.62, false);
    const rRing = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.26, 10, 24), M().stdMat(0xDC2626));
    rRing.position.set(0, 6.2, 3.8);
    kiosk.add(rRing);
    M().addBox(kiosk, 3.2, 0.56, 0.30, M().stdMat(0x1D4ED8), 0, 6.2, 3.8, false);
    g.add(kiosk);

    parent.add(g);
    return { group: g, pids };
  }

  /* ═══════════════════════════════════════════════════════════
   * ARCHETYPE 4: AT-GRADE 4-TRACK MULTI-BAY Y-HUB (Yamuna Bank!)
   * Ground-level embankment + 4 parallel tracks + 2 Island Platforms
   * + Overhead Foot-Over-Bridge (FOB) Concourse + Y-Turnout branch!
   * ═══════════════════════════════════════════════════════════ */
  function buildSurfaceMultiBay(parent, cfg) {
    const mat = M().shared();
    const {
      xCenter = 0, plinthTopY = -6.5,
      hindiName = 'यमुना बैंक', engName = 'YAMUNA BANK',
      subtitle = 'BLUE LINE · 4-TRACK SURFACE JUNCTION (NOIDA / VAISHALI)',
      lineColorHex = '#2563EB', lineColor = M().LINE_COLORS.blue
    } = cfg || {};

    const g = new THREE.Group();
    // Wide surface railway yard plinth + sage floodplain embankment + acoustic yard walls
    M().addBox(g, 114, 5.6, 62, mat.plinth, xCenter, plinthTopY - 2.8, 2);
    M().addBox(g, 112, 0.8, 58, mat.sageGround, xCenter, plinthTopY + 0.4, 2);
    // Crushed gravel yard apron spanning all 4 tracks
    M().addBox(g, 106, 0.35, 32, M().stdMat(0x94A3B8, { roughness: 0.95 }), xCenter, 0.0, 0);

    const trackZs = [-11.5, -4.5, 4.5, 11.5];
    T().buildTracksAlongAxis(g, {
      xStart: xCenter - 51, xEnd: xCenter + 51, trackZs,
      lineColor, yFn: () => 0.18, oheStart: xCenter - 51,
      oheXs: [xCenter - 46, xCenter - 26, xCenter + 26, xCenter + 46], oheSpanWidth: 27.6
    });

    // Diverging Y-Turnout Track splitting East toward Vaishali / Depot!
    const branch = T().buildYBranchSwitch(g, {
      xStart: xCenter + 16, xEnd: xCenter + 52, y: 0.18,
      zStart: 11.5, zEnd: 24.5, lineColor
    });

    // TWO WIDE CENTRAL ISLAND PLATFORMS serving all 4 tracks (P1/P2 & P3/P4)!
    const islandZs = [-8.0, 8.0];
    const commuters = [];
    islandZs.forEach((iz, idx) => {
      const platTop = P().buildPlatformDeck(g, {
        x: xCenter, yCenter: 0.9, zCenter: iz,
        length: 48, width: 4.4, thickness: 1.6,
        edges: ['north', 'south'], centerGuide: true
      });
      [-14, 0, 14].forEach(dx => P().buildBandedColumn(g, xCenter + dx, platTop - 0.02, 4.8, [lineColor]));
      P().buildSteelBench(g, xCenter - 9, platTop - 0.02, iz);
      P().buildSteelBench(g, xCenter + 9, platTop - 0.02, iz);
      P().buildDualWasteBins(g, xCenter + 3, platTop - 0.02, iz + 0.3);

      // Sleek individual pitched DMRC platform shelter roof over each island
      M().addBox(g, 44, 0.24, 5.4, mat.dmrcBlueRoof, xCenter, platTop + 4.8, iz);
      M().addBox(g, 44, 0.18, 2.2, mat.skylightGlass, xCenter, platTop + 4.92, iz);

      [-16, -7, 5, 16].forEach((dx, ci) => {
        commuters.push([xCenter + dx, platTop - 0.02, iz - 1.2, Math.PI, (ci + idx * 2) % 8]);
        commuters.push([xCenter + dx + 2, platTop - 0.02, iz + 1.2, 0, (ci + idx * 3 + 1) % 8]);
      });
    });

    // OVERHEAD FOOT-OVER-BRIDGE (FOB) CONCOURSE SPANNING ABOVE ALL 4 TRACKS (Y = +7.4)!
    const fobY = 7.4;
    M().addBox(g, 17.6, 0.7, 36.2, mat.concreteLight, xCenter - 1, fobY, 0);
    // Open glazed atrium skylight roof so turnstiles & escalator flights remain legible
    M().addBox(g, 13.8, 0.16, 34.4, mat.skylightGlass, xCenter - 1, fobY + 4.25, 0, false);
    [-9.5, 7.5].forEach((fx) => {
      M().addBox(g, 0.9, 0.48, 36.4, mat.dmrcBlueRoof, xCenter + fx, fobY + 4.2, 0);
      M().addBox(g, 0.16, 3.6, 35.6, mat.concourseGlass, xCenter + fx, fobY + 2.1, 0, false);
      for (let fz = -16; fz <= 16; fz += 8) {
        M().addBox(g, 0.24, 3.9, 0.24, mat.steelDark, xCenter + fx, fobY + 2.15, fz);
      }
    });
    [-17.8, 17.8].forEach((fz) => M().addBox(g, 17.6, 0.48, 0.9, mat.steelDark, xCenter - 1, fobY + 4.2, fz));
    P().buildAFCTurnstileBank(g, xCenter - 3, fobY + 0.36, 0, 6, Math.PI / 2);

    // 4 Escalator/Stair flights descending from FOB Concourse onto BOTH Island Platforms!
    islandZs.forEach((iz) => {
      P().buildEscalatorFlight(g, { x: xCenter + 8.5, y: 4.5, z: iz - 0.8, length: 8.8, width: 1.5, rotZ: 0.72 });
    });

    // External Ground Entry Stair/Lift Wing on South Side
    P().buildElevatorShaft(g, { x: xCenter - 1, z: 18.0, yBottom: 0.18, yTop: fobY + 4.0, width: 4.2, depth: 4.2, cabY: 4.2, withApron: true });
    P().buildStreetTotem(g, xCenter - 14, 0.18, 21.0);
    P().buildCommuters(g, commuters);

    const signTex = M().makeDMRCBilingualSign(hindiName, engName, subtitle, lineColorHex);
    attachFasciaSign(g, xCenter - 1, fobY + 2.2, 18.2, signTex, 0);
    attachFasciaSign(g, xCenter - 1, fobY + 2.2, -18.2, signTex, Math.PI);

    const pids = P().buildSuspendedPIDS(g, {
      x: xCenter + 8, yBoard: 5.1, z: -8.0, roofY: 6.5,
      header: `${engName} · 4-TRACK HUB`,
      p1: 'P1/P2: NOIDA ELEC CITY (01 MIN)',
      p2: 'P3/P4: VAISHALI BRANCH (02 MIN)'
    });

    parent.add(g);
    return { group: g, pids, branchCurve: branch.curve };
  }

  /* ═══════════════════════════════════════════════════════════
   * ARCHETYPE 5: CROSS-STACKED UNDERGROUND INTERCHANGE (Hauz Khas!)
   * Upper -10m (East-West X) + Lower -19m (North-South Z) at 90°
   * ═══════════════════════════════════════════════════════════ */
  function buildStackedCrossInterchange(parent, cfg) {
    const mat = M().shared();
    const {
      xCenter = 0, plinthTopY = -22.0,
      hindiName = 'हौज़ ख़ास', engName = 'HAUZ KHAS',
      subtitle = 'YELLOW (-12m) × MAGENTA (-21m) CROSS INTERCHANGE',
      lineColorHex = '#EAB308', secondaryHex = '#DB2777',
      upperColor = M().LINE_COLORS.yellow, lowerColor = M().LINE_COLORS.magenta
    } = cfg || {};

    const g = new THREE.Group();
    // Deep square geological cross-section cutaway plinth revealing BOTH stacked underground levels!
    M().addBox(g, 86, 5.2, 86, mat.plinth, xCenter, plinthTopY - 2.6, 0);
    M().addBox(g, 82, 8.2, 82, mat.slateDark, xCenter, -16.8, 0);
    M().addBox(g, 82, 10.0, 2.2, mat.slateCut, xCenter, -6.5, 36.0);
    M().addBox(g, 82, 22.0, 3.4, mat.slateDark, xCenter, -1.0, -37.0);
    M().addBox(g, 3.4, 22.0, 82, mat.slateDark, xCenter - 37.0, -1.0, 0);

    // ── UPPER LEVEL (-4m): Yellow Line running East–West (X) ──
    const upperY = -2.0;
    T().buildTracksAlongAxis(g, { xStart: xCenter - 36, xEnd: xCenter + 36, trackZs: [-3.6, 3.6], lineColor: upperColor, yFn: () => upperY, withOHE: false });
    T().buildTBMCollars(g, { xPortal: xCenter - 35, y: upperY + 2.2, trackZs: [-3.6, 3.6], depth: 8.5 });
    const upTop = P().buildPlatformDeck(g, { x: xCenter, yCenter: upperY + 0.7, zCenter: 0, length: 40, width: 4.2, thickness: 1.6, edges: ['north', 'south'] });
    P().buildPSDBank(g, { xStart: xCenter - 17, xEnd: xCenter + 17, yBase: upTop - 0.02, zPos: -2.02, gapXs: [-10, 0, 10], lineColor: upperColor });
    P().buildPSDBank(g, { xStart: xCenter - 17, xEnd: xCenter + 17, yBase: upTop - 0.02, zPos: 2.02, gapXs: [-10, 0, 10], lineColor: upperColor });

    // ── LOWER LEVEL (-12m): Magenta Line running North–South (Z) ──
    const lowerY = -11.5;
    T().buildTracksAlongAxis(g, { xStart: -35.5, xEnd: 35.5, trackZs: [-3.6, 3.6], lineColor: lowerColor, yFn: () => lowerY, withOHE: false, rotY: Math.PI / 2, originX: xCenter });
    T().buildTBMCollars(g, { xPortal: -33.2, y: lowerY + 2.2, trackZs: [-3.6, 3.6], depth: 8.5, rotY: Math.PI / 2, originX: xCenter });
    const lowPlat = new THREE.Group();
    lowPlat.rotation.y = Math.PI / 2;
    lowPlat.position.x = xCenter;
    const lowTop = P().buildPlatformDeck(lowPlat, { x: 0, yCenter: lowerY + 0.7, zCenter: 0, length: 40, width: 4.2, thickness: 1.6, edges: ['north', 'south'] });
    P().buildPSDBank(lowPlat, { xStart: -17, xEnd: 17, yBase: lowTop - 0.02, zPos: -2.02, gapXs: [-10, 0, 10], lineColor: lowerColor });
    P().buildPSDBank(lowPlat, { xStart: -17, xEnd: 17, yBase: lowTop - 0.02, zPos: 2.02, gapXs: [-10, 0, 10], lineColor: lowerColor });
    g.add(lowPlat);

    // ── CENTRAL VERTICAL INTERCHANGE TRANSFER ESCALATOR & ELEVATOR CORE ──
    P().buildElevatorShaft(g, { x: xCenter + 7.5, z: -7.5, yBottom: lowerY + 1.5, yTop: 10.5, width: 4.0, depth: 4.0, cabY: -4.0, withApron: false });
    P().buildEscalatorFlight(g, { x: xCenter - 4.0, y: -5.5, z: -5.5, length: 13.5, width: 1.8, rotX: 0.65 });
    // Anchor upper concourse mezzanine with full-height concrete columns + frosted edge + connecting escalator
    M().addBox(g, 38, 1.2, 22, mat.concreteLight, xCenter, 8.8, -22);
    M().addBox(g, 38, 1.1, 0.16, mat.glassBarrier, xCenter, 9.95, -11.1, false);
    [-17.5, 17.5].forEach((px) => {
      M().addBox(g, 1.5, 22.8, 1.5, mat.concreteLight, xCenter + px, -2.0, -12.0);
      M().addBox(g, 1.5, 22.8, 1.5, mat.concreteLight, xCenter + px, -2.0, -31.0);
    });
    P().buildEscalatorFlight(g, { x: xCenter - 11.5, y: 4.2, z: -9.5, length: 12.2, width: 1.75, rotX: 0.72 });
    P().buildAFCTurnstileBank(g, xCenter, 9.45, -16, 6);

    const signTex = M().makeDMRCBilingualSign(hindiName, engName, subtitle, lineColorHex, secondaryHex);
    const sMesh = new THREE.Mesh(new THREE.BoxGeometry(18.0, 3.2, 0.32), new THREE.MeshBasicMaterial({ map: signTex }));
    sMesh.position.set(xCenter, 5.2, -34.8);
    g.add(sMesh);

    const uLight = new THREE.PointLight(0xFBBF24, 1.4, 48, 1.1);
    uLight.position.set(xCenter, 4.0, 0);
    g.add(uLight);
    M().undergroundLights.push(uLight);

    const lLight = new THREE.PointLight(0xF472B6, 1.3, 42, 1.1);
    lLight.position.set(xCenter, -6.5, 0);
    g.add(lLight);
    M().undergroundLights.push(lLight);

    const pids = P().buildSuspendedPIDS(g, {
      x: xCenter, yBoard: 4.2, roofY: 8.8,
      header: `${engName} · CROSS INTERCHANGE`,
      p1: 'UPPER (-12m): YELLOW LINE (01 MIN)',
      p2: 'LOWER (-21m): MAGENTA LINE (02 MIN)'
    });

    parent.add(g);
    return { group: g, pids, upperY, lowerY };
  }

  /* ═══════════════════════════════════════════════════════════
   * ARCHETYPE 6: HYBRID MEGA INTERCHANGE HUB (Kashmere Gate!)
   * Elevated Red Line (+14m) stacked atop Underground Yellow (-12m)
   * ═══════════════════════════════════════════════════════════ */
  function buildHybridMegaHub(parent, cfg) {
    const mat = M().shared();
    const {
      xCenter = 0, plinthTopY = -10.0, yViaduct = 12.5,
      hindiName = 'कश्मीरी गेट', engName = 'KASHMERE GATE',
      subtitle = 'RED (ELEVATED +14m) × YELLOW / VIOLET (UNDERGROUND -12m)',
      elevColor = M().LINE_COLORS.red, ugColor = M().LINE_COLORS.yellow
    } = cfg || {};

    const g = new THREE.Group();
    M().addBox(g, 98, 6.2, 58, mat.plinth, xCenter, plinthTopY - 3.1, -1);

    // ── BOTTOM TIER (-12m): Underground Cutaway Yellow Line Chamber ──
    M().addBox(g, 70, 9.2, 48, mat.slateDark, xCenter, -5.4, -1);
    M().addBox(g, 70, 1.6, 2.2, mat.slateCut, xCenter, 0.05, 16.5);
    M().addBox(g, 68, 12.5, 3.2, mat.slateDark, xCenter, 5.2, -21.5);
    M().addBox(g, 2.8, 10.6, 22.0, mat.slateDark, xCenter - 34.4, 1.6, -2.0);
    T().buildTracksAlongAxis(g, { xStart: xCenter - 44, xEnd: xCenter + 44, trackZs: [-3.6, 3.6], lineColor: ugColor, yFn: () => 0, withOHE: false });
    T().buildTBMCollars(g, { xPortal: xCenter - 33.8, y: 2.2, trackZs: [-3.6, 3.6], depth: 8.5 });

    const ugTop = P().buildPlatformDeck(g, { x: xCenter, yCenter: 0.7, zCenter: 0, length: 40, width: 4.2, thickness: 1.6, edges: ['north', 'south'] });
    P().buildPSDBank(g, { xStart: xCenter - 17, xEnd: xCenter + 17, yBase: ugTop - 0.02, zPos: -2.02, gapXs: [-10, 0, 10], lineColor: ugColor });
    P().buildPSDBank(g, { xStart: xCenter - 17, xEnd: xCenter + 17, yBase: ugTop - 0.02, zPos: 2.02, gapXs: [-10, 0, 10], lineColor: ugColor });

    // ── TOP TIER (+14m): Elevated Red Line Viaduct & Side Platforms ──
    T().buildBoxGirderSegment(g, { x: xCenter - 34, y: yViaduct, length: 18, width: 11.8 });
    T().buildBoxGirderSegment(g, { x: xCenter + 34, y: yViaduct, length: 18, width: 11.8 });
    M().addBox(g, 48, 0.72, 11.4, mat.concreteLight, xCenter, yViaduct - 0.36, 0);
    M().addBox(g, 48, 1.45, 7.6, mat.concreteWeb, xCenter, yViaduct - 1.40, 0);
    T().buildTracksAlongAxis(g, { xStart: xCenter - 45, xEnd: xCenter + 45, trackZs: [-3.6, 3.6], lineColor: elevColor, yFn: () => yViaduct, oheStart: xCenter - 45, oheXs: [xCenter - 34, xCenter + 34] });

    [-28, 28].forEach(px => T().buildDMRCViaductPier(g, { x: xCenter + px, bottomY: 0.0, topDeckBottomY: yViaduct }));

    [-8.0, 8.0].forEach((pz) => {
      const sign = Math.sign(pz);
      const topY = P().buildPlatformDeck(g, {
        x: xCenter, yCenter: yViaduct + 0.82, zCenter: pz,
        length: 46, width: 4.8, thickness: 1.65, edges: [sign < 0 ? 'south' : 'north']
      });
      P().buildSteelBench(g, xCenter - 10, topY - 0.02, pz + sign * 0.9);
      P().buildSteelBench(g, xCenter + 10, topY - 0.02, pz + sign * 0.9);
    });

    buildDMRCVaultCanopy(g, { xCenter, yViaduct, archR: 13.0, length: 46.2, roofLineColor: 0xDC2626 });

    // ── FULL-HEIGHT 3-TIER TRANSFER LIFT & ESCALATOR ATRIUM (-12m -> Concourse -> +14m) ──
    P().buildElevatorShaft(g, { x: xCenter + 18, z: 9.8, yBottom: 0.0, yTop: yViaduct + 2.0, width: 4.5, depth: 4.5, cabY: 7.5, withApron: false, porticoColor: 0xDC2626 });
    P().buildEscalatorFlight(g, { x: xCenter - 10, y: 6.4, z: -7.5, length: 14.5, width: 1.75, rotZ: 0.68 });
    P().buildAFCTurnstileBank(g, xCenter, 6.4, -15.5, 6);

    const signTex = M().makeDMRCBilingualSign(hindiName, engName, subtitle, '#DC2626', '#EAB308');
    attachFasciaSign(g, xCenter - 5, yViaduct + 0.55, 10.65, signTex, 0);
    attachFasciaSign(g, xCenter, yViaduct + 0.55, -10.65, signTex, Math.PI);

    const uLight = new THREE.PointLight(0xFBBF24, 1.5, 38, 1.1);
    uLight.position.set(xCenter, 6.2, -3);
    g.add(uLight);
    M().undergroundLights.push(uLight);

    const pids = P().buildSuspendedPIDS(g, {
      x: xCenter, yBoard: yViaduct + 7.2, roofY: yViaduct + 13.5,
      header: `${engName} · TRIPLE HUB`,
      p1: 'UPPER (+14m): RED LINE  01 MIN',
      p2: 'LOWER (-12m): YELLOW/VIOLET 02M'
    });

    parent.add(g);
    return { group: g, pids };
  }

  return {
    buildDMRCVaultCanopy,
    buildGlazedConcourseBox,
    attachFasciaSign,
    buildElevatedSide,
    buildElevatedIsland,
    buildUndergroundIsland,
    buildSurfaceMultiBay,
    buildStackedCrossInterchange,
    buildHybridMegaHub
  };
})();

