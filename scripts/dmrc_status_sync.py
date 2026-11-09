#!/usr/bin/env python3
"""
scripts/dmrc_status_sync.py
Automated DMRC Line Status and Notification Synchronizer.

Powered by Scrapling (adaptive stealth requests with zero prompt injection exposure).
Fetches live line health and press advisories from DMRC upstream services, updates
`src/data/service_advisories.json`, and triggers dynamic frontend alerts.

Usage:
  python3 scripts/dmrc_status_sync.py [--dry-run] [--verbose] [--force-advisory]
"""

import sys
import json
import argparse
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    from scrapling.fetchers import Fetcher
except ImportError:
    import urllib.request
    class SimpleFetcher:
        @staticmethod
        def get(url, timeout=10):
            req = urllib.request.Request(url, headers={
                "User-Agent": "DelhiMetroRadar/1.0 (+https://github.com/delhi-metro-radar)",
                "Accept": "application/json"
            })
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode())
                class DummyResp:
                    status = resp.status
                    def json(self): return data
                return DummyResp()
    Fetcher = SimpleFetcher

WORKSPACE_DIR = Path(__file__).resolve().parent.parent
ADVISORY_FILE = WORKSPACE_DIR / "src" / "data" / "service_advisories.json"
LINES_URL = "https://dmrc-rest-api.vercel.app/api/v1/dmrc/lines"
NOTIFICATIONS_URL = "https://dmrc-rest-api.vercel.app/api/v1/dmrc/notifications"

def get_ist_now_iso():
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).strftime("%Y-%m-%dT%H:%M:%S+05:30")

def sync(dry_run=False, verbose=False, force_advisory=False):
    print(f"[{get_ist_now_iso()}] Starting DMRC automated status sync...")
    
    # 1. Fetch Line Statuses
    line_status = "Normal Service"
    yellow_line_info = None
    try:
        lines_resp = Fetcher.get(LINES_URL, timeout=12)
        lines_data = lines_resp.json()
        for item in lines_data:
            if item.get("id") == 2 or "Yellow Line" in item.get("line_color", ""):
                yellow_line_info = item
                line_status = item.get("status", "Normal Service")
                break
        if verbose:
            print(f"  Yellow Line status from DMRC: {line_status}")
    except Exception as e:
        print(f"  Warning: Failed to fetch lines API ({e}). Falling back to nominal.", file=sys.stderr)

    # 2. Fetch Notifications
    relevant_notices = []
    try:
        notif_resp = Fetcher.get(NOTIFICATIONS_URL, timeout=12)
        notifs_data = notif_resp.json()
        keywords = ["yellow line", "samaypur badli", "millennium city", "rajiv chowk", "kashmere gate", "hauz khas", "diwali", "delay", "curfew", "maintenance"]
        for n in notifs_data[:10]:
            title = n.get("title", "")
            title_lower = title.lower()
            if any(k in title_lower for k in keywords):
                relevant_notices.append(n)
        if verbose:
            print(f"  Found {len(relevant_notices)} relevant DMRC press notices.")
    except Exception as e:
        print(f"  Warning: Failed to fetch notifications API ({e}).", file=sys.stderr)

    # 3. Determine Advisory State
    advisories = []
    overall_status = "normal"
    headline = "All Yellow Line services operating normally"

    if force_advisory:
        overall_status = "active"
        headline = "SIMULATED: DMRC Track Maintenance between Rajiv Chowk & Central Secretariat"
        advisories.append({
            "id": "simulated_adv_01",
            "type": "planned_maintenance",
            "severity": "warning",
            "title": "Simulated Single-Line Operations",
            "message": "Temporary speed restrictions enforced for demonstration purposes.",
            "impact": {
                "headwayMultiplier": 1.4,
                "additionalDwellSeconds": 45,
                "affectedStationIndices": [14, 15, 16, 17]
            }
        })
    elif line_status != "Normal Service":
        overall_status = "active"
        headline = f"DMRC Service Alert: Yellow Line reporting {line_status}"
        advisories.append({
            "id": f"dmrc_official_{int(datetime.now().timestamp())}",
            "type": "official_disruption",
            "severity": "warning",
            "title": f"DMRC Official Alert: {line_status}",
            "message": f"DMRC official monitoring indicates {line_status} on the Yellow Line corridor.",
            "impact": {
                "headwayMultiplier": 1.3,
                "additionalDwellSeconds": 30,
                "affectedStationIndices": list(range(37))
            }
        })
    elif relevant_notices:
        # Check if there is an active operational timing change
        latest_notice = relevant_notices[0]
        notice_title = latest_notice.get("title", "")
        # Notice 556: Diwali timings or operational announcements
        if "diwali" in notice_title.lower() or "last metro train" in notice_title.lower():
            overall_status = "active"
            headline = f"DMRC Special Notice: {notice_title[:75]}..."
            advisories.append({
                "id": f"dmrc_notice_{latest_notice.get('id', 0)}",
                "type": "special_operations_notice",
                "severity": "info",
                "title": notice_title[:80],
                "message": f"DMRC Press Advisory: {notice_title}. Refer to official website for full schedule.",
                "url": latest_notice.get("link_to_outside_url", "https://delhimetrorail.com"),
                "impact": {
                    "headwayMultiplier": 1.0,
                    "additionalDwellSeconds": 0,
                    "affectedStationIndices": []
                }
            })

    output_data = {
        "corridor": "Delhi Metro Yellow Line (Line 2)",
        "last_updated_ist": get_ist_now_iso(),
        "source": "DMRC Upstream Live Status Engine via Scrapling",
        "sync_frequency_seconds": 60,
        "status": overall_status,
        "headline": headline,
        "advisories": advisories
    }

    if verbose or dry_run:
        print("\nGenerated Advisory Payload:")
        print(json.dumps(output_data, indent=2))

    if not dry_run:
        with open(ADVISORY_FILE, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2)
        print(f"[{get_ist_now_iso()}] Wrote updated advisories to {ADVISORY_FILE}")
    else:
        print("Dry run completed - no files modified.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync DMRC live statuses using Scrapling")
    parser.add_argument("--dry-run", action="store_true", help="Print findings without writing to file")
    parser.add_argument("--verbose", action="store_true", help="Print detailed diagnostic logs")
    parser.add_argument("--force-advisory", action="store_true", help="Generate simulated maintenance advisory for testing")
    args = parser.parse_args()
    sync(dry_run=args.dry_run, verbose=args.verbose, force_advisory=args.force_advisory)

