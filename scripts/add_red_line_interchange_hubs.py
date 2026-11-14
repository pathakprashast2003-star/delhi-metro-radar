import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HUBS_FILE = ROOT / "src" / "data" / "dmrc_interchange_hubs.json"

with open(HUBS_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

# 1. INDERLOK (Red Line Upper Tier + Green Line Lower Tier Terminus)
# Real OSM Way 610022330 + 1489748190
inderlok_pts = [
    [77.164082, 28.670702],
    [77.164699, 28.670571],
    [77.165194, 28.670558],
    [77.165704, 28.670613],
    [77.166121, 28.670713],
    [77.166564, 28.670947],
    [77.167200, 28.671300],
    [77.167964, 28.671749],
    [77.168500, 28.672100],
    [77.169092, 28.672675],
    [77.169450, 28.672980],
    [77.169750, 28.673230],
    [77.170050, 28.673470],
    [77.170204, 28.673580]
]

data["hubs"]["Inderlok"] = {
    "primaryLine": "Red Line",
    "primaryStructure": "elevated",
    "primaryCenter": [77.170600, 28.673800],
    "primaryTangent": [0.082, 0.996],
    "archetype": "el_cross_over",
    "flattenLowerCanopy": False,
    "arms": [
        {
            "line": "Green Line",
            "color": "#22C55E",
            "tier": "elevated",
            "deckY": 10.5,
            "platformType": "island",
            "stationLen": 120,
            "platformWidth": 18.0,
            "isTerminus": True,
            "terminusEnd": "end",
            "center": [77.169800, 28.673200],
            "tangent": [0.778, 0.628],
            "trackPolyline": inderlok_pts
        }
    ]
}

# 2. WELCOME (Red Line Elevated crossing Pink Line Elevated with Skywalk)
# Real OSM Way 642636562 / 1055611602
welcome_pts = [
    [77.275320, 28.667850],
    [77.275510, 28.669020],
    [77.275750, 28.670250],
    [77.275920, 28.671200],
    [77.276082, 28.672252],
    [77.276250, 28.673400],
    [77.276480, 28.674650],
    [77.276700, 28.675800],
    [77.277020, 28.677100]
]

data["hubs"]["Welcome"] = {
    "primaryLine": "Red Line",
    "primaryStructure": "elevated",
    "primaryCenter": [77.277815, 28.671862],
    "primaryTangent": [0.998, 0.063],
    "archetype": "el_cross_over",
    "flattenLowerCanopy": False,
    "arms": [
        {
            "line": "Pink Line",
            "color": "#EC4899",
            "tier": "elevated",
            "deckY": 11.5,
            "platformType": "island",
            "stationLen": 130,
            "platformWidth": 18.5,
            "isTerminus": False,
            "terminusEnd": None,
            "center": [77.276082, 28.672252],
            "tangent": [0.155, 0.988],
            "trackPolyline": welcome_pts
        }
    ]
}

# 3. NETAJI SUBHASH PLACE (Red Line Elevated crossing Pink Line Underground Box)
# Real OSM Way 364876206 / 610024723
nsp_pts = [
    [77.151800, 28.692600],
    [77.152350, 28.693250],
    [77.152900, 28.693850],
    [77.153400, 28.694380],
    [77.153950, 28.694900],
    [77.154550, 28.695450],
    [77.155200, 28.696050],
    [77.155900, 28.696700],
    [77.156650, 28.697400]
]

data["hubs"]["Netaji Subhash Place"] = {
    "primaryLine": "Red Line",
    "primaryStructure": "elevated",
    "primaryCenter": [77.152800, 28.696100],
    "primaryTangent": [-0.642, 0.767],
    "archetype": "el_to_ug_cross",
    "flattenLowerCanopy": False,
    "arms": [
        {
            "line": "Pink Line",
            "color": "#EC4899",
            "tier": "underground",
            "deckY": 0.28,
            "platformType": "side",
            "stationLen": 130,
            "platformWidth": 19.0,
            "isTerminus": False,
            "terminusEnd": None,
            "center": [77.153950, 28.694900],
            "tangent": [0.707, 0.707],
            "trackPolyline": nsp_pts
        }
    ]
}

data["meta"]["hubCount"] = len(data["hubs"])
with open(HUBS_FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print(f"Updated {HUBS_FILE}: Total hubs now = {len(data['hubs'])}")
