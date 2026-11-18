/**
 * Thirsty Beaches — location, schedule and alert signups
 *
 * PUBLIC
 *   GET  /where        live position (only while open). "Open" lasts until POST /close, or 12 h after it was
 *                      opened ({since}) if nobody closes it; position updates don't need to keep coming.
 *   GET  /schedule     upcoming stops
 *   POST /subscribe    sign up for alerts {contact, smsConsent, source:'web'|'kiosk', consentVersion?}: PENDING until confirmed
 *                      (reply YES / emailed link / staff). POST /subscribe/confirm {code} · POST /unsubscribe {contact} (self-serve)
 *                      · POST /sms/inbound (Twilio webhook: YES, STOP, HELP; signature checked). See README.md.
 *   POST /quote        event / catering quote request  {name, email, phone?, event, date, city, guests, ...}
 *
 * PRIVATE (Bearer TB_SECRET)
 *   POST /update       set live position {lat, lng, label, open}. {refresh:true} (the trailer page re-sends the
 *                      position every 30 min while it's open) is refused with 409 if the pin was closed meanwhile.
 *   POST /close        go dark
 *   POST /schedule     replace the stop list  {stops:[...]}
 *   GET  /subs         export signups (confirmed, pending, legacy)  · POST /subs/confirm {contact} · POST /subs/reconfirm
 *   POST /unsub        remove one  {contact}
 *   GET  /quotes       event quote requests, newest first  [?limit=50]   each has status new|replied|booked|declined
 *   POST /quote/status {id, status}  set a quote's follow-up status (trailer page buttons)
 *
 * CRON (wrangler.jsonc "triggers": hourly)
 *   quote reminders: a request still "new" 24 h and again 72 h after it arrived gets a "Still new after 24 h"
 *   push through QUOTE_WEBHOOK, or the relay (same channels as the new-quote alert). Optional QUOTE_REMIND_HOURS="24,72".
 *   One KV list per run (status lives in the key's metadata); one write per reminder actually sent.
 *
 * ARCADE
 *   GET  /scores       top 10
 *   GET  /scores/token  a signed play token (PLAY_SECRET), minted when a game starts, 20 per IP per hour
 *   POST /scores       {score, who, token} -> leaderboard, one prize code per network per day at 2000+, weekly draw TICKET at 500+
 *                      (draw only while DRAW_ENABLED). Without a valid, unused, 45 s-old token nothing is recorded or issued.
 *   POST /redeem       {code} check · {code, redeem:true} burn it: needs header X-Kiosk-Key = KIOSK_KEY (kiosk / window)
 *   GET  /draw/last    public: last week's winning ticket · GET /draw, POST /draw/claim {ticket}: staff
 *
 * LOYALTY (punch card, site/card.html)
 *   GET  /card?id=     the card  {id, punches, redeemed}  (+ exists:false when nothing is stored under that id yet)
 *   POST /punch        {id, staff} add a punch (staff = today's code "K7QM2XPD" / "UPSIZE-K7QM2XPD", or TB_SECRET)
 *   POST /card/redeem  {id, staff} use a free drink (moved from /redeem)
 *   GET  /draw         (private) this week's tickets + the picked winner  [?week=YYYY-Www]
 *   POST /card/link    {id, phone} customer saves their card to a US phone number (no staff needed; only for a
 *                      card that has had a punch; never re-points a number already saved to another card).
 *                      Stored as ph:<hash> -> {card, last4}: a peppered SHA-256 of +1XXXXXXXXXX, never the number.
 *   POST /card/recover {phone, staff, id?, merge?} new phone / cleared storage: staff confirm with today's code,
 *                      the saved card id comes back. If this phone's card {id} also has punches: 409 has-punches,
 *                      then merge:true sums punches (every 10 -> free drink), keeps free drinks, and marks the
 *                      other card mergedInto the saved one (GET /card on it tells the page to switch).
 *   GET  /card/byphone?phone=   (private) find a card by phone so staff can punch without the customer's phone
 *   Wrong staff codes on /punch, /redeem and /card/recover: 8 per IP per 15 min, then 429 (in-memory, no KV).
 *   POST /card/claim   {id, token} punch from a paid order: the station signs a token (secret PUNCH_KEY, see
 *                      cardClaim) for an order it knows is paid; adds `drinks` punches (every 10 -> free drink).
 *                      200 {ok, added, earned, card} · 400 bad-token · 409 used|merged · 410 expired · 503 punch-off
 *
 * ALERT LIST BROADCAST ("Tell the list we're open" on the trailer page; OFF unless var BROADCAST_ENABLED="true")
 *   GET  /broadcast    (private) {enabled, phones, emails, sms, email, stopLine, maxLen, lastAt, gapMin} · 503 broadcast-off
 *   GET  /twilio/status  public: {configured, credentials ok|bad|error, number found|missing, sms} (sends nothing)
 *   POST /broadcast    (private) {text <= 300} -> texts every phone on the list through the relay (kind "sms"), and
 *                      emails them through Resend when RESEND_API_KEY + BROADCAST_EMAIL_FOOTER are set.
 *                      200 {ok, phones, emails, sms:{sent,failed}|{skipped}|{error}, email:{...}, text} · 429 too-soon (10 min)
 *
 * KIOSK STATUS (the drink kiosk PC reports in; read-only — commands go through the control repo)
 *   POST /kiosk/ping   heartbeat from the kiosk server every ~2 min. No auth (the kiosk repo is public, so
 *                      there is no shared secret on the PC): strictly size/type-checked, rate-limited, only
 *                      whitelisted fields kept, at most KIOSK_MAX_IDS kiosks. Stored in TB_LOC as
 *                      kiosk:<id> (latest + short event history, 30-day TTL). To stay inside the KV free-tier
 *                      write budget an unchanged ping is written at most every KIOSK_WRITE_MIN minutes
 *                      (default 5; set the var to 1 on a paid plan for to-the-minute "last seen").
 *   GET  /kiosk/status          public: { online, lastSeen, version } (+ kiosks:[...])
 *   GET  /kiosk/status?full=1   staff (Bearer TB_SECRET): everything, incl. errors, rollbacks, history
 *
 * CORS: every route answers any origin (incl. the owner app, https://nicholasroper-cloud.github.io) and allows the
 *       Authorization header; private routes still need Bearer TB_SECRET.
 *
 * Bindings: KV namespace TB_LOC, secret TB_SECRET
 * Optional: secret PUNCH_KEY (set by the "Set up punch key" workflow) turns on POST /card/claim.
 * Optional: var BROADCAST_ENABLED="true" turns on /broadcast; var BROADCAST_EMAIL_FOOTER enables its emails.
 * Optional: secret QUOTE_WEBHOOK — where to send an alert for every new quote request. One URL, or several
 *           separated by commas. The format is picked from the URL:
 *             https://ntfy.sh/<topic>                 phone push notification (ntfy app), with Reply/Inbox buttons
 *             https://discord.com/api/webhooks/...    Discord message
 *             https://hooks.slack.com/...             Slack message
 *             anything else (Zapier, Make, Power Automate, Pipedream…)  JSON: {type, text, ...quote fields}
 *           Quotes are saved to KV either way, so nothing is lost if a webhook is missing or down.
 * Optional: secret RELAY_KEY — with QUOTE_WEBHOOK unset, new-quote alerts and the 24/72 h reminders go to Nick's
 *           phone through the Salty Dog Tags relay (saltydogtags.com/api/relay: the Pushover/Twilio channels that
 *           site already has). Set by the one-time "Set up relay key" workflow; RELAY_URL overrides the address.
 *           QUOTE_WEBHOOK, when set, always wins (the relay is then not used).
 * Optional: automatic "got it, we reply within one business day" email to the planner, with a short summary
 *           of their request, through Resend (resend.com) — dormant until RESEND_API_KEY is set:
 *             RESEND_API_KEY   secret, from the Resend dashboard (the sending domain must be verified there)
 *             EMAIL_FROM       default "Thirsty Beaches <hello@thirstybeaches.com>"
 *             EMAIL_REPLY_TO   default hello@thirstybeaches.com
 *           Sent in the background after the quote is saved; a Resend error is logged, never shown to the planner.
 * Optional: text-message alerts through Twilio, routed by region:
 *             QUOTE_SMS_UTAH     +1XXXXXXXXXX  gets Utah requests (the default region)
 *             QUOTE_SMS_FLORIDA  +1XXXXXXXXXX  gets Florida requests (city/page mentions a Gulf Coast spot)
 *             TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM (a verified Twilio number) or
 *             TWILIO_MESSAGING_SERVICE_SID. Nothing is sent until all of these are set.
 */

/* a pin set with "We're open" stays live until /close or this long after opening (in case nobody closes) */
const OPEN_MAX_MS = 12 * 3600e3;

/* ---------- Thirsty Maze play tokens ---------- */
const PLAY_MIN_MS = 45 * 1000;            // a real maze run takes longer than this
const PLAY_MAX_MS = 6 * 3600e3;
const MINT_PER_IP_PER_HOUR = 20;
const playSecret = env => (typeof env.PLAY_SECRET === 'string' && env.PLAY_SECRET.trim().length >= 24 ? env.PLAY_SECRET.trim() : '');
const drawOn = env => String(env.DRAW_ENABLED || '').trim() === 'true';
const b64u = s => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return atob(s); };
async function hmacHexKey(secret, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
}
async function mintPlayToken(env) {
  const payload = JSON.stringify({ id: hex(crypto.getRandomValues(new Uint8Array(12))), iat: Date.now() });
  return b64u(payload) + '.' + await hmacHexKey(playSecret(env), payload);
}
/* returns the token id when it is well formed, correctly signed and between PLAY_MIN_MS and PLAY_MAX_MS old; else null */
async function verifyPlayToken(env, token) {
  const secret = playSecret(env);
  if (!secret || typeof token !== 'string' || !token || token.length > 400) return null;
  const dot = token.indexOf('.'); if (dot < 0) return null;
  let payloadStr, payload;
  try { payloadStr = unb64u(token.slice(0, dot)); payload = JSON.parse(payloadStr); } catch (e) { return null; }
  if (!payload || typeof payload.id !== 'string' || !/^[0-9a-f]{16,40}$/.test(payload.id) || typeof payload.iat !== 'number') return null;
  if (!safeEq(await hmacHexKey(secret, payloadStr), token.slice(dot + 1).toLowerCase())) return null;
  const age = Date.now() - payload.iat;
  return age >= PLAY_MIN_MS && age <= PLAY_MAX_MS ? payload.id : null;
}
/* a draw ticket: DRAW-K7QM2X. No personal data is attached to it. */
async function newTicket() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return 'DRAW-' + [...b].map(x => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[x % 31]).join('');
}

async function drawEntries(env, wk) {
  const list = await env.TB_LOC.list({ prefix: 'draw:' + wk + ':' });
  const entries = [];
  for (const k of list.keys) {
    const v = await env.TB_LOC.get(k.name);
    if (!v) continue;
    try { const e = JSON.parse(v); entries.push({ ticket: e.ticket, who: e.who, score: e.score, at: e.at }); } catch (err) { /* skip */ }
  }
  return entries.sort((a, b) => (a.ticket < b.ticket ? -1 : 1));
}
async function pickWinner(env, wk, entries) {
  if (!entries.length) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(wk + '|draw|' + (env.TB_SECRET || '')));
  const n = new Uint8Array(buf).slice(0, 4).reduce((a, b) => a * 256 + b, 0);
  return entries[n % entries.length];
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS },
  });

/* Constant-time string compare: the loop always covers the longer input and folds the length difference in, so the time
   taken depends on neither where the strings first differ nor which one is shorter. Used for every secret check. */
