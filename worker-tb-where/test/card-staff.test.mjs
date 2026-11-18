// node worker-tb-where/test/card-staff.test.mjs — staff-side punching from the trailer phone (secret as staff proof).
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
const m = new Map();
const kv = { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); },
  async list() { return { keys: [] }; } };
const env = { TB_LOC: kv, TB_SECRET: 'staff-secret' };
const call = async (method, path, body) => {
  const r = await worker.fetch(new Request('https://tb-where.test' + path, { method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {} });
  return { status: r.status, json: await r.json() };
};
let r = await call('GET', '/card?id=nosuchcard1');
assert.equal(r.json.exists, false, 'unknown id is flagged so staff can catch a typo');
assert.equal(m.size, 0, 'looking up writes nothing');
assert.equal((await call('POST', '/punch', { id: 'abc123', staff: 'wrong' })).status, 401);
r = await call('POST', '/punch', { id: 'abc123', staff: 'staff-secret' });
assert.equal(r.status, 200); assert.equal(r.json.card.punches, 1);
r = await call('GET', '/card?id=abc123');
assert.equal(r.json.exists, undefined); assert.equal(r.json.punches, 1);
assert.equal((await call('POST', '/punch', { id: 'abc123', staff: 'staff-secret' })).status, 429);
console.log('card staff tests passed');
