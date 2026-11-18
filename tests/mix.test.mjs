// node tests/mix.test.mjs — /api/mix moderation, kiosk key bucket, null body, CORS, constant-time compare.
import { onRequestPost } from '../functions/api/mix.js';
import { corsHeaders, handlePreflight, safeEqual, isKiosk } from '../functions/api/_lib.js';
import { sanitizeDrinkText } from '../functions/api/_moderation.js';
import assert from 'node:assert/strict';

const kv = new Map();
const AI_RL = { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } };
let reply = { name: 'Riptide Situation', base: 'Sprite', syrups: ['Peach'], cream: 'No cream', topper: 'Lime', why: 'Beach day energy.' };
const AI = { run: async () => ({ response: JSON.stringify(reply) }) };
const KEY = 'kiosk-shared-secret-0123456789abcdef';
const req = (b, ip = '1.1.1.1', headers = {}) => new Request('https://thirstybeaches.com/api/mix', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...headers }, body: typeof b === 'string' ? b : JSON.stringify(b) });
const call = async (b, env = {}, ip, headers) => { const r = await onRequestPost({ request: req(b, ip, headers), env: { AI, AI_RL, ...env } }); return { status: r.status, data: await r.json() }; };

// moderation: the kiosk denylist applies to name and why, kid mode or not
reply = { ...reply, name: 'Tipsy Tide', why: 'Tastes like a margarita.' };
let r = await call({ mood: 'sunny' });
assert.equal(r.status, 200); assert.equal(r.data.name, 'Riptide Confession'); assert.ok(!/margarita/i.test(r.data.why));
r = await call({ mood: 'sunny', kid: true }, {}, '1.1.1.2');
assert.equal(r.data.name, 'Sunshine Situation');
reply = { ...reply, name: 'Salt Life', why: 'Fizzy and fruity.' };
r = await call({ mood: 'sunny' }, {}, '1.1.1.3');
assert.equal(r.data.name, 'Salt Life'); assert.equal(r.data.why, 'Fizzy and fruity.');
assert.equal(sanitizeDrinkText('Root Beer Float', 'name'), 'Root Beer Float'); // "beer" is only blocked outside "root beer"
assert.equal(sanitizeDrinkText('<img src=x onerror=alert(1)>', 'name'), '');
assert.equal(sanitizeDrinkText('Hangover cure', 'blurb'), '');

// null / array / scalar bodies are 400, not a thrown 500
for (const b of ['null', '[]', '7']) assert.equal((await call(b, {}, '1.1.1.4')).status, 400, b);

// per-visitor limit is 5 an hour; the kiosk key selects its own, higher bucket
for (let i = 0; i < 5; i++) assert.equal((await call({ mood: 'x' }, {}, '2.2.2.2')).status, 200);
assert.equal((await call({ mood: 'x' }, {}, '2.2.2.2')).status, 429);
for (let i = 0; i < 30; i++) assert.equal((await call({ mood: 'x' }, { KIOSK_KEY: KEY }, '2.2.2.2', { 'x-kiosk-key': KEY })).status, 200, 'kiosk call ' + i);
// a wrong or missing key never gets the kiosk bucket; a short configured key disables the feature
assert.equal((await call({ mood: 'x' }, { KIOSK_KEY: KEY }, '2.2.2.2', { 'x-kiosk-key': KEY + 'x' })).status, 429);
assert.equal(isKiosk(req({}, '1.1.1.1', { 'x-kiosk-key': 'short' }), { KIOSK_KEY: 'short' }), false);
assert.equal(isKiosk(req({}), { KIOSK_KEY: KEY }), false);
assert.equal(safeEqual('a', 'a'), true); assert.equal(safeEqual('a', 'ab'), false);

// CORS: exact origins, no pages.dev wildcard
const o = (origin) => new Request('https://thirstybeaches.com/api/mix', { headers: origin ? { origin } : {} });
assert.equal(corsHeaders(o('https://thirstybeaches.com'), {})['Access-Control-Allow-Origin'], 'https://thirstybeaches.com');
for (const bad of ['https://evil.pages.dev', 'https://thirsty-beaches.pages.dev', 'http://thirstybeaches.com', 'https://thirstybeaches.com.evil.test']) assert.deepEqual(corsHeaders(o(bad), {}), {}, bad);
assert.equal(handlePreflight(o('https://evil.pages.dev'), {}).status, 403);
console.log('mix.test.mjs ok');
