// node worker-tb-where/test/phone-card.test.mjs — punch card linked to a phone: link, recover, merge, staff lookup, abuse.
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const m = new Map(); let writes = 0;
const kv = { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { writes++; m.set(k, String(v)); },
  async delete(k) { m.delete(k); }, async list() { return { keys: [] }; } };
const env = { TB_LOC: kv, TB_SECRET: 'staff-secret' };
let now = Date.parse('2026-10-25T18:00:00Z');
Date.now = () => now;
const call = async (method, path, body, { ip = '10.2.0.1', auth = false } = {}) => {
  const r = await worker.fetch(new Request('https://tb-where.test' + path, { method,
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip, ...(auth ? { Authorization: 'Bearer staff-secret' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {} });
  return { status: r.status, json: await r.json() };
};
const code = (await call('GET', '/todaycode', undefined, { auth: true })).json.code.slice(-8);
const punch = async (id, n = 1) => { for (let i = 0; i < n; i++) { now += 181000; assert.equal((await call('POST', '/punch', { id, staff: code })).status, 200); } };

// a card with 4 punches on phone A
await punch('cardaaaa1111', 4);
// link: bad numbers
for (const bad of ['', '123', '555-1234', '(011) 555-1234', '801-155-1234', '1111111111', '+44 20 7946 0958', '8015550142999'])
  assert.equal((await call('POST', '/card/link', { id: 'cardaaaa1111', phone: bad }, { ip: '10.9.0.' + bad.length })).json.error, 'bad-phone', bad);
// link: a card with no punches yet can't be saved (stops KV spam from home)
assert.equal((await call('POST', '/card/link', { id: 'neverpunched1', phone: '801-555-0142' })).json.error, 'no-card');
// link ok: one write (plus the one-time pepper write)
let w = writes;
let r = await call('POST', '/card/link', { id: 'cardaaaa1111', phone: '(801) 555-0142' });
assert.deepEqual(r.json, { ok: true, last4: '0142' });
assert.equal(writes - w, 2, 'link write + one-time pepper');
const phKeys = [...m.keys()].filter(k => k.startsWith('ph:'));
assert.equal(phKeys.length, 1);
assert.ok(![...m.values()].some(v => v.includes('5550142') || v.includes('801555')), 'plain number never stored');
assert.match(phKeys[0], /^ph:[0-9a-f]{32}$/);
// same link again (other formatting): no write
w = writes;
r = await call('POST', '/card/link', { id: 'cardaaaa1111', phone: '+1 801.555.0142' });
assert.equal(r.json.already, true); assert.equal(writes, w);
// someone else can't re-point that number to their card from home
await punch('cardbbbb2222', 2);
r = await call('POST', '/card/link', { id: 'cardbbbb2222', phone: '8015550142' }, { ip: '10.2.0.77' });
assert.equal(r.status, 409); assert.equal(r.json.error, 'linked-elsewhere');
assert.equal(JSON.parse(m.get(phKeys[0])).card, 'cardaaaa1111');

// recover on a brand-new phone (no card there yet): needs staff
assert.equal((await call('POST', '/card/recover', { phone: '801-555-0142' })).status, 401);
assert.equal((await call('POST', '/card/recover', { phone: '801-555-0142', staff: '0000' === code ? '0001' : '0000' })).status, 401);
assert.equal((await call('POST', '/card/recover', { phone: '801-555-0199', staff: code })).json.error, 'not-linked');
assert.equal((await call('POST', '/card/recover', { phone: 'nope', staff: code })).json.error, 'bad-phone');
w = writes;
r = await call('POST', '/card/recover', { phone: '801 555 0142', staff: code, id: 'freshphone01' });
assert.equal(r.json.ok, true); assert.equal(r.json.id, 'cardaaaa1111'); assert.equal(r.json.card.punches, 4); assert.equal(r.json.last4, '0142');
assert.equal(writes, w, 'recovering onto an empty phone writes nothing');

// merge: phone B already has a card with 7 punches + 1 free drink; customer recovers the saved card there
m.set('card:cardbbbb2222', JSON.stringify({ id: 'cardbbbb2222', punches: 7, redeemed: 1, used: 2, last: now }));
r = await call('POST', '/card/recover', { phone: '8015550142', staff: code, id: 'cardbbbb2222' });
assert.equal(r.status, 409); assert.equal(r.json.error, 'has-punches');
assert.deepEqual(r.json.here, { id: 'cardbbbb2222', punches: 7, redeemed: 1 }); assert.equal(r.json.saved.punches, 4);
w = writes;
r = await call('POST', '/card/recover', { phone: '8015550142', staff: code, id: 'cardbbbb2222', merge: true });
assert.equal(r.json.merged, true); assert.equal(r.json.id, 'cardaaaa1111');
assert.deepEqual(r.json.card, { id: 'cardaaaa1111', punches: 1, redeemed: 2 }, '4+7=11 -> 1 punch + 1 new free drink, + the 1 kept');
assert.equal(writes - w, 2);
const b = JSON.parse(m.get('card:cardbbbb2222'));
assert.equal(b.mergedInto, 'cardaaaa1111'); assert.equal(b.punches, 0); assert.equal(b.redeemed, 0);
// the merged card can't be punched/redeemed/double-counted again; GET tells the page where it went
assert.equal((await call('GET', '/card?id=cardbbbb2222')).json.mergedInto, 'cardaaaa1111');
now += 181000;
assert.equal((await call('POST', '/punch', { id: 'cardbbbb2222', staff: code })).json.error, 'merged');
assert.equal((await call('POST', '/card/redeem', { id: 'cardbbbb2222', staff: code })).json.error, 'merged');
r = await call('POST', '/card/recover', { phone: '8015550142', staff: code, id: 'cardbbbb2222', merge: true });
assert.equal(r.json.merged, undefined, 'merging twice adds nothing'); assert.equal(r.json.card.redeemed, 2);
// a number linked to the merged-away card follows it to the survivor
m.set('card:cardcccc3333', JSON.stringify({ id: 'cardcccc3333', punches: 1, redeemed: 0 }));
await call('POST', '/card/link', { id: 'cardcccc3333', phone: '727-555-0199' });
m.set('card:cardcccc3333', JSON.stringify({ id: 'cardcccc3333', punches: 0, redeemed: 0, mergedInto: 'cardaaaa1111' }));
r = await call('POST', '/card/recover', { phone: '727-555-0199', staff: code });
assert.equal(r.json.id, 'cardaaaa1111');

// staff lookup by phone (trailer page): secret only, reads only
assert.equal((await call('GET', '/card/byphone?phone=8015550142')).status, 401);
w = writes;
r = await call('GET', '/card/byphone?phone=801-555-0142', undefined, { auth: true });
assert.equal(r.json.id, 'cardaaaa1111'); assert.equal(r.json.card.redeemed, 2); assert.equal(r.json.last4, '0142');
assert.equal((await call('GET', '/card/byphone?phone=4155550100', undefined, { auth: true })).status, 404);
assert.equal((await call('GET', '/card/byphone?phone=12', undefined, { auth: true })).status, 400);
assert.equal(writes, w);

// abuse: guessing the 4-digit staff code is braked per IP (on recover AND punch), other IPs unaffected
const guessIp = '10.66.0.1';
let statuses = [];
for (let i = 0; i < 10; i++) statuses.push((await call('POST', '/card/recover', { phone: '8015550142', staff: String(1000 + i) === code ? '9999' : String(1000 + i) }, { ip: guessIp })).status);
assert.deepEqual(statuses.slice(0, 8), Array(8).fill(401)); assert.deepEqual(statuses.slice(8), [429, 429]);
assert.equal((await call('POST', '/punch', { id: 'cardaaaa1111', staff: code }, { ip: guessIp })).status, 429, 'even the right code waits out the brake');
now += 181000;
assert.equal((await call('POST', '/punch', { id: 'cardaaaa1111', staff: code }, { ip: '10.2.0.200' })).status, 200);
now += 16 * 60000;
assert.equal((await call('POST', '/card/recover', { phone: '8015550142', staff: code }, { ip: guessIp })).status, 200, 'brake lifts after 15 min');
// abuse: link spam from one IP is limited (10 per 10 min)
statuses = [];
for (let i = 0; i < 12; i++) statuses.push((await call('POST', '/card/link', { id: 'nosuch' + i, phone: '801555' + String(1000 + i) }, { ip: '10.77.0.1' })).status);
assert.deepEqual(statuses.slice(10), [429, 429]);
assert.equal([...m.keys()].filter(k => k.startsWith('ph:')).length, 2, 'spam created no links');
console.log('phone card tests passed');
