# SmartMed

A responsive React dashboard for a four-compartment connected medicine box.

## Run

Use Node.js 22 or later.

```sh
npm ci --cache /tmp/smartmed-npm-cache
npm run dev -- --port 5173
```

`npm run build` creates the production frontend in `dist/`.

## Included

- Overview with daily schedules, next reminder, compartments, and activity.
- Add, edit, remove, and search daily medicines; one medicine per compartment.
- Access history and CSV export.
- Device page with ultrasonic reading simulation and disconnection simulation.
- Care circle and locally saved patient, caregiver, sensor, and reminder preferences.
- Responsive navigation and layouts for smaller screens.

This is a frontend prototype. Demo data and preferences are stored in browser localStorage. No real device, cloud synchronization, authentication, notification delivery, or automatic scheduling runs. Do not enter sensitive patient data into this prototype. Google Fonts is optional; local sans-serif fonts are used as fallback.

## Hardware and backend integration

Keep events sensor-independent: device ID, unique event ID, dose ID if applicable, compartment ID, event type, and occurrence timestamp. Distinguish compartment opening from confirmed ingestion. The sensor layer can later use ultrasonic, magnetic, or mechanical sensing without changing the dashboard event model.

For ultrasonic detection, calibrate the closed-lid distance per compartment, require a stable increase over the baseline, and rearm after a stable close. Threshold and signal-stability controls currently affect demo labels only. Test minimum measurement range, lid geometry, and crosstalk in the physical enclosure. Hardware may require level shifting; do not connect a 5 V echo signal directly to an ESP32 input.

Suggested next step: connect Spring Boot REST endpoints for medicines, dose instances, device health, and idempotent access events, backed by MySQL. Persist timestamps in UTC and render in the user's timezone. Device offline state should delay missed-dose conclusions until queued access events are reconciled. Add authentication and authorization before storing real patient data.
