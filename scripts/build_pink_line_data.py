#!/usr/bin/env python3
"""
Builds exact, verified OpenStreetMap & service JSON files for the
Delhi Metro Pink Line (Line 7 / Majlis Park ↔ Shiv Vihar, 59 km, 38 stations):
- src/data/pink_line_accurate_osm.json
- src/data/pink_line_service.json
"""

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

def resample_polyline(coords, target_step_m=85.0):
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

# All 38 Pink Line Stations with exact Wikidata/OSM verified coordinates
PINK_LINE_STATIONS = [
    {
        "id": "majlis_park",
        "name": "Majlis Park",
        "hindi": "मजलिस पार्क",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.18207, 28.72416],
        "major": True,
        "terminus": True,
        "interchanges": ["Magenta Line (Phase IV)"],
        "interchange": "Phase IV",
        "code": "MJPK"
    },
    {
        "id": "azadpur_pink",
        "name": "Azadpur",
        "hindi": "आज़ादपुर",
        "structure": "underground",
        "elevM": -16.0,
        "coords": [77.179974, 28.707273],
        "major": True,
        "terminus": False,
        "interchanges": ["Yellow Line"],
        "interchange": "Yellow Line",
        "code": "AZP"
    },
    {
        "id": "shalimar_bagh",
        "name": "Shalimar Bagh",
        "hindi": "शालीमार बाग़",
        "structure": "underground",
        "elevM": -15.0,
        "coords": [77.165191, 28.701819],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "SHMB"
    },
    {
        "id": "netaji_subhash_place_pink",
        "name": "Netaji Subhash Place",
        "hindi": "नेताजी सुभाष प्लेस",
        "structure": "underground",
        "elevM": -16.0,
        "coords": [77.15245, 28.695886],
        "major": True,
        "terminus": False,
        "interchanges": ["Red Line"],
        "interchange": "Red Line",
        "code": "NSP"
    },
    {
        "id": "shakurpur",
        "name": "Shakurpur",
        "hindi": "शकूरपुर",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.149626, 28.685779],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "SHKP"
    },
    {
        "id": "punjabi_bagh_west",
        "name": "Punjabi Bagh West",
        "hindi": "पंजाबी बाग़ पश्चिम",
        "structure": "elevated",
        "elevM": 17.5,
        "coords": [77.139256, 28.672826],
        "major": True,
        "terminus": False,
        "interchanges": ["Green Line"],
        "interchange": "Green Line",
        "code": "PBGW"
    },
    {
        "id": "esi_basaidarapur",
        "name": "ESI - Basaidarapur",
        "hindi": "ईएसआई - बसईदारापुर",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.127391, 28.658271],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "ESIB"
    },
    {
        "id": "rajouri_garden_pink",
        "name": "Rajouri Garden",
        "hindi": "राजौरी गार्डन",
        "structure": "elevated",
        "elevM": 21.0, # High viaduct over Blue Line
        "coords": [77.122634, 28.649004],
        "major": True,
        "terminus": False,
        "interchanges": ["Blue Line"],
        "interchange": "Blue Line",
        "code": "RJGD"
    },
    {
        "id": "mayapuri",
        "name": "Mayapuri",
        "hindi": "मायापुरी",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.129741, 28.637099],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "MYPR"
    },
    {
        "id": "naraina_vihar",
        "name": "Naraina Vihar",
        "hindi": "नारायणा विहार",
        "structure": "underground",
        "elevM": -16.0,
        "coords": [77.136488, 28.624125],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "NRVR"
    },
    {
        "id": "delhi_cantt",
        "name": "Delhi Cantt.",
        "hindi": "दिल्ली कैन्ट.",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.140423, 28.60871],
        "major": False,
        "terminus": False,
        "interchanges": ["Delhi Cantt. Railway Station feeder"],
        "interchange": None,
        "code": "DLCN"
    },
    {
        "id": "durgabai_deshmukh_south_campus",
        "name": "Durgabai Deshmukh South Campus",
        "hindi": "दुर्गाबाई देशमुख साउथ कैम्पस",
        "structure": "elevated",
        "elevM": 23.6, # 23.6m peak over Dhaula Kuan grade separator
        "coords": [77.169475, 28.589441],
        "major": True,
        "terminus": False,
        "interchanges": ["Airport Express via Dhaula Kuan Travelator"],
        "interchange": "Airport Express",
        "code": "DDSC"
    },
    {
        "id": "sir_m_vishweshwaraiah_moti_bagh",
        "name": "Sir M. Vishweshwaraiah Moti Bagh",
        "hindi": "सर एम. विश्वेश्वरय्या मोती बाग",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.175726, 28.578504],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "SMVM"
    },
    {
        "id": "bhikaji_cama_place",
        "name": "Bhikaji Cama Place",
        "hindi": "भीकाजी कामा प्लेस",
        "structure": "underground",
        "elevM": -16.0,
        "coords": [77.187888, 28.570211],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "BKCP"
    },
    {
        "id": "sarojini_nagar",
        "name": "Sarojini Nagar",
        "hindi": "सरोजिनी नगर",
        "structure": "underground",
        "elevM": -16.0,
        "coords": [77.198571, 28.575807],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "SJNR"
    },
    {
        "id": "dilli_haat_ina_pink",
        "name": "Dilli Haat - INA",
        "hindi": "दिल्ली हाट - आईएनए",
        "structure": "underground",
        "elevM": -18.0, # Lower level cut-and-cover box beneath Yellow Line
        "coords": [77.207311, 28.575224],
        "major": True,
        "terminus": False,
        "interchanges": ["Yellow Line"],
        "interchange": "Yellow Line",
        "code": "INA"
    },
    {
        "id": "south_extension",
        "name": "South Extension",
        "hindi": "साउथ एक्सटेंशन",
        "structure": "underground",
        "elevM": -16.0,
        "coords": [77.220265, 28.568611],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "SXNT"
    },
    {
        "id": "lajpat_nagar_pink",
        "name": "Lajpat Nagar",
        "hindi": "लाजपत नगर",
        "structure": "underground",
        "elevM": -18.0,
        "coords": [77.23646, 28.570566],
        "major": True,
        "terminus": False,
        "interchanges": ["Violet Line"],
        "interchange": "Violet Line",
        "code": "LJNR"
    },
    {
        "id": "vinobapuri",
        "name": "Vinobapuri",
        "hindi": "विनोबापुरी",
        "structure": "underground",
        "elevM": -16.0,
        "coords": [77.250502, 28.565944],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "VNBP"
    },
    {
        "id": "ashram",
        "name": "Ashram",
        "hindi": "आश्रम",
        "structure": "underground",
        "elevM": -16.0, # India's shortest station (151.6m)
        "coords": [77.258475, 28.572208],
        "major": False,
        "terminus": False,
        "interchanges": ["Ashram Chowk Underpass"],
        "interchange": None,
        "code": "ASHR"
    },
    {
        "id": "sarai_kale_khan_nizamuddin",
        "name": "Sarai Kale Khan - Nizamuddin",
        "hindi": "सराय काले ख़ान - निज़ामुद्दीन",
        "structure": "underground",
        "elevM": -16.0,
        "coords": [77.257128, 28.589356],
        "major": True,
        "terminus": False,
        "interchanges": ["Hazrat Nizamuddin Railway Station", "Sarai Kale Khan RRTS", "ISBT Sarai Kale Khan"],
        "interchange": "Nizamuddin Hub",
        "code": "SKKN"
    },
    {
        "id": "mayur_vihar_1_pink",
        "name": "Mayur Vihar-I",
        "hindi": "मयूर विहार-I",
        "structure": "elevated",
        "elevM": 24.5, # Super-elevated crossing over Blue Line
        "coords": [77.289526, 28.604134],
        "major": True,
        "terminus": False,
        "interchanges": ["Blue Line"],
        "interchange": "Blue Line",
        "code": "MV1"
    },
    {
        "id": "mayur_vihar_pocket_1",
        "name": "Mayur Vihar Pocket-1",
        "hindi": "मयूर विहार पॉकेट-१",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.298042, 28.605631],
        "major": False,
        "terminus": False,
        "interchanges": ["Shree Ram Mandir"],
        "interchange": None,
        "code": "MVP1"
    },
    {
        "id": "trilokpuri_sanjay_lake",
        "name": "Trilokpuri - Sanjay Lake",
        "hindi": "त्रिलोकपुरी - संजय लेक",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.308849, 28.613678],
        "major": False,
        "terminus": False,
        "interchanges": ["Sanjay Lake Park"],
        "interchange": None,
        "code": "TKSJ"
    },
    {
        "id": "east_vinod_nagar_mayur_vihar_2",
        "name": "East Vinod Nagar - Mayur Vihar-II",
        "hindi": "ईस्ट विनोद नगर - मयूर विहार-II",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.305266, 28.620039],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "EVN2"
    },
    {
        "id": "mandawali_west_vinod_nagar",
        "name": "Mandawali - West Vinod Nagar",
        "hindi": "मण्डावली - वेस्ट विनोद नगर",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.304583, 28.624977],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "MWVN"
    },
    {
        "id": "ip_extension",
        "name": "IP Extension",
        "hindi": "इन्द्रप्रस्थ एक्सटेंशन",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.3109, 28.631898],
        "major": True,
        "terminus": False,
        "interchanges": ["Vinod Nagar Depot feeder"],
        "interchange": "Depot",
        "code": "IPEX"
    },
    {
        "id": "anand_vihar_pink",
        "name": "Anand Vihar",
        "hindi": "आनंद विहार",
        "structure": "elevated",
        "elevM": 17.5,
        "coords": [77.315878, 28.646886],
        "major": True,
        "terminus": False,
        "interchanges": ["Blue Line", "Anand Vihar Railway Terminal", "Anand Vihar RRTS", "ISBT Anand Vihar"],
        "interchange": "Blue Line",
        "code": "ANVR"
    },
    {
        "id": "karkarduma_pink",
        "name": "Karkarduma",
        "hindi": "कड़कड़डूमा",
        "structure": "elevated",
        "elevM": 24.5, # Super-elevated crossing over Blue Line
        "coords": [77.30556, 28.648539],
        "major": True,
        "terminus": False,
        "interchanges": ["Blue Line"],
        "interchange": "Blue Line",
        "code": "KKDM"
    },
    {
        "id": "karkarduma_court",
        "name": "Karkarduma Court",
        "hindi": "कड़कड़डूमा कोर्ट",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.295787, 28.653685],
        "major": False,
        "terminus": False,
        "interchanges": ["District Courts"],
        "interchange": None,
        "code": "KKCT"
    },
    {
        "id": "krishna_nagar",
        "name": "Krishna Nagar",
        "hindi": "कृष्णा नगर",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.290276, 28.657855],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "KSNA"
    },
    {
        "id": "east_azad_nagar",
        "name": "East Azad Nagar",
        "hindi": "ईस्ट आज़ाद नगर",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.285, 28.664722],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "EAZN"
    },
    {
        "id": "welcome_pink",
        "name": "Welcome",
        "hindi": "वेलकम",
        "structure": "elevated",
        "elevM": 17.5, # Crossing above Red Line
        "coords": [77.277934, 28.67205],
        "major": True,
        "terminus": False,
        "interchanges": ["Red Line"],
        "interchange": "Red Line",
        "code": "WEL"
    },
    {
        "id": "jaffrabad",
        "name": "Jaffrabad",
        "hindi": "जाफ़राबाद",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.274748, 28.682759],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "JFBD"
    },
    {
        "id": "maujpur_babarpur",
        "name": "Maujpur - Babarpur",
        "hindi": "मौजपुर - बाबरपुर",
        "structure": "elevated",
        "elevM": 18.0, # Junction station connecting Ring and Shiv Vihar branch
        "coords": [77.279585, 28.692073],
        "major": True,
        "terminus": False,
        "interchanges": ["Pink Line Ring & Branch Junction"],
        "interchange": "Junction",
        "code": "MJPR"
    },
    {
        "id": "gokulpuri",
        "name": "Gokulpuri",
        "hindi": "गोकुलपुरी",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.286111, 28.7025],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "GKPR"
    },
    {
        "id": "johri_enclave",
        "name": "Johri Enclave",
        "hindi": "जोहरी एन्क्लेव",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.290107, 28.713167],
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "JHEN"
    },
    {
        "id": "shiv_vihar",
        "name": "Shiv Vihar",
        "hindi": "शिव विहार",
        "structure": "elevated",
        "elevM": 16.5,
        "coords": [77.289494, 28.721612],
        "major": True,
        "terminus": True,
        "interchanges": ["Loni Border feeder"],
        "interchange": "Loni Border",
        "code": "SHVR"
    }
]

