-- =====================================================================
-- Delhi Metro Radar — live reports backend, whole network (Supabase / Postgres)
--
-- Design rules
--   * The browser timetable is always the fallback. This backend only adds
--     optional corrections on top; if it is down, the map still works.
--   * Every table and internal function lives in the private schema "metro",
--     which the Data API does not expose. The public schema holds only the
--     functions meant to be called:
--       anyone        get_live_state(line?)   get_network()
--       signed-in     submit_report(...)
--       service key   apply_network, admin_*, get_health, purge_old_reports, schedule_purge
--   * Device identity = Supabase anonymous auth user (auth.uid()).
--     No names, emails or phone numbers are stored.
--   * Raw reports are deleted after 24 hours.
--   * The network (lines, branches, rings, stations) is data, loaded with
--     apply_network(json). Nothing about a particular line is hard-coded.
--
-- Network model
--   station   one physical station, one id, shared by every line that calls there
--   route     one ordered run of stations on a line. A line may have several:
--             a branch (Blue to Noida and to Vaishali), a ring closed by a
--             second run (Pink), or separate sections not yet joined (Magenta).
--   paths     apply_network works out, for every pair of stations on a line,
--             the shortest way between them and the first station on that way.
--   towards   riders give direction as the destination shown on the train, or
--             simply the next station. The server stores the NEXT station on
--             the way there, so every train leaving a platform the same way
--             groups together whatever its final destination.
--
-- Before going live
--   * Turn on CAPTCHA (Cloudflare Turnstile) for anonymous sign-ins in Supabase
--     Auth. Device limits below slow abuse down; only sign-up friction stops
--     someone creating accounts in bulk.
--   * Enable the pg_cron extension, then run: select public.schedule_purge();
--   * Keep the service key on a server or in the dashboard, never in the website.
--
-- Run this file as one unit: `supabase db push`, or paste the whole file into
-- the SQL editor. Both run it as a single transaction, so either everything
-- below exists with the right permissions, or nothing does.
-- =====================================================================

create schema metro;
revoke all on schema metro from public, anon, authenticated;

-- ---------- Network reference data -----------------------------------------

create table metro.network_meta (
  only_row    boolean primary key default true check (only_row),
  version     text        not null default 'empty',
  applied_at  timestamptz not null default now(),
  snapshot    jsonb       not null default '{}'::jsonb      -- what get_network() returns
);
insert into metro.network_meta default values;

create table metro.lines (
  id      text primary key check (id ~ '^[a-z0-9_]{1,64}$'),
  name    text not null check (length(name) between 1 and 120),
  active  boolean not null default true
);

create table metro.stations (
  id       text primary key check (id ~ '^[a-z0-9_]{1,64}$'),
  name     text not null check (length(name) between 1 and 120),
  aliases  text[] not null default '{}',
  lat      double precision check (lat between -90 and 90),
  lon      double precision check (lon between -180 and 180),
  active   boolean not null default true,
  check ((lat is null) = (lon is null))
);

create table metro.routes (
  id       text primary key check (id ~ '^[a-z0-9_]{1,64}$'),
  line_id  text not null references metro.lines(id),
  name     text not null check (length(name) between 1 and 200),
  active   boolean not null default true
);
create index routes_line_idx on metro.routes (line_id);

create table metro.route_stops (
  route_id    text    not null references metro.routes(id),
  seq         integer not null check (seq >= 0),
  station_id  text    not null references metro.stations(id),
  primary key (route_id, seq),
  unique (route_id, station_id)
);
create index route_stops_station_idx on metro.route_stops (station_id);

-- Derived by apply_network.
create table metro.line_stations (
  line_id        text    not null references metro.lines(id),
  station_id     text    not null references metro.stations(id),
  can_terminate  boolean not null default false,   -- trains may end here (shown as a destination)
  neighbours     integer not null,                 -- 1 = end of the line
  primary key (line_id, station_id)
);
create index line_stations_station_idx on metro.line_stations (station_id);

-- Shortest way between every two stations of a line. Two rows for the same
-- pair mean two equally short ways (opposite side of a ring): ambiguous.
create table metro.line_paths (
  line_id  text    not null,
  from_id  text    not null,
  to_id    text    not null,
  hops     integer not null,
  next_id  text    not null,           -- first station on the way from from_id to to_id
  primary key (line_id, from_id, to_id, next_id)
);

-- ---------- Rider data ------------------------------------------------------

-- departed : a train just left this station in this direction
-- arrived  : a train just arrived at this station
-- stuck    : the rider's train has been stopped unusually long here
-- cleared  : the rider's train started moving again after being stuck
create type metro.report_kind as enum ('departed', 'arrived', 'stuck', 'cleared');

create table metro.devices (
  device_id   uuid primary key,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  accepted    integer     not null default 0
);
create index devices_last_seen_idx on metro.devices (last_seen);
create index devices_first_seen_idx on metro.devices (first_seen);

-- The foreign keys here are a safety net only: lines and stations are switched
-- off, never deleted, so they need no supporting indexes on this busy table.
create table metro.reports (
  device_id    uuid        not null,
  id           uuid        not null,          -- made by the client, so a resend is ignored
  line_id      text        not null references metro.lines(id),
  station_id   text        not null references metro.stations(id),
  towards_id   text        not null references metro.stations(id),
  next_id      text        not null references metro.stations(id),   -- = station_id when the train ends here
  kind         metro.report_kind not null,
  established  boolean     not null default false,   -- device first seen at least a day before this report
  observed_at  timestamptz not null,
  received_at  timestamptz not null default now(),
  primary key (device_id, id)                 -- ids are private to a device: nobody can probe another's
);
create index reports_observed_idx    on metro.reports (observed_at);
create index reports_device_time_idx on metro.reports (device_id, received_at desc);
create index reports_received_idx    on metro.reports (received_at);
alter table metro.reports set (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02);

create table metro.alerts (
  id            bigint generated always as identity primary key,
  line_id       text references metro.lines(id),        -- null = whole network
  from_station  text references metro.stations(id),     -- null = whole line
  to_station    text references metro.stations(id),
  severity      text        not null check (severity in ('info', 'warning', 'severe')),
  message       text        not null check (length(message) between 3 and 280),
  active        boolean     not null default true,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  check ((from_station is null) = (to_station is null)),
  check (line_id is not null or from_station is null)
);
create index alerts_active_idx on metro.alerts (expires_at) where active;

create table metro.blocked_devices (
  device_id   uuid primary key,
  reason      text,
  created_at  timestamptz not null default now()
);

-- Short-lived copy of the combined answer, so a crowd of readers costs one query.
create table metro.live_cache (
  key           text primary key,             -- '*' = the whole network
  payload       jsonb       not null,
  generated_at  timestamptz not null,           -- when the data was read (start of the build)
  build_ms      integer,
  dirty_since   timestamptz                     -- an admin change after this time is not in the copy yet
);
alter table metro.live_cache set (autovacuum_vacuum_scale_factor = 0, autovacuum_vacuum_threshold = 50);

create table metro.housekeeping (
  only_row       boolean primary key default true check (only_row),
  last_purge_at  timestamptz not null default now()
);
insert into metro.housekeeping default values;

