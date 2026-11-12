/* ============================================================
 * DELHI METRO KIT — Reusable Station & Platform Parts
 * Shared across all 6 DMRC station archetypes: decks, tactile
 * strips, glass PSDs, AFC gates, escalators, lifts, benches,
 * recycling bins, banded columns, PIDS hangers & commuters.
 * ============================================================ */

window.MetroKit = window.MetroKit || {};

window.MetroKit.PlatformParts = (function () {
  'use strict';

  function M() { return window.MetroKit.Materials; }

  function buildPlatformDeck(parent, cfg) {
    const mat = M().shared();
    const {
      x = 0, yCenter = 0.7, zCenter = 0,
      length = 38, width = 4.6, thickness = 1.7,
      edges = ['north', 'south'],
      centerGuide = false
    } = cfg;

    M().addBox(parent, length, thickness, width, mat.terrazzoDeck, x, yCenter, zCenter);
    const topY = yCenter + thickness / 2 + 0.03;

    if (edges.includes('north')) {
      M().addBox(parent, length, 0.08, 0.36, mat.tactileYellow, x, topY, zCenter - width / 2 + 0.28, false);
    }
    if (edges.includes('south')) {
      M().addBox(parent, length, 0.08, 0.36, mat.tactileYellow, x, topY, zCenter + width / 2 - 0.28, false);
    }
    if (centerGuide) {
      M().addBox(parent, Math.max(4, length - 2), 0.06, 0.20, mat.tactileYellow, x, topY, zCenter, false);
    }
    return topY;
  }

  function buildPSDBank(parent, cfg) {
    const mat = M().shared();
    const {
      xStart, xEnd, yBase, zPos,
      gapXs = [],
      lineColor = M().LINE_COLORS.yellow
    } = cfg;

    const frameMat = M().stdMat(0x64748B, { metalness: 0.72, roughness: 0.28 });
    const glassMat = M().stdMat(0xBAE6FD, { transparent: true, opacity: 0.40, roughness: 0.12 });
    const headerMat = new THREE.MeshBasicMaterial({ color: lineColor });
    const step = 3.1;

    for (let x = xStart; x < xEnd; x += step) {
      const isDoorGap = gapXs.some(gx => Math.abs(x - gx) < 1.5);
      M().addBox(parent, 0.13, 1.42, 0.13, frameMat, x, yBase + 0.71, zPos);
      if (!isDoorGap) {
        M().addBox(parent, step - 0.15, 1.20, 0.07, glassMat, x + step / 2, yBase + 0.64, zPos, false);
        M().addBox(parent, step, 0.14, 0.15, headerMat, x + step / 2, yBase + 1.36, zPos, false);
      } else {
        M().addBox(parent, step, 0.15, 0.15, frameMat, x + step / 2, yBase + 1.36, zPos, false);
        M().addBox(parent, 0.40, 0.08, 0.17, mat.ledGreen, x + step / 2, yBase + 1.46, zPos, false);
      }
    }
  }

  function buildAFCTurnstileBank(parent, x, y, z, count, rotY = 0) {
    const bank = new THREE.Group();
    bank.position.set(x, y, z);
    bank.rotation.y = rotY;
    const mat = M().shared();
    const topMat = M().stdMat(0x1E293B, { roughness: 0.4 });
    const flapMat = M().stdMat(0xEF4444, { transparent: true, opacity: 0.78 });

    for (let i = 0; i < count; i++) {
      const gx = (i - (count - 1) / 2) * 1.1;
      M().addBox(bank, 0.30, 1.02, 1.35, mat.steelChrome, gx, 0.51, 0);
      M().addBox(bank, 0.32, 0.08, 1.38, topMat, gx, 1.04, 0, false);
      M().addBox(bank, 0.16, 0.06, 0.20, mat.ledGreen, gx, 1.09, 0.45, false);
      if (i < count - 1) {
        M().addBox(bank, 0.58, 0.70, 0.06, flapMat, gx + 0.55, 0.54, 0, false);
      }
    }
    parent.add(bank);
    return bank;
  }

  function buildEscalatorFlight(parent, cfg) {
    const mat = M().shared();
    const {
      x = 0, y = 0, z = 0,
      length = 11.0, width = 1.65,
      rotX = 0, rotY = 0, rotZ = 0,
      enclosed = false
    } = cfg;

    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.set(rotX, rotY, rotZ);

    M().addBox(g, width, 0.68, length, mat.steelChrome, 0, 0, 0);
    M().addBox(g, 0.16, 0.18, length, mat.ledGreen, width / 2 - 0.12, 0.48, 0, false);
    M().addBox(g, 0.16, 0.18, length, mat.ledGreen, -width / 2 + 0.12, 0.48, 0, false);
    if (enclosed) {
      M().addBox(g, width - 0.1, 1.30, length, mat.concourseGlass, 0, 0.92, 0, false);
    }
    parent.add(g);
    return g;
  }

  function buildElevatorShaft(parent, cfg) {
    const mat = M().shared();
    const {
      x, z, yBottom, yTop,
      width = 4.4, depth = 4.4,
      cabY = null,
      withApron = true,
      porticoColor = 0x1D4ED8
    } = cfg;

    const g = new THREE.Group();
    const shaftH = yTop - yBottom;
    const midY = yBottom + shaftH / 2;

    if (withApron) {
      M().addBox(g, width + 3.0, 0.34, depth + 1.4, M().stdMat(0xE2E8F0, { roughness: 0.75 }), x + 1.0, yBottom + 0.17, z);
      M().addBox(g, width + 1.4, 0.24, depth + 0.6, M().stdMat(porticoColor, { roughness: 0.4 }), x, yBottom + 3.7, z);
    }

    M().addBox(g, width, shaftH, depth, mat.concourseGlass, x, midY, z, false);
    const liftY = cabY !== null ? cabY : yBottom + shaftH * 0.55;
    M().addBox(g, width * 0.62, 2.8, depth * 0.62, M().stdMat(0xE2E8F0, { metalness: 0.65, roughness: 0.28 }), x, liftY, z);
    M().addBox(g, width * 0.64, 0.30, depth * 0.64, mat.ledWarm, x, liftY + 1.2, z, false);

    for (let sx of [-width / 2 + 0.12, width / 2 - 0.12]) {
      for (let sz of [-depth / 2 + 0.12, depth / 2 - 0.12]) {
        M().addBox(g, 0.22, shaftH, 0.22, mat.steelDark, x + sx, midY, z + sz);
      }
    }

    parent.add(g);
    return g;
  }

  function buildSteelBench(parent, x, y, z, rotY = 0) {
    const bench = new THREE.Group();
    bench.position.set(x, y, z);
    bench.rotation.y = rotY;
    const mat = M().shared();
    const seatMat = M().stdMat(0x94A3B8, { metalness: 0.72, roughness: 0.28 });
    M().addBox(bench, 2.8, 0.10, 0.70, seatMat, 0, 0.44, 0);
    M().addBox(bench, 2.8, 0.40, 0.08, seatMat, 0, 0.68, -0.30);
    M().addBox(bench, 0.12, 0.44, 0.52, mat.steelDark, -1.1, 0.22, 0);
    M().addBox(bench, 0.12, 0.44, 0.52, mat.steelDark, 1.1, 0.22, 0);
    parent.add(bench);
    return bench;
  }

  function buildDualWasteBins(parent, x, y, z) {
    M().addBox(parent, 0.46, 0.70, 0.40, M().stdMat(0x16A34A), x, y + 0.35, z);
    M().addBox(parent, 0.46, 0.70, 0.40, M().stdMat(0x2563EB), x + 0.54, y + 0.35, z);
  }

  function buildBandedColumn(parent, x, yBottom, height, lineColors, z = 0) {
    const mat = M().shared();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, height, 12), mat.steelChrome);
    col.position.set(x, yBottom + height / 2, z);
    col.castShadow = true;
    parent.add(col);

    (lineColors || [M().LINE_COLORS.yellow]).forEach((lc, idx) => {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.31, 0.31, idx === 0 ? 0.52 : 0.30, 12),
        new THREE.MeshBasicMaterial({ color: lc })
      );
      band.position.set(x, yBottom + 2.4 - idx * 0.48, z);
      parent.add(band);
    });
  }

  function buildSuspendedPIDS(parent, cfg) {
    const mat = M().shared();
    const {
      x = 0, yBoard = 6.0, z = 0,
      width = 7.6, height = 1.75,
      roofY = 14.0,
      header = 'DELHI METRO · LIVE PIDS',
      p1 = 'P1: MILLENNIUM CITY  01 MIN',
      p2 = 'P2: SAMAYPUR BADLI   02 MIN',
      rotY = 0
    } = cfg;

    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    const pidsData = M().makePIDSTexture(header, p1, p2);
    M().addBox(g, width, height, 0.30, new THREE.MeshBasicMaterial({ map: pidsData.texture }), 0, yBoard, 0, false);

    const rodLen = Math.max(0.8, roofY - (yBoard + height / 2));
    const rodY = yBoard + height / 2 + rodLen / 2;
    M().addBox(g, 0.13, rodLen, 0.13, mat.steelChrome, -width * 0.34, rodY, 0, false);
    M().addBox(g, 0.13, rodLen, 0.13, mat.steelChrome, width * 0.34, rodY, 0, false);

    parent.add(g);
    return pidsData;
  }

  function buildStreetTotem(parent, x, y, z) {
    const totem = new THREE.Group();
    totem.position.set(x, y, z);
    M().addBox(totem, 1.0, 5.8, 0.50, M().stdMat(0x1E293B), 0, 2.9, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.50, 0.12, 8, 20), M().stdMat(0xDC2626));
    ring.position.set(0, 5.1, 0.30);
    totem.add(ring);
    M().addBox(totem, 1.3, 0.24, 0.15, M().stdMat(0x1D4ED8), 0, 5.1, 0.30, false);
    parent.add(totem);
    return totem;
  }

  const COMMUTER_PALETTES = [
    { coat: 0xC2410C, pants: 0x1E293B, scarf: 0xF59E0B },
    { coat: 0x1E40AF, pants: 0x334155, scarf: 0x38BDF8 },
    { coat: 0x047857, pants: 0x0F172A, scarf: 0xA7F3D0 },
    { coat: 0xD97706, pants: 0x334155, scarf: 0xFDE68A },
    { coat: 0xBE123C, pants: 0x475569, scarf: 0xFECDD3 },
    { coat: 0x374151, pants: 0x111827, scarf: 0xE2E8F0 },
    { coat: 0x6D28D9, pants: 0x1E293B, scarf: 0xC4B5FD },
    { coat: 0x0284C7, pants: 0x0F172A, scarf: 0xBAE6FD }
  ];

  function buildCommuters(parent, placements) {
    const group = new THREE.Group();
    const skinMat = M().stdMat(0xECC0A0);
    const headGeo = new THREE.SphereGeometry(0.23, 8, 8);
    const torsoGeo = new THREE.CylinderGeometry(0.25, 0.29, 0.78, 8);
    const scarfGeo = new THREE.TorusGeometry(0.21, 0.06, 6, 8);
    const legsGeo = new THREE.BoxGeometry(0.36, 0.66, 0.23);

    placements.forEach(([x, yBase, z, rotY, palIdx, sitting]) => {
      const p = COMMUTER_PALETTES[palIdx % COMMUTER_PALETTES.length];
      const fig = new THREE.Group();
      fig.position.set(x, yBase, z);
      fig.rotation.y = rotY || 0;

      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.y = sitting ? 1.22 : 1.60;
      head.castShadow = true;
      fig.add(head);

      const torso = new THREE.Mesh(torsoGeo, M().stdMat(p.coat));
      torso.position.y = sitting ? 0.70 : 0.98;
      torso.castShadow = true;
      fig.add(torso);

      const scarf = new THREE.Mesh(scarfGeo, new THREE.MeshBasicMaterial({ color: p.scarf }));
      scarf.rotation.x = Math.PI / 2;
      scarf.position.y = sitting ? 1.06 : 1.36;
      fig.add(scarf);

      if (!sitting) {
        const legs = new THREE.Mesh(legsGeo, M().stdMat(p.pants));
        legs.position.y = 0.33;
        legs.castShadow = true;
        fig.add(legs);
      }
      group.add(fig);
    });

    parent.add(group);
    return group;
  }

  return {
    buildPlatformDeck,
    buildPSDBank,
    buildAFCTurnstileBank,
    buildEscalatorFlight,
    buildElevatorShaft,
    buildSteelBench,
    buildDualWasteBins,
    buildBandedColumn,
    buildSuspendedPIDS,
    buildStreetTotem,
    buildCommuters
  };
})();

