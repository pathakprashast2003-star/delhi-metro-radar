import asyncio
import os
import shutil
import subprocess
from playwright.async_api import async_playwright

ARTIFACT_DIR = '/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229'
WORKSPACE_DIR = '/Users/prashastpathak/Desktop/delhi-metro-radar'
FFMPEG = '/opt/anaconda3/bin/ffmpeg'

async def capture_sequence(page, url, n_frames, out_dir, shot_mode='orbit'):
    os.makedirs(out_dir, exist_ok=True)
    # clean out old frames
    for f in os.listdir(out_dir):
        if f.endswith('.png'):
            os.remove(os.path.join(out_dir, f))

    print(f'Loading {url}...')
    await page.goto(url)
    await page.wait_for_function('() => window.__sceneReady === true')
    await page.wait_for_timeout(800)

    frame_paths = []
    print(f'Capturing {n_frames} frames (mode={shot_mode})...')
    for i in range(n_frames):
        prog = i / float(n_frames)
        await page.evaluate(f'window.__setAnimationFrame({prog:.4f}, "{shot_mode}")')
        await page.wait_for_timeout(40)
        f_path = os.path.join(out_dir, f'frame_{i:03d}.png')
        await page.screenshot(path=f_path)
        frame_paths.append(f_path)
    return frame_paths

def compile_gif_and_mp4(frame_dir, base_name, fps=12):
    gif_out = os.path.join(WORKSPACE_DIR, f'{base_name}.gif')
    mp4_out = os.path.join(WORKSPACE_DIR, f'{base_name}.mp4')
    palette = os.path.join(frame_dir, 'palette.png')

    print(f'Compiling {base_name} with ffmpeg at {fps} fps...')
    # 1. Generate optimal color palette
    cmd_pal = [
        FFMPEG, '-y', '-framerate', str(fps),
        '-i', os.path.join(frame_dir, 'frame_%03d.png'),
        '-vf', 'fps=' + str(fps) + ',scale=960:-1:flags=lanczos,palettegen=stats_mode=diff',
        palette
    ]
    subprocess.run(cmd_pal, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    # 2. Render GIF using palette
    cmd_gif = [
        FFMPEG, '-y', '-framerate', str(fps),
        '-i', os.path.join(frame_dir, 'frame_%03d.png'),
        '-i', palette,
        '-lavfi', 'fps=' + str(fps) + ',scale=960:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3',
        gif_out
    ]
    subprocess.run(cmd_gif, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    # 3. Render MP4
    cmd_mp4 = [
        FFMPEG, '-y', '-framerate', str(fps),
        '-i', os.path.join(frame_dir, 'frame_%03d.png'),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
        mp4_out
    ]
    subprocess.run(cmd_mp4, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    # Copy to artifacts
    shutil.copy2(gif_out, os.path.join(ARTIFACT_DIR, f'{base_name}.gif'))
    shutil.copy2(mp4_out, os.path.join(ARTIFACT_DIR, f'{base_name}.mp4'))
    print(f'Done: {base_name}.gif & {base_name}.mp4 ({os.path.getsize(gif_out)//1024} KB)')

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 720})

        # 1. Janakpuri West 360-Degree Orbit (Blue Line +15m × Magenta Line -18m × 15.6m Escalator)
        jw_dir = os.path.join(WORKSPACE_DIR, 'frames_jw_orbit')
        await capture_sequence(page, 'http://localhost:8080/janakpuri_west_cinematic.html', 36, jw_dir, 'orbit')
        compile_gif_and_mp4(jw_dir, 'janakpuri_west_interchange_orbit', fps=12)

        # 2. Janakpuri West 15.6m Tallest Escalator Ride First-Person Ascent
        jw_esc_dir = os.path.join(WORKSPACE_DIR, 'frames_jw_esc')
        await capture_sequence(page, 'http://localhost:8080/janakpuri_west_cinematic.html', 30, jw_esc_dir, 'escalator_ride')
        compile_gif_and_mp4(jw_esc_dir, 'janakpuri_west_escalator_ride', fps=12)

        # 3. Botanical Garden Dual Elevated Hub (+16m Parallel Viaducts)
        bg_dir = os.path.join(WORKSPACE_DIR, 'frames_bg_orbit')
        await capture_sequence(page, 'http://localhost:8080/botanical_garden_cinematic.html', 36, bg_dir, 'orbit')
        compile_gif_and_mp4(bg_dir, 'botanical_garden_interchange_orbit', fps=12)

        # 4. Hauz Khas Deepest Tube Arrival (-29m Deep Cavern)
        hk_dir = os.path.join(WORKSPACE_DIR, 'frames_hk_orbit')
        await capture_sequence(page, 'http://localhost:8080/magenta_platform_cinematic.html', 30, hk_dir, 'hero')
        compile_gif_and_mp4(hk_dir, 'hauz_khas_deep_tube_animated', fps=10)

        await browser.close()
    print('ALL INTERCHANGE ANIMATIONS RENDERED & COMPILED SUCCESSFULLY!')

if __name__ == '__main__':
    asyncio.run(main())

