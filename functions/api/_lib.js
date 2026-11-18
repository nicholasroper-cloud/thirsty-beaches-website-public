// Shared helpers for the Thirsty Beaches API (Cloudflare Pages Functions). New file — this project had
// no functions/api/ before the AI endpoints; mirrors the patterns already proven in the Salty Dog Tags
// sibling project (same account, same stack).

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });

export const str = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

/* ---------- CORS (exact origins only) ----------
   Fail closed on an allow-list of full origins (scheme + host + port); never echo whatever Origin shows up and never
   wildcard a hostname. Notably NOT *.pages.dev: anyone can host a page there and call the AI endpoints from a
   visitor's browser. Extra origins for a test deployment: ALLOWED_ORIGINS (comma separated). */
const ALLOWED_ORIGINS = new Set([
  'https://thirstybeaches.com',
  'https://www.thirstybeaches.com',
  'http://localhost:8788', 'http://127.0.0.1:8788', // wrangler pages dev
]);
function originAllowed(origin, env) {
  if (!origin) return true; // no Origin header: same-origin navigation or a non-browser caller
  if (ALLOWED_ORIGINS.has(origin)) return true;
  const extra = env && typeof env.ALLOWED_ORIGINS === 'string' ? env.ALLOWED_ORIGINS.split(',').map((x) => x.trim()).filter(Boolean) : [];
  return extra.includes(origin);
}
export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin || !originAllowed(origin, env)) return {};
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}
export function handlePreflight(request, env) {
  const origin = request.headers.get('Origin');
  if (origin && !originAllowed(origin, env)) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request, env),
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/* ---------- AI request guardrails ---------- */

// Constant-time string compare (the loop always covers the longer input and folds the length difference in).
export function safeEqual(a, b) {
  a = String(a == null ? '' : a); b = String(b == null ? '' : b);
  const n = Math.max(a.length, b.length);
  let r = a.length ^ b.length;
  for (let i = 0; i < n; i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}

// Does this request carry the kiosk's shared secret (header X-Kiosk-Key = env.KIOSK_KEY, 24+ chars)? The kiosk
// proxies every customer from one trailer IP, so it gets its own, higher rate-limit bucket instead of the per-visitor one.
export function isKiosk(request, env) {
  const k = typeof env.KIOSK_KEY === 'string' ? env.KIOSK_KEY.trim() : '';
  if (k.length < 24) return false;
  return safeEqual(request.headers.get('x-kiosk-key') || '', k);
}

async function hashHex(input) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

// Fixed-ish window limiter in KV (binding AI_RL): `limit` calls per `windowSeconds` per IP, key
// ai:ip:<hash>. Fails closed on KV errors (treated as rate-limited) rather than allowing unlimited spend.
export async function rateLimitIp(env, request, limit, windowSeconds, prefix = 'ai:ip:') {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '0.0.0.0';
  // IP_SALT (optional secret) keeps the stored hash from being reversed over the IPv4 space; counters expire within the window.
  const key = prefix + (await hashHex((typeof env.IP_SALT === 'string' && env.IP_SALT ? env.IP_SALT + ':' : '') + ip));
  try {
    const raw = await env.AI_RL.get(key);
    const count = raw ? parseInt(raw, 10) || 0 : 0;
    if (count >= limit) return { ok: false };
    await env.AI_RL.put(key, String(count + 1), { expirationTtl: windowSeconds });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// Races a Workers AI call against a hard deadline so one slow model never ties up a request.
export async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('ai-timeout')), ms); });
  try { return await Promise.race([promise, timeout]); } finally { clearTimeout(timer); }
}

/* ---------- Claude API client (roast.js, mix.js, ai-health.js) ----------
   Tiny fetch wrapper, no SDK. Secret: ANTHROPIC_API_KEY (Pages secret). Every caller treats a throw as
   "fall back to Workers AI", so this never returns partial data: it returns the model's text or throws.
   Errors carry only a short code (status or reason), never the response body or the key. */
export const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
export const CLAUDE_VERSION = '2023-06-01';
export const CLAUDE_TIMEOUT_MS = 8000;

export const hasClaude = (env) => typeof env.ANTHROPIC_API_KEY === 'string' && env.ANTHROPIC_API_KEY.trim().length > 0;

// `messages` is the Anthropic messages array (content may be a string or an array of blocks, including
// base64 image blocks). Uses AbortController so a slow call is actually cancelled, not just abandoned.
export async function callClaude(env, { model, system, messages, maxTokens = 600, timeoutMs = CLAUDE_TIMEOUT_MS }) {
  if (!hasClaude(env)) throw new Error('claude-no-key');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(CLAUDE_URL, {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY.trim(),
        'anthropic-version': CLAUDE_VERSION,
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    });
    if (!r.ok) throw new Error('claude-http-' + r.status);
    const data = await r.json();
    if (data && data.stop_reason === 'refusal') throw new Error('claude-refusal');
    const text = ((data && data.content) || []).filter((b) => b && b.type === 'text').map((b) => b.text).join('').trim();
    if (!text) throw new Error('claude-empty');
    return text;
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('ai-timeout');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
