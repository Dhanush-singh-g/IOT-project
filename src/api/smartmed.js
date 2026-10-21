import {createWorkspace, STORAGE_KEY, validateSlots, validateWorkspace} from '../model.js';

// ESP32 CONNECTION PLACEHOLDER: the browser calls your backend, never the board directly.
// Local mode starts empty and stores only user-entered schedules. It cannot create sensor events.
const environment = import.meta.env || {};
export const DATA_MODE = environment.VITE_DATA_MODE === 'live' ? 'live' : 'local';
const BASE_URL = (environment.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
function readLocal() {
  try {const saved = localStorage.getItem(STORAGE_KEY); return saved ? validateWorkspace(JSON.parse(saved)) : createWorkspace();}
  catch {throw new Error('Your saved schedule could not be read. Your browser data has been kept. Please contact support before clearing it.');}
}
function storeLocal(workspace) {
  try {localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));}
  catch {throw new Error('Your changes could not be saved on this browser. Check available storage and try again.');}
}
async function request(path, {method = 'GET', body} = {}) {
  let response;
  try {
    response = await fetch(BASE_URL + path, {
      method, credentials: 'include', signal: AbortSignal.timeout(10000),
      headers: {'Accept': 'application/json', ...(body ? {'Content-Type': 'application/json'} : {})},
      body: body ? JSON.stringify(body) : undefined,
      // CONNECTION PLACEHOLDER: add the backend's CSRF header for cookie-authenticated writes.
      // Device credentials and Wi-Fi passwords belong only in backend/firmware provisioning.
    });
  } catch {throw new Error('We could not connect. Check your connection and try again.');}
  if (response.status === 401 || response.status === 403) throw new Error('Your session could not be verified. Please sign in again.');
  if (!response.ok) throw new Error('Your changes could not be completed. Please try again.');
  if (response.status === 204) return null;
  try {return await response.json();} catch {throw new Error('Your data could not be loaded. Please try again.');}
}
export const smartmed = {
  async load() {
    // CONNECTION PLACEHOLDER: implement the workspace endpoint described in docs/02_MICROCONTROLLER_INTEGRATION.md.
    // Connection failures never insert sample records.
    return DATA_MODE === 'local' ? readLocal() : validateWorkspace(await request('/workspace'));
  },
  async saveMedicine(medicine) {
    if (DATA_MODE === 'live') return request(`/medicines${medicine.id ? '/' + encodeURIComponent(medicine.id) : ''}`, {method: medicine.id ? 'PATCH' : 'POST', body: medicine});
    const workspace = readLocal();
    const {reminderTime, ...entry} = medicine;
    if (!entry.name?.trim() || !entry.strength?.trim() || !entry.quantity?.trim() || !workspace.slots.some(s => s.id === entry.slotId)) throw new Error('Complete the medicine details.');
    if (!reminderTime) throw new Error('Choose a reminder time for this part of the day.');
    const slots = workspace.slots.map(s => s.id === entry.slotId ? {...s, time: reminderTime} : s);
    validateSlots(slots, workspace.settings.grace);
    workspace.slots = slots;
    const saved = {...entry, id: entry.id || crypto.randomUUID()};
    workspace.medicines = workspace.medicines.some(m => m.id === saved.id) ? workspace.medicines.map(m => m.id === saved.id ? saved : m) : [...workspace.medicines, saved];
    storeLocal(workspace);
  },
  async removeMedicine(id) {
    if (DATA_MODE === 'live') return request('/medicines/' + encodeURIComponent(id), {method: 'DELETE'});
    const workspace = readLocal(); workspace.medicines = workspace.medicines.filter(m => m.id !== id); storeLocal(workspace);
  },
  async saveSlots(slots) {
    if (DATA_MODE === 'live') return request('/slots', {method: 'PUT', body: {slots}});
    const workspace = readLocal(); validateSlots(slots, workspace.settings.grace);
    if (slots.some(s => !s.time && workspace.medicines.some(m => m.slotId === s.id))) throw new Error('Keep a reminder time for every slot that has medicines.');
    workspace.slots = slots; storeLocal(workspace);
  },
};
