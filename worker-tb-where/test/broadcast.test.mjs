// node worker-tb-where/test/broadcast.test.mjs — "Tell the list we're open": GET/POST /broadcast, plus the owner app's
// CORS preflights. Fake KV + a stubbed fetch that records every call: NOTHING is ever sent (no text, no email).
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const KEY = 'c'.repeat(64);
console.log = () => {};
const done = msg => process.stdout.write(msg + '\n');
function makeKV() {
  const m = new Map();
  const kv = { _m: m, writes: 0, lists: 0,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { kv.writes++; m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    async list({ prefix = '', limit = 1000, cursor } = {}) {
      kv.lists++;
      const all = [...m.keys()].filter(k => k.startsWith(prefix)).sort();
      const s = cursor ? +cursor : 0, keys = all.slice(s, s + limit).map(name => ({ name }));
      return { keys, list_complete: s + limit >= all.length, cursor: s + limit >= all.length ? undefined : String(s + limit) };
    } };
  return kv;
}
let sent = [];
let relayReply = () => new Response('{"ok":true,"sent":2,"failed":0}');
let resendReply = () => new Response('{"data":[]}');
globalThis.fetch = async (url, init = {}) => {
  sent.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : null });
  if (String(url).includes('/api/relay')) return relayReply();
  if (String(url).includes('api.resend.com')) return resendReply();
  throw new Error('unexpected fetch ' + url);
};
let now = Date.parse('2026-10-25T17:00:00Z');
Date.now = () => now;
let env;
let ipn = 0;
const call = async (method, path, body, auth = 'staff-secret', extra = {}) => {
  const headers = { 'Content-Type': 'application/json', 'cf-connecting-ip': '10.5.0.' + (++ipn), ...extra };
  if (auth) headers.Authorization = 'Bearer ' + auth;
  const r = await worker.fetch(new Request('https://tb-where.test' + path, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {} });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: r.status, json, headers: r.headers };
};
const fresh = (x = {}) => {
  env = { TB_LOC: makeKV(), TB_SECRET: 'staff-secret', RELAY_KEY: KEY, ...x };
  return env;
};
// double opt-in: a signup is pending until confirmed (here by staff); only confirmed contacts are on the broadcast list
const subscribe = async contact => {
  assert.equal((await call('POST', '/subscribe', { contact, consent: true }, null)).status, 200);
  assert.equal((await call('POST', '/subs/confirm', { contact })).status, 200);
};
const msg = 'Thirsty Beaches: we’re open at Lehi Costco until 8.';

/* --- OFF by default: 503 broadcast-off, before auth, nothing listed / sent / written --- */
for (const v of [undefined, '', 'false', 'TRUE', '1', 'yes']) {
  fresh({ BROADCAST_ENABLED: v });
  for (const [m, b] of [['GET'], ['POST', { text: msg }]]) {
    const r = await call(m, '/broadcast', b);
    assert.equal(r.status, 503, 'off for ' + v); assert.equal(r.json.error, 'broadcast-off');
  }
  assert.equal(env.TB_LOC.lists, 0); assert.equal(env.TB_LOC.writes, 0); assert.equal(sent.length, 0);
}

/* --- ON: auth + text checks --- */
fresh({ BROADCAST_ENABLED: 'true' });
await subscribe('(801) 555-0142');
await subscribe('801-555-0199');
await subscribe('fan@example.com');
const w0 = env.TB_LOC.writes;
assert.equal((await call('GET', '/broadcast', undefined, null)).status, 401);
assert.equal((await call('GET', '/broadcast', undefined, 'wrong')).status, 401);
assert.equal((await call('POST', '/broadcast', { text: msg }, 'wrong')).status, 401);
for (const text of [undefined, 42, '', '   ', 'x'.repeat(301)]) {
  const r = await call('POST', '/broadcast', { text });
  assert.equal(r.status, 400, 'text ' + String(text).slice(0, 10)); assert.equal(r.json.error, 'bad-text');
}
assert.equal(sent.length, 0); assert.equal(env.TB_LOC.writes, w0);

/* --- GET status: counts from key names, no per-subscriber reads --- */
let r = await call('GET', '/broadcast');
assert.equal(r.status, 200);
assert.deepEqual(r.json, { enabled: true, phones: 2, emails: 1, sms: true, email: false, stopLine: 'Reply STOP to opt out',
  maxLen: 300, lastAt: null, gapMin: 10 });

/* --- POST: phones via the relay (kind sms, STOP line added), emails skipped without Resend --- */
r = await call('POST', '/broadcast', { text: '  ' + msg + '  ' });
assert.equal(r.status, 200, JSON.stringify(r.json));
assert.deepEqual(r.json.sms, { sent: 2, failed: 0 });
assert.deepEqual(r.json.email, { skipped: 'no-resend' });
assert.equal(r.json.phones, 2); assert.equal(r.json.emails, 1);
assert.equal(r.json.text, msg + '\nReply STOP to opt out');
assert.equal(sent.length, 1);
assert.equal(sent[0].url, 'https://saltydogtags.com/api/relay');
assert.equal(sent[0].init.headers.Authorization, 'Bearer ' + KEY);
assert.deepEqual(sent[0].body, { kind: 'sms', source: 'tb-where', to: ['+18015550142', '+18015550199'], text: msg + '\nReply STOP to opt out' });
assert.equal(env.TB_LOC.writes, w0 + 1, 'one KV write per broadcast');

/* --- one per 10 minutes (KV-backed, survives a fresh isolate) --- */
r = await call('POST', '/broadcast', { text: msg });
assert.equal(r.status, 429); assert.equal(r.json.error, 'too-soon');
assert.equal(sent.length, 1);
r = await call('GET', '/broadcast');
assert.equal(r.json.lastAt, now);
now += 10 * 60000 + 1;

