import json
import math

def build_depots():
    with open('scripts/overpass_depots.json') as f:
        d = json.load(f)

    nodes = {e['id']: [e['lon'], e['lat']] for e in d.get('elements', []) if e['type'] == 'node'}
    ways = [e for e in d.get('elements', []) if e['type'] == 'way']

    # --- 1. Mukundpur Depot ---
    muk_turnouts = []
    muk_stabling = []
    for w in ways:
        w_nodes = [nodes[nid] for nid in w.get('nodes', []) if nid in nodes]
        if len(w_nodes) < 2:
            continue
        avg_lon = sum(p[0] for p in w_nodes) / len(w_nodes)
        avg_lat = sum(p[1] for p in w_nodes) / len(w_nodes)
        if avg_lon < 77.20 and (28.718 <= avg_lat <= 28.735) and (77.180 <= avg_lon <= 77.195):
            pts_3d = [[round(p[0], 6), round(p[1], 6), 1.35] for p in w_nodes]
            # If long track (stabling line) vs turnout
            dx = (pts_3d[-1][0] - pts_3d[0][0]) * 97700
            dy = (pts_3d[-1][1] - pts_3d[0][1]) * 111000
            length = math.hypot(dx, dy)
            if length > 70 and len(pts_3d) >= 4:
                muk_stabling.append(pts_3d)
            else:
                muk_turnouts.append(pts_3d)

    mukundpur_json = {
        "version": "2.0-authentic-osm",
        "name": "Mukundpur Metro Depot (DMRC Pink & Yellow Fleet HQ)",
        "corridor": "pink",
        "origin": [77.1870, 28.7230],
        "groundElev": 1.35,
        "tracks": {
            "turnouts": muk_turnouts,
            "stabling_tracks": muk_stabling
        },
        "workshops": [
            {
                "id": "mukundpur_heavy_overhaul_shed",
                "name": "Mukundpur Major Heavy Overhaul & Wheel Lathe Workshop",
                "coords": [77.1882, 28.7275],
                "widthM": 48,
                "lengthM": 210,
                "heightM": 9.5,
                "headingDeg": 15.0,
                "tracksInside": 4
            },
            {
                "id": "mukundpur_inspection_bay",
                "name": "Mukundpur Routine Inspection & Stabling Bay",
                "coords": [77.1868, 28.7235],
                "widthM": 36,
                "lengthM": 180,
                "heightM": 8.5,
                "headingDeg": 12.0,
                "tracksInside": 3
            },
            {
                "id": "mukundpur_wash_plant",
                "name": "Mukundpur Automated Train Washing Plant",
                "coords": [77.1888, 28.7295],
                "widthM": 16,
                "lengthM": 90,
                "heightM": 6.5,
                "headingDeg": 15.0,
                "tracksInside": 1
            }
        ],
        "anchors": {
            "throat": [77.1825, 28.7245, 1.35],
            "majlis_park_station": [77.18207, 28.72416, 16.5],
            "stabled_rakes": [
                {"id": "pink_rake_mukundpur_1", "centerLL": [77.1865, 28.7225], "cars": 6, "bearing": 12.0, "headlights": False},
                {"id": "pink_rake_mukundpur_2", "centerLL": [77.1870, 28.7225], "cars": 6, "bearing": 12.0, "headlights": True},
                {"id": "pink_rake_mukundpur_3", "centerLL": [77.1875, 28.7225], "cars": 6, "bearing": 12.0, "headlights": False},
                {"id": "pink_rake_mukundpur_4", "centerLL": [77.1880, 28.7230], "cars": 6, "bearing": 12.0, "headlights": False},
                {"id": "pink_rake_mukundpur_5", "centerLL": [77.1885, 28.7245], "cars": 6, "bearing": 15.0, "headlights": False}
            ],
            "floodlight_masts": [
                [77.1855, 28.7220, 1.35],
                [77.1875, 28.7215, 1.35],
                [77.1885, 28.7225, 1.35],
                [77.1890, 28.7250, 1.35],
                [77.1895, 28.7280, 1.35],
                [77.1870, 28.7290, 1.35],
                [77.1850, 28.7240, 1.35]
            ]
        }
    }

    with open('src/data/mukundpur_yard_tracks.json', 'w') as f:
        json.dump(mukundpur_json, f, indent=2)
    print(f"Mukundpur Depot: {len(muk_turnouts)} turnouts, {len(muk_stabling)} stabling tracks written to src/data/mukundpur_yard_tracks.json")

    # --- 2. Vinod Nagar Depot ---
    vin_turnouts = []
    vin_stabling = []
    for w in ways:
        w_nodes = [nodes[nid] for nid in w.get('nodes', []) if nid in nodes]
        if len(w_nodes) < 2:
            continue
        avg_lon = sum(p[0] for p in w_nodes) / len(w_nodes)
        avg_lat = sum(p[1] for p in w_nodes) / len(w_nodes)
        if avg_lon > 77.30 and (28.620 <= avg_lat <= 28.635) and (77.305 <= avg_lon <= 77.326):
            pts_3d = [[round(p[0], 6), round(p[1], 6), 1.35] for p in w_nodes]
            dx = (pts_3d[-1][0] - pts_3d[0][0]) * 97700
            dy = (pts_3d[-1][1] - pts_3d[0][1]) * 111000
            length = math.hypot(dx, dy)
            if length > 70 and len(pts_3d) >= 4:
                vin_stabling.append(pts_3d)
            else:
                vin_turnouts.append(pts_3d)

    vinod_json = {
        "version": "2.0-authentic-osm",
        "name": "Vinod Nagar Metro Depot (East Delhi Pink Fleet Maintenance)",
        "corridor": "pink",
        "origin": [77.3180, 28.6270],
        "groundElev": 1.35,
        "tracks": {
            "turnouts": vin_turnouts,
            "stabling_tracks": vin_stabling
        },
        "workshops": [
            {
                "id": "vinod_nagar_major_workshop",
                "name": "Vinod Nagar Major Inspection & Maintenance Workshop",
                "coords": [77.3215, 28.6275],
                "widthM": 44,
                "lengthM": 190,
                "heightM": 9.0,
                "headingDeg": 82.0,
                "tracksInside": 3
            },
            {
                "id": "vinod_nagar_stabling_shed",
                "name": "Vinod Nagar Stabling & Daily Examination Shed",
                "coords": [77.3185, 28.6265],
                "widthM": 32,
                "lengthM": 160,
                "heightM": 8.0,
                "headingDeg": 82.0,
                "tracksInside": 3
            }
        ],
        "anchors": {
            "throat": [77.3115, 28.6305, 1.35],
            "ip_extension_station": [77.3109, 28.631898, 16.5],
            "stabled_rakes": [
                {"id": "pink_rake_vinod_1", "centerLL": [77.3205, 28.6272], "cars": 6, "bearing": 82.0, "headlights": False},
                {"id": "pink_rake_vinod_2", "centerLL": [77.3210, 28.6275], "cars": 6, "bearing": 82.0, "headlights": True},
                {"id": "pink_rake_vinod_3", "centerLL": [77.3215, 28.6278], "cars": 6, "bearing": 82.0, "headlights": False},
                {"id": "pink_rake_vinod_4", "centerLL": [77.3180, 28.6265], "cars": 6, "bearing": 82.0, "headlights": False}
            ],
            "floodlight_masts": [
                [77.3140, 28.6250, 1.35],
                [77.3170, 28.6260, 1.35],
                [77.3200, 28.6265, 1.35],
                [77.3235, 28.6280, 1.35],
                [77.3250, 28.6285, 1.35],
                [77.3210, 28.6285, 1.35],
                [77.3160, 28.6270, 1.35]
            ]
        }
    }

    with open('src/data/vinod_nagar_yard_tracks.json', 'w') as f:
        json.dump(vinod_json, f, indent=2)
    print(f"Vinod Nagar Depot: {len(vin_turnouts)} turnouts, {len(vin_stabling)} stabling tracks written to src/data/vinod_nagar_yard_tracks.json")

if __name__ == '__main__':
    build_depots()
