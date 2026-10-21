# 1. Run the application

These commands work in Windows PowerShell, macOS Terminal, and Linux terminals.

## 1. Install the prerequisites

- Install a current Node.js LTS release (Node 22 or later): https://nodejs.org/
- Install Git: https://git-scm.com/downloads
- After installation, open a new terminal.

Verify:

```sh
node --version
npm --version
git --version
```

## 2. Clone and start

```sh
git clone https://github.com/Dhanush-singh-g/IOT-project.git
cd IOT-project
npm ci
npm run dev -- --port 5173
```

Keep this terminal open. Open http://localhost:5173 in your browser. If that port is already occupied, Vite prints the next available port; use the address it prints.

If the repository is private, sign in using your Git installation's supported GitHub authentication flow when prompted. You must have access to the repository; do not paste tokens into the clone URL.

No ESP32, backend, database, .env file, or credentials are required for local mode. Only initial dependency installation requires Internet access. The optional Google Fonts request can fall back to local fonts.

## 3. Try the app

1. The app starts empty. On **Today**, choose **Add your first medicine**.
2. Enter the prescribed medicine name, strength, quantity, part of the day, and reminder time. Instructions are optional.
3. Add more medicines to the same section if needed; they share its reminder time.
4. Use **Today** to review the schedule and matching compartment label.
5. On **Schedule**, edit/remove entries or choose **Edit reminder times**.
6. **History** stays empty until real box events are supplied by a connected backend. There are no simulation controls or invented readings.

Local schedules are saved only in this browser. Automatic reminders and box history are not connected. This frontend does not send real alarms or messages. The box cannot verify which medicine was selected or taken.

Previous prototype/sample records are not loaded into the new app. Their localStorage keys are left untouched; no existing browser data is deleted automatically.

## 4. Stop and restart

Press **Ctrl+C** in the terminal to stop Vite.

Next time, open a terminal in the cloned `IOT-project` folder and run:

```sh
npm run dev -- --port 5173
```

## 5. Get updates

If you have not made local source changes:

```sh
git pull --ff-only origin main
npm ci
npm run dev -- --port 5173
```

Stop the existing dev server before running these commands. If Git reports local changes, preserve them before pulling; do not discard them blindly.

## 6. Optional checks

```sh
npm test
npm run build
```

To serve the production build locally:

```sh
npm run preview -- --port 4173
```

Open http://localhost:4173. Stop this server with Ctrl+C too.

## 7. Troubleshooting

| Problem | What to do |
| --- | --- |
| `node`, `npm`, or `git` is not recognized | Install the missing prerequisite and reopen the terminal |
| PowerShell blocks `npm.ps1` | Use `npm.cmd ci` and `npm.cmd run dev -- --port 5173`, or use Command Prompt; no policy change is needed |
| Port 5173 is occupied | Use the URL Vite prints, or run `npm run dev -- --port 5175` |
| Workspace unavailable / backend error | Remove an unintended `.env.local` live-mode setting or set `VITE_DATA_MODE=local`, then restart Vite |
| Need to clear your local schedule | Back up the information first, then remove only `smartmed-personal-workspace-v1` from this site's browser localStorage and reload. This deletes your locally entered schedule. |
| `npm ci` fails | Confirm Node is 22 or later and the package registry is reachable; retain the error output for diagnosis |

## 8. Connecting real hardware later

See [02_MICROCONTROLLER_INTEGRATION.md](02_MICROCONTROLLER_INTEGRATION.md). Set up the backend before switching to live mode. Never place ESP32 credentials or Wi-Fi passwords in browser variables.
