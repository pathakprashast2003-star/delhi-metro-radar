// Backend tests. Run:  npm test
//   With DATABASE_URL set they run on a real Postgres, including the parallel-request and load tests.
//   Without it they run on an embedded Postgres and skip those.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { openDb, install } from './db.mjs';

const db = await openDb();
let pass = 0, fail = 0, skipped = 0;
const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const section = (s) => console.log('\n' + s);
const network = JSON.parse(readFileSync(new URL('../data/network.json', import.meta.url), 'utf8'));

await install(db);

const submitRaw = async (dev, o = {}) => (await db.call(dev ? 'authenticated' : 'anon', dev,
  `select public.submit_report($1,$2,$3,$4,$5,$6) as r`,
  ['id' in o ? o.id : randomUUID(), 'line' in o ? o.line : 'yellow', 'station' in o ? o.station : 'rajiv_chowk',
   'towards' in o ? o.towards : 'millennium_city_centre', 'kind' in o ? o.kind : 'departed', 'age' in o ? o.age : 0]))[0].r;
const submit = async (dev, o) => (await submitRaw(dev, o)).status;
const stateCached = async (line = null, timeoutMs = 0) => (await db.call('anon', null, `select public.get_live_state($1) as s`, [line], timeoutMs))[0].s;
const state = async (line = null) => { await db.exec(`delete from live_cache`); return stateCached(line); };
const admin = async (sql, params = []) => (await db.call('service_role', null, sql, params))[0];
const applyNetwork = async (n) => admin(`select public.apply_network($1::jsonb) as r`, [JSON.stringify(n)]);
const reset = async () => db.exec(`delete from reports; delete from devices; delete from alerts; delete from blocked_devices; delete from live_cache;`);
const trustAll = async () => db.exec(`update devices set first_seen = now() - interval '2 days'; update reports set established = true`);
const threw = async (fn) => { try { await fn(); return null; } catch (e) { return e.message || String(e); } };
const obs = (s, line, f = () => true) => (s.lines[line]?.observations ?? []).filter(f);
const riderAlerts = (s, line) => (s.lines[line]?.alerts ?? []).filter((a) => a.source === 'riders');
const dev = () => randomUUID();
const devs = (n) => Array.from({ length: n }, dev);
const nextOf = async (o) => { const id = randomUUID(); const s = await submit(dev(), { ...o, id });
  return s === 'accepted' ? (await db.query(`select next_id from reports where id = $1`, [id]))[0].next_id : s; };
const count = async (sql, params = []) => (await db.query(`select count(*)::int n from ${sql}`, params))[0].n;

// ---------------------------------------------------------------------------
section('Network: whole system loaded, including sections opened since the old timetable file');
{
  const c = (await db.query(`select (select count(*)::int from lines where active) l, (select count(*)::int from stations where active) s,
                                    (select count(*)::int from routes where active) r, (select version from network_meta) v`))[0];
  ok(c.l === 11 && c.s === 276 && c.r === 15, '11 lines, 276 stations, 15 routes loaded', c);
  ok(c.v === network.version, 'network version recorded', c.v);
  const rc = (await db.query(`select array_agg(line_id order by line_id) a from line_stations where station_id = 'rajiv_chowk'`))[0].a;
  ok(rc.join() === 'blue,yellow', 'Rajiv Chowk is one station on two lines', rc);
  const mp = (await db.query(`select array_agg(line_id order by line_id) a from line_stations where station_id = 'majlis_park'`))[0].a;
  ok(mp.join() === 'magenta,pink', 'Majlis Park is on Pink and on the new Magenta section', mp);
  const t = (await db.query(`select array_agg(station_id order by station_id) a from line_stations where line_id = 'yellow' and can_terminate`))[0].a;
  ok(t.join() === 'millennium_city_centre,qutab_minar,samaypur_badli,vishwavidyalaya', 'Yellow destinations include the two short-turn stations', t);
  const net = (await db.call('anon', null, `select public.get_network() as n`))[0].n;
  ok(net.stations.length === 276 && net.routes.length === 15 && net.version === network.version && net.destinations.length > 20, 'get_network gives clients the same network', { s: net.stations?.length });
  ok(await count(`pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','v','m','S')`) === 0,
     'no table, view or sequence sits in the public (API-exposed) schema');
}

section('Network: directions on branches, the Pink ring and the split Magenta line');
{
  ok(await nextOf({ towards: 'millennium_city_centre' }) === 'patel_chowk', 'Yellow at Rajiv Chowk towards Millennium City Centre: next is Patel Chowk');
  ok(await nextOf({ towards: 'samaypur_badli' }) === 'new_delhi', 'towards Samaypur Badli: next is New Delhi');
  ok(await nextOf({ towards: 'qutab_minar' }) === 'patel_chowk', 'a short-turn destination gives the same direction');
  ok(await nextOf({ towards: 'patel_chowk' }) === 'patel_chowk', 'naming just the next station works too');
  ok(await nextOf({ line: 'blue', towards: 'vaishali' }) === 'barakhamba'
     && await nextOf({ line: 'blue', towards: 'noida_electronic_city' }) === 'barakhamba', 'Blue trunk: Vaishali and Noida trains leave the same way');
  ok(await nextOf({ line: 'blue', station: 'yamuna_bank', towards: 'vaishali' }) === 'laxmi_nagar'
     && await nextOf({ line: 'blue', station: 'yamuna_bank', towards: 'noida_electronic_city' }) === 'akshardham', 'at the junction the two branches split');
  ok(await nextOf({ line: 'blue', station: 'laxmi_nagar', towards: 'noida_electronic_city' }) === 'yamuna_bank', 'branch to branch goes back through the junction');
  ok(await nextOf({ line: 'green', station: 'punjabi_bagh', towards: 'inderlok' }) === 'ashok_park_main'
     && await nextOf({ line: 'green', station: 'punjabi_bagh', towards: 'kirti_nagar' }) === 'ashok_park_main', 'Green: both branch ends leave the trunk the same way');
  ok(await nextOf({ line: 'aqua', station: 'noida_sector_76', towards: 'depot_station' }) !== 'bad_towards', 'Aqua runs through from Sector 51 side to Depot');
  ok(await nextOf({ line: 'magenta', station: 'janak_puri_west', towards: 'krishna_park_extension' }) === 'krishna_park_extension', 'Magenta now runs to Krishna Park Extension');
  ok(await nextOf({ line: 'magenta', station: 'bhalaswa', towards: 'deepali_chowk' }) === 'haiderpur_badli_mor', 'new Magenta section Majlis Park to Deepali Chowk works');
  ok(await nextOf({ line: 'magenta', station: 'janak_puri_west', towards: 'deepali_chowk' }) === 'bad_towards', 'the two Magenta sections are not joined yet');
  ok(await nextOf({ line: 'airport', station: 'dwarka_sector_21', towards: 'yashobhoomi_dwarka_sector_25' }) === 'yashobhoomi_dwarka_sector_25', 'Airport line reaches Yashobhoomi Dwarka Sector 25');
  ok(await nextOf({ line: 'pink', station: 'majlis_park', towards: 'burari' }) === 'burari'
     && await nextOf({ line: 'pink', station: 'majlis_park', towards: 'azadpur' }) === 'azadpur', 'Pink ring: both ways out of Majlis Park exist');
  ok(await nextOf({ line: 'pink', station: 'welcome', towards: 'shiv_vihar' }) === 'jafrabad', 'Pink towards Shiv Vihar takes the branch at Maujpur');
  ok(await nextOf({ line: 'pink', station: 'yamuna_vihar', towards: 'majlis_park' }) === 'bhajanpura', 'the new arc heads to Majlis Park the short way');
  ok(await nextOf({ line: 'pink', station: 'azadpur', towards: 'shiv_vihar' }) === 'shalimar_bagh', 'a Shiv Vihar train at Azadpur runs the original way round, not backwards');
  ok(await nextOf({ line: 'pink', station: 'bhikaji_cama_place', towards: 'shiv_vihar' }) === 'sarojini_nagar'
     && await nextOf({ line: 'pink', station: 'mayur_vihar_i', towards: 'majlis_park' }) !== 'bad_towards', 'destinations that are equally far both ways round still resolve by route');
  const amb = (await db.query(`select lp.from_id, lp.to_id from line_paths lp where lp.line_id = 'pink' group by 1, 2 having count(*) > 1
      and not exists (select 1 from route_stops a join route_stops b on b.route_id = a.route_id where a.station_id = lp.from_id and b.station_id = lp.to_id) limit 1`))[0];
  if (amb) ok(await nextOf({ line: 'pink', station: amb.from_id, towards: amb.to_id }) === 'bad_towards', 'a true tie with no route to decide it is refused as ambiguous', amb);
  else { skipped++; console.log('  SKIP no unresolvable tie exists on Pink'); }
  const az = devs(4);
  for (const [i, t] of ['shiv_vihar', 'shiv_vihar', 'shalimar_bagh', 'lajpat_nagar'].entries())
    await submit(az[i], { line: 'pink', station: 'azadpur', towards: t, kind: 'stuck' });
  ok((await db.query(`select count(distinct next_id)::int n from reports where station_id = 'azadpur'`))[0].n === 1, 'riders on one Pink train naming different stations land in one group');
  ok(await nextOf({ line: 'blue', station: 'vaishali', towards: 'vaishali', kind: 'arrived' }) === 'vaishali', 'a train arriving at the end of the line can be reported');
  ok(await nextOf({ line: 'blue', station: 'vaishali', towards: 'vaishali', kind: 'departed' }) === 'bad_towards', 'but nothing departs from the end towards itself');
  ok(await nextOf({ line: 'pink', station: 'welcome', towards: 'welcome', kind: 'arrived' }) === 'bad_towards', 'nobody "arrives towards" a plain through station');
  ok(await nextOf({ line: 'magenta', station: 'majlis_park', towards: 'majlis_park', kind: 'arrived' }) === 'majlis_park', 'on Magenta it is');
  ok(await nextOf({ station: 'qutab_minar', towards: 'qutab_minar', kind: 'arrived' }) === 'qutab_minar', 'a short-turn train arriving where it ends can be reported too');
  await reset();
}

