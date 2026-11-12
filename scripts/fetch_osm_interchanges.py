#!/usr/bin/env python3
"""
Fetches high-resolution OpenStreetMap ways & station nodes around all 19
Yellow / Blue / Vaishali interchange hubs via api.openstreetmap.org/api/0.6/map
so every hub uses true OSM geometry rather than simplified GTFS corner vertices.
"""
import json
import math
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HUBS_FILE = ROOT / "src" / "data" / "dmrc_interchange_hubs.json"
OUT_CACHE = ROOT / "scripts" / "osm_hubs_cache.json"


def dist_m(a, b):
    kx = 111320.0 * math.cos(math.radians((a[1] + b[1]) * 0.5))
    return math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * 110540.0)


def fetch_bbox(lon, lat, dlon=0.0048, dlat=0.0042):
    url = f"https://api.openstreetmap.org/api/0.6/map?bbox={lon-dlon:.5f},{lat-dlat:.5f},{lon+dlon:.5f},{lat+dlat:.5f}"
    req = urllib.request.Request(url, headers={"User-Agent": "delhi-metro-radar/1.0"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read()


def parse_osm(xml_bytes):
    root = ET.fromstring(xml_bytes)
    nodes = {}
    station_nodes = []
    for n in root.findall("node"):
        nid = n.attrib["id"]
        lon, lat = float(n.attrib["lon"]), float(n.attrib["lat"])
        tags = {t.attrib["k"]: t.attrib["v"] for t in n.findall("tag")}
        nodes[nid] = (lon, lat)
        if tags.get("railway") in ("station", "halt") or tags.get("station") in ("subway", "light_rail", "monorail"):
            station_nodes.append({"id": nid, "lon": lon, "lat": lat, "tags": tags})

    rail_ways = []
    platform_ways = []
    for w in root.findall("way"):
        tags = {t.attrib["k"]: t.attrib["v"] for t in w.findall("tag")}
        nd_refs = [nd.attrib["ref"] for nd in w.findall("nd")]
        coords = [[round(nodes[r][0], 6), round(nodes[r][1], 6)] for r in nd_refs if r in nodes]
        if len(coords) < 2:
            continue
        rw = tags.get("railway")
        pt = tags.get("public_transport")
        if rw in ("subway", "light_rail", "monorail"):
            rail_ways.append({"id": w.attrib["id"], "tags": tags, "coords": coords})
        elif pt == "platform" or rw == "platform":
            platform_ways.append({"id": w.attrib["id"], "tags": tags, "coords": coords})

    return {"station_nodes": station_nodes, "rail_ways": rail_ways, "platform_ways": platform_ways}


def main():
    hubs = json.load(open(HUBS_FILE))["hubs"]
    cache = json.load(open(OUT_CACHE)) if OUT_CACHE.exists() else {}

    for name, h in hubs.items():
        if name in cache and cache[name].get("rail_ways"):
            print(f"[cached] {name}")
            continue
        lon, lat = h["primaryCenter"]
        # Use wider bbox for Noida Sec-52 <-> Sec-51 (280m offset) and long interchanges
        dlon = 0.0062 if name in ("Noida Sec-52", "Mayur Vihar-I", "Sikanderpur") else 0.0046
        dlat = 0.0052 if name in ("Noida Sec-52", "Mayur Vihar-I", "Sikanderpur") else 0.0040
        print(f"Fetching {name} @ ({lon:.5f}, {lat:.5f})...", flush=True)
        for attempt in range(3):
            try:
                xml_bytes = fetch_bbox(lon, lat, dlon, dlat)
                parsed = parse_osm(xml_bytes)
                cache[name] = parsed
                OUT_CACHE.write_text(json.dumps(cache))
                st_names = [s["tags"].get("name") for s in parsed["station_nodes"]]
                way_names = sorted({w["tags"].get("name") or w["tags"].get("railway") for w in parsed["rail_ways"]})
                print(f"  -> {len(parsed['station_nodes'])} stations {st_names} | {len(parsed['rail_ways'])} ways {way_names}")
                break
            except Exception as e:
                print(f"  retry {attempt+1}: {e}")
                time.sleep(1.5)
        time.sleep(0.35)

    print(f"Saved OSM cache for {len(cache)} hubs to {OUT_CACHE}")


if __name__ == "__main__":
    main()

