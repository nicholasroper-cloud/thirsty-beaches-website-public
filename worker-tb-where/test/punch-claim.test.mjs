// node worker-tb-where/test/punch-claim.test.mjs — POST /card/claim: a punch from a paid order, signed by the station
// with PUNCH_KEY. Fake KV, no network. Covers: punch-off, good token, bad sig, expired, reused, every-10 free drink.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from '../src/worker.js';

const KEY = 'ab'.repeat(32);                       // what the setup workflow makes: 64 hex chars
const m = new Map();
const ttl = new Map();
let writes = 0;
const kv = { async get(k) { return m.has(k) ? m.get(k) : null; },
  async put(k, v, o) { writes++; m.set(k, String(v)); if (o && o.expirationTtl) ttl.set(k, o.expirationTtl); },
  async delete(k) { m.delete(k); }, async list() { return { keys: [], list_complete: true }; } };
let env = { TB_LOC: kv, TB_SECRET: 'staff-secret' };
globalThis.fetch = async () => { throw new Error('no network in tests'); };
let ipn = 0;
const call = async (method, path, body, ip) => {
  const r = await worker.fetch(new Request('https://tb-where.test' + path, { method,
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip || '10.9.0.' + (++ipn), Origin: 'https://thirstybeaches.com' },
    body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {} });
  return { status: r.status, json: await r.json(), headers: r.headers };
};
// the station's side of the contract, written independently with node:crypto
const token = (ref, drinks, expMs, key = KEY) => {
  const payload = `${ref}.${drinks}.${expMs}`;
  return payload + '.' + createHmac('sha256', key).update(payload).digest('hex').slice(0, 32);
};
const week = () => Date.now() + 7 * 86400e3;

/* --- feature off until PUNCH_KEY is set (and a too-short key counts as unset) --- */
for (const k of [undefined, '', 'short']) {
  env = { TB_LOC: kv, TB_SECRET: 'staff-secret', PUNCH_KEY: k };
  const r = await call('POST', '/card/claim', { id: 'abc123', token: token('KQ1', 2, week()) });
  assert.equal(r.status, 503); assert.equal(r.json.error, 'punch-off');
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), '*', 'CORS like the other card routes');
}
assert.equal(m.size, 0, 'punch-off writes nothing');
env = { TB_LOC: kv, TB_SECRET: 'staff-secret', PUNCH_KEY: KEY };

/* --- good token: a brand-new card gets the punches --- */
let r = await call('POST', '/card/claim', { id: 'abc123', token: token('KQ1ABCDE', 2, week()) });
assert.equal(r.status, 200, JSON.stringify(r.json));
assert.deepEqual(r.json, { ok: true, added: 2, earned: 0, card: { id: 'abc123', punches: 2, redeemed: 0 } });
assert.ok(m.has('claim:KQ1ABCDE')); assert.equal(ttl.get('claim:KQ1ABCDE'), 8 * 86400, 'claim key lives 8 days');
assert.equal(JSON.parse(m.get('card:abc123')).punches, 2);
assert.equal(writes, 2, 'one claim = 2 KV writes');

/* --- reused: same ref again (even with a fresh, valid token for it) -> 409, card unchanged --- */
r = await call('POST', '/card/claim', { id: 'abc123', token: token('KQ1ABCDE', 2, week()) });
assert.equal(r.status, 409); assert.equal(r.json.error, 'used');
r = await call('POST', '/card/claim', { id: 'other1', token: token('KQ1ABCDE', 5, week()) });
assert.equal(r.status, 409, 'a ref can only be claimed once, onto any card');
assert.equal(JSON.parse(m.get('card:abc123')).punches, 2);
assert.equal(m.has('card:other1'), false);