section('Network: apply_network rejects bad input and changes nothing');
{
  const base = () => ({ version: 't1', lines: [{ id: 'x', name: 'X Line' }],
    stations: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    routes: [{ id: 'x_1', line: 'x', name: 'A-C', stops: ['a', 'b', 'c'] }] });
  const bad = {
    'station repeated in a route': (n) => { n.routes[0].stops = ['a', 'b', 'a']; },
    'route uses unknown station': (n) => { n.routes[0].stops = ['a', 'zzz']; },
    'route on unknown line': (n) => { n.routes[0].line = 'nope'; },
    'one-stop route': (n) => { n.routes[0].stops = ['a']; },
    'bad id characters': (n) => { n.stations[0].id = 'Bad Id!'; n.routes[0].stops = ['Bad Id!', 'b']; },
    'numeric id': (n) => { n.stations[0].id = 7; },
    'blank name': (n) => { n.stations[0].name = '   '; },
    'duplicate station id': (n) => { n.stations.push({ id: 'a', name: 'A again' }); },
    'coordinates out of range': (n) => { n.stations[0].lat = 400; n.stations[0].lon = 77; },
    'latitude without longitude': (n) => { n.stations[0].lat = 28.6; },
    'coordinates as text': (n) => { n.stations[0].lat = 'abc'; n.stations[0].lon = 'def'; },
    'line without any route': (n) => { n.lines.push({ id: 'y', name: 'Y Line' }); },
    'turnback not on its line': (n) => { n.stations.push({ id: 'd', name: 'D' }); n.routes.push({ id: 'x_2', line: 'x', name: 'C-D', stops: ['c', 'd'] }); n.lines.push({ id: 'y', name: 'Y' }); n.routes.push({ id: 'y_1', line: 'y', name: 'A-B', stops: ['a', 'b'] }); n.turnbacks = [{ line: 'y', station: 'd' }]; },
    'missing version': (n) => { delete n.version; },
    'stops not a list': (n) => { n.routes[0].stops = 'a,b'; },
    'null inside stops': (n) => { n.routes[0].stops = ['a', null, 'c']; },
    'station that is not an object': (n) => { n.stations.push(null); },
    'aliases that are not a list of names': (n) => { n.stations[0].aliases = [1, 2]; },
    'too many stations': (n) => { for (let i = 0; i < 1001; i++) n.stations.push({ id: 'z' + i, name: 'Z' }); },
  };
  for (const [name, mutate] of Object.entries(bad)) {
    const n = base(); mutate(n);
    const err = await threw(() => applyNetwork(n));
    ok(err && /^network:/.test(err), 'rejects: ' + name, err ?? 'no error');
  }
  ok(/^network:/.test(await threw(() => applyNetwork('not an object')) ?? ''), 'rejects: payload that is not an object');
  const c = (await db.query(`select (select count(*)::int from stations where active) s, (select version from network_meta) v`))[0];
  ok(c.s === 276 && c.v === network.version, 'failed applies left the real network untouched', c);
}

section('Network: reloading the same network changes nothing');
{
  ok(await submit(dev(), { station: 'saket' }) === 'accepted', 'a report is stored');
  const r = (await applyNetwork(network)).r;
  ok(r.status === 'unchanged' && await count('reports') === 1, 're-applying the same version keeps riders\' reports', r);
  await reset();
}

section('Network: path search stays quick on a long line');
{
  const n = 300, ids = Array.from({ length: n }, (_, i) => 's' + i);
  const big = { version: 'perf-300', lines: [{ id: 'p', name: 'P' }], stations: ids.map((id) => ({ id, name: id })),
    routes: [{ id: 'p_1', line: 'p', name: 'P', stops: ids }] };
  const t0 = Date.now(); await applyNetwork(big); const ms = Date.now() - t0;
  ok(ms < (db.real ? 20000 : 90000) && await count(`line_paths where line_id = 'p'`) === n * (n - 1), `300 stations in a row: all ${n * (n - 1)} paths in ${ms} ms`);
  await applyNetwork(network);
  ok(await count('line_stations') > 276, 'real network restored');
}

section('Network: removing a line switches it off, re-adding switches it on');
{
  ok(await submit(dev(), { line: 'grey', station: 'dwarka', towards: 'dhansa_bus_stand' }) === 'accepted', 'report on Grey Line accepted before removal');
  const greyOnly = new Set(network.routes.filter((r) => r.line === 'grey').flatMap((r) => r.stops));
  for (const r of network.routes) if (r.line !== 'grey') for (const s of r.stops) greyOnly.delete(s);
  const noGrey = { ...network, version: 'test-no-grey', lines: network.lines.filter((l) => l.id !== 'grey'),
    routes: network.routes.filter((r) => r.line !== 'grey'), stations: network.stations.filter((s) => !greyOnly.has(s.id)) };
  await applyNetwork(noGrey);
  ok(await count('reports') === 0, 'reloading the network clears stored reports (their directions may no longer fit)');
  ok(await submit(dev(), { line: 'grey', station: 'dwarka', towards: 'dhansa_bus_stand' }) === 'bad_station', 'removed line no longer accepts reports');
  ok((await stateCached('grey')).status === 'bad_line', 'removed line is not served');
  ok(await submit(dev(), { line: 'blue', station: 'dwarka', towards: 'vaishali' }) === 'accepted', 'shared station still works on its other line');
  ok((await db.query(`select active from stations where id = 'dhansa_bus_stand'`))[0].active === false, 'removed stations are switched off, not deleted');
  await applyNetwork(network);
  ok(await submit(dev(), { line: 'grey', station: 'dwarka', towards: 'dhansa_bus_stand' }) === 'accepted', 'line works again after re-adding');
  await reset();
}

// ---------------------------------------------------------------------------
section('Reports: validation');
{
  const d = dev();
  ok(await submit(null) === 'unauthenticated', 'no session is rejected');
  ok(await submit(d, { id: null }) === 'missing_id', 'missing report id');
  ok(await submit(d, { kind: 'teleport' }) === 'bad_kind', 'unknown kind');
  ok(await submit(d, { kind: null }) === 'bad_kind', 'null kind');
  ok(await submit(d, { line: 'nope' }) === 'bad_station', 'unknown line');
  ok(await submit(d, { line: null }) === 'bad_station', 'null line');
  ok(await submit(d, { station: 'atlantis' }) === 'bad_station', 'unknown station');
  ok(await submit(d, { line: 'red', station: 'rajiv_chowk', towards: 'rithala' }) === 'bad_station', 'station that is not on that line');
  ok(await submit(d, { towards: 'rajiv_chowk' }) === 'bad_towards', 'destination equal to the station');
  ok(await submit(d, { towards: 'vaishali' }) === 'bad_towards', 'destination on another line');
  ok(await submit(d, { towards: 'atlantis' }) === 'bad_towards', 'unknown destination');
  ok(await submit(d, { towards: null }) === 'bad_towards', 'null destination');
  ok(await submit(d, { age: -1 }) === 'bad_time', 'negative age');
  ok(await submit(d, { age: 601 }) === 'bad_time', 'older than 10 minutes');
  ok(await submit(d, { age: 'NaN' }) === 'bad_time', 'NaN age');
  ok(await submit(d, { age: 'Infinity' }) === 'bad_time', 'infinite age');
  ok(await submit(d, { age: null }) === 'bad_time', 'null age');
  ok(['accepted', 'duplicate'].includes(await submit(d, { age: '1e-400' })) && ['accepted', 'duplicate'].includes(await submit(dev(), { age: '0.' + '0'.repeat(500) + '1', station: 'saket' })),
     'vanishingly small ages are handled, not crashed on');
  await reset();
  ok(await submit(d, { station: 'x'.repeat(100000) }) === 'bad_station', 'huge input is rejected cleanly');
  ok(await submit(d, { station: "rajiv_chowk'; drop table metro.reports; --" }) === 'bad_station', 'hostile input is just an unknown station');
  ok(await count('reports') === 0, 'nothing was stored by rejected reports');
}

