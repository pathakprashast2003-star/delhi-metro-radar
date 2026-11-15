#!/usr/bin/env python3
"""
Builds exact, authentic OpenStreetMap & service JSON files for the
Delhi Metro Pink Line (Line 7 / Majlis Park ↔ Shiv Vihar, 58.6 km, 38 stations)
directly from OpenStreetMap Relation 8242437 (31 operational railway ways, 741 vertices):
- src/data/pink_line_accurate_osm.json
- src/data/pink_line_service.json
"""

import json
import math
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data"

# Station metadata for authentic Pink Line
STATION_METADATA = [
    {
        "id": "majlis_park",
        "name": "Majlis Park",
        "hindi": "मजलिस पार्क",
        "structure": "elevated",
        "elevM": 16.5,
        "major": True,
        "terminus": True,
        "interchanges": ["Magenta Line (Phase IV)"],
        "interchange": "Phase IV",
        "code": "MJPK",
        "dwellSeconds": 90
    },
    {
        "id": "azadpur_pink",
        "name": "Azadpur",
        "hindi": "आज़ादपुर",
        "structure": "underground",
        "elevM": -16.0,
        "major": True,
        "terminus": False,
        "interchanges": ["Yellow Line"],
        "interchange": "Yellow Line",
        "code": "AZP",
        "dwellSeconds": 45
    },
    {
        "id": "shalimar_bagh",
        "name": "Shalimar Bagh",
        "hindi": "शालीमार बाग़",
        "structure": "underground",
        "elevM": -15.0,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "SHMB",
        "dwellSeconds": 25
    },
    {
        "id": "netaji_subhash_place_pink",
        "name": "Netaji Subhash Place",
        "hindi": "नेताजी सुभाष प्लेस",
        "structure": "underground",
        "elevM": -16.0,
        "major": True,
        "terminus": False,
        "interchanges": ["Red Line"],
        "interchange": "Red Line",
        "code": "NSP",
        "dwellSeconds": 45
    },
    {
        "id": "shakurpur",
        "name": "Shakurpur",
        "hindi": "शकूरपुर",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "SHKP",
        "dwellSeconds": 25
    },
    {
        "id": "punjabi_bagh_west",
        "name": "Punjabi Bagh West",
        "hindi": "पंजाबी बाग़ पश्चिम",
        "structure": "elevated",
        "elevM": 17.5,
        "major": True,
        "terminus": False,
        "interchanges": ["Green Line"],
        "interchange": "Green Line",
        "code": "PBGW",
        "dwellSeconds": 40
    },
    {
        "id": "esi_basaidarapur",
        "name": "ESI - Basaidarapur",
        "hindi": "ईएसआई - बसईदारापुर",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "ESIB",
        "dwellSeconds": 25
    },
    {
        "id": "rajouri_garden_pink",
        "name": "Rajouri Garden",
        "hindi": "राजौरी गार्डन",
        "structure": "elevated",
        "elevM": 21.0,
        "major": True,
        "terminus": False,
        "interchanges": ["Blue Line"],
        "interchange": "Blue Line",
        "code": "RJGD",
        "dwellSeconds": 50
    },
    {
        "id": "mayapuri",
        "name": "Mayapuri",
        "hindi": "मायापुरी",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "MYPR",
        "dwellSeconds": 25
    },
    {
        "id": "naraina_vihar",
        "name": "Naraina Vihar",
        "hindi": "नारायणा विहार",
        "structure": "underground",
        "elevM": -16.0,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "NRVR",
        "dwellSeconds": 25
    },
    {
        "id": "delhi_cantt",
        "name": "Delhi Cantt.",
        "hindi": "दिल्ली कैन्ट.",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": ["Delhi Cantt. Railway Station feeder"],
        "interchange": None,
        "code": "DLCN",
        "dwellSeconds": 30
    },
    {
        "id": "durgabai_deshmukh_south_campus",
        "name": "Durgabai Deshmukh South Campus",
        "hindi": "दुर्गाबाई देशमुख साउथ कैम्पस",
        "structure": "elevated",
        "elevM": 23.6,
        "major": True,
        "terminus": False,
        "interchanges": ["Airport Express via Dhaula Kuan Travelator"],
        "interchange": "Airport Express",
        "code": "DDSC",
        "dwellSeconds": 50
    },
    {
        "id": "sir_m_vishweshwaraiah_moti_bagh",
        "name": "Sir M. Vishweshwaraiah Moti Bagh",
        "hindi": "सर एम. विश्वेश्वरय्या मोती बाग",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "SMVM",
        "dwellSeconds": 25
    },
    {
        "id": "bhikaji_cama_place",
        "name": "Bhikaji Cama Place",
        "hindi": "भीकाजी कामा प्लेस",
        "structure": "underground",
        "elevM": -16.0,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "BKCP",
        "dwellSeconds": 25
    },
    {
        "id": "sarojini_nagar",
        "name": "Sarojini Nagar",
        "hindi": "सरोजिनी नगर",
        "structure": "underground",
        "elevM": -16.0,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "SJNR",
        "dwellSeconds": 30
    },
    {
        "id": "dilli_haat_ina_pink",
        "name": "Dilli Haat - INA",
        "hindi": "दिल्ली हाट - आईएनए",
        "structure": "underground",
        "elevM": -18.0,
        "major": True,
        "terminus": False,
        "interchanges": ["Yellow Line"],
        "interchange": "Yellow Line",
        "code": "INA",
        "dwellSeconds": 50
    },
    {
        "id": "south_extension",
        "name": "South Extension",
        "hindi": "साउथ एक्सटेंशन",
        "structure": "underground",
        "elevM": -16.0,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "SXNT",
        "dwellSeconds": 30
    },
    {
        "id": "lajpat_nagar_pink",
        "name": "Lajpat Nagar",
        "hindi": "लाजपत नगर",
        "structure": "underground",
        "elevM": -18.0,
        "major": True,
        "terminus": False,
        "interchanges": ["Violet Line"],
        "interchange": "Violet Line",
        "code": "LJNR",
        "dwellSeconds": 50
    },
    {
        "id": "vinobapuri",
        "name": "Vinobapuri",
        "hindi": "विनोबापुरी",
        "structure": "underground",
        "elevM": -16.0,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "VNBP",
        "dwellSeconds": 25
    },
    {
        "id": "ashram",
        "name": "Ashram",
        "hindi": "आश्रम",
        "structure": "underground",
        "elevM": -16.0,
        "major": False,
        "terminus": False,
        "interchanges": ["Ashram Chowk Underpass"],
        "interchange": None,
        "code": "ASHR",
        "dwellSeconds": 30
    },
    {
        "id": "sarai_kale_khan_nizamuddin",
        "name": "Sarai Kale Khan - Nizamuddin",
        "hindi": "सराय काले ख़ान - निज़ामुद्दीन",
        "structure": "underground",
        "elevM": -16.0,
        "major": True,
        "terminus": False,
        "interchanges": ["Hazrat Nizamuddin Railway Station", "Sarai Kale Khan RRTS", "ISBT Sarai Kale Khan"],
        "interchange": "Nizamuddin Hub",
        "code": "SKKN",
        "dwellSeconds": 50
    },
    {
        "id": "mayur_vihar_1_pink",
        "name": "Mayur Vihar-I",
        "hindi": "मयूर विहार-I",
        "structure": "elevated",
        "elevM": 24.5,
        "major": True,
        "terminus": False,
        "interchanges": ["Blue Line"],
        "interchange": "Blue Line",
        "code": "MV1",
        "dwellSeconds": 50
    },
    {
        "id": "mayur_vihar_pocket_1",
        "name": "Mayur Vihar Pocket-1",
        "hindi": "मयूर विहार पॉकेट-१",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": ["Shree Ram Mandir"],
        "interchange": None,
        "code": "MVP1",
        "dwellSeconds": 25
    },
    {
        "id": "trilokpuri_sanjay_lake",
        "name": "Trilokpuri - Sanjay Lake",
        "hindi": "त्रिलोकपुरी - संजय लेक",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": ["Sanjay Lake Park"],
        "interchange": None,
        "code": "TKSJ",
        "dwellSeconds": 25
    },
    {
        "id": "east_vinod_nagar_mayur_vihar_2",
        "name": "East Vinod Nagar - Mayur Vihar-II",
        "hindi": "ईस्ट विनोद नगर - मयूर विहार-II",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "EVN2",
        "dwellSeconds": 25
    },
    {
        "id": "mandawali_west_vinod_nagar",
        "name": "Mandawali - West Vinod Nagar",
        "hindi": "मण्डावली - वेस्ट विनोद नगर",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "MWVN",
        "dwellSeconds": 25
    },
    {
        "id": "ip_extension",
        "name": "IP Extension",
        "hindi": "इन्द्रप्रस्थ एक्सटेंशन",
        "structure": "elevated",
        "elevM": 16.5,
        "major": True,
        "terminus": False,
        "interchanges": ["Vinod Nagar Depot feeder"],
        "interchange": "Depot",
        "code": "IPEX",
        "dwellSeconds": 35
    },
    {
        "id": "anand_vihar_pink",
        "name": "Anand Vihar",
        "hindi": "आनंद विहार",
        "structure": "elevated",
        "elevM": 17.5,
        "major": True,
        "terminus": False,
        "interchanges": ["Blue Line", "Anand Vihar Railway Terminal", "Anand Vihar RRTS", "ISBT Anand Vihar"],
        "interchange": "Blue Line",
        "code": "ANVR",
        "dwellSeconds": 60
    },
    {
        "id": "karkarduma_pink",
        "name": "Karkarduma",
        "hindi": "कड़कड़डूमा",
        "structure": "elevated",
        "elevM": 24.5,
        "major": True,
        "terminus": False,
        "interchanges": ["Blue Line"],
        "interchange": "Blue Line",
        "code": "KKDM",
        "dwellSeconds": 50
    },
    {
        "id": "karkarduma_court",
        "name": "Karkarduma Court",
        "hindi": "कड़कड़डूमा कोर्ट",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": ["District Courts"],
        "interchange": None,
        "code": "KKCT",
        "dwellSeconds": 25
    },
    {
        "id": "krishna_nagar",
        "name": "Krishna Nagar",
        "hindi": "कृष्णा नगर",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "KSNA",
        "dwellSeconds": 25
    },
    {
        "id": "east_azad_nagar",
        "name": "East Azad Nagar",
        "hindi": "ईस्ट आज़ाद नगर",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "EAZN",
        "dwellSeconds": 25
    },
    {
        "id": "welcome_pink",
        "name": "Welcome",
        "hindi": "वेलकम",
        "structure": "elevated",
        "elevM": 17.5,
        "major": True,
        "terminus": False,
        "interchanges": ["Red Line"],
        "interchange": "Red Line",
        "code": "WEL",
        "dwellSeconds": 50
    },
    {
        "id": "jaffrabad",
        "name": "Jaffrabad",
        "hindi": "जाफ़राबाद",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "JFBD",
        "dwellSeconds": 25
    },
    {
        "id": "maujpur_babarpur",
        "name": "Maujpur - Babarpur",
        "hindi": "मौजपुर - बाबरपुर",
        "structure": "elevated",
        "elevM": 18.0,
        "major": True,
        "terminus": False,
        "interchanges": ["Pink Line Ring & Branch Junction"],
        "interchange": "Junction",
        "code": "MJPR",
        "dwellSeconds": 45
    },
    {
        "id": "gokulpuri",
        "name": "Gokulpuri",
        "hindi": "गोकुलपुरी",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "GKPR",
        "dwellSeconds": 25
    },
    {
        "id": "johri_enclave",
        "name": "Johri Enclave",
        "hindi": "जोहरी एन्क्लेव",
        "structure": "elevated",
        "elevM": 16.5,
        "major": False,
        "terminus": False,
        "interchanges": [],
        "interchange": None,
        "code": "JHEN",
        "dwellSeconds": 25
    },
    {
        "id": "shiv_vihar",
        "name": "Shiv Vihar",
        "hindi": "शिव विहार",
        "structure": "elevated",
        "elevM": 16.5,
        "major": True,
        "terminus": True,
        "interchanges": ["Loni Border feeder"],
        "interchange": "Loni Border",
        "code": "SHVR",
        "dwellSeconds": 90
    }
]

