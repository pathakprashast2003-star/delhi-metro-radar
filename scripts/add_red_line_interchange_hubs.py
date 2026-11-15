import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HUBS_FILE = ROOT / "src" / "data" / "dmrc_interchange_hubs.json"

with open(HUBS_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

# 1. INDERLOK (Red Line Upper Tier + Green Line Terminus via Parsvnath Mall Concourse)
# Green Line approaches from the west and terminates at [77.16985, 28.67320]
# Real OSM Way 610022330 + 1489748190
inderlok_green_pts = [
    [77.164082, 28.670702],
    [77.164699, 28.670571],
    [77.165194, 28.670558],
    [77.165704, 28.670613],
    [77.166121, 28.670713],
    [77.166564, 28.670947],
    [77.167200, 28.671300],
    [77.167964, 28.671749],
    [77.168500, 28.672100],
    [77.168900, 28.672480],
    [77.169220, 28.672720],
    [77.169563, 28.672961],
    [77.169850, 28.673200]
]

data["hubs"]["Inderlok"] = {
    "primaryLine": "Red Line",
    "primaryStructure": "elevated",
    "primaryCenter": [77.170354, 28.673543],
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
            "stationLen": 100,
            "platformWidth": 16.0,
            "isTerminus": True,
            "terminusEnd": "end",
            "center": [77.169563, 28.672961],
            "tangent": [0.778, 0.628],
            "trackPolyline": inderlok_green_pts
        }
    ]
}

# 2. WELCOME (Red Line Elevated crossing Pink Line Elevated with 110m Covered Skywalk)
# Real OSM Way 642636562 / 1055611602 + Station Way 699660184
welcome_pink_pts = [
    [77.275800, 28.669800],
    [77.276080, 28.670700],
    [77.276400, 28.671600],
    [77.276779, 28.672444],
    [77.277150, 28.673300],
    [77.277500, 28.674200],
    [77.277900, 28.675200]
]

data["hubs"]["Welcome"] = {
    "primaryLine": "Red Line",
    "primaryStructure": "elevated",
    "primaryCenter": [77.277710, 28.671834],
    "primaryTangent": [0.998, 0.063],
    "archetype": "el_cross_over",
    "flattenLowerCanopy": False,
    "arms": [
        {
            "line": "Pink Line",
            "color": "#EC4899",
            "tier": "elevated",
            "deckY": 12.0,
            "platformType": "island",
            "stationLen": 110,
            "platformWidth": 17.0,
            "isTerminus": False,
            "terminusEnd": None,
            "center": [77.276779, 28.672444],
            "tangent": [0.380, 0.925],
            "trackPolyline": welcome_pink_pts
        }
    ]
}

# 3. NETAJI SUBHASH PLACE (Red Line Elevated + Pink Line Underground Box via Pacific Mall Subway)
# Real OSM Way 364876206 / 610024723 + Pathway Way 1209274129
nsp_pink_pts = [
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
    "primaryCenter": [77.152655, 28.696030],
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
            "stationLen": 120,
            "platformWidth": 18.0,
            "isTerminus": False,
            "terminusEnd": None,
            "center": [77.153950, 28.694900],
            "tangent": [0.707, 0.707],
            "trackPolyline": nsp_pink_pts
        }
    ]
}

data["meta"]["hubCount"] = len(data["hubs"])
with open(HUBS_FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print(f"Updated {HUBS_FILE}: Total hubs now = {len(data['hubs'])}")
