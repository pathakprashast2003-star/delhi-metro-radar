import math
import json
import re

LAT0 = 28.6328
LON0 = 77.2195
SCALE = 100.0  # 1 Three.js unit = 100 meters

def project(lon, lat, elev=0.0):
    x = (lon - LON0) * 111000.0 * math.cos(math.radians(LAT0)) / SCALE
    z = -(lat - LAT0) * 111000.0 / SCALE
    return [round(x, 3), round(elev, 3), round(z, 3)]

def project_ring(coords, elev=0.0):
    return [project(pt[0], pt[1], elev) for pt in coords]

# 1. Yamuna River GeoJSON Path
YAMUNA_RAW = [
    [77.218, 28.845], [77.222, 28.815], [77.226, 28.780], [77.230, 28.750], 
    [77.234, 28.718], [77.237, 28.692], [77.241, 28.672], [77.246, 28.655], 
    [77.255, 28.642], [77.264, 28.630], [77.268, 28.618], [77.266, 28.598], 
    [77.268, 28.585], [77.276, 28.572], [77.292, 28.558], [77.308, 28.546], 
    [77.322, 28.532], [77.332, 28.510], [77.340, 28.480], [77.348, 28.450]
]

# Generate Yamuna 3D River Ribbon with width ~3.5 units (350m)
yamuna_ribbon_left = []
yamuna_ribbon_right = []
yamuna_center = []

for i in range(len(YAMUNA_RAW)):
    curr = project(YAMUNA_RAW[i][0], YAMUNA_RAW[i][1], -0.05)
    yamuna_center.append(curr)
    
    if i < len(YAMUNA_RAW) - 1:
        next_pt = project(YAMUNA_RAW[i+1][0], YAMUNA_RAW[i+1][1], -0.05)
        dx = next_pt[0] - curr[0]
        dz = next_pt[2] - curr[2]
    else:
        prev_pt = project(YAMUNA_RAW[i-1][0], YAMUNA_RAW[i-1][1], -0.05)
        dx = curr[0] - prev_pt[0]
        dz = curr[2] - prev_pt[2]
        
    length = math.sqrt(dx*dx + dz*dz) or 1.0
    nx = -dz / length * 2.0  # ~200m half-width
    nz = dx / length * 2.0
    
    yamuna_ribbon_left.append([round(curr[0] + nx, 3), -0.05, round(curr[2] + nz, 3)])
    yamuna_ribbon_right.append([round(curr[0] - nx, 3), -0.05, round(curr[2] - nz, 3)])

# 2. Delhi Ridge and Forest Reserves
PARKS_RAW = {
    "central_ridge": {
        "name": "Central Ridge Reserve",
        "coords": [[77.165, 28.625], [77.185, 28.630], [77.200, 28.615], [77.195, 28.595], [77.170, 28.585], [77.155, 28.605], [77.165, 28.625]]
    },
    "northern_ridge": {
        "name": "Northern Ridge (Civil Lines)",
        "coords": [[77.202, 28.675], [77.215, 28.695], [77.225, 28.685], [77.215, 28.665], [77.202, 28.675]]
    },
    "southern_ridge_sanjay_van": {
        "name": "Southern Ridge & Sanjay Van",
        "coords": [[77.155, 28.540], [77.175, 28.550], [77.192, 28.535], [77.195, 28.515], [77.180, 28.505], [77.160, 28.515], [77.155, 28.540]]
    },
    "central_vista_lawns": {
        "name": "Central Vista Greens & India Gate Lawns",
        "coords": [[77.199, 28.616], [77.235, 28.616], [77.235, 28.610], [77.199, 28.610], [77.199, 28.616]]
    },
    "lodhi_gardens": {
        "name": "Lodhi Gardens",
        "coords": [[77.215, 28.598], [77.225, 28.598], [77.225, 28.588], [77.215, 28.588], [77.215, 28.598]]
    }
}

parks_projected = []
for pid, pdata in PARKS_RAW.items():
    pts = project_ring(pdata["coords"], elev=0.01)
    parks_projected.append({
        "id": pid,
        "name": pdata["name"],
        "points": pts
    })

# 3. Landmark Silhouettes
LANDMARKS_RAW = [
    {"id": "india_gate", "name": "India Gate", "lon": 77.2295, "lat": 28.6129, "type": "arch", "h": 4.2, "w": 3.0},
    {"id": "qutab_minar", "name": "Qutab Minar", "lon": 77.1855, "lat": 28.5244, "type": "tower", "h": 7.3, "w": 1.4},
    {"id": "red_fort", "name": "Red Fort", "lon": 77.2410, "lat": 28.6562, "type": "rampart", "h": 2.5, "w": 4.5},
    {"id": "lotus_temple", "name": "Lotus Temple", "lon": 77.2588, "lat": 28.5535, "type": "petal_dome", "h": 3.6, "w": 3.2},
    {"id": "rashtrapati_bhavan", "name": "Rashtrapati Bhavan", "lon": 77.1990, "lat": 28.6143, "type": "dome_complex", "h": 3.8, "w": 5.0},
    {"id": "connaught_place", "name": "Connaught Place", "lon": 77.2195, "lat": 28.6328, "type": "circle", "h": 1.4, "w": 4.0},
    {"id": "aerocity_t3", "name": "IGI Airport Terminal 3", "lon": 77.0850, "lat": 28.5560, "type": "airport", "h": 2.0, "w": 6.0}
]

