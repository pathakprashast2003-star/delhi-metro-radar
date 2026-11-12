/* ============================================================
 * DELHI METRO KIT — Track Substructures & Articulated Fleet
 * 5 Track Types (Viaduct, At-Grade Surface, Ramp/Portal,
 * Extruded TBM Tube, Y-Turnout Switch) + Instanced Sleepers
 * & Ballast + 1 Shared Articulated Train Factory (3 variants).
 * ============================================================ */

window.MetroKit = window.MetroKit || {};

window.MetroKit.TrackSystem = (function () {
  'use strict';

  function M() { return window.MetroKit.Materials; }

  function buildDMRCViaductPier(parent, cfg) {
    const mat = M().shared();
    const { x = 0, z = 0, bottomY = -9.3, topDeckBottomY = 10.5, capWidth = 10.4, rotY = 0 } = cfg;

    const pierGroup = new THREE.Group();
    pierGroup.position.set(x, 0, z);
    pierGroup.rotation.y = rotY;

    M().addBox(pierGroup, 4.6, 0.85, 4.6, mat.concreteWeb, 0, bottomY + 0.42, 0);

    const capBottomY = topDeckBottomY - 2.3;
    const shaftH = Math.max(2.0, capBottomY - (bottomY + 0.85));
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.85, shaftH, 18), mat.concreteLight);
    shaft.position.y = bottomY + 0.85 + shaftH / 2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    pierGroup.add(shaft);

    const halfCap = capWidth / 2;
    const capShape = new THREE.Shape();
    capShape.moveTo(-1.65, 0);
    capShape.lineTo(1.65, 0);
    capShape.lineTo(halfCap, 1.65);
    capShape.lineTo(halfCap, 2.3);
    capShape.lineTo(-halfCap, 2.3);
    capShape.lineTo(-halfCap, 1.65);
    capShape.closePath();

    const capGeo = new THREE.ExtrudeGeometry(capShape, { depth: 3.1, bevelEnabled: false });
    capGeo.translate(0, 0, -1.55);
    const capMesh = new THREE.Mesh(capGeo, mat.concreteLight);
    capMesh.rotation.y = Math.PI / 2;
    capMesh.position.y = capBottomY;
    capMesh.castShadow = true;
    capMesh.receiveShadow = true;
    pierGroup.add(capMesh);

    parent.add(pierGroup);
    return pierGroup;
  }

  function buildBoxGirderSegment(parent, cfg) {
    const mat = M().shared();
    const { x = 0, y = 10.5, z = 0, length = 10, width = 11.8, pitch = 0, rotY = 0 } = cfg;

    const seg = new THREE.Group();
    seg.position.set(x, y, z);
    seg.rotation.y = rotY;
    seg.rotation.z = pitch;

    const topDeck = new THREE.Mesh(new THREE.BoxGeometry(length, 0.72, width), mat.concreteLight);
    topDeck.position.y = -0.36;
    topDeck.castShadow = true;
    topDeck.receiveShadow = true;
    seg.add(topDeck);

    const spine = new THREE.Mesh(new THREE.BoxGeometry(length, 1.45, width * 0.56), mat.concreteWeb);
    spine.position.y = -1.40;
    spine.castShadow = true;
    spine.receiveShadow = true;
    seg.add(spine);

    for (let pz of [-width / 2 + 0.24, width / 2 - 0.24]) {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(length, 0.78, 0.38), mat.concreteLight);
      parapet.position.set(0, 0.39, pz);
      parapet.castShadow = true;
      seg.add(parapet);

      const topBar = new THREE.Mesh(new THREE.BoxGeometry(length, 0.08, 0.10), mat.steelDark);
      topBar.position.set(0, 1.05, pz);
      seg.add(topBar);
    }

    parent.add(seg);
    return seg;
  }

  /** Instanced sleepers, ballast & continuous spline rails along X (or rotated along Z) */
  function buildTracksAlongAxis(parent, cfg) {
    const mat = M().shared();
    const {
      xStart = -74,
      xEnd = 93,
      trackZs = [-3.6, 3.6],
      lineColor = M().LINE_COLORS.yellow,
      yFn = () => 0,
      pitchFn = () => 0,
      withOHE = true,
      oheStart = -20,
      oheXs = null,
      oheSpanWidth = 11.4,
      rotY = 0,
      originX = 0,
      originZ = 0
    } = cfg;

    const trackGroup = new THREE.Group();
    trackGroup.position.set(originX, 0, originZ);
    trackGroup.rotation.y = rotY;

    const step = 1.95;
    const xs = [];
    for (let x = xStart; x <= xEnd; x += step) xs.push(x);

    const totalInstances = xs.length * trackZs.length;
    const sleeperGeo = new THREE.BoxGeometry(0.85, 0.26, 2.8);
    const ballastGeo = new THREE.BoxGeometry(2.1, 0.34, 3.6);

    const sleeperMesh = new THREE.InstancedMesh(sleeperGeo, mat.sleeperWood, totalInstances);
    sleeperMesh.castShadow = true;
    sleeperMesh.receiveShadow = true;
    sleeperMesh.frustumCulled = false;

    const ballastMesh = new THREE.InstancedMesh(ballastGeo, mat.ballast, totalInstances);
    ballastMesh.receiveShadow = true;
    ballastMesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      const y = yFn(x);
      const pitch = pitchFn(x);
      for (let j = 0; j < trackZs.length; j++) {
        const tz = trackZs[j];
        dummy.position.set(x, y - 0.14, tz);
        dummy.rotation.set(0, 0, pitch);
        dummy.updateMatrix();
        ballastMesh.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(x, y + 0.08, tz);
        dummy.updateMatrix();
        sleeperMesh.setMatrixAt(idx, dummy.matrix);
        idx++;
      }
    }
    ballastMesh.instanceMatrix.needsUpdate = true;
    sleeperMesh.instanceMatrix.needsUpdate = true;
    trackGroup.add(ballastMesh, sleeperMesh);

    const sampleXs = [];
    for (let x = xStart - 1; x <= xEnd + 1; x += 2.0) sampleXs.push(x);

    const stripeMat = new THREE.MeshBasicMaterial({ color: lineColor });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x64748B });

    trackZs.forEach((tz) => {
      [-0.85, 0.85].forEach((rz) => {
        const pts = sampleXs.map(x => new THREE.Vector3(x, yFn(x) + 0.30, tz + rz));
        const railGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(40, sampleXs.length), 0.12, 6, false);
        const railMesh = new THREE.Mesh(railGeo, mat.railSteel);
        railMesh.castShadow = true;
        trackGroup.add(railMesh);
      });

      const stripePts = sampleXs.map(x => new THREE.Vector3(x, yFn(x) + 0.10, tz));
      const stripeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripePts), Math.max(36, sampleXs.length), 0.08, 4, false);
      trackGroup.add(new THREE.Mesh(stripeGeo, stripeMat));

      if (withOHE) {
        const wirePts = [];
        for (let x = Math.max(xStart, oheStart); x <= xEnd; x += 2.0) {
          wirePts.push(new THREE.Vector3(x, yFn(x) + 4.75, tz));
        }
        if (wirePts.length >= 2) {
          const wireGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wirePts), 48, 0.045, 4, false);
          trackGroup.add(new THREE.Mesh(wireGeo, wireMat));
        }
      }
    });

    if (withOHE && oheXs && oheXs.length) {
      const halfSpan = oheSpanWidth / 2;
      oheXs.forEach((mx) => {
        const my = yFn(mx);
        M().addBox(trackGroup, 0.22, 5.8, 0.22, mat.steelDark, mx, my + 2.9, -halfSpan);
        M().addBox(trackGroup, 0.22, 5.8, 0.22, mat.steelDark, mx, my + 2.9, halfSpan);
        M().addBox(trackGroup, 0.24, 0.18, oheSpanWidth + 0.2, mat.steelDark, mx, my + 5.75, 0, false);
      });
    }

    parent.add(trackGroup);
    return trackGroup;
  }

  /** Diverging Y-Turnout branch rails & cross-ties (used at Yamuna Bank junction!) */
  function buildYBranchSwitch(parent, cfg) {
    const mat = M().shared();
    const {
      xStart = 20, xEnd = 74, y = 0,
      zStart = 10.5, zEnd = 22.0,
      lineColor = M().LINE_COLORS.blue
    } = cfg;

    const g = new THREE.Group();
    const midX = (xStart + xEnd) / 2;
    const midZ = (zStart + zEnd) / 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(xStart, y, zStart),
      new THREE.Vector3(midX - 4, y, zStart + (zEnd - zStart) * 0.22),
      new THREE.Vector3(midX + 6, y, midZ + (zEnd - zStart) * 0.15),
      new THREE.Vector3(xEnd, y, zEnd)
    ]);

    const pts = curve.getSpacedPoints(26);
    const sleeperGeo = new THREE.BoxGeometry(0.85, 0.24, 2.8);
    const ballastGeo = new THREE.BoxGeometry(2.1, 0.32, 3.6);
    const sMesh = new THREE.InstancedMesh(sleeperGeo, mat.sleeperWood, pts.length);
    sMesh.frustumCulled = false;
    const bMesh = new THREE.InstancedMesh(ballastGeo, mat.ballast, pts.length);
    bMesh.frustumCulled = false;
    const dummy = new THREE.Object3D();

    pts.forEach((p, i) => {
      const tan = curve.getTangentAt(i / (pts.length - 1));
      const yaw = Math.atan2(-tan.z, tan.x);
      dummy.position.set(p.x, p.y - 0.14, p.z);
      dummy.rotation.set(0, yaw, 0);
      dummy.updateMatrix();
      bMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x, p.y + 0.08, p.z);
      dummy.updateMatrix();
      sMesh.setMatrixAt(i, dummy.matrix);
    });
    bMesh.instanceMatrix.needsUpdate = true;
    sMesh.instanceMatrix.needsUpdate = true;
    g.add(bMesh, sMesh);

    [-0.85, 0.85].forEach((offset) => {
      const railPts = pts.map((p, i) => {
        const tan = curve.getTangentAt(i / (pts.length - 1));
        const perp = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        return p.clone().addScaledVector(perp, offset).add(new THREE.Vector3(0, 0.30, 0));
      });
      const rGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 40, 0.12, 6, false);
      const rMesh = new THREE.Mesh(rGeo, mat.railSteel);
      rMesh.castShadow = true;
      g.add(rMesh);
    });

    const stripePts = pts.map(p => p.clone().add(new THREE.Vector3(0, 0.10, 0)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripePts), 36, 0.08, 4, false), new THREE.MeshBasicMaterial({ color: lineColor })));

    parent.add(g);
    return { group: g, curve };
  }

  /** Extruded concrete TBM tunnel portal collars & dark expansion ribs */
  function buildTBMCollars(parent, cfg) {
    const mat = M().shared();
    const { xPortal = -70, y = 2.2, trackZs = [-3.6, 3.6], depth = 9.0, rotY = 0, originX = 0, originZ = 0 } = cfg;

    const g = new THREE.Group();
    g.position.set(originX, 0, originZ);
    g.rotation.y = rotY;
    const boreDark = new THREE.MeshBasicMaterial({ color: 0x060A12 });

    const archShape = new THREE.Shape();
    archShape.absarc(0, 0, 3.85, 0, Math.PI, false);
    archShape.lineTo(-3.85, -1.6);
    archShape.lineTo(-2.95, -1.6);
    archShape.lineTo(-2.95, 0);
    archShape.absarc(0, 0, 2.95, Math.PI, 0, true);
    archShape.lineTo(2.95, -1.6);
    archShape.lineTo(3.85, -1.6);
    archShape.closePath();

    const tunnelExtrude = new THREE.ExtrudeGeometry(archShape, { depth, bevelEnabled: false });

    trackZs.forEach((tz) => {
      const tube = new THREE.Mesh(tunnelExtrude, mat.concreteLight);
      tube.rotation.y = Math.PI / 2;
      tube.position.set(xPortal, y, tz);
      tube.castShadow = true;
      tube.receiveShadow = true;
      g.add(tube);

      for (let rx = xPortal + 0.5; rx <= xPortal + depth - 0.5; rx += 2.6) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(3.88, 0.20, 8, 22, Math.PI), mat.steelDark);
        rib.position.set(rx, y, tz);
        rib.rotation.y = Math.PI / 2;
        g.add(rib);
      }

      const voidMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.85, 5.2, 20), boreDark);
      voidMesh.rotation.z = Math.PI / 2;
      voidMesh.position.set(xPortal + 2.3, y, tz);
      g.add(voidMesh);
    });

    parent.add(g);
    return g;
  }

  return {
    buildDMRCViaductPier,
    buildBoxGirderSegment,
    buildTracksAlongAxis,
    buildYBranchSwitch,
    buildTBMCollars
  };
})();

