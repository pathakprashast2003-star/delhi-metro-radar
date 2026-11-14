// Builds data/network.json (all lines, routes, branches, stations) from a GTFS folder,
// then writes supabase/migrations/0002_seed_network.sql which loads it with apply_network().
//
// Usage: node scripts/build_network.mjs <path-to-gtfs-folder>
//
// The GTFS copy in this project is an old third-party snapshot. Station ORDER and
// branch structure are used here; timings are not. Check the result against the
// current DMRC map before launch (newer extensions will be missing).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const gtfs = process.argv[2];
if (!gtfs) { console.error('usage: node scripts/build_network.mjs <gtfs-folder>'); process.exit(1); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// CSV with quoted fields ("Saket, Malviya Nagar") handled properly
const parseLine = (line) => {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  if (q) throw new Error('unterminated quote in CSV line: ' + line);
  out.push(cur);
  return out;
};
const csv = (file) => {
  const [head, ...rows] = readFileSync(join(gtfs, file), 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const cols = parseLine(head);
  return rows.map((r) => {
    const v = parseLine(r);
    if (v.length !== cols.length) throw new Error(`${file}: expected ${cols.length} fields, got ${v.length}: ${r}`);
    return Object.fromEntries(cols.map((c, i) => [c, v[i]]));
  });
};

// GTFS line prefix -> our line id and display name
const LINES = {
  YELLOW: ['yellow', 'Yellow Line'], BLUE: ['blue', 'Blue Line'], RED: ['red', 'Red Line'],
  GREEN: ['green', 'Green Line'], VIOLET: ['violet', 'Violet Line'], PINK: ['pink', 'Pink Line'],
  MAGENTA: ['magenta', 'Magenta Line'], GRAY: ['grey', 'Grey Line'],
  'ORANGE/AIRPORT': ['airport', 'Airport Express (Orange Line)'],
  RAPID: ['rapid', 'Rapid Metro Gurugram'], AQUA: ['aqua', 'Aqua Line (Noida Metro)'],
};
// Which terminal a line's main route starts from (keeps Yellow in the same order as the frontend).
const START = { yellow: 'Samaypur Badli', blue: 'Dwarka Sector - 21' };
// Renames since the snapshot: old GTFS name -> [current name, alias]
// Source defects: stops that the snapshot wrongly lists on a line.
// Rapid Metro's own Sikanderpur stop is separate from the Yellow Line one (linked by a walkway).
const DROP = { rapid: ['Sikanderpur'] };
const RENAMES = { 'Huda City Centre': ['Millennium City Centre Gurugram', 'HUDA City Centre'] };
// Yellow Line ids already used by the frontend (src/data/yellow_line_service.json), in route order.
const YELLOW_IDS = ['samaypur_badli','rohini_18_19','haiderpur_badli_mor','jahangirpuri','adarsh_nagar','azadpur',
  'model_town','gtb_nagar','vishwavidyalaya','vidhan_sabha','civil_lines','kashmere_gate','chandni_chowk','chawri_bazar',
  'new_delhi','rajiv_chowk','patel_chowk','central_secretariat','udyog_bhawan','lok_kalyan_marg','jor_bagh','dilli_haat_ina',
  'aiims','green_park','hauz_khas','malviya_nagar','saket','qutab_minar','chhatarpur','sultanpur','ghitorni','arjan_garh',
  'guru_dronacharya','sikanderpur','mg_road','iffco_chowk','millennium_city_centre'];

const slug = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const stops = Object.fromEntries(csv('stops.txt').map((s) => [s.stop_id, s]));
const routeLine = {};
for (const r of csv('routes.txt')) {
  const prefix = r.route_long_name.split('_')[0];
  if (!LINES[prefix]) throw new Error('unknown line prefix: ' + prefix);
  routeLine[r.route_id] = LINES[prefix][0];
}
const tripRoute = Object.fromEntries(csv('trips.txt').map((t) => [t.trip_id, t.route_id]));
const tripStops = {};
for (const st of csv('stop_times.txt')) (tripStops[st.trip_id] ??= []).push([+st.stop_sequence, st.stop_id]);

// distinct stop patterns per line
const patterns = {};
for (const [trip, list] of Object.entries(tripStops)) {
  const line = routeLine[tripRoute[trip]];
  const key = list.sort((a, b) => a[0] - b[0]).map((x) => x[1])
    .filter((sid) => !(DROP[line] ?? []).includes(stops[sid].stop_name.trim())).join('>');
  (patterns[line] ??= new Set()).add(key);
}

const isSubRun = (small, big) => {
  for (let i = 0; i + small.length <= big.length; i++) if (small.every((s, j) => big[i + j] === s)) return true;
  return false;
};
const pairs = (r) => new Set(r.slice(1).map((s, i) => r[i] + '>' + s));

const stationId = {};           // gtfs stop_id -> our id
const out = { version: '', source: 'Third-party GTFS snapshot (pre-2023). Order and branches only. Unverified.',
  lines: [], stations: [], routes: [], turnbacks: [] };

for (const [line, set] of Object.entries(patterns).sort()) {
  const all = [...set].map((k) => k.split('>')).sort((a, b) => b.length - a.length || a.join().localeCompare(b.join()));
  const kept = [];
  const turnbacks = new Set();
  for (let p of all) {
    const rev = [...p].reverse();
    const host = kept.find((k) => isSubRun(p, k) || isSubRun(rev, k));
    if (host) {                                   // short-turn service: remember where it ends
      for (const end of [p[0], p[p.length - 1]]) if (end !== host[0] && end !== host[host.length - 1]) turnbacks.add(end);
      continue;
    }
    if (!kept.length) {
      const want = START[line];
      const firstName = (x) => stops[x[0]].stop_name;
      if (want ? firstName(p) !== want : firstName(rev) < firstName(p)) p = rev;
    } else {                                      // orient to agree with routes already kept
      const score = (x) => kept.reduce((n, k) => {
        const kp = pairs(k); let s = 0;
        for (const pr of pairs(x)) if (kp.has(pr)) s += 2;
        if (!s) { if (x[0] === k[k.length - 1]) s += 1; if (x[x.length - 1] === k[0]) s += 1; }
        return n + s; }, 0);
      if (score(rev) > score(p)) p = rev;
    }
    kept.push(p);
  }
  if (START[line] && stops[kept[0][0]].stop_name.trim() !== START[line]) throw new Error(`${line}: no route starts at "${START[line]}"`);
  // two routes that only meet end-to-start are one through route split in the data (Aqua): join them
  for (let merged = true; merged;) {
    merged = false;
    for (const a of kept) for (const b of kept) {
      if (a === b || a[a.length - 1] !== b[0] || a.filter((x) => b.includes(x)).length !== 1) continue;
      turnbacks.add(b[0]);
      kept.splice(kept.indexOf(a), 1, [...a, ...b.slice(1)]); kept.splice(kept.indexOf(b), 1);
      merged = true; break;
    }
  }
  out.lines.push({ id: line, name: Object.values(LINES).find((l) => l[0] === line)[1] });
  kept.forEach((p, i) => {
    p.forEach((sid, pos) => {
      if (stationId[sid]) return;
      const raw = stops[sid].stop_name.trim();
      const [name, alias] = RENAMES[raw] ?? [raw, null];
      let id = slug(name);
      if (line === 'yellow' && i === 0) id = YELLOW_IDS[pos];
      if (Object.values(stationId).includes(id)) throw new Error('duplicate station id ' + id);
      stationId[sid] = id;
      out.stations.push({ id, name, aliases: alias ? [alias] : [], lat: +stops[sid].stop_lat, lon: +stops[sid].stop_lon });
    });
    const ids = p.map((s) => stationId[s]);
    out.routes.push({ id: `${line}_${i + 1}`, line, stops: ids,
      name: `${out.stations.find((s) => s.id === ids[0]).name} – ${out.stations.find((s) => s.id === ids[ids.length - 1]).name}` });
  });
  for (const t of turnbacks) out.turnbacks.push({ line, station: stationId[t] });
}
if (out.routes.find((r) => r.id === 'yellow_1').stops.length !== YELLOW_IDS.length) throw new Error('Yellow Line is not 37 stations');

// changes since the snapshot (new stations, extensions, new sections), kept by hand in data/network_updates.json
const upd = JSON.parse(readFileSync(join(root, 'data/network_updates.json'), 'utf8'));
const nameOf = (id) => { const s = out.stations.find((x) => x.id === id); if (!s) throw new Error('updates: unknown station ' + id); return s.name; };
for (const s of upd.stations ?? []) {
  if (out.stations.some((x) => x.id === s.id)) throw new Error('updates: station already exists: ' + s.id);
  const st = { id: s.id, name: s.name, aliases: s.aliases ?? [] };
  if (s.lat != null && s.lon != null) { st.lat = s.lat; st.lon = s.lon; }
  out.stations.push(st);
}
for (const e of upd.extend ?? []) {
  const r = out.routes.find((x) => x.id === e.route);
  if (!r) throw new Error('updates: unknown route ' + e.route);
  r.stops = [...(e.prepend ?? []), ...r.stops, ...(e.append ?? [])];
  r.name = `${nameOf(r.stops[0])} \u2013 ${nameOf(r.stops[r.stops.length - 1])}`;
}
for (const r of upd.routes ?? []) {
  if (out.routes.some((x) => x.id === r.id)) throw new Error('updates: route already exists: ' + r.id);
  if (!out.lines.some((l) => l.id === r.line)) throw new Error('updates: unknown line ' + r.line);
  out.routes.push({ id: r.id, line: r.line, stops: r.stops, name: `${nameOf(r.stops[0])} \u2013 ${nameOf(r.stops[r.stops.length - 1])}` });
}
for (const r of out.routes) {
  r.stops.forEach(nameOf);
  if (new Set(r.stops).size !== r.stops.length) throw new Error('station twice in route ' + r.id);
}
const used = new Set(out.routes.flatMap((r) => r.stops));
for (const s of out.stations) if (!used.has(s.id)) throw new Error('station on no route: ' + s.id);
out.source += ` Updated by hand to ${upd.as_of} (data/network_updates.json).`;
out.stations.sort((a, b) => a.id.localeCompare(b.id));

// sanity checks on the result
const noCoords = [];
for (const s of out.stations) {
  if (s.lat == null && s.lon == null) { noCoords.push(s.id); continue; }
  if (!(s.lat > 28 && s.lat < 29.2 && s.lon > 76.6 && s.lon < 77.9)) throw new Error(`station outside Delhi NCR: ${s.id} ${s.lat},${s.lon}`);
  if (!s.name || /["\n]/.test(s.name)) throw new Error('suspicious station name: ' + JSON.stringify(s.name));
}
const warnings = [];
const metres = (a, b) => Math.hypot((a.lat - b.lat) * 111000, (a.lon - b.lon) * 97500);
out.stations.forEach((a, i) => out.stations.slice(i + 1).forEach((b) => {
  if (a.lat != null && b.lat != null && metres(a, b) < 50) warnings.push(`${a.id} and ${b.id} are ${Math.round(metres(a, b))} m apart in the source data`);
}));
out.version = 'gtfs-' + createHash('sha256').update(JSON.stringify([out.lines, out.stations, out.routes, out.turnbacks])).digest('hex').slice(0, 12);

mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(join(root, 'data/network.json'), JSON.stringify(out, null, 1) + '\n');
const json = JSON.stringify(out);
if (json.includes('$network$')) throw new Error('unsafe content');
writeFileSync(join(root, 'supabase/migrations/0002_seed_network.sql'),
  `-- Generated by scripts/build_network.mjs — do not edit by hand.\n-- ${out.source}\n` +
  `select public.apply_network($network$${json}$network$::jsonb);\n`);
console.log(`${out.lines.length} lines, ${out.routes.length} routes, ${out.stations.length} stations, ${out.turnbacks.length} turnbacks`);
for (const r of out.routes) console.log(' ', r.id.padEnd(10), String(r.stops.length).padStart(2), r.name);
if (noCoords.length) console.log(`  NOTE: ${noCoords.length} newer stations have no coordinates yet: ${noCoords.join(', ')}`);
for (const w of warnings) console.log('  WARNING:', w);
console.log('  turnbacks:', out.turnbacks.map((t) => `${t.line}:${t.station}`).join(', '));