-- Second line of defence: row level security on, with no policies, so even a
-- mistaken grant on this schema would expose no rows.
alter table metro.network_meta     enable row level security;
alter table metro.lines            enable row level security;
alter table metro.stations         enable row level security;
alter table metro.routes           enable row level security;
alter table metro.route_stops      enable row level security;
alter table metro.line_stations    enable row level security;
alter table metro.line_paths       enable row level security;
alter table metro.devices          enable row level security;
alter table metro.reports          enable row level security;
alter table metro.alerts           enable row level security;
alter table metro.blocked_devices  enable row level security;
alter table metro.live_cache       enable row level security;
alter table metro.housekeeping     enable row level security;

-- ---------- Tunables --------------------------------------------------------

create function metro.cfg(key text) returns numeric
language sql immutable as $$
  select case key
    when 'max_age_s'              then 600   -- oldest observation accepted (offline queue); same as the live window
    when 'rate_window_s'          then 600   -- per-device rate-limit window
    when 'rate_max'               then 30    -- reports per device per window
    when 'rate_minute_max'        then 10    -- reports per device per minute
    when 'global_rate_max'        then 6000  -- reports per minute from everyone; above this = flood
    when 'untrusted_rate_max'     then 1500  -- reports per minute from new devices together; they cannot crowd out the rest
    when 'repeat_window_s'        then 60    -- same device, station, direction, kind within this = double tap
    when 'min_hop_s'              then 45    -- fastest believable time between neighbouring stations
    when 'cross_line_min_s'       then 120   -- fastest believable jump between unconnected stations
    when 'max_speed_mps'          then 25    -- 90 km/h: fastest believable straight-line travel between stations
    when 'live_window_s'          then 600   -- observations used for the live state
    when 'decay_half_life_s'      then 120   -- an observation's weight halves every 2 minutes
    when 'trusted_device_age_s'   then 86400 -- a report counts fully only if its device was first seen a day before it
    when 'untrusted_weight'       then 0.5   -- a newer device counts as half a rider
    when 'stuck_min_weight'       then 3     -- riders (trusted = 1, new = 0.5) needed for a public warning
    when 'stuck_hold_s'           then 1200  -- a rider's "stuck" stands this long unless they say otherwise
    when 'stuck_lookback_s'       then 1800  -- how far back a stoppage's start is traced
    when 'contradict_min'         then 4     -- trusted riders on later departures needed to call a warning wrong ...
    when 'contradict_ratio'       then 2     -- ... and at least this many times the riders saying stuck ...
    when 'contradict_window_s'    then 300   -- ... all within the last 5 minutes
    when 'cache_ttl_s'            then 5     -- a stored copy younger than this is served as current
    when 'stale_after_s'          then 60    -- older than this, answers carry "stale": true
    when 'reader_rebuild_after_s' then 30    -- with pg_cron refreshing, readers rebuild only if the copy is this old
    when 'purge_every_s'          then 60
    when 'purge_batch'            then 5000
    when 'purge_batch_inline'     then 2000  -- smaller batch when tidy-up rides along with a rider's request
    when 'max_stations'           then 600
    when 'retention_h'            then 24
  end::numeric
$$;

-- ---------- Network helpers -------------------------------------------------

-- The next station for a train at p_station heading for p_towards on p_line.
--   * p_towards may be the destination on the train or just the next station.
--   * A train ARRIVING where it ends (a terminus or a turn-back station) may
--     give that station itself; the answer is then the station ("ends here").
--   * Null when there is no way there on this line, or two equally short ways
--     (the far side of a ring): the rider must name a nearer station.
--   * When one route holds both stations, its order decides (that is how
--     trains are signed: on the Pink ring a train for Shiv Vihar runs the
--     original way round even where the new arc would be shorter).
--   * Otherwise the shortest way on the line decides.
create function metro.resolve_next(p_line text, p_station text, p_towards text, p_arrived boolean default false)
returns text
language sql stable security definer set search_path = metro, pg_temp as $$
  select case
    when p_station = p_towards then
      (select ls.station_id from line_stations ls
       where p_arrived and ls.line_id = p_line and ls.station_id = p_station and ls.can_terminate)
    else coalesce(
      (select min(c.station_id) from routes r
       join route_stops a on a.route_id = r.id and a.station_id = p_station
       join route_stops b on b.route_id = r.id and b.station_id = p_towards
       join route_stops c on c.route_id = r.id and c.seq = a.seq + sign(b.seq - a.seq)::int
       where r.line_id = p_line and r.active
       having count(distinct c.station_id) = 1),
      (select min(lp.next_id) from line_paths lp
       where lp.line_id = p_line and lp.from_id = p_station and lp.to_id = p_towards
       having count(*) = 1)
       -- different routes disagreeing, or a true tie on a ring, gives null: ambiguous
       -- (the route lookup returns null when its routes disagree; the path lookup then decides)
    )
  end
$$;

-- Fewest stops between two stations of a line; null if they are not connected.
create function metro.hops_between(p_line text, p_a text, p_b text)
returns integer
language sql stable security definer set search_path = metro, pg_temp as $$
  select case when p_a = p_b then 0 else
    (select min(lp.hops) from line_paths lp
     where lp.line_id = p_line and lp.from_id = p_a and lp.to_id = p_b) end
$$;

-- ---------- apply_network (admin) -------------------------------------------
-- Replaces the whole network in one transaction. Anything wrong in the input
-- raises an error and leaves the old network untouched. Stations and lines
-- that disappear are switched off, never deleted. Stored rider reports are
-- cleared, because their directions were worked out against the old network.
-- A ring is given as two routes that share both end stations.

