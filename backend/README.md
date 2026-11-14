# Delhi Metro Radar — live reports backend

Optional crowd-sourced corrections on top of the timetable map, for the whole
Delhi Metro network. The website always works from its own timetable; this
backend only adds what riders report. If it is down, the map still works.

Unofficial. Not affiliated with DMRC.

## What riders can send, and what everyone can read

| Function | Who | What it does |
|---|---|---|
| `submit_report(id, line, station, towards, kind, age_s)` | signed-in (anonymous is fine) | One observation: a train `departed` / `arrived` / is `stuck` / `cleared`, at `station`, heading `towards` (the destination shown on the train, or just the next station). `age_s` = seconds since it happened, measured on the phone. `id` = a UUID the app makes, so a resend is ignored. |
| `get_live_state(line?)` | anyone | Combined recent observations and warnings for one line, or the whole network. Never waits: always answers within milliseconds. |
| `get_network()` | anyone | Lines, routes, stations and valid destinations, with the ids the server uses. |

Every `submit_report` answer has a `status`: `accepted`, `duplicate`, `rate_limited`, `busy`,
`implausible`, `bad_station`, `bad_towards`, `bad_kind`, `bad_time`, `unauthenticated`, `missing_id`.
Only `rate_limited` and `busy` are worth retrying later.

Every `get_live_state` answer carries `age_s` and `stale`. When `stale` is true (older than a minute),
or `status` is `warming`, show the timetable alone and say live reports are delayed.

Admin only (service key, never in the website): `apply_network`, `admin_set_alert`, `admin_clear_alert`,
`admin_block_device`, `admin_unblock_device`, `get_health`, `refresh_live_state`, `purge_old_reports`,
`schedule_purge`.

## Setting it up on Supabase

1. Create a project. In **Authentication → Sign In / Providers**, turn on **anonymous sign-ins**, and
   turn on **CAPTCHA protection** (Cloudflare Turnstile). Without CAPTCHA, anyone can make accounts in
   bulk and fake reports.
2. In **Database → Extensions**, enable **pg_cron** (version 1.5 or later, for the 10-second refresh).
3. Run `supabase/migrations/0001_live_reports.sql`, then `0002_seed_network.sql`, each as a whole
   (`supabase db push`, or paste the whole file into the SQL editor).
4. If pg_cron was enabled after step 3, run `select public.schedule_purge();` once.
5. Check: `select public.get_health();` should show 276 active stations and `pg_cron_enabled: true`.
6. In the website, call the functions with **POST** (the supabase-js default for `rpc`).

Without pg_cron it still works, but the live copy is only rebuilt when someone reads it, and old reports
are cleared more slowly than they may arrive at peak.

To undo everything: `supabase/rollback/0001_live_reports.down.sql`.

## How it decides things

- **Direction.** The server turns `towards` into the next station on the way there, using the order of
  the route that holds both stations (how trains are signed) or else the shortest way on the line. A true
  tie on the Pink ring with no route to decide it is refused (`bad_towards`).
- **Trust.** A report counts fully only if its device was first seen at least a day before it
  ("established"); otherwise it counts as half.
- **Observations.** Each device speaks for one train: only its latest departure and latest arrival
  count, and their weight halves every 2 minutes. "high" confidence needs three established devices.
- **"Train stuck" warnings.** Each device has one current word, its latest report anywhere. A warning
  needs riders adding up to 3, counted over a stretch of consecutive stations on one track (only places
  with an established rider link up). One warning per stretch, "confirmed" when 3 or more are
  established. Only the riders who said stuck can take it back; at plain through stations, clearly more
  established riders still leaving the same way (at least 4, and twice the established riders saying
  stuck, within 5 minutes) cancel it. A stuck report stands for 20 minutes.
- **Limits.** 10 reports a minute and 30 per 10 minutes per device; 6,000 a minute overall, of which new
  devices share 1,500; an established rider who has been quiet for 2 minutes still gets through a flood
  (up to 12,000 a minute overall). Reports from far-apart stations too close in time are refused.
- **Retention.** Raw reports are deleted after 24 hours; devices unused for 6 months are forgotten.

All numbers are in `metro.cfg()` at the top of the migration.

## Keeping the network current

`data/network.json` is generated from the GTFS timetable copy plus `data/network_updates.json`, which
lists everything opened since that copy (as of 2026-11-13: Magenta to Krishna Park Extension, Magenta
Majlis Park–Deepali Chowk, the Pink ring, Airport line to Yashobhoomi Dwarka Sector 25). When DMRC opens
or renames something, edit `network_updates.json`, then:

```
node scripts/build_network.mjs <path-to-gtfs-folder>
```

and apply the regenerated `supabase/migrations/0002_seed_network.sql` (as a new migration). Reloading
clears stored live reports, since their directions may no longer fit.

Still to check against DMRC: the 14 newer stations have no coordinates yet; the list of short-turn
stations comes from the old timetable copy (only 5); and whether Pink Line trains for Shiv Vihar still
run the original way round from Majlis Park.

## Tests

```
npm ci
npm test                                   # embedded Postgres, no setup
DATABASE_URL=postgres://... npm test       # a real Postgres: adds the concurrency and load tests
```

With `DATABASE_URL`, the tests create and drop their own temporary database.