section('Reports: duplicates and limits');
{
  const d = dev(), other = dev(), id = randomUUID();
  ok(await submit(d, { id }) === 'accepted', 'valid report accepted');
  ok(await submit(d, { id }) === 'duplicate', 'same id resent is ignored');
  ok(await submit(other, { id, station: 'saket' }) === 'accepted' && await count(`reports where id = $1`, [id]) === 2,
     "report ids are private to a device: another device cannot probe or clash with them");
  ok(await submit(d) === 'duplicate', 'double tap within a minute is ignored');
  ok(await submit(d, { age: 120 }) === 'accepted', 'same place two minutes apart is a new report');
  await reset();

  const kinds = ['departed', 'arrived', 'stuck', 'cleared'], ends = ['millennium_city_centre', 'samaypur_badli'];
  const nth = (i) => ({ kind: kinds[i % 4], towards: ends[(i >> 2) % 2], age: (i >> 3) * 61 });
  let res = [];
  for (let i = 0; i < 11; i++) res.push(await submit(d, nth(i)));
  ok(res.slice(0, 10).every((s) => s === 'accepted') && res[10] === 'rate_limited', '11th report within a minute is rate limited', res);
  for (let batch = 1; batch < 3; batch++) {
    await db.exec(`update reports set received_at = received_at - interval '2 minutes'`);
    for (let i = batch * 10; i < batch * 10 + 10; i++) res.push(await submit(d, nth(i)));
  }
  await db.exec(`update reports set received_at = received_at - interval '2 minutes'`);
  const last = await submit(d, nth(30));
  ok(await count('reports') === 30 && last === 'rate_limited', '31st report within 10 minutes is rate limited', { stored: await count('reports'), last });
  ok(await submit(other) === 'accepted', "one device's limit does not affect another");
  await reset();

  const old = dev();
  await submit(old, { station: 'aiims', age: 300 });
  await trustAll();
  await db.exec(`insert into devices (device_id, first_seen) select g, now() from (select gen_random_uuid() g from generate_series(1, 1500)) x;
                 insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at)
                 select gen_random_uuid(), device_id, 'yellow', 'saket', 'samaypur_badli', 'malviya_nagar', 'arrived', now()
                 from devices where first_seen > now() - interval '1 minute'`);
  ok(await submit(d) === 'busy', 'a crowd of new accounts fills only the new-device allowance');
  ok(await submit(old, { station: 'hauz_khas', age: 0 }) === 'accepted', 'established riders still get through');
  await reset();
  await db.exec(`insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at)
                 select gen_random_uuid(), gen_random_uuid(), 'yellow', 'saket', 'samaypur_badli', 'malviya_nagar', 'arrived', now()
                 from generate_series(1, 6000)`);
  ok(await submit(d) === 'busy', 'network-wide flood makes new reports wait');
  const light = dev(), heavy = dev();
  await db.exec(`insert into devices (device_id, first_seen) values ('${light}', now() - interval '2 days'), ('${heavy}', now() - interval '2 days')`);
  await db.exec(`insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at)
                 values (gen_random_uuid(), '${heavy}', 'yellow', 'aiims', 'samaypur_badli', 'dilli_haat_ina', 'arrived', now() - interval '60 seconds')`);
  ok(await submit(light, { station: 'green_park' }) === 'accepted', 'an established rider who has been quiet still gets through a flood');
  ok(await submit(heavy, { station: 'hauz_khas' }) === 'busy', 'but one that is reporting busily waits like everyone else');
  await reset();
  ok(await submit(d) === 'accepted', 'accepted again once the flood has passed');
  await reset();
}

section('Reports: impossible movement');
{
  const d = dev();
  await submit(d, { station: 'rajiv_chowk' });
  ok(await submit(d, { station: 'hauz_khas' }) === 'implausible', '9 stations away in the same second is rejected');
  ok(await submit(d, { station: 'patel_chowk' }) === 'implausible', 'even the next station in the same second is rejected');
  ok(await submit(d, { line: 'red', station: 'rithala', towards: 'shaheed_sthal_new_bus_adda' }) === 'implausible', 'another line far away in the same second is rejected');
  ok(await submit(d, { line: 'blue', station: 'rajiv_chowk', towards: 'vaishali' }) === 'accepted', 'changing line at an interchange is fine');
  const e = dev();
  await submit(e, { station: 'rajiv_chowk', age: 600 });
  ok(await submit(e, { station: 'hauz_khas', age: 0 }) === 'accepted', '9 stations in 10 minutes is believable');
  const f = dev();
  await submit(f, { station: 'hauz_khas', age: 0 });
  ok(await submit(f, { station: 'rajiv_chowk', age: 600 }) === 'accepted', 'queued reports arriving out of order keep their true times');
  const far = dev();
  await submit(far, { line: 'red', station: 'rithala', towards: 'shaheed_sthal_new_bus_adda', age: 300 });
  ok(await submit(far, { station: 'millennium_city_centre', towards: 'samaypur_badli', kind: 'arrived', age: 0 }) === 'implausible', 'two lines 30 km apart within 5 minutes is rejected');
  const g = dev();
  await submit(g, { line: 'blue', station: 'vaishali', towards: 'dwarka_sector_21', age: 0 });
  ok(await submit(g, { line: 'blue', station: 'noida_electronic_city', towards: 'dwarka_sector_21', age: 130 }) === 'implausible', 'one Blue branch end to the other in 2 minutes is rejected');
  const h = dev();
  await submit(h, { line: 'aqua', station: 'noida_sector_51', towards: 'depot_station', age: 0 });
  ok(await submit(h, { line: 'aqua', station: 'depot_station', towards: 'noida_sector_51', age: 130 }) === 'implausible', 'one end of Aqua to the other in 2 minutes is rejected');
  await reset();
}

section('Reports: blocked devices');
{
  const bad = dev(), good = dev();
  await admin(`select public.admin_block_device($1, 'spam') as r`, [bad]);
  ok(await submit(bad, { station: 'saket' }) === 'accepted', 'blocked device gets a normal-looking answer');
  ok(await count('reports') === 0, 'but nothing is stored');
  await db.exec(`insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at)
                 values (gen_random_uuid(), '${bad}', 'yellow', 'saket', 'samaypur_badli', 'malviya_nagar', 'arrived', now())`);
  await submit(good, { station: 'aiims' });
  const s = await state('yellow');
  ok(obs(s, 'yellow', (o) => o.station === 'saket').length === 0 && obs(s, 'yellow', (o) => o.station === 'aiims').length === 1,
     'reports stored before a device was blocked are hidden too');
  ok((await admin(`select public.admin_unblock_device($1) as r`, [bad])).r.ok && await submit(bad, { station: 'saket', kind: 'stuck' }) === 'accepted'
     && await count('reports where device_id = $1', [bad]) === 2, 'an unblocked device is stored again');
  await reset();
}

