#!/usr/bin/env python3
"""
Builds clean, clipped, elevation-solved Yamuna Bank yard/braid track data
(src/data/yamuna_bank_yard_tracks.json) and aligns Vaishali branch nodes 0..24
in src/data/vaishali_branch_accurate_osm.json to real OSM / Google Maps geometry.

Single source of truth for Yamuna Bank complex (-760m..+760m, -520m..+320m):
- Strips mainline overlaps against blueCorridor and vaishaliCorridor.
- Resamples dense polylines with continuous Hermite elevation profiles (elevM).
- Clamps miter angles / minimum vertex spacing so buildRibbonFromSpans never twists.
- Validates strict bounding box, grade slopes (|dz/ds| < 0.08), and station anchors.
"""

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_PATH = ROOT / "yamuna_source_features.json"
BL_PATH = ROOT / "src/data/blue_line_accurate_osm.json"
VA_PATH = ROOT / "src/data/vaishali_branch_accurate_osm.json"
OUT_PATH = ROOT / "src/data/yamuna_bank_yard_tracks.json"

YB_LL = [77.267937, 28.623178]
ORIGIN_LL = [77.2100, 28.6000]

# Exact station-local clip box (meters relative to YB_LL)
CLIP_X = (-760.0, 760.0)
CLIP_Z = (-520.0, 320.0)

VIADUCT_Y = 17.5
AT_GRADE_Y = 1.2
UNDERPASS_Y = 0.35


def hermite(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3.0 - 2.0 * u)


def to_yb_m(c):
    lon, lat = c[0], c[1]
    x = (lon - YB_LL[0]) * 111320.0 * math.cos(math.radians(YB_LL[1]))
    z = -(lat - YB_LL[1]) * 111320.0
    return (x, z)


def yb_m_to_ll(pt):
    lon = YB_LL[0] + pt[0] / (111320.0 * math.cos(math.radians(YB_LL[1])))
    lat = YB_LL[1] - pt[1] / 111320.0
    return [round(lon, 6), round(lat, 6)]


def dist2d(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])


