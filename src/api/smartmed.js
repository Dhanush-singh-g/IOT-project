import {createDemoWorkspace, STORAGE_KEY, reminderContext, validateSlots} from '../model.js';

// ESP32 CONNECTION PLACEHOLDER 1:
// Set VITE_DATA_MODE=live and VITE_API_BASE_URL in .env.local AFTER your backend exists.
// The browser calls Spring Boot. Only Spring Boot accepts authenticated ESP32 telemetry.
const environment = import.meta.env || {};
export const DATA_MODE = environment.VITE_DATA_MODE === 'live' ? 'live' : 'demo';
const BASE_URL = (environment.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
let demoMemory;
function readDemo() {
  if (demoMemory) return structuredClone(demoMemory);
  const saved = localStorage.getItem(STORAGE_KEY);
  demoMemory = saved ? JSON.parse(saved) : createDemoWorkspace();
  return structuredClone(demoMemory);
}
function storeDemo(workspace) {
  // Persist first: storage errors must not appear as a successful save.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  demoMemory = structuredClone(workspace);
  return workspace;
}

async function request(path, {method = 'GET', body} = {}) {
  const response = await fetch(BASE_URL + path, {
    method, credentials: 'include', signal: AbortSignal.timeout(10000),
    headers: {'Accept': 'application/json', ...(body ? {'Content-Type': 'application/json'} : {})},
    body: body ? JSON.stringify(body) : undefined,
    // ESP32 CONNECTION PLACEHOLDER 2: integrate your backend's CSRF header here for cookie-authenticated mutations.
    // Never put an ESP32 device token in this browser code or a VITE_* variable.
  });
  if (!response.ok) throw new Error(`Backend request failed (${response.status}). Check the API connection and your session.`);
  if (response.status === 204) return null;
  return response.json();
}
function validateWorkspace(value) {
  if (!value || !Array.isArray(value.slots) || !Array.isArray(value.medicines) || !Array.isArray(value.events) || !value.settings || !value.device) throw new Error('Backend response does not match the workspace contract. See docs/ESP32_CONNECTION.md.');
  return value;
}

export const smartmed = {
  async load() {
    // ESP32 CONNECTION PLACEHOLDER 3: map GET /workspace to the payload documented in ESP32_CONNECTION.md.
    // Live mode NEVER silently falls back to demo records.
    return DATA_MODE === 'demo' ? readDemo() : validateWorkspace(await request('/workspace'));
  },
  async saveMedicine(medicine) {
    if (DATA_MODE === 'live') return request(`/medicines${medicine.id ? '/' + encodeURIComponent(medicine.id) : ''}`, {method: medicine.id ? 'PATCH' : 'POST', body: medicine});
    const workspace = readDemo();
    const saved = {...medicine, id: medicine.id || crypto.randomUUID()};
    workspace.medicines = workspace.medicines.some(m => m.id === saved.id) ? workspace.medicines.map(m => m.id === saved.id ? saved : m) : [...workspace.medicines, saved];
    storeDemo(workspace);
  },
  async removeMedicine(id) {
    if (DATA_MODE === 'live') return request('/medicines/' + encodeURIComponent(id), {method: 'DELETE'});
    const workspace = readDemo(); workspace.medicines = workspace.medicines.filter(m => m.id !== id); storeDemo(workspace);
  },
  async saveSlots(slots) {
    if (DATA_MODE === 'live') return request('/slots', {method: 'PUT', body: {slots}});
    const workspace = readDemo(); validateSlots(slots, workspace.settings.grace); workspace.slots = slots; storeDemo(workspace);
  },
  async saveSettings(settings) {
    if (DATA_MODE === 'live') return request('/settings', {method: 'PUT', body: settings});
    const workspace = readDemo(); validateSlots(workspace.slots, settings.grace); workspace.settings = settings;
    workspace.device.desiredConfigVersion += 1; storeDemo(workspace);
  },
  async simulate(action, instant = new Date()) {
    if (DATA_MODE !== 'demo') throw new Error('Simulation is disabled in live mode.');
    const workspace = readDemo();
    if (action === 'toggleConnection') {
      workspace.device.online = !workspace.device.online;
    } else {
      if (!workspace.device.online) throw new Error('Reconnect the demo device first.');
      const opening = action === 'open';
      if (workspace.device.lidState === (opening ? 'OPEN' : 'CLOSED')) throw new Error(opening ? 'Close the demo lid before opening it again.' : 'The demo lid is already closed.');
      workspace.events.unshift({id: crypto.randomUUID(), deviceId: workspace.device.id, type: opening ? 'BOX_OPENED' : 'BOX_CLOSED', occurredAt: instant.toISOString(), source: 'Demo simulation', reminderContext: opening ? reminderContext(workspace, instant) : null});
      workspace.device.lidState = opening ? 'OPEN' : 'CLOSED';
      workspace.device.distanceCm = opening ? 14.1 : 3.2;
      workspace.device.lastSeen = instant.toISOString();
    }
    storeDemo(workspace);
  },
};