create function public.apply_network(p jsonb)
returns jsonb
language plpgsql security definer set search_path = metro, pg_temp as $$
declare
  v_bad text;
  v_k   integer := 1;
  v_n   integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('dmr_network', 0));

  if jsonb_typeof(p) is distinct from 'object'
     or jsonb_typeof(p->'lines')    is distinct from 'array'
     or jsonb_typeof(p->'stations') is distinct from 'array'
     or jsonb_typeof(p->'routes')   is distinct from 'array'
     or jsonb_typeof(coalesce(p->'turnbacks', '[]'::jsonb)) is distinct from 'array'
     or jsonb_typeof(p->'version') is distinct from 'string'
     or p->>'version' !~ '^[A-Za-z0-9._-]{1,64}$' then
    raise exception 'network: need version, lines[], stations[], routes[]';
  end if;
  if jsonb_array_length(p->'lines') not between 1 and 50
     or jsonb_array_length(p->'stations') not between 2 and cfg('max_stations')
     or jsonb_array_length(p->'routes') not between 1 and 200 then
    raise exception 'network: size out of range';
  end if;

  -- ids and names must be JSON strings, coordinates JSON numbers (or absent)
  if exists (select 1 from jsonb_array_elements((p->'lines') || (p->'stations') || (p->'routes')) x
             where jsonb_typeof(x) is distinct from 'object'
                or jsonb_typeof(x->'id') is distinct from 'string'
                or jsonb_typeof(x->'name') is distinct from 'string') then
    raise exception 'network: every line, station and route needs a text id and name';
  end if;
  if exists (select 1 from jsonb_array_elements(p->'stations') x
             where coalesce(jsonb_typeof(x->'lat'), 'null') not in ('number', 'null')
                or coalesce(jsonb_typeof(x->'lon'), 'null') not in ('number', 'null')
                or coalesce(jsonb_typeof(x->'lat'), 'null') <> coalesce(jsonb_typeof(x->'lon'), 'null')) then
    raise exception 'network: lat and lon must both be numbers, or both be left out';
  end if;
  if exists (select 1 from jsonb_array_elements(p->'stations') x
             where x ? 'aliases' and (jsonb_typeof(x->'aliases') <> 'array'
                or jsonb_array_length(x->'aliases') > 10
                or exists (select 1 from jsonb_array_elements(x->'aliases') a
                           where jsonb_typeof(a) <> 'string' or length(a #>> '{}') not between 1 and 120))) then
    raise exception 'network: aliases must be a list of up to 10 names';
  end if;
  if exists (select 1 from jsonb_array_elements(p->'routes') x
             where jsonb_typeof(x->'stops') is distinct from 'array'
                or jsonb_typeof(x->'line') is distinct from 'string') then
    raise exception 'network: every route needs a line and a stops[] list of station ids';
  end if;
  if exists (select 1 from jsonb_array_elements(p->'routes') x, jsonb_array_elements(x->'stops') s
             where jsonb_typeof(s) <> 'string') then
    raise exception 'network: every route needs a line and a stops[] list of station ids';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p->'turnbacks', '[]'::jsonb)) x
             where jsonb_typeof(x) is distinct from 'object'
                or jsonb_typeof(x->'line') is distinct from 'string'
                or jsonb_typeof(x->'station') is distinct from 'string') then
    raise exception 'network: every turnback needs a line and a station';
  end if;

  -- the same network again changes nothing (and keeps riders' reports)
  if (select version from network_meta) = p->>'version' then
    return jsonb_build_object('ok', true, 'status', 'unchanged', 'version', p->>'version');
  end if;

  drop table if exists pg_temp._l, pg_temp._s, pg_temp._r, pg_temp._rs, pg_temp._t, pg_temp._adj, pg_temp._path;
  create temp table _l on commit drop as
    select x->>'id' as id, trim(x->>'name') as name from jsonb_array_elements(p->'lines') x;
  create temp table _s on commit drop as
    select x->>'id' as id, trim(x->>'name') as name,
           coalesce((select array_agg(a) from jsonb_array_elements_text(
                       case when jsonb_typeof(x->'aliases') = 'array' then x->'aliases' else '[]'::jsonb end) a), '{}') as aliases,
           (x->>'lat')::double precision as lat, (x->>'lon')::double precision as lon
    from jsonb_array_elements(p->'stations') x;
  create temp table _r on commit drop as
    select x->>'id' as id, x->>'line' as line, trim(x->>'name') as name, x->'stops' as stops
    from jsonb_array_elements(p->'routes') x;
  create temp table _rs on commit drop as
    select r.id as route_id, r.line, (s.ord - 1)::int as seq, s.station_id
    from _r r, jsonb_array_elements_text(r.stops) with ordinality as s(station_id, ord);
  create temp table _t on commit drop as
    select distinct x->>'line' as line, x->>'station' as station
    from jsonb_array_elements(coalesce(p->'turnbacks', '[]'::jsonb)) x;

  select string_agg(left(id, 40), ', ') into v_bad from (
    select id from _l where id !~ '^[a-z0-9_]{1,64}$' or length(name) not between 1 and 120
    union all select id from _s where id !~ '^[a-z0-9_]{1,64}$' or length(name) not between 1 and 120
    union all select id from _r where id !~ '^[a-z0-9_]{1,64}$' or length(name) not between 1 and 200
  ) q;
  if v_bad is not null then raise exception 'network: bad id or name: %', v_bad; end if;

  select string_agg(id, ', ') into v_bad from (
    select id from _l group by id having count(*) > 1
    union all select id from _s group by id having count(*) > 1
    union all select id from _r group by id having count(*) > 1) q;
  if v_bad is not null then raise exception 'network: duplicate id: %', v_bad; end if;

  select string_agg(id, ', ') into v_bad from _s
  where lat not between -90 and 90 or lon not between -180 and 180;
  if v_bad is not null then raise exception 'network: bad coordinates: %', v_bad; end if;

  select string_agg(id, ', ') into v_bad from _r where line not in (select id from _l);
  if v_bad is not null then raise exception 'network: route on unknown line: %', v_bad; end if;

  select string_agg(distinct route_id, ', ') into v_bad from _rs
  where station_id not in (select id from _s);
  if v_bad is not null then raise exception 'network: route uses unknown station: %', v_bad; end if;

  select string_agg(id, ', ') into v_bad from _r r
  where (select count(*) from _rs where route_id = r.id) < 2;
  if v_bad is not null then raise exception 'network: route needs at least 2 stops: %', v_bad; end if;

  select string_agg(distinct route_id, ', ') into v_bad from (
    select route_id from _rs group by route_id, station_id having count(*) > 1) q;
  if v_bad is not null then raise exception 'network: station repeated in route (give a ring as two routes): %', v_bad; end if;

  select string_agg(id, ', ') into v_bad from _l l where not exists (select 1 from _r where line = l.id);
  if v_bad is not null then raise exception 'network: line without a route: %', v_bad; end if;

  select string_agg(line || ':' || station, ', ') into v_bad from _t t
  where not exists (select 1 from _rs where line = t.line and station_id = t.station);
  if v_bad is not null then raise exception 'network: turnback not on its line: %', v_bad; end if;

  -- which stations are next to each other on each line, then the shortest way
  -- between every pair, found by stepping outwards one stop at a time
  create temp table _adj on commit drop as
    select distinct a.line, a.station_id as a, b.station_id as b
    from _rs a join _rs b on b.route_id = a.route_id and abs(b.seq - a.seq) = 1;
  create index on _adj (line, a);
  analyze _adj;
  create temp table _path (line text, src text, dst text, hops int, first text, primary key (line, src, dst, first)) on commit drop;
  create index on _path (hops);
  insert into _path select line, a, b, 1, b from _adj;
  loop
    analyze _path;
    insert into _path
    select distinct p.line, p.src, e.b, v_k + 1, p.first
    from _path p join _adj e on e.line = p.line and e.a = p.dst
    where p.hops = v_k and e.b <> p.src
      and not exists (select 1 from _path q where q.line = p.line and q.src = p.src and q.dst = e.b and q.hops <= v_k);
    get diagnostics v_n = row_count;
    exit when v_n = 0;
    v_k := v_k + 1;
    if v_k > cfg('max_stations') then raise exception 'network: path search did not finish'; end if;
  end loop;

  -- apply
  insert into lines (id, name, active) select id, name, true from _l
    on conflict (id) do update set name = excluded.name, active = true;
  update lines set active = false where active and id not in (select id from _l);

  insert into stations (id, name, aliases, lat, lon, active) select id, name, aliases, lat, lon, true from _s
    on conflict (id) do update set name = excluded.name, aliases = excluded.aliases,
                                   lat = excluded.lat, lon = excluded.lon, active = true;
  update stations set active = false where active and id not in (select id from _s);

  insert into routes (id, line_id, name, active) select id, line, name, true from _r
    on conflict (id) do update set line_id = excluded.line_id, name = excluded.name, active = true;
  update routes set active = false where active and id not in (select id from _r);

  delete from route_stops;
  insert into route_stops (route_id, seq, station_id) select route_id, seq, station_id from _rs;

  delete from line_paths;
  insert into line_paths (line_id, from_id, to_id, hops, next_id) select line, src, dst, hops, first from _path;

  delete from line_stations;
  insert into line_stations (line_id, station_id, can_terminate, neighbours)
  select q.line, q.station_id,
         q.is_end or exists (select 1 from _t t where t.line = q.line and t.station = q.station_id),
         (select count(*) from _adj e where e.line = q.line and e.a = q.station_id)
  from (select rs.line, rs.station_id,
               bool_or(rs.seq = 0 or rs.seq = (select max(seq) from _rs m where m.route_id = rs.route_id)) as is_end
        from _rs rs group by rs.line, rs.station_id) q;

  delete from reports;
  update network_meta set version = p->>'version', applied_at = now(), snapshot = jsonb_build_object(
    'ok', true, 'version', p->>'version',
    'lines', (select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by id) from _l),
    'stations', (select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'aliases', to_jsonb(aliases), 'lat', lat, 'lon', lon) order by id) from _s),
    'routes', (select jsonb_agg(jsonb_build_object('id', r.id, 'line', r.line, 'name', r.name,
                 'stops', (select jsonb_agg(station_id order by seq) from _rs where route_id = r.id)) order by r.id) from _r r),
    'destinations', (select jsonb_agg(jsonb_build_object('line', line_id, 'station', station_id) order by line_id, station_id)
                     from line_stations where can_terminate));
  perform mark_dirty();

  return jsonb_build_object('ok', true, 'version', p->>'version',
    'lines', (select count(*) from _l), 'stations', (select count(*) from _s), 'routes', (select count(*) from _r));
