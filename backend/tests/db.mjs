// Test database helper. Two modes:
//   DATABASE_URL set  -> a real Postgres (fresh database per run, real roles, parallel connections)
//   not set           -> embedded Postgres (PGlite): same checks, minus the parallel-connection tests
//
// Every call runs the way Supabase runs it: inside one transaction, as the given
// role, with the caller's user id in request.jwt.claim.sub.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const SUPABASE_SHIM = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role nologin bypassrls; end if;
  end $$;
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase hands every new table and function in public to these roles by default.
  alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export async function openDb() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pg = (await import('pg')).default;
    const name = 'dmr_test_' + randomBytes(5).toString('hex');
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    await admin.query(`create database ${name}`);
    const dbUrl = new URL(url); dbUrl.pathname = '/' + name;
    const pool = new pg.Pool({ connectionString: dbUrl.toString(), max: 60, options: '-c search_path=metro,public' });
    pool.on('error', () => {});
    const exec = (sql) => pool.query(sql);
    const call = async (role, uid, sql, params = [], timeoutMs = 0, readOnly = false) => {
      const c = await pool.connect();
      try {
        await c.query(readOnly ? 'begin read only' : 'begin');
        await c.query(`set local role ${role}`);
        await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
        if (timeoutMs) await c.query(`set local statement_timeout = ${Number(timeoutMs)}`);
        const r = await c.query(sql, params);
        await c.query('commit');
        return r.rows;
      } catch (e) { await c.query('rollback').catch(() => {}); throw e; }
      finally { c.release(); }
    };
    return {
      real: true, exec, call,
      query: async (sql, params = []) => (await pool.query(sql, params)).rows,
      close: async () => { await pool.end(); await admin.query(`drop database ${name} with (force)`); await admin.end(); },
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`set search_path = metro, public`);
  const call = async (role, uid, sql, params = [], timeoutMs = 0, readOnly = false) => {
    await db.exec(readOnly ? 'begin read only' : 'begin');
    try {
      await db.exec(`set local role ${role}`);
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
      const r = await db.query(sql, params);
      await db.exec('commit');
      return r.rows;
    } catch (e) { await db.exec('rollback').catch(() => {}); throw e; }
  };
  return {
    real: false, call,
    exec: (sql) => db.exec(sql),
    query: async (sql, params = []) => (await db.query(sql, params)).rows,
    close: async () => db.close(),
  };
}

export async function install(db) {
  await db.exec(SUPABASE_SHIM);
  await db.exec(readFileSync(new URL('../supabase/migrations/0001_live_reports.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/0002_seed_network.sql', import.meta.url), 'utf8'));
}
