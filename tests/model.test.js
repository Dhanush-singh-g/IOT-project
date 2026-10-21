import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoWorkspace, reminderContext, slotStatus, slotMedicines, validateSlots, exportCsv} from '../src/model.js';
const at = value => new Date(value);
const morning = w => w.slots.find(s => s.id === 'morning');

test('multiple medicines share a time slot without separate reminders', () => {
  const w = createDemoWorkspace();
  assert.equal(slotMedicines(w, 'morning').length, 2);
  assert.equal(w.slots.length, 4);
  assert.equal(w.events.length, 0);
});
test('opening during a reminder has timing context, never a detected compartment', () => {
  const w = createDemoWorkspace();
  const context = reminderContext(w, at('2027-01-15T02:34:00Z'));
  assert.equal(context.slotId, 'morning');
  assert.equal(context.medicines.length, 2);
  assert.equal(context.date, '2027-01-15');
  assert.equal(context.compartmentId, undefined);
  const event = {type: 'BOX_OPENED', reminderContext: context};
  w.events.push(event);
  assert.equal(slotStatus(w, morning(w), at('2027-01-15T02:35:00Z')), 'Box opened');
  assert.ok(w.medicines.every(m => !('status' in m)));
});
test('out-of-window openings cannot satisfy a reminder', () => {
  const w = createDemoWorkspace();
  assert.equal(reminderContext(w, at('2027-01-15T02:29:00Z')), null);
  assert.equal(reminderContext(w, at('2027-01-15T02:51:00Z')), null);
});
test('one day’s opening does not satisfy tomorrow’s reminder', () => {
  const w = createDemoWorkspace();
  w.events.push({type: 'BOX_OPENED', reminderContext: reminderContext(w, at('2027-01-15T02:34:00Z'))});
  assert.equal(slotStatus(w, morning(w), at('2027-01-16T02:35:00Z')), 'Due now');
});
test('closed lid events do not count as an opening', () => {
  const w = createDemoWorkspace();
  w.events.push({type: 'BOX_CLOSED', reminderContext: reminderContext(w, at('2027-01-15T02:34:00Z'))});
  assert.equal(slotStatus(w, morning(w), at('2027-01-15T02:35:00Z')), 'Due now');
});
test('empty slot is never due', () => {
  const w = createDemoWorkspace();
  assert.equal(slotStatus(w, w.slots.find(s => s.id === 'evening'), at('2027-01-15T12:35:00Z')), 'Not scheduled');
});
test('reminder windows crossing midnight retain the prior reminder date', () => {
  const w = createDemoWorkspace(); w.slots.find(s => s.id === 'night').time = '23:50';
  const context = reminderContext(w, at('2027-01-15T18:35:00Z'));
  assert.equal(context.date, '2027-01-15');
  assert.equal(context.label, 'Night');
});
test('schedule validation rejects overlapping windows, including across midnight', () => {
  const w = createDemoWorkspace();
  assert.doesNotThrow(() => validateSlots(w.slots, 20));
  w.slots[1].time = '08:10';
  assert.throws(() => validateSlots(w.slots, 20), /overlap/);
  w.slots[1].time = '13:00'; w.slots[0].time = '00:05'; w.slots[3].time = '23:50';
  assert.throws(() => validateSlots(w.slots, 20), /overlap/);
});
test('editing a reminder does not retroactively reassign a recorded opening', () => {
  const w = createDemoWorkspace();
  const context = reminderContext(w, at('2027-01-15T02:34:00Z'));
  w.events.push({type: 'BOX_OPENED', reminderContext: context});
  morning(w).time = '09:00'; w.medicines[0].name = 'Changed prescription';
  assert.equal(context.medicines[0].name, 'Metformin');
  assert.equal(slotStatus(w, morning(w), at('2027-01-15T03:35:00Z')), 'Due now');
});
test('CSV preserves event meaning, escapes quotes, and neutralizes formulas', () => {
  const csv = exportCsv([{id: '=1+1', type: 'BOX_OPENED', occurredAt: '2027-01-15T02:34:00Z', reminderContext: null, source: 'a,"b"'}], 'Asia/Kolkata');
  assert.match(csv, /"'=1\+1"/);
  assert.match(csv, /"a,""b"""/);
  assert.match(csv, /not verified/);
  assert.match(csv, /Outside a reminder window/);
});