end;
$$;

-- The current network, for clients that want the server's ids and names.
create function public.get_network()
returns jsonb
language sql stable security definer set search_path = metro, pg_temp as $$
  select snapshot from network_meta
$$;

-- ---------- Retention -------------------------------------------------------
-- Deletes day-old reports in batches. Only one purge runs at a time; a second
-- caller returns at once, so a scheduled purge and one started by a reader
-- can never wait on each other.

create function public.purge_old_reports(p_max_batches integer default 1, p_batch integer default null)
returns integer
language plpgsql security definer set search_path = metro, pg_temp as $$
declare
  n     integer;
  total integer := 0;
  v_b   integer := least(greatest(coalesce(p_batch, cfg('purge_batch')::int), 1), 50000);
begin
  if not pg_try_advisory_xact_lock(hashtextextended('dmr_purge', 0)) then
    return 0;
  end if;
  for i in 1 .. least(greatest(coalesce(p_max_batches, 1), 1), 1000) loop
    delete from reports where (device_id, id) in (
      select device_id, id from reports
      where received_at < now() - make_interval(hours => cfg('retention_h')::int)
      order by received_at
      limit v_b);
    get diagnostics n = row_count;
    total := total + n;
    exit when n < v_b;
  end loop;
  update alerts set active = false where active and expires_at < now();
  delete from alerts where not active and expires_at < now() - interval '30 days';
  for i in 1 .. least(greatest(coalesce(p_max_batches, 1), 1), 1000) loop
    delete from devices where device_id in (
      select d.device_id from devices d
      where d.last_seen < now() - interval '180 days'
        and not exists (select 1 from blocked_devices b where b.device_id = d.device_id)
      limit v_b);
    get diagnostics n = row_count;
    exit when n < v_b;
  end loop;
  delete from live_cache where key <> '*';
  update housekeeping set last_purge_at = now();
  return total;
end;
$$;

-- Runs one purge batch if none has run for a while. Called from the public
-- functions so tidy-up happens even when no scheduler is installed. Never raises.
create function metro.maybe_purge()
returns void
language plpgsql security definer set search_path = metro, pg_temp as $$
begin
  if exists (select 1 from housekeeping
             where last_purge_at < now() - make_interval(secs => cfg('purge_every_s')::double precision)) then
    perform public.purge_old_reports(1, cfg('purge_batch_inline')::int);
  end if;
exception when others then
  null;
end;
$$;

-- Schedules the purge every 10 minutes and the live copy every 10 seconds.
-- Needs the pg_cron extension (1.5 or later for second-level schedules).
create function public.schedule_purge()
returns jsonb
language plpgsql security definer set search_path = metro, pg_temp as $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return jsonb_build_object('ok', false, 'status', 'pg_cron_not_enabled');
  end if;
  perform cron.schedule('dmr-purge-old-reports', '*/10 * * * *', 'select public.purge_old_reports(200, 5000)');
  begin
    perform cron.schedule('dmr-refresh-live-state', '10 seconds', 'select public.refresh_live_state()');
  exception when others then   -- pg_cron before 1.5 has no second-level schedules
    perform cron.schedule('dmr-refresh-live-state', '* * * * *', 'select public.refresh_live_state()');
  end;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- submit_report ---------------------------------------------------
-- p_age_s = how many seconds ago the rider saw it, measured on the phone.
-- Sending an age instead of a clock time means a wrong phone clock cannot
-- shift the observation, and a report queued offline keeps its true time.

create function public.submit_report(
  p_id       uuid,
  p_line     text,
  p_station  text,
  p_towards  text,
  p_kind     text,
  p_age_s    numeric default 0
) returns jsonb
language plpgsql security definer set search_path = metro, pg_temp as $$
declare
  v_device uuid := auth.uid();
  v_now    timestamptz := clock_timestamp();
  v_obs    timestamptz;
  v_kind   metro.report_kind;
  v_next   text;
  v_prev   record;
  v_hops   integer;
  v_gap    numeric;
  v_min    integer;
  v_win    integer;
  v_trust  boolean;
  v_lat    double precision;
  v_lon    double precision;
