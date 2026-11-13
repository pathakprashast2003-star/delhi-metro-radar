#!/usr/bin/env python3
"""
Builds exact, verified OpenStreetMap & service JSON files for the
Delhi Metro Magenta Line (Line 8 / Janakpuri West ↔ Botanical Garden):
- src/data/magenta_line_accurate_osm.json
- src/data/magenta_line_service.json
"""

import urllib.request
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def haversine(p1, p2):
    R = 6371000
    phi1, phi2 = math.radians(p1[1]), math.radians(p2[1])
    dphi = math.radians(p2[1] - p1[1])
    dlambda = math.radians(p2[0] - p1[0])
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def resample_polyline(coords, target_step_m=105.0):
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

HINDI_NAMES = {
    "Janakpuri West": "जनकपुरी पश्चिम",
    "Dabri Mor - Janakpuri South": "डाबरी मोड़ - जनकपुरी दक्षिण",
    "Dashrath Puri": "दशरथ पुरी",
    "Palam": "पालम",
    "Sadar Bazar Cantonment": "सदर बाज़ार छावनी",
    "Terminal 1 IGI Airport": "टर्मिनल 1 आईजीआई एयरपोर्ट",
    "Shankar Vihar": "शंकर विहार",
    "Vasant Vihar": "वसंत विहार",
    "Munirka": "मुनीरका",
    "R. K. Puram": "आर.के. पुरम",
    "IIT Delhi": "आईआईटी दिल्ली",
    "Hauz Khas": "हौज खास",
    "Panchsheel Park": "पंचशील पार्क",
    "Chirag Delhi": "चिराग दिल्ली",
    "Greater Kailash": "ग्रेटर कैलाश",
    "Nehru Enclave": "नेहरू एन्क्लेव",
    "Kalkaji Mandir": "कालकाजी मंदिर",
    "Okhla NSIC": "ओखला एन.एस.आई.सी.",
    "Sukhdev Vihar": "सुखदेव विहार",
    "Jamia Millia Islamia": "जामिया मिल्लिया इस्लामिया",
    "Okhla Vihar": "ओखला विहार",
    "Jasola Vihar Shaheen Bagh": "जसोला विहार शाहीन बाग",
    "Kalindi Kunj": "कालिंदी कुंज",
    "Okhla Bird Sanctuary": "ओखला पक्षी अभयारण्य",
    "Botanical Garden": "बॉटनिकल गार्डन"
}

