# SmartMed hardware wiring guide

Build and test **one compartment first**, then repeat the sensor and LED connections for four compartments.

This guide is a proposed bench-build wiring plan. It has not been tested on your hardware. It assumes a **classic ESP32-WROOM-32 development board with the listed GPIOs exposed**, and **four separate 5 V HC-SR04-style ultrasonic modules with VCC, TRIG, ECHO, and GND pins**. It does not apply unchanged to ESP32-C3/S3 boards, ESP32-WROVER boards, or other sensor interfaces. Confirm the exact board and sensor datasheets before wiring.

For software and backend communication, see [DEVICE_INTEGRATION.md](DEVICE_INTEGRATION.md).

## 1. Parts required

| Part | Quantity | Notes |
| --- | ---: | --- |
| ESP32-WROOM-32 development board | 1 | Board with USB power and the GPIOs listed below |
| HC-SR04-style 5 V ultrasonic sensor | 4 | One per independently opening compartment; verify physical fit and minimum range |
| LED | 4 | One per compartment |
| 330 Ω resistor | 4 | One in series with each LED |
| 2.2 kΩ resistor | 4 | Upper resistor in each ECHO voltage divider |
| 3.3 kΩ resistor | 4 | Lower resistor in each ECHO voltage divider |
| 74AHCT125 buffer, DIP-14 | 1 | Converts four 3.3 V TRIG signals to 5 V; use the AHCT version |
| 100 nF ceramic capacitor | 5 | One across buffer power pins; one near each sensor's power pins |
| 5 V active buzzer, rated at 20 mA or less | 1 | Sounds continuously when powered; an active buzzer does not require a tone waveform |
| NPN transistor, e.g. 2N2222 or BC337 | 1 | Drives the buzzer; identify base, collector, emitter from its exact datasheet |
| 1 kΩ resistor | 1 | GPIO-to-transistor base resistor |
| 10 kΩ resistor | 1 | Base-to-emitter pull-down |
| Flyback diode, e.g. 1N4148 | 1 if needed | Required for an inductive/magnetic buzzer; observe polarity |
| Regulated 5 V USB supply | 1 | A reputable 1 A supply is a reasonable starting choice; confirm total load |
| Breadboard, jumper wires, terminal connectors | As needed | Use soldered, insulated wiring for the enclosed build |
| DS3231 RTC module with compatible backup battery | 1 recommended | Optional for the first sensor test; useful for reminders after power loss |
| Four-compartment enclosure | 1 | Separate lids if you need separate compartment-opening detection |

Some ultrasonic variants accept 3.3 V trigger signals directly. The buffer here avoids relying on undocumented behavior in generic 5 V modules. If you choose a fully 3.3 V-compatible sensor, redesign its power and interface according to its datasheet; do not automatically reuse the 5 V wiring.

**Do a physical fit check before buying four sensors.** A typical HC-SR04 is relatively large and has a minimum measuring distance around 2 cm, depending on the model. A shallow pill compartment may be unsuitable.

## 2. Overall connections

```text
                      Regulated 5 V supply
                              |
                   ESP32 USB power connector
                              |
              Verified USB-derived 5 V board pin
                              |
        +---------------------+----------------------+
        |                     |                      |
   4 sensor VCCs       74AHCT125 VCC            Buzzer positive

ESP32 3.3 V ----------------------------------> RTC VCC (if compatible)

ESP32 GPIO -- buffer -------------------------> Sensor TRIG
Sensor ECHO -- voltage divider ---------------> ESP32 input GPIO
ESP32 GPIO -- 330 ohm -- LED ------------------> GND
ESP32 GPIO -- 1 kohm -- transistor base -------> Buzzer driver
ESP32 SDA / SCL ------------------------------> RTC SDA / SCL

ALL GROUNDS CONNECT TOGETHER.
```

This plan powers everything from one USB supply through the development board. Before using its 5 V/VIN pin as an output, confirm that the board exposes USB-derived 5 V there and that its connector, protection components, and traces can carry the complete load. Board labels vary; `VIN` is not universally an output.

If the board cannot supply the peripheral load, use a suitable power distribution arrangement based on its schematic. Do not connect an external 5 V supply to its 5 V pin while USB is also powering it unless the board explicitly supports that arrangement. Do not power the sensors or buzzer from GPIO pins or from the ESP32's 3.3 V regulator.

## 3. Proposed ESP32 pin map

GPIO numbers below are chip GPIO numbers, **not physical header positions**.

| Function | A1 | A2 | A3 | A4 |
| --- | --- | --- | --- | --- |
| Ultrasonic TRIG, through buffer | GPIO 18 | GPIO 19 | GPIO 23 | GPIO 25 |
| Ultrasonic ECHO, through divider | GPIO 34 | GPIO 35 | GPIO 36 / VP | GPIO 39 / VN |
| Compartment LED, through 330 Ω | GPIO 13 | GPIO 14 | GPIO 26 | GPIO 27 |