begin
  if v_device is null then
    return jsonb_build_object('ok', false, 'status', 'unauthenticated');
  end if;
  if p_id is null then
    return jsonb_build_object('ok', false, 'status', 'missing_id');
  end if;
  if p_kind is null or p_kind not in ('departed', 'arrived', 'stuck', 'cleared') then
    return jsonb_build_object('ok', false, 'status', 'bad_kind');
  end if;
  v_kind := p_kind::metro.report_kind;

  -- written this way so null, NaN and infinities are rejected too
  if p_age_s is null or not (p_age_s >= 0 and p_age_s <= cfg('max_age_s')) then
    return jsonb_build_object('ok', false, 'status', 'bad_time');
  end if;
  v_obs := v_now - make_interval(secs => round(p_age_s, 3)::double precision);

  if p_line is null or p_station is null or not exists (
       select 1 from line_stations ls
       join lines l on l.id = ls.line_id and l.active
       join stations s on s.id = ls.station_id and s.active
       where ls.line_id = p_line and ls.station_id = p_station) then
    return jsonb_build_object('ok', false, 'status', 'bad_station');
  end if;

  v_next := resolve_next(p_line, p_station, p_towards, v_kind = 'arrived');
  if v_next is null then
    return jsonb_build_object('ok', false, 'status', 'bad_towards');
  end if;

  if exists (select 1 from blocked_devices where device_id = v_device) then
    return jsonb_build_object('ok', true, 'status', 'accepted');   -- quietly dropped
  end if;

  -- one report at a time per device, so the limits below cannot be raced
  if not pg_try_advisory_xact_lock(hashtextextended('dmr_dev:' || v_device::text, 0)) then
    return jsonb_build_object('ok', false, 'status', 'busy');
  end if;

  -- the same report id sent twice by this device (offline queue resend) is ignored
  if exists (select 1 from reports where device_id = v_device and id = p_id) then
    return jsonb_build_object('ok', true, 'status', 'duplicate');
  end if;

  select count(*) filter (where received_at > v_now - interval '60 seconds'), count(*)
    into v_min, v_win
  from reports
  where device_id = v_device
    and received_at > v_now - make_interval(secs => cfg('rate_window_s')::double precision);
  if v_min >= cfg('rate_minute_max') or v_win >= cfg('rate_max') then
    return jsonb_build_object('ok', false, 'status', 'rate_limited');
  end if;

  -- flood limits: one for everyone, and a smaller shared one for new devices,
  -- so a crowd of fresh accounts cannot lock out established riders
  select coalesce(bool_or(first_seen <= v_now - make_interval(secs => cfg('trusted_device_age_s')::double precision)), false)
    into v_trust from devices where device_id = v_device;
  if ((select count(*) from reports
       where received_at > v_now - interval '60 seconds') >= cfg('global_rate_max')
      -- an established rider who has not reported for 2 minutes always gets through,
      -- so a crowd of busy accounts cannot shut everyone out
      and not (v_trust and not exists (select 1 from reports where device_id = v_device
                                       and received_at > v_now - interval '2 minutes')
               -- ... up to twice the cap overall, so the bypass itself stays bounded
               and (select count(*) from reports where received_at > v_now - interval '60 seconds') < 2 * cfg('global_rate_max')))
     or (not v_trust and (select count(*) from reports r join devices d on d.device_id = r.device_id
                          where r.received_at > v_now - interval '60 seconds'
                            and d.first_seen > v_now - make_interval(secs => cfg('trusted_device_age_s')::double precision))
                         >= cfg('untrusted_rate_max')) then
    return jsonb_build_object('ok', false, 'status', 'busy');
  end if;

  if exists (
      select 1 from reports
      where device_id = v_device and line_id = p_line and station_id = p_station
        and next_id = v_next and kind = v_kind
        and abs(extract(epoch from (observed_at - v_obs))) < cfg('repeat_window_s')) then
    return jsonb_build_object('ok', true, 'status', 'duplicate');
  end if;

  -- nobody is at two far-apart stations within seconds
  select lat, lon into v_lat, v_lon from stations where id = p_station;
  for v_prev in
    select r.line_id, r.station_id, r.observed_at, s.lat, s.lon from reports r
    join stations s on s.id = r.station_id
    where r.device_id = v_device
      and r.received_at > v_now - make_interval(secs => cfg('rate_window_s')::double precision)
      and r.station_id <> p_station
  loop
    v_gap  := abs(extract(epoch from (v_obs - v_prev.observed_at)));
    v_hops := case when v_prev.line_id = p_line then hops_between(p_line, v_prev.station_id, p_station) end;
    if v_gap < coalesce(v_hops * cfg('min_hop_s'),
                        greatest(cfg('cross_line_min_s'),
                                 -- straight-line distance at 90 km/h, when both stations have coordinates
                                 sqrt(power((v_lat - v_prev.lat) * 111000, 2) + power((v_lon - v_prev.lon) * 97500, 2)) / cfg('max_speed_mps'),
                                 0)) then
      return jsonb_build_object('ok', false, 'status', 'implausible');
    end if;
  end loop;

  insert into reports (device_id, id, line_id, station_id, towards_id, next_id, kind, observed_at, received_at, established)
  values (v_device, p_id, p_line, p_station, p_towards, v_next, v_kind, v_obs, v_now,
          coalesce((select first_seen <= v_obs - make_interval(secs => cfg('trusted_device_age_s')::double precision)
                    from devices where device_id = v_device), false))
  on conflict (device_id, id) do nothing;
  if not found then
    return jsonb_build_object('ok', true, 'status', 'duplicate');
  end if;

  insert into devices (device_id, first_seen, last_seen, accepted)
  values (v_device, v_now, v_now, 1)
  on conflict (device_id) do update set last_seen = excluded.last_seen, accepted = devices.accepted + 1;

  perform maybe_purge();
  return jsonb_build_object('ok', true, 'status', 'accepted');
end;
$$;

-- ---------- build_live_state (internal) -------------------------------------
-- Builds the answer for the whole network in one pass. Every per-device step
-- works over the whole network first and only then is split by line, so a
-- single-line answer always agrees with the whole-network one.
--
-- Observations (departed / arrived)
--   Each device speaks for one train: only its latest "departed" and its latest
--   "arrived" count, and their weight fades with age. "high" confidence needs
--   three established devices.
--
-- "Stuck" warnings
--   * A device has ONE current word: its latest report anywhere. It is "stuck
--     at place P" (line + station + next station) only while that latest word
--     is "stuck" at P, for up to 20 minutes. Saying anything else, anywhere,
--     withdraws it, so one device cannot hold up warnings in several places.
--   * A report counts fully only if its device was first seen at least a day
--     earlier ("established"); otherwise it counts as half a rider.
--   * Places on one stretch of track (consecutive, same way, each with an
--     established rider) are taken together, since riders on one held train
--     name neighbouring stations. A stretch shows one warning, at its place
--     with most established riders, once its riders add up to 3; "confirmed"
--     when 3 or more are established.
--   * Only the riders who said stuck can take their word back. Departures by
--     other trains do not cancel a warning, except where every place of the
--     stretch is a plain through station: there, clearly more established
--     riders (at least 4, and twice the riders saying stuck) leaving the same
--     way after the stoppage began, within the last 5 minutes, show it moving.
--   * The stoppage began at the first "stuck" its current riders gave there in
--     the last 30 minutes, ignoring any "cleared" in between, so flipping to
--     "cleared" and back cannot make later departures stop counting.

