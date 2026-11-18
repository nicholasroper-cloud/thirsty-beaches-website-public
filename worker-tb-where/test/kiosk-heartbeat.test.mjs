// node worker-tb-where/test/kiosk-heartbeat.test.mjs — /kiosk/ping + /kiosk/status against an in-memory KV.
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

function makeKV() {
  const m = new Map(); let writes = 0;
  return {
    get writes() { return writes; },
    async get(k) { const e = m.get(k); return e ? e.v : null; },
    async put(k, v, o) { writes++; m.set(k, { v: String(v), ttl: o && o.expirationTtl }); },
    async delete(k) { m.delete(k); },
    async list({ prefix = '' } = {}) { return { keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }; },
    _m: m,
  };
}
const kv = makeKV();
const env = { TB_LOC: kv, TB_SECRET: 'staff-secret', KIOSK_MIN_GAP_MS: '0', KIOSK_WRITE_MIN: '5' };
let ip = 0;
const call = async (method, path, body, headers = {}) => {
  const r = await worker.fetch(new Request('https://tb-where.test' + path, {
    method, headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '10.0.0.' + (++ip % 250), ...headers },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  }), env, { waitUntil() {} });
  return { status: r.status, json: await r.json() };
};
const ping = (extra = {}) => ({
  kioskId: 'ThirstyBeaches-Kiosk', version: 24, serverHash: 'ab'.repeat(32), uptimeSec: 60, startedAt: '2026-10-25T12:00:00Z',
  lastUpdate: { version: 24, at: '2026-10-25T12:00:00Z', ok: true, error: null }, rollback: null,
  pay: { enabled: false, flexConnected: false, state: 'disabled' }, clover: { lastOk: '2026-10-25T12:01:00Z', lastError: null },
  errors: [], node: 'v22.1.0', freeDiskMB: 51234, supervised: true, trial: false, safeMode: false, settings: [], ...extra,
});

let r = await call('GET', '/kiosk/status');
assert.equal(r.status, 200); assert.equal(r.json.online, false); assert.equal(r.json.lastSeen, null);

r = await call('POST', '/kiosk/ping', ping());
assert.deepEqual(r.json, { ok: true, stored: true });
r = await call('GET', '/kiosk/status');
assert.equal(r.json.online, true); assert.equal(r.json.version, 24); assert.equal(r.json.kioskId, 'ThirstyBeaches-Kiosk');
assert.ok(!('errors' in r.json) && !('history' in r.json) && !('serverHash' in r.json), 'public view is minimal');

// unchanged ping inside the write window -> not written (KV write budget)
const w0 = kv.writes;
r = await call('POST', '/kiosk/ping', ping({ uptimeSec: 180 }));
assert.deepEqual(r.json, { ok: true, stored: false }); assert.equal(kv.writes, w0);
// something material changed -> written + history
r = await call('POST', '/kiosk/ping', ping({ version: 25, rollback: { at: '2026-10-25T12:05:00Z', from: 26, to: 25, reason: 'crashed 3 times' },
  errors: ['update check failed: x', '<img src=x onerror=alert(1)>'] }));
assert.equal(r.json.stored, true);

// staff view
assert.equal((await call('GET', '/kiosk/status?full=1')).status, 401);
assert.equal((await call('GET', '/kiosk/status?full=1', undefined, { Authorization: 'Bearer nope' })).status, 401);
r = await call('GET', '/kiosk/status?full=1', undefined, { Authorization: 'Bearer staff-secret' });
const k = r.json.kiosks[0];
assert.equal(k.version, 25); assert.equal(k.rollback.from, 26);
assert.deepEqual(k.history.map(h => h.t), ['version', 'start', 'update', 'version', 'rollback', 'error']);
assert.equal(k.errors[1], '<img src=x onerror=alert(1)>', 'stored as plain text (the page renders with textContent)');

// validation
assert.equal((await call('POST', '/kiosk/ping', 'not json')).status, 400);
assert.equal((await call('POST', '/kiosk/ping', [1, 2])).status, 400);
assert.equal((await call('POST', '/kiosk/ping', ping({ kioskId: '../etc' }))).status, 400);
assert.equal((await call('POST', '/kiosk/ping', ping({ kioskId: 'x'.repeat(41) }))).status, 400);
assert.equal((await call('POST', '/kiosk/ping', JSON.stringify(ping({ errors: ['x'.repeat(9000)] })))).status, 413);
// junk / oversized fields are dropped or capped, unknown fields never stored
r = await call('POST', '/kiosk/ping', ping({ kioskId: 'K2', version: { evil: 1 }, serverHash: 'zz', uptimeSec: -5, node: 'v'.repeat(500),
  errors: Array.from({ length: 30 }, (_, i) => 'e' + i), secretStuff: 'CLOVER_API_TOKEN=abc', pay: 'yes', settings: ['A'.repeat(100)] }));
assert.equal(r.json.stored, true);
const rec = JSON.parse(kv._m.get('kiosk:K2').v).last;
assert.equal(rec.version, null); assert.equal(rec.serverHash, null); assert.equal(rec.uptimeSec, null);
assert.equal(rec.node.length, 20); assert.equal(rec.errors.length, 10); assert.equal(rec.pay, null);
assert.equal(rec.settings[0].length, 40); assert.ok(!('secretStuff' in rec));
assert.equal(kv._m.get('kiosk:K2').ttl, 60 * 60 * 24 * 30);
// at most 5 kiosk ids
for (const id of ['K3', 'K4', 'K5']) assert.equal((await call('POST', '/kiosk/ping', ping({ kioskId: id }))).json.stored, true);
assert.equal((await call('POST', '/kiosk/ping', ping({ kioskId: 'K6' }))).status, 403);
// appDown -> offline publicly
await call('POST', '/kiosk/ping', ping({ appDown: true, version: 25, errors: ['kiosk server is not answering'] }));
r = await call('GET', '/kiosk/status?id=ThirstyBeaches-Kiosk');
assert.equal(r.json.online, false); assert.equal(r.json.kiosks.length, 1);
// rate limit per kiosk id
env.KIOSK_MIN_GAP_MS = '60000';
await call('POST', '/kiosk/ping', ping({ kioskId: 'K3', version: 30 }));
assert.equal((await call('POST', '/kiosk/ping', ping({ kioskId: 'K3', version: 31 }))).status, 429);
// existing routes still answer
assert.equal((await call('GET', '/where')).json.open, false);
console.log('kiosk heartbeat worker tests passed');