| Shared function | GPIO / connection |
| --- | --- |
| Buzzer transistor base, through 1 kΩ | GPIO 32 |
| DS3231 SDA | GPIO 21 |
| DS3231 SCL | GPIO 22 |
| Sensor and buffer power | Verified 5 V rail |
| DS3231 power | 3.3 V, only for a module compatible with that supply |
| All component grounds | Common GND |

GPIO 34, 35, 36, and 39 are input-only on this ESP32, which suits ECHO inputs. They do not have internal pull-up/down resistors; the ECHO divider provides a path to ground. This plan leaves boot-strapping pins and GPIO 6–11, normally used for flash, unused. GPIO 13/14 cannot simultaneously serve a JTAG interface in this wiring.

## 4. Wire each ultrasonic sensor

### ECHO: protect the ESP32 input

A 5 V ECHO output must **not** connect directly to an ESP32 input.

For A1:

```text
HC-SR04 ECHO ---- 2.2 kohm ----+---- GPIO 34
                             |
                          3.3 kohm
                             |
                            GND
```

The divider produces approximately:

```text
5.0 V × 3.3 / (2.2 + 3.3) = 3.0 V
```

Repeat this divider separately for A2 → GPIO 35, A3 → GPIO 36, and A4 → GPIO 39. Do not join the sensors' ECHO outputs together. The resistor order matters: **2.2 kΩ above the junction, 3.3 kΩ below it**.

### TRIG: buffer the outgoing signals

For a standard DIP-14 **74AHCT125**, viewed and numbered according to its datasheet:

| Buffer pin | Connect to |
| --- | --- |
| 14: VCC | 5 V |
| 7: GND | Common GND |
| 1, 4, 10, 13: active-low output enables | GND, enabling all four channels |
| 2: channel 1 input | ESP32 GPIO 18 |
| 3: channel 1 output | A1 TRIG |
| 5: channel 2 input | ESP32 GPIO 19 |
| 6: channel 2 output | A2 TRIG |
| 9: channel 3 input | ESP32 GPIO 23 |
| 8: channel 3 output | A3 TRIG |
| 12: channel 4 input | ESP32 GPIO 25 |
| 11: channel 4 output | A4 TRIG |

Place a 100 nF ceramic capacitor between pins 14 and 7, close to the chip. Confirm the notch/dot orientation before connecting power. Do not substitute a 74HC125 powered at 5 V without checking its input-high requirements; AHCT inputs accept 3.3 V logic.

For each sensor:

| Sensor pin | Connect to |
| --- | --- |
| VCC | 5 V rail |
| GND | Common GND |
| TRIG | Its assigned buffer output |
| ECHO | Its own divider input |

Place a 100 nF capacitor across each sensor's VCC and GND near the module. Keep TRIG outputs low when idle; if startup glitches occur, add pull-downs on buffer inputs and verify startup behavior before interpreting readings.

## 5. Wire the LEDs

For A1:

```text
GPIO 13 ---- 330 ohm ---- LED anode (+)
                         LED cathode (-) ---- GND
```

Repeat for A2 → GPIO 14, A3 → GPIO 26, and A4 → GPIO 27. Each LED needs its own resistor. Check LED polarity; the longer lead usually identifies the anode, but confirm the part. An output HIGH turns the LED on. The resistor keeps a typical indicator LED at a few milliamps; do not substitute a high-power LED in this circuit.

## 6. Wire the buzzer through a transistor

This circuit assumes a bare 5 V active buzzer drawing no more than 20 mA. A buzzer module with its own driver may have different connections.

```text
5 V --------------------------- Buzzer (+)
                                Buzzer (-)
                                     |
                                Collector (C)
GPIO 32 ---- 1 kohm ---- Base (B)   NPN transistor
                            |   Emitter (E)
                         10 kohm     |
                            |        |
                           GND ----- GND
```

The 10 kΩ resistor goes from base to emitter/GND and keeps the transistor off while the ESP32 is starting. GPIO HIGH turns the buzzer on; LOW turns it off. Check the transistor's pin order: parts sold as 2N2222 can have different lead arrangements.

For an inductive/magnetic buzzer, place a flyback diode across it:

```text
Diode cathode (striped end) --> buzzer (+), 5 V
Diode anode                --> buzzer (-), collector
```

A piezo buzzer is not an inductive load and generally does not need that diode. If the chosen buzzer needs substantially more current, recalculate the driver or use an appropriately rated logic-level MOSFET circuit.

## 7. Optional DS3231 backup clock

