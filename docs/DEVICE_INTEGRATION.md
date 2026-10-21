# SmartMed: connecting the web app to an ESP32

## 1. The simplest architecture

```text
React dashboard <-- HTTPS / JSON --> Spring Boot API <---> MySQL
                                           ^
                                           | HTTPS / JSON over Wi-Fi
                                           v
                                         ESP32
                                  /         |         \
                         Ultrasonic       LEDs       Buzzer
                           sensors
```

The dashboard and ESP32 both talk to the backend. The dashboard does not connect directly to the ESP32 or MySQL. This lets a caregiver view records remotely without exposing the medicine box to incoming Internet connections.

Use HTTP REST requests initially; an MQTT broker is not required. The backend is the source of truth. The ESP32 keeps a local copy of upcoming doses so reminders continue without Wi-Fi.

**Current implementation:** the web app uses browser-local demo data. The backend, database, firmware, device credentials, and real notification delivery described here still need implementing. These are proposed integration contracts, not existing endpoints.

## 2. Hardware responsibilities

Use an ESP32 with 2.4 GHz Wi-Fi, four independently monitored compartments, four LEDs, a buzzer, and a regulated power supply. A DS3231 clock with a suitable backup battery is recommended for timekeeping across power loss.

- Read the compartment sensors.
- Keep time using network time and the backup clock.
- Save downloaded doses and settings in persistent storage.
- Trigger reminders locally at the correct time.
- Queue access events durably before attempting upload.
- Upload events and periodic device health reports.

Power and interface ultrasonic modules according to their datasheets. Many modules have a 5 V echo output: use an appropriate divider or level shifter before an ESP32 input. Confirm minimum measuring distance, dimensions, mounting direction, and required GPIO count before buying sensors or finalizing wiring. Do not finalize a pin map until the sensor model is selected.

## 3. Ultrasonic opening detection

First test one compartment. A small medicine box may be shorter than a sensor's minimum range, and the lid may leave the beam when opened. The distance could increase, decrease, or become invalid depending on placement. Calibrate using actual closed and open measurements; do not assume a particular direction works in every enclosure.

For a placement where opening reliably increases distance:

1. With the lid closed, collect valid readings and store a median closed baseline for that compartment.
2. Read sensors sequentially, leaving the manufacturer's required settling time between triggers to reduce interference.
3. Filter valid readings, for example with a small median filter.
4. Consider the lid open when `distance - baseline >= openThresholdCm` continuously for `stabilityMs`.
5. Record one `OPENED` transition and stop the reminder for the matching due compartment.
6. Consider it closed when the difference falls below a separate, lower `closeThresholdCm` for the stability window. Record `CLOSED` and rearm detection.

Separate open and close thresholds provide hysteresis. An illustrative starting configuration is an 8 cm open threshold, 3 cm close threshold, and 1000 ms stability window; these are **not validated hardware values**. Both thresholds must fit within the measured geometry and sensor range.

A timeout, missing echo, or out-of-range reading is `UNKNOWN`, not automatically `OPENED`. Report persistent sensor faults. Do not continuously recalibrate while the box is in use. Calibrate explicitly with the lid known to be closed.

Opening a compartment establishes access only. Never label it confirmed medicine intake. Changing sensor type later should affect firmware detection, not the access-event format.

## 4. Backend endpoints

All routes below are under `/api/v1`. Device credentials must be separate from caregiver login credentials.

| Method and route | Caller | Purpose |
| --- | --- | --- |
| `GET /devices/{deviceId}/config` | ESP32 | Read sensor settings and configuration version |
| `GET /devices/{deviceId}/doses?from=...&to=...` | ESP32 | Download concrete upcoming dose instances with UTC timestamps |
| `POST /devices/{deviceId}/events` | ESP32 | Upload a batch of durable access events |
| `POST /devices/{deviceId}/heartbeat` | ESP32 | Report connectivity, readings, clock health, and applied configuration |
| `GET /medicines` | Dashboard | Load medicines and daily schedules |
| `POST /medicines` | Dashboard | Add a medicine and schedule |
| `PATCH /medicines/{medicineId}` | Dashboard | Edit a medicine and schedule |
| `DELETE /medicines/{medicineId}` | Dashboard | Disable future doses; preserve historical records |
| `GET /doses?date=YYYY-MM-DD&timezone=Asia%2FKolkata` | Dashboard | Read doses and derived statuses for a local day |
| `GET /events?deviceId=...&cursor=...` | Dashboard | Read paginated access history |
| `GET /devices/{deviceId}` | Dashboard | Read latest health, last contact, and sensor data |
| `PATCH /devices/{deviceId}/config` | Dashboard | Save requested sensor/reminder settings |

For a first version, have the dashboard refresh every 5–10 seconds. Have the ESP32 refresh its configuration and rolling 48-hour dose list every 60 seconds, and send a heartbeat every 30 seconds. These are starting intervals, not hard requirements. Polling must not block local reminders or sensor sampling.

### Configuration response

