# ESP32 connection placeholders: single shared lid

This is the current connection contract for SmartMed. The backend and firmware are not implemented in this repository. The React frontend works in demo mode now and contains a live HTTP adapter ready for a backend implementing this contract.

## 1. What the device can measure

The box has four labelled sections: **Morning, Afternoon, Evening, Night**. Multiple prescribed medicines may be loaded in each section. There is **one lid for the entire box**, **one ultrasonic sensor**, **four LEDs**, and **one shared external buzzer**.

The sensor reports `BOX_OPENED` and `BOX_CLOSED`. It cannot determine a selected compartment, medicine, quantity removed, or ingestion. A backend may associate an opening with the reminder active at that time; that is timing context, not verification.

```text
React frontend <--- HTTPS ---> Spring Boot + MySQL <--- HTTPS / Wi-Fi ---> ESP32
                                                                         |
                                                      shared-lid sensor + 4 LEDs + buzzer
```

## 2. Exact files to change

| File | What to do |
| --- | --- |
| `.env.example` → `.env.local` | Set the public backend URL and switch demo to live after endpoints exist |
| `src/api/smartmed.js` | Search `ESP32 CONNECTION PLACEHOLDER`; map routes, session/CSRF handling, and response validation to your backend |
| `src/main.jsx` | Uses the adapter already; reads `dailyStatuses` from the backend in live mode |
| `src/model.js` | Shared frontend slot/event model and demo timing logic; not production firmware |
| Firmware project, to be created separately | Wi-Fi provisioning, timekeeping, sensing, alarms, durable queue, HTTPS uploads |

```dotenv
VITE_DATA_MODE=live
VITE_API_BASE_URL=https://YOUR-BACKEND/api/v1
```

Restart Vite after changing `.env.local`. `VITE_*` values are public browser-bundle values: never store Wi-Fi passwords or device credentials there. Keep this file out of Git. Demo mode uses a new `smartmed-shared-lid-v1` localStorage key; earlier per-compartment demo data is left untouched and is not reused as shared-lid evidence.

In live mode the app polls `GET /workspace` every 10 seconds and reloads it after successful mutations. A timeout, invalid payload, or failed request is shown as an error; it does not fall back to sample medicines. Live simulation controls are disabled/hidden.

## 3. Frontend API contract

Routes below are relative to `VITE_API_BASE_URL`. Successful mutations can return JSON or HTTP 204; the app fetches `/workspace` afterward. Return validation failures as non-2xx responses. Dates and timestamps must be valid; authorize access to the correct workspace on every route.

| Route | Purpose |
| --- | --- |
| `GET /workspace` | Complete patient-authorized dashboard snapshot |
| `POST /medicines` | Create a medicine entry in a daily slot |
| `PATCH /medicines/{id}` | Edit an entry |
| `DELETE /medicines/{id}` | Remove future scheduled entry; retain historical event snapshots |
| `PUT /slots` | Save four non-overlapping daily reminder times |
| `PUT /settings` | Save care and sensor/reminder preferences; create a desired device configuration version |

Medicine mutation body:

```json
{
  "name": "Example prescribed medicine",
  "strength": "500 mg",
  "quantity": "1 tablet",
  "instructions": "As prescribed",
  "slotId": "morning"
}
```

Slot IDs are exactly `morning`, `afternoon`, `evening`, `night`. One medicine entry belongs to one slot; if prescribed at two times, create two entries. Several medicines may share a slot. The prescription, not the software, determines quantities and instructions.

`PUT /slots` takes `{"slots": [...]}` with the same four slot objects as the snapshot. Validate reminder windows, including windows across midnight. `PUT /settings` takes the settings object below; validate numeric ranges and names server-side and return only approved fields in the snapshot.

### Example GET /workspace response

The single medicine and event below illustrate shape, not medical advice. A real response returns all medicine entries and all events currently loaded for display/export.

