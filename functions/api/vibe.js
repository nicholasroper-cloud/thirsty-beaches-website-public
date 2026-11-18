// POST /api/vibe — "Match My Vibe" for the kiosk. Takes one camera frame plus the kiosk's menu
// (candidates: [{id, name, desc}]) and returns the ONE real menu drink that fits the person's energy,
// plus a funny one-off name for their cup:
//   {ai:true, id, nickname, reading, why, provider}   or   {ai:false} (kiosk falls back to its on-device pick)
// The kiosk PC holds no AI key: its local server forwards here. The photo is used for this one call and
// never stored or logged. Providers: Claude (ANTHROPIC_API_KEY, vision) first; else Workers AI (llava
// describes colors/mood only, llama picks). `id` is always one of the given candidates.
import { sanitizeDrinkText } from './_moderation.js';
import { json, str, corsHeaders, handlePreflight, rateLimitIp, withTimeout, callClaude, hasClaude } from './_lib.js';

export const onRequestOptions = ({ request, env }) => handlePreflight(request, env);

const CLAUDE_MODEL = 'claude-haiku-5-5'; // keep in sync with mix.js
const VISION_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const AI_TIMEOUT_MS = 8000;
// The trailer's kiosk (and phones on the trailer's own network) share one IP, so this is per-IP but
// generous; the call is small (one 320px frame, short JSON) and has its own counter (not /api/mix's).
const RATE_LIMIT = 40;
const RATE_WINDOW_S = 60 * 60;
const MAX_BODY = 700_000;
const IMAGE_MAX_BYTES = 400_000;
const B64_RE = /^[A-Za-z0-9+/=]+$/;

const RULES = `Rules for everything you write:
- Go on overall energy, colors, setting and mood only. Never mention or guess anyone's looks, body, face, hair, clothes, age, gender, race or anything about who they are.
- Family friendly: kids use this kiosk. Flattering and silly, never mean, never a put-down, nothing romantic, no innuendo, no alcohol, no brand names.`;

function cleanNick(s) {
  return String(s == null ? '' : s).normalize('NFC').replace(/[^\p{L}\p{N} .'!&-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 28);
}

function coerceJson(resp) {
  if (resp && typeof resp === 'object') return resp;
  if (typeof resp !== 'string' || !resp) return null;
  const t = resp.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* fall through */ } }
  return null;
}

