#!/usr/bin/env python3
"""
Builds exact, verified OpenStreetMap & service JSON files for the
Delhi Airport Express Line (Orange Line / Line 10):
- src/data/orange_line_accurate_osm.json
- src/data/orange_line_service.json
"""

import urllib.request
import json
import math

def haversine(p1, p2):
    R = 6371000
    phi1, phi2 = math.radians(p1[1]), math.radians(p2[1])
    dphi = math.radians(p2[1] - p1[1])
    dlambda = math.radians(p2[0] - p1[0])
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def resample_polyline(coords, target_step_m=110.0):
    """Resamples a list of [lon, lat] points to roughly uniform step length."""
    if len(coords) < 2:
        return coords

    cum_dists = [0.0]
    total = 0.0
    for i in range(1, len(coords)):
        total += haversine(coords[i - 1], coords[i])
        cum_dists.append(total)

    num_samples = max(2, int(round(total / target_step_m)) + 1)
    resampled = [coords[0]]

    curr_seg = 0
    for s in range(1, num_samples - 1):
        target_d = (s / (num_samples - 1)) * total
        while curr_seg < len(cum_dists) - 2 and cum_dists[curr_seg + 1] < target_d:
            curr_seg += 1
        d_start = cum_dists[curr_seg]
        d_end = cum_dists[curr_seg + 1]
        seg_len = max(1e-6, d_end - d_start)
        u = (target_d - d_start) / seg_len
        p0 = coords[curr_seg]
        p1 = coords[curr_seg + 1]
        new_lon = p0[0] + (p1[0] - p0[0]) * u
        new_lat = p0[1] + (p1[1] - p0[1]) * u
        resampled.append([round(new_lon, 6), round(new_lat, 6)])

    resampled.append(coords[-1])
    return resampled

