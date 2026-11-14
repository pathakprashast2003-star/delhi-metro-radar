import time
import os
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = "/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229"

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        args=["--use-gl=angle", "--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"]
    )
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()

    errors = []
    page.on("pageerror", lambda err: errors.append(f"PAGE ERROR: {err}"))
    page.on("console", lambda msg: errors.append(f"CONSOLE: {msg.text}") if msg.type == "error" else None)

    print("Navigating to http://localhost:8080...")
    page.goto("http://localhost:8080", wait_until="networkidle", timeout=30000)
    page.wait_for_function("() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo && window.MetroWebGLLayer.getDebugInfo().isReady === true", timeout=20000)
    time.sleep(2)

    # Make sure all lines view or blue/orange is active
    # Set to evening lighting matching user screenshot (around 18:30)
    page.evaluate("""() => {
        if (window.MetroWebGLLayer && window.MetroWebGLLayer.setAtmosphereTime) {
            window.MetroWebGLLayer.setAtmosphereTime(18.5 * 3600);
        }
    }""")
    time.sleep(1)

    # Shot 1: Exact User Perspective (matching media_1794626172337_ee706b1e.jpg)
    # Looking North-East along the Blue Line curve & East portals
    page.evaluate("""() => {
        const m = window.mapInstance || window.map;
        m.jumpTo({ center: [77.0601, 28.5528], zoom: 16.6, pitch: 58, bearing: 14 });
    }""")
    time.sleep(2.5)
    shot1_path = os.path.join(ARTIFACT_DIR, "dwarka21_exact_user_audit_fix.png")
    page.screenshot(path=shot1_path)
    print(f"Captured: {shot1_path}")

    # Shot 2: East Portal Headwall Closeup (checking all 4 arches & track continuity)
    page.evaluate("""() => {
        const m = window.mapInstance || window.map;
        m.jumpTo({ center: [77.0594, 28.5524], zoom: 17.8, pitch: 52, bearing: 18 });
    }""")
    time.sleep(2.5)
    shot2_path = os.path.join(ARTIFACT_DIR, "dwarka21_east_portal_headwall_closeup.png")
    page.screenshot(path=shot2_path)
    print(f"Captured: {shot2_path}")

    # Shot 3: Day View (matching media_1794582555204_3b8d9748.jpg)
    page.evaluate("""() => {
        if (window.MetroWebGLLayer && window.MetroWebGLLayer.setAtmosphereTime) {
            window.MetroWebGLLayer.setAtmosphereTime(12.0 * 3600);
        }
        const m = window.mapInstance || window.map;
        m.jumpTo({ center: [77.0600, 28.5527], zoom: 16.7, pitch: 56, bearing: 14 });
    }""")
    time.sleep(2.5)
    shot3_path = os.path.join(ARTIFACT_DIR, "dwarka21_day_view_reconstructed.png")
    page.screenshot(path=shot3_path)
    print(f"Captured: {shot3_path}")

    # Shot 4: Station Chamber & Symmetrical Canopy Overhead
    page.evaluate("""() => {
        const m = window.mapInstance || window.map;
        m.jumpTo({ center: [77.0586, 28.5518], zoom: 17.2, pitch: 48, bearing: -30 });
    }""")
    time.sleep(2.5)
    shot4_path = os.path.join(ARTIFACT_DIR, "dwarka21_canopy_and_chamber_overview.png")
    page.screenshot(path=shot4_path)
    print(f"Captured: {shot4_path}")

    # Check station metadata
    st_info = page.evaluate("""() => {
        const stations = window.MetroWebGLLayer.getStations ? window.MetroWebGLLayer.getStations() : [];
        const d21 = stations.filter(s => s.name && s.name.includes('Dwarka Sector 21'));
        return d21.map(s => ({
            name: s.name,
            lineKey: s.lineKey || s.lineId,
            structure: s.structure,
            pos: s.pos,
            isSharedDualHub: s._isSharedDualHub
        }));
    }""")
    print("Dwarka 21 stations:", st_info)
    print("Logged Errors count:", len(errors))
    if errors:
        for err in errors[:5]:
            print("  ", err)

    browser.close()

