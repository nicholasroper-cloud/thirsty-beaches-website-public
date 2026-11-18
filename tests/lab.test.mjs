// node tests/lab.test.mjs — /api/lab (owner Drink Lab) with GitHub and Claude both stubbed. No network.
import { onRequestPost, onRequestOptions } from '../functions/api/lab.js';
import assert from 'node:assert/strict';

const kv = new Map();
const AI_RL = { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } };
const env = { AI_RL, ANTHROPIC_API_KEY: 'sk-ant-test' };
const OWNER = 'https://nicholasroper-cloud.github.io';
const GOOD = 'ghp_' + 'g'.repeat(36), READONLY = 'ghp_' + 'r'.repeat(36), BAD = 'ghp_' + 'b'.repeat(36);
const logs = [];
for (const lvl of ['log', 'warn', 'error']) console[lvl] = (...a) => logs.push(a.map(String).join(' '));

let gh = 0, claude = 0, githubDown = false;
let answer = { catKey: 'dirtysodas', base: 'base:Dr Pepper', mods: ['flavor:Coconut', 'flavor:Nope', 'cream:Coconut Cream'], name: 'Coco Loco Motion', blurb: 'Island time in a cup.' };
globalThis.fetch = async (u, o = {}) => {
  u = String(u);
  if (u.startsWith('https://api.github.com/')) {
    gh++;
    assert.equal(u, 'https://api.github.com/repos/nicholasroper-cloud/Thirsty-Beaches-Control');
    assert.ok(o.headers['User-Agent'], 'GitHub needs a User-Agent');
    if (githubDown) return new Response('oops', { status: 502 });
    const t = o.headers.Authorization;
    if (t === 'Bearer ' + GOOD) return new Response(JSON.stringify({ full_name: 'x', permissions: { admin: true, push: true, pull: true } }));
    if (t === 'Bearer ' + READONLY) return new Response(JSON.stringify({ full_name: 'x', permissions: { admin: false, push: false, pull: true } }));
    return new Response('{"message":"Bad credentials"}', { status: 401 });
  }
  if (u === 'https://api.anthropic.com/v1/messages') {
    claude++;
    const b = JSON.parse(o.body);
    assert.ok(b.max_tokens >= 1500, 'maxTokens >= 1500');
    assert.match(b.system, /flavor:Coconut/); assert.match(b.system, /dirtysodas/);
    assert.match(b.messages[0].content, /coconut/i);
    assert.ok(!o.body.includes(GOOD), 'the GitHub token never goes to Claude');
    return new Response(JSON.stringify({ content: [{ type: 'text', text: '```json\n' + JSON.stringify(answer) + '\n```' }] }));
  }
  throw new Error('unexpected fetch ' + u);
};
let ipn = 0;
const req = (b, { token, origin = OWNER, ip } = {}) => {
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': ip || '3.3.3.' + (++ipn) };
  if (token !== undefined) headers.Authorization = token;
  if (origin) headers.Origin = origin;
  return new Request('https://thirstybeaches.com/api/lab', { method: 'POST', headers, body: JSON.stringify(b) });
};
const body = { brief: 'Something with coconut for a hot day', cats: ['dirtysodas', 'lemonades'],
  palette: [{ id: 'base:Dr Pepper', group: 'Base', name: 'Dr Pepper' }, { id: 'flavor:Coconut', group: 'Flavors', name: 'Coconut' },
    { id: 'cream:Coconut Cream', group: 'Cream', name: 'Coconut Cream' }, { id: '<script>', group: 'x', name: 'y' }] };
const run = async (b, o) => { const r = await onRequestPost({ request: req(b, o), env }); return { status: r.status, json: await r.json(), headers: r.headers }; };

/* --- preflight: owner app + site allowed (with Authorization), anything else refused --- */
let pre = onRequestOptions({ request: new Request('https://thirstybeaches.com/api/lab', { method: 'OPTIONS', headers: { Origin: OWNER } }) });
assert.equal(pre.status, 204);
assert.equal(pre.headers.get('Access-Control-Allow-Origin'), OWNER);
assert.match(pre.headers.get('Access-Control-Allow-Headers'), /authorization/);
pre = onRequestOptions({ request: new Request('https://thirstybeaches.com/api/lab', { method: 'OPTIONS', headers: { Origin: 'https://thirstybeaches.com' } }) });
assert.equal(pre.headers.get('Access-Control-Allow-Origin'), 'https://thirstybeaches.com');
for (const o of ['https://evil.example', 'https://someone-else.github.io', 'http://x.pages.dev']) {
  pre = onRequestOptions({ request: new Request('https://thirstybeaches.com/api/lab', { method: 'OPTIONS', headers: { Origin: o } }) });
  assert.equal(pre.status, 403, o);
}
assert.equal((await run(body, { token: 'Bearer ' + GOOD, origin: 'https://evil.example' })).status, 403);