function safeEq(a, b) {
  a = String(a == null ? '' : a); b = String(b == null ? '' : b);
  const n = Math.max(a.length, b.length);
  let r = a.length ^ b.length;
  for (let i = 0; i < n; i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}

function authed(request, env) {
  const h = request.headers.get('Authorization') || '';
  const token = h.replace(/^Bearer\s+/i, '').trim();
  return Boolean(env.TB_SECRET) && Boolean(token) && safeEq(token, env.TB_SECRET);
}

/* The kiosk's shared secret (var/secret KIOSK_KEY, 24+ chars) in the X-Kiosk-Key header: required to burn a Maze code. */
const kioskKeyOk = (request, env) => {
  const k = typeof env.KIOSK_KEY === 'string' ? env.KIOSK_KEY.trim() : '';
  return k.length >= 24 && safeEq(request.headers.get('X-Kiosk-Key') || '', k);
};

/* JSON body that must be a plain object: `null`, arrays and scalars are a 400, never a thrown 500 on `body.x`. */
async function readJson(request) {
  try {
    const b = await request.json();
    return b && typeof b === 'object' && !Array.isArray(b) ? b : null;
  } catch (e) { return null; }
}

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function sha256Hex(text) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }
/* A salted hash of the caller's IP (salt: IP_SALT, else TB_SECRET). Stored only as a counter key, never the IP itself. */
async function ipHash(env, request) {
  return (await sha256Hex((env.IP_SALT || env.TB_SECRET || 'tb') + '|' + ipOf(request))).slice(0, 24);
}
/* A KV counter with its own expiry stored in the value (so a window is honored even where the KV TTL is coarse):
   returns the new count. Used only where a write per event is acceptable (wrong staff codes, signups, prizes). */
async function readCounter(env, key) {
  try { const v = JSON.parse((await env.TB_LOC.get(key)) || 'null'); return v && v.exp > Date.now() ? v : null; } catch (e) { return null; }
}
async function bump(env, key, ttl) {
  const cur = await readCounter(env, key);
  const v = { n: (cur ? cur.n : 0) + 1, exp: cur ? cur.exp : Date.now() + ttl * 1000 };
  await env.TB_LOC.put(key, JSON.stringify(v), { expirationTtl: Math.max(60, ttl) });
  return v.n;
}
async function count(env, key) { const c = await readCounter(env, key); return c ? c.n : 0; }

function normalise(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s.includes('@')) {
    return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s) ? { kind: 'email', id: s.toLowerCase() } : null;
  }
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return { kind: 'sms', id: '+1' + d };
  if (d.length === 11 && d[0] === '1') return { kind: 'sms', id: '+' + d };
  return null;
}


/* a short code that changes every day, derived from the secret so it
   can't be guessed — staff can look up today's on the trailer page */
/* ISO week id, e.g. 2026-W41 — the weekly draw bucket. Weeks run Monday to Sunday on the trailer's local calendar
   (America/Denver, see localDay), not UTC, so a Sunday-night play counts for the week the player sees. */
function weekId(d = new Date(Date.now())) {
  const [y, m, dd] = localDay(d).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, dd));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y0) / 864e5 + 1) / 7)).padStart(2, '0');
}

/* a one-time prize code: MAZE-123456, unique, redeemable once, dies at end of day */
async function newCode(env, meta) {
  for (let i = 0; i < 6; i++) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
    const code = 'MAZE-' + String(n).padStart(6, '0');
    if (await env.TB_LOC.get('code:' + code)) continue;
    await env.TB_LOC.put('code:' + code, JSON.stringify({ ...meta, redeemed: false, at: Date.now() }),
                         { expirationTtl: 60 * 60 * 30 });
    return code;
  }
  return null;
}

/* The staff code's "day" is the local calendar day in America/Denver, not UTC
   (UTC midnight is 6pm in Utah, mid-shift). Denver midnight is 2am in Florida,
   so one fixed zone never rolls the code over during open hours in either state,
   and the code doesn't jump when the trailer's live position changes region. */
function localDay(d = new Date(Date.now())) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch (e) {
    return new Date(d.getTime() - 7 * 3600e3).toISOString().slice(0, 10);   // MST fallback
  }
}

/* Staff day code: UPSIZE- plus 8 characters (no 0/O/1/I), 31^8 = 8.5e11 possibilities, derived from the secret and the
   Denver calendar day. It was 4 digits (10,000 tries to find today's code); with 8 characters guessing is no longer a
   realistic path, and wrong tries are also counted per IP in KV (staffGate). */
const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
async function dayCode(env) {
  const day = localDay();
  const data = new TextEncoder().encode(day + '|' + (env.TB_SECRET || ''));
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  let out = '';
  for (let i = 0; i < 8; i++) out += CODE_ALPHA[bytes[i] % CODE_ALPHA.length];
  return 'UPSIZE-' + out;
}

/* staff proof for the punch card: today's code, typed as "UPSIZE-K7QM2XPD" or just the 8 characters (any case, spaces
   or dashes optional), or the full secret. Compared in constant time. */
async function staffOk(env, raw) {
  const given = String(raw || '').trim().toUpperCase();
  if (!given) return false;
  if (env.TB_SECRET && safeEq(given, String(env.TB_SECRET).toUpperCase())) return true;
  const typed = given.replace(/[\s-]+/g, '').replace(/^UPSIZE/, '');
  if (typed.length !== 8) return false;
  const want = (await dayCode(env)).slice('UPSIZE-'.length);
  return safeEq(typed, want);
}

/* customer redeems their free drink on the punch card: {id, staff} */
async function redeemCard(env, body, request) {
  const id = String(body.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);
  if (!id) return json({ error: 'no-id' }, 400);
  const gate = await staffGate(request, env, body.staff);
  if (gate) return gate;
  const raw = await env.TB_LOC.get('card:' + id);
  if (!raw) return json({ error: 'no-card' }, 404);
  const card = JSON.parse(raw);
  if (card.mergedInto) return json({ error: 'merged', into: card.mergedInto }, 409);
  if (card.redeemed < 1) return json({ error: 'nothing-to-redeem', card }, 400);
  card.redeemed -= 1;
  card.used = (card.used || 0) + 1;
  await env.TB_LOC.put('card:' + id, JSON.stringify(card));
  return json({ ok: true, card });
}

/* ---------- rate limits that cost no KV writes (per isolate: a speed bump, not a wall) ---------- */
const hits = new Map();
function tooMany(key, max, windowMs) {
  const now = Date.now();
  let h = hits.get(key);
  if (!h || now - h.t > windowMs) { h = { t: now, n: 0 }; hits.set(key, h); }
  if (hits.size > 2000) for (const [k, v] of hits) if (now - v.t > 3600e3) hits.delete(k);
  return h.n >= max;
}
const hit = key => { const h = hits.get(key); if (h) h.n++; };
const ipOf = request => (request && request.headers.get('cf-connecting-ip')) || '0';
/* staff code check with a brake on guessing: 8 wrong codes per IP per 15 min (the daily code is only 4 digits) */
const STAFF_FAILS_PER_15MIN = 8;
async function staffGate(request, env, staff) {
  const key = 'staffbad:' + ipOf(request);
  if (tooMany(key, STAFF_FAILS_PER_15MIN, 15 * 60000)) return json({ error: 'too-many-tries' }, 429);
  /* the in-memory brake is per isolate; the KV counter below is shared by all of them (one write per WRONG code only) */
  const kvKey = 'staffbad:' + (await ipHash(env, request));
  if (await count(env, kvKey) >= STAFF_FAILS_PER_15MIN) return json({ error: 'too-many-tries' }, 429);
  if (await staffOk(env, staff)) return null;
  hit(key);
  await bump(env, kvKey, 15 * 60);
  return json({ error: 'bad-staff-code' }, 401);
}

/* ---------- punch card <-> phone number (recoverable cards) ----------
   ph:<hash> -> {card, last4, at}. The hash is SHA-256(pepper | +1XXXXXXXXXX); the pepper is a random value made
   once and kept in KV (cfg:phone-pepper), so the plain number is never stored, US numbers (only 10^10 of them)
   can't be looked up from a leaked key list without it, and rotating TB_SECRET doesn't orphan saved numbers. */
function usPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  const n = d.length === 11 && d[0] === '1' ? d.slice(1) : d;
  if (n.length !== 10 || !/^[2-9]\d{2}[2-9]\d{6}$/.test(n) || /^(\d)\1{9}$/.test(n)) return null;
  return '+1' + n;
}
let pepperCache = null;
async function phonePepper(env) {
  if (pepperCache) return pepperCache;
  let p = await env.TB_LOC.get('cfg:phone-pepper');
  if (!p) {
    p = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
    await env.TB_LOC.put('cfg:phone-pepper', p);            // one write, ever
  }
  return (pepperCache = p);
}
async function phoneKey(env, e164) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode((await phonePepper(env)) + '|' + e164));
  return 'ph:' + [...new Uint8Array(buf)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}
const cardId = v => String(v || '').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 32);
const cardView = c => ({ id: c.id, punches: c.punches || 0, redeemed: c.redeemed || 0 });
async function getCard(env, id) {
  try { return JSON.parse((await env.TB_LOC.get('card:' + id)) || 'null'); } catch (e) { return null; }
}

/* customer: "Save my card to my phone number" {id, phone}. One write; never re-points a number that's
   already saved to a different card (that needs staff: /card/recover with merge). */
async function cardLink(request, env) {
  if (tooMany('link:' + ipOf(request), 10, 10 * 60000)) return json({ error: 'slow-down' }, 429);
  hit('link:' + ipOf(request));
  let body = {};
  body = await readJson(request); if (!body) return json({ error: 'bad-json' }, 400);
  const id = cardId(body.id);
  if (!id) return json({ error: 'no-id' }, 400);
  const phone = usPhone(body.phone);
  if (!phone) return json({ error: 'bad-phone' }, 400);
  const card = await getCard(env, id);
  if (!card) return json({ error: 'no-card' }, 404);               // only cards that have had a staff punch
  if (card.mergedInto) return json({ error: 'merged', into: card.mergedInto }, 409);
  const key = await phoneKey(env, phone);
  const last4 = phone.slice(-4);
  let link = null;
  try { link = JSON.parse((await env.TB_LOC.get(key)) || 'null'); } catch (e) { link = null; }
  if (link && link.card === id) return json({ ok: true, last4, already: true });
  if (link) return json({ error: 'linked-elsewhere', last4 }, 409);
  await env.TB_LOC.put(key, JSON.stringify({ card: id, last4, at: Date.now() }));
  return json({ ok: true, last4 });
}

/* staff-confirmed recovery on a new phone {phone, staff, id?, merge?}:
   returns the saved card's id (the page stores it). If this phone's own card {id} has punches too, it answers
   409 has-punches until staff confirm merge:true, then sums punches (every 10 -> a free drink), keeps free
   drinks, and marks this phone's card as merged into the saved one (2 writes). */
async function cardRecover(request, env) {
  let body = {};
  body = await readJson(request); if (!body) return json({ error: 'bad-json' }, 400);
  const gate = await staffGate(request, env, body.staff);
  if (gate) return gate;
  const phone = usPhone(body.phone);
  if (!phone) return json({ error: 'bad-phone' }, 400);
  const key = await phoneKey(env, phone);
  let link = null;
  try { link = JSON.parse((await env.TB_LOC.get(key)) || 'null'); } catch (e) { link = null; }
  if (!link) return json({ error: 'not-linked' }, 404);
  let savedId = link.card, saved = await getCard(env, savedId);
  for (let i = 0; i < 3 && saved && saved.mergedInto; i++) { savedId = saved.mergedInto; saved = await getCard(env, savedId); }
  if (!saved) return json({ error: 'no-card' }, 404);
  const last4 = link.last4;
  const hereId = cardId(body.id);
  const here = hereId && hereId !== savedId ? await getCard(env, hereId) : null;
  const hereHas = here && !here.mergedInto && ((here.punches || 0) > 0 || (here.redeemed || 0) > 0);
  if (!hereHas) return json({ ok: true, id: savedId, last4, card: cardView(saved) });
  if (body.merge !== true) return json({ error: 'has-punches', last4, here: cardView(here), saved: cardView(saved) }, 409);
  saved.punches = (saved.punches || 0) + (here.punches || 0);
  saved.redeemed = (saved.redeemed || 0) + (here.redeemed || 0);
  while (saved.punches >= 10) { saved.punches -= 10; saved.redeemed += 1; }
  saved.used = (saved.used || 0) + (here.used || 0);
  saved.merged = (saved.merged || []).concat(hereId).slice(-10);
  await env.TB_LOC.put('card:' + savedId, JSON.stringify(saved));
  await env.TB_LOC.put('card:' + hereId, JSON.stringify({ id: hereId, punches: 0, redeemed: 0, used: here.used || 0,
    mergedInto: savedId, mergedAt: Date.now() }));
  return json({ ok: true, id: savedId, last4, merged: true, card: cardView(saved) });
}

