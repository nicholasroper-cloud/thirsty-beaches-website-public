// node test/security.test.mjs — 2026-11-15 review fixes: play tokens, draw tickets, redeem key, staff code, double opt-in.
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import worker from '../src/worker.js';

console.log = () => {};
function makeKV() {
  const m = new Map();
  const kv = { _m: m, writes: 0,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { kv.writes++; m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    async list({ prefix = '', limit = 1000, cursor } = {}) {
      const all = [...m.keys()].filter(k => k.startsWith(prefix)).sort();
      const s = cursor ? +cursor : 0, keys = all.slice(s, s + limit).map(name => ({ name }));
      return { keys, list_complete: s + limit >= all.length, cursor: s + limit >= all.length ? undefined : String(s + limit) };
    } };
  return kv;
}
let outbound = [];
globalThis.fetch = async (url, init = {}) => { outbound.push({ url: String(url), body: init.body ? String(init.body) : '' }); return new Response('{"ok":true}', { status: 200 }); };
let now = Date.parse('2026-11-16T18:00:00Z');   // a Monday, 11:00 Denver
Date.now = () => now;
const PLAY = 'play-secret-0123456789abcdef-xyz', KIOSK = 'kiosk-key-0123456789abcdef-xyz';
let env, ipn = 0;
const fresh = (x = {}) => (env = { TB_LOC: makeKV(), TB_SECRET: 'staff-secret-long', PLAY_SECRET: PLAY, KIOSK_KEY: KIOSK, ...x });
const call = async (method, path, body, { auth, ip, headers = {}, raw, ct = 'application/json' } = {}) => {
  const h = { 'cf-connecting-ip': ip || '10.9.0.' + (++ipn), ...headers };
  if (body !== undefined || raw !== undefined) h['Content-Type'] = ct;
  if (auth) h.Authorization = 'Bearer ' + (auth === true ? 'staff-secret-long' : auth);
  const r = await worker.fetch(new Request('https://tb-where.test' + path, { method, headers: h, body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {} });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: r.status, json, text, headers: r.headers };
};
const b64u = s => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tokenAged = (ageMs, id = 'aabbccddeeff00112233aabb') => { const p = JSON.stringify({ id, iat: now - ageMs }); return b64u(p) + '.' + createHmac('sha256', PLAY).update(p).digest('hex'); };

/* ---- play tokens ---- */
fresh({ PLAY_SECRET: undefined });
assert.equal((await call('GET', '/scores/token')).status, 503, 'no PLAY_SECRET, no tokens');
fresh();
const mint = await call('GET', '/scores/token'); assert.equal(mint.status, 200); assert.ok(mint.json.token); assert.equal(env.TB_LOC.writes, 0, 'minting writes nothing');
// too young
assert.equal((await call('POST', '/scores', { score: 9000, who: 'AAA', token: mint.json.token })).json.prize, 'no-token');
assert.equal(env.TB_LOC.writes, 0, 'an invalid token records nothing');
// a token signed with another secret
const forged = (() => { const p = JSON.stringify({ id: 'aabbccddeeff00112233aabb', iat: now - 120000 }); return b64u(p) + '.' + createHmac('sha256', 'x'.repeat(30)).update(p).digest('hex'); })();
assert.equal((await call('POST', '/scores', { score: 9000, token: forged })).json.code, null);
// valid: prize once per network per day, replay refused
const t1 = tokenAged(120000);
let r = await call('POST', '/scores', { score: 9000, who: 'zed', token: t1 }, { ip: '203.0.113.1' });
assert.equal(r.json.prize, 'won'); assert.match(r.json.code, /^MAZE-\d{6}$/);
r = await call('POST', '/scores', { score: 9000, token: t1 }, { ip: '203.0.113.1' });
assert.equal(r.json.code, null); assert.equal(r.json.prize, 'already-claimed', 'single use');
r = await call('POST', '/scores', { score: 9000, token: tokenAged(120000, '112233445566778899aabbcc') }, { ip: '203.0.113.1' });
assert.equal(r.json.prize, 'already-claimed', 'new token, same network, same day');
r = await call('POST', '/scores', { score: 9000, token: tokenAged(120000, '212233445566778899aabbcc') }, { ip: '203.0.113.2' });
assert.equal(r.json.prize, 'won', 'another network has its own budget');
// daily cap
fresh({ PRIZE_DAILY_CAP: '1' });
assert.equal((await call('POST', '/scores', { score: 9000, token: tokenAged(120000, 'a1a1a1a1a1a1a1a1a1a1a1a1') }, { ip: '198.51.100.1' })).json.prize, 'won');
assert.equal((await call('POST', '/scores', { score: 9000, token: tokenAged(120000, 'b1b1b1b1b1b1b1b1b1b1b1b1') }, { ip: '198.51.100.2' })).json.prize, 'sold-out');
// null / array bodies
for (const raw of ['null', '[]', '5']) assert.equal((await call('POST', '/scores', undefined, { raw })).status, 400, raw);
// minting is capped per IP
fresh(); let last; for (let i = 0; i < 21; i++) last = (await call('GET', '/scores/token', undefined, { ip: '203.0.113.40' })).status;
assert.equal(last, 429);

/* ---- weekly draw: off until DRAW_ENABLED, then one ticket per network per week, no personal data ---- */
fresh();
r = await call('POST', '/scores', { score: 700, token: tokenAged(120000, 'c1c1c1c1c1c1c1c1c1c1c1c1') }, { ip: '203.0.113.5' });
assert.equal(r.json.draw, null, 'no draw entry while the draw is off');
fresh({ DRAW_ENABLED: 'true' });
r = await call('POST', '/scores', { score: 700, who: 'ABC', token: tokenAged(120000, 'c2c2c2c2c2c2c2c2c2c2c2c2') }, { ip: '203.0.113.5' });
assert.match(r.json.draw.ticket, /^DRAW-[A-Z2-9]{6}$/); assert.equal(r.json.draw.already, false);
const ticket = r.json.draw.ticket;
r = await call('POST', '/scores', { score: 900, who: 'ABC', token: tokenAged(120000, 'c3c3c3c3c3c3c3c3c3c3c3c3') }, { ip: '203.0.113.5' });
assert.equal(r.json.draw.ticket, ticket); assert.equal(r.json.draw.already, true, 'one entry per person per week');
const entryKeys = [...env.TB_LOC._m.keys()].filter(k => k.startsWith('draw:'));
assert.equal(entryKeys.length, 1); assert.ok(!entryKeys[0].includes('203.0.113.5'), 'the IP is hashed in the key');
assert.ok(!/203\.0\.113\.5/.test(env.TB_LOC._m.get(entryKeys[0])), 'no IP in the entry');
r = await call('GET', '/draw', undefined, { auth: true }); assert.equal(r.json.entries, 1); assert.equal(r.json.winner.ticket, ticket);
assert.ok(!('device' in r.json.all[0]));
assert.equal((await call('GET', '/draw')).status, 401);
// next week: last week's winner is public, claimable once by staff
now += 7 * 86400e3;
r = await call('GET', '/draw/last'); assert.equal(r.json.ticket, ticket);
assert.equal((await call('POST', '/draw/claim', { ticket })).status, 401);
assert.equal((await call('POST', '/draw/claim', { ticket }, { auth: true })).json.status, 'claimed');
assert.equal((await call('POST', '/draw/claim', { ticket }, { auth: true })).json.status, 'already-claimed');
assert.equal((await call('POST', '/draw/claim', { ticket: 'DRAW-ZZZZZZ' }, { auth: true })).json.status, 'not-a-winner');
now = Date.parse('2026-11-16T18:00:00Z');
// the week rolls over on Monday local time, not UTC: Sunday 23:30 Denver is still the old week
const wk = async t => { now = t; fresh({ DRAW_ENABLED: 'true' }); const x = await call('POST', '/scores', { score: 700, token: tokenAged(120000, 'd1d1d1d1d1d1d1d1d1d1d1d1') }); return x.json.draw.week; };
const sunNight = await wk(Date.parse('2026-11-16T06:30:00Z')), monMorning = await wk(Date.parse('2026-11-16T07:30:00Z'));
assert.notEqual(sunNight, monMorning, 'Sunday 23:30 MST and Monday 00:30 MST are different weeks'); now = Date.parse('2026-11-16T18:00:00Z');

/* ---- Maze code redeem needs the kiosk key ---- */
fresh();
env.TB_LOC._m.set('code:MAZE-123456', JSON.stringify({ redeemed: false }));
assert.equal((await call('POST', '/redeem', { code: 'MAZE-123456' })).json.status, 'valid');
assert.equal((await call('POST', '/redeem', { code: 'MAZE-123456', redeem: true })).status, 401);
assert.equal((await call('POST', '/redeem', { code: 'MAZE-123456', redeem: true }, { headers: { 'X-Kiosk-Key': KIOSK + 'x' } })).status, 401);
assert.equal(JSON.parse(env.TB_LOC._m.get('code:MAZE-123456')).redeemed, false, 'still unburned');
assert.equal((await call('POST', '/redeem', { code: 'MAZE-123456', redeem: true }, { headers: { 'X-Kiosk-Key': KIOSK } })).json.status, 'redeemed');
assert.equal((await call('POST', '/redeem', { code: 'MAZE-123456', redeem: true }, { headers: { 'X-Kiosk-Key': KIOSK } })).json.status, 'used');
fresh({ KIOSK_KEY: undefined }); env.TB_LOC._m.set('code:MAZE-123456', JSON.stringify({ redeemed: false }));
assert.equal((await call('POST', '/redeem', { code: 'MAZE-123456', redeem: true }, { headers: { 'X-Kiosk-Key': 'anything' } })).status, 503, 'no KIOSK_KEY: redeeming is off, not open');
// a claim key alone (a redemption in flight) blocks a second burn
fresh(); env.TB_LOC._m.set('code:MAZE-654321', JSON.stringify({ redeemed: false })); env.TB_LOC._m.set('redeeming:MAZE-654321', '1');
assert.equal((await call('POST', '/redeem', { code: 'MAZE-654321', redeem: true }, { headers: { 'X-Kiosk-Key': KIOSK } })).json.status, 'used');
// the loyalty redeem moved to /card/redeem
fresh(); env.TB_LOC._m.set('card:abc123', JSON.stringify({ id: 'abc123', punches: 0, redeemed: 1 }));
assert.equal((await call('POST', '/redeem', { id: 'abc123', staff: 'staff-secret-long' })).json.status, 'unknown');
r = await call('POST', '/card/redeem', { id: 'abc123', staff: 'staff-secret-long' }); assert.equal(r.status, 200); assert.equal(r.json.card.redeemed, 0);
assert.equal((await call('POST', '/card/redeem', undefined, { raw: 'null' })).status, 400);

/* ---- staff day code: 8 characters, Denver date, wrong tries counted in KV across isolates ---- */
fresh();
const code = (await call('GET', '/todaycode', undefined, { auth: true })).json.code;
assert.match(code, /^UPSIZE-[A-HJKMNP-Z2-9]{8}$/);
assert.equal((await call('POST', '/punch', { id: 'p1', staff: code.slice(-8).toLowerCase() })).status, 200, 'typed without the prefix, any case');
now += 3 * 3600e3; // 21:00 UTC = 14:00 Denver, same Denver day
assert.equal((await call('GET', '/todaycode', undefined, { auth: true })).json.code, code);
now = Date.parse('2026-11-17T06:30:00Z'); // 23:30 Monday Denver: UTC is already Tuesday, the code must not have rolled
assert.equal((await call('GET', '/todaycode', undefined, { auth: true })).json.code, code, 'the code follows the trailer date, not UTC');
now = Date.parse('2026-11-17T08:00:00Z'); // 01:00 Tuesday Denver
assert.notEqual((await call('GET', '/todaycode', undefined, { auth: true })).json.code, code);
now = Date.parse('2026-11-16T18:00:00Z');
// KV-backed guess brake: a fresh isolate (cleared in-memory counters are simulated by changing the ip seen in memory, same salted hash input)
fresh(); let st = [];
for (let i = 0; i < 9; i++) st.push((await call('POST', '/punch', { id: 'p2', staff: 'WRONG' + i }, { ip: '203.0.113.99' })).status);
assert.deepEqual(st.slice(0, 8), Array(8).fill(401)); assert.equal(st[8], 429);
assert.ok([...env.TB_LOC._m.keys()].some(k => k.startsWith('staffbad:') && !k.includes('203.0.113.99')), 'the KV counter key is a hash, not the IP');

/* ---- constant-time secret compare still accepts the right secret and nothing else ---- */
fresh();
assert.equal((await call('GET', '/subs', undefined, { auth: true })).status, 200);
assert.equal((await call('GET', '/subs', undefined, { auth: 'staff-secret-lonX' })).status, 401);
assert.equal((await call('GET', '/subs', undefined, { auth: 'staff-secret-long-and-more' })).status, 401);
assert.equal((await call('GET', '/subs')).status, 401);

/* ---- double opt-in signup ---- */
const consent = createHash('sha256').update("Yes, Thirsty Beaches may send automated marketing texts to this number about stops and specials. Not required to buy anything. A few msgs/month; msg & data rates may apply. Reply STOP to cancel, HELP for help. I'm 13+ and this is my number. Terms: thirstybeaches.com/sms-terms").digest('hex');
fresh();   // no Twilio / Resend: nothing can be sent, the signup stays pending for staff
r = await call('POST', '/subscribe', { contact: '(801) 555-0142', smsConsent: true, source: 'kiosk', consentVersion: consent }, { ip: '203.0.113.60' });
assert.equal(r.status, 200); assert.equal(r.json.status, 'pending'); assert.equal(r.json.confirm, 'staff');
assert.equal(outbound.length, 0, 'nothing is sent without a sender');
let rec = JSON.parse(env.TB_LOC._m.get('pend:+18015550142'));
assert.equal(rec.source, 'kiosk'); assert.equal(rec.consentVersion, consent); assert.ok(rec.ts); assert.equal(env.TB_LOC._m.has('csub:+18015550142'), false);
assert.equal((await call('POST', '/subscribe', { contact: '801-555-0143', smsConsent: false })).json.error, 'consent-required');
assert.equal((await call('POST', '/subscribe', { contact: '801-555-0143', smsConsent: true, consentVersion: 'f'.repeat(64) })).status, 409, 'a stale page cannot record a different wording');
assert.equal((await call('POST', '/subscribe', undefined, { raw: 'null' })).status, 400);
assert.equal((await call('POST', '/subscribe', { contact: 'nope', smsConsent: true })).json.error, 'bad-contact');
// pending people are not on the broadcast list; staff confirm moves them
env.BROADCAST_ENABLED = 'true'; env.RELAY_KEY = 'r'.repeat(40);
assert.equal((await call('GET', '/broadcast', undefined, { auth: true })).json.phones, 0);
assert.equal((await call('POST', '/subs/confirm', { contact: '8015550142' })).status, 401);
assert.equal((await call('POST', '/subs/confirm', { contact: '8015550142' }, { auth: true })).status, 200);
assert.equal((await call('GET', '/broadcast', undefined, { auth: true })).json.phones, 1);
assert.equal(JSON.parse(env.TB_LOC._m.get('csub:+18015550142')).confirmedVia, 'staff');
// the web form: no smsConsent field needed for email, source defaults to web, version recorded for text
r = await call('POST', '/subscribe', { contact: 'Fan@Example.com' }); assert.equal(r.json.status, 'pending');
assert.equal(JSON.parse(env.TB_LOC._m.get('pend:fan@example.com')).consentVersion, null);
// T-1: the consent version is stamped ONLY from a hash the client sent that equals the current wording
r = await call('POST', '/subscribe', { contact: '801-555-0150', smsConsent: true, source: 'web', consentVersion: consent }); rec = JSON.parse(env.TB_LOC._m.get('pend:+18015550150'));
assert.equal(rec.source, 'web'); assert.equal(rec.consentVersion, consent);
// the old kiosk body ({consent:true, smsConsent:true}, no source, no hash) must NOT be recorded as the website's text
r = await call('POST', '/subscribe', { contact: '801-555-0155', consent: true, smsConsent: true }); assert.equal(r.status, 200);
rec = JSON.parse(env.TB_LOC._m.get('pend:+18015550155')); assert.equal(rec.source, 'unknown'); assert.equal(rec.consentVersion, null);
// a web post with no hash (no-JS form without the hidden field) gets no version either
r = await call('POST', '/subscribe', { contact: '801-555-0156', smsConsent: true, source: 'web' }); assert.equal(JSON.parse(env.TB_LOC._m.get('pend:+18015550156')).consentVersion, null);
// T-7: an already-confirmed number gets the same reply as a new signup
r = await call('POST', '/subscribe', { contact: '801-555-0142', smsConsent: true, source: 'web', consentVersion: consent });   // confirmed above by staff
const fresh1 = await call('POST', '/subscribe', { contact: '801-555-0157', smsConsent: true, source: 'web', consentVersion: consent });
assert.deepEqual(r.json, fresh1.json, 'confirmed and new look identical'); assert.equal(r.json.status, 'pending');
// a plain HTML form post (no JS) is accepted and redirected, never a JSON page
r = await call('POST', '/subscribe', undefined, { raw: 'contact=801-555-0151&smsConsent=1&source=web&via=sms', ct: 'application/x-www-form-urlencoded' });
assert.equal(r.status, 303); assert.match(r.headers.get('location'), /signup-thanks\.html\?r=ok$/);
assert.ok(env.TB_LOC._m.has('pend:+18015550151'));
r = await call('POST', '/subscribe', undefined, { raw: 'contact=801-555-0152&via=sms', ct: 'application/x-www-form-urlencoded' });
assert.match(r.headers.get('location'), /r=consent$/);
// honeypot
r = await call('POST', '/subscribe', { contact: '801-555-0153', smsConsent: true, website: 'x' }); assert.equal(r.status, 200); assert.equal(env.TB_LOC._m.has('pend:+18015550153'), false);
// per-IP rate limit
fresh(); let last2; for (let i = 0; i < 10; i++) last2 = (await call('POST', '/subscribe', { contact: '801-555-02' + String(10 + i), smsConsent: true }, { ip: '203.0.113.70' })).status;
assert.equal(last2, 429);

// with Twilio configured: ONE confirmation text, not repeated on a quick re-submit, at most 3 in total
fresh({ TWILIO_SID: 'AC' + '1'.repeat(32), TWILIO_TOKEN: 'tok', TWILIO_FROM: '+13855215955' }); outbound = [];
await call('POST', '/subscribe', { contact: '801-555-0170', smsConsent: true });
assert.equal(outbound.length, 1); assert.match(new URLSearchParams(outbound[0].body).get('Body'), /^Thirsty Beaches: reply YES/);
await call('POST', '/subscribe', { contact: '801-555-0170', smsConsent: true });
assert.equal(outbound.length, 1, 'a quick re-submit does not text again');
for (let i = 0; i < 4; i++) { now += 11 * 60000; await call('POST', '/subscribe', { contact: '801-555-0170', smsConsent: true }); }
assert.equal(outbound.length, 3, 'three confirmation texts at most');
// inbound webhook: signature required; YES confirms; STOP removes; HELP answers
const sign = (url, params, token = 'tok') => createHmac('sha1', token).update(url + Object.keys(params).sort().map(k => k + params[k]).join('')).digest('base64');
const inbound = async (params, sig) => { const raw = new URLSearchParams(params).toString(); return call('POST', '/sms/inbound', undefined, { raw, ct: 'application/x-www-form-urlencoded', headers: { 'X-Twilio-Signature': sig === undefined ? sign('https://tb-where.test/sms/inbound', params) : sig } }); };
assert.equal((await inbound({ From: '+18015550170', Body: 'YES' }, 'bad')).status, 403);
r = await inbound({ From: '+18015550170', Body: 'yes' }); assert.equal(r.status, 200); assert.match(r.text, /you're in/);
assert.ok(env.TB_LOC._m.has('csub:+18015550170')); assert.equal(env.TB_LOC._m.has('pend:+18015550170'), false);
assert.equal(JSON.parse(env.TB_LOC._m.get('csub:+18015550170')).confirmedVia, 'sms-reply');
assert.match((await inbound({ From: '+18015550170', Body: 'HELP' })).text, /hello@thirstybeaches\.com/);
r = await inbound({ From: '+18015550170', Body: 'please stop texting me' }); assert.match(r.text, /unsubscribed/); assert.equal(env.TB_LOC._m.has('csub:+18015550170'), false);
fresh(); assert.equal((await call('POST', '/sms/inbound', undefined, { raw: 'From=%2B18015550170&Body=YES', ct: 'application/x-www-form-urlencoded' })).status, 503, 'no TWILIO_TOKEN: inbound is off');

// self-serve unsubscribe never reveals who is on the list
fresh(); await call('POST', '/subscribe', { contact: '801-555-0180', smsConsent: true });
await call('POST', '/subs/confirm', { contact: '801-555-0180' }, { auth: true });
assert.equal((await call('POST', '/unsubscribe', { contact: '801-555-0180' })).json.ok, true);
assert.equal((await call('POST', '/unsubscribe', { contact: '801-555-0199' })).json.ok, true, 'same answer for a stranger');
assert.equal(env.TB_LOC._m.has('csub:+18015550180'), false);
assert.equal((await call('POST', '/unsubscribe', undefined, { raw: 'null' })).status, 400);
// email confirm link
fresh({ RESEND_API_KEY: 're_test' }); outbound = [];
await call('POST', '/subscribe', { contact: 'link@example.com' });
assert.equal(outbound.length, 1); const code2 = /confirm\?c=([a-z0-9]{24})/.exec(JSON.parse(outbound[0].body).text)[1];
assert.equal((await call('POST', '/subscribe/confirm', { code: 'x'.repeat(24) })).status, 404);
assert.equal((await call('POST', '/subscribe/confirm', { code: code2 })).json.ok, true);
assert.ok(env.TB_LOC._m.has('csub:link@example.com'));
assert.equal((await call('POST', '/subscribe/confirm', { code: code2 })).status, 404, 'the code works once');

// T-5: reconfirm never overwrites a pending or confirmed record, drops junk legacy keys, and drains past them
fresh({ TWILIO_PER_SEND: '5', TWILIO_SID: 'AC' + '1'.repeat(32), TWILIO_TOKEN: 'tok', TWILIO_FROM: '+13855215955' }); outbound = [];
env.TB_LOC._m.set('sub:+18015550201', JSON.stringify({ id: '+18015550201', kind: 'sms', consent: true }));
env.TB_LOC._m.set('pend:+18015550201', JSON.stringify({ id: '+18015550201', kind: 'sms', status: 'pending', code: 'a'.repeat(24), source: 'web', consentVersion: consent, sentCount: 2, lastSent: now - 5 * 60000 }));
env.TB_LOC._m.set('sub:+18015550202', JSON.stringify({ id: '+18015550202' }));
env.TB_LOC._m.set('csub:+18015550202', JSON.stringify({ id: '+18015550202', confirmedVia: 'sms-reply' }));
env.TB_LOC._m.set('sub:+18015550203', '{}');
env.TB_LOC._m.set('sub:!!junk1', '{}'); env.TB_LOC._m.set('sub:!!junk2', '{}');
r = await call('POST', '/subs/reconfirm', undefined, { auth: true, raw: '{}' });
assert.equal(r.status, 200); assert.equal(r.json.queued, 1, 'only the genuinely legacy number is queued');
let kept = JSON.parse(env.TB_LOC._m.get('pend:+18015550201')); assert.equal(kept.source, 'web'); assert.equal(kept.consentVersion, consent); assert.equal(kept.sentCount, 2);
assert.equal(JSON.parse(env.TB_LOC._m.get('csub:+18015550202')).confirmedVia, 'sms-reply');
assert.equal(JSON.parse(env.TB_LOC._m.get('pend:+18015550203')).source, 'legacy');
for (const k of ['sub:+18015550201', 'sub:+18015550202', 'sub:+18015550203', 'sub:!!junk1', 'sub:!!junk2']) assert.equal(env.TB_LOC._m.has(k), false, k + ' retired');
assert.equal(outbound.length, 1, 'one confirmation text, for the legacy number only');

// T-3: the page asks whether a sender exists before showing the form
fresh(); assert.deepEqual((await call('GET', '/subscribe/status')).json, { sms: false, email: false });
fresh({ TWILIO_SID: 'AC' + '1'.repeat(32), TWILIO_TOKEN: 'tok', TWILIO_FROM: '+13855215955', RESEND_API_KEY: 're_x' }); assert.deepEqual((await call('GET', '/subscribe/status')).json, { sms: true, email: true });

// T-8: /prizes counts today's codes on the local trailer day
fresh(); await call('POST', '/scores', { score: 9000, token: tokenAged(120000, 'e1e1e1e1e1e1e1e1e1e1e1e1') }, { ip: '203.0.113.201' });
r = await call('GET', '/prizes', undefined, { auth: true }); assert.equal(r.json.issued, 1); assert.equal(r.json.date, '2026-11-16');

// T-4: signup cap is 100 a day
fresh(); let n429 = 0; for (let i = 0; i < 105; i++) { const x = await call('POST', '/subscribe', { contact: '801-556-' + String(1000 + i), smsConsent: true, source: 'web' }, { ip: '10.77.' + Math.floor(i / 8) + '.' + (i % 8) }); if (x.status === 429) n429++; }
assert.equal(n429, 5, 'the 101st to 105th signups of the day are refused');
process.stdout.write('security.test.mjs ok\n');