| DS3231 module pin | ESP32 connection |
| --- | --- |
| VCC | 3.3 V, with a module confirmed to support it |
| GND | Common GND |
| SDA | GPIO 21 |
| SCL | GPIO 22 |
| SQW / INT | Leave unconnected for the first version |
| 32K | Leave unconnected |

Use a module with I²C pull-ups to **3.3 V**, not 5 V. Check the module schematic; the DS3231 chip's capabilities do not guarantee that every breakout is wired the same way. Add external pull-ups only if the module lacks them, following the bus requirements.

Use the battery type specified by that module. Some inexpensive boards include a charging circuit: do not place a non-rechargeable CR2032 in an active charging circuit. Prefer a documented non-charging module designed for CR2032, or the manufacturer's specified compatible arrangement.

The backup battery powers the clock only. It does not keep the ESP32, sensors, LEDs, or buzzer running during a power cut.

## 8. Mount sensors before choosing detection thresholds

```text
       One compartment's lid
       ---------------------  <- intended reflecting surface when closed
                ^
                | clear acoustic path
                |
        [ultrasonic sensor]
       =====================  <- protected mounting area
```

- Point each sensor toward its own lid, with enough space for its specified minimum range.
- Keep medicines and packaging out of the acoustic path; changing contents can change reflections.
- Keep wiring and electronics protected from pills, spills, and cleaning.
- Test with the lid closed, partly open, and fully open, and with different medicine fill levels.
- Trigger only one sensor at a time. For many HC-SR04 modules, at least 60 ms between successive triggers is a reasonable initial test interval; use the actual datasheet and increase spacing if crosstalk remains.
- Avoid indefinite waits for ECHO. Use a bounded timeout and report invalid readings.
- A fully open lid may produce no echo. Treat that as unknown unless you have established a reliable additional detection method. Do not assume every missing echo means the lid opened.

**A shared outer lid is a different design:** four sensors watching the same lid cannot establish which compartment was accessed. Use independent lids or report only a whole-box opening. Even an independent lid opening does not prove a pill was removed or swallowed.

If the physical box cannot produce repeatable measurements, select a sensor better suited to its geometry before expanding the build. The dashboard's access-event model can remain unchanged.

## 9. Assemble and check in this order

1. **Power off:** check breadboard rail continuity, component polarity, transistor leads, buffer orientation, and all resistor values. Some breadboard power rails are split in the middle.
2. **ESP32 alone:** power by USB and upload a basic firmware sketch. Verify the board selection and serial output.
3. **One LED:** confirm that only the selected GPIO turns it on and off.
4. **One sensor:** add A1, its trigger buffer channel, and ECHO divider. Before attaching the divider output to the ESP32, measure the ECHO waveform with an oscilloscope or logic analyzer with suitable voltage capability if available. A multimeter alone may miss its pulse peak. Confirm the divider output stays within the ESP32 input limits.
5. **Read distances:** print valid/invalid readings in the serial monitor. Test known distances and timeout behavior.
6. **Test the physical lid:** collect closed, partly open, and fully open readings before choosing thresholds. Check for false events over an extended closed-lid period.
7. **Add the buzzer driver:** verify startup is silent and GPIO control works.
8. **Repeat A2–A4:** read sequentially, label wires, and check that one lid does not trigger another compartment.
9. **Add RTC:** verify time survives removal of main power, then restore time synchronization.
10. **Connect the backend:** follow the event-upload flow in [DEVICE_INTEGRATION.md](DEVICE_INTEGRATION.md).
11. **Enclose:** replace temporary jumper connections with secure wiring, insulate exposed conductors, and provide strain relief for the power cable.

Before use, verify stable 5 V and 3.3 V rails during Wi-Fi transmission and buzzer operation. Brownouts commonly look like random sensor or connectivity failures.

## 10. Wiring checklist

- [ ] Exact ESP32 board and sensor variants match this plan, or wiring is revised from their datasheets.
- [ ] USB-derived peripheral power path is verified and rated for the total load.
- [ ] All grounds are connected; no 5 V signal reaches an ESP32 GPIO.
- [ ] All four ECHO dividers are present and correctly ordered.
- [ ] Trigger buffer is AHCT-compatible, powered at 5 V, with correct pin orientation and decoupling.
- [ ] Each LED has its own resistor.
- [ ] Buzzer uses its driver; transistor and diode polarity are correct.
- [ ] RTC pull-ups are at 3.3 V and its battery arrangement is compatible.
- [ ] Independent compartment access can actually be distinguished in the enclosure.
- [ ] Sensor validity, crosstalk, restart behavior, and power stability have been checked.

No physical USB/data wire connects this box to the web dashboard during normal use. The USB cable supplies power; the ESP32 sends and receives application data over Wi-Fi through the backend.