/* staff (Bearer TB_SECRET): find a card by phone to punch it without the customer's phone. Reads only. */
async function cardByPhone(request, env, url) {
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const phone = usPhone(url.searchParams.get('phone'));
  if (!phone) return json({ error: 'bad-phone' }, 400);
  let link = null;
  try { link = JSON.parse((await env.TB_LOC.get(await phoneKey(env, phone))) || 'null'); } catch (e) { link = null; }
  if (!link) return json({ error: 'not-linked' }, 404);
  let id = link.card, card = await getCard(env, id);
  for (let i = 0; i < 3 && card && card.mergedInto; i++) { id = card.mergedInto; card = await getCard(env, id); }
  if (!card) return json({ error: 'no-card' }, 404);
  return json({ ok: true, id, last4: link.last4, card: { ...card, exists: true } });
}

/* ---------- quote alerts (see QUOTE_WEBHOOK above) ---------- */
function quoteText(q) {
  return [
    `${q.event} · ${q.date}`,
    `${q.city} · ${q.guests} guests${q.hours ? ' · ' + q.hours : ''}`,
    (q.services && q.services.length ? 'Wants: ' + q.services.join(', ') : '') + (q.pay ? (q.services && q.services.length ? ' · ' : '') + 'Pays: ' + q.pay : ''),
    `${q.name} · ${q.email}${q.phone ? ' · ' + q.phone : ''}`,
    q.notes ? 'Notes: ' + q.notes : '',
  ].filter(Boolean).join('\n');
}
const FL_RE = /\b(fl|florida|tampa|st\.? ?pete|st\.? petersburg|clearwater|sarasota|bradenton|venice|naples|fort myers|ft\.? myers|cape coral|bonita|marco island|siesta|lakewood ranch|gulf coast)\b/i;
function quoteRegion(q) {
  return FL_RE.test(q.city || '') || /tampa|sarasota|naples|florida/.test(q.page || '') ? 'florida' : 'utah';
}
async function smsQuote(env, q) {
  const region = quoteRegion(q);
  const to = region === 'florida' ? env.QUOTE_SMS_FLORIDA : env.QUOTE_SMS_UTAH;
  const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN;
  if (!to || !sid || !tok || !(env.TWILIO_FROM || env.TWILIO_MESSAGING_SERVICE_SID)) return;
  let when = q.date;
  try { when = new Date(q.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); } catch (e) {}
  const body = [
    `Thirsty Beaches: new ${q.event} request`,
    `${when} · ${q.city} · ${q.guests} guests`,
    `${q.name} · ${q.phone || q.email}${q.phone ? ' · ' + q.email : ''}`,
    'Details: thirstybeaches.com/trailer',
  ].join('\n').slice(0, 320);
  const form = new URLSearchParams({ To: to, Body: body });
  if (env.TWILIO_MESSAGING_SERVICE_SID) form.set('MessagingServiceSid', env.TWILIO_MESSAGING_SERVICE_SID);
  else form.set('From', env.TWILIO_FROM);
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST', body: form,
      headers: { 'Authorization': 'Basic ' + btoa(sid + ':' + tok), 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!r.ok) console.log('quote sms', region, r.status, (await r.text()).slice(0, 200));
  } catch (e) { console.log('quote sms failed', region, String(e)); }
}

/* The Salty Dog Tags relay (see RELAY_KEY above). -> true when at least one of Nick's channels took it. */
const relayOn = env => typeof env.RELAY_KEY === 'string' && env.RELAY_KEY.trim().length >= 32;
async function relayQuote(env, q, opt = {}) {
  const cut = (v, n) => { v = String(v || ''); return v.length > n ? v.slice(0, n - 1) + '…' : v; };
  const payload = { kind: 'notify', source: 'tb-where', priority: opt.priority || 'high', url: 'https://thirstybeaches.com/trailer',
    title: cut(opt.title || `New event request: ${q.event}`, 120),
    message: cut((opt.lead ? opt.lead + '\n' : '') + quoteText(q), 1000) };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(env.RELAY_URL || 'https://saltydogtags.com/api/relay', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.RELAY_KEY.trim() },
      body: JSON.stringify(payload),
    });
    let d = null; try { d = await r.json(); } catch (e) {}
    if (r.ok && d && d.ok) return true;
    console.log('quote relay', r.status, d && typeof d.error === 'string' ? d.error.slice(0, 40) : '');
  } catch (e) { console.log('quote relay failed', e && e.name === 'AbortError' ? 'timeout' : 'unreachable'); }
  finally { clearTimeout(timer); }
  return false;
}
/* Nick's quote alert: QUOTE_WEBHOOK when set (unchanged), otherwise the relay. -> false only when the relay failed. */
async function ownerQuoteAlert(env, q, opt = {}) {
  if (env.QUOTE_WEBHOOK) { await notifyQuote(env.QUOTE_WEBHOOK, q, opt); return true; }
  if (relayOn(env)) return relayQuote(env, q, opt);
  return true;
}

async function notifyQuote(hooks, q, opt = {}) {
  const text = (opt.lead ? opt.lead + '\n' : '') + quoteText(q);
  const title = opt.title || `New event request: ${q.event}`;
  const reply = 'mailto:' + q.email + '?subject=' + encodeURIComponent(`Your Thirsty Beaches quote (${q.event}, ${q.date})`);
  const inbox = 'https://thirstybeaches.com/trailer';
  const jobs = String(hooks).split(',').map(u => u.trim()).filter(Boolean).map(async raw => {
    let u; try { u = new URL(raw); } catch (e) { return; }
    let req;
    if (/(^|\.)ntfy\./.test(u.hostname)) {
      // header values must be ASCII-safe; ntfy decodes RFC 2047 =?UTF-8?B?...?= in headers
      const h = v => /^[\x20-\x7e]*$/.test(v) ? v : '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(v))) + '?=';
      req = { method: 'POST', body: text, headers: {
        'Title': h(title), 'Tags': opt.tags || 'cup_with_straw,tada', 'Priority': 'high', 'Click': inbox,
        'Actions': `view, Reply by email, ${reply}; view, Open quote inbox, ${inbox}`,
      } };
    } else if (/(^|\.)discord(app)?\.com$/.test(u.hostname)) {
      req = { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Thirsty Beaches', content: `**${title}**\n${text}`.slice(0, 1990) }) };
    } else if (u.hostname === 'hooks.slack.com') {
      req = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `*${title}*\n${text}` }) };
    } else {
      req = { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: opt.type || 'quote', title, text, reply_link: reply, inbox, ...q }) };
    }
    try { const r = await fetch(u.toString(), req); if (!r.ok) console.log('quote webhook', u.hostname, r.status); }
    catch (e) { console.log('quote webhook failed', u.hostname, String(e)); }
  });
  await Promise.all(jobs);
}

/* ---------- quote follow-ups: status, reminders, acknowledgement email ---------- */
const QUOTE_STATUSES = ['new', 'replied', 'booked', 'declined'];
const QUOTE_INV = 9999999999999;
const quoteKey = (at, id) => 'quote:' + String(QUOTE_INV - at).padStart(13, '0') + ':' + id;
/* the KV metadata copy lets the hourly reminder scan decide from one list() call, without reading every quote */
const quoteMeta = q => ({ s: q.status || 'new', at: q.at, r: q.remind || 0 });

function prettyDate(d) {
  try { return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
  catch (e) { return d; }
}

/* Cron (wrangler.jsonc triggers, hourly): ping QUOTE_WEBHOOK (or the relay) about requests still "new" 24 h and 72 h after
   they arrived (QUOTE_REMIND_HOURS, default "24,72"). One KV list per run; one KV write per reminder sent
   (at most two per quote, ever). Requests saved before statuses existed (no metadata) are never nagged about. */
async function quoteReminders(env, now = Date.now()) {
  if (!env.QUOTE_WEBHOOK && !relayOn(env)) return { sent: 0, skipped: 'no-webhook' };
  const steps = String(env.QUOTE_REMIND_HOURS || '24,72').split(',').map(n => parseFloat(n)).filter(n => n > 0).sort((a, b) => a - b).slice(0, 4);
  if (!steps.length) return { sent: 0 };
  const oldest = now - (steps[steps.length - 1] + 96) * 3600e3;    // nothing older than the last step + 4 days
  let sent = 0, cursor, scanned = 0;
  outer: for (let page = 0; page < 5; page++) {
    const list = await env.TB_LOC.list({ prefix: 'quote:', cursor, limit: 1000 });
    for (const k of list.keys) {
      scanned++;
      const at = QUOTE_INV - parseInt(k.name.split(':')[1], 10);
      if (!(at >= oldest)) break outer;                            // keys sort newest first
      const m = k.metadata;
      if (!m || m.s !== 'new') continue;
      const ageH = (now - m.at) / 3600e3;
      let level = 0; steps.forEach((h, i) => { if (ageH >= h) level = i + 1; });
      if (level <= (m.r || 0)) continue;
      const raw = await env.TB_LOC.get(k.name);
      if (!raw) continue;
      const q = JSON.parse(raw);
      if ((q.status || 'new') !== 'new') continue;
      const hrs = steps[level - 1];
      const ok = await ownerQuoteAlert(env, q, {
        title: `Still new after ${hrs} h: ${q.event} (${q.name})`,
        lead: `Reminder: this request arrived ${Math.round(ageH)} h ago and is still marked new. Reply, then set its status on /trailer.`,
        tags: 'alarm_clock', type: 'quote-reminder', priority: 'normal',
      });
      if (!ok) return { sent, scanned, failed: true };              // relay didn't take it: not marked, next hour retries
      q.remind = level;
      await env.TB_LOC.put(k.name, JSON.stringify(q), { metadata: quoteMeta(q) });
      sent++;
    }
    if (list.list_complete || !list.cursor) break;
    cursor = list.cursor;
  }
  return { sent, scanned };
}

/* Automatic "got it" email to the planner through Resend's HTTP API. Dormant unless RESEND_API_KEY is set.
   Only fixed text plus a short summary of their own request; links/domains typed into the form are stripped and
   the free-text notes are not echoed, so the form can't be used to send arbitrary text to someone else. */
const noLinks = v => String(v || '')
  .replace(/https?:\/\/\S+|www\.\S+/gi, '')
  .replace(/\b[a-z0-9-]+\.(com|net|org|info|biz|io|co|ru|xyz|top|site|online|link|app|me|ly|gg|cn|tk|click|shop)\b\S*/gi, '')
  .replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
const escHtml = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function ackMessage(q) {
  const first = noLinks(q.name).split(' ')[0].slice(0, 30);
  const rows = [
    ['Event', noLinks(q.event)], ['Date', prettyDate(q.date)], ['Where', noLinks(q.city)], ['Guests', noLinks(q.guests)],
    ['Hours', noLinks(q.hours)], ['Wants', (q.services || []).map(noLinks).join(', ')],
  ].filter(r => r[1]);
  const subject = `We got your request: ${noLinks(q.event) || 'event'}, ${prettyDate(q.date)}`;
  const text = [
    `Hi${first ? ' ' + first : ''},`, '',
    'Got it, here’s what happens next: we reply within one business day.',
    'If anything changes before then, just reply to this email.', '',
    'Here’s what you sent us:',
    ...rows.map(([k, v]) => `  ${k}: ${v}`),
    q.notes ? '  (your notes came through too)' : '', '',
    'Thirsty Beaches',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.5;color:#1b0538">`
    + `<p>Hi${first ? ' ' + escHtml(first) : ''},</p>`
    + `<p><b>Got it, here’s what happens next:</b> we reply within one business day. If anything changes before then, just reply to this email.</p>`
    + `<p>Here’s what you sent us:</p><table style="border-collapse:collapse">`
    + rows.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#666">${k}</td><td style="padding:2px 0">${escHtml(v)}</td></tr>`).join('')
    + `</table>${q.notes ? '<p style="color:#666">(your notes came through too)</p>' : ''}<p>Thirsty Beaches</p></div>`;
  return { subject, text, html };
}

async function ackEmail(env, q) {
  if (!env.RESEND_API_KEY) return { skipped: 'no-key' };
  const msg = ackMessage(q);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'quote-' + q.id },
      body: JSON.stringify({
        from: env.EMAIL_FROM || 'Thirsty Beaches <hello@thirstybeaches.com>',
        to: [q.email],
        reply_to: env.EMAIL_REPLY_TO || 'hello@thirstybeaches.com',
        subject: msg.subject, text: msg.text, html: msg.html,
      }),
    });
    if (!r.ok) console.log('quote ack email', r.status, (await r.text()).slice(0, 200));
    return { status: r.status };
  } catch (e) { console.log('quote ack email failed', String(e)); return { error: String(e) }; }
}

