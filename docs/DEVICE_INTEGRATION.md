# SmartMed device integration: current design

The project now uses **one shared lid over four daily sections**, replacing the earlier independent-compartment design.

Read [ESP32_CONNECTION.md](ESP32_CONNECTION.md) for the current API contract, connection placeholders, firmware event format, configuration steps, and acceptance checks. Read [HARDWARE_WIRING.md](HARDWARE_WIRING.md) for single-sensor wiring.

## Architecture

```text
React dashboard <-- HTTPS --> Spring Boot API <--> MySQL
                                    ^
                                    | HTTPS over Wi-Fi
                                    v
                                  ESP32
                  one ultrasonic sensor, four LEDs, one buzzer
```

## Rules the implementation must preserve

- Sections are Morning, Afternoon, Evening, and Night. Each can contain multiple medicines and has one daily reminder time.
- A caregiver loads the prescribed medicines each day. The patient sees names, strengths, quantities, and instructions, and follows the matching label/LED.
- The one sensor measures the entire lid. Report `BOX_OPENED` and `BOX_CLOSED`, never a detected compartment or medicine selection.
- Timing can associate an opening with a reminder; that does not verify the chosen medicine or intake.
- Access events are dated records, separate from recurring medicine entries. Yesterday's opening cannot satisfy today's reminder.
- ESP32 keeps reminders and queued events in persistent storage. The backend deduplicates uploads and reconciles offline evidence.
- Frontend live mode calls the backend; device credentials never appear in browser configuration.

The current app defaults to browser-local demo data. Backend, authenticated accounts, physical alarms, firmware, and remote alerts still require implementation. The live adapter contains explicit placeholders and does not simulate success if the backend is unavailable.