// ---------------------------------------------------------------------------
section('Live state: agreement, fading, grouping');
{
  const [a, b, c, d] = devs(4);
  for (const x of [a, b, c]) await submit(x, { age: 20 });
  let s = await state('yellow');
  let rc = obs(s, 'yellow', (o) => o.station === 'rajiv_chowk')[0];
  ok(rc && rc.devices === 3 && rc.confidence === 'medium', '3 brand-new devices agreeing are only "medium"', rc);
  await trustAll();
  await submit(d, { station: 'hauz_khas', towards: 'samaypur_badli', age: 540 });
  s = await state('yellow');
  rc = obs(s, 'yellow', (o) => o.station === 'rajiv_chowk')[0];
  const hk = obs(s, 'yellow', (o) => o.station === 'hauz_khas')[0];
  ok(rc && rc.devices === 3 && rc.confidence === 'high' && rc.next === 'patel_chowk' && rc.towards === 'millennium_city_centre', '3 established riders agreeing = high confidence', rc);
  ok(hk && hk.devices === 1 && hk.confidence === 'low' && hk.score < 0.1, 'one 9-minute-old report = low and faded', hk);
  ok(Math.abs(new Date(rc.observed_at) - (Date.now() - 20000)) < 5000, 'observation time is "now minus age"', rc.observed_at);
  ok(Object.keys(s.lines).join() === 'yellow' && s.ok === true && s.version === 2, 'single-line answer holds only that line');
  await db.exec(`update reports set observed_at = now() - interval '601 seconds' where station_id = 'hauz_khas'`);
  ok(obs(await state('yellow'), 'yellow', (o) => o.station === 'hauz_khas').length === 0, 'older than 10 minutes drops out');

  await submit(d, { towards: 'qutab_minar', age: 5 });
  s = await state('yellow');
  const dep = obs(s, 'yellow', (o) => o.station === 'rajiv_chowk' && o.kind === 'departed');
  ok(dep.length === 2 && dep.find((o) => o.towards === 'qutab_minar')?.devices === 1, 'trains to different destinations are kept apart', dep);

  const e = dev();
  await submit(e, { station: 'saket', age: 400 }); await submit(e, { station: 'hauz_khas', age: 200 }); await submit(e, { station: 'aiims', age: 5 });
  s = await state('yellow');
  ok(obs(s, 'yellow', (o) => o.station === 'saket' || o.station === 'hauz_khas').length === 0 && obs(s, 'yellow', (o) => o.station === 'aiims').length === 1,
     'a device speaks for one train: only its latest departure counts');

  await submit(dev(), { line: 'blue', station: 'rajiv_chowk', towards: 'vaishali' });
  const all = await state();
  ok(all.lines.yellow && all.lines.blue && !all.lines.red, 'whole-network answer lists only lines with something to say', Object.keys(all.lines));
  ok(obs(all, 'blue', (o) => o.station === 'rajiv_chowk').length === 1 && obs(all, 'blue').every((o) => o.next === 'barakhamba'),
     'same station, two lines: reports stay on their own line');
  ok((await stateCached('nope')).status === 'bad_line' && await count(`live_cache where key = 'nope'`) === 0, 'unknown line is refused and never cached');
  const x = dev();
  await submit(x, { station: 'aiims', towards: 'samaypur_badli', age: 200 });
  await submit(x, { line: 'blue', station: 'rajiv_chowk', towards: 'dwarka_sector_21', age: 30 });
  const one = obs(await state('yellow'), 'yellow', (o) => o.station === 'aiims').length, whole = obs(await state(), 'yellow', (o) => o.station === 'aiims').length;
  ok(one === whole, 'a line on its own and the whole network always agree', { one, whole });
  await reset();
}

