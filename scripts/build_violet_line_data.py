#!/usr/bin/env python3
"""
Builds exact, authentic OpenStreetMap & service JSON files for the
Delhi Metro Violet Line (Line 6 / Kashmere Gate ↔ Raja Nahar Singh Ballabhgarh, 46.6 km, 34 stations)
directly from OpenStreetMap Relation 2535797:
- src/data/violet_line_accurate_osm.json
- src/data/violet_line_service.json
"""

import json
import math
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data"

def haversine(p1, p2):
    R = 6371000
    phi1, phi2 = math.radians(p1[1]), math.radians(p2[1])
    dphi = math.radians(p2[1] - p1[1])
    dlambda = math.radians(p2[0] - p1[0])
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def resample_polyline(coords, target_step_m=75.0):
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

STATION_SPECS = [
    {"id": "kashmere_gate_violet", "name": "Kashmere Gate", "hindi": "कश्मीरी गेट", "structure": "underground", "elevM": -16.5, "major": True, "terminus": True, "interchanges": ["Red Line", "Yellow Line", "ISBT Kashmere Gate"], "interchange": "Triple Interchange", "code": "KG", "dwellSeconds": 90},
    {"id": "lal_quila", "name": "Lal Quila", "hindi": "लाल क़िला", "structure": "underground", "elevM": -16.0, "major": True, "terminus": False, "interchanges": ["Red Fort Heritage"], "interchange": "Red Fort", "code": "LQ", "dwellSeconds": 35},
    {"id": "jama_masjid", "name": "Jama Masjid", "hindi": "जामा मस्जिद", "structure": "underground", "elevM": -16.0, "major": True, "terminus": False, "interchanges": ["Jama Masjid Heritage"], "interchange": "Jama Masjid", "code": "JM", "dwellSeconds": 35},
    {"id": "delhi_gate", "name": "Delhi Gate", "hindi": "दिल्ली गेट", "structure": "underground", "elevM": -16.0, "major": False, "terminus": False, "interchanges": ["Feroz Shah Kotla Ground"], "interchange": None, "code": "DG", "dwellSeconds": 25},
    {"id": "ito", "name": "ITO", "hindi": "आईटीओ", "structure": "underground", "elevM": -16.0, "major": True, "terminus": False, "interchanges": ["Pragati Maidan / Income Tax Office"], "interchange": "ITO", "code": "ITO", "dwellSeconds": 35},
    {"id": "mandi_house_violet", "name": "Mandi House", "hindi": "मण्डी हाउस", "structure": "underground", "elevM": -16.0, "major": True, "terminus": False, "interchanges": ["Blue Line"], "interchange": "Blue Line", "code": "MDH", "dwellSeconds": 45},
    {"id": "janpath", "name": "Janpath", "hindi": "जनपथ", "structure": "underground", "elevM": -16.0, "major": False, "terminus": False, "interchanges": ["Connaught Place South"], "interchange": None, "code": "JNP", "dwellSeconds": 25},
    {"id": "central_secretariat_violet", "name": "Central Secretariat", "hindi": "केन्द्रीय सचिवालय", "structure": "underground", "elevM": -16.0, "major": True, "terminus": False, "interchanges": ["Yellow Line", "Kartavya Path"], "interchange": "Yellow Line", "code": "CS", "dwellSeconds": 50},
    {"id": "khan_market", "name": "Khan Market", "hindi": "ख़ान मार्किट", "structure": "underground", "elevM": -16.0, "major": False, "terminus": False, "interchanges": ["Lodhi Garden"], "interchange": None, "code": "KM", "dwellSeconds": 25},
    {"id": "jln_stadium", "name": "Jawaharlal Nehru Stadium", "hindi": "जवाहर लाल नेहरू स्टेडियम", "structure": "underground", "elevM": -16.0, "major": False, "terminus": False, "interchanges": ["JLN Sports Complex"], "interchange": None, "code": "JLN", "dwellSeconds": 25},
    {"id": "jangpura", "name": "Jangpura", "hindi": "जंगपुरा", "structure": "underground", "elevM": -16.0, "major": False, "terminus": False, "interchanges": ["Delhi-Meerut RRTS Stabling"], "interchange": None, "code": "JGP", "dwellSeconds": 25},
    {"id": "lajpat_nagar_violet", "name": "Lajpat Nagar", "hindi": "लाजपत नगर", "structure": "underground", "elevM": -18.0, "major": True, "terminus": False, "interchanges": ["Pink Line"], "interchange": "Pink Line", "code": "LJNR", "dwellSeconds": 45},
    {"id": "moolchand", "name": "Moolchand", "hindi": "मूलचन्द", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": ["Moolchand Medcity"], "interchange": None, "code": "MCH", "dwellSeconds": 25},
    {"id": "kailash_colony", "name": "Kailash Colony", "hindi": "कैलाश कॉलोनी", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": [], "interchange": None, "code": "KC", "dwellSeconds": 25},
    {"id": "nehru_place", "name": "Nehru Place", "hindi": "नेहरू प्लेस", "structure": "elevated", "elevM": 17.5, "major": True, "terminus": False, "interchanges": ["Nehru Place IT Hub"], "interchange": "IT Hub", "code": "NP", "dwellSeconds": 35},
    {"id": "kalkaji_mandir_violet", "name": "Kalkaji Mandir", "hindi": "कालकाजी मंदिर", "structure": "elevated", "elevM": 17.5, "major": True, "terminus": False, "interchanges": ["Magenta Line", "Lotus Temple"], "interchange": "Magenta Line", "code": "KKJM", "dwellSeconds": 45},
    {"id": "govind_puri", "name": "Govind Puri", "hindi": "गोविन्दपुरी", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": [], "interchange": None, "code": "GVP", "dwellSeconds": 25},
    {"id": "harkesh_nagar_okhla", "name": "Harkesh Nagar Okhla", "hindi": "हरकेश नगर ओखला", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": ["Okhla Phase II"], "interchange": None, "code": "HNO", "dwellSeconds": 25},
    {"id": "jasola_apollo", "name": "Jasola Apollo", "hindi": "जसोला अपोलो", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": ["Indraprastha Apollo Hospital"], "interchange": None, "code": "JA", "dwellSeconds": 25},
    {"id": "sarita_vihar", "name": "Sarita Vihar", "hindi": "सरिता विहार", "structure": "elevated", "elevM": 17.5, "major": True, "terminus": False, "interchanges": ["Sarita Vihar Depot Throat"], "interchange": "Depot", "code": "SV", "dwellSeconds": 30},
    {"id": "mohan_estate", "name": "Mohan Estate", "hindi": "मोहन एस्टेट", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": [], "interchange": None, "code": "ME", "dwellSeconds": 25},
    {"id": "tughlakabad_station", "name": "Tughlakabad Station", "hindi": "तुग़लकाबाद स्टेशन", "structure": "elevated", "elevM": 17.5, "major": True, "terminus": False, "interchanges": ["Tughlakabad Railway Station", "Silver Line (Phase IV)"], "interchange": "Silver Line", "code": "TGB", "dwellSeconds": 30},
    {"id": "badarpur_border", "name": "Badarpur Border", "hindi": "बदरपुर बॉर्डर", "structure": "elevated", "elevM": 17.5, "major": True, "terminus": False, "interchanges": ["Delhi-Haryana Border"], "interchange": "Haryana Border", "code": "BDP", "dwellSeconds": 35},
    {"id": "sarai", "name": "Sarai", "hindi": "सराय", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": ["Faridabad Entry"], "interchange": None, "code": "SAR", "dwellSeconds": 25},
    {"id": "nhpc_chowk", "name": "NHPC Chowk", "hindi": "एनएचपीसी चौक", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": ["NHPC Complex"], "interchange": None, "code": "NHPC", "dwellSeconds": 25},
    {"id": "mewla_maharajpur", "name": "Mewla Maharajpur", "hindi": "मेवला महाराजपुर", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": [], "interchange": None, "code": "MMH", "dwellSeconds": 25},
    {"id": "sector_28", "name": "Sector 28", "hindi": "सेक्टर 28", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": [], "interchange": None, "code": "S28", "dwellSeconds": 25},
    {"id": "badkal_mor", "name": "Badkal Mor", "hindi": "बड़कल मोड़", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": ["Badkhal Tourist Complex"], "interchange": None, "code": "BKM", "dwellSeconds": 25},
    {"id": "old_faridabad", "name": "Old Faridabad", "hindi": "ओल्ड फ़रीदाबाद", "structure": "elevated", "elevM": 17.5, "major": True, "terminus": False, "interchanges": ["Old Faridabad Railway Station"], "interchange": "Railway Station", "code": "OFB", "dwellSeconds": 35},
    {"id": "neelam_chowk_ajronda", "name": "Neelam Chowk Ajronda", "hindi": "नीलम चौक अजरौन्दा", "structure": "elevated", "elevM": 17.5, "major": True, "terminus": False, "interchanges": ["Ajronda Depot Throat"], "interchange": "Ajronda Depot", "code": "NCA", "dwellSeconds": 30},
    {"id": "bata_chowk", "name": "Bata Chowk", "hindi": "बाटा चौक", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": ["Bata Industrial Hub"], "interchange": None, "code": "BTC", "dwellSeconds": 25},
    {"id": "escorts_mujesar", "name": "Escorts Mujesar", "hindi": "एस्कॉर्ट्स मुजेसर", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": ["Escorts Industrial Plant"], "interchange": None, "code": "EM", "dwellSeconds": 25},
    {"id": "sant_surdas_sihi", "name": "Sant Surdas (Sihi)", "hindi": "संत सूरदास - सिही", "structure": "elevated", "elevM": 17.5, "major": False, "terminus": False, "interchanges": ["NCB Colony"], "interchange": None, "code": "SSS", "dwellSeconds": 25},
    {"id": "raja_nahar_singh", "name": "Raja Nahar Singh (Ballabhgarh)", "hindi": "राजा नाहर सिंह", "structure": "elevated", "elevM": 17.5, "major": True, "terminus": True, "interchanges": ["Ballabhgarh Railway Station", "Ballabhgarh Bus Stand"], "interchange": "Ballabhgarh Hub", "code": "RNS", "dwellSeconds": 90}
]

def build_violet_data():
    print("Fetching OSM Relation 2535797...")
    url = "https://api.openstreetmap.org/api/0.6/relation/2535797/full.json"
    req = urllib.request.Request(url, headers={"User-Agent": "DelhiMetroRadar/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    nodes = {e["id"]: [round(e["lon"], 6), round(e["lat"], 6)] for e in data["elements"] if e["type"] == "node"}
    ways = {e["id"]: e for e in data["elements"] if e["type"] == "way"}
    rel = next(e for e in data["elements"] if e["type"] == "relation")

    # Chain continuous ways
    raw_centerline = []
    for m in rel["members"]:
        if m["type"] == "way":
            w = ways.get(m["ref"])
            if w:
                w_pts = [nodes[nid] for nid in w["nodes"]]
                if not raw_centerline:
                    raw_centerline.extend(w_pts)
                else:
                    raw_centerline.extend(w_pts[1:])

    print(f"Raw centerline vertices: {len(raw_centerline)}")
    
    # Resample to 75m steps
    resampled_centerline = resample_polyline(raw_centerline, target_step_m=75.0)
    print(f"Resampled centerline vertices: {len(resampled_centerline)}")

    total_len_m = sum(haversine(resampled_centerline[i], resampled_centerline[i+1]) for i in range(len(resampled_centerline)-1))
    print(f"Total corridor length: {total_len_m:.1f} m ({total_len_m/1000:.2f} km)")

    # Match each station to exact centerline projection
    stops = [m for m in rel["members"] if m.get("role") in ["stop", "platform", "station"]]
    osm_stop_coords = [nodes[m["ref"]] for m in stops]

    cum_cl_dists = [0.0]
    for i in range(1, len(resampled_centerline)):
        cum_cl_dists.append(cum_cl_dists[-1] + haversine(resampled_centerline[i-1], resampled_centerline[i]))

    stations_data = []
    for idx, spec in enumerate(STATION_SPECS):
        raw_st_coord = osm_stop_coords[idx]
        # find closest point along resampled centerline
        best_d = 1e9
        best_idx = 0
        best_proj = raw_st_coord
        best_track_dist = 0.0

        for ci in range(len(resampled_centerline) - 1):
            p0 = resampled_centerline[ci]
            p1 = resampled_centerline[ci + 1]
            dx = (p1[0] - p0[0]) * 111320 * math.cos(math.radians(p0[1]))
            dy = (p1[1] - p0[1]) * 110540
            seg_len = math.hypot(dx, dy)
            if seg_len < 1e-4: continue

            vx = (raw_st_coord[0] - p0[0]) * 111320 * math.cos(math.radians(p0[1]))
            vy = (raw_st_coord[1] - p0[1]) * 110540
            u = max(0.0, min(1.0, (vx * dx + vy * dy) / (seg_len * seg_len)))

            proj_lon = p0[0] + (p1[0] - p0[0]) * u
            proj_lat = p0[1] + (p1[1] - p0[1]) * u
            p_dist = haversine(raw_st_coord, [proj_lon, proj_lat])

            if p_dist < best_d:
                best_d = p_dist
                best_idx = ci
                best_proj = [round(proj_lon, 6), round(proj_lat, 6)]
                best_track_dist = cum_cl_dists[ci] + u * haversine(p0, p1)

        st_obj = {
            "id": spec["id"],
            "name": spec["name"],
            "hindi": spec["hindi"],
            "coords": best_proj,
            "trackNodeIndex": best_idx,
            "elevM": spec["elevM"],
            "structure": spec["structure"],
            "major": spec["major"],
            "terminus": spec["terminus"],
            "interchanges": spec["interchanges"],
            "interchange": spec["interchange"],
            "distanceMeters": round(best_track_dist, 1),
            "code": spec["code"],
            "dwellSeconds": spec["dwellSeconds"],
            "index": idx,
            "isTerminal": spec["terminus"],
            "isShortTurnTerminal": False
        }
        stations_data.append(st_obj)
        print(f"  {idx+1:2d}. {spec['name']:32s} | dist={best_track_dist:7.1f}m | node={best_idx:3d} | {best_proj}")

    # Portal transition between Lajpat Nagar (underground) and Moolchand (elevated)
    # Station 11 (Lajpat Nagar) is underground; Station 12 (Moolchand) is elevated
    lajpat_node = stations_data[11]["trackNodeIndex"]
    moolchand_node = stations_data[12]["trackNodeIndex"]
    portal_node = (lajpat_node + moolchand_node) // 2
    portal_coord = resampled_centerline[portal_node]
    print(f"\nSubway-Viaduct Portal: node {portal_node} at {portal_coord} (between Lajpat Nagar and Moolchand)")

    # Save violet_line_accurate_osm.json
    osm_payload = {
        "line": "violet",
        "lineName": "Violet Line (Line 6)",
        "color": "#8B5CF6",
        "stations": stations_data,
        "centerline": resampled_centerline,
        "portalIndices": [portal_node],
        "portalCoords": [portal_coord],
        "totalLenMeters": round(total_len_m, 1)
    }

    osm_out = DATA_DIR / "violet_line_accurate_osm.json"
    with open(osm_out, "w", encoding="utf-8") as f:
        json.dump(osm_payload, f, indent=2, ensure_ascii=False)
    print(f"Saved: {osm_out}")

    # Save violet_line_service.json
    svc_payload = {
        "line": "violet",
        "name": "Violet Line (Line 6)",
        "color": "#8B5CF6",
        "corridor": "Kashmere Gate ↔ Raja Nahar Singh (Ballabhgarh)",
        "stations": stations_data
    }

    svc_out = DATA_DIR / "violet_line_service.json"
    with open(svc_out, "w", encoding="utf-8") as f:
        json.dump(svc_payload, f, indent=2, ensure_ascii=False)
    print(f"Saved: {svc_out}")

if __name__ == "__main__":
    build_violet_data()
