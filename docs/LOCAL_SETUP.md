# Run SmartMed on your laptop

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

No ESP32, backend, database, .env file, or credentials are required for demo mode. Only initial dependency installation requires Internet access. The optional Google Fonts request can fall back to local fonts.

## 3. Try the app

1. On **Today**, select Morning, Afternoon, Evening, or Night to see the scheduled medicine names, quantities, and instructions.
2. On **Medication schedule**, add multiple medicines to a slot or edit/remove existing sample entries.
3. Use **Edit times** to change the four daily reminder times.
4. On **My device**, click **Simulate box opening**, then **Close demo lid**.
5. On **Box history**, check opening/closing events and try CSV export.
6. On **Settings**, update sample profiles or sensor preferences.

Records are saved in this browser's localStorage. Opening the box does not verify medicine selection or intake. No real alarm, device output, or message is sent. Do not enter real patient information into the prototype.

To test a reminder association, set one slot's reminder time to the current time in the displayed patient timezone (default Asia/Kolkata), then simulate a new opening within the follow-up window. The event will show timing context only. Close the simulated lid before opening again.

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
| Workspace unavailable / backend error | Remove an unintended `.env.local` live-mode setting or set `VITE_DATA_MODE=demo`, then restart Vite |
| Old sample edits remain | In browser developer tools, remove only the localStorage key `smartmed-shared-lid-v1` for this site, then reload; this deletes that browser's demo edits/history |
| `npm ci` fails | Confirm Node is 22 or later and the package registry is reachable; retain the error output for diagnosis |

## 8. Connecting real hardware later

See [ESP32_CONNECTION.md](ESP32_CONNECTION.md). Set up the backend before switching to live mode. Never place ESP32 credentials or Wi-Fi passwords in browser variables.
