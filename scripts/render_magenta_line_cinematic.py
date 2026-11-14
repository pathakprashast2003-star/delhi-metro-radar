import asyncio
import os
import shutil
from PIL import Image
from playwright.async_api import async_playwright

ARTIFACT_DIR = '/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229'
WORKSPACE_DIR = '/Users/prashastpathak/Desktop/delhi-metro-radar'
FRAME_DIR = os.path.join(WORKSPACE_DIR, 'magenta_frames')

os.makedirs(FRAME_DIR, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1600, 'height': 900})
        page.on('console', lambda msg: print('LOG:', msg.text))
        page.on('pageerror', lambda exc: print('PAGE_ERROR:', exc))

        url = 'http://localhost:8080/magenta_platform_cinematic.html'
        print(f'Navigating to {url}...')
        await page.goto(url)
        await page.wait_for_function('() => window.__sceneReady === true')
        await page.wait_for_timeout(1000)

        # 1. Master Hero View
        print('Rendering Master Hero Shot...')
        await page.evaluate('switchView("hero")')
        await page.wait_for_timeout(600)
        hero_path = os.path.join(WORKSPACE_DIR, 'magenta_platform_hero.png')
        await page.screenshot(path=hero_path)
        shutil.copy2(hero_path, os.path.join(ARTIFACT_DIR, 'magenta_platform_hero.png'))
        print('Captured magenta_platform_hero.png')

        # 2. Shot 1: Platform Arrival
        shot1_path = os.path.join(WORKSPACE_DIR, 'magenta_shot_01_platform_arrival.png')
        shutil.copy2(hero_path, shot1_path)
        shutil.copy2(shot1_path, os.path.join(ARTIFACT_DIR, 'magenta_shot_01_platform_arrival.png'))

        # 3. Shot 2: Deep Escalators Canyon
        print('Rendering Deep Escalators View...')
        await page.evaluate('switchView("escalator")')
        await page.wait_for_timeout(600)
        shot2_path = os.path.join(WORKSPACE_DIR, 'magenta_shot_02_deep_escalators.png')
        await page.screenshot(path=shot2_path)
        shutil.copy2(shot2_path, os.path.join(ARTIFACT_DIR, 'magenta_shot_02_deep_escalators.png'))
        print('Captured magenta_shot_02_deep_escalators.png')

        # 4. Shot 3: Driverless Nose & Headlights
        print('Rendering Driverless Nose View...')
        await page.evaluate('switchView("train_front")')
        await page.wait_for_timeout(600)
        shot3_path = os.path.join(WORKSPACE_DIR, 'magenta_shot_03_driverless_nose.png')
        await page.screenshot(path=shot3_path)
        shutil.copy2(shot3_path, os.path.join(ARTIFACT_DIR, 'magenta_shot_03_driverless_nose.png'))
        print('Captured magenta_shot_03_driverless_nose.png')

        # 5. Shot 4: Cavern Cutaway Overview
        print('Rendering Cavern Cutaway View...')
        await page.evaluate('switchView("cutaway")')
        await page.wait_for_timeout(600)
        shot4_path = os.path.join(WORKSPACE_DIR, 'magenta_shot_04_cavern_cutaway.png')
        await page.screenshot(path=shot4_path)
        shutil.copy2(shot4_path, os.path.join(ARTIFACT_DIR, 'magenta_shot_04_cavern_cutaway.png'))
        print('Captured magenta_shot_04_cavern_cutaway.png')

        # 6. Multi-frame Animation Capture (28 frames)
        print('Capturing 28 animation frames for GIF...')
        await page.evaluate('switchView("hero")')
        await page.wait_for_timeout(400)

        num_frames = 28
        frame_paths = []
        for i in range(num_frames):
            prog = i / float(num_frames)
            await page.evaluate(f'window.__setAnimationFrame({prog:.4f})')
            await page.wait_for_timeout(80)
            f_path = os.path.join(FRAME_DIR, f'frame_{i:02d}.png')
            await page.screenshot(path=f_path)
            frame_paths.append(f_path)
            print(f'Frame {i+1}/{num_frames} captured (prog {prog:.2f})')

        await browser.close()

    # 7. Compile Animated GIFs
    print('Compiling magenta_platform_animated.gif (960x540)...')
    images_hd = []
    for p in frame_paths:
        im = Image.open(p)
        im_resized = im.resize((960, 540), Image.Resampling.LANCZOS)
        images_hd.append(im_resized.convert('P', palette=Image.Palette.ADAPTIVE, colors=128))

    gif_hd_path = os.path.join(WORKSPACE_DIR, 'magenta_platform_animated.gif')
    images_hd[0].save(
        gif_hd_path,
        save_all=True,
        append_images=images_hd[1:],
        duration=130, # ~7.7 FPS
        loop=0,
        optimize=True
    )
    shutil.copy2(gif_hd_path, os.path.join(ARTIFACT_DIR, 'magenta_platform_animated.gif'))
    print(f'Saved {gif_hd_path} ({os.path.getsize(gif_hd_path) / 1024 / 1024:.2f} MB)')

    print('Compiling magenta_platform_compact.gif (640x360)...')
    images_sm = []
    for p in frame_paths:
        im = Image.open(p)
        im_resized = im.resize((640, 360), Image.Resampling.LANCZOS)
        images_sm.append(im_resized.convert('P', palette=Image.Palette.ADAPTIVE, colors=96))

    gif_sm_path = os.path.join(WORKSPACE_DIR, 'magenta_platform_compact.gif')
    images_sm[0].save(
        gif_sm_path,
        save_all=True,
        append_images=images_sm[1:],
        duration=130,
        loop=0,
        optimize=True
    )
    shutil.copy2(gif_sm_path, os.path.join(ARTIFACT_DIR, 'magenta_platform_compact.gif'))
    print(f'Saved {gif_sm_path} ({os.path.getsize(gif_sm_path) / 1024 / 1024:.2f} MB)')

    print('ALL RENDERS & ANIMATIONS GENERATED SUCCESSFULLY!')

if __name__ == '__main__':
    asyncio.run(main())