```json
{
  "slots": [
    {"id":"morning","label":"Morning","time":"08:00","color":"green"},
    {"id":"afternoon","label":"Afternoon","time":"13:00","color":"orange"},
    {"id":"evening","label":"Evening","time":"18:00","color":"purple"},
    {"id":"night","label":"Night","time":"21:00","color":"blue"}
  ],
  "medicines": [
    {"id":"m1","name":"Example prescribed medicine","strength":"500 mg","quantity":"1 tablet","instructions":"As prescribed","slotId":"morning"}
  ],
  "events": [
    {
      "id":"event-001",
      "deviceId":"SM-HOME-001",
      "type":"BOX_OPENED",
      "occurredAt":"2027-01-15T02:34:00Z",
      "source":"ESP32",
      "reminderContext": {
        "slotId":"morning",
        "label":"Morning",
        "date":"2027-01-15",
        "scheduledTime":"08:00",
        "medicines":[{"name":"Example prescribed medicine","strength":"500 mg","quantity":"1 tablet"}]
      }
    }
  ],
  "settings": {
    "patient":"Patient name",
    "caregiver":"Caregiver name",
    "timezone":"Asia/Kolkata",
    "threshold":8,
    "stability":1000,
    "grace":20,
    "repeat":5
  },
  "device": {
    "id":"SM-HOME-001",
    "online":true,
    "lidState":"CLOSED",
    "distanceCm":3.2,
    "ledSlotId":null,
    "buzzerActive":false,
    "lastSeen":"2027-01-15T02:40:00Z",
    "desiredConfigVersion":3,
    "appliedConfigVersion":3
  },
  "dailyStatuses": {
    "date":"2027-01-15",
    "bySlot": {
      "morning":"Box opened",
      "afternoon":"Not scheduled",
      "evening":"Not scheduled",
      "night":"Not scheduled"
    }
  }
}
```

Sort events newest first. Event `type` in this view must be `BOX_OPENED` or `BOX_CLOSED`; expose sensor faults through device health, or extend the frontend explicitly. For an opening outside a reminder window, or for a closing event, return `reminderContext: null`. An associated event must carry an immutable snapshot of the scheduled slot and medicines as context; never rewrite it after schedule edits. It does not mean those medicines were selected.

`dailyStatuses.date` is the patient's local date. Allowed display values: `Upcoming`, `Due now`, `Box opened`, `No opening recorded`, `Awaiting sync`, `Monitoring unavailable`, and `Not scheduled`. Missing or stale status dates display as `Awaiting sync`. Device `online` must be derived from recent heartbeats, not a permanent database flag. Use `lidState: "UNKNOWN"` and `distanceCm: null` for invalid readings. Only report `ledSlotId` and `buzzerActive` from actual output telemetry.

For long histories, add cursor pagination and date filters to the adapter/UI; the existing CSV exports only loaded records. Production recurring reminders need separate dated reminder/dose instances in the database, not mutable medicine-level “taken” flags.

## 4. ESP32-facing endpoints to implement in Spring Boot

These endpoints are for firmware, not direct browser calls. Prefix them with `/api/v1` as appropriate.

| Route | Firmware operation |
| --- | --- |
| `GET /devices/{id}/config` | Download calibrated sensor settings, desired configuration version, and LED GPIO mapping/slot identity |
| `GET /devices/{id}/reminders?from=...&to=...` | Download dated reminder instances for the next 48 hours |
| `POST /devices/{id}/events` | Upload durable batches of shared-lid events |
| `POST /devices/{id}/heartbeat` | Report readings, outputs, clock health, configuration versions, queue state, and last event sequence |

The backend generates stable reminder-instance IDs, `scheduledAt` and `windowEndsAt` in UTC, slot ID, and schedule version. Return a complete snapshot for a stated horizon so firmware can remove canceled future reminders. The slot identifies the LED to blink, not a sensor channel. Store the snapshot persistently and surface an expired schedule; do not silently keep obsolete alarms.

Example firmware event upload:

