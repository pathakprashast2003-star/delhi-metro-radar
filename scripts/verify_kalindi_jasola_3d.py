import asyncio
import os
from playwright.async_api import async_playwright

ARTIFACT_DIR = "/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--use-gl=angle",
                "--use-angle=metal",
                "--enable-webgl",
                "--ignore-gpu-blocklist"
            ]
        )
        context = await browser.new_context(
            viewport={"width": 1600, "height": 1000},
            device_scale_factor=2
        )
        page = await context.new_page()

        print("Navigating to http://localhost:8080 ...")
        await page.goto("http://localhost:8080", wait_until="networkidle")
        await asyncio.sleep(4)

        # Wait for MapLibre map to be available
        await page.wait_for_function("() => window.map && window.map.loaded()")
        print("Map loaded successfully!")

        # Switch to Magenta Line via #btn-line-magenta
        await page.evaluate("""() => {
            const btn = document.getElementById('btn-line-magenta');
            if (btn) btn.click();
            else if (window.setLineFilter) window.setLineFilter('magenta');
        }""")
        await asyncio.sleep(2)

        # VIEW 1: Top-down closeup of Jasola Vihar Shaheen Bagh elevated stabling yard & turnout throat
        # Matching user Screenshot 4: Looking down at the connected railroads into the mainline viaduct
        print("Moving camera to Jasola Vihar station elevated deck (Screenshot 4 view)...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.2976, 28.5448],
                zoom: 17.6,
                pitch: 52,
                bearing: -32
            });
        }""")
        await asyncio.sleep(4)

        jasola_deck_path = os.path.join(ARTIFACT_DIR, "verified_jasola_vihar_connected_railroads.png")
        await page.screenshot(path=jasola_deck_path)
        print(f"Captured: {jasola_deck_path}")

        # Also capture top-down perspective from opposite angle showing all 12 curved turnouts
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.2974, 28.5452],
                zoom: 17.8,
                pitch: 35,
                bearing: -115
            });
        }""")
        await asyncio.sleep(3)
        jasola_topdown_path = os.path.join(ARTIFACT_DIR, "verified_jasola_throat_ladder_connection.png")
        await page.screenshot(path=jasola_topdown_path)
        print(f"Captured: {jasola_topdown_path}")

        # VIEW 2: GD Birla Marg Turnout Flyover, Canal Bridge & Incline Ramp
        # Matching user Screenshot 5: Looking from GD Birla Marg across the Agra Canal
        print("Moving camera to GD Birla Marg & Agra Canal crossing (Screenshot 5 view)...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.3005, 28.5418],
                zoom: 16.5,
                pitch: 62,
                bearing: 55
            });
        }""")
        await asyncio.sleep(4)

        canal_crossing_path = os.path.join(ARTIFACT_DIR, "verified_gd_birla_canal_crossing_and_depot.png")
        await page.screenshot(path=canal_crossing_path)
        print(f"Captured: {canal_crossing_path}")

        # VIEW 3: Broad Aerial Orbit of Kalindi Kunj Ground Depot Yard (39 Tracks, Workshops, Solar PV)
        print("Moving camera to Kalindi Kunj Ground Depot master view...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.3055, 28.5435],
                zoom: 16.2,
                pitch: 60,
                bearing: -45
            });
        }""")
        await asyncio.sleep(4)

        depot_master_path = os.path.join(ARTIFACT_DIR, "verified_kalindi_kunj_ground_depot_yard.png")
        await page.screenshot(path=depot_master_path)
        print(f"Captured: {depot_master_path}")

        # VIEW 4: High-Bay Overhaul Workshop (HRO) & 1.5 MWp Solar PV & IBL Shed Closeup
        print("Moving camera to Workshops & Solar PV closeup...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.3068, 28.5438],
                zoom: 17.2,
                pitch: 64,
                bearing: 25
            });
        }""")
        await asyncio.sleep(3)

        workshop_closeup_path = os.path.join(ARTIFACT_DIR, "verified_kalindi_workshops_and_solar_farm.png")
        await page.screenshot(path=workshop_closeup_path)
        print(f"Captured: {workshop_closeup_path}")

        # VIEW 5: Agra Canal Bowstring Arch Truss Bridge Closeup (User Screenshot 8 View)
        # Directly centered over the canal water body, showing the arch span, piers in water/banks, and dual tracks
        print("Moving camera to Agra Canal Bowstring Arch Truss Bridge closeup (Screenshot 8 view)...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.3017, 28.5414],
                zoom: 17.6,
                pitch: 68,
                bearing: -65
            });
        }""")
        await asyncio.sleep(4)

        canal_truss_path = os.path.join(ARTIFACT_DIR, "verified_agra_canal_bowstring_bridge_closeup.png")
        await page.screenshot(path=canal_truss_path)
        print(f"Captured: {canal_truss_path}")

        # VIEW 6: Canal Crossing looking East into Depot Incline Ramp & Ground Yard (User Screenshot 6 View)
        print("Moving camera to Canal Crossing East view (Screenshot 6 view)...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.3025, 28.5418],
                zoom: 17.0,
                pitch: 65,
                bearing: 70
            });
        }""")
        await asyncio.sleep(4)

        canal_ramp_path = os.path.join(ARTIFACT_DIR, "verified_canal_incline_ramp_connection.png")
        await page.screenshot(path=canal_ramp_path)
        print(f"Captured: {canal_ramp_path}")

        await browser.close()
        print("Verification complete!")

if __name__ == "__main__":
    asyncio.run(main())

