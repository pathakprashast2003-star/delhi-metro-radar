/* ============================================================
 * DELHI METRO KIT-OF-PARTS — High-Fidelity City Station Modules
 * Brings full Studio Diorama craft (ceramic tiled chamber walls,
 * ribbed TBM tunnel collars, PSD glass doors, live amber PIDS,
 * escalators, commuters, skylights, glass elevators & plaza
 * trees) across all 37 Yellow Line stations on the Delhi 3D Map.
 * ============================================================ */

window.MetroKit = window.MetroKit || {};

window.MetroKit.CityNodes = (function () {
  'use strict';

  function M() { return window.MetroKit.Materials; }

  const UNDERGROUND_SIDE_IDS = new Set([
    'gtb_nagar',
    'vishwavidyalaya',
    'vidhan_sabha',
    'civil_lines',
    'central_secretariat'
  ]);
  const RIDGE_HERITAGE_IDS = new Set([
    'qutab_minar',
    'chhatarpur',
    'sultanpur',
    'ghitorni',
    'arjan_garh'
  ]);
  const GURUGRAM_CYBER_IDS = new Set([
    'guru_dronacharya',
    'sikanderpur',
    'mg_road',
    'iffco_chowk',
    'millennium_city_centre'
  ]);

  function resolveArchetype(st) {
    const id = (st.id || '').toLowerCase();
    const isUg = st.structure === 'underground';
    if (id === 'kashmere_gate') return 'hybridMegaHub';
    if (isUg) {
      if (UNDERGROUND_SIDE_IDS.has(id)) return 'undergroundSide';
      if (id === 'hauz_khas' || (st.major && (st.interchange || (st.interchanges && st.interchanges.length > 0)))) {
        return 'stackedCrossInterchange';
      }
      return 'undergroundIsland';
    }
    // Real DMRC Yellow Line audit: ONLY Haiderpur Badli Mor (#3) is an elevated island station!
    if (id === 'haiderpur_badli_mor') {
      return 'elevatedIsland';
    }
    return 'elevatedSide';
  }

  function projectToPlinth(lon, lat) {
    const originLon = 77.2195;
    const originLat = 28.6328;
    const cosLat = Math.cos((originLat * Math.PI) / 180);
    return [
      (lon - originLon) * 111.32 * cosLat * 10,
      -(lat - originLat) * 110.85 * 10
    ];
  }

  let _res = null;
  function getShared() {
    if (_res) return _res;
    const tileTex = M().makeGridTileTexture('#F5F2EB', '#DDD6C7', 6, 6, 4, 2);
    const pidsObj = M().makePIDSTexture('YELLOW LINE · LIVE PIDS', 'P1: MILLENNIUM CITY  01 MIN', 'P2: SAMAYPUR BADLI   02 MIN');

    const mat = M().shared();
    const m = {
      ...mat,
      glassBarrier: mat.balustradeGlass,
      concretePlat: mat.terrazzoDeck,
      pierCream: mat.concreteLight,
      benchTop: mat.steelChrome,
      tileWall: new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.72 }),
      pidsScreen: new THREE.MeshBasicMaterial({ map: pidsObj.texture }),
      roundelRed: new THREE.MeshBasicMaterial({ color: 0xDC2626 }),
      roundelWhite: new THREE.MeshBasicMaterial({ color: 0xFFFFFF }),
      escalatorStep: M().stdMat(0x2A3646, { metalness: 0.45 }),
      escalatorGlass: new THREE.MeshPhysicalMaterial({ color: 0x99F6E4, roughness: 0.14, transparent: true, opacity: 0.56, side: THREE.DoubleSide }),
      redRoof: new THREE.MeshStandardMaterial({ color: 0xDC2626, roughness: 0.34, transparent: true, opacity: 0.86, side: THREE.DoubleSide }),
      glassSky: new THREE.MeshPhysicalMaterial({ color: 0xBAE6FD, roughness: 0.14, transparent: true, opacity: 0.44, side: THREE.DoubleSide }),
      boreDark: new THREE.MeshBasicMaterial({ color: 0x060A12 }),
      trunk: M().stdMat(0x8D6E63, { roughness: 0.9 }),
      leaf: M().stdMat(0x6FAF6D, { roughness: 0.8 }),
      plazaPave: M().stdMat(0xE8D8C3, { roughness: 0.92 }),
      brickRed: M().stdMat(0xB45339, { roughness: 0.72 }),
      lutyensCream: M().stdMat(0xF3EAD8, { roughness: 0.64 }),
      terracotta: M().stdMat(0xC2410C, { roughness: 0.68 }),
      cyberTeal: M().stdMat(0x0D9488, { roughness: 0.34, metalness: 0.28 }),
      bufferRed: M().stdMat(0xDC2626, { roughness: 0.36 }),
      magentaRoof: new THREE.MeshStandardMaterial({ color: 0xDB2777, roughness: 0.36, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
      emeraldRapid: new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.36, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
      amberPortal: M().stdMat(0xF59E0B, { roughness: 0.42 }),
      marbleDome: M().stdMat(0xFAF7F2, { roughness: 0.35 }),
      commuterShirts: COM_COLORS.map(c => M().stdMat(c, { roughness: 0.72 }))
    };

    const g = {
      // Underground chamber (Island + Side)
      ugFloor: new THREE.BoxGeometry(4.8, 0.06, 1.35),
      ugSideFloor: new THREE.BoxGeometry(4.8, 0.06, 2.08),
      ugRearRetain: new THREE.BoxGeometry(5.1, 1.45, 0.24),
      ugTileBacking: new THREE.BoxGeometry(4.65, 1.05, 0.04),
      ugTileFrieze: new THREE.BoxGeometry(4.65, 0.09, 0.06),
      ugFrontCurb: new THREE.BoxGeometry(5.1, 0.38, 0.16),
      ugFrontRailing: new THREE.BoxGeometry(4.95, 0.08, 0.18),
      ugDeckIsland: new THREE.BoxGeometry(4.35, 0.24, 0.38),
      ugSidePlat: new THREE.BoxGeometry(4.35, 0.24, 0.42),
      ugMedian: new THREE.BoxGeometry(4.30, 0.08, 0.10),
      ugTactile: new THREE.BoxGeometry(4.2, 0.04, 0.06),
      ugTopDeckRoof: new THREE.BoxGeometry(5.1, 0.22, 0.88),
      ugRoofBeam: new THREE.BoxGeometry(0.10, 0.12, 1.48),
      ugSideRoofBeam: new THREE.BoxGeometry(0.10, 0.12, 2.15),
      ugSkyBridge: new THREE.BoxGeometry(0.66, 0.08, 1.56),
      ugSkyRail: new THREE.BoxGeometry(0.05, 0.18, 1.56),
      tbmArch: new THREE.CylinderGeometry(0.28, 0.28, 0.55, 14, 1, false, 0, Math.PI),
      tbmRib: new THREE.TorusGeometry(0.285, 0.025, 6, 14, Math.PI),
      tbmBore: new THREE.CylinderGeometry(0.21, 0.21, 0.58, 12),
      psdPanel: new THREE.BoxGeometry(0.32, 0.26, 0.03),
      psdFrame: new THREE.BoxGeometry(3.8, 0.04, 0.04),
      psdPost: new THREE.BoxGeometry(0.035, 0.28, 0.04),
      pidsBoard: new THREE.BoxGeometry(0.95, 0.22, 0.05),
      benchSeat: new THREE.BoxGeometry(0.32, 0.05, 0.10),
      escRamp: new THREE.BoxGeometry(0.95, 0.10, 0.18),
      kioskGlass: new THREE.BoxGeometry(1.15, 0.44, 0.72),
      kioskRoof: new THREE.BoxGeometry(1.32, 0.09, 0.86),
      kioskRoundel: new THREE.TorusGeometry(0.11, 0.028, 8, 18),
      rotundaCyl: new THREE.CylinderGeometry(0.36, 0.38, 0.46, 14),
      rotundaCap: new THREE.CylinderGeometry(0.42, 0.42, 0.09, 14),
      chhatriDome: new THREE.SphereGeometry(0.20, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      expressShaft: new THREE.CylinderGeometry(0.22, 0.24, 1.68, 14),
      skylightPyr: new THREE.ConeGeometry(0.56, 0.52, 4),
      fobDeck: new THREE.BoxGeometry(0.75, 0.10, 2.5),
      // Elevated chamber
      elDeck: new THREE.BoxGeometry(4.8, 0.24, 1.98),
      elWeb: new THREE.BoxGeometry(4.8, 0.26, 0.85),
      elSidePlat: new THREE.BoxGeometry(4.65, 0.26, 0.46),
      elIslandPlat: new THREE.BoxGeometry(4.65, 0.26, 0.40),
      elConcourse: new THREE.BoxGeometry(3.55, 0.62, 1.38),
      elConcourseSlab: new THREE.BoxGeometry(3.75, 0.12, 1.52),
      elMullion: new THREE.BoxGeometry(0.045, 0.62, 0.045),
      elAfcGate: new THREE.BoxGeometry(0.06, 0.18, 0.18),
      elPier: new THREE.CylinderGeometry(0.16, 0.21, 1.85, 10),
      elPierCap: new THREE.BoxGeometry(0.55, 0.20, 1.35),
      elLiftGlass: new THREE.BoxGeometry(0.42, 2.75, 0.42),
      elLiftCab: new THREE.BoxGeometry(0.30, 0.36, 0.30),
      elLiftCanopy: new THREE.BoxGeometry(0.68, 0.09, 0.68),
      elArchSeg: new THREE.CylinderGeometry(1.06, 1.06, 0.98, 14, 1, true, 0.30, Math.PI - 0.60),
      elGlassBay: new THREE.CylinderGeometry(1.04, 1.04, 0.82, 14, 1, true, 0.30, Math.PI - 0.60),
      elArchRib: new THREE.TorusGeometry(1.07, 0.036, 6, 16, Math.PI - 0.56),
      elCanopyCol: new THREE.BoxGeometry(0.055, 0.72, 0.055),
      terminusBuffer: new THREE.BoxGeometry(0.12, 0.28, 0.84),
      depotRoof: new THREE.BoxGeometry(1.45, 0.18, 0.92),
      cyberFin: new THREE.BoxGeometry(0.10, 0.82, 0.32),
      ridgeTrim: new THREE.BoxGeometry(4.84, 0.14, 0.12),
      // Plaza, trees & commuters
      plazaPad: new THREE.BoxGeometry(5.8, 0.05, 3.2),
      plazaApronRear: new THREE.BoxGeometry(5.8, 0.05, 1.15),
      fascia: new THREE.BoxGeometry(2.65, 0.30, 0.06),
      commBody: new THREE.CylinderGeometry(0.038, 0.042, 0.14, 6),
      commHead: new THREE.SphereGeometry(0.034, 6, 6),
      treeTrunk: new THREE.CylinderGeometry(0.035, 0.045, 0.36, 5),
      treeCrown: new THREE.DodecahedronGeometry(0.22, 0),
      // Interchanges & hit
      crossDeck: new THREE.BoxGeometry(1.45, 0.22, 4.6),
      crossCanopy: new THREE.CylinderGeometry(0.82, 0.82, 3.2, 12, 1, true, 0.32, Math.PI - 0.64),
      crossTower: new THREE.BoxGeometry(0.48, 2.8, 0.48),
      halo: new THREE.RingGeometry(1.55, 1.92, 28)
    };
    _res = { m, g };
    return _res;
  }

  const COM_COLORS = [0x2563EB, 0xEC4899, 0x059669, 0xF59E0B, 0xDC2626, 0x6366F1];

  function addCommuters(parent, geo, mat, spots) {
    spots.forEach(([x, y, z, colorIdx]) => {
      const shirt = new THREE.Mesh(geo.commBody, mat.commuterShirts[colorIdx % COM_COLORS.length]);
      shirt.position.set(x, y + 0.07, z);
      const head = new THREE.Mesh(geo.commHead, mat.concretePlat);
      head.position.set(x, y + 0.16, z);
      parent.add(shirt, head);
    });
  }

  function addTree(parent, res, x, y, z) {
    const tr = new THREE.Mesh(res.g.treeTrunk, res.m.trunk);
    tr.position.set(x, y + 0.18, z);
    tr.castShadow = true;
    const lf = new THREE.Mesh(res.g.treeCrown, res.m.leaf);
    lf.position.set(x, y + 0.48, z);
    lf.castShadow = true;
    parent.add(tr, lf);
  }

  function makeMiniSignTexture(name, secondaryColorHex) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 44;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, 256, 44);
    ctx.fillStyle = '#EAB308';
    ctx.fillRect(0, 0, 256, 5);
    if (secondaryColorHex) {
      ctx.fillStyle = secondaryColorHex;
      ctx.fillRect(0, 39, 256, 5);
    }
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(20, 22, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(9, 20, 22, 4);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px -apple-system, Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const shortName = name.length > 20 ? name.slice(0, 19) + '…' : name;
    ctx.fillText(shortName.toUpperCase(), 38, 22);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  function pickSecondaryLineColor(st) {
    const raw = (st.interchange || (st.interchanges && st.interchanges.join(' ')) || '').toLowerCase();
    if (raw.includes('magenta')) return M().LINE_COLORS.magenta;
    if (raw.includes('blue')) return M().LINE_COLORS.blue;
    if (raw.includes('red')) return M().LINE_COLORS.red;
    if (raw.includes('violet')) return 0x7C3AED;
    if (raw.includes('pink')) return 0xEC4899;
    if (raw.includes('airport')) return 0xF97316;
    if (raw.includes('rapid')) return 0x059669;
    return null;
  }

  function addElevatedCanopy(parent, res, yBase, roofMat) {
    const { g, m } = res;
    [-1.42, 0, 1.42].forEach((bx) => {
      const bar = new THREE.Mesh(g.elArchSeg, roofMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(bx, yBase + 0.56, 0);
      bar.castShadow = true;
      parent.add(bar);
    });
    [-0.71, 0.71].forEach((bx) => {
      const bay = new THREE.Mesh(g.elGlassBay, m.glassSky);
      bay.rotation.z = Math.PI / 2;
      bay.position.set(bx, yBase + 0.56, 0);
      parent.add(bay);
    });
    [-1.92, -0.96, 0, 0.96, 1.92].forEach((rx) => {
      const rib = new THREE.Mesh(g.elArchRib, m.steelDark);
      rib.rotation.y = Math.PI / 2;
      rib.rotation.z = 0.28;
      rib.position.set(rx, yBase + 0.56, 0);
      parent.add(rib);
      [-0.95, 0.95].forEach((cz) => {
        const col = new THREE.Mesh(g.elCanopyCol, m.steelDark);
        col.position.set(rx, yBase + 0.36, cz);
        parent.add(col);
      });
    });
  }

  function addTBMCollarsBothEnds(parent, res, yCenter, trackZs) {
    const { g, m } = res;
    [-2.20, 2.20].forEach((xEnd) => {
      trackZs.forEach((tz) => {
        const arch = new THREE.Mesh(g.tbmArch, m.concreteLight);
        arch.rotation.z = Math.PI / 2;
        arch.position.set(xEnd, yCenter, tz);
        arch.castShadow = true;
        parent.add(arch);

        const bore = new THREE.Mesh(g.tbmBore, m.boreDark);
        bore.rotation.z = Math.PI / 2;
        bore.position.set(xEnd, yCenter + 0.04, tz);
        parent.add(bore);

        [-0.18, 0.18].forEach((dr) => {
          const rib = new THREE.Mesh(g.tbmRib, m.steelDark);
          rib.rotation.y = Math.PI / 2;
          rib.position.set(xEnd + dr, yCenter, tz);
          parent.add(rib);
        });
      });
    });
  }

  function addElevatedSignatureDetail(parent, res, id, viaductY) {
    const { g, m } = res;
    if (id === 'samaypur_badli' || id === 'millennium_city_centre') {
      [-2.35, 2.35].forEach((bx) => {
        const portalBar = new THREE.Mesh(g.ridgeTrim, m.bufferRed);
        portalBar.scale.set(0.035, 1.2, 16.5);
        portalBar.position.set(bx, viaductY + 0.58, 0);
        parent.add(portalBar);
      });
    }
    if (id === 'samaypur_badli') {
      [-1.4, 1.4].forEach((dx) => {
        const bay = new THREE.Mesh(g.depotRoof, m.steelChrome);
        bay.position.set(dx, 0.48, -1.35);
        bay.castShadow = true;
        parent.add(bay);
      });
    } else if (id === 'millennium_city_centre') {
      [-1.6, 0, 1.6].forEach((fx) => {
        const fin = new THREE.Mesh(g.cyberFin, m.cyberTeal);
        fin.position.set(fx, viaductY + 0.52, 0.98);
        const finB = fin.clone();
        finB.position.z = -0.98;
        parent.add(fin, finB);
      });
    } else if (id === 'haiderpur_badli_mor') {
      const mDeck = new THREE.Mesh(g.crossDeck, m.concreteLight);
      mDeck.position.y = viaductY + 2.04;
      mDeck.castShadow = true;
      const mCanopy = new THREE.Mesh(g.crossCanopy, m.magentaRoof);
      mCanopy.rotation.set(0, Math.PI / 2, Math.PI / 2);
      mCanopy.position.y = viaductY + 2.15;
      [-2.08, 2.08].forEach((pz) => {
        const leg = new THREE.Mesh(g.crossTower, m.pierCream);
        leg.scale.set(0.75, 1.68, 0.75);
        leg.position.set(0, viaductY * 0.5 + 0.96, pz);
        parent.add(leg);
      });
      parent.add(mDeck, mCanopy);
    } else if (id === 'azadpur') {
      const pRib = new THREE.Mesh(g.elDeck, m.magentaRoof);
      pRib.scale.set(0.28, 0.4, 2.25);
      pRib.position.y = viaductY - 0.65;
      parent.add(pRib);
    } else if (id === 'model_town') {
      const gantry = new THREE.Mesh(g.ridgeTrim, m.amberPortal);
      gantry.scale.set(0.04, 1.4, 16.5);
      gantry.position.set(2.2, viaductY + 0.58, 0);
      parent.add(gantry);
    } else if (RIDGE_HERITAGE_IDS.has(id)) {
      [-1.02, 1.02].forEach((rz) => {
        const trim = new THREE.Mesh(g.ridgeTrim, m.brickRed);
        trim.position.set(0, viaductY + 0.04, rz);
        parent.add(trim);
      });
      if (id === 'qutab_minar') {
        const pav = new THREE.Mesh(g.kioskGlass, m.brickRed);
        pav.position.set(-1.35, 0.42, 1.05);
        const pavDome = new THREE.Mesh(g.chhatriDome, m.lutyensCream);
        pavDome.position.set(-1.35, 0.68, 1.05);
        parent.add(pav, pavDome);
      }
    } else if (GURUGRAM_CYBER_IDS.has(id)) {
      [-1.3, 0, 1.3].forEach((fx) => {
        const fin = new THREE.Mesh(g.cyberFin, m.cyberTeal);
        fin.position.set(fx, viaductY + 0.48, 0.96);
        parent.add(fin);
      });
      if (id === 'sikanderpur') {
        const rDeck = new THREE.Mesh(g.crossDeck, m.emeraldRapid);
        rDeck.scale.set(0.75, 0.9, 1.0);
        rDeck.position.y = viaductY - 0.85;
        parent.add(rDeck);
      }
    }
  }

  function addUndergroundSignatureDetail(parent, res, id, subwayY, roofZ) {
    const { g, m } = res;
    if (id === 'vishwavidyalaya') {
      const brickHall = new THREE.Mesh(g.kioskGlass, m.brickRed);
      brickHall.scale.set(1.05, 1.15, 0.9);
      brickHall.position.set(-0.95, subwayY + 1.66, roofZ);
      const trim = new THREE.Mesh(g.kioskRoof, m.lutyensCream);
      trim.scale.set(1.05, 0.85, 0.9);
      trim.position.set(-0.95, subwayY + 1.94, roofZ);
      parent.add(brickHall, trim);
    } else if (id === 'vidhan_sabha') {
      const colHall = new THREE.Mesh(g.kioskGlass, m.lutyensCream);
      colHall.scale.set(1.25, 0.95, 0.85);
      colHall.position.set(-0.90, subwayY + 1.60, roofZ);
      const colRoof = new THREE.Mesh(g.kioskRoof, m.lutyensCream);
      colRoof.scale.set(1.28, 1.1, 0.9);
      colRoof.position.set(-0.90, subwayY + 1.88, roofZ);
      parent.add(colHall, colRoof);
    } else if (id === 'chandni_chowk') {
      const mughalPav = new THREE.Mesh(g.kioskGlass, m.brickRed);
      mughalPav.position.set(-0.95, subwayY + 1.64, roofZ);
      [-1.30, -0.60].forEach((dx) => {
        const dome = new THREE.Mesh(g.chhatriDome, m.marbleDome);
        dome.position.set(dx, subwayY + 1.90, roofZ);
        parent.add(dome);
      });
      parent.add(mughalPav);
    } else if (id === 'chawri_bazar') {
      [-1.55, 1.65].forEach((sx) => {
        const shaft = new THREE.Mesh(g.expressShaft, m.steelChrome);
        shaft.position.set(sx, subwayY + 0.92, roofZ + 0.08);
        shaft.castShadow = true;
        parent.add(shaft);
      });
    } else if (id === 'new_delhi') {
      const fob = new THREE.Mesh(g.fobDeck, m.cyberTeal);
      fob.position.set(-0.95, subwayY + 1.52, -0.35);
      fob.castShadow = true;
      parent.add(fob);
    } else if (id === 'rajiv_chowk') {
      [-1.18, 1.68].forEach((rx) => {
        const cyl = new THREE.Mesh(g.rotundaCyl, m.lutyensCream);
        cyl.position.set(rx, subwayY + 1.64, roofZ);
        cyl.castShadow = true;
        const cap = new THREE.Mesh(g.rotundaCap, m.brickRed);
        cap.position.set(rx, subwayY + 1.90, roofZ);
        parent.add(cyl, cap);
      });
    } else if (id === 'central_secretariat') {
      const block = new THREE.Mesh(g.kioskGlass, m.lutyensCream);
      block.position.set(-0.95, subwayY + 1.64, roofZ);
      const sandstoneRoof = new THREE.Mesh(g.kioskRoof, m.brickRed);
      sandstoneRoof.position.set(-0.95, subwayY + 1.90, roofZ);
      const dome = new THREE.Mesh(g.chhatriDome, m.brickRed);
      dome.scale.setScalar(1.25);
      dome.position.set(-0.95, subwayY + 1.96, roofZ);
      parent.add(block, sandstoneRoof, dome);
    } else if (id === 'patel_chowk' || id === 'udyog_bhawan' || id === 'lok_kalyan_marg' || id === 'jor_bagh') {
      const plinthBand = new THREE.Mesh(g.kioskRoof, m.brickRed);
      plinthBand.position.set(-0.95, subwayY + 1.56, roofZ);
      const creamPav = new THREE.Mesh(g.kioskGlass, m.lutyensCream);
      creamPav.scale.set(0.85, 0.85, 0.85);
      creamPav.position.set(-0.95, subwayY + 1.76, roofZ);
      parent.add(plinthBand, creamPav);
    } else if (id === 'dilli_haat_ina') {
      const roof = new THREE.Mesh(g.kioskRoof, m.terracotta);
      roof.scale.set(1.2, 1.2, 1.15);
      roof.position.set(-0.95, subwayY + 1.78, roofZ);
      parent.add(roof);
    } else if (id === 'aiims') {
      const medPod = new THREE.Mesh(g.kioskRoof, m.cyberTeal);
      medPod.scale.set(1.25, 1.4, 1.1);
      medPod.position.set(-0.95, subwayY + 1.72, roofZ);
      parent.add(medPod);
    } else if (id === 'hauz_khas') {
      const pyr = new THREE.Mesh(g.skylightPyr, m.glassSky);
      pyr.rotation.y = Math.PI / 4;
      pyr.position.set(-0.95, subwayY + 1.76, roofZ);
      parent.add(pyr);
    }
  }

  function buildCityStationNode(st, cfg) {
    const { yawRad = 0, viaductY = 2.65, subwayY = 0.14 } = cfg || {};
    const res = getShared();
    const { g, m } = res;
    const id = (st.id || '').toLowerCase();
    const archetype = resolveArchetype(st);
    const secColor = pickSecondaryLineColor(st);
    const secCss = secColor ? ('#' + secColor.toString(16).padStart(6, '0')) : null;
    const signMat = new THREE.MeshBasicMaterial({ map: makeMiniSignTexture(st.name, secCss) });

    const root = new THREE.Group();
    root.position.set(st.x, 0, st.z);
    root.rotation.y = yawRad;

    let halo = null;
    const TRACK_Z = [-0.34, 0.34];

    if (archetype === 'elevatedSide' || archetype === 'elevatedIsland') {
      const plaza = new THREE.Mesh(g.plazaPad, m.plazaPave);
      plaza.position.set(0, 0.17, 0);
      plaza.receiveShadow = true;
      root.add(plaza);

      const isIsland = archetype === 'elevatedIsland';
      // 1. Concrete box-girder viaduct & under-web
      const deck = new THREE.Mesh(g.elDeck, m.concreteLight);
      deck.position.y = viaductY - 0.12;
      deck.castShadow = true;
      deck.receiveShadow = true;
      const web = new THREE.Mesh(g.elWeb, m.concreteWeb);
      web.position.y = viaductY - 0.36;
      root.add(deck, web);

      // 2. Flared piers + pier caps + plaza street trees
      [-1.55, 0, 1.55].forEach((px) => {
        const pier = new THREE.Mesh(g.elPier, m.pierCream);
        pier.position.set(px, viaductY * 0.5 - 0.12, 0);
        pier.scale.y = Math.max(0.4, (viaductY - 0.25) / 1.85);
        pier.castShadow = true;
        const cap = new THREE.Mesh(g.elPierCap, m.concreteLight);
        cap.position.set(px, viaductY - 0.26, 0);
        root.add(pier, cap);
      });
      addTree(root, res, -2.5, 0.18, 1.35);
      addTree(root, res, 2.5, 0.18, -1.35);

      // 3. Glazed under-viaduct concourse hall + vertical mullions + AFC gates
      const conc = new THREE.Mesh(g.elConcourse, m.concourseGlass);
      conc.position.y = viaductY - 0.78;
      const cFloor = new THREE.Mesh(g.elConcourseSlab, m.concreteLight);
      cFloor.position.y = viaductY - 1.12;
      cFloor.receiveShadow = true;
      root.add(conc, cFloor);

      [-0.72, 0.72].forEach((mz) => {
        for (let mx = -1.6; mx <= 1.6; mx += 0.45) {
          const mul = new THREE.Mesh(g.elMullion, m.steelDark);
          mul.position.set(mx, viaductY - 0.78, mz);
          root.add(mul);
        }
      });
      for (let gx = -0.5; gx <= 0.5; gx += 0.25) {
        const afc = new THREE.Mesh(g.elAfcGate, m.steelDark);
        afc.position.set(gx, viaductY - 0.96, 0.15);
        root.add(afc);
      }

      // 4. Exterior glass elevator tower (alternating street wing by station index)
      const liftSide = (st.index || 0) % 2 === 0 ? 1 : -1;
      const lift = new THREE.Mesh(g.elLiftGlass, m.glassBarrier);
      lift.position.set(1.92 * liftSide, viaductY * 0.5 + 0.15, 0.96 * liftSide);
      const cab = new THREE.Mesh(g.elLiftCab, m.concreteWeb);
      cab.position.set(1.92 * liftSide, viaductY * 0.55, 0.96 * liftSide);
      const vCap = new THREE.Mesh(g.elLiftCanopy, GURUGRAM_CYBER_IDS.has(id) ? m.cyberTeal : (RIDGE_HERITAGE_IDS.has(id) ? m.brickRed : m.dmrcBlueRoof));
      vCap.position.set(1.92 * liftSide, 0.66, 0.96 * liftSide);
      root.add(lift, cab, vCap);

      // 5. Platforms, yellow tactile edges, benches, PIDS & waiting commuters
      const comSpots = [];
      if (isIsland) {
        const plat = new THREE.Mesh(g.elIslandPlat, m.concretePlat);
        plat.position.set(0, viaductY + 0.14, 0);
        plat.castShadow = true;
        root.add(plat);
        [-0.17, 0.17].forEach((tz) => {
          const tact = new THREE.Mesh(g.ugTactile, m.tactileYellow);
          tact.position.set(0, viaductY + 0.28, tz);
          root.add(tact);
        });
        [-0.85, 0.85].forEach((bx) => {
          const b = new THREE.Mesh(g.benchSeat, m.benchTop);
          b.position.set(bx, viaductY + 0.30, 0);
          root.add(b);
          comSpots.push([bx + 0.25, viaductY + 0.28, 0.08, 0], [bx - 0.22, viaductY + 0.28, -0.08, 1]);
        });
      } else {
        [-0.72, 0.72].forEach((pz, sIdx) => {
          const plat = new THREE.Mesh(g.elSidePlat, m.concretePlat);
          plat.position.set(0, viaductY + 0.14, pz);
          plat.castShadow = true;
          root.add(plat);
          const tact = new THREE.Mesh(g.ugTactile, m.tactileYellow);
          tact.position.set(0, viaductY + 0.28, pz - Math.sign(pz) * 0.19);
          root.add(tact);
          [-0.95, 0.95].forEach((bx, bi) => {
            const b = new THREE.Mesh(g.benchSeat, m.benchTop);
            b.position.set(bx, viaductY + 0.30, pz + Math.sign(pz) * 0.06);
            root.add(b);
            comSpots.push([bx + 0.24, viaductY + 0.28, pz - Math.sign(pz) * 0.10, sIdx + bi]);
          });
        });
      }
      addCommuters(root, g, m, comSpots);

      const pids = new THREE.Mesh(g.pidsBoard, m.pidsScreen);
      pids.position.set(0, viaductY + 0.75, 0);
      root.add(pids);

      const elevRoofMat = GURUGRAM_CYBER_IDS.has(id)
        ? m.cyberTeal
        : (RIDGE_HERITAGE_IDS.has(id) ? m.brickRed : (id === 'haiderpur_badli_mor' ? m.magentaRoof : m.dmrcBlueRoof));
      addElevatedCanopy(root, res, viaductY + 0.20, elevRoofMat);
      addElevatedSignatureDetail(root, res, id, viaductY);

      // Bilingual front & rear fascia signage
      const sbF = new THREE.Mesh(g.fascia, signMat);
      sbF.position.set(0, viaductY + 0.05, 1.05);
      const sbB = sbF.clone();
      sbB.rotation.y = Math.PI;
      sbB.position.z = -1.05;
      root.add(sbF, sbB);

      if (secColor && id !== 'haiderpur_badli_mor') {
        const cb = new THREE.Mesh(g.crossDeck, m.concreteLight);
        cb.position.y = viaductY - 0.72;
        const cs = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 4.65), new THREE.MeshBasicMaterial({ color: secColor }));
        cs.position.y = viaductY - 0.58;
        root.add(cb, cs);
      }
    } else if (archetype === 'hybridMegaHub') {
      // KASHMERE GATE: Underground Yellow Cutaway BELOW + Elevated Red Arched Overpass ABOVE + Violet Sub-Bay
      const plaza = new THREE.Mesh(g.plazaApronRear, m.plazaPave);
      plaza.position.set(0, 0.17, -1.25);
      plaza.receiveShadow = true;
      const floor = new THREE.Mesh(g.ugFloor, m.slateDark);
      floor.position.y = subwayY;
      const rear = new THREE.Mesh(g.ugRearRetain, m.slateCut);
      rear.position.set(0, subwayY + 0.70, -0.78);
      const tile = new THREE.Mesh(g.ugTileBacking, m.tileWall);
      tile.position.set(0, subwayY + 0.65, -0.64);
      const frontCurb = new THREE.Mesh(g.ugFrontCurb, m.slateCut);
      frontCurb.position.set(0, subwayY + 0.18, 0.62);
      const plat = new THREE.Mesh(g.ugDeckIsland, m.concretePlat);
      plat.position.y = subwayY + 0.13;
      root.add(plaza, floor, rear, tile, frontCurb, plat);
      addTBMCollarsBothEnds(root, res, subwayY + 0.18, TRACK_Z);

      const cb = new THREE.Mesh(g.crossDeck, m.concreteLight);
      cb.position.y = viaductY + 0.45;
      cb.castShadow = true;
      const redStripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.10, 4.65), new THREE.MeshBasicMaterial({ color: 0xDC2626 }));
      redStripe.position.y = viaductY + 0.58;
      const redCanopy = new THREE.Mesh(g.crossCanopy, m.redRoof);
      redCanopy.rotation.set(0, Math.PI / 2, Math.PI / 2);
      redCanopy.position.y = viaductY + 0.56;
      const lift = new THREE.Mesh(g.elLiftGlass, m.glassBarrier);
      lift.scale.set(1.1, 1.15, 1.1);
      lift.position.set(1.15, viaductY * 0.5 + 0.35, 0.85);
      const sb = new THREE.Mesh(g.fascia, signMat);
      sb.position.set(0, viaductY + 0.95, 1.28);
      root.add(cb, redStripe, redCanopy, lift, sb);
      addTree(root, res, -2.55, 0.18, 1.35);
      addTree(root, res, 2.55, 0.18, 1.35);
    } else {
      // UNDERGROUND CUTAWAY CHAMBER: UndergroundSide (5 stations) vs UndergroundIsland (14)
      const isUgSide = archetype === 'undergroundSide';
      const rearWallZ = isUgSide ? -1.16 : -0.82;
      const tileZ = rearWallZ + 0.14;
      const frontZ = isUgSide ? 1.04 : 0.62;
      const roofZ = isUgSide ? -1.46 : -1.16;

      // Rear street apron outside cutaway pit so dark concrete slab never z-fights!
      const plaza = new THREE.Mesh(g.plazaApronRear, m.plazaPave);
      plaza.position.set(0, 0.17, roofZ);
      plaza.receiveShadow = true;

      const floor = new THREE.Mesh(isUgSide ? g.ugSideFloor : g.ugFloor, m.slateDark);
      floor.position.y = subwayY;
      floor.receiveShadow = true;

      const rearWall = new THREE.Mesh(g.ugRearRetain, m.slateCut);
      rearWall.position.set(0, subwayY + 0.68, rearWallZ);
      rearWall.castShadow = true;
      rearWall.receiveShadow = true;

      const tileBack = new THREE.Mesh(g.ugTileBacking, m.tileWall);
      tileBack.position.set(0, subwayY + 0.66, tileZ);
      const frieze = new THREE.Mesh(g.ugTileFrieze, m.tactileYellow);
      frieze.position.set(0, subwayY + 0.94, tileZ + 0.01);

      const frontCurb = new THREE.Mesh(g.ugFrontCurb, m.slateCut);
      frontCurb.position.set(0, subwayY + 0.18, frontZ);
      frontCurb.castShadow = true;
      const frontEdge = new THREE.Mesh(g.ugFrontRailing, m.concreteLight);
      frontEdge.position.set(0, subwayY + 0.38, frontZ);

      const streetRoof = new THREE.Mesh(g.ugTopDeckRoof, m.concreteLight);
      streetRoof.position.set(0, subwayY + 1.32, roofZ);
      streetRoof.castShadow = true;
      root.add(plaza, floor, rearWall, tileBack, frieze, frontCurb, frontEdge, streetRoof);

      [-1.5, -0.5, 0.5, 1.5].forEach((rx) => {
        const beam = new THREE.Mesh(isUgSide ? g.ugSideRoofBeam : g.ugRoofBeam, m.steelDark);
        beam.position.set(rx, subwayY + 1.24, isUgSide ? -0.04 : -0.05);
        beam.castShadow = true;
        root.add(beam);
      });

      if (isUgSide) {
        // Two outer platforms flanking central dual-track bed + overhead paid transfer skybridge
        const median = new THREE.Mesh(g.ugMedian, m.slateCut);
        median.position.set(0, subwayY + 0.04, 0);
        root.add(median);

        const comSpots = [];
        [-0.74, 0.74].forEach((pz, sIdx) => {
          const sign = Math.sign(pz);
          const plat = new THREE.Mesh(g.ugSidePlat, m.concretePlat);
          plat.position.set(0, subwayY + 0.13, pz);
          plat.receiveShadow = true;
          root.add(plat);

          const tact = new THREE.Mesh(g.ugTactile, m.tactileYellow);
          tact.position.set(0, subwayY + 0.26, pz - sign * 0.17);
          const psdBar = new THREE.Mesh(g.psdFrame, m.steelDark);
          psdBar.position.set(0, subwayY + 0.42, pz - sign * 0.19);
          root.add(tact, psdBar);
          [-1.3, -0.65, 0.65, 1.3].forEach((dx) => {
            const door = new THREE.Mesh(g.psdPanel, m.glassBarrier);
            door.position.set(dx, subwayY + 0.34, pz - sign * 0.19);
            root.add(door);
          });

          const b = new THREE.Mesh(g.benchSeat, m.benchTop);
          b.position.set(-0.95 + sIdx * 1.9, subwayY + 0.27, pz + sign * 0.08);
          root.add(b);
          comSpots.push(
            [-1.3, subwayY + 0.26, pz + sign * 0.04, sIdx],
            [0.35, subwayY + 0.26, pz - sign * 0.04, sIdx + 2],
            [1.35, subwayY + 0.26, pz + sign * 0.04, sIdx + 4]
          );
        });
        addCommuters(root, g, m, comSpots);

        // Overhead paid cross-track footbridge spanning north & south side platforms cleanly above trains
        const sky = new THREE.Mesh(g.ugSkyBridge, m.concreteLight);
        sky.position.set(-0.35, subwayY + 0.64, 0);
        sky.castShadow = true;
        const railL = new THREE.Mesh(g.ugSkyRail, m.glassBarrier);
        railL.position.set(-0.66, subwayY + 0.74, 0);
        const railR = railL.clone();
        railR.position.x = -0.04;
        root.add(sky, railL, railR);
      } else {
        // Central Island Deck + Yellow Tactile Strips + PSDs + Benches + Commuters
        const plat = new THREE.Mesh(g.ugDeckIsland, m.concretePlat);
        plat.position.y = subwayY + 0.13;
        plat.receiveShadow = true;
        root.add(plat);

        [-0.16, 0.16].forEach((tz) => {
          const tact = new THREE.Mesh(g.ugTactile, m.tactileYellow);
          tact.position.set(0, subwayY + 0.26, tz);
          root.add(tact);
          const psdBar = new THREE.Mesh(g.psdFrame, m.steelDark);
          psdBar.position.set(0, subwayY + 0.42, tz);
          root.add(psdBar);
          [-1.3, -0.65, 0.65, 1.3].forEach((dx) => {
            const door = new THREE.Mesh(g.psdPanel, m.glassBarrier);
            door.position.set(dx, subwayY + 0.34, tz);
            root.add(door);
          });
        });

        const b1 = new THREE.Mesh(g.benchSeat, m.benchTop);
        b1.position.set(-1.1, subwayY + 0.27, 0);
        const b2 = b1.clone();
        b2.position.x = 1.1;
        root.add(b1, b2);

        addCommuters(root, g, m, [
          [-1.4, subwayY + 0.26, 0.09, 0], [-0.9, subwayY + 0.26, -0.09, 1],
          [0.1, subwayY + 0.26, 0.10, 2], [0.85, subwayY + 0.26, -0.08, 3],
          [1.45, subwayY + 0.26, 0.09, 4]
        ]);
      }

      // Ribbed TBM Tunnel Collars at BOTH ends!
      addTBMCollarsBothEnds(root, res, subwayY + 0.16, TRACK_Z);

      // Diagonal glass-and-mint escalator + PIDS board
      const esc = new THREE.Mesh(g.escRamp, m.escalatorStep);
      esc.position.set(-0.65, subwayY + 0.58, rearWallZ + 0.52);
      esc.rotation.x = 0.55;
      const escGlass = new THREE.Mesh(g.escRamp, m.escalatorGlass);
      escGlass.position.set(-0.65, subwayY + 0.68, rearWallZ + 0.52);
      escGlass.rotation.x = 0.55;
      const pids = new THREE.Mesh(g.pidsBoard, m.pidsScreen);
      pids.position.set(0.35, subwayY + 0.72, isUgSide ? 0.02 : -0.02);
      root.add(esc, escGlass, pids);

      // Street-Level Glass Entrance Pavilion + Signature Orange/Red DMRC Roundel
      const kiosk = new THREE.Mesh(g.kioskGlass, m.concourseGlass);
      kiosk.position.set(0.55, subwayY + 1.64, roofZ);
      kiosk.castShadow = true;
      const kRoof = new THREE.Mesh(g.kioskRoof, m.dmrcBlueRoof);
      kRoof.position.set(0.55, subwayY + 1.90, roofZ);
      const roundel = new THREE.Mesh(g.kioskRoundel, m.roundelRed);
      roundel.position.set(0.55, subwayY + 2.02, roofZ);
      root.add(kiosk, kRoof, roundel);

      addUndergroundSignatureDetail(root, res, id, subwayY, roofZ);

      // Station Bilingual Name Fascia inside rear chamber & along front coping
      const sbBack = new THREE.Mesh(g.fascia, signMat);
      sbBack.position.set(0.3, subwayY + 1.14, tileZ + 0.05);
      const sbFront = new THREE.Mesh(g.fascia, signMat);
      sbFront.scale.setScalar(0.85);
      sbFront.position.set(0, subwayY + 0.24, frontZ + 0.12);
      root.add(sbBack, sbFront);

      // Transverse cross-line deep sub-chamber (sits neatly flush below main tracks!)
      if (secColor) {
        const crossTube = new THREE.Mesh(
          new THREE.BoxGeometry(1.05, 0.14, 4.4),
          new THREE.MeshStandardMaterial({
            color: secColor,
            emissive: secColor,
            emissiveIntensity: 0.35,
            roughness: 0.35,
            transparent: true,
            opacity: 0.85
          })
        );
        crossTube.position.set(0, subwayY - 0.10, 0);
        root.add(crossTube);
      }

      addTree(root, res, -2.25, 0.18, roofZ - 0.12);
      addTree(root, res, 2.25, 0.18, roofZ - 0.12);
    }

    if (st.major || !!secColor || st.terminus) {
      const hColor = secColor || M().LINE_COLORS.yellow;
      const haloMat = new THREE.MeshBasicMaterial({ color: hColor, transparent: true, opacity: 0.40, side: THREE.DoubleSide });
      halo = new THREE.Mesh(g.halo, haloMat);
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = (archetype === 'elevatedSide' || archetype === 'elevatedIsland') ? 0.19 : subwayY + 0.05;
      root.add(halo);
    }

    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.8, 3.6), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.position.y = (archetype === 'elevatedSide' || archetype === 'elevatedIsland') ? viaductY : subwayY + 0.9;
    root.add(hitBox);

    return { group: root, archetype, halo };
  }

  return {
    resolveArchetype,
    projectToPlinth,
    buildCityStationNode
  };
})();