def dist_m(p1, p2):
    kx = 111320.0 * math.cos(math.radians((p1[1] + p2[1]) * 0.5))
    return math.hypot((p2[0] - p1[0]) * kx, (p2[1] - p1[1]) * 110540.0)

def main():
    print("Fetching authentic OpenStreetMap Relation 8242437 (Pink Line)...")
    url = "https://api.openstreetmap.org/api/0.6/relation/8242437/full.json"
    req = urllib.request.Request(url, headers={"User-Agent": "DelhiMetroRadar/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read().decode('utf-8'))

    nodes = {e['id']: [round(e['lon'], 6), round(e['lat'], 6)] for e in data['elements'] if e['type'] == 'node'}
    ways = {e['id']: e for e in data['elements'] if e['type'] == 'way'}
    rel = next(e for e in data['elements'] if e['type'] == 'relation')

    # Operational section starts from way index 5 (Majlis Park northern crossover)
    operational_ways = [m for m in rel['members'] if m['type'] == 'way'][5:]
    print(f"Stitching {len(operational_ways)} operational railway ways...")

    stitched = []
    for wm in operational_ways:
        w = ways.get(wm['ref'])
        if not w:
            continue
        w_pts = [nodes[nid] for nid in w['nodes'] if nid in nodes]
        if not stitched:
            stitched.extend(w_pts)
        else:
            d_norm = dist_m(stitched[-1], w_pts[0])
            d_rev = dist_m(stitched[-1], w_pts[-1])
            if d_rev < d_norm:
                w_pts.reverse()
            stitched.extend(w_pts[1:])

    print(f"Stitched polyline contains {len(stitched)} raw vertices.")

    # 38 operational stops in relation 8242437 (indices 9 to 46)
    stops = [m for m in rel['members'] if m.get('role') == 'stop'][9:]
    stop_coords = [nodes[m['ref']] for m in stops]

    # Densify straightaways > 90m while preserving every station coordinate as an exact vertex
    dense = []
    station_node_indices = {}

    for i in range(len(stitched)):
        pt = stitched[i]
        for s_idx, sc in enumerate(stop_coords):
            if pt[0] == sc[0] and pt[1] == sc[1]:
                station_node_indices[s_idx] = len(dense)
        dense.append(pt)
        if i < len(stitched) - 1:
            next_pt = stitched[i + 1]
            seg_len = dist_m(pt, next_pt)
            if seg_len > 90.0:
                steps = math.ceil(seg_len / 80.0)
                for s in range(1, steps):
                    f = s / steps
                    interp = [
                        round(pt[0] + (next_pt[0] - pt[0]) * f, 6),
                        round(pt[1] + (next_pt[1] - pt[1]) * f, 6)
                    ]
                    dense.append(interp)

    total_pts = len(dense)
    print(f"Densified smooth polyline contains {total_pts} points.")
    assert len(station_node_indices) == 38, f"Expected 38 stations mapped, got {len(station_node_indices)}"

    # Compute cumulative distances along the polyline
    cum_dists = [0.0]
    for i in range(1, total_pts):
        d = dist_m(dense[i - 1], dense[i])
        cum_dists.append(cum_dists[-1] + d)
    total_len_m = cum_dists[-1]
    print(f"Total operational corridor length: {total_len_m / 1000.0:.2f} km")

    # Build calibrated station list
    calibrated_stations = []
    service_stations = []

    for s_idx in range(38):
        node_idx = station_node_indices[s_idx]
        coord = dense[node_idx]
        dist_at_node = round(cum_dists[node_idx], 1)
        meta = STATION_METADATA[s_idx]

        st_obj = {
            "id": meta["id"],
            "name": meta["name"],
            "coords": coord,
            "trackNodeIndex": node_idx,
            "elevM": meta["elevM"],
            "structure": meta["structure"],
            "major": meta["major"],
            "terminus": meta["terminus"],
            "interchanges": meta["interchanges"],
            "interchange": meta["interchange"],
            "distanceMeters": dist_at_node,
            "code": meta["code"],
            "hindi": meta["hindi"]
        }
        calibrated_stations.append(st_obj)

        svc_obj = dict(st_obj)
        svc_obj["index"] = s_idx
        svc_obj["isTerminal"] = meta["terminus"]
        svc_obj["isShortTurnTerminal"] = False
        svc_obj["dwellSeconds"] = meta["dwellSeconds"]
        service_stations.append(svc_obj)

        print(f"[{s_idx + 1:2d}/38] {meta['name']:32s} -> node {node_idx:4d} @ {dist_at_node:7.1f}m ({meta['structure']})")

    # The 6 physical portal locations between elevated & underground sections
    # 1. Majlis Park -> Azadpur: ramp down around node 25
    # 2. Netaji Subhash Place -> Shakurpur: ramp up around node 102
    # 3. Mayapuri -> Naraina Vihar: ramp down around node 245
    # 4. Naraina Vihar -> Delhi Cantt: ramp up around node 274
    # 5. Moti Bagh -> Bhikaji Cama Place: ramp down around node 390
    # 6. Sarai Kale Khan - Nizamuddin -> Mayur Vihar-I: ramp up across Yamuna around node 594
    p1_idx = (station_node_indices[0] + station_node_indices[1]) // 2
    p2_idx = (station_node_indices[3] + station_node_indices[4]) // 2
    p3_idx = (station_node_indices[8] + station_node_indices[9]) // 2
    p4_idx = (station_node_indices[9] + station_node_indices[10]) // 2
    p5_idx = (station_node_indices[12] + station_node_indices[13]) // 2
    p6_idx = (station_node_indices[20] + station_node_indices[21]) // 2
    portal_indices = [p1_idx, p2_idx, p3_idx, p4_idx, p5_idx, p6_idx]
    portal_coords = [dense[idx] for idx in portal_indices]

    accurate_osm_data = {
        "line": "pink",
        "lineName": "Pink Line",
        "color": "#EC4899",
        "stations": calibrated_stations,
        "centerline": dense,
        "portalIndices": portal_indices,
        "portalCoords": portal_coords,
        "totalLenMeters": round(total_len_m, 1)
    }

    service_data = {
        "line": "pink",
        "name": "Pink Line (Majlis Park ↔ Shiv Vihar)",
        "color": "#EC4899",
        "corridor": "pink",
        "stations": service_stations
    }

    osm_out = DATA_DIR / "pink_line_accurate_osm.json"
    svc_out = DATA_DIR / "pink_line_service.json"

    with open(osm_out, "w", encoding="utf-8") as f:
        json.dump(accurate_osm_data, f, indent=2, ensure_ascii=False)
    print(f"Wrote accurate OSM data to {osm_out}")

    with open(svc_out, "w", encoding="utf-8") as f:
        json.dump(service_data, f, indent=2, ensure_ascii=False)
    print(f"Wrote service data to {svc_out}")

if __name__ == "__main__":
    main()