create function metro.build_live_state()
returns jsonb
language sql stable security definer
set search_path = metro, pg_temp
set jit = off
set enable_nestloop = off
set work_mem = '64MB'
as $$
  with params as (
    select now() as t,
           cfg('live_window_s')::double precision        as win,
           cfg('stuck_lookback_s')::double precision     as look,
           cfg('stuck_hold_s')::double precision         as hold,
           cfg('decay_half_life_s')::double precision    as half,
           cfg('trusted_device_age_s')::double precision as trust_age,
           cfg('untrusted_weight')                       as uw,
           cfg('stuck_min_weight')                       as need,
           cfg('contradict_min')                         as cmin,
           cfg('contradict_ratio')                       as cratio,
           cfg('contradict_window_s')::double precision  as cwin
  ),
  rep as (           -- every usable report from the last 30 minutes
    select r.device_id, r.line_id, r.station_id, r.towards_id, r.next_id, r.kind, r.observed_at,
           r.established as trusted
    from reports r
    join lines l on l.id = r.line_id and l.active
    join stations s on s.id = r.station_id and s.active,
    params p
    where r.observed_at > p.t - make_interval(secs => p.look)
      and not exists (select 1 from blocked_devices b where b.device_id = r.device_id)
  ),
  -- observations
  latest as (
    select distinct on (r.device_id, r.kind)
           r.device_id, r.line_id, r.station_id, r.towards_id, r.next_id, r.kind, r.observed_at, r.trusted
    from rep r, params p
    where r.kind in ('departed', 'arrived') and r.observed_at > p.t - make_interval(secs => p.win)
    order by r.device_id, r.kind, r.observed_at desc
  ),
  obs as (
    select l.line_id, l.station_id, l.towards_id, l.next_id, l.kind,
           count(*) as devices,
           count(*) filter (where l.trusted) as trusted_devices,
           max(l.observed_at) as last_at,
           to_timestamp(percentile_cont(0.5) within group (order by extract(epoch from l.observed_at))) as typical_at,
           sum(power(0.5::double precision,
                     greatest(extract(epoch from (p.t - l.observed_at))::double precision, 0) / p.half)) as score
    from latest l, params p
    group by l.line_id, l.station_id, l.towards_id, l.next_id, l.kind
  ),
  -- stuck warnings
  cur as (           -- each device's one current word (latest report anywhere), with its first
                     -- "stuck" at that same place in the last 30 minutes, found in the same pass;
                     -- breaks are ignored, so flipping to "cleared" and back cannot move it later
    select * from (
      select r.*,
             row_number() over w_dev as rn,
             min(r.observed_at) filter (where r.kind = 'stuck')
               over (partition by r.device_id, r.line_id, r.station_id, r.next_id) as first_stuck
      from rep r
      window w_dev as (partition by r.device_id order by r.observed_at desc, r.kind desc)
    ) x
    where rn = 1
  ),
  stuck_now as (
    select c.device_id, c.line_id, c.station_id, c.next_id, c.observed_at, c.trusted, c.first_stuck
    from cur c, params p
    where c.kind = 'stuck' and c.observed_at > p.t - make_interval(secs => p.hold)
  ),
  place as (
    select row_number() over (order by s.line_id, s.station_id, s.next_id) as pid,
           s.line_id, s.station_id, s.next_id,
           sum(case when s.trusted then 1 else p.uw end) as weight,
           count(*) as devices,
           count(*) filter (where s.trusted) as trusted_devices,
           -- when the stoppage began: by established riders if there are any, so one new
           -- account cannot back-date it and make earlier normal departures count against it
           coalesce(min(s.first_stuck) filter (where s.trusted), min(s.first_stuck)) as since,
           max(s.observed_at) as last_at
    from stuck_now s, params p
    group by s.line_id, s.station_id, s.next_id, p.uw
  ),
  -- Two places belong to one stretch of track when a train can run straight
  -- through both (a -> b -> c, same way): either one route runs through them in
  -- order, or the middle station has just two neighbours on the line (so there
  -- is only one way on, as where the Pink ring's two routes join). Never across
  -- opposite directions or between branches at a junction. Only places with an
  -- established rider link up, so new accounts can neither join separate
  -- stoppages together nor attach themselves to a real one.
  edge as (
    select distinct p1.pid as a, p2.pid as b
    from place p1
    join place p2 on p2.line_id = p1.line_id and p2.station_id = p1.next_id and p2.next_id <> p1.station_id
    where p1.trusted_devices >= 1 and p2.trusted_devices >= 1
      and (exists (select 1 from routes r
                   join route_stops x on x.route_id = r.id and x.station_id = p1.station_id
                   join route_stops y on y.route_id = r.id and y.station_id = p1.next_id
                   join route_stops z on z.route_id = r.id and z.station_id = p2.next_id
                   where r.line_id = p1.line_id and r.active
                     and y.seq - x.seq in (1, -1) and z.seq - y.seq = y.seq - x.seq)
           or exists (select 1 from line_stations ls
                      where ls.line_id = p1.line_id and ls.station_id = p1.next_id and ls.neighbours = 2))
  ),
  link as (select a, b from edge union select b, a from edge),
  reach as (
    with recursive walk(src, dst) as (
      select pid, pid from place
      union
      select w.src, l.b from walk w join link l on l.a = w.dst
    )
    select src, min(dst) as cid from walk group by src
  ),
  cluster as (
    select r.cid,
           min(pl.line_id) as line_id,
           sum(pl.weight) as weight,
           sum(pl.devices) as devices,
           sum(pl.trusted_devices) as trusted_devices,
           coalesce(min(pl.since) filter (where pl.trusted_devices > 0), min(pl.since)) as since,
           max(pl.last_at) as last_at,
           jsonb_agg(pl.station_id order by pl.station_id) as stations,
           array_agg(pl.pid) as pids
    from place pl
    join reach r on r.src = pl.pid
    group by r.cid
  ),
  place_c as (
    select pl.*, r.cid,
           coalesce(ls.can_terminate or ls.neighbours > 2, true) as busy_platforms
    from place pl
    join reach r on r.src = pl.pid
    left join line_stations ls on ls.line_id = pl.line_id and ls.station_id = pl.station_id
  ),
  -- one warning per stretch, shown at its place with most established riders
  candidate as (
    select f.line_id, f.station_id, f.next_id, c.weight, c.devices, c.trusted_devices,
           c.since, c.last_at, f.busy_platforms, c.stations, c.pids
    from cluster c
    join lateral (select * from place_c q where q.cid = c.cid
                  order by q.trusted_devices desc, q.weight desc, q.since, q.station_id limit 1) f on true,
    params p
    where c.weight >= p.need
  ),
  movers as (        -- established riders, not stuck themselves, whose latest departure left one of the
                     -- warning's places the same way after the stoppage began, within the last 5 minutes
    select cd.station_id, cd.line_id, cd.next_id, count(distinct l.device_id) as n
    from candidate cd
    join place_c pc on pc.pid = any(cd.pids)
    join latest l on l.kind = 'departed' and l.trusted
                 and l.line_id = pc.line_id and l.station_id = pc.station_id and l.next_id = pc.next_id
                 and l.observed_at > cd.since,
    params p
    where l.observed_at > p.t - make_interval(secs => p.cwin)
      and not exists (select 1 from stuck_now s where s.device_id = l.device_id)
    group by cd.station_id, cd.line_id, cd.next_id
  ),
  rider_alerts as (
    select cd.line_id, jsonb_build_object(
             'source', 'riders', 'station', cd.station_id, 'next', cd.next_id, 'stations', cd.stations,
             'devices', cd.devices, 'established_devices', cd.trusted_devices,
             'confirmed', cd.trusted_devices >= p.need,
             'since', cd.since, 'last_observed_at', cd.last_at,
             'message', 'Riders report a train held at ' || st.name) as j
    from candidate cd
    join stations st on st.id = cd.station_id
    left join movers m on m.line_id = cd.line_id and m.station_id = cd.station_id and m.next_id = cd.next_id,
    params p
    -- at a plain through station, clearly more established traffic still leaving the same way means it is moving
    where not (not cd.busy_platforms
               and coalesce(m.n, 0) >= greatest(p.cmin, p.cratio * greatest(cd.trusted_devices, 1)))
  ),
  admin_alerts as (
    select a.line_id, a.created_at, jsonb_build_object(
             'source', 'admin', 'id', a.id, 'from', a.from_station, 'to', a.to_station,
             'severity', a.severity, 'message', a.message,
             'since', a.created_at, 'expires_at', a.expires_at) as j
    from alerts a, params p
    where a.active and a.expires_at > p.t
  ),
  per_line as (
    select li.id,
           coalesce((select jsonb_agg(jsonb_build_object(
                        'station', o.station_id, 'towards', o.towards_id, 'next', o.next_id, 'kind', o.kind,
                        'devices', o.devices, 'observed_at', o.typical_at, 'last_observed_at', o.last_at,
                        'score', round(o.score::numeric, 3),
                        'confidence', case when o.trusted_devices >= 3 and o.score >= 1.5 then 'high'
                                           when o.devices >= 2 and o.score >= 0.8 then 'medium'
                                           else 'low' end)
                      order by o.station_id, o.next_id, o.kind, o.towards_id)
                     from obs o where o.line_id = li.id), '[]'::jsonb) as observations,
           coalesce((select jsonb_agg(a.j order by a.created_at desc) from admin_alerts a where a.line_id = li.id), '[]'::jsonb)
           || coalesce((select jsonb_agg(r.j order by r.j->>'station', r.j->>'next') from rider_alerts r where r.line_id = li.id), '[]'::jsonb) as alerts
    from lines li
    where li.active
  )
  select jsonb_build_object(
    'ok', true,
    'version', 2,
    'network_version', (select version from network_meta),
    'server_time', (select t from params),
    'generated_at', (select t from params),
    'ttl_s', cfg('cache_ttl_s'),
    'window_s', cfg('live_window_s'),
    'lines', coalesce((select jsonb_object_agg(id, jsonb_build_object('observations', observations, 'alerts', alerts))
                       from per_line
                       where observations <> '[]'::jsonb or alerts <> '[]'::jsonb), '{}'::jsonb),
    'network_alerts', coalesce((select jsonb_agg(a.j order by a.created_at desc) from admin_alerts a where a.line_id is null), '[]'::jsonb)
  );
$$;

-- One line's view of a whole-network answer.
create function metro.line_view(p_all jsonb, p_line text)
returns jsonb
language sql immutable security definer set search_path = metro, pg_temp as $$
  select case when p_line is null then p_all
    else jsonb_set(p_all, '{lines}', jsonb_build_object(p_line,
           coalesce(p_all->'lines'->p_line, '{"observations": [], "alerts": []}'::jsonb))) end
$$;

-- ---------- refresh / get_live_state ----------------------------------------
-- One stored copy for the whole network; each line's answer is cut from it.
--
-- The copy is rebuilt by refresh_live_state(), which pg_cron runs every 10
-- seconds with no time limit. Readers never wait for a rebuild: at most one
-- reader at a time may rebuild in passing when the copy is out of date, and
-- if that cannot finish in time it still answers with the last copy. So a
-- crowd of readers, or a very busy network, can make answers late but never
-- makes them fail. Every answer says how old it is ("age_s"), and carries
-- "stale": true once older than a minute, so the website can fall back to the
-- timetable alone and say so.

-- Builds and stores a copy. Only stores it if it is newer than what is there
-- and was started after the last admin change, so a slow build that began
-- before a change cannot overwrite the change.
create function metro.store_build()
returns jsonb
language plpgsql security definer set search_path = metro, pg_temp as $$
declare
  v_t0  timestamptz := clock_timestamp();
  v_out jsonb := build_live_state();
begin
  insert into live_cache (key, payload, generated_at, build_ms)
  values ('*', v_out, v_t0, (extract(epoch from clock_timestamp() - v_t0) * 1000)::int)
  on conflict (key) do update set payload = excluded.payload, generated_at = excluded.generated_at, build_ms = excluded.build_ms
  where live_cache.generated_at < excluded.generated_at
    and coalesce(live_cache.dirty_since, '-infinity') < excluded.generated_at;
  update live_cache set dirty_since = null where key = '*' and dirty_since < v_t0;
  return v_out;
end;
$$;

-- Rebuilds the stored copy; this is what pg_cron runs. It waits up to 5 s for
-- a rebuild already under way, so readers rebuilding in passing can never
-- keep it out. Returns false if it could not get in.
create function public.refresh_live_state()
returns boolean
language plpgsql security definer
set search_path = metro, pg_temp
set jit = off
set lock_timeout = '5s'
as $$
begin
  begin
    perform pg_advisory_xact_lock(hashtextextended('dmr_cache', 0));
  exception when lock_not_available then
    return false;
  end;
  perform maybe_purge();
  perform store_build();
  return true;
end;
$$;

-- Marks the copy out of date after an admin change; the next refresh (or reader) rebuilds it.
create function metro.mark_dirty()
returns void
language sql security definer set search_path = metro, pg_temp as $$
  update live_cache set dirty_since = clock_timestamp() where key = '*'
$$;

-- One line's view of a stored copy, stamped with its age.
create function metro.answer(p_all jsonb, p_generated timestamptz, p_line text)
returns jsonb
language sql stable security definer set search_path = metro, pg_temp as $$
  select line_view(p_all, p_line)
         || jsonb_build_object('age_s', greatest(round(extract(epoch from now() - p_generated))::int, 0),
                               'stale', p_generated < now() - make_interval(secs => cfg('stale_after_s')::double precision))
$$;

create function public.get_live_state(p_line text default null)
returns jsonb
language plpgsql security definer
set search_path = metro, pg_temp
set jit = off
as $$
declare
  v_row   metro.live_cache%rowtype;
  v_out   jsonb;
  v_ro    boolean := current_setting('transaction_read_only') = 'on';
  v_have  boolean;
  v_cron  boolean := exists (select 1 from pg_extension where extname = 'pg_cron');
begin
  if p_line is not null and not exists (select 1 from lines where id = p_line and active) then
    return jsonb_build_object('ok', false, 'status', 'bad_line');
  end if;

  select * into v_row from live_cache where key = '*';
  v_have := found and v_row.generated_at > '-infinity';

  -- current enough: serve it
  if v_have and v_row.dirty_since is null
     and v_row.generated_at > now() - make_interval(secs => cfg('cache_ttl_s')::double precision) then
    return answer(v_row.payload, v_row.generated_at, p_line);
  end if;

  -- Rebuild in passing only when nobody else will soon: with pg_cron refreshing
  -- every 10 s, only if the copy is well overdue or an admin change is waiting;
  -- a read-only caller (an HTTP GET) only when there is no copy at all, since it
  -- cannot store what it builds. At most one reader at a time.
  if v_have and (v_ro or (v_cron and v_row.dirty_since is null
                          and v_row.generated_at > now() - make_interval(secs => cfg('reader_rebuild_after_s')::double precision))) then
    return answer(v_row.payload, v_row.generated_at, p_line);
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended('dmr_cache', 0)) then
    if v_have then return answer(v_row.payload, v_row.generated_at, p_line); end if;
    return jsonb_build_object('ok', true, 'status', 'warming', 'lines', '{}'::jsonb, 'network_alerts', '[]'::jsonb, 'stale', true);
  end if;

  begin
    if v_ro then
      v_out := build_live_state();
    else
      perform maybe_purge();
      v_out := store_build();
    end if;
    return answer(v_out, now(), p_line);
  exception when query_canceled or others then
    -- ran out of time, or could not store: the last copy is still an answer
    if v_have then return answer(v_row.payload, v_row.generated_at, p_line); end if;
    return jsonb_build_object('ok', true, 'status', 'warming', 'lines', '{}'::jsonb, 'network_alerts', '[]'::jsonb, 'stale', true);
  end;