/* ---------- punches: the one rule every route uses (every 10 punches -> a free drink) ---------- */
function addPunches(card, n) {
  card.punches = (card.punches || 0) + n;
  card.redeemed = card.redeemed || 0;
  let earned = 0;
  while (card.punches >= 10) { card.punches -= 10; card.redeemed += 1; earned++; }
  return earned;
}

/* ---------- punch from any paid order: POST /card/claim {id, token} ----------
   The station makes the token, only for an order it knows is paid (see CONTRACTS "Punch from any paid order"):
     payload = `${ref}.${drinks}.${expMs}`, sig = first 32 hex of HMAC-SHA256(PUNCH_KEY, payload), token = payload.sig
   The HMAC key is the PUNCH_KEY string as stored (64 hex chars), UTF-8 encoded, not hex-decoded.
   Feature off (503 punch-off) until the "Set up punch key" workflow has stored PUNCH_KEY here.
   One use per ref: claim:<ref> (TTL 8 days) is written before the punch. 2 KV writes per claim. */
const punchKey = env => (typeof env.PUNCH_KEY === 'string' && env.PUNCH_KEY.trim().length >= 32 ? env.PUNCH_KEY.trim() : '');
const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function punchSig(key, payload) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(payload))).slice(0, 32);
}
function sameHex(a, b) {                      // constant time for equal lengths (both are always 32 here)
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const TOKEN_RE = /^([A-Z0-9]{1,40})\.([1-5])\.(\d{10,15})\.([0-9a-f]{32})$/;
async function cardClaim(request, env) {
  const key = punchKey(env);
  if (!key) return json({ error: 'punch-off' }, 503);
  const rl = 'claim:' + ipOf(request);
  if (tooMany(rl, 10, 10 * 60000)) return json({ error: 'slow-down' }, 429);
  hit(rl);
  let body = {};
  body = await readJson(request); if (!body) return json({ error: 'bad-json' }, 400);
  const id = String((body && body.id) || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);   // same as /punch
  if (!id) return json({ error: 'no-id' }, 400);
  const m = String((body && body.token) || '').trim().match(TOKEN_RE);
  if (!m) return json({ error: 'bad-token' }, 400);
  const [, ref, drinksS, expS, sig] = m;
  if (!sameHex(sig, await punchSig(key, `${ref}.${drinksS}.${expS}`))) return json({ error: 'bad-token' }, 400);
  if (Number(expS) < Date.now()) return json({ error: 'expired' }, 410);
  if (await env.TB_LOC.get('claim:' + ref)) return json({ error: 'used' }, 409);
  const raw = await env.TB_LOC.get('card:' + id);
  const card = raw ? JSON.parse(raw) : { id, punches: 0, redeemed: 0, created: Date.now() };
  if (card.mergedInto) return json({ error: 'merged', into: card.mergedInto }, 409);   // the page follows it and retries
  const drinks = Number(drinksS);
  await env.TB_LOC.put('claim:' + ref, JSON.stringify({ card: id, drinks, at: Date.now() }), { expirationTtl: 8 * 86400 });
  const earned = addPunches(card, drinks);
  card.claimed = (card.claimed || 0) + drinks;
  await env.TB_LOC.put('card:' + id, JSON.stringify(card));
  return json({ ok: true, added: drinks, earned, card: cardView(card) });
}

/* ---------- "Tell the list we're open": POST /broadcast (Bearer TB_SECRET) {text} ----------
   OFF (503 broadcast-off) unless the var BROADCAST_ENABLED is "true" (Nick turns it on once the SMS terms /
   privacy page are approved). GET /broadcast (same auth) tells the trailer page whether to show the step.
   Who gets it: everyone on the alert list. Every sub:<contact> key was written by POST /subscribe, which
   refuses without consent:true, so the key names are the list: no per-subscriber reads.
     phones (+E.164) -> own Twilio (TWILIO_*), else the Salty Dog Tags relay, kind "sms" (its Twilio number; the relay adds the hard caps:
                        500 numbers per call, 1 call per 10 min, 2000 per day). "Reply STOP to opt out" is added.
     emails          -> Resend batch API, only when RESEND_API_KEY and BROADCAST_EMAIL_FOOTER (Nick's mailing
                        address + how to unsubscribe, required for marketing email) are both set; else skipped.
   One send per 10 min from here too. KV per send: 1 list per 1000 subscribers + 1 read + 1 write (bcast:last). */
const broadcastOn = env => String(env.BROADCAST_ENABLED || '').trim() === 'true';
/* TODO(Nick): before setting BROADCAST_ENABLED, check the texts against your SMS terms / privacy page. The signup
   box promises "a few times a month"; the relay only enforces this STOP line. A STOP reply is handled by Twilio
   (it blocks that number; later sends to it count as failed), it does not remove the number from this list. */
const STOP_LINE = 'Reply STOP to opt out';
const BROADCAST_GAP_MS = 10 * 60000;
const BROADCAST_MAX_SMS = 500;
const BROADCAST_MAX_EMAIL = 500;
const E164_RE = /^\+[1-9]\d{7,14}$/;
const emailReady = env => !!(env.RESEND_API_KEY && String(env.BROADCAST_EMAIL_FOOTER || '').trim());
async function listContacts(env) {
  const phones = [], emails = [];
  let cursor;
  for (let page = 0; page < 10; page++) {
    /* csub: = confirmed (double opt-in) subscribers only. Pending signups (pend:) and the pre-confirmation legacy list
       (sub:) are never texted or emailed until they confirm. */
    const list = await env.TB_LOC.list({ prefix: 'csub:', cursor, limit: 1000 });
    for (const k of list.keys) {
      const c = k.name.slice(5);
      if (E164_RE.test(c)) phones.push(c);
      else if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(c)) emails.push(c);
    }
    if (list.list_complete || !list.cursor) break;
    cursor = list.cursor;
  }
  return { phones, emails };
}
const smsText = t => (t.endsWith(STOP_LINE) ? t : t + '\n' + STOP_LINE);
/* Thirsty Beaches' own Twilio number (secrets TWILIO_SID + TWILIO_TOKEN, and TWILIO_FROM = +1XXXXXXXXXX or a
   Messaging Service SID MG...). When set, texts go straight from here; otherwise through the Salty Dog Tags relay.
   Workers Free allows 50 outgoing requests per call, so one send texts at most TWILIO_PER_SEND (default 45) numbers;
   set TWILIO_PER_SEND higher on Workers Paid. The rest are reported as "left". */
const twilioOn = env => !!(env.TWILIO_SID && env.TWILIO_TOKEN && env.TWILIO_FROM);
const smsOn = env => twilioOn(env) || relayOn(env);
/* GET /twilio/status (public, sends nothing): are the Twilio keys right, and can the number text yet?
   {configured, credentials:"ok"|"bad"|"error", number:"found"|"missing", sms:bool}. One Twilio read, cached 10 min
   per isolate; no SID, token or number in the reply. */
let twilioStatusMemo = { at: 0, body: null };
async function twilioStatus(env) {
  if (!twilioOn(env)) return json({ configured: false });
  if (twilioStatusMemo.body && Date.now() - twilioStatusMemo.at < 600000) return json(twilioStatusMemo.body);
  const sid = String(env.TWILIO_SID).trim(), from = String(env.TWILIO_FROM).trim();
  const auth = 'Basic ' + btoa(sid + ':' + String(env.TWILIO_TOKEN).trim());
  const base = 'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid);
  let body;
  try {
    const r = await fetch(base + '/IncomingPhoneNumbers.json?PhoneNumber=' + encodeURIComponent(from), { headers: { Authorization: auth } });
    if (r.status === 401 || r.status === 403 || r.status === 404) body = { configured: true, credentials: 'bad' };
    else if (!r.ok) body = { configured: true, credentials: 'error', http: r.status };
    else {
      const d = await r.json().catch(() => ({}));
      const n = (d.incoming_phone_numbers || [])[0];
      body = { configured: true, credentials: 'ok', number: n ? 'found' : 'missing', sms: !!(n && n.capabilities && n.capabilities.sms) };
    }
  } catch (e) { body = { configured: true, credentials: 'error' }; }
  twilioStatusMemo = { at: Date.now(), body };
  return json(body);
}
async function broadcastTwilio(env, to, text) {
  const per = Math.max(1, Math.min(500, parseInt(env.TWILIO_PER_SEND, 10) || 45));
  const list = to.slice(0, per), from = String(env.TWILIO_FROM).trim();
  const auth = 'Basic ' + btoa(String(env.TWILIO_SID).trim() + ':' + String(env.TWILIO_TOKEN).trim());
  const url = 'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(String(env.TWILIO_SID).trim()) + '/Messages.json';
  let sent = 0, failed = 0;
  for (let i = 0; i < list.length; i += 10) {                          // 10 at a time
    const rs = await Promise.allSettled(list.slice(i, i + 10).map(num => fetch(url, {
      method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: num, Body: text, ...(/^MG[0-9a-f]{32}$/i.test(from) ? { MessagingServiceSid: from } : { From: from }) }),
    })));
    for (const r of rs) { if (r.status === 'fulfilled' && r.value.ok) sent++; else failed++; }
  }
  if (failed) console.log('broadcast twilio failed', failed);         // never the numbers
  return { sent, failed, via: 'twilio', ...(to.length > list.length ? { left: to.length - list.length } : {}) };
}
async function broadcastStatus(request, env) {
  if (!broadcastOn(env)) return json({ error: 'broadcast-off' }, 503);
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const { phones, emails } = await listContacts(env);
  let last = null;
  try { last = JSON.parse((await env.TB_LOC.get('bcast:last')) || 'null'); } catch (e) { last = null; }
  return json({ enabled: true, phones: phones.length, emails: emails.length, sms: smsOn(env), email: emailReady(env),
    stopLine: STOP_LINE, maxLen: 300, lastAt: last ? last.at : null, gapMin: BROADCAST_GAP_MS / 60000 });
}
async function broadcastSms(env, to, text) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 28000);
  try {
    const r = await fetch(env.RELAY_URL || 'https://saltydogtags.com/api/relay', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.RELAY_KEY.trim() },
      body: JSON.stringify({ kind: 'sms', source: 'tb-where', to, text }),
    });
    let d = null; try { d = await r.json(); } catch (e) {}
    if (r.ok && d && d.ok) return { sent: d.sent | 0, failed: d.failed | 0 };
    console.log('broadcast relay', r.status, d && typeof d.error === 'string' ? d.error.slice(0, 40) : '');
    return { error: d && typeof d.error === 'string' ? d.error.slice(0, 40) : 'relay-' + r.status };
  } catch (e) {
    console.log('broadcast relay failed', e && e.name === 'AbortError' ? 'timeout' : 'unreachable');
    return { error: e && e.name === 'AbortError' ? 'relay-timeout' : 'relay-unreachable' };
  } finally { clearTimeout(timer); }
}
async function broadcastEmail(env, to, text) {
  const footer = String(env.BROADCAST_EMAIL_FOOTER).trim();
  const body = text + '\n\n--\n' + footer;
  let sent = 0, failed = 0;
  for (let i = 0; i < to.length; i += 100) {                         // Resend batch: up to 100 emails per call
    const chunk = to.slice(i, i + 100);
    try {
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk.map(addr => ({
          from: env.EMAIL_FROM || 'Thirsty Beaches <hello@thirstybeaches.com>',
          to: [addr], reply_to: env.EMAIL_REPLY_TO || 'hello@thirstybeaches.com',
          subject: 'Thirsty Beaches: we’re open', text: body,
        }))),
      });
      if (r.ok) sent += chunk.length; else { failed += chunk.length; console.log('broadcast email', r.status); }
    } catch (e) { failed += chunk.length; console.log('broadcast email failed'); }
  }
  return { sent, failed };
}
async function broadcast(request, env) {
  if (!broadcastOn(env)) return json({ error: 'broadcast-off' }, 503);
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  let body = {};
  body = await readJson(request); if (!body) return json({ error: 'bad-json' }, 400);
  if (typeof (body && body.text) !== 'string') return json({ error: 'bad-text' }, 400);
  const text = body.text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text || text.length > 300) return json({ error: 'bad-text', max: 300 }, 400);
  const now = Date.now();
  if (tooMany('bcast', 1, BROADCAST_GAP_MS)) return json({ error: 'too-soon', retryMin: 10 }, 429);
  let last = null;
  try { last = JSON.parse((await env.TB_LOC.get('bcast:last')) || 'null'); } catch (e) { last = null; }
  if (last && now - last.at < BROADCAST_GAP_MS) return json({ error: 'too-soon', retryMin: Math.ceil((BROADCAST_GAP_MS - (now - last.at)) / 60000) }, 429);
  const { phones, emails } = await listContacts(env);
  hit('bcast');
  // reserve before sending, so a double tap or a retry can't text everyone twice
  await env.TB_LOC.put('bcast:last', JSON.stringify({ at: now, phones: phones.length, emails: emails.length }), { expirationTtl: 86400 });
  const toSms = phones.slice(0, BROADCAST_MAX_SMS), toEmail = emails.slice(0, BROADCAST_MAX_EMAIL);
  const sms = !phones.length ? { skipped: 'no-phones' } : twilioOn(env) ? await broadcastTwilio(env, toSms, smsText(text))
    : !relayOn(env) ? { skipped: 'no-sms' } : await broadcastSms(env, toSms, smsText(text));
  if (phones.length > toSms.length && !sms.skipped) sms.left = (sms.left || 0) + phones.length - toSms.length;
  const email = !emails.length ? { skipped: 'no-emails' } : !env.RESEND_API_KEY ? { skipped: 'no-resend' }
    : !emailReady(env) ? { skipped: 'no-email-footer' } : await broadcastEmail(env, toEmail, text);
  if (emails.length > toEmail.length && !email.skipped) email.left = emails.length - toEmail.length;
  return json({ ok: true, phones: phones.length, emails: emails.length, sms, email, text: smsText(text) });
}

