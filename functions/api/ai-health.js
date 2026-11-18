// GET /api/ai-health — dry run (no image) status for the model(s) POST /api/mix depends on. The text
// model gets a real, trivial prompt. The vision model requires an actual photo to say anything
// meaningful, so per spec this is a no-image dry run: it's reported "configured" without spending an
// AI call on a fake image — /api/mix reports real vision failures live via graceful degradation.
// Claude (the primary provider for /api/mix when ANTHROPIC_API_KEY is set) is NEVER called here: health
// only reports whether the key is present, so polling this endpoint cannot spend Anthropic tokens.
import { json, corsHeaders, handlePreflight, withTimeout, hasClaude } from './_lib.js';

export const onRequestOptions = ({ request, env }) => handlePreflight(request, env);

const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const VISION_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
const CLAUDE_MODEL = 'claude-haiku-5-5'; // keep in sync with mix.js
const AI_TIMEOUT_MS = 5000;

export async function onRequestGet({ request, env }) {
  const extra = corsHeaders(request, env);
  const claudeKey = hasClaude(env);
  // `provider` is what /api/mix will try first; Workers AI remains the fallback either way.
  const claude = { configured: claudeKey, model: CLAUDE_MODEL, note: claudeKey ? 'key set; not called (health never spends Claude tokens)' : 'ANTHROPIC_API_KEY not set' };
  const provider = claudeKey ? 'claude' : 'workers-ai';
  if (!env.AI) return json({ ai: false, models: {}, provider, claude }, 200, extra);

  const models = {};
  try {
    const out = await withTimeout(
      env.AI.run(TEXT_MODEL, { messages: [{ role: 'user', content: 'Reply with the single word: OK' }], max_tokens: 5 }),
      AI_TIMEOUT_MS
    );
    models[TEXT_MODEL] = { ok: Boolean(out && typeof out.response === 'string' && out.response.length), note: 'live dry run' };
  } catch (e) {
    models[TEXT_MODEL] = { ok: false, note: String((e && e.message) || e).slice(0, 120) };
  }

  models[VISION_MODEL] = { ok: null, note: 'not called — requires an image; see POST /api/mix' };

  return json({ ai: true, models, provider, claude }, 200, extra);
}
