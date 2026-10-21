# SmartMed

A simple medicine routine for a box with four daily sections under one shared lid.

## Run on your laptop

Install Node.js 22 or later and Git, then:

```sh
git clone https://github.com/Dhanush-singh-g/IOT-project.git
cd IOT-project
npm ci
npm run dev -- --port 5173
```

Open the localhost address printed by Vite. Full instructions: [LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

## Three pages

- **Today:** prescribed medicines, quantities, instructions, and the labelled section to use.
- **Schedule:** add/edit/remove medicines and set daily reminder times.
- **History:** real whole-box opening/closing records supplied by the backend.

The app starts empty. There are no seeded patient names, medicines, reminder times, device readings, or simulated events. Hardware setup and development information are kept in documentation, outside the user interface.

Default **local mode** stores only user-entered schedules in this browser. It does not run automatic reminders, synchronize to another device, or manufacture box history. A separate storage key, `smartmed-personal-workspace-v1`, prevents previous sample records from appearing; old prototype keys are preserved but not automatically imported.

Multiple medicines can share Morning, Afternoon, Evening, or Night. Each section has one shared reminder time. The caregiver fills the sections daily according to the prescription. Opening the shared lid does not identify the selected medicine or verify ingestion.

## Connecting real services

See [ESP32_CONNECTION.md](docs/ESP32_CONNECTION.md), [DEVICE_INTEGRATION.md](docs/DEVICE_INTEGRATION.md), and [HARDWARE_WIRING.md](docs/HARDWARE_WIRING.md).

Copy `.env.example` to `.env.local` and set `VITE_DATA_MODE=live` with the real API URL only when the backend exists. Integration hooks stay in `src/api/smartmed.js`. Live connection failures are displayed without substituting synthetic data.

This repository contains the frontend, not a complete production healthcare service. Backend authentication/authorization, secure shared storage, hardware integration, firmware, and remote notification delivery remain to be implemented before a real deployment. The optional Google Fonts request has local font fallbacks.

## Checks

```sh
npm test
npm run build
```

`npm run build` creates `dist/`. Use `npm run preview -- --port 4173` to inspect it locally.
