# Delhi Metro Radar — Live Reports Backend (Supabase / Postgres)

A lightweight, zero-maintenance crowdsourced consensus backend for real-time metro tracking corrections.

---

## 1. What This Backend Does

The browser's scheduled timetable is **always the self-contained baseline**. This backend provides real-time, peer-to-peer corrections on top of the schedule by aggregating observations from actual riders traveling on the Yellow Line.

```
                  ┌─────────────────────────────────────────┐
                  │          Riders on Yellow Line          │
                  │   ("Train left Rajiv Chowk just now")   │
                  └────────────────────┬────────────────────┘
                                       │ 1-tap anonymous report
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │       PostgreSQL / Supabase Edge        │
                  │  • Deduplication & rate-limiting        │
                  │  • Temporal half-life decay (300s)      │
                  │  • Consensus threshold (3+ riders)      │
                  │  • Automated "Stuck Train" alerts       │
                  └────────────────────┬────────────────────┘
                                       │ get_live_state('yellow')
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │           Every Waiting Rider           │
                  │   "🟢 Live Verified: Left Rajiv Chowk"   │
                  │   "⚠️ Advisory: Train held at Patel Ch" │
                  └─────────────────────────────────────────┘
```

### Core Functions & Capabilities:
1. **Consensus-Driven Verification**: 
   - 1 rider reporting = *Low confidence* (provisional).
   - 3+ independent riders reporting within 5 minutes = *High confidence* (`confidence: 'high'`).
2. **Exponential Half-Life Decay**:
   - Observations automatically decay using a 5-minute half-life formula:
     $$\text{score} = \sum 0.5^{(\text{age} / 300\text{s})}$$
   - Observations older than 10 minutes automatically drop out. Zero manual cleanup required.
3. **Automated Stuck-Train Detection**:
   - When 3 or more distinct riders report being `stuck` at the same station, the backend automatically generates a line advisory for that sector.
   - When 2 riders report `cleared` (train moving again), the advisory automatically clears.
4. **Anti-Troll & Security Defenses**:
   - Device identity uses anonymous cryptographic UUIDs (`auth.uid()`). No phone numbers, names, or emails are ever requested or stored.
   - Double-taps from the same device within 60 seconds are silently deduplicated.
   - Rate limit: Maximum 30 reports per 10 minutes per device; spammers are automatically rate-limited.
   - Row-Level Security (RLS): Anonymous API keys can only execute `submit_report()` and `get_live_state()`; direct reads/writes to raw report tables are blocked.

---

## 2. Directory Layout

```
backend/
├── package.json              # Embedded test runner (@electric-sql/pglite)
├── README.md                 # System overview and operational guide
├── supabase/
│   └── migrations/
│       ├── 0001_live_reports.sql     # Core tables, functions, RLS & decay logic
│       └── 0002_seed_yellow_line.sql # Station index reference data (0-36)
└── tests/
    └── run_tests.mjs         # 26 automated unit & integration tests on PGlite
```

---

## 3. Running Automated Tests Locally

This backend includes an embedded PostgreSQL test harness that runs in Node.js without needing Docker or a remote database:

```bash
cd backend
npm test
```

Expected output:
```
Validation: 12 tests passed
Rate limit: 1 test passed
Row level security: 3 tests passed
Live state & decay: 3 tests passed
Stuck trains: 3 tests passed
Manual alerts: 1 test passed
Blocked devices: 2 tests passed
Retention: 1 test passed

26 passed, 0 failed
```

---

## 4. Deploying to Supabase (Free Tier)

1. Create a free project at [supabase.com](https://supabase.com).
2. Link your project via the Supabase CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-id>
   ```
3. Push the migrations:
   ```bash
   npx supabase db push
   ```
4. Copy your project's **URL** and **Anon Public Key** from the Supabase dashboard into `src/data/backend_config.json`:
   ```json
   {
     "supabaseUrl": "https://your-project.supabase.co",
     "supabaseAnonKey": "your-anon-public-key",
     "line": "yellow",
     "pollIntervalMs": 30000,
     "enabled": true
   }
   ```

---

## 5. API Contracts

### A. Submit an Observation (`public.submit_report`)
```sql
SELECT public.submit_report(
  p_id          := '550e8400-e29b-41d4-a716-446655440000', -- Client UUID (idempotency key)
  p_line        := 'yellow',
  p_kind        := 'departed', -- 'arrived' | 'departed' | 'stuck' | 'cleared' | 'cell'
  p_station     := 15,         -- Rajiv Chowk
  p_direction   := 1,          -- 1 = Southbound (➔ MCC), -1 = Northbound (➔ Badli)
  p_observed_at := now(),
  p_cell_id     := NULL,
  p_network     := NULL
);
```
**Response**: `{"ok": true, "status": "accepted"}`

### B. Query Aggregated State (`public.get_live_state`)
```sql
SELECT public.get_live_state('yellow');
```
**Response**:
```json
{
  "line": "yellow",
  "generated_at": "2026-11-09T10:45:00Z",
  "observations": [
    {
      "station_idx": 15,
      "direction": 1,
      "kind": "departed",
      "devices": 3,
      "score": 2.85,
      "confidence": "high",
      "typical_observed_at": "2026-11-09T10:44:40Z",
      "age_s": 20
    }
  ],
  "alerts": []
}
```

