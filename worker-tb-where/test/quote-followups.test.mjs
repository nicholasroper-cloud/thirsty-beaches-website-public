// node worker-tb-where/test/quote-followups.test.mjs — quote status, 24/72 h reminders (fake clock), Resend ack email.
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

function makeKV() {
  const m = new Map(); let writes = 0, lists = 0;
  return {
    get writes() { return writes; }, get lists() { return lists; },
    async get(k) { const e = m.get(k); return e ? e.v : null; },
    async put(k, v, o) { writes++; m.set(k, { v: String(v), meta: o && o.metadata, ttl: o && o.expirationTtl }); },
    async delete(k) { m.delete(k); },
    async list({ prefix = '', limit = 1000, cursor } = {}) {
      lists++;
      const all = [...m.keys()].filter(k => k.startsWith(prefix)).sort();
      const s = cursor ? +cursor : 0, keys = all.slice(s, s + limit).map(name => ({ name, metadata: m.get(name).meta }));
      return { keys, list_complete: s + limit >= all.length, cursor: s + limit >= all.length ? undefined : String(s + limit) };
    },
    _m: m,
  };
}
const kv = makeKV();
const env = { TB_LOC: kv, TB_SECRET: 'staff-secret' };
let now = Date.parse('2026-10-20T15:00:00Z');
Date.now = () => now;
const H = 3600e3;
const sent = [];
let resendFails = false;
globalThis.fetch = async (url, init = {}) => {
  sent.push({ url: String(url), init, body: init.body });
  if (String(url).startsWith('https://api.resend.com') && resendFails) throw new Error('resend down');
  return new Response('{}', { status: 200 });
};
let ipn = 0;
const call = async (method, path, body, auth) => {
  const waits = [];
  const r = await worker.fetch(new Request('https://tb-where.test' + path, { method,
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '10.1.0.' + (++ipn), ...(auth ? { Authorization: 'Bearer staff-secret' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil(p) { waits.push(p); } });
  await Promise.all(waits);
  return { status: r.status, json: await r.json() };
};
const cron = async () => { const waits = []; await worker.scheduled({ scheduledTime: now }, env, { waitUntil(p) { waits.push(p); } }); await Promise.all(waits); };
const quote = (x = {}) => ({ name: 'Jenna Park', email: 'jenna@example.com', phone: '801-555-0142', event: 'Wedding', date: '2026-11-14',
  city: 'Lehi, UT', guests: '150', hours: '3 hours', services: ['Dirty sodas'], notes: 'Buy cheap pills at spam.example.ru now', ...x });

/* --- email dormant without RESEND_API_KEY; no webhook -> nothing sent at all --- */
let r = await call('POST', '/quote', quote());
assert.equal(r.status, 200);
assert.equal(sent.length, 0, 'no channels configured: nothing goes out');
const id1 = r.json.id;
let [k1] = [...kv._m.keys()].filter(k => k.startsWith('quote:'));
assert.deepEqual(kv._m.get(k1).meta, { s: 'new', at: now, r: 0 });
assert.equal(JSON.parse(kv._m.get(k1).v).status, 'new');

/* --- email enabled --- */
env.RESEND_API_KEY = 're_test_123';
now += 1000;
r = await call('POST', '/quote', quote({ name: 'Marcus www.evil.com Lee', email: 'marcus@example.org', city: 'St. Pete <b>FL</b> visit http://x.co/y' }));
assert.equal(r.status, 200);
const id2 = r.json.id;
assert.equal(sent.length, 1);
const em = sent[0]; const eb = JSON.parse(em.body);
assert.equal(em.url, 'https://api.resend.com/emails');
assert.equal(em.init.headers.Authorization, 'Bearer re_test_123');
assert.deepEqual(eb.to, ['marcus@example.org']);
assert.equal(eb.from, 'Thirsty Beaches <hello@thirstybeaches.com>');
assert.equal(eb.reply_to, 'hello@thirstybeaches.com');
assert.match(eb.text, /Got it, here’s what happens next: we reply within one business day\./);
assert.match(eb.text, /Event: Wedding/); assert.match(eb.text, /Date: Sat, Nov 14, 2026/); assert.match(eb.text, /Guests: 150/);
assert.ok(!/evil|http|x\.co|spam|pills|<b>FL/i.test(eb.text + eb.html), 'no links, tags or notes echoed to the address typed in');
assert.match(eb.text, /your notes came through too/);
env.EMAIL_FROM = 'TB <events@thirstybeaches.com>';
/* --- email failure never fails the quote --- */
resendFails = true; sent.length = 0; now += 1000;
r = await call('POST', '/quote', quote({ email: 'third@example.com' }));
assert.equal(r.status, 200); assert.ok(r.json.ok);
assert.equal(JSON.parse(sent[0].body).from, 'TB <events@thirstybeaches.com>');
resendFails = false;
const id3 = r.json.id;

/* --- status --- */
assert.equal((await call('POST', '/quote/status', { id: id1, status: 'replied' })).status, 401);
assert.equal((await call('POST', '/quote/status', { id: id1, status: 'maybe' }, true)).status, 400);
assert.equal((await call('POST', '/quote/status', { id: '../x', status: 'booked' }, true)).status, 400);
assert.equal((await call('POST', '/quote/status', { id: 'zzzzzzzz-abc', status: 'booked' }, true)).status, 404);
let w = kv.writes;
r = await call('POST', '/quote/status', { id: id2, status: 'replied' }, true);
assert.equal(r.json.status, 'replied'); assert.equal(kv.writes, w + 1);
r = await call('POST', '/quote/status', { id: id2, status: 'replied' }, true);
assert.equal(kv.writes, w + 1, 'same status again: no write');
r = await call('GET', '/quotes', undefined, true);
assert.deepEqual(r.json.quotes.map(q => q.status), ['new', 'replied', 'new']);

/* --- reminders: dormant without QUOTE_WEBHOOK --- */
now += 25 * H; sent.length = 0;
await cron();
assert.equal(sent.length, 0);
env.QUOTE_WEBHOOK = 'https://ntfy.sh/tb-test';
/* a legacy quote saved before statuses (no metadata) never triggers a reminder */
kv._m.set('quote:' + String(9999999999999 - (now - 30 * H)).padStart(13, '0') + ':legacy-1', { v: JSON.stringify({ id: 'legacy-1', at: now - 30 * H, ...quote() }) });
/* at 23 h: nothing */
now -= 2 * H; sent.length = 0; w = kv.writes;
await cron();
assert.equal(sent.length, 0); assert.equal(kv.writes, w);
/* at 25 h: one reminder each for quotes 1 and 3 (2 is replied) */
now += 2 * H;
await cron();
assert.equal(sent.length, 2);
assert.ok(sent.every(s => s.url === 'https://ntfy.sh/tb-test'));
assert.match(sent[0].init.headers.Title, /Still new after 24 h: Wedding/);
assert.match(sent[0].body, /^Reminder: this request arrived 2[45] h ago/);
assert.equal(kv.writes, w + 2, 'one write per reminder');
/* next hours: no repeats */
sent.length = 0; w = kv.writes;
for (let i = 0; i < 5; i++) { now += H; await cron(); }
assert.equal(sent.length, 0); assert.equal(kv.writes, w);
/* quote 1 booked meanwhile; at 72 h only quote 3 is reminded again */
await call('POST', '/quote/status', { id: id1, status: 'booked' }, true);
now = JSON.parse(kv._m.get(k1).v).at + 72 * H + 60e3;
sent.length = 0;
await cron();
assert.equal(sent.length, 1);
assert.match(sent[0].init.headers.Title, /Still new after 72 h/);
const q3 = (await call('GET', '/quotes', undefined, true)).json.quotes.find(q => q.id === id3);
assert.equal(q3.remind, 2);
/* never a third time; a run costs one list() */
sent.length = 0; const l0 = kv.lists;
now += 48 * H; await cron();
assert.equal(sent.length, 0); assert.equal(kv.lists, l0 + 1);
/* Discord + generic webhook formats carry the reminder too */
env.QUOTE_WEBHOOK = 'https://discord.com/api/webhooks/1/x,https://hooks.zapier.com/1';
now = Date.parse('2026-11-01T12:00:00Z');
r = await call('POST', '/quote', quote({ email: 'late@example.com' }));
now += 24 * H + 1; sent.length = 0;
await cron();
const gen = sent.find(s => s.url.includes('zapier')), dis = sent.find(s => s.url.includes('discord'));
assert.equal(JSON.parse(gen.body).type, 'quote-reminder');
assert.match(JSON.parse(dis.body).content, /Still new after 24 h/);
console.log('quote follow-up tests passed');