/* --- bad signature: wrong key, tampered drinks / ref / exp, short or junk sig -> 400, nothing written --- */
const w0 = writes;
const good = token('KQ2', 1, week());
const [ref, , exp, sig] = good.split('.');
for (const t of [
  token('KQ2', 1, week(), 'cd'.repeat(32)),       // signed with another key
  `${ref}.5.${exp}.${sig}`,                        // drinks bumped
  `KQ3.1.${exp}.${sig}`,                           // ref swapped
  `${ref}.1.${Number(exp) + 1000}.${sig}`,         // exp pushed out
  `${ref}.1.${exp}.${sig.slice(0, 31)}`,           // short sig
  `${ref}.1.${exp}.${sig.toUpperCase()}`,          // not the hex form the station makes
  `${ref}.6.${exp}.${sig}`, `${ref}.0.${exp}.${sig}`,  // drinks outside 1..5
  'kq2.1.' + exp + '.' + sig, '', 'nope', null,
]) {
  r = await call('POST', '/card/claim', { id: 'abc123', token: t });
  assert.equal(r.status, 400, 'bad token ' + t); assert.equal(r.json.error, 'bad-token');
}
assert.equal(writes, w0, 'bad tokens write nothing');
assert.equal((await call('POST', '/card/claim', { token: good })).json.error, 'no-id');

/* --- expired -> 410 (and it does not burn the ref) --- */
r = await call('POST', '/card/claim', { id: 'abc123', token: token('KQ4', 3, Date.now() - 1000) });
assert.equal(r.status, 410); assert.equal(r.json.error, 'expired');
assert.equal(m.has('claim:KQ4'), false);

/* --- every 10 -> a free drink, same rule as /punch (incl. a claim that crosses 10 twice over a few orders) --- */
m.set('card:full9', JSON.stringify({ id: 'full9', punches: 9, redeemed: 0, created: 1 }));
r = await call('POST', '/card/claim', { id: 'full9', token: token('KQ5', 3, week()) });
assert.equal(r.status, 200);
assert.deepEqual(r.json.card, { id: 'full9', punches: 2, redeemed: 1 }); assert.equal(r.json.earned, 1);
r = await call('POST', '/card/claim', { id: 'full9', token: token('KQ6', 5, week()) });
r = await call('POST', '/card/claim', { id: 'full9', token: token('KQ7', 3, week()) });
assert.deepEqual(r.json.card, { id: 'full9', punches: 0, redeemed: 2 }); assert.equal(r.json.earned, 1);
// staff /punch still uses the same rule
m.set('card:p9', JSON.stringify({ id: 'p9', punches: 9, redeemed: 0 }));
r = await call('POST', '/punch', { id: 'p9', staff: 'staff-secret' });
assert.equal(r.json.earned, true); assert.equal(r.json.card.punches, 0); assert.equal(r.json.card.redeemed, 1);

/* --- a merged card answers 409 merged without burning the ref (the page follows it and retries) --- */
m.set('card:old1', JSON.stringify({ id: 'old1', punches: 0, redeemed: 0, mergedInto: 'new1' }));
r = await call('POST', '/card/claim', { id: 'old1', token: token('KQ8', 1, week()) });
assert.equal(r.status, 409); assert.equal(r.json.error, 'merged'); assert.equal(r.json.into, 'new1');
assert.equal(m.has('claim:KQ8'), false);
r = await call('POST', '/card/claim', { id: 'new1', token: token('KQ8', 1, week()) });
assert.equal(r.status, 200); assert.equal(r.json.card.punches, 1);

/* --- rate limit like the other public card routes: 10 per IP per 10 min --- */
let last;
for (let i = 0; i < 11; i++) last = await call('POST', '/card/claim', { id: 'abc123', token: 'junk' }, '10.66.0.1');
assert.equal(last.status, 429);

/* --- bad JSON --- */
const bad = await worker.fetch(new Request('https://tb-where.test/card/claim', { method: 'POST', body: '{', headers: { 'cf-connecting-ip': '10.77.0.1' } }), env, {});
assert.equal(bad.status, 400);

console.log('punch claim tests passed');
