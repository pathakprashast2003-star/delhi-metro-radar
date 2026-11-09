/**
 * Delhi Metro Radar — Live Client Bridge (Supabase REST API Integration)
 * Connects the frontend to the crowdsourced consensus backend.
 * 
 * Design rule:
 * The static timetable is always the primary fallback.
 * If Supabase is unconfigured, unreachable, or offline, this module
 * degrades silently to local scheduled mode with zero errors.
 */

window.LiveClient = (function() {
  let config = {
    supabaseUrl: '',
    supabaseAnonKey: '',
    line: 'yellow',
    pollIntervalMs: 30000,
    enabled: false
  };

  let currentState = {
    line: 'yellow',
    generated_at: null,
    observations: [],
    alerts: []
  };

  let listeners = [];
  let pollTimer = null;

  function getDeviceId() {
    let id = localStorage.getItem('dmrc_device_id');
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('dmrc_device_id', id);
    }
    return id;
  }

  async function init() {
    try {
      const res = await fetch('src/data/backend_config.json');
      if (res.ok) {
        config = Object.assign(config, await res.json());
      }
    } catch (e) {
      console.warn('[LiveClient] backend_config.json not loaded, staying offline.');
    }

    if (config.enabled && config.supabaseUrl && config.supabaseAnonKey) {
      console.log('[LiveClient] Supabase live reports enabled. Polling every ' + (config.pollIntervalMs / 1000) + 's');
      await fetchLiveState();
      pollTimer = setInterval(fetchLiveState, Math.max(10000, config.pollIntervalMs));
    } else {
      console.log('[LiveClient] Supabase live reports disabled. Running in 100% client-side timetable mode.');
    }
  }

  async function fetchLiveState() {
    if (!config.enabled || !config.supabaseUrl || !config.supabaseAnonKey) return currentState;

    try {
      const url = `${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/get_live_state`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': config.supabaseAnonKey,
          'Authorization': `Bearer ${config.supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_line: config.line })
      });

      if (res.ok) {
        currentState = await res.json();
        listeners.forEach(fn => fn(currentState));
      }
    } catch (e) {
      console.warn('[LiveClient] fetchLiveState network warning:', e);
    }
    return currentState;
  }

  async function submitReport(opts) {
    const reportId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'rep_' + Math.random().toString(36).slice(2);
    const payload = {
      p_id: reportId,
      p_line: config.line,
      p_kind: opts.kind || 'stuck', // 'departed' | 'arrived' | 'stuck' | 'cleared'
      p_station: Number(opts.stationIdx),
      p_direction: opts.direction === 'south' ? 1 : (opts.direction === 'north' ? -1 : (opts.direction || 1)),
      p_observed_at: new Date().toISOString(),
      p_cell_id: opts.cellId || null,
      p_network: opts.network || null
    };

    // Save locally for instant UI feedback regardless of network
    const localKey = 'dmrc_reported_delay_' + opts.stationIdx;
    localStorage.setItem(localKey, Date.now());

    if (!config.enabled || !config.supabaseUrl || !config.supabaseAnonKey) {
      console.log('[LiveClient] Report stored locally (remote backend disabled):', payload);
      return { ok: true, status: 'accepted_local' };
    }

    try {
      const url = `${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/submit_report`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': config.supabaseAnonKey,
          'Authorization': `Bearer ${config.supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        console.log('[LiveClient] submit_report response:', data);
        fetchLiveState(); // Refresh immediately after submitting
        return data;
      }
    } catch (e) {
      console.warn('[LiveClient] submitReport network failed, local report retained:', e);
    }

    return { ok: true, status: 'accepted_local_fallback' };
  }

  function onStateUpdate(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function getStationLiveObservation(stationIdx, direction) {
    if (!currentState || !currentState.observations) return null;
    const dirVal = (direction === 'south') ? 1 : -1;
    return currentState.observations.find(o => o.station_idx === stationIdx && o.direction === dirVal) || null;
  }

  return {
    init,
    submitReport,
    fetchLiveState,
    onStateUpdate,
    getStationLiveObservation,
    getLiveState: () => currentState,
    getDeviceId,
    isRemoteEnabled: () => config.enabled
  };
})();
