// node worker-tb-where/test/relay-alerts.test.mjs — new-quote alerts and 24/72 h reminders through the Salty Dog Tags
// relay (RELAY_KEY) when QUOTE_WEBHOOK is unset; QUOTE_WEBHOOK still wins. Fake KV + stubbed fetch, no network.
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const KEY = 'c'.repeat(64);
const logs = [];
console.log = (...a) => logs.push(a.map(String).join(' '));

function makeKV() {
  const m = new Map();
  return {
    async get(k) { const e = m.get(k); return e ? e.v : null; },
    async put(k, v, o) { m.set(k, { v: String(v), meta: o && o.metadata }); },
    async delete(k) { m.delete(k); },
    async list({ prefix = '', limit = 1000, cursor } = {}) {
      const all = [...m.keys()].filter(k => k.startsWith(prefix)).sort();
      const s = cursor ? +cursor : 0, keys = all.slice(s, s + limit).map(name => ({ name, metadata: m.get(name).meta }));
      return { keys, list_complete: s + limit >= all.length, cursor: s + limit >= all.length ? undefined : String(s + limit) };
    },
    _m: m,
  };
}
let env = { TB_LOC: makeKV(), TB_SECRET: 'staff-secret' };
let now = Date.parse('2026-10-20T15:00:00Z');
Date.now = () => now;
const H = 3600e3;
const sent = [];
let relayReply = () => new Response('{"ok":true,"sent":1}');
globalThis.fetch = async (url, init = {}) => {
  sent.push({ url: String(url), init, body: init.body });
  if (String(url).includes('/api/relay')) return relayReply();
  return new Response('{}', { status: 200 });
};
let ipn = 0;
const call = async (method, path, body) => {
  const waits = [];
  const r = await worker.fetch(new Request('https://tb-where.test' + path, { method,
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '10.2.0.' + (++ipn) },
    body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil(p) { waits.push(p); } });
  await Promise.all(waits);
  const text = await r.text();
  return { status: r.status, json: JSON.parse(text), text };
};
const cron = async () => { const waits = []; await worker.scheduled({ scheduledTime: now }, env, { waitUntil(p) { waits.push(p); } }); await Promise.all(waits); };
const quote = (x = {}) => ({ name: 'Jenna Park', email: 'jenna@example.com', phone: '801-555-0142', event: 'Wedding', date: '2026-11-14',
  city: 'Lehi, UT', guests: '150', hours: '3 hours', services: ['Dirty sodas'], notes: 'Lots of guests', ...x });
const relayCalls = () => sent.filter(s => s.url.includes('/api/relay'));

/* --- short / missing key: nothing goes out (same as before) --- */
env.RELAY_KEY = 'short';
let r = await call('POST', '/quote', quote());
assert.equal(r.status, 200); assert.equal(sent.length, 0);
await cron(); assert.equal(sent.length, 0);
env = { TB_LOC: makeKV(), TB_SECRET: 'staff-secret' };

/* --- RELAY_KEY only: new quote alert via the relay --- */
env.RELAY_KEY = KEY;
r = await call('POST', '/quote', quote({ notes: 'N'.repeat(1500) }));
assert.equal(r.status, 200);
assert.equal(relayCalls().length, 1);
const rc = relayCalls()[0];
assert.equal(rc.url, 'https://saltydogtags.com/api/relay');
assert.equal(rc.init.method, 'POST');
assert.equal(rc.init.headers.Authorization, 'Bearer ' + KEY);
let p = JSON.parse(rc.body);
assert.equal(p.kind, 'notify'); assert.equal(p.source, 'tb-where'); assert.equal(p.priority, 'high');
assert.equal(p.url, 'https://thirstybeaches.com/trailer');
assert.equal(p.title, 'New event request: Wedding');
assert.match(p.message, /^Wedding · 2026-11-14\nLehi, UT · 150 guests · 3 hours\n/);
assert.match(p.message, /Jenna Park · jenna@example.com · 801-555-0142/);
assert.equal(p.message.length, 1000, 'cut to the relay limit');
assert.ok(p.title.length <= 120);
// a relay failure never fails the quote
for (const fn of [() => new Response('{"error":"rate-limited"}', { status: 429 }), () => { throw new TypeError('down'); }, () => new Response('Not found', { status: 404 })]) {
  relayReply = fn;
  r = await call('POST', '/quote', quote({ email: 'x' + (++ipn) + '@example.com' }));
  assert.equal(r.status, 200); assert.ok(r.json.ok);
}
relayReply = () => new Response('{"ok":true,"sent":1}');
// RELAY_URL override
env.RELAY_URL = 'https://preview.salty-dog-tags.pages.dev/api/relay'; sent.length = 0;
await call('POST', '/quote', quote({ email: 'url@example.com' }));
assert.equal(relayCalls()[0].url, 'https://preview.salty-dog-tags.pages.dev/api/relay');
delete env.RELAY_URL;