/* --- text already ending in the STOP line is not doubled; Resend + footer -> emails go out (stubbed) --- */
env.RESEND_API_KEY = 're_test'; env.BROADCAST_EMAIL_FOOTER = 'TODO-footer';
sent = [];
r = await call('POST', '/broadcast', { text: 'Open now!\nReply STOP to opt out' });
assert.equal(r.status, 200);
assert.equal(sent[0].body.text, 'Open now!\nReply STOP to opt out');
const em = sent.find(s => s.url === 'https://api.resend.com/emails/batch');
assert.ok(em, 'emails through the Resend batch API');
assert.equal(em.body.length, 1); assert.deepEqual(em.body[0].to, ['fan@example.com']);
assert.match(em.body[0].text, /TODO-footer$/);
assert.deepEqual(r.json.email, { sent: 1, failed: 0 });
now += 10 * 60000 + 1;

/* --- Resend set but no footer -> emails skipped (marketing email needs Nick's address + unsubscribe line) --- */
delete env.BROADCAST_EMAIL_FOOTER; sent = [];
r = await call('POST', '/broadcast', { text: msg });
assert.deepEqual(r.json.email, { skipped: 'no-email-footer' });
assert.equal(sent.filter(s => s.url.includes('resend')).length, 0);
now += 10 * 60000 + 1;

/* --- relay refuses / is down: reported, never thrown; no relay key -> skipped --- */
relayReply = () => new Response('{"error":"rate-limited"}', { status: 429 });
r = await call('POST', '/broadcast', { text: msg });
assert.equal(r.status, 200); assert.deepEqual(r.json.sms, { error: 'rate-limited' });
now += 10 * 60000 + 1;
relayReply = () => { throw new TypeError('down'); };
r = await call('POST', '/broadcast', { text: msg });
assert.deepEqual(r.json.sms, { error: 'relay-unreachable' });
now += 10 * 60000 + 1;
delete env.RELAY_KEY; sent = [];
r = await call('POST', '/broadcast', { text: msg });
assert.deepEqual(r.json.sms, { skipped: 'no-sms' }); assert.equal(sent.length, 0);
now += 10 * 60000 + 1;

/* --- more than 500 phones: the first 500 go, the rest are reported as left --- */
fresh({ BROADCAST_ENABLED: 'true' });
relayReply = () => new Response('{"ok":true,"sent":500,"failed":0}');
for (let i = 0; i < 520; i++) env.TB_LOC._m.set('csub:+1801555' + String(1000 + i), '{}');
env.TB_LOC._m.set('csub:not-a-contact', '{}');
sent = [];
r = await call('POST', '/broadcast', { text: msg });
assert.equal(r.json.phones, 520); assert.equal(sent[0].body.to.length, 500); assert.equal(r.json.sms.left, 20);
assert.deepEqual(r.json.email, { skipped: 'no-emails' });
now += 10 * 60000 + 1;

/* --- owner app CORS (item 6): preflight with Authorization, and the real answers carry the header --- */
fresh({});
const OWNER = 'https://nicholasroper-cloud.github.io';
for (const p of ['/quotes', '/card/byphone?phone=8015550142', '/kiosk/status?full=1', '/broadcast']) {
  const pre = await worker.fetch(new Request('https://tb-where.test' + p, { method: 'OPTIONS', headers: {
    Origin: OWNER, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } }), env, {});
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(pre.headers.get('Access-Control-Allow-Headers'), /Authorization/i);
  assert.match(pre.headers.get('Access-Control-Allow-Methods'), /GET/);
}
for (const p of ['/quotes', '/card/byphone?phone=8015550142', '/kiosk/status?full=1']) {
  const res = await call('GET', p, undefined, 'staff-secret', { Origin: OWNER });
  assert.ok([200, 404].includes(res.status), p + ' ' + res.status);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
}

done('broadcast tests passed');

/* --- Thirsty Beaches' own Twilio number: straight to api.twilio.com, capped per send, relay not used --- */
{
  const realFetch = globalThis.fetch;
  const tw = [];
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes('api.twilio.com')) { tw.push({ url: String(url), init, body: String(init.body) }); return new Response('{"sid":"SM1"}', { status: 201 }); }
    return realFetch(url, init);
  };
  fresh({ BROADCAST_ENABLED: 'true', RELAY_KEY: KEY, TWILIO_SID: 'AC' + '1'.repeat(32), TWILIO_TOKEN: 'tok', TWILIO_FROM: '+13855215955', TWILIO_PER_SEND: '3' });
  now += 3600e3;
  for (const n of ['8015550101', '8015550102', '8015550103', '8015550104']) await subscribe(n);
  const st = await call('GET', '/broadcast'); assert.equal(st.json.sms, true);
  assert.equal(tw.length, 4, 'one confirmation text per signup went out through Twilio'); tw.length = 0;
  sent = [];
  const r = await call('POST', '/broadcast', { text: msg });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.sms.via, 'twilio'); assert.equal(r.json.sms.sent, 3); assert.equal(r.json.sms.left, 1);
  assert.equal(tw.length, 3); assert.ok(sent.every(x => !x.url.includes('/api/relay')), 'relay not used');
  assert.match(tw[0].url, /Accounts\/AC1{32}\/Messages\.json$/);
  const b = new URLSearchParams(tw[0].body); assert.equal(b.get('From'), '+13855215955'); assert.ok(b.get('Body').endsWith('Reply STOP to opt out'));
  assert.match(tw[0].init.headers.Authorization, /^Basic /);
  globalThis.fetch = realFetch;
  done('broadcast: own Twilio number ok');
}