end;
$$;

-- ---------- Admin: alerts, blocking, health ---------------------------------

create function public.admin_set_alert(
  p_line text, p_from text, p_to text, p_severity text, p_message text, p_minutes integer default 180
) returns jsonb
language plpgsql security definer set search_path = metro, pg_temp as $$
declare v_id bigint;
begin
  if p_severity is null or p_severity not in ('info', 'warning', 'severe') then
    return jsonb_build_object('ok', false, 'status', 'bad_severity');
  end if;
  if p_message is null or length(trim(p_message)) not between 3 and 280 then
    return jsonb_build_object('ok', false, 'status', 'bad_message');
  end if;
  if p_minutes is null or p_minutes not between 5 and 1440 then
    return jsonb_build_object('ok', false, 'status', 'bad_duration');
  end if;
  if p_line is not null and not exists (select 1 from lines where id = p_line and active) then
    return jsonb_build_object('ok', false, 'status', 'bad_line');
  end if;
  if (p_from is null) <> (p_to is null) or (p_line is null and p_from is not null) then
    return jsonb_build_object('ok', false, 'status', 'bad_range');
  end if;
  if p_from is not null and (p_from = p_to or hops_between(p_line, p_from, p_to) is null) then
    return jsonb_build_object('ok', false, 'status', 'bad_range');   -- both ends must be joined on this line
  end if;

  insert into alerts (line_id, from_station, to_station, severity, message, expires_at)
  values (p_line, p_from, p_to, p_severity, trim(p_message), now() + make_interval(mins => p_minutes))
  returning id into v_id;
  perform mark_dirty();
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create function public.admin_clear_alert(p_id bigint)
returns jsonb
language plpgsql security definer set search_path = metro, pg_temp as $$
begin
  update alerts set active = false where id = p_id and active;
  if not found then return jsonb_build_object('ok', false, 'status', 'not_found'); end if;
  perform mark_dirty();
  return jsonb_build_object('ok', true);
