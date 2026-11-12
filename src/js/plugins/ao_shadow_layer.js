/* ============================================================
 * AOShadowLayer (WallShadowLayer) for MapLibre GL JS v5.x
 * Adapted from MIT-licensed `wallabyway/maplibre-building-shadows`
 * Merges:
 *  - Projected Stenciled Directional Footprint Ground Shadows
 *  - Jump Flood Algorithm (JFA) SDF Contact Ambient Occlusion
 *  - Per-Vertex Wall Ambient Occlusion & Subtle Architectural Facade Relief
 * ============================================================ */
(function (global) {
  'use strict';

  const LOC = {
    a_pos: 0,
    a_normal_ed: 1,
    a_height_f: 2,
    a_height_v: 3,
    a_base_f: 4,
    a_base_v: 5,
    a_color: 6,
    a_color4: 7
  };
  const LAYOUT_STRIDE = 12;

  const FE = `
    #define FE(f, v, t) ((t) < 0.0 ? (f) : mix((v).x, (v).y, t))`;

  const HEIGHT_ATTRS = `
    attribute float a_height_f;
    attribute vec2 a_height_v;
    uniform float u_ht;
    attribute float a_base_f;
    attribute vec2 a_base_v;
    uniform float u_bt;
    ${FE}`;

  const BUILD_VS = `
    uniform mat4 u_matrix;
    uniform vec3 u_lightpos;
    uniform float u_lightintensity;
    uniform float u_strength;
    uniform float u_band;
    uniform float u_metersPerTileUnit;
    uniform float u_tileBias;
    attribute vec2 a_pos;
    attribute vec4 a_normal_ed;
    attribute vec2 a_color;
    attribute vec4 a_color4;
    uniform float u_ct;
    varying vec3 v_color;
    varying float v_dark;
    varying float v_elev;
    varying float v_base;
    varying float v_h;
    varying float v_isWall;
    varying float v_dirFactor;
    varying float v_wallU;
    varying float v_bldgId;
    varying vec2 v_tilePos;
    ${HEIGHT_ATTRS}
    void main() {
      float t = mod(a_normal_ed.x, 2.0);
      float isWall = a_normal_ed.z < 8192.0 ? 1.0 : 0.0;
      float base = max(FE(a_base_f, a_base_v, u_bt), 0.0);
      float h = max(FE(a_height_f, a_height_v, u_ht), 0.0);

      vec2 pk = u_ct < -0.5 ? a_color : mix(a_color4.xy, a_color4.zw, u_ct);
      vec4 rawColor = vec4(floor(pk / 256.0), mod(pk, 256.0)).xzyw / 255.0;
      float bId = fract(dot(rawColor.rgb, vec3(19.7, 43.3, 71.9)) + floor(h * 0.5) * 0.137);
      v_bldgId = bId;

      // Deterministic roof relief + per-tile depth tie-breaker stops coplanar diagonal Z-fighting
      if (t > 0.5 && h > 1.0) {
        h += (bId - 0.5) * 0.22 + u_tileBias;
      }

      float elev = mix(base, h, t);
      float wallRatio = isWall > 0.5 ? max(0.0, elev - base) / max(h - base, 0.001) : -1.0;

      float dark = (wallRatio < 0.0 || wallRatio >= u_band) ? 0.0
                 : (exp(-3.0 * wallRatio / u_band) - 0.0498) * 1.0524;
      v_dark = u_strength * dark;
      v_elev = elev;
      v_base = base;
      v_h = h;
      v_isWall = isWall;
      v_tilePos = a_pos;

      vec2 nRaw = a_normal_ed.xy;
      float nLen = length(nRaw);
      vec2 n2 = nLen > 1.0 ? (nRaw / nLen) : vec2(1.0, 0.0);
      v_wallU = dot(a_pos, vec2(-n2.y, n2.x)) * u_metersPerTileUnit;

      vec4 color = rawColor;
      // Harmonize hyper-saturated OSM/Overture primaries (e.g. building:colour=red #FF0000) into natural terracotta/stone
      float rawLuma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      float rawSat = max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b));
      if (rawSat > 0.36) {
        color.rgb = mix(vec3(rawLuma * 0.96 + 0.04), color.rgb, 0.42);
      }
      float colorvalue = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb = min(color.rgb + vec3(0.014), vec3(0.96));
      vec3 n = a_normal_ed.xyz / 16384.0;
      float directional = clamp(dot(n, u_lightpos), 0.0, 1.0);
      v_dirFactor = isWall < 0.5 ? 0.88 : directional;
      directional = mix(1.0 - u_lightintensity, max(1.0 - colorvalue + u_lightintensity, 1.0), directional);
      if (isWall < 0.5) directional = clamp(directional, 0.90, 0.97);
      v_color = clamp(color.rgb * directional, 0.0, 0.96);
      gl_Position = u_matrix * vec4(a_pos, elev, 1.0);
    }`;

  const BUILD_FS = `
    precision highp float;
    uniform float u_facadeDetail;
    uniform float u_camDist;
    uniform float u_zoom;
    uniform float u_metersPerTileUnit;
    uniform vec3 u_fogColor;
    uniform float u_fogStart;
    uniform float u_fogEnd;
    uniform float u_nightGlow;
    uniform float u_opacity;
    uniform vec3 u_sunTint;
    uniform vec3 u_ambTint;
    uniform float u_skyReflect;
    varying vec3 v_color;
    varying float v_dark;
    varying float v_elev;
    varying float v_base;
    varying float v_h;
    varying float v_isWall;
    varying float v_dirFactor;
    varying float v_wallU;
    varying float v_bldgId;
    varying vec2 v_tilePos;
    void main() {
      float dRatio = (1.0 / max(gl_FragCoord.w, 1e-5)) / max(u_camDist, 1.0);
      float detailLod = clamp((u_zoom - 13.5) / 1.15, 0.0, 1.0) * (1.0 - smoothstep(3.00, 6.80, dRatio));

      // Blend directional sunlight tint & cool sky ambient bounce
      vec3 shadeTint = mix(u_ambTint, u_sunTint, smoothstep(0.10, 0.84, v_dirFactor));
      vec3 col = v_color * shadeTint * (1.0 - v_dark * mix(1.0, 0.45, u_nightGlow));

      float isGlassTower = clamp(smoothstep(0.015, 0.065, v_color.b - v_color.r) * 0.72 + smoothstep(16.0, 26.0, v_h) * 0.62, 0.0, 1.0);
      float heightRel = max(0.0, v_elev - v_base);
      float distTop = max(0.0, v_h - v_elev);

      if (v_isWall > 0.5 && v_h >= 4.0) {
        // Architectural ground plinth dado + upper roofline parapet rim
        if (heightRel < 2.25 && v_h >= 6.8) {
          float plinthMix = smoothstep(2.25, 1.95, heightRel) * 0.86;
          vec3 plinthCol = mix(col * vec3(0.82, 0.83, 0.86), col * vec3(0.74, 0.76, 0.80), step(0.5, fract(v_wallU * 0.35)) * 0.35);
          col = mix(col, plinthCol, plinthMix * detailLod);
        }
        float copingRim = (1.0 - smoothstep(0.32, 0.58, distTop));
        float soffitShadow = smoothstep(0.45, 0.62, distTop) * (1.0 - smoothstep(0.88, 1.10, distTop));
        col = mix(col, min(col * 1.12 + vec3(0.025), vec3(0.97)), copingRim * detailLod);
        col = mix(col, col * 0.85, soffitShadow * detailLod);

        if (u_facadeDetail > 0.01 && v_h >= 6.2 && detailLod > 0.01 && heightRel > 2.10 && distTop > 1.02) {
          float floorH = mix(3.15, 3.50, isGlassTower);
          float bayW = mix(2.70, 3.00, isGlassTower);
          float fRow = fract(heightRel / floorH);
          float fCol = fract(v_wallU / bayW);

          if (isGlassTower > 0.55) {
            // Modern commercial curtain-wall tower: wide tinted glazing + bright anodized aluminum spandrels
            float paneY = smoothstep(0.14, 0.22, fRow) * (1.0 - smoothstep(0.82, 0.90, fRow));
            float paneX = smoothstep(0.08, 0.16, fCol) * (1.0 - smoothstep(0.84, 0.92, fCol));
            float glassMask = paneX * paneY;
            float spandrel = 1.0 - smoothstep(0.14, 0.20, fRow);
            vec3 glassCol = mix(vec3(0.18, 0.30, 0.42), vec3(0.48, 0.66, 0.82), clamp(heightRel / max(v_h, 1.0), 0.0, 1.0) * u_skyReflect);
            glassCol *= mix(vec3(0.78, 0.82, 0.92), u_sunTint, v_dirFactor * 0.72);
            col = mix(col, col * 0.88, spandrel * 0.45 * detailLod * u_facadeDetail);
            col = mix(col, glassCol, glassMask * 0.78 * detailLod * u_facadeDetail);

            if (u_nightGlow > 0.03) {
              vec2 cell = vec2(floor(v_wallU / bayW), floor(heightRel / floorH));
              float hSeed = fract(sin(dot(cell + floor(v_bldgId * 43.0), vec2(127.1, 311.7))) * 43758.5453);
              float lit = step(0.54, hSeed);
              vec3 winLight = mix(vec3(1.0, 0.86, 0.58), vec3(0.76, 0.91, 1.0), step(0.78, hSeed));
              col = mix(col, winLight, lit * glassMask * clamp(u_nightGlow * 0.88, 0.0, 0.90) * detailLod);
            }
          } else {
            // Delhi residential & heritage masonry facades: punched bays or balcony ribbons + sandstone sills
            float winMinX = v_bldgId > 0.58 ? 0.14 : 0.23;
            float winMaxX = v_bldgId > 0.58 ? 0.86 : 0.77;
            float paneY = smoothstep(0.24, 0.33, fRow) * (1.0 - smoothstep(0.73, 0.82, fRow));
            float paneX = smoothstep(winMinX - 0.07, winMinX + 0.02, fCol) * (1.0 - smoothstep(winMaxX - 0.02, winMaxX + 0.07, fCol));
            float glassMask = paneX * paneY;
            float sillLine = smoothstep(0.17, 0.23, fRow) * (1.0 - smoothstep(0.24, 0.30, fRow)) * paneX;
            vec3 winRecess = mix(vec3(0.17, 0.23, 0.30), vec3(0.32, 0.44, 0.56), u_skyReflect * 0.52) * mix(u_ambTint, u_sunTint, v_dirFactor * 0.45);
            col = mix(col, col * 1.09 + vec3(0.028), sillLine * 0.55 * detailLod * u_facadeDetail);
            col = mix(col, winRecess, glassMask * 0.66 * detailLod * u_facadeDetail);

            if (u_nightGlow > 0.03) {
              vec2 cell = vec2(floor(v_wallU / bayW), floor(heightRel / floorH));
              float hSeed = fract(sin(dot(cell + floor(v_bldgId * 37.0), vec2(91.3, 271.9))) * 29543.13);
              float lit = step(0.68, hSeed);
              vec3 winLight = mix(vec3(1.0, 0.84, 0.54), vec3(0.86, 0.93, 1.0), step(0.86, hSeed));
              col = mix(col, winLight, lit * glassMask * clamp(u_nightGlow * 0.82, 0.0, 0.88) * detailLod);
            }
          }
        }
      } else if (v_isWall < 0.5) {
        // Clean architectural roofs: warm terracotta/limestone terraces & cool commercial gravel decks (never olive!)
        float isWarm = smoothstep(0.0, 0.06, v_color.r - v_color.b);
        vec3 neutralRoof = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))), 0.18) * 1.03 + vec3(0.024, 0.022, 0.020);
        vec3 terracottaRoof = col * vec3(1.04, 0.99, 0.95) + vec3(0.025, 0.012, 0.004);
        vec3 slateRoof = mix(col, vec3(0.63, 0.68, 0.75), 0.36);
        col = mix(neutralRoof, terracottaRoof, isWarm * 0.65);
        col = mix(col, slateRoof, isGlassTower * 0.80);

        if (detailLod > 0.02) {
          vec2 rm = v_tilePos * u_metersPerTileUnit;
          float rx = smoothstep(0.05, 0.12, fract(rm.x * 0.20));
          float ry = smoothstep(0.05, 0.12, fract(rm.y * 0.20));
          col = mix(col * 0.93, col, mix(1.0, rx * ry, 0.38 * detailLod));

          // Rooftop solar panel / water-tank / HVAC penthouse accents
          vec2 rCell = floor(rm * 0.09);
          vec2 rUv = fract(rm * 0.09);
          float rHash = fract(sin(dot(rCell + floor(v_bldgId * 31.0), vec2(53.1, 97.7))) * 18432.7);
          if (v_h >= 6.8 && rHash > 0.74) {
            float padX = smoothstep(0.18, 0.24, rUv.x) * (1.0 - smoothstep(0.68, 0.74, rUv.x));
            float padY = smoothstep(0.22, 0.28, rUv.y) * (1.0 - smoothstep(0.72, 0.78, rUv.y));
            float padRim = smoothstep(0.14, 0.19, rUv.x) * (1.0 - smoothstep(0.73, 0.78, rUv.x)) *
                           smoothstep(0.18, 0.23, rUv.y) * (1.0 - smoothstep(0.77, 0.82, rUv.y));
            float isPanel = step(0.86, rHash);
            vec3 unitCol = isPanel > 0.5 ? vec3(0.23, 0.34, 0.49) : mix(vec3(0.74, 0.76, 0.79), vec3(0.30, 0.35, 0.42), u_nightGlow * 0.75);
            col = mix(col, col * 0.86, max(0.0, padRim - padX * padY) * 0.65 * detailLod);
            col = mix(col, unitCol, padX * padY * 0.72 * detailLod);
          }
        }
        col = min(col, mix(vec3(0.95, 0.94, 0.92), vec3(0.30, 0.36, 0.46), u_nightGlow * 0.78));
      }

      // X-Ray glass tint when buildings become translucent
      if (u_opacity < 0.95) {
        col = mix(col, vec3(0.72, 0.83, 0.94), 0.42);
      }

      // Gentle distant atmospheric aerial perspective (keeps front-side horizon skyline crisp)
      float fogAmt = smoothstep(u_fogStart, u_fogEnd, dRatio) * 0.56;
      col = mix(col, u_fogColor, fogAmt);

      gl_FragColor = vec4(col, u_opacity);
    }`;

  const SHAD_VS = `
    uniform mat4 u_matrix;
    uniform vec2 u_shadowOff;
    uniform float u_heightScale;
    attribute vec2 a_pos;
    attribute vec4 a_normal_ed;
    ${HEIGHT_ATTRS}
    void main() {
      float t = mod(a_normal_ed.x, 2.0);
      float h = mix(FE(a_base_f, a_base_v, u_bt), FE(a_height_f, a_height_v, u_ht), t) * u_heightScale;
      gl_Position = u_matrix * vec4(a_pos + u_shadowOff * h, 0.0, 1.0);
    }`;

  const SHAD_FS = `
    precision highp float;
    void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }`;

  const SEED_VS = `
    uniform mat4 u_matrix;
    attribute vec2 a_pos;
    void main() { gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0); }`;

  const SEED_FS = `
    precision highp float;
    uniform vec2 u_res;
    void main() { gl_FragColor = vec4(gl_FragCoord.xy / u_res, 0.0, 1.0); }`;

  const JFA_VS = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  const JFA_FS = `
    precision highp float;
    uniform sampler2D u_tex;
    uniform float u_stride;
    uniform vec2 u_texel;
    varying vec2 v_uv;
    void main() {
      vec2 best = vec2(0.0);
      float bestD = 1e10, found = 0.0;
      for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
          vec2 uv = v_uv + vec2(float(dx), float(dy)) * u_stride * u_texel;
          if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
            vec4 s = texture2D(u_tex, uv);
            if (s.a > 0.5) {
              float d = distance(v_uv, s.rg);
              if (d < bestD) { bestD = d; best = s.rg; found = 1.0; }
            }
          }
        }
      }
      gl_FragColor = found > 0.5 ? vec4(best, 0.0, 1.0) : vec4(0.0);
    }`;

  const COMP_FS = `
    precision highp float;
    uniform sampler2D u_sdf, u_shadow;
    uniform float u_radius, u_intensity, u_shadowAlpha;
    uniform vec2 u_offset, u_blurStep;
    uniform vec3 u_shadowColor;
    varying vec2 v_uv;
    void main() {
      float sh = 0.0, sw = 0.0;
      vec2 step2 = u_blurStep * 1.45;
      for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
          float d2 = float(dx * dx + dy * dy);
          float w = d2 < 0.5 ? 1.0 : (d2 < 1.5 ? 0.62 : 0.38);
          sh += texture2D(u_shadow, v_uv + vec2(float(dx), float(dy)) * step2).a * w;
          sw += w;
        }
      }
      float shadow = (sh / sw) * u_shadowAlpha;

      vec2 uv = v_uv - u_offset;
      vec4 s = texture2D(u_sdf, uv);
      float ao = 0.0;
      if (s.a > 0.5) {
        float d = distance(uv, s.rg);
        if (d < u_radius) {
          ao = exp(-3.0 * d / u_radius) * u_intensity;
        }
      }
      float combined = 1.0 - (1.0 - shadow) * (1.0 - ao);
      if (combined < 0.002) discard;
      gl_FragColor = vec4(u_shadowColor, combined);
    }`;

  function compileShader(gl, type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[WallShadowLayer] shader compile:', gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function linkProgram(gl, vSrc, fSrc) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, vSrc));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, fSrc));
    Object.keys(LOC).forEach((name) => {
      gl.bindAttribLocation(prog, LOC[name], name);
    });
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[WallShadowLayer] program link:', gl.getProgramInfoLog(prog));
    }
    return prog;
  }

  function uniformLocs(gl, prog, names) {
    const out = {};
    names.forEach((n) => { out[n] = gl.getUniformLocation(prog, n); });
    return out;
  }

  function createTexture(gl, size, useFloat, filter) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const ifmt = useFloat ? (gl.RGBA32F || gl.RGBA) : gl.RGBA;
    const type = useFloat ? gl.FLOAT : gl.UNSIGNED_BYTE;
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, size, size, 0, gl.RGBA, type, null);
    const filt = filter || gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    return tex;
  }

  function beginPass(gl, fbo, size, opts) {
    const stencil = opts && opts.stencil;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, size, size);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    if (stencil) {
      gl.enable(gl.STENCIL_TEST);
      gl.stencilMask(0xFF);
      gl.clearStencil(0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    } else {
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  function drawQuad(gl, quadBuf) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(LOC.a_pos);
    gl.vertexAttribPointer(LOC.a_pos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function saveGlState(gl) {
    return {
      fbo: gl.getParameter(gl.FRAMEBUFFER_BINDING),
      vp: gl.getParameter(gl.VIEWPORT),
      depth: gl.isEnabled(gl.DEPTH_TEST),
      depthFunc: gl.getParameter(gl.DEPTH_FUNC),
      depthMask: gl.getParameter(gl.DEPTH_WRITEMASK),
      depthRange: gl.getParameter(gl.DEPTH_RANGE),
      stencil: gl.isEnabled(gl.STENCIL_TEST),
      stencilFunc: gl.getParameter(gl.STENCIL_FUNC),
      stencilRef: gl.getParameter(gl.STENCIL_REF),
      stencilValueMask: gl.getParameter(gl.STENCIL_VALUE_MASK),
      stencilWriteMask: gl.getParameter(gl.STENCIL_WRITEMASK),
      stencilOp: [
        gl.getParameter(gl.STENCIL_FAIL),
        gl.getParameter(gl.STENCIL_PASS_DEPTH_FAIL),
        gl.getParameter(gl.STENCIL_PASS_DEPTH_PASS)
      ],
      blend: gl.isEnabled(gl.BLEND),
      cull: gl.isEnabled(gl.CULL_FACE),
      cullFace: gl.getParameter(gl.CULL_FACE_MODE),
      frontFace: gl.getParameter(gl.FRONT_FACE),
      vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING)
    };
  }

  function restoreGlState(gl, s) {
    const en = (cap, on) => { if (on) gl.enable(cap); else gl.disable(cap); };
    gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo);
    gl.viewport(s.vp[0], s.vp[1], s.vp[2], s.vp[3]);
    gl.depthFunc(s.depthFunc);
    gl.depthMask(s.depthMask);
    gl.depthRange(s.depthRange[0], s.depthRange[1]);
    gl.stencilFunc(s.stencilFunc, s.stencilRef, s.stencilValueMask);
    gl.stencilMask(s.stencilWriteMask);
    gl.stencilOp(s.stencilOp[0], s.stencilOp[1], s.stencilOp[2]);
    en(gl.DEPTH_TEST, s.depth);
    en(gl.STENCIL_TEST, s.stencil);
    en(gl.BLEND, s.blend);
    en(gl.CULL_FACE, s.cull);
    gl.cullFace(s.cullFace);
    gl.frontFace(s.frontFace);
  }

  function zoomFactor(map, coord) {
    const z = coord.overscaledZ != null ? coord.overscaledZ : (coord.canonical && coord.canonical.z) || 14;
    return Math.min(1, Math.max(0, map.getZoom() - z));
  }

  function canonicalsOverlap(a, b) {
    if (!a || !b) return false;
    if (a.z === b.z) return a.x === b.x && a.y === b.y;
    if (a.z > b.z) {
      const shift = a.z - b.z;
      return (a.x >> shift) === b.x && (a.y >> shift) === b.y;
    }
    const shift = b.z - a.z;
    return (b.x >> shift) === a.x && (b.y >> shift) === a.y;
  }

  class WallShadowLayer {
    constructor(opts) {
      opts = opts || {};
      this.id = opts.id || 'wallshadow';
      this.type = 'custom';
      this.renderingMode = '2d';
      this._layerId = opts.buildingsLayerId;
      this._sourceId = opts.sourceId || null;
      this._fallbackLayerId = opts.fallbackLayerId || null;
      this._fallbackSourceId = opts.fallbackSourceId || null;
      this._minZoom = opts.minZoom != null ? opts.minZoom : 12.6;
      this._maxZoom = opts.maxZoom != null ? opts.maxZoom : 20;
      this._onRenderTiles = typeof opts.onRenderTiles === 'function' ? opts.onRenderTiles : null;

      this.enabled = opts.enabled != null ? opts.enabled : true;
      this.wallShade = opts.wallShade != null ? opts.wallShade : true;
      this.groundFx = opts.groundFx != null ? opts.groundFx : true;

      this.strength = opts.strength != null ? opts.strength : 0.34;
      this.band = opts.band != null ? opts.band : 0.85;
      this.facadeDetail = opts.facadeDetail != null ? opts.facadeDetail : 0.85;
      this._height = opts.height != null ? opts.height : 12;
      this._base = opts.base != null ? opts.base : 0;

      // Ground directional shadow defaults tuned for Delhi warm SE sun (casting NW)
      this.shadowAlpha = opts.shadowAlpha != null ? opts.shadowAlpha : 0.24;
      this._heightScale = opts.heightScale != null ? opts.heightScale : 0.48;
      this.shadowOffset = opts.shadowOffset ? opts.shadowOffset.slice() : [-0.62, -0.48];
      this.shadowBlur = opts.shadowBlur != null ? opts.shadowBlur : 2.2;
      this.shadowColor = opts.shadowColor ? opts.shadowColor.slice() : [0.09, 0.11, 0.15];

      this._sdfRes = opts.sdfResolution != null ? opts.sdfResolution : 512;
      this._stickyMax = opts.stickyCacheMax != null ? opts.stickyCacheMax : 64;
      this.aoRadiusMin = opts.aoRadiusMin != null ? opts.aoRadiusMin : 16;
      this.aoRadiusMax = opts.aoRadiusMax != null ? opts.aoRadiusMax : 56;
      this.aoIntensity = opts.aoIntensity != null ? opts.aoIntensity : 0.38;
      this.aoOffset = opts.aoOffset ? opts.aoOffset.slice() : [0, -1, -2];

      // Dynamic Solar / Atmosphere / X-Ray uniforms
      this.fogColor = opts.fogColor ? opts.fogColor.slice() : [0.922, 0.902, 0.855];
      this.fogStart = opts.fogStart != null ? opts.fogStart : 3.60;
      this.fogEnd = opts.fogEnd != null ? opts.fogEnd : 9.80;
      this.nightGlow = opts.nightGlow != null ? opts.nightGlow : 0.0;
      this.opacity = opts.opacity != null ? opts.opacity : 1.0;
      this.sunTint = opts.sunTint ? opts.sunTint.slice() : [1.03, 1.01, 0.97];
      this.ambTint = opts.ambTint ? opts.ambTint.slice() : [0.78, 0.84, 0.92];
      this.skyReflect = opts.skyReflect != null ? opts.skyReflect : 0.78;

      this.lastRenderedTileCount = 0;
      this.lastPrimaryTileCount = 0;
      this.lastFallbackTileCount = 0;
      this._cachedGroundSig = null;
      this._stickyPrimary = new Map();
      this._stickyFallback = new Map();
    }

    setEnvironment(cfg) {
      if (!cfg) return;
      let groundDirty = false;
      if (Array.isArray(cfg.shadowOffset)) {
        const dx = Math.abs(this.shadowOffset[0] - cfg.shadowOffset[0]);
        const dy = Math.abs(this.shadowOffset[1] - cfg.shadowOffset[1]);
        if (dx > 0.02 || dy > 0.02) {
          this.shadowOffset[0] = cfg.shadowOffset[0];
          this.shadowOffset[1] = cfg.shadowOffset[1];
          groundDirty = true;
        }
      }
      if (cfg.shadowAlpha != null && Math.abs(this.shadowAlpha - cfg.shadowAlpha) > 0.005) {
        this.shadowAlpha = cfg.shadowAlpha;
      }
      if (cfg.heightScale != null && Math.abs(this._heightScale - cfg.heightScale) > 0.01) {
        this._heightScale = cfg.heightScale;
        groundDirty = true;
      }
      if (cfg.aoIntensity != null) this.aoIntensity = cfg.aoIntensity;
      if (Array.isArray(cfg.shadowColor)) this.shadowColor = cfg.shadowColor.slice();
      if (Array.isArray(cfg.fogColor)) this.fogColor = cfg.fogColor.slice();
      if (cfg.fogStart != null) this.fogStart = cfg.fogStart;
      if (cfg.fogEnd != null) this.fogEnd = cfg.fogEnd;
      if (cfg.nightGlow != null) this.nightGlow = cfg.nightGlow;
      if (cfg.opacity != null) this.opacity = cfg.opacity;
      if (Array.isArray(cfg.sunTint)) this.sunTint = cfg.sunTint.slice();
      if (Array.isArray(cfg.ambTint)) this.ambTint = cfg.ambTint.slice();
      if (cfg.skyReflect != null) this.skyReflect = cfg.skyReflect;
      if (groundDirty) this._cachedGroundSig = null;
    }

    setTarget(buildingsLayerId, sourceId) {
      if (this._layerId === buildingsLayerId && this._sourceId === sourceId) return;
      this._layerId = buildingsLayerId;
      this._sourceId = sourceId;
      this.lastRenderedTileCount = 0;
      this.lastPrimaryTileCount = 0;
      this.lastFallbackTileCount = 0;
      this._cachedGroundSig = null;
      this._stickyPrimary = new Map();
      this._stickyFallback = new Map();
    }

    setFallback(fallbackLayerId, fallbackSourceId) {
      if (this._fallbackLayerId === fallbackLayerId && this._fallbackSourceId === fallbackSourceId) return;
      this._fallbackLayerId = fallbackLayerId || null;
      this._fallbackSourceId = fallbackSourceId || null;
      this._cachedGroundSig = null;
    }

    onAdd(map, gl) {
      this._map = map;
      this._gl = gl;
      this._cachedGroundSig = null;
      this._vao = {
        create: () => gl.createVertexArray(),
        bind: (v) => gl.bindVertexArray(v)
      };
      // Compile WebGL programs & allocate JFA/shadow FBOs lazily on first zoom >= 12.6 draw
      this._buildProg = null;
      this._shadProg = null;
      this._seedProg = null;
      this._jfaProg = null;
      this._compProg = null;
      this._groundReady = false;
    }

    _ensureBuildProg(gl) {
      if (this._buildProg) return;
      this._buildProg = linkProgram(gl, BUILD_VS, BUILD_FS);
      this._uBuild = uniformLocs(gl, this._buildProg, [
        'u_matrix', 'u_ht', 'u_bt', 'u_ct', 'u_band', 'u_strength',
        'u_lightpos', 'u_lightintensity', 'u_facadeDetail',
        'u_metersPerTileUnit', 'u_tileBias', 'u_camDist', 'u_zoom',
        'u_fogColor', 'u_fogStart', 'u_fogEnd', 'u_nightGlow',
        'u_opacity', 'u_sunTint', 'u_ambTint', 'u_skyReflect'
      ]);
    }

    _ensureGroundResources(gl) {
      if (this._groundReady) return;
      this._groundReady = true;
      this._shadProg = linkProgram(gl, SHAD_VS, SHAD_FS);
      this._uShad = uniformLocs(gl, this._shadProg, [
        'u_matrix', 'u_shadowOff', 'u_heightScale', 'u_ht', 'u_bt'
      ]);
      this._seedProg = linkProgram(gl, SEED_VS, SEED_FS);
      this._uSeed = uniformLocs(gl, this._seedProg, ['u_matrix', 'u_res']);
      this._jfaProg = linkProgram(gl, JFA_VS, JFA_FS);
      this._uJfa = uniformLocs(gl, this._jfaProg, ['u_tex', 'u_stride', 'u_texel']);
      this._compProg = linkProgram(gl, JFA_VS, COMP_FS);
      this._uComp = uniformLocs(gl, this._compProg, [
        'u_sdf', 'u_shadow', 'u_radius', 'u_intensity', 'u_shadowAlpha', 'u_offset', 'u_blurStep', 'u_shadowColor'
      ]);

      const N = this._sdfRes;
      this._useFloat = !!gl.getExtension('EXT_color_buffer_float');
      this._tex = [
        createTexture(gl, N, this._useFloat),
        createTexture(gl, N, this._useFloat),
        createTexture(gl, N, false, gl.LINEAR)
      ];

      this._fbo = [gl.createFramebuffer(), gl.createFramebuffer(), gl.createFramebuffer()];
      for (let i = 0; i < 3; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo[i]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._tex[i], 0);
      }
      this._stencilRB = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, this._stencilRB);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, N, N);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo[2]);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this._stencilRB);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      this._quadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    }

    _resolveSource(sourceId, layerId) {
      let sid = sourceId !== undefined ? sourceId : this._sourceId;
      const lid = layerId !== undefined ? layerId : this._layerId;
      if (!sid && lid) {
        const layer = this._map.getLayer(lid);
        if (layer) sid = layer.source || layer.sourceLayer;
      }
      if (!sid) return null;
      const style = this._map.style;
      if (!style) return null;
      return (style.sourceCaches && style.sourceCaches[sid]) ||
        (style.tileManagers && style.tileManagers[sid]) ||
        null;
    }

    _tileMatrix(coord) {
      const xf = this._map.transform;
      try {
        const pd = xf.getProjectionData({ overscaledTileID: coord, applyTerrainMatrix: true });
        if (pd && pd.mainMatrix) return pd.mainMatrix;
      } catch (_) { }
      try {
        return xf.calculatePosMatrix(coord);
      } catch (_) {
        return null;
      }
    }

    _lightUniforms() {
      const L = this._map.style && this._map.style.light && this._map.style.light.properties;
      if (!L || typeof L.get !== 'function') return { pos: [0.55, 0.62, 0.56], intensity: 0.40 };
      const p = L.get('position');
      let x = p && p.x != null ? p.x : (Array.isArray(p) ? p[0] : 0.55);
      let y = p && p.y != null ? p.y : (Array.isArray(p) ? p[1] : 0.62);
      const z = p && p.z != null ? p.z : (Array.isArray(p) ? p[2] : 0.56);
      if (L.get('anchor') === 'viewport') {
        const th = this._map.transform.bearingInRadians || 0;
        const nx = x * Math.cos(th) - y * Math.sin(th);
        const ny = x * Math.sin(th) + y * Math.cos(th);
        x = nx; y = ny;
      }
      const len = Math.hypot(x, y, z) || 1;
      return { pos: [x / len, y / len, z / len], intensity: L.get('intensity') || 0.40 };
    }

    _segVaos(gl, bucket, layerId) {
      const targetLayerId = layerId || this._layerId;
      const key = '_wshVao_' + (targetLayerId || 'default');
      if (bucket[key]) return bucket[key];
      const pcs = bucket.programConfigurations && bucket.programConfigurations.programConfigurations;
      const cfg = pcs ? pcs[targetLayerId] : null;
      const findBuf = (name) => {
        if (!cfg || !cfg._buffers) return null;
        return cfg._buffers.find((b) => b.attributes && b.attributes.some((a) => a.name === name)) || null;
      };
      const dyn = (name, fLoc, vLoc, defComp) => {
        const buf = findBuf(name);
        const attr = buf && buf.attributes ? buf.attributes.find((a) => a.name === name) : null;
        const comp = buf ? (attr && attr.components ? attr.components : defComp) : 0;
        return { buf: buf ? buf.buffer : null, loc: comp === defComp ? fLoc : vLoc, comp };
      };

      const hD = dyn('a_height', LOC.a_height_f, LOC.a_height_v, 1);
      const bD = dyn('a_base', LOC.a_base_f, LOC.a_base_v, 1);
      const cD = dyn('a_color', LOC.a_color, LOC.a_color4, 2);

      const point = (loc, glBuf, comp, type, stride, off) => {
        if (!glBuf) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, glBuf);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, comp, type, false, stride, off);
      };

      if (!bucket.layoutVertexBuffer || !bucket.indexBuffer || !bucket.segments) return null;
      const list = [];
      const segs = typeof bucket.segments.get === 'function' ? bucket.segments.get() : [];
      if (!segs.length) return null;
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const vao = this._vao.create();
        this._vao.bind(vao);
        point(LOC.a_pos, bucket.layoutVertexBuffer.buffer, 2, gl.SHORT, LAYOUT_STRIDE, seg.vertexOffset * LAYOUT_STRIDE);
        point(LOC.a_normal_ed, bucket.layoutVertexBuffer.buffer, 4, gl.SHORT, LAYOUT_STRIDE, seg.vertexOffset * LAYOUT_STRIDE + 4);
        point(hD.loc, hD.buf, hD.comp, gl.FLOAT, hD.comp * 4, seg.vertexOffset * hD.comp * 4);
        point(bD.loc, bD.buf, bD.comp, gl.FLOAT, bD.comp * 4, seg.vertexOffset * bD.comp * 4);
        point(cD.loc, cD.buf, cD.comp, gl.FLOAT, cD.comp * 4, seg.vertexOffset * cD.comp * 4);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bucket.indexBuffer.buffer);
        list.push({ vao, pO: seg.primitiveOffset, pL: seg.primitiveLength });
      }
      this._vao.bind(null);
      bucket[key] = { list, hComp: hD.comp, bComp: bD.comp, cComp: cD.comp };
      return bucket[key];
    }

    _drawSegs(gl, sg) {
      for (let i = 0; i < sg.list.length; i++) {
        const s = sg.list[i];
        this._vao.bind(s.vao);
        gl.drawElements(gl.TRIANGLES, s.pL * 3, gl.UNSIGNED_SHORT, s.pO * 6);
      }
    }

    render(gl) {
      if (!this.enabled || !this._map || this._map.getZoom() < this._minZoom) {
        this.lastRenderedTileCount = 0;
        this.lastPrimaryTileCount = 0;
        this.lastFallbackTileCount = 0;
        if (this._onRenderTiles) this._onRenderTiles(0, { primaryCount: 0, fallbackCount: 0 });
        return;
      }
      const primarySource = this._resolveSource(this._sourceId, this._layerId);
      const primaryLayer = this._layerId ? this._map.getLayer(this._layerId) : null;
      const fallbackSource = (this._fallbackLayerId || this._fallbackSourceId)
        ? this._resolveSource(this._fallbackSourceId, this._fallbackLayerId)
        : null;
      const fallbackLayer = this._fallbackLayerId ? this._map.getLayer(this._fallbackLayerId) : null;

      if ((!primarySource || !primaryLayer) && (!fallbackSource || !fallbackLayer)) {
        this.lastRenderedTileCount = 0;
        this.lastPrimaryTileCount = 0;
        this.lastFallbackTileCount = 0;
        if (this._onRenderTiles) this._onRenderTiles(0, { primaryCount: 0, fallbackCount: 0 });
        return;
      }

      const collectSourceTileCoords = (src) => {
        if (!src || !src._tiles) return [];
        const out = [];
        const vals = Object.values(src._tiles);
        for (let i = 0; i < vals.length; i++) {
          const t = vals[i];
          if (t && t.tileID && t.tileID.canonical && t.state !== 'errored') {
            out.push(t.tileID);
          }
        }
        return out;
      };

      let primaryCoords = [];
      if (primarySource && primaryLayer) {
        try {
          primaryCoords = primarySource.getVisibleCoordinates().slice().reverse();
        } catch (_) {
          primaryCoords = [];
        }
      }

      let fallbackCoords = [];
      if (fallbackSource && fallbackLayer) {
        try {
          fallbackCoords = fallbackSource.getVisibleCoordinates().slice().reverse();
        } catch (_) {
          fallbackCoords = [];
        }
      }

      const primaryTileTableCoords = (primarySource && primaryLayer) ? collectSourceTileCoords(primarySource) : [];
      const fallbackTileTableCoords = (fallbackSource && fallbackLayer) ? collectSourceTileCoords(fallbackSource) : [];

      if (!primaryCoords.length && !fallbackCoords.length && !primaryTileTableCoords.length && !fallbackTileTableCoords.length) {
        this.lastRenderedTileCount = 0;
        this.lastPrimaryTileCount = 0;
        this.lastFallbackTileCount = 0;
        if (this._onRenderTiles) this._onRenderTiles(0, { primaryCount: 0, fallbackCount: 0 });
        return;
      }

      const tiles = [];
      const loadedPrimaryCanonicals = [];
      let primaryCount = 0;
      let fallbackCount = 0;

      const touchSticky = (store, canonKey, entry) => {
        if (!canonKey) return;
        if (store.has(canonKey)) store.delete(canonKey);
        store.set(canonKey, entry);
        if (store.size > this._stickyMax) {
          const oldest = store.keys().next().value;
          store.delete(oldest);
        }
      };

      const hasBucketGeometry = (bucket) => {
        if (!bucket || !bucket.layoutVertexBuffer || !bucket.indexBuffer || !bucket.segments) return false;
        const vb = bucket.layoutVertexBuffer.buffer;
        const ib = bucket.indexBuffer.buffer;
        if (!vb || !ib || !gl.isBuffer(vb) || !gl.isBuffer(ib)) return false;
        const segs = typeof bucket.segments.get === 'function' ? bucket.segments.get() : null;
        return !!(segs && segs.length > 0);
      };

      const inspectCachedTile = (t, layer, targetCanon) => {
        const tc = t && t.tileID && t.tileID.canonical;
        if (!tc || tc.z !== targetCanon.z || tc.x !== targetCanon.x || tc.y !== targetCanon.y) return null;
        if (t.state !== 'loaded' && t.state !== 'reloading') return null;
        const b = typeof t.getBucket === 'function' ? t.getBucket(layer) : null;
        return hasBucketGeometry(b) ? { coord: t.tileID, tile: t, bucket: b } : null;
      };

      const findSourceCachedBucket = (src, layer, targetCanon) => {
        if (!src || !layer || !targetCanon) return null;
        if (src._tiles) {
          const vals = Object.values(src._tiles);
          for (let i = 0; i < vals.length; i++) {
            const hit = inspectCachedTile(vals[i], layer, targetCanon);
            if (hit) return hit;
          }
        }
        if (src._cache && src._cache.data) {
          const cacheVals = Object.values(src._cache.data);
          for (let i = 0; i < cacheVals.length; i++) {
            const slot = cacheVals[i];
            if (Array.isArray(slot)) {
              for (let j = 0; j < slot.length; j++) {
                const hit = inspectCachedTile(slot[j] && slot[j].value, layer, targetCanon);
                if (hit) return hit;
              }
            } else {
              const hit = inspectCachedTile((slot && slot.value) || slot, layer, targetCanon);
              if (hit) return hit;
            }
          }
        }
        return null;
      };

      const getValidSticky = (store, canonKey) => {
        if (!canonKey) return null;
        const entry = store.get(canonKey);
        if (!entry || !hasBucketGeometry(entry.bucket)) {
          store.delete(canonKey);
          return null;
        }
        return entry;
      };

      const pushResolvedTile = (picked, layerId, isFallback) => {
        const m = this._tileMatrix(picked.coord);
        if (!m) return false;
        tiles.push({
          coord: picked.coord,
          tile: picked.tile,
          bucket: picked.bucket,
          layerId,
          isFallback,
          matrix: m instanceof Float32Array ? m : new Float32Array(m),
          zf: zoomFactor(this._map, picked.coord)
        });
        if (isFallback) fallbackCount++;
        else primaryCount++;
        return true;
      };

      const isCoveredByCanonicals = (canon, list) => {
        if (!canon || !list.length) return false;
        for (let j = 0; j < list.length; j++) {
          if (list[j].z >= canon.z && canonicalsOverlap(canon, list[j])) {
            return true;
          }
        }
        return false;
      };

      const seenPrimaryCanons = new Set();
      for (let i = 0; i < primaryCoords.length; i++) {
        const coord = primaryCoords[i];
        const canonKey = coord && coord.canonical ? `${coord.canonical.z}/${coord.canonical.x}/${coord.canonical.y}` : '';
        if (canonKey && seenPrimaryCanons.has(canonKey)) continue;
        try {
          const tile = primarySource.getTile(coord);
          const bucket = tile && typeof tile.getBucket === 'function' ? tile.getBucket(primaryLayer) : null;
          const isReadyTile = !!tile && hasBucketGeometry(bucket) && (tile.state === 'loaded' || tile.state === 'reloading');

          let picked = null;
          if (isReadyTile) {
            picked = { coord, tile, bucket };
            touchSticky(this._stickyPrimary, canonKey, picked);
          } else {
            // Keep previously compiled overscaled bucket pinned while worker builds the new overscaledZ bucket
            picked = findSourceCachedBucket(primarySource, primaryLayer, coord.canonical) || getValidSticky(this._stickyPrimary, canonKey);
          }

          if (picked && pushResolvedTile(picked, this._layerId, false)) {
            if (canonKey) seenPrimaryCanons.add(canonKey);
            if (picked.coord && picked.coord.canonical) {
              loadedPrimaryCanonicals.push(picked.coord.canonical);
            }
          }
        } catch (_) { }
      }

      // Preserve already-cached primary tiles whose active viewport slot is still loading under a new overscaledZ
      if (primarySource && primaryLayer) {
        const extraPrimaryCandidates = primaryTileTableCoords.concat(fallbackCoords)
          .filter((c) => c && c.canonical)
          .sort((a, b) => b.canonical.z - a.canonical.z);
        for (let i = 0; i < extraPrimaryCandidates.length; i++) {
          const ec = extraPrimaryCandidates[i];
          const canonKey = `${ec.canonical.z}/${ec.canonical.x}/${ec.canonical.y}`;
          if (seenPrimaryCanons.has(canonKey)) continue;
          if (isCoveredByCanonicals(ec.canonical, loadedPrimaryCanonicals)) continue;
          // Avoid pinning a lower-z parent over an active higher-z viewport tile
          const hasHigherActive = extraPrimaryCandidates.some((other) =>
            other.canonical.z > ec.canonical.z && canonicalsOverlap(ec.canonical, other.canonical)
          );
          if (hasHigherActive) continue;
          try {
            const picked = findSourceCachedBucket(primarySource, primaryLayer, ec.canonical) || getValidSticky(this._stickyPrimary, canonKey);
            if (picked && pushResolvedTile(picked, this._layerId, false)) {
              touchSticky(this._stickyPrimary, canonKey, picked);
              seenPrimaryCanons.add(canonKey);
              if (picked.coord && picked.coord.canonical) {
                loadedPrimaryCanonicals.push(picked.coord.canonical);
              }
            }
          } catch (_) { }
        }
      }

      if (fallbackSource && fallbackLayer) {
        const seenFallbackCanons = new Set();
        const loadedFallbackCanonicals = [];
        const activePrimaryKeys = new Set(
          primaryTileTableCoords
            .filter((c) => c && c.canonical)
            .map((c) => `${c.canonical.z}/${c.canonical.x}/${c.canonical.y}`)
        );
        const sortedExtraFb = fallbackTileTableCoords
          .filter((c) => c && c.canonical && activePrimaryKeys.has(`${c.canonical.z}/${c.canonical.x}/${c.canonical.y}`))
          .sort((a, b) => b.canonical.z - a.canonical.z);
        const fbCandidates = fallbackCoords.concat(sortedExtraFb);
        for (let i = 0; i < fbCandidates.length; i++) {
          const fc = fbCandidates[i];
          const canonKey = fc && fc.canonical ? `${fc.canonical.z}/${fc.canonical.x}/${fc.canonical.y}` : '';
          if (canonKey && seenFallbackCanons.has(canonKey)) continue;
          try {
            if (isCoveredByCanonicals(fc.canonical, loadedPrimaryCanonicals)) continue;
            const fromVisible = i < fallbackCoords.length;
            if (!fromVisible) {
              if (isCoveredByCanonicals(fc.canonical, loadedFallbackCanonicals)) continue;
              const hasHigherActiveFb = fbCandidates.some((other) =>
                other && other.canonical && other.canonical.z > fc.canonical.z && canonicalsOverlap(fc.canonical, other.canonical)
              );
              if (hasHigherActiveFb) continue;
            }
            let picked = null;
            if (fromVisible) {
              const tile = fallbackSource.getTile(fc);
              const bucket = tile && typeof tile.getBucket === 'function' ? tile.getBucket(fallbackLayer) : null;
              const isReadyFb = !!tile && hasBucketGeometry(bucket) && (tile.state === 'loaded' || tile.state === 'reloading');
              if (isReadyFb) {
                picked = { coord: fc, tile, bucket };
              }
            }
            if (!picked) {
              picked = findSourceCachedBucket(fallbackSource, fallbackLayer, fc.canonical) || getValidSticky(this._stickyFallback, canonKey);
            }
            if (picked && pushResolvedTile(picked, this._fallbackLayerId, true)) {
              touchSticky(this._stickyFallback, canonKey, picked);
              if (canonKey) seenFallbackCanons.add(canonKey);
              if (picked.coord && picked.coord.canonical) {
                loadedFallbackCanonicals.push(picked.coord.canonical);
              }
            }
          } catch (_) { }
        }
      }

      this.lastRenderedTileCount = tiles.length;
      this.lastPrimaryTileCount = primaryCount;
      this.lastFallbackTileCount = fallbackCount;
      if (this._onRenderTiles) this._onRenderTiles(tiles.length, { primaryCount, fallbackCount });
      if (!tiles.length) return;

      const saved = saveGlState(gl);
      gl.disable(gl.RASTERIZER_DISCARD);

      const H = this._height;
      const B = this._base;
      const W = 65535;
      gl.vertexAttrib1f(LOC.a_height_f, H);
      gl.vertexAttrib2f(LOC.a_height_v, H, H);
      gl.vertexAttrib1f(LOC.a_base_f, B);
      gl.vertexAttrib2f(LOC.a_base_v, B, B);
      gl.vertexAttrib2f(LOC.a_color, W, W);
      gl.vertexAttrib4f(LOC.a_color4, W, W, W, W);

      if (this.groundFx && this._map.getZoom() >= 13.8 && this._map.getPitch() > 8) {
        this._ensureGroundResources(gl);
        const c = this._map.getCenter();
        const z = this._map.getZoom();
        const b = this._map.getBearing();
        const p = this._map.getPitch();
        const vp = saved.vp;
        let tKey = '';
        for (let i = 0; i < tiles.length; i++) {
          const segs = tiles[i].bucket && tiles[i].bucket.segments && typeof tiles[i].bucket.segments.get === 'function'
            ? tiles[i].bucket.segments.get().length
            : 0;
          const k = (tiles[i].tileID && tiles[i].tileID.key) || (tiles[i].coord && tiles[i].coord.key) || (tiles[i].canonical && tiles[i].canonical.key) || i;
          tKey += `${k}:${tiles[i].layerId}:${segs};`;
        }
        const sig = `${c.lng.toFixed(6)},${c.lat.toFixed(6)},${z.toFixed(4)},${b.toFixed(2)},${p.toFixed(2)},${vp[2]}x${vp[3]},${this._layerId},${this._fallbackLayerId || ''},${tKey}`;
        if (sig !== this._cachedGroundSig) {
          this._shadowPass(gl, tiles);
          this._seedPass(gl, tiles);
          this._jfaPass(gl);
          this._cachedGroundSig = sig;
        }
        this._compPass(gl, saved);
      }
      if (this.wallShade) {
        this._buildingPass(gl, tiles);
      }

      restoreGlState(gl, saved);
      this._vao.bind(saved.vao);

      const ctx = this._map.painter && this._map.painter.context;
      if (ctx) {
        ['program', 'bindVertexBuffer', 'bindElementBuffer', 'bindVertexArray',
          'depthMask', 'depthFunc', 'depthRange', 'activeTexture', 'bindTexture',
          'stencilFunc', 'stencilOp', 'blend', 'blendFunc', 'cullFace'].forEach((k) => {
            if (ctx[k]) ctx[k].dirty = true;
          });
      }
    }

    _shadowPass(gl, tiles) {
      const U = this._uShad;
      beginPass(gl, this._fbo[2], this._sdfRes, { stencil: true });
      gl.stencilFunc(gl.EQUAL, 0, 0xFF);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);

      gl.useProgram(this._shadProg);
      gl.uniform1f(U.u_heightScale, this._heightScale);

      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        const sg = this._segVaos(gl, t.bucket, t.layerId);
        if (!sg) continue;
        gl.uniformMatrix4fv(U.u_matrix, false, t.matrix);
        const zTile = (t.coord.canonical && t.coord.canonical.z != null) ? t.coord.canonical.z : t.coord.overscaledZ;
        const s = Math.pow(2, zTile) / (t.tile.tileSize || 512) / 8;
        gl.uniform2f(U.u_shadowOff, this.shadowOffset[0] * s, this.shadowOffset[1] * s);
        gl.uniform1f(U.u_ht, sg.hComp === 2 ? t.zf : -1);
        gl.uniform1f(U.u_bt, sg.bComp === 2 ? t.zf : -1);
        this._drawSegs(gl, sg);
      }
      this._vao.bind(null);
      gl.disable(gl.STENCIL_TEST);
    }

    _seedPass(gl, tiles) {
      const U = this._uSeed;
      beginPass(gl, this._fbo[0], this._sdfRes, { stencil: false });
      gl.useProgram(this._seedProg);
      gl.uniform2f(U.u_res, this._sdfRes, this._sdfRes);

      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        const sg = this._segVaos(gl, t.bucket, t.layerId);
        if (!sg) continue;
        gl.uniformMatrix4fv(U.u_matrix, false, t.matrix);
        this._drawSegs(gl, sg);
      }
      this._vao.bind(null);
      this._readIdx = 0;
    }

    _jfaPass(gl) {
      const N = this._sdfRes;
      const U = this._uJfa;
      this._vao.bind(null);

      gl.useProgram(this._jfaProg);
      gl.uniform2f(U.u_texel, 1 / N, 1 / N);
      gl.uniform1i(U.u_tex, 0);

      let read = 0;
      for (let stride = N >> 1; stride >= 1; stride >>= 1) {
        const write = 1 - read;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo[write]);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._tex[read]);
        gl.uniform1f(U.u_stride, stride);
        drawQuad(gl, this._quadBuf);
        read = write;
      }
      this._readIdx = read;
    }

    _compPass(gl, saved) {
      const U = this._uComp;
      const vp = saved.vp;

      gl.bindFramebuffer(gl.FRAMEBUFFER, saved.fbo);
      gl.viewport(vp[0], vp[1], vp[2], vp[3]);
      this._vao.bind(null);
      gl.useProgram(this._compProg);

      const vw = vp[2];
      const vh = vp[3];
      const zoom = this._map.getZoom();
      const t = Math.min(Math.max((zoom - this._minZoom) / (this._maxZoom - this._minZoom), 0), 1);
      const radiusPx = this.aoRadiusMin + t * (this.aoRadiusMax - this.aoRadiusMin);
      gl.uniform1f(U.u_radius, Math.min(radiusPx / Math.max(vw, vh), 0.16));
      gl.uniform1f(U.u_intensity, this.aoIntensity);
      gl.uniform1f(U.u_shadowAlpha, this.shadowAlpha);

      const blurStep = this.shadowBlur / this._sdfRes;
      gl.uniform2f(U.u_blurStep, blurStep, blurStep);
      gl.uniform3fv(U.u_shadowColor, this.shadowColor);

      const bearing = (this._map.getBearing() * Math.PI) / 180;
      const c = Math.cos(bearing);
      const s = Math.sin(bearing);
      const ox = this.aoOffset[0];
      const oy = this.aoOffset[1];
      const oz = this.aoOffset[2] != null ? this.aoOffset[2] : 0;
      gl.uniform2f(U.u_offset, (ox * c - oy * s) / vw, (ox * s + oy * c + oz) / vh);

      gl.uniform1i(U.u_sdf, 0);
      gl.uniform1i(U.u_shadow, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._tex[this._readIdx]);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this._tex[2]);

      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      drawQuad(gl, this._quadBuf);
    }

    _buildingPass(gl, tiles) {
      this._ensureBuildProg(gl);
      const U = this._uBuild;
      const isXray = this.opacity < 0.98;
      // Restore write masks BEFORE gl.clear(DEPTH_BUFFER_BIT); gl.depthMask(false) from _compPass would otherwise make depth clear a no-op!
      gl.colorMask(true, true, true, true);
      gl.depthMask(true);
      gl.disable(gl.SCISSOR_TEST);
      gl.disable(gl.STENCIL_TEST);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      const dr = this._map.painter && this._map.painter.depthRangeFor3D;
      if (dr) gl.depthRange(dr[0], dr[1]);
      gl.clearDepth(1.0);
      gl.clear(gl.DEPTH_BUFFER_BIT);

      if (isXray) {
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW);
      } else {
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        // Disable backface culling for opaque extrusions because Overture/OSM courtyard rings may vary in winding
        gl.disable(gl.CULL_FACE);
      }

      gl.useProgram(this._buildProg);
      gl.uniform1f(U.u_band, Math.max(0.01, this.band));
      gl.uniform1f(U.u_strength, this.strength);
      gl.uniform1f(U.u_facadeDetail, this.facadeDetail);
      const light = this._lightUniforms();
      gl.uniform3fv(U.u_lightpos, light.pos);
      gl.uniform1f(U.u_lightintensity, light.intensity);

      const camDist = (this._map.transform && this._map.transform.cameraToCenterDistance) || 700.0;
      gl.uniform1f(U.u_camDist, camDist);
      gl.uniform1f(U.u_zoom, this._map.getZoom());
      gl.uniform3fv(U.u_fogColor, this.fogColor);
      gl.uniform1f(U.u_fogStart, this.fogStart);
      gl.uniform1f(U.u_fogEnd, this.fogEnd);
      gl.uniform1f(U.u_nightGlow, this.nightGlow);
      gl.uniform1f(U.u_opacity, this.opacity);
      gl.uniform3fv(U.u_sunTint, this.sunTint);
      gl.uniform3fv(U.u_ambTint, this.ambTint);
      gl.uniform1f(U.u_skyReflect, this.skyReflect);

      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        const sg = this._segVaos(gl, t.bucket, t.layerId);
        if (!sg) continue;
        const zTile = (t.coord.canonical && t.coord.canonical.z != null) ? t.coord.canonical.z : (t.coord.overscaledZ || 14);
        const tx = (t.coord.canonical && t.coord.canonical.x) || 0;
        const ty = (t.coord.canonical && t.coord.canonical.y) || 0;
        const mpu = (40075016.686 * 0.878) / (Math.pow(2, zTile) * 8192);
        gl.uniform1f(U.u_metersPerTileUnit, mpu);
        gl.uniform1f(U.u_tileBias, (((tx * 7 + ty * 13) & 15) - 7.5) * 0.012);
        gl.uniformMatrix4fv(U.u_matrix, false, t.matrix);
        gl.uniform1f(U.u_ht, sg.hComp === 2 ? t.zf : -1);
        gl.uniform1f(U.u_bt, sg.bComp === 2 ? t.zf : -1);
        gl.uniform1f(U.u_ct, sg.cComp === 4 ? t.zf : -1);
        this._drawSegs(gl, sg);
      }
      if (isXray) {
        gl.depthMask(true);
      }
      this._vao.bind(null);
    }

    onRemove(_map, gl) {
      [this._buildProg, this._shadProg, this._seedProg, this._jfaProg, this._compProg].forEach((p) => {
        if (p) gl.deleteProgram(p);
      });
      if (this._fbo) this._fbo.forEach((f) => gl.deleteFramebuffer(f));
      if (this._tex) this._tex.forEach((t) => gl.deleteTexture(t));
      if (this._stencilRB) gl.deleteRenderbuffer(this._stencilRB);
      if (this._quadBuf) gl.deleteBuffer(this._quadBuf);
    }
  }

  global.WallShadowLayer = WallShadowLayer;
})(window);