```json
{
  "deviceId": "SM-HOME-001",
  "version": 3,
  "timezone": "Asia/Kolkata",
  "followUpMinutes": 20,
  "repeatReminderMinutes": 5,
  "compartments": [
    {
      "id": "A1",
      "sensorType": "ULTRASONIC",
      "closedBaselineCm": 3.2,
      "openThresholdCm": 8,
      "closeThresholdCm": 3,
      "stabilityMs": 1000
    }
  ]
}
```

Include A1–A4 in a real response. Baselines must come from physical calibration. The device validates configuration, saves it atomically, then reports `appliedConfigVersion`. Until that acknowledgment arrives, the dashboard displays **Pending device sync**, rather than claiming settings were applied.

### Dose response

```json
{
  "scheduleVersion": 12,
  "validThrough": "2027-01-17T00:00:00Z",
  "doses": [
    {
      "doseId": "dose-001",
      "medicineId": "med-001",
      "compartmentId": "A1",
      "scheduledAt": "2027-01-15T02:30:00Z",
      "windowEndsAt": "2027-01-15T02:50:00Z"
    }
  ]
}
```

This example is an 08:00 reminder in India. Backend-generated dose IDs must stay stable across downloads. Send a complete replacement snapshot for the requested horizon with a version, so the device removes edited or canceled future reminders. Retain already-triggered dose state and queued events. Do not silently continue an expired schedule: surface that refresh is required. Do not replay old alarms after a restart without checking their valid window.

### Access-event upload

Request body for `POST /devices/SM-HOME-001/events`:

```json
{
  "events": [
    {
      "eventId": "8c24475a-1ef6-4a19-a9b4-47f2a571955c",
      "deviceId": "SM-HOME-001",
      "doseId": "dose-001",
      "compartmentId": "A1",
      "type": "OPENED",
      "occurredAt": "2027-01-15T02:34:00Z",
      "timeQuality": "RTC_SYNCED",
      "sensorType": "ULTRASONIC",
      "distanceCm": 14.1,
      "sequence": 1042
    }
  ]
}
```

Use `doseId: null` for unscheduled openings. Persist the event ID and payload once; retry with the same ID. `sequence` is a device-persisted increasing counter useful for finding gaps; it does not replace a unique event ID. Other event types include `CLOSED` and `SENSOR_FAULT`.

Successful response, sent only after database commit:

```json
{
  "acknowledgedEventIds": ["8c24475a-1ef6-4a19-a9b4-47f2a571955c"]
}
```

Enforce a unique database constraint on `(device_id, event_id)`. A repeated identical event returns the same acknowledgment without another record; a repeated ID with a different payload is rejected as a conflict. Reject device IDs that do not match the authenticated device. Acknowledge valid duplicates as well as newly committed events. The device deletes only acknowledged events from its queue.

### Heartbeat example

```json
{
  "firmwareVersion": "0.1.0",
  "appliedConfigVersion": 3,
  "appliedScheduleVersion": 12,
  "scheduleValidThrough": "2027-01-17T00:00:00Z",
  "clockHealthy": true,
  "queueDepth": 0,
  "wifiRssi": -61,
  "compartments": [
    {"id": "A1", "state": "CLOSED", "distanceCm": 3.2, "sensorHealthy": true}
  ]
}
```

The backend stamps `receivedAt` itself. Mark the device offline when no heartbeat arrives for a configurable interval, initially 90 seconds. Show stale readings with their last-update time. Heartbeats are snapshots, not reliable substitutes for queued access events.

## 5. A complete dose flow

1. Caregiver saves a daily schedule in React; Spring Boot validates and stores it.
2. Backend generates dose instances in the patient's timezone and supplies UTC timestamps to the device.
3. ESP32 downloads and persists the upcoming doses.
4. At the scheduled time, it activates that compartment's LED and buzzer. A disconnected network must not stop this step.
5. A stable sensor opening transition creates a durable event. Firmware stops only the matching reminder; opening a different compartment must not satisfy the dose.
6. Backend validates the event's compartment, dose, and timing. It records access once per dose while preserving any additional raw opening events.
7. React fetches the new status and refreshes the history and overview.
8. When the follow-up window expires without access, the backend applies the reconciliation rules below and creates a caregiver alert if justified.

Use a deterministic rule for matching an opening to a dose: same compartment, inside its configured time window. Prevent overlapping dose windows for the same compartment in the initial version. Preserve out-of-window events as unscheduled or late access rather than silently assigning them.

## 6. Time, connectivity, and missed-dose handling

- Store event and dose timestamps in UTC; keep an IANA timezone on the patient schedule. Render the patient's timezone explicitly, including on caregiver screens.
- Sync ESP32 time through network time and maintain a backup clock. Use monotonic timing for signal stability and reminder intervals.
- If the clock is invalid after restart, report a fault. Do not invent an access timestamp or claim reliable scheduled reminders until time is restored. Preserve event sequence and uptime information for reconciliation if needed.
- Persist downloaded schedules, alarm state, event queue, and sequence counter. Never store only in RAM.
- On a failed upload, retry with bounded exponential backoff and jitter. Keep sensing and reminders running independently.
- If storage fills, report a queue/storage fault and make the loss of reliable logging visible. Size and test queue capacity for the intended offline duration; do not silently overwrite unacknowledged events.
- Backend computes due and follow-up status; React must not be the scheduler.

