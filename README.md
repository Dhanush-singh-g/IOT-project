# SmartMed

A medicine schedule and box-access app for four daily sections—Morning, Afternoon, Evening, Night—under one shared lid. The user interface has three pages: Today, Schedule, and History.

## Documentation

| Guide | Contents |
| --- | --- |
| [1. Run the application](docs/01_RUN_APPLICATION.md) | Laptop prerequisites, clone/install/start commands, updating, checks, and troubleshooting |
| [2. Integrate the web app with the microcontroller](docs/02_MICROCONTROLLER_INTEGRATION.md) | Backend connection hooks, API payloads, firmware communication, event syncing, and security |
| [3. Hardware connections](docs/03_HARDWARE_CONNECTIONS.md) | Parts, ESP32 pins, sensor voltage protection, LEDs, buzzer, optional clock, and assembly checks |
| [4. System architecture](docs/04_SYSTEM_ARCHITECTURE.md) | System diagram, responsibilities, data flow, proposed data model, and implementation status |

The app starts empty. Local mode saves only user-entered schedules in the current browser; real box history and automatic hardware reminders require backend and firmware integration. Opening the shared lid does not verify medicine selection or intake.