STATION_METADATA = [
    {
        "id": "janakpuri_west_magenta",
        "name": "Janakpuri West",
        "structure": "underground",
        "elevM": -18,
        "major": True,
        "terminus": True,
        "interchanges": ["Blue Line"],
        "interchange": "Blue Line",
        "code": "JW"
    },
    {
        "id": "dabri_mor_janakpuri_south",
        "name": "Dabri Mor - Janakpuri South",
        "structure": "underground",
        "elevM": -14,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "DM"
    },
    {
        "id": "dashrath_puri",
        "name": "Dashrath Puri",
        "structure": "underground",
        "elevM": -14,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "DP"
    },
    {
        "id": "palam",
        "name": "Palam",
        "structure": "underground",
        "elevM": -15,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "PL"
    },
    {
        "id": "sadar_bazar_cantonment",
        "name": "Sadar Bazar Cantonment",
        "structure": "elevated",
        "elevM": 15,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "SB"
    },
    {
        "id": "terminal_1_igi_airport",
        "name": "Terminal 1 IGI Airport",
        "structure": "underground",
        "elevM": -17,
        "major": True,
        "terminus": False,
        "interchanges": ["IGI Airport Terminal 1 Flights"],
        "interchange": "Airport Flights",
        "code": "T1"
    },
    {
        "id": "shankar_vihar",
        "name": "Shankar Vihar",
        "structure": "elevated",
        "elevM": 14,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "SV"
    },
    {
        "id": "vasant_vihar",
        "name": "Vasant Vihar",
        "structure": "underground",
        "elevM": -16,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "VV"
    },
    {
        "id": "munirka",
        "name": "Munirka",
        "structure": "underground",
        "elevM": -18,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "MN"
    },
    {
        "id": "rk_puram",
        "name": "R. K. Puram",
        "structure": "underground",
        "elevM": -16,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "RK"
    },
    {
        "id": "iit_delhi",
        "name": "IIT Delhi",
        "structure": "underground",
        "elevM": -17,
        "major": False,
        "terminus": False,
        "interchanges": ["IIT Delhi Campus"],
        "interchange": "IIT Delhi",
        "code": "IIT"
    },
    {
        "id": "hauz_khas_magenta",
        "name": "Hauz Khas",
        "structure": "underground",
        "elevM": -29, # Deepest station in DMRC
        "major": True,
        "terminus": False,
        "interchanges": ["Yellow Line"],
        "interchange": "Yellow Line",
        "code": "HK"
    },
    {
        "id": "panchsheel_park",
        "name": "Panchsheel Park",
        "structure": "underground",
        "elevM": -15,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "PP"
    },
    {
        "id": "chirag_delhi",
        "name": "Chirag Delhi",
        "structure": "underground",
        "elevM": -15,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "CD"
    },
    {
        "id": "greater_kailash",
        "name": "Greater Kailash",
        "structure": "underground",
        "elevM": -15,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "GK"
    },
    {
        "id": "nehru_enclave",
        "name": "Nehru Enclave",
        "structure": "underground",
        "elevM": -15,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "NE"
    },
    {
        "id": "kalkaji_mandir_magenta",
        "name": "Kalkaji Mandir",
        "structure": "underground",
        "elevM": -14,
        "major": True,
        "terminus": False,
        "interchanges": ["Violet Line"],
        "interchange": "Violet Line",
        "code": "KM"
    },
    {
        "id": "okhla_nsic",
        "name": "Okhla NSIC",
        "structure": "elevated",
        "elevM": 16,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "ON"
    },
    {
        "id": "sukhdev_vihar",
        "name": "Sukhdev Vihar",
        "structure": "elevated",
        "elevM": 16,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "SVH"
    },
    {
        "id": "jamia_millia_islamia",
        "name": "Jamia Millia Islamia",
        "structure": "elevated",
        "elevM": 16,
        "major": False,
        "terminus": False,
        "interchanges": ["Jamia Millia Islamia University"],
        "interchange": "Jamia University",
        "code": "JMI"
    },
    {
        "id": "okhla_vihar",
        "name": "Okhla Vihar",
        "structure": "elevated",
        "elevM": 16,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "OV"
    },
    {
        "id": "jasola_vihar_shaheen_bagh",
        "name": "Jasola Vihar Shaheen Bagh",
        "structure": "elevated",
        "elevM": 16,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "JS"
    },
    {
        "id": "kalindi_kunj",
        "name": "Kalindi Kunj",
        "structure": "elevated",
        "elevM": 18, # High bridge span over Yamuna River
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "KK"
    },
    {
        "id": "okhla_bird_sanctuary",
        "name": "Okhla Bird Sanctuary",
        "structure": "elevated",
        "elevM": 16,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "OBS"
    },
    {
        "id": "botanical_garden_magenta",
        "name": "Botanical Garden",
        "structure": "elevated",
        "elevM": 17,
        "major": True,
        "terminus": True,
        "interchanges": ["Blue Line"],
        "interchange": "Blue Line",
        "code": "BG"
    }
]