section('Live state: stuck trains');
{
  const at = { station: 'kashmere_gate', kind: 'stuck' };
  const alerts = async (line = 'yellow') => riderAlerts(await state(line), line);
  const say = async (list, o) => { for (const x of list) await submit(x, o); };

  let [a, b, c] = devs(3);
  await say([a, b], { ...at, age: 30 });
  await trustAll();
  ok((await alerts()).length === 0, '2 riders are not enough for a public warning');
  await submit(c, { ...at, age: 25 });
  ok((await alerts()).length === 0, 'a brand-new device counts only half, so 2.5 is still not enough');
  await trustAll();
  let al = await alerts();
  ok(al.length === 1 && al[0].station === 'kashmere_gate' && al[0].next === 'chandni_chowk' && al[0].devices === 3 && al[0].confirmed === true
     && /Kashmere Gate/.test(al[0].message), '3 established riders raise a confirmed warning', al);
  ok(riderAlerts(await state(), 'yellow').length === 1, 'warning also appears in the whole-network answer');
  await submit(a, { station: 'kashmere_gate', kind: 'cleared', age: 5 });
  ok((await alerts()).length === 0, 'a rider taking their word back drops it below 3');
  await reset();

  await say(devs(6), { ...at, age: 20 });
  al = await alerts();
  ok(al.length === 1 && al[0].confirmed === false && al[0].established_devices === 0, 'six first-time users still raise a warning, marked unconfirmed', al);
  await reset();

  await say(devs(5), { ...at, age: 0 });
  await db.exec(`update reports set observed_at = now() - interval '15 minutes', received_at = now() - interval '15 minutes'`);
  await trustAll();
  ok((await alerts()).length === 1, 'a long stoppage stays up for 15 minutes without anyone re-tapping');
  await db.exec(`update reports set observed_at = now() - interval '21 minutes', received_at = now() - interval '21 minutes'`);
  ok((await alerts()).length === 0, 'and lapses after 20 minutes of silence');
  await reset();

  const split = devs(4);
  await say(split.slice(0, 2), { ...at, age: 10 });
  await say(split.slice(2), { station: 'chandni_chowk', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  await trustAll();
  al = await alerts();
  ok(al.length === 1 && ['kashmere_gate', 'chandni_chowk'].includes(al[0].station), 'riders on one held train naming neighbouring stations add up, and the warning shows once', al);
  await reset();

  const chain = devs(3);
  await submit(chain[0], { station: 'civil_lines', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  await submit(chain[1], { ...at, age: 10 });
  await submit(chain[2], { station: 'chandni_chowk', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  await trustAll();
  al = await alerts();
  ok(al.length === 1 && al[0].devices === 3 && al[0].stations.length === 3, 'three riders naming three consecutive stations make one warning', al);
  await reset();
  const five = devs(5);
  for (const [i, st] of ['civil_lines', 'civil_lines', 'kashmere_gate', 'chandni_chowk', 'chandni_chowk'].entries())
    await submit(five[i], { station: st, towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  await trustAll();
  ok((await alerts()).length === 1, 'riders split 2 / 1 / 2 along one stretch still give one warning, not two');
  await reset();
  const jn = devs(3);
  await submit(jn[0], { line: 'blue', station: 'akshardham', towards: 'dwarka_sector_21', kind: 'stuck', age: 10 });
  await submit(jn[1], { line: 'blue', station: 'akshardham', towards: 'dwarka_sector_21', kind: 'stuck', age: 10 });
  await submit(jn[2], { line: 'blue', station: 'yamuna_bank', towards: 'vaishali', kind: 'stuck', age: 10 });
  await trustAll();
  ok((await alerts('blue')).length === 0, 'trains on different branches meeting at a junction are not added together');
  await reset();
  await say(devs(3), { ...at, age: 0 });
  await db.exec(`update reports set observed_at = now() - interval '15 minutes', received_at = now() - interval '15 minutes';
                 update devices set first_seen = now() - interval '15 minutes'`);
  ok((await alerts()).length === 0, 'three new accounts cannot become "established" just by waiting out their own report');
  await reset();
  const day = devs(2);
  await db.exec(`insert into devices (device_id, first_seen) values ('${day[0]}', now() - interval '25 hours'), ('${day[1]}', now() - interval '23 hours')`);
  await submit(day[0], { station: 'saket' }); await submit(day[1], { station: 'aiims' });
  const est = await db.query(`select device_id, established from reports order by station_id`);
  ok(est.find((r) => r.device_id === day[0])?.established === true && est.find((r) => r.device_id === day[1])?.established === false,
     'a report is established only if its device was first seen a full day before it', est);
  await reset();
  const honest = devs(3);
  await submit(honest[0], { ...at, age: 60 }); await submit(honest[1], { ...at, age: 60 });
  await submit(honest[2], { station: 'chandni_chowk', towards: 'millennium_city_centre', kind: 'stuck', age: 60 });
  await trustAll();
  ok((await alerts()).length === 1, 'two riders at one station and one at the next raise a warning');
  await say(devs(4), { station: 'kashmere_gate', towards: 'qutab_minar', kind: 'departed', age: 5 });
  await trustAll();
  ok((await alerts()).length === 1, 'four departures cannot hide it: the bar counts every rider in the stretch');
  await reset();

  const bridge = devs(8);
  await say(bridge.slice(0, 2), { ...at, age: 10 });
  await submit(bridge[2], { station: 'chandni_chowk', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  await say(bridge.slice(3, 5), { station: 'new_delhi', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  await submit(bridge[5], { station: 'rajiv_chowk', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  await trustAll();
  await say(bridge.slice(6), { station: 'chawri_bazar', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  al = await alerts();
  ok(al.length === 2 && al.every((x) => x.confirmed), 'two new accounts in the gap cannot merge two real stoppages into one', al.map((x) => [x.station, x.stations]));
  await reset();
  const hide = devs(9);
  await say(hide.slice(0, 2), { ...at, age: 10 });
  await submit(hide[2], { station: 'chandni_chowk', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  await trustAll();
  await say(hide.slice(3), { station: 'chawri_bazar', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  al = await alerts();
  ok(al.some((x) => x.confirmed && x.station === 'kashmere_gate'), 'six new accounts next door cannot replace a confirmed warning', al.map((x) => [x.station, x.confirmed]));
  await reset();
  await say(devs(3), { station: 'kashmere_gate', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  await say(devs(3), { station: 'chandni_chowk', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  await say(devs(3), { station: 'chawri_bazar', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  await trustAll();
  al = await alerts();
  ok(al.length === 1 && al[0].devices === 9 && al[0].stations.length === 3, 'one held train with riders at three stations gives one warning, not three', al.map((x) => x.station));
  await reset();
  await say(devs(6), { station: 'patel_chowk', towards: 'millennium_city_centre', kind: 'departed', age: 170 });
  await say(devs(3), { station: 'patel_chowk', towards: 'millennium_city_centre', kind: 'stuck', age: 60 });
  await trustAll();
  ok((await alerts()).length === 1, 'departures before a stoppage began do not count against it');
  await submit(dev(), { station: 'patel_chowk', towards: 'millennium_city_centre', kind: 'stuck', age: 590 });
  ok((await alerts()).length === 1, 'and one new account cannot back-date the stoppage to make them count');
  await reset();
  const opp = devs(4);
  await say(opp.slice(0, 2), { ...at, age: 10 });
  await say(opp.slice(2), { station: 'chandni_chowk', towards: 'samaypur_badli', kind: 'stuck', age: 10 });
  await trustAll();
  ok((await alerts()).length === 0, 'trains going opposite ways are never added together');
  await reset();
  const ring = devs(4);
  await say(ring.slice(0, 2), { line: 'pink', station: 'burari', towards: 'majlis_park', kind: 'stuck', age: 10 });
  await say(ring.slice(2), { line: 'pink', station: 'majlis_park', towards: 'azadpur', kind: 'stuck', age: 10 });
  await trustAll();
  ok((await alerts('pink')).length === 1, 'one held train either side of where the Pink ring joins makes one warning');
  await reset();
  await say(devs(3), { ...at, age: 10 });
  await say(devs(3), { station: 'chawri_bazar', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  await trustAll();
  await submit(dev(), { station: 'chandni_chowk', towards: 'millennium_city_centre', kind: 'stuck', age: 10 });
  al = await alerts();
  ok(al.length === 2 && al.map((x) => x.station).sort().join() === 'chawri_bazar,kashmere_gate', 'one new account between two real stoppages cannot merge them into one', al.map((x) => x.station));
  await reset();
  await say(devs(3), { station: 'civil_lines', towards: 'millennium_city_centre', kind: 'stuck', age: 200 });
  await trustAll();
  await submit(dev(), { station: 'vidhan_sabha', towards: 'millennium_city_centre', kind: 'stuck', age: 150 });
  await submit(dev(), { station: 'vishwavidyalaya', towards: 'millennium_city_centre', kind: 'stuck', age: 150 });
  await say(devs(8), { station: 'civil_lines', towards: 'millennium_city_centre', kind: 'departed', age: 30 });
  await db.exec(`update devices set first_seen = now() - interval '2 days' where device_id not in (select device_id from reports where kind = 'stuck' and station_id <> 'civil_lines');
                 update reports set established = true where not (kind = 'stuck' and station_id <> 'civil_lines')`);
  ok((await alerts()).length === 0, 'new accounts next to a turn-back station cannot shield a contradicted warning');
  await reset();

  const multi = devs(3);
  for (const x of multi) {
    await submit(x, { ...at, age: 40 });
    await submit(x, { line: 'red', station: 'kashmere_gate', towards: 'rithala', kind: 'stuck', age: 30 });
    await submit(x, { line: 'violet', station: 'kashmere_gate', towards: 'raja_nahar_singh', kind: 'stuck', age: 20 });
  }
  await trustAll();
  const all = await state();
  const n = ['yellow', 'red', 'violet'].map((l) => riderAlerts(all, l).length);
  ok(n.join() === '0,0,1', 'one device holds up one warning at a time: only its latest word counts', n);
  await reset();

  // other trains leaving do not cancel a warning at a terminus or junction
  await say(devs(3), { station: 'samaypur_badli', towards: 'millennium_city_centre', kind: 'stuck', age: 60 });
  await say(devs(8), { station: 'samaypur_badli', towards: 'millennium_city_centre', kind: 'departed', age: 5 });
  await trustAll();
  ok((await alerts()).length === 1, 'departures from the other platform at a terminus do not cancel it');
  await reset();
  await say(devs(3), { line: 'green', station: 'ashok_park_main', towards: 'brigadier_hoshiyar_singh', kind: 'stuck', age: 60 });
  await say(devs(8), { line: 'green', station: 'ashok_park_main', towards: 'brigadier_hoshiyar_singh', kind: 'departed', age: 5 });
  await trustAll();
  ok((await alerts('green')).length === 1, 'nor do departures at a junction');
  await reset();

  // at a plain through station, clearly more traffic leaving shows the track is moving
  const ten = devs(10);
  await say(ten, { ...at, age: 60 });
  await trustAll();
  await say(devs(2), { station: 'kashmere_gate', towards: 'qutab_minar', kind: 'departed', age: 5 });
  await trustAll();
  ok((await alerts())[0]?.devices === 10, 'two departures cannot cancel ten riders');
  await say(devs(3), { station: 'kashmere_gate', kind: 'cleared', age: 3 });
  await trustAll();
  ok((await alerts())[0]?.devices === 10, 'nor can outsiders tapping "moving": only the stuck riders can take it back');
  await reset();

  const pin = devs(3);
  await say(pin, { ...at, age: 200 });
  await trustAll();
  ok((await alerts()).length === 1, 'three accounts raise a warning');
  const traffic = devs(8);
  await say(traffic, { station: 'kashmere_gate', towards: 'qutab_minar', kind: 'departed', age: 100 });
  await trustAll();
  ok((await alerts()).length === 0, '8 later departures the same way show the track is moving');
  for (const x of pin) { await submit(x, { station: 'kashmere_gate', kind: 'cleared', age: 70 }); await submit(x, { ...at, age: 0 }); }
  ok((await alerts()).length === 0, 'flipping to "cleared" and back to "stuck" does not hide those departures');
  for (const x of pin) await submit(x, { ...at, age: 0, id: randomUUID() });
  await db.exec(`update reports set observed_at = observed_at - interval '6 minutes', received_at = received_at - interval '6 minutes' where device_id = any($1)`.replace('$1', `array[${traffic.map((t) => `'${t}'`).join(',')}]::uuid[]`));
  ok((await alerts()).length === 1, 'but once departures stop coming (5 minutes), a warning can stand again');
  await reset();

  const blue = devs(3);
  await submit(blue[0], { line: 'blue', station: 'mandi_house', towards: 'vaishali', kind: 'stuck', age: 10 });
  await submit(blue[1], { line: 'blue', station: 'mandi_house', towards: 'noida_electronic_city', kind: 'stuck', age: 10 });
  await submit(blue[2], { line: 'blue', station: 'mandi_house', towards: 'vaishali', kind: 'stuck', age: 10 });
  await submit(dev(), { line: 'violet', station: 'mandi_house', towards: 'raja_nahar_singh', kind: 'stuck', age: 10 });
  await trustAll();
  const s = await state();
  ok(riderAlerts(s, 'blue').length === 1 && riderAlerts(s, 'blue')[0].devices === 3, 'riders on both Blue branches count together on the shared track');
  ok(riderAlerts(s, 'violet').length === 0, 'a different line at the same station is counted separately');
  await reset();
}

section('Live state: short-lived copy');
{
  const first = await state('yellow');
  await submit(dev(), { station: 'saket' });
  const second = await stateCached('yellow');
  ok(second.generated_at === first.generated_at && obs(second, 'yellow').length === 0, 'answers within 5 seconds come from the stored copy');
  await db.exec(`update live_cache set generated_at = now() - interval '6 seconds'`);
  const third = await stateCached('yellow');
  ok(third.generated_at !== first.generated_at && obs(third, 'yellow').length === 1, 'after 5 seconds it is rebuilt');
  await stateCached(); await stateCached('blue'); await stateCached('red');
  ok((await db.query(`select array_agg(key order by key) k from live_cache`))[0].k.join() === '*', 'every line is cut from one shared copy');
  await db.exec(`update live_cache set generated_at = now() - interval '3 days'`);
  await submit(dev(), { station: 'hauz_khas' });
  const roState = await db.call('anon', null, `select public.get_live_state('yellow') as s`, [], 0, true).then((r) => r[0].s, (e) => e.message);
  ok(roState?.ok === true && roState.stale === true && roState.age_s > 3 * 86400 - 60,
     'a read-only (GET) caller is never made to rebuild while a copy exists: it gets the copy, clearly marked stale with its age', { stale: roState?.stale, age: roState?.age_s });
  await db.exec(`delete from live_cache`);
  const roFresh = await db.call('anon', null, `select public.get_live_state('yellow') as s`, [], 0, true).then((r) => r[0].s);
  ok(roFresh.ok && roFresh.stale === false && obs(roFresh, 'yellow', (o) => o.station === 'hauz_khas').length === 1, 'with no copy at all, it gets a fresh answer');
  await stateCached();
  await db.exec(`update live_cache set generated_at = now() - interval '10 seconds'`);
  const ro2 = await db.call('anon', null, `select public.get_live_state(null) as s`, [], 0, true).then((r) => r[0].s);
  ok(ro2.stale === false && ro2.age_s >= 9 && ro2.age_s <= 12, 'a copy a few seconds old is served as current, with its true age', ro2.age_s);
  if (db.real) {
    const pg = (await import('pg')).default;
    const dbName = (await db.query(`select current_database() d`))[0].d;
    const u = new URL(process.env.DATABASE_URL); u.pathname = '/' + dbName;
    const holder = new pg.Client({ connectionString: u.toString() }); await holder.connect();
    await stateCached();
    await db.exec(`update live_cache set generated_at = now() - interval '2 minutes'`);
    await holder.query(`begin; select pg_advisory_xact_lock(hashtextextended('dmr_cache', 0))`);
    let t0 = Date.now();
    const busyRead = await stateCached('yellow', 3000);
    ok(busyRead.ok && busyRead.stale === true && busyRead.age_s >= 119 && Date.now() - t0 < 1000,
       'while a rebuild is under way readers get the last copy at once, marked stale with its age', { stale: busyRead.stale, age: busyRead.age_s });
    await db.exec(`delete from live_cache`);
    t0 = Date.now();
    const warm = await stateCached(null, 3000);
    ok(warm.ok && warm.status === 'warming' && Date.now() - t0 < 1000, 'with no copy yet they get "warming" at once instead of waiting', warm);
    await holder.query(`rollback`); await holder.end();
    ok((await admin(`select public.refresh_live_state() as r`)).r === true && (await stateCached()).stale === false, 'the background refresh rebuilds the copy');
  } else { skipped += 3; }
  await reset();
}

// ---------------------------------------------------------------------------
section('Admin alerts');
{
  const set = async (...p) => (await admin(`select public.admin_set_alert($1,$2,$3,$4,$5,$6) as r`, p)).r;
  await stateCached('yellow');
  const r = await set('yellow', 'saket', 'qutab_minar', 'warning', 'Delay between Saket and Qutab Minar', 60);
  let s = await stateCached('yellow');
  const a = s.lines.yellow.alerts.find((x) => x.source === 'admin');
  ok(r.ok && a && a.from === 'saket' && a.to === 'qutab_minar' && a.severity === 'warning', 'a posted alert shows at once, without waiting for the stored copy to age', a);
  ok((await db.query(`select dirty_since from live_cache`))[0].dirty_since === null, 'and the copy is no longer marked out of date');
  ok((await set('magenta', 'janak_puri_west', 'deepali_chowk', 'info', 'Across the gap', 60)).status === 'bad_range', 'range across two unjoined sections is refused');
  ok((await set('yellow', 'saket', 'vaishali', 'info', 'Other line station', 60)).status === 'bad_range', 'range with a station from another line is refused');
  ok((await set('yellow', 'saket', 'saket', 'info', 'Zero length', 60)).status === 'bad_range', 'zero-length range is refused');
  ok((await set('yellow', 'saket', null, 'info', 'Half a range', 60)).status === 'bad_range', 'half a range is refused');
  ok((await set(null, 'saket', 'qutab_minar', 'info', 'No line', 60)).status === 'bad_range', 'range without a line is refused');
  ok((await set('nope', null, null, 'info', 'Unknown line', 60)).status === 'bad_line', 'unknown line is refused');
  ok((await set('yellow', null, null, 'loud', 'Bad severity', 60)).status === 'bad_severity', 'unknown severity is refused');
  ok((await set('yellow', null, null, 'info', 'x'.repeat(281), 60)).status === 'bad_message', 'over-long message is refused');
  ok((await set('yellow', null, null, 'info', '  ', 60)).status === 'bad_message', 'blank message is refused');
  ok((await set('yellow', null, null, 'info', 'Too long lived', 100000)).status === 'bad_duration', 'absurd duration is refused');
  ok((await set('blue', 'vaishali', 'noida_electronic_city', 'info', 'Both branches via Yamuna Bank', 60)).ok, 'range across a junction is allowed');
  await db.exec(`delete from alerts where line_id = 'blue'`);
  await set(null, null, null, 'severe', 'Network-wide notice', 60);
  await set('blue', null, null, 'info', 'Whole Blue Line notice', 60);
  s = await stateCached();
  ok(s.network_alerts.length === 1 && s.lines.blue.alerts.length === 1 && s.lines.yellow.alerts.length === 1, 'network, line and section alerts land in the right places');
  ok((await stateCached('red')).network_alerts.length === 1, 'network-wide alert reaches every line');
  await db.exec(`update alerts set expires_at = now() - interval '1 minute' where line_id = 'blue'`);
  ok(!(await state()).lines.blue, 'expired alert disappears');
  ok((await admin(`select public.admin_clear_alert($1) as r`, [r.id])).r.ok && (await stateCached('yellow')).lines.yellow.alerts.length === 0, 'cleared alert disappears at once');
  ok((await admin(`select public.admin_clear_alert($1) as r`, [r.id])).r.status === 'not_found', 'clearing twice reports not found');
  await reset();
}

// ---------------------------------------------------------------------------
section('Permissions');
{
  const denied = async (role, uid, sql) => { const e = await threw(() => db.call(role, uid, sql)); return e !== null && /permission denied/i.test(e); };
  const u = dev();
  await submit(u);
  for (const t of ['reports', 'devices', 'alerts', 'blocked_devices', 'live_cache', 'housekeeping', 'stations', 'line_paths', 'network_meta'])
    ok(await denied('anon', null, `select * from metro.${t}`) && await denied('authenticated', u, `select * from metro.${t}`), `public keys cannot read metro.${t}`);
  ok(await denied('authenticated', u, `insert into metro.reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at)
        values (gen_random_uuid(), '${u}', 'yellow', 'saket', 'samaypur_badli', 'malviya_nagar', 'stuck', now())`), 'signed-in user cannot insert reports directly');
  ok(await denied('authenticated', u, `update metro.stations set name = 'x'`) && await denied('anon', null, `delete from metro.lines`), 'public keys cannot change the network');
  ok(await denied('anon', null, `select setval('metro.alerts_id_seq', 9223372036854775807)`) && await denied('authenticated', u, `select nextval('metro.alerts_id_seq')`), 'public keys cannot touch the alert counter');
  ok(await denied('authenticated', u, `create table metro.x (i int)`) && await denied('anon', null, `create function metro.f() returns int language sql as 'select 1'`), 'public keys cannot create anything in the private schema');
  for (const f of [`public.apply_network('{}'::jsonb)`, `public.admin_set_alert(null,null,null,'info','hello there',60)`, `public.admin_clear_alert(1)`,
                   `public.admin_block_device(gen_random_uuid(),'x')`, `public.admin_unblock_device(gen_random_uuid())`, `public.get_health()`,
                   `public.purge_old_reports(1, 10)`, `public.schedule_purge()`, `public.refresh_live_state()`, `metro.answer('{}'::jsonb, now(), null)`, `metro.store_build()`, `metro.mark_dirty()`, `metro.build_live_state()`, `metro.line_view('{}'::jsonb, null)`, `metro.maybe_purge()`,
                   `metro.cfg('rate_max')`, `metro.resolve_next('yellow','saket','samaypur_badli')`, `metro.hops_between('yellow','saket','aiims')`])
    ok(await denied('anon', null, `select ${f}`) && await denied('authenticated', u, `select ${f}`), `public keys cannot call ${f.split('(')[0]}`);
  const callable = (await db.query(`select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'metro') and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')) order by 1`)).map((r) => r.f);
  ok(callable.join(' | ') === 'get_live_state(text) | get_network() | submit_report(uuid,text,text,text,text,numeric)', 'exactly three functions are callable with the public keys', callable);
  const loose = (await db.query(`select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'metro') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`)).map((r) => r.f);
  ok(loose.length === 0, 'every privileged function pins its search path', loose);
  const h = (await admin(`select public.get_health() as r`)).r;
  ok(h.reports_stored === 1 && h.active_stations === 276 && h.network_version === network.version, 'health summary works for the admin key', h);
  await stateCached();
  const h2 = (await admin(`select public.get_health() as r`)).r;
  ok(Number.isInteger(h2.live_copy_age_s) && Number.isInteger(h2.live_copy_build_ms), 'health shows how old the live copy is and how long it took to build', h2);
  await reset();
}

// ---------------------------------------------------------------------------
section('Retention');
{
  const d = dev();
  await submit(d); await submit(d, { station: 'saket', age: 600 });
  await db.exec(`update reports set received_at = now() - interval '25 hours' where station_id = 'saket';
                 insert into devices (device_id, last_seen) values (gen_random_uuid(), now() - interval '181 days');
                 insert into alerts (line_id, severity, message, active, expires_at) values ('yellow', 'info', 'ancient', false, now() - interval '31 days')`);
  const n = (await admin(`select public.purge_old_reports() as n`)).n;
  const left = (await db.query(`select (select count(*)::int from reports) r, (select count(*)::int from devices) d, (select count(*)::int from alerts) a`))[0];
  ok(n === 1 && left.r === 1 && left.d === 1 && left.a === 0, 'purge removes day-old reports, devices unused for 6 months, and old alerts', { n, ...left });

  await db.exec(`update reports set received_at = now() - interval '25 hours'; update housekeeping set last_purge_at = now() - interval '11 minutes'`);
  await state('yellow');
  ok(await count('reports') === 0, 'reads tidy up by themselves when no scheduler is installed');

  await db.exec(`insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at, received_at)
                 select gen_random_uuid(), gen_random_uuid(), 'yellow', 'saket', 'samaypur_badli', 'malviya_nagar', 'arrived', now() - interval '26 hours', now() - interval '26 hours'
                 from generate_series(1, 12000);
                 update housekeeping set last_purge_at = now() - interval '11 minutes'`);
  ok(await submit(dev()) === 'accepted' && await count('reports') === 10001, 'writes tidy up too, in small batches so the rider is not kept waiting', await count('reports'));
  ok((await admin(`select public.purge_old_reports(200, 5000) as n`)).n === 10000 && await count('reports') === 1, 'the scheduled purge keeps going until nothing overdue is left');
  await reset();
}

// ---------------------------------------------------------------------------
section('Many requests at the same moment, and load');
if (!db.real) { skipped += 19; console.log('  SKIP 19 checks (need a real Postgres: set DATABASE_URL)'); }
else {
  const d = dev(), id = randomUUID();
  let res = await Promise.all(Array.from({ length: 25 }, () => submit(d, { id })));
  let n = await count(`reports where id = $1`, [id]);
  ok(n === 1 && res.every((s) => ['accepted', 'duplicate', 'busy'].includes(s)) && res.filter((s) => s === 'accepted').length === 1,
     '25 copies of one report at once store exactly one', { n, res: [...new Set(res)] });
  await reset();

  const kinds = ['departed', 'arrived', 'stuck', 'cleared'], ends = ['millennium_city_centre', 'samaypur_badli'];
  const burst = (i) => submit(d, { kind: kinds[i % 4], towards: ends[(i >> 2) % 2], age: (i >> 3) * 61 });
  for (let round = 0; round < 4; round++) await Promise.all(Array.from({ length: 60 }, (_, i) => burst(i)));
  n = await count(`reports where device_id = $1`, [d]);
  ok(n >= 1 && n <= 10, 'a device hammering in parallel never gets past 10 a minute', n);
  await reset();

  const readers = await Promise.all(Array.from({ length: 50 }, (_, i) => stateCached(i % 2 ? 'yellow' : null)));
  ok(readers.every((s) => s.ok === true) && await count('live_cache') === 1, '50 readers at once all get an answer from one stored copy');

  const many = devs(40);
  const [applied, ...subs] = await Promise.all([applyNetwork({ ...network, version: network.version + '-reload' }).then(() => 'ok', (e) => e.message),
    ...many.map((x, i) => submit(x, { station: network.routes.find((r) => r.id === 'yellow_1').stops[1 + (i % 35)] }).catch((e) => 'ERR ' + e.message))]);
  ok(applied === 'ok' && subs.every((s) => s === 'accepted'),
     'reloading the network while reports arrive breaks nothing', { applied, subs: [...new Set(subs)] });
  ok(await count('line_stations') > 276 && await count('line_paths') > 5000, 'network intact after the reload');
  await reset();

  // a day of history must not slow reads down or let a cache refresh knock them over
  await db.exec(`insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at, received_at)
                 select gen_random_uuid(), gen_random_uuid(), 'yellow', 'saket', 'samaypur_badli', 'malviya_nagar', 'arrived', t, t
                 from (select now() - interval '11 minutes' - (g * interval '0.4 seconds') as t from generate_series(1, 200000) g) x;
                 analyze reports;`);
  await db.exec(`delete from live_cache`);
  let t0 = Date.now(); await stateCached(null, 3000); const cold = Date.now() - t0;
  ok(cold < 500, `a cold whole-network read with 200,000 old reports takes well under the 3-second limit (${cold} ms)`);
  await admin(`select public.admin_set_alert('yellow', null, null, 'info', 'Refresh every stored copy', 60) as r`);
  let rs = await Promise.all(Array.from({ length: 40 }, (_, i) => stateCached(i % 3 ? null : 'yellow', 3000).then((s) => s.ok, (e) => e.message)));
  ok(rs.every((x) => x === true), '40 readers right after an admin change all succeed within 3 seconds', [...new Set(rs)]);
  await db.exec(`delete from live_cache`);
  rs = await Promise.all(Array.from({ length: 40 }, () => stateCached(null, 3000).then((s) => s.ok, (e) => e.message)));
  ok(rs.every((x) => x === true) && await count('live_cache') >= 1, '40 readers with no stored copy at all: one rebuilds, the rest wait and succeed', [...new Set(rs)]);

  // a busy ten minutes: 30,000 honest reports in the live window, plus 300 riders stuck,
  // plus 100 established attackers with 30 "stuck" taps each spread around the network
  await db.exec(`delete from reports; delete from devices; delete from live_cache;`);
  await db.exec(`
    with st as (select line_id, station_id, row_number() over () - 1 as k from line_stations),
         nx as (select distinct on (line_id, from_id) line_id, from_id, next_id from line_paths order by line_id, from_id, next_id),
         g as (select i, gen_random_uuid() as d from generate_series(1, 30000) i)
    insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at, received_at)
    select gen_random_uuid(), g.d, st.line_id, st.station_id, nx.next_id, nx.next_id,
           (array['departed','arrived']::metro.report_kind[])[1 + g.i % 2], now() - (g.i % 590) * interval '1 second', now() - (g.i % 590) * interval '1 second'
    from g join st on st.k = g.i % (select count(*) from line_stations) join nx on nx.line_id = st.line_id and nx.from_id = st.station_id;
    insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at, received_at)
    select gen_random_uuid(), gen_random_uuid(), 'yellow', 'kashmere_gate', 'millennium_city_centre', 'chandni_chowk', 'stuck', now() - (i % 300) * interval '1 second', now()
    from generate_series(1, 300) i;
    with att as (select gen_random_uuid() d from generate_series(1, 100)),
         st as (select line_id, station_id, row_number() over () - 1 as k from line_stations),
         nx as (select distinct on (line_id, from_id) line_id, from_id, next_id from line_paths order by line_id, from_id, next_id)
    insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at, received_at)
    select gen_random_uuid(), att.d, st.line_id, st.station_id, nx.next_id, nx.next_id, 'stuck', now() - j * interval '19 seconds', now()
    from att cross join generate_series(0, 29) j
    join st on st.k = (abs(hashtext(att.d::text)) + j * 7) % (select count(*) from line_stations)
    join nx on nx.line_id = st.line_id and nx.from_id = st.station_id;
    insert into devices (device_id, first_seen) select distinct device_id, now() - interval '2 days' from reports;
    update reports set established = true;
    analyze reports; analyze devices;`);
  t0 = Date.now(); const busy = await stateCached(null, 3000); const busyMs = Date.now() - t0;
  ok(busy.ok && busyMs < 1500, `whole-network build in a very busy ten minutes: ${busyMs} ms`);
  await db.exec(`update live_cache set generated_at = '-infinity'`);
  rs = await Promise.all(Array.from({ length: 40 }, (_, i) => stateCached(i % 4 ? null : 'yellow', 3000).then((s) => s.ok, (e) => e.message)));
  ok(rs.every((x) => x === true), '40 readers during that busy period all succeed within 3 seconds', [...new Set(rs)]);
  await db.exec(`delete from live_cache`);
  rs = await Promise.all(Array.from({ length: 30 }, (_, i) => stateCached(i % 3 ? null : 'blue', 3000).then((s) => s.ok, (e) => e.message)));
  ok(rs.every((x) => x === true), 'and 30 readers with no stored copy at all also succeed', [...new Set(rs)]);
  await reset();

  // a huge disruption: 5,000 riders each tap "stuck" once, plus 2,000 established attackers
  // tapping "stuck" every minute for 30 minutes all over the network, plus 60,000 honest reports
  await db.exec(`
    with st as (select line_id, station_id, row_number() over () - 1 as k from line_stations),
         nx as (select distinct on (line_id, from_id) line_id, from_id, next_id from line_paths order by line_id, from_id, next_id),
         g as (select i, gen_random_uuid() as d from generate_series(1, 60000) i)
    insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at, received_at)
    select gen_random_uuid(), g.d, st.line_id, st.station_id, nx.next_id, nx.next_id,
           (array['departed','arrived']::metro.report_kind[])[1 + g.i % 2], now() - (g.i % 590) * interval '1 second', now()
    from g join st on st.k = g.i % (select count(*) from line_stations) join nx on nx.line_id = st.line_id and nx.from_id = st.station_id;
    with st as (select line_id, station_id, row_number() over () - 1 as k from line_stations),
         nx as (select distinct on (line_id, from_id) line_id, from_id, next_id from line_paths order by line_id, from_id, next_id),
         g as (select i, gen_random_uuid() as d from generate_series(1, 5000) i)
    insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at, received_at)
    select gen_random_uuid(), g.d, st.line_id, st.station_id, nx.next_id, nx.next_id, 'stuck', now() - (g.i % 900) * interval '1 second', now()
    from g join st on st.k = (g.i * 13) % (select count(*) from line_stations) join nx on nx.line_id = st.line_id and nx.from_id = st.station_id;
    with att as (select gen_random_uuid() d, i from generate_series(1, 2000) i),
         st as (select line_id, station_id, row_number() over () - 1 as k from line_stations),
         nx as (select distinct on (line_id, from_id) line_id, from_id, next_id from line_paths order by line_id, from_id, next_id)
    insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at, received_at)
    select gen_random_uuid(), att.d, st.line_id, st.station_id, nx.next_id, nx.next_id, 'stuck', now() - j * interval '61 seconds', now()
    from att cross join generate_series(0, 29) j
    join st on st.k = (att.i * 7 + j * 3) % (select count(*) from line_stations)
    join nx on nx.line_id = st.line_id and nx.from_id = st.station_id;
    insert into devices (device_id, first_seen) select distinct device_id, now() - interval '2 days' from reports;
    update reports set established = true;
    analyze reports; analyze devices;`);
  await db.exec(`delete from live_cache`);
  t0 = Date.now(); await admin(`select public.refresh_live_state() as r`); const hugeMs = Date.now() - t0;
  ok(hugeMs < 3000, `background rebuild with 5,000 stuck riders, 2,000 attackers and 60,000 other reports: ${hugeMs} ms`);
  await db.exec(`update live_cache set generated_at = now() - interval '30 seconds'`);
  rs = await Promise.all(Array.from({ length: 40 }, (_, i) => stateCached(i % 4 ? null : 'yellow', 3000).then((s) => s.ok, (e) => e.message)));
  ok(rs.every((x) => x === true), '40 readers during that disruption all get an answer within 3 seconds', [...new Set(rs)]);
  await db.exec(`delete from live_cache`);
  rs = await Promise.all(Array.from({ length: 40 }, (_, i) => db.call('anon', null, `select public.get_live_state($1) as s`, [i % 2 ? null : 'blue'], 3000, true)
                                                          .then((r) => r[0].s.ok, (e) => e.message)));
  ok(rs.every((x) => x === true), '40 read-only (GET) readers with no copy at all also all get an answer', [...new Set(rs)]);
  await reset();

  // the busiest the limits allow: 180,000 reports in 30 minutes, each from a different device
  await db.exec(`
    with st as (select line_id, station_id, row_number() over () - 1 as k from line_stations),
         nx as (select distinct on (line_id, from_id) line_id, from_id, next_id from line_paths order by line_id, from_id, next_id)
    insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at, received_at, established)
    select gen_random_uuid(), gen_random_uuid(), st.line_id, st.station_id, nx.next_id, nx.next_id,
           (array['departed','arrived','stuck']::metro.report_kind[])[1 + g % 3], now() - (g % 1790) * interval '1 second', now(), g % 2 = 0
    from generate_series(1, 180000) g join st on st.k = g % (select count(*) from line_stations) join nx on nx.line_id = st.line_id and nx.from_id = st.station_id;
    analyze reports;`);
  t0 = Date.now(); await admin(`select public.refresh_live_state() as r`); const maxMs = Date.now() - t0;
  ok(maxMs < 6000, `background rebuild at the busiest the limits allow (180,000 devices): ${maxMs} ms`);
  await db.exec(`update live_cache set generated_at = now() - interval '30 seconds'`);
  rs = await Promise.all(Array.from({ length: 40 }, (_, i) => stateCached(i % 4 ? null : 'yellow', 3000).then((s) => s.ok, (e) => e.message)));
  ok(rs.every((x) => x === true), 'and 40 readers then still all get an answer within 3 seconds', [...new Set(rs)]);
  await reset();

  await db.exec(`insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at, received_at)
                 select gen_random_uuid(), gen_random_uuid(), 'yellow', 'saket', 'samaypur_badli', 'malviya_nagar', 'arrived', now() - interval '26 hours', now() - interval '26 hours'
                 from generate_series(1, 200000)`);

  // a reader whose rebuild runs out of time still answers, from the last copy
  await admin(`select public.refresh_live_state() as r`);
  await db.exec(`update live_cache set generated_at = now() - interval '45 seconds'`);
  const slow = await db.call('anon', null, `select public.get_live_state(null) as s`, [], 40).then((r) => r[0].s, (e) => 'ERR ' + e.message);
  ok(slow?.ok === true && slow.age_s >= 44, 'a reader whose rebuild runs out of time gets the last copy, not an error', slow?.age_s ?? slow);

  // GET readers hammering in a loop cannot keep the scheduled refresh out
  await db.exec(`update live_cache set generated_at = now() - interval '45 seconds'`);
  let stop = false;
  const loops = Array.from({ length: 6 }, async () => { while (!stop) await db.call('anon', null, `select public.get_live_state(null) as s`, [], 3000, true).catch(() => {}); });
  await new Promise((r) => setTimeout(r, 300));
  const refreshed = await admin(`select public.refresh_live_state() as r`);
  stop = true; await Promise.all(loops);
  ok(refreshed.r === true && (await db.query(`select extract(epoch from now() - generated_at) a from live_cache`))[0].a < 10,
     'readers in a loop cannot keep the scheduled refresh out', refreshed);
  await reset();
  await db.exec(`insert into reports (id, device_id, line_id, station_id, towards_id, next_id, kind, observed_at, received_at)
                 select gen_random_uuid(), gen_random_uuid(), 'yellow', 'saket', 'samaypur_badli', 'malviya_nagar', 'arrived', now() - interval '26 hours', now() - interval '26 hours'
                 from generate_series(1, 200000)`);

  // scheduled purge and reader-triggered purge at the same moment
  await db.exec(`update reports set received_at = now() - interval '26 hours'`);
  const errs = [];
  for (let round = 0; round < 8; round++) {
    await db.exec(`update housekeeping set last_purge_at = now() - interval '11 minutes'; update live_cache set generated_at = '-infinity'`);
    const out = await Promise.all([
      admin(`select public.purge_old_reports(2, 5000) as n`).then(() => null, (e) => e.message),
      ...Array.from({ length: 12 }, (_, i) => stateCached(i % 2 ? 'yellow' : null, 3000).then(() => null, (e) => e.message)),
      ...Array.from({ length: 6 }, () => submit(dev(), { station: 'aiims' }).then(() => null, (e) => e.message))]);
    errs.push(...out.filter(Boolean));
  }
  ok(errs.length === 0, 'purge, readers and writers together: no deadlock, no error', [...new Set(errs)]);
  await reset();
}

section('Rollback script');
{
  await db.exec(readFileSync(new URL('../supabase/rollback/0001_live_reports.down.sql', import.meta.url), 'utf8'));
  const leftover = await count(`pg_namespace where nspname = 'metro'`)
                 + await count(`pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','v','S')`)
                 + await count(`pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`);
  ok(leftover === 0, 'rollback removes the private schema and every public function', leftover);
  const again = await threw(() => install(db));
  ok(again === null && await submit(dev()) === 'accepted', 'migrations apply cleanly again after a rollback', again ?? '');
}

console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ''}  (${db.real ? 'real Postgres' : 'embedded Postgres'})`);
await db.close();
process.exit(fail ? 1 : 0);
