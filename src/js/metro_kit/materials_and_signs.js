/* ============================================================
 * DELHI METRO KIT — Shared Materials, Textures & DMRC Signage
 * Single source of truth for PBR surfaces, dynamic theme pools,
 * procedural terrazzo/tile maps & bilingual Hindi/English boards.
 * ============================================================ */

window.MetroKit = window.MetroKit || {};

window.MetroKit.Materials = (function () {
  'use strict';

  const LINE_COLORS = {
    yellow:  0xEAB308,
    blue:    0x2563EB,
    red:     0xDC2626,
    violet:  0x7C3AED,
    magenta: 0xDB2777,
    pink:    0xEC4899,
    airport: 0xF97316,
    rapid:   0x0EA5E9
  };

  const LINE_HEX = {
    yellow:  '#EAB308',
    blue:    '#2563EB',
    red:     '#DC2626',
    violet:  '#7C3AED',
    magenta: '#DB2777',
    pink:    '#EC4899',
    airport: '#F97316',
    rapid:   '#0EA5E9'
  };

  const windowMaterials = [];
  const headlightMaterials = [];
  const undergroundLights = [];
  const elevatedLights = [];
  const streetLampLights = [];

  const textureCache = new Map();

  function stdMat(color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({
      color: color,
      roughness: 0.76,
      metalness: 0.06
    }, opts || {}));
  }

  function addBox(parent, w, h, d, mat, x, y, z, shadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    if (shadow) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    parent.add(mesh);
    return mesh;
  }

  function makeGridTileTexture(baseHex, lineHex, cellsX, cellsY, repeatX = 1, repeatY = 1) {
    const key = `${baseHex}_${lineHex}_${cellsX}_${cellsY}_${repeatX}_${repeatY}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = lineHex;
    ctx.lineWidth = 2;
    const sx = 256 / cellsX;
    const sy = 256 / cellsY;
    for (let x = 0; x <= 256; x += sx) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
    }
    for (let y = 0; y <= 256; y += sy) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.encoding = THREE.sRGBEncoding;
    textureCache.set(key, tex);
    return tex;
  }

  function makeBuildingFacadeTexture() {
    if (textureCache.has('bldg')) return textureCache.get('bldg');
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#F3EFE4';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#C9C4B5';
    for (let y = 14; y < 118; y += 26) {
      for (let x = 14; x < 114; x += 26) {
        ctx.fillRect(x, y, 16, 14);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    textureCache.set('bldg', tex);
    return tex;
  }

  function makeDMRCBilingualSign(hindiName, engName, subtitle, accentColor, secondaryColor) {
    const key = `sign_${hindiName}_${engName}_${subtitle}_${accentColor}_${secondaryColor || ''}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 148;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, 640, 148);

    if (secondaryColor) {
      ctx.fillStyle = accentColor || '#EAB308';
      ctx.fillRect(0, 134, 320, 14);
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(320, 134, 320, 14);
    } else {
      ctx.fillStyle = accentColor || '#EAB308';
      ctx.fillRect(0, 134, 640, 14);
    }

    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(64, 68, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(64, 68, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1D4ED8';
    ctx.fillRect(18, 56, 92, 24);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 28px "Inter", -apple-system, sans-serif';
    ctx.fillText(hindiName, 128, 48);
    ctx.font = 'bold 34px "Inter", -apple-system, sans-serif';
    ctx.fillText(engName, 128, 86);

    ctx.fillStyle = accentColor || '#EAB308';
    ctx.font = 'bold 18px "Inter", -apple-system, sans-serif';
    ctx.fillText(subtitle, 128, 116);

    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    textureCache.set(key, tex);
    return tex;
  }

  function makePIDSTexture(header, line1, line2) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d');
    drawPIDSToContext(ctx, header, line1, line2);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.minFilter = THREE.LinearFilter;
    return { canvas: c, ctx, texture: tex };
  }

  function drawPIDSToContext(ctx, header, line1, line2) {
    if (!ctx) return;
    ctx.fillStyle = '#0B1324';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#EAB308';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 508, 124);

    ctx.fillStyle = '#EAB308';
    ctx.font = 'bold 21px "JetBrains Mono", monospace';
    ctx.fillText(header, 18, 36);

    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillText(line1, 18, 74);

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillText(line2, 18, 108);
  }

  function createSharedPalette() {
    return {
      plinth:          stdMat(0xE6DFD3, { roughness: 0.88, metalness: 0.03 }),
      plinthTrim:      stdMat(0xCFC6B6, { roughness: 0.85, metalness: 0.04 }),
      sageGround:      stdMat(0xCBD7BF, { roughness: 0.92, metalness: 0.02 }),
      roadSandstone:   stdMat(0xDDA987, { roughness: 0.86, metalness: 0.02 }),
      concreteLight:   stdMat(0xC5CCD4, { roughness: 0.76 }),
      concreteWeb:     stdMat(0x9AA5B2, { roughness: 0.82 }),
      slateDark:       stdMat(0x2D3748, { roughness: 0.88, metalness: 0.08 }),
      slateCut:        stdMat(0x4A5568, { roughness: 0.84, metalness: 0.10 }),
      steelDark:       stdMat(0x334155, { metalness: 0.75, roughness: 0.28 }),
      steelChrome:     stdMat(0xCBD5E1, { metalness: 0.76, roughness: 0.24 }),
      dmrcBlueRoof:    stdMat(0x4088CA, { roughness: 0.38, metalness: 0.24, side: THREE.DoubleSide }),
      skylightGlass:   stdMat(0xDCEEF8, { roughness: 0.14, metalness: 0.12, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
      balustradeGlass: stdMat(0xCFE6F4, { roughness: 0.18, metalness: 0.10, transparent: true, opacity: 0.52, side: THREE.DoubleSide }),
      concourseGlass:  stdMat(0x60A5FA, { roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.42 }),
      tactileYellow:   new THREE.MeshBasicMaterial({ color: 0xFACC15 }),
      ballast:         stdMat(0x788591, { roughness: 0.94 }),
      sleeperWood:     stdMat(0x5C3D28, { roughness: 0.84 }),
      railSteel:       stdMat(0x334155, { metalness: 0.88, roughness: 0.24 }),
      ledWarm:         new THREE.MeshBasicMaterial({ color: 0xFEF08A }),
      ledGreen:        new THREE.MeshBasicMaterial({ color: 0x22C55E }),
      terrazzoDeck:    stdMat(0xFFFFFF, { map: makeGridTileTexture('#ECEFF4', '#CBD5E1', 20, 5, 4, 1), roughness: 0.52 }),
      subwayTileWall:  stdMat(0xFFFFFF, { map: makeGridTileTexture('#F8FAFC', '#E2E8F0', 16, 8, 4, 1), roughness: 0.25 }),
      buildingFacade:  stdMat(0xF5F1E8, { map: makeBuildingFacadeTexture(), roughness: 0.85 })
    };
  }

  function resetDynamicPools() {
    windowMaterials.length = 0;
    headlightMaterials.length = 0;
    undergroundLights.length = 0;
    elevatedLights.length = 0;
    streetLampLights.length = 0;
  }

  let _shared = null;
  function shared() {
    if (!_shared) _shared = createSharedPalette();
    return _shared;
  }

  return {
    LINE_COLORS,
    LINE_HEX,
    shared,
    stdMat,
    addBox,
    makeGridTileTexture,
    makeBuildingFacadeTexture,
    makeDMRCBilingualSign,
    makePIDSTexture,
    drawPIDSToContext,
    windowMaterials,
    headlightMaterials,
    undergroundLights,
    elevatedLights,
    streetLampLights,
    resetDynamicPools
  };
})();

