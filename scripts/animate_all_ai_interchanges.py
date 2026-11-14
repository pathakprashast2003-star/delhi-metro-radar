import os
import subprocess

FFMPEG = '/opt/anaconda3/bin/ffmpeg'
ARTIFACT_DIR = '/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229'
WORKSPACE_DIR = '/Users/prashastpathak/Desktop/delhi-metro-radar'

INTERCHANGES = [
    {
        'key': 'orange_dhaula_kuan',
        'title': 'Dhaula Kuan Aero Hub (+18m)',
        'img': 'dhaula_kuan_aero_metro_interchange_1794637642502.jpg',
        'zoom_x': 'iw/2-(iw/zoom/2)+sin(on/30)*20',
        'zoom_y': 'ih/2-(ih/zoom/2)+cos(on/30)*10',
        'max_z': 1.30
    },
    {
        'key': 'orange_dwarka21',
        'title': 'Dwarka Sector 21 Multimodal Hub',
        'img': 'dwarka_sector_21_aerial_multimodal_hub_1794637508268.jpg',
        'zoom_x': 'iw/2-(iw/zoom/2)+sin(on/35)*18',
        'zoom_y': 'ih/2-(ih/zoom/2)-sin(on/35)*12',
        'max_z': 1.35
    },
    {
        'key': 'orange_ndls',
        'title': 'New Delhi Railway Station (NDLS)',
        'img': 'ndls_multimodal_metro_interchange_cutaway_1794637728574.jpg',
        'zoom_x': 'iw/2-(iw/zoom/2)-sin(on/30)*22',
        'zoom_y': 'ih/2-(ih/zoom/2)+cos(on/30)*14',
        'max_z': 1.32
    },
    {
        'key': 'magenta_janakpuri_west',
        'title': 'Janakpuri West Dual Hub',
        'img': 'janakpuri_west_metro_interchange_1794637276275.jpg',
        'zoom_x': 'iw/2-(iw/zoom/2)+sin(on/28)*25',
        'zoom_y': 'ih/2-(ih/zoom/2)+cos(on/28)*12',
        'max_z': 1.30
    },
    {
        'key': 'magenta_janakpuri_aerial',
        'title': 'Janakpuri West Aerial Masterplan',
        'img': 'janakpuri_west_aerial_masterplan_interchange_1794637554292.jpg',
        'zoom_x': 'iw/2-(iw/zoom/2)-sin(on/32)*18',
        'zoom_y': 'ih/2-(ih/zoom/2)+cos(on/32)*14',
        'max_z': 1.35
    },
    {
        'key': 'magenta_hauz_khas',
        'title': 'Hauz Khas Deep Tube (-29m)',
        'img': 'hauz_khas_deep_tube_interchange_cutaway_clean_1794637356830.jpg',
        'zoom_x': 'iw/2-(iw/zoom/2)+sin(on/30)*16',
        'zoom_y': 'ih/2-(ih/zoom/2)+sin(on/30)*18',
        'max_z': 1.34
    },
    {
        'key': 'magenta_botanical_garden',
        'title': 'Botanical Garden Dual Viaducts',
        'img': 'botanical_garden_metro_interchange_1794637398755.jpg',
        'zoom_x': 'iw/2-(iw/zoom/2)-sin(on/30)*20',
        'zoom_y': 'ih/2-(ih/zoom/2)+cos(on/30)*10',
        'max_z': 1.30
    },
    {
        'key': 'magenta_kalkaji_mandir',
        'title': 'Kalkaji Mandir Lotus Temple View',
        'img': 'kalkaji_mandir_metro_interchange_1794637778713.jpg',
        'zoom_x': 'iw/2-(iw/zoom/2)+sin(on/30)*22',
        'zoom_y': 'ih/2-(ih/zoom/2)-cos(on/30)*12',
        'max_z': 1.32
    }
]

def animate_single(item):
    src_img = os.path.join(ARTIFACT_DIR, item['img'])
    out_mp4 = os.path.join(ARTIFACT_DIR, f"anim_{item['key']}.mp4")
    out_gif = os.path.join(ARTIFACT_DIR, f"anim_{item['key']}.gif")
    pal_img = os.path.join(WORKSPACE_DIR, f"pal_{item['key']}.png")

    if not os.path.exists(src_img):
        print(f"Skipping {item['key']}, source {src_img} not found")
        return None

    print(f"Animating {item['title']}...")
    # 5 seconds at 25 fps = 125 frames
    n_frames = 125
    rate_z = (item['max_z'] - 1.0) / float(n_frames)
    filt = f"zoompan=z='min(zoom+{rate_z:.5f},{item['max_z']})':d={n_frames}:x='{item['zoom_x']}':y='{item['zoom_y']}':s=960x540:fps=25"

    # MP4
    cmd_mp4 = [
        FFMPEG, '-y', '-loop', '1', '-i', src_img,
        '-vf', filt,
        '-t', '5',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
        out_mp4
    ]
    subprocess.run(cmd_mp4, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    # GIF via palettegen
    cmd_pal = [
        FFMPEG, '-y', '-i', out_mp4,
        '-vf', 'fps=12,scale=720:-1:flags=lanczos,palettegen=stats_mode=diff',
        pal_img
    ]
    subprocess.run(cmd_pal, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    cmd_gif = [
        FFMPEG, '-y', '-i', out_mp4, '-i', pal_img,
        '-lavfi', 'fps=12,scale=720:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3',
        out_gif
    ]
    subprocess.run(cmd_gif, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    if os.path.exists(pal_img):
        os.remove(pal_img)

    print(f"Completed {item['key']}: {os.path.getsize(out_mp4)//1024} KB mp4, {os.path.getsize(out_gif)//1024} KB gif")
    return out_mp4

def compile_grand_montage(mp4_list):
    concat_txt = os.path.join(WORKSPACE_DIR, 'montage_list.txt')
    out_montage = os.path.join(ARTIFACT_DIR, 'delhi_metro_interchanges_grand_montage.mp4')
    with open(concat_txt, 'w') as f:
        for p in mp4_list:
            if p and os.path.exists(p):
                f.write(f"file '{p}'\n")

    print("Compiling Master Grand Montage video...")
    cmd_concat = [
        FFMPEG, '-y', '-f', 'concat', '-safe', '0',
        '-i', concat_txt,
        '-c', 'copy',
        out_montage
    ]
    subprocess.run(cmd_concat, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    if os.path.exists(concat_txt):
        os.remove(concat_txt)
    print(f"Grand Montage Ready: {out_montage} ({os.path.getsize(out_montage)//1024} KB)")

def main():
    mp4_files = []
    for itm in INTERCHANGES:
        res = animate_single(itm)
        if res:
            mp4_files.append(res)
    compile_grand_montage(mp4_files)

if __name__ == '__main__':
    main()

