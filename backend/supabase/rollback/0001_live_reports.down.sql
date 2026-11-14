-- Removes everything 0001_live_reports.sql created. All live data is lost.
begin;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin perform cron.unschedule('dmr-purge-old-reports'); exception when others then null; end;
    begin perform cron.unschedule('dmr-refresh-live-state'); exception when others then null; end;
  end if;
end $$;
drop function if exists
  public.get_health(), public.admin_unblock_device(uuid), public.admin_block_device(uuid, text),
  public.admin_clear_alert(bigint), public.admin_set_alert(text, text, text, text, text, integer),
  public.get_live_state(text), public.submit_report(uuid, text, text, text, text, numeric),
  public.schedule_purge(), public.refresh_live_state(), public.purge_old_reports(integer, integer), public.get_network(), public.apply_network(jsonb);
drop schema if exists metro cascade;
commit;