```json
{
  "events": [
    {
      "eventId":"a-unique-persisted-uuid",
      "deviceId":"SM-HOME-001",
      "type":"BOX_OPENED",
      "occurredAt":"2027-01-15T02:34:00Z",
      "sequence":1042,
      "timeQuality":"RTC_SYNCED",
      "sensorType":"ULTRASONIC",
      "distanceCm":14.1
    }
  ]
}
```

There is deliberately **no detected `compartmentId` or medicine ID**. Backend association uses a valid event timestamp and one active reminder window. It can attach the matching reminder-instance ID internally and present the `reminderContext` snapshot above. Unscheduled openings remain visible without satisfying a reminder.

Commit to the database before replying:

```json
{"acknowledgedEventIds":["a-unique-persisted-uuid"]}
```

Use a unique `(device_id, event_id)` database constraint. An identical retry returns the same acknowledgment without duplicating history; conflicting payloads under the same ID are rejected. Firmware deletes only acknowledged events. Retrying uploads must reuse the original event ID and occurrence time.

Configuration must include measured closed baseline, open and lower close thresholds, stability window, invalid-reading handling, reminder repeat/follow-up intervals, and a version. Values of 8 cm and 1000 ms in the UI are unvalidated examples. The backend must reject a threshold incompatible with the calibrated closing threshold. Firmware validates and atomically applies a configuration, then reports `appliedConfigVersion`. Until then show pending sync.

## 5. Firmware behavior

1. Connect to 2.4 GHz Wi-Fi; establish valid time using network time and, preferably, a DS3231 backup clock.
2. Read the one shared-lid sensor with bounded echo timeouts and filtered valid readings.
3. Detect stable CLOSED → OPEN and OPEN → CLOSED transitions with calibrated thresholds and hysteresis. Never equate no echo with open without a validated detection method.
4. At a reminder time, blink only its slot LED and sound the one external buzzer. This must work without Wi-Fi.
5. On the first opening during that window, stop that reminder's buzzer/blinking, and persist a `BOX_OPENED` event. This acknowledges access only. Do not suggest medicine intake is verified.
6. Wait for a stable close before another opening can be logged. Report close events too.
7. Upload queued events and heartbeats without blocking sensing or reminders. Retry failures with backoff/jitter.
8. After restart, reconcile clock, queue, lid state, and active reminder. An already-open lid at boot is a state report, not proof of a new opening.

If the lid was already open when a reminder became due, flag that condition and continue a defined reminder policy; do not fabricate a fresh opening. If monitoring fails, record the monitoring gap.

## 6. Connectivity, auth, and verification

- Browser API requests use `credentials: include`. Implement backend session login, authorization, CSRF protection, and the adapter's CSRF-header placeholder before enabling mutations with real patient data.
- Prefer frontend and API on the same HTTPS origin. For separate origins, explicitly configure CORS, cookie attributes, and credentials; never use wildcard origins with credentialed requests.
- Each ESP32 needs its own revocable device credential. Keep it out of Git, logs, URLs, and the React bundle. Authenticate the device ID against that credential. Validate server certificates on the ESP32.
- `localhost` on the ESP32 means the ESP32, not your development computer. Use a reachable LAN backend address for a controlled bench test, or a public HTTPS endpoint for deployment. Home Wi-Fi cannot reach an isolated cloud workspace's private IP directly.
- Store timestamps in UTC; render the patient timezone. Production backend handles timezone/DST rules and window reconciliation. Demo timing uses local wall-clock windows and defaults to Asia/Kolkata.
- Preserve queued events across power loss. A heartbeat does not prove an offline window had no openings. Finalize `No opening recorded` only after acknowledged event coverage and healthy monitoring establish it; otherwise keep `Awaiting sync` or `Monitoring unavailable`.
- Daily refilling is manual. The system does not measure pill count or verify loading.

Acceptance check: a physical shared-lid opening → one committed backend event → updated dashboard within its polling interval. Repeat the upload, disconnect/reconnect Wi-Fi, restart the board, cross a local midnight, and edit a schedule. Confirm no duplicate event, false medicine confirmation, or lost historical context.
