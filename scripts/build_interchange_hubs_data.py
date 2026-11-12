#!/usr/bin/env python3
"""
Builds src/data/dmrc_interchange_hubs.json and smooths src/data/dmrc_other_lines_gtfs.json
directly from cached high-resolution OpenStreetMap geometry (scripts/osm_hubs_cache.json)
plus DMRC corridor topology (src/data/*_accurate_osm.json, *_service.json).

Covers all 19 remaining Yellow Line, Blue Line, and Vaishali Branch dual/tri interchanges
(excluding Rajiv Chowk and Yamuna Bank which have bespoke builders) while preserving genuine
DMRC horizontal offsets, track curves, vertical tiering, canopy typology, and skywalk/passage links.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data"
SCRIPTS_DIR = ROOT / "scripts"
CACHE_PATH = SCRIPTS_DIR / "osm_hubs_cache.json"
GTFS_PATH = DATA_DIR / "dmrc_other_lines_gtfs.json"
GTFS_BACKUP_PATH = SCRIPTS_DIR / "dmrc_other_lines_gtfs.pre_osm_backup.json"


def meters_scale(lat_deg):
    rad = math.radians(lat_deg)
    return 111320.0 * math.cos(rad), 110540.0


def dist_m(a, b):
    kx, ky = meters_scale(0.5 * (a[1] + b[1]))
    return math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky)


def ll_to_local(ll, origin):
    kx, ky = meters_scale(origin[1])
    return ((ll[0] - origin[0]) * kx, (ll[1] - origin[1]) * ky)


def local_to_ll(xy, origin):
    kx, ky = meters_scale(origin[1])
    return [round(origin[0] + xy[0] / kx, 6), round(origin[1] + xy[1] / ky, 6)]


def closest_on_polyline(coords, target_ll):
    kx, ky = meters_scale(target_ll[1])
    best = None
    for i in range(len(coords) - 1):
        ax, ay = (coords[i][0] - target_ll[0]) * kx, (coords[i][1] - target_ll[1]) * ky
        bx, by = (coords[i + 1][0] - target_ll[0]) * kx, (coords[i + 1][1] - target_ll[1]) * ky
        vx, vy = bx - ax, by - ay
        seg_len2 = vx * vx + vy * vy
        t = max(0.0, min(1.0, -(ax * vx + ay * vy) / seg_len2)) if seg_len2 > 1e-8 else 0.0
        px, py = ax + t * vx, ay + t * vy
        d = math.hypot(px, py)
        if best is None or d < best[0]:
            seg_len = math.sqrt(seg_len2) if seg_len2 > 1e-8 else 1.0
            best = (d, i, t, [vx / seg_len, vy / seg_len], local_to_ll((px, py), target_ll))
    return best


def stitch_osm_ways(rail_ways, way_ids):
    """Stitch ordered OSM single-track ways end-to-end into one continuous directed polyline."""
    by_id = {int(rw["id"]): rw["coords"] for rw in rail_ways}
    ordered_segs = []
    for wid in way_ids:
        pts = [list(c) for c in by_id[int(wid)]]
        if len(pts) >= 2:
            ordered_segs.append(pts)
    if not ordered_segs:
        raise ValueError(f"No valid OSM ways found for {way_ids}")

    if len(ordered_segs) == 1:
        stitched = ordered_segs[0]
    else:
        # Orient segment 0 so its end faces segment 1 closely
        s0, s1 = ordered_segs[0], ordered_segs[1]
        cand = [
            (min(dist_m(s0[-1], s1[0]), dist_m(s0[-1], s1[-1])), False),
            (min(dist_m(s0[0], s1[0]), dist_m(s0[0], s1[-1])), True),
        ]
        if min(cand, key=lambda x: x[0])[1]:
            s0 = list(reversed(s0))
        stitched = list(s0)
        for seg in ordered_segs[1:]:
            d_fwd = dist_m(stitched[-1], seg[0])
            d_rev = dist_m(stitched[-1], seg[-1])
            chosen = list(seg) if d_fwd <= d_rev else list(reversed(seg))
            gap = min(d_fwd, d_rev)
            if gap > 25.0:
                raise ValueError(f"Large gap ({gap:.1f}m) stitching OSM ways {way_ids}")
            if gap < 1.5:
                stitched.extend(chosen[1:])
            else:
                stitched.extend(chosen)

    # Deduplicate adjacent near-identical vertices
    out = []
    for p in stitched:
        if not out or dist_m(out[-1], p) > 0.4:
            out.append([round(p[0], 6), round(p[1], 6)])
    return out


def point_at_arc_offset(coords, seg_idx, seg_t, signed_offset_m):
    """Walk signed_offset_m along polyline (+ forward, - backward) from (seg_idx, seg_t)."""
    kx, ky = meters_scale(coords[seg_idx][1])
    p0 = [
        coords[seg_idx][0] + seg_t * (coords[seg_idx + 1][0] - coords[seg_idx][0]),
        coords[seg_idx][1] + seg_t * (coords[seg_idx + 1][1] - coords[seg_idx][1]),
    ]
    if abs(signed_offset_m) < 1e-4:
        return [round(p0[0], 6), round(p0[1], 6)]

    cur = list(p0)
    if signed_offset_m > 0:
        rem = signed_offset_m
        idx = seg_idx + 1
        while rem > 0 and idx < len(coords):
            nxt = coords[idx]
            d = math.hypot((nxt[0] - cur[0]) * kx, (nxt[1] - cur[1]) * ky)
            if d < 1e-4:
                idx += 1
                continue
            if d >= rem:
                f = rem / d
                return [round(cur[0] + f * (nxt[0] - cur[0]), 6), round(cur[1] + f * (nxt[1] - cur[1]), 6)]
            rem -= d
            cur = list(nxt)
            idx += 1
        return [round(coords[-1][0], 6), round(coords[-1][1], 6)]
    else:
        rem = -signed_offset_m
        idx = seg_idx
        while rem > 0 and idx >= 0:
            nxt = coords[idx]
            d = math.hypot((nxt[0] - cur[0]) * kx, (nxt[1] - cur[1]) * ky)
            if d < 1e-4:
                idx -= 1
                continue
            if d >= rem:
                f = rem / d
                return [round(cur[0] + f * (nxt[0] - cur[0]), 6), round(cur[1] + f * (nxt[1] - cur[1]), 6)]
            rem -= d
            cur = list(nxt)
            idx -= 1
        return [round(coords[0][0], 6), round(coords[0][1], 6)]


def sample_polyline_window(coords, seg_idx, seg_t, back_m=130.0, fwd_m=130.0, max_step_m=18.0):
    """Clip polyline continuously around (seg_idx, seg_t) and densify long spans for smooth curves."""
    kx, ky = meters_scale(coords[seg_idx][1])
    p0 = [
        coords[seg_idx][0] + seg_t * (coords[seg_idx + 1][0] - coords[seg_idx][0]),
        coords[seg_idx][1] + seg_t * (coords[seg_idx + 1][1] - coords[seg_idx][1]),
    ]

    back_pts = []
    rem = back_m
    cur = list(p0)
    idx = seg_idx
    while rem > 0.2 and idx >= 0:
        nxt = coords[idx]
        d = math.hypot((nxt[0] - cur[0]) * kx, (nxt[1] - cur[1]) * ky)
        if d <= 1e-4:
            idx -= 1
            continue
        if d >= rem:
            f = rem / d
            back_pts.append([round(cur[0] + f * (nxt[0] - cur[0]), 6), round(cur[1] + f * (nxt[1] - cur[1]), 6)])
            rem = 0.0
            break
        back_pts.append([round(nxt[0], 6), round(nxt[1], 6)])
        rem -= d
        cur = list(nxt)
        idx -= 1

    fwd_pts = []
    rem = fwd_m
    cur = list(p0)
    idx = seg_idx + 1
    while rem > 0.2 and idx < len(coords):
        nxt = coords[idx]
        d = math.hypot((nxt[0] - cur[0]) * kx, (nxt[1] - cur[1]) * ky)
        if d <= 1e-4:
            idx += 1
            continue
        if d >= rem:
            f = rem / d
            fwd_pts.append([round(cur[0] + f * (nxt[0] - cur[0]), 6), round(cur[1] + f * (nxt[1] - cur[1]), 6)])
            rem = 0.0
            break
        fwd_pts.append([round(nxt[0], 6), round(nxt[1], 6)])
        rem -= d
        cur = list(nxt)
        idx += 1

    raw = list(reversed(back_pts)) + [[round(p0[0], 6), round(p0[1], 6)]] + fwd_pts
    # Deduplicate tiny segments
    dedup = []
    for p in raw:
        if not dedup or dist_m(dedup[-1], p) > 0.5:
            dedup.append(p)

    # Subdivide any straight span > max_step_m so Hermite/deck builders stay smooth
    if len(dedup) < 2:
        return dedup
    dense = [dedup[0]]
    for a, b in zip(dedup[:-1], dedup[1:]):
        seg_d = dist_m(a, b)
        if seg_d > max_step_m:
            n_sub = int(math.ceil(seg_d / max_step_m))
            for k in range(1, n_sub):
                u = k / n_sub
                dense.append([
                    round(a[0] + u * (b[0] - a[0]), 6),
                    round(a[1] + u * (b[1] - a[1]), 6),
                ])
        dense.append(b)
    return dense


def chord_tangent_at(coords, center_ll, half_chord_m=28.0):
    """Compute balanced unit tangent across [-half_chord_m, +half_chord_m] on polyline."""
    _, idx, t, fallback_tan, _ = closest_on_polyline(coords, center_ll)
    p_back = point_at_arc_offset(coords, idx, t, -half_chord_m)
    p_fwd = point_at_arc_offset(coords, idx, t, +half_chord_m)
    x0, y0 = ll_to_local(p_back, center_ll)
    x1, y1 = ll_to_local(p_fwd, center_ll)
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy)
    if L < 1.0:
        return [round(fallback_tan[0], 5), round(fallback_tan[1], 5)]
    return [round(dx / L, 5), round(dy / L, 5)]


def point_at_offset_along_tan(origin_ll, tan_xy, along_m=0.0, perp_m=0.0):
    dx = tan_xy[0] * along_m + tan_xy[1] * perp_m
    dy = tan_xy[1] * along_m - tan_xy[0] * perp_m
    return local_to_ll((dx, dy), origin_ll)


def clearance_box_for_arm(center_ll, tan_xy, length=104.0, width=28.0):
    return {
        "center": [round(center_ll[0], 6), round(center_ll[1], 6)],
        "tangent": [round(tan_xy[0], 5), round(tan_xy[1], 5)],
        "length": round(length, 1),
        "width": round(width, 1),
    }


def validate_arm_geometry(hub_name, arm):
    """Measure local smoothness and platform chord fit across +-42m station box."""
    poly = arm["trackPolyline"]
    c = arm["center"]
    tx, ty = arm["tangent"]
    nx, ny = -ty, tx
    pts = [ll_to_local(p, c) for p in poly]

    # Max perpendicular offset from chord line within |along| <= 42m
    max_chord_dev = 0.0
    for x, y in pts:
        along = x * tx + y * ty
        if abs(along) <= 44.0:
            perp = abs(x * nx + y * ny)
            max_chord_dev = max(max_chord_dev, perp)

    # Max local turning angle across consecutive segments within 60m of arm center
    max_turn = 0.0
    for i in range(1, len(pts) - 1):
        if math.hypot(*pts[i]) > 65.0:
            continue
        v1x, v1y = pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]
        v2x, v2y = pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]
        l1, l2 = math.hypot(v1x, v1y), math.hypot(v2x, v2y)
        if l1 > 1.0 and l2 > 1.0:
            dot = max(-1.0, min(1.0, (v1x * v2x + v1y * v2y) / (l1 * l2)))
            ang = math.degrees(math.acos(dot))
            max_turn = max(max_turn, ang)

    return max_turn, max_chord_dev


def slice_osm_between(stitched, p_start_ll, p_end_ll, max_step_m=24.0):
    """Extract monotonic sub-polyline of stitched OSM coordinates between projections of p_start_ll and p_end_ll."""
    _, i0, t0, _, ll0 = closest_on_polyline(stitched, p_start_ll)
    _, i1, t1, _, ll1 = closest_on_polyline(stitched, p_end_ll)
    # Signed arc position = segment index + t
    pos0 = i0 + t0
    pos1 = i1 + t1
    rev = pos0 > pos1
    if rev:
        a_idx, a_t, a_ll = i1, t1, ll1
        b_idx, b_t, b_ll = i0, t0, ll0
    else:
        a_idx, a_t, a_ll = i0, t0, ll0
        b_idx, b_t, b_ll = i1, t1, ll1

    pts = [a_ll]
    for k in range(a_idx + 1, b_idx + 1):
        pts.append([round(stitched[k][0], 6), round(stitched[k][1], 6)])
    pts.append(b_ll)
    if rev:
        pts.reverse()

    dedup = []
    for p in pts:
        if not dedup or dist_m(dedup[-1], p) > 0.5:
            dedup.append(p)
    if len(dedup) < 2:
        return dedup
    dense = [dedup[0]]
    for a, b in zip(dedup[:-1], dedup[1:]):
        seg_d = dist_m(a, b)
        if seg_d > max_step_m:
            n_sub = int(math.ceil(seg_d / max_step_m))
            for k in range(1, n_sub):
                u = k / n_sub
                dense.append([round(a[0] + u * (b[0] - a[0]), 6), round(a[1] + u * (b[1] - a[1]), 6)])
        dense.append(b)
    return dense


def splice_gtfs_with_osm(gtfs_coords, hub_center, osm_full_track, is_terminus=False):
    """
    Replace coarse GTFS vertices inside ~280m of hub_center using monotonic projections
    onto stitched high-resolution OSM geometry so there are zero reversals or spikes.
    """
    if len(osm_full_track) < 2 or len(gtfs_coords) < 2:
        return gtfs_coords

    closest_idx = min(range(len(gtfs_coords)), key=lambda i: dist_m(gtfs_coords[i], hub_center))
    i_lo = closest_idx
    while i_lo > 0 and dist_m(gtfs_coords[i_lo], hub_center) < 280.0:
        i_lo -= 1
    i_hi = closest_idx
    while i_hi < len(gtfs_coords) - 1 and dist_m(gtfs_coords[i_hi], hub_center) < 280.0:
        i_hi += 1

    at_start_term = (i_lo == 0 and dist_m(gtfs_coords[0], hub_center) < 350.0)
    at_end_term = (i_hi == len(gtfs_coords) - 1 and dist_m(gtfs_coords[-1], hub_center) < 350.0)
    if at_start_term and i_hi == 0:
        i_hi = min(len(gtfs_coords) - 1, 1)
    if at_end_term and i_lo == len(gtfs_coords) - 1:
        i_lo = max(0, len(gtfs_coords) - 2)

    p_in = hub_center if at_start_term else gtfs_coords[i_lo]
    p_out = hub_center if at_end_term else gtfs_coords[i_hi]
    osm_seg = slice_osm_between(osm_full_track, p_in, p_out, max_step_m=24.0)
    if len(osm_seg) < 2:
        return gtfs_coords

    # Avoid 90-degree perpendicular doglegs where a coarse GTFS vertex is laterally offset
    # from the stitched OSM centerline: taper smoothly (>=70m chord, keeping points near hub_center).
    if not at_start_term:
        while len(osm_seg) > 3 and dist_m(osm_seg[0], gtfs_coords[i_lo]) < 80.0 and dist_m(osm_seg[0], hub_center) > 160.0:
            osm_seg.pop(0)
    if not at_end_term:
        while len(osm_seg) > 3 and dist_m(osm_seg[-1], gtfs_coords[i_hi]) < 80.0 and dist_m(osm_seg[-1], hub_center) > 160.0:
            osm_seg.pop()

    prefix = [] if at_start_term else gtfs_coords[: i_lo + 1]
    suffix = [] if at_end_term else gtfs_coords[i_hi:]
    out = prefix + osm_seg + suffix

    cleaned = []
    for p in out:
        if not cleaned or dist_m(cleaned[-1], p) > 0.5:
            cleaned.append(p)
    return cleaned


def main():
    cache = json.loads(CACHE_PATH.read_text())
    yellow_osm = json.loads((DATA_DIR / "yellow_line_accurate_osm.json").read_text())
    blue_osm = json.loads((DATA_DIR / "blue_line_accurate_osm.json").read_text())
    vaishali_osm = json.loads((DATA_DIR / "vaishali_branch_accurate_osm.json").read_text())
    yellow_srv = json.loads((DATA_DIR / "yellow_line_service.json").read_text())
    blue_srv = json.loads((DATA_DIR / "blue_line_service.json").read_text())

    # Primary station lookup with track-snapped center & corridor tangent
    primary_map = {}
    for line_name, osm_obj, srv_obj in [
        ("Yellow Line", yellow_osm, yellow_srv),
        ("Blue Line", blue_osm, blue_srv),
        ("Vaishali Branch", vaishali_osm, None),
    ]:
        cl = osm_obj["centerline"]
        st_list = srv_obj["stations"] if srv_obj else osm_obj["stations"]
        for st in st_list:
            name = st["name"]
            if name in ("Rajiv Chowk", "Yamuna Bank"):
                continue
            ic = st.get("interchanges") or st.get("interchange")
            if not ic and name != "Dwarka":
                continue
            raw_ll = st.get("coordinates") or st.get("coords")
            best = closest_on_polyline(cl, raw_ll)
            tan = best[3]
            primary_map[name] = {
                "name": name,
                "primaryLine": line_name,
                "structure": st.get("structure", "elevated"),
                "center": best[4],
                "tangent": [round(tan[0], 5), round(tan[1], 5)],
            }

    def osm_station_node(hub_name, substr=None, prefer_ll=None):
        nodes = cache[hub_name]["station_nodes"]
        cands = []
        for sn in nodes:
            nm = sn["tags"].get("name", "")
            if substr is None or substr.lower() in nm.lower():
                cands.append([round(sn["lon"], 6), round(sn["lat"], 6)])
        if not cands:
            raise ValueError(f"No OSM station node matching {substr!r} in {hub_name}")
        if prefer_ll and len(cands) > 1:
            cands.sort(key=lambda ll: dist_m(ll, prefer_ll))
        return cands[0]

    gtfs_splices = []  # (gtfs_ids, hub_center, osm_splice_pts, is_terminus)

    def build_osm_arm(
        hub_name,
        way_ids,
        line_name,
        color,
        target_ll,
        tier,
        deck_y,
        platform_type,
        station_len=84,
        platform_width=19.6,
        clip_back=130.0,
        clip_fwd=130.0,
        terminus_side=None,  # 'start' | 'end' | None
        shift_along_m=0.0,
        perp_offset_m=0.0,
        gtfs_ids=None,
    ):
        rail_ways = cache[hub_name]["rail_ways"]
        stitched = stitch_osm_ways(rail_ways, way_ids)

        d, idx, t, _, snap_ll = closest_on_polyline(stitched, target_ll)
        arm_center = (
            point_at_arc_offset(stitched, idx, t, shift_along_m)
            if abs(shift_along_m) > 0.1
            else snap_ll
        )
        # Re-snap arm_center cleanly onto stitched polyline for exact index
        d2, c_idx, c_t, _, arm_center = closest_on_polyline(stitched, arm_center)
        tan = chord_tangent_at(stitched, arm_center, half_chord_m=28.0)

        poly = sample_polyline_window(stitched, c_idx, c_t, back_m=clip_back, fwd_m=clip_fwd)

        if abs(perp_offset_m) > 0.1:
            norm_E = -tan[1]
            norm_N = tan[0]
            latAvg = arm_center[1] * math.pi / 180
            m_to_lon = 1.0 / (111320 * math.cos(latAvg))
            m_to_lat = 1.0 / 110540
            arm_center = [
                round(arm_center[0] + norm_E * perp_offset_m * m_to_lon, 6),
                round(arm_center[1] + norm_N * perp_offset_m * m_to_lat, 6),
            ]
            poly = [
                [
                    round(p[0] + norm_E * perp_offset_m * m_to_lon, 6),
                    round(p[1] + norm_N * perp_offset_m * m_to_lat, 6),
                ]
                for p in poly
            ]

        # Measure real offset from primaryCenter (filled by caller if needed)
        arm = {
            "line": line_name,
            "color": color,
            "tier": tier,
            "deckY": deck_y,
            "platformType": platform_type,
            "stationLen": station_len,
            "platformWidth": platform_width,
            "isTerminus": terminus_side is not None,
            "terminusEnd": terminus_side,
            "center": arm_center,
            "tangent": tan,
            "trackPolyline": poly,
            "offsetMeters": round(d2, 1),
        }

        if gtfs_ids:
            gtfs_splices.append((gtfs_ids, arm_center, stitched, terminus_side is not None))

        return arm

    hubs = {}

    # 1. Haiderpur Badli Mor (Yellow elev 17.5m + Phase-4 Magenta upper elev 27.8m directly over Yellow)
    p = primary_map["Haiderpur Badli Mor"]
    mag_hbm = build_osm_arm(
        "Haiderpur Badli Mor", [538930432], "Magenta Line", "#D946EF", p["center"],
        tier="elevated_upper", deck_y=27.8, platform_type="side",
        station_len=84, platform_width=19.6, clip_back=135.0, clip_fwd=135.0,
    )
    mag_hbm["offsetMeters"] = round(dist_m(p["center"], mag_hbm["center"]), 1)
    hubs["Haiderpur Badli Mor"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "el_cross_over",
        "flattenLowerCanopy": True,
        "arms": [mag_hbm],
        "links": [
            {
                "kind": "lift_tower",
                "posLngLat": point_at_offset_along_tan(p["center"], p["tangent"], along_m=22.0, perp_m=15.0),
                "fromY": 0.0,
                "toY": 27.8,
                "color": "#D946EF",
            }
        ],
        "clearanceBoxes": [clearance_box_for_arm(mag_hbm["center"], mag_hbm["tangent"], 114, 28)],
    }

    # 2. Azadpur (Yellow elev 17.5m + Pink UG 0.28m at real OSM Azadpur (Pink Line) 209m SE + skywalk)
    p = primary_map["Azadpur"]
    az_pink_ll = osm_station_node("Azadpur", "Azadpur (Pink Line)")
    pink_az = build_osm_arm(
        "Azadpur", [364876206], "Pink Line", "#EC4899", az_pink_ll,
        tier="underground", deck_y=0.28, platform_type="island",
        station_len=84, platform_width=19.6, clip_back=135.0, clip_fwd=135.0,
        gtfs_ids=["P_MS"],
    )
    pink_az["offsetMeters"] = round(dist_m(p["center"], pink_az["center"]), 1)
    hubs["Azadpur"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "el_to_ug_skywalk",
        "flattenLowerCanopy": False,
        "arms": [pink_az],
        "links": [
            {
                "kind": "skywalk",
                "fromLngLat": p["center"],
                "fromY": 11.8,
                "toLngLat": pink_az["center"],
                "toY": 4.2,
                "width": 6.4,
                "color": "#EC4899",
            },
            {
                "kind": "lift_tower",
                "posLngLat": pink_az["center"],
                "fromY": 0.28,
                "toY": 11.5,
                "color": "#EC4899",
            },
        ],
        "clearanceBoxes": [clearance_box_for_arm(pink_az["center"], pink_az["tangent"], 112, 28)],
    }

    # 3. Kashmere Gate (Yellow UG + Red elev 17.5m cross + Violet UG 0.28m NNE bay)
    p = primary_map["Kashmere Gate"]
    red_kg = build_osm_arm(
        "Kashmere Gate", [70214093], "Red Line", "#EF4444", p["center"],
        tier="elevated", deck_y=17.5, platform_type="side",
        station_len=84, platform_width=19.6, clip_back=135.0, clip_fwd=135.0,
        gtfs_ids=["R_RD", "R_RS"],
    )
    red_kg["offsetMeters"] = round(dist_m(p["center"], red_kg["center"]), 1)

    kg_vio_node = osm_station_node("Kashmere Gate", "Kashmere Gate", prefer_ll=[77.228051, 28.668673])
    # Terminus bay starts near NNW buffer (-41.6, 163.2) and runs SE; place platform center +54m SE from buffer
    vio_kg = build_osm_arm(
        "Kashmere Gate", [1036191756, 1036191758], "Violet Line", "#7C3AED", kg_vio_node,
        tier="underground", deck_y=0.28, platform_type="island",
        station_len=82, platform_width=18.8, clip_back=85.0, clip_fwd=135.0,
        terminus_side="start", shift_along_m=10.0,
        gtfs_ids=["V_KB", "V_KR"],
    )
    vio_kg["offsetMeters"] = round(dist_m(p["center"], vio_kg["center"]), 1)
    hubs["Kashmere Gate"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "tri_hub_mixed",
        "arms": [red_kg, vio_kg],
        "links": [
            {
                "kind": "lift_tower",
                "posLngLat": point_at_offset_along_tan(p["center"], p["tangent"], along_m=18.0, perp_m=14.0),
                "fromY": 0.28,
                "toY": 17.5,
                "color": "#EF4444",
            },
            {
                "kind": "subsurface_passage",
                "fromLngLat": p["center"],
                "fromY": 0.28,
                "toLngLat": vio_kg["center"],
                "toY": 0.28,
                "width": 7.6,
                "color": "#7C3AED",
            },
        ],
        "clearanceBoxes": [
            clearance_box_for_arm(red_kg["center"], red_kg["tangent"], 114, 28),
            clearance_box_for_arm(vio_kg["center"], vio_kg["tangent"], 110, 28),
        ],
    }

    # 4. New Delhi (Yellow UG + Airport Express UG terminus ~115m SSW + subsurface concourse)
    p = primary_map["New Delhi"]
    nd_aex_node = osm_station_node("New Delhi", "Airport Express")
    # WY 188216912 ends at (+31.7, -108.4); shift -56m SSW so 86m station fits flush before headwall
    aex_nd = build_osm_arm(
        "New Delhi", [188216912], "Airport Express", "#F59E0B", nd_aex_node,
        tier="underground", deck_y=0.28, platform_type="island",
        station_len=86, platform_width=19.6, clip_back=135.0, clip_fwd=65.0,
        terminus_side="end", shift_along_m=-56.0,
        gtfs_ids=["O_DN"],
    )
    aex_nd["offsetMeters"] = round(dist_m(p["center"], aex_nd["center"]), 1)
    hubs["New Delhi"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "ug_subsurface_link",
        "arms": [aex_nd],
        "links": [
            {
                "kind": "subsurface_passage",
                "fromLngLat": p["center"],
                "fromY": 0.28,
                "toLngLat": aex_nd["center"],
                "toY": 0.28,
                "width": 8.0,
                "color": "#F59E0B",
            }
        ],
        "clearanceBoxes": [clearance_box_for_arm(aex_nd["center"], aex_nd["tangent"], 116, 28)],
    }

    # 5. Central Secretariat (Yellow UG + parallel Violet Line 0.28m along smooth WY 610024711)
    p = primary_map["Central Secretariat"]
    vio_cs = build_osm_arm(
        "Central Secretariat", [610024711], "Violet Line", "#7C3AED", p["center"],
        tier="underground", deck_y=0.28, platform_type="island",
        station_len=86, platform_width=18.6, clip_back=135.0, clip_fwd=135.0,
        perp_offset_m=-18.0,
        gtfs_ids=["V_KB", "V_KR"],
    )
    vio_cs["offsetMeters"] = round(dist_m(p["center"], vio_cs["center"]), 1)
    hubs["Central Secretariat"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "ug_parallel_plaza",
        "arms": [vio_cs],
        "links": [
            {
                "kind": "subsurface_passage",
                "fromLngLat": p["center"],
                "fromY": 0.28,
                "toLngLat": vio_cs["center"],
                "toY": 0.28,
                "width": 9.2,
                "color": "#7C3AED",
            },
            {
                "kind": "lift_tower",
                "posLngLat": point_at_offset_along_tan(p["center"], p["tangent"], along_m=16.0, perp_m=9.25),
                "fromY": 0.28,
                "toY": 10.2,
                "color": "#7C3AED",
            },
        ],
        "clearanceBoxes": [clearance_box_for_arm(vio_cs["center"], vio_cs["tangent"], 114, 28)],
    }

    # 6. Dilli Haat - INA (Yellow UG + Pink Line UG ~180m WSW + subsurface passage)
    p = primary_map["Dilli Haat - INA"]
    ina_pink_node = osm_station_node("Dilli Haat - INA", "Pink Line")
    pink_ina = build_osm_arm(
        "Dilli Haat - INA", [279102625], "Pink Line", "#EC4899", ina_pink_node,
        tier="underground", deck_y=0.28, platform_type="island",
        station_len=84, platform_width=19.6, clip_back=135.0, clip_fwd=135.0,
        gtfs_ids=["P_MS"],
    )
    pink_ina["offsetMeters"] = round(dist_m(p["center"], pink_ina["center"]), 1)
    hubs["Dilli Haat - INA"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "ug_subsurface_link",
        "arms": [pink_ina],
        "links": [
            {
                "kind": "subsurface_passage",
                "fromLngLat": p["center"],
                "fromY": 0.28,
                "toLngLat": pink_ina["center"],
                "toY": 0.28,
                "width": 7.8,
                "color": "#EC4899",
            }
        ],
        "clearanceBoxes": [clearance_box_for_arm(pink_ina["center"], pink_ina["tangent"], 114, 28)],
    }

    # 7. Hauz Khas (Yellow UG + Magenta Line UG ~193m SW + travelator subsurface gallery)
    p = primary_map["Hauz Khas"]
    hk_mag_node = osm_station_node("Hauz Khas", "Magenta Line")
    mag_hk = build_osm_arm(
        "Hauz Khas", [379883518], "Magenta Line", "#D946EF", hk_mag_node,
        tier="underground", deck_y=0.28, platform_type="island",
        station_len=84, platform_width=19.6, clip_back=135.0, clip_fwd=135.0,
        gtfs_ids=["M_JB"],
    )
    mag_hk["offsetMeters"] = round(dist_m(p["center"], mag_hk["center"]), 1)
    hubs["Hauz Khas"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "ug_subsurface_link",
        "arms": [mag_hk],
        "links": [
            {
                "kind": "subsurface_passage",
                "fromLngLat": p["center"],
                "fromY": 0.28,
                "toLngLat": mag_hk["center"],
                "toY": 0.28,
                "width": 8.0,
                "color": "#D946EF",
            }
        ],
        "clearanceBoxes": [clearance_box_for_arm(mag_hk["center"], mag_hk["tangent"], 114, 28)],
    }

    # 8. Sikanderpur (Yellow elev 17.5m + Rapid Metro elev 17.5m 143m E + skywalk)
    p = primary_map["Sikanderpur"]
    sik_rmrg_node = osm_station_node("Sikanderpur", "RMRG")
    rmrg_sik = build_osm_arm(
        "Sikanderpur", [483037274], "Rapid Metro", "#06B6D4", sik_rmrg_node,
        tier="elevated", deck_y=17.5, platform_type="side",
        station_len=76, platform_width=17.2, clip_back=130.0, clip_fwd=130.0,
        gtfs_ids=["R_SP"],
    )
    rmrg_sik["offsetMeters"] = round(dist_m(p["center"], rmrg_sik["center"]), 1)
    hubs["Sikanderpur"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "el_twin_skywalk",
        "arms": [rmrg_sik],
        "links": [
            {
                "kind": "skywalk",
                "fromLngLat": p["center"],
                "fromY": 11.8,
                "toLngLat": rmrg_sik["center"],
                "toY": 11.8,
                "width": 6.4,
                "color": "#06B6D4",
            }
        ],
        "clearanceBoxes": [clearance_box_for_arm(rmrg_sik["center"], rmrg_sik["tangent"], 104, 26)],
    }

    # 9. Dwarka Sector - 21 (Blue UG 0.28m + Airport Express UG 0.28m at Pacific D21 mall / transport complex)
    p = primary_map["Dwarka Sector - 21"]
    d21_node = osm_station_node("Dwarka Sector - 21", "Dwarka Sector 21")
    aex_d21 = build_osm_arm(
        "Dwarka Sector - 21", [604707728, 80677193], "Airport Express", "#F59E0B", d21_node,
        tier="underground", deck_y=0.28, platform_type="island",
        station_len=86, platform_width=19.6, clip_back=135.0, clip_fwd=135.0,
        gtfs_ids=["O_DN"],
    )
    aex_d21["offsetMeters"] = round(dist_m(p["center"], aex_d21["center"]), 1)
    hubs["Dwarka Sector - 21"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "ug_parallel_plaza",
        "arms": [aex_d21],
        "links": [
            {
                "kind": "subsurface_passage",
                "fromLngLat": p["center"],
                "fromY": 0.28,
                "toLngLat": aex_d21["center"],
                "toY": 0.28,
                "width": 9.2,
                "color": "#F59E0B",
            },
            {
                "kind": "lift_tower",
                "posLngLat": aex_d21["center"],
                "fromY": 0.28,
                "toY": 11.5,
                "color": "#F59E0B",
            },
        ],
        "clearanceBoxes": [clearance_box_for_arm(aex_d21["center"], aex_d21["tangent"], 114, 28)],
    }

    # 10. Dwarka (Blue elev 17.5m + Grey Line elev 17.5m parallel 114m NNW + headwall + skywalk)
    p = primary_map["Dwarka"]
    dw_grey_node = osm_station_node("Dwarka", "Grey Line")
    grey_dw = build_osm_arm(
        "Dwarka", [251754097, 563896853], "Grey Line", "#9CA3AF", dw_grey_node,
        tier="elevated", deck_y=17.5, platform_type="side",
        station_len=80, platform_width=18.2, clip_back=135.0, clip_fwd=142.0,
        terminus_side="end",
        gtfs_ids=["G_DD"],
    )
    grey_dw["offsetMeters"] = round(dist_m(p["center"], grey_dw["center"]), 1)
    hubs["Dwarka"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "el_twin_skywalk",
        "arms": [grey_dw],
        "links": [
            {
                "kind": "skywalk",
                "fromLngLat": p["center"],
                "fromY": 11.8,
                "toLngLat": grey_dw["center"],
                "toY": 11.8,
                "width": 7.6,
                "color": "#9CA3AF",
            }
        ],
        "clearanceBoxes": [clearance_box_for_arm(grey_dw["center"], grey_dw["tangent"], 108, 28)],
    }

    # 11. Janak Puri West (Blue elev 17.5m + Magenta UG 0.28m directly beneath + Phase-4 ext + escalator bridge)
    p = primary_map["Janak Puri West"]
    jp_mag_node = osm_station_node("Janak Puri West", "Janakpuri West", prefer_ll=[77.077949, 28.628947])
    mag_jp = build_osm_arm(
        "Janak Puri West", [279029821, 1339456793], "Magenta Line", "#D946EF", jp_mag_node,
        tier="underground", deck_y=0.28, platform_type="island",
        station_len=84, platform_width=19.6, clip_back=135.0, clip_fwd=135.0,
        gtfs_ids=["M_JB"],
    )
    mag_jp["offsetMeters"] = round(dist_m(p["center"], mag_jp["center"]), 1)
    hubs["Janak Puri West"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "el_to_ug_cross",
        "arms": [mag_jp],
        "links": [
            {
                "kind": "escalator_bridge",
                "fromLngLat": p["center"],
                "fromY": 11.8,
                "toLngLat": mag_jp["center"],
                "toY": 4.2,
                "width": 7.2,
                "color": "#D946EF",
            },
            {
                "kind": "lift_tower",
                "posLngLat": point_at_offset_along_tan(mag_jp["center"], mag_jp["tangent"], along_m=18.0, perp_m=14.0),
                "fromY": 0.28,
                "toY": 11.8,
                "color": "#D946EF",
            },
        ],
        "clearanceBoxes": [clearance_box_for_arm(mag_jp["center"], mag_jp["tangent"], 114, 28)],
    }

    # 12. Rajouri Garden (Blue elev 17.5m w/ full blue canopy + Pink Ring Rd elev 21.5m 271m NE + iconic skywalk)
    p = primary_map["Rajouri Garden"]
    rg_pink_node = osm_station_node("Rajouri Garden", "Pink Line")
    pink_rg = build_osm_arm(
        "Rajouri Garden", [364896925], "Pink Line", "#EC4899", rg_pink_node,
        tier="elevated_upper", deck_y=21.5, platform_type="side",
        station_len=84, platform_width=19.6, clip_back=135.0, clip_fwd=135.0,
        gtfs_ids=["P_MS"],
    )
    pink_rg["offsetMeters"] = round(dist_m(p["center"], pink_rg["center"]), 1)
    hubs["Rajouri Garden"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "el_twin_skywalk",
        "flattenLowerCanopy": False,
        "arms": [pink_rg],
        "links": [
            {
                "kind": "skywalk",
                "fromLngLat": p["center"],
                "fromY": 11.8,
                "toLngLat": pink_rg["center"],
                "toY": 15.8,
                "width": 6.4,
                "color": "#EC4899",
            }
        ],
        "clearanceBoxes": [clearance_box_for_arm(pink_rg["center"], pink_rg["tangent"], 112, 28)],
    }

    # 13. Kirti Nagar (Blue elev 17.5m + Green Line terminus elev 17.5m 311m ESE + overrun pocket + skywalk)
    p = primary_map["Kirti Nagar"]
    kn_green_node = osm_station_node("Kirti Nagar", "Green Line")
    # [171440669 (overrun SW tail) -> 1489748193 -> 77852923 (mainline NE)]
    green_kn = build_osm_arm(
        "Kirti Nagar", [171440669, 1489748193, 77852923], "Green Line", "#10B981", kn_green_node,
        tier="elevated", deck_y=17.5, platform_type="side",
        station_len=80, platform_width=18.4, clip_back=265.0, clip_fwd=135.0,
        terminus_side="start",
        gtfs_ids=["G_KB"],
    )
    green_kn["offsetMeters"] = round(dist_m(p["center"], green_kn["center"]), 1)
    hubs["Kirti Nagar"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "el_twin_skywalk",
        "arms": [green_kn],
        "links": [
            {
                "kind": "skywalk",
                "fromLngLat": p["center"],
                "fromY": 11.8,
                "toLngLat": green_kn["center"],
                "toY": 11.8,
                "width": 6.2,
                "color": "#10B981",
            }
        ],
        "clearanceBoxes": [clearance_box_for_arm(green_kn["center"], green_kn["tangent"], 108, 28)],
    }

    # 14. Mandi House (Blue UG 0.28m + Violet Line UG 0.28m parallel/curving along WY 610024711)
    p = primary_map["Mandi House"]
    mh_vio_node = osm_station_node("Mandi House", "Mandi House", prefer_ll=[77.234193, 28.625515])
    vio_mh = build_osm_arm(
        "Mandi House", [610024711], "Violet Line", "#7C3AED", mh_vio_node,
        tier="underground", deck_y=0.28, platform_type="island",
        station_len=84, platform_width=18.2, clip_back=135.0, clip_fwd=135.0,
        gtfs_ids=["V_KB", "V_KR"],
    )
    vio_mh["offsetMeters"] = round(dist_m(p["center"], vio_mh["center"]), 1)
    hubs["Mandi House"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "ug_parallel_plaza",
        "arms": [vio_mh],
        "links": [
            {
                "kind": "subsurface_passage",
                "fromLngLat": p["center"],
                "fromY": 0.28,
                "toLngLat": vio_mh["center"],
                "toY": 0.28,
                "width": 8.6,
                "color": "#7C3AED",
            },
            {
                "kind": "lift_tower",
                "posLngLat": point_at_offset_along_tan(vio_mh["center"], vio_mh["tangent"], along_m=18.0, perp_m=13.5),
                "fromY": 0.28,
                "toY": 10.2,
                "color": "#7C3AED",
            },
        ],
        "clearanceBoxes": [clearance_box_for_arm(vio_mh["center"], vio_mh["tangent"], 112, 28)],
    }

    # 15. Mayur Vihar-I (Blue elev 17.5m + Pink Line high elev 24.5m 176m ESE + skywalk)
    p = primary_map["Mayur Vihar-I"]
    mv_pink_node = osm_station_node("Mayur Vihar-I", "Pink Line")
    pink_mv = build_osm_arm(
        "Mayur Vihar-I", [364896924], "Pink Line", "#EC4899", mv_pink_node,
        tier="elevated_upper", deck_y=24.5, platform_type="side",
        station_len=84, platform_width=19.6, clip_back=135.0, clip_fwd=135.0,
        gtfs_ids=["P_MS"],
    )
    pink_mv["offsetMeters"] = round(dist_m(p["center"], pink_mv["center"]), 1)
    hubs["Mayur Vihar-I"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "el_twin_skywalk",
        "arms": [pink_mv],
        "links": [
            {
                "kind": "skywalk",
                "fromLngLat": p["center"],
                "fromY": 11.8,
                "toLngLat": pink_mv["center"],
                "toY": 18.8,
                "width": 6.4,
                "color": "#EC4899",
            }
        ],
        "clearanceBoxes": [clearance_box_for_arm(pink_mv["center"], pink_mv["tangent"], 112, 28)],
    }

    # 16. Botanical Garden (Blue elev 17.5m + Magenta elev 17.5m 51m W + curved NW overrun tail + wide concourse)
    p = primary_map["Botanical Garden"]
    bg_mag_node = osm_station_node("Botanical Garden", "Magenta Line")
    mag_bg = build_osm_arm(
        "Botanical Garden", [563894916, 563894918], "Magenta Line", "#D946EF", bg_mag_node,
        tier="elevated", deck_y=17.5, platform_type="side",
        station_len=84, platform_width=19.2, clip_back=135.0, clip_fwd=165.0,
        terminus_side="end",
        gtfs_ids=["M_JB"],
    )
    mag_bg["offsetMeters"] = round(dist_m(p["center"], mag_bg["center"]), 1)
    hubs["Botanical Garden"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "el_parallel_concourse",
        "arms": [mag_bg],
        "links": [
            {
                "kind": "skywalk",
                "fromLngLat": p["center"],
                "fromY": 11.8,
                "toLngLat": mag_bg["center"],
                "toY": 11.8,
                "width": 12.0,
                "color": "#D946EF",
            }
        ],
        "clearanceBoxes": [clearance_box_for_arm(mag_bg["center"], mag_bg["tangent"], 112, 28)],
    }

    # 17. Noida Sec-52 (Blue elev 17.5m + Aqua Line Sec-51 elev 17.5m 264m ESE + overrun pocket + glass skywalk)
    p = primary_map["Noida Sec-52"]
    n51_node = osm_station_node("Noida Sec-52", "Noida Sector 51")
    aqua_51 = build_osm_arm(
        "Noida Sec-52", [687733477, 687733478], "Noida Aqua Line", "#06B6D4", n51_node,
        tier="elevated", deck_y=17.5, platform_type="side",
        station_len=82, platform_width=18.8, clip_back=145.0, clip_fwd=135.0,
        terminus_side="start",
        gtfs_ids=["A_NN", "A_ND"],
    )
    aqua_51["offsetMeters"] = round(dist_m(p["center"], aqua_51["center"]), 1)
    hubs["Noida Sec-52"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "el_twin_skywalk",
        "arms": [aqua_51],
        "links": [
            {
                "kind": "skywalk",
                "fromLngLat": p["center"],
                "fromY": 11.8,
                "toLngLat": aqua_51["center"],
                "toY": 11.8,
                "width": 6.4,
                "color": "#06B6D4",
            }
        ],
        "clearanceBoxes": [clearance_box_for_arm(aqua_51["center"], aqua_51["tangent"], 108, 28)],
    }

    # 18. Karkarduma (Vaishali elev 17.5m + Pink Line high elev 24.5m 121m NNE + skywalk)
    p = primary_map["Karkarduma"]
    kdm_pink_node = osm_station_node("Karkarduma", "Pink Line")
    pink_kdm = build_osm_arm(
        "Karkarduma", [915112328, 915112331, 642636562], "Pink Line", "#EC4899", kdm_pink_node,
        tier="elevated_upper", deck_y=24.5, platform_type="side",
        station_len=84, platform_width=19.6, clip_back=135.0, clip_fwd=135.0,
        gtfs_ids=["P_MS"],
    )
    pink_kdm["offsetMeters"] = round(dist_m(p["center"], pink_kdm["center"]), 1)
    hubs["Karkarduma"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "el_twin_skywalk",
        "arms": [pink_kdm],
        "links": [
            {
                "kind": "skywalk",
                "fromLngLat": p["center"],
                "fromY": 11.8,
                "toLngLat": pink_kdm["center"],
                "toY": 18.8,
                "width": 6.2,
                "color": "#EC4899",
            }
        ],
        "clearanceBoxes": [clearance_box_for_arm(pink_kdm["center"], pink_kdm["tangent"], 112, 28)],
    }

    # 19. Anand Vihar ISBT (Vaishali elev 17.5m + Pink Line parallel elev 21.5m 51m S + wide skywalk)
    p = primary_map["Anand Vihar ISBT"]
    av_pink_node = osm_station_node("Anand Vihar ISBT", "Pink Line")
    pink_av = build_osm_arm(
        "Anand Vihar ISBT", [915112328], "Pink Line", "#EC4899", av_pink_node,
        tier="elevated_upper", deck_y=21.5, platform_type="side",
        station_len=84, platform_width=19.6, clip_back=135.0, clip_fwd=135.0,
        gtfs_ids=["P_MS"],
    )
    pink_av["offsetMeters"] = round(dist_m(p["center"], pink_av["center"]), 1)
    hubs["Anand Vihar ISBT"] = {
        "primaryLine": p["primaryLine"],
        "primaryStructure": p["structure"],
        "primaryCenter": p["center"],
        "primaryTangent": p["tangent"],
        "archetype": "el_parallel_concourse",
        "arms": [pink_av],
        "links": [
            {
                "kind": "skywalk",
                "fromLngLat": p["center"],
                "fromY": 11.8,
                "toLngLat": pink_av["center"],
                "toY": 15.8,
                "width": 10.5,
                "color": "#EC4899",
            }
        ],
        "clearanceBoxes": [clearance_box_for_arm(pink_av["center"], pink_av["tangent"], 112, 28)],
    }

    # Ensure underground cutaway arms clear their full +/-130m portals from Overture buildings
    for h in hubs.values():
        boxes = h.get("clearanceBoxes", [])
        for idx, arm in enumerate(h["arms"]):
            if arm["tier"] == "underground" and idx < len(boxes):
                boxes[idx]["length"] = max(boxes[idx]["length"], 265.0)

    out = {
        "meta": {
            "version": 2,
            "hubCount": len(hubs),
            "source": "OpenStreetMap live ways (osm_hubs_cache.json) + DMRC corridor geometry",
            "note": "Genuine DMRC dual/tri interchange station geometry from real OSM tracks across Yellow, Blue, and Vaishali lines.",
        },
        "hubs": hubs,
    }
    out_path = DATA_DIR / "dmrc_interchange_hubs.json"
    out_path.write_text(json.dumps(out, indent=2))
    print(f"Wrote {len(hubs)} OSM-backed interchange hubs to {out_path}")

    # Validate smoothness and platform alignment across every arm
    warnings = []
    for name, h in hubs.items():
        arms_desc = []
        for a in h["arms"]:
            max_turn, max_dev = validate_arm_geometry(name, a)
            arms_desc.append(
                f"{a['line']}({a['tier']}@{a['deckY']}m off={a['offsetMeters']}m turn={max_turn:.1f}deg dev={max_dev:.2f}m)"
            )
            if max_turn > 15.0 or max_dev > 3.5:
                warnings.append((name, a["line"], max_turn, max_dev))
        print(f"  - {name:20s} [{h['primaryLine']:15s}] {', '.join(arms_desc)}")

    if warnings:
        print("\nWARNINGS:")
        for w in warnings:
            print(f"  ! {w}")

    # Patch dmrc_other_lines_gtfs.json cleanly from backup so idempotent across re-runs
    if not GTFS_BACKUP_PATH.exists():
        GTFS_BACKUP_PATH.write_text(GTFS_PATH.read_text())
        print(f"\nSaved original GTFS backup to {GTFS_BACKUP_PATH}")

    gtfs_obj = json.loads(GTFS_BACKUP_PATH.read_text())
    feat_map = {f["properties"]["id"]: f for f in gtfs_obj["features"]}
    patched_count = 0
    for gtfs_ids, hub_center, osm_pts, is_term in gtfs_splices:
        for gid in gtfs_ids:
            if gid not in feat_map:
                continue
            coords = feat_map[gid]["geometry"]["coordinates"]
            # Check if this GTFS feature actually passes near this hub
            min_d = min(dist_m(p, hub_center) for p in coords)
            if min_d < 400.0:
                feat_map[gid]["geometry"]["coordinates"] = splice_gtfs_with_osm(
                    coords, hub_center, osm_pts, is_terminus=is_term
                )
                patched_count += 1
    GTFS_PATH.write_text(json.dumps(gtfs_obj, indent=2))
    print(f"Patched {patched_count} GTFS route-hub intersections in {GTFS_PATH} from live OSM cache.")


if __name__ == "__main__":
    main()