end;
$$;

create function public.admin_block_device(p_device uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = metro, pg_temp as $$
begin
  if p_device is null then return jsonb_build_object('ok', false, 'status', 'bad_device'); end if;
  insert into blocked_devices (device_id, reason) values (p_device, left(p_reason, 200))
  on conflict (device_id) do nothing;
  perform mark_dirty();
  return jsonb_build_object('ok', true);
end;
$$;

create function public.admin_unblock_device(p_device uuid)
returns jsonb
language plpgsql security definer set search_path = metro, pg_temp as $$
begin
  delete from blocked_devices where device_id = p_device;
  if not found then return jsonb_build_object('ok', false, 'status', 'not_found'); end if;
  perform mark_dirty();
  return jsonb_build_object('ok', true);
end;
$$;

create function public.get_health()
returns jsonb
language sql stable security definer set search_path = metro, pg_temp as $$
  select jsonb_build_object(
    'server_time',        now(),
    'network_version',    (select version from network_meta),
    'active_lines',       (select count(*) from lines where active),
    'active_stations',    (select count(*) from stations where active),
    'reports_5m',         (select count(*) from reports where received_at > now() - interval '5 minutes'),
    'reports_1h',         (select count(*) from reports where received_at > now() - interval '1 hour'),
    'devices_1h',         (select count(distinct device_id) from reports where received_at > now() - interval '1 hour'),
    'last_report_at',     (select max(received_at) from reports),
    'reports_stored',     (select count(*) from reports),
    'overdue_for_purge',  (select count(*) from reports where received_at < now() - make_interval(hours => cfg('retention_h')::int + 1)),
    'last_purge_at',      (select last_purge_at from housekeeping),
    'pg_cron_enabled',    exists (select 1 from pg_extension where extname = 'pg_cron'),
    'live_copy_age_s',    (select round(extract(epoch from now() - generated_at))::int from live_cache where key = '*' and generated_at > '-infinity'),
    'live_copy_build_ms', (select build_ms from live_cache where key = '*'),
    'active_alerts',      (select count(*) from alerts where active and expires_at > now()),
    'blocked_devices',    (select count(*) from blocked_devices)
  )
$$;

-- ---------- Who may call what -----------------------------------------------
-- Supabase gives new functions in public to anon and authenticated by default,
-- so take everything away and hand back only the public entry points.

revoke all on function
  public.apply_network(jsonb),
  public.get_network(),
  public.purge_old_reports(integer, integer),
  public.schedule_purge(),
  public.submit_report(uuid, text, text, text, text, numeric),
  public.get_live_state(text),
  public.refresh_live_state(),
  public.admin_set_alert(text, text, text, text, text, integer),
  public.admin_clear_alert(bigint),
  public.admin_block_device(uuid, text),
  public.admin_unblock_device(uuid),
  public.get_health()
from public, anon, authenticated;

revoke all on function
  metro.cfg(text),
  metro.resolve_next(text, text, text, boolean),
  metro.hops_between(text, text, text),
  metro.maybe_purge(),
  metro.build_live_state(),
  metro.line_view(jsonb, text),
  metro.answer(jsonb, timestamptz, text),
  metro.store_build(),
  metro.mark_dirty()
from public;

grant execute on function public.get_live_state(text), public.get_network() to anon, authenticated;
-- anon may call submit_report too, but only gets a clean "unauthenticated" answer back
grant execute on function public.submit_report(uuid, text, text, text, text, numeric) to anon, authenticated;

grant execute on function
  public.apply_network(jsonb),
  public.admin_set_alert(text, text, text, text, text, integer),
  public.admin_clear_alert(bigint),
  public.admin_block_device(uuid, text),
  public.admin_unblock_device(uuid),
  public.get_health(),
  public.purge_old_reports(integer, integer),
  public.refresh_live_state(),
  public.schedule_purge()
to service_role;

-- If pg_cron is already enabled, schedule the purge now. Otherwise enable it
-- later and run: select public.schedule_purge();
select public.schedule_purge();
