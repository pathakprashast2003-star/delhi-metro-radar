// Runs the migrations on an embedded Postgres (PGlite) and checks behaviour.
// Usage: node tests/run_tests.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const db = new PGlite();
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra); }
};

// --- Supabase shims (exist automatically on Supabase) ---
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
`);
await db.exec(readFileSync('supabase/migrations/0001_live_reports.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0002_seed_yellow_line.sql', 'utf8'));
// Supabase grants table privileges to these roles by default; RLS must still block them.
await db.exec(`grant usage on schema public to anon, authenticated;
               grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);

const asDevice = async (uid) => db.exec(`select set_config('test.uid', '${uid ?? ''}', false)`);
const submit = async (o) => {
  const r = await db.query(
    `select public.submit_report($1,$2,$3,$4,$5,$6,$7,$8) as r`,
    [o.id ?? randomUUID(), o.line ?? 'yellow', o.kind ?? 'departed', o.station ?? 15,
     o.direction ?? 1, o.at ?? new Date().toISOString(), o.cell ?? null, o.network ?? null]);
  return r.rows[0].r.status;
};
const ago = (s) => new Date(Date.now() - s * 1000).toISOString();
const state = async () => (await db.query(`select public.get_live_state('yellow') as s`)).rows[0].s;

console.log('\nValidation');
await asDevice(null);
ok(await submit({}) === 'unauthenticated', 'rejects calls without a session');

const d1 = randomUUID(), d2 = randomUUID(), d3 = randomUUID(), d4 = randomUUID();
await asDevice(d1);
const rid = randomUUID();
ok(await submit({ id: rid }) === 'accepted', 'accepts a valid report');
ok(await submit({ id: rid }) === 'duplicate', 'same report id resent is ignored');
ok(await submit({}) === 'duplicate', 'double tap within 60s is ignored');
ok(await submit({ station: 99 }) === 'bad_station', 'rejects unknown station');
ok(await submit({ line: 'pink' }) === 'bad_station', 'rejects unknown line');
ok(await submit({ at: ago(3600) }) === 'bad_time', 'rejects observation 1h old');
ok(await submit({ at: ago(-600) }) === 'bad_time', 'rejects observation 10 min in future');
ok(await submit({ kind: 'teleport' }) === 'bad_kind', 'rejects unknown kind');
ok(await submit({ direction: 0 }) === 'bad_direction', 'rejects bad direction');
ok(await submit({ kind: 'cell', station: 3 }) === 'bad_cell', 'cell report needs a cell id');
ok(await submit({ kind: 'cell', station: 3, cell: '404-45-1234-5678', network: 'Jio' }) === 'accepted', 'accepts a cell report');

console.log('\nRate limit');
await asDevice(d4);
let last;
for (let i = 0; i < 31; i++) last = await submit({ station: i % 37, direction: i % 2 ? 1 : -1, at: ago(i) });
ok(last === 'rate_limited', '31st report in 10 min is rate limited', last);
await db.exec(`delete from reports where device_id = '${d4}'`);

console.log('\nRow level security');
await db.exec(`set role anon`);
const anonRows = (await db.query(`select count(*)::int as n from reports`)).rows[0].n;
let anonInsert = 'blocked';
try { await db.exec(`insert into reports (id, device_id, line_id, kind, station_idx, direction, observed_at)
                     values (gen_random_uuid(), gen_random_uuid(), 'yellow', 'departed', 1, 1, now())`); anonInsert = 'allowed'; }
catch { anonInsert = 'blocked'; }
const anonStations = (await db.query(`select count(*)::int as n from stations`)).rows[0].n;
await db.exec(`reset role`);
ok(anonRows === 0, 'public key cannot read raw reports', `saw ${anonRows}`);
ok(anonInsert === 'blocked', 'public key cannot insert reports directly');
ok(anonStations === 37, 'public key can read station list', `saw ${anonStations}`);

console.log('\nLive state: agreement and decay');
await db.exec(`delete from reports`);
for (const d of [d1, d2, d3]) { await asDevice(d); await submit({ station: 15, direction: 1, at: ago(20) }); }
await asDevice(d1); await submit({ station: 24, direction: -1, at: ago(540) }); // one device, 9 min old
let s = await state();
const rc = s.observations.find(o => o.station_idx === 15 && o.direction === 1);
const hk = s.observations.find(o => o.station_idx === 24);
ok(rc && rc.devices === 3 && rc.confidence === 'high', '3 fresh devices at Rajiv Chowk = high confidence', JSON.stringify(rc));
ok(hk && hk.confidence === 'low' && hk.score < 0.1, 'single 9-min-old report = low confidence, faded', JSON.stringify(hk));

await asDevice(d2); await submit({ station: 30, direction: 1, at: ago(14 * 60) });   // inside 15 min accept window
s = await state();
ok(!s.observations.find(o => o.station_idx === 30), 'reports older than 10 min drop out of live state');

console.log('\nStuck trains');
for (const d of [d1, d2]) { await asDevice(d); await submit({ kind: 'stuck', station: 11, direction: 1, at: ago(30) }); }
s = await state();
ok(!s.alerts.find(a => a.source === 'riders'), '2 stuck reports are not enough for an alert');
await asDevice(d3); await submit({ kind: 'stuck', station: 11, direction: 1, at: ago(25) });
s = await state();
const st = s.alerts.find(a => a.source === 'riders');
ok(st && st.station_idx === 11 && st.message.includes('Kashmere Gate'), '3 stuck reports create a rider alert', JSON.stringify(st));
for (const d of [d1, d2]) { await asDevice(d); await submit({ kind: 'cleared', station: 11, direction: 1, at: ago(2) }); }
s = await state();
ok(!s.alerts.find(a => a.source === 'riders'), '2 "moving again" reports clear the alert');

console.log('\nManual alerts');
await db.exec(`insert into alerts (line_id, from_idx, to_idx, severity, message) values ('yellow', 26, 27, 'warning', 'Delay between Saket and Qutab Minar');
               insert into alerts (line_id, from_idx, to_idx, severity, message, expires_at) values ('yellow', 1, 2, 'info', 'Old expired alert', now() - interval '1 minute');`);
s = await state();
const admin = s.alerts.filter(a => a.source === 'admin');
ok(admin.length === 1 && admin[0].message.startsWith('Delay'), 'active alert shown, expired alert hidden', JSON.stringify(admin));

console.log('\nBlocked devices');
const bad = randomUUID();
await db.exec(`insert into blocked_devices (device_id, reason) values ('${bad}', 'spam')`);
await asDevice(bad);
ok(await submit({ station: 5, direction: -1 }) === 'accepted', 'blocked device gets a normal-looking answer');
s = await state();
ok(!s.observations.find(o => o.station_idx === 5), 'blocked device reports never appear');

console.log('\nRetention');
await db.exec(`update reports set received_at = now() - interval '25 hours' where station_idx = 24`);
const purged = (await db.query(`select public.purge_old_reports() as n`)).rows[0].n;
ok(purged >= 1, 'purge removes reports older than 24h', `purged ${purged}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
