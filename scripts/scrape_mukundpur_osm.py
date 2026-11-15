from scrapling import Fetcher
import xml.etree.ElementTree as ET
import json

url = "https://api.openstreetmap.org/api/0.6/map?bbox=77.175,28.718,77.195,28.730"
print(f"Fetching from official OSM API with scrapling: {url}")
fetcher = Fetcher()
res = fetcher.get(url, timeout=30)
print("Status:", res.status)

if res.status == 200:
    root = ET.fromstring(res.body)
    nodes = {n.get("id"): (float(n.get("lon")), float(n.get("lat"))) for n in root.findall("node")}
    ways = root.findall("way")
    rw_ways = []
    buildings = []
    
    for w in ways:
        tags = {t.get("k"): t.get("v") for t in w.findall("tag")}
        w_coords = [nodes.get(nd.get("ref")) for nd in w.findall("nd") if nd.get("ref") in nodes]
        if "railway" in tags:
            rw_ways.append({
                "id": w.get("id"),
                "tags": tags,
                "coords": w_coords
            })
        elif "building" in tags:
            buildings.append({
                "id": w.get("id"),
                "tags": tags,
                "coords": w_coords
            })
            
    print(f"Total nodes: {len(nodes)}, Total ways: {len(ways)}, Railway ways: {len(rw_ways)}, Buildings: {len(buildings)}")
    
    for i, rw in enumerate(rw_ways):
        tags = rw["tags"]
        name = tags.get("name", "unnamed")
        r_type = tags.get("railway", "")
        service = tags.get("service", "")
        bridge = tags.get("bridge", "")
        pts = len(rw["coords"])
        print(f"[{i:2d}] Way {rw['id']}: {name} (rw={r_type}, service={service}, bridge={bridge}) {pts} pts")
        
    with open("scripts/mukundpur_osm_parsed.json", "w") as f:
        json.dump({"railways": rw_ways, "buildings": buildings}, f, indent=2)
    print("Saved to scripts/mukundpur_osm_parsed.json")
else:
    print("Failed to fetch from OSM API")