export async function onRequestPost({ request, env }) {
  const extra = corsHeaders(request, env);
  if (!env.AI && !hasClaude(env)) return json({ ai: false, error: 'AI not configured' }, 503, extra);
  if ((request.headers.get('content-type') || '').indexOf('application/json') < 0) return json({ ai: false, error: 'json only' }, 415, extra);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ai: false, error: 'too big' }, 413, extra);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ ai: false, error: 'bad json' }, 400, extra); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ai: false, error: 'bad json' }, 400, extra);

  let b64 = typeof body.image === 'string' ? body.image : '';
  if (b64.startsWith('data:')) b64 = b64.slice(b64.indexOf(',') + 1);
  if (!b64 || !B64_RE.test(b64) || Math.floor((b64.length * 3) / 4) > IMAGE_MAX_BYTES) return json({ ai: false, error: 'bad image' }, 400, extra);

  const cands = (Array.isArray(body.candidates) ? body.candidates : []).slice(0, 160)
    .map((c) => ({ id: str(c && c.id, 48), name: str(c && c.name, 48), desc: str(c && c.desc, 120) }))
    .filter((c) => c.id && c.name);
  if (cands.length < 2) return json({ ai: false, error: 'no menu' }, 400, extra);
  const ids = new Set(cands.map((c) => c.id));
  const menu = cands.map((c) => `${c.id}: ${c.name}${c.desc ? ' — ' + c.desc : ''}`).join('\n');

  const limited = await rateLimitIp(env, request, RATE_LIMIT, RATE_WINDOW_S, 'vibe:ip:');
  if (!limited.ok) return json({ ai: false, error: 'rate-limited' }, 429, extra);

  const ask = `You are the drink matcher at Thirsty Beaches, a beach-themed dirty soda trailer. Voice: punny, upbeat, beachy.
Pick the ONE drink from the menu below whose vibe best fits the energy in the photo, then invent a funny one-off name for THEIR cup of it.
${RULES}

MENU (id: name — description). The id must be copied exactly from this list:
${menu}

Reply with ONE JSON object and nothing else:
{"id":"...", "nickname":"...", "reading":"...", "why":"..."}
- "nickname": a funny, punny name for this person's cup, 2-4 words, at most 28 characters, no emojis or quotation marks, e.g. "The Sunburnt Optimist", "Tide Pod Royalty", "Captain Brain Freeze". Not the drink's real name.
- "reading": a 3-6 word vibe read, e.g. "Cool, calm, sun-chaser".
- "why": one cheeky sentence, at most 120 characters, on why this drink fits the vibe.`;

  let parsed = null, provider = 'workers-ai', why = 'no-provider';
  if (hasClaude(env)) {
    try {
      const text = await callClaude(env, { model: CLAUDE_MODEL, timeoutMs: 15000, maxTokens: 1500, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
        { type: 'text', text: ask },
      ] }] });
      parsed = coerceJson(text); if (parsed) provider = 'claude'; else why = 'claude-unparsed';
    } catch (e) { why = String((e && e.message) || 'claude-error').slice(0, 40); console.warn('vibe: claude failed:', why); }
  }
  const claudeWhy = why;
  if (!parsed && env.AI) {
    let vibe = '';
    try {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const v = await withTimeout(env.AI.run(VISION_MODEL, { image: Array.from(bytes), max_tokens: 80,
        prompt: 'In one short phrase, describe the colors, setting, lighting and overall mood of this photo. Do not describe any person, face or identifying feature.' }), AI_TIMEOUT_MS);
      vibe = str(v && v.description, 240);
    } catch (e) { vibe = ''; why = 'vision-' + String((e && e.message) || 'error').slice(0, 30); }
    try {
      const out = await withTimeout(env.AI.run(TEXT_MODEL, { max_tokens: 300, temperature: 0.9, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: ask.replace('the energy in the photo', 'the photo vibe the user describes') },
        { role: 'user', content: `Photo vibe: ${vibe || 'sunny, fun, beach day'}\nReturn the JSON now.` },
      ] }), AI_TIMEOUT_MS);
      parsed = coerceJson(out && out.response); if (!parsed) why = 'text-unparsed';
    } catch (e) { parsed = null; why = 'text-' + String((e && e.message) || 'error').slice(0, 30); }
  }
  if (!parsed || typeof parsed !== 'object') return json({ ai: false, reason: why, ...(hasClaude(env) ? { claude: claudeWhy } : {}) }, 200, extra);
  if (!ids.has(String(parsed.id))) {
    // models sometimes answer with the drink's name instead of its id
    const said = String(parsed.id || parsed.name || '').toLowerCase();
    const byName = cands.find((c) => c.name.toLowerCase() === said)
      || cands.find((c) => said && (said.includes(c.id.toLowerCase()) || said.includes(c.name.toLowerCase())));
    if (byName) parsed.id = byName.id; else return json({ ai: false, reason: 'bad-id', ...(hasClaude(env) && provider !== 'claude' ? { claude: claudeWhy } : {}) }, 200, extra);
  }
  const item = cands.find((c) => c.id === String(parsed.id));
  let nickname = sanitizeDrinkText(cleanNick(parsed.nickname), 'name'); // same denylist as the kiosk drink text
  if (nickname.toLowerCase() === item.name.toLowerCase()) nickname = '';
  const claudeNote = provider !== 'claude' && hasClaude(env) ? { claude: claudeWhy } : {};   // why Claude was skipped (short code only, e.g. claude-http-401)
  return json({
    ...claudeNote, ai: true, id: item.id, nickname,
    reading: sanitizeDrinkText(str(parsed.reading, 60), 'name') || 'Pure beach energy',
    why: sanitizeDrinkText(str(parsed.why, 140), 'blurb') || 'Pure beach energy, picked for the vibe.',
    provider,
  }, 200, extra);
}
