"""
Build Delhi Metro topology with:
1. All stations with [lon, lat] geographic coordinates (for MapLibre projection)
2. All line centerlines as [lon, lat] arrays
3. Station structure (elevated/underground) with elevation in meters
"""
import math
import json
import re

LAT0 = 28.6328
LON0 = 77.2195
SCALE = 100.0

def project_to_meters(lon, lat):
    x = (lon - LON0) * 111000.0 * math.cos(math.radians(LAT0)) / SCALE
    z = -(lat - LAT0) * 111000.0 / SCALE
    return [round(x, 3), round(z, 3)]

# ─── 1. Yellow Line ─────────────────────────────────────────────────
with open('src/data/yellow_line_accurate_osm.json') as f:
    yl_data = json.load(f)

yellow_stations_geo = []
for s in yl_data.get('stations', []):
    structure = s.get('structure', 'elevated')
    elev_m = -14 if structure in ['underground', 'tunnel'] else 15
    xy = project_to_meters(s['coords'][0], s['coords'][1])
    yellow_stations_geo.append({
        "id": s['id'],
        "name": s['name'],
        "line": "yellow-line",
        "lineColor": "#F59E0B",
        "structure": structure,
        "elevM": elev_m,
        "coords": s['coords'],   # [lon, lat]
        "mx": xy[0],             # meters x
        "mz": xy[1],             # meters z
        "major": s.get('major', False),
        "terminus": s.get('terminus', False),
        "interchange": s.get('interchange', None),
        "interchanges": [s['interchange']] if s.get('interchange') else []
    })

yellow_centerline = []
for pt in yl_data.get('centerline', []):
    lat = pt[1]
    is_tunnel = 28.535 <= lat <= 28.670
    elev_m = -14 if is_tunnel else 15
    yellow_centerline.append({
        "coords": [pt[0], pt[1]],
        "elevM": elev_m,
        "structure": "underground" if is_tunnel else "elevated"
    })

# ─── 2. Other Lines from dmrc-network.js ───────────────────────────
with open('src/data/dmrc-network.js') as f:
    network_js = f.read()

feature_blocks = re.findall(
    r"properties:\s*\{(.*?)\},\s*geometry:\s*\{\s*type:\s*['\"]LineString['\"],\s*coordinates:\s*\[(.*?)\]\s*\}",
    network_js, re.DOTALL
)

COLORS = {
    'blue-line':      '#0055A5',
    'red-line':       '#E21E26',
    'violet-line':    '#7C3AED',
    'magenta-line':   '#C026D3',
    'pink-line':      '#DB2777',
    'airport-express':'#EA580C',
    'rapid-metro':    '#059669',
}

network_lines_geo = []
all_stations = {s['id']: s for s in yellow_stations_geo}

for props_str, coords_str in feature_blocks:
    lid   = re.search(r"id:\s*['\"]([^'\"]+)", props_str).group(1)
    name  = re.search(r"name:\s*['\"]([^'\"]+)", props_str).group(1)
    color = COLORS.get(lid, '#888888')

    matches = re.findall(r"\[([0-9\.]+),\s*([0-9\.]+)\],?\s*(?://\s*([^\r\n]+))?", coords_str)
    centerline = []
    for lon_s, lat_s, st_comment in matches:
        lon, lat = float(lon_s), float(lat_s)
        # Determine elevation
        if lid == 'airport-express':
            is_underground = not (28.57 <= lat <= 0.61)  # mostly underground to Dhaula Kuan
            elev_m = -14 if not (28.57 <= lat <= 28.61) else 15
        elif lid == 'blue-line':
            elev_m = -14 if 77.21 <= lon <= 77.24 else 15
        elif lid == 'violet-line':
            elev_m = -14 if 77.19 <= lon <= 77.24 else 15
        else:
            elev_m = 15  # elevated by default
        
        structure = "underground" if elev_m < 0 else "elevated"
        centerline.append({
            "coords": [lon, lat],
            "elevM": elev_m,
            "structure": structure
        })

        # Station from comment
        if st_comment:
            clean_name = re.sub(r'\s*\(INTERCHANGE\)', '', st_comment, flags=re.IGNORECASE).strip()
            st_id = re.sub(r'[^a-z0-9]+', '_', clean_name.lower()).strip('_')
            xy = project_to_meters(lon, lat)
            if st_id not in all_stations:
                all_stations[st_id] = {
                    "id": st_id,
                    "name": clean_name,
                    "line": lid,
                    "lineColor": color,
                    "structure": structure,
                    "elevM": elev_m,
                    "coords": [lon, lat],
                    "mx": xy[0],
                    "mz": xy[1],
                    "major": False,
                    "terminus": False,
                    "interchange": None,
                    "interchanges": []
                }
            else:
                st = all_stations[st_id]
                st['major'] = True
                if lid not in (st.get('interchange') or ''):
                    if st.get('interchange'):
                        st['interchange'] += f" × {lid.replace('-line','').title()}"
                    else:
                        st['interchange'] = f"{st['line'].replace('-line','').title()} × {lid.replace('-line','').title()}"
                    st['interchanges'] = [st['interchange']]

    network_lines_geo.append({
        "id": lid,
        "name": name,
        "color": color,
        "centerline": centerline
    })

# ─── 3. Assemble all lines ──────────────────────────────────────────
all_lines = [{
    "id": "yellow-line",
    "name": "Yellow Line (Line 2)",
    "color": "#F59E0B",
    "centerline": yellow_centerline
}] + network_lines_geo

all_stations_list = sorted(all_stations.values(), key=lambda s: s['name'])
# Give each station an index for search
for i, s in enumerate(all_stations_list):
    s['index'] = i

topology = {
    "version": "5.0.0-geographic",
    "metadata": {
        "title": "Delhi NCR Metro Geographic Topology (Lat/Lon + Elevation)",
        "origin": {"name": "Connaught Place / Rajiv Chowk", "lat": LAT0, "lon": LON0},
        "crs": "EPSG:4326",
        "elevationUnit": "meters"
    },
    "lines": all_lines,
    "stations": all_stations_list
}

out = 'src/data/delhi_network_topology_geo.json'
with open(out, 'w') as f:
    json.dump(topology, f, indent=2)

print(f"Generated {out}")
print(f"  Lines: {len(all_lines)}")
print(f"  Stations: {len(all_stations_list)}")
