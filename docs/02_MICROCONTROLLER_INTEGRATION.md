# 2. Integrate the web app with the microcontroller

For the complete component design, see [System architecture](04_SYSTEM_ARCHITECTURE.md). For physical wiring, see [Hardware connections](03_HARDWARE_CONNECTIONS.md). Hardware setup is intentionally kept outside the user interface. The app has patient sign-in followed by Today, Schedule, and History. It contains no sample patients, sample medicines, device simulator, or invented box readings.

## 1. Connection overview

```text
React frontend <-- HTTPS --> Spring Boot + PostgreSQL <-- HTTPS / Wi-Fi --> ESP32
                                                                     |
                                                one ultrasonic sensor + four LEDs + buzzer
```

There are four labelled sections: Morning, Afternoon, Evening, Night, under one shared lid. Several medicines may share a section. The one sensor reports `BOX_OPENED` and `BOX_CLOSED`; it cannot identify a selected compartment, medicine, quantity, or ingestion. Reminder association is timing context only.

## 2. Configuration and code locations

| File | Purpose |
| --- | --- |
| `.env.example` copied to `.env.local` | Public API URL and `local` or `live` data mode |
| `src/api/smartmed.js` | API integration hooks; search `CONNECTION PLACEHOLDER` |
| `src/model.js` | Empty workspace structure, validation, time helpers, CSV escaping |
| `src/main.jsx` | User-facing Today, Schedule, History; no sensor configuration UI |
| Separate firmware project | Credentials, Wi-Fi, calibrated sensing, timekeeping, local alarms, durable events |

Default mode is `local`: an empty schedule with only user-entered data saved in this browser, no sensor events or physical alarms. In-app reminder popups work for user-entered schedules while the dashboard is active. Earlier demo storage keys are preserved but ignored. The new storage key is `smartmed-personal-workspace-v1`.

After implementing the backend:

```dotenv
VITE_DATA_MODE=live
VITE_API_BASE_URL=https://YOUR-BACKEND/api/v1
```

Restart Vite after editing `.env.local`. Browser variables are public; never place device tokens or Wi-Fi passwords in them. Live mode polls every 10 seconds. Invalid data, failed writes, and connection errors are reported without synthetic fallback. No manual create-event endpoint is exposed by the frontend adapter.

## 3. Frontend contract

| Endpoint | Purpose |
| --- | --- |
| `GET /workspace` | Authenticated, authorized schedule and real event snapshot |
| `POST /medicines` | Create a medicine and atomically apply its section reminder time |
| `PATCH /medicines/{id}` | Edit a medicine and atomically apply its section reminder time |
| `DELETE /medicines/{id}` | Remove future entry; preserve immutable historical events |
| `PUT /slots` | Update all four section times; unused times may be null |

Medicine mutations contain `name`, `strength`, `quantity`, optional `instructions`, `slotId`, and `reminderTime` (`HH:mm`). An edit also includes `id`. **Apply the medicine and its shared section time in one database transaction.** Changing the time affects every medicine in that section. Return non-2xx on validation failure so the UI does not claim a save. Successful writes return JSON or HTTP 204; the app then reloads the workspace.

Enforce the four exact slot IDs and valid times server-side. Sections with medicines must have a time; unused sections may have `time: null`. Prevent overlapping follow-up windows, including across midnight. `PUT /slots` takes `{"slots": [...]}`.

### Empty workspace response shape

```json
{
  "slots": [
    {"id":"morning","label":"Morning","time":null},
    {"id":"afternoon","label":"Afternoon","time":null},
    {"id":"evening","label":"Evening","time":null},
    {"id":"night","label":"Night","time":null}
  ],
  "medicines": [],
  "events": [],
  "settings": {"timezone":"Asia/Kolkata","grace":20},
  "device": null
}
```

Populate only real user records. Medicine records require a stable string `id`, `name`, `strength`, `quantity`, `slotId`, and optionally `instructions`. Never seed production records from examples. `settings.timezone` is the patient's real IANA timezone; `grace` is an integer from 1 to 180.

Each real event must have a string `id`, `type` (`BOX_OPENED` or `BOX_CLOSED`), valid UTC `occurredAt`, and optional `reminderContext`. A context has the reminder `label` and can retain internal slot/date/prescription snapshots for audit. Do not imply that context proves medicine selection. For unscheduled events, use null. Preserve context after schedule edits.

When a box has actually been provisioned, `device` may contain its `id`, heartbeat-derived `online` boolean, and UTC `lastSeen`. The user interface displays connected only when the report is less than 90 seconds old. Sensor distances, output states, firmware versions, and thresholds do not belong in this user view.