/* ---------- kiosk heartbeat ---------- */
const KIOSK_MAX_BYTES = 8192;
const KIOSK_MAX_IDS = 5;
const KIOSK_ONLINE_MS = 12 * 60 * 1000;      // > ping interval (2 min) + write throttle (5 min) + slack
const KIOSK_TTL_S = 60 * 60 * 24 * 30;
const KIOSK_HISTORY = 25;
const kioskRate = new Map();                  // per-isolate limiter (no KV writes spent on rate limiting)

function kioskRateOk(key, minGapMs) {
  const now = Date.now();
  const last = kioskRate.get(key) || 0;
  if (now - last < minGapMs) return false;
  kioskRate.set(key, now);
  if (kioskRate.size > 500) for (const [k, t] of kioskRate) if (now - t > 600000) kioskRate.delete(k);
  return true;
}
const kStr = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : null);
const kNum = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v) : null);
const kBool = v => (typeof v === 'boolean' ? v : null);
const kIso = v => (typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : null);
const kVer = v => (typeof v === 'number' ? kNum(v, 0, 1e9) : kStr(v, 24));
const kObj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

/* keep only known fields, each type-checked and length-capped */
function cleanKioskPing(b) {
  const lu = kObj(b.lastUpdate), rb = kObj(b.rollback), pay = kObj(b.pay), cl = kObj(b.clover), lc = kObj(b.lastCommand);
  return {
    version: kVer(b.version),
    serverHash: typeof b.serverHash === 'string' && /^[0-9a-f]{8,64}$/.test(b.serverHash) ? b.serverHash : null,
    uptimeSec: kNum(b.uptimeSec, 0, 1e9),
    startedAt: kIso(b.startedAt),
    lastUpdate: lu ? { version: kVer(lu.version), at: kIso(lu.at), ok: kBool(lu.ok), error: kStr(lu.error, 200) } : null,
    rollback: rb ? { at: kIso(rb.at), from: kVer(rb.from), to: kVer(rb.to), reason: kStr(rb.reason, 200) } : null,
    pay: pay ? { enabled: kBool(pay.enabled), flexConnected: kBool(pay.flexConnected), state: kStr(pay.state, 20) } : null,
    clover: cl ? { lastOk: kIso(cl.lastOk), lastError: kStr(cl.lastError, 160) } : null,
    errors: Array.isArray(b.errors) ? b.errors.slice(-10).map(e => kStr(e, 200)).filter(Boolean) : [],
    node: kStr(b.node, 20),
    freeDiskMB: kNum(b.freeDiskMB, 0, 1e9),
    supervised: kBool(b.supervised),
    trial: kBool(b.trial),
    safeMode: kBool(b.safeMode),
    appDown: b.appDown === true,
    settings: Array.isArray(b.settings) ? b.settings.slice(0, 20).map(s => kStr(s, 40)).filter(Boolean) : [],
    lastCommand: lc ? { name: kStr(lc.name, 20), at: kIso(lc.at) } : null,
    pendingRestart: kStr(b.pendingRestart, 80),
  };
}
/* what counts as "something happened" (written at once + added to the history) */
function kioskSig(r) {
  return JSON.stringify([r.version, r.serverHash, r.lastUpdate, r.rollback, r.errors.slice(-1), r.pay && r.pay.flexConnected,
                         r.safeMode, r.appDown, r.trial, r.startedAt]);
}
function kioskEvents(prev, r, now) {
  const ev = [];
  const p = prev || {};
  if (!prev || p.version !== r.version) ev.push({ at: now, t: 'version', v: r.version });
  if (!prev || p.startedAt !== r.startedAt) ev.push({ at: now, t: 'start', v: r.version });
  if (r.rollback && JSON.stringify(r.rollback) !== JSON.stringify(p.rollback || null)) ev.push({ at: now, t: 'rollback', ...r.rollback });
  if (r.lastUpdate && JSON.stringify(r.lastUpdate) !== JSON.stringify(p.lastUpdate || null)) ev.push({ at: now, t: 'update', ...r.lastUpdate });
  const lastErr = r.errors[r.errors.length - 1];
  if (lastErr && lastErr !== (p.errors || []).slice(-1)[0]) ev.push({ at: now, t: 'error', msg: lastErr });
  if (r.appDown !== !!p.appDown) ev.push({ at: now, t: r.appDown ? 'down' : 'up' });
  if (r.safeMode && !p.safeMode) ev.push({ at: now, t: 'safe-mode' });
  return ev;
}

async function kioskPing(request, env) {
  const len = parseInt(request.headers.get('content-length') || '0', 10) || 0;
  if (len > KIOSK_MAX_BYTES) return json({ error: 'too-big' }, 413);
  const text = await request.text();
  if (text.length > KIOSK_MAX_BYTES) return json({ error: 'too-big' }, 413);
  let b;
  try { b = JSON.parse(text); } catch (e) { return json({ error: 'bad-json' }, 400); }
  if (!kObj(b)) return json({ error: 'bad-json' }, 400);
  const id = typeof b.kioskId === 'string' && /^[A-Za-z0-9._-]{1,40}$/.test(b.kioskId) ? b.kioskId : null;
  if (!id) return json({ error: 'bad-kiosk-id' }, 400);
  const ip = request.headers.get('cf-connecting-ip') || '0';
  const gap = parseInt(env.KIOSK_MIN_GAP_MS || '15000', 10);
  if (!kioskRateOk('ip:' + ip, Math.min(5000, gap)) || !kioskRateOk('id:' + id, gap)) return json({ error: 'slow-down' }, 429);

  const rec = cleanKioskPing(b);
  const key = 'kiosk:' + id;
  const prevRaw = await env.TB_LOC.get(key);
  let prev = null;
  try { prev = prevRaw ? JSON.parse(prevRaw) : null; } catch (e) { prev = null; }
  if (!prev) {
    let idx = [];
    try { idx = JSON.parse((await env.TB_LOC.get('kiosk:index')) || '[]'); } catch (e) { idx = []; }
    if (!Array.isArray(idx)) idx = [];
    if (!idx.includes(id)) {
      if (idx.length >= KIOSK_MAX_IDS) return json({ error: 'too-many-kiosks' }, 403);
      idx.push(id);
      await env.TB_LOC.put('kiosk:index', JSON.stringify(idx));
    }
  }
  const now = Date.now();
  const sig = kioskSig(rec);
  const writeEvery = (parseInt(env.KIOSK_WRITE_MIN || '5', 10) || 5) * 60000;
  if (prev && prev.sig === sig && now - (prev.seenAt || 0) < writeEvery) return json({ ok: true, stored: false });
  const history = ((prev && prev.history) || []).concat(kioskEvents(prev && prev.last, rec, now)).slice(-KIOSK_HISTORY);
  const out = { kioskId: id, seenAt: now, firstSeen: (prev && prev.firstSeen) || now, sig, last: rec, history };
  await env.TB_LOC.put(key, JSON.stringify(out), { expirationTtl: KIOSK_TTL_S });
  return json({ ok: true, stored: true });
}

async function kioskStatus(request, env, url) {
  const full = url.searchParams.get('full') === '1';
  if (full && !authed(request, env)) return json({ error: 'unauthorized' }, 401);
  let idx = [];
  try { idx = JSON.parse((await env.TB_LOC.get('kiosk:index')) || '[]'); } catch (e) { idx = []; }
  if (!Array.isArray(idx)) idx = [];
  const want = (url.searchParams.get('id') || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40);
  const ids = want ? idx.filter(i => i === want) : idx;
  const now = Date.now();
  const kiosks = [];
  for (const id of ids) {
    let r = null;
    try { r = JSON.parse((await env.TB_LOC.get('kiosk:' + id)) || 'null'); } catch (e) { r = null; }
    if (!r || !r.last) continue;
    const base = {
      kioskId: id,
      online: now - r.seenAt < KIOSK_ONLINE_MS && !r.last.appDown,
      lastSeen: new Date(r.seenAt).toISOString(),
      ageMin: Math.round((now - r.seenAt) / 60000),
      version: r.last.version,
    };
    kiosks.push(full ? { ...base, firstSeen: new Date(r.firstSeen).toISOString(), ...r.last, history: r.history || [] } : base);
  }
  const first = kiosks[0] || { online: false, lastSeen: null, version: null };
  return json({ ...first, kiosks });
}

/* ---------- alert signup: double opt-in, consent record, self-serve unsubscribe, STOP/HELP/YES ----------
   POST /subscribe {contact, smsConsent, source:'web'|'kiosk', consentVersion?}  (JSON, or a plain HTML form post)
     -> a PENDING record (pend:<id>) with a confirmation code. Nothing is texted or emailed to the list until it is
        CONFIRMED (csub:<id>), by replying YES to the confirmation text, by the emailed link, or by staff (/subs/confirm).
        Each record keeps source (web|kiosk), consentVersion (sha256 of the exact consent text shown), and ts.
   The consent wording lives in consent/sms-consent-v1.txt (and SMS_CONSENT_V1 below, the website form, and the kiosk page).
   tests/consent.test.mjs fails when any copy drifts from the file. Change the text = a NEW file + a new constant, never an edit. */
const SMS_CONSENT_V1 = "Yes, Thirsty Beaches may send automated marketing texts to this number about stops and specials. Not required to buy anything. A few msgs/month; msg & data rates may apply. Reply STOP to cancel, HELP for help. I'm 13+ and this is my number. Terms: thirstybeaches.com/sms-terms";
const CONFIRM_TEXT = 'Thirsty Beaches: reply YES to get stop & special alerts. A few msgs/mo. Msg & data rates may apply. Reply STOP to cancel, HELP for help.';
const SITE_URL = 'https://thirstybeaches.com';
const normText = t => String(t).normalize('NFC').replace(/\s+/g, ' ').trim();
async function consentVersionNow() { return sha256Hex(normText(SMS_CONSENT_V1)); }
const PEND_TTL = 14 * 86400;
const CONFIRM_MAX_SENDS = 3, CONFIRM_RESEND_MS = 10 * 60000;
/* A fresh signup costs 4-5 KV writes and the Workers free plan allows 1,000 writes a day in the namespace that also holds the
   live pin, schedule and cards: 100 signups a day is about 500 writes. Raise it only on a paid plan, and put a Cloudflare
   rate-limit rule on /subscribe and /scores first (README, "Before deploy"). */
