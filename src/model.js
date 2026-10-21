export const SLOT_IDS = ['morning', 'afternoon', 'evening', 'night'];
export const STORAGE_KEY = 'smartmed-shared-lid-v1';
export const DEVICE_ID = 'SM-HOME-001';

export function createDemoWorkspace() {
  return {
    slots: [
      {id: 'morning', label: 'Morning', time: '08:00', color: 'green'},
      {id: 'afternoon', label: 'Afternoon', time: '13:00', color: 'orange'},
      {id: 'evening', label: 'Evening', time: '18:00', color: 'purple'},
      {id: 'night', label: 'Night', time: '21:00', color: 'blue'},
    ],
    medicines: [
      {id: 'm1', name: 'Metformin', strength: '500 mg', quantity: '1 tablet', instructions: 'After breakfast', slotId: 'morning'},
      {id: 'm2', name: 'Vitamin D3', strength: '1000 IU', quantity: '1 tablet', instructions: 'After breakfast', slotId: 'morning'},
      {id: 'm3', name: 'Amlodipine', strength: '5 mg', quantity: '1 tablet', instructions: 'As prescribed', slotId: 'afternoon'},
      {id: 'm4', name: 'Atorvastatin', strength: '10 mg', quantity: '1 tablet', instructions: 'After dinner', slotId: 'night'},
    ],
    events: [],
    settings: {patient: 'Margaret Wilson', caregiver: 'Sarah Wilson', timezone: 'Asia/Kolkata', threshold: 8, stability: 1000, grace: 20, repeat: 5},
    device: {id: DEVICE_ID, online: true, lidState: 'CLOSED', distanceCm: 3.2, ledSlotId: null, buzzerActive: false, lastSeen: null, desiredConfigVersion: 1, appliedConfigVersion: null},
  };
}

export function zonedParts(instant, timezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(new Date(instant)).map(p => [p.type, p.value]));
  return {date: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute)};
}
const ordinal = date => Date.parse(date + 'T00:00:00Z') / 86400000;
export const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export const clockLabel = time => new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
export const eventTime = (time, zone) => new Date(time).toLocaleString('en-US', {timeZone: zone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
export const slotMedicines = (workspace, id) => workspace.medicines.filter(m => m.slotId === id);

// Reminder context describes the timing of a WHOLE-BOX opening, never a detected compartment.
export function reminderContext(workspace, instant) {
  const {date, minute} = zonedParts(instant, workspace.settings.timezone);
  for (const daysBack of [0, 1]) {
    const reminderDate = new Date((ordinal(date) - daysBack) * 86400000).toISOString().slice(0, 10);
    for (const slot of workspace.slots) {
      const age = daysBack * 1440 + minute - minutes(slot.time);
      if (slotMedicines(workspace, slot.id).length && age >= 0 && age <= workspace.settings.grace) {
        return {slotId: slot.id, label: slot.label, date: reminderDate, scheduledTime: slot.time,
          medicines: slotMedicines(workspace, slot.id).map(m => ({name: m.name, strength: m.strength, quantity: m.quantity}))};
      }
    }
  }
  return null;
}

export function slotStatus(workspace, slot, instant = new Date()) {
  if (!slotMedicines(workspace, slot.id).length) return 'Not scheduled';
  const {date, minute} = zonedParts(instant, workspace.settings.timezone);
  const opened = workspace.events.some(e => e.type === 'BOX_OPENED' && e.reminderContext?.slotId === slot.id && e.reminderContext?.date === date && e.reminderContext?.scheduledTime === slot.time);
  if (opened) return 'Box opened';
  if (minute < minutes(slot.time)) return 'Upcoming';
  if (minute <= minutes(slot.time) + workspace.settings.grace) return 'Due now';
  // A live backend must establish monitoring coverage before making a no-opening conclusion.
  return 'No opening recorded';
}

export function validateSlots(slots, grace) {
  if (slots.length !== 4 || new Set(slots.map(s => s.id)).size !== 4 || slots.some(s => !SLOT_IDS.includes(s.id))) throw new Error('Keep the four named daily slots.');
  if (slots.some(s => !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))) throw new Error('Enter a valid reminder time.');
  const ordered = [...slots].sort((a, b) => minutes(a.time) - minutes(b.time));
  for (let i = 0; i < ordered.length; i++) {
    const gap = (minutes(ordered[(i + 1) % ordered.length].time) - minutes(ordered[i].time) + 1440) % 1440;
    if (gap <= grace) throw new Error('Reminder windows must not overlap, including across midnight. Space them farther apart or reduce the follow-up window.');
  }
}

export function exportCsv(events, timezone) {
  const rows = [['Event ID', 'Occurred at (UTC)', 'Displayed time', 'Event', 'Reminder context (not compartment detection)', 'Scheduled medicines (not verified)', 'Source'],
    ...events.map(e => [e.id, e.occurredAt, eventTime(e.occurredAt, timezone), e.type === 'BOX_OPENED' ? 'Box opened' : 'Box closed', e.reminderContext ? `${e.reminderContext.label} (${e.reminderContext.date})` : 'Outside a reminder window', e.reminderContext?.medicines.map(m => `${m.name} ${m.strength} ${m.quantity}`).join('; ') || '', e.source])];
  // Prevent spreadsheet formula execution from editable medicine names or imported fields.
  return rows.map(row => row.map(value => {let text = String(value ?? ''); if (/^[\s]*[=+@-]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"';}).join(',')).join('\r\n');
}