Schedule previews are based on entered times, not claims about completed intake. The app makes no missed-dose conclusion from absent events. Keep event ingestion and reminder reconciliation on the backend. Do not encode recurring medicine entries as mutable “taken” flags.

For long histories, add cursor pagination/date filtering to the API adapter and UI. Existing export covers loaded events only. The browser uses cookie credentials and the session CSRF token in the `X-CSRF-Token` header. Implement the server-side contract below before production writes.

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

Configuration must include measured closed baseline, open and lower close thresholds, stability window, invalid-reading handling, reminder repeat/follow-up intervals, and a version. Sensor thresholds belong in protected device configuration, not the patient interface. The backend must reject a threshold incompatible with the calibrated closing threshold. Firmware validates and atomically applies a configuration, then reports `appliedConfigVersion`. Retain and track the pending configuration in the backend until acknowledgment; keep diagnostics out of the patient interface.

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
- Store timestamps in UTC; render the patient timezone. Production backend handles timezone/DST rules and window reconciliation. Local-only schedules use the browser timezone. Live workspaces use the patient timezone returned by the backend.
- Preserve queued events across power loss. A heartbeat does not prove an offline window had no openings. Finalize `No opening recorded` only after acknowledged event coverage and healthy monitoring establish it; otherwise keep `Awaiting sync` or `Monitoring unavailable`.
- Daily refilling is manual. The system does not measure pill count or verify loading.

Acceptance check: a physical shared-lid opening → one committed backend event → updated dashboard within its polling interval. Repeat the upload, disconnect/reconnect Wi-Fi, restart the board, cross a local midnight, and edit a schedule. Confirm no duplicate event, false medicine confirmation, or lost historical context.

## 7. Patient session endpoints

Implement these routes under the same `/api/v1` base. `src/api/auth.js` handles them; `src/PatientLogin.jsx` renders the page. PostgreSQL is the planned persistent store; no database or account server is included in this repository yet.

| Method and path | Required behavior |
| --- | --- |
| `GET /auth/session` | Return HTTP 200 with `{user: null, csrfToken}` for anonymous callers, or a verified patient user and CSRF token for authenticated callers |
| `POST /auth/login` | Accept `{email, password}` with the anonymous session's `X-CSRF-Token`; verify credentials on the server, rotate the session, set a secure HttpOnly session cookie, and return user plus a rotated CSRF token |
| `POST /auth/logout` | Validate session/CSRF, invalidate the server session and expire its cookie; return HTTP 204 |

Authenticated response shape:

```json
{
  "user": {
    "id": "server-assigned-patient-id",
    "displayName": "the actual patient's display name",
    "role": "PATIENT"
  },
  "csrfToken": "server-generated-session-bound-token"
}
```

This is a response contract, not a seeded account. The UI accepts only verified `PATIENT` sessions. Store salted password hashes using an appropriate password-hashing algorithm such as Argon2id or bcrypt, never plaintext passwords. Enforce session expiry, login rate limiting, patient authorization, cookie security, and CSRF checks on the server. The browser does not store passwords, auth tokens, or patient sessions in localStorage. It keeps only the CSRF token in memory. Configure session cookies with Secure/HttpOnly and an appropriate SameSite setting; use same-origin HTTPS where possible.

Return HTTP 401 for invalid credentials/session expiry and 429 for throttling. A 401 from a workspace request returns the app to sign-in; a 403 is an authorization failure, not a successful save. A failed logout leaves the patient view open with a retry message so the app does not falsely claim the server session ended. Provision patient accounts through the backend; self-registration and password recovery are not implemented here.

## 8. Active-dashboard reminders

`src/reminders.js` selects a slot only when it has user-entered medicines and its scheduled time has arrived in the patient's timezone. The dashboard checks every five seconds and on focus/visibility changes. It shows the popup only while visible and focused, with a valid loaded schedule and no schedule-edit dialog or connection error.

The popup lists the actual prescribed entries and section label. Dismiss and View medicines suppress that dated slot/time reminder, not medicine intake. Five-minute snooze can recur after the chosen delay. Decisions are scoped to the signed-in server user ID (or the explicitly local workspace) and stored as minimal reminder IDs/timestamps, separately from box history. They are not sent to event ingestion and do not satisfy reminder instances on the backend. Changed reminder times and new days have separate keys. Stale reminders/snoozes are not replayed hours later.

This is an in-app convenience, not background notification delivery. Browser throttling, focus, tab closure, sign-out, and device sleep affect it. Keep physical reminders on ESP32 and implement remote notification delivery separately if required.
