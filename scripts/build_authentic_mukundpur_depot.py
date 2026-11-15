#!/usr/bin/env python3
"""
build_authentic_mukundpur_depot.py
Builds authentic 3D Mukundpur Depot infrastructure and elevated flyover spur ramps
connecting Majlis Park elevated viaduct (+16.5m) to Mukundpur Depot yard (+1.35m).
Uses raw OpenStreetMap geometry extracted via Scrapling from api.openstreetmap.org.
"""

import json
import math

def dist_m(p1, p2):
    dx = (p2[0] - p1[0]) * 97700
    dy = (p2[1] - p1[1]) * 111000
    return math.hypot(dx, dy)

def build_mukundpur():
    with open('scripts/mukundpur_osm_parsed.json') as f:
        osm_data = json.load(f)

    railways = osm_data.get('railways', [])
    buildings = osm_data.get('buildings', [])

    majlis_anchor = [77.18207, 28.72416]  # +16.5m elevation
    depot_throat_anchor = [77.18750, 28.72960]  # +1.35m ground elevation

    flyover_spurs = []
    yard_turnouts = []
    yard_stabling = []
    workshop_tracks = []

    # Operational Flyover spur way IDs connecting Majlis Park to Mukundpur Depot
    flyover_way_ids = {
        '279102624', '364876207', '364876208', '364876209', 
        '1183304780', '1183304782', '1486693035', '1486693036'
    }

    # Workshop internal track IDs
    workshop_way_ids = {
        '570756003', '570756004', '1180656833', '1187685054', '1187685055'
    }

    for r in railways:
        rid = str(r['id'])
        coords = r['coords']
        if len(coords) < 2:
            continue
        
        tags = r.get('tags', {})
        service = tags.get('service')
        bridge = tags.get('bridge')
        layer = tags.get('layer')

        # Check if this is an elevated flyover spur connecting Majlis Park viaduct to Mukundpur
        if rid in flyover_way_ids:
            # Calculate cumulative distances along the way
            cum_dists = [0.0]
            for i in range(len(coords) - 1):
                cum_dists.append(cum_dists[-1] + dist_m(coords[i], coords[i+1]))
            total_way_len = cum_dists[-1]
            if total_way_len < 1e-3:
                continue

            # Determine whether start or end is closer to Majlis Park
            d_start_majlis = dist_m(coords[0], majlis_anchor)
            d_end_majlis = dist_m(coords[-1], majlis_anchor)

            # S-curve interpolation between 16.5m (Majlis Park) and 1.35m (Depot)
            # If layer == 3, add extra peak elevation (+19.5m) to clear layer 2 tracks
            pts_3d = []
            for i, c in enumerate(coords):
                if d_start_majlis < d_end_majlis:
                    t = cum_dists[i] / total_way_len  # 0 at Majlis (16.5m), 1 at Depot (1.35m)
                else:
                    t = 1.0 - (cum_dists[i] / total_way_len)  # 0 at Majlis, 1 at Depot
                
                # Hermite smoothstep: 3*t^2 - 2*t^3
                smooth_t = 3 * (t ** 2) - 2 * (t ** 3)
                elev = 16.5 - (16.5 - 1.35) * smooth_t

                # If layer 3 flyover, bump the center elevation to cross over
                if layer == '3':
                    parabola = 4 * t * (1.0 - t)
                    elev += 3.2 * parabola  # up to 19.7m clearance

                pts_3d.append([round(c[0], 6), round(c[1], 6), round(elev, 2)])

            flyover_spurs.append(pts_3d)

        elif rid in workshop_way_ids:
            # Interior workshop tracks at 1.35m
            pts_3d = [[round(c[0], 6), round(c[1], 6), 1.35] for c in coords]
            workshop_tracks.append(pts_3d)

        elif service == 'yard':
            # Yard stabling or turnout track at 1.35m
            pts_3d = [[round(c[0], 6), round(c[1], 6), 1.35] for c in coords]
            # Long stabling tracks vs short turnouts
            w_len = sum(dist_m(coords[i], coords[i+1]) for i in range(len(coords) - 1))
            if w_len > 70.0 and len(coords) >= 4:
                yard_stabling.append(pts_3d)
            else:
                yard_turnouts.append(pts_3d)

        elif service == 'crossover':
            # Elevated crossover track north of Majlis Park platforms (+16.5m)
            pts_3d = [[round(c[0], 6), round(c[1], 6), 16.5] for c in coords]
            flyover_spurs.append(pts_3d)

    # Authentic OSM depot buildings
    workshops = [
        {
            "id": "osm_bldg_1180927558",
            "name": "Mukundpur Major Inspection & Overhaul Shed (14 Bays)",
            "osmId": 1180927558,
            "coords": [77.186847, 28.724383],
            "widthM": 115.5,
            "lengthM": 152.6,
            "heightM": 12.0,
            "headingDeg": 12.0,
            "tracksInside": 14
        },
        {
            "id": "osm_bldg_1180601954",
            "name": "Mukundpur Heavy Repair & Stabling Workshop",
            "osmId": 1180601954,
            "coords": [77.185662, 28.721707],
            "widthM": 38.6,
            "lengthM": 182.4,
            "heightM": 10.0,
            "headingDeg": 12.0,
            "tracksInside": 4
        },
        {
            "id": "osm_bldg_1180602086",
            "name": "Mukundpur Traction Substation & Technical Depot",
            "osmId": 1180602086,
            "coords": [77.186999, 28.721510],
            "widthM": 37.6,
            "lengthM": 64.7,
            "heightM": 8.5,
            "headingDeg": 12.0,
            "tracksInside": 0
        },
        {
            "id": "osm_bldg_1180601955",
            "name": "Mukundpur Operational Control & Crew Center",
            "osmId": 1180601955,
            "coords": [77.186187, 28.720954],
            "widthM": 15.0,
            "lengthM": 113.2,
            "heightM": 7.5,
            "headingDeg": 12.0,
            "tracksInside": 0
        },
        {
            "id": "osm_bldg_1180938569",
            "name": "Mukundpur Automatic Train Washing Plant",
            "osmId": 1180938569,
            "coords": [77.188705, 28.721132],
            "widthM": 26.0,
            "lengthM": 52.1,
            "heightM": 7.0,
            "headingDeg": 12.0,
            "tracksInside": 2
        }
    ]

    # Stabled train fleet on stabling lines
    stabled_rakes = [
        {"id": "pink_rake_mukundpur_1", "centerLL": [77.1862, 28.7228], "cars": 6, "bearing": 12.0, "headlights": False},
        {"id": "pink_rake_mukundpur_2", "centerLL": [77.1868, 28.7228], "cars": 6, "bearing": 12.0, "headlights": True},
        {"id": "pink_rake_mukundpur_3", "centerLL": [77.1873, 28.7232], "cars": 6, "bearing": 12.0, "headlights": False},
        {"id": "pink_rake_mukundpur_4", "centerLL": [77.1878, 28.7235], "cars": 6, "bearing": 12.0, "headlights": False},
        {"id": "pink_rake_mukundpur_5", "centerLL": [77.1883, 28.7242], "cars": 6, "bearing": 15.0, "headlights": False},
        {"id": "pink_rake_mukundpur_6", "centerLL": [77.1888, 28.7250], "cars": 6, "bearing": 15.0, "headlights": False},
        {"id": "pink_rake_mukundpur_7", "centerLL": [77.1892, 28.7262], "cars": 6, "bearing": 15.0, "headlights": False}
    ]

    floodlight_masts = [
        [77.1852, 28.7212, 1.35],
        [77.1855, 28.7225, 1.35],
        [77.1870, 28.7212, 1.35],
        [77.1885, 28.7218, 1.35],
        [77.1895, 28.7240, 1.35],
        [77.1902, 28.7265, 1.35],
        [77.1898, 28.7285, 1.35],
        [77.1875, 28.7300, 1.35],
        [77.1850, 28.7250, 1.35],
        [77.1835, 28.7280, 1.35]
    ]

    mukundpur_json = {
        "version": "3.0-authentic-osm-3d",
        "name": "Mukundpur Metro Depot (DMRC Pink & Yellow Fleet HQ)",
        "corridor": "pink",
        "origin": [77.1870, 28.7230],
        "groundElev": 1.35,
        "tracks": {
            "flyover_spurs": flyover_spurs,
            "turnouts": yard_turnouts,
            "stabling_tracks": yard_stabling,
            "workshop_tracks": workshop_tracks
        },
        "workshops": workshops,
        "anchors": {
            "throat": [77.18750, 28.72960, 1.35],
            "majlis_park_station": [77.18207, 28.72416, 16.5],
            "stabled_rakes": stabled_rakes,
            "floodlight_masts": floodlight_masts
        }
    }

    with open('src/data/mukundpur_yard_tracks.json', 'w') as f:
        json.dump(mukundpur_json, f, indent=2)

    print(f"Generated Mukundpur Depot JSON:")
    print(f"  Flyover spurs (3D ramps 16.5m -> 1.35m): {len(flyover_spurs)}")
    print(f"  Yard stabling tracks (1.35m): {len(yard_stabling)}")
    print(f"  Yard turnouts (1.35m): {len(yard_turnouts)}")
    print(f"  Workshop tracks (1.35m): {len(workshop_tracks)}")
    print(f"  Authentic OSM workshops: {len(workshops)}")
    print(f"  Stabled rakes: {len(stabled_rakes)}")
    print(f"  Floodlight masts: {len(floodlight_masts)}")

if __name__ == '__main__':
    build_mukundpur()