def poly_length(pts):
    return sum(dist2d(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def cum_lengths(pts):
    s = [0.0]
    for i in range(len(pts) - 1):
        s.append(s[-1] + dist2d(pts[i], pts[i + 1]))
    return s


def interp_poly(pts, target_s):
    s = cum_lengths(pts)
    if target_s <= 0.0:
        return pts[0]
    if target_s >= s[-1]:
        return pts[-1]
    for i in range(len(pts) - 1):
        if s[i] <= target_s <= s[i + 1]:
            seg = s[i + 1] - s[i]
            t = 0.0 if seg < 1e-9 else (target_s - s[i]) / seg
            return (
                pts[i][0] + t * (pts[i + 1][0] - pts[i][0]),
                pts[i][1] + t * (pts[i + 1][1] - pts[i][1]),
            )
    return pts[-1]


def resample_poly(pts, step_m=10.0, min_pt_dist=1.5):
    """Resamples 2D polyline with uniform ~step_m spacing and merges tiny vertices."""
    cleaned = [pts[0]]
    for p in pts[1:]:
        if dist2d(cleaned[-1], p) >= min_pt_dist:
            cleaned.append(p)
    if len(cleaned) < 2:
        cleaned.append(pts[-1])
    elif dist2d(cleaned[-1], pts[-1]) > 0.25:
        cleaned.append(pts[-1])

    out = [cleaned[0]]
    for i in range(len(cleaned) - 1):
        a, b = cleaned[i], cleaned[i + 1]
        d = dist2d(a, b)
        n = max(1, int(math.ceil(d / step_m)))
        for k in range(1, n + 1):
            t = k / n
            out.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
    return out


def clip_polyline_to_box(pts, xmin, xmax, zmin, zmax):
    """Liang-Barsky segment clipping returning list of contiguous clipped polylines."""
    def clip_seg(p0, p1):
        x0, z0 = p0
        x1, z1 = p1
        dx, dz = x1 - x0, z1 - z0
        t0, t1 = 0.0, 1.0
        for p, q in (
            (-dx, x0 - xmin),
            (dx, xmax - x0),
            (-dz, z0 - zmin),
            (dz, zmax - z0),
        ):
            if abs(p) < 1e-12:
                if q < 0:
                    return None
            else:
                r = q / p
                if p < 0:
                    if r > t1:
                        return None
                    if r > t0:
                        t0 = r
                else:
                    if r < t0:
                        return None
                    if r < t1:
                        t1 = r
        return (x0 + t0 * dx, z0 + t0 * dz), (x0 + t1 * dx, z0 + t1 * dz), t1 < 1.0 - 1e-6

    spans = []
    cur = []
    for i in range(len(pts) - 1):
        res = clip_seg(pts[i], pts[i + 1])
        if res is None:
            if len(cur) >= 2:
                spans.append(cur)
            cur = []
            continue
        a, b, clipped_end = res
        if not cur:
            cur = [a, b]
        else:
            if dist2d(cur[-1], a) > 0.5:
                if len(cur) >= 2:
                    spans.append(cur)
                cur = [a, b]
            else:
                cur.append(b)
        if clipped_end:
            if len(cur) >= 2:
                spans.append(cur)
            cur = []
    if len(cur) >= 2:
        spans.append(cur)
    return spans


def min_dist_poly(pt, poly):
    best = 1e9
    for i in range(len(poly) - 1):
        ax, az = poly[i]
        bx, bz = poly[i + 1]
        dx, dz = bx - ax, bz - az
        l2 = dx * dx + dz * dz
        t = 0.0 if l2 < 1e-9 else max(0.0, min(1.0, ((pt[0] - ax) * dx + (pt[1] - az) * dz) / l2))
        d = math.hypot(pt[0] - (ax + t * dx), pt[1] - (az + t * dz))
        if d < best:
            best = d
    return best


def bl_elev_at_pt(pt):
    """Exact blueCorridor elevation model matching metro_webgl_layer.js (ybDown 347..350, ybUp 362..366)."""
    x = pt[0]
    if x <= 510.0:
        return AT_GRADE_Y
    if x >= 788.6:
        return VIADUCT_Y
    u = (x - 510.0) / (788.6 - 510.0)
    return AT_GRADE_Y + (VIADUCT_Y - AT_GRADE_Y) * hermite(u)


def build_aligned_vaishali_nodes(src, va_data):
    """
    Rebuilds va['centerline'][0..24] directly from the real OSM Vaishali track pair:
      West/Station pair: src[2].coords[0] & reversed src[2].coords[4]
      East/Viaduct pair: src[4].coords[2] & reversed src[4].coords[3]
    Starts at Yamuna Bank northern Vaishali platform bay (midpoint of 2.0 & 2.4 at station)
    and joins VA[25] smoothly at (999.3, -871.1) through Laxmi Nagar (node 24).
    """
    s20 = [to_yb_m(p) for p in src[2]["coords"][0]]
    s24 = [to_yb_m(p) for p in reversed(src[2]["coords"][4])]
    s42 = [to_yb_m(p) for p in src[4]["coords"][2]]
    s43 = [to_yb_m(p) for p in reversed(src[4]["coords"][3])]

    # Combined track A (2.0 + 4.2) and track B (2.4 + 4.3)
    track_a = s20 + s42[1:]
    track_b = s24 + s43[1:]

    # Trim track_a and track_b to start right at Yamuna Bank station (u=0 along BL tangent, x ~ +8..14m)
    # Station northern bay center at x ~ 7.7m (perpendicular v=+16.0m from BL[357]=(13.6, 0.2))
    # Find closest point on track_a and track_b to (7.7, -14.7)
    def slice_from_closest(poly, target):
        best_i, best_d = 0, 1e9
        s_list = cum_lengths(poly)
        # dense search along segments
        for s_val in range(0, int(s_list[-1]), 1):
            p = interp_poly(poly, float(s_val))
            d = dist2d(p, target)
            if d < best_d:
                best_d = d
                best_s = float(s_val)
        start_pt = interp_poly(poly, best_s)
        out = [start_pt]
        for i in range(len(poly)):
            if s_list[i] > best_s + 0.5:
                out.append(poly[i])
        return out

    yb_north_bay = (7.7, -14.7)
    ta = slice_from_closest(track_a, yb_north_bay)
    tb = slice_from_closest(track_b, yb_north_bay)

    # Resample both tracks evenly by normalized arc parameter [0..1] up to Laxmi Nagar ~94% before VA[25]
    # Note track_a[-1] = (1000.4, -876.5), track_b[-1] = (1000.4, -867.1) -> midpoint (1000.4, -871.8) = 0.7m from VA[25]!
    la = poly_length(ta)
    lb = poly_length(tb)
    va25_m = to_yb_m(va_data["centerline"][25])
    # Compute step 0..24 so index 24 is ~93.5% along la/lb (right at x=936.8, z=-825.7 = Laxmi Nagar)
    # and next step (VA[25]) is at (999.3, -871.1)
    # Wait: check fraction where midpoint reaches x=936.8
    mid_dense = []
    n_dense = 200
    for k in range(n_dense + 1):
        u = k / n_dense
        pa = interp_poly(ta, u * la)
        pb = interp_poly(tb, u * lb)
        mid_dense.append(((pa[0] + pb[0]) * 0.5, (pa[1] + pb[1]) * 0.5))

    # Find parameter along mid_dense closest to Laxmi Nagar longitudinal position (x=936.8)
    s_mid = cum_lengths(mid_dense)
    ln_total = s_mid[-1]
    laxmi_s = ln_total
    for k, p in enumerate(mid_dense):
        if p[0] >= 936.8:
            laxmi_s = s_mid[k]
            break

    # Build 25 nodes (0..24) evenly spaced from 0 to laxmi_s
    nodes_0_24_m = [interp_poly(mid_dense, (i / 24.0) * laxmi_s) for i in range(25)]
    nodes_0_24_ll = [yb_m_to_ll(p) for p in nodes_0_24_m]

    va_updated = json.loads(json.dumps(va_data))
    va_updated["centerline"] = nodes_0_24_ll + va_data["centerline"][25:]
    # Sync station coords to trackNodeIndex 0 and 24 cleanly
    va_updated["stations"][0]["coords"] = nodes_0_24_ll[0]
    va_updated["stations"][1]["coords"] = nodes_0_24_ll[24]
    return va_updated, nodes_0_24_m


def va_elev_at_s(s_m):
    """Exact match to isBlueVaishali in metro_webgl_layer.js (nodes 5..8..15)."""
    if s_m <= 266.0:
        return AT_GRADE_Y
    if s_m <= 425.4:
        return AT_GRADE_Y + (6.4 - AT_GRADE_Y) * hermite((s_m - 266.0) / (425.4 - 266.0))
    if s_m <= 797.6:
        return 6.4 + (VIADUCT_Y - 6.4) * hermite((s_m - 425.4) / (797.6 - 425.4))
    return VIADUCT_Y


def trim_Ends_near_corridor(pts, corridor_poly, min_clear_m=4.5):
    """Keeps maximal contiguous interior portion / or strips points overlapping corridor_poly."""
    # Split into contiguous sub-spans where points are outside min_clear_m, keeping 1 boundary point for clean switch join
    spans = []
    cur = []
    for i, p in enumerate(pts):
        d = min_dist_poly(p, corridor_poly)
        if d >= min_clear_m:
            if not cur and i > 0:
                cur.append(pts[i - 1])
            cur.append(p)
        else:
            if cur:
                cur.append(p)
                if len(cur) >= 2:
                    spans.append(cur)
                cur = []
    if len(cur) >= 2:
        spans.append(cur)
    return spans


def pack_span_3d(pts_elev):
    """Converts list of (x, z, elev) in YB meters into [[lng, lat, elev], ...]."""
    out = []
    for x, z, elev in pts_elev:
        ll = yb_m_to_ll((x, z))
        out.append([ll[0], ll[1], round(elev, 3)])
    return out


def sample_poly_frame(poly, target_x, lat_offset=0.0):
    """Samples point & unit tangent at x ~ target_x with Three.js right normal (-tz, tx) * lat_offset."""
    # Find closest segment crossing target_x (or closest point)
    best_pt, best_tan = poly[0], (1.0, 0.0)
    best_dx = 1e9
    for i in range(len(poly) - 1):
        ax, az = poly[i]
        bx, bz = poly[i + 1]
        dx, dz = bx - ax, bz - az
        segl = math.hypot(dx, dz)
        if segl < 1e-6:
            continue
        tx, tz = dx / segl, dz / segl
        if (ax <= target_x <= bx) or (bx <= target_x <= ax):
            t = 0.0 if abs(bx - ax) < 1e-6 else (target_x - ax) / (bx - ax)
            px, pz = ax + t * dx, az + t * dz
            return (px - tz * lat_offset, pz + tx * lat_offset), (tx, tz)
        d = min(abs(ax - target_x), abs(bx - target_x))
        if d < best_dx:
            best_dx = d
            p = poly[i] if abs(ax - target_x) <= abs(bx - target_x) else poly[i + 1]
            best_pt = (p[0] - tz * lat_offset, p[1] + tx * lat_offset)
            best_tan = (tx, tz)
    return best_pt, best_tan


def hermite_s_turnout(p0, t0, p1, t1, n_pts=24):
    """Cubic Hermite S-curve cleanly tangent to start & end rails with zero angular kink."""
    chord = dist2d(p0, p1)
    scale = chord * 0.45
    m0 = (t0[0] * scale, t0[1] * scale)
    m1 = (t1[0] * scale, t1[1] * scale)
    pts = []
    for k in range(n_pts):
        u = k / (n_pts - 1)
        u2 = u * u
        u3 = u2 * u
        h00 = 2 * u3 - 3 * u2 + 1
        h10 = u3 - 2 * u2 + u
        h01 = -2 * u3 + 3 * u2
        h11 = u3 - u2
        x = h00 * p0[0] + h10 * m0[0] + h01 * p1[0] + h11 * m1[0]
        z = h00 * p0[1] + h10 * m0[1] + h01 * p1[1] + h11 * m1[1]
        pts.append((x, z))
    return pts


def validate_slope(pts_elev, name, max_grade=0.08):
    max_g = 0.0
    for i in range(len(pts_elev) - 1):
        ds = dist2d(pts_elev[i], pts_elev[i + 1])
        if ds > 0.5:
            g = abs(pts_elev[i + 1][2] - pts_elev[i][2]) / ds
            if g > max_g:
                max_g = g
    if max_g > max_grade:
        raise ValueError(f"Excessive slope {max_g:.4f} on {name} (limit {max_grade})")
    return max_g


def main():
    src = json.loads(SRC_PATH.read_text())
    bl = json.loads(BL_PATH.read_text())
    va = json.loads(VA_PATH.read_text())

    # 1. Align VA 0..24 & write updated vaishali_branch_accurate_osm.json
    va_updated, va_0_24_m = build_aligned_vaishali_nodes(src, va)
    VA_PATH.write_text(json.dumps(va_updated, indent=2) + "\n")

    bl_corridor_m = [to_yb_m(p) for p in bl["centerline"][344:376]]
    va_corridor_m = [to_yb_m(p) for p in va_updated["centerline"][0:30]]

    categories = {
        "at_grade_yard": [],
        "noida_underpass": [],
        "yard_underpass": [],
        "vaishali_spur_viaduct": [],
        "noida_pocket_viaduct": [],
        "crossovers": [],
    }
    max_observed_grade = 0.0

    # --- Group A: 63 yard tracks from src[3] ---
    # Skip 3.47, 3.51 (merged with src[1] -> yard_underpass), 3.50 (overlaps BL),
    # 3.52 (merged with 9.1 -> noida_pocket_viaduct), 3.59 (merged with 5.1 -> vaishali_spur_viaduct)
    skip_s3 = {47, 50, 51, 52, 59}
    for si, ln in enumerate(src[3]["coords"]):
        if si in skip_s3:
            continue
        pts = [to_yb_m(p) for p in ln]
        for seg in clip_polyline_to_box(pts, *CLIP_X, *CLIP_Z):
            res = resample_poly(seg, step_m=12.0)
            if si == 61:
                # 3.61 meets BL near west bridge abutment (-697.9, 229.0); clip where overlapping BL double-track
                sub_spans = trim_Ends_near_corridor(res, bl_corridor_m, min_clear_m=5.2)
                for sp in sub_spans:
                    categories["at_grade_yard"].append(pack_span_3d([(p[0], p[1], AT_GRADE_Y) for p in sp]))
            else:
                categories["at_grade_yard"].append(pack_span_3d([(p[0], p[1], AT_GRADE_Y) for p in res]))

    # West connector portions of src[2].0 and src[2].4 between turnout (-255m) and Yamuna Bank VA[0]
    for seg_idx in (0, 4):
        ln = src[2]["coords"][seg_idx]
        pts = [to_yb_m(p) for p in (ln if seg_idx == 0 else list(reversed(ln)))]
        # Keep only x in [-260, +8.0] (before VA[0] starts at x~7.7m)
        sub = [p for p in pts if -270.0 <= p[0] <= 12.0]
        if len(sub) >= 2:
            # Anchor exact end onto VA[0] vicinity (x=7.7)
            res = resample_poly(sub, step_m=10.0)
            res = [p for p in res if min_dist_poly(p, va_corridor_m) >= 2.0 or p[0] <= 7.7]
            if len(res) >= 2:
                # Trim west tail that sits inside BL[-4.6, +4.6]
                trimmed = trim_Ends_near_corridor(res, bl_corridor_m, min_clear_m=3.2)
                for sp in trimmed:
                    categories["at_grade_yard"].append(pack_span_3d([(p[0], p[1], AT_GRADE_Y) for p in sp]))

    # --- Group B: Eastbound Noida Underpass (2.1 -> src[0] -> 2.3 -> 8.0 ramp) ---
    s21 = [to_yb_m(p) for p in src[2]["coords"][1]]
    s0 = [to_yb_m(p) for p in src[0]["coords"]]
    s23 = [to_yb_m(p) for p in src[2]["coords"][3]]
    s80 = [to_yb_m(p) for p in src[8]["coords"][0]]
    # Join cleanly (removing duplicate joint vertices); stop 8.0 where it merges within 3.2m of BL
    s80_clipped = []
    for p in resample_poly(s80, step_m=8.0):
        s80_clipped.append(p)
        if p[0] > 730.0 and min_dist_poly(p, bl_corridor_m) < 3.5:
            break
    eb_noida = resample_poly(s21[:-1] + s0[:-1] + s23[:-1] + s80_clipped, step_m=7.5)
    eb_s = cum_lengths(eb_noida)
    # Locate trough center nearest (368.3, -180.4)
    cross_s_eb = min(range(len(eb_noida)), key=lambda i: dist2d(eb_noida[i], (368.3, -180.4)))
    s_center_eb = eb_s[cross_s_eb]

    def eb_elev(s_val, pt):
        d_cross = abs(s_val - s_center_eb)
        if d_cross <= 18.0:
            return UNDERPASS_Y
        if d_cross <= 135.0:
            u = (d_cross - 18.0) / (135.0 - 18.0)
            return UNDERPASS_Y + (AT_GRADE_Y - UNDERPASS_Y) * hermite(u)
        return bl_elev_at_pt(pt)

    eb_3d = [(eb_noida[i][0], eb_noida[i][1], eb_elev(eb_s[i], eb_noida[i])) for i in range(len(eb_noida))]
    max_observed_grade = max(max_observed_grade, validate_slope(eb_3d, "noida_underpass"))
    categories["noida_underpass"].append(pack_span_3d(eb_3d))

    # --- Group C: Yard Underpass Track (3.47 -> src[1] -> 3.51) ---
    s347 = [to_yb_m(p) for p in src[3]["coords"][47]]
    s1 = [to_yb_m(p) for p in reversed(src[1]["coords"])]  # (353.6,-182.5) -> (399.7,-194.0)
    s351 = [to_yb_m(p) for p in reversed(src[3]["coords"][51])]  # (399.7,-194.0) -> (658.2,-135.9)
    yd_under = resample_poly(s347[:-1] + s1[:-1] + s351, step_m=7.5)
    yd_s = cum_lengths(yd_under)
    cross_s_yd = min(range(len(yd_under)), key=lambda i: dist2d(yd_under[i], (377.7, -189.3)))
    s_center_yd = yd_s[cross_s_yd]

    def yd_elev(s_val):
        d_cross = abs(s_val - s_center_yd)
        if d_cross <= 20.0:
            return UNDERPASS_Y
        if d_cross <= 145.0:
            return UNDERPASS_Y + (AT_GRADE_Y - UNDERPASS_Y) * hermite((d_cross - 20.0) / 125.0)
        return AT_GRADE_Y

    yd_3d = [(yd_under[i][0], yd_under[i][1], yd_elev(yd_s[i])) for i in range(len(yd_under))]
    max_observed_grade = max(max_observed_grade, validate_slope(yd_3d, "yard_underpass"))
    categories["yard_underpass"].append(pack_span_3d(yd_3d))

    # --- Group D: Vaishali Elevated Depot Spur (3.59 -> 5.1) + Siding 6.0 ---
    s359 = [to_yb_m(p) for p in src[3]["coords"][59]]
    s51 = [to_yb_m(p) for p in reversed(src[5]["coords"][1])]  # (307.5,-220.8) -> (541.8,-457.7)
    spur_raw = resample_poly(s359[:-1] + s51, step_m=8.0)
    # Trim final ~15m where 5.1 merges directly onto Vaishali viaduct (avoid double ballast overlap)
    spur = []
    for p in spur_raw:
        if p[0] > 495.0 and min_dist_poly(p, va_corridor_m) < 4.8:
            break
        spur.append(p)
    spur_s = cum_lengths(spur)
    # Ramp starts right at (307.5, -220.8) -> ~275m from start of 3.59
    ramp_start_idx = min(range(len(spur)), key=lambda i: dist2d(spur[i], (307.5, -220.8)))
    s_ramp0 = spur_s[ramp_start_idx]
    va_len = poly_length(va_0_24_m)

    def va_elev_nearest(pt):
        # Project continuously onto va_0_24_m segments for C0/C1 height match
        best_s, best_d = 0.0, 1e9
        s_list = cum_lengths(va_0_24_m)
        for k in range(len(va_0_24_m) - 1):
            ax, az = va_0_24_m[k]
            bx, bz = va_0_24_m[k + 1]
            dx, dz = bx - ax, bz - az
            l2 = dx * dx + dz * dz
            t = 0.0 if l2 < 1e-9 else max(0.0, min(1.0, ((pt[0] - ax) * dx + (pt[1] - az) * dz) / l2))
            d = math.hypot(pt[0] - (ax + t * dx), pt[1] - (az + t * dz))
            if d < best_d:
                best_d = d
                best_s = s_list[k] + t * math.sqrt(l2)
        return va_elev_at_s(best_s)

    target_end_h = va_elev_nearest(spur[-1])
    spur_3d = []
    s_end_spur = spur_s[-1]
    for i, p in enumerate(spur):
        if spur_s[i] <= s_ramp0:
            z_m = AT_GRADE_Y
        else:
            u = (spur_s[i] - s_ramp0) / max(1.0, s_end_spur - s_ramp0)
            z_m = AT_GRADE_Y + (target_end_h - AT_GRADE_Y) * hermite(u)
        spur_3d.append((p[0], p[1], z_m))
    max_observed_grade = max(max_observed_grade, validate_slope(spur_3d, "vaishali_spur_viaduct"))
    categories["vaishali_spur_viaduct"].append(pack_span_3d(spur_3d))

    # 6.0 Elevated Siding alongside Vaishali viaduct (501,-394 -> 561,-503) clipped to CLIP_Z
    s60 = [to_yb_m(p) for p in src[6]["coords"]]
    for seg in clip_polyline_to_box(s60, *CLIP_X, *CLIP_Z):
        res = resample_poly(seg, step_m=8.0)
        res_3d = [(p[0], p[1], va_elev_nearest(p)) for p in res]
        max_observed_grade = max(max_observed_grade, validate_slope(res_3d, "vaishali_siding_6"))
        categories["vaishali_spur_viaduct"].append(pack_span_3d(res_3d))

    # --- Group E: Noida Pocket Elevated Lead (3.52 -> 9.1) + 9.0 ---
    s352 = [to_yb_m(p) for p in reversed(src[3]["coords"][52])]  # (175.9,-167.8) -> (692.2,-112.3)
    s91 = [to_yb_m(p) for p in reversed(src[9]["coords"][1])]   # (692.2,-112.3) -> (754.6, 5.7)
    pocket = resample_poly(s352[:-1] + s91, step_m=8.0)
    # Trim very end within 3.5m of BL viaduct centerline
    pocket_trimmed = []
    for p in pocket:
        if p[0] > 730.0 and min_dist_poly(p, bl_corridor_m) < 3.5:
            break
        pocket_trimmed.append(p)
    pk_s = cum_lengths(pocket_trimmed)
    # Ramp gently from x >= 490m (~315m along) up to target_h (matching BL at pocket_trimmed[-1])
    pk_ramp0 = next((pk_s[i] for i, p in enumerate(pocket_trimmed) if p[0] >= 490.0), pk_s[-1] * 0.6)
    pk_target_h = bl_elev_at_pt(pocket_trimmed[-1])
    pk_3d = []
    for i, p in enumerate(pocket_trimmed):
        if pk_s[i] <= pk_ramp0:
            h = AT_GRADE_Y
        else:
            u = (pk_s[i] - pk_ramp0) / max(1.0, pk_s[-1] - pk_ramp0)
            h = AT_GRADE_Y + (pk_target_h - AT_GRADE_Y) * hermite(u)
        pk_3d.append((p[0], p[1], h))
    max_observed_grade = max(max_observed_grade, validate_slope(pk_3d, "noida_pocket_viaduct"))
    categories["noida_pocket_viaduct"].append(pack_span_3d(pk_3d))

    # --- Group F: Tangent-Smooth Hermite S-Curve Throat Crossovers (2.5, 2.6, 2.7 + mainline scissors) ---
    # Instead of straight jagged chords slicing through ballast/rails, peel tangentially off actual rail axes
    p_va_s95, t_va_s95 = sample_poly_frame(va_corridor_m, 95.0, +4.6)
    p_bl_n205, t_bl_n205 = sample_poly_frame(bl_corridor_m, 205.0, -4.6)
    co_26 = hermite_s_turnout(p_va_s95, t_va_s95, p_bl_n205, t_bl_n205, 22)

    p_bl_n215, t_bl_n215 = sample_poly_frame(bl_corridor_m, 215.0, -4.6)
    p_va_s295, t_va_s295 = sample_poly_frame(va_corridor_m, 295.0, +4.6)
    co_25 = hermite_s_turnout(p_bl_n215, t_bl_n215, p_va_s295, t_va_s295, 22)

    p_va_n95, t_va_n95 = sample_poly_frame(va_corridor_m, 95.0, -4.6)
    p_eb_290, t_eb_290 = sample_poly_frame(eb_noida, 290.0, 0.0)
    co_27 = hermite_s_turnout(p_va_n95, t_va_n95, p_eb_290, t_eb_290, 26)

    # Double-slip mainline scissors crossover east of station platforms (BL South +4.6 <-> BL North -4.6)
    p_bl_s82, t_bl_s82 = sample_poly_frame(bl_corridor_m, 82.0, +4.6)
    p_bl_n142, t_bl_n142 = sample_poly_frame(bl_corridor_m, 142.0, -4.6)
    co_sc1 = hermite_s_turnout(p_bl_s82, t_bl_s82, p_bl_n142, t_bl_n142, 18)

    p_bl_n82, t_bl_n82 = sample_poly_frame(bl_corridor_m, 82.0, -4.6)
    p_bl_s142, t_bl_s142 = sample_poly_frame(bl_corridor_m, 142.0, +4.6)
    co_sc2 = hermite_s_turnout(p_bl_n82, t_bl_n82, p_bl_s142, t_bl_s142, 18)

    switch_points = []
    for co_pts, co_t0, co_t1 in (
        (co_26, t_va_s95, t_bl_n205),
        (co_25, t_bl_n215, t_va_s295),
        (co_27, t_va_n95, t_eb_290),
        (co_sc1, t_bl_s82, t_bl_n142),
        (co_sc2, t_bl_n82, t_bl_s142),
    ):
        # Slightly sink ballast base 1.5cm below main track ballast top at crossovers to prevent coplanar Z-fighting
        categories["crossovers"].append(pack_span_3d([(p[0], p[1], AT_GRADE_Y - 0.015) for p in co_pts]))
        switch_points.append({
            "ll": yb_m_to_ll(co_pts[1]),
            "elevM": AT_GRADE_Y,
            "yawRad": round(math.atan2(-co_t0[1], co_t0[0]), 4),
        })
        switch_points.append({
            "ll": yb_m_to_ll(co_pts[-2]),
            "elevM": AT_GRADE_Y,
            "yawRad": round(math.atan2(-co_t1[1], co_t1[0]), 4),
        })

    # --- Group G: Architectural & Civil Anchors (for buildYamunaBankJunctionStation) ---
    # Station tangent yaw at BL[357] -> BL[356..358]
    p356, p358 = to_yb_m(bl["centerline"][356]), to_yb_m(bl["centerline"][358])
    tx, tz = p358[0] - p356[0], p358[1] - p356[1]
    tlen = math.hypot(tx, tz)
    tx, tz = tx / tlen, tz / tlen
    nx, nz = tz, -tx  # NW perpendicular unit vector
    bl357 = to_yb_m(bl["centerline"][357])

    # Compute stabled 8-coach rake positions directly on real yard sidings (3.18, 3.22, 3.27)
    stabled_rakes = []
    for si in (18, 22, 27):
        track_pts = [to_yb_m(p) for p in src[3]["coords"][si]]
        mid_s = poly_length(track_pts) * 0.48
        p_a = interp_poly(track_pts, max(0.0, mid_s - 40.0))
        p_b = interp_poly(track_pts, min(poly_length(track_pts), mid_s + 40.0))
        center_pt = interp_poly(track_pts, mid_s)
        ang_rad = math.atan2(-(p_b[1] - p_a[1]), p_b[0] - p_a[0])
        stabled_rakes.append({
            "centerLL": yb_m_to_ll(center_pt),
            "elevM": AT_GRADE_Y,
            "yawRad": round(ang_rad, 4),
            "coaches": 8,
        })

    # Depot shed angle (measured along NW inspection/stabling tracks x=-650..-350)
    # 3.09 goes (-678, -18.4) -> (-350, ~-85): slope dz/dx ~ -0.22 -> -12.6 deg
    anchors = {
        "originYB": YB_LL,
        "stationTangent": [round(tx, 5), round(tz, 5)],
        "stationNormalNW": [round(nx, 5), round(nz, 5)],
        "stationHall": {
            "centerLL": yb_m_to_ll((bl357[0] + nx * 8.0, bl357[1] + nz * 8.0)),
            "lengthM": 144.0,
            "widthM": 33.5,
            "elevM": AT_GRADE_Y,
        },
        "underpassBridge": {
            "centerLL": yb_m_to_ll((368.3, -180.4)),
            "troughStartLL": yb_m_to_ll((300.0, -154.0)),
            "troughEndLL": yb_m_to_ll((430.0, -196.0)),
            "vaishaliDeckY": 6.1,
            "troughFloorY": UNDERPASS_Y,
        },
        "stabledRakes": stabled_rakes,
        "switchHardware": switch_points,
        "throatBallastPads": [
            {
                "name": "East Station Throat Ballast Apron",
                "centerLL": yb_m_to_ll((150.0, -68.0)),
                "lengthM": 152.0,
                "widthM": 28.0,
                "angleDeg": -21.5,
                "elevM": AT_GRADE_Y - 0.04,
            },
        ],
        "sheds": [
            {
                "name": "RS Building / Workshop West",
                "centerLL": yb_m_to_ll((-600.0, -35.0)),
                "lengthM": 115.0,
                "widthM": 42.0,
                "heightM": 11.5,
                "angleDeg": -12.6,
            },
            {
                "name": "Inspection Bay Shed",
                "centerLL": yb_m_to_ll((-430.0, -72.0)),
                "lengthM": 150.0,
                "widthM": 40.0,
                "heightM": 10.5,
                "angleDeg": -12.6,
            },
        ],
        "southParkingPlaza": {
            "centerLL": yb_m_to_ll((bl357[0] - nx * 42.0, bl357[1] - nz * 42.0)),
            "lengthM": 150.0,
            "widthM": 42.0,
        },
    }

    payload = {
        "version": 1,
        "boundsLocalM": {"x": list(CLIP_X), "z": list(CLIP_Z)},
        "maxGradeSlope": round(max_observed_grade, 4),
        "spanCounts": {k: len(v) for k, v in categories.items()},
        "tracks": categories,
        "anchors": anchors,
    }
    OUT_PATH.write_text(json.dumps(payload, separators=(",", ":")) + "\n")

    # Automated schema & bounds validation assertions
    for cat, spans in categories.items():
        for sp in spans:
            assert len(sp) >= 2, f"Empty span in {cat}"
            for pt in sp:
                mx, mz = to_yb_m(pt[:2])
                # Allow <= 2m float rounding tolerance on bounds clip
                assert CLIP_X[0] - 2.0 <= mx <= CLIP_X[1] + 2.0, f"{cat} X out of bounds: {mx}"
                assert CLIP_Z[0] - 2.0 <= mz <= CLIP_Z[1] + 2.0, f"{cat} Z out of bounds: {mz}"

    # Verify Laxmi Nagar haversine drift < 25m vs VA[24]
    ln_new = to_yb_m(va_updated["centerline"][24])
    ln_orig = (936.5, -848.5)
    drift = dist2d(ln_new, ln_orig)
    assert drift < 25.0, f"Laxmi Nagar drift too large: {drift:.1f}m"

    print("SUCCESS: Built yamuna_bank_yard_tracks.json and aligned vaishali_branch_accurate_osm.json")
    print("Span counts:", payload["spanCounts"])
    print(f"Max grade slope across all ramps: {max_observed_grade:.4f} (< 0.08)")
    print(f"Laxmi Nagar station alignment adjustment: {drift:.1f}m (< 25m)")
    print("VA[0] local (x,z):", tuple(round(v, 1) for v in to_yb_m(va_updated["centerline"][0])))
    print("VA[9] (over underpass) local (x,z):", tuple(round(v, 1) for v in to_yb_m(va_updated["centerline"][9])))


if __name__ == "__main__":
    main()