landmarks_projected = []
for lm in LANDMARKS_RAW:
    pos = project(lm["lon"], lm["lat"], 0.0)
    landmarks_projected.append({
        "id": lm["id"],
        "name": lm["name"],
        "type": lm["type"],
        "x": pos[0],
        "y": pos[1],
        "z": pos[2],
        "height": lm["h"],
        "width": lm["w"]
    })

# 4. Yellow Line Accurate Points & Stations
with open('src/data/yellow_line_accurate_osm.json') as f:
    yl_data = json.load(f)

stations_dict = {}

for s in yl_data.get('stations', []):
    structure = s.get('structure', 'elevated')
    elev = 0.25 if structure == 'elevated' else -0.28
    pos = project(s['coords'][0], s['coords'][1], elev)
    st_id = s['id']
    stations_dict[st_id] = {
        "id": st_id,
        "name": s['name'],
        "line": "yellow-line",
        "lineColor": "#F59E0B",
        "structure": structure,
        "coords": s['coords'],
        "x": pos[0],
        "y": pos[1],
        "z": pos[2],
        "major": s.get('major', False),
        "terminus": s.get('terminus', False),
        "interchange": s.get('interchange', None)
    }

yellow_spline = []
for pt in yl_data.get('centerline', []):
    lat = pt[1]
    is_tunnel = 28.535 <= lat <= 28.670
    elev = -0.28 if is_tunnel else 0.25
    yellow_spline.append(project(pt[0], pt[1], elev))

# 5. Extract other lines and stations from dmrc-network.js
with open('src/data/dmrc-network.js') as f:
    network_js = f.read()

feature_blocks = re.findall(r"properties:\s*\{(.*?)\},\s*geometry:\s*\{\s*type:\s*['\"]LineString['\"],\s*coordinates:\s*\[(.*?)\]\s*\}", network_js, re.DOTALL)

network_lines = []

for props_str, coords_str in feature_blocks:
    lid = re.search(r"id:\s*['\"]([^'\"]+)", props_str).group(1)
    name = re.search(r"name:\s*['\"]([^'\"]+)", props_str).group(1)
    color = re.search(r"color:\s*['\"]([^'\"]+)", props_str).group(1)
    
    # Extract coordinates and station comment names
    matches = re.findall(r"\[([0-9\.]+),\s*([0-9\.]+)\],?\s*(?://\s*([^\r\n]+))?", coords_str)
    spline_pts = []
    
    for lon_s, lat_s, st_name in matches:
        lon, lat = float(lon_s), float(lat_s)
        
        if lid == 'airport-express':
            elev = 0.30 if 28.57 <= lat <= 28.61 else -0.30
        elif lid == 'blue-line':
            elev = -0.25 if 77.21 <= lon <= 77.24 else 0.25
        else:
            elev = 0.25
            
        pt_proj = project(lon, lat, elev)
        spline_pts.append(pt_proj)
        
        if st_name:
            clean_name = st_name.strip()
            # Clean up uppercase INTERCHANGE flags
            clean_name = re.sub(r'\s*\(INTERCHANGE\)', '', clean_name, flags=re.IGNORECASE).strip()
            clean_id = re.sub(r'[^a-z0-9]+', '_', clean_name.lower()).strip('_')
            
            if clean_id not in stations_dict:
                structure = 'tunnel' if elev < 0 else 'elevated'
                stations_dict[clean_id] = {
                    "id": clean_id,
                    "name": clean_name,
                    "line": lid,
                    "lineColor": color,
                    "structure": structure,
                    "coords": [lon, lat],
                    "x": pt_proj[0],
                    "y": pt_proj[1],
                    "z": pt_proj[2],
                    "major": False,
                    "terminus": False,
                    "interchange": None
                }
            else:
                # Station already exists (e.g. interchange with Yellow Line)
                st = stations_dict[clean_id]
                st["major"] = True
                if not st.get("interchange"):
                    st["interchange"] = f"{st['line']} ✕ {lid}"
                elif lid not in st["interchange"]:
                    st["interchange"] += f" ✕ {lid}"

    network_lines.append({
        "id": lid,
        "name": name,
        "color": color,
        "points": spline_pts
    })

all_lines = [{
    "id": "yellow-line",
    "name": "Yellow Line (Line 2)",
    "color": "#F59E0B",
    "points": yellow_spline
}] + network_lines

all_stations = list(stations_dict.values())
# Sort stations alphabetically by name for clean search indexing
all_stations.sort(key=lambda s: s["name"])

# 6. Assemble Master Topology Package
topology = {
    "version": "4.1.0",
    "metadata": {
        "title": "Delhi NCR 3D Metro Architectural Topology",
        "origin": {"name": "Connaught Place / Rajiv Chowk", "lat": LAT0, "lon": LON0},
        "units": "1 unit = 100 meters (0.1 km)",
        "plinth": {
            "width": 520,
            "depth": 540,
            "height": 18,
            "bevel": 2.0
        }
    },
    "yamuna": {
        "name": "Yamuna River",
        "centerline": yamuna_center,
        "ribbonLeft": yamuna_ribbon_left,
        "ribbonRight": yamuna_ribbon_right
    },
    "parks": parks_projected,
    "landmarks": landmarks_projected,
    "lines": all_lines,
    "stations": all_stations
}

output_path = 'src/data/delhi_network_topology.json'
with open(output_path, 'w') as f:
    json.dump(topology, f, indent=2)

print(f"Successfully generated {output_path}!")
print(f"Total lines: {len(all_lines)}")
print(f"Total stations: {len(all_stations)}")
print(f"Total parks: {len(parks_projected)}")
print(f"Total landmarks: {len(landmarks_projected)}")