def main():
    print("Loading GTFS Pink Line (P_MS) track centerline...")
    with open(ROOT / "src" / "data" / "dmrc_other_lines_gtfs.json") as f:
        gtfs = json.load(f)

    raw_coords = None
    for feat in gtfs["features"]:
        if feat["properties"].get("id") == "P_MS":
            raw_coords = feat["geometry"]["coordinates"]
            break

    if not raw_coords:
        raise ValueError("Could not find P_MS Pink Line in dmrc_other_lines_gtfs.json")

    print(f"Loaded {len(raw_coords)} GTFS raw points.")
    raw_len = sum(haversine(raw_coords[i-1], raw_coords[i]) for i in range(1, len(raw_coords)))
    print(f"Raw centerline length: {raw_len/1000:.2f} km")

    # Resample to uniform ~85m step length
    resampled = resample_polyline(raw_coords, target_step_m=85.0)
    print(f"Resampled to {len(resampled)} points (~85m step).")

    # Calculate cumulative distance along resampled centerline
    cum_dists = [0.0]
    total_d = 0.0
    for i in range(1, len(resampled)):
        total_d += haversine(resampled[i-1], resampled[i])
        cum_dists.append(total_d)
    total_len_m = cum_dists[-1]

    # Map each of the 38 stations onto the centerline
    stations_list = []
    station_node_indices = []
    
    last_node = 0
    for idx, meta in enumerate(PINK_LINE_STATIONS):
        st_coord = meta["coords"]

        # If terminus 0: exactly first node
        if idx == 0:
            best_idx = 0
            resampled[0] = [st_coord[0], st_coord[1]]
        elif idx == len(PINK_LINE_STATIONS) - 1:
            best_idx = len(resampled) - 1
            resampled[-1] = [st_coord[0], st_coord[1]]
        else:
            # Find closest node strictly >= last_node to preserve forward progression
            best_d = float("inf")
            best_idx = last_node
            search_window_end = min(len(resampled), last_node + 60)
            for c_idx in range(last_node, search_window_end):
                d = haversine(resampled[c_idx], st_coord)
                if d < best_d:
                    best_d = d
                    best_idx = c_idx
            
            # Snap the centerline node to the exact station coordinate so track and platform are 100% aligned
            resampled[best_idx] = [round(st_coord[0], 6), round(st_coord[1], 6)]

        last_node = max(last_node + 1, best_idx)
        station_node_indices.append(best_idx)

        st_obj = {
            "id": meta["id"],
            "name": meta["name"],
            "coords": resampled[best_idx],
            "trackNodeIndex": best_idx,
            "elevM": meta["elevM"],
            "structure": meta["structure"],
            "major": meta["major"],
            "terminus": meta["terminus"],
            "interchanges": meta["interchanges"],
            "interchange": meta["interchange"],
            "distanceMeters": round(cum_dists[best_idx], 1),
            "code": meta["code"],
            "hindi": meta["hindi"]
        }
        stations_list.append(st_obj)
        print(f"[{idx+1:2d}/38] {meta['name']:32s} -> node {best_idx:3d} @ {st_obj['distanceMeters']:7.1f}m ({meta['structure']})")

    # Recompute cum_dists after snapping
    cum_dists = [0.0]
    total_d = 0.0
    for i in range(1, len(resampled)):
        total_d += haversine(resampled[i-1], resampled[i])
        cum_dists.append(total_d)
    for st in stations_list:
        st["distanceMeters"] = round(cum_dists[st["trackNodeIndex"]], 1)
    total_len_m = cum_dists[-1]

    # Portals:
    # 1. Majlis Park (node 0, elev 16.5m) to Azadpur (node st[1], elev -16.0m) -> ramp down
    # 2. Netaji Subhash Place (node st[3], elev -16.0m) to Shakurpur (node st[4], elev 16.5m) -> ramp up
    # 3. Mayapuri (node st[8], elev 16.5m) to Naraina Vihar (node st[9], elev -16.0m) -> ramp down
    # 4. Naraina Vihar (node st[9], elev -16.0m) to Delhi Cantt (node st[10], elev 16.5m) -> ramp up
    # 5. Moti Bagh (node st[12], elev 16.5m) to Bhikaji Cama Place (node st[13], elev -16.0m) -> ramp down
    # 6. Sarai Kale Khan - Nizamuddin (node st[20], elev -16.0m) to Mayur Vihar-I (node st[21], elev 24.5m) -> ramp up across Yamuna
    p1 = (station_node_indices[0] + station_node_indices[1]) // 2
    p2 = (station_node_indices[3] + station_node_indices[4]) // 2
    p3 = (station_node_indices[8] + station_node_indices[9]) // 2
    p4 = (station_node_indices[9] + station_node_indices[10]) // 2
    p5 = (station_node_indices[12] + station_node_indices[13]) // 2
    p6 = (station_node_indices[20] + station_node_indices[21]) // 2

    portal_indices = [p1, p2, p3, p4, p5, p6]
    portal_coords = [resampled[p] for p in portal_indices]

    out_osm = {
        "line": "pink",
        "lineName": "Pink Line (Line 7)",
        "color": "#EC4899",
        "stations": stations_list,
        "centerline": resampled,
        "portalIndices": portal_indices,
        "portalCoords": portal_coords,
        "totalLenMeters": round(total_len_m, 1)
    }

    osm_path = ROOT / "src" / "data" / "pink_line_accurate_osm.json"
    with open(osm_path, "w", encoding="utf-8") as f:
        json.dump(out_osm, f, indent=2)
    print(f"\nSuccessfully wrote {osm_path} with {len(resampled)} centerline points and {len(stations_list)} stations.")

    # Service data
    service_stations = []
    for idx, s in enumerate(stations_list):
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
            "code": s["code"],
            "hindi": s["hindi"],
            "isTerminal": s["terminus"],
            "isShortTurnTerminal": (s["name"] in ["Maujpur - Babarpur", "Mayur Vihar Pocket-1"]),
            "dwellSeconds": 90 if s["terminus"] else (45 if s["major"] else 25)
        })

    out_svc = {
        "meta": {
            "lineId": "pink",
            "lineName": "Pink Line (Line 7)",
            "lineColor": "#EC4899",
            "fleetType": "Hyundai Rotem RS-10 / Alstom Metropolis 6-car",
            "carsPerTrain": 6,
            "operationalSpeedKmh": 80,
            "totalLengthKm": round(total_len_m / 1000.0, 2),
            "stationsCount": len(stations_list),
            "headwayPeakMinutes": 4.5,
            "headwayRegularMinutes": 6.5,
            "firstTrain": "05:30",
            "lastTrain": "23:30"
        },
        "stations": service_stations
    }

    svc_path = ROOT / "src" / "data" / "pink_line_service.json"
    with open(svc_path, "w", encoding="utf-8") as f:
        json.dump(out_svc, f, indent=2)
    print(f"Successfully wrote {svc_path}")

if __name__ == "__main__":
    main()
