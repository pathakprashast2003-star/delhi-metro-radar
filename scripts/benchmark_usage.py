#!/usr/bin/env python3
"""
Mac vs. Mobile Performance & Resource Benchmark for Delhi Metro Radar.

Profiles three environments against http://localhost:8080/:
  1. Mac Desktop Retina (1440x900, 2x DPR)
  2. Mobile Flagship (390x844, 3x DPR, touch, unthrottled)
  3. Mobile Mid-Range (390x844, 3x DPR, touch, 4x CPU throttle + 4G network)

Usage:
  python3 scripts/benchmark_usage.py
  python3 scripts/benchmark_usage.py --url http://localhost:8080/
"""

import argparse
import asyncio
import json
import os
import threading
import time
from playwright.async_api import async_playwright

CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

PROFILES = [
    {
        "name": "Mac Retina (1440x900 @2x)",
        "viewport": {"width": 1440, "height": 900},
        "dpr": 2,
        "is_mobile": False,
        "has_touch": False,
        "cpu_throttle": 1,
        "net_4g": False,
    },
    {
        "name": "Mobile High (390x844 @3x)",
        "viewport": {"width": 390, "height": 844},
        "dpr": 3,
        "is_mobile": True,
        "has_touch": True,
        "cpu_throttle": 1,
        "net_4g": False,
    },
    {
        "name": "Mobile 4xCPU+4G (390x844 @3x)",
        "viewport": {"width": 390, "height": 844},
        "dpr": 3,
        "is_mobile": True,
        "has_touch": True,
        "cpu_throttle": 4,
        "net_4g": True,
    },
]

INIT_PROBE_JS = """(function() {
  window.__bench = {
    drawCallsInFrame: 0,
    threeRenderers: []
  };

  function hookThree() {
    if (!window.THREE || !window.THREE.WebGLRenderer || window.__threeHooked) return false;
    try {
      const OrigRenderer = window.THREE.WebGLRenderer;
      const Wrapped = function(...args) {
        const inst = Reflect.construct(OrigRenderer, args, new.target || OrigRenderer);
        window.__bench.threeRenderers.push(inst);
        return inst;
      };
      Wrapped.prototype = OrigRenderer.prototype;
      Object.setPrototypeOf(Wrapped, OrigRenderer);
      window.THREE.WebGLRenderer = Wrapped;
      window.__threeHooked = true;
      return true;
    } catch (_) {
      return true;
    }
  }
  if (!hookThree()) {
    const t = setInterval(() => { if (hookThree()) clearInterval(t); }, 15);
  }

  // Hook WebGL2 draw calls to count exact GPU draw submissions per frame
  if (window.WebGL2RenderingContext) {
    const p = window.WebGL2RenderingContext.prototype;
    ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'].forEach((fn) => {
      const orig = p[fn];
      if (typeof orig !== 'function') return;
      p[fn] = function() {
        if (window.__bench) window.__bench.drawCallsInFrame++;
        return orig.apply(this, arguments);
      };
    });
  }
})();"""


async def profile_environment(playwright, url: str, prof: dict) -> dict:
    print(f"[bench] Running {prof['name']} ...", flush=True)
    launch_opts = {
        "headless": True,
        "args": ["--headless=new", "--enable-webgl", "--ignore-gpu-blocklist"],
    }
    if os.path.exists(CHROME_PATH):
        launch_opts["executable_path"] = CHROME_PATH

    browser = await playwright.chromium.launch(**launch_opts)
    try:
        return await _profile_inner(browser, url, prof)
    finally:
        try:
            await asyncio.wait_for(browser.close(), timeout=3.0)
        except Exception:
            pass