const SIGNUPS_PER_IP_PER_HOUR = 8, SIGNUPS_PER_IP_PER_DAY = 20, SIGNUPS_PER_DAY = 100;

async function readForm(request) {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) { const b = await readJson(request); return b ? { body: b, form: false } : null; }
  if (ct.includes('application/x-www-form-urlencoded')) {
    try { const f = new URLSearchParams(await request.text()); return { body: Object.fromEntries(f.entries()), form: true }; } catch (e) { return null; }
  }
  return null;
}
const truthy = v => v === true || v === '1' || v === 'on' || v === 'true' || v === 'yes';
const formDone = (r) => new Response(null, { status: 303, headers: { Location: SITE_URL + '/signup-thanks.html?r=' + r, 'Cache-Control': 'no-store' } });
const rand = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

async function newPending(env, who, extra) {
  const rec = { id: who.id, kind: who.kind, status: 'pending', code: rand(24), ts: Date.now(), sentCount: 0, lastSent: 0, ...extra };
  await env.TB_LOC.put('pend:' + who.id, JSON.stringify(rec), { expirationTtl: PEND_TTL });
  await env.TB_LOC.put('pcode:' + rec.code, who.id, { expirationTtl: PEND_TTL });
  return rec;
}

/* sends the confirmation text/email when a sender is wired; false = nothing was sent (the record stays pending for staff) */
async function sendConfirmation(env, rec) {
  if (rec.sentCount >= CONFIRM_MAX_SENDS || Date.now() - (rec.lastSent || 0) < CONFIRM_RESEND_MS) return false;
  let ok = false;
  if (rec.kind === 'sms' && twilioOn(env)) {
    const r = await broadcastTwilio(env, [rec.id], CONFIRM_TEXT);
    ok = r.sent > 0;
  } else if (rec.kind === 'email' && env.RESEND_API_KEY) {
    try {
      const link = SITE_URL + '/confirm?c=' + rec.code;
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.EMAIL_FROM || 'Thirsty Beaches <hello@thirstybeaches.com>', to: [rec.id],
          reply_to: env.EMAIL_REPLY_TO || 'hello@thirstybeaches.com', subject: 'Confirm your Thirsty Beaches alerts',
          text: 'Tap to confirm you want Thirsty Beaches stop and special alerts by email:\n' + link + '\n\nIf this was not you, ignore this message and nothing will be sent.',
        }),
      });
      ok = r.ok;
    } catch (e) { ok = false; }
  }
  if (ok) {
    rec.sentCount = (rec.sentCount || 0) + 1; rec.lastSent = Date.now();
    await env.TB_LOC.put('pend:' + rec.id, JSON.stringify(rec), { expirationTtl: PEND_TTL });
  }
  return ok;
}

/* pending -> confirmed. via: 'sms-reply' | 'link' | 'staff' */
async function confirmContact(env, id, via) {
  let rec = null;
  try { rec = JSON.parse((await env.TB_LOC.get('pend:' + id)) || 'null'); } catch (e) { rec = null; }
  if (!rec) return null;
  const done = { id: rec.id, kind: rec.kind, source: rec.source, consentVersion: rec.consentVersion, ts: rec.ts, confirmedAt: Date.now(), confirmedVia: via };
  await env.TB_LOC.put('csub:' + id, JSON.stringify(done));
  await env.TB_LOC.delete('pend:' + id);
  if (rec.code) await env.TB_LOC.delete('pcode:' + rec.code);
  await env.TB_LOC.delete('sub:' + id);
  return done;
}
async function removeContact(env, id) {
  let rec = null;
  try { rec = JSON.parse((await env.TB_LOC.get('pend:' + id)) || 'null'); } catch (e) { rec = null; }
  if (rec && rec.code) await env.TB_LOC.delete('pcode:' + rec.code);
  await env.TB_LOC.delete('pend:' + id);
  await env.TB_LOC.delete('csub:' + id);
  await env.TB_LOC.delete('sub:' + id);
}

async function subscribe(request, env) {
  const parsed = await readForm(request);
  const fail = (code, status, formCode) => (parsed && parsed.form ? formDone(formCode || 'bad') : json({ error: code }, status));
  if (!parsed) return json({ error: 'bad-json' }, 400);
  const b = parsed.body;
  if (b.website) return parsed.form ? formDone('ok') : json({ ok: true, kind: 'sms', pending: true });   // honeypot: look successful
  const ip = ipOf(request);
  if (tooMany('sub:' + ip, SIGNUPS_PER_IP_PER_HOUR, 3600e3)) return fail('slow-down', 429, 'rate');
  hit('sub:' + ip);
  const who = normalise(b.contact);
  if (!who) return fail('bad-contact', 400, 'bad');
  /* where the consent was given. A client that does not say (the kiosk before its update) is 'unknown', never assumed to be
     the website: the record must describe the words the person actually saw. */
  const source = b.source === 'kiosk' ? 'kiosk' : b.source === 'web' ? 'web' : 'unknown';
  /* consent: a text signup needs the box ticked. smsConsent is the explicit field; an older client that only sends
     consent:true (the kiosk before its update) is accepted the same way, and recorded without a version. */
  const sms = b.smsConsent !== undefined ? truthy(b.smsConsent) : b.consent === true;
  if (who.kind === 'sms' && !sms) return fail('consent-required', 400, 'consent');
  const current = await consentVersionNow();
  let consentVersion = null;
  if (who.kind === 'sms') {
    /* stamped ONLY when the client sent the hash of the text it showed and that hash is the current wording; no hash = no
       version (null), whatever the source. The website form carries the hash in a hidden field and recomputes it in JS. */
    if (typeof b.consentVersion === 'string' && b.consentVersion) {
      if (b.consentVersion !== current) return fail('consent-changed', 409, 'bad');        // a stale page showed other wording
      consentVersion = current;
    }
  }
  /* a number already confirmed gets exactly the reply a new signup gets, so this form cannot be used to probe the list */
  if (await env.TB_LOC.get('csub:' + who.id)) {
    if (parsed.form) return formDone('ok');
    const can = who.kind === 'sms' ? twilioOn(env) : Boolean(env.RESEND_API_KEY);
    return json({ ok: true, kind: who.kind, status: 'pending', confirmSent: can, confirm: can ? who.kind : 'staff' });
  }

  const ih = await ipHash(env, request);
  if (await count(env, 'signupip:' + ih) >= SIGNUPS_PER_IP_PER_DAY || await count(env, 'signups:' + localDay()) >= SIGNUPS_PER_DAY) return fail('slow-down', 429, 'rate');

  let rec = null;
  try { rec = JSON.parse((await env.TB_LOC.get('pend:' + who.id)) || 'null'); } catch (e) { rec = null; }
  if (!rec) {
    rec = await newPending(env, who, { source, consentVersion });
    await bump(env, 'signupip:' + ih, 86400); await bump(env, 'signups:' + localDay(), 86400);
  }
  const sent = await sendConfirmation(env, rec);
  if (parsed.form) return formDone('ok');
  return json({ ok: true, kind: who.kind, status: 'pending', confirmSent: sent, confirm: sent ? who.kind : 'staff' });
}

/* the emailed link (or a future SMS link): POST /subscribe/confirm {code} */
async function confirmByCode(request, env) {
  const b = await readJson(request); if (!b) return json({ error: 'bad-json' }, 400);
  if (tooMany('confirm:' + ipOf(request), 20, 3600e3)) return json({ error: 'slow-down' }, 429);
  hit('confirm:' + ipOf(request));
  const code = String(b.code || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
  if (code.length !== 24) return json({ error: 'bad-code' }, 400);
  const id = await env.TB_LOC.get('pcode:' + code);
  if (!id) return json({ error: 'bad-code' }, 404);
  const rec = await confirmContact(env, id, 'link');
  return rec ? json({ ok: true, kind: rec.kind }) : json({ error: 'bad-code' }, 404);
}

/* public self-serve unsubscribe: POST /unsubscribe {contact}. Always answers ok (no list probing). */
async function selfUnsub(request, env) {
  const b = await readJson(request); if (!b) return json({ error: 'bad-json' }, 400);
  if (tooMany('unsub:' + ipOf(request), 10, 3600e3)) return json({ error: 'slow-down' }, 429);
  hit('unsub:' + ipOf(request));
  const who = normalise(b.contact);
  if (!who) return json({ error: 'bad-contact' }, 400);
  await removeContact(env, who.id);
  return json({ ok: true });
}

/* Twilio inbound SMS webhook (set the number's "A message comes in" URL to <worker>/sms/inbound). The request signature
   (X-Twilio-Signature = base64 HMAC-SHA1 of the URL + the sorted form fields, key = the auth token) is checked first;
   with no TWILIO_TOKEN the route is off (503). STOP-type words and plain-language opt-outs remove the number at once. */
const STOP_RE = /^\s*(stop|stopall|unsubscribe|cancel|end|quit)\s*[.!]*\s*$/i;
const PLAIN_STOP_RE = /\b(stop (texting|messaging|sending)|unsubscribe|opt[ -]?out|remove me|no more (texts|messages)|leave me alone|do not text)\b/i;
const twiml = text => new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Message>' + String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</Message></Response>', { headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-store' } });
async function twilioSigOk(request, env, params) {
  const token = typeof env.TWILIO_TOKEN === 'string' ? env.TWILIO_TOKEN.trim() : '';
  if (!token) return false;
  const url = env.TWILIO_INBOUND_URL || request.url;
  const data = url + Object.keys(params).sort().map(k => k + params[k]).join('');
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(token), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)))));
  return safeEq(sig, request.headers.get('X-Twilio-Signature') || '');
}
async function smsInbound(request, env) {
  if (!(typeof env.TWILIO_TOKEN === 'string' && env.TWILIO_TOKEN.trim())) return json({ error: 'inbound-off' }, 503);
  let params;
  try { params = Object.fromEntries(new URLSearchParams(await request.text()).entries()); } catch (e) { return json({ error: 'bad-body' }, 400); }
  if (!(await twilioSigOk(request, env, params))) return json({ error: 'bad-signature' }, 403);
  const from = normalise(params.From), text = String(params.Body || '').trim();
  if (!from || from.kind !== 'sms') return twiml('Thirsty Beaches: this number cannot be used.');
  if (STOP_RE.test(text) || PLAIN_STOP_RE.test(text)) {
    await removeContact(env, from.id);
    return twiml("Thirsty Beaches: you're unsubscribed and won't get any more texts.");
  }
  if (/^\s*help\s*[.!]*\s*$/i.test(text)) return twiml('Thirsty Beaches texts: stops & specials, a few msgs/mo. Msg & data rates may apply. Reply STOP to cancel. Help: hello@thirstybeaches.com');
  if (/^\s*(yes|y|yep|yeah|confirm)\s*[.!]*\s*$/i.test(text)) {
    const rec = await confirmContact(env, from.id, 'sms-reply');
    return twiml(rec ? "Thirsty Beaches: you're in! A few msgs/mo about stops & specials. Reply STOP to cancel, HELP for help." : 'Thirsty Beaches: you are already set. Reply STOP to cancel, HELP for help.');
  }
  return twiml('Thirsty Beaches: reply YES to confirm alerts, STOP to cancel, HELP for help.');
}