/* --- reminders through the relay --- */
env.TB_LOC = makeKV(); now = Date.parse('2026-10-21T15:00:00Z');
await call('POST', '/quote', quote({ name: 'Ana Ruiz', email: 'ana@example.com' }));
now += 1000;
await call('POST', '/quote', quote({ name: 'Bo Diaz', email: 'bo@example.com', event: 'Birthday' }));
now += 25 * H; sent.length = 0;
await cron();
assert.equal(relayCalls().length, 2);
p = JSON.parse(relayCalls()[0].body);
assert.match(p.title, /^Still new after 24 h: (Wedding|Birthday)/); assert.equal(p.priority, 'normal');
assert.match(p.message, /^Reminder: this request arrived 25 h ago/);
sent.length = 0; now += H; await cron(); assert.equal(sent.length, 0, 'no repeat');
// relay down at 72 h: not marked, retried the next hour, sent once it works
now += 47 * H; relayReply = () => new Response('{"error":"notify-failed"}', { status: 502 }); sent.length = 0;
await cron();
assert.equal(relayCalls().length, 1, 'stops at the first failure');
const marks = () => [...env.TB_LOC._m.values()].map(e => JSON.parse(e.v)).filter(q => q.id).map(q => q.remind || 0).sort();
assert.deepEqual(marks(), [1, 1], 'nothing marked when the relay failed');
relayReply = () => new Response('{"ok":true,"sent":1}'); sent.length = 0; now += H;
await cron();
assert.equal(relayCalls().length, 2); assert.deepEqual(marks(), [2, 2]);
assert.match(JSON.parse(relayCalls()[0].body).title, /Still new after 72 h/);
// a 200 without ok:true counts as failed too
env.TB_LOC = makeKV(); now = Date.parse('2026-10-25T10:00:00Z');
await call('POST', '/quote', quote({ email: 'z@example.com' }));
now += 24 * H + 1; relayReply = () => new Response('{}'); await cron();
assert.deepEqual(marks(), [0]);
relayReply = () => new Response('{"ok":true,"sent":1}');

/* --- QUOTE_WEBHOOK wins: relay not used for alerts or reminders --- */
env.TB_LOC = makeKV(); env.QUOTE_WEBHOOK = 'https://ntfy.sh/tb-test'; now = Date.parse('2026-10-26T10:00:00Z'); sent.length = 0;
await call('POST', '/quote', quote({ email: 'w@example.com' }));
assert.equal(relayCalls().length, 0); assert.equal(sent.filter(s => s.url === 'https://ntfy.sh/tb-test').length, 1);
now += 24 * H + 1; sent.length = 0; await cron();
assert.equal(relayCalls().length, 0); assert.equal(sent.filter(s => s.url === 'https://ntfy.sh/tb-test').length, 1);
delete env.QUOTE_WEBHOOK;

/* --- SMS (own Twilio, region numbers) is unchanged and independent of the relay --- */
env.TB_LOC = makeKV(); Object.assign(env, { QUOTE_SMS_UTAH: '+18015550000', TWILIO_ACCOUNT_SID: 'ACx', TWILIO_AUTH_TOKEN: 'tw-token', TWILIO_FROM: '+18015551111' });
sent.length = 0;
await call('POST', '/quote', quote({ email: 's@example.com' }));
assert.equal(relayCalls().length, 1); assert.equal(sent.filter(s => s.url.includes('twilio')).length, 1);

/* --- the key never shows up in a response or a log line --- */
r = await call('GET', '/where'); assert.ok(!r.text.includes(KEY));
for (const l of logs) assert.ok(!l.includes(KEY) && !l.includes('tw-token'), 'secret in a log: ' + l);
process.stdout.write('relay alert tests passed\n');