Recommended dashboard states:

| State | Meaning |
| --- | --- |
| Upcoming | Scheduled time has not arrived |
| Due | Reminder window is open |
| Access recorded | Valid matching opening has been received |
| Awaiting device sync | Evidence is incomplete because the device or event queue is not synchronized |
| No access recorded | Window ended and synchronized device evidence shows no qualifying opening |

If the device was offline during the window, retain **Awaiting device sync** until its queued events have been ingested. For reliable reconciliation, extend the sync protocol with a device coverage checkpoint: only after every locally logged event through a reported sequence/time has been acknowledged may the backend finalize windows covered by that checkpoint. A heartbeat or empty queue alone does not prove earlier time periods were monitored without gaps. If the clock, sensor, or device was unavailable, display monitoring unavailable instead of concluding the person missed a dose.

Late-arriving evidence may revise a status; retain an audit trail. Deduplicate caregiver alerts per dose and alert type. Display notifications in the web app first; add an email/SMS provider later. Browser UI alerts alone do not notify a caregiver who has closed the app.

## 7. Frontend changes needed

The current `src/main.jsx` uses `useStored(...)`, `initialMeds`, simulated device connectivity, and local opening events.

1. Introduce an API client, for example `src/api/client.js`, using a configurable `VITE_API_BASE_URL`.
2. Replace medicine localStorage operations with backend CRUD requests.
3. Fetch dose instances separately from medicines. A medicine schedule repeats; each dose has its own status and history. Do not permanently change a medicine to accessed after one opening.
4. Replace local event arrays with paginated backend access history.
5. Replace hardcoded readings and online status with latest device telemetry and backend last-contact timestamps.
6. Send settings changes to the backend and display requested versus device-applied configuration versions.
7. Keep simulation controls only in an explicit demo mode, separate from production records.
8. Add loading, retry, validation, authorization, and stale-data states. Failed requests must not show successful saves.
9. Load patient and caregiver profiles from authenticated APIs. Export history from the backend or fetch all pages before creating a complete CSV.

An example local, non-secret frontend setting:

```dotenv
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

For local development, use a Vite `/api` proxy or explicitly allow the development frontend origin in Spring's CORS configuration. `localhost` on an ESP32 means the ESP32 itself: firmware must use the backend computer's reachable LAN address for a bench test, or its public HTTPS hostname when deployed. A backend on a remote cloud workspace needs an approved reachable endpoint; a private workspace address will not be reachable from home Wi-Fi.

For deployment, serve frontend and API under one HTTPS origin where practical. Never put device tokens or backend secrets in `VITE_*` variables; those are public browser bundle values.

## 8. Security essentials

- Give every device a revocable, unique credential provisioned through a controlled process. Keep it in firmware/device configuration, not the React bundle, Git repository, URL, or logs.
- Send device credentials in an authorization header over HTTPS. Validate server certificates on the ESP32; do not disable TLS checks to bypass connection problems.
- Authenticate caregivers independently and authorize access to their assigned patients and devices on every backend operation. Never rely on a device ID being difficult to guess.
- For web sessions, prefer secure HttpOnly cookies with appropriate SameSite and CSRF protection. Restrict CORS to intended origins.
- Validate payloads and limits, rate-limit device endpoints, and avoid sending patient names or full medication details to firmware unless necessary.
- Keep real patient data out of the prototype until access controls and an appropriate deployment are in place.

## 9. Implementation order and acceptance checks

| Step | Deliverable | Check |
| --- | --- | --- |
| 1 | One ESP32 compartment sensor | Closed/open transitions are repeatable; invalid echoes do not create openings |
| 2 | Spring Boot API and MySQL | A sample event appears once even after identical retries |
| 3 | ESP32 upload | A physical lid opening appears in the backend with correct identity and time |
| 4 | Dashboard API integration | That physical event appears without a page reload |
| 5 | Dose download and local alarm | Correct LED/buzzer activate at the scheduled time |
| 6 | Four compartments | Wrong-compartment openings do not satisfy another dose; sensors do not interfere |
| 7 | Persistent offline queue | Disconnect Wi-Fi, open a lid, restart the ESP32, reconnect: exactly one event survives and uploads |
| 8 | Configuration sync | A dashboard threshold change stays pending until the device acknowledges it |
| 9 | Reconciliation and alerts | Offline windows stay pending; an acknowledged coverage checkpoint permits the correct conclusion |
| 10 | Authentication and deployment | One caregiver/device cannot read or alter another's data; production TLS works |

Also test an ESP32 restart with an open lid, clock loss, an expired schedule, schedule edits while offline, sensor failure, and queue exhaustion. Define expected behavior before treating the system as reliable.

Start with **one physical opening → backend record → dashboard update**. Once that works end to end, add reminders, offline recovery, and caregiver alerts.