/* --- 401 without a token / with a junk or bad token; no Claude call, no rate-limit KV write --- */
for (const token of [undefined, '', 'Bearer', 'Bearer short', 'token ' + GOOD, 'Bearer ' + BAD]) {
  const r = await run(body, { token });
  assert.equal(r.status, 401, String(token)); assert.equal(r.json.ai, false);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), OWNER, 'the owner app can read the 401');
}
assert.equal(claude, 0); assert.equal(kv.size, 0);
assert.equal(gh, 1, 'only the well-formed bad token was checked with GitHub');

/* --- a token that can read but not push the Control repo is refused too --- */
let r = await run(body, { token: 'Bearer ' + READONLY });
assert.equal(r.status, 401); assert.equal(claude, 0);

/* --- ok path --- */
r = await run(body, { token: 'Bearer ' + GOOD });
assert.equal(r.status, 200, JSON.stringify(r.json));
assert.deepEqual(r.json, { ai: true, provider: 'claude', drink: { catKey: 'dirtysodas', base: 'base:Dr Pepper',
  mods: ['flavor:Coconut', 'cream:Coconut Cream'], name: 'Coco Loco Motion', blurb: 'Island time in a cup.' } });
assert.equal(r.headers.get('Access-Control-Allow-Origin'), OWNER);
assert.equal(claude, 1);

/* --- verdicts cached 10 min per token hash: no more GitHub calls for the same tokens --- */
const gh0 = gh;
await run(body, { token: 'Bearer ' + GOOD }); await run(body, { token: 'Bearer ' + READONLY }); await run(body, { token: 'Bearer ' + BAD });
assert.equal(gh, gh0, 'cached');
const realNow = Date.now; Date.now = () => realNow() + 11 * 60 * 1000;
await run(body, { token: 'Bearer ' + GOOD });
assert.equal(gh, gh0 + 1, 're-checked after 10 min');
Date.now = realNow;

/* --- GitHub down: 503, not cached as a refusal --- */
githubDown = true;
const NEW = 'ghp_' + 'n'.repeat(36);
r = await run(body, { token: 'Bearer ' + NEW });
assert.equal(r.status, 503); assert.equal(r.json.reason, 'auth-unavailable');
githubDown = false;

/* --- body checks, bad answers --- */
assert.equal((await run({ ...body, brief: '' }, { token: 'Bearer ' + GOOD })).status, 400);
assert.equal((await run({ ...body, palette: [] }, { token: 'Bearer ' + GOOD })).status, 400);
answer = { catKey: 'coffee', mods: ['flavor:Coconut'] };
r = await run(body, { token: 'Bearer ' + GOOD });
assert.deepEqual(r.json, { ai: false, reason: 'bad-category' });
answer = { catKey: 'lemonades', base: null, mods: ['flavor:Nope'] };
assert.equal((await run(body, { token: 'Bearer ' + GOOD })).json.reason, 'no-ingredients');
r = await onRequestPost({ request: req(body, { token: 'Bearer ' + GOOD }), env: { AI_RL } });
assert.deepEqual(await r.json(), { ai: false, reason: 'no-key' });

/* --- 30 per IP per hour (own prefix) --- */
answer = { catKey: 'dirtysodas', base: null, mods: ['flavor:Coconut'], name: 'X', blurb: 'Y' };
let last;
for (let i = 0; i < 31; i++) last = await run(body, { token: 'Bearer ' + GOOD, ip: '9.9.9.9' });
assert.equal(last.status, 429);
assert.ok([...kv.keys()].every((k) => k.startsWith('lab:ip:')), 'own rate-limit prefix');

/* --- 20 refused tokens per IP per 10 min, then 429 without asking GitHub --- */
const gh1 = gh;
for (let i = 0; i < 20; i++) await run(body, { token: 'Bearer ghp_' + String(i).padStart(36, 'z'), ip: '8.8.8.8' });
r = await run(body, { token: 'Bearer ' + GOOD, ip: '8.8.8.8' });
assert.equal(r.status, 429); assert.equal(gh, gh1 + 20);

/* --- the token is never logged --- */
for (const l of logs) for (const t of [GOOD, READONLY, BAD]) assert.ok(!l.includes(t), 'token in a log line');
process.stdout.write('lab: all passed\n');
