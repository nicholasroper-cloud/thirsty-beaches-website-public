// node tests/vibe.test.mjs — /api/vibe with a fake Workers AI and a fake Claude.
import { onRequestPost } from '../functions/api/vibe.js';
import assert from 'node:assert/strict';
const kv = new Map();
const AI_RL = { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } };
const cands = [{ id: 'sandy-bottom', name: 'Sandy Bottom', desc: 'Dole Whip over soda' }, { id: 'riptide', name: 'Riptide', desc: 'Red white blue' }];
const img = Buffer.alloc(600, 7).toString('base64');
const req = (b, ip = '1.1.1.1') => new Request('https://thirstybeaches.com/api/vibe', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(b) });
let reply = { id: 'riptide', nickname: 'Captain "Brain" Freeze 🧊', reading: 'Loud and proud', why: 'Big energy, big flavor.' };
const AI = { run: async (m) => (m.includes('llava') ? { description: 'bright sunny colors' } : { response: JSON.stringify(reply) }) };
let r = await (await onRequestPost({ request: req({ image: img, candidates: cands }), env: { AI, AI_RL } })).json();
assert.equal(r.ai, true); assert.equal(r.id, 'riptide'); assert.equal(r.nickname, 'Captain Brain Freeze'); assert.equal(r.provider, 'workers-ai');
reply = { id: 'not-on-menu', nickname: 'x' };
r = await (await onRequestPost({ request: req({ image: img, candidates: cands }), env: { AI, AI_RL } })).json();
assert.deepEqual(r, { ai: false, reason: 'bad-id' });
reply = { id: 'sandy-bottom', nickname: 'Sandy Bottom', reading: 'chill', why: 'w' };
r = await (await onRequestPost({ request: req({ image: 'data:image/jpeg;base64,' + img, candidates: cands }), env: { AI, AI_RL } })).json();
assert.equal(r.id, 'sandy-bottom'); assert.equal(r.nickname, '');
// Claude path
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => { assert.match(String(u), /anthropic/); const b = JSON.parse(o.body); assert.equal(b.messages[0].content[0].type, 'image');
  return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"id":"sandy-bottom","nickname":"The Sunburnt Optimist","reading":"Sunny","why":"Yes."}' }] })); };
r = await (await onRequestPost({ request: req({ image: img, candidates: cands }), env: { AI, AI_RL, ANTHROPIC_API_KEY: 'k' } })).json();
assert.equal(r.provider, 'claude'); assert.equal(r.nickname, 'The Sunburnt Optimist');
globalThis.fetch = realFetch;
// bad input + rate limit
assert.equal((await onRequestPost({ request: req({ image: '!!', candidates: cands }), env: { AI, AI_RL } })).status, 400);
assert.equal((await onRequestPost({ request: req({ image: img, candidates: [] }), env: { AI, AI_RL } })).status, 400);
for (let i = 0; i < 40; i++) await onRequestPost({ request: req({ image: img, candidates: cands }, '9.9.9.9'), env: { AI, AI_RL } });
assert.equal((await onRequestPost({ request: req({ image: img, candidates: cands }, '9.9.9.9'), env: { AI, AI_RL } })).status, 429);
console.log('vibe: all passed');
