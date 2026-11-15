import json
import urllib.request

url = "https://api.openstreetmap.org/api/0.6/relation/8242437/full.json"
req = urllib.request.Request(url, headers={"User-Agent": "DelhiMetroRadar/1.0"})
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode("utf-8"))

rel = next(e for e in data["elements"] if e["type"] == "relation")
ways = {e["id"]: e for e in data["elements"] if e["type"] == "way"}
nodes = {e["id"]: e for e in data["elements"] if e["type"] == "node"}

way_members = [m for m in rel["members"] if m["type"] == "way"]
print("Total way members in relation:", len(way_members))
for i, wm in enumerate(way_members[:12]):
    w = ways.get(wm["ref"])
    if w:
        tags = w.get("tags", {})
        wid = w["id"]
        wname = tags.get("name", "unnamed")
        rw = tags.get("railway")
        br = tags.get("bridge")
        tu = tags.get("tunnel")
        nl = len(w["nodes"])
        fn = nodes.get(w["nodes"][0])
        ln = nodes.get(w["nodes"][-1])
        fnc = [fn["lon"], fn["lat"]] if fn else []
        lnc = [ln["lon"], ln["lat"]] if ln else []
        print(f"[{i:2d}] Way {wid}: {wname} | rw={rw} br={br} tu={tu} nodes={nl} | {fnc} -> {lnc}")

node_members = [m for m in rel["members"] if m["type"] == "node"]
print("\nFirst 8 node members in relation:")
for i, nm in enumerate(node_members[:8]):
    n = nodes.get(nm["ref"])
    tags = n.get("tags", {}) if n else {}
    nname = tags.get("name", "unnamed")
    role = nm.get("role", "")
    nref = nm["ref"]
    nc = [n["lon"], n["lat"]] if n else []
    print(f"[{i:2d}] Node {nref}: {nname} role={role} coords={nc}")
