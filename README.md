# SmartMed — one box, four daily moments

A responsive React dashboard for a medicine box with **one shared lid, one ultrasonic sensor, four time-slot LEDs, and one external buzzer**.

## Run

For step-by-step Windows/macOS/Linux instructions, see [LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

Use Node.js 22 or later.

```sh
npm ci
npm run dev -- --port 5173
```

```sh
npm test
npm run build
```

`npm run build` creates the production frontend in `dist/`.

## What the app does

- Patient-friendly Today screen: medicine names, strengths, quantities, instructions, and the labelled section to use.
- Morning, Afternoon, Evening, Night slots, each with an editable daily reminder time and multiple medicines.
- One shared-lid device view, open/close simulation, whole-box history, and CSV export.
- Care profile and locally saved reminder/sensor preferences.
- Responsive navigation, accessible dialogs, and separate demo/live data adapters.

**Box opened is not medicine taken.** One shared sensor cannot establish which section was accessed or verify medicine identity, quantity, or ingestion. An event's reminder context is a time association only. A caregiver must load the day's prescribed medicines and refill the box daily.

## Connect ESP32 and backend

See [ESP32_CONNECTION.md](docs/ESP32_CONNECTION.md) for exact integration steps and payloads, [DEVICE_INTEGRATION.md](docs/DEVICE_INTEGRATION.md) for the architecture, and [HARDWARE_WIRING.md](docs/HARDWARE_WIRING.md) for the single-sensor wiring plan.

Copy `.env.example` to `.env.local`. Default `VITE_DATA_MODE=demo` works without a server. When Spring Boot implements the documented contract, set `VITE_DATA_MODE=live` and `VITE_API_BASE_URL` to its public API URL, then restart Vite. Search for `ESP32 CONNECTION PLACEHOLDER` in `src/api/smartmed.js` and `src/main.jsx` for the integration points. Never put device credentials in frontend variables.

Live mode polls the backend every 10 seconds, disables demo hardware controls, and reports connection failures without substituting sample data. Authentication, CSRF/session integration, backend endpoints, database, real notifications, and firmware are still to be implemented.

## Demo boundaries

Demo medicines are illustrative, not prescriptions. State uses browser localStorage key `smartmed-shared-lid-v1`; earlier per-compartment prototype keys are left untouched. A shared-lid opening never updates a medicine-level intake flag. New days have separate reminder status; historical event context survives medicine changes.

Demo events are created by opening/closing the simulated lid, not by measured distance. Threshold preferences do not configure physical hardware. Local demo reminder states are illustrative; real missed-opening decisions require backend coverage reconciliation. No real buzzer, LED, email, SMS, or background alarm is driven by this frontend. Google Fonts is optional with local sans-serif fallbacks. Do not enter sensitive patient data before authentication and a suitable deployment exist.