async def _profile_inner(browser, url: str, prof: dict) -> dict:
    context = await browser.new_context(
        viewport=prof["viewport"],
        device_scale_factor=prof["dpr"],
        is_mobile=prof["is_mobile"],
        has_touch=prof["has_touch"],
    )
    page = await context.new_page()
    await page.add_init_script(INIT_PROBE_JS)

    cdp = await context.new_cdp_session(page)
    await cdp.send("Network.enable")
    await cdp.send("Performance.enable")

    if prof["cpu_throttle"] > 1:
        await cdp.send("Emulation.setCPUThrottlingRate", {"rate": prof["cpu_throttle"]})
    if prof["net_4g"]:
        # Fast 4G-equivalent (~9 Mbps down, 1.5 Mbps up, 70ms RTT)
        await cdp.send(
            "Network.emulateNetworkConditions",
            {
                "offline": False,
                "latency": 70,
                "downloadThroughput": int(9 * 1024 * 1024 / 8),
                "uploadThroughput": int(1.5 * 1024 * 1024 / 8),
            },
        )

    net_stats = {"total_bytes": 0, "pmtiles_bytes": 0, "osm_bytes": 0, "requests": 0}
    req_urls = {}

    def on_req_sent(params):
        req_urls[params["requestId"]] = params["request"]["url"]

    def on_loading_done(params):
        b = int(params.get("encodedDataLength", 0) or 0)
        u = req_urls.get(params["requestId"], "")
        net_stats["requests"] += 1
        net_stats["total_bytes"] += b
        if "buildings.pmtiles" in u:
            net_stats["pmtiles_bytes"] += b
        elif "openfreemap.org" in u:
            net_stats["osm_bytes"] += b

    cdp.on("Network.requestWillBeSent", on_req_sent)
    cdp.on("Network.loadingFinished", on_loading_done)

    errors = []
    ov_loaded = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else (ov_loaded.append((time.time(), m.text)) if m.text.startswith("OV_BENCH ") else None))

    t0 = time.time()
    await page.goto(url, wait_until="domcontentloaded")
    await page.wait_for_function(
        "() => window.map && window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo().isReady",
        timeout=25000,
    )
    t_ready = round(time.time() - t0, 2)

    await page.evaluate("""() => {
      const m = window.map;
      const ws = m.style._layers['wallshadow'].implementation;
      const ml = m.style._layers['metro-webgl-3d-layer'].implementation;
      window.__prof = { wsIdle: [], wsJfa: [], three: [], draws: [], frames: 0, jfaRuns: 0, fbFrames: 0 };

      const origJfa = ws._jfaPass;
      ws._jfaPass = function() {
        window.__prof.jfaRuns++;
        return origJfa.apply(this, arguments);
      };
      const origWs = ws.render;
      ws.render = function() {
        const prevSig = this._cachedGroundSig;
        const s = performance.now();
        const r = origWs.apply(this, arguments);
        const dt = performance.now() - s;
        if (this._cachedGroundSig !== prevSig) window.__prof.wsJfa.push(dt);
        else window.__prof.wsIdle.push(dt);
        if ((ws.lastFallbackTileCount || 0) > 0) window.__prof.fbFrames++;
        return r;
      };
      const origMl = ml.render;
      ml.render = function() {
        const s = performance.now();
        const r = origMl.apply(this, arguments);
        window.__prof.three.push(performance.now() - s);
        return r;
      };
      m.on('render', () => {
        window.__prof.frames++;
        window.__prof.draws.push(window.__bench.drawCallsInFrame);
        window.__bench.drawCallsInFrame = 0;
      });
      m.on('sourcedata', (e) => {
        if (e.sourceId === 'overture-buildings' && e.tile && e.tile.state === 'loaded') {
          const c = e.tile.tileID.canonical;
          console.log(`OV_BENCH ${c.z}/${c.x}/${c.y}`);
        }
      });
    }""")

    # Wait briefly for initial Samaypur Badli tile, then test bookmark fly -> Rajiv Chowk
    deadline_q = time.time() + (9.0 if prof["net_4g"] else 4.5)
    t_qutab = None
    while time.time() < deadline_q:
        already = await page.evaluate("""() => {
          const cache = window.map?.style?.sourceCaches?.['overture-buildings'];
          if (!cache || !cache._tiles) return false;
          return Object.values(cache._tiles).some((t) => {
            const c = t.tileID?.canonical;
            return t.state === 'loaded' && c && c.z === 14 && c.x === 11702 && c.y === 6825;
          });
        }""")
        if already or any("14/11702/6825" in txt for _, txt in ov_loaded):
            t_qutab = round(time.time() - t0, 2)
            break
        await asyncio.sleep(0.1)

    t_click = time.time()
    await page.evaluate('() => document.querySelector(".bookmark-chip[data-loc=\\"rajiv\\"]").click()')

    deadline_r = time.time() + (14.0 if prof["net_4g"] else 8.0)
    t_rajiv = None
    while time.time() < deadline_r:
        has_loaded_cache = await page.evaluate("""() => {
          const cache = window.map?.style?.sourceCaches?.['overture-buildings'];
          if (!cache || !cache._tiles) return [false, false];
          let n = false, s = false;
          for (const t of Object.values(cache._tiles)) {
            const c = t.tileID?.canonical;
            if (t.state === 'loaded' && c && c.z === 14 && c.x === 11706) {
              if (c.y === 6830) n = true;
              if (c.y === 6831) s = true;
            }
          }
          return [n, s];
        }""")
        has_n = has_loaded_cache[0] or any("14/11706/6830" in txt for _, txt in ov_loaded)
        has_s = has_loaded_cache[1] or any("14/11706/6831" in txt for _, txt in ov_loaded)
        if has_n and has_s:
            t_rajiv = round(time.time() - t_click, 2)
            break
        await asyncio.sleep(0.1)

    # Settle then measure 2.0s Idle
    await asyncio.sleep(0.5)
    await page.evaluate("() => { const p = window.__prof; p.wsIdle=[]; p.wsJfa=[]; p.three=[]; p.draws=[]; p.frames=0; p.jfaRuns=0; p.fbFrames=0; }")
    await asyncio.sleep(2.0)
    idle_stats = await page.evaluate("""() => {
      const avg = (a) => a.length ? +(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2) : 0;
      const p = window.__prof;
      return {
        fps: +(p.frames / 2.0).toFixed(1),
        wsIdleMs: avg(p.wsIdle),
        threeMs: avg(p.three),
        drawsPerFrame: Math.round(avg(p.draws))
      };
    }""")

    # Measure 2.5s Active 360 Spin
    await page.evaluate("() => { const p = window.__prof; p.wsIdle=[]; p.wsJfa=[]; p.three=[]; p.draws=[]; p.frames=0; p.jfaRuns=0; p.fbFrames=0; document.getElementById('btn-360-orbit').click(); }")
    await asyncio.sleep(2.5)
    spin_stats = await page.evaluate("""() => {
      const b = document.getElementById('btn-360-orbit');
      if (b && b.classList.contains('active')) b.click();
      const avg = (a) => a.length ? +(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2) : 0;
      const m = window.map;
      const c = m.getCanvas();
      const ws = m.style._layers['wallshadow'].implementation;
      const p = window.__prof;
      const tr = (window.__bench.threeRenderers || [])[0];
      const infoMem = tr && tr.info ? tr.info.memory : {};
      return {
        fps: +(p.frames / 2.5).toFixed(1),
        wsJfaMs: avg(p.wsJfa),
        jfaRuns: p.jfaRuns,
        threeMs: avg(p.three),
        drawsPerFrame: Math.round(avg(p.draws)),
        fbFrames: p.fbFrames,
        canvasPx: `${c.width}x${c.height}`,
        pixelRatio: m.getPixelRatio ? +m.getPixelRatio().toFixed(2) : null,
        sdfRes: ws._sdfRes,
        workers: window.maplibregl.getWorkerCount ? window.maplibregl.getWorkerCount() : null,
        geometries: infoMem.geometries || 0,
        textures: infoMem.textures || 0,
        buildingsRendered: m.queryRenderedFeatures({ layers: ['overture-buildings-3d'] }).length,
      };
    }""")

    heap = await cdp.send("Runtime.getHeapUsage")
    perf_metrics = await cdp.send("Performance.getMetrics")
    metric_map = {item["name"]: item["value"] for item in perf_metrics.get("metrics", [])}

    return {
        "profile": prof["name"],
        "t_ready_s": t_ready,
        "t_qutab_tile_s": t_qutab,
        "t_rajiv_click_s": t_rajiv,
        "net_total_mb": round(net_stats["total_bytes"] / (1024 * 1024), 2),
        "net_pmtiles_mb": round(net_stats["pmtiles_bytes"] / (1024 * 1024), 2),
        "net_requests": net_stats["requests"],
        "js_heap_mb": round(heap.get("usedSize", 0) / (1024 * 1024), 1),
        "dom_nodes": int(metric_map.get("Nodes", 0)),
        "idle": idle_stats,
        "spin": spin_stats,
        "errors": errors,
    }


