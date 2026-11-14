import asyncio
import os
import shutil
from PIL import Image
from playwright.async_api import async_playwright

ARTIFACT_DIR = '/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229'
WORKSPACE_DIR = '/Users/prashastpathak/Desktop/delhi-metro-radar'
FRAME_DIR = os.path.join(WORKSPACE_DIR, 'janakpuri_frames')

os.makedirs(FRAME_DIR, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1600, 'height': 900})
        page.on('console', lambda msg: print('LOG:', msg.text))
        page.on('pageerror', lambda exc: print('PAGE_ERROR:', exc))

        url = 'http://localhost:8080/janakpuri_west_cinematic.html'
        print(f'Navigating to {url}...')
        await page.goto(url)
        await page.wait_for_function('() => window.__sceneReady === true')
        await page.wait_for_timeout(1000)

        # 1. Master Hero Interchange Shot
        print('Rendering Master Hero Interchange Shot...')
        await page.evaluate('switchView("hero")')
        await page.wait_for_timeout(800)
        hero_path = os.path.join(WORKSPACE_DIR, 'janakpuri_west_interchange_hero.png')
        await page.screenshot(path=hero_path)
        shutil.copy2(hero_path, os.path.join(ARTIFACT_DIR, 'janakpuri_west_interchange_hero.png'))
        print('Captured janakpuri_west_interchange_hero.png')

        # 2. India\'s Tallest Escalator Link (15.6m rise)
        print('Rendering 15.6m Tallest Escalator Link Closeup...')
        await page.evaluate('switchView("escalator")')
        await page.wait_for_timeout(800)
        shot2_path = os.path.join(WORKSPACE_DIR, 'janakpuri_west_tallest_escalator_closeup.png')
        await page.screenshot(path=shot2_path)
        shutil.copy2(shot2_path, os.path.join(ARTIFACT_DIR, 'janakpuri_west_tallest_escalator_closeup.png'))
        print('Captured janakpuri_west_tallest_escalator_closeup.png')

        # 3. Dual-Level Cross-Section (+15m Elevated & -18m Underground)
        print('Rendering Dual-Level Cross Section...')
        await page.evaluate('switchView("cross_section")')
        await page.wait_for_timeout(800)
        shot3_path = os.path.join(WORKSPACE_DIR, 'janakpuri_west_cross_section_view.png')
        await page.screenshot(path=shot3_path)
        shutil.copy2(shot3_path, os.path.join(ARTIFACT_DIR, 'janakpuri_west_cross_section_view.png'))
        print('Captured janakpuri_west_cross_section_view.png')

        # 4. OSM Curvature to Krishna Park Extension
        print('Rendering OSM Curvature View...')
        await page.evaluate('switchView("osm_curve")')
        await page.wait_for_timeout(800)
        shot4_path = os.path.join(WORKSPACE_DIR, 'janakpuri_west_osm_curvature_track.png')
        await page.screenshot(path=shot4_path)
        shutil.copy2(shot4_path, os.path.join(ARTIFACT_DIR, 'janakpuri_west_osm_curvature_track.png'))
        print('Captured janakpuri_west_osm_curvature_track.png')

        # 5. Multi-frame Animation Capture (24 frames)
        print('Capturing 24 animation frames for animated GIF...')
        await page.evaluate('switchView("hero")')
        await page.wait_for_timeout(600)

        num_frames = 24
        frame_paths = []
        for i in range(num_frames):
            prog = i / float(num_frames)
            await page.evaluate(f'window.__setAnimationFrame({prog:.4f})')
            await page.wait_for_timeout(70)
            f_path = os.path.join(FRAME_DIR, f'frame_{i:02d}.png')
            await page.screenshot(path=f_path)
            frame_paths.append(f_path)

        await browser.close()

    # Compile Animated GIF
    print('Compiling janakpuri_west_interchange_animated.gif (960x540)...')
    images_hd = []
    for p in frame_paths:
        im = Image.open(p)
        im_resized = im.resize((960, 540), Image.Resampling.LANCZOS)
        images_hd.append(im_resized.convert('P', palette=Image.Palette.ADAPTIVE, colors=128))

    gif_hd_path = os.path.join(WORKSPACE_DIR, 'janakpuri_west_interchange_animated.gif')
    images_hd[0].save(
        gif_hd_path,
        save_all=True,
        append_images=images_hd[1:],
        duration=120,
        loop=0,
        optimize=True
    )
    shutil.copy2(gif_hd_path, os.path.join(ARTIFACT_DIR, 'janakpuri_west_interchange_animated.gif'))
    print('Saved janakpuri_west_interchange_animated.gif')

if __name__ == '__main__':
    asyncio.run(main())