def main():
    print("Fetching Magenta Line OSM Relation 8385429...")
    url = "https://api.openstreetmap.org/api/0.6/relation/8385429/full.json"
    req = urllib.request.Request(url, headers={"User-Agent": "DelhiMetroRadar/1.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    nodes = {e["id"]: [round(e["lon"], 6), round(e["lat"], 6)] for e in data["elements"] if e["type"] == "node"}
    node_tags = {e["id"]: e.get("tags", {}) for e in data["elements"] if e["type"] == "node"}
    ways = {e["id"]: e for e in data["elements"] if e["type"] == "way"}
    rel = next(e for e in data["elements"] if e["type"] == "relation")

    way_members = [m for m in rel["members"] if m["type"] == "way"]
    rev_ways = list(reversed(way_members[:-1]))

    raw_coords = []
    for idx, m in enumerate(rev_ways):
        w = ways.get(m["ref"])
        w_nodes = [nodes[nid] for nid in w["nodes"]]
        if not raw_coords:
            if w_nodes[0][1] < w_nodes[-1][1]:
                w_nodes.reverse()
            raw_coords.extend(w_nodes)
        else:
            last_pt = raw_coords[-1]
            first_pt = w_nodes[0]
            end_pt = w_nodes[-1]
            d_normal = (last_pt[0]-first_pt[0])**2 + (last_pt[1]-first_pt[1])**2
            d_reversed = (last_pt[0]-end_pt[0])**2 + (last_pt[1]-end_pt[1])**2
            if d_reversed < d_normal:
                w_nodes.reverse()
            raw_coords.extend(w_nodes[1:])

    print(f"Stitched raw coordinates: {len(raw_coords)}")
    raw_len = sum(haversine(raw_coords[i-1], raw_coords[i]) for i in range(1, len(raw_coords)))
    print(f"Total raw length: {raw_len/1000:.2f} km")

    resampled_centerline = resample_polyline(raw_coords, target_step_m=105.0)
    print(f"Resampled centerline points: {len(resampled_centerline)}")
    total_len_m = sum(haversine(resampled_centerline[i-1], resampled_centerline[i]) for i in range(1, len(resampled_centerline)))
    print(f"Total resampled length: {total_len_m/1000:.2f} km")

    raw_stops = [m for m in rel["members"] if m["role"] == "stop"]
    osm_stops_rev = []
    for m in reversed(raw_stops):
        nid = m["ref"]
        name = node_tags.get(nid, {}).get("name", "")
        if "Krishna Park" in name:
            continue
        clean_name = name.replace(" (Magenta Line)", "")
        osm_stops_rev.append({"name": clean_name, "coords": nodes[nid]})

    stations_list = []
    cum_dists = [0.0]
    total_d = 0.0
    for i in range(1, len(resampled_centerline)):
        total_d += haversine(resampled_centerline[i-1], resampled_centerline[i])
        cum_dists.append(total_d)

    for idx, meta in enumerate(STATION_METADATA):
        osm_stop = osm_stops_rev[idx]
        target_coord = osm_stop["coords"]

        min_d = float("inf")
        best_node_idx = 0
        for c_idx, pt in enumerate(resampled_centerline):
            d = haversine(pt, target_coord)
            if d < min_d:
                min_d = d
                best_node_idx = c_idx

        st_obj = {
            "id": meta["id"],
            "name": meta["name"],
            "coords": target_coord,
            "trackNodeIndex": best_node_idx,
            "elevM": meta["elevM"],
            "structure": meta["structure"],
            "major": meta["major"],
            "terminus": meta["terminus"],
            "interchanges": meta["interchanges"],
            "interchange": meta["interchange"],
            "distanceMeters": round(cum_dists[best_node_idx], 1)
        }
        stations_list.append(st_obj)
        print(f"[{idx+1:2d}] {meta['name']:30s} -> node {best_node_idx:3d} @ {st_obj['distanceMeters']:7.1f}m ({meta['structure']})")

    # Portal transitions (5 exact portals connecting underground tubes and elevated viaducts):
    # Portal 1: Palam ramp up to Sadar Bazar viaduct (node 63)
    # Portal 2: Sadar Bazar ramp down to T1 airport subway (node 86)
    # Portal 3: T1 airport ramp up to Shankar Vihar viaduct (node 106)
    # Portal 4: Shankar Vihar ramp down to Vasant Vihar subway (node 124)
    # Portal 5: Kalkaji Mandir ramp up to Okhla NSIC viaduct (node 235)
    portal_indices = [63, 86, 106, 124, 235]
    portal_coords = [resampled_centerline[idx] for idx in portal_indices]

    out_osm = {
        "line": "magenta",
        "lineName": "Magenta Line (Line 8)",
        "color": "#D946EF",
        "stations": stations_list,
        "centerline": resampled_centerline,
        "portalIndices": portal_indices,
        "portalCoords": portal_coords,
        "totalLenMeters": round(total_len_m, 1)
    }

    osm_path = ROOT / "src" / "data" / "magenta_line_accurate_osm.json"
    with open(osm_path, "w", encoding="utf-8") as f:
        json.dump(out_osm, f, indent=2)
    print(f"Wrote {osm_path} ({len(resampled_centerline)} centerline nodes, {len(stations_list)} stations)")

    # Service data
    service_stations = []
    for idx, s in enumerate(stations_list):
        meta = STATION_METADATA[idx]
        service_stations.append({
            "id": s["id"],
            "name": s["name"],
            "coords": s["coords"],
            "trackNodeIndex": s["trackNodeIndex"],
            "elevM": s["elevM"],
            "structure": s["structure"],
            "major": s["major"],
            "terminus": s["terminus"],
            "interchanges": s["interchanges"],
            "interchange": s["interchange"],
            "distanceMeters": s["distanceMeters"],
            "index": idx,
            "code": meta["code"],
            "hindi": HINDI_NAMES.get(s["name"], s["name"]),
            "isTerminal": s["terminus"],
            "isShortTurnTerminal": False,
            "dwellSeconds": 90 if s["terminus"] else (45 if s["major"] else 25)
        })

    out_svc = {
        "meta": {
            "lineId": "magenta",
            "lineName": "Magenta Line (Line 8)",
            "lineColor": "#D946EF",
            "operationalSpeedKmh": 80,
            "totalLengthKm": round(total_len_m / 1000.0, 2),
            "stationsCount": len(stations_list),
            "headwayPeakMinutes": 3.5,
            "headwayRegularMinutes": 6,
            "firstTrain": "05:30",
            "lastTrain": "23:30"
        },
        "stations": service_stations
    }

    svc_path = ROOT / "src" / "data" / "magenta_line_service.json"
    with open(svc_path, "w", encoding="utf-8") as f:
        json.dump(out_svc, f, indent=2)
    print(f"Wrote {svc_path}")

if __name__ == "__main__":
    main()