def print_report(results):
    print("\n" + "=" * 96)
    print("DELHI METRO RADAR — MAC vs. MOBILE PERFORMANCE & RESOURCE REPORT")
    print("=" * 96)
    headers = [
        ("Profile", lambda r: r["profile"]),
        ("Canvas (WxH @DPR / SDF / Workers)", lambda r: f"{r['spin']['canvasPx']} @{r['spin']['pixelRatio']} / {r['spin']['sdfRes']}px / {r['spin']['workers']}w"),
        ("Scene Ready -> Samaypur 3D Tile", lambda r: f"{r['t_ready_s']}s -> {r['t_qutab_tile_s']}s"),
        ("Click 'Rajiv' -> 3D Loaded", lambda r: f"{r['t_rajiv_click_s']}s" if r["t_rajiv_click_s"] is not None else "Timed out"),
        ("Idle FPS (AO ms / 3D ms / Draws)", lambda r: f"{r['idle']['fps']} fps ({r['idle']['wsIdleMs']}ms / {r['idle']['threeMs']}ms / {r['idle']['drawsPerFrame']}dc)"),
        ("360 Spin FPS (JFA ms / 3D ms / Draws)", lambda r: f"{r['spin']['fps']} fps ({r['spin']['wsJfaMs']}ms / {r['spin']['threeMs']}ms / {r['spin']['drawsPerFrame']}dc)"),
        ("JS Heap / DOM / Three Geo+Tex", lambda r: f"{r['js_heap_mb']} MB / {r['dom_nodes']} nodes / {r['spin']['geometries']}g+{r['spin']['textures']}t"),
        ("Wire Network (Overture S3 / Total)", lambda r: f"{r['net_pmtiles_mb']} MB / {r['net_total_mb']} MB ({r['net_requests']} reqs)"),
        ("Errors / Spin Fallback Frames", lambda r: f"{len(r['errors'])} errs / {r['spin']['fbFrames']} fb"),
    ]
    col_w = 32
    print("Metric".ljust(36) + " | " + " | ".join(r["profile"][:col_w].ljust(col_w) for r in results))
    print("-" * 36 + "-+-" + "-+-".join("-" * col_w for _ in results))
    for label, fn in headers[1:]:
        vals = [str(fn(r))[:col_w].ljust(col_w) for r in results]
        print(f"{label.ljust(36)} | " + " | ".join(vals))
    print("=" * 96)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8080/")
    parser.add_argument("--json", action="store_true", help="Print raw JSON metrics too")
    args = parser.parse_args()

    results = []
    async with async_playwright() as p:
        for prof in PROFILES:
            results.append(await profile_environment(p, args.url, prof))

    print_report(results)
    if args.json:
        print(json.dumps(results, indent=2))
    os._exit(0)


if __name__ == "__main__":
    threading.Timer(120.0, lambda: (print("HARD_TIMEOUT_120S", flush=True), os._exit(2))).start()
    asyncio.run(main())