window.MetroKit.TrainFactory = (function () {
  'use strict';

  function M() { return window.MetroKit.Materials; }

  function mergeCarByMaterial(car) {
    const meshes = [];
    for (let i = 0; i < car.children.length; i++) {
      if (car.children[i].isMesh) meshes.push(car.children[i]);
    }
    if (meshes.length < 2) return;
    const buckets = new Map();
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      const mat = m.material;
      if (!buckets.has(mat)) buckets.set(mat, []);
      buckets.get(mat).push(m);
    }
    buckets.forEach((list, mat) => {
      if (list.length < 2) return;
      const nonIdx = [];
      let totalFloats = 0;
      let anyShadow = false;
      let anyRecv = false;
      let allNoShadow = true;
      for (let i = 0; i < list.length; i++) {
        const src = list[i];
        src.updateMatrix();
        const g = src.geometry.index ? src.geometry.toNonIndexed() : src.geometry.clone();
        g.applyMatrix4(src.matrix);
        const pos = g.attributes.position;
        if (!pos) { g.dispose(); continue; }
        if (!g.attributes.normal) g.computeVertexNormals();
        totalFloats += pos.array.length;
        if (src.castShadow) anyShadow = true;
        if (src.receiveShadow) anyRecv = true;
        if (!src.userData || !src.userData.noShadow) allNoShadow = false;
        nonIdx.push(g);
        car.remove(src);
      }
      if (!nonIdx.length) return;
      const posArr = new Float32Array(totalFloats);
      const normArr = new Float32Array(totalFloats);
      let off = 0;
      for (let i = 0; i < nonIdx.length; i++) {
        const g = nonIdx[i];
        const pa = g.attributes.position.array;
        posArr.set(pa, off);
        normArr.set(g.attributes.normal.array, off);
        off += pa.length;
        g.dispose();
      }
      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
      const out = new THREE.Mesh(merged, mat);
      out.castShadow = anyShadow;
      out.receiveShadow = anyRecv;
      if (allNoShadow) out.userData.noShadow = true;
      car.add(out);
    });
  }

  function createArticulatedTrain(cfg) {
    const {
      lineColor = M().LINE_COLORS.yellow,
      carCount = 3,
      directionSign = -1,
      variant = 'standard', // 'standard' | 'airport' | 'rapid'
      carScale = 1,
      withPointLight = true
    } = cfg || {};

    const trainRoot = new THREE.Group();
    trainRoot.userData.carScale = carScale;
    const cars = [];
    const gangways = [];

    const bodyColor = variant === 'airport' ? 0xF8FAFC : 0xE2E8F0;
    const bodyMat = M().stdMat(bodyColor, { metalness: 0.75, roughness: 0.20 });
    const darkBandMat = M().stdMat(0x1E293B, { roughness: 0.42 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: lineColor });
    const roofPodMat = M().stdMat(0xCBD5E1, { metalness: 0.35, roughness: 0.4 });

    const winMat = new THREE.MeshStandardMaterial({
      color: 0x0F172A,
      metalness: 0.85,
      roughness: 0.14,
      emissive: 0xF59E0B,
      emissiveIntensity: 0.14
    });
    M().windowMaterials.push(winMat);

    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xFEF08A });
    M().headlightMaterials.push(headlightMat);
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xEF4444 });
    const roundelMat = new THREE.MeshBasicMaterial({ color: 0xDC2626 });
    const gangwayMat = M().stdMat(0x334155, { roughness: 0.88 });

    const carLen = variant === 'rapid' ? 7.4 : 8.4;
    const carWid = 2.35;
    const carH = 2.55;
    const spacing = carLen + 1.0;

    const hw = carWid / 2;
    const coachShape = new THREE.Shape();
    coachShape.moveTo(-hw + 0.12, 0);
    coachShape.lineTo(hw - 0.12, 0);
    coachShape.lineTo(hw, 0.25);
    coachShape.lineTo(hw, carH - 0.45);
    coachShape.quadraticCurveTo(hw, carH, hw - 0.55, carH);
    coachShape.lineTo(-hw + 0.55, carH);
    coachShape.quadraticCurveTo(-hw, carH, -hw, carH - 0.45);
    coachShape.lineTo(-hw, 0.25);
    coachShape.closePath();

    const coachGeo = new THREE.ExtrudeGeometry(coachShape, { depth: carLen, bevelEnabled: false });
    coachGeo.translate(0, 0, -carLen / 2);
    coachGeo.rotateY(Math.PI / 2);

    const midIndex = Math.floor(carCount / 2);

    for (let idx = 0; idx < carCount; idx++) {
      const offset = (idx - (carCount - 1) / 2) * spacing * carScale;
      const car = new THREE.Group();
      car.userData.localOffset = offset;
      if (carScale !== 1) car.scale.setScalar(carScale);

      const body = new THREE.Mesh(coachGeo, bodyMat);
      body.position.y = 0.42;
      body.castShadow = true;
      body.receiveShadow = true;
      car.add(body);

      M().addBox(car, carLen - 0.8, 0.36, carWid - 0.45, darkBandMat, 0, 0.34, 0);

      [-hw - 0.01, hw + 0.01].forEach((sz) => {
        const band = new THREE.Mesh(new THREE.BoxGeometry(carLen - 0.4, 0.82, 0.025), darkBandMat);
        band.position.set(0, 1.88, sz);
        band.userData.noShadow = true;
        car.add(band);

        const stripe = new THREE.Mesh(new THREE.BoxGeometry(carLen, 0.28, 0.03), stripeMat);
        stripe.position.set(0, 1.18, sz);
        stripe.userData.noShadow = true;
        car.add(stripe);

        const badge = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), roundelMat);
        badge.position.set(0, 0.88, sz + Math.sign(sz) * 0.02);
        if (sz < 0) badge.rotation.y = Math.PI;
        badge.userData.noShadow = true;
        car.add(badge);

        for (let wx = -carLen * 0.33; wx <= carLen * 0.33; wx += 1.85) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.62, 0.04), winMat);
          win.position.set(wx, 1.88, sz + Math.sign(sz) * 0.01);
          win.userData.noShadow = true;
          car.add(win);
        }
      });

      M().addBox(car, carLen * 0.52, 0.26, 1.35, roofPodMat, 0, carH + 0.50, 0);
      if (idx === midIndex) {
        M().addBox(car, 1.1, 0.12, 1.0, darkBandMat, 0, carH + 0.68, 0, false);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.10), darkBandMat);
        arm.position.set(-0.15, carH + 1.08, 0);
        arm.rotation.z = 0.62;
        arm.userData.noShadow = true;
        car.add(arm);
        M().addBox(car, 0.14, 0.08, 1.4, roofPodMat, 0.22, carH + 1.40, 0, false);
      }

      const isLead = (directionSign === -1 && idx === 0) || (directionSign === 1 && idx === carCount - 1);
      const isRear = (directionSign === -1 && idx === carCount - 1) || (directionSign === 1 && idx === 0);

      if (isLead) {
        const noseLen = variant === 'airport' ? 1.65 : 1.2;
        const noseX = directionSign * (carLen / 2 + noseLen * 0.48);
        const nose = new THREE.Mesh(new THREE.BoxGeometry(noseLen, carH - 0.18, carWid - 0.16), bodyMat);
        nose.position.set(noseX, carH / 2 + 0.40, 0);
        nose.castShadow = true;
        car.add(nose);

        const ws = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, carWid - 0.55), winMat);
        ws.position.set(noseX + directionSign * (noseLen * 0.5 + 0.02), 1.92, 0);
        ws.rotation.z = directionSign * 0.15;
        ws.userData.noShadow = true;
        car.add(ws);

        const noseBadge = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), roundelMat);
        noseBadge.position.set(noseX + directionSign * (noseLen * 0.5 + 0.03), 1.15, 0);
        noseBadge.rotation.y = directionSign > 0 ? Math.PI / 2 : -Math.PI / 2;
        noseBadge.userData.noShadow = true;
        car.add(noseBadge);

        const dest = M().addBox(car, 0.12, 0.18, 1.25, new THREE.MeshBasicMaterial({ color: 0xF59E0B }), noseX + directionSign * (noseLen * 0.48), 2.66, 0, false);
        dest.userData.noShadow = true;

        [-0.72, 0.72].forEach((hz) => {
          const hl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), headlightMat);
          hl.position.set(noseX + directionSign * (noseLen * 0.5 + 0.03), 1.02, hz);
          hl.userData.noShadow = true;
          car.add(hl);
        });

        if (withPointLight) {
          const beam = new THREE.PointLight(0xFEF08A, 1.35, 26, 1.3);
          beam.position.set(noseX + directionSign * 2.0, 1.4, 0);
          car.add(beam);
        }
      }

      if (isRear) {
        const tailX = -directionSign * (carLen / 2 + 0.05);
        [-0.72, 0.72].forEach((tz) => {
          const tl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), taillightMat);
          tl.position.set(tailX, 1.02, tz);
          tl.userData.noShadow = true;
          car.add(tl);
        });
      }

      mergeCarByMaterial(car);
      trainRoot.add(car);
      cars.push(car);

      if (idx < carCount - 1) {
        const g = new THREE.Mesh(new THREE.BoxGeometry(1.15, carH - 0.45, carWid - 0.50), gangwayMat);
        g.userData.localOffset = offset + (spacing * carScale) / 2;
        if (carScale !== 1) g.scale.setScalar(carScale);
        trainRoot.add(g);
        gangways.push(g);
      }
    }

    trainRoot.userData.cars = cars;
    trainRoot.userData.gangways = gangways;
    return trainRoot;
  }

  function updateTrainOnAxis(trainGroup, centerPos, laneOffset, axis, yFn, pitchFn) {
    if (!trainGroup) return;
    const isZ = axis === 'z';
    trainGroup.userData.cars.forEach((car) => {
      const p = centerPos + car.userData.localOffset;
      const y = yFn(p) + 0.14;
      const pitch = pitchFn(p);
      if (isZ) {
        car.position.set(laneOffset, y, p);
        car.rotation.set(-pitch, -Math.PI / 2, 0);
      } else {
        car.position.set(p, y, laneOffset);
        car.rotation.set(0, 0, pitch);
      }
    });
    trainGroup.userData.gangways.forEach((g) => {
      const p = centerPos + g.userData.localOffset;
      const y = yFn(p) + 1.68;
      const pitch = pitchFn(p);
      if (isZ) {
        g.position.set(laneOffset, y, p);
        g.rotation.set(-pitch, -Math.PI / 2, 0);
      } else {
        g.position.set(p, y, laneOffset);
        g.rotation.set(0, 0, pitch);
      }
    });
  }

  function updateTrainOnCurve(trainGroup, curve, centerDist, totalLen, laneOffset = 0, yOffset = 0) {
    if (!trainGroup || !curve) return;
    const sc = trainGroup.userData.carScale || 1;
    const clampU = (u) => Math.max(0.002, Math.min(0.998, u));
    const placePart = (mesh, yExtra) => {
      const u = clampU((centerDist + mesh.userData.localOffset) / totalLen);
      const pt = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      const len = Math.hypot(tan.x, tan.z) || 1;
      const perpX = (-tan.z / len) * laneOffset;
      const perpZ = (tan.x / len) * laneOffset;
      mesh.position.set(pt.x + perpX, pt.y + yOffset + yExtra * sc, pt.z + perpZ);
      mesh.rotation.set(0, Math.atan2(-tan.z, tan.x), Math.asin(Math.max(-0.5, Math.min(0.5, tan.y))));
    };
    trainGroup.userData.cars.forEach(c => placePart(c, 0.14));
    trainGroup.userData.gangways.forEach(g => placePart(g, 1.68));
  }

  return {
    createArticulatedTrain,
    updateTrainOnAxis,
    updateTrainOnCurve,
    mergeGroupByMaterial: mergeCarByMaterial
  };
})();