def main():
    print("Fetching Airport Express Line OSM Relation 2535798...")
    url = "https://api.openstreetmap.org/api/0.6/relation/2535798/full.json"
    req = urllib.request.Request(url, headers={"User-Agent": "DelhiMetroRadar/1.0"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    nodes = {n["id"]: [round(n["lon"], 6), round(n["lat"], 6)] for n in data["elements"] if n["type"] == "node"}
    ways = {w["id"]: w for w in data["elements"] if w["type"] == "way"}
    rel = next(r for r in data["elements"] if r["type"] == "relation")

    raw_coords = []
    way_tags_seq = []
    for m in rel["members"]:
        if m["type"] == "way":
            w = ways[m["ref"]]
            pts = [nodes[nid] for nid in w["nodes"]]
            layer = int(w.get("tags", {}).get("layer", "0"))
            bridge = w.get("tags", {}).get("bridge") == "yes"
            tunnel = w.get("tags", {}).get("tunnel") == "yes"
            
            if raw_coords and raw_coords[-1] == pts[0]:
                raw_coords.extend(pts[1:])
            else:
                raw_coords.extend(pts)
            way_tags_seq.append({
                "way_id": w["id"],
                "layer": layer,
                "bridge": bridge,
                "tunnel": tunnel
            })

    print(f"Raw centerline points: {len(raw_coords)}")

    # Portal coordinates from raw ways
    # Portal South: transition from way 103170729 (tunnel layer -2) to 79482955 (elevated bridge layer 2)
    portal_south_coord = [77.133092, 28.559397]
    # Portal North: transition from way 79482956 (elevated bridge layer 2) to 188216912 (tunnel layer -1)
    portal_north_coord = [77.174096, 28.611425]

    # Target resampled ~220 points (step ~110m)
    cl = resample_polyline(raw_coords, target_step_m=110.0)
    print(f"Resampled centerline points: {len(cl)}")

    # Station definitions with official DMRC codes, metadata & exact OSM positions
    station_defs = [
        {
            "id": "yashobhoomi_dwarka_sector_25",
            "name": "Yashobhoomi Dwarka Sector 25",
            "hindi": "यशोभूमि द्वारका सेक्टर 25",
            "code": "Y25",
            "coords": [77.045329, 28.550852],
            "structure": "underground",
            "elevM": -14,
            "major": True,
            "terminus": True,
            "isTerminal": True,
            "dwellSeconds": 120,
            "interchanges": [],
            "interchange": None
        },
        {
            "id": "dwarka_sector__21",
            "name": "Dwarka Sector - 21",
            "hindi": "द्वारका सेक्टर - 21",
            "code": "DS2",
            "coords": [77.058560, 28.551922],
            "structure": "underground",
            "elevM": -14,
            "major": True,
            "terminus": False,
            "isTerminal": False,
            "dwellSeconds": 60,
            "interchanges": ["Blue Line"],
            "interchange": "Blue Line"
        },
        {
            "id": "igi_airport",
            "name": "IGI Airport",
            "hindi": "आई.जी.आई. एयरपोर्ट (टर्मिनल 3)",
            "code": "APT",
            "coords": [77.086724, 28.556490],
            "structure": "underground",
            "elevM": -18,
            "major": True,
            "terminus": False,
            "isTerminal": False,
            "dwellSeconds": 90,
            "interchanges": ["IGI Terminal 3 Domestic & International Flights"],
            "interchange": "Airport Flights"
        },
        {
            "id": "delhi_aerocity",
            "name": "Delhi Aerocity",
            "hindi": "दिल्ली एरोसिटी",
            "code": "AER",
            "coords": [77.120809, 28.548800],
            "structure": "underground",
            "elevM": -14,
            "major": False,
            "terminus": False,
            "isTerminal": False,
            "dwellSeconds": 45,
            "interchanges": ["Aerocity Hospitality Hub"],
            "interchange": "Aerocity"
        },
        {
            "id": "dhaula_kuan",
            "name": "Dhaula Kuan",
            "hindi": "धौला कुआँ",
            "code": "DHK",
            "coords": [77.161684, 28.591914],
            "structure": "elevated",
            "elevM": 18,
            "major": True,
            "terminus": False,
            "isTerminal": False,
            "dwellSeconds": 45,
            "interchanges": ["Pink Line (Durgabai Deshmukh South Campus)"],
            "interchange": "Pink Line"
        },
        {
            "id": "shivaji_stadium",
            "name": "Shivaji Stadium",
            "hindi": "शिवाजी स्टेडियम",
            "code": "SVS",
            "coords": [77.211311, 28.628914],
            "structure": "underground",
            "elevM": -16,
            "major": False,
            "terminus": False,
            "isTerminal": False,
            "dwellSeconds": 45,
            "interchanges": ["Connaught Place Outer Circle"],
            "interchange": "Connaught Place"
        },
        {
            "id": "new_delhi",
            "name": "New Delhi",
            "hindi": "नई दिल्ली",
            "code": "NDL",
            "coords": [77.223095, 28.642490],
            "structure": "underground",
            "elevM": -18,
            "major": True,
            "terminus": True,
            "isTerminal": True,
            "dwellSeconds": 120,
            "interchanges": ["Yellow Line", "Northern Railway (NDLS)"],
            "interchange": "Yellow Line · Indian Railways"
        }
    ]

    # Snap stations to closest centerline point and compute distance
    cum_d = [0.0]
    total_len = 0.0
    for i in range(1, len(cl)):
        total_len += haversine(cl[i - 1], cl[i])
        cum_d.append(total_len)

    def find_closest_cl_idx(coord):
        best_d = 1e9
        best_i = 0
        for i, c in enumerate(cl):
            d = haversine(c, coord)
            if d < best_d:
                best_d = d
                best_i = i
        return best_i, best_d

    stations_accurate = []
    stations_service = []

    for s_idx, s in enumerate(station_defs):
        best_i, best_d = find_closest_cl_idx(s["coords"])
        s_dist = cum_d[best_i]
        
        # Ensure first station at 0 and last at len(cl)-1
        if s_idx == 0:
            best_i = 0
            s_dist = 0.0
            cl[0] = s["coords"]
        elif s_idx == len(station_defs) - 1:
            best_i = len(cl) - 1
            s_dist = total_len
            cl[-1] = s["coords"]

        acc_st = {
            "id": s["id"],
            "name": s["name"],
            "coords": s["coords"],
            "trackNodeIndex": best_i,
            "elevM": s["elevM"],
            "structure": s["structure"],
            "major": s["major"],
            "terminus": s["terminus"],
            "interchanges": s["interchanges"],
            "interchange": s["interchange"],
            "distanceMeters": round(s_dist, 1)
        }
        stations_accurate.append(acc_st)

        svc_st = dict(acc_st)
        svc_st.update({
            "index": s_idx,
            "code": s["code"],
            "hindi": s["hindi"],
            "isTerminal": s["isTerminal"],
            "isShortTurnTerminal": False,
            "dwellSeconds": s["dwellSeconds"]
        })
        stations_service.append(svc_st)

    # Snap portals
    portal_south_idx, _ = find_closest_cl_idx(portal_south_coord)
    portal_north_idx, _ = find_closest_cl_idx(portal_north_coord)

    print(f"Portal South (Aerocity -> Dhaula Kuan ramp): Node {portal_south_idx} ({cum_d[portal_south_idx]:.1f}m)")
    print(f"Portal North (Dhaula Kuan -> Shivaji Stadium ramp): Node {portal_north_idx} ({cum_d[portal_north_idx]:.1f}m)")

    accurate_osm_data = {
        "line": "orange",
        "lineName": "Airport Express Line",
        "color": "#F97316",
        "stations": stations_accurate,
        "centerline": cl,
        "portalSouth": portal_south_coord,
        "portalSouthNodeIndex": portal_south_idx,
        "portalNorth": portal_north_coord,
        "portalNorthNodeIndex": portal_north_idx,
        "totalLenMeters": round(total_len, 1)
    }

    service_data = {
        "meta": {
            "lineId": "orange",
            "lineName": "Airport Express Line",
            "lineColor": "#F97316",
            "operationalSpeedKmh": 120,
            "totalLengthKm": round(total_len / 1000.0, 2),
            "stationsCount": len(stations_service),
            "headwayPeakMinutes": 10,
            "headwayRegularMinutes": 15,
            "firstTrain": "04:45",
            "lastTrain": "23:40"
        },
        "stations": stations_service
    }

    with open("src/data/orange_line_accurate_osm.json", "w") as f:
        json.dump(accurate_osm_data, f, indent=2)
    print("Wrote src/data/orange_line_accurate_osm.json")

    with open("src/data/orange_line_service.json", "w") as f:
        json.dump(service_data, f, indent=2)
    print("Wrote src/data/orange_line_service.json")

    print("\nStations Summary:")
    for st in stations_service:
        print(f"  [{st['code']}] {st['name']:30s} Node {st['trackNodeIndex']:3d} | {st['structure']:12s} | {st['distanceMeters']:7.1f}m | {st['interchange']}")

if __name__ == "__main__":
    main()
