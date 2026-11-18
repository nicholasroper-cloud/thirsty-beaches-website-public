// node worker-tb-where/test/open-pin.test.mjs — "We're open" stays open until closed or 12 h (fake clock).
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const m = new Map(); let writes = 0;
const kv = { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { writes++; m.set(k, String(v)); },
  async delete(k) { m.delete(k); }, async list() { return { keys: [] }; } };
const env = { TB_LOC: kv, TB_SECRET: 'staff-secret' };
let now = Date.parse('2026-10-25T16:02:00Z');
Date.now = () => now;
const MIN = 60000, H = 60 * MIN;
const call = async (method, path, body, auth = true) => {
  const r = await worker.fetch(new Request('https://tb-where.test' + path, { method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer staff-secret' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {} });
  return { status: r.status, json: await r.json() };
};
const pos = { lat: 27.77, lng: -82.64, label: 'St. Pete Pier', open: true };

assert.equal((await call('POST', '/update', pos, false)).status, 401);
let r = await call('POST', '/update', pos);
assert.equal(r.json.since, now);
const opened = now;
// 100 minutes later with no refresh: still open (used to show closed after 90 min)
now += 100 * MIN;
r = await call('GET', '/where');
assert.equal(r.json.open, true); assert.equal(r.json.since, opened); assert.equal(r.json.ageMin, 100);
// a refresh keeps "since"
r = await call('POST', '/update', { ...pos, lat: 27.771, refresh: true });
assert.equal(r.status, 200); assert.equal(r.json.since, opened);
r = await call('POST', '/update', { ...pos, label: '', refresh: true });
assert.equal(r.json.label, 'St. Pete Pier', 'a refresh from a phone with no label typed keeps the label');
// moving with a normal open tap also keeps "since" while still open
now += 30 * MIN;
r = await call('POST', '/update', { ...pos, label: 'Vinoy Park' });
assert.equal(r.json.since, opened);
// 11h59 after opening: open; 12h01: closed (expired) even though the page refreshed at 2h10
now = opened + 11 * H + 59 * MIN;
assert.equal((await call('GET', '/where')).json.open, true);
now = opened + 12 * H + MIN;
r = await call('GET', '/where');
assert.equal(r.json.open, false); assert.equal(r.json.expired, true);
// a background refresh can't revive an expired pin, and spends no KV write
let w = writes;
r = await call('POST', '/update', { ...pos, refresh: true });
assert.equal(r.status, 409); assert.equal(r.json.reason, 'expired'); assert.equal(writes, w);
// an explicit open tap starts a fresh 12 h
r = await call('POST', '/update', pos);
assert.equal(r.json.since, now);
// close -> closed; a refresh from a forgotten open tab is refused and doesn't re-open it
assert.equal((await call('POST', '/close')).json.open, false);
w = writes;
r = await call('POST', '/update', { ...pos, refresh: true });
assert.equal(r.status, 409); assert.equal(r.json.reason, 'closed'); assert.equal(writes, w);
r = await call('GET', '/where');
assert.equal(r.json.open, false); assert.equal(r.json.expired, undefined);
// legacy record without "since" (written before this change) counts from "updated"
m.set('current', JSON.stringify({ lat: 1, lng: 2, label: 'x', open: true, updated: now - 3 * H }));
r = await call('GET', '/where');
assert.equal(r.json.open, true); assert.equal(r.json.since, now - 3 * H);
console.log('open pin tests passed');