export default {
  /* hourly cron (wrangler.jsonc "triggers") — quote reminders only */
  async scheduled(event, env, ctx) {
    const job = quoteReminders(env, event && event.scheduledTime ? event.scheduledTime : Date.now())
      .then(r => console.log('quote reminders', JSON.stringify(r)))
      .catch(e => console.log('quote reminders failed', String(e)));
    if (ctx && ctx.waitUntil) ctx.waitUntil(job); else await job;
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    /* preflight for every route, incl. the owner app (https://nicholasroper-cloud.github.io) sending
       Authorization to /quotes, /card/byphone and /kiosk/status?full=1 */
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } });

    if (path === '/kiosk/ping' && request.method === 'POST') return kioskPing(request, env);
    if (path === '/kiosk/status' && request.method === 'GET') return kioskStatus(request, env, url);

    if (path === '/where' && request.method === 'GET') {
      const raw = await env.TB_LOC.get('current');
      if (!raw) return json({ open: false, reason: 'no-data' });
      const d = JSON.parse(raw);
      const now = Date.now();
      const since = d.since || d.updated;
      const ageMin = (now - d.updated) / 60000;
      /* open stays open until /close, or OPEN_MAX_MS after it was opened (forgot to close) */
      if (!d.open || now - since > OPEN_MAX_MS) {
        return json({ open: false, lastSeen: d.updated, label: d.label || null, expired: d.open ? true : undefined });
      }
      return json({ open: true, lat: d.lat, lng: d.lng, label: d.label || null,
                    updated: d.updated, since, ageMin: Math.round(ageMin) });
    }

    if (path === '/update' && request.method === 'POST') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      let body = {};
      body = (await readJson(request)) || {};
      const lat = parseFloat(body.lat != null ? body.lat : url.searchParams.get('lat'));
      const lng = parseFloat(body.lng != null ? body.lng : url.searchParams.get('lng'));
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return json({ error: 'bad-coords' }, 400);
      }
      const label = String(body.label != null ? body.label : (url.searchParams.get('label') || '')).slice(0, 80);
      const op = body.open != null ? body.open : url.searchParams.get('open');
      const open = (op == null) ? true : !(op === false || op === 'false' || op === '0');
      const now = Date.now();
      let prev = null;
      try { prev = JSON.parse((await env.TB_LOC.get('current')) || 'null'); } catch (e) { prev = null; }
      const prevLive = !!(prev && prev.open && now - (prev.since || prev.updated) <= OPEN_MAX_MS);
      /* the trailer page's 30-minute background refresh never re-opens a closed or expired pin */
      if (body.refresh === true && !prevLive) {
        return json({ ok: false, open: false, reason: prev && prev.open ? 'expired' : 'closed' }, 409);
      }
      const record = { lat, lng, label: body.refresh === true && !label ? prev.label || '' : label, open, updated: now };
      if (open) record.since = prevLive ? (prev.since || prev.updated) : now;
      await env.TB_LOC.put('current', JSON.stringify(record));
      return json(Object.assign({ ok: true }, record));
    }

    if (path === '/close' && request.method === 'POST') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      const raw = await env.TB_LOC.get('current');
      const prev = raw ? JSON.parse(raw) : {};
      await env.TB_LOC.put('current', JSON.stringify(Object.assign({}, prev, { open: false, updated: Date.now() })));
      return json({ ok: true, open: false });
    }

    if (path === '/schedule' && request.method === 'GET') {
      const raw = await env.TB_LOC.get('schedule');
      const stops = raw ? JSON.parse(raw) : [];
      const today = new Date(Date.now()).toISOString().slice(0, 10);
      const upcoming = stops.filter(s => (s.date || '') >= today)
                            .sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
      return json({ stops: upcoming.slice(0, 12) });
    }

    if (path === '/schedule' && request.method === 'POST') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      let body = {};
      body = await readJson(request); if (!body) return json({ error: 'bad-json' }, 400);
      if (!Array.isArray(body.stops)) return json({ error: 'stops-required' }, 400);
      const clean = body.stops.slice(0, 30).map(s => ({
        date:  String(s.date  || '').slice(0, 10),
        label: String(s.label || '').slice(0, 80),
        start: String(s.start || '').slice(0, 8),
        end:   String(s.end   || '').slice(0, 8),
        note:  String(s.note  || '').slice(0, 120),
      })).filter(s => s.date && s.label);
      await env.TB_LOC.put('schedule', JSON.stringify(clean));
      return json({ ok: true, count: clean.length });
    }

    if (path === '/subscribe' && request.method === 'POST') return subscribe(request, env);
    /* public: can a confirmation message actually be sent? The signup form stays hidden until the answer is yes. */
    if (path === '/subscribe/status' && request.method === 'GET') return json({ sms: twilioOn(env), email: Boolean(env.RESEND_API_KEY) });
    if (path === '/subscribe/confirm' && request.method === 'POST') return confirmByCode(request, env);
    if (path === '/unsubscribe' && request.method === 'POST') return selfUnsub(request, env);
    if (path === '/sms/inbound' && request.method === 'POST') return smsInbound(request, env);

    if (path === '/twilio/status' && request.method === 'GET') return twilioStatus(env);
    if (path === '/broadcast' && request.method === 'GET') return broadcastStatus(request, env);
    if (path === '/broadcast' && request.method === 'POST') return broadcast(request, env);

    if (path === '/subs' && request.method === 'GET') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      const out = [];
      for (const [prefix, status] of [['csub:', 'confirmed'], ['pend:', 'pending'], ['sub:', 'legacy-unconfirmed']]) {
        const list = await env.TB_LOC.list({ prefix });
        for (let i = 0; i < list.keys.length; i += 25) {
          const vals = await Promise.all(list.keys.slice(i, i + 25).map(k => env.TB_LOC.get(k.name)));
          for (const v of vals) { if (!v) continue; try { const r = JSON.parse(v); delete r.code; out.push({ ...r, status }); } catch (e) { /* skip */ } }
        }
      }
      out.sort((a, b) => (b.ts || b.joined || 0) - (a.ts || a.joined || 0));
      const by = st => out.filter(o => o.status === st).length;
      return json({ count: out.length, confirmed: by('confirmed'), pending: by('pending'), legacy: by('legacy-unconfirmed'), subscribers: out });
    }

    /* staff: confirm a pending signup by hand (the person told us in person, or no SMS sender is wired yet)  {contact} */
    if (path === '/subs/confirm' && request.method === 'POST') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      const body = await readJson(request); if (!body) return json({ error: 'bad-json' }, 400);
      const who = normalise(body.contact);
      if (!who) return json({ error: 'bad-contact' }, 400);
      const rec = await confirmContact(env, who.id, 'staff');
      return rec ? json({ ok: true, confirmed: who.id }) : json({ error: 'not-pending' }, 404);
    }

    /* staff: re-confirm the old list (signups from before double opt-in): moves each legacy sub: into pending and sends the
       confirmation text/email where a sender exists. Up to TWILIO_PER_SEND per call. Nothing is marketed until they reply YES. */
    if (path === '/subs/reconfirm' && request.method === 'POST') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      const per = Math.max(1, Math.min(200, parseInt(env.TWILIO_PER_SEND, 10) || 45));
      const list = await env.TB_LOC.list({ prefix: 'sub:', limit: per });
      let queued = 0, sent = 0;
      for (const k of list.keys) {
        const id = k.name.slice(4), who = normalise(id);
        if (!who) { console.log('reconfirm: dropped an unparseable legacy sub: key'); await env.TB_LOC.delete(k.name); continue; }
        /* already pending or confirmed (they signed up again on the new form): keep that record, never overwrite its
           consent data or reset its send counter, just retire the legacy key */
        if (await env.TB_LOC.get('pend:' + who.id) || await env.TB_LOC.get('csub:' + who.id)) { await env.TB_LOC.delete(k.name); continue; }
        const rec = await newPending(env, who, { source: 'legacy', consentVersion: null });
        queued++;
        if (await sendConfirmation(env, rec)) sent++;
        await env.TB_LOC.delete(k.name);
      }
      return json({ ok: true, queued, sent, left: !list.list_complete });
    }

    if (path === '/unsub' && request.method === 'POST') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      const body = (await readJson(request)) || {};
      const who = normalise(body.contact);
      if (!who) return json({ error: 'bad-contact' }, 400);
      await removeContact(env, who.id);
      return json({ ok: true, removed: who.id });
    }


    /* ---------- event / catering quote requests ---------- */
    if (path === '/quote' && request.method === 'POST') {
      let body = {};
      body = await readJson(request); if (!body) return json({ error: 'bad-json' }, 400);
      if (String(body.website || '').trim()) return json({ ok: true }); // honeypot: bots fill every field
      const t = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
      const q = {
        name: t(body.name, 80), email: t(body.email, 120).toLowerCase(), phone: t(body.phone, 30),
        event: t(body.event, 40), date: t(body.date, 10), city: t(body.city, 120),
        guests: t(body.guests, 20), hours: t(body.hours, 20),
        services: (Array.isArray(body.services) ? body.services : []).map(x => t(x, 30)).filter(Boolean).slice(0, 6),
        pay: t(body.pay, 40), notes: String(body.notes || '').trim().slice(0, 1500),
        page: t(body.page, 120),
      };
      const missing = ['name', 'email', 'event', 'date', 'city', 'guests'].filter(k => !q[k]);
      if (missing.length) return json({ error: 'missing', fields: missing }, 400);
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(q.email)) return json({ error: 'bad-email', fields: ['email'] }, 400);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date)) return json({ error: 'bad-date', fields: ['date'] }, 400);

      // light per-IP limit: 5 requests an hour
      const ipRaw = request.headers.get('cf-connecting-ip') || '0.0.0.0';
      const ipHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(ipRaw + '|' + (env.TB_SECRET || ''))))).slice(0, 8)
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const rlKey = 'qrl:' + ipHash;
      const n = parseInt((await env.TB_LOC.get(rlKey)) || '0', 10) || 0;
      if (n >= 5) return json({ error: 'slow-down' }, 429);
      await env.TB_LOC.put(rlKey, String(n + 1), { expirationTtl: 3600 });

      const at = Date.now();
      const id = at.toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      // key sorts newest-first: invert the timestamp
      const key = quoteKey(at, id);
      const rec = { id, at, ...q, status: 'new' };
      await env.TB_LOC.put(key, JSON.stringify(rec), { metadata: quoteMeta(rec) });
      if (env.QUOTE_WEBHOOK || relayOn(env) || env.QUOTE_SMS_UTAH || env.QUOTE_SMS_FLORIDA || env.RESEND_API_KEY) {
        // every channel swallows its own errors: a failed alert or email never fails the quote
        const send = Promise.all([
          ownerQuoteAlert(env, rec),
          smsQuote(env, rec),
          ackEmail(env, rec),
        ]).catch(e => console.log('quote follow-up failed', String(e)));
        if (ctx && ctx.waitUntil) ctx.waitUntil(send); else await send;   // don't make the customer wait
      }
      return json({ ok: true, id });
    }

    if (path === '/quotes' && request.method === 'GET') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10) || 50);
      const list = await env.TB_LOC.list({ prefix: 'quote:', limit });
      const out = [];
      for (const k of list.keys) {
        const v = await env.TB_LOC.get(k.name);
        if (v) out.push(JSON.parse(v));
      }
      return json({ count: out.length, quotes: out });
    }

    /* staff: set a quote's follow-up status {id, status: new|replied|booked|declined} — one KV write */
    if (path === '/quote/status' && request.method === 'POST') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      let body = {};
      body = await readJson(request); if (!body) return json({ error: 'bad-json' }, 400);
      const id = String(body.id || '');
      const status = String(body.status || '');
      if (!QUOTE_STATUSES.includes(status)) return json({ error: 'bad-status' }, 400);
      const m = id.match(/^([0-9a-z]{6,10})-[0-9a-z]{1,8}$/);
      if (!m) return json({ error: 'bad-id' }, 400);
      const key = quoteKey(parseInt(m[1], 36), id);
      const raw = await env.TB_LOC.get(key);
      if (!raw) return json({ error: 'no-quote' }, 404);
      const q = JSON.parse(raw);
      if ((q.status || 'new') !== status) {
        q.status = status; q.statusAt = Date.now();
        await env.TB_LOC.put(key, JSON.stringify(q), { metadata: quoteMeta(q) });
      }
      return json({ ok: true, id, status: q.status, statusAt: q.statusAt || null });
    }

    /* ---------- arcade leaderboard ---------- */
    if (path === '/scores' && request.method === 'GET') {
      const raw = await env.TB_LOC.get('scores');
      return json({ scores: raw ? JSON.parse(raw) : [] });
    }

    /* A game starts: the server signs a play token (PLAY_SECRET, its own secret, never TB_SECRET). The token proves a
       real session took time; the score itself is still client-reported, so everything valuable (prize code, draw entry,
       leaderboard slot) is bound to a valid, unused, old-enough token and capped per IP. Minting writes nothing to KV. */
    if (path === '/scores/token' && request.method === 'GET') {
      if (!playSecret(env)) return json({ error: 'play-off' }, 503);
      const rl = 'mint:' + ipOf(request);
      if (tooMany(rl, MINT_PER_IP_PER_HOUR, 3600e3)) return json({ error: 'slow-down' }, 429);
      hit(rl);
      return json({ token: await mintPlayToken(env), minMs: PLAY_MIN_MS });
    }

    if (path === '/scores' && request.method === 'POST') {
      const body = await readJson(request); if (!body) return json({ error: 'bad-json' }, 400);

      const score = Math.floor(Number(body.score));
      if (!isFinite(score) || score < 0 || score > 20000) return json({ error: 'bad-score' }, 400);
      const who = String(body.who || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'TB';
      const today = localDay();
      const WIN = 2000;

      const rawTop = await env.TB_LOC.get('scores');
      let top = rawTop ? JSON.parse(rawTop) : [];

      /* per-IP speed bump on claims (isolate memory, no KV) */
      const rl = 'scorepost:' + ipOf(request);
      if (tooMany(rl, 12, 10 * 60000)) return json({ error: 'slow-down' }, 429);
      hit(rl);

      const tokenId = await verifyPlayToken(env, body.token);
      if (!tokenId) {
        /* no valid session: nothing is recorded, no code, no draw entry */
        return json({ ok: true, top, rank: 0, code: null, prize: score >= WIN ? 'no-token' : 'below-bar', threshold: WIN, draw: null });
      }
      /* single use: the marker is written before anything is awarded, so a replay finds it */
      const usedKey = 'playused:' + tokenId;
      if (await env.TB_LOC.get(usedKey)) return json({ ok: true, top, rank: 0, code: null, prize: score >= WIN ? 'already-claimed' : 'below-bar', threshold: WIN, draw: null });
      await env.TB_LOC.put(usedKey, '1', { expirationTtl: 60 * 60 * 8 });

      top.push({ who, score, at: Date.now() });
      top.sort((a, b) => b.score - a.score);
      top = top.slice(0, 10);
      await env.TB_LOC.put('scores', JSON.stringify(top));

      const ih = await ipHash(env, request);

      /* the prize: one per network per day, a daily cap for the whole site, and only above the bar */
      let code = null, prize = 'below-bar';
      if (score >= WIN) {
        const ipKey = 'prizeip:' + today + ':' + ih, dayKey = 'prizecount:' + today;
        const cap = Math.max(1, parseInt(env.PRIZE_DAILY_CAP, 10) || 100);
        if (await env.TB_LOC.get(ipKey)) prize = 'already-claimed';
        else if (await count(env, dayKey) >= cap) prize = 'sold-out';
        else {
          code = await newCode(env, { token: tokenId, who, score, day: today });
          if (code) {
            await env.TB_LOC.put(ipKey, code, { expirationTtl: 60 * 60 * 30 });
            await bump(env, dayKey, 60 * 60 * 30);
          }
          prize = code ? 'won' : 'none';
        }
      }

      /* weekly draw (only while DRAW_ENABLED="true", i.e. once the official rules are published): one entry per
         network per week, a 500+ score qualifies, the best score is kept. The player gets a TICKET code and nothing
         else is collected; the winning ticket is posted on /maze-rules and claimed at the window. */
      let draw = null;
      if (drawOn(env) && score >= 500) {
        const wk = weekId(), dkey = 'draw:' + wk + ':' + ih;
        let entry = null;
        try { entry = JSON.parse((await env.TB_LOC.get(dkey)) || 'null'); } catch (e) { entry = null; }
        if (!entry) {
          entry = { ticket: await newTicket(), who, score, token: tokenId, at: Date.now() };
          await env.TB_LOC.put(dkey, JSON.stringify(entry), { expirationTtl: 60 * 60 * 24 * 45 });
          draw = { week: wk, ticket: entry.ticket, already: false };
        } else {
          if (score > entry.score) { entry.score = score; entry.who = who; await env.TB_LOC.put(dkey, JSON.stringify(entry), { expirationTtl: 60 * 60 * 24 * 45 }); }
          draw = { week: wk, ticket: entry.ticket, already: true };
        }
      }

      return json({ ok: true, top, rank: top.findIndex(x => x.score === score && x.who === who) + 1,
                    code, prize, threshold: WIN, draw });
    }

    /* kiosk / window: check or redeem a Maze prize code.
       {code}               -> status only (rate limited per IP)
       {code, redeem:true}  -> marks it used (one shot). Needs the kiosk key (header X-Kiosk-Key = KIOSK_KEY): without
                               it anyone could probe for valid MAZE-###### codes and burn them. A missing KIOSK_KEY
                               means redeeming is off (503), never open.
       The punch card's "use a free drink" is POST /card/redeem, not this route. */
    if (path === '/redeem' && request.method === 'POST') {
      const body = await readJson(request); if (!body) return json({ error: 'bad-json' }, 400);
      const rl = 'redeem:' + ipOf(request);
      if (tooMany(rl, 30, 10 * 60000)) return json({ error: 'slow-down' }, 429);
      hit(rl);
      const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const m = code.match(/^MAZE(\d{6})$/);
      if (!m) return json({ ok: false, status: 'unknown' });
      if (body.redeem === true) {
        if (!(typeof env.KIOSK_KEY === 'string' && env.KIOSK_KEY.trim().length >= 24)) return json({ error: 'redeem-off' }, 503);
        if (!kioskKeyOk(request, env)) return json({ error: 'unauthorized' }, 401);
      }
      const key = 'code:MAZE-' + m[1];
      const raw = await env.TB_LOC.get(key);
      if (!raw) return json({ ok: false, status: 'unknown' });
      const rec = JSON.parse(raw);
      if (rec.redeemed) return json({ ok: false, status: 'used', usedAt: rec.redeemedAt || null });
      if (body.redeem === true) {
        /* the claim key goes down first, so a second request that read the record a moment ago still finds it */
        const claimKey = 'redeeming:MAZE-' + m[1];
        if (await env.TB_LOC.get(claimKey)) return json({ ok: false, status: 'used', usedAt: null });
        await env.TB_LOC.put(claimKey, String(Date.now()), { expirationTtl: 60 * 60 * 24 * 14 });
        rec.redeemed = true; rec.redeemedAt = Date.now(); rec.redeemedBy = String(body.by || 'kiosk').slice(0, 24);
        await env.TB_LOC.put(key, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 14 });
        return json({ ok: true, status: 'redeemed', prize: 'upsize', discountId: '1JWEYE5W54K84' });
      }
      return json({ ok: true, status: 'valid', prize: 'upsize', discountId: '1JWEYE5W54K84' });
    }

    /* staff: the weekly draw. GET /draw[?week=2026-W41] lists the entries (ticket + score, nothing identifying) and picks
       the winner (deterministic from the secret and the sorted entries, so re-running gives the same answer). */
    if (path === '/draw' && request.method === 'GET') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      const wk = (url.searchParams.get('week') || weekId()).replace(/[^0-9W-]/g, '').slice(0, 8);
      const entries = await drawEntries(env, wk);
      return json({ week: wk, enabled: drawOn(env), entries: entries.length, winner: await pickWinner(env, wk, entries), all: entries });
    }

    /* public: last week's winning TICKET (posted Mondays, shown on /maze-rules). Computed once, then served from KV. */
    if (path === '/draw/last' && request.method === 'GET') {
      const t = new Date(Date.now()); t.setUTCDate(t.getUTCDate() - 7);
      const wk = weekId(t);
      let rec = null;
      try { rec = JSON.parse((await env.TB_LOC.get('drawwin:' + wk)) || 'null'); } catch (e) { rec = null; }
      if (!rec) {
        const entries = await drawEntries(env, wk);
        const w = await pickWinner(env, wk, entries);
        rec = { week: wk, ticket: w ? w.ticket : null, entries: entries.length, at: Date.now() };
        if (entries.length) await env.TB_LOC.put('drawwin:' + wk, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 60 });
      }
      return json({ week: rec.week, ticket: rec.ticket, claimed: Boolean(rec.claimedAt), enabled: drawOn(env) });
    }

    /* staff at the window: check a winning ticket and mark it claimed (once). {ticket} */
    if (path === '/draw/claim' && request.method === 'POST') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      const body = await readJson(request); if (!body) return json({ error: 'bad-json' }, 400);
      const ticket = String(body.ticket || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^DRAW/, '');
      if (ticket.length !== 6) return json({ ok: false, error: 'bad-ticket' }, 400);
      for (const back of [7, 14, 21, 28]) {                 // winners are posted for 30 days
        const t = new Date(Date.now()); t.setUTCDate(t.getUTCDate() - back);
        const wk = weekId(t), key = 'drawwin:' + wk;
        let rec = null; try { rec = JSON.parse((await env.TB_LOC.get(key)) || 'null'); } catch (e) { rec = null; }
        if (rec && rec.ticket === 'DRAW-' + ticket) {
          if (rec.claimedAt) return json({ ok: false, status: 'already-claimed', week: wk });
          rec.claimedAt = Date.now();
          await env.TB_LOC.put(key, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 60 });
          return json({ ok: true, status: 'claimed', week: wk });
        }
      }
      return json({ ok: false, status: 'not-a-winner' });
    }

    /* how many prizes went out today (local trailer day) — staff can sanity-check at the window */
    if (path === '/prizes' && request.method === 'GET') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      const day = localDay();
      return json({ date: day, issued: await count(env, 'prizecount:' + day), code: await dayCode(env) });
    }

    /* staff: today's code, so you can check it at the window */
    if (path === '/todaycode' && request.method === 'GET') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      return json({ code: await dayCode(env), date: localDay() });
    }


    /* ---------- loyalty ---------- */
    /* A card lives under a random id held on the customer's phone.
       Only a request carrying today's staff code can add a punch, so
       nobody can punch their own card from the car park.            */

    if (path === '/card/redeem' && request.method === 'POST') {
      const body = await readJson(request); if (!body) return json({ error: 'bad-json' }, 400);
      return redeemCard(env, body, request);
    }
    if (path === '/card/claim' && request.method === 'POST') return cardClaim(request, env);
    if (path === '/card/link' && request.method === 'POST') return cardLink(request, env);
    if (path === '/card/recover' && request.method === 'POST') return cardRecover(request, env);
    if (path === '/card/byphone' && request.method === 'GET') return cardByPhone(request, env, url);

    if (path === '/card' && request.method === 'GET') {
      const id = (url.searchParams.get('id') || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);
      if (!id) return json({ error: 'no-id' }, 400);
      const raw = await env.TB_LOC.get('card:' + id);
      /* exists:false lets the staff "Punch a card" screen warn about a mistyped id */
      const card = raw ? JSON.parse(raw) : { id, punches: 0, redeemed: 0, created: Date.now(), exists: false };
      return json(card);
    }

    if (path === '/punch' && request.method === 'POST') {
      let body = {};
      body = await readJson(request); if (!body) return json({ error: 'bad-json' }, 400);

      const id = String(body.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);
      if (!id) return json({ error: 'no-id' }, 400);

      /* staff proof: today's code (with or without UPSIZE-), or the full secret; too many wrong codes -> 429 */
      const gate = await staffGate(request, env, body.staff);
      if (gate) return gate;

      const raw = await env.TB_LOC.get('card:' + id);
      const card = raw ? JSON.parse(raw) : { id, punches: 0, redeemed: 0, created: Date.now() };
      if (card.mergedInto) return json({ error: 'merged', into: card.mergedInto }, 409);

      /* one punch per 3 minutes stops double taps and queue-hopping */
      if (card.last && Date.now() - card.last < 180000) {
        return json({ error: 'too-soon', card }, 429);
      }

      const earned = addPunches(card, 1) > 0;
      card.last = Date.now();
      await env.TB_LOC.put('card:' + id, JSON.stringify(card));
      return json({ ok: true, earned, card });
    }

    /* customer redeems their free drink: handled in POST /redeem above (redeemCard) */

    return json({ error: 'not-found' }, 404);
  },
};